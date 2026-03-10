#!/bin/bash

# Configuration
APP_DIR="/var/www/quanlybanhang"
LOG_FILE="$APP_DIR/logs/update.log"

# Ensure log directory exists
mkdir -p "$APP_DIR/logs"

echo "[$(date)] Starting update process..." >> "$LOG_FILE"

# Navigate to app directory
cd "$APP_DIR" || { echo "Failed to cd to $APP_DIR" >> "$LOG_FILE"; exit 1; }

# Reset local changes (Optional: be careful if you edit files on server)
# git reset --hard origin/main

# Pull latest code
echo "Pulling from git..." >> "$LOG_FILE"
git pull origin main >> "$LOG_FILE" 2>&1

# Install dependencies
echo "Installing dependencies..." >> "$LOG_FILE"
npm install >> "$LOG_FILE" 2>&1

# Build (if you have a build step for server, e.g. tsc)
# echo "Building..." >> "$LOG_FILE"
# npm run build >> "$LOG_FILE" 2>&1

# Restart PM2
echo "Restarting application..." >> "$LOG_FILE"
pm2 reload ecosystem.config.cjs >> "$LOG_FILE" 2>&1

echo "[$(date)] Update completed successfully." >> "$LOG_FILE"
