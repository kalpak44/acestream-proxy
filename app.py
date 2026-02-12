from typing import Optional

import httpx
from fastapi import FastAPI, Query, Response

UPSTREAM_BASE = "https://search-ace.stream/playlist"

DEFAULT_ENGINE_IP = "192.168.1.50"
DEFAULT_ENGINE_PORT = "6878"

REPLACEMENT_HEADER = '#EXTM3U catchup="flussonic" url-tvg="https://ip-tv.dev/epg/epg.xml.gz"'

app = FastAPI()


def patch_first_line(text: str) -> str:
    text = text.lstrip("\ufeff")
    lines = text.splitlines(True)  # keep original line endings

    if not lines:
        return REPLACEMENT_HEADER + "\n"

    first = lines[0]

    newline = ""
    if first.endswith("\r\n"):
        newline = "\r\n"
    elif first.endswith("\n"):
        newline = "\n"

    if first.strip().startswith("#EXTM3U"):
        lines[0] = REPLACEMENT_HEADER + newline
    else:
        lines.insert(0, REPLACEMENT_HEADER + "\n")

    return "".join(lines)


@app.get("/playlist")
async def playlist(
    engine_ip: Optional[str] = Query(DEFAULT_ENGINE_IP),
    engine_port: Optional[str] = Query(DEFAULT_ENGINE_PORT),
):
    params = {
        "engine_ip": engine_ip,
        "engine_port": engine_port,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(UPSTREAM_BASE, params=params)
        response.raise_for_status()

    patched = patch_first_line(response.text)

    return Response(
        content=patched,
        media_type="application/x-mpegURL; charset=utf-8",
    )
