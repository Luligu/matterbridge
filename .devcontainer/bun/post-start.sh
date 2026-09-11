#!/usr/bin/env bash

# .devcontainer/bun/post-start.sh v.2.1.0

# This script runs after the Dev Container is started to set up the dev container environment.

set -euo pipefail

echo "Welcome to Matterbridge Dev Container (post-start.sh)"
DISTRO=$(awk -F= '/^PRETTY_NAME=/{gsub(/"/, "", $2); print $2}' /etc/os-release)
CODENAME=$(awk -F= '/^VERSION_CODENAME=/{print $2}' /etc/os-release)
echo "Distro: $DISTRO ($CODENAME)"
echo "User: $(whoami)"
echo "Hostname: $(hostname)"
echo "Architecture: $(uname -m)"
echo "Kernel Version: $(uname -r)"
echo "Uptime: $(uptime -p || echo 'unavailable')"
echo "Date: $(date)"
echo "Bun version: $(bun -v)"
echo "Bun global cache: ${HOME}/.bun/install/cache"
echo ""

echo $'\033[36m'"[$(date '+%Y-%m-%d %H:%M:%S')]"$'\033[0m' "1.post-start - Installing Matterbridge dependencies..."
[ -f package-lock.json ] && mv package-lock.json package-lock.json.bak || true
bun install
[ -f package-lock.json.bak ] && mv package-lock.json.bak package-lock.json || true

echo $'\033[36m'"[$(date '+%Y-%m-%d %H:%M:%S')]"$'\033[0m' "2.post-start - Building Matterbridge..."
bun run build

echo $'\033[36m'"[$(date '+%Y-%m-%d %H:%M:%S')]"$'\033[0m' "3.post-start - Linking Matterbridge..."
# sudo is required because BUN_INSTALL_BIN=/usr/local/bin is root-owned.
# -E preserves HOME so the link registry remains available to the bun user.
sudo -E bun link
sudo chown -R bun:bun /home/bun/.bun

cd apps/frontend
echo $'\033[36m'"[$(date '+%Y-%m-%d %H:%M:%S')]"$'\033[0m' "4.post-start - Installing frontend dependencies..."
[ -f package-lock.json ] && mv package-lock.json package-lock.json.bak || true
bun install
[ -f package-lock.json.bak ] && mv package-lock.json.bak package-lock.json || true

echo $'\033[36m'"[$(date '+%Y-%m-%d %H:%M:%S')]"$'\033[0m' "5.post-start - Building the frontend..."
bun run build
cd ../..

echo $'\033[36m'"[$(date '+%Y-%m-%d %H:%M:%S')]"$'\033[0m' "6.post-start - Post start setup completed!"
