const axios = require('axios');const logger = require('../logger');

const CHANNEL_NAME_RE = /<h5>\s*<a[^>]+>\s*<strong>([^<]+)<\/strong>/g;

async function fetchInwebviewChannelNames(url) {
    logger.info(`Fetching channel names from ${url}...`);
    const response = await axios.get(url, {
        timeout: 120000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'ru,en;q=0.9',
        },
    });
    const html = response.data;
    const seen = new Set();
    const names = [];
    let match;
    while ((match = CHANNEL_NAME_RE.exec(html)) !== null) {
        const name = match[1].trim();
        if (!name || seen.has(name)) continue;
        seen.add(name);
        names.push(name);
    }
    logger.info(`Extracted ${names.length} channel names from ${url}.`);
    return names;
}

module.exports = {fetchInwebviewChannelNames};