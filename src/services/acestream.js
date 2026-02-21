const axios = require('axios');
const logger = require('../logger');
const { SEARCH_URL, PAGE_SIZE } = require('../config');

async function fetchAllResults() {
  const allResults = [];
  let page = 1;

  while (true) {
    logger.info(`Fetching search results, page ${page}...`);
    try {
      const response = await axios.get(SEARCH_URL, {
        params: { page, page_size: PAGE_SIZE },
        timeout: 15000,
      });

      const data = response.data;
      const result = data.result || {};
      const results = result.results || [];
      const total = parseInt(result.total || 0, 10);

      if (results.length === 0) {
        logger.info('No more results found.');
        break;
      }

      allResults.push(...results);
      logger.info(`Collected ${allResults.length} / ${total} items.`);

      if (allResults.length >= total) {
        break;
      }

      page += 1;
    } catch (error) {
      logger.error(`An error occurred while requesting search results: ${error.message}`);
      throw error;
    }
  }

  return allResults;
}

module.exports = {
  fetchAllResults,
};
