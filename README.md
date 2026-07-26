# Ace Stream Proxy

A small Node.js service that lets you manually curate IPTV playlists from an AceStream engine
and serve them (plus a matching XMLTV EPG) over HTTP. Every playlist is built from user-defined
categories and channels — no external playlist source, no external EPG.

## How it works

1. Sign in to the admin UI and configure the AceStream engine URL and MPEG-TS/HLS base URLs on
   `/settings` (env vars serve as defaults; JSON overrides live in `data/settings.json`).
2. On `/search`, query the engine's `/search` endpoint, then add channels straight into a
   playlist/category from the results.
3. Each playlist has its own random public URL (`GET /:id/playlist.m3u8`) and matching EPG
   (`GET /:id/epg.xml`). Any config change (add/remove channel, rename category, change stream
   flavor) rebuilds both files atomically.
4. The random ID doubles as a bearer token — anyone with the URL can fetch it, so treat it
   like a password. Rotate it from the playlists list.

## Configuration

All configuration is environment variables. Runtime overrides for the engine/streaming URLs
live in the UI (`/settings`) and are stored in `data/settings.json`.

- `AUTH_USERNAME`, `AUTH_PASSWORD` (**required**, no defaults)
    - Credentials for the web UI. Missing values abort startup.
- `SESSION_SECRET` (**required**, no default)
    - Signs the session cookie. Rotate to invalidate all active sessions.
- `ACESTREAM_SEARCH_URL` (`http://localhost:6878/search`)
    - Default AceStream engine search endpoint. Override at runtime in `/settings`.
- `ACESTREAM_STREAM_BASE` (`http://localhost:6878/ace/manifest.m3u8`)
    - Default MPEG-TS base URL. Override at runtime in `/settings`.
- `ACESTREAM_PAGE_SIZE` (`50`)
    - Default search page size. Override at runtime in `/settings`.
- `PUBLIC_BASE_URL` (`http://localhost:{PORT}`)
    - Absolute URL clients use to reach this proxy. Each generated playlist's M3U header embeds
      `url-tvg="{PUBLIC_BASE_URL}/{id}/epg.xml"` so IPTV clients auto-load our EPG. Set this to
      the LAN hostname/IP or reverse-proxy URL when VLC runs on another device.
- `PORT` (`8000`)
    - HTTP listen port.
- `DATA_DIR` (`data`)
    - Directory for persisted state (`playlists.json`, `settings.json`, per-playlist M3U/XML files).
- `SESSION_COOKIE_SECURE` (`false`) — set `true` when serving over HTTPS.
- `TRUST_PROXY` (`false`) — set `true` behind a reverse proxy so `req.ip`/`req.protocol` are honored.

## API

- `GET|HEAD /:id/playlist.m3u8`
    - Public per-playlist M3U built from that playlist's categories and channels. `404` for
      unknown IDs, `503` before the first build.
- `GET|HEAD /:id/epg.xml`
    - Public per-playlist XMLTV EPG. Each configured channel appears as a `<channel>` entry
      with matching `id` for the M3U `tvg-id`. No programmes today.
- `GET /` — redirects to `/playlists`.
- `GET /playlists`, `POST /playlists`, `POST /playlists/:id/update`, `POST /playlists/:id/delete`
    - Session-gated CRUD for playlists (name + ID).
- `GET /playlists/:id` — detail page: rebuild now, stream flavor (TS/HLS), categories, channels.
- `POST /playlists/:id/stream-kind`, `.../categories`, `.../categories/:cid/update`,
  `.../categories/:cid/delete`, `.../channels`, `.../channels/:chid/delete`, `.../rebuild`
    - Config endpoints backing the detail page.
- `GET /search`, `POST /search/add-channel`
    - Session-gated UI that proxies the engine's `/search`. Each result offers per-flavor Copy/Open
      and an "Add to playlist → category" action.
- `GET /settings`, `POST /settings`
    - Session-gated runtime overrides for engine URL, TS/HLS base URLs, public base URL, and
      search page size.
- `GET /login`, `POST /login`, `POST /logout` — session-based login flow.

## Quick start (Docker)

```bash
docker build -t acestream-proxy .

# Create once. It preserves playlists, settings, and generated M3U/XML files
# when the container is recreated or upgraded.
docker volume create acestream-data

docker run -d \
  --name acestream-proxy \
  -p 8000:8000 \
  -v acestream-data:/app/data \
  -e ACESTREAM_SEARCH_URL="http://acestream-engine:6878/search" \
  -e ACESTREAM_STREAM_BASE="http://192.168.1.7:6879/ace/getstream" \
  -e PUBLIC_BASE_URL="http://192.168.1.7:8000" \
  -e AUTH_USERNAME="admin" \
  -e AUTH_PASSWORD="change-me" \
  -e SESSION_SECRET="$(openssl rand -hex 32)" \
  acestream-proxy
```

Then open the UI at http://localhost:8000/.

The named volume is intentionally mounted at `/app/data`; do not omit it unless
you want the app's playlists and settings to be discarded when the container is removed.

## Run locally (without Docker)

Requirements: Node.js 20+.

```bash
npm install
npm start
```

## Development

- Main entry point: `src/index.js`
- HTTP routing: `src/app.js`, per-area routers in `src/routes/`
- Services: `src/services/` (auth, playlists, playlistBuilder, epgBuilder, acestream, settings)
- Views (server-rendered HTML with Tailwind Play CDN): `src/views/`
- Configuration: `src/config.js`
- Dependencies: see `package.json`
- Containerization: `Dockerfile`
