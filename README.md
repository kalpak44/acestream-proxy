# Ace Stream Proxy

A tiny Node.js service that generates an IPTV-friendly M3U8 playlist by combining a curated source
playlist (channel names, groups, logos, EPG ids) with live AceStream infohashes discovered from an
AceStream search endpoint. The generated playlist is served over HTTP and rebuilt nightly by an
internal cron job.

## How it works

1. On startup — and again on the configured cron schedule (default `0 3 * * *`, nightly at 03:00
   local time) — the service:
   - Streams the source M3U from `SOURCE_PLAYLIST_URL` line by line (never buffered in RAM).
   - Paginates the AceStream `search` endpoint and builds an in-memory `name → infohash` index.
   - Matches each source channel to an AceStream entry by normalized `tvg-name` / display name.
   - Streams the resulting playlist to disk with an atomic rename.
2. `GET /playlist.m3u8` serves the last successful build. Groups, logos, and EPG ids come from the
   source playlist — no manual overrides.

## Configuration

All configuration is done via environment variables. Defaults are shown in parentheses.

- `SOURCE_PLAYLIST_URL` (**required**, no default)
    - Upstream M3U used as the channel catalog (names, groups, logos, EPG ids). The build fails
      loudly if this is not set.
- `EPG_URL` (`https://iptv.online/epg/epg.xml.gz`)
    - Advertised via `url-tvg="..."` on the `#EXTM3U` header of the generated playlist.
- `ACESTREAM_SEARCH_URL` (`http://localhost:6878/search`)
    - Upstream AceStream search endpoint the service paginates through.
- `ACESTREAM_STREAM_BASE` (`http://localhost:6878/ace/manifest.m3u8`)
    - Base URL used to construct per-item stream URLs: `"{ACESTREAM_STREAM_BASE}?infohash={infohash}"`.
- `ACESTREAM_PAGE_SIZE` (`50`)
    - Number of items to request per page from the AceStream search API.
- `CRON_SCHEDULE` (`0 3 * * *`)
    - Standard 5-field cron expression evaluated in the container's local time.
- `PLAYLIST_FILE` (`playlist.m3u8`)
    - File name of the generated playlist on disk.
- `PORT` (`8000`)
    - The port the HTTP server listens on.

## API

- `GET /playlist.m3u8`
    - Returns the generated playlist file. Returns `503` if the initial build has not completed.
- `HEAD /playlist.m3u8`
    - Same as `GET` but returns only headers.

There is no manual refresh endpoint — rebuilds happen on startup and via cron only.

## Quick start (Docker)

```bash
docker build -t acestream-proxy .

docker run -d \
  --name acestream-proxy \
  -p 8000:8000 \
  -e ACESTREAM_SEARCH_URL="http://acestream-engine:6878/search" \
  -e ACESTREAM_STREAM_BASE="http://acestream-engine:6878/ace/manifest.m3u8" \
  -e SOURCE_PLAYLIST_URL="https://iptv.online/play/XXXXXXXXXX/m3u8" \
  -e EPG_URL="https://iptv.online/epg/epg.xml.gz" \
  -e CRON_SCHEDULE="0 3 * * *" \
  acestream-proxy
```

Then open: http://localhost:8000/playlist.m3u8

## Run locally (without Docker)

Requirements: Node.js 20+.

```bash
npm install
npm start
```

## Channel matching

Each source channel is matched to an AceStream infohash by comparing normalized
names through a tiered fallback (stop at first hit, prefer stricter tiers):

1. **tier 0 — strict**: NFKC → lowercase → non-alphanumerics collapsed to spaces.
2. **tier 1 — quality-agnostic**: tier 0 minus `hd`, `fhd`, `uhd`, `sd`, `4k`, `hevc`, `h265`, `h264`.
3. **tier 2 — timezone-agnostic**: tier 0 minus `+N`, `(+N)`, `СНГ`, `Мир`, `Планета`, `Международная`, `EU`, `East`, `West`.
4. **tier 3 — both stripped**: last-chance exact match.
5. **tier 4 — fuzzy**: bigram similarity ≥ 0.85 against the AceStream tier-0 keys.

Every build logs a per-tier hit count and the first 20 unmatched channels with
their normalized keys and nearest AceStream candidates.

## Diagnostics

Two scripts help profile matches without redeploying the container:

- `scripts/dump-acestream.sh` — run on the Docker host to dump every page of the
  engine's `/search` into `acestream-dump.json`. Uses `docker exec` on the
  playlist container so it can reach the engine over the private compose
  network. Requires `docker` and `jq`.
- `scripts/diagnose-matching.js` — offline analyzer. Reads the dump and the
  live source M3U, runs the same tiered matcher, and prints per-tier hit
  counts plus unmatched samples with nearest candidates.

## M3U8 output format

The header advertises the EPG URL, and each channel is emitted with the metadata carried over from
the source playlist plus the resolved AceStream stream URL:

```m3u8
#EXTM3U url-tvg="https://iptv.online/epg/epg.xml.gz"
#EXTGRP:<Group>
#EXTINF:-1 tvg-name="<Name>" tvg-id="<ChannelID>" tvg-logo="<LogoURL>" group-title="<Group>",<Display Name>
<AceStream stream URL>
```

Channels in the source playlist that have no matching AceStream infohash are omitted.

## Development

- Main entry point: `src/index.js`
- HTTP routing: `src/app.js`
- Services: `src/services/`
- Configuration: `src/config.js`
- Dependencies: see `package.json`
- Containerization: `Dockerfile`