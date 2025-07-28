# Docker Deployment Guide

This guide covers deploying the 444lila Spotify Tracker using Docker and Docker Compose.

## Prerequisites

- Docker and Docker Compose installed
- Your Spotify `sp_dc` cookie

## Getting Your Spotify Cookie

1. Open [https://open.spotify.com/](https://open.spotify.com/) in your browser
2. Log in to your Spotify account
3. Open Developer Tools (F12)
4. Go to Application → Cookies → https://open.spotify.com
5. Find the `sp_dc` cookie and copy its value

## Local Docker Deployment

### Method 1: Docker Compose (Recommended)

1. **Clone and navigate to the project:**
   ```bash
   git clone <your-repo-url>
   cd spotify-lila-tracker
   ```

2. **Set environment variables:**
   ```bash
   export SP_DC_COOKIE="your_spotify_cookie_here"
   export CHECK_INTERVAL=30000
   ```

3. **Build and run:**
   ```bash
   docker-compose -f docker/docker-compose.yml up -d
   ```

4. **Access the dashboard:**
   Open `http://localhost:3001` in your browser

### Method 2: Manual Docker Build

1. **Build the image:**
   ```bash
   docker build -f docker/Dockerfile -t lila-tracker .
   ```

2. **Run the tracker:**
   ```bash
   docker run -d \
     --name lila-tracker \
     -e SP_DC_COOKIE="your_cookie_here" \
     -v $(pwd)/lila-activity-log.json:/app/lila-activity-log.json \
     lila-tracker
   ```

3. **Run the dashboard:**
   ```bash
   docker run -d \
     --name lila-dashboard \
     -p 3001:3000 \
     -e SP_DC_COOKIE="your_cookie_here" \
     -v $(pwd)/lila-activity-log.json:/app/lila-activity-log.json \
     lila-tracker node src/dashboard.js
   ```

## Portainer Stack Deployment

### Using Portainer Web UI

1. **Access Portainer** (usually at `http://localhost:9000`)

2. **Create a new stack:**
   - Go to Stacks → Add Stack
   - Choose "Web editor"
   - Name your stack (e.g., "lila-tracker")

3. **Copy the stack configuration:**
   Copy the contents of `docker/portainer-stack.yml`

4. **Set environment variables:**
   In the "Environment variables" section, add:
   ```
   SP_DC_COOKIE=your_spotify_cookie_here
   CHECK_INTERVAL=30000
   ```

5. **Deploy the stack:**
   Click "Deploy the stack"

6. **Access the dashboard:**
   Once deployed, access the dashboard at `http://your-server-ip:3001`

### Stack Configuration

The Portainer stack includes:

- **lila-tracker**: Monitors 444lila's activity every 30 seconds
- **lila-dashboard**: Web interface on port 3001
- **Shared volumes**: For persistent data storage
- **Health checks**: Automatic container monitoring
- **Auto-restart**: Containers restart automatically if they fail

## Volume Management

The stack creates several volumes:

- `lila_logs`: Application logs
- `lila_data`: General data storage  
- `lila_shared_data`: Shared data between tracker and dashboard (contains the activity log file)

**Important**: The activity log file is stored at `/app/shared/lila-activity-log.json` inside the containers and is shared between both services via the `lila_shared_data` volume.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SP_DC_COOKIE` | Your Spotify sp_dc cookie | **Required** |
| `CHECK_INTERVAL` | Check interval in milliseconds | 30000 (30 seconds) |
| `PORT` | Dashboard port inside container | 3000 |
| `NODE_ENV` | Node environment | production |

## Monitoring

### Container Health

Both containers include health checks that verify:
- Node.js process is running
- Log files are being updated
- Dashboard API is responding

### Logs

View container logs:
```bash
# Tracker logs
docker logs lila-tracker

# Dashboard logs
docker logs lila-dashboard
```

### Activity Data

The activity log is stored in `lila-activity-log.json` and is shared between containers.

## Troubleshooting

### Common Issues

1. **Container won't start:**
   - Check if `SP_DC_COOKIE` is set correctly
   - Verify Docker has enough resources

2. **No activity being logged:**
   - Ensure 444lila is actively listening to music
   - Check if the sp_dc cookie is still valid

3. **Dashboard not accessible:**
   - Verify port 3001 is not blocked by firewall
   - Check if the dashboard container is running

### Getting Fresh Logs

```bash
# Follow tracker logs in real-time
docker logs -f lila-tracker

# Check last 50 lines of dashboard logs
docker logs --tail 50 lila-dashboard
```

## Updating

To update the application:

1. **Pull latest changes:**
   ```bash
   git pull origin main
   ```

2. **Rebuild and restart:**
   ```bash
   docker-compose -f docker/docker-compose.yml down
   docker-compose -f docker/docker-compose.yml up -d --build
   ```

## Security Notes

- Store your `sp_dc` cookie securely
- Consider using Docker secrets for production deployments
- Regularly update the base Node.js image
- Monitor container logs for any authentication issues

## Performance

- The tracker uses minimal resources (< 100MB RAM)
- Dashboard serves static files efficiently
- Health checks run every 30 seconds
- Logs rotate automatically to prevent disk space issues
