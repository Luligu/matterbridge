#!/usr/bin/env bash

# docker/devcontainer/install-matterbridge.sh v.2.2.0

# This script globally installs Matterbridge from the given branch (main or dev).
# To be used only inside the Dev Container with the mounted matterbridge volume.

set -euo pipefail

MODE=""
BRANCH=""

for arg in "$@"; do
  case "$arg" in
    --bun)
      MODE="bun"
      ;;
    --node)
      MODE="node"
      ;;
    main|dev)
      BRANCH="$arg"
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: install-matterbridge.sh <main|dev> <--bun|--node>" >&2
      exit 1
      ;;
  esac
done

if [ -z "$BRANCH" ] || [ -z "$MODE" ]; then
  echo "Usage: install-matterbridge.sh <main|dev> <--bun|--node>" >&2
  exit 1
fi

echo $'\033[36m'"[$(date '+%Y-%m-%d %H:%M:%S')]"$'\033[0m' "1.install-matterbridge - Installing Matterbridge from the $BRANCH branch..."
if [ ! -d "/workspaces" ]; then
  echo "Directory /workspaces does not exist. Exiting."
  exit 1
fi
cd /workspaces

echo $'\033[36m'"[$(date '+%Y-%m-%d %H:%M:%S')]"$'\033[0m' "2.install-matterbridge - Preparing Matterbridge directory..."
if [ "$(stat -c %u matterbridge)" != "$(id -u)" ]; then
  sudo chown -R "$(id -u):$(id -g)" matterbridge
fi
sudo chmod g+s matterbridge
sudo rm -rf matterbridge/* matterbridge/.[!.]* matterbridge/..?*

echo $'\033[36m'"[$(date '+%Y-%m-%d %H:%M:%S')]"$'\033[0m' "3.install-matterbridge - Cloning Matterbridge from the $BRANCH branch..."
# Shallow clone for speed (history not needed inside dev container). Remove --depth if full history required.
git clone --depth 1 --single-branch --no-tags -b "$BRANCH" https://github.com/Luligu/matterbridge.git matterbridge
cd matterbridge

if [ "$MODE" = "bun" ]; then
  echo $'\033[36m'"[$(date '+%Y-%m-%d %H:%M:%S')]"$'\033[0m' "4.install-matterbridge - Setting Matterbridge version..."
  bun scripts/version.mjs git

  echo $'\033[36m'"[$(date '+%Y-%m-%d %H:%M:%S')]"$'\033[0m' "5.install-matterbridge - Installing Matterbridge dependencies and building..."
  rm -f package-lock.json && bun install && bun run build

  echo $'\033[36m'"[$(date '+%Y-%m-%d %H:%M:%S')]"$'\033[0m' "6.install-matterbridge - Installing Matterbridge frontend dependencies and building..."
  cd apps/frontend && rm -f package-lock.json && bun install && bun run build && cd ../..

  echo $'\033[36m'"[$(date '+%Y-%m-%d %H:%M:%S')]"$'\033[0m' "7.install-matterbridge - Installing Matterbridge globally..."
  # sudo is required because BUN_INSTALL_BIN=/usr/local/bin is root-owned.
  # -E preserves HOME so the link registry is written under the bun user's
  # home instead of root's, keeping it visible to the non-sudo "bun link"
  # calls in post-create.sh/post-start.sh.
  sudo -E bun link
  sudo chown -R bun:bun /home/bun/.bun
else
  echo $'\033[36m'"[$(date '+%Y-%m-%d %H:%M:%S')]"$'\033[0m' "4.install-matterbridge - Setting Matterbridge version..."
  node scripts/version.mjs git

  echo $'\033[36m'"[$(date '+%Y-%m-%d %H:%M:%S')]"$'\033[0m' "5.install-matterbridge - Installing Matterbridge dependencies and building..."
  npm ci --no-fund --no-audit && npm run build

  echo $'\033[36m'"[$(date '+%Y-%m-%d %H:%M:%S')]"$'\033[0m' "6.install-matterbridge - Installing Matterbridge frontend dependencies and building..."
  cd apps/frontend && npm ci --no-fund --no-audit && npm run build && cd ../..

  echo $'\033[36m'"[$(date '+%Y-%m-%d %H:%M:%S')]"$'\033[0m' "7.install-matterbridge - Installing Matterbridge globally..."
  sudo npm link --no-fund --no-audit
fi

sudo rm -rf .agents .antigravity .cache .claude .codex .devcontainer .git .github .vscode docker docs reflector screenshots scripts systemd

echo $'\033[36m'"[$(date '+%Y-%m-%d %H:%M:%S')]"$'\033[0m' "8.install-matterbridge - Matterbridge has been installed from the $BRANCH branch."
