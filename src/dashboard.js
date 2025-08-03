// Modern Web Dashboard for Lila's Spotify Activity with Analytics
const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Song mood/type classification based on song title and artist
const classifySongType = (song, artist, album) => {
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

// API endpoint to get Lila's activity data with enhanced analytics
app.get('/api/lila-activity', async (req, res) => {
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
        const enhancedActivities = activities.map(activity => ({
            ...activity,
            moodType: classifySongType(activity.song, activity.artist, activity.album),
            id: `${activity.song}-${activity.artist}-${activity.loggedAt}`.replace(/[^a-zA-Z0-9]/g, '-')
        }));
        
        // Sort by timestamp (newest first)
        enhancedActivities.sort((a, b) => new Date(b.loggedAt) - new Date(a.loggedAt));
        
        res.json(enhancedActivities);
    } catch (error) {
        console.error('Error reading activity log:', error.message);
        res.status(500).json({ error: 'Failed to read activity log' });
    }
});

// API endpoint for analytics data
app.get('/api/analytics', async (req, res) => {
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
        const analytics = generateAnalytics(activities);
        res.json(analytics);
    } catch (error) {
        console.error('Error generating analytics:', error.message);
        res.status(500).json({ error: 'Failed to generate analytics' });
    }
});

// Generate comprehensive analytics
const generateAnalytics = (activities) => {
    const moodCounts = {};
    const artistCounts = {};
    const hourlyListening = {};
    const dailyListening = {};
    
    activities.forEach(activity => {
        // Mood distribution
        const mood = classifySongType(activity.song, activity.artist, activity.album);
        moodCounts[mood] = (moodCounts[mood] || 0) + 1;
        
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
    const sessions = generateListeningSessions(activities);
    
    return {
        totalSongs: activities.length,
        uniqueArtists: Object.keys(artistCounts).length,
        moodDistribution: moodCounts,
        topArtists,
        listeningPatterns: {
            hourly: hourlyListening,
            daily: Object.keys(dailyListening).length
        },
        recentActivity: activities.slice(0, 5).map(a => ({
            song: a.song,
            artist: a.artist,
            timestamp: a.loggedAt,
            mood: classifySongType(a.song, a.artist, a.album)
        })),
        sessions: sessions
    };
};

// Generate listening sessions with mood classification
const generateListeningSessions = (activities) => {
    if (activities.length === 0) return [];
    
    const sessions = [];
    let currentSession = null;
    const SESSION_GAP_MINUTES = 30; // If gap > 30 minutes, start new session
    
    // Sort activities by timestamp (oldest first for session building)
    const sortedActivities = [...activities].sort((a, b) => 
        new Date(a.loggedAt) - new Date(b.loggedAt)
    );
    
    sortedActivities.forEach((activity, index) => {
        const mood = classifySongType(activity.song, activity.artist, activity.album);
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
                songs: [{ ...activity, mood }],
                duration: 0
            };
        } else {
            // Add to current session
            currentSession.songs.push({ ...activity, mood });
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
    console.log('🔍 Available endpoints:');
    console.log('  - GET / (Dashboard)');
    console.log('  - GET /api/lila-activity (Enhanced activity data)');
    console.log('  - GET /api/analytics (Analytics data)');
});
