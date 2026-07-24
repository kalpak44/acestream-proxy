const SEARCH_URL = process.env.ACESTREAM_SEARCH_URL || 'http://localhost:6878/search';
const STREAM_BASE_URL = process.env.ACESTREAM_STREAM_BASE || 'http://localhost:6878/ace/manifest.m3u8';
const PAGE_SIZE = Number.parseInt(process.env.ACESTREAM_PAGE_SIZE || '50', 10);
const PLAYLIST_FILE = process.env.PLAYLIST_FILE || 'playlist.m3u8';
const PORT = process.env.PORT || 8000;

const SOURCE_PLAYLIST_URL = process.env.SOURCE_PLAYLIST_URL;
const EPG_URL = process.env.EPG_URL || 'https://iptv.online/epg/epg.xml.gz';
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 3 * * *';

module.exports = {
    SEARCH_URL,
    STREAM_BASE_URL,
    PAGE_SIZE,
    PLAYLIST_FILE,
    PORT,
    SOURCE_PLAYLIST_URL,
    EPG_URL,
    CRON_SCHEDULE,
};