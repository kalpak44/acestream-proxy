const fs = require('fs-extra');
const logger = require('../logger');
const config = require('../config');
const {buildInfohashIndex} = require('./acestream');
const PlaylistWriter = require('./playlist/PlaylistWriter');
const {generateRows} = require('./playlist/generator');

async function buildPlaylist() {
    if (!config.SOURCE_PLAYLIST_URL) {
        throw new Error('SOURCE_PLAYLIST_URL is not configured.');
    }

    const tmpPath = `${config.PLAYLIST_FILE}.tmp`;
    logger.info('Building playlist...');

    const infohashIndex = await buildInfohashIndex();
    const writer = new PlaylistWriter(tmpPath, {epgUrl: config.EPG_URL});

    try {
        for await (const row of generateRows(infohashIndex)) {
            await writer.addRow(row);
        }
        const count = await writer.close();
        await fs.move(tmpPath, config.PLAYLIST_FILE, {overwrite: true});
        logger.info(`Playlist written to ${config.PLAYLIST_FILE} with ${count} entries.`);
        return count;
    } catch (error) {
        try {
            await writer.close();
        } catch (_) { /* swallow */ }
        await fs.remove(tmpPath).catch(() => {});
        logger.error(`Failed to build playlist: ${error.message}`);
        throw error;
    }
}

module.exports = {buildPlaylist};