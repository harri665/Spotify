const otplib = require('otplib')

// Clean the hex string by removing invalid characters
function cleanHex (hexStr) {
  const validChars = new Set('0123456789abcdefABCDEF')
  let cleaned = ''
  for (const char of hexStr) {
    if (validChars.has(char)) {
      cleaned += char
    }
  }
  if (cleaned.length % 2 !== 0) {
    cleaned = cleaned.slice(0, -1)
  }
  return cleaned
}

// Generate the TOTP for a specific server time
async function generateTotp (serverTimeSeconds) {
  const secretCipher = [12, 56, 76, 33, 88, 44, 88, 33, 78, 78, 11, 66, 22, 22, 55, 69, 54]
  const processed = secretCipher.map((byte, i) => byte ^ (i % 33 + 9))
  const processedStr = processed.join('')
  const utf8Bytes = Buffer.from(processedStr, 'utf-8')
  const hexStr = utf8Bytes.toString('hex')
  const cleanedHex = cleanHex(hexStr)
  const secretBytes = Buffer.from(cleanedHex, 'hex')

  // Encode to base32 using otplib
  const secretBase32 = otplib.authenticator.encode(secretBytes)

  // Set the time step to 30 seconds (default) and use the given server time in seconds
  const timeStep = 30 // Interval of 30 seconds for TOTP

  // Calculate the number of steps from the Unix epoch
  const epochTime = Math.floor(serverTimeSeconds / timeStep)

  // Generate the TOTP for the specific time step
  return otplib.authenticator.generate(secretBase32, { step: timeStep, time: epochTime })
}

exports.getWebAccessToken = async function getWebAccessToken (spDcCookie) {
  // First, try to get server time from an alternative endpoint or use current time
  let serverTimeSeconds;
  try {
    // Try to get server time from a different approach
    const resp = await fetch('https://open.spotify.com/', {
      headers: {
        'Cookie': `sp_dc=${spDcCookie}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      }
    });
    
    // Extract timestamp from headers or use current time
    const dateHeader = resp.headers.get('date');
    if (dateHeader) {
      serverTimeSeconds = Math.floor(new Date(dateHeader).getTime() / 1000);
    } else {
      serverTimeSeconds = Math.floor(Date.now() / 1000);
    }
  } catch (error) {
    console.log('Using local time as server time is unavailable');
    serverTimeSeconds = Math.floor(Date.now() / 1000);
  }

  // Generate TOTP using server time
  const totp = await generateTotp(serverTimeSeconds);
  const timestamp = Math.floor(Date.now() / 1000);

  const params = new URLSearchParams({
    reason: 'transport',
    productType: 'web_player',
    totp,
    totpVer: '5',
    ts: timestamp.toString()
  });

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Cookie': `sp_dc=${spDcCookie}`,
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://open.spotify.com/',
    'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="124", "Chromium";v="124"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'X-Requested-With': 'XMLHttpRequest'
  };

  const response = await fetch(`https://open.spotify.com/get_access_token?${params.toString()}`, {
    method: 'GET',
    headers
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to get access token:', response.status, response.statusText);
    console.error('Error details:', errorText);
    throw Object.assign(new Error(`Failed to get web access token: ${response.status} - ${response.statusText}`), {
      response
    });
  }

  return await response.json();
}

exports.getFriendActivity = async function getFriendActivity (webAccessToken) {
  // Looks like the app now uses `https://spclient.wg.spotify.com/presence-view/v1/buddylist`
  // but both endpoints appear to be identical in the kind of token they accept
  // and the response format.
  const res = await fetch('https://guc-spclient.spotify.com/presence-view/v1/buddylist', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Authorization: `Bearer ${webAccessToken}`
    }
  })

  if (!res.ok) {
    throw Object.assign(new Error(`Failed to get friend activity: ${res.status}`), {
      response: res
    })
  }

  return res.json()
}
