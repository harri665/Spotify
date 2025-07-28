// 444lila Specific Tracker - Enhanced Friend Activity Monitor
const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class LilaTracker {
    constructor() {
        this.targetUser = '444lila';
        this.currentToken = null;
        this.tokenExpiry = 0;
        this.browser = null;
        this.page = null;
        // Use environment variable or fallback to hardcoded cookie
        this.spDcCookie = process.env.SP_DC_COOKIE || 'AQBbWMvOJE6ogmn-_L67o1gWzCOSaJGuYrYCxiedBP5-60GtsxHxK7oI-V5w-DzFcR1sW5BcI9gxWV0rSUV2VNB6rhlqkPbD_BGjDM-APb49SFUeDP9sL1qLHlCvfciPUlrD2d7yLNyyYMcbyE6_sv34emaRyZf4';
        this.lastActivity = null;
        this.checkInterval = parseInt(process.env.CHECK_INTERVAL) || 30000; // 30 seconds default
    }

    async init() {
        console.log(`🎯 Initializing ${this.targetUser} tracker...`);
        
        this.browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
            ]
        });

        this.page = await this.browser.newPage();
        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
        
        console.log('✅ Browser initialized');
    }

    async getToken() {
        try {
            console.log('🔄 Getting fresh token...');
            
            // Create a fresh page for token extraction
            const tokenPage = await this.browser.newPage();
            await tokenPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
            
            // Set up request interception to capture tokens
            await tokenPage.setRequestInterception(true);
            
            let capturedToken = null;
            
            tokenPage.on('request', (request) => {
                const authHeader = request.headers()['authorization'];
                if (authHeader && authHeader.startsWith('Bearer ') && authHeader.length > 100) {
                    capturedToken = authHeader.substring(7);
                    console.log('🎯 Fresh token captured:', capturedToken.substring(0, 50) + '...');
                }
                request.continue();
            });

            // Set cookie and navigate to Spotify
            await tokenPage.setCookie({
                name: 'sp_dc',
                value: this.spDcCookie,
                domain: '.spotify.com'
            });

            await tokenPage.goto('https://open.spotify.com/', { waitUntil: 'networkidle2' });
            
            // Wait 3 seconds for requests to process
            await new Promise(resolve => setTimeout(resolve, 3000));

            if (capturedToken) {
                this.currentToken = capturedToken;
                this.tokenExpiry = Date.now() + (55 * 60 * 1000); // 55 minutes
                console.log('✅ Token captured successfully');
                await tokenPage.close();
                return true;
            } else {
                console.log('❌ No token captured');
                await tokenPage.close();
                return false;
            }
        } catch (error) {
            console.error('❌ Token extraction error:', error.message);
            return false;
        }
    }

    async trackLila() {
        if (!this.currentToken || Date.now() > this.tokenExpiry) {
            const success = await this.getToken();
            if (!success) {
                console.error('❌ Could not get token');
                return null;
            }
        }

        try {
            const response = await fetch('https://guc-spclient.spotify.com/presence-view/v1/buddylist', {
                headers: {
                    'Authorization': `Bearer ${this.currentToken}`,
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
                }
            });

            if (response.ok) {
                const data = await response.json();
                const lilaActivity = data.friends?.find(friend => friend.user.name === this.targetUser);
                
                if (lilaActivity) {
                    return this.processLilaActivity(lilaActivity);
                } else {
                    console.log(`😴 ${this.targetUser} is not currently listening to music`);
                    return null;
                }
            } else {
                console.error('❌ API call failed:', response.status, response.statusText);
                return null;
            }
        } catch (error) {
            console.error('❌ Error tracking Lila:', error.message);
            return null;
        }
    }

    processLilaActivity(activity) {
        const track = activity.track;
        const timestamp = new Date(activity.timestamp);
        
        const currentActivity = {
            user: this.targetUser,
            song: track.name,
            artist: track.artist.name,
            album: track.album.name,
            timestamp: timestamp.toLocaleString(),
            imageUrl: track.imageUrl
        };

        // Check if this is a new song
        const isNewSong = !this.lastActivity || 
                         this.lastActivity.song !== currentActivity.song ||
                         this.lastActivity.artist !== currentActivity.artist;

        if (isNewSong) {
            console.log(`\n🎵 ${this.targetUser} is now listening to:`);
            console.log(`   🎶 "${currentActivity.song}" by ${currentActivity.artist}`);
            console.log(`   💿 Album: "${currentActivity.album}"`);
            console.log(`   ⏰ Started: ${currentActivity.timestamp}`);
            console.log(`   🖼️  Cover: ${currentActivity.imageUrl}\n`);
            
            this.lastActivity = currentActivity;
            this.saveActivity(currentActivity);
        } else {
            console.log(`🎵 ${this.targetUser} is still listening to "${currentActivity.song}"`);
        }

        return currentActivity;
    }

    async saveActivity(activity) {
        try {
            const filename = `lila-activity-log.json`;
            let log = [];
            
            try {
                const existingData = await fs.readFile(filename, 'utf8');
                log = JSON.parse(existingData);
            } catch (error) {
                // File doesn't exist, start fresh
            }
            
            // Add Spotify URL for the track
            const spotifyUrl = `https://open.spotify.com/search/${encodeURIComponent(activity.song + ' ' + activity.artist)}`;
            
            log.push({
                ...activity,
                spotifyUrl: spotifyUrl,
                loggedAt: new Date().toISOString()
            });
            
            await fs.writeFile(filename, JSON.stringify(log, null, 2));
            console.log(`📝 Activity logged to ${filename}`);
        } catch (error) {
            console.error('❌ Error saving activity:', error.message);
        }
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
            console.log('🧹 Browser closed');
        }
    }
}

async function main() {
    // Check if SP_DC_COOKIE is provided
    if (!process.env.SP_DC_COOKIE && process.env.NODE_ENV === 'production') {
        console.error('❌ SP_DC_COOKIE environment variable is required in production');
        console.log('ℹ️  Get your cookie from https://open.spotify.com → DevTools → Cookies → sp_dc');
        process.exit(1);
    }

    const tracker = new LilaTracker();
    
    try {
        await tracker.init();
        
        console.log(`🎯 Starting ${tracker.targetUser} activity tracker...`);
        console.log(`🔄 Checking every ${tracker.checkInterval / 1000} seconds for new songs...\n`);
        
        // Initial check
        await tracker.trackLila();
        
        // Set up periodic checking using configured interval
        const interval = setInterval(async () => {
            await tracker.trackLila();
        }, tracker.checkInterval);
        
        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            console.log('\n🛑 Shutting down tracker...');
            clearInterval(interval);
            await tracker.cleanup();
            process.exit(0);
        });
        
        console.log('✅ Tracker running! Press Ctrl+C to stop.');
        
    } catch (error) {
        console.error('❌ Error starting tracker:', error.message);
        await tracker.cleanup();
    }
}

main();
