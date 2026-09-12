#!/bin/sh
#
# Install Node.js (from the Alpine repositories) and Bun on an Alpine container.
#
# POSIX sh on purpose: the alpine image has no bash, so this must run with "sh".
#
# Usage inside a container (runs as root):
#   curl -fsSL https://matterbridge.io/scripts/install-alpine.sh | sh
#   curl -fsSL https://matterbridge.io/scripts/install-alpine.sh | TZ=Europe/Rome sh
#
# Node.js comes from apk, so its version is whatever the running Alpine release ships.
# TZ defaults to Europe/Brussels (CET/CEST); legacy zone names like "CET" are not shipped,
# so use region zones.
#
# One-shot container, script from a local copy, interactive shell afterwards:
#   docker run -it --rm --pull always --hostname alpine --name alpine --network host \
#     -v /c/Users/lligu/GitHub/matterbridge/docs/scripts:/scripts:ro alpine:latest \
#     sh -c '/scripts/install-alpine.sh; exec sh'
#
# Same, script fetched from the network:
#   docker run -it --rm --pull always --hostname alpine --name alpine --network host alpine:latest \
#     sh -c 'apk add --no-cache curl && curl -fsSL https://matterbridge.io/scripts/install-alpine.sh | sh; exec sh'
#
# Drop the trailing "; exec sh" (and -it) to run the script and exit.
#

set -eu

TZ="${TZ:-Europe/Brussels}"
export TZ

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  command -v sudo >/dev/null 2>&1 || { echo "This script needs root or sudo." >&2; exit 1; }
  SUDO="sudo"
fi

echo "==> Installing prerequisites"
$SUDO apk add --no-cache ca-certificates curl tzdata unzip bash libstdc++ libgcc

echo "==> Setting timezone to $TZ"
[ -f "/usr/share/zoneinfo/$TZ" ] || { echo "Unknown timezone: $TZ" >&2; exit 1; }
$SUDO ln -fs "/usr/share/zoneinfo/$TZ" /etc/localtime
echo "$TZ" | $SUDO tee /etc/timezone >/dev/null

echo "==> Installing Node.js and npm from the Alpine repositories"
$SUDO apk add --no-cache nodejs npm

echo "==> Installing Bun"
curl -fsSL https://bun.com/install | bash
export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
export PATH="$BUN_INSTALL/bin:$PATH"

echo "==> Versions"
node -v
npm -v
bun --version

echo
echo "Open a new shell or run: export PATH=\"\$HOME/.bun/bin:\$PATH\"   (to get bun on PATH in sh)"
