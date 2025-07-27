#!/bin/sh

# Health check script for Spotify Friend Activity Monitor
# This script verifies that the application is running properly

# Check if Node.js process is running
if ! pgrep -f "node" > /dev/null; then
    echo "Node.js process not found"
    exit 1
fi

# Check if the log directory exists and is writable
if [ ! -d "/app/logs" ]; then
    echo "Logs directory not found"
    exit 1
fi

if [ ! -w "/app/logs" ]; then
    echo "Logs directory not writable"
    exit 1
fi

# For web dashboard, check if HTTP server is responding
if [ "${CHECK_WEB:-false}" = "true" ]; then
    if ! wget --quiet --tries=1 --timeout=5 --spider http://localhost:3000/ 2>/dev/null; then
        echo "Web server not responding"
        exit 1
    fi
fi

echo "Health check passed"
exit 0
