const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const {writePlaylistIfStale} = require('./services/playlist');
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

    try {
        await writePlaylistIfStale();
    } catch (error) {
        // Ignore the error, we will try to serve an existing file if it exists
    }

    const exists = await fs.pathExists(PLAYLIST_FILE);
    if (!exists) {
        return res.status(503).send('Playlist not ready');
    }

    const headers = getResponseHeaders();
    res.set(headers);

    if (req.method === 'HEAD') {
        return res.status(200).end();
    }

    res.sendFile(path.resolve(PLAYLIST_FILE));
});

app.post('/refresh', async (req, res) => {
    try {
        const count = await writePlaylistIfStale(true);
        res.json({updated: true, items: count});
    } catch (error) {
        res.status(500).json({error: error.message});
    }
});

module.exports = app;
