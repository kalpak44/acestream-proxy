const express = require('express');
const logger = require('../logger');
const {requireAuth} = require('../services/auth');
const {searchChannels, buildStreamUrl, SEARCH_CATEGORIES} = require('../services/acestream');
const settings = require('../services/settings');
const playlistsSvc = require('../services/playlists');
const {rebuild} = require('../services/playlistBuilder');
const {renderSearch} = require('../views');

const router = express.Router();
router.use(requireAuth);

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 25;
const CATEGORY_KEYS = new Set(SEARCH_CATEGORIES.map((c) => c.key));

function parsePage(raw) {
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
}

function parsePageSize(raw) {
    const n = Number.parseInt(raw, 10);
    return PAGE_SIZE_OPTIONS.includes(n) ? n : DEFAULT_PAGE_SIZE;
}

function resolveTarget(rawTarget, playlists) {
    if (typeof rawTarget !== 'string' || !rawTarget.includes(':')) return null;
    const [pid, cid] = rawTarget.split(':');
    const playlist = playlists.find((p) => p.id === pid);
    if (!playlist) return null;
    const category = playlist.categories.find((c) => c.id === cid);
    if (!category) return null;
    return {value: `${pid}:${cid}`, playlistId: pid, categoryId: cid, playlistName: playlist.name, categoryName: category.name};
}

router.get('/search', async (req, res) => {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const category = typeof req.query.category === 'string' && CATEGORY_KEYS.has(req.query.category)
        ? req.query.category
        : '';
    const page = parsePage(req.query.page);
    const pageSize = parsePageSize(req.query.page_size);

    const submitted = ['q', 'category', 'page', 'page_size'].some((k) => k in req.query);

    const allPlaylists = await playlistsSvc.list();
    const target = resolveTarget(req.query.target, allPlaylists);
    const view = {
        user: req.session.user,
        form: {query, category, page, pageSize, target: target ? target.value : ''},
        target,
        categories: SEARCH_CATEGORIES,
        pageSizeOptions: PAGE_SIZE_OPTIONS,
        playlists: allPlaylists,
        flash: req.query.flash,
        error: req.query.error,
    };

    if (!submitted) {
        return res.type('html').send(renderSearch({...view, results: null}));
    }

    try {
        const {total, time, results} = await searchChannels({query, category, page, pageSize});
        const s = settings.effective();
        const flavors = [];
        if (s.streamBaseTs) flavors.push({kind: 'ts', label: 'TS'});
        if (s.streamBaseHls) flavors.push({kind: 'hls', label: 'HLS'});
        const enriched = results.map((r) => ({
            name: r.name || '',
            icons: r.icons || [],
            items: (r.items || []).map((it) => ({
                ...it,
                streams: flavors.map((f) => ({...f, url: buildStreamUrl(it.infohash, {kind: f.kind})})),
            })),
        }));
        return res.type('html').send(renderSearch({
            ...view,
            results: enriched,
            total,
            time,
            hasAnyStreamBase: flavors.length > 0,
        }));
    } catch (err) {
        logger.error(`AceStream search failed: ${err.message}`);
        return res.type('html').send(renderSearch({
            ...view,
            results: null,
            error: `Search failed: ${err.message}`,
        }));
    }
});

router.post('/search/add-channel', async (req, res) => {
    const {target, name, infohash, icon} = req.body || {};
    const [playlistId, categoryId] = String(target || '').split(':');
    const backParams = new URLSearchParams();
    for (const k of ['q', 'category', 'page', 'page_size', 'target']) {
        if (typeof req.body[k] === 'string' && req.body[k] !== '') backParams.set(k, req.body[k]);
    }
    const backQs = backParams.toString();

    function backWith(qsExtra) {
        const merged = new URLSearchParams(backQs);
        for (const [k, v] of Object.entries(qsExtra)) merged.set(k, v);
        return `/search?${merged.toString()}`;
    }

    if (!playlistId || !categoryId) return res.redirect(backWith({error: 'Pick a playlist and category.'}));

    try {
        await playlistsSvc.addChannel(playlistId, {name, infohash, icon, categoryId});
        try { await rebuild(playlistId); } catch (e) { logger.warn(`Rebuild after add-from-search failed: ${e.message}`); }
        logger.info(`Channel "${name}" added to ${playlistId}/${categoryId} from search by "${req.session.user}".`);
        return res.redirect(backWith({flash: `added:${playlistId}`}));
    } catch (err) {
        if (['BAD_NAME', 'BAD_INFOHASH', 'BAD_CATEGORY', 'DUP_CHANNEL', 'NOT_FOUND'].includes(err.code)) {
            return res.redirect(backWith({error: err.message}));
        }
        logger.error(`Add from search failed: ${err.message}`);
        return res.redirect(backWith({error: 'Failed to add channel.'}));
    }
});

router.post('/search/add-channels', async (req, res) => {
    const {target} = req.body || {};
    const [playlistId, categoryId] = String(target || '').split(':');
    const backParams = new URLSearchParams();
    for (const k of ['q', 'category', 'page', 'page_size', 'target']) {
        if (typeof req.body[k] === 'string' && req.body[k] !== '') backParams.set(k, req.body[k]);
    }
    const backQs = backParams.toString();
    const backWith = (extra) => {
        const merged = new URLSearchParams(backQs);
        for (const [k, v] of Object.entries(extra)) merged.set(k, v);
        return `/search?${merged.toString()}`;
    };
    if (!playlistId || !categoryId) return res.redirect(backWith({error: 'Pick a playlist and category.'}));

    const rawChannels = Array.isArray(req.body.channels)
        ? req.body.channels
        : (req.body.channels ? [req.body.channels] : []);
    let channels;
    try {
        channels = rawChannels.map((item) => JSON.parse(item));
    } catch (_) {
        return res.redirect(backWith({error: 'Invalid channel selection.'}));
    }
    try {
        const result = await playlistsSvc.addChannels(playlistId, {channels, categoryId});
        if (result.added > 0) await rebuild(playlistId);
        logger.info(`Added ${result.added} channel(s) to ${playlistId}/${categoryId} from search by "${req.session.user}"; skipped ${result.skipped} duplicates.`);
        return res.redirect(backWith({flash: `bulk-added:${result.added}:${result.skipped}`}));
    } catch (err) {
        if (['BAD_NAME', 'BAD_INFOHASH', 'BAD_CATEGORY', 'NO_CHANNELS', 'NOT_FOUND'].includes(err.code)) {
            return res.redirect(backWith({error: err.message}));
        }
        logger.error(`Bulk add from search failed: ${err.message}`);
        return res.redirect(backWith({error: 'Failed to add selected channels.'}));
    }
});

module.exports = router;
