# app.py
import asyncio
import time
import ipaddress
from typing import Dict, List, Tuple
from urllib.parse import urlparse, parse_qs

import httpx
from fastapi import FastAPI, Query, Response, HTTPException, Request


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Upstream service that returns category-based M3U playlists
UPSTREAM_BASE = "https://search-ace.stream/playlist"

# Default Ace Stream engine connection values
DEFAULT_ENGINE_IP = "192.168.1.50"
DEFAULT_ENGINE_PORT = 6878

# Mapping:
#   key   -> upstream category name (used in API request)
#   value -> Russian group name shown in IPTV player (#EXTGRP)
CATEGORY_GROUPS_RU: Dict[str, str] = {
    "informational": "Информационные",
    "entertaining": "Развлекательные",
    "educational": "Образовательные",
    "movies": "Фильмы",
    "documentaries": "Документальные",
    "sport": "Спорт",
    "fashion": "Мода",
    "music": "Музыка",
    "regional": "Региональные",
    "ethnic": "Этнические",
    "religion": "Религия",
    "teleshop": "Телемагазин",
    "erotic_18_plus": "Эротика 18+",
    "other_18_plus": "Для взрослых 18+",
    "cyber_games": "Киберспорт",
    "amateur": "Любительские",
    "webcam": "Вебкам",
}

# Custom M3U header (Flussonic-compatible catchup + EPG)
HEADER = '#EXTM3U catchup="flussonic" url-tvg="https://ip-tv.dev/epg/epg.xml.gz"'


# ---------------------------------------------------------------------------
# Simple in-memory cache
#   Key:   (engine_ip, engine_port)
#   Value: (expires_timestamp, playlist_bytes)
# ---------------------------------------------------------------------------

CACHE: Dict[Tuple[str, int], Tuple[float, bytes]] = {}
CACHE_TTL_SECONDS = 30  # small TTL improves performance without going stale


# Disable automatic trailing-slash redirects (some IPTV clients dislike 307/308)
app = FastAPI(redirect_slashes=False)


# ---------------------------------------------------------------------------
# Utility Functions
# ---------------------------------------------------------------------------

def validate_engine_ip(value: str) -> str:
    """
    Validate that engine_ip is a valid IPv4 or IPv6 address.
    Raises HTTP 422 if invalid.
    """
    try:
        ipaddress.ip_address(value)
        return value
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"Invalid engine_ip: {value}") from e


def response_headers() -> dict:
    """
    Return IPTV-compatible headers.
    Mimics iptv.online response style.
    """
    return {
        "access-control-allow-origin": "*",
        "cache-control": "max-age=1, private, must-revalidate",
        "pragma": "public",
        "expires": "0",
        "content-disposition": "attachment; filename=playlist.m3u",
    }


def rewrite_acestream_url(url: str, engine_ip: str, engine_port: int) -> str:
    """
    Rewrite Ace Stream engine URL from getstream to manifest.m3u8.

    Input (example):
      http://192.168.1.50:6878/ace/getstream?infohash=...&pid=1

    Output:
      http://192.168.1.50:6878/ace/manifest.m3u8?id=...
    """
    try:
        p = urlparse(url)

        # Only rewrite Ace engine getstream URLs
        if p.path.rstrip("/") != "/ace/getstream":
            return url

        qs = parse_qs(p.query)
        infohash_list = qs.get("infohash")
        if not infohash_list:
            return url

        infohash = infohash_list[0].strip()
        if not infohash:
            return url

        return f"http://{engine_ip}:{engine_port}/ace/manifest.m3u8?id={infohash}"
    except Exception:
        # If anything looks odd, keep original URL
        return url


