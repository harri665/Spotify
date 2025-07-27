const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const SpotifyFriendActivityServer = require('./friend-activity-server');

class SpotifyWebDashboard {
  constructor(spDcCookie, port = 3000) {
    this.spDcCookie = spDcCookie || process.env.SP_DC_COOKIE;
    this.port = parseInt(process.env.PORT) || port;
    this.app = express();
    this.server = null;
    this.spotifyServer = null;
    
    // Use logs directory for Docker volume mounting
    const logsDir = path.join(__dirname, 'logs');
    this.logFile = path.join(logsDir, 'friend-activity-log.json');
    
    // Ensure logs directory exists
    this.ensureLogsDirectory();
  }

  async ensureLogsDirectory() {
    try {
      const logsDir = path.dirname(this.logFile);
      await fs.mkdir(logsDir, { recursive: true });
    } catch (error) {
      console.log('Logs directory already exists or error creating it:', error.message);
    }
  }

  async init() {
    console.log('🌐 Starting Spotify Web Dashboard...');
    
    // Setup express middleware
    this.app.use(express.static('public'));
    this.app.use(express.json());
    
    // Setup routes
    this.setupRoutes();
    
    // Start Spotify monitoring server
    this.spotifyServer = new SpotifyFriendActivityServer(this.spDcCookie);
    await this.spotifyServer.init();
    
    // Start web server
    this.server = this.app.listen(this.port, () => {
      console.log(`\n🎯 Dashboard available at: http://localhost:${this.port}`);
      console.log('📊 View real-time friend activity in your browser!');
    });
  }

