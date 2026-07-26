const crypto = require('node:crypto');
const session = require('express-session');
const config = require('../config');

const FAILED_LOGIN_LIMIT = 5;
const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;
const SESSION_COOKIE_NAME = 'sid';

const failedByIp = new Map();

function sessionMiddleware() {
    return session({
        name: SESSION_COOKIE_NAME,
        secret: config.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        rolling: true,
        cookie: {
            httpOnly: true,
            sameSite: 'strict',
            secure: config.SESSION_COOKIE_SECURE,
            maxAge: SESSION_MAX_AGE_MS,
        },
    });
}

function safeEqual(a, b) {
    const ha = crypto.createHash('sha256').update(String(a)).digest();
    const hb = crypto.createHash('sha256').update(String(b)).digest();
    return crypto.timingSafeEqual(ha, hb);
}

function verifyCredentials(username, password) {
    if (typeof username !== 'string' || typeof password !== 'string') return false;
    const userOk = safeEqual(username, config.AUTH_USERNAME);
    const passOk = safeEqual(password, config.AUTH_PASSWORD);
    return userOk && passOk;
}

function throttle(ip) {
    const now = Date.now();
    const entry = failedByIp.get(ip);
    if (!entry) return {allowed: true};
    if (now - entry.firstFailAt > FAILED_LOGIN_WINDOW_MS) {
        failedByIp.delete(ip);
        return {allowed: true};
    }
    if (entry.count >= FAILED_LOGIN_LIMIT) {
        const retryInSec = Math.ceil((FAILED_LOGIN_WINDOW_MS - (now - entry.firstFailAt)) / 1000);
        return {allowed: false, retryInSec};
    }
    return {allowed: true};
}

function recordFail(ip) {
    const now = Date.now();
    const entry = failedByIp.get(ip);
    if (!entry || now - entry.firstFailAt > FAILED_LOGIN_WINDOW_MS) {
        failedByIp.set(ip, {count: 1, firstFailAt: now});
        return;
    }
    entry.count += 1;
}

function resetFails(ip) {
    failedByIp.delete(ip);
}

function requireAuth(req, res, next) {
    if (req.session && req.session.user) return next();
    return res.redirect('/login');
}

module.exports = {
    sessionMiddleware,
    verifyCredentials,
    throttle,
    recordFail,
    resetFails,
    requireAuth,
    SESSION_COOKIE_NAME,
};