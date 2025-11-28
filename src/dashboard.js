const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;
const express = require('express');
const compression = require('compression');
const crypto = require('crypto');

const PORT = parseInt(process.env.PORT, 10) || 3000;

const SHARED_DATA_DIR = process.env.SHARED_DATA_DIR
    ? path.resolve(process.env.SHARED_DATA_DIR)
    : path.join(__dirname, '..', 'shared');

function resolveActivityLogPath() {
    if (process.env.ACTIVITY_LOG_PATH) {
        return path.resolve(process.env.ACTIVITY_LOG_PATH);
    }
    try {
        fs.mkdirSync(SHARED_DATA_DIR, { recursive: true });
        return path.join(SHARED_DATA_DIR, 'lila-activity-log.json');
    } catch (error) {
        console.warn('Unable to access shared data directory, falling back to local file:', error.message);
        return path.join(__dirname, '..', 'lila-activity-log.json');
    }
}

const ACTIVITY_LOG_PATH = resolveActivityLogPath();
const DIARY_LOG_PATH = process.env.DIARY_LOG_PATH
    ? path.resolve(process.env.DIARY_LOG_PATH)
    : path.join(__dirname, '..', 'manual-classifications.json');

const PASSWORD = process.env.DASHBOARD_PASSWORD;
const TOKEN_TTL_MINUTES = 12 * 60;

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(compression());

function ensureJsonFile(filePath, initialContent = '[]\n') {
    try {
        const directory = path.dirname(filePath);
        if (!fs.existsSync(directory)) {
            fs.mkdirSync(directory, { recursive: true });
        }
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, initialContent, 'utf8');
            console.log(`Created missing data file at ${filePath}`);
        }
    } catch (error) {
        console.error(`Unable to prepare data file at ${filePath}:`, error.message);
        throw error;
    }
}

function isValidTimeZone(tz) {
    if (!tz || typeof tz !== 'string') {
        return false;
    }
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz });
        return true;
    } catch (error) {
        return false;
    }
}

const SYSTEM_TIMEZONE = (() => {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (error) {
        return null;
    }
})();

const CONFIGURED_TIMEZONE = process.env.ACTIVITY_TIMEZONE;
const DEFAULT_TIMEZONE = isValidTimeZone(CONFIGURED_TIMEZONE)
    ? CONFIGURED_TIMEZONE
    : (isValidTimeZone(SYSTEM_TIMEZONE) ? SYSTEM_TIMEZONE : 'UTC');

const dateKeyFormatters = new Map();

function resolveTimeZone(tz) {
    if (tz && isValidTimeZone(tz)) {
        return tz;
    }
    return DEFAULT_TIMEZONE;
}

function getDateKey(date, requestedTimeZone) {
    const timeZone = resolveTimeZone(requestedTimeZone);
    let formatter = dateKeyFormatters.get(timeZone);
    if (!formatter) {
        formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
        dateKeyFormatters.set(timeZone, formatter);
    }
    return formatter.format(date);
}

