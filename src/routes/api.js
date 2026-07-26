const express = require('express');
const axios = require('axios');
const {requireAuth} = require('../services/auth');
const settings = require('../services/settings');

const router = express.Router();
router.use(requireAuth);

router.get('/api/engine/status', async (req, res) => {
    try {
        const s = settings.effective();
        const parsed = new URL(s.engineSearchUrl);
        const engineBase = `${parsed.protocol}//${parsed.host}`;

        const [versionRes, statusRes] = await Promise.all([
            axios.get(`${engineBase}/webui/api/service?method=get_version&format=json`, {timeout: 5000}),
            axios.get(`${engineBase}/webui/api/service?method=get_status&format=json`, {timeout: 5000}),
        ]);

        const versionData = versionRes.data && versionRes.data.result ? versionRes.data.result : versionRes.data || {};
        const statusData = statusRes.data && statusRes.data.result ? statusRes.data.result : statusRes.data || {};

        return res.json({
            ok: true,
            version: versionData.version || versionData.Version || '',
            platform: versionData.platform || versionData.Platform || '',
            status: statusData.status || statusData.Status || '',
        });
    } catch (err) {
        return res.json({ok: false, error: err.message});
    }
});

module.exports = router;