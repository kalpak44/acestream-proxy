const axios = require('axios');
const logger = require('../logger');
const {SEARCH_URL, PAGE_SIZE} = require('../config');

async function fetchAllResults() {
    const allResults = [];
    let page = 1;

    while (true) {
        logger.info(`Fetching search results, page ${page}...`);
        try {
            const response = await axios.get(SEARCH_URL, {
                params: {page, page_size: PAGE_SIZE},
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

            // Sometimes AceStream API might return fewer results than PAGE_SIZE even if there are more
            // or the "total" might be slightly inconsistent.
            // We'll keep fetching until we get 0 results to ensure we get everything.
            // We use the 'total' only as a hint for logging.
            
            page += 1;
        } catch (error) {
            logger.error(`An error occurred while requesting search results (page ${page}): ${error.message}`);
            if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                logger.warn(`Request for page ${page} timed out. Retrying once...`);
                // Simple one-time retry
                try {
                     const retryResponse = await axios.get(SEARCH_URL, {
                         params: {page, page_size: PAGE_SIZE},
                         timeout: 10000,
                     });
                     const data = retryResponse.data;
                     const result = data.result || {};
                     const results = result.results || [];
                     const total = parseInt(result.total || 0, 10);
                     if (results.length > 0) {
                         allResults.push(...results);
                         logger.info(`Collected ${allResults.length} / ${total} items after retry.`);
                         page += 1;
                         continue;
                     }
                } catch (retryError) {
                    logger.error(`Retry for page ${page} also failed: ${retryError.message}`);
                }
            }
            // If it's not a timeout or retry failed, we might want to break and return what we have
            // instead of throwing and failing everything, but 'throw error' was there before.
            // Let's stick to throwing for now as it's a critical error.
            throw error;
        }
    }

    return allResults;
}

module.exports = {
    fetchAllResults,
};
