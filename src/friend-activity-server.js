const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

class SpotifyFriendActivityServer {
  constructor(spDcCookie, options = {}) {
    this.spDcCookie = spDcCookie || process.env.SP_DC_COOKIE;
    this.currentToken = null;
    this.tokenExpiry = null;
    this.browser = null;
    this.page = null;
    this.intervalId = null;
    this.lastActivity = {};
    
    // Use logs directory for Docker volume mounting
    const logsDir = path.join(__dirname, 'logs');
    this.logFile = path.join(logsDir, 'friend-activity-log.json');
    
    // Check interval in milliseconds (default: 3 minutes = 180000ms)
    this.checkInterval = parseInt(process.env.CHECK_INTERVAL) || options.checkInterval || (3 * 60 * 1000);
    
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
    console.log('🚀 Starting Spotify Friend Activity Server...');
    await this.setupBrowser();
    await this.loadPreviousActivity();
    await this.refreshToken();
    this.startMonitoring();
  }

  async setupBrowser() {
    console.log('🌐 Setting up browser...');
    this.browser = await puppeteer.launch({
      headless: true, // Run in background
      defaultViewport: null,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-gpu',
        '--disable-extensions',
        '--no-first-run',
        '--disable-default-apps',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ],
      // Use system Chromium in Docker
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    });

    this.page = await this.browser.newPage();
    
    // Set cookie
    await this.page.setCookie({
      name: 'sp_dc',
      value: this.spDcCookie,
      domain: '.spotify.com',
      path: '/',
      httpOnly: true,
      secure: true
    });

