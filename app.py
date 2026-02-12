from typing import List
import ipaddress

import httpx
from fastapi import FastAPI, Query, Response, HTTPException

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

app = FastAPI()


def validate_engine_ip(value: str) -> str:
    try:
        ipaddress.ip_address(value)
        return value
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"Invalid engine_ip: {value}") from e


async def fetch_category(
    client: httpx.AsyncClient,
    category: str,
    engine_ip: str,
    engine_port: int,
) -> str:
    params = {
        "category": category,
        "engine_ip": engine_ip,
        "engine_port": str(engine_port),
    }
    r = await client.get(UPSTREAM_BASE, params=params)
    r.raise_for_status()
    return r.text


def transform_playlist(content: str, category: str) -> List[str]:
    """
    Transforms upstream playlist into:
      #EXTINF:0,...
      #EXTGRP:<category>
      <url>
    Skips upstream #EXTM3U header lines.
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
            extinf = line.replace("#EXTINF:-1", "#EXTINF:0", 1)
            out.append(extinf)
            out.append(f"#EXTGRP:{category}")

            # Next line should be a URL; include it if present
            if i + 1 < len(lines):
                nxt = lines[i + 1].strip()
                if nxt and not nxt.startswith("#"):
                    out.append(nxt)
                    i += 1

        i += 1

    return out


@app.get("/playlist")
async def playlist(
    engine_ip: str = Query(DEFAULT_ENGINE_IP, description="Ace engine IP address"),
    engine_port: int = Query(
        DEFAULT_ENGINE_PORT, ge=1, le=65535, description="Ace engine port (1-65535)"
    ),
):
    engine_ip = validate_engine_ip(engine_ip)

    combined: List[str] = [HEADER]

    async with httpx.AsyncClient(timeout=60.0) as client:
        for category in CATEGORIES:
            content = await fetch_category(client, category, engine_ip, engine_port)
            combined.extend(transform_playlist(content, category))

    # Use CRLF for maximum IPTV/VLC compatibility
    final = "\r\n".join(combined) + "\r\n"

    return Response(
        content=final.encode("utf-8"),
        media_type="application/vnd.apple.mpegurl",
        headers={
            "Content-Disposition": 'inline; filename="playlist.m3u8"',
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
            "Access-Control-Allow-Origin": "*",
            "Accept-Ranges": "bytes",
        },
    )
