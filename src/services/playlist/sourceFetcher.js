const readline = require('node:readline');
const axios = require('axios');
const logger = require('../../logger');

function parseExtinf(line) {
    const tvgId = line.match(/tvg-id="([^"]*)"/)?.[1] || '';
    const tvgName = line.match(/tvg-name="([^"]*)"/)?.[1] || '';
    const logo = line.match(/tvg-logo="([^"]*)"/)?.[1] || '';
    const commaIdx = line.indexOf(',');
    const displayName = commaIdx === -1 ? '' : line.substring(commaIdx + 1).trim();
    return {tvgId, tvgName, logo, displayName};
}

async function* streamSourceChannels(url) {
    logger.info(`Streaming source playlist: ${url}`);
    const response = await axios.get(url, {responseType: 'stream', timeout: 30000});
    const rl = readline.createInterface({input: response.data, crlfDelay: Infinity});

    let pending = null;
    let group = '';
    let count = 0;

    try {
        for await (const raw of rl) {
            const line = raw.trim();
            if (!line || line.startsWith('#EXTM3U')) continue;

            if (line.startsWith('#EXTINF:')) {
                pending = parseExtinf(line);
                continue;
            }

            if (line.startsWith('#EXTGRP:')) {
                group = line.substring('#EXTGRP:'.length).trim();
                continue;
            }

            if (line.startsWith('#')) continue;

            if (pending) {
                yield {
                    tvgId: pending.tvgId,
                    tvgName: pending.tvgName,
                    logo: pending.logo,
                    displayName: pending.displayName,
                    group,
                    sourceUrl: line,
                };
                count += 1;
                pending = null;
            }
        }
    } finally {
        rl.close();
        if (typeof response.data.destroy === 'function') response.data.destroy();
        logger.info(`Streamed ${count} channels from source playlist.`);
    }
}

module.exports = {streamSourceChannels};