function safeDateValue(value) {
    if (!value) {
        return null;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

class ActivityStore {
    constructor(filePath) {
        this.filePath = filePath;
        this.cache = null;
        this.cacheKey = 0;
        this.sessionsCache = null;
        this.calendarCache = new Map();
        this.summaryCache = null;
        this.watchHandle = null;
    }

    async ensureCache() {
        const stats = await fsp.stat(this.filePath).catch(() => null);
        if (!stats) {
            this.cache = [];
            this.cacheKey = Date.now();
            this.sessionsCache = null;
            this.calendarCache.clear();
            this.summaryCache = null;
            return this.cache;
        }

        if (this.cache && stats.mtimeMs === this.cacheKey) {
            return this.cache;
        }

        const raw = await fsp.readFile(this.filePath, 'utf8');
        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch (error) {
            console.error('Failed to parse activity log:', error.message);
            parsed = [];
        }

        const enriched = parsed.map((entry, index) => {
            const playedAt = safeDateValue(entry.loggedAt) || safeDateValue(entry.timestamp) || new Date(0);
            return {
                ...entry,
                __index: index,
                playedAt: playedAt.toISOString(),
                playedAtMs: playedAt.getTime(),
            };
        }).sort((a, b) => a.playedAtMs - b.playedAtMs);

        const sessionThresholdMs = 10 * 60 * 1000;
        let currentSessionId = 0;
        let previousPlayedAtMs = null;
        let currentSessionStart = null;
        let currentSessionStartMs = null;
        enriched.forEach((entry) => {
            if (previousPlayedAtMs === null || entry.playedAtMs - previousPlayedAtMs > sessionThresholdMs) {
                currentSessionId += 1;
                currentSessionStart = entry.playedAt;
                currentSessionStartMs = entry.playedAtMs;
            }
            entry.sessionId = currentSessionId;
            entry.sessionStart = currentSessionStart;
            entry.sessionStartMs = currentSessionStartMs;
            previousPlayedAtMs = entry.playedAtMs;
        });

        this.cache = enriched;
        this.cacheKey = stats.mtimeMs;
        this.sessionsCache = null;
        this.calendarCache.clear();
        this.summaryCache = null;
        return this.cache;
    }

    getSummary(data) {
        if (this.summaryCache) {
            return this.summaryCache;
        }
        const totalSongs = data.length;
        const artists = new Set();
        data.forEach((item) => {
            if (item.artist) {
                artists.add(item.artist.toLowerCase());
            }
        });
        const summary = {
            totalSongs,
            uniqueArtists: artists.size,
            firstEntry: totalSongs ? data[0].playedAt : null,
            latestEntry: totalSongs ? data[totalSongs - 1].playedAt : null,
        };
        this.summaryCache = summary;
        return summary;
    }

    getRecent(data, offset, limit) {
        const start = Math.max(data.length - offset - limit, 0);
        const end = Math.max(data.length - offset, 0);
        const items = data.slice(start, end).reverse();
        return { items, total: data.length };
    }

    search(data, queryTerms, songTitles) {
        if ((!queryTerms || !queryTerms.length) && (!songTitles || !songTitles.length)) {
            return [];
        }
        const terms = (queryTerms || []).map((term) => term.toLowerCase());
        const songTargets = (songTitles || []).map((title) => title.toLowerCase());
        return data.filter((entry) => {
            const songMatch = songTargets.length
                ? songTargets.some((target) => entry.song && entry.song.toLowerCase().includes(target))
                : true;
            if (!songMatch) {
                return false;
            }
            if (!terms.length) {
                return true;
            }
            const haystack = [entry.song, entry.artist, entry.album].filter(Boolean).join(' ').toLowerCase();
            return terms.every((term) => haystack.includes(term));
        }).map((entry) => ({
            song: entry.song,
            artist: entry.artist,
            album: entry.album,
            timestamp: entry.timestamp,
            playedAt: entry.playedAt,
            spotifyUrl: entry.spotifyUrl,
            imageUrl: entry.imageUrl,
            loggedAt: entry.loggedAt,
            __index: entry.__index,
        }));
    }

    async getSessions(data) {
        if (this.sessionsCache) {
            return this.sessionsCache;
        }
        const grouped = new Map();
        data.forEach((entry) => {
            if (!entry.sessionId) {
                return;
            }
            if (!grouped.has(entry.sessionId)) {
                grouped.set(entry.sessionId, []);
            }
            grouped.get(entry.sessionId).push(entry);
        });

        const sessions = Array.from(grouped.entries()).map(([sessionId, entries]) => {
            const sorted = entries.slice().sort((a, b) => a.playedAtMs - b.playedAtMs);
            const first = sorted[0];
            const last = sorted[sorted.length - 1];
            const durationMinutes = first && last
                ? Math.max(1, Math.round((last.playedAtMs - first.playedAtMs) / 60000))
                : 0;
            return {
                sessionId,
                start: first ? first.playedAt : null,
                end: last ? last.playedAt : null,
                durationMinutes,
                trackCount: sorted.length,
                tracks: sorted.map((track) => ({
                    song: track.song,
                    artist: track.artist,
                    album: track.album,
                    playedAt: track.playedAt,
                    playedAtMs: track.playedAtMs,
                    spotifyUrl: track.spotifyUrl,
                    imageUrl: track.imageUrl,
                    loggedAt: track.loggedAt,
                    sessionId: track.sessionId,
                })),
            };
        }).sort((a, b) => {
            if (!a.start || !b.start) {
                return 0;
            }
            return new Date(b.start) - new Date(a.start);
        });

        this.sessionsCache = sessions;
        return sessions;
    }

    async getCalendar(data, months, songFilter, requestedTimeZone) {
        const timeZone = resolveTimeZone(requestedTimeZone);
        const cacheKey = `${timeZone}::${months || 'all'}::${(songFilter || []).join('|').toLowerCase()}`;
        if (this.calendarCache.has(cacheKey)) {
            return this.calendarCache.get(cacheKey);
        }
        const result = new Map();
        const cutoffDate = months ? new Date() : null;
        if (cutoffDate && months) {
            cutoffDate.setUTCMonth(cutoffDate.getUTCMonth() - months);
            cutoffDate.setUTCHours(0, 0, 0, 0);
        }
        const songTargets = (songFilter || []).map((title) => title.toLowerCase());
        data.forEach((entry) => {
            if (songTargets.length && !songTargets.some((target) => entry.song && entry.song.toLowerCase().includes(target))) {
                return;
            }
            const playedAt = new Date(entry.playedAtMs);
            if (!playedAt) {
                return;
            }
            if (cutoffDate && playedAt < cutoffDate) {
                return;
            }
            const key = getDateKey(playedAt, timeZone);
            if (!result.has(key)) {
                result.set(key, { date: key, count: 0, songs: new Map() });
            }
            const dayInfo = result.get(key);
            dayInfo.count += 1;
            if (songFilter && songFilter.length) {
                const songKey = entry.song || 'Unknown';
                const current = dayInfo.songs.get(songKey) || 0;
                dayInfo.songs.set(songKey, current + 1);
            }
        });
        const payload = Array.from(result.values()).map((item) => ({
            date: item.date,
            count: item.count,
            songs: item.songs.size ? Array.from(item.songs.entries()).map(([song, count]) => ({ song, count })) : undefined,
        })).sort((a, b) => a.date.localeCompare(b.date));
        this.calendarCache.set(cacheKey, payload);
        return payload;
    }

    getDayEntries(data, date, songFilter, requestedTimeZone) {
        if (!date) {
            return [];
        }
        const normalized = date.toString().slice(0, 10);
        const songTargets = (songFilter || []).map((title) => title.toLowerCase());
        const timeZone = resolveTimeZone(requestedTimeZone);
        const matches = data.filter((entry) => {
            const entryDate = getDateKey(new Date(entry.playedAtMs), timeZone);
            if (entryDate !== normalized) {
                return false;
            }
            if (!songTargets.length) {
                return true;
            }
            if (!entry.song) {
                return false;
            }
            const lower = entry.song.toLowerCase();
            return songTargets.some((target) => lower.includes(target));
        }).sort((a, b) => b.playedAtMs - a.playedAtMs);

        return matches.map((entry) => ({
            song: entry.song,
            artist: entry.artist,
            album: entry.album,
            playedAt: entry.playedAt,
            loggedAt: entry.loggedAt,
            timestamp: entry.timestamp,
            spotifyUrl: entry.spotifyUrl,
            imageUrl: entry.imageUrl,
            moodType: entry.moodType,
            durationMs: entry.durationMs,
            __index: entry.__index,
            sessionId: entry.sessionId,
            sessionStart: entry.sessionStart,
            playedAtMs: entry.playedAtMs,
        }));
    }
}

ensureJsonFile(ACTIVITY_LOG_PATH);
console.log(`Activity log path: ${ACTIVITY_LOG_PATH}`);
console.log(`Activity data timezone set to ${DEFAULT_TIMEZONE}`);
const activityStore = new ActivityStore(ACTIVITY_LOG_PATH);

function startWatcher(store) {
    if (!fs.existsSync(store.filePath)) {
        return;
    }
    if (store.watchHandle) {
        return;
    }
    try {
        store.watchHandle = fs.watch(store.filePath, { persistent: false }, () => {
            store.cache = null;
            store.sessionsCache = null;
            store.calendarCache.clear();
            store.summaryCache = null;
        });
    } catch (error) {
        console.warn('File watcher not available:', error.message);
    }
}

startWatcher(activityStore);

function requireAuth(req, res, next) {
    if (!PASSWORD) {
        return next();
    }
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = header.slice(7);
    const record = authTokens.get(token);
    if (!record) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    if (record.expiresAt < Date.now()) {
        authTokens.delete(token);
        return res.status(401).json({ error: 'Session expired' });
    }
    record.expiresAt = Date.now() + TOKEN_TTL_MINUTES * 60 * 1000;
    return next();
}

const authTokens = new Map();

app.post('/api/login', async (req, res) => {
    if (!PASSWORD) {
        return res.json({ token: 'dev-no-auth' });
    }
    const { password } = req.body || {};
    if (!password || typeof password !== 'string') {
        return res.status(400).json({ error: 'Password required' });
    }
    if (password !== PASSWORD) {
        return res.status(401).json({ error: 'Invalid password' });
    }
    const token = crypto.randomUUID();
    authTokens.set(token, { expiresAt: Date.now() + TOKEN_TTL_MINUTES * 60 * 1000 });
    return res.json({ token });
});

app.use('/api', requireAuth);

app.get('/api/ping', (req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
});

app.get('/api/activity/summary', async (req, res) => {
    const data = await activityStore.ensureCache();
    const summary = activityStore.getSummary(data);
    res.json(summary);
});

app.get('/api/activity/recent', async (req, res) => {
    const data = await activityStore.ensureCache();
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const { items, total } = activityStore.getRecent(data, offset, limit);
    res.json({ items, total, offset, limit });
});

app.get('/api/activity/sessions', async (req, res) => {
    const data = await activityStore.ensureCache();
    const sessions = await activityStore.getSessions(data);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);
    const sliced = sessions.slice(offset, offset + limit);
    res.json({ items: sliced, total: sessions.length, offset, limit });
});

app.get('/api/activity/calendar', async (req, res) => {
    const data = await activityStore.ensureCache();
    const months = req.query.months ? Math.max(parseInt(req.query.months, 10) || 0, 0) : null;
    const songs = req.query.songs
        ? req.query.songs.split(',').map((item) => item.trim()).filter(Boolean)
        : [];
    const timeZone = resolveTimeZone(req.query.tz);
    const calendar = await activityStore.getCalendar(data, months, songs, timeZone);
    res.json({ items: calendar, songs, timeZone });
});

app.get('/api/activity/day', async (req, res) => {
    const date = (req.query.date || '').toString();
    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) {
        return res.status(400).json({ error: 'Valid date (YYYY-MM-DD) required' });
    }
    const data = await activityStore.ensureCache();
    const songs = req.query.songs
        ? req.query.songs.split(',').map((item) => item.trim()).filter(Boolean)
        : [];
    const timeZone = resolveTimeZone(req.query.tz);
    const filteredItems = activityStore.getDayEntries(data, date, songs, timeZone);
    const allItems = activityStore.getDayEntries(data, date, [], timeZone);
    return res.json({
        date,
        timeZone,
        filtered: { items: filteredItems, total: filteredItems.length },
        all: { items: allItems, total: allItems.length },
    });
});

