const fs = require('fs-extra');
const axios = require('axios');
const logger = require('../logger');
const { fetchAllResults } = require('./acestream');
const config = require('../config');

async function fetchExternalPlaylist(url, label) {
  try {
    logger.info(`Fetching external playlist: ${url}...`);
    const response = await axios.get(url, { timeout: 15000 });
    const content = response.data;
    const lines = content.split(/\r?\n/);
    const resultLines = [];
    
    let currentExtinf = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#EXTM3U')) {
        continue;
      }

      if (trimmed.startsWith('#EXTINF:')) {
        let updatedExtinf = trimmed;
        let group = label;

        if (updatedExtinf.includes('group-title="')) {
          const match = updatedExtinf.match(/group-title="([^"]*)"/);
          if (match && match[1]) {
            const originalGroup = match[1];
            group = `${originalGroup} / ${label}`;
            updatedExtinf = updatedExtinf.replace(/group-title="[^"]*"/, `group-title="${group}"`);
          } else {
            updatedExtinf = updatedExtinf.replace(/group-title="[^"]*"/, `group-title="${label}"`);
          }
        } else {
          updatedExtinf = updatedExtinf.replace(/,/, ` group-title="${label}",`);
        }
        currentExtinf = { line: updatedExtinf, group };
      } else if (!trimmed.startsWith('#')) {
        if (currentExtinf) {
          resultLines.push(`#EXTGRP:${currentExtinf.group}`);
          resultLines.push(currentExtinf.line);
          resultLines.push(trimmed);
          currentExtinf = null;
        }
      }
    }
    return resultLines.join('\n');
  } catch (error) {
    logger.error(`Failed to fetch external playlist ${url}: ${error.message}`);
    return '';
  }
}

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
  const groupToItems = {};
  const uniqueCountries = new Set();
  const uniqueCategories = new Set();

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

      // Filter by configuration
      const isCountryInMap = countries.some((c) => {
        const cLower = c.toLowerCase();
        return config.COUNTRY_MAP.some(cm => cm.code === cLower);
      });
      const isCategoryInMap = itemCategories.some((cat) => {
        const catLower = cat.toLowerCase();
        // Check if catLower is in any of the remapped categories
        return config.CATEGORY_REMAP.some(remap => remap.sources.includes(catLower));
      });

      if (!isCountryInMap && !isCategoryInMap) {
        continue;
      }

      const groups = new Set();

      // Handle INFOHASH_CATEGORY_OVERRIDE
      for (const [name, infohashes] of Object.entries(config.INFOHASH_CATEGORY_OVERRIDE)) {
        if (Array.isArray(infohashes) && infohashes.includes(infohash)) {
          groups.add(name);
        }
      }

      // Handle INFOHASH_COUNTRY_OVERRIDE
      for (const [name, infohashes] of Object.entries(config.INFOHASH_COUNTRY_OVERRIDE)) {
        if (Array.isArray(infohashes) && infohashes.includes(infohash)) {
          groups.add(name);
        }
      }

      // Add categories
      for (const cat of itemCategories) {
        const catLower = cat.toLowerCase();
        uniqueCategories.add(catLower);
        
        // Remap category if needed
        const remap = config.CATEGORY_REMAP.find(r => r.sources.includes(catLower));
        if (remap) {
          groups.add(remap.name);
        }
      }

      // Add countries
      for (const c of countries) {
        const cLower = c.toLowerCase();
        uniqueCountries.add(cLower);
        const countryEntry = config.COUNTRY_MAP.find(cm => cm.code === cLower);
        if (countryEntry) {
          groups.add(countryEntry.name);
        }
      }

      if (groups.size === 0) {
        groups.add('Прочее');
      }

      const channelId = item.channel_id || res.channel_id;
      const tvgIdAttr = channelId !== undefined && channelId !== null ? ` tvg-id="${channelId}"` : '';

      const displayName = !epgTitle ? name : `${name} — ${epgTitle}`;

      for (const group of groups) {
        if (!groupToItems[group]) {
          groupToItems[group] = [];
        }
        const extinf = `#EXTINF:-1 tvg-name="${name}"${tvgIdAttr} tvg-logo="${logo}" group-title="${group}",${displayName}`;
        const streamUrl = `${config.STREAM_BASE_URL}?infohash=${infohash}`;
        groupToItems[group].push(`#EXTGRP:${group}\n${extinf}\n${streamUrl}`);
      }
    }
  }

  if (uniqueCountries.size > 0) {
    logger.info(`Unique countries: ${Array.from(uniqueCountries).sort().join(', ')}`);
  }
  if (uniqueCategories.size > 0) {
    logger.info(`Unique categories: ${Array.from(uniqueCategories).sort().join(', ')}`);
  }

  return groupToItems;
}

