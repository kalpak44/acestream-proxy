const fs = require('fs-extra');
const logger = require('../logger');
const {fetchAllResults} = require('./acestream');
const config = require('../config');

const PlaylistRow = require('./playlist/PlaylistRow');
const PlaylistWriter = require('./playlist/PlaylistWriter');
const {fetchExternalPlaylist} = require('./playlist/externalFetcher');
const {generateM3u8} = require('./playlist/generator');

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

        // Combine everything using PlaylistWriter
        const writer = new PlaylistWriter();

        // Reusable function to fetch and add external rows
        const addExternalRows = async (groupName, externalUrls) => {
            if (Array.isArray(externalUrls)) {
                for (const url of externalUrls) {
                    const extRows = await fetchExternalPlaylist(url, groupName);
                    if (extRows && extRows.length > 0) {
                        for (const row of extRows) {
                            writer.addRow(row);
                        }
                    }
                }
            }
        };

        // Helper to add internal rows
        const addInternalRows = (groupName) => {
            if (groupToItems[groupName]) {
                for (const item of groupToItems[groupName]) {
                    writer.addRow(item);
                }
            }
        };

        // 1. Categories
        for (const cat of config.CATEGORY_REMAP) {
            addInternalRows(cat.name);
            await addExternalRows(cat.name, cat.external);
        }

        // 2. Countries
        for (const country of config.COUNTRY_MAP) {
            addInternalRows(country.name);
            await addExternalRows(country.name, country.external);
        }

        await fs.writeFile(config.PLAYLIST_FILE, writer.toString(), 'utf8');
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
