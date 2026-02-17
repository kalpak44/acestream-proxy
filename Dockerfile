FROM python:3.12-slim

LABEL maintainer="Pavel Usanli <pavel@usanli.online>"
LABEL description="Ace Stream Proxy - transforms and rewrites Ace Stream M3U playlists"
LABEL org.opencontainers.image.source="https://github.com/pavel-usanli/acestream-proxy"

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
