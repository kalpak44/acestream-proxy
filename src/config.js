const SEARCH_URL = process.env.ACESTREAM_SEARCH_URL || 'http://localhost:6878/search';
const STREAM_BASE_URL = process.env.ACESTREAM_STREAM_BASE || 'http://localhost:6878/ace/manifest.m3u8';
const PAGE_SIZE = Number.parseInt(process.env.ACESTREAM_PAGE_SIZE || '50', 10);
const PLAYLIST_FILE = process.env.PLAYLIST_FILE || 'playlist.m3u8';
const PORT = process.env.PORT || 8000;

const SOURCE_PLAYLIST_URL = process.env.SOURCE_PLAYLIST_URL;
const EPG_URL = process.env.EPG_URL || 'https://iptv.online/epg/epg.xml.gz';
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 3 * * *';

const DEFAULT_INWEBVIEW_SOURCES = [
    {url: 'https://inwebview.com/category/3', group: 'Кино'},
    {url: 'https://inwebview.com/category/5', group: 'Россия'},
    {url: 'https://inwebview.com/category/1', group: 'Детские'},
    {url: 'https://inwebview.com/category/8', group: 'Разное'},
    {url: 'https://inwebview.com/category/4', group: 'Спорт'},
    {url: 'https://inwebview.com/category/6', group: 'Познавательные'},
    {url: 'https://inwebview.com/category/2', group: 'Музыкальные'},
    {url: 'https://inwebview.com/category/16', group: 'Украинские'},
    {url: 'https://inwebview.com/hd', group: 'HD Каналы'},
];
const INWEBVIEW_SOURCES = process.env.INWEBVIEW_SOURCES
    ? JSON.parse(process.env.INWEBVIEW_SOURCES)
    : DEFAULT_INWEBVIEW_SOURCES;

// Country-code tag used to filter search-ace.stream channels, e.g. 'RU' keeps only channels
// whose name contains [RU]. Set to null to disable filtering.
const SEARCH_ACE_LANG = process.env.SEARCH_ACE_LANG !== undefined ? (process.env.SEARCH_ACE_LANG || null) : 'RU';

// Maps AceStream API category slugs to existing playlist group names.
// Only categories present here are fetched from search-ace.stream.
const SEARCH_ACE_CATEGORY_MAP = {
    informational:  'Россия',
    entertaining:   'Разное',
    educational:    'Познавательные',
    movies:         'Кино',
    documentaries:  'Познавательные',
    sport:          'Спорт',
    music:          'Музыкальные',
    regional:       'Россия',
    cyber_games:    'Спорт',
};

module.exports = {
    SEARCH_URL,
    STREAM_BASE_URL,
    PAGE_SIZE,
    PLAYLIST_FILE,
    PORT,
    SOURCE_PLAYLIST_URL,
    EPG_URL,
    CRON_SCHEDULE,
    INWEBVIEW_SOURCES,
    SEARCH_ACE_CATEGORY_MAP,
    SEARCH_ACE_LANG,
};