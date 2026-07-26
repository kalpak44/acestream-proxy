const express = require('express');
const fs = require('fs-extra');
const path = require('node:path');
const playlistsSvc = require('../services/playlists');
const {playlistFilePath, epgFilePath, rebuild} = require('../services/playlistBuilder');

const router = express.Router();

function commonHeaders(filename, contentType) {
    return {
        'access-control-allow-origin': '*',
        'cache-control': 'max-age=3600, private, must-revalidate',
        // This is an IPTV channel list, not an HLS media manifest. Serving it
        // inline with the generic M3U type lets VLC use its playlist parser
        // when the URL is opened directly.
        'content-disposition': `inline; filename=${filename}`,
        ...(contentType ? {'content-type': contentType} : {}),
    };
}

async function servePublicFile(req, res, {id, filePath, headers, missingMessage}) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).end();
    if (!playlistsSvc.isValidId(id)) return res.status(404).send('Not found');
    const playlist = await playlistsSvc.get(id);
    if (!playlist) return res.status(404).send('Not found');

    try {
        // The generated M3U and XMLTV files are derived caches. Rebuild on
        // every public request so stream/EPG base URLs and channel changes in
        // Settings are reflected immediately.
        await rebuild(id);
    } catch (_) {
        return res.status(503).send(missingMessage);
    }

    const exists = await fs.pathExists(filePath);
    if (!exists) return res.status(503).send(missingMessage);

    res.set(headers);
    if (req.method === 'HEAD') return res.status(200).end();
    res.sendFile(path.resolve(filePath));
}

router.all('/:id/playlist.m3u8', (req, res) => servePublicFile(req, res, {
    id: req.params.id,
    filePath: playlistFilePath(req.params.id),
    headers: commonHeaders('playlist.m3u8', 'audio/x-mpegurl; charset=utf-8'),
    missingMessage: 'Playlist not built yet. Configure and rebuild in the admin UI.',
}));

router.all('/:id/epg.xml', (req, res) => servePublicFile(req, res, {
    id: req.params.id,
    filePath: epgFilePath(req.params.id),
    headers: commonHeaders('epg.xml', 'application/xml; charset=utf-8'),
    missingMessage: 'EPG not built yet.',
}));

module.exports = router;
