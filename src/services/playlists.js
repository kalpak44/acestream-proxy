const crypto = require('node:crypto');
const fs = require('fs-extra');
const path = require('node:path');
const config = require('../config');

const ID_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
const ID_LENGTH = 12;
const ID_PATTERN = /^[a-z0-9]{4,64}$/;
const CHILD_ID_LENGTH = 8;
const INFOHASH_PATTERN = /^[0-9a-f]{40}$/i;
const MAX_GEN_ATTEMPTS = 8;

let writeLock = Promise.resolve();

function fileName() {
    return path.join(config.DATA_DIR, 'playlists.json');
}

const VALID_STREAM_KINDS = new Set(['ts', 'hls']);

function withDefaults(p) {
    return {
        id: p.id,
        name: p.name || `Playlist ${(p.id || '').slice(0, 6)}`,
        createdAt: p.createdAt || new Date().toISOString(),
        streamKind: VALID_STREAM_KINDS.has(p.streamKind) ? p.streamKind : 'ts',
        categories: Array.isArray(p.categories) ? p.categories.map((c) => ({id: c.id, name: c.name || ''})) : [],
        channels: Array.isArray(p.channels) ? p.channels.map((c) => ({
            id: c.id,
            name: c.name || '',
            infohash: (c.infohash || '').toLowerCase(),
            icon: c.icon || '',
            categoryId: c.categoryId || '',
            addedAt: c.addedAt || new Date().toISOString(),
        })) : [],
    };
}

async function readAll() {
    try {
        const data = await fs.readJson(fileName());
        return {playlists: (data.playlists || []).map(withDefaults)};
    } catch (err) {
        if (err.code === 'ENOENT') return {playlists: []};
        throw err;
    }
}

async function writeAll(data) {
    await fs.ensureDir(config.DATA_DIR);
    const tmp = fileName() + '.tmp';
    await fs.writeJson(tmp, data, {spaces: 2});
    await fs.move(tmp, fileName(), {overwrite: true});
}

function withLock(fn) {
    const next = writeLock.then(fn, fn);
    writeLock = next.catch(() => {});
    return next;
}

function generateId(length = ID_LENGTH) {
    const bytes = crypto.randomBytes(length);
    let s = '';
    for (let i = 0; i < length; i++) {
        s += ID_ALPHABET[bytes[i] % ID_ALPHABET.length];
    }
    return s;
}

function isValidId(id) {
    return typeof id === 'string' && ID_PATTERN.test(id);
}

function isValidInfohash(v) {
    return typeof v === 'string' && INFOHASH_PATTERN.test(v);
}

function fail(code, message) {
    const err = new Error(message);
    err.code = code;
    return err;
}

async function list() {
    const {playlists} = await readAll();
    return playlists;
}

async function get(id) {
    const {playlists} = await readAll();
    return playlists.find((p) => p.id === id) || null;
}

async function create({name} = {}) {
    return withLock(async () => {
        const data = await readAll();
        const existing = new Set(data.playlists.map((p) => p.id));
        let id;
        for (let i = 0; i < MAX_GEN_ATTEMPTS; i++) {
            const candidate = generateId();
            if (!existing.has(candidate)) { id = candidate; break; }
        }
        if (!id) throw fail('GEN_FAILED', 'Failed to generate a unique playlist ID.');
        const trimmed = (name || '').trim();
        const playlist = withDefaults({
            id,
            name: trimmed || `Playlist ${id.slice(0, 6)}`,
            createdAt: new Date().toISOString(),
        });
        data.playlists.push(playlist);
        await writeAll(data);
        return playlist;
    });
}

async function update(oldId, {id: newId, name} = {}) {
    return withLock(async () => {
        const data = await readAll();
        const idx = data.playlists.findIndex((p) => p.id === oldId);
        if (idx === -1) throw fail('NOT_FOUND', 'Playlist not found.');

        if (newId !== undefined && newId !== oldId) {
            if (!isValidId(newId)) throw fail('BAD_ID', 'ID must be 4–64 chars of a–z or 0–9.');
            if (data.playlists.some((p) => p.id === newId)) throw fail('DUP_ID', 'That ID is already in use.');
            data.playlists[idx].id = newId;
        }
        if (name !== undefined) {
            const trimmed = name.trim();
            data.playlists[idx].name = trimmed || `Playlist ${data.playlists[idx].id.slice(0, 6)}`;
        }
        await writeAll(data);
        return data.playlists[idx];
    });
}

