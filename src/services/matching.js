const QUALITY_TOKENS = new Set([
    'hd', 'fhd', 'uhd', 'sd', 'hq', 'lq',
    '4k', '2k', '8k',
    'hevc', 'h265', 'h264',
]);

const TIMEZONE_TOKENS = new Set([
    'east', 'west', 'europe', 'european', 'eu',
    'снг', 'мир', 'европа', 'планета', 'международная', 'international', 'intl',
    'cis', 'cng',
]);

const PLUS_OFFSET_TOKEN = /^\+\d{1,2}$/;

function normalize(input) {
    if (!input) return '';
    return String(input)
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}+]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function tokens(normalized) {
    return normalized ? normalized.split(' ') : [];
}

function stripTokens(normalized, {quality = false, timezone = false} = {}) {
    if (!normalized) return '';
    const kept = tokens(normalized).filter((t) => {
        if (quality && QUALITY_TOKENS.has(t)) return false;
        if (timezone && TIMEZONE_TOKENS.has(t)) return false;
        if (timezone && PLUS_OFFSET_TOKEN.test(t)) return false;
        return true;
    });
    return kept.join(' ');
}

function tierKeys(rawName) {
    const t0 = normalize(rawName);
    if (!t0) return {t0: '', t1: '', t2: '', t3: ''};
    return {
        t0,
        t1: stripTokens(t0, {quality: true}),
        t2: stripTokens(t0, {timezone: true}),
        t3: stripTokens(t0, {quality: true, timezone: true}),
    };
}

function bigrams(s) {
    if (!s || s.length < 2) return new Set(s ? [s] : []);
    const out = new Set();
    for (let i = 0; i < s.length - 1; i++) {
        out.add(s.substring(i, i + 2));
    }
    return out;
}

function bigramSimilarity(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;
    const A = bigrams(a);
    const B = bigrams(b);
    if (A.size === 0 || B.size === 0) return 0;
    let inter = 0;
    for (const g of A) if (B.has(g)) inter += 1;
    return (2 * inter) / (A.size + B.size);
}

module.exports = {
    normalize,
    tierKeys,
    bigramSimilarity,
    QUALITY_TOKENS,
    TIMEZONE_TOKENS,
};