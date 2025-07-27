# Spotify Friend Activity Monitor - Docker Stack

A containerized Spotify friend activity monitoring system that can be deployed as a Portainer stack from a Git repository.

## 🚀 Features

- **Real-time monitoring** of Spotify friend activity every 3 minutes
- **Web dashboard** for viewing current and historical activity
- **Persistent logging** with Docker volumes
- **Environment-based configuration**
- **Health checks** and auto-restart capabilities
- **Traefik labels** for reverse proxy integration

## 📋 Prerequisites

- Docker and Docker Compose
- Portainer installed and running
- Valid Spotify `sp_dc` cookie

## 🔧 Portainer Stack Deployment

### 1. Get Your Spotify Cookie

1. Open your browser and go to [https://open.spotify.com/](https://open.spotify.com/)
2. Log in to your Spotify account
3. Open Developer Tools (F12)
4. Go to **Application** → **Storage** → **Cookies** → `https://open.spotify.com`
5. Find the `sp_dc` cookie and copy its value

### 2. Deploy in Portainer

1. In Portainer, go to **Stacks** → **Add Stack**
2. Choose **Repository** as the build method
3. Enter this repository URL: `https://github.com/yourusername/spotify-friend-activity`
4. Set **Compose path** to: `docker-compose.yml`
5. In **Environment variables**, add:
   ```
   SP_DC_COOKIE=your_sp_dc_cookie_value_here
   CHECK_INTERVAL=180000
   ```
6. Click **Deploy the stack**

### 3. Access the Applications

After deployment:
- **Friend Activity Server**: Runs in background, logs to console
- **Web Dashboard**: Available at `http://your-server:3001`

## 📊 Services

### spotify-friend-activity
- **Port**: 3000 (internal use)
- **Function**: Background monitoring service
- **Logs**: Available in Portainer logs view
- **Health Check**: Built-in Node.js health check

### web-dashboard
- **Port**: 3001 (external access)
- **Function**: Web interface for viewing friend activity
- **URL**: `http://localhost:3001` or `http://your-server:3001`

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SP_DC_COOKIE` | Your Spotify sp_dc cookie (required) | - |
| `CHECK_INTERVAL` | Check interval in milliseconds | 180000 (3 minutes) |
| `NODE_ENV` | Node environment | production |

### Volumes

- `spotify-logs`: Persistent storage for activity logs
- `spotify-data`: General data storage

## 📝 Logs and Data

All friend activity is logged to persistent volumes:
- Activity logs: `/app/logs/friend-activity-log.json`
- Data storage: `/app/data/`

Access logs through:
1. Portainer container logs (real-time)
2. Volume browser in Portainer
3. Direct container access

## 🔍 Monitoring

### Health Checks
Both services include health checks that verify:
- Container is responsive
- Node.js process is running
- Basic application functionality

### Logging
- Console output available in Portainer logs
- Structured JSON logs for friend activity
- Error logging and debugging information

## 🛠️ Troubleshooting

### Common Issues

1. **"SP_DC_COOKIE is required" error**
   - Ensure you've set the `SP_DC_COOKIE` environment variable
   - Verify the cookie value is correct and not expired

2. **Token refresh failures**
   - Check if your `sp_dc` cookie is still valid
   - Try getting a fresh cookie from your browser

3. **No friend activity detected**
   - Ensure your friends are actively listening to music
   - Check if Spotify's privacy settings allow friend activity

### Getting Fresh Cookies
Spotify cookies expire periodically. To update:
1. Get a new `sp_dc` cookie from your browser
2. Update the stack environment variables in Portainer
3. Restart the stack

## 🔄 Updates

To update the application:
1. In Portainer, go to your stack
2. Click **Editor** tab
3. Pull latest changes or update environment variables
4. Click **Update the stack**

## 🏷️ Traefik Integration

The stack includes Traefik labels for reverse proxy:
- Main service: `spotify.localhost`
- Dashboard: `dashboard.spotify.localhost`

Configure Traefik to use these labels for domain routing.

## 📱 API Endpoints

The web dashboard exposes several endpoints:
- `GET /` - Main dashboard interface
- `GET /api/activity` - Current friend activity (JSON)
- `GET /api/history` - Historical activity logs (JSON)

## 🔒 Security Notes

- The `sp_dc` cookie provides access to your Spotify account
- Store it securely and don't share it
- Consider using Docker secrets for production deployments
- The application runs as a non-root user in containers

## 🐛 Support

For issues and support:
1. Check Portainer container logs
2. Verify environment variables are set correctly
3. Ensure your Spotify cookie is valid
4. Review the application README for additional troubleshooting

## 📄 License

This project is unlicensed and free to use.
