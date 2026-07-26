const express = require('express');
const logger = require('../logger');
const {requireAuth} = require('../services/auth');
const settings = require('../services/settings');
const playlistsSvc = require('../services/playlists');
const {rebuild} = require('../services/playlistBuilder');
const {renderSettings} = require('../views');

const router = express.Router();
router.use(requireAuth);

router.get('/settings', (req, res) => {
    res.type('html').send(renderSettings({
        user: req.session.user,
        raw: settings.raw(),
        effective: settings.effective(),
        defaults: settings.envDefaults(),
        flash: req.query.flash,
        error: req.query.error,
    }));
});

router.post('/settings', async (req, res) => {
    const {engineSearchUrl, streamBaseTs, streamBaseHls, publicBaseUrl, pageSize} = req.body || {};
    try {
        await settings.update({engineSearchUrl, streamBaseTs, streamBaseHls, publicBaseUrl, pageSize});
        logger.info(`Settings updated by "${req.session.user}".`);
        const all = await playlistsSvc.list();
        let rebuilt = 0;
        for (const p of all) {
            try {
                await rebuild(p.id);
                rebuilt += 1;
            } catch (e) {
                logger.error(`Rebuild after settings change failed for ${p.id}: ${e.message}`);
            }
        }
        logger.info(`Rebuilt ${rebuilt}/${all.length} playlists after settings change.`);
        res.redirect('/settings?flash=saved');
    } catch (err) {
        if (['BAD_URL', 'BAD_PAGE_SIZE'].includes(err.code)) {
            return res.redirect('/settings?error=' + encodeURIComponent(err.message));
        }
        logger.error(`Settings update failed: ${err.message}`);
        res.redirect('/settings?error=' + encodeURIComponent('Failed to save settings.'));
    }
});

module.exports = router;