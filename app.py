# app.py
import asyncio
import time
import ipaddress
from typing import Dict, List, Tuple
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

import httpx
from fastapi import FastAPI, Query, Response, HTTPException, Request


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Upstream service that returns category-based M3U playlists
UPSTREAM_BASE = "https://search-ace.stream/playlist"

# Hardcoded Ace Stream engine connection value
ENGINE_BASE_URL = "https://streaming-television.pavel-usanli.online"

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
#   Key:   None (since we removed params, we have a single entry)
#   Value: (expires_timestamp, playlist_bytes)
# ---------------------------------------------------------------------------

CACHE: Dict[str, Tuple[float, bytes]] = {}
CACHE_TTL_SECONDS = 30  # small TTL improves performance without going stale


# Disable automatic trailing-slash redirects (some IPTV clients dislike 307/308)
app = FastAPI(redirect_slashes=False)


# ---------------------------------------------------------------------------
# Utility Functions
# ---------------------------------------------------------------------------

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


def rewrite_acestream_url(url: str) -> str:
    """
    Rewrite Ace Stream engine URL from getstream to its original path.
    All original query parameters are preserved and appended to the new URL.

    Input (example):
      http://127.0.0.1:6878/ace/getstream?infohash=...&pid=1

    Output:
      https://streaming-television.pavel-usanli.online/ace/getstream?infohash=...&pid=1
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

        # Preserve original query parameters exactly as received (no renaming)
        new_qs = qs.copy()

        # Encode the query parameters back unchanged
        new_query = urlencode(new_qs, doseq=True)

        # Construct the new URL
        # We replace the scheme, netloc, path and query
        new_url_parts = list(p)
        
        # Parse ENGINE_BASE_URL to get its components
        engine_p = urlparse(ENGINE_BASE_URL)
        
        new_url_parts[0] = engine_p.scheme  # scheme
        new_url_parts[1] = engine_p.netloc  # netloc
        new_url_parts[2] = p.path # path (keep original)
        new_url_parts[4] = new_query # query
        
        return urlunparse(new_url_parts)
    except Exception:
        # If anything looks odd, keep original URL
        return url


def transform_playlist(content: str, group_name: str) -> List[str]:
    """
    Transform upstream playlist format into IPTV-friendly format and
    rewrite Ace Stream engine URLs.

    Upstream example:
        #EXTM3U
        #EXTINF:-1,Channel Name
        http://stream-url

    Output:
        #EXTINF:0,Channel Name
        #EXTGRP:<Russian Group Name>
        https://streaming-television.pavel-usanli.online/ace/getstream?infohash=... (rewritten if Ace getstream)
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
                    url = rewrite_acestream_url(url)
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
    extra_params: dict = None,
) -> str:
    """
    Fetch a single category playlist from upstream.

    Args:
        client: Async HTTPX client.
        category: Upstream category name.
        extra_params: Optional query parameters to pass to upstream.
    """
    params = {
        "category": category,
    }
    if extra_params:
        params.update(extra_params)

    response = await client.get(UPSTREAM_BASE, params=params, follow_redirects=True)
    response.raise_for_status()
    return response.text


async def build_playlist(extra_params: dict = None) -> bytes:
    """
    Build combined playlist by:
        1. Fetching all categories concurrently
        2. Transforming them (+ URL rewrite)
        3. Concatenating into a single M3U file
        4. Caching result

    The cache key includes sorted query parameters to ensure correct isolation
    between requests with different extra parameters (e.g., auth tokens).

    Args:
        extra_params: Optional query parameters to forward to upstream and
                      include in the cache key.
    """
    # Cache key should now include query parameters to avoid serving wrong playlist
    cache_key = f"playlist:{urlencode(sorted(extra_params.items()))}" if extra_params else "default"
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
            fetch_category(client, category, extra_params)
            for category, _ in pairs
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    combined: List[str] = [HEADER]

    # Merge results into one playlist
    for (category, group_name), result in zip(pairs, results):
        if isinstance(result, Exception):
            # Skip failed category without failing entire playlist
            continue

        combined.extend(transform_playlist(result, group_name))

    # Use CRLF for maximum IPTV compatibility
    final = "\r\n".join(combined) + "\r\n"
    payload = final.encode("utf-8")

    # Store in cache
    CACHE[cache_key] = (now + CACHE_TTL_SECONDS, payload)

    return payload


# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------

@app.api_route("/playlist.m3u8", methods=["GET", "HEAD"])
async def playlist_m3u8(request: Request):
    """
    Standard IPTV M3U playlist extension endpoint.
    All incoming query parameters are forwarded to the upstream service.
    """
    extra_params = dict(request.query_params)
    payload = await build_playlist(extra_params)
    body = b"" if request.method == "HEAD" else payload

    return Response(
        content=body,
        media_type="application/octet-stream",
        headers=response_headers(),
    )
