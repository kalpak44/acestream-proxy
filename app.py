from typing import List, Optional

import httpx
from fastapi import FastAPI, Query, Response

UPSTREAM_BASE = "https://search-ace.stream/playlist"

DEFAULT_ENGINE_IP = "192.168.1.50"
DEFAULT_ENGINE_PORT = "6878"

DEFAULT_CATEGORIES = [
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


async def fetch_category(client, category: str, engine_ip: str, engine_port: str):
    params = {
        "category": category,
        "engine_ip": engine_ip,
        "engine_port": engine_port,
    }
    r = await client.get(UPSTREAM_BASE, params=params)
    r.raise_for_status()
    return r.text


def transform_playlist(content: str, category: str) -> List[str]:
    lines = content.splitlines()
    output = []

    i = 0
    while i < len(lines):
        line = lines[i].strip()

        if line.startswith("#EXTINF"):
            # Modify EXTINF duration to 0 instead of -1
            extinf = line.replace("#EXTINF:-1", "#EXTINF:0")

            output.append(extinf)

            # Add group
            output.append(f"#EXTGRP:{category}")

            # Add next line (URL)
            if i + 1 < len(lines):
                output.append(lines[i + 1].strip())
                i += 1

        i += 1

    return output


@app.get("/playlist")
async def playlist(
    engine_ip: str = Query(DEFAULT_ENGINE_IP),
    engine_port: str = Query(DEFAULT_ENGINE_PORT),
    categories: Optional[str] = Query(None),
):
    category_list = (
        [c.strip() for c in categories.split(",")]
        if categories
        else DEFAULT_CATEGORIES
    )

    combined_lines = [HEADER]

    async with httpx.AsyncClient(timeout=60.0) as client:
        for category in category_list:
            content = await fetch_category(client, category, engine_ip, engine_port)
            transformed = transform_playlist(content, category)
            combined_lines.extend(transformed)

    final_playlist = "\n".join(combined_lines) + "\n"

    return Response(
        content=final_playlist,
        media_type="application/x-mpegURL; charset=utf-8",
    )
