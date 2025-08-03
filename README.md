# Spotify Activity Tracker

A simple, focused Spotify activity tracker that monitors what you're listening to and displays it in a beautiful web dashboard with Docker and Portainer support.

## Features

- 🎵 Real-time tracking of Spotify activity
- 📊 Beautiful web dashboard showing listening history
- 🕐 Timestamps for when each song was played
- 🎶 Direct links to songs on Spotify
- 📱 Responsive design that works on all devices
- 🔄 Auto-refreshing dashboard every 30 seconds
- 🐳 Docker support with health checks
- 📦 Portainer stack ready for easy deployment
- 📈 Persistent data storage with volume mounting
- 🤖 **Automatic Spotify session detection (no manual cookie needed!)**

## Quick Start

### Prerequisites

- Node.js (v14 or higher) **OR** Docker
- **No manual configuration needed!** The app automatically detects Spotify sessions

### Automatic Setup

The tracker now **automatically extracts Spotify session cookies**, so you don't need to manually configure anything! Just deploy and it works.

> **Note:** If automatic detection fails, you can still manually set the `SP_DC_COOKIE` environment variable as a fallback.

## Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set your cookie:**
   ```bash
   cp .env.example .env
   # Edit .env and add your SP_DC_COOKIE
   ```

3. **Run both services:**
   ```bash
   npm run dev
   ```

4. **View the dashboard:**
   Open `http://localhost:3000`

## Docker Deployment

### Method 1: Docker Compose (Recommended)

1. **Set environment variables:**
   ```bash
   export SP_DC_COOKIE="your_spotify_cookie_here"
   ```

2. **Build and run:**
   ```bash
   npm run docker:up
   ```

3. **Access dashboard:**
   Open `http://localhost:3001`

### Method 2: Manual Docker Commands

```bash
# Build the image
npm run docker:build

# Run with environment variables
docker run -d \
  --name lila-tracker \
  -e SP_DC_COOKIE="your_cookie_here" \
  -v $(pwd)/lila-activity-log.json:/app/lila-activity-log.json \
  lila-tracker
```

## Portainer Stack Deployment

### Using Portainer Web UI

1. **Access Portainer** (usually `http://localhost:9000`)

2. **Create new stack:**
   - Go to Stacks → Add Stack
   - Name: `lila-tracker`
   - Choose "Web editor"

3. **Copy stack configuration:**
   Copy contents from `docker/portainer-stack.yml`

4. **Deploy the stack:**
   - **No environment variables needed!** The app auto-detects Spotify sessions
   - Optionally set `CHECK_INTERVAL=30000` to customize check frequency
   - Click "Deploy the stack"

5. **Access dashboard:**
   - Dashboard available at `http://your-server:3001`
   - The tracker will automatically handle Spotify authentication

### Stack Services

The Portainer stack includes:
- **lila-tracker**: Background monitoring service
- **lila-dashboard**: Web interface on port 3001
- **Shared volumes**: Persistent data storage
- **Health checks**: Automatic monitoring
- **Auto-restart**: Fault tolerance

## Usage

### Individual Commands
- `npm start` - Start only the Lila tracker
- `npm run dashboard` - Start only the web dashboard
- `npm run dev` - Run both tracker and dashboard

### Docker Commands
- `npm run docker:build` - Build Docker image
- `npm run docker:up` - Start with Docker Compose
- `npm run docker:down` - Stop Docker services
- `npm run docker:logs` - View container logs

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SP_DC_COOKIE` | Your Spotify sp_dc cookie (optional - auto-extracted) | Auto-detected |
| `CHECK_INTERVAL` | Check interval in milliseconds | 30000 |
| `PORT` | Dashboard port | 3000 |
| `DASHBOARD_PORT` | External dashboard port | 3001 |
| `NODE_ENV` | Environment mode | development |

### Data Storage

- **Local**: `lila-activity-log.json` in project root
- **Docker**: Persistent volumes + bind mounts
- **Format**: JSON with song, artist, album, timestamps, and Spotify links

## How It Works

1. **lila-tracker.js** - Monitors Spotify activity every 30 seconds
2. **dashboard.js** - Serves web interface showing listening history  
3. **lila-activity-log.json** - Stores all tracked activity data
4. **Docker containers** - Isolated, scalable deployment
5. **Health checks** - Automatic monitoring and restart

## Dashboard Features

- **Real-time Stats**: Total songs, unique artists, last update time
- **Song Cards**: Album artwork, song details, timestamps, Spotify links
- **Auto-refresh**: Updates every 30 seconds automatically
- **Responsive Design**: Works on desktop and mobile
- **Persistent Data**: All activity history preserved
- **Direct Integration**: Spotify search links for each song

## Monitoring

### Container Health

Both containers include health checks:
- Node.js process monitoring
- Log file activity verification
- API endpoint responsiveness
- Automatic restart on failure

### Viewing Logs

```bash
# Docker Compose logs
npm run docker:logs

# Individual container logs
docker logs lila-tracker
docker logs lila-dashboard

# Real-time logs
docker logs -f lila-tracker
```

## Troubleshooting

### Common Issues

1. **"Cannot proceed without valid Spotify session cookie"**
   - The automatic cookie extraction failed
   - **Solution**: Manually set `SP_DC_COOKIE` environment variable
   - Or ensure someone is logged into Spotify on the server

2. **Dashboard not accessible**
   - Check if port 3001 is available
   - Verify container is running: `docker ps`

3. **No activity logged**
   - Ensure you're actively listening
   - Check container logs for authentication issues

4. **"Failed to launch browser process"**
   - Docker container missing Chrome/Chromium
   - **Solution**: Rebuild Docker image (fixed in latest version)

### Getting Help

- Check container logs for errors
- Verify Spotify cookie validity
- Review documentation in `docs/`
- Test with `npm run dev` for local debugging

## Documentation

- **[Docker Guide](docs/README-DOCKER.md)** - Detailed Docker deployment
- **[Token Guide](docs/MANUAL_TOKEN_GUIDE.md)** - Authentication setup
- **[Portainer Stack](docker/portainer-stack.yml)** - Stack configuration

## Requirements

- **Local**: Node.js 14+, valid Spotify session
- **Docker**: Docker & Docker Compose
- **Portainer**: Portainer instance with stack support

## Security Notes

- Store sp_dc cookie securely (environment variables)
- Never commit cookies to version control
- Use Docker secrets for production deployments
- Regularly rotate authentication cookies

---

**🎵 Created for tracking your music taste with enterprise-grade deployment! 🎵**
