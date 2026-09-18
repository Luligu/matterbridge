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
# Set the setgid bit so everything created inside the mounted volume inherits its
# group, keeping the cloned tree group-accessible regardless of the creator's umask.
sudo chmod g+s matterbridge
# sudo rm -rf matterbridge/* matterbridge/.[!.]* matterbridge/..?*

echo $'\033[36m'"[$(date '+%Y-%m-%d %H:%M:%S')]"$'\033[0m' "3.install-matterbridge - Cloning Matterbridge from the $BRANCH branch..."
# "git clone" refuses a non-empty target, so the repository is fetched in place instead:
# on the first run (or after a wipe) the directory is emptied and initialized, on later
# runs only the new commits are fetched and the working tree is reset onto them. That
# keeps node_modules and the previous build output, which is what makes a re-install fast.
if [ ! -d matterbridge/.git ]; then
  sudo rm -rf matterbridge/* matterbridge/.[!.]* matterbridge/..?*
  git init -q -b "$BRANCH" matterbridge
  git -C matterbridge remote add origin https://github.com/Luligu/matterbridge.git
fi
# Shallow fetch for speed (history not needed inside dev container). Remove --depth if full history required.
git -C matterbridge fetch --depth 1 --no-tags origin "$BRANCH"
# -f/-B discards local edits and moves the branch onto the fetched commit, so files changed
# or deleted upstream are handled; clean removes stale untracked leftovers (for example a
# previous build output) while preserving the installed dependencies.
git -C matterbridge checkout -f -B "$BRANCH" FETCH_HEAD
git -C matterbridge clean -qxdf -e node_modules -e apps/frontend/node_modules
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
  npm install --no-fund --no-audit && npm run build

  echo $'\033[36m'"[$(date '+%Y-%m-%d %H:%M:%S')]"$'\033[0m' "6.install-matterbridge - Installing Matterbridge frontend dependencies and building..."
  cd apps/frontend && npm install --no-fund --no-audit && npm run build && cd ../..

  echo $'\033[36m'"[$(date '+%Y-%m-%d %H:%M:%S')]"$'\033[0m' "7.install-matterbridge - Installing Matterbridge globally..."
  sudo npm link --no-fund --no-audit
fi

# sudo rm -rf .agents .antigravity .cache .claude .codex .devcontainer .git .github .vscode docker docs reflector screenshots scripts systemd

echo $'\033[36m'"[$(date '+%Y-%m-%d %H:%M:%S')]"$'\033[0m' "8.install-matterbridge - Matterbridge has been installed from the $BRANCH branch."
