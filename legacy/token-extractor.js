const puppeteer = require('puppeteer');

async function getSpotifyTokenFromWebApp(spDcCookie) {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  try {
    console.log('Setting up Spotify session...');
    
    // Set the cookie first
    await page.setCookie({
      name: 'sp_dc',
      value: spDcCookie,
      domain: '.spotify.com',
      path: '/',
      httpOnly: true,
      secure: true
    });

    // Navigate to Spotify Web Player
    await page.goto('https://open.spotify.com/', { waitUntil: 'networkidle2' });
    
    console.log('Extracting access token from the web app...');
    
    // Try to extract access token from various sources in the web app
    const tokenInfo = await page.evaluate(async () => {
      const results = {
        fromLocalStorage: null,
        fromSessionStorage: null,
        fromWindow: null,
        fromWebApi: null,
        error: null
      };

      try {
        // Check localStorage
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          const value = localStorage.getItem(key);
          if (value && (value.includes('Bearer') || value.includes('access_token') || key.includes('token'))) {
            results.fromLocalStorage = { key, value };
            break;
          }
        }

        // Check sessionStorage
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          const value = sessionStorage.getItem(key);
          if (value && (value.includes('Bearer') || value.includes('access_token') || key.includes('token'))) {
            results.fromSessionStorage = { key, value };
            break;
          }
        }

        // Check window object for Spotify-related objects
        if (window.Spotify) {
          results.fromWindow = 'Spotify object found';
        }

        // Try to make a web API call to see if we can get a token from the response
        try {
          const response = await fetch('/api/token', {
            credentials: 'include'
          });
          if (response.ok) {
            const data = await response.json();
            results.fromWebApi = data;
          }
        } catch (e) {
          // Endpoint might not exist
        }

      } catch (error) {
        results.error = error.message;
      }

      return results;
    });

    console.log('Token extraction results:', JSON.stringify(tokenInfo, null, 2));

    // Also try to intercept network requests that might contain tokens
    console.log('Monitoring network traffic...');
    
    const tokens = [];
    
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('spclient') || url.includes('api.spotify') || url.includes('token')) {
        try {
          const headers = response.headers();
          if (headers.authorization) {
            tokens.push({
              url,
              authorization: headers.authorization,
              timestamp: new Date().toISOString()
            });
          }
        } catch (error) {
          // Some responses might not be accessible
        }
      }
    });

    // Trigger some activity to generate network requests
    console.log('Triggering network activity...');
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Try to navigate to different sections to trigger API calls
    try {
      await page.goto('https://open.spotify.com/search', { waitUntil: 'networkidle2' });
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
      console.log('Could not navigate to search');
    }

    console.log(`Captured ${tokens.length} potential tokens from network traffic`);
    
    if (tokens.length > 0) {
      console.log('Network tokens found:');
      tokens.forEach((token, i) => {
        console.log(`${i + 1}. ${token.authorization.substring(0, 50)}... from ${token.url}`);
      });

      // Try using the first token to access buddy list
      if (tokens[0]) {
        console.log('Testing buddy list access with captured token...');
        const buddyListResult = await page.evaluate(async (authHeader) => {
          try {
            const response = await fetch('https://guc-spclient.spotify.com/presence-view/v1/buddylist', {
              headers: {
                'Authorization': authHeader,
                'Accept': 'application/json'
              },
              credentials: 'include'
            });

            return {
              status: response.status,
              statusText: response.statusText,
              data: response.ok ? await response.json() : await response.text()
            };
          } catch (error) {
            return { error: error.message };
          }
        }, tokens[0].authorization);

        console.log('Buddy list result:', JSON.stringify(buddyListResult, null, 2));
      }
    }

    console.log('\n=== Manual Inspection ===');
    console.log('Browser left open for manual inspection');
    console.log('1. Open DevTools (F12)');
    console.log('2. Go to Network tab');
    console.log('3. Look for requests to spclient.spotify.com or api.spotify.com');
    console.log('4. Check request headers for Authorization tokens');
    console.log('\nPress Ctrl+C when done');

    // Keep browser open for manual inspection
    await new Promise(() => {});

  } catch (error) {
    console.error('Error:', error);
  }
  // Don't close browser automatically
}

async function main() {
  const spDcCookie = 'AQBbWMvOJE6ogmn-_L67o1gWzCOSaJGuYrYCxiedBP5-60GtsxHxK7oI-V5w-DzFcR1sW5BcI9gxWV0rSUV2VNB6rhlqkPbD_BGjDM-APb49SFUeDP9sL1qLHlCvfciPUlrD2d7yLNyyYMcbyE6_sv34emaRyZf4';
  await getSpotifyTokenFromWebApp(spDcCookie);
}

main();
