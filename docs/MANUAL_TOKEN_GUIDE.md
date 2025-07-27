# Spotify Buddy List Access - Manual Token Extraction Guide

## The Problem
Spotify has blocked the `/get_access_token` endpoint (Error 54113), but the buddy list endpoints still work if you have a valid access token.

## Solution: Extract Token Manually

### Step 1: Get Your Access Token
1. Open https://open.spotify.com/ in your browser
2. Log in to your Spotify account
3. Open Developer Tools (F12)
4. Go to the **Network** tab
5. Clear the network log
6. Navigate around Spotify (search for music, browse playlists, etc.)
7. Look for requests to:
   - `spclient.spotify.com`
   - `api.spotify.com`
   - Any URL containing `buddylist` or `presence`

8. Click on any of these requests
9. In the **Request Headers** section, look for:
   ```
   Authorization: Bearer BQC...
   ```
10. Copy the entire token (everything after "Bearer ")

### Step 2: Use the Token
Replace `YOUR_ACCESS_TOKEN_HERE` in the code below with your copied token.

## Working Endpoints We Found:
- ✅ `https://guc-spclient.spotify.com/presence-view/v1/buddylist` (401 - needs auth)
- ✅ `https://spclient.wg.spotify.com/presence-view/v1/buddylist` (401 - needs auth)
- ❌ `https://open.spotify.com/get_access_token` (403 - blocked)

## Token Characteristics:
- Tokens start with: `BQC`, `BQD`, `BQA`, etc.
- They are usually 200+ characters long
- They expire after some time (usually 1 hour)

## Security Note:
- Never share your access tokens
- Tokens expire and need to be refreshed periodically
- This is for educational/personal use only