  setupRoutes() {
    // Main dashboard page
    this.app.get('/', (req, res) => {
      res.send(this.getHtmlPage());
    });

    // API endpoint for current activity
    this.app.get('/api/current-activity', async (req, res) => {
      try {
        const activity = await this.spotifyServer.fetchFriendActivity();
        res.json(activity || { friends: [] });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // API endpoint for activity log
    this.app.get('/api/activity-log', async (req, res) => {
      try {
        let log = [];
        try {
          const data = await fs.readFile(this.logFile, 'utf8');
          log = JSON.parse(data);
        } catch (error) {
          // File doesn't exist, return empty log
        }
        
        // Return last 50 entries
        res.json(log.slice(-50));
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // API endpoint for stats
    this.app.get('/api/stats', async (req, res) => {
      try {
        let log = [];
        try {
          const data = await fs.readFile(this.logFile, 'utf8');
          log = JSON.parse(data);
        } catch (error) {
          // File doesn't exist
        }

        const stats = {
          totalEntries: log.length,
          lastUpdate: log.length > 0 ? log[log.length - 1].timestamp : null,
          uniqueFriends: [...new Set(log.map(entry => entry.user))].length
        };

        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  getHtmlPage() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Spotify Friend Activity Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #1DB954, #191414);
            color: white;
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }
        
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .stat-card {
            background: rgba(0, 0, 0, 0.3);
            padding: 20px;
            border-radius: 10px;
            text-align: center;
        }
        
        .stat-value {
            font-size: 2em;
            font-weight: bold;
            color: #1DB954;
        }
        
        .current-activity {
            background: rgba(0, 0, 0, 0.3);
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 30px;
        }
        
        .friend-item {
            display: flex;
            align-items: center;
            padding: 15px;
            margin: 10px 0;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 8px;
        }
        
        .friend-avatar {
            width: 50px;
            height: 50px;
            border-radius: 50%;
            margin-right: 15px;
            background: #1DB954;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
        }
        
        .friend-info {
            flex: 1;
        }
        
        .friend-name {
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .track-info {
            opacity: 0.8;
            font-size: 0.9em;
        }
        
        .activity-log {
            background: rgba(0, 0, 0, 0.3);
            padding: 20px;
            border-radius: 10px;
            max-height: 400px;
            overflow-y: auto;
        }
        
        .log-item {
            padding: 10px;
            margin: 5px 0;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 5px;
            font-size: 0.9em;
        }
        
        .log-timestamp {
            color: #1DB954;
            font-weight: bold;
        }
        
        .status {
            text-align: center;
            padding: 10px;
            margin: 10px 0;
            border-radius: 5px;
        }
        
        .status.online {
            background: rgba(29, 185, 84, 0.2);
        }
        
        .status.error {
            background: rgba(255, 0, 0, 0.2);
        }
        
        .refresh-btn {
            background: #1DB954;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 1em;
            margin: 10px 5px;
        }
        
        .refresh-btn:hover {
            background: #1ed760;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎵 Spotify Friend Activity Dashboard</h1>
            <p>Real-time monitoring of what your friends are listening to</p>
        </div>
        
        <div class="stats" id="stats">
            <div class="stat-card">
                <div class="stat-value" id="totalEntries">-</div>
                <div>Total Entries</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="uniqueFriends">-</div>
                <div>Unique Friends</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="activeFriends">-</div>
                <div>Currently Active</div>
            </div>
        </div>
        
        <div class="status" id="status">
            🔄 Loading...
        </div>
        
        <div class="current-activity">
            <h2>👥 Current Activity</h2>
            <button class="refresh-btn" onclick="refreshActivity()">🔄 Refresh</button>
            <button class="refresh-btn" onclick="toggleAutoRefresh()">⏸️ Auto Refresh: ON</button>
            <div id="currentActivity">
                Loading current activity...
            </div>
        </div>
        
        <div class="activity-log">
            <h2>📜 Recent Activity Log</h2>
            <button class="refresh-btn" onclick="refreshLog()">🔄 Refresh Log</button>
            <div id="activityLog">
                Loading activity log...
            </div>
        </div>
    </div>

    <script>
        let autoRefresh = true;
        let refreshInterval;

        async function fetchCurrentActivity() {
            try {
                const response = await fetch('/api/current-activity');
                const data = await response.json();
                displayCurrentActivity(data);
                updateStatus('online', '✅ Connected - Last updated: ' + new Date().toLocaleTimeString());
            } catch (error) {
                updateStatus('error', '❌ Error: ' + error.message);
            }
        }

        async function fetchActivityLog() {
            try {
                const response = await fetch('/api/activity-log');
                const data = await response.json();
                displayActivityLog(data);
            } catch (error) {
                console.error('Error fetching log:', error);
            }
        }

        async function fetchStats() {
            try {
                const response = await fetch('/api/stats');
                const data = await response.json();
                document.getElementById('totalEntries').textContent = data.totalEntries || 0;
                document.getElementById('uniqueFriends').textContent = data.uniqueFriends || 0;
            } catch (error) {
                console.error('Error fetching stats:', error);
            }
        }

        function displayCurrentActivity(data) {
            const container = document.getElementById('currentActivity');
            
            if (!data.friends || data.friends.length === 0) {
                container.innerHTML = '<p>📭 No friends are currently listening to music</p>';
                document.getElementById('activeFriends').textContent = '0';
                return;
            }

            document.getElementById('activeFriends').textContent = data.friends.length;

            const html = data.friends.map(friend => {
                const avatar = friend.user?.name ? friend.user.name.charAt(0).toUpperCase() : '?';
                const trackInfo = friend.track ? 
                    \`🎵 "\${friend.track.name}" by \${friend.track.artist?.name || 'Unknown'}\` :
                    '💤 Not currently listening';
                
                return \`
                    <div class="friend-item">
                        <div class="friend-avatar">\${avatar}</div>
                        <div class="friend-info">
                            <div class="friend-name">\${friend.user?.name || 'Unknown'}</div>
                            <div class="track-info">\${trackInfo}</div>
                            \${friend.track ? \`<div class="track-info">💿 \${friend.track.album?.name || 'Unknown Album'}</div>\` : ''}
                        </div>
                    </div>
                \`;
            }).join('');

            container.innerHTML = html;
        }

        function displayActivityLog(data) {
            const container = document.getElementById('activityLog');
            
            if (!data || data.length === 0) {
                container.innerHTML = '<p>📭 No activity logged yet</p>';
                return;
            }

            const html = data.slice(-20).reverse().map(entry => {
                const icon = entry.stopped ? '⏹️' : (entry.isNew ? '🆕' : '🔄');
                const action = entry.stopped ? 'stopped listening' : 
                               entry.isNew ? 'started listening to' : 'switched to';
                const trackInfo = entry.track ? 
                    \`"\${entry.track.name}" by \${entry.track.artist}\` : '';
                
                return \`
                    <div class="log-item">
                        <span class="log-timestamp">\${entry.timestamp}</span><br>
                        \${icon} <strong>\${entry.user}</strong> \${action} \${trackInfo}
                    </div>
                \`;
            }).join('');

            container.innerHTML = html;
        }

        function updateStatus(type, message) {
            const status = document.getElementById('status');
            status.className = \`status \${type}\`;
            status.textContent = message;
        }

        function refreshActivity() {
            fetchCurrentActivity();
        }

        function refreshLog() {
            fetchActivityLog();
            fetchStats();
        }

        function toggleAutoRefresh() {
            autoRefresh = !autoRefresh;
            const btn = event.target;
            
            if (autoRefresh) {
                btn.textContent = '⏸️ Auto Refresh: ON';
                startAutoRefresh();
            } else {
                btn.textContent = '▶️ Auto Refresh: OFF';
                clearInterval(refreshInterval);
            }
        }

        function startAutoRefresh() {
            refreshInterval = setInterval(() => {
                if (autoRefresh) {
                    fetchCurrentActivity();
                    fetchActivityLog();
                    fetchStats();
                }
            }, 30000); // Refresh every 30 seconds
        }

        // Initial load
        fetchCurrentActivity();
        fetchActivityLog();
        fetchStats();
        startAutoRefresh();
    </script>
</body>
</html>
    `;
  }

  async stop() {
    console.log('\n🛑 Stopping dashboard...');
    
    if (this.spotifyServer) {
      await this.spotifyServer.stop();
    }
    
    if (this.server) {
      this.server.close();
    }
    
    console.log('✅ Dashboard stopped');
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n📍 Received interrupt signal');
  if (global.dashboard) {
    await global.dashboard.stop();
  }
  process.exit(0);
});

async function main() {
  // Check for required environment variable
  const spDcCookie = process.env.SP_DC_COOKIE || 'AQBbWMvOJE6ogmn-_L67o1gWzCOSaJGuYrYCxiedBP5-60GtsxHxK7oI-V5w-DzFcR1sW5BcI9gxWV0rSUV2VNB6rhlqkPbD_BGjDM-APb49SFUeDP9sL1qLHlCvfciPUlrD2d7yLNyyYMcbyE6_sv34emaRyZf4';
  const port = parseInt(process.env.PORT) || 3000;
  
  if (!spDcCookie || spDcCookie === 'your_sp_dc_cookie_here') {
    console.error('❌ SP_DC_COOKIE environment variable is required!');
    console.log('Please set your Spotify sp_dc cookie in the environment variable SP_DC_COOKIE');
    console.log('Get it from: https://open.spotify.com/ → DevTools → Application → Cookies → sp_dc');
    process.exit(1);
  }
  
  global.dashboard = new SpotifyWebDashboard(spDcCookie, port);
  
  try {
    await global.dashboard.init();
  } catch (error) {
    console.error('❌ Failed to start dashboard:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = SpotifyWebDashboard;