def transform_playlist(content: str, group_name: str, engine_ip: str, engine_port: int) -> List[str]:
    """
    Transform upstream playlist format into IPTV-friendly format and
    rewrite Ace Stream engine URLs to manifest.m3u8.

    Upstream example:
        #EXTM3U
        #EXTINF:-1,Channel Name
        http://stream-url

    Output:
        #EXTINF:0,Channel Name
        #EXTGRP:<Russian Group Name>
        http://stream-url (rewritten if Ace getstream)
    """
    lines = content.splitlines()
    out: List[str] = []

    i = 0
    while i < len(lines):
        line = lines[i].strip()

        # Skip empty lines and original header
        if not line or line.startswith("#EXTM3U"):
            i += 1
            continue

        # Process channel entries
        if line.startswith("#EXTINF"):
            # Normalize duration (-1 -> 0)
            out.append(line.replace("#EXTINF:-1", "#EXTINF:0", 1))

            # Add IPTV group name
            out.append(f"#EXTGRP:{group_name}")

            # Append stream URL if present
            if i + 1 < len(lines):
                url = lines[i + 1].strip()
                if url and not url.startswith("#"):
                    url = rewrite_acestream_url(url, engine_ip, engine_port)
                    out.append(url)
                    i += 1

        i += 1

    return out


# ---------------------------------------------------------------------------
# Upstream Fetching
# ---------------------------------------------------------------------------

async def fetch_category(
    client: httpx.AsyncClient,
    category: str,
    engine_ip: str,
    engine_port: int,
) -> str:
    """
    Fetch a single category playlist from upstream.
    """
    params = {
        "category": category,
        "engine_ip": engine_ip,
        "engine_port": str(engine_port),
    }

    response = await client.get(UPSTREAM_BASE, params=params, follow_redirects=True)
    response.raise_for_status()
    return response.text


async def build_playlist(engine_ip: str, engine_port: int) -> bytes:
    """
    Build combined playlist by:
        1. Fetching all categories concurrently
        2. Transforming them (+ URL rewrite)
        3. Concatenating into a single M3U file
        4. Caching result
    """
    cache_key = (engine_ip, engine_port)
    now = time.time()

    # Serve from cache if valid
    cached = CACHE.get(cache_key)
    if cached and cached[0] > now:
        return cached[1]

    timeout = httpx.Timeout(connect=8.0, read=20.0, write=8.0, pool=8.0)

    async with httpx.AsyncClient(timeout=timeout) as client:
        pairs = list(CATEGORY_GROUPS_RU.items())

        # Fetch all categories concurrently
        tasks = [
            fetch_category(client, category, engine_ip, engine_port)
            for category, _ in pairs
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    combined: List[str] = [HEADER]

    # Merge results into one playlist
    for (category, group_name), result in zip(pairs, results):
        if isinstance(result, Exception):
            # Skip failed category without failing entire playlist
            continue

        combined.extend(transform_playlist(result, group_name, engine_ip, engine_port))

    # Use CRLF for maximum IPTV compatibility
    final = "\r\n".join(combined) + "\r\n"
    payload = final.encode("utf-8")

    # Store in cache
    CACHE[cache_key] = (now + CACHE_TTL_SECONDS, payload)

    return payload


# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------

@app.api_route("/playlist", methods=["GET", "HEAD"])
async def playlist(
    request: Request,
    engine_ip: str = Query(DEFAULT_ENGINE_IP),
    engine_port: int = Query(DEFAULT_ENGINE_PORT, ge=1, le=65535),
):
    """
    Main endpoint.
    Returns combined M3U playlist.
    """
    engine_ip = validate_engine_ip(engine_ip)

    payload = await build_playlist(engine_ip, engine_port)
    body = b"" if request.method == "HEAD" else payload

    return Response(
        content=body,
        media_type="application/octet-stream",
        headers=response_headers(),
    )


@app.api_route("/playlist/", methods=["GET", "HEAD"])
async def playlist_slash(
    request: Request,
    engine_ip: str = Query(DEFAULT_ENGINE_IP),
    engine_port: int = Query(DEFAULT_ENGINE_PORT, ge=1, le=65535),
):
    """
    Same as /playlist but without redirect for trailing slash.
    Some IPTV clients break on redirects.
    """
    engine_ip = validate_engine_ip(engine_ip)

    payload = await build_playlist(engine_ip, engine_port)
    body = b"" if request.method == "HEAD" else payload

    return Response(
        content=body,
        media_type="application/octet-stream",
        headers=response_headers(),
    )
