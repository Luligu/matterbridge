#!/usr/bin/env bash

# postCreateCommand.sh

# This script runs after the Dev Container is created to set up the dev container environment.

set -euo pipefail

echo "Welcome to Matterbridge Dev Container"
DISTRO=$(awk -F= '/^PRETTY_NAME=/{gsub(/"/, "", $2); print $2}' /etc/os-release)
CODENAME=$(awk -F= '/^VERSION_CODENAME=/{print $2}' /etc/os-release)
echo "Distro: $DISTRO ($CODENAME)"
echo "User: $(whoami)"
echo "Hostname: $(hostname)"
echo "Architecture: $(uname -m)"
echo "Kernel Version: $(uname -r)"
echo "Uptime: $(uptime -p || echo 'unavailable')"
echo "Date: $(date)"
echo "Node.js version: $(node -v)"
echo "Npm version: $(npm -v)"
echo ""

echo "1 - Installing updates and scripts..."
npm install --global --no-fund --no-audit npm npm-check-updates shx cross-env 

echo "2 - Creating directories..."
mkdir -p /home/node/Matterbridge /home/node/.matterbridge /home/node/.mattercert

echo "3 - Setting ownership of directories..."
sudo chown -R node:node . /home/node/Matterbridge /home/node/.matterbridge /home/node/.mattercert

echo "4 - Building the package..."
npm install --no-fund --no-audit
npm run build
npm link --no-fund --no-audit
npm outdated || true

echo "5 - Setup completed!"
