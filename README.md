# Spotify Friend Activity Monitor

> An advanced monitoring system for Spotify friend activity with real-time tracking, web dashboard, and Docker deployment support.

## 🎵 Overview

This project provides comprehensive monitoring of Spotify friend activity using automated token extraction and real-time tracking. It includes:

- **Automated Server**: Background monitoring every 3 minutes
- **Web Dashboard**: Real-time activity viewing with beautiful UI
- **Specific User Tracking**: Focus on individual friends (like 444lila)
- **Docker Support**: Easy deployment with Portainer stacks
- **Activity Logging**: Persistent JSON logs with change detection

## 🚀 Features

- ✅ **Real-time monitoring** of all friend activity
- ✅ **Smart change detection** - only logs when friends switch songs
- ✅ **Web dashboard** with auto-refresh and historical data
- ✅ **Individual user tracking** for specific friends
- ✅ **Docker containerization** with health checks
- ✅ **Persistent logging** with volume mounting
- ✅ **Automatic token refresh** using Puppeteer
- ✅ **Command-line interface** for quick checks

## 📁 Project Structure

```
spotify-friend-activity/
├── src/                          # Main application code
│   ├── friend-activity-server.js # Main monitoring server
│   ├── web-dashboard.js          # Express web dashboard
│   ├── lila-tracker.js          # 444lila specific tracker
│   └── monitor-cli.js           # Command line interface
├── docker/                      # Docker deployment files
│   ├── Dockerfile              # Container definition
│   ├── docker-compose.yml      # Multi-service setup
│   ├── portainer-stack.yml     # Portainer stack file
│   └── healthcheck.sh          # Health check script
├── docs/                       # Documentation
│   ├── README-DOCKER.md        # Docker deployment guide
│   ├── MONITOR_README.md       # Monitoring setup guide
│   └── MANUAL_TOKEN_GUIDE.md   # Token extraction guide
├── legacy/                     # Historical/deprecated files
└── logs/                       # Activity logs (created at runtime)
```

## 🔧 Quick Start

### Prerequisites
- Node.js 18+
- Valid Spotify account
- Spotify `sp_dc` cookie