async function writePlaylistIfStale(force = false) {
  let needUpdate = force;
  
  if (!needUpdate) {
    try {
      const exists = await fs.pathExists(config.PLAYLIST_FILE);
      if (!exists) {
        logger.info(`Playlist file ${config.PLAYLIST_FILE} does not exist. Initializing...`);
        needUpdate = true;
      } else {
        const stats = await fs.stat(config.PLAYLIST_FILE);
        const age = (Date.now() - stats.mtimeMs) / 1000;
        if (age > config.CACHE_TTL) {
          logger.info(`Playlist file ${config.PLAYLIST_FILE} is stale (age: ${Math.round(age)}s, TTL: ${config.CACHE_TTL}s). Refreshing...`);
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
    const groupToItems = generateM3u8(results);
    const finalGroups = {};

    // 1. Collect all category content (Internal + External)
    for (const cat of config.CATEGORY_REMAP) {
      let groupLines = [];
      
      // Internal content
      if (groupToItems[cat.name]) {
        groupLines.push(...groupToItems[cat.name]);
        delete groupToItems[cat.name]; // Mark as consumed
      }

      // External content
      if (Array.isArray(cat.external)) {
        for (const url of cat.external) {
          const extContent = await fetchExternalPlaylist(url, cat.name);
          if (extContent) {
            groupLines.push(extContent);
          }
        }
      }

      if (groupLines.length > 0) {
        finalGroups[cat.name] = groupLines.join('\n');
      }
    }

    // 2. Collect all country content (Internal + External)
    for (const country of config.COUNTRY_MAP) {
      let groupLines = [];

      // Internal content
      if (groupToItems[country.name]) {
        groupLines.push(...groupToItems[country.name]);
        delete groupToItems[country.name]; // Mark as consumed
      }

      // External content
      if (Array.isArray(country.external)) {
        for (const url of country.external) {
          const extContent = await fetchExternalPlaylist(url, country.name);
          if (extContent) {
            groupLines.push(extContent);
          }
        }
      }

      if (groupLines.length > 0) {
        finalGroups[country.name] = groupLines.join('\n');
      }
    }

    // 3. Handle any leftovers (e.g., 'Прочее' if it wasn't in remapping or countries)
    for (const [group, items] of Object.entries(groupToItems)) {
      if (finalGroups[group]) {
        finalGroups[group] += '\n' + items.join('\n');
      } else {
        finalGroups[group] = items.join('\n');
      }
    }

    // Combine everything in final order
    const lines = ['#EXTM3U'];
    
    // 1. Categories in config order
    for (const cat of config.CATEGORY_REMAP) {
      if (finalGroups[cat.name]) {
        lines.push(finalGroups[cat.name]);
        delete finalGroups[cat.name];
      }
    }

    // 2. Countries in config order
    for (const country of config.COUNTRY_MAP) {
      if (finalGroups[country.name]) {
        lines.push(finalGroups[country.name]);
        delete finalGroups[country.name];
      }
    }

    // 3. Anything else
    for (const content of Object.values(finalGroups)) {
      lines.push(content);
    }

    const content = lines.join('\n') + '\n';
    await fs.writeFile(config.PLAYLIST_FILE, content, 'utf8');
    logger.info(`Playlist updated successfully with ${results.length} items from AceStream and external playlists.`);
    return results.length;
  } catch (error) {
    logger.error(`Failed to update playlist: ${error.message}`);
    throw error;
  }
}

module.exports = {
  writePlaylistIfStale
};
