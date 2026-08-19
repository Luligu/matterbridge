#!/usr/bin/env bash

set -euo pipefail

echo "Running Matterbridge Bun Dev Container post-start.sh..."

echo "1.post-start - Installing Matterbridge dependencies..."
bun install

echo "2.post-start - Building Matterbridge..."
bun run build

echo "3.post-start - Linking Matterbridge..."
# sudo is required because BUN_INSTALL_BIN=/usr/local/bin is root-owned.
# -E preserves HOME so the link registry remains available to the bun user.
sudo -E bun link
sudo chown -R bun:bun /home/bun/.bun

cd apps/frontend
echo "4.post-start - Installing frontend dependencies..."
bun install

echo "5.post-start - Building the frontend..."
bun run build
cd ../..

echo "6.post-start - Post start setup completed!"
