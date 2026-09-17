#!/bin/sh
#
# Install Node.js (from the Alpine repositories) and Bun on an Alpine container.
#
# Start with POSIX sh because the base image has no Bash; this script installs it.
#
# Usage inside a container (runs as root):
#   curl -fsSL https://matterbridge.io/scripts/install-alpine.sh | sh
#   curl -fsSL https://matterbridge.io/scripts/install-alpine.sh | TZ=Europe/Rome sh
#
# Node.js comes from apk, so its version is whatever the running Alpine release ships.
# TZ defaults to Europe/Brussels (CET/CEST); legacy zone names like "CET" are not shipped,
# so use region zones.
#
# Run from the repository root: local script, interactive shell afterwards:
#   docker run -it --rm --pull always --hostname alpine --name alpine --network host -v "${PWD}/docs/scripts:/scripts:ro" alpine:latest sh -c 'sh /scripts/install-alpine.sh && exec bash'
#
# Same, script fetched from the network:
#   docker run -it --rm --pull always --hostname alpine --name alpine --network host alpine:latest sh -c 'apk add --no-cache curl && curl -fsSL https://matterbridge.io/scripts/install-alpine.sh | sh && exec bash'
#
# Re-enter the running container with Bash to load the saved Bun environment:
#   docker exec -it alpine bash
#
# Drop the trailing "&& exec bash" (and -it) to run the script and exit.
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

# Load the persisted system timezone in new interactive Bash shells.
TZ_PROFILE_EXPORT='export TZ="$(cat /etc/timezone)"'
if ! grep -Fqx "$TZ_PROFILE_EXPORT" "$HOME/.bashrc" 2>/dev/null; then
  printf '\n%s\n' "$TZ_PROFILE_EXPORT" >> "$HOME/.bashrc"
fi

echo "==> Installing Node.js and npm from the Alpine repositories"
$SUDO apk add --no-cache nodejs npm

echo "==> Installing Bun"
export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
curl -fsSL https://bun.com/install | bash
export PATH="$BUN_INSTALL/bin:$PATH"

# Persist the install directory for interactive Bash shells.
# Single-quote the value so spaces and shell metacharacters remain literal.
BUN_PROFILE_EXPORT="export BUN_INSTALL='$(printf '%s' "$BUN_INSTALL" | sed "s/'/'\\\\''/g")'"
if ! grep -Fqx "$BUN_PROFILE_EXPORT" "$HOME/.bashrc" 2>/dev/null; then
  {
    printf '\n# Bun environment for Alpine shells\n%s\n' "$BUN_PROFILE_EXPORT"
    cat <<'EOF'
case ":$PATH:" in
  *":$BUN_INSTALL/bin:"*) ;;
  *) export PATH="$BUN_INSTALL/bin:$PATH" ;;
esac
EOF
  } >> "$HOME/.bashrc"
fi

echo "==> Versions"
node -v
npm -v
bun --version

echo
echo 'Run: . "$HOME/.bashrc"   (to load Bun in the current shell), or open a new Bash shell'
