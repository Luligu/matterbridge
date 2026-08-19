#!/usr/bin/env bash

set -euo pipefail

echo "Running Matterbridge Node Dev Container post-start.sh..."

echo "1.post-start - Installing Matterbridge dependencies..."
npm install --no-fund --no-audit

echo "2.post-start - Building Matterbridge..."
npm run build

echo "3.post-start - Linking Matterbridge..."
sudo npm link

cd apps/frontend
echo "4.post-start - Installing frontend dependencies..."
npm install --no-fund --no-audit

echo "5.post-start - Building the frontend..."
npm run build
cd ../..

echo "6.post-start - Post start setup completed!"
