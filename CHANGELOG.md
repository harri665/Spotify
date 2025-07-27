# Changelog

All notable changes to the Spotify Friend Activity Monitor project.

## [4.0.0] - 2025-07-26

### Added 🎉
- Complete project restructure with organized directories
- Docker support with multi-service deployment
- Portainer stack configuration for easy deployment
- Web dashboard with real-time activity monitoring
- Individual user tracking (444lila tracker)
- Command-line interface for quick checks
- Comprehensive health checks and monitoring
- Environment variable configuration
- Persistent logging with Docker volumes
- Auto-refresh functionality
- Smart change detection (only logs new songs)

### Project Structure 📁
- `src/` - Main application code
- `docker/` - Docker deployment files
- `docs/` - Documentation and guides
- `legacy/` - Historical/deprecated files

### Services 🚀
- **friend-activity-server.js** - Main monitoring server (every 3 minutes)
- **web-dashboard.js** - Express web interface with API endpoints
- **lila-tracker.js** - Specific user tracking (every 30 seconds)
- **monitor-cli.js** - Command-line monitoring tool

### Docker Features 🐳
- Multi-stage Dockerfile with Alpine Linux
- Docker Compose with health checks
- Portainer stack support
- Persistent volumes for logs and data
- Traefik labels for reverse proxy integration

### Improvements 🔧
- Token extraction using fresh Puppeteer pages
- Better error handling and retry logic
- Configurable check intervals
- JSON structured logging
- Real-time web dashboard updates
- Security improvements (non-root containers)

## [3.0.0] - Previous Version

### Legacy Features
- Basic friend activity fetching
- Simple token-based authentication
- Manual token extraction
- Example scripts and exploratory tools

### Moved to Legacy
- `index.js` - Original library implementation
- `example.js` - Basic usage examples
- Various experimental scripts
- HTML test files

---

## Migration Guide

### From 3.x to 4.0

1. **File Structure**: Main files moved to `src/` directory
2. **Docker**: Use `docker/` files for containerization
3. **Scripts**: Updated npm scripts for new structure
4. **Environment**: Use `.env` file or environment variables
5. **Documentation**: Check `docs/` for detailed guides

### Running the New Version

```bash
# Install dependencies
npm install

# Start main server
npm start

# Start web dashboard
npm run dashboard

# Track specific user
npm run lila-tracker

# Docker deployment
npm run docker:up
```

### Configuration

Set your Spotify cookie in environment variables:
```bash
export SP_DC_COOKIE="your_cookie_here"
```

Or use the `.env` file:
```
SP_DC_COOKIE=your_cookie_here
CHECK_INTERVAL=180000
```
