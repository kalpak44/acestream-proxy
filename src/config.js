// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const SEARCH_URL = process.env.ACESTREAM_SEARCH_URL || 'http://localhost:6878/search';
const STREAM_BASE_URL = process.env.ACESTREAM_STREAM_BASE || 'http:/localhost:6878/ace/manifest.m3u8';
const PAGE_SIZE = parseInt(process.env.ACESTREAM_PAGE_SIZE || '10', 10);
const PLAYLIST_FILE = process.env.PLAYLIST_FILE || 'playlist.m3u8';
const CACHE_TTL = parseInt(process.env.PLAYLIST_TTL || '3600', 10); // seconds
const PORT = process.env.PORT || 8000;
const COUNTRY_MAP = [
    {
        code: 'bg',
        name: 'Болгария',
        external: ['https://iptv-org.github.io/iptv/languages/bul.m3u']
    },
    {code: 'ca', name: 'Канада'},
    {
        code: 'cz',
        name: 'Чехия',
        external: ['https://iptv-org.github.io/iptv/languages/ces.m3u']
    },
    {code: 'ee', name: 'Эстония'},
    {
        code: 'fr',
        name: 'Франция',
        external: ['https://iptv-org.github.io/iptv/countries/fr.m3u']
    },
    {
        code: 'gb',
        name: 'Великобритания',
        external: ['https://iptv-org.github.io/iptv/languages/eng.m3u']
    },
    {code: 'kz', name: 'Казахстан'},
    {code: 'lt', name: 'Литва'},
    {code: 'lv', name: 'Латвия'},
    {
        code: 'md',
        name: 'Молдова',
        external: ['https://iptv-org.github.io/iptv/countries/md.m3u']
    },
    {code: 'mk', name: 'Северная Македония'},
    {
        code: 'pl',
        name: 'Польша',
        external: ['https://iptv-org.github.io/iptv/languages/pol.m3u']
    },
    {code: 'ro', name: 'Румыния'},
    {code: 'ru', name: 'Россия'},
    {
        code: 'ua',
        name: 'Украина',
        external: ['https://iptv-org.github.io/iptv/countries/ua.m3u']
    },
    {code: 'us', name: 'США'},
];

const CATEGORY_REMAP = [
    {
        sources: ['music', 'music_video', 'radijas'],
        name: 'Музыка',
        external: ['https://iptv-org.github.io/iptv/categories/music.m3u']
    },
    {
        sources: ['educational', 'documentaries'],
        name: 'Познавательные',
        external: ['https://iptv-org.github.io/iptv/categories/documentary.m3u', 'https://iptv-org.github.io/iptv/categories/education.m3u']
    },
    {sources: ['entertaining'], name: 'Развлекательные', external: []},
    {sources: ['kids'], name: 'Детские', external: ['https://iptv-org.github.io/iptv/categories/kids.m3u']},
    {sources: ['movies'], name: 'Кино', external: []},
    {
        sources: ['other', 'amateur', 'emilia', 'informational', 'fashion', 'kameros', 'regional', 'teleshop', 'tv', 'vari', 'emilia romagna', 'religion', 'regional'],
        name: 'Прочее',
        external: []
    },
    {sources: ['sport'], name: 'Спорт', external: ['https://iptv-org.github.io/iptv/categories/sports.m3u']},
];

const INFOHASH_CATEGORY_OVERRIDE = {
    'Спорт': ['0bb7252a2a8dd3704b3a6c0538478450b8987012', 'e84c8f3896a843b7fb272a6e3a18bba6b198db04', 'fc5e35ba19a015dc14fa4060fb922f7cbc026f96', 'a9fc65ae6e7b537f106c07471b7a66b2cbc87069', '9510f65da1d8a4a2b7c972fdc2f1b19e2d468f2f'],
    'Познавательные': ['3a43c9534e29fe4bced0b6b52d84208e8731a1c6', '6477d56108d979adf1a069b26c820e749b94b9da', 'd6129ac39701d36993b3a8abdc0b6d7c02d6ff95', 'cfa9d82af3e0853f5d461fbb964aa4bddce7419b', 'c5ff05b3d5780ba3fe53dbf69f82e804c84dcd1a', '97173d5c881764f696276b011feae5d9c8fc4491', 'dc7c65c3001424a5cb25977689bc0dc54148c17e', '3fe87de722805888221849955ac29970e4a4d8f8', 'dc7c65c3001424a5cb25977689bc0dc54148c17e', '79262f7e44a66fbc6f657488be32cc711fcad137', '568159b1059c7bbe3eaf40f123541fef86ef83cb', '3c2590e3d167e159115d4a63b25d371f6eeae7c0'],
    'Развлекательные': ['a95ec5a3780c3a3c76da5707b12561daee4f2305', '00ed244a3f5e36067b57b6a62b18cfa5d9dd0e22', 'fab9f7a13476148dc75d77ba29bf38ccf966ac81', '91b603d193b26020ec28d43ae065f517d903f9f7', 'a95ec5a3780c3a3c76da5707b12561daee4f2305', 'fab9f7a13476148dc75d77ba29bf38ccf966ac81'],
    'Детские': ['d78c7a1da99696e3987563926a1cd31bff9c56bf',],
    'Музыка': ['7f9ae2b48d0872ae47d04890227d33fb225658d1'],
    'Кино': ['51aba262210dcea336693bfb47e39622615772ee'],
    'Прочее': ['f004490028139751fc32cd19426459e06b3903fa'],
};

const INFOHASH_COUNTRY_OVERRIDE = {
    // 'Россия': ['infohash3', 'infohash4']
};

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
};
