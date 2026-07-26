const logger = require('./logger');
const {PORT, assertAuthConfig} = require('./config');

try {
    assertAuthConfig();
} catch (err) {
    logger.error(err.message);
    process.exit(1);
}

const app = require('./app');
const settings = require('./services/settings');
const playlists = require('./services/playlists');
const {rebuild} = require('./services/playlistBuilder');

async function rebuildPlaylistsAtStartup() {
    const all = await playlists.list();
    let rebuilt = 0;
    for (const playlist of all) {
        try {
            await rebuild(playlist.id);
            rebuilt += 1;
        } catch (err) {
            logger.error(`Startup rebuild failed for playlist ${playlist.id}: ${err.message}`);
        }
    }
    logger.info(`Startup rebuild completed for ${rebuilt}/${all.length} playlists.`);
}

async function start() {
    try {
        await settings.load();
    } catch (err) {
        logger.error(`Settings load failed: ${err.message}`);
    }
    try {
        await rebuildPlaylistsAtStartup();
    } catch (err) {
        logger.error(`Startup playlist rebuild failed: ${err.message}`);
    }
    app.listen(PORT, '0.0.0.0', () => {
        logger.info(`Server listening on port ${PORT}`);
    });
}

start();