### 1. Get Your Spotify Cookie
1. Open [https://open.spotify.com/](https://open.spotify.com/) in your browser
2. Open DevTools (F12) → **Application** → **Cookies**
3. Copy the `sp_dc` cookie value

### 2. Installation
```bash
# Clone the repository
git clone <repository-url>
cd spotify-friend-activity

# Install dependencies
npm install

# Set your cookie (optional - can be set as environment variable)
cp .env.example .env
# Edit .env and add your SP_DC_COOKIE
```

### 3. Usage Options

#### Option A: Main Server (All Friends)
```bash
# Start the monitoring server
npm start

# Or with environment variable
SP_DC_COOKIE=your_cookie_here npm start
```

#### Option B: Web Dashboard
```bash
# Start web dashboard at http://localhost:3000
npm run dashboard
```

#### Option C: 444lila Specific Tracker
```bash
# Track only 444lila's activity
npm run lila-tracker
```

#### Option D: Quick CLI Check
```bash
# One-time check via command line
npm run cli
```

## 🐳 Docker Deployment

### Local Docker
```bash
# Build and run with Docker Compose
npm run docker:build
npm run docker:up

# Access dashboard at http://localhost:3001
```

### Portainer Stack
1. Copy `docker/portainer-stack.yml` content
2. In Portainer: **Stacks** → **Add Stack** → **Web Editor**
3. Set environment variables:
   ```
   SP_DC_COOKIE=your_spotify_cookie_here
   CHECK_INTERVAL=180000
   ```
4. Deploy the stack

See [docs/README-DOCKER.md](docs/README-DOCKER.md) for detailed Docker instructions.

## 📊 Services & Endpoints

### Main Server (`src/friend-activity-server.js`)
- **Function**: Background monitoring of all friends
- **Frequency**: Every 3 minutes (configurable)
- **Logs**: Console output + JSON file

### Web Dashboard (`src/web-dashboard.js`)
- **URL**: `http://localhost:3000`
- **API**: `/api/activity`, `/api/history`
- **Features**: Real-time updates, historical data

### Lila Tracker (`src/lila-tracker.js`)
- **Function**: Focuses only on 444lila's activity
- **Frequency**: Every 30 seconds
- **Logs**: `444lila-activity-log.json`

## ⚙️ Configuration

### Environment Variables
| Variable | Description | Default |
|----------|-------------|---------|
| `SP_DC_COOKIE` | Your Spotify sp_dc cookie (required) | - |
| `CHECK_INTERVAL` | Monitoring interval in milliseconds | 180000 (3 min) |
| `PORT` | Web dashboard port | 3000 |
| `NODE_ENV` | Environment mode | development |

### File Locations
- **Main logs**: `logs/friend-activity-log.json`
- **Lila logs**: `444lila-activity-log.json`
- **Docker volumes**: `/app/logs/`, `/app/data/`

## 🔍 Example Output

```
🎵 Friend Activity Check - 7/26/2025, 8:10:27 PM
👥 Found 3 active friends:

1. forestrain93 🆕
   🎵 "My Michelle" by Guns N' Roses
   💿 Album: "Appetite For Destruction"
   ⏰ Started: 7/26/2025, 3:17:25 PM

2. 444lila 🔄
   🎵 "Cherry" by Chromatics
   💿 Album: "Cherry (Deluxe)"
   ⏰ Started: 7/26/2025, 8:09:34 PM
```

## 🛠️ Development

### Scripts
- `npm start` - Run main server
- `npm run dashboard` - Start web dashboard
- `npm run lila-tracker` - Run 444lila tracker
- `npm run cli` - Command line check
- `npm run lint` - Code linting

### File Structure
- **Core logic**: Token extraction, API calls, change detection
- **Web interface**: Express server with real-time updates
- **Docker support**: Multi-stage builds, health checks
- **Documentation**: Comprehensive setup guides

## 🔒 Security Notes

- Store your `sp_dc` cookie securely
- Don't commit cookies to version control
- Use environment variables for production
- Consider Docker secrets for sensitive data

## 🐛 Troubleshooting

### Common Issues

1. **"SP_DC_COOKIE is required"**
   - Set the environment variable or update .env file

2. **Token refresh failures**
   - Get a fresh sp_dc cookie from your browser
   - Check if Spotify changed their authentication

3. **No friend activity**
   - Ensure friends are actively listening
   - Check Spotify privacy settings

### Getting Help
- Check console logs for error details
- Verify your sp_dc cookie is valid
- Review the documentation in `docs/`

## 📄 License

This project is unlicensed and free to use.

## 🙏 Credits

Original spotify-buddylist by Val (val.codejam.info)  
Enhanced with monitoring, Docker support, and web dashboard by GitHub Copilot

## Usage

To use this API, you need to get a web player access token, not a
regular API access token, so you can't use the official API way of
logging in, getting and refreshing tokens.

The good news is that if you don't mind logging in on the web player and
refreshing a value in your code once a year, it's actually quite easier
than the official OAuth way. More on that [below](#sp_dc-cookie).

```js
const buddyList = require('spotify-buddylist')

async function main () {
  const spDcCookie = 'put your cookie here'

  const { accessToken } = await buddyList.getWebAccessToken(spDcCookie)
  const friendActivity = await buddyList.getFriendActivity(accessToken)

  console.log(friendActivity)
}

main()
```

The output looks like:

```json
{
  "friends": [
    {
      "timestamp": 1600773735000,
      "user": {
        "uri": "spotify:user:shaktirockgym",
        "name": "shaktirockgym"
      },
      "track": {
        "uri": "spotify:track:51xHvAUYQfhY29GcGlBM0n",
        "name": "Piano Sonata No. 16 in C Major, K. 545 \"Sonata facile\": 1. Allegro",
        "imageUrl": "http://i.scdn.co/image/ab67616d0000b273bf4b533ee6e9634a6fcd8882",
        "album": {
          "uri": "spotify:album:1XORY4rQNhqkZxTze6Px90",
          "name": "Piano Book (Deluxe Edition)"
        },
        "artist": {
          "uri": "spotify:artist:4NJhFmfw43RLBLjQvxDuRS",
          "name": "Wolfgang Amadeus Mozart"
        },
        "context": {
          "uri": "spotify:user:spotify:playlist:37i9dQZF1E4riV8HyBkA7r",
          "name": "Wolfgang Amadeus Mozart Radio",
          "index": 0
        }
      }
    }
  ]
}
```

## `sp_dc` cookie

This is the only value that you need for this to work. After you login
on the [web player] (which I don't automate because reCAPTCHA), you get
a bunch of cookies, including one named `sp_dc`.

[web player]: https://open.spotify.com/

Seems like it's valid for one year, and with just that value you can
call anytime an endpoint that gives you a refreshed, elevated API access
token, that, unlike the official API ones, will let you query the
undocumented endpoint that retrieves the friend activity.

## Usage with spotify-web-api-node

You might already be using the [spotify-web-api-node](https://github.com/thelinmichael/spotify-web-api-node)
package to use the official API.

To authenticate using the `sp_dc` cookie:

```js
const SpotifyWebApi = require('spotify-web-api-node')
const buddyList = require('spotify-buddylist')

const api = new SpotifyWebApi()

const tokenResponse = await buddyList.getWebAccessToken(config.spotify.spDcCookie)

api.setAccessToken(tokenResponse.accessToken)
```

Should your script run more than the token response's
`accessTokenExpirationTimestampMs` (currently an hour), I would suggest
implementing token refresh logic which is just calling
`getWebAccessToken` and `setAccessToken` again like above.

## Don't know how to code?

If the documentation above doesn't make much sense to you, here's a
couple extra information you might find useful. 🙏

Because spotify-buddylist is a library, it's meant to be used by *other
programs*, and it doesn't makes any assumption on how it's going to be
used. You're free to *code* a program that automatically populates
another playlist, sends you a notification when a specific friend plays
a specific song, feeds an online spreadsheet, or just appends to a local
file.

But don't worry, if you don't know how to code, you can still use the
[example](example.js) that just displays the data when you run it. The
following steps will show you how to do that.

### Installing

Because this library is built with [Node.js](https://nodejs.org/),
you'll need to install it first.

Then, [download the archive for this repository](https://github.com/valeriangalliat/spotify-buddylist/archive/refs/heads/master.zip)
and extract it.

Open a terminal, go in the spotify-buddylist directory that you just
extracted, and run:

```sh
npm install
```

This will install the extra dependencies needed for the program to run.

### Fetching the cookie

Then you'll need to grab your `sp_dc` cookie from Spotify. This is a
requirement because Spotify doesn't allow third-party apps to get the
friend activity feed, so this cookie allows us to pretend that we're the
Spotify app itself to get access to that data.

For that, login on the [web player] and open your browser's web
developer tools. It's usually in "settings", "more tools", "developer
tools". In that pane, go in "application", "storage", "cookies",
`https://open.spotify.com` (or something close to that depending on your
browser).

You'll find a cookie named `sp_dc`. Copy its value.

### Running the example

In the spotify-buddylist directory, open `example.js` with any text
editor, and paste the cookie value in place of the text "put your cookie
here".

Now, you can run the following command to execute the script:

```sh
node example.js
```

This will display the JSON response from Spotify (once).

If you want to run it periodically, you can uncomment the last line of
the file (remove the `//` from the beginning of the line and save the
file) and run the above command again. Now the script will run
indefinitely, fetching new data every minute and appending it to the
terminal output.

That should be enough to get you started! 🎉

If you want to do more things with that, you might want to learn a
little bit of JavaScript. Programming is powerful, and will allow you to
do the things that *you* want to do with your computer, instead of being
limited to the things that someone else decided that you should be able
to do. Enjoy!
