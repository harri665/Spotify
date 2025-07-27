const puppeteer = require('puppeteer');

class SpotifyBuddyListScraper {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async init() {
    this.browser = await puppeteer.launch({
      headless: false, // Keep visible to see what's happening
      defaultViewport: null,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });

    this.page = await this.browser.newPage();
    
    // Set a realistic user agent
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
  }

  async loginWithCookie(spDcCookie) {
    try {
      console.log('Setting up Spotify session...');
      
      // Navigate to Spotify first
      await this.page.goto('https://open.spotify.com/', { waitUntil: 'networkidle2' });
      
      // Set the sp_dc cookie
      await this.page.setCookie({
        name: 'sp_dc',
        value: spDcCookie,
        domain: '.spotify.com',
        path: '/',
        httpOnly: true,
        secure: true
      });

      // Refresh the page to apply the cookie
      await this.page.reload({ waitUntil: 'networkidle2' });
      
      // Wait for the page to load
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Check if we're logged in by looking for user elements
      try {
        await this.page.waitForSelector('[data-testid="user-widget-link"]', { timeout: 10000 });
        console.log('✓ Successfully logged in to Spotify');
        return true;
      } catch (error) {
        console.log('⚠ Could not confirm login status, but continuing...');
        return true;
      }
    } catch (error) {
      console.error('Error setting up Spotify session:', error);
      return false;
    }
  }

