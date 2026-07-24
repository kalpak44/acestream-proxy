const logger = require('../../logger');
const config = require('../../config');
const PlaylistRow = require('./PlaylistRow');
const {streamSourceChannels} = require('./sourceFetcher');
const {normalizeName} = require('../acestream');

function matchInfohash(channel, index) {
    const candidates = [channel.tvgName, channel.displayName];
    for (const candidate of candidates) {
        const key = normalizeName(candidate);
        if (!key) continue;
        const hit = index.get(key);
        if (hit) return hit;
    }
    return null;
}

async function* generateRows(infohashIndex) {
    let matched = 0;
    let skipped = 0;

    for await (const channel of streamSourceChannels(config.SOURCE_PLAYLIST_URL)) {
        const match = matchInfohash(channel, infohashIndex);
        if (!match) {
            skipped += 1;
            continue;
        }

        const name = channel.displayName || channel.tvgName || 'Unknown';
        const streamUrl = `${config.STREAM_BASE_URL}?infohash=${match.infohash}`;

        yield new PlaylistRow(name, streamUrl, {
            tvgName: channel.tvgName || name,
            tvgId: channel.tvgId || match.channelId || '',
            logo: channel.logo || match.logo || '',
            group: channel.group || '',
        });
        matched += 1;
    }

    logger.info(`Playlist generation done: matched ${matched} channels, skipped ${skipped} without AceStream infohash.`);
}

module.exports = {generateRows};