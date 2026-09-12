#!/usr/bin/env bash
#
# Install Node.js (from the official tarball) and Bun on a Debian/Ubuntu container.
#
# Usage inside a container (runs as root):
#   curl -fsSL https://matterbridge.io/scripts/install-debian.sh | bash
#   curl -fsSL https://matterbridge.io/scripts/install-debian.sh | NODE_VERSION=24.10.0 TZ=Europe/Rome bash
#
# NODE_VERSION defaults to "latest" (newest release on nodejs.org/dist, not necessarily LTS).
# TZ defaults to Europe/Brussels (CET/CEST). Legacy zone names like "CET" are not in Debian 13's
# base tzdata package, so use region zones.
#
# One-shot container, script from a local copy, interactive shell afterwards:
#   docker run -it --rm --pull always --hostname debian --name debian --network host \
#     -v /c/Users/lligu/GitHub/matterbridge/docs/scripts:/scripts:ro debian:latest \
#     bash -c '/scripts/install-debian.sh; exec bash'
#
# Same, script fetched from the network (the base image has no curl yet):
#   docker run -it --rm --pull always --hostname debian --name debian --network host debian:latest \
#     bash -c 'apt-get update && apt-get install -y curl && curl -fsSL https://matterbridge.io/scripts/install-debian.sh | bash; exec bash'
#
# Drop the trailing "; exec bash" (and -it) to run the script and exit.
#

set -euo pipefail

NODE_VERSION="${NODE_VERSION:-latest}"
TZ="${TZ:-Europe/Brussels}"

export DEBIAN_FRONTEND=noninteractive
export TZ

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  command -v sudo >/dev/null 2>&1 || { echo "This script needs root or sudo." >&2; exit 1; }
  SUDO="sudo"
fi

echo "==> Installing prerequisites"
$SUDO apt-get update
$SUDO apt-get install -y --no-install-recommends tzdata curl ca-certificates xz-utils libatomic1 unzip

echo "==> Setting timezone to $TZ"
[ -f "/usr/share/zoneinfo/$TZ" ] || { echo "Unknown timezone: $TZ" >&2; exit 1; }
$SUDO ln -fs "/usr/share/zoneinfo/$TZ" /etc/localtime
$SUDO dpkg-reconfigure -f noninteractive tzdata

if [ "$NODE_VERSION" = "latest" ]; then
  NODE_VERSION="$(curl -fsSL https://nodejs.org/dist/index.json | grep -o '"version":"v[^"]*"' | sed -n '1s/.*"v//; 1s/"//p')"
  [ -n "$NODE_VERSION" ] || { echo "Could not resolve the latest Node.js version." >&2; exit 1; }
fi

ARCH="$(uname -m | sed 's/x86_64/x64/; s/aarch64/arm64/; s/armv7l/armv7l/')"

echo "==> Installing Node.js v$NODE_VERSION ($ARCH)"
curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${ARCH}.tar.xz" -o /tmp/node.tar.xz
$SUDO tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1
rm -f /tmp/node.tar.xz

echo "==> Installing Bun"
curl -fsSL https://bun.com/install | bash
export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
export PATH="$BUN_INSTALL/bin:$PATH"

echo "==> Versions"
node -v
npm -v
bun --version

echo
echo "Open a new shell or run: source ~/.bashrc   (to get bun on PATH)"
