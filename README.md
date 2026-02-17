# Ace Stream Playlist Proxy

A minimal HTTP service that aggregates multiple categories from `search-ace.stream` into a single, IPTV-friendly M3U playlist.

## Features

- **Multi-Category Aggregation**: Merges various content categories (Movies, Sports, Music, etc.) from `search-ace.stream` into one playlist.
- **EPG & Catchup Support**: Includes headers for [IPTV.dev](https://ip-tv.dev) EPG and Flussonic-compatible catchup.
- **Automatic Grouping**: Maps categories to Russian group names (`#EXTGRP`) for better organization in IPTV players.
- **URL Rewriting**: Automatically rewrites Ace Stream engine URLs to a custom base URL (`streaming-television.pavel-usanli.online`).
- **Smart Caching**: In-memory caching (30s TTL) for better performance and reduced upstream load.
- **Header Optimization**: Returns IPTV-compatible headers (`content-disposition`, `cache-control`, etc.).

## Endpoints

- `/playlist.m3u8` - Recommended endpoint for most IPTV players.

The endpoint supports `GET` and `HEAD` methods and forwards all query parameters to the upstream service.

## Usage

### Docker

```bash
docker run --rm -p 8000:8000 ghcr.io/kalpak44/acestream-proxy:latest
```

### Manual Run

Requires Python 3.9+:

```bash
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000
```

### Get Playlist

```bash
curl "http://localhost:8000/playlist.m3u8"
```

### Production Deployment

You can use the official deployment:

```
https://iptv.pavel-usanli.online/playlist.m3u8
```

## Configuration

Currently, the following settings are defined in `app.py`:

- `UPSTREAM_BASE`: `https://search-ace.stream/playlist`
- `ENGINE_BASE_URL`: `https://streaming-television.pavel-usanli.online`
- `CACHE_TTL_SECONDS`: `30`
- `EPG URL`: `https://ip-tv.dev/epg/epg.xml.gz`
