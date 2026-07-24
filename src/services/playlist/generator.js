const logger = require('../../logger');
const config = require('../../config');
const PlaylistRow = require('./PlaylistRow');
const {streamSourceChannels} = require('./sourceFetcher');
const {fetchInwebviewChannelNames} = require('../inwebview');
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

function resolveChannel(channel, index) {
    const {byTier, entries} = index;
    const primaryName = channel.tvgName || channel.displayName;
    if (!primaryName) return {reason: 'noname'};

    for (const cand of candidateNames(channel)) {
        const sourceKeys = tierKeys(cand);
        const found = lookupExact(sourceKeys, byTier);
        if (found) return {hit: {...found, sourceKeys}};
    }

    const primaryKeys = tierKeys(primaryName);
    const fuzzy = lookupFuzzy(primaryKeys, entries);
    if (fuzzy) return {hit: {...fuzzy, sourceKeys: primaryKeys}};
    return {reason: 'nomatch', keys: primaryKeys};
}

async function* generateRows(index) {
    const {entries} = index;
    const tierHits = [0, 0, 0, 0, 0];
    const unmatched = [];
    const emittedInfohashes = new Set();
    let matched = 0;
    let skippedNoName = 0;
    let skippedBadInfohash = 0;
    let sampleUrlsLogged = 0;

    for await (const channel of streamSourceChannels(config.SOURCE_PLAYLIST_URL)) {
        const result = resolveChannel(channel, index);
        if (result.reason === 'noname') {
            skippedNoName += 1;
            continue;
        }
        if (result.reason === 'nomatch') {
            if (unmatched.length < UNMATCHED_LOG_LIMIT) {
                unmatched.push({
                    tvgName: channel.tvgName,
                    displayName: channel.displayName,
                    group: channel.group,
                    keys: result.keys,
                    candidates: topCandidates(result.keys, entries, CANDIDATES_PER_UNMATCHED),
                });
            }
            continue;
        }

        const {hit} = result;
        const {match} = hit;
        if (!INFOHASH_RE.test(match.infohash || '')) {
            skippedBadInfohash += 1;
            logger.warn(`Skipping "${channel.tvgName || channel.displayName}" — infohash "${match.infohash}" is not a 40-char hex string.`);
            continue;
        }

        tierHits[hit.tier] += 1;
        matched += 1;
        emittedInfohashes.add(match.infohash);

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
        `Source match summary — matched: ${matched}, tier0: ${tierHits[0]}, tier1: ${tierHits[1]}, ` +
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

    for (const source of config.INWEBVIEW_SOURCES || []) {
        if (!source || !source.url || !source.group) continue;

        let extraNames = [];
        try {
            extraNames = await fetchInwebviewChannelNames(source.url);
        } catch (err) {
            logger.warn(`Failed to fetch extra channel names from ${source.url}: ${err.message}`);
            continue;
        }

        const extraTierHits = [0, 0, 0, 0, 0];
        let extraAppended = 0;
        let extraDedup = 0;
        let extraUnmatched = 0;
        const unmatchedExtras = [];

        for (const name of extraNames) {
            const result = resolveChannel({tvgName: name, displayName: name}, index);
            if (result.reason === 'noname' || result.reason === 'nomatch') {
                extraUnmatched += 1;
                if (unmatchedExtras.length < UNMATCHED_LOG_LIMIT && result.keys) {
                    unmatchedExtras.push({
                        name,
                        keys: result.keys,
                        candidates: topCandidates(result.keys, entries, CANDIDATES_PER_UNMATCHED),
                    });
                }
                continue;
            }
            const {hit} = result;
            const {match} = hit;
            if (!INFOHASH_RE.test(match.infohash || '')) continue;
            if (emittedInfohashes.has(match.infohash)) {
                extraDedup += 1;
                continue;
            }

            emittedInfohashes.add(match.infohash);
            extraTierHits[hit.tier] += 1;
            extraAppended += 1;

            const streamUrl = buildStreamUrl(config.STREAM_BASE_URL, match.infohash);
            yield new PlaylistRow(name, streamUrl, {
                tvgName: name,
                tvgId: match.channelId || '',
                logo: match.logo || '',
                group: source.group,
            });
        }

        logger.info(
            `Extra source (${source.url}) — appended: ${extraAppended} to "${source.group}", ` +
            `tier0: ${extraTierHits[0]}, tier1: ${extraTierHits[1]}, tier2: ${extraTierHits[2]}, ` +
            `tier3: ${extraTierHits[3]}, fuzzy(tier4): ${extraTierHits[4]}, ` +
            `dedup-existing-infohash: ${extraDedup}, unmatched: ${extraUnmatched}.`
        );
        for (const u of unmatchedExtras) {
            const keys = `t0="${u.keys.t0}" t1="${u.keys.t1}" t2="${u.keys.t2}" t3="${u.keys.t3}"`;
            const cands = u.candidates.length
                ? u.candidates.map((c) => `"${c.entry.name}"(${c.score.toFixed(2)})`).join(', ')
                : '(no candidates above 0)';
            logger.info(`Unmatched extra "${u.name}" keys=[${keys}] nearest=[${cands}]`);
        }
    }
}

module.exports = {generateRows};