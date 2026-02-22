# Ace Stream Proxy

A tiny Node.js service that queries an Ace Stream search endpoint, converts the results into an IPTV‑friendly M3U8
playlist, and serves it over HTTP. It enriches entries with EPG titles (when available), channel logos, and group
information. As of the latest update, each channel also includes an `#EXTGRP:` line for improved compatibility with IPTV
players that rely on this tag.

## Features

- Generates an M3U8 playlist from Ace Stream search results and external M3U providers
- Merges channels from multiple sources into a single, unified playlist
- Automatically prefixes channel names with country codes (e.g., `[UA] Channel Name`)
- Supports manual category and country overrides via infohash
- Adds `tvg-name`, `tvg-id`, and `tvg-logo` (when available)
- Includes category grouping both as `group-title` and as a separate `#EXTGRP:` line
- Appends the current EPG program title to the channel name (when available)
- Simple caching to avoid hammering upstream APIs
- Docker image for easy deployment

## How it works

1. On startup, the service fetches Ace Stream search results (paged) from `ACESTREAM_SEARCH_URL`.
2. It also fetches additional channels from external M3U playlists defined in the configuration (e.g., from `iptv-org`).
3. It maps each channel to a specific group based on its category, country, or manual infohash override.
4. It generates a combined playlist file (by default `playlist.m3u8`) with one entry per item/variant found.
5. It refreshes the cached playlist when it becomes stale (configurable TTL) or when explicitly requested.

The playlist format example:

```m3u8
#EXTM3U
#EXTGRP:General
#EXTINF:-1 tvg-name="Channel Name" tvg-id="123" tvg-logo="http://logo.url" group-title="General",Channel Name — Current Program
http://your-stream-base/ace/manifest.m3u8?infohash=...
```

## Quick start (Docker)

```bash
# Build locally (optional – you can also deploy from a registry if available)
docker build -t acestream-proxy .

# Run
docker run -d \
  --name acestream-proxy \
  -p 8000:8000 \
  -e ACESTREAM_SEARCH_URL="http://acestream-engine:6878/search" \
  -e ACESTREAM_STREAM_BASE="http://acestream-engine:6878/ace/manifest.m3u8" \
  -e ACESTREAM_PAGE_SIZE=10 \
  -e PLAYLIST_FILE=playlist.m3u8 \
  -e PLAYLIST_TTL=3600 \
  -e PORT=8000 \
  acestream-proxy
```

Then open:

- Playlist: http://localhost:8000/playlist.m3u8

## Run locally (without Docker)

Requirements:

- Node.js 20+

Install and run:

```bash
npm install
npm start
```

## Configuration

All configuration is done via environment variables. Defaults are shown in parentheses.

- `ACESTREAM_SEARCH_URL` ("http://localhost:6878/search")
    - Upstream search endpoint the service paginates through.
- `ACESTREAM_STREAM_BASE` ("http://localhost:6878/ace/manifest.m3u8")
    - Base URL used to construct per‑item stream URLs: `"{ACESTREAM_STREAM_BASE}?infohash={infohash}"`.
- `ACESTREAM_PAGE_SIZE` ("10")
    - Number of items to request per page from the upstream search API.
- `PLAYLIST_FILE` ("playlist.m3u8")
    - File name of the generated playlist on disk.
- `PLAYLIST_TTL` ("3600")
    - Cache lifetime (seconds). When the cached playlist is older than this, it will be regenerated on next request or
      at startup.
- `PORT` ("8000")
    - The port the HTTP server listens on.

## Advanced Configuration

Currently, the following mappings are hardcoded in `src/config.js`, but they influence how the playlist is generated:

- **Country Map (`COUNTRY_MAP`):** Defines supported countries, their human-readable names, and any external M3U sources to merge from (e.g., `iptv-org` lists).
- **Category Remap (`CATEGORY_REMAP`):** Maps various upstream categories (e.g., `music_video`, `kids`, `sport`) to unified group names and can also include external M3U sources.
- **Infohash Overrides (`INFOHASH_CATEGORY_OVERRIDE`, `INFOHASH_COUNTRY_OVERRIDE`):** Allows manual assignment of specific stream infohashes to specific groups or countries.

## API

- `GET /playlist.m3u8`
    - Returns the generated playlist file. If the cached file is stale (older than TTL), it is refreshed first. Returns
      `503` if not yet initialized.
- `HEAD /playlist.m3u8`
    - Same as `GET` but returns only headers (useful for clients probing availability); includes `Content-Disposition`
      and cache headers.
- `POST /refresh`
    - Forces a refresh even if the cached playlist is fresh. Returns JSON with `{ "updated": true, "items": <count> }`.

## M3U8 entry format

Each item results in a block like:

```m3u8
#EXTGRP:<Group>
#EXTINF:-1 tvg-name="<Name>" tvg-id="<ChannelID>" tvg-logo="<LogoURL>" group-title="<Group>",<Display Name>
<StreamURL>
```

Notes:

- `<Group>` comes from the item's first matching category or country (remapped to human-readable names).
- `<Display Name>` includes:
    - **Country Prefix:** Channels with a detected country are prefixed like `[UA] Channel Name`.
    - **External Prefix:** Channels from external M3U sources are prefixed with `External`.
    - **EPG Title:** The current program is appended with an em dash `—` when available (e.g., `[UA] Channel Name — Current Program`).
- Some items may not have `tvg-id` or `tvg-logo`.

## Logging

The service logs to stdout with level `INFO` by default and reports pagination progress, cache refreshes, and errors
contacting the upstream.

## Troubleshooting

- Playlist returns 503
    - The service could not initialize the playlist yet (upstream unavailable or still retrying). Check logs and
      connectivity to `ACESTREAM_SEARCH_URL`.
- Channels play but logos/EPG missing
    - Not all upstream items include icons or EPG; the proxy preserves what is available.
- Groups not recognized by your player
    - Ensure your player supports `#EXTGRP`. This service also keeps `group-title` in `#EXTINF` for broader
      compatibility.

## Development

- Main entry point: `src/index.js`
- Application logic: `src/app.js`
- Services: `src/services/`
- Configuration: `src/config.js`
- Dependencies: see `package.json`
- Containerization: `Dockerfile`
