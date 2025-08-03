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
        }))
    };
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
