// Simple command-line version of the Spotify Friend Activity Server
const SpotifyFriendActivityServer = require('./friend-activity-server');

async function main() {
  const spDcCookie = 'AQBbWMvOJE6ogmn-_L67o1gWzCOSaJGuYrYCxiedBP5-60GtsxHxK7oI-V5w-DzFcR1sW5BcI9gxWV0rSUV2VNB6rhlqkPbD_BGjDM-APb49SFUeDP9sL1qLHlCvfciPUlrD2d7yLNyyYMcbyE6_sv34emaRyZf4';
  
  console.log('🎵 Starting Spotify Friend Activity Monitor (CLI Version)');
  console.log('⏱️  Checking every 3 minutes for friend activity changes');
  console.log('📝 Activity log will be saved to friend-activity-log.json');
  console.log('🛑 Press Ctrl+C to stop\n');
  
  const server = new SpotifyFriendActivityServer(spDcCookie);
  global.server = server;
  
  try {
    await server.init();
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    console.log('\n🔍 Troubleshooting tips:');
    console.log('1. Make sure your sp_dc cookie is valid and fresh');
    console.log('2. Check your internet connection');
    console.log('3. Try running fresh-token-getter.js to verify your setup');
    process.exit(1);
  }
}

main();
