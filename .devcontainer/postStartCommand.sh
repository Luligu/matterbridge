#!/usr/bin/env bash

# postStartCommand.sh

# This script runs after the Dev Container is started to set up the dev container environment.

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

echo "1 - Installing dependencies..."
npm install --no-fund --no-audit

echo "2 - Building the package..."
npm run build

echo "3 - Building the frontend package..."
cd apps/frontend
npm install --no-fund --no-audit
npm run build
cd ../..

echo "4 - Linking the package globally..."
sudo npm link --no-fund --no-audit

echo "5 - Setup completed!"
