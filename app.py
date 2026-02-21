# app.py
import asyncio
import json
import logging
import os
import time
from typing import List, Optional

import httpx
from fastapi import FastAPI, Response, Request
from fastapi.responses import FileResponse

# ---------------------------------------------------------------------------
# Logging Configuration
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("acestream-proxy")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Engine search endpoint and stream base URL
SEARCH_URL = os.getenv("ACESTREAM_SEARCH_URL", "http://acestream-engine:6878/search")
STREAM_BASE_URL = os.getenv(
    "ACESTREAM_STREAM_BASE",
    "http://streaming-television.pavel-usanli.online:6878/ace/manifest.m3u8",
)
PAGE_SIZE = int(os.getenv("ACESTREAM_PAGE_SIZE", "10"))  # per prompt
PLAYLIST_FILE = os.getenv("PLAYLIST_FILE", "playlist.m3u8")
CACHE_TTL = int(os.getenv("PLAYLIST_TTL", "3600"))  # seconds
COUNTRY_MAP = {
    "ru": "Россия",
    "ua": "Украина",
    "by": "Беларусь",
    "kz": "Казахстан",
    "us": "США",
    "gb": "Великобритания",
    "de": "Германия",
    "fr": "Франция",
    "it": "Италия",
    "es": "Испания",
    "tr": "Турция",
    "pl": "Польша",
    "nl": "Нидерланды",
    "be": "Бельгия",
    "ca": "Канада",
    "au": "Австралия",
    "il": "Израиль",
    "pt": "Португалия",
    "gr": "Греция",
    "cz": "Чехия",
    "hu": "Венгрия",
    "ro": "Румыния",
    "bg": "Болгария",
    "at": "Австрия",
    "ch": "Швейцария",
    "se": "Швеция",
    "no": "Норвегия",
    "fi": "Финляндия",
    "dk": "Дания",
    "ie": "Ирландия",
    "br": "Бразилия",
    "ar": "Аргентина",
    "cl": "Чили",
    "co": "Колумбия",
    "mx": "Мексика",
    "cn": "Китай",
    "jp": "Япония",
    "kr": "Южная Корея",
    "in": "Индия",
    "sa": "Саудовская Аравия",
    "ae": "ОАЭ",
    "eg": "Египет",
    "za": "ЮАР",
}
CATEGORY_MAP = {
    "music": "Музыка",
    "movies": "Кино",
}

# Disable automatic trailing-slash redirects (some IPTV clients dislike 307/308)
app = FastAPI(redirect_slashes=False)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def response_headers() -> dict:
    return {
        "access-control-allow-origin": "*",
        "cache-control": "max-age=3600, private, must-revalidate",
        "content-disposition": "attachment; filename=playlist.m3u8",
    }


async def fetch_all_results() -> List[dict]:
    """Iterate search pages and collect all results."""
    all_results: List[dict] = []
    page = 1

    async with httpx.AsyncClient() as client:
        while True:
            logger.info(f"Fetching search results, page {page}...")
            try:
                resp = await client.get(
                    SEARCH_URL, params={"page": page, "page_size": PAGE_SIZE}, timeout=15.0
                )
                resp.raise_for_status()
            except httpx.RequestError as exc:
                logger.error(f"An error occurred while requesting {exc.request.url!r}: {exc}")
                raise
            except httpx.HTTPStatusError as exc:
                logger.error(f"Error response {exc.response.status_code} while requesting {exc.request.url!r}")
                raise

            data = resp.json()

            result = data.get("result", {})
            results = result.get("results", [])
            total = int(result.get("total", 0) or 0)

            if not results:
                logger.info("No more results found.")
                break

            all_results.extend(results)
            logger.info(f"Collected {len(all_results)} / {total} items.")

            if len(all_results) >= total:
                break

            page += 1

    return all_results


def pick_logo(urls: List[dict]) -> str:
    if not urls:
        return ""
    type0 = [u.get("url", "") for u in urls if u.get("type") == 0 and u.get("url")]
    if type0:
        return type0[0]
    return next((u.get("url", "") for u in urls if u.get("url")), "")


