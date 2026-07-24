const axios = require('axios');
const logger = require('../logger');
const {SEARCH_URL, PAGE_SIZE} = require('../config');
const {tierKeys} = require('./matching');

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

function addToTier(map, key, entry) {
    if (!key) return;
    const bucket = map.get(key);
    if (bucket) {
        bucket.push(entry);
    } else {
        map.set(key, [entry]);
    }
}

async function buildInfohashIndex() {
    const byTier = [new Map(), new Map(), new Map(), new Map()];
    const entries = [];
    let page = 1;

    while (true) {
        logger.info(`Fetching AceStream search page ${page}...`);
        const results = await fetchPage(page);
        if (results.length === 0) break;

        for (const res of results) {
            const items = res.items || [];
            const infohashItem = items.find((it) => it && it.infohash);
            if (!infohashItem) continue;

            const name = res.name || '';
            const keys = tierKeys(name);
            if (!keys.t0) continue;

            const entry = {
                name,
                keys,
                infohash: infohashItem.infohash,
                channelId: infohashItem.channel_id || res.channel_id || '',
                logo: pickLogo(res.icons),
            };
            entries.push(entry);
            addToTier(byTier[0], keys.t0, entry);
            addToTier(byTier[1], keys.t1, entry);
            addToTier(byTier[2], keys.t2, entry);
            addToTier(byTier[3], keys.t3, entry);
        }

        logger.info(`AceStream index now holds ${entries.length} entries (page ${page}, +${results.length} raw).`);
        page += 1;
    }

    logger.info(`AceStream infohash index built: ${entries.length} entries with infohash across ${byTier[0].size} unique tier-0 names.`);
    return {byTier, entries};
}

module.exports = {
    buildInfohashIndex,
};