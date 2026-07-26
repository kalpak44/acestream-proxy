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

function toXmltvTime(unixTs) {
    const d = new Date(Number(unixTs) * 1000);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())} +0000`;
}

function renderEpg(channels, epgIndex = new Map()) {
    const lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<!DOCTYPE tv SYSTEM "xmltv.dtd">',
        '<tv generator-info-name="AceStream Proxy">',
    ];
    const programmes = [];
    for (const ch of channels) {
        const data = epgIndex.get(ch.infohash);
        const icon = ch.icon || (data && data.icons && data.icons[0] && data.icons[0].url) || '';
        lines.push(`  <channel id="${escapeXml(ch.infohash)}">`);
        lines.push(`    <display-name>${escapeXml(ch.name)}</display-name>`);
        if (icon) lines.push(`    <icon src="${escapeXml(icon)}"/>`);
        lines.push('  </channel>');
        for (const entry of (data && data.epg || [])) {
            if (!entry.start || !entry.stop || !entry.name) continue;
            programmes.push(`  <programme start="${toXmltvTime(entry.start)}" stop="${toXmltvTime(entry.stop)}" channel="${escapeXml(ch.infohash)}">`);
            programmes.push(`    <title>${escapeXml(entry.name)}</title>`);
            programmes.push('  </programme>');
        }
    }
    lines.push(...programmes);
    lines.push('</tv>');
    return lines.join('\n') + '\n';
}

async function buildEpgFile(playlist, epgIndex = new Map()) {
    const target = epgFilePath(playlist.id);
    await fs.ensureDir(path.dirname(target));
    const tmp = target + '.tmp';
    const content = renderEpg(playlist.channels, epgIndex);
    await fs.writeFile(tmp, content);
    await fs.move(tmp, target, {overwrite: true});
    return {
        path: target,
        channels: playlist.channels.length,
        bytes: Buffer.byteLength(content, 'utf8'),
    };
}

async function buildCombinedEpgFile(allPlaylists, epgIndex = new Map()) {
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
    const content = renderEpg(channels, epgIndex);
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