  async interceptNetworkRequests() {
    // Monitor network requests to see what the web player is doing
    await this.page.setRequestInterception(true);
    
    const interceptedData = {
      accessTokens: [],
      friendRequests: [],
      allRequests: []
    };

    this.page.on('request', request => {
      const url = request.url();
      const headers = request.headers();
      
      // Log all requests to Spotify APIs
      if (url.includes('spclient.spotify.com') || url.includes('api.spotify.com') || url.includes('open.spotify.com')) {
        interceptedData.allRequests.push({
          url,
          method: request.method(),
          headers: headers,
          timestamp: new Date().toISOString()
        });
        
        // Look for authorization headers
        if (headers.authorization) {
          interceptedData.accessTokens.push({
            token: headers.authorization,
            url,
            timestamp: new Date().toISOString()
          });
        }
        
        // Look for friend/buddy list requests
        if (url.includes('buddy') || url.includes('friend') || url.includes('presence') || url.includes('activity')) {
          interceptedData.friendRequests.push({
            url,
            method: request.method(),
            headers: headers,
            timestamp: new Date().toISOString()
          });
        }
      }
      
      request.continue();
    });

    this.page.on('response', async response => {
      const url = response.url();
      
      // Capture responses from friend/buddy endpoints
      if ((url.includes('buddy') || url.includes('friend') || url.includes('presence') || url.includes('activity')) && 
          response.status() === 200) {
        try {
          const data = await response.json();
          interceptedData.friendRequests.push({
            url,
            status: response.status(),
            data: data,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          // Response might not be JSON
        }
      }
    });

    return interceptedData;
  }

  async exploreSpotifyWebApp() {
    try {
      console.log('Starting network interception...');
      const interceptedData = await this.interceptNetworkRequests();
      
      console.log('Navigating to Spotify Web Player...');
      await this.page.goto('https://open.spotify.com/', { waitUntil: 'networkidle2' });
      
      // Wait for the app to load
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Try to trigger friend activity by navigating or interacting with the page
      console.log('Looking for friend activity in the web app...');
      
      // Check if there's a friend bar or activity section
      try {
        // Look for friend activity elements
        const friendElements = await this.page.$$('[data-testid*="friend"], [data-testid*="buddy"], [data-testid*="activity"]');
        console.log(`Found ${friendElements.length} potential friend activity elements`);
        
        // Try clicking on friend-related elements
        for (let element of friendElements.slice(0, 3)) {
          try {
            await element.click();
            await new Promise(resolve => setTimeout(resolve, 2000));
          } catch (error) {
            // Element might not be clickable
          }
        }
      } catch (error) {
        console.log('No obvious friend activity elements found');
      }
      
      // Try navigating to different sections that might trigger friend requests
      const sectionsToTry = [
        '/browse',
        '/search',
        '/collection/playlists',
        '/user'
      ];
      
      for (let section of sectionsToTry) {
        try {
          console.log(`Navigating to ${section}...`);
          await this.page.goto(`https://open.spotify.com${section}`, { waitUntil: 'networkidle2' });
          await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (error) {
          console.log(`Could not navigate to ${section}`);
        }
      }
      
      return interceptedData;
    } catch (error) {
      console.error('Error exploring Spotify web app:', error);
      throw error;
    }
  }

  async tryDirectAPI() {
    try {
      console.log('Trying direct API approaches...');
      
      // Try to execute various API calls in the browser context
      const results = await this.page.evaluate(async () => {
        const results = {
          attempts: [],
          errors: []
        };
        
        // List of endpoints to try
        const endpointsToTry = [
          'https://guc-spclient.spotify.com/presence-view/v1/buddylist',
          'https://spclient.wg.spotify.com/presence-view/v1/buddylist',
          'https://api.spotify.com/v1/me/player/currently-playing',
          'https://api.spotify.com/v1/me',
          'https://spclient.spotify.com/friendactivity/v0/feeder',
          'https://open.spotify.com/get_access_token?reason=transport&productType=web_player'
        ];
        
        for (let endpoint of endpointsToTry) {
          try {
            const response = await fetch(endpoint, {
              method: 'GET',
              credentials: 'include',
              headers: {
                'Accept': 'application/json'
              }
            });
            
            results.attempts.push({
              endpoint,
              status: response.status,
              statusText: response.statusText,
              success: response.ok
            });
            
          } catch (error) {
            results.errors.push({
              endpoint,
              error: error.message
            });
          }
        }
        
        return results;
      });
      
      return results;
    } catch (error) {
      console.error('Error trying direct API calls:', error);
      throw error;
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

async function main() {
  const spDcCookie = 'AQBbWMvOJE6ogmn-_L67o1gWzCOSaJGuYrYCxiedBP5-60GtsxHxK7oI-V5w-DzFcR1sW5BcI9gxWV0rSUV2VNB6rhlqkPbD_BGjDM-APb49SFUeDP9sL1qLHlCvfciPUlrD2d7yLNyyYMcbyE6_sv34emaRyZf4';
  
  const scraper = new SpotifyBuddyListScraper();
  
  try {
    await scraper.init();
    
    const loginSuccess = await scraper.loginWithCookie(spDcCookie);
    if (!loginSuccess) {
      console.log('Failed to login, but continuing anyway...');
    }
    
    // Try direct API calls
    console.log('\n=== Trying Direct API Calls ===');
    const apiResults = await scraper.tryDirectAPI();
    console.log('API Results:', JSON.stringify(apiResults, null, 2));
    
    // Explore the web app and intercept network requests
    console.log('\n=== Exploring Spotify Web App ===');
    const interceptedData = await scraper.exploreSpotifyWebApp();
    
    console.log('\n=== Results Summary ===');
    console.log(`Total requests intercepted: ${interceptedData.allRequests.length}`);
    console.log(`Access tokens found: ${interceptedData.accessTokens.length}`);
    console.log(`Friend-related requests: ${interceptedData.friendRequests.length}`);
    
    if (interceptedData.accessTokens.length > 0) {
      console.log('\nAccess tokens found:');
      interceptedData.accessTokens.forEach((token, i) => {
        console.log(`${i + 1}. ${token.token.substring(0, 50)}... (from ${token.url})`);
      });
    }
    
    if (interceptedData.friendRequests.length > 0) {
      console.log('\nFriend-related requests:');
      interceptedData.friendRequests.forEach((req, i) => {
        console.log(`${i + 1}. ${req.url} (${req.method || 'Response'}) - ${req.status || 'Request'}`);
        if (req.data) {
          console.log('   Data:', JSON.stringify(req.data, null, 2));
        }
      });
    }
    
    // Keep the browser open for manual inspection
    console.log('\n=== Browser left open for manual inspection ===');
    console.log('Check the Network tab in DevTools for more information');
    console.log('Press Ctrl+C to close when done');
    
    // Keep the process alive
    await new Promise(() => {});
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Don't close automatically - let user inspect
    // await scraper.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = SpotifyBuddyListScraper;
