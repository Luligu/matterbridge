#!/usr/bin/env bash

# docker/devcontainer/post-start.sh v.2.1.1

# This script runs after the Dev Container is started to set up the dev container environment.

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
      echo "Usage: post-start.sh <--bun|--node> [--plugin]" >&2
      exit 1
      ;;
  esac
done

if [ -z "$MODE" ]; then
  echo "Usage: post-start.sh <--bun|--node> [--plugin]" >&2
  exit 1
fi

TARGET="project"
if [ "$PLUGIN" = true ]; then
  TARGET="plugin"
  echo "Welcome to Matterbridge Plugin Dev Container (post-start.sh)"
else
  echo "Welcome to Matterbridge Dev Container (post-start.sh)"
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
  echo $'\033[36m'"[$(date '+%Y-%m-%d %H:%M:%S')]"$'\033[0m' "${STEP}.post-start - $1"
  STEP=$((STEP + 1))
}

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
  echo $'\033[36m'"[$(date '+%Y-%m-%d %H:%M:%S')]"$'\033[0m' "${STEP}.post-start - Checking for the plugin frontend..."
  if [ -f apps/frontend/package.json ]; then
    echo $'\033[36m'"[$(date '+%Y-%m-%d %H:%M:%S')]"$'\033[0m' "${STEP}.post-start - Building the plugin frontend..."
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
fi

step "Post start setup completed!"
