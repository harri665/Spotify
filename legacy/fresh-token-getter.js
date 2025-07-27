const puppeteer = require('puppeteer');

async function getFreshTokenAndTest(spDcCookie) {
  console.log('🚀 Getting fresh Spotify access token...');
  
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  try {
    // Set the sp_dc cookie
    await page.setCookie({
      name: 'sp_dc',
      value: spDcCookie,
      domain: '.spotify.com',
      path: '/',
      httpOnly: true,
      secure: true
    });

    // Intercept network requests to capture the first authorization token
    await page.setRequestInterception(true);
    
    let foundToken = null;
    
    page.on('request', request => {
      const headers = request.headers();
      
      // Look for the first Bearer token
      if (!foundToken && headers.authorization && headers.authorization.startsWith('Bearer BQ')) {
        foundToken = headers.authorization.replace('Bearer ', '');
        console.log(`🎯 Found fresh token: ${foundToken.substring(0, 50)}...`);
      }
      
      request.continue();
    });

    // Navigate to Spotify to trigger API calls
    console.log('📱 Loading Spotify Web Player...');
    await page.goto('https://open.spotify.com/', { waitUntil: 'networkidle2' });
    
    // Wait for a token to be captured
    let attempts = 0;
    while (!foundToken && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
    
    if (!foundToken) {
      throw new Error('No access token found in network traffic');
    }
    
    console.log('🧪 Testing token with buddy list endpoint...');
    
    // Test the token immediately
    const result = await page.evaluate(async (token) => {
      try {
        const response = await fetch('https://guc-spclient.spotify.com/presence-view/v1/buddylist', {
          headers: {
            'Authorization': `Bearer ${token}`,
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
    }, foundToken);

    if (result.success) {
      console.log('\n🎉 SUCCESS! Fresh token works!');
      console.log(`\n🔑 Your fresh access token:`);
      console.log(foundToken);
      
      console.log('\n👥 Your friend activity:');
      if (result.data && result.data.friends) {
        result.data.friends.forEach((friend, i) => {
          console.log(`\n${i + 1}. ${friend.user?.name || 'Unknown'}`);
          if (friend.track) {
            console.log(`   🎵 "${friend.track.name}" by ${friend.track.artist?.name}`);
            console.log(`   💿 Album: "${friend.track.album?.name}"`);
            console.log(`   ⏰ Since: ${new Date(friend.timestamp).toLocaleString()}`);
          } else {
            console.log(`   💤 Not currently listening`);
          }
        });
      } else {
        console.log('📭 No friends currently listening or data format changed');
      }
      
      return { token: foundToken, data: result.data };
    } else {
      console.log(`❌ Token test failed: ${result.error}`);
      return null;
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    return null;
  } finally {
    await browser.close();
  }
}

async function main() {
  const spDcCookie = 'AQBbWMvOJE6ogmn-_L67o1gWzCOSaJGuYrYCxiedBP5-60GtsxHxK7oI-V5w-DzFcR1sW5BcI9gxWV0rSUV2VNB6rhlqkPbD_BGjDM-APb49SFUeDP9sL1qLHlCvfciPUlrD2d7yLNyyYMcbyE6_sv34emaRyZf4';
  
  const result = await getFreshTokenAndTest(spDcCookie);
  
  if (result) {
    console.log('\n✅ You can now use this token in your scripts!');
    console.log('💡 Note: Tokens typically expire after ~1 hour, so you may need to run this again later.');
  } else {
    console.log('\n❌ Failed to get working token. Please check your sp_dc cookie.');
  }
}

main();
