// Modern Web Dashboard for Lila's Spotify Activity with Analytics
require('dotenv').config();
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Dashboard password (you can change this)
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || 'lila2025';

// Session store (in production, use Redis or database)
const sessions = new Map();

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Authentication middleware
const requireAuth = (req, res, next) => {
    const sessionId = req.headers['x-session-id'];
    
    if (!sessionId || !sessions.has(sessionId)) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    const session = sessions.get(sessionId);
    if (Date.now() > session.expiresAt) {
        sessions.delete(sessionId);
        return res.status(401).json({ error: 'Session expired' });
    }
    
    // Extend session
    session.expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
    next();
};

// Authentication endpoints
app.post('/api/auth/login', (req, res) => {
    const { password } = req.body;
    
    if (password !== DASHBOARD_PASSWORD) {
        return res.status(401).json({ error: 'Invalid password' });
    }
    
    // Generate session
    const sessionId = crypto.randomUUID();
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
    
    sessions.set(sessionId, {
        createdAt: Date.now(),
        expiresAt: expiresAt
    });
    
    res.json({ 
        sessionId: sessionId,
        expiresAt: expiresAt
    });
});

app.post('/api/auth/logout', (req, res) => {
    const sessionId = req.headers['x-session-id'];
    if (sessionId) {
        sessions.delete(sessionId);
    }
    res.json({ success: true });
});

app.get('/api/auth/verify', requireAuth, (req, res) => {
    res.json({ authenticated: true });
});

// Cache for Spotify audio features to avoid repeated API calls
const audioFeaturesCache = new Map();

