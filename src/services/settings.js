const fs = require('fs-extra');
const path = require('node:path');
const config = require('../config');

let cache = null;
let writeLock = Promise.resolve();

function fileName() {
    return path.join(config.DATA_DIR, 'settings.json');
}

function withLock(fn) {
    const next = writeLock.then(fn, fn);
    writeLock = next.catch(() => {});
    return next;
}

function fail(code, message) {
    const err = new Error(message);
    err.code = code;
    return err;
}

async function load() {
    try {
        cache = await fs.readJson(fileName());
    } catch (err) {
        if (err.code !== 'ENOENT') throw err;
        cache = {};
    }
}

function effective() {
    const c = cache || {};
    return {
        engineSearchUrl: (c.engineSearchUrl || '').trim() || config.SEARCH_URL,
        streamBaseTs: (c.streamBaseTs || '').trim() || config.STREAM_BASE_URL,
        streamBaseHls: (c.streamBaseHls || '').trim() || '',
        publicBaseUrl: ((c.publicBaseUrl || '').trim() || config.PUBLIC_BASE_URL || '').replace(/\/+$/, ''),
        pageSize: Number.isInteger(c.pageSize) ? c.pageSize : config.PAGE_SIZE,
    };
}

function raw() {
    const c = cache || {};
    return {
        engineSearchUrl: c.engineSearchUrl || '',
        streamBaseTs: c.streamBaseTs || '',
        streamBaseHls: c.streamBaseHls || '',
        publicBaseUrl: c.publicBaseUrl || '',
        pageSize: Number.isInteger(c.pageSize) ? c.pageSize : '',
    };
}

function envDefaults() {
    return {
        engineSearchUrl: config.SEARCH_URL,
        streamBaseTs: config.STREAM_BASE_URL,
        streamBaseHls: '',
        publicBaseUrl: config.PUBLIC_BASE_URL || '',
        pageSize: config.PAGE_SIZE,
    };
}

function validateUrl(u) {
    if (!u) return true;
    try {
        const p = new URL(u);
        return p.protocol === 'http:' || p.protocol === 'https:';
    } catch (_) { return false; }
}

async function update(patch = {}) {
    return withLock(async () => {
        const next = {...(cache || {})};
        for (const k of ['engineSearchUrl', 'streamBaseTs', 'streamBaseHls', 'publicBaseUrl']) {
            if (patch[k] !== undefined) {
                const v = String(patch[k] || '').trim();
                if (v && !validateUrl(v)) throw fail('BAD_URL', `Invalid URL for ${k}.`);
                next[k] = v;
            }
        }
        if (patch.pageSize !== undefined) {
            const asInt = Number.parseInt(patch.pageSize, 10);
            if (patch.pageSize === '' || patch.pageSize === null) {
                delete next.pageSize;
            } else if (!Number.isInteger(asInt) || asInt < 1 || asInt > 200) {
                throw fail('BAD_PAGE_SIZE', 'Page size must be an integer 1–200.');
            } else {
                next.pageSize = asInt;
            }
        }
        await fs.ensureDir(config.DATA_DIR);
        const tmp = fileName() + '.tmp';
        await fs.writeJson(tmp, next, {spaces: 2});
        await fs.move(tmp, fileName(), {overwrite: true});
        cache = next;
        return effective();
    });
}

module.exports = {load, effective, raw, envDefaults, update};