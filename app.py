import asyncio
import time
import ipaddress
from typing import Dict, List, Tuple

import httpx
from fastapi import FastAPI, Query, Response, HTTPException, Request

UPSTREAM_BASE = "https://search-ace.stream/playlist"

DEFAULT_ENGINE_IP = "192.168.1.50"
DEFAULT_ENGINE_PORT = 6878"

# Upstream category -> Russian group name
CATEGORY_GROUPS_RU = {
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

HEADER = '#EXTM3U catchup="flussonic" url-tvg="https://ip-tv.dev/epg/epg.xml.gz"'

# Cache: (ip, port) -> (expires_at, payload_bytes)
CACHE: Dict[Tuple[str, int], Tuple[float, bytes]] = {}
CACHE_TTL_SECONDS = 30

app = FastAPI(redirect_slashes=False)


def validate_engine_ip(value: str) -> str:
    try:
        ipaddress.ip_address(value)
        return value
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"Invalid engine_ip: {value}") from e


def response_headers() -> dict:
    return {
        "access-control-allow-origin": "*",
        "cache-control": "max-age=1, private, must-revalidate",
        "pragma": "public",
        "expires": "0",
        "content-disposition": "attachment; filename=playlist.m3u",
    }


def transform_playlist(content: str, group_name: str) -> List[str]:
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
            out.append(f"#EXTGRP:{group_name}")

            if i + 1 < len(lines):
                url = lines[i + 1].strip()
                if url and not url.startswith("#"):
                    out.append(url)
                    i += 1

        i += 1

    return out


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
    r = await client.get(UPSTREAM_BASE, params=params, follow_redirects=True)
    r.raise_for_status()
    return r.text


async def build_playlist(engine_ip: str, engine_port: int) -> bytes:
    cache_key = (engine_ip, engine_port)
    now = time.time()

    cached = CACHE.get(cache_key)
    if cached and cached[0] > now:
        return cached[1]

    timeout = httpx.Timeout(connect=8.0, read=20.0, write=8.0, pool=8.0)

    async with httpx.AsyncClient(timeout=timeout) as client:
        tasks = [
            fetch_category(client, category, engine_ip, engine_port)
            for category in CATEGORY_GROUPS_RU.keys()
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    combined: List[str] = [HEADER]

    for (category, group_name), result in zip(CATEGORY_GROUPS_RU.items(), results):
        if isinstance(result, Exception):
            continue

        combined.extend(transform_playlist(result, group_name))

    final = "\r\n".join(combined) + "\r\n"
    payload = final.encode("utf-8")

    CACHE[cache_key] = (now + CACHE_TTL_SECONDS, payload)
    return payload


@app.api_route("/playlist", methods=["GET", "HEAD"])
async def playlist(
    request: Request,
    engine_ip: str = Query(DEFAULT_ENGINE_IP),
    engine_port: int = Query(DEFAULT_ENGINE_PORT, ge=1, le=65535),
):
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
    engine_ip = validate_engine_ip(engine_ip)

    payload = await build_playlist(engine_ip, engine_port)
    body = b"" if request.method == "HEAD" else payload

    return Response(
        content=body,
        media_type="application/octet-stream",
        headers=response_headers(),
    )
