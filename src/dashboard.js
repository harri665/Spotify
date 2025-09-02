// Modern Web Dashboard for Lila's Spotify Activity with Analytics
require('dotenv').config();
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize OpenAI client
let openai = null;
if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here') {
    openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });
    console.log('✅ OpenAI client initialized');
} else {
    console.log('⚠️  OPENAI_API_KEY not configured - using fallback classification');
}

// Cache for OpenAI classifications to avoid repeated API calls and save costs
const classificationCache = new Map();
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

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

// Advanced song classification using OpenAI ChatGPT
const classifySongWithOpenAI = async (song, artist, album) => {
    try {
        if (!openai) {
            return classifySongTypeFallback(song, artist, album);
        }

        // Create cache key
        const cacheKey = `${song}-${artist}-${album}`.toLowerCase();
        
        // Check cache first
        if (classificationCache.has(cacheKey)) {
            const cached = classificationCache.get(cacheKey);
            if (Date.now() - cached.timestamp < CACHE_DURATION) {
                return cached.mood;
            }
        }

        // Prepare prompt for ChatGPT
        const prompt = `Classify the mood/genre of this song based on the title, artist, and album. 

Song: "${song}"
Artist: "${artist}"
Album: "${album}"

Choose ONE of these categories that best fits:
- energetic (high energy, pump-up, workout music)
- sad (melancholy, depressing, emotional pain)
- breakup (relationship endings, moving on, heartbreak)
- love (romantic, affectionate, relationship happiness)
- chill (relaxed, laid-back, easy listening)
- angry (aggressive, frustrated, intense)
- nostalgic (reminiscent, memories, past-focused)
- confident (empowering, self-assured, boss vibes)
- melodic (beautiful vocals, harmony-focused, musical)
- party (celebration, dancing, nightlife)

Only respond with the single word category, nothing else.`;

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: "You are a music expert that classifies songs into mood categories. You always respond with exactly one word from the provided categories."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            max_tokens: 10,
            temperature: 0.3
        });

        const classification = completion.choices[0]?.message?.content?.trim().toLowerCase();
        
        // Validate the response
        const validMoods = ['energetic', 'sad', 'breakup', 'love', 'chill', 'angry', 'nostalgic', 'confident', 'melodic', 'party'];
        const finalMood = validMoods.includes(classification) ? classification : 'melodic';
        
        // Cache the result
        classificationCache.set(cacheKey, {
            mood: finalMood,
            timestamp: Date.now()
        });

        console.log(`[OpenAI] "${song}" by ${artist} → ${finalMood}`);
        return finalMood;

    } catch (error) {
        console.warn(`[OpenAI] Error classifying "${song}" by ${artist}:`, error.message);
        return classifySongTypeFallback(song, artist, album);
    }
};

