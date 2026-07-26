const express = require('express');
const {TRUST_PROXY} = require('./config');
const {sessionMiddleware} = require('./services/auth');
const authRoutes = require('./routes/auth');
const uiRoutes = require('./routes/ui');
const publicPlaylistRoutes = require('./routes/publicPlaylist');
const playlistsRoutes = require('./routes/playlists');
const searchRoutes = require('./routes/search');
const settingsRoutes = require('./routes/settings');

const app = express();
if (TRUST_PROXY) app.set('trust proxy', 1);

// A page of bulk channel selections includes channel names and infohashes.
app.use(express.urlencoded({extended: false, limit: '32kb'}));
app.use(sessionMiddleware());

app.use('/', publicPlaylistRoutes);
app.use('/', authRoutes);
app.use('/', uiRoutes);
app.use('/', playlistsRoutes);
app.use('/', searchRoutes);
app.use('/', settingsRoutes);

module.exports = app;
