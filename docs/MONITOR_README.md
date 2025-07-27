# Spotify Friend Activity Monitor

Automatically monitor what your friends are listening to on Spotify every 3 minutes!

## 🚀 Quick Start

### Option 1: Web Dashboard (Recommended)
```bash
node web-dashboard.js
```
Then open http://localhost:3000 in your browser for a beautiful real-time dashboard!

### Option 2: Command Line Only
```bash
node monitor-cli.js
```
For simple terminal output without a web interface.

### Option 3: Basic Server
```bash
node friend-activity-server.js
```
Core monitoring functionality only.

## 📁 Files Overview

- **`web-dashboard.js`** - Full web dashboard with real-time UI
- **`monitor-cli.js`** - Simple command-line version
- **`friend-activity-server.js`** - Core monitoring server class
- **`fresh-token-getter.js`** - Get fresh access tokens when needed
- **`friend-activity-log.json`** - Automatically generated activity log

## ✨ Features

- **🔄 Automatic Monitoring** - Checks every 3 minutes
- **🎯 Change Detection** - Only logs when friends change songs
- **📊 Web Dashboard** - Beautiful real-time interface
- **📝 Activity Logging** - Persistent log of all changes
- **🔐 Auto Token Refresh** - Handles expired tokens automatically
- **💤 Detects Stopped Listening** - Tracks when friends stop listening

## 🌐 Web Dashboard Features

- **Real-time Activity View** - See what friends are listening to now
- **Activity Statistics** - Total entries, unique friends, currently active
- **Recent Activity Log** - History of all song changes
- **Auto-refresh** - Updates every 30 seconds
- **Responsive Design** - Works on desktop and mobile

## 📊 Example Output

```
🎵 Friend Activity Check - 7/26/2025, 8:15:23 PM
👥 Found 3 active friends:

1. forestrain93 🆕
   🎵 "Welcome to the Jungle" by Guns N' Roses
   💿 Album: "Appetite For Destruction"
   ⏰ Started: 7/26/2025, 8:14:45 PM

2. Rogue4hire (continuing)
   🎵 "Natural" by Imagine Dragons

3. 444lila 🔄
   🎵 "Older" by Lizzy McAlpine
   💿 Album: "Older (and Wiser)"
   ⏰ Started: 7/26/2025, 8:15:12 PM

📝 Logged 2 changes to friend-activity-log.json
```

## 🔧 Configuration

Edit the `spDcCookie` variable in any of the files with your cookie value:

```javascript
const spDcCookie = 'YOUR_SP_DC_COOKIE_HERE';
```

## 🔐 Getting Fresh Tokens

If you get authentication errors, run:
```bash
node fresh-token-getter.js
```

This will get you a fresh access token that you can use with the other scripts.

## 📝 Activity Log Format

The activity log (`friend-activity-log.json`) stores:
- User name and track information
- Timestamp of changes
- Whether it's a new track or continuation
- When users stop listening

## 🛑 Stopping the Server

Press `Ctrl+C` to gracefully stop any of the servers. This will:
- Close the browser session
- Stop the monitoring interval
- Save any pending log entries

## 📱 Mobile Access

The web dashboard works great on mobile! Just navigate to `http://[your-computer-ip]:3000` from your phone when connected to the same network.

## 🔍 Troubleshooting

1. **Token Expired**: Run `fresh-token-getter.js` to get a new token
2. **No Friends Found**: Make sure your friends are actively listening and you have friend activity enabled
3. **Browser Issues**: The server runs headless Chrome - make sure you have enough RAM
4. **Network Errors**: Check your internet connection and firewall settings

## 🎯 How It Works

1. **Token Extraction**: Uses Puppeteer to extract access tokens from Spotify Web Player
2. **API Calls**: Makes authenticated requests to Spotify's friend activity endpoints
3. **Change Detection**: Compares current activity with previous state
4. **Logging**: Saves all changes to a JSON file
5. **Web UI**: Serves a real-time dashboard via Express.js

## 🔒 Privacy & Security

- Your sp_dc cookie is only used locally
- No data is sent to external servers
- All monitoring happens on your local machine
- Activity logs are stored locally only

## 📊 Performance

- **Memory Usage**: ~100-200MB (mostly Chrome browser)
- **CPU Usage**: Minimal (only active during 3-minute checks)
- **Network**: Only API calls to Spotify during checks
- **Storage**: Activity log grows ~1KB per friend change

Enjoy monitoring your friends' music taste! 🎵
