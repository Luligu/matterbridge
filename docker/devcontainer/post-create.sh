#!/usr/bin/env bash

# docker/devcontainer/post-create.sh v.2.1.1

# This script runs after the Dev Container is created to set up the dev container environment.

set -euo pipefail

MODE=""
PLUGIN=false

for arg in "$@"; do
  case "$arg" in
    --bun)
      MODE="bun"
      ;;
    --node)
      MODE="node"
      ;;
    --plugin)
      PLUGIN=true
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: post-create.sh <--bun|--node> [--plugin]" >&2
      exit 1
      ;;
  esac
done

if [ -z "$MODE" ]; then
  echo "Usage: post-create.sh <--bun|--node> [--plugin]" >&2
  exit 1
fi

TARGET="project"
if [ "$PLUGIN" = true ]; then
  TARGET="plugin"
  echo "Welcome to Matterbridge Plugin Dev Container (post-create.sh)"
else
  echo "Welcome to Matterbridge Dev Container (post-create.sh)"
fi

DISTRO=$(awk -F= '/^PRETTY_NAME=/{gsub(/"/, "", $2); print $2}' /etc/os-release)
CODENAME=$(awk -F= '/^VERSION_CODENAME=/{print $2}' /etc/os-release)
echo "Distro: $DISTRO ($CODENAME)"
echo "User: $(whoami)"
echo "Hostname: $(hostname)"
echo "Architecture: $(uname -m)"
echo "Kernel Version: $(uname -r)"
echo "Uptime: $(uptime -p || echo 'unavailable')"
echo "Date: $(date)"
if [ "$MODE" = "bun" ]; then
  echo "Bun version: $(bun -v)"
  echo "Bun global cache: ${HOME}/.bun/install/cache"
else
  echo "Node.js version: $(node -v)"
  echo "Npm version: $(npm -v)"
  echo "Npm cache: $(npm config get cache)"
fi
echo ""

STEP=1
step() {
  echo $'\033[36m'"[$(date '+%Y-%m-%d %H:%M:%S')]"$'\033[0m' "${STEP}.post-create - $1"
  STEP=$((STEP + 1))
}

# Ensure required directories exist and are owned by the current user
workspace_paths=("$PWD/node_modules" "$PWD/.cache")
home_paths=("$HOME/.claude" "$HOME/.codex" "$HOME/.gemini" "$HOME/.agents" "$HOME/.bash-cache" "$HOME/.npm" "$HOME/.bun" "$HOME/.bun/install/cache" "$HOME/.vscode-server/extensions")

if [ "$PLUGIN" = true ]; then
  workspace_paths+=("$PWD/apps/frontend/node_modules")
  home_paths+=("$HOME/Matterbridge" "$HOME/.matterbridge" "$HOME/.mattercert")
fi

step "Creating directories..."
sudo mkdir -p "${workspace_paths[@]}" "${home_paths[@]}" # Create directories if they don't exist

step "Setting permissions..."
# Only chown paths that are not already owned by the current user. The image pre-creates the
# home paths, so fresh volumes are seeded correctly and this is a no-op; the workspace volumes
# still need it on first create, but they are empty then, so the recursion is instant.
for path in . "${workspace_paths[@]}" "${home_paths[@]}"; do
  if [ "$(stat -c %u "$path")" != "$(id -u)" ]; then
    sudo chown -R "$(id -u):$(id -g)" "$path" # Transfer ownership to the current user
  fi
done

if [ "$PLUGIN" = true ]; then
  step "Building Matterbridge..."
  # Change dev to main to install the stable branch.
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  INSTALL_SCRIPT="${SCRIPT_DIR}/install-matterbridge.sh"
  if [ ! -f "$INSTALL_SCRIPT" ]; then
    INSTALL_SCRIPT="/usr/local/bin/install-matterbridge.sh"
  fi
  if [ ! -f "$INSTALL_SCRIPT" ]; then
    INSTALL_SCRIPT=".devcontainer/install-matterbridge.sh"
  fi
  bash "$INSTALL_SCRIPT" dev "--$MODE"
fi

step "Installing the ${TARGET} dependencies..."
if [ "$MODE" = "bun" ]; then
  [ -f package-lock.json ] && mv package-lock.json package-lock.json.bak || true
  bun install
  [ -f package-lock.json.bak ] && mv package-lock.json.bak package-lock.json || true
else
  npm install --no-fund --no-audit
fi

if [ "$PLUGIN" = true ]; then
  step "Linking Matterbridge..."
  if [ "$MODE" = "bun" ]; then
    if ! bun link matterbridge; then
      echo "Retrying link with elevated permissions..."
      sudo bun link matterbridge
      sudo chown -R bun:bun ./node_modules
    fi
  else
    if ! npm link matterbridge --no-fund --no-audit; then
      echo "Retrying link with elevated permissions..."
      sudo npm link matterbridge --no-fund --no-audit
      sudo chown -R node:node ./node_modules
    fi
  fi
fi

step "Building the ${TARGET}..."
if [ "$MODE" = "bun" ]; then
  bun run build
else
  npm run build
fi

if [ "$PLUGIN" = true ]; then
  echo $'\033[36m'"[$(date '+%Y-%m-%d %H:%M:%S')]"$'\033[0m' "${STEP}.post-create - Checking for the plugin frontend..."
  if [ -f apps/frontend/package.json ]; then
    echo $'\033[36m'"[$(date '+%Y-%m-%d %H:%M:%S')]"$'\033[0m' "${STEP}.post-create - Building the plugin frontend..."
    cd apps/frontend
    if [ "$MODE" = "bun" ]; then
      [ -f package-lock.json ] && mv package-lock.json package-lock.json.bak || true
      bun install && bun run build
      [ -f package-lock.json.bak ] && mv package-lock.json.bak package-lock.json || true
    else
      npm install --no-fund --no-audit && npm run build
    fi
    cd ../..
  fi
  STEP=$((STEP + 1))

  step "Adding the plugin to Matterbridge..."
  if [ "$MODE" = "bun" ]; then
    bun run add
  else
    npm run add
  fi
fi

step "Checking for outdated packages..."
if [ "$MODE" = "bun" ]; then
  bun outdated || true
else
  npm outdated || true
fi

step "Post create setup completed!"
