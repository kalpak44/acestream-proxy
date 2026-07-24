const express = require('express');
const fs = require('fs-extra');
const path = require('node:path');
const {PLAYLIST_FILE} = require('./config');

const app = express();

function getResponseHeaders() {
    return {
        'access-control-allow-origin': '*',
        'cache-control': 'max-age=3600, private, must-revalidate',
        'content-disposition': 'attachment; filename=playlist.m3u8',
    };
}

app.all('/playlist.m3u8', async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        return res.status(405).end();
    }

    const exists = await fs.pathExists(PLAYLIST_FILE);
    if (!exists) {
        return res.status(503).send('Playlist not ready');
    }

    res.set(getResponseHeaders());
    if (req.method === 'HEAD') return res.status(200).end();

    res.sendFile(path.resolve(PLAYLIST_FILE));
});

module.exports = app;