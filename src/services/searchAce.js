const axios = require('axios');
const logger = require('../logger');

const SEARCH_ACE_BASE = 'https://search-ace.stream/playlist';
const EXTINF_RE = /^#EXTINF:[^,]*,(.+)$/;
const INFOHASH_URL_RE = /[?&]infohash=([0-9a-f]{40})/i;

function langTag(lang) {
    return new RegExp(`\\[${lang}\\]`, 'i');
}

async function fetchSearchAceChannels(category, lang = null) {
    const url = `${SEARCH_ACE_BASE}?category=${encodeURIComponent(category)}`;
    logger.info(`Fetching channels from search-ace.stream category "${category}"...`);
    const response = await axios.get(url, {
        timeout: 60000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': 'application/x-mpegurl,*/*',
            'Accept-Language': 'ru,en;q=0.9',
        },
    });

    const lines = String(response.data).split('\n');
    const channels = [];
    let pendingName = null;

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        const infMatch = EXTINF_RE.exec(line);
        if (infMatch) {
            pendingName = infMatch[1].trim();
            continue;
        }

        if (pendingName && !line.startsWith('#')) {
            const hashMatch = INFOHASH_URL_RE.exec(line);
            if (hashMatch) {
                const name = pendingName;
                if (!lang || langTag(lang).test(name)) {
                    channels.push({name, infohash: hashMatch[1].toLowerCase()});
                }
            }
            pendingName = null;
        }
    }

    const langNote = lang ? ` (lang=${lang})` : '';
    logger.info(`Extracted ${channels.length} channels from search-ace.stream category "${category}"${langNote}.`);
    return channels;
}

module.exports = {fetchSearchAceChannels};