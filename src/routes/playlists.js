const fs = require('fs-extra');
const express = require('express');
const logger = require('../logger');
const {requireAuth} = require('../services/auth');
const playlistsSvc = require('../services/playlists');
const {playlistFilePath, removePlaylistFile, rebuild} = require('../services/playlistBuilder');
const {fetchEpgIndex} = require('../services/acestream');
const {renderPlaylists, renderPlaylistDetail} = require('../views');

const router = express.Router();
router.use(requireAuth);

function baseUrl(req) {
    return `${req.protocol}://${req.get('host')}`;
}

function redirectWithError(res, message) {
    res.redirect('/playlists?error=' + encodeURIComponent(message));
}

function redirectDetailWithError(res, id, message) {
    res.redirect(`/playlists/${encodeURIComponent(id)}?error=` + encodeURIComponent(message));
}

function redirectDetailWithFlash(res, id, key) {
    res.redirect(`/playlists/${encodeURIComponent(id)}?flash=` + encodeURIComponent(key));
}

async function fireRebuild(id, actor) {
    try {
        await rebuild(id);
    } catch (err) {
        logger.error(`Rebuild after change by "${actor}" for ${id} failed: ${err.message}`);
    }
}

router.get('/playlists', async (req, res) => {
    const playlists = await playlistsSvc.list();
    res.type('html').send(renderPlaylists({
        user: req.session.user,
        playlists,
        baseUrl: baseUrl(req),
        flash: req.query.flash,
        error: req.query.error,
    }));
});

router.post('/playlists', async (req, res) => {
    try {
        const p = await playlistsSvc.create({name: req.body && req.body.name});
        logger.info(`Playlist created id="${p.id}" name="${p.name}" by "${req.session.user}".`);
        await fireRebuild(p.id, req.session.user);
        res.redirect(`/playlists?flash=created:${encodeURIComponent(p.id)}`);
    } catch (err) {
        logger.error(`Playlist create failed: ${err.message}`);
        redirectWithError(res, 'Failed to create playlist.');
    }
});

router.post('/playlists/:id/update', async (req, res) => {
    const oldId = req.params.id;
    const {name, id: newId} = req.body || {};
    try {
        const p = await playlistsSvc.update(oldId, {id: newId, name});
        logger.info(`Playlist updated ${oldId} -> id="${p.id}" name="${p.name}" by "${req.session.user}".`);
        if (p.id !== oldId) {
            await removePlaylistFile(oldId).catch((err) => logger.warn(`Cleanup after playlist ID change failed for ${oldId}: ${err.message}`));
        }
        await fireRebuild(p.id, req.session.user);
        redirectDetailWithFlash(res, p.id, 'updated');
    } catch (err) {
        if (err.code === 'NOT_FOUND') return redirectWithError(res, 'Playlist not found.');
        if (err.code === 'BAD_ID' || err.code === 'DUP_ID') return redirectDetailWithError(res, oldId, err.message);
        logger.error(`Playlist update failed: ${err.message}`);
        redirectDetailWithError(res, oldId, 'Failed to update playlist.');
    }
});

router.post('/playlists/:id/delete', async (req, res) => {
    const {id} = req.params;
    const removed = await playlistsSvc.remove(id);
    if (removed) {
        await removePlaylistFile(id).catch((e) => logger.warn(`Cleanup of ${id}.m3u8 failed: ${e.message}`));
        logger.info(`Playlist deleted id="${id}" by "${req.session.user}".`);
    }
    res.redirect('/playlists');
});

router.get('/playlists/:id', async (req, res) => {
    const {id} = req.params;
    const playlist = await playlistsSvc.get(id);
    if (!playlist) return res.status(404).redirect('/playlists');
    const file = playlistFilePath(id);
    let lastBuiltAt = null;
    let fileBytes = null;
    try {
        const stat = await fs.stat(file);
        lastBuiltAt = stat.mtime.toISOString();
        fileBytes = stat.size;
    } catch (_) { /* not built yet */ }
    res.type('html').send(renderPlaylistDetail({
        user: req.session.user,
        playlist,
        baseUrl: baseUrl(req),
        lastBuiltAt,
        fileBytes,
        flash: req.query.flash,
        error: req.query.error,
    }));
});

router.post('/playlists/:id/stream-kind', async (req, res) => {
    const {id} = req.params;
    const {streamKind} = req.body || {};
    try {
        await playlistsSvc.setStreamKind(id, {streamKind});
        await fireRebuild(id, req.session.user);
        redirectDetailWithFlash(res, id, 'stream-kind-saved');
    } catch (err) {
        if (err.code === 'BAD_STREAM_KIND') return redirectDetailWithError(res, id, err.message);
        if (err.code === 'NOT_FOUND') return redirectWithError(res, 'Playlist not found.');
        logger.error(`Set stream kind failed: ${err.message}`);
        redirectDetailWithError(res, id, 'Failed to save stream kind.');
    }
});

