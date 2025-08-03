# Getting Your Spotify Cookie for Portainer

## Quick Steps

1. **Open Spotify Web Player:**
   - Go to [https://open.spotify.com/](https://open.spotify.com/)
   - Make sure you're logged in

2. **Open Developer Tools:**
   - Press `F12` (or right-click → Inspect)
   - Go to **Application** tab
   - Click on **Cookies** in the left sidebar
   - Click on `https://open.spotify.com`

3. **Find the sp_dc Cookie:**
   - Look for a cookie named `sp_dc`
   - Click on it to select the row
   - Copy the **Value** (the long string)

4. **Set in Portainer:**
   - In Portainer, when creating the stack
   - In the "Environment variables" section, add:
     ```
     SP_DC_COOKIE=AQBbWMvOJE6ogmn...your_full_cookie_value_here...
     CHECK_INTERVAL=30000
     ```

## Example Environment Variables

```
SP_DC_COOKIE=AQBbWMvOJE6ogmn-_L67o1gWzCOSaJGuYrYCxiedBP5-60GtsxHxK7oI-V5w-DzFcR1sW5BcI9gxWV0rSUV2VNB6rhlqkPbD_BGjDM-APb49SFUeDP9sL1qLHlCvfciPUlrD2d7yLNyyYMcbyE6_sv34emaRyZf4
CHECK_INTERVAL=30000
```

## Troubleshooting

### Container Keeps Restarting
If you see repeated messages like:
```
❌ SP_DC_COOKIE environment variable is required in production
```

**Solution:** The environment variable is not set correctly in Portainer.

1. **Check Environment Variables:**
   - Go to your stack in Portainer
   - Click "Edit this stack"
   - Scroll down to "Environment variables"
   - Make sure `SP_DC_COOKIE` is listed with your actual cookie value

2. **Redeploy the Stack:**
   - After setting the environment variable
   - Click "Update the stack"
   - Wait for containers to restart

### Invalid Cookie
If the tracker starts but can't get tokens:
```
❌ No token captured
❌ Could not get token
```

**Solution:** Your cookie might be expired or invalid.

1. **Get a Fresh Cookie:**
   - Log out of Spotify completely
   - Clear browser cookies for spotify.com
   - Log back in to open.spotify.com
   - Get a new sp_dc cookie value

2. **Update in Portainer:**
   - Edit your stack
   - Update the SP_DC_COOKIE value
   - Redeploy

## Cookie Security

⚠️ **Important Security Notes:**
- Your sp_dc cookie is like a password
- Don't share it publicly
- Store it securely in Portainer environment variables
- Consider rotating it periodically

## Cookie Lifespan

- Spotify cookies typically last ~1 year
- You'll need to update it when it expires
- The app will show authentication errors when the cookie expires
