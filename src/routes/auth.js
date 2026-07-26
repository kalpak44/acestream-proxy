const express = require('express');
const logger = require('../logger');
const {verifyCredentials, throttle, recordFail, resetFails, SESSION_COOKIE_NAME} = require('../services/auth');
const {renderLogin} = require('../views');

const router = express.Router();

router.get('/login', (req, res) => {
    if (req.session && req.session.user) return res.redirect('/');
    res.type('html').send(renderLogin());
});

router.post('/login', (req, res) => {
    const ip = req.ip || 'unknown';
    const gate = throttle(ip);
    if (!gate.allowed) {
        return res.status(429).type('html').send(renderLogin({
            error: `Too many attempts. Try again in ${gate.retryInSec}s.`,
        }));
    }

    const {username, password} = req.body || {};
    if (!verifyCredentials(username, password)) {
        recordFail(ip);
        logger.warn(`Failed login attempt from ${ip}.`);
        return res.status(401).type('html').send(renderLogin({error: 'Invalid credentials.'}));
    }

    resetFails(ip);
    req.session.regenerate((regenErr) => {
        if (regenErr) {
            logger.error(`Session regenerate failed: ${regenErr.message}`);
            return res.status(500).type('html').send(renderLogin({error: 'Login failed. Try again.'}));
        }
        req.session.user = username;
        req.session.save((saveErr) => {
            if (saveErr) {
                logger.error(`Session save failed: ${saveErr.message}`);
                return res.status(500).type('html').send(renderLogin({error: 'Login failed. Try again.'}));
            }
            logger.info(`Login success for "${username}" from ${ip}.`);
            res.redirect('/');
        });
    });
});

router.post('/logout', (req, res) => {
    const user = req.session && req.session.user;
    req.session.destroy(() => {
        res.clearCookie(SESSION_COOKIE_NAME);
        if (user) logger.info(`Logout for "${user}".`);
        res.redirect('/login');
    });
});

module.exports = router;