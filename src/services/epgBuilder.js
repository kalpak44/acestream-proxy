const fs = require('fs-extra');
const path = require('node:path');
const config = require('../config');

function epgFilePath(id) {
    return path.join(config.DATA_DIR, 'playlists', `${id}.xml`);
}

function escapeXml(v) {
    return String(v || '').replace(/[<>&"']/g, (c) => (
        {'<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;'}[c]
    ));
}

function renderEpg(playlist) {
    const categoriesById = new Map(playlist.categories.map((c) => [c.id, c]));
    const lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<!DOCTYPE tv SYSTEM "xmltv.dtd">',
        '<tv generator-info-name="AceStream Proxy">',
    ];
    for (const ch of playlist.channels) {
        const cat = categoriesById.get(ch.categoryId);
        lines.push(`  <channel id="${escapeXml(ch.id)}">`);
        lines.push(`    <display-name>${escapeXml(ch.name)}</display-name>`);
        if (cat && cat.name) {
            lines.push(`    <category>${escapeXml(cat.name)}</category>`);
        }
        lines.push('  </channel>');
    }
    lines.push('</tv>');
    return lines.join('\n') + '\n';
}

async function buildEpgFile(playlist) {
    const target = epgFilePath(playlist.id);
    await fs.ensureDir(path.dirname(target));
    const tmp = target + '.tmp';
    const content = renderEpg(playlist);
    await fs.writeFile(tmp, content);
    await fs.move(tmp, target, {overwrite: true});
    return {
        path: target,
        channels: playlist.channels.length,
        bytes: Buffer.byteLength(content, 'utf8'),
    };
}

async function removeEpgFile(id) {
    await fs.remove(epgFilePath(id));
}

module.exports = {buildEpgFile, removeEpgFile, epgFilePath};