router.post('/playlists/:id/categories', async (req, res) => {
    const {id} = req.params;
    try {
        const cat = await playlistsSvc.addCategory(id, {name: req.body && req.body.name});
        logger.info(`Playlist ${id} category "${cat.name}" added by "${req.session.user}".`);
        await fireRebuild(id, req.session.user);
        redirectDetailWithFlash(res, id, `category-added:${cat.id}`);
    } catch (err) {
        if (['BAD_NAME', 'DUP_NAME'].includes(err.code)) return redirectDetailWithError(res, id, err.message);
        if (err.code === 'NOT_FOUND') return redirectWithError(res, 'Playlist not found.');
        logger.error(`Add category failed: ${err.message}`);
        redirectDetailWithError(res, id, 'Failed to add category.');
    }
});

router.post('/playlists/:id/categories/:categoryId/update', async (req, res) => {
    const {id, categoryId} = req.params;
    try {
        await playlistsSvc.renameCategory(id, categoryId, {name: req.body && req.body.name});
        await fireRebuild(id, req.session.user);
        redirectDetailWithFlash(res, id, 'category-updated');
    } catch (err) {
        if (['BAD_NAME', 'DUP_NAME'].includes(err.code)) return redirectDetailWithError(res, id, err.message);
        if (err.code === 'NOT_FOUND') return redirectDetailWithError(res, id, err.message);
        logger.error(`Rename category failed: ${err.message}`);
        redirectDetailWithError(res, id, 'Failed to rename category.');
    }
});

router.post('/playlists/:id/categories/:categoryId/delete', async (req, res) => {
    const {id, categoryId} = req.params;
    try {
        await playlistsSvc.removeCategory(id, categoryId);
        await fireRebuild(id, req.session.user);
        redirectDetailWithFlash(res, id, 'category-removed');
    } catch (err) {
        if (err.code === 'NOT_FOUND') return redirectDetailWithError(res, id, err.message);
        logger.error(`Remove category failed: ${err.message}`);
        redirectDetailWithError(res, id, 'Failed to remove category.');
    }
});

router.post('/playlists/:id/channels', async (req, res) => {
    const {id} = req.params;
    const {name, infohash, categoryId} = req.body || {};
    try {
        await playlistsSvc.addChannel(id, {name, infohash, categoryId});
        await fireRebuild(id, req.session.user);
        redirectDetailWithFlash(res, id, 'channel-added');
    } catch (err) {
        if (['BAD_NAME', 'BAD_INFOHASH', 'BAD_CATEGORY', 'DUP_CHANNEL'].includes(err.code)) {
            return redirectDetailWithError(res, id, err.message);
        }
        if (err.code === 'NOT_FOUND') return redirectDetailWithError(res, id, err.message);
        logger.error(`Add channel failed: ${err.message}`);
        redirectDetailWithError(res, id, 'Failed to add channel.');
    }
});

router.post('/playlists/:id/channels/:channelId/update', async (req, res) => {
    const {id, channelId} = req.params;
    try {
        await playlistsSvc.renameChannel(id, channelId, {name: req.body && req.body.name});
        await fireRebuild(id, req.session.user);
        redirectDetailWithFlash(res, id, 'channel-updated');
    } catch (err) {
        if (['BAD_NAME', 'NOT_FOUND'].includes(err.code)) return redirectDetailWithError(res, id, err.message);
        logger.error(`Rename channel failed: ${err.message}`);
        redirectDetailWithError(res, id, 'Failed to rename channel.');
    }
});

router.post('/playlists/:id/refresh-availability', async (req, res) => {
    const {id} = req.params;
    try {
        const channelIndex = await fetchEpgIndex();
        const result = await playlistsSvc.refreshChannelStats(id, channelIndex);
        logger.info(`Availability refreshed for playlist ${id} by "${req.session.user}": ${result.updated} channels updated.`);
        await fireRebuild(id, req.session.user);
        redirectDetailWithFlash(res, id, 'availability-refreshed');
    } catch (err) {
        if (err.code === 'NOT_FOUND') return redirectWithError(res, 'Playlist not found.');
        logger.error(`Refresh availability failed for playlist ${id}: ${err.message}`);
        redirectDetailWithError(res, id, 'Failed to refresh availability.');
    }
});

router.post('/playlists/:id/channels/:channelId/delete', async (req, res) => {
    const {id, channelId} = req.params;
    try {
        await playlistsSvc.removeChannel(id, channelId);
        await fireRebuild(id, req.session.user);
        redirectDetailWithFlash(res, id, 'channel-removed');
    } catch (err) {
        if (err.code === 'NOT_FOUND') return redirectDetailWithError(res, id, err.message);
        logger.error(`Remove channel failed: ${err.message}`);
        redirectDetailWithError(res, id, 'Failed to remove channel.');
    }
});

module.exports = router;
