# Manual Token Guide

This guide explains how to manually obtain and use Spotify tokens for the 444lila tracker.

## Overview

The tracker uses Spotify's internal web API, which requires a different type of authentication than the official Spotify API. Instead of OAuth tokens, it uses:

1. **sp_dc Cookie**: Long-lived session cookie (valid ~1 year)
2. **Bearer Tokens**: Short-lived access tokens (~1 hour)

## Getting Your sp_dc Cookie

### Method 1: Browser Developer Tools

1. **Open Spotify Web Player:**
   - Go to [https://open.spotify.com/](https://open.spotify.com/)
   - Log in with your Spotify account

2. **Open Developer Tools:**
   - Press `F12` (or right-click → Inspect)
   - Go to the **Application** tab
   - Navigate to **Storage** → **Cookies** → `https://open.spotify.com`

3. **Find the sp_dc Cookie:**
   - Look for a cookie named `sp_dc`
   - Copy the entire **Value** (it's a long string)

4. **Save the Cookie:**
   - Store it securely (this is your authentication key)
   - It typically looks like: `AQBbWMvOJE6ogmn-_L67o1gW...` (much longer)

### Method 2: Browser Network Tab

1. **Open Network Tab:**
   - Open Developer Tools (`F12`)
   - Go to **Network** tab
   - Refresh the Spotify page

2. **Find a Request:**
   - Look for any request to `spclient.spotify.com`
   - Click on the request
   - Go to **Request Headers**
   - Find the `Cookie` header
   - Extract the `sp_dc=` value

## Using the Cookie

### In Environment Variables

```bash
export SP_DC_COOKIE="your_long_cookie_value_here"
npm start
```

### In .env File

Create a `.env` file in the project root:
```
SP_DC_COOKIE=your_long_cookie_value_here
CHECK_INTERVAL=30000
```

### In Code (Not Recommended)

You can also set it directly in `lila-tracker.js`:
```javascript
this.spDcCookie = 'your_cookie_value_here';
```

## Token Lifecycle

### Automatic Token Management

The tracker handles tokens automatically:

1. **Initial Token**: Gets a fresh Bearer token using your sp_dc cookie
2. **Token Refresh**: Automatically refreshes when tokens expire (~55 minutes)
3. **Error Recovery**: Re-authenticates if requests fail

### Manual Token Extraction

If you need to manually get a Bearer token:

```javascript
const tracker = new LilaTracker();
await tracker.init();
const success = await tracker.getToken();
if (success) {
    console.log('Token:', tracker.currentToken);
}
```

## Troubleshooting Authentication

### Common Issues

1. **"SP_DC_COOKIE is required"**
   - Make sure you've set the environment variable
   - Check that the cookie value is complete (no truncation)

2. **"Token extraction failed"**
   - Your sp_dc cookie might be expired
   - Get a fresh cookie from your browser
   - Make sure you're logged into Spotify

3. **"API call failed: 401"**
   - The Bearer token has expired
   - The tracker should automatically refresh
   - If it persists, get a new sp_dc cookie

4. **"No token captured"**
   - Spotify might have changed their authentication flow
   - Try clearing browser cache and getting a fresh cookie
   - Check if Puppeteer is working correctly

### Debugging Steps

1. **Verify Cookie Format:**
   ```bash
   echo $SP_DC_COOKIE
   # Should start with alphanumeric characters
   ```

2. **Test Token Extraction:**
   ```javascript
   // Add this to lila-tracker.js for debugging
   console.log('Cookie length:', this.spDcCookie.length);
   console.log('Cookie start:', this.spDcCookie.substring(0, 20));
   ```

3. **Check Puppeteer:**
   ```javascript
   // Run with headful mode to see browser
   this.browser = await puppeteer.launch({ 
       headless: false,  // See what's happening
       devtools: true    // Open DevTools
   });
   ```

## Cookie Security

### Best Practices

- **Never commit cookies to git**
- **Use environment variables in production**
- **Rotate cookies periodically**
- **Store securely (encrypted)**

### Cookie Scope

The sp_dc cookie has access to:
- Your Spotify profile
- Friend activity data
- Playlists and listening history
- **Treat it like a password**

## Advanced Usage

### Multiple Accounts

To track multiple users, you need separate cookies:

```javascript
const lilaTracker = new LilaTracker();
lilaTracker.spDcCookie = 'cookie_for_account_1';

const otherTracker = new LilaTracker();
otherTracker.spDcCookie = 'cookie_for_account_2';
```

### Token Sharing

Bearer tokens can be shared between requests:

```javascript
// Get token once
const token = await tracker.getToken();

// Use for multiple API calls
const response1 = await fetch('api1', { headers: { 'Authorization': `Bearer ${token}` }});
const response2 = await fetch('api2', { headers: { 'Authorization': `Bearer ${token}` }});
```

## API Endpoints Used

The tracker uses these Spotify internal endpoints:

1. **Token Endpoint**: `https://open.spotify.com/`
   - Extracts Bearer tokens from requests
   - Uses sp_dc cookie for authentication

2. **Friend Activity**: `https://guc-spclient.spotify.com/presence-view/v1/buddylist`
   - Gets current friend activity
   - Requires Bearer token

## Cookie Expiration

### Signs Your Cookie is Expired

- Authentication failures
- Empty friend activity responses
- "Unauthorized" errors

### Getting a Fresh Cookie

1. Log out of Spotify completely
2. Clear browser cookies for spotify.com
3. Log back in to open.spotify.com
4. Extract the new sp_dc cookie
5. Update your environment variable

## Support

If you're having trouble with authentication:

1. **Verify Prerequisites:**
   - Active Spotify account
   - Browser access to open.spotify.com
   - Node.js environment

2. **Test Basic Functionality:**
   ```bash
   # Test with a simple curl request
   curl -H "Cookie: sp_dc=YOUR_COOKIE" https://open.spotify.com/
   ```

3. **Check Spotify Status:**
   - Visit [Spotify Status](https://status.spotify.com/)
   - Check if web player is working normally

Remember: The sp_dc cookie is essentially your Spotify session. Keep it secure and treat it like a password!
