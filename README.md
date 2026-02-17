# acestream-proxy

Minimal HTTP service that aggregates multiple `search-ace.stream` categories into **one** M3U playlist and rewrites the header to include EPG.

## Run (Docker)

```bash
docker run --rm -p 8000:8000 ghcr.io/kalpak44/acestream-proxy:latest
````

## Get playlist

```bash
curl "http://localhost:8000/playlist.m3u8"
```

Use deployments: 

```bash
curl "https://iptv.pavel-usanli.online/playlist.m3u8"
```
