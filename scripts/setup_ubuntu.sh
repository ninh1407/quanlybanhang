#!/bin/bash

# Exit on error
set -e

echo "=== Starting Automatic Server Setup ==="

# 1. Update System
echo "--- Updating System ---"
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git unzip build-essential

# 2. Install Node.js 20
echo "--- Installing Node.js 20 ---"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v

# 3. Install PostgreSQL 16
echo "--- Installing PostgreSQL ---"
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt update
sudo apt install -y postgresql-16 postgresql-contrib

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create Database and User (Interactive or Hardcoded - defaulting to safe local)
# You should change 'secure_password' manually later
echo "--- Configuring Database ---"
sudo -u postgres psql -c "CREATE DATABASE sales_db;" || echo "Database sales_db already exists"
sudo -u postgres psql -c "CREATE USER sales_admin WITH ENCRYPTED PASSWORD 'ChangeMe123!';" || echo "User sales_admin already exists"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE sales_db TO sales_admin;"

# 4. Install PM2
echo "--- Installing PM2 ---"
sudo npm install -g pm2
pm2 startup

# 5. Setup Application
APP_DIR="/var/www/quanlybanhang"
REPO_URL="https://github.com/ninh1407/quanlybanhang.git" # Replace with your repo

echo "--- Setting up Application at $APP_DIR ---"
sudo mkdir -p /var/www
sudo chown -R $USER:$USER /var/www

if [ -d "$APP_DIR" ]; then
    echo "Directory exists, pulling latest..."
    cd "$APP_DIR"
    git pull
else
    echo "Cloning repository..."
    git clone "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

# Install App Dependencies
npm install

# Setup Env (Copy example if not exists)
if [ ! -f .env ]; then
    cp .env.example .env
    echo "⚠️  CREATED .env FILE. PLEASE EDIT IT WITH REAL SECRETS!"
fi

# Start App
pm2 start ecosystem.config.cjs
pm2 save

# 6. Setup Auto-Update Cron (Daily at 3 AM)
echo "--- Setting up Auto-Update Cron ---"
chmod +x scripts/update_app.sh
(crontab -l 2>/dev/null; echo "0 3 * * * $APP_DIR/scripts/update_app.sh") | crontab -

# 7. Firewall (UFW)
echo "--- Configuring Firewall ---"
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
# sudo ufw allow 3000/tcp # Only if testing directly, otherwise use Nginx reverse proxy
# sudo ufw enable # Uncomment to enable (can disconnect SSH if not careful)

echo "=== Setup Completed Successfully! ==="
echo "Next Steps:"
echo "1. Edit .env file: nano $APP_DIR/.env"
echo "2. Setup Nginx as Reverse Proxy (Recommended for SSL)"