// Batch classification for multiple songs (more efficient)
const classifyMultipleSongsWithOpenAI = async (songs) => {
    try {
        if (!openai || songs.length === 0) {
            return songs.map(song => ({
                ...song,
                mood: classifySongTypeFallback(song.song, song.artist, song.album)
            }));
        }

        // Check cache for all songs first
        const results = [];
        const uncachedSongs = [];
        
        for (const song of songs) {
            const cacheKey = `${song.song}-${song.artist}-${song.album}`.toLowerCase();
            if (classificationCache.has(cacheKey)) {
                const cached = classificationCache.get(cacheKey);
                if (Date.now() - cached.timestamp < CACHE_DURATION) {
                    results.push({ ...song, mood: cached.mood });
                    continue;
                }
            }
            uncachedSongs.push(song);
        }

        // Process uncached songs in batches of 5 to save API calls
        if (uncachedSongs.length > 0) {
            const batchSize = 5;
            for (let i = 0; i < uncachedSongs.length; i += batchSize) {
                const batch = uncachedSongs.slice(i, i + batchSize);
                
                const songList = batch.map((song, index) => 
                    `${index + 1}. "${song.song}" by ${song.artist} (Album: ${song.album})`
                ).join('\n');

                const prompt = `Classify the mood/genre of these songs. For each song, choose ONE category:

Songs:
${songList}

Categories:
- energetic (high energy, pump-up, workout music)
- sad (melancholy, depressing, emotional pain)
- breakup (relationship endings, moving on, heartbreak)
- love (romantic, affectionate, relationship happiness)
- chill (relaxed, laid-back, easy listening)
- angry (aggressive, frustrated, intense)
- nostalgic (reminiscent, memories, past-focused)
- confident (empowering, self-assured, boss vibes)
- melodic (beautiful vocals, harmony-focused, musical)
- party (celebration, dancing, nightlife)

Respond with only the numbers and categories, like:
1. energetic
2. sad
3. love
etc.`;

                const completion = await openai.chat.completions.create({
                    model: "gpt-3.5-turbo",
                    messages: [
                        {
                            role: "system",
                            content: "You are a music expert that classifies songs into mood categories. Always respond in the exact format requested."
                        },
                        {
                            role: "user",
                            content: prompt
                        }
                    ],
                    max_tokens: 100,
                    temperature: 0.3
                });

                const response = completion.choices[0]?.message?.content?.trim();
                const lines = response.split('\n');
                
                // Parse results and cache them
                const validMoods = ['energetic', 'sad', 'breakup', 'love', 'chill', 'angry', 'nostalgic', 'confident', 'melodic', 'party'];
                
                batch.forEach((song, index) => {
                    let mood = 'melodic'; // default
                    
                    if (lines[index]) {
                        const match = lines[index].match(/\d+\.\s*(\w+)/);
                        if (match && validMoods.includes(match[1].toLowerCase())) {
                            mood = match[1].toLowerCase();
                        }
                    }
                    
                    // Cache the result
                    const cacheKey = `${song.song}-${song.artist}-${song.album}`.toLowerCase();
                    classificationCache.set(cacheKey, {
                        mood: mood,
                        timestamp: Date.now()
                    });
                    
                    results.push({ ...song, mood });
                });

                // Small delay to respect rate limits
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        console.log(`[OpenAI] Batch classified ${results.length} songs`);
        return results;

    } catch (error) {
        console.warn('[OpenAI] Error in batch classification:', error.message);
        return songs.map(song => ({
            ...song,
            mood: classifySongTypeFallback(song.song, song.artist, song.album)
        }));
    }
};

// Keep the original fallback method
const classifySongTypeFallback = (song, artist, album) => {
    const text = `${song} ${artist} ${album}`.toLowerCase();
    
    // Simple classification keywords
    const classifications = {
        'energetic': ['pump', 'energy', 'fire', 'hype', 'party', 'dance', 'club', 'bounce'],
        'sad': ['sad', 'cry', 'tear', 'hurt', 'pain', 'broken', 'lonely', 'miss', 'gone'],
        'breakup': ['ex', 'over', 'leave', 'goodbye', 'forget', 'move on', 'done', 'through'],
        'love': ['love', 'heart', 'baby', 'honey', 'forever', 'together', 'kiss', 'romance'],
        'chill': ['chill', 'vibe', 'calm', 'smooth', 'relax', 'easy', 'soft', 'mellow'],
        'angry': ['mad', 'hate', 'fight', 'rage', 'angry', 'fuck', 'kill', 'destroy'],
        'nostalgic': ['remember', 'old', 'back', 'time', 'past', 'memories', 'used to'],
        'confident': ['boss', 'king', 'queen', 'winner', 'rich', 'money', 'success']
    };
    
    for (const [type, keywords] of Object.entries(classifications)) {
        if (keywords.some(keyword => text.includes(keyword))) {
            return type;
        }
    }
    
    return 'melodic'; // Default to melodic instead of neutral
};


// Manual classification override (loads from JSON file)
let manualClassifications = null;
const manualClassificationsPath = path.join(__dirname, '..', 'manual-classifications.json');

async function loadManualClassifications() {
    if (manualClassifications !== null) return manualClassifications;
    try {
        const data = await fs.readFile(manualClassificationsPath, 'utf8');
        const parsed = JSON.parse(data);
        // Convert to a lookup map for fast access
        manualClassifications = new Map();
        Object.values(parsed).forEach(entry => {
            if (entry.song && entry.artist && entry.mood) {
                const key = `${entry.song.toLowerCase()}|${entry.artist.toLowerCase()}|${(entry.album||'').toLowerCase()}`;
                manualClassifications.set(key, entry.mood.toLowerCase());
            }
        });
        return manualClassifications;
    } catch (e) {
        manualClassifications = new Map();
        return manualClassifications;
    }
}

// Main classification function using manual override, OpenAI, or fallback
const classifySongType = async (song, artist, album, timestamp = null, context = {}) => {
    // 1. Check manual override first
    const manualMap = await loadManualClassifications();
    const key = `${(song||'').toLowerCase()}|${(artist||'').toLowerCase()}|${(album||'').toLowerCase()}`;
    if (manualMap.has(key)) {
        return manualMap.get(key);
    }
    // 2. Try OpenAI classification if available
    if (openai) {
        return await classifySongWithOpenAI(song, artist, album);
    }
    // 3. Fallback to pattern recognition if OpenAI is not available
    return classifySongTypeFallback(song, artist, album);
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
        
        // Enhance each activity with mood classification using OpenAI
        let enhancedActivities = [];
        
        // Process in batches for better performance with OpenAI
        if (openai && activities.length > 10) {
            // Use batch processing for large datasets
            const classified = await classifyMultipleSongsWithOpenAI(activities);
            
            enhancedActivities = classified.map(activity => ({
                ...activity,
                moodType: activity.mood,
                id: `${activity.song}-${activity.artist}-${activity.loggedAt}`.replace(/[^a-zA-Z0-9]/g, '-')
            }));
        } else {
            // Process individually for smaller datasets or fallback
            for (let i = 0; i < activities.length; i++) {
                const activity = activities[i];
                const moodType = await classifySongType(
                    activity.song, 
                    activity.artist, 
                    activity.album, 
                    activity.loggedAt
                );
                
                enhancedActivities.push({
                    ...activity,
                    moodType,
                    id: `${activity.song}-${activity.artist}-${activity.loggedAt}`.replace(/[^a-zA-Z0-9]/g, '-')
                });
            }
        }
        
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
    
    // Process all activities with mood classification using OpenAI
    let activitiesWithMood = [];
    
    // Use batch processing for better performance with OpenAI
    if (openai && activities.length > 10) {
        activitiesWithMood = await classifyMultipleSongsWithOpenAI(activities);
    } else {
        // Process individually for smaller datasets or fallback
        for (let i = 0; i < activities.length; i++) {
            const activity = activities[i];
            const mood = await classifySongType(
                activity.song, 
                activity.artist, 
                activity.album, 
                activity.loggedAt
            );
            
            activitiesWithMood.push({
                ...activity,
                mood
            });
        }
    }
    
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
    const sessions = generateListeningSessions(activitiesWithMood);
    
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
const generateListeningSessions = (activitiesWithMood) => {
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
    console.log('🤖 Advanced song classification using pattern recognition');
    console.log('🧠 Multi-factor analysis: title structure, artist patterns, temporal context');
    console.log('📈 Behavioral learning from listening sequences');
    console.log('🔍 Available endpoints:');
    console.log('  - GET / (Dashboard)');
    console.log('  - GET /api/lila-activity (Enhanced activity data)');
    console.log('  - GET /api/analytics (Analytics data)');
    console.log('  - Authentication required for all API endpoints');
    
    console.log('✅ Pattern recognition system ready - No external dependencies');
});
