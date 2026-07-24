const logger = require('../../logger');
const config = require('../../config');
const PlaylistRow = require('./PlaylistRow');
const {streamSourceChannels} = require('./sourceFetcher');
const {tierKeys, bigramSimilarity} = require('../matching');

const FUZZY_THRESHOLD = 0.85;
const UNMATCHED_LOG_LIMIT = 20;
const CANDIDATES_PER_UNMATCHED = 3;
const INFOHASH_RE = /^[0-9a-f]{40}$/i;
const SAMPLE_URL_LOG_LIMIT = 3;

function buildStreamUrl(base, infohash) {
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}infohash=${infohash}`;
}

function candidateNames(channel) {
    return [channel.tvgName, channel.displayName].filter(Boolean);
}

function bestByCloseness(candidates, sourceT0) {
    if (candidates.length === 1) return candidates[0];
    let best = candidates[0];
    let bestScore = -1;
    for (const c of candidates) {
        const s = bigramSimilarity(sourceT0, c.keys.t0);
        if (s > bestScore) {
            bestScore = s;
            best = c;
        }
    }
    return best;
}

function lookupExact(sourceKeys, byTier) {
    for (let tier = 0; tier < 4; tier++) {
        const key = sourceKeys[`t${tier}`];
        if (!key) continue;
        const hit = byTier[tier].get(key);
        if (hit && hit.length > 0) {
            return {match: bestByCloseness(hit, sourceKeys.t0), tier};
        }
    }
    return null;
}

function lookupFuzzy(sourceKeys, entries) {
    let best = null;
    let bestScore = FUZZY_THRESHOLD;
    for (const e of entries) {
        const score = bigramSimilarity(sourceKeys.t0, e.keys.t0);
        if (score > bestScore) {
            bestScore = score;
            best = e;
        }
    }
    return best ? {match: best, tier: 4, score: bestScore} : null;
}

function topCandidates(sourceKeys, entries, limit) {
    const scored = [];
    for (const e of entries) {
        const score = bigramSimilarity(sourceKeys.t0, e.keys.t0);
        if (score > 0) scored.push({entry: e, score});
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
}

async function* generateRows(index) {
    const {byTier, entries} = index;
    const tierHits = [0, 0, 0, 0, 0];
    const unmatched = [];
    let matched = 0;
    let skippedNoName = 0;
    let skippedBadInfohash = 0;
    let sampleUrlsLogged = 0;

    for await (const channel of streamSourceChannels(config.SOURCE_PLAYLIST_URL)) {
        const primaryName = channel.tvgName || channel.displayName;
        if (!primaryName) {
            skippedNoName += 1;
            continue;
        }

        let hit = null;
        for (const cand of candidateNames(channel)) {
            const sourceKeys = tierKeys(cand);
            const found = lookupExact(sourceKeys, byTier);
            if (found) {
                hit = {...found, sourceKeys};
                break;
            }
        }

        if (!hit) {
            const primaryKeys = tierKeys(primaryName);
            const fuzzy = lookupFuzzy(primaryKeys, entries);
            if (fuzzy) {
                hit = {...fuzzy, sourceKeys: primaryKeys};
            } else if (unmatched.length < UNMATCHED_LOG_LIMIT) {
                unmatched.push({
                    tvgName: channel.tvgName,
                    displayName: channel.displayName,
                    group: channel.group,
                    keys: primaryKeys,
                    candidates: topCandidates(primaryKeys, entries, CANDIDATES_PER_UNMATCHED),
                });
            }
        }

        if (!hit) continue;

        const {match} = hit;
        if (!INFOHASH_RE.test(match.infohash || '')) {
            skippedBadInfohash += 1;
            logger.warn(`Skipping "${primaryName}" — infohash "${match.infohash}" is not a 40-char hex string.`);
            continue;
        }

        tierHits[hit.tier] += 1;
        matched += 1;

        const name = channel.displayName || channel.tvgName || 'Unknown';
        const streamUrl = buildStreamUrl(config.STREAM_BASE_URL, match.infohash);

        if (sampleUrlsLogged < SAMPLE_URL_LOG_LIMIT) {
            logger.info(`Sample stream URL [tier${hit.tier}] "${name}" -> ${streamUrl}`);
            sampleUrlsLogged += 1;
        }

        yield new PlaylistRow(name, streamUrl, {
            tvgName: channel.tvgName || name,
            tvgId: channel.tvgId || match.channelId || '',
            logo: channel.logo || match.logo || '',
            group: channel.group || '',
        });
    }

    logger.info(
        `Match summary — total matched: ${matched}, tier0: ${tierHits[0]}, tier1: ${tierHits[1]}, ` +
        `tier2: ${tierHits[2]}, tier3: ${tierHits[3]}, fuzzy(tier4): ${tierHits[4]}, ` +
        `unmatched-with-samples: ${unmatched.length}, skipped-noname: ${skippedNoName}, ` +
        `skipped-bad-infohash: ${skippedBadInfohash}.`
    );

    for (const u of unmatched) {
        const label = `[${u.group || '-'}] "${u.displayName || ''}" (tvg-name="${u.tvgName || ''}")`;
        const keys = `t0="${u.keys.t0}" t1="${u.keys.t1}" t2="${u.keys.t2}" t3="${u.keys.t3}"`;
        const cands = u.candidates.length
            ? u.candidates.map((c) => `"${c.entry.name}"(${c.score.toFixed(2)})`).join(', ')
            : '(no candidates above 0)';
        logger.info(`Unmatched ${label} keys=[${keys}] nearest=[${cands}]`);
    }
}

module.exports = {generateRows};