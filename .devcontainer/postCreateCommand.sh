#!/usr/bin/env bash

# postCreateCommand.sh v. 1.0.1

# This script runs after the Dev Container is created to set up the dev container environment.

set -euo pipefail

echo "Welcome to Matterbridge Dev Container"
WORKSPACE_FS_TYPE=$(stat -f -c %T "$PWD" 2>/dev/null || echo unknown)
DISTRO=$(awk -F= '/^PRETTY_NAME=/{gsub(/"/, "", $2); print $2}' /etc/os-release)
CODENAME=$(awk -F= '/^VERSION_CODENAME=/{print $2}' /etc/os-release)
echo "Distro: $DISTRO ($CODENAME)"
echo "User: $(whoami)"
echo "Hostname: $(hostname)"
echo "Architecture: $(uname -m)"
echo "Kernel Version: $(uname -r)"
echo "Uptime: $(uptime -p || echo 'unavailable')"
echo "Workspace filesystem: $WORKSPACE_FS_TYPE"
echo "Date: $(date)"
echo "Node.js version: $(node -v)"
echo "Npm version: $(npm -v)"
echo ""

echo "1 - Creating directories..."
mkdir -p /home/node/Matterbridge /home/node/.matterbridge /home/node/.mattercert

echo "2 - Cleaning up workspace..."
npm run deepClean || true

echo "3 - Setting ownership of directories..."
ls .
sudo chown -R node:node .cache node_modules apps/frontend/node_modules /home/node/Matterbridge /home/node/.matterbridge /home/node/.mattercert
sudo chmod +x bin/*.js

sudo mkdir -p /home/node/.claude /home/node/.codex
sudo chown -R node:node /home/node/.claude /home/node/.codex

echo "4 - Installing dependencies..."
npm install --no-fund --no-audit

echo "5 - Building the package..."
npm run build

echo "6 - Building the frontend package..."
cd apps/frontend
# Uncomment if you want to reset the frontend before building
# sudo rm -rf build coverage node_modules
npm install --no-fund --no-audit
npm run build
cd ../..

echo "7 - Linking the package globally..."
sudo npm link --no-fund --no-audit

echo "8 - Checking for outdated packages..."
npm outdated || true

echo "9 - Setup completed!"
