FROM node:20-slim

LABEL maintainer="Pavel Usanli <pavel.usanli@gmail.com>"
LABEL description="Ace Stream Proxy - transforms and rewrites Ace Stream M3U playlists"
LABEL org.opencontainers.image.source="https://github.com/pavel-usanli/acestream-proxy"

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY src ./src

EXPOSE 8000

CMD ["npm", "start"]