async function remove(id) {
    return withLock(async () => {
        const data = await readAll();
        const before = data.playlists.length;
        data.playlists = data.playlists.filter((p) => p.id !== id);
        if (data.playlists.length === before) return false;
        await writeAll(data);
        return true;
    });
}

async function setStreamKind(id, {streamKind}) {
    return withLock(async () => {
        const data = await readAll();
        const p = data.playlists.find((x) => x.id === id);
        if (!p) throw fail('NOT_FOUND', 'Playlist not found.');
        if (!VALID_STREAM_KINDS.has(streamKind)) throw fail('BAD_STREAM_KIND', 'Stream kind must be "ts" or "hls".');
        p.streamKind = streamKind;
        await writeAll(data);
        return p;
    });
}

async function addCategory(id, {name}) {
    return withLock(async () => {
        const data = await readAll();
        const p = data.playlists.find((x) => x.id === id);
        if (!p) throw fail('NOT_FOUND', 'Playlist not found.');
        const trimmed = (name || '').trim();
        if (!trimmed) throw fail('BAD_NAME', 'Category name is required.');
        if (p.categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
            throw fail('DUP_NAME', 'A category with that name already exists.');
        }
        const existing = new Set(p.categories.map((c) => c.id));
        let cid;
        for (let i = 0; i < MAX_GEN_ATTEMPTS; i++) {
            const cand = generateId(CHILD_ID_LENGTH);
            if (!existing.has(cand)) { cid = cand; break; }
        }
        if (!cid) throw fail('GEN_FAILED', 'Failed to generate a unique category ID.');
        const category = {id: cid, name: trimmed};
        p.categories.push(category);
        await writeAll(data);
        return category;
    });
}

async function renameCategory(id, categoryId, {name}) {
    return withLock(async () => {
        const data = await readAll();
        const p = data.playlists.find((x) => x.id === id);
        if (!p) throw fail('NOT_FOUND', 'Playlist not found.');
        const cat = p.categories.find((c) => c.id === categoryId);
        if (!cat) throw fail('NOT_FOUND', 'Category not found.');
        const trimmed = (name || '').trim();
        if (!trimmed) throw fail('BAD_NAME', 'Category name is required.');
        if (p.categories.some((c) => c.id !== categoryId && c.name.toLowerCase() === trimmed.toLowerCase())) {
            throw fail('DUP_NAME', 'A category with that name already exists.');
        }
        cat.name = trimmed;
        await writeAll(data);
        return cat;
    });
}

async function removeCategory(id, categoryId) {
    return withLock(async () => {
        const data = await readAll();
        const p = data.playlists.find((x) => x.id === id);
        if (!p) throw fail('NOT_FOUND', 'Playlist not found.');
        const before = p.categories.length;
        p.categories = p.categories.filter((c) => c.id !== categoryId);
        if (p.categories.length === before) return false;
        p.channels = p.channels.filter((c) => c.categoryId !== categoryId);
        await writeAll(data);
        return true;
    });
}

async function addChannel(id, {name, infohash, icon, categoryId}) {
    return withLock(async () => {
        const data = await readAll();
        const p = data.playlists.find((x) => x.id === id);
        if (!p) throw fail('NOT_FOUND', 'Playlist not found.');
        const normalizedInfohash = (infohash || '').toLowerCase();
        if (!isValidInfohash(normalizedInfohash)) throw fail('BAD_INFOHASH', 'Infohash must be a 40-char hex string.');
        const trimmedName = (name || '').trim();
        if (!trimmedName) throw fail('BAD_NAME', 'Channel name is required.');
        if (!p.categories.some((c) => c.id === categoryId)) throw fail('BAD_CATEGORY', 'Unknown category.');
        if (p.channels.some((c) => c.infohash === normalizedInfohash && c.categoryId === categoryId)) {
            throw fail('DUP_CHANNEL', 'This infohash is already in that category.');
        }
        const existing = new Set(p.channels.map((c) => c.id));
        let chId;
        for (let i = 0; i < MAX_GEN_ATTEMPTS; i++) {
            const cand = generateId(CHILD_ID_LENGTH);
            if (!existing.has(cand)) { chId = cand; break; }
        }
        if (!chId) throw fail('GEN_FAILED', 'Failed to generate a unique channel ID.');
        const channel = {
            id: chId,
            name: trimmedName,
            infohash: normalizedInfohash,
            icon: (icon || '').trim(),
            categoryId,
            addedAt: new Date().toISOString(),
        };
        p.channels.push(channel);
        await writeAll(data);
        return channel;
    });
}