def generate_m3u8(results: List[dict]) -> str:
    """Generate M3U8 grouped by country (Russian name)."""
    lines: List[str] = ["#EXTM3U"]

    for res in results:
        name = res.get("name", "Unknown")

        # EPG: take first program title if available and append to name
        epg = res.get("epg") or []
        epg_title = (epg[0].get("name") if epg and isinstance(epg, list) else "") or ""

        icons = res.get("icons") or []
        logo = pick_logo(icons)

        items = res.get("items") or []
        if not items:
            continue

        # Some results may have multiple item variants. Emit one entry per item.
        for item in items:
            infohash = item.get("infohash")
            if not infohash:
                continue

            countries = item.get("countries") or []
            item_categories = item.get("categories") or []
            
            groups = []
            # Group by country. If multiple countries, add to multiple groups.
            for c in countries:
                c_lower = c.lower()
                groups.append(COUNTRY_MAP.get(c_lower, c_lower.upper()))

            # Add special category groups
            for cat in item_categories:
                cat_lower = cat.lower()
                if cat_lower in CATEGORY_MAP:
                    groups.append(CATEGORY_MAP[cat_lower])

            # If no countries and no special categories, fall back to "Прочее"
            if not groups:
                groups = ["Прочее"]

            channel_id = item.get("channel_id") or res.get("channel_id")
            tvg_id_attr = f' tvg-id="{channel_id}"' if channel_id is not None else ""

            # Compose display name with EPG title when present
            display_name = name if not epg_title else f"{name} — {epg_title}"

            for group in groups:
                extinf = (
                    f'#EXTINF:-1 tvg-name="{name}"{tvg_id_attr} tvg-logo="{logo}" '
                    f'group-title="{group}",{display_name}'
                )
                lines.append(f"#EXTGRP:{group}")
                lines.append(extinf)

                stream_url = f"{STREAM_BASE_URL}?infohash={infohash}"
                lines.append(stream_url)

    return "\n".join(lines) + "\n"


async def write_playlist_if_stale() -> Optional[int]:
    """Create or refresh playlist file if older than TTL. Returns item count or None."""
    need_update = False
    if not os.path.exists(PLAYLIST_FILE):
        logger.info(f"Playlist file {PLAYLIST_FILE} does not exist. Initializing...")
        need_update = True
    else:
        age = time.time() - os.path.getmtime(PLAYLIST_FILE)
        if age > CACHE_TTL:
            logger.info(f"Playlist file {PLAYLIST_FILE} is stale (age: {age:.0f}s, TTL: {CACHE_TTL}s). Refreshing...")
            need_update = True

    if not need_update:
        return None

    try:
        results = await fetch_all_results()
        content = generate_m3u8(results)
        with open(PLAYLIST_FILE, "w", encoding="utf-8") as f:
            f.write(content)
        logger.info(f"Playlist updated successfully with {len(results)} items.")
        return len(results)
    except Exception as e:
        logger.error(f"Failed to update playlist: {e}")
        return None


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def on_startup():
    # Build playlist at startup before accepting requests
    logger.info("Service starting up. Initializing playlist...")
    max_retries = 10
    retry_delay = 5
    for attempt in range(1, max_retries + 1):
        try:
            count = await write_playlist_if_stale()
            if count is not None or os.path.exists(PLAYLIST_FILE):
                logger.info("Startup playlist initialization complete.")
                break
        except Exception as e:
            logger.warning(f"Startup playlist initialization attempt {attempt} failed: {e}")
        
        if attempt < max_retries:
            logger.info(f"Retrying in {retry_delay} seconds...")
            await asyncio.sleep(retry_delay)
    else:
        logger.error("Failed to initialize playlist after several attempts during startup.")


@app.api_route("/playlist.m3u8", methods=["GET", "HEAD"])
async def serve_playlist(request: Request):
    await write_playlist_if_stale()

    if not os.path.exists(PLAYLIST_FILE):
        return Response(content="Playlist not ready", status_code=503)

    if request.method == "HEAD":
        return Response(content=None, headers=response_headers())

    return FileResponse(
        path=PLAYLIST_FILE,
        filename="playlist.m3u8",
        media_type="application/octet-stream",
        headers=response_headers(),
    )


@app.post("/refresh")
async def manual_refresh():
    count = await write_playlist_if_stale()
    # Force refresh even if not stale
    if count is None:
        results = await fetch_all_results()
        content = generate_m3u8(results)
        with open(PLAYLIST_FILE, "w", encoding="utf-8") as f:
            f.write(content)
        count = len(results)
    return {"updated": True, "items": count}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
