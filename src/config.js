// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const SEARCH_URL = process.env.ACESTREAM_SEARCH_URL || 'http://localhost:6878/search';
const STREAM_BASE_URL = process.env.ACESTREAM_STREAM_BASE || 'http:/localhost:6878/ace/manifest.m3u8';
const PAGE_SIZE = parseInt(process.env.ACESTREAM_PAGE_SIZE || '10', 10);
const PLAYLIST_FILE = process.env.PLAYLIST_FILE || 'playlist.m3u8';
const CACHE_TTL = parseInt(process.env.PLAYLIST_TTL || '3600', 10); // seconds
const PORT = process.env.PORT || 8000;
const COUNTRY_MAP = [{
    code: 'bg', name: 'Болгария', external: ['https://iptv-org.github.io/iptv/languages/bul.m3u']
}, {
    code: 'cz', name: 'Чехия', external: ['https://iptv-org.github.io/iptv/languages/ces.m3u']
}, {
    code: 'fr', name: 'Франция', external: ['https://iptv-org.github.io/iptv/countries/fr.m3u']
}, {
    code: 'gb', name: 'Великобритания', external: ['https://iptv-org.github.io/iptv/languages/eng.m3u']
}, {
    code: 'md', name: 'Молдова', external: ['https://iptv-org.github.io/iptv/countries/md.m3u']
}, {
    code: 'pl', name: 'Польша', external: ['https://iptv-org.github.io/iptv/languages/pol.m3u']
}, {code: 'ro', name: 'Румыния'}, {code: 'ru', name: 'Россия'}, {
    code: 'ua', name: 'Украина', external: ['https://iptv-org.github.io/iptv/countries/ua.m3u']
}, {code: 'us', name: 'США'},];

const CATEGORY_REMAP = [{
    sources: ['music', 'music_video', 'radijas'], name: 'Музыка', external: []
}, {
    sources: ['educational', 'documentaries'], name: 'Познавательные', external: []
}, {sources: ['entertaining'], name: 'Развлекательные', external: []}, {
    sources: ['kids'],
    name: 'Детские',
    external: []
}, {sources: ['movies'], name: 'Кино', external: []}, {
    sources: ['other', 'amateur', 'emilia', 'informational', 'fashion', 'kameros', 'regional', 'teleshop', 'tv', 'vari', 'emilia romagna', 'religion', 'regional'],
    name: 'Прочее',
    external: []
}, {sources: ['sport'], name: 'Спорт', external: []},];

const INFOHASH_CATEGORY_OVERRIDE = {
    'Спорт': ['0bb7252a2a8dd3704b3a6c0538478450b8987012', 'e84c8f3896a843b7fb272a6e3a18bba6b198db04', 'fc5e35ba19a015dc14fa4060fb922f7cbc026f96', 'a9fc65ae6e7b537f106c07471b7a66b2cbc87069', '9510f65da1d8a4a2b7c972fdc2f1b19e2d468f2f', '7f6ceda82b964c416983ab233787cee4e2333435'],
    'Познавательные': ['3a43c9534e29fe4bced0b6b52d84208e8731a1c6', '6477d56108d979adf1a069b26c820e749b94b9da', 'd6129ac39701d36993b3a8abdc0b6d7c02d6ff95', 'cfa9d82af3e0853f5d461fbb964aa4bddce7419b', 'c5ff05b3d5780ba3fe53dbf69f82e804c84dcd1a', '97173d5c881764f696276b011feae5d9c8fc4491', 'dc7c65c3001424a5cb25977689bc0dc54148c17e', '3fe87de722805888221849955ac29970e4a4d8f8', 'dc7c65c3001424a5cb25977689bc0dc54148c17e', '79262f7e44a66fbc6f657488be32cc711fcad137', '568159b1059c7bbe3eaf40f123541fef86ef83cb', '3c2590e3d167e159115d4a63b25d371f6eeae7c0', 'c3caa2f63d813d808b352ccb0f46bec601e9c493'],
    'Развлекательные': ['a95ec5a3780c3a3c76da5707b12561daee4f2305', '00ed244a3f5e36067b57b6a62b18cfa5d9dd0e22', 'fab9f7a13476148dc75d77ba29bf38ccf966ac81', '91b603d193b26020ec28d43ae065f517d903f9f7', 'a95ec5a3780c3a3c76da5707b12561daee4f2305', 'fab9f7a13476148dc75d77ba29bf38ccf966ac81'],
    'Детские': ['d78c7a1da99696e3987563926a1cd31bff9c56bf',],
    'Музыка': ['7f9ae2b48d0872ae47d04890227d33fb225658d1'],
    'Кино': ['51aba262210dcea336693bfb47e39622615772ee', '76079829f1037018821f7c69164ad88b3cea5d3c'],
    'Прочее': ['f004490028139751fc32cd19426459e06b3903fa'],
};

const INFOHASH_COUNTRY_OVERRIDE = {
    // 'Россия': ['infohash3', 'infohash4']
};

const INFOHASH_BLACKLIST = ['678bb91a0d35978d05a4cc89a16645bc4123d50d', 'd1a09f3eb83748b937244ab6c1d2cbbbc7dcfb03', 'd1a09f3eb83748b937244ab6c1d2cbbbc7dcfb03', '65eb0226b313a99ec8899e107505b4938a813515', 'd44bd2431058be8bed00b1e40bb3d46639584611', '3ece4a317af7567e5e1ac3d4ceede71fc7c2f10e', '7f02927aa9cd8c4f74710204fdf3bed14199d791', 'e885a930393d640c9a18de846a9778aeaeff7410', 'e885a930393d640c9a18de846a9778aeaeff7410', '7d7c678f4371e8b033484d1dbb701af4732c4cd1', 'a4d1f042e5a367bb63d155680e79c8e3b6745ca3', '96fe1281760be8e40a28e120f99def011b0b943f', '94072596f07b4542980f519e45f44c91e74364db', '422167865c4b6fb5749ca05bbd560df36e0b9ab3', '6558e36abfcaedc13b80bb6091acdf9d58b88773', '1498f930c93486cc30594491a95d8814834a5de3', 'e592b60d7abe41ff027fe11178318dbc486c4274', 'bcfda165bf5a32327e647f94a20f750fe643c7cb', 'aa5dde51504c69fcbc480c64117e89dcb203c3c3', 'fce57665cd9ce280a9884d13c70e16e9ad5e638f', '42e74d3cf6ce872fb2c9e7d58c42648240b63867'];

module.exports = {
    SEARCH_URL,
    STREAM_BASE_URL,
    PAGE_SIZE,
    PLAYLIST_FILE,
    CACHE_TTL,
    PORT,
    COUNTRY_MAP,
    CATEGORY_REMAP,
    INFOHASH_CATEGORY_OVERRIDE,
    INFOHASH_COUNTRY_OVERRIDE,
    INFOHASH_BLACKLIST,
};
