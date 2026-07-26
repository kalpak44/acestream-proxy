const SEARCH_URL = process.env.ACESTREAM_SEARCH_URL || 'http://localhost:6878/search';
const STREAM_BASE_URL = process.env.ACESTREAM_STREAM_BASE || 'http://localhost:6878/ace/manifest.m3u8';
const PAGE_SIZE = Number.parseInt(process.env.ACESTREAM_PAGE_SIZE || '50', 10);
const PORT = process.env.PORT || 8000;
const DATA_DIR = process.env.DATA_DIR || 'data';
// Every generated playlist advertises the matching local XMLTV endpoint by
// default. Set PUBLIC_BASE_URL when players reach this app through a LAN URL,
// hostname, or reverse proxy instead.
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;

const AUTH_USERNAME = process.env.AUTH_USERNAME;
const AUTH_PASSWORD = process.env.AUTH_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET;
const SESSION_COOKIE_SECURE = process.env.SESSION_COOKIE_SECURE === 'true';
const TRUST_PROXY = process.env.TRUST_PROXY === 'true';

function assertAuthConfig() {
    const missing = [];
    if (!AUTH_USERNAME) missing.push('AUTH_USERNAME');
    if (!AUTH_PASSWORD) missing.push('AUTH_PASSWORD');
    if (!SESSION_SECRET) missing.push('SESSION_SECRET');
    if (missing.length > 0) {
        const err = new Error(`Missing required env vars: ${missing.join(', ')}.`);
        err.fatal = true;
        throw err;
    }
}

module.exports = {
    SEARCH_URL,
    STREAM_BASE_URL,
    PAGE_SIZE,
    PORT,
    DATA_DIR,
    PUBLIC_BASE_URL,
    AUTH_USERNAME,
    AUTH_PASSWORD,
    SESSION_SECRET,
    SESSION_COOKIE_SECURE,
    TRUST_PROXY,
    assertAuthConfig,
};
