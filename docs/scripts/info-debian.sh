#!/usr/bin/env bash
#
# Print the environment banner of a Debian/Ubuntu container.
#
# Usage inside a container:
#   bash /scripts/info-debian.sh
#   curl -4 -fsSL https://matterbridge.io/scripts/info-debian.sh | bash
#
# install-debian.sh installs this script to INFO_SCRIPT (default /usr/local/bin/info-debian.sh)
# and calls it from ~/.bashrc, so every new interactive Bash shell prints the banner.
# The runtime lines are selected from the commands actually present, so the same script covers
# Node.js only, Bun only, and images that ship both.
#

set -euo pipefail

DISTRO=$(awk -F= '/^PRETTY_NAME=/{gsub(/"/, "", $2); print $2}' /etc/os-release)
CODENAME=$(awk -F= '/^VERSION_CODENAME=/{print $2}' /etc/os-release)
echo "🖥️ Distro: $DISTRO ($CODENAME)"
echo "🧱 Architecture: $(uname -m)"
echo "🧩 Kernel Version: $(uname -r)"
echo "👤 User: $(whoami)"
echo "🏷️ Hostname: $(hostname)"
echo "📅 Date: $(date)"

# Bun based images ship a "node" (and sometimes "npm") shim that forwards to bun, so the presence
# of the command is not enough: accept it only when it answers with a real version string.
NODE_VERSION_OUTPUT="$(node -v 2>/dev/null || true)"
case "$NODE_VERSION_OUTPUT" in
  v[0-9]*)
    echo "🟢 Node.js version: $NODE_VERSION_OUTPUT"
    echo "📍 Node.js location: $(command -v node)"
    NPM_VERSION_OUTPUT="$(npm -v 2>/dev/null || true)"
    case "$NPM_VERSION_OUTPUT" in
      [0-9]*)
        echo "🟣 Npm version: $NPM_VERSION_OUTPUT"
        echo "📦 Npm global prefix: $(npm root -g)"
        ;;
    esac
    ;;
esac

if command -v bun >/dev/null 2>&1; then
  echo "🥟 Bun version: $(bun -v)"
  echo "📍 Bun location: $(command -v bun)"
  echo "📦 Bun global prefix: ${BUN_INSTALL:-$HOME/.bun}/install/global/node_modules"
fi
