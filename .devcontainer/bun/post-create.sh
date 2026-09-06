#!/usr/bin/env bash

# .devcontainer/bun/post-create.sh v.2.1.0

# This script runs after the Dev Container is created to set up the dev container environment.

set -euo pipefail

echo $'\033[36m'"[$(date '+%Y-%m-%d %H:%M:%S')]"$'\033[0m' "Running Matterbridge Bun Dev Container post-create.sh..."

# Ensure required directories exist and are owned by the current user
workspace_paths=("$PWD/node_modules" "$PWD/apps/frontend/node_modules" "$PWD/.cache")
home_paths=("$HOME/Matterbridge" "$HOME/.matterbridge" "$HOME/.mattercert" "$HOME/.claude" "$HOME/.codex" "$HOME/.agents" "$HOME/.bash-cache" "$HOME/.npm" "$HOME/.bun" "$HOME/.bun/install/cache")

echo $'\033[36m'"[$(date '+%Y-%m-%d %H:%M:%S')]"$'\033[0m' "1.post-create - Creating directories..."
sudo mkdir -p "${workspace_paths[@]}" "${home_paths[@]}" # Create directories if they don't exist

echo $'\033[36m'"[$(date '+%Y-%m-%d %H:%M:%S')]"$'\033[0m' "2.post-create - Setting permissions..."
# Only chown paths that are not already owned by the current user. The image pre-creates the
# home paths, so fresh volumes are seeded correctly and this is a no-op; the workspace volumes
# still need it on first create, but they are empty then, so the recursion is instant.
for path in . "${workspace_paths[@]}" "${home_paths[@]}"; do
  if [ "$(stat -c %u "$path")" != "$(id -u)" ]; then
    sudo chown -R "$(id -u):$(id -g)" "$path" # Transfer ownership to the current user
  fi
done

echo $'\033[36m'"[$(date '+%Y-%m-%d %H:%M:%S')]"$'\033[0m' "3.post-create - Post create setup completed!"