    console.log('✅ Browser setup complete');
  }

  async refreshToken() {
    try {
      console.log('🔄 Refreshing access token...');
      
      // Create a fresh page for token extraction
      const tokenPage = await this.browser.newPage();
      await tokenPage.setCookie({
        name: 'sp_dc',
        value: this.spDcCookie,
        domain: '.spotify.com',
        path: '/',
        httpOnly: true,
        secure: true
      });
      
      // Set up request interception on the token page
      await tokenPage.setRequestInterception(true);
      
      let foundToken = null;
      const tokenListener = (request) => {
        const headers = request.headers();
        if (!foundToken && headers.authorization && headers.authorization.startsWith('Bearer BQ')) {
          foundToken = headers.authorization.replace('Bearer ', '');
          console.log(`🎯 Fresh token captured: ${foundToken.substring(0, 50)}...`);
        }
        request.continue();
      };

      tokenPage.on('request', tokenListener);

      // Navigate to Spotify to trigger token generation
      await tokenPage.goto('https://open.spotify.com/', { waitUntil: 'networkidle2' });
      
      // Wait for token to be captured
      let attempts = 0;
      while (!foundToken && attempts < 15) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }

      // Clean up the token page
      await tokenPage.close();

      if (foundToken) {
        this.currentToken = foundToken;
        this.tokenExpiry = Date.now() + (50 * 60 * 1000); // Assume 50-minute expiry
        console.log('✅ Token refreshed successfully');
        return true;
      } else {
        throw new Error('No token found in network traffic');
      }
    } catch (error) {
      console.error('❌ Failed to refresh token:', error.message);
      return false;
    }
  }

  async fetchFriendActivity() {
    if (!this.currentToken || Date.now() > this.tokenExpiry) {
      console.log('🔄 Token expired, refreshing...');
      const success = await this.refreshToken();
      if (!success) {
        console.error('❌ Could not refresh token, skipping this check');
        return null;
      }
    }

    try {
      // Use a simple HTTP request instead of page evaluation
      const response = await fetch('https://guc-spclient.spotify.com/presence-view/v1/buddylist', {
        headers: {
          'Authorization': `Bearer ${this.currentToken}`,
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        }
      });

      if (response.ok) {
        return await response.json();
      } else {
        console.error('❌ API call failed:', response.status, response.statusText);
        // If it's an auth error, try refreshing token
        if (response.status === 401 || response.status === 403) {
          console.log('🔄 Auth error, refreshing token...');
          await this.refreshToken();
        }
        return null;
      }
    } catch (error) {
      console.error('❌ Error fetching friend activity:', error.message);
      return null;
    }
  }

  async processActivity(activity) {
    if (!activity || !activity.friends) {
      console.log('📭 No friend activity data');
      return;
    }

    const timestamp = new Date().toLocaleString();
    const changes = [];

    console.log(`\n🎵 Friend Activity Check - ${timestamp}`);
    console.log(`👥 Found ${activity.friends.length} active friends:`);

    activity.friends.forEach((friend, i) => {
      const userId = friend.user?.uri || friend.user?.name || `unknown_${i}`;
      const userName = friend.user?.name || 'Unknown';
      
      if (friend.track) {
        const currentTrack = {
          name: friend.track.name,
          artist: friend.track.artist?.name,
          album: friend.track.album?.name,
          timestamp: friend.timestamp
        };

        const lastTrack = this.lastActivity[userId];
        
        // Check if this is a new track
        if (!lastTrack || 
            lastTrack.name !== currentTrack.name || 
            lastTrack.artist !== currentTrack.artist ||
            Math.abs(currentTrack.timestamp - lastTrack.timestamp) > 60000) { // More than 1 minute difference
          
          const change = {
            user: userName,
            track: currentTrack,
            timestamp: timestamp,
            isNew: !lastTrack
          };
          
          changes.push(change);
          
          console.log(`\n${i + 1}. ${userName} ${change.isNew ? '🆕' : '🔄'}`);
          console.log(`   🎵 "${currentTrack.name}" by ${currentTrack.artist}`);
          console.log(`   💿 Album: "${currentTrack.album}"`);
          console.log(`   ⏰ Started: ${new Date(currentTrack.timestamp).toLocaleString()}`);
        } else {
          console.log(`\n${i + 1}. ${userName} (continuing)`);
          console.log(`   🎵 "${currentTrack.name}" by ${currentTrack.artist}`);
        }

        this.lastActivity[userId] = currentTrack;
      } else {
        console.log(`\n${i + 1}. ${userName}`);
        console.log(`   💤 Not currently listening`);
        
        // Remove from last activity if they stopped listening
        if (this.lastActivity[userId]) {
          delete this.lastActivity[userId];
          changes.push({
            user: userName,
            stopped: true,
            timestamp: timestamp
          });
        }
      }
    });

    // Log changes to file
    if (changes.length > 0) {
      await this.logActivity(changes);
      console.log(`\n📝 Logged ${changes.length} changes to ${this.logFile}`);
    }

    console.log('\n' + '='.repeat(60));
  }

  async logActivity(changes) {
    try {
      let existingLog = [];
      
      try {
        const data = await fs.readFile(this.logFile, 'utf8');
        existingLog = JSON.parse(data);
      } catch (error) {
        // File doesn't exist yet, start with empty array
      }

      existingLog.push(...changes);
      
      // Keep only last 1000 entries to prevent file from getting too large
      if (existingLog.length > 1000) {
        existingLog = existingLog.slice(-1000);
      }

      await fs.writeFile(this.logFile, JSON.stringify(existingLog, null, 2));
    } catch (error) {
      console.error('❌ Error logging activity:', error.message);
    }
  }

  async loadPreviousActivity() {
    try {
      const data = await fs.readFile(this.logFile, 'utf8');
      const log = JSON.parse(data);
      
      // Rebuild last activity from recent log entries
      log.slice(-50).forEach(entry => {
        if (entry.track && !entry.stopped) {
          // We don't have user URI in log, so use name as key (not ideal but workable)
          this.lastActivity[entry.user] = entry.track;
        }
      });
      
      console.log(`📖 Loaded previous activity state from ${this.logFile}`);
    } catch (error) {
      console.log('📝 No previous activity log found, starting fresh');
    }
  }

  startMonitoring() {
    console.log(`\n🎯 Starting monitoring (checking every ${this.checkInterval / 1000 / 60} minutes)...`);
    
    // Do initial check
    this.checkActivity();
    
    // Set up interval
    this.intervalId = setInterval(() => {
      this.checkActivity();
    }, this.checkInterval);

    console.log('✅ Server is running! Press Ctrl+C to stop.');
  }

  async checkActivity() {
    try {
      const activity = await this.fetchFriendActivity();
      await this.processActivity(activity);
    } catch (error) {
      console.error('❌ Error during activity check:', error.message);
    }
  }

  async stop() {
    console.log('\n🛑 Stopping server...');
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    
    if (this.browser) {
      await this.browser.close();
    }
    
    console.log('✅ Server stopped');
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n📍 Received interrupt signal');
  if (global.server) {
    await global.server.stop();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n📍 Received terminate signal');
  if (global.server) {
    await global.server.stop();
  }
  process.exit(0);
});

async function main() {
  // Check for required environment variable
  const spDcCookie = process.env.SP_DC_COOKIE || 'AQBbWMvOJE6ogmn-_L67o1gWzCOSaJGuYrYCxiedBP5-60GtsxHxK7oI-V5w-DzFcR1sW5BcI9gxWV0rSUV2VNB6rhlqkPbD_BGjDM-APb49SFUeDP9sL1qLHlCvfciPUlrD2d7yLNyyYMcbyE6_sv34emaRyZf4';
  
  if (!spDcCookie || spDcCookie === 'your_sp_dc_cookie_here') {
    console.error('❌ SP_DC_COOKIE environment variable is required!');
    console.log('Please set your Spotify sp_dc cookie in the environment variable SP_DC_COOKIE');
    console.log('Get it from: https://open.spotify.com/ → DevTools → Application → Cookies → sp_dc');
    process.exit(1);
  }
  
  global.server = new SpotifyFriendActivityServer(spDcCookie);
  
  try {
    await global.server.init();
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = SpotifyFriendActivityServer;
