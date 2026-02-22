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
    {code: 'by', name: 'Беларусь'},
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
    // 'Музыка': ['infohash1', 'infohash2']
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
