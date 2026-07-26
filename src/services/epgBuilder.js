const fs = require('fs-extra');
const path = require('node:path');
const config = require('../config');

function epgFilePath(id) {
    return path.join(config.DATA_DIR, 'playlists', `${id}.xml`);
}

function combinedEpgFilePath() {
    return path.join(config.DATA_DIR, 'playlists', 'iptv-epg.xml');
}

function escapeXml(v) {
    return String(v || '').replace(/[<>&"']/g, (c) => (
        {'<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;'}[c]
    ));
}

function renderEpg(channels) {
    const lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<!DOCTYPE tv SYSTEM "xmltv.dtd">',
        '<tv generator-info-name="AceStream Proxy">',
    ];
    for (const ch of channels) {
        lines.push(`  <channel id="${escapeXml(ch.infohash)}">`);
        lines.push(`    <display-name>${escapeXml(ch.name)}</display-name>`);
        if (ch.icon) lines.push(`    <icon src="${escapeXml(ch.icon)}"/>`);
        lines.push('  </channel>');
    }
    lines.push('</tv>');
    return lines.join('\n') + '\n';
}

async function buildEpgFile(playlist) {
    const target = epgFilePath(playlist.id);
    await fs.ensureDir(path.dirname(target));
    const tmp = target + '.tmp';
    const content = renderEpg(playlist.channels);
    await fs.writeFile(tmp, content);
    await fs.move(tmp, target, {overwrite: true});
    return {
        path: target,
        channels: playlist.channels.length,
        bytes: Buffer.byteLength(content, 'utf8'),
    };
}

async function buildCombinedEpgFile(allPlaylists) {
    const seen = new Set();
    const channels = [];
    for (const playlist of allPlaylists) {
        for (const ch of playlist.channels) {
            if (!seen.has(ch.infohash)) {
                seen.add(ch.infohash);
                channels.push(ch);
            }
        }
    }
    const target = combinedEpgFilePath();
    await fs.ensureDir(path.dirname(target));
    const tmp = target + '.tmp';
    const content = renderEpg(channels);
    await fs.writeFile(tmp, content);
    await fs.move(tmp, target, {overwrite: true});
    return {
        path: target,
        channels: channels.length,
        bytes: Buffer.byteLength(content, 'utf8'),
    };
}

async function removeEpgFile(id) {
    await fs.remove(epgFilePath(id));
}

module.exports = {buildEpgFile, buildCombinedEpgFile, removeEpgFile, epgFilePath, combinedEpgFilePath};