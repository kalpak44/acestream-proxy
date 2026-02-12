# acestream-proxy

Minimal HTTP service that aggregates multiple `search-ace.stream` categories into **one** M3U playlist and rewrites the header to include EPG.

## Run (Docker)

```bash
docker run --rm -p 8000:8000 ghcr.io/kalpak44/acestream-proxy:latest
````

## Get playlist

Defaults:

* `engine_ip=192.168.1.50`
* `engine_port=6878`

```bash
curl "http://localhost:8000/playlist"
```

Override engine IP/port (validated):

```bash
curl "http://localhost:8000/playlist?engine_ip=192.168.0.244&engine_port=6878"
```

Use deployments: 

```bash
curl https://acestream-proxy.pavel-usanli.online/playlist
```

```bash
curl "https://acestream-proxy.pavel-usanli.online/playlist?engine_ip=192.168.0.244&engine_port=6878"
```
