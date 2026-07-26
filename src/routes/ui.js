const express = require('express');
const {requireAuth} = require('../services/auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => res.redirect('/playlists'));

module.exports = router;