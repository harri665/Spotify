const puppeteerSpotify = require('./puppeteer-spotify');

async function main() {
  const spDcCookie = 'AQBbWMvOJE6ogmn-_L67o1gWzCOSaJGuYrYCxiedBP5-60GtsxHxK7oI-V5w-DzFcR1sW5BcI9gxWV0rSUV2VNB6rhlqkPbD_BGjDM-APb49SFUeDP9sL1qLHlCvfciPUlrD2d7yLNyyYMcbyE6_sv34emaRyZf4';

  try {
    console.log('Starting Puppeteer-based Spotify access...');
    
    // Get access token using Puppeteer
    console.log('Getting access token...');
    const accessTokenInfo = await puppeteerSpotify.getWebAccessToken(spDcCookie);
    
    console.log('Access token:', JSON.stringify(accessTokenInfo, null, 2));
    
    // Get friend activity
    console.log('Getting friend activity...');
    const friendActivity = await puppeteerSpotify.getFriendActivity(accessTokenInfo.accessToken);
    
    console.log('Friend Activity:', JSON.stringify(friendActivity, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

main();
