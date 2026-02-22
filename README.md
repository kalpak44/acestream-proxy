# Ace Stream Proxy

A tiny Node.js service that queries an Ace Stream search endpoint, converts the results into an IPTV‑friendly M3U8
playlist, and serves it over HTTP. It enriches entries with EPG titles (when available), channel logos, and group
information. As of the latest update, each channel also includes an `#EXTGRP:` line for improved compatibility with IPTV
players that rely on this tag.

## Features

- Generates an M3U8 playlist from Ace Stream search results
- Adds `tvg-name`, `tvg-id`, and `tvg-logo` (when available)
- Includes category grouping both as `group-title` and as a separate `#EXTGRP:` line
- Appends the current EPG program title to the channel name (when available)
- Simple caching to avoid hammering the upstream search API
- Docker image for easy deployment

## How it works

1. On startup, the service fetches Ace Stream search results (paged) from `ACESTREAM_SEARCH_URL`.
2. It generates a playlist file (by default `playlist.m3u8`) with one entry per item/variant found.
3. It refreshes the cached playlist when it becomes stale (configurable TTL) or when explicitly requested.

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
  -e ACESTREAM_STREAM_BASE="http://streaming-television.pavel-usanli.online:6878/ace/manifest.m3u8" \
  -e ACESTREAM_PAGE_SIZE=10 \
  -e PLAYLIST_FILE=playlist.m3u8 \
  -e PLAYLIST_TTL=3600 \
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

- `ACESTREAM_SEARCH_URL` ("http://acestream-engine:6878/search")
    - Upstream search endpoint the service paginates through.
- `ACESTREAM_STREAM_BASE` ("http://streaming-television.pavel-usanli.online:6878/ace/manifest.m3u8")
    - Base URL used to construct per‑item stream URLs: `"{ACESTREAM_STREAM_BASE}?infohash={infohash}"`.
- `ACESTREAM_PAGE_SIZE` ("10")
    - Number of items to request per page from the upstream search API.
- `PLAYLIST_FILE` ("playlist.m3u8")
    - File name of the generated playlist on disk.
- `PLAYLIST_TTL` ("3600")
    - Cache lifetime (seconds). When the cached playlist is older than this, it will be regenerated on next request or
      at startup.

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
#EXTINF:-1 tvg-name="<Name>" tvg-id="<ChannelID>" tvg-logo="<LogoURL>" group-title="<Group>",<Name> — <EPG Title>
<ACESTREAM_STREAM_BASE>?infohash=<InfoHash>
```

Notes:

- `<Group>` comes from the item's first category (or `General` when absent).
- The EPG title is appended with an em dash `—` when available; otherwise only the channel name is shown.
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
