#!/usr/bin/env bash

set -euo pipefail

echo "Running Matterbridge Node Dev Container post-create.sh..."

# Ensure required directories exist and are owned by the current user
workspace_paths=("$PWD/node_modules" "$PWD/apps/frontend/node_modules" "$PWD/.cache")
home_paths=("$HOME/Matterbridge" "$HOME/.matterbridge" "$HOME/.mattercert" "$HOME/.claude" "$HOME/.codex" "$HOME/.agents" "$HOME/.bash-cache" "$HOME/.npm" "$HOME/.bun" "$HOME/.bun/install/cache")

echo "1.post-create - Creating directories..."
sudo mkdir -p "${workspace_paths[@]}" "${home_paths[@]}" # Create directories if they don't exist

echo "2.post-create - Setting permissions..."
sudo chown -R "$(id -u):$(id -g)" "${workspace_paths[@]}" "${home_paths[@]}" # Transfer ownership to the current user

echo "3.post-create - Post create setup completed!"
