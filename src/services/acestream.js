const axios = require('axios');
const logger = require('../logger');
const {SEARCH_URL, PAGE_SIZE} = require('../config');

function normalizeName(name) {
    return String(name || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function pickLogo(icons) {
    if (!Array.isArray(icons) || icons.length === 0) return '';
    const primary = icons.find((i) => i && i.type === 0 && i.url);
    if (primary) return primary.url;
    const any = icons.find((i) => i && i.url);
    return any ? any.url : '';
}

async function fetchPage(page) {
    const params = {page, page_size: PAGE_SIZE};
    try {
        const response = await axios.get(SEARCH_URL, {params, timeout: 15000});
        return response.data?.result?.results || [];
    } catch (error) {
        if (error.code === 'ECONNABORTED' || /timeout/i.test(error.message)) {
            logger.warn(`AceStream search page ${page} timed out. Retrying once...`);
            const retry = await axios.get(SEARCH_URL, {params, timeout: 15000});
            return retry.data?.result?.results || [];
        }
        throw error;
    }
}

async function buildInfohashIndex() {
    const index = new Map();
    let page = 1;
    let totalAdded = 0;

    while (true) {
        logger.info(`Fetching AceStream search page ${page}...`);
        const results = await fetchPage(page);
        if (results.length === 0) break;

        for (const res of results) {
            const items = res.items || [];
            const infohashItem = items.find((it) => it && it.infohash);
            if (!infohashItem) continue;

            const key = normalizeName(res.name);
            if (!key || index.has(key)) continue;

            index.set(key, {
                infohash: infohashItem.infohash,
                channelId: infohashItem.channel_id || res.channel_id || '',
                logo: pickLogo(res.icons),
            });
            totalAdded += 1;
        }

        logger.info(`AceStream index now holds ${index.size} unique names (page ${page}, +${results.length} raw).`);
        page += 1;
    }

    logger.info(`AceStream infohash index built: ${index.size} unique channels (from ${totalAdded} candidates).`);
    return index;
}

module.exports = {
    buildInfohashIndex,
    normalizeName,
};