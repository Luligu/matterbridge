#!/usr/bin/env bash

# .devcontainer/node/post-start.sh v.2.0.0

# This script runs after the Dev Container is started to set up the dev container environment.

set -euo pipefail

echo $'\033[36m'"[$(date '+%Y-%m-%d %H:%M:%S')]"$'\033[0m' "Running Matterbridge Node Dev Container post-start.sh..."

echo $'\033[36m'"[$(date '+%Y-%m-%d %H:%M:%S')]"$'\033[0m' "1.post-start - Installing Matterbridge dependencies..."
npm install --no-fund --no-audit

echo $'\033[36m'"[$(date '+%Y-%m-%d %H:%M:%S')]"$'\033[0m' "2.post-start - Building Matterbridge..."
npm run build

echo $'\033[36m'"[$(date '+%Y-%m-%d %H:%M:%S')]"$'\033[0m' "3.post-start - Linking Matterbridge..."
sudo npm link

cd apps/frontend
echo $'\033[36m'"[$(date '+%Y-%m-%d %H:%M:%S')]"$'\033[0m' "4.post-start - Installing frontend dependencies..."
npm install --no-fund --no-audit

echo $'\033[36m'"[$(date '+%Y-%m-%d %H:%M:%S')]"$'\033[0m' "5.post-start - Building the frontend..."
npm run build
cd ../..

echo $'\033[36m'"[$(date '+%Y-%m-%d %H:%M:%S')]"$'\033[0m' "6.post-start - Post start setup completed!"