// Get Spotify access token using sp_dc cookie
const getSpotifyAccessToken = async () => {
    try {
        const spDc = process.env.SP_DC_COOKIE;
        if (!spDc) {
            console.warn('SP_DC_COOKIE not found, using fallback classification');
            return null;
        }

        const response = await fetch('https://open.spotify.com/get_access_token?reason=transport&productType=web_player', {
            headers: {
                'Cookie': `sp_dc=${spDc}`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!response.ok) {
            console.warn('Failed to get Spotify access token');
            return null;
        }

        const data = await response.json();
        return data.accessToken;
    } catch (error) {
        console.warn('Error getting Spotify access token:', error.message);
        return null;
    }
};

// Search for track ID on Spotify
const searchSpotifyTrack = async (song, artist, accessToken) => {
    try {
        const query = encodeURIComponent(`track:"${song}" artist:"${artist}"`);
        const response = await fetch(`https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.ok) return null;
        
        const data = await response.json();
        return data.tracks?.items?.[0]?.id || null;
    } catch (error) {
        console.warn('Error searching Spotify track:', error.message);
        return null;
    }
};

// Get audio features from Spotify
const getAudioFeatures = async (trackId, accessToken) => {
    try {
        if (audioFeaturesCache.has(trackId)) {
            return audioFeaturesCache.get(trackId);
        }

        const response = await fetch(`https://api.spotify.com/v1/audio-features/${trackId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.ok) return null;
        
        const features = await response.json();
        audioFeaturesCache.set(trackId, features);
        return features;
    } catch (error) {
        console.warn('Error getting audio features:', error.message);
        return null;
    }
};

// Advanced song classification using Spotify Audio Features
const classifySongTypeAdvanced = async (song, artist, album) => {
    try {
        const accessToken = await getSpotifyAccessToken();
        if (!accessToken) {
            console.log(`[Classification] Using fallback for "${song}" by ${artist} - No access token`);
            return classifySongTypeFallback(song, artist, album);
        }

        const trackId = await searchSpotifyTrack(song, artist, accessToken);
        if (!trackId) {
            console.log(`[Classification] Using fallback for "${song}" by ${artist} - Track not found`);
            return classifySongTypeFallback(song, artist, album);
        }

        const features = await getAudioFeatures(trackId, accessToken);
        if (!features) {
            console.log(`[Classification] Using fallback for "${song}" by ${artist} - No audio features`);
            return classifySongTypeFallback(song, artist, album);
        }

        console.log(`[Classification] Using audio features for "${song}" by ${artist} - Energy: ${features.energy}, Valence: ${features.valence}`);

        // Classify based on audio features
        const { valence, energy, danceability, acousticness, mode, tempo } = features;

        // High energy + high valence = energetic/happy
        if (energy > 0.7 && valence > 0.6) {
            return 'energetic';
        }
        
        // Low valence + low energy = sad
        if (valence < 0.3 && energy < 0.4) {
            return 'sad';
        }

        // Low valence + medium energy = angry/breakup
        if (valence < 0.4 && energy > 0.5 && energy < 0.8) {
            // Check lyrics/title for breakup indicators
            const text = `${song} ${artist}`.toLowerCase();
            const breakupKeywords = ['ex', 'over', 'leave', 'goodbye', 'forget', 'move on', 'done', 'through', 'end', 'break'];
            if (breakupKeywords.some(keyword => text.includes(keyword))) {
                return 'breakup';
            }
            return 'angry';
        }

        // High valence + medium energy = love/romantic
        if (valence > 0.6 && energy > 0.3 && energy < 0.7) {
            const text = `${song} ${artist}`.toLowerCase();
            const loveKeywords = ['love', 'heart', 'baby', 'honey', 'together', 'kiss', 'romance'];
            if (loveKeywords.some(keyword => text.includes(keyword))) {
                return 'love';
            }
        }

        // High acousticness + low energy = chill
        if (acousticness > 0.5 && energy < 0.5) {
            return 'chill';
        }

        // High danceability + high energy = party/energetic
        if (danceability > 0.7 && energy > 0.6) {
            return 'energetic';
        }

        // Low energy + medium valence = nostalgic/melodic
        if (energy < 0.5 && valence > 0.3 && valence < 0.7) {
            return 'nostalgic';
        }

        // High energy + low valence + fast tempo = angry
        if (energy > 0.7 && valence < 0.4 && tempo > 120) {
            return 'angry';
        }

        // Medium everything = melodic
        if (energy > 0.4 && energy < 0.7 && valence > 0.4 && valence < 0.7) {
            return 'melodic';
        }

        // Fallback to keyword-based if no clear audio pattern
        return classifySongTypeFallback(song, artist, album);

    } catch (error) {
        console.warn('Error in advanced classification:', error.message);
        return classifySongTypeFallback(song, artist, album);
    }
};

// Fallback classification using keywords (original method)
const classifySongTypeFallback = (song, artist, album) => {
    const text = `${song} ${artist} ${album}`.toLowerCase();
    
    // Define classification keywords
    const classifications = {
        'energetic': ['pump', 'energy', 'fire', 'hype', 'party', 'dance', 'club', 'bounce', 'wild', 'crazy', 'turnt', 'lit'],
        'sad': ['sad', 'cry', 'tear', 'hurt', 'pain', 'broken', 'lonely', 'miss', 'gone', 'lost', 'empty', 'blue'],
        'breakup': ['ex', 'over', 'leave', 'goodbye', 'forget', 'move on', 'done', 'through', 'end', 'break up', 'split'],
        'love': ['love', 'heart', 'baby', 'honey', 'forever', 'together', 'kiss', 'romance', 'sweet', 'mine'],
        'chill': ['chill', 'vibe', 'calm', 'smooth', 'relax', 'easy', 'soft', 'mellow', 'cool', 'peaceful'],
        'angry': ['mad', 'hate', 'fight', 'rage', 'angry', 'fuck', 'kill', 'destroy', 'war', 'violence'],
        'nostalgic': ['remember', 'old', 'back', 'time', 'past', 'memories', 'used to', 'childhood', 'young'],
        'confident': ['boss', 'king', 'queen', 'winner', 'rich', 'money', 'success', 'top', 'best', 'flex'],
        'melodic': ['melody', 'sing', 'voice', 'sound', 'music', 'notes', 'harmony', 'tune'],
        'experimental': ['weird', 'strange', 'different', 'new', 'experimental', 'abstract', 'avant']
    };
    
    // Check for explicit mood indicators in song title
    for (const [type, keywords] of Object.entries(classifications)) {
        if (keywords.some(keyword => text.includes(keyword))) {
            return type;
        }
    }
    
    // Genre-based classification fallback
    const genres = {
        'energetic': ['rap', 'hip hop', 'trap', 'drill', 'edm', 'electronic'],
        'chill': ['lo-fi', 'indie', 'acoustic', 'folk'],
        'melodic': ['pop', 'r&b', 'soul'],
        'experimental': ['alternative', 'experimental']
    };
    
    for (const [type, genreKeywords] of Object.entries(genres)) {
        if (genreKeywords.some(genre => text.includes(genre))) {
            return type;
        }
    }
    
    return 'neutral';
};

// Main classification function (uses advanced method with fallback)
const classifySongType = async (song, artist, album) => {
    return await classifySongTypeAdvanced(song, artist, album);
};

// API endpoint to get Lila's activity data with enhanced analytics
app.get('/api/lila-activity', requireAuth, async (req, res) => {
    try {
        // Use shared directory in Docker, parent directory otherwise
        const logPath = process.env.NODE_ENV === 'production' 
            ? '/app/shared/lila-activity-log.json'
            : path.join(__dirname, '..', 'lila-activity-log.json');
        
        // Check if file exists and is actually a file
        try {
            const stats = await fs.stat(logPath);
            if (stats.isDirectory()) {
                console.log('Warning: Log path is a directory, not a file');
                return res.json([]);
            }
        } catch (statError) {
            if (statError.code === 'ENOENT') {
                // File doesn't exist yet, return empty array
                return res.json([]);
            }
            throw statError;
        }
        
        const data = await fs.readFile(logPath, 'utf8');
        const activities = JSON.parse(data);
        
        // Enhance each activity with mood classification
        const enhancedActivities = await Promise.all(activities.map(async activity => ({
            ...activity,
            moodType: await classifySongType(activity.song, activity.artist, activity.album),
            id: `${activity.song}-${activity.artist}-${activity.loggedAt}`.replace(/[^a-zA-Z0-9]/g, '-')
        })));
        
        // Sort by timestamp (newest first)
        enhancedActivities.sort((a, b) => new Date(b.loggedAt) - new Date(a.loggedAt));
        
        res.json(enhancedActivities);
    } catch (error) {
        console.error('Error reading activity log:', error.message);
        res.status(500).json({ error: 'Failed to read activity log' });
    }
});

// API endpoint for analytics data
app.get('/api/analytics', requireAuth, async (req, res) => {
    try {
        const logPath = process.env.NODE_ENV === 'production' 
            ? '/app/shared/lila-activity-log.json'
            : path.join(__dirname, '..', 'lila-activity-log.json');
        
        try {
            await fs.stat(logPath);
        } catch (statError) {
            if (statError.code === 'ENOENT') {
                return res.json({
                    totalSongs: 0,
                    uniqueArtists: 0,
                    moodDistribution: {},
                    topArtists: [],
                    listeningPatterns: {}
                });
            }
            throw statError;
        }
        
        const data = await fs.readFile(logPath, 'utf8');
        const activities = JSON.parse(data);
        
        // Generate analytics
        const analytics = await generateAnalytics(activities);
        res.json(analytics);
    } catch (error) {
        console.error('Error generating analytics:', error.message);
        res.status(500).json({ error: 'Failed to generate analytics' });
    }
});

// Generate comprehensive analytics
const generateAnalytics = async (activities) => {
    const moodCounts = {};
    const artistCounts = {};
    const hourlyListening = {};
    const dailyListening = {};
    
    // Process all activities with async mood classification
    const activitiesWithMood = await Promise.all(activities.map(async activity => ({
        ...activity,
        mood: await classifySongType(activity.song, activity.artist, activity.album)
    })));
    
    activitiesWithMood.forEach(activity => {
        // Mood distribution
        moodCounts[activity.mood] = (moodCounts[activity.mood] || 0) + 1;
        
        // Artist frequency
        artistCounts[activity.artist] = (artistCounts[activity.artist] || 0) + 1;
        
        // Listening patterns
        const date = new Date(activity.loggedAt);
        const hour = date.getHours();
        const day = date.toDateString();
        
        hourlyListening[hour] = (hourlyListening[hour] || 0) + 1;
        dailyListening[day] = (dailyListening[day] || 0) + 1;
    });
    
    // Top artists (limit to top 10)
    const topArtists = Object.entries(artistCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([artist, count]) => ({ artist, count }));
    
    // Generate listening sessions
    const sessions = await generateListeningSessions(activitiesWithMood);
    
    return {
        totalSongs: activities.length,
        uniqueArtists: Object.keys(artistCounts).length,
        moodDistribution: moodCounts,
        topArtists,
        listeningPatterns: {
            hourly: hourlyListening,
            daily: Object.keys(dailyListening).length
        },
        recentActivity: activitiesWithMood.slice(0, 5).map(a => ({
            song: a.song,
            artist: a.artist,
            timestamp: a.loggedAt,
            mood: a.mood
        })),
        sessions: sessions
    };
};

// Diary endpoints
app.get('/api/diary', requireAuth, async (req, res) => {
    try {
        const diaryPath = process.env.NODE_ENV === 'production' 
            ? '/app/shared/diary-entries.json'
            : path.join(__dirname, '..', 'diary-entries.json');
        
        try {
            const data = await fs.readFile(diaryPath, 'utf8');
            const entries = JSON.parse(data);
            
            // Sort by date (newest first)
            entries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            
            res.json(entries);
        } catch (error) {
            if (error.code === 'ENOENT') {
                res.json([]);
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error('Error reading diary entries:', error.message);
        res.status(500).json({ error: 'Failed to read diary entries' });
    }
});

app.post('/api/diary', requireAuth, async (req, res) => {
    try {
        const { title, content, mood, tags } = req.body;
        
        if (!title || !content) {
            return res.status(400).json({ error: 'Title and content are required' });
        }
        
        const diaryPath = process.env.NODE_ENV === 'production' 
            ? '/app/shared/diary-entries.json'
            : path.join(__dirname, '..', 'diary-entries.json');
        
        // Read existing entries
        let entries = [];
        try {
            const data = await fs.readFile(diaryPath, 'utf8');
            entries = JSON.parse(data);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
        
        // Create new entry
        const newEntry = {
            id: crypto.randomUUID(),
            title: title.trim(),
            content: content.trim(),
            mood: mood || 'neutral',
            tags: tags || [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        entries.unshift(newEntry);
        
        // Save entries
        await fs.writeFile(diaryPath, JSON.stringify(entries, null, 2));
        
        res.json(newEntry);
    } catch (error) {
        console.error('Error creating diary entry:', error.message);
        res.status(500).json({ error: 'Failed to create diary entry' });
    }
});

app.put('/api/diary/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content, mood, tags } = req.body;
        
        const diaryPath = process.env.NODE_ENV === 'production' 
            ? '/app/shared/diary-entries.json'
            : path.join(__dirname, '..', 'diary-entries.json');
        
        const data = await fs.readFile(diaryPath, 'utf8');
        const entries = JSON.parse(data);
        
        const entryIndex = entries.findIndex(entry => entry.id === id);
        if (entryIndex === -1) {
            return res.status(404).json({ error: 'Entry not found' });
        }
        
        // Update entry
        entries[entryIndex] = {
            ...entries[entryIndex],
            title: title?.trim() || entries[entryIndex].title,
            content: content?.trim() || entries[entryIndex].content,
            mood: mood || entries[entryIndex].mood,
            tags: tags || entries[entryIndex].tags,
            updatedAt: new Date().toISOString()
        };
        
        await fs.writeFile(diaryPath, JSON.stringify(entries, null, 2));
        
        res.json(entries[entryIndex]);
    } catch (error) {
        console.error('Error updating diary entry:', error.message);
        res.status(500).json({ error: 'Failed to update diary entry' });
    }
});

app.delete('/api/diary/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        const diaryPath = process.env.NODE_ENV === 'production' 
            ? '/app/shared/diary-entries.json'
            : path.join(__dirname, '..', 'diary-entries.json');
        
        const data = await fs.readFile(diaryPath, 'utf8');
        const entries = JSON.parse(data);
        
        const filteredEntries = entries.filter(entry => entry.id !== id);
        
        if (filteredEntries.length === entries.length) {
            return res.status(404).json({ error: 'Entry not found' });
        }
        
        await fs.writeFile(diaryPath, JSON.stringify(filteredEntries, null, 2));
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting diary entry:', error.message);
        res.status(500).json({ error: 'Failed to delete diary entry' });
    }
});

// Raw JSON editing endpoints
app.get('/api/raw/activity', requireAuth, async (req, res) => {
    try {
        const logPath = process.env.NODE_ENV === 'production' 
            ? '/app/shared/lila-activity-log.json'
            : path.join(__dirname, '..', 'lila-activity-log.json');
        
        const rawContent = req.query.raw === 'true'; // Query param to get raw content
        
        try {
            const data = await fs.readFile(logPath, 'utf8');
            
            if (rawContent) {
                // Return raw file content as string
                res.json({ content: data, path: logPath, type: 'raw' });
            } else {
                // Return parsed JSON content for editing
                const parsed = JSON.parse(data || '[]');
                res.json(parsed);
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                if (rawContent) {
                    res.json({ content: '[]', path: logPath, type: 'raw' });
                } else {
                    res.json([]);
                }
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error('Error reading raw activity data:', error.message);
        res.status(500).json({ error: 'Failed to read raw activity data' });
    }
});

app.get('/api/raw/diary', requireAuth, async (req, res) => {
    try {
        const diaryPath = process.env.NODE_ENV === 'production' 
            ? '/app/shared/diary-entries.json'
            : path.join(__dirname, '..', 'diary-entries.json');
        
        const rawContent = req.query.raw === 'true'; // Query param to get raw content
        
        try {
            const data = await fs.readFile(diaryPath, 'utf8');
            
            if (rawContent) {
                // Return raw file content as string
                res.json({ content: data, path: diaryPath, type: 'raw' });
            } else {
                // Return parsed JSON content for editing
                const parsed = JSON.parse(data || '[]');
                res.json(parsed);
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                if (rawContent) {
                    res.json({ content: '[]', path: diaryPath, type: 'raw' });
                } else {
                    res.json([]);
                }
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error('Error reading raw diary data:', error.message);
        res.status(500).json({ error: 'Failed to read raw diary data' });
    }
});

app.put('/api/raw/activity', requireAuth, async (req, res) => {
    try {
        const { data } = req.body; // Expect structured data instead of raw content
        
        if (!data) {
            return res.status(400).json({ error: 'Data is required' });
        }
        
        // Convert to JSON string
        const content = JSON.stringify(data, null, 2);
        
        const logPath = process.env.NODE_ENV === 'production' 
            ? '/app/shared/lila-activity-log.json'
            : path.join(__dirname, '..', 'lila-activity-log.json');
        
        // Create backup before overwriting
        const backupPath = logPath + '.backup.' + Date.now();
        try {
            await fs.copyFile(logPath, backupPath);
        } catch (error) {
            // Backup failed, but continue if original file doesn't exist
            if (error.code !== 'ENOENT') {
                console.warn('Failed to create backup:', error.message);
            }
        }
        
        await fs.writeFile(logPath, content);
        
        res.json({ success: true, message: 'Activity data updated successfully' });
    } catch (error) {
        console.error('Error updating raw activity data:', error.message);
        res.status(500).json({ error: 'Failed to update raw activity data' });
    }
});

app.put('/api/raw/diary', requireAuth, async (req, res) => {
    try {
        const { data } = req.body; // Expect structured data instead of raw content
        
        if (!data) {
            return res.status(400).json({ error: 'Data is required' });
        }
        
        // Convert to JSON string
        const content = JSON.stringify(data, null, 2);
        
        
        const diaryPath = process.env.NODE_ENV === 'production' 
            ? '/app/shared/diary-entries.json'
            : path.join(__dirname, '..', 'diary-entries.json');
        
        // Create backup before overwriting
        const backupPath = diaryPath + '.backup.' + Date.now();
        try {
            await fs.copyFile(diaryPath, backupPath);
        } catch (error) {
            // Backup failed, but continue if original file doesn't exist
            if (error.code !== 'ENOENT') {
                console.warn('Failed to create backup:', error.message);
            }
        }
        
        await fs.writeFile(diaryPath, content);
        
        res.json({ success: true, message: 'Diary data updated successfully' });
    } catch (error) {
        console.error('Error updating raw diary data:', error.message);
        res.status(500).json({ error: 'Failed to update raw diary data' });
    }
});

// Generate listening sessions with mood classification
const generateListeningSessions = async (activitiesWithMood) => {
    if (activitiesWithMood.length === 0) return [];
    
    const sessions = [];
    let currentSession = null;
    const SESSION_GAP_MINUTES = 30; // If gap > 30 minutes, start new session
    
    // Sort activities by timestamp (oldest first for session building)
    const sortedActivities = [...activitiesWithMood].sort((a, b) => 
        new Date(a.loggedAt) - new Date(b.loggedAt)
    );
    
    sortedActivities.forEach((activity, index) => {
        const timestamp = new Date(activity.loggedAt);
        
        // Check if we should start a new session
        if (!currentSession || 
            (timestamp - new Date(currentSession.endTime)) > SESSION_GAP_MINUTES * 60 * 1000) {
            
            // Finalize previous session
            if (currentSession) {
                currentSession.sessionMood = determineSessionMood(currentSession.songs);
                sessions.push(currentSession);
            }
            
            // Start new session
            currentSession = {
                id: `session-${timestamp.getTime()}`,
                startTime: activity.loggedAt,
                endTime: activity.loggedAt,
                songs: [{ ...activity, mood: activity.mood }],
                duration: 0
            };
        } else {
            // Add to current session
            currentSession.songs.push({ ...activity, mood: activity.mood });
            currentSession.endTime = activity.loggedAt;
            currentSession.duration = new Date(currentSession.endTime) - new Date(currentSession.startTime);
        }
    });
    
    // Finalize last session
    if (currentSession) {
        currentSession.sessionMood = determineSessionMood(currentSession.songs);
        sessions.push(currentSession);
    }
    
    // Return sessions sorted by start time (newest first)
    return sessions.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
};

// Determine the overall mood of a listening session
const determineSessionMood = (songs) => {
    if (songs.length === 0) return 'neutral';
    
    // Count mood occurrences
    const moodCounts = {};
    songs.forEach(song => {
        const mood = song.mood || 'neutral';
        moodCounts[mood] = (moodCounts[mood] || 0) + 1;
    });
    
    // Find the most common mood
    const sortedMoods = Object.entries(moodCounts)
        .sort(([,a], [,b]) => b - a);
    
    const dominantMood = sortedMoods[0][0];
    const dominantCount = sortedMoods[0][1];
    const totalSongs = songs.length;
    
    // If a mood represents more than 40% of the session, use it
    if (dominantCount / totalSongs >= 0.4) {
        return dominantMood;
    }
    
    // If no clear dominant mood, check for emotional patterns
    const emotionalWeight = {
        'sad': 2,
        'breakup': 2,
        'angry': 2,
        'love': 1.5,
        'nostalgic': 1.5,
        'energetic': 1,
        'confident': 1,
        'chill': 0.5,
        'melodic': 0.5,
        'experimental': 0.5,
        'neutral': 0
    };
    
    let weightedScore = 0;
    let totalWeight = 0;
    
    Object.entries(moodCounts).forEach(([mood, count]) => {
        const weight = emotionalWeight[mood] || 0;
        weightedScore += weight * count;
        totalWeight += count;
    });
    
    const averageWeight = weightedScore / totalWeight;
    
    if (averageWeight >= 1.5) return 'intense'; // Emotional session
    if (averageWeight >= 1) return 'mixed'; // Mixed emotional session
    return 'chill'; // Relaxed session
};

// Serve the main dashboard page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🎵 Lila Tracker Dashboard running at http://localhost:${PORT}`);
    console.log('📊 Enhanced dashboard with mood analysis and analytics tools!');
    console.log('🎯 Advanced song classification using Spotify Audio Features API');
    console.log('🔍 Available endpoints:');
    console.log('  - GET / (Dashboard)');
    console.log('  - GET /api/lila-activity (Enhanced activity data)');
    console.log('  - GET /api/analytics (Analytics data)');
    console.log('  - Authentication required for all API endpoints');
    
    // Test the classification system on startup
    if (process.env.SP_DC_COOKIE) {
        console.log('✅ SP_DC_COOKIE found - Advanced classification available');
    } else {
        console.log('⚠️  SP_DC_COOKIE not found - Using fallback classification');
    }
});
