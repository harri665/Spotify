const puppeteer = require('puppeteer');

async function findSpotifyAccessToken(spDcCookie) {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  try {
    console.log('🚀 Starting automated token extraction...');
    
    // Set the sp_dc cookie
    await page.setCookie({
      name: 'sp_dc',
      value: spDcCookie,
      domain: '.spotify.com',
      path: '/',
      httpOnly: true,
      secure: true
    });

    // Intercept network requests to capture authorization headers
    await page.setRequestInterception(true);
    
    const foundTokens = new Set();
    
    page.on('request', request => {
      const headers = request.headers();
      const url = request.url();
      
      // Look for Authorization headers
      if (headers.authorization && headers.authorization.startsWith('Bearer ')) {
        foundTokens.add({
          token: headers.authorization.replace('Bearer ', ''),
          url: url,
          timestamp: new Date().toISOString()
        });
        console.log(`🎯 Found token in request to: ${url}`);
        console.log(`   Token: ${headers.authorization.substring(0, 50)}...`);
      }
      
      request.continue();
    });

    // Navigate to Spotify and try to trigger API calls
    console.log('📱 Loading Spotify Web Player...');
    await page.goto('https://open.spotify.com/', { waitUntil: 'networkidle2' });
    
    // Wait for the app to load
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('🎵 Navigating to different sections to trigger API calls...');
    
    // Try to trigger various API calls
    const sectionsToVisit = [
      'https://open.spotify.com/search',
      'https://open.spotify.com/browse',
      'https://open.spotify.com/collection/playlists'
    ];
    
    for (const section of sectionsToVisit) {
      try {
        console.log(`   Visiting: ${section}`);
        await page.goto(section, { waitUntil: 'networkidle2' });
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        if (foundTokens.size > 0) {
          console.log(`✅ Found ${foundTokens.size} token(s)! Stopping search.`);
          break;
        }
      } catch (error) {
        console.log(`   ⚠️ Could not visit ${section}: ${error.message}`);
      }
    }
    
    // If no tokens found yet, try manual actions
    if (foundTokens.size === 0) {
      console.log('🔍 No tokens found automatically. Trying manual interactions...');
      
      try {
        // Try searching for something
        const searchBox = await page.$('input[data-testid="search-input"]');
        if (searchBox) {
          await searchBox.click();
          await searchBox.type('test');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      } catch (error) {
        console.log('   Could not interact with search box');
      }
    }
    
    // Convert Set to Array for easier handling
    const tokens = Array.from(foundTokens);
    
    if (tokens.length > 0) {
      console.log(`\n🎉 SUCCESS! Found ${tokens.length} access token(s):\n`);
      
      tokens.forEach((tokenInfo, index) => {
        console.log(`Token ${index + 1}:`);
        console.log(`   Value: ${tokenInfo.token}`);
        console.log(`   From: ${tokenInfo.url}`);
        console.log(`   Time: ${tokenInfo.timestamp}`);
        console.log('');
      });
      
      // Test the first token
      console.log('🧪 Testing the first token with buddy list endpoint...');
      const testResult = await testTokenWithBuddyList(page, tokens[0].token);
      
      if (testResult.success) {
        console.log('✅ Token works! Here\'s your friend activity:');
        console.log(JSON.stringify(testResult.data, null, 2));
      } else {
        console.log(`❌ Token test failed: ${testResult.error}`);
      }
      
    } else {
      console.log('\n❌ No access tokens found in network traffic');
      console.log('📋 Manual steps to find your token:');
      console.log('1. The browser should still be open');
      console.log('2. Open DevTools (F12)');
      console.log('3. Go to Network tab');
      console.log('4. Clear the network log');
      console.log('5. Navigate around Spotify (search, browse, etc.)');
      console.log('6. Look for requests with Authorization headers starting with "Bearer BQ"');
      console.log('\nPress Ctrl+C when done');
      
      // Keep browser open for manual inspection
      await new Promise(() => {});
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  // Don't auto-close to allow manual inspection
}

async function testTokenWithBuddyList(page, token) {
  try {
    const result = await page.evaluate(async (accessToken) => {
      try {
        const response = await fetch('https://guc-spclient.spotify.com/presence-view/v1/buddylist', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          },
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          return { success: true, data: data };
        } else {
          const errorText = await response.text();
          return { success: false, error: `${response.status} ${response.statusText}: ${errorText}` };
        }
      } catch (error) {
        return { success: false, error: error.message };
      }
    }, token);

    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function main() {
  const spDcCookie = 'AQBbWMvOJE6ogmn-_L67o1gWzCOSaJGuYrYCxiedBP5-60GtsxHxK7oI-V5w-DzFcR1sW5BcI9gxWV0rSUV2VNB6rhlqkPbD_BGjDM-APb49SFUeDP9sL1qLHlCvfciPUlrD2d7yLNyyYMcbyE6_sv34emaRyZf4';
  await findSpotifyAccessToken(spDcCookie);
}

main();
