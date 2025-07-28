// Simple Web Dashboard for Lila's Spotify Activity
const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint to get Lila's activity data
app.get('/api/lila-activity', async (req, res) => {
    try {
        const logPath = path.join(__dirname, '..', 'lila-activity-log.json');
        const data = await fs.readFile(logPath, 'utf8');
        const activities = JSON.parse(data);
        
        // Sort by timestamp (newest first)
        activities.sort((a, b) => new Date(b.loggedAt) - new Date(a.loggedAt));
        
        res.json(activities);
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.json([]); // Return empty array if file doesn't exist yet
        } else {
            console.error('Error reading activity log:', error);
            res.status(500).json({ error: 'Failed to read activity log' });
        }
    }
});

// Serve the main dashboard page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🎵 Lila Tracker Dashboard running at http://localhost:${PORT}`);
    console.log('📊 View Lila\'s listening activity in your browser!');
});
