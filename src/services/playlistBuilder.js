const fs = require('fs-extra');
const path = require('node:path');
const config = require('../config');
const logger = require('../logger');
const playlists = require('./playlists');
const settings = require('./settings');
const {buildStreamUrl} = require('./acestream');
const {buildEpgFile, removeEpgFile, epgFilePath} = require('./epgBuilder');

const rebuildLocks = new Map();

function playlistFilePath(id) {
    return path.join(config.DATA_DIR, 'playlists', `${id}.m3u8`);
}

function sanitizeText(v) {
    return String(v || '').replace(/[\r\n]+/g, ' ').trim();
}

function escapeAttr(v) {
    return sanitizeText(v).replace(/"/g, '\'');
}

function epgUrlFor(playlistId) {
    const base = settings.effective().publicBaseUrl;
    if (!base) return '';
    return `${base}/${playlistId}/epg.xml`;
}

function renderPlaylist(playlist) {
    const categoriesById = new Map(playlist.categories.map((c) => [c.id, c]));
    const epgUrl = epgUrlFor(playlist.id);
    const header = epgUrl ? `#EXTM3U url-tvg="${escapeAttr(epgUrl)}"` : '#EXTM3U';
    const lines = [header];

    const kind = playlist.streamKind || 'ts';
    let skipped = 0;
    for (const category of playlist.categories) {
        const inCat = playlist.channels.filter((ch) => ch.categoryId === category.id);
        for (const ch of inCat) {
            const streamUrl = buildStreamUrl(ch.infohash, {kind});
            if (!streamUrl) {
                skipped += 1;
                continue;
            }
            const groupName = categoriesById.get(ch.categoryId)?.name || '';
            const displayName = sanitizeText(ch.name) || 'Unnamed';
            lines.push(`#EXTGRP:${sanitizeText(groupName)}`);
            lines.push(`#EXTINF:-1 tvg-id="${escapeAttr(ch.id)}" tvg-name="${escapeAttr(ch.name)}" group-title="${escapeAttr(groupName)}",${displayName}`);
            lines.push(streamUrl);
        }
    }
    return {content: lines.join('\n') + '\n', skipped};
}

async function buildPlaylistFile(playlist) {
    const target = playlistFilePath(playlist.id);
    await fs.ensureDir(path.dirname(target));
    const tmp = target + '.tmp';
    const {content, skipped} = renderPlaylist(playlist);
    await fs.writeFile(tmp, content);
    await fs.move(tmp, target, {overwrite: true});
    const epg = await buildEpgFile(playlist);
    if (skipped > 0) {
        logger.warn(`Playlist "${playlist.name}" (${playlist.id}): skipped ${skipped} channel(s) — no stream base URL configured for kind "${playlist.streamKind || 'ts'}".`);
    }
    return {
        path: target,
        itemCount: playlist.channels.length - skipped,
        skippedCount: skipped,
        bytes: Buffer.byteLength(content, 'utf8'),
        epg,
    };
}

async function removePlaylistFile(id) {
    await Promise.all([
        fs.remove(playlistFilePath(id)),
        removeEpgFile(id),
    ]);
}

async function rebuildNow(id) {
    const playlist = await playlists.get(id);
    if (!playlist) throw new Error(`Playlist ${id} not found`);
    const result = await buildPlaylistFile(playlist);
    logger.info(`Playlist "${playlist.name}" (${playlist.id}) built: ${result.itemCount} channels, ${result.bytes} bytes (EPG ${result.epg.bytes} bytes).`);
    return result;
}

// Mutations and simultaneous player requests may ask for the same generated
// files at once. Serialize each playlist so the atomic file replacement stays
// coherent and every response reflects the current settings and playlist data.
function rebuild(id) {
    const previous = rebuildLocks.get(id) || Promise.resolve();
    const next = previous.catch(() => {}).then(() => rebuildNow(id));
    rebuildLocks.set(id, next);
    return next.finally(() => {
        if (rebuildLocks.get(id) === next) rebuildLocks.delete(id);
    });
}

module.exports = {buildPlaylistFile, removePlaylistFile, playlistFilePath, epgFilePath, rebuild};