app.get('/api/activity/search', async (req, res) => {
    const data = await activityStore.ensureCache();
    const q = (req.query.q || '').toString().trim();
    const songs = req.query.songs
        ? req.query.songs.split(',').map((item) => item.trim()).filter(Boolean)
        : [];
    const terms = q ? q.split(/\s+/).filter(Boolean) : [];
    const matches = activityStore.search(data, terms, songs);
    res.json({ items: matches, total: matches.length });
});

function resolveEditableFile(key) {
    if (key === 'activity') {
        return ACTIVITY_LOG_PATH;
    }
    if (key === 'diary') {
        return DIARY_LOG_PATH;
    }
    return null;
}

app.get('/api/json', async (req, res) => {
    const key = (req.query.file || '').toString();
    const filePath = resolveEditableFile(key);
    if (!filePath) {
        return res.status(400).json({ error: 'Unsupported file' });
    }
    try {
        const raw = await fsp.readFile(filePath, 'utf8');
        res.json({ file: key, content: raw, size: Buffer.byteLength(raw, 'utf8') });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/json', async (req, res) => {
    const { file, content } = req.body || {};
    const filePath = resolveEditableFile(file);
    if (!filePath) {
        return res.status(400).json({ error: 'Unsupported file' });
    }
    if (typeof content !== 'string') {
        return res.status(400).json({ error: 'Content must be a string' });
    }
    try {
        JSON.parse(content);
    } catch (error) {
        return res.status(400).json({ error: 'Invalid JSON payload' });
    }
    const backupPath = `${filePath}.${Date.now()}.bak`;
    try {
        if (fs.existsSync(filePath)) {
            await fsp.copyFile(filePath, backupPath);
        }
        await fsp.writeFile(filePath, content, 'utf8');
        if (file === 'activity') {
            activityStore.cache = null;
            activityStore.sessionsCache = null;
            activityStore.calendarCache.clear();
            activityStore.summaryCache = null;
        }
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir, { maxAge: '1h', etag: true }));

app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
        return res.sendFile(path.join(publicDir, 'index.html'));
    }
    return next();
});

app.listen(PORT, () => {
    console.log(`Dashboard running on http://localhost:${PORT}`);
});
