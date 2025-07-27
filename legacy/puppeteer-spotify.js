const puppeteer = require('puppeteer');

class SpotifyPuppeteerClient {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async init() {
    this.browser = await puppeteer.launch({
      headless: false, // Set to true to run headlessly
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
      
      // Wait a bit for the page to fully load
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log('Successfully set sp_dc cookie and loaded Spotify');
      return true;
    } catch (error) {
      console.error('Error setting up cookie:', error);
      return false;
    }
  }

  async getWebAccessToken() {
    try {
      console.log('Getting web access token...');
      
      // Execute the token request in the browser context
      const tokenData = await this.page.evaluate(async () => {
        try {
          // Import the actual TOTP generation logic
          // Since we can't import otplib in browser context, we'll use a simpler approach
          
          // First, try without TOTP to see if it works
          const params = new URLSearchParams({
            reason: 'transport',
            productType: 'web_player'
          });

          const response = await fetch(`https://open.spotify.com/get_access_token?${params.toString()}`, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Accept': 'application/json',
              'X-Requested-With': 'XMLHttpRequest'
            }
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to get access token: ${response.status} ${response.statusText} - ${errorText}`);
          }

          return await response.json();
        } catch (error) {
          throw new Error(`Browser execution error: ${error.message}`);
        }
      });

      console.log('Access token obtained successfully');
      return tokenData;
    } catch (error) {
      console.error('Error getting access token:', error);
      throw error;
    }
  }

  async getFriendActivity(accessToken) {
    try {
      console.log('Getting friend activity...');
      
      const friendData = await this.page.evaluate(async (token) => {
        try {
          const response = await fetch('https://guc-spclient.spotify.com/presence-view/v1/buddylist', {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json'
            }
          });

          if (!response.ok) {
            throw new Error(`Failed to get friend activity: ${response.status} ${response.statusText}`);
          }

          return await response.json();
        } catch (error) {
          throw new Error(`Browser execution error: ${error.message}`);
        }
      }, accessToken);

      console.log('Friend activity obtained successfully');
      return friendData;
    } catch (error) {
      console.error('Error getting friend activity:', error);
      throw error;
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Export functions similar to the original API
exports.getWebAccessToken = async function(spDcCookie) {
  const client = new SpotifyPuppeteerClient();
  try {
    await client.init();
    await client.loginWithCookie(spDcCookie);
    const tokenData = await client.getWebAccessToken();
    await client.close();
    return tokenData;
  } catch (error) {
    await client.close();
    throw error;
  }
};

exports.getFriendActivity = async function(accessToken) {
  const client = new SpotifyPuppeteerClient();
  try {
    await client.init();
    // For friend activity, we might not need to login again if we have a valid token
    const friendData = await client.getFriendActivity(accessToken);
    await client.close();
    return friendData;
  } catch (error) {
    await client.close();
    throw error;
  }
};

// Export the class for more advanced usage
exports.SpotifyPuppeteerClient = SpotifyPuppeteerClient;
