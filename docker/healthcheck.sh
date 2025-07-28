#!/bin/sh
# Health check script for the container

# Check if the main process is running
if ! pgrep -f "node" > /dev/null; then
    echo "❌ Node process not running"
    exit 1
fi

# Check if log file exists and is being written to (for tracker)
LOG_FILE="/app/shared/lila-activity-log.json"
if [ -f "$LOG_FILE" ]; then
    # Check if file was modified in the last 10 minutes (600 seconds)
    if [ $(find "$LOG_FILE" -mmin -10 | wc -l) -gt 0 ]; then
        echo "✅ Tracker is active - log file recently updated"
        exit 0
    fi
fi

# Check if dashboard is responding (if dashboard service)
if curl -f http://localhost:3000/api/lila-activity > /dev/null 2>&1; then
    echo "✅ Dashboard is responding"
    exit 0
fi

# If tracker is running but no recent activity, still consider healthy
echo "✅ Service is running"
exit 0