async function addChannels(id, {channels, categoryId}) {
    return withLock(async () => {
        const data = await readAll();
        const p = data.playlists.find((x) => x.id === id);
        if (!p) throw fail('NOT_FOUND', 'Playlist not found.');
        if (!p.categories.some((c) => c.id === categoryId)) throw fail('BAD_CATEGORY', 'Unknown category.');
        if (!Array.isArray(channels) || channels.length === 0) throw fail('NO_CHANNELS', 'Select at least one channel.');

        const selected = [];
        const selectedInfohashes = new Set();
        for (const item of channels) {
            const infohash = String(item && item.infohash || '').toLowerCase();
            const name = String(item && item.name || '').trim();
            const icon = String(item && item.icon || '').trim();
            if (!isValidInfohash(infohash)) throw fail('BAD_INFOHASH', 'Infohash must be a 40-char hex string.');
            if (!name) throw fail('BAD_NAME', 'Channel name is required.');
            // A Set makes repeated selections harmless and preserves the first name.
            if (selectedInfohashes.has(infohash)) continue;
            selectedInfohashes.add(infohash);
            selected.push({infohash, name, icon});
        }

        const existing = new Set(
            p.channels.filter((c) => c.categoryId === categoryId).map((c) => c.infohash)
        );
        const existingIds = new Set(p.channels.map((c) => c.id));
        let added = 0;
        let skipped = 0;
        for (const {infohash, name, icon} of selected) {
            if (existing.has(infohash)) {
                skipped += 1;
                continue;
            }
            let chId;
            for (let i = 0; i < MAX_GEN_ATTEMPTS; i++) {
                const candidate = generateId(CHILD_ID_LENGTH);
                if (!existingIds.has(candidate)) {
                    chId = candidate;
                    break;
                }
            }
            if (!chId) throw fail('GEN_FAILED', 'Failed to generate a unique channel ID.');
            p.channels.push({
                id: chId,
                name,
                infohash,
                icon,
                categoryId,
                addedAt: new Date().toISOString(),
            });
            existingIds.add(chId);
            existing.add(infohash);
            added += 1;
        }
        await writeAll(data);
        return {added, skipped};
    });
}

async function renameChannel(id, channelId, {name}) {
    return withLock(async () => {
        const data = await readAll();
        const p = data.playlists.find((x) => x.id === id);
        if (!p) throw fail('NOT_FOUND', 'Playlist not found.');
        const ch = p.channels.find((c) => c.id === channelId);
        if (!ch) throw fail('NOT_FOUND', 'Channel not found.');
        const trimmed = (name || '').trim();
        if (!trimmed) throw fail('BAD_NAME', 'Channel name is required.');
        ch.name = trimmed;
        await writeAll(data);
        return ch;
    });
}

async function removeChannel(id, channelId) {
    return withLock(async () => {
        const data = await readAll();
        const p = data.playlists.find((x) => x.id === id);
        if (!p) throw fail('NOT_FOUND', 'Playlist not found.');
        const before = p.channels.length;
        p.channels = p.channels.filter((c) => c.id !== channelId);
        if (p.channels.length === before) return false;
        await writeAll(data);
        return true;
    });
}

module.exports = {
    list,
    get,
    create,
    update,
    remove,
    setStreamKind,
    addCategory,
    renameCategory,
    removeCategory,
    addChannel,
    addChannels,
    renameChannel,
    removeChannel,
    isValidId,
    isValidInfohash,
    ID_PATTERN,
    INFOHASH_PATTERN,
};
