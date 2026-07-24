#!/usr/bin/env node
// Offline matching diagnostic.
//
// Reads a JSON dump produced by scripts/dump-acestream.sh (an array of raw
// AceStream `result` objects) and streams the source M3U from
// SOURCE_PLAYLIST_URL. Runs the same tiered matcher used by the app and
// prints:
//   - per-tier hit counts (tier0..3 exact, tier4 fuzzy)
//   - the first N unmatched channels with normalized keys and nearest
//     AceStream candidates by bigram similarity
//
// Usage:
//   SOURCE_PLAYLIST_URL="https://iptv.online/play/XXXXXXXXXX/m3u8" \
//     node scripts/diagnose-matching.js [dump.json] [limit]
//
// Defaults:
//   dump.json = ./acestream-dump.json
//   limit     = 40  (unmatched samples to print)

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const axios = require('axios');

const {tierKeys, bigramSimilarity} = require(path.join(__dirname, '..', 'src', 'services', 'matching'));

const DUMP_PATH = process.argv[2] || './acestream-dump.json';
const UNMATCHED_LIMIT = Number.parseInt(process.argv[3] || '40', 10);
const FUZZY_THRESHOLD = 0.85;
const SOURCE_URL = process.env.SOURCE_PLAYLIST_URL;

if (!SOURCE_URL) {
    console.error('SOURCE_PLAYLIST_URL env var is required.');
    process.exit(1);
}

function loadIndex(dumpFile) {
    const raw = JSON.parse(fs.readFileSync(dumpFile, 'utf8'));
    if (!Array.isArray(raw)) {
        throw new Error(`Dump file ${dumpFile} is not a JSON array.`);
    }
    const byTier = [new Map(), new Map(), new Map(), new Map()];
    const entries = [];
    for (const res of raw) {
        const items = res.items || [];
        const infohashItem = items.find((it) => it && it.infohash);
        if (!infohashItem) continue;
        const name = res.name || '';
        const keys = tierKeys(name);
        if (!keys.t0) continue;
        const entry = {name, keys, infohash: infohashItem.infohash};
        entries.push(entry);
        for (let t = 0; t < 4; t++) {
            const key = keys[`t${t}`];
            if (!key) continue;
            if (!byTier[t].has(key)) byTier[t].set(key, []);
            byTier[t].get(key).push(entry);
        }
    }
    return {byTier, entries};
}

function parseExtinf(line) {
    const tvgName = line.match(/tvg-name="([^"]*)"/)?.[1] || '';
    const commaIdx = line.indexOf(',');
    const displayName = commaIdx === -1 ? '' : line.substring(commaIdx + 1).trim();
    return {tvgName, displayName};
}

async function* streamSource(url) {
    const response = await axios.get(url, {responseType: 'stream', timeout: 30000});
    const rl = readline.createInterface({input: response.data, crlfDelay: Infinity});
    let pending = null;
    let group = '';
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
                yield {...pending, group};
                pending = null;
            }
        }
    } finally {
        rl.close();
        if (typeof response.data.destroy === 'function') response.data.destroy();
    }
}

function lookupExact(sourceKeys, byTier) {
    for (let t = 0; t < 4; t++) {
        const key = sourceKeys[`t${t}`];
        if (!key) continue;
        const hit = byTier[t].get(key);
        if (hit && hit.length) return {tier: t, match: hit[0], candidates: hit.length};
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
    return best ? {tier: 4, match: best, score: bestScore} : null;
}

function nearest(sourceKeys, entries, n) {
    const scored = [];
    for (const e of entries) {
        const s = bigramSimilarity(sourceKeys.t0, e.keys.t0);
        if (s > 0) scored.push({name: e.name, score: s});
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, n);
}

(async () => {
    console.log(`Loading AceStream dump from ${DUMP_PATH}...`);
    const {byTier, entries} = loadIndex(DUMP_PATH);
    console.log(`Loaded ${entries.length} entries with infohash (${byTier[0].size} unique tier-0 keys).`);

    const hits = [0, 0, 0, 0, 0];
    const unmatched = [];
    let total = 0;

    for await (const ch of streamSource(SOURCE_URL)) {
        total += 1;
        let found = null;
        for (const candName of [ch.tvgName, ch.displayName].filter(Boolean)) {
            const sk = tierKeys(candName);
            const exact = lookupExact(sk, byTier);
            if (exact) {
                found = {...exact, keys: sk};
                break;
            }
        }
        if (!found) {
            const sk = tierKeys(ch.tvgName || ch.displayName || '');
            const fuzzy = lookupFuzzy(sk, entries);
            if (fuzzy) found = {...fuzzy, keys: sk};
            else if (unmatched.length < UNMATCHED_LIMIT) {
                unmatched.push({
                    ...ch,
                    keys: sk,
                    nearest: nearest(sk, entries, 3),
                });
            }
        }
        if (found) hits[found.tier] += 1;
    }

    console.log(`\nSource channels: ${total}`);
    console.log(`Matched tier0 (exact strict):   ${hits[0]}`);
    console.log(`Matched tier1 (quality strip):  ${hits[1]}`);
    console.log(`Matched tier2 (timezone strip): ${hits[2]}`);
    console.log(`Matched tier3 (both strip):     ${hits[3]}`);
    console.log(`Matched tier4 (fuzzy ≥ ${FUZZY_THRESHOLD}):  ${hits[4]}`);
    const matched = hits.reduce((a, b) => a + b, 0);
    console.log(`Matched total:                  ${matched} (${((matched / total) * 100).toFixed(1)}%)`);
    console.log(`Unmatched:                      ${total - matched}`);

    console.log(`\nFirst ${unmatched.length} unmatched (nearest AceStream names with bigram score):`);
    for (const u of unmatched) {
        const cands = u.nearest.length
            ? u.nearest.map((c) => `"${c.name}"(${c.score.toFixed(2)})`).join(', ')
            : '(no candidates > 0)';
        console.log(`  [${u.group || '-'}] tvg-name="${u.tvgName}" display="${u.displayName}"`);
        console.log(`      keys t0="${u.keys.t0}" t1="${u.keys.t1}" t2="${u.keys.t2}" t3="${u.keys.t3}"`);
        console.log(`      nearest: ${cands}`);
    }
})().catch((err) => {
    console.error(err.stack || err.message);
    process.exit(1);
});