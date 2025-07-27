// Simple Spotify Buddy List Client
// Use this with your extracted access token

async function getBuddyList(accessToken) {
  const endpoints = [
    'https://guc-spclient.spotify.com/presence-view/v1/buddylist',
    'https://spclient.wg.spotify.com/presence-view/v1/buddylist'
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`Trying endpoint: ${endpoint}`);
      
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        }
      });

      console.log(`Response: ${response.status} ${response.statusText}`);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Success! Buddy list data:');
        console.log(JSON.stringify(data, null, 2));
        return data;
      } else {
        const errorText = await response.text();
        console.log(`❌ Error: ${errorText}`);
      }
    } catch (error) {
      console.log(`❌ Network error: ${error.message}`);
    }
  }

  throw new Error('All endpoints failed');
}

async function main() {
  // Working access token extracted from Spotify Web Player
  const accessToken = 'BQALuAghGA2vYJd5lRgS5vWSnQTl4ZmGzbCfwb-bZF_2J5olDx5WQ49P_eYuVQe4IXOQ9Xaxtb1hkQ3dP3doLa4jfKjDPjkQi1ziZfC9DGNvnv92yop5WIlG_kwuNy2401mcKedZZUv75YNdTpVK0aETDePCBc7OWZOYmpRyRKMCcBWMlsRABacraFLXzV73ULyiPUnO5Z7-aF-l_hULS2XafgcAepNC7GUKtyfP6kLlAdSglo0jNybGlJtSU4vNWrnSIeWAg-51LeISSg6TORcydODDORjVaG63Yjftua3JBOiYpUDvhh4mgrnTXaEKV-9x0KZxVaa1NiRbRtT5Ko8NQ-ZwzUbqIFA6z5Ji5o2O2akplnf7ofdWdmzOXPR_6YzA';
  
  console.log('✅ Using working access token extracted from Spotify Web Player\n');

  try {
    console.log('🎵 Fetching Spotify buddy list...');
    const buddyList = await getBuddyList(accessToken);
    
    // Process the data
    if (buddyList && buddyList.friends) {
      console.log(`\n👥 Found ${buddyList.friends.length} friends:`);
      buddyList.friends.forEach((friend, i) => {
        console.log(`\n${i + 1}. ${friend.user?.name || 'Unknown'}`);
        if (friend.track) {
          console.log(`   🎵 Listening to: "${friend.track.name}" by ${friend.track.artist?.name}`);
          console.log(`   💿 Album: "${friend.track.album?.name}"`);
          console.log(`   ⏰ Since: ${new Date(friend.timestamp).toLocaleString()}`);
        } else {
          console.log(`   💤 Not currently listening`);
        }
      });
    } else {
      console.log('📭 No friend activity found or unexpected data format');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n🔍 Troubleshooting:');
    console.log('1. Make sure your access token is fresh (not expired)');
    console.log('2. Check that you copied the entire token');
    console.log('3. Ensure your Spotify account has friends and they are active');
    console.log('4. Try getting a new token from the browser');
  }
}

main();
