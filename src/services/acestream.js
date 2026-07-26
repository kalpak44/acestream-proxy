const axios = require('axios');
const settings = require('./settings');

const SEARCH_CATEGORIES = [
    {key: 'informational', label: 'Informational'},
    {key: 'entertaining', label: 'Entertaining'},
    {key: 'educational', label: 'Educational'},
    {key: 'movies', label: 'Movies'},
    {key: 'documentaries', label: 'Documentaries'},
    {key: 'sport', label: 'Sport'},
    {key: 'fashion', label: 'Fashion'},
    {key: 'music', label: 'Music'},
    {key: 'regional', label: 'Regional'},
    {key: 'ethnic', label: 'Ethnic'},
    {key: 'religion', label: 'Religion'},
    {key: 'teleshop', label: 'Teleshop'},
    {key: 'erotic_18_plus', label: 'Erotic (18+)'},
    {key: 'other_18_plus', label: 'Other (18+)'},
    {key: 'cyber_games', label: 'Cyber Games'},
    {key: 'amateur', label: 'Amateur'},
    {key: 'webcam', label: 'Webcam'},
];

const STREAM_KINDS = new Set(['ts', 'hls']);

function normalizeKind(kind) {
    return STREAM_KINDS.has(kind) ? kind : 'ts';
}

function baseForKind(kind) {
    const s = settings.effective();
    const k = normalizeKind(kind);
    if (k === 'hls') return s.streamBaseHls || s.streamBaseTs;
    return s.streamBaseTs;
}

function buildStreamUrl(infohash, {kind = 'ts'} = {}) {
    const base = baseForKind(kind);
    if (!base) return '';
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}infohash=${infohash}`;
}

async function searchChannels({query = '', category = '', page = 0, pageSize} = {}) {
    const s = settings.effective();
    const ps = Number.isInteger(pageSize) ? pageSize : s.pageSize;
    const params = {page, page_size: ps};
    if (query) params.query = query;
    if (category) params.category = category;
    const response = await axios.get(s.engineSearchUrl, {params, timeout: 15000});
    const result = (response.data && response.data.result) || {};
    return {
        total: Number.isFinite(result.total) ? result.total : (result.results || []).length,
        time: Number(result.time) || 0,
        results: result.results || [],
    };
}

module.exports = {
    searchChannels,
    buildStreamUrl,
    SEARCH_CATEGORIES,
    STREAM_KINDS,
};