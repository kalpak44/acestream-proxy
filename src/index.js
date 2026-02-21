const app = require('./app');
const logger = require('./logger');
const fs = require('fs-extra');
const { PORT, PLAYLIST_FILE } = require('./config');
const { writePlaylistIfStale } = require('./services/playlist');

async function onStartup() {
  logger.info('Service starting up. Initializing playlist...');
  const maxRetries = 10;
  const retryDelay = 5000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const count = await writePlaylistIfStale();
      const exists = await fs.pathExists(PLAYLIST_FILE);
      if (count !== null || exists) {
        logger.info('Startup playlist initialization complete.');
        return;
      }
    } catch (error) {
      logger.warn(`Startup playlist initialization attempt ${attempt} failed: ${error.message}`);
    }

    if (attempt < maxRetries) {
      logger.info(`Retrying in ${retryDelay / 1000} seconds...`);
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  logger.error('Failed to initialize playlist after several attempts during startup.');
}

app.listen(PORT, '0.0.0.0', async () => {
  logger.info(`Server listening on port ${PORT}`);
  await onStartup();
});
