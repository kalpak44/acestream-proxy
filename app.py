from typing import List
import ipaddress

import httpx
from fastapi import FastAPI, Query, Response, HTTPException, Request

UPSTREAM_BASE = "https://search-ace.stream/playlist"

DEFAULT_ENGINE_IP = "192.168.1.50"
DEFAULT_ENGINE_PORT = 6878

CATEGORIES = [
    "informational",
    "entertaining",
    "educational",
    "movies",
    "documentaries",
    "sport",
    "fashion",
    "music",
    "regional",
    "ethnic",
    "religion",
    "teleshop",
    "erotic_18_plus",
    "other_18_plus",
    "cyber_games",
    "amateur",
    "webcam",
]

HEADER = '#EXTM3U catchup="flussonic" url-tvg="https://ip-tv.dev/epg/epg.xml.gz"'

# Prevent auto-redirects (some clients hate 307/308)
app = FastAPI(redirect_slashes=False)


def validate_engine_ip(value: str) -> str:
    try:
        ipaddress.ip_address(value)  # supports IPv4/IPv6
        return value
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"Invalid engine_ip: {value}") from e


async def fetch_category(
    client: httpx.AsyncClient,
    category: str,
    engine_ip: str,
    engine_port: int,
) -> str:
    params = {"category": category, "engine_ip": engine_ip, "engine_port": str(engine_port)}
    r = await client.get(UPSTREAM_BASE, params=params, follow_redirects=True)
    r.raise_for_status()
    return r.text


def transform_playlist(content: str, category: str) -> List[str]:
    """
    For each channel:
      #EXTINF:0,...
      #EXTGRP:<category>
      <url>
    """
    lines = content.splitlines()
    out: List[str] = []

    i = 0
    while i < len(lines):
        line = lines[i].strip()

        if not line or line.startswith("#EXTM3U"):
            i += 1
            continue

        if line.startswith("#EXTINF"):
            out.append(line.replace("#EXTINF:-1", "#EXTINF:0", 1))
            out.append(f"#EXTGRP:{category}")

            if i + 1 < len(lines):
                url = lines[i + 1].strip()
                if url and not url.startswith("#"):
                    out.append(url)
                    i += 1

        i += 1

    return out


def response_headers() -> dict:
    return {
        "Content-Disposition": 'inline; filename="playlist.m3u8"',
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "Access-Control-Allow-Origin": "*",
        "Accept-Ranges": "bytes",
    }


async def build_playlist(engine_ip: str, engine_port: int) -> bytes:
    engine_ip = validate_engine_ip(engine_ip)

    combined: List[str] = [HEADER]

    timeout = httpx.Timeout(connect=10.0, read=60.0, write=10.0, pool=10.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        for category in CATEGORIES:
            try:
                content = await fetch_category(client, category, engine_ip, engine_port)
                combined.extend(transform_playlist(content, category))
            except Exception:
                # Don't fail whole playlist if one category fails
                continue

    # CRLF for IPTV/VLC compatibility
    final = "\r\n".join(combined) + "\r\n"
    return final.encode("utf-8")


@app.api_route("/playlist", methods=["GET", "HEAD"])
async def playlist(
    request: Request,
    engine_ip: str = Query(DEFAULT_ENGINE_IP),
    engine_port: int = Query(DEFAULT_ENGINE_PORT, ge=1, le=65535),
):
    payload = await build_playlist(engine_ip, engine_port)
    body = b"" if request.method == "HEAD" else payload

    return Response(
        content=body,
        media_type="application/vnd.apple.mpegurl",
        headers=response_headers(),
    )


# Optional (helps clients/proxies that append trailing slash)
@app.api_route("/playlist/", methods=["GET", "HEAD"])
async def playlist_slash(
    request: Request,
    engine_ip: str = Query(DEFAULT_ENGINE_IP),
    engine_port: int = Query(DEFAULT_ENGINE_PORT, ge=1, le=65535),
):
    payload = await build_playlist(engine_ip, engine_port)
    body = b"" if request.method == "HEAD" else payload

    return Response(
        content=body,
        media_type="application/vnd.apple.mpegurl",
        headers=response_headers(),
    )
