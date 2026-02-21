const fs = require('fs-extra');
const logger = require('../logger');
const { fetchAllResults } = require('./acestream');
const {
  STREAM_BASE_URL,
  COUNTRY_MAP,
  CATEGORY_MAP,
  PLAYLIST_FILE,
  CACHE_TTL,
} = require('../config');

function pickLogo(urls) {
  if (!urls || urls.length === 0) {
    return '';
  }
  const type0 = urls.filter((u) => u.type === 0 && u.url).map((u) => u.url);
  if (type0.length > 0) {
    return type0[0];
  }
  const anyUrl = urls.find((u) => u.url);
  return anyUrl ? anyUrl.url : '';
}

function generateM3u8(results) {
  const lines = ['#EXTM3U'];

  for (const res of results) {
    const name = res.name || 'Unknown';

    // EPG: take first program title if available and append to name
    const epg = res.epg || [];
    const epgTitle = (Array.isArray(epg) && epg.length > 0 ? epg[0].name : '') || '';

    const icons = res.icons || [];
    const logo = pickLogo(icons);

    const items = res.items || [];
    if (items.length === 0) {
      continue;
    }

    // Emit one entry per item
    for (const item of items) {
      const infohash = item.infohash;
      if (!infohash) {
        continue;
      }

      const countries = item.countries || [];
      const itemCategories = item.categories || [];

      const groups = [];
      for (const c of countries) {
        const cLower = c.toLowerCase();
        groups.push(COUNTRY_MAP[cLower] || cLower.toUpperCase());
      }

      for (const cat of itemCategories) {
        const catLower = cat.toLowerCase();
        if (CATEGORY_MAP[catLower]) {
          groups.push(CATEGORY_MAP[catLower]);
        }
      }

      if (groups.length === 0) {
        groups.push('Прочее');
      }

      const channelId = item.channel_id || res.channel_id;
      const tvgIdAttr = channelId !== undefined && channelId !== null ? ` tvg-id="${channelId}"` : '';

      const displayName = !epgTitle ? name : `${name} — ${epgTitle}`;

      for (const group of groups) {
        const extinf = `#EXTINF:-1 tvg-name="${name}"${tvgIdAttr} tvg-logo="${logo}" group-title="${group}",${displayName}`;
        lines.push(`#EXTGRP:${group}`);
        lines.push(extinf);

        const streamUrl = `${STREAM_BASE_URL}?infohash=${infohash}`;
        lines.push(streamUrl);
      }
    }
  }

  return lines.join('\n') + '\n';
}

async function writePlaylistIfStale(force = false) {
  let needUpdate = force;
  
  if (!needUpdate) {
    try {
      const exists = await fs.pathExists(PLAYLIST_FILE);
      if (!exists) {
        logger.info(`Playlist file ${PLAYLIST_FILE} does not exist. Initializing...`);
        needUpdate = true;
      } else {
        const stats = await fs.stat(PLAYLIST_FILE);
        const age = (Date.now() - stats.mtimeMs) / 1000;
        if (age > CACHE_TTL) {
          logger.info(`Playlist file ${PLAYLIST_FILE} is stale (age: ${Math.round(age)}s, TTL: ${CACHE_TTL}s). Refreshing...`);
          needUpdate = true;
        }
      }
    } catch (error) {
      logger.error(`Error checking playlist status: ${error.message}`);
      needUpdate = true;
    }
  }

  if (!needUpdate) {
    return null;
  }

  try {
    const results = await fetchAllResults();
    const content = generateM3u8(results);
    await fs.writeFile(PLAYLIST_FILE, content, 'utf8');
    logger.info(`Playlist updated successfully with ${results.length} items.`);
    return results.length;
  } catch (error) {
    logger.error(`Failed to update playlist: ${error.message}`);
    throw error;
  }
}

module.exports = {
  writePlaylistIfStale,
};
