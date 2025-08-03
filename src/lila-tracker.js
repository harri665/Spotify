// Spotify Activity Tracker - Enhanced Friend Activity Monitor
const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class SpotifyTracker {
    constructor() {
        this.targetUser = 'spotify_user';
        this.currentToken = null;
        this.tokenExpiry = 0;
        this.browser = null;
        this.page = null;
        this.spDcCookie = null; // Will be extracted automatically
        this.lastActivity = null;
        this.checkInterval = parseInt(process.env.CHECK_INTERVAL) || 30000; // 30 seconds default
    }

    async init() {
        console.log(`🎯 Initializing ${this.targetUser} tracker...`);
        
        // Configure Puppeteer for Docker environment
        const puppeteerConfig = {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-dev-shm-usage',
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-gpu'
            ]
        };

        // Use system Chromium in Docker/production
        if (process.env.NODE_ENV === 'production' && process.env.PUPPETEER_EXECUTABLE_PATH) {
            puppeteerConfig.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
            console.log('🐳 Using system Chromium for Docker environment');
        }

        this.browser = await puppeteer.launch(puppeteerConfig);

        this.page = await this.browser.newPage();
        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
        
        console.log('✅ Browser initialized');
    }

    async extractSpotifyCookie() {
        console.log('🔄 Attempting to extract Spotify session cookie...');
        
        try {
            // Check if manually provided first
            if (process.env.SP_DC_COOKIE) {
                this.spDcCookie = process.env.SP_DC_COOKIE;
                console.log('✅ Using provided SP_DC_COOKIE from environment');
                return true;
            }

            // Create a page for cookie extraction
            const cookiePage = await this.browser.newPage();
            await cookiePage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
            
            // Navigate to Spotify
            console.log('🌐 Navigating to Spotify web player...');
            await cookiePage.goto('https://open.spotify.com/', { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });

            // Wait a moment for the page to load
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Extract cookies
            const cookies = await cookiePage.cookies();
            const spDcCookie = cookies.find(cookie => cookie.name === 'sp_dc');

            if (spDcCookie && spDcCookie.value && spDcCookie.value.length > 50) {
                this.spDcCookie = spDcCookie.value;
                console.log('✅ Successfully extracted sp_dc cookie automatically');
                await cookiePage.close();
                return true;
            } else {
                console.log('❌ No valid sp_dc cookie found');
                console.log('ℹ️  This usually means you need to log in to Spotify first');
                console.log('ℹ️  Please visit https://open.spotify.com and log in');
                console.log('ℹ️  Or set SP_DC_COOKIE environment variable manually');
                await cookiePage.close();
                return false;
            }
        } catch (error) {
            console.error('❌ Error extracting cookie:', error.message);
            return false;
        }
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

    async trackUser() {
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
                const userActivity = data.friends?.find(friend => friend.user.name === this.targetUser);

                if (userActivity) {
                    return this.processUserActivity(userActivity);
                } else {
                    console.log(`😴 ${this.targetUser} is not currently listening to music`);
                    return null;
                }
            } else {
                console.error('❌ API call failed:', response.status, response.statusText);
                return null;
            }
        } catch (error) {
            console.error('❌ Error tracking user:', error.message);
            return null;
        }
    }

    processUserActivity(activity) {
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
            // Use shared directory in Docker, current directory otherwise
            const logDir = process.env.NODE_ENV === 'production' ? '/app/shared' : '.';
            const filename = `${logDir}/spotify-activity-log.json`;
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
    const tracker = new SpotifyTracker();
    
    try {
        await tracker.init();
        
        // Automatically extract Spotify cookie
        const cookieSuccess = await tracker.extractSpotifyCookie();
        if (!cookieSuccess) {
            console.log('⏸️  Cannot proceed without valid Spotify session cookie');
            if (process.env.NODE_ENV === 'production') {
                console.log('⏸️  Container will sleep to avoid restart loop');
                // Sleep indefinitely to prevent restart loop
                while (true) {
                    await new Promise(resolve => setTimeout(resolve, 60000));
                    console.log('⏸️  Still waiting for valid Spotify session...');
                }
            } else {
                console.log('💡 For development: Set SP_DC_COOKIE environment variable');
                await tracker.cleanup();
                return;
            }
        }
        
        console.log(`🎯 Starting ${tracker.targetUser} activity tracker...`);
        console.log(`🔄 Checking every ${tracker.checkInterval / 1000} seconds for new songs...`);
        console.log(`🔑 Using cookie: ${tracker.spDcCookie.substring(0, 20)}...`);
        console.log('');
        
        // Initial check
        await tracker.trackUser();
        
        // Set up periodic checking using configured interval
        const interval = setInterval(async () => {
            await tracker.trackUser();
        }, tracker.checkInterval);
        
        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            console.log('\n🛑 Shutting down tracker...');
            clearInterval(interval);
            await tracker.cleanup();
            process.exit(0);
        });
        
        process.on('SIGTERM', async () => {
            console.log('\n🛑 Received SIGTERM, shutting down tracker...');
            clearInterval(interval);
            await tracker.cleanup();
            process.exit(0);
        });
        
        console.log('✅ Tracker running! Use SIGINT or SIGTERM to stop.');
        
    } catch (error) {
        console.error('❌ Error starting tracker:', error.message);
        await tracker.cleanup();
        process.exit(1);
    }
}

main();
