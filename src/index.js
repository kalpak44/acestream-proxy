const cron = require('node-cron');
const app = require('./app');
const logger = require('./logger');
const {PORT, CRON_SCHEDULE} = require('./config');
const {buildPlaylist} = require('./services/playlist');

async function buildWithRetries() {
    const maxRetries = 10;
    const retryDelay = 5000;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await buildPlaylist();
            return true;
        } catch (error) {
            logger.warn(`Playlist build attempt ${attempt} failed: ${error.message}`);
            if (attempt < maxRetries) {
                await new Promise((resolve) => setTimeout(resolve, retryDelay));
            }
        }
    }
    logger.error('Giving up playlist build after several attempts.');
    return false;
}

function scheduleDailyBuild() {
    if (!cron.validate(CRON_SCHEDULE)) {
        logger.error(`Invalid CRON_SCHEDULE "${CRON_SCHEDULE}"; daily rebuild disabled.`);
        return;
    }
    cron.schedule(CRON_SCHEDULE, async () => {
        logger.info(`Cron tick (${CRON_SCHEDULE}) — rebuilding playlist.`);
        try {
            await buildPlaylist();
        } catch (error) {
            logger.error(`Scheduled playlist rebuild failed: ${error.message}`);
        }
    });
    logger.info(`Scheduled playlist rebuild with cron "${CRON_SCHEDULE}".`);
}

app.listen(PORT, '0.0.0.0', async () => {
    logger.info(`Server listening on port ${PORT}`);
    scheduleDailyBuild();
    await buildWithRetries();
});