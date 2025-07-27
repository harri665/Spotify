# Project Structure

This document outlines the cleaned and organized structure of the Spotify Friend Activity Monitor.

## 📁 Directory Structure

```
spotify-friend-activity/
├── 📋 Project Files
│   ├── package.json              # Project configuration & dependencies
│   ├── package-lock.json         # Locked dependency versions
│   ├── README.md                 # Main project documentation
│   ├── CHANGELOG.md              # Version history and changes
│   ├── .env.example              # Environment variable template
│   ├── .gitignore                # Git ignore patterns
│   └── .dockerignore             # Docker ignore patterns
│
├── 🚀 src/                       # Main Application Code
│   ├── friend-activity-server.js # Main monitoring server (every 3 min)
│   ├── web-dashboard.js          # Express web dashboard + API
│   ├── lila-tracker.js           # 444lila specific tracker (30 sec)
│   └── monitor-cli.js            # Command-line monitoring tool
│
├── 🐳 docker/                    # Docker & Container Files
│   ├── Dockerfile                # Container definition
│   ├── docker-compose.yml        # Multi-service setup
│   ├── portainer-stack.yml       # Portainer deployment
│   └── healthcheck.sh            # Container health checks
│
├── 📚 docs/                      # Documentation
│   ├── README-DOCKER.md          # Docker deployment guide
│   ├── MONITOR_README.md         # Monitoring setup guide
│   └── MANUAL_TOKEN_GUIDE.md     # Token extraction instructions
│
└── 🗂️ legacy/                    # Historical/Deprecated Files
    ├── index.js                  # Original library implementation
    ├── example.js                # Basic usage examples
    ├── auto-token-finder.js      # Legacy token extraction
    ├── fresh-token-getter.js     # Alternative token methods
    ├── simple-buddy-list.js      # Simple API testing
    ├── spotify-explorer.js       # API exploration script
    ├── token-extractor.js        # Manual token extraction
    ├── working-buddy-list.js     # Working implementation test
    ├── puppeteer-spotify.js      # Puppeteer experiments
    ├── example-puppeteer.js      # Puppeteer examples
    └── th.html                   # Test HTML file
```

## 🎯 Application Components

### Main Services (`src/`)

| File | Purpose | Usage |
|------|---------|-------|
| `friend-activity-server.js` | Background monitoring server | `npm start` |
| `web-dashboard.js` | Web interface + API | `npm run dashboard` |
| `lila-tracker.js` | Specific user tracker | `npm run lila-tracker` |
| `monitor-cli.js` | Command-line tool | `npm run cli` |

### Docker Deployment (`docker/`)

| File | Purpose | Usage |
|------|---------|-------|
| `Dockerfile` | Container definition | `docker build` |
| `docker-compose.yml` | Local multi-service | `docker-compose up` |
| `portainer-stack.yml` | Portainer deployment | Portainer UI |
| `healthcheck.sh` | Health monitoring | Automatic |

### Documentation (`docs/`)

| File | Purpose |
|------|---------|
| `README-DOCKER.md` | Complete Docker guide |
| `MONITOR_README.md` | Monitoring setup |
| `MANUAL_TOKEN_GUIDE.md` | Token extraction help |

### Legacy Code (`legacy/`)

Contains all historical implementations and experimental scripts. These files are preserved for reference but are not part of the current application.

## 🔧 NPM Scripts

```bash
# Main Application
npm start              # Run main monitoring server
npm run dashboard      # Start web dashboard
npm run lila-tracker   # Run 444lila specific tracker
npm run cli           # Quick command-line check

# Docker Operations
npm run docker:build  # Build Docker image
npm run docker:up     # Start with Docker Compose
npm run docker:down   # Stop Docker services

# Development
npm run lint          # Code linting
```

## 📊 Data Flow

```
1. Token Extraction (Puppeteer) → Bearer Token
2. Friend Activity API → JSON Data
3. Change Detection → New Songs Only
4. Logging → JSON Files
5. Web Dashboard → Real-time Display
```

## 🏗️ Migration from v3.x

The project has been completely restructured:

- ✅ **Organized directories** by function
- ✅ **Separated concerns** (app, docker, docs, legacy)
- ✅ **Updated paths** in all configuration files
- ✅ **Enhanced documentation** with guides
- ✅ **Modernized deployment** with Docker support

## 📝 Next Steps

1. **Run the application**: `npm start`
2. **Access web dashboard**: `npm run dashboard`
3. **Deploy with Docker**: See `docs/README-DOCKER.md`
4. **Track specific users**: `npm run lila-tracker`

This structure provides a clean, maintainable, and scalable foundation for the Spotify Friend Activity Monitor.
