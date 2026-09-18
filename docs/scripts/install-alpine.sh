#!/bin/sh
#
# Install Node.js (from the Alpine repositories) and Bun on an Alpine container.
#
# Start with POSIX sh because the base image has no Bash; this script installs it.
#
# Usage inside a container (runs as root):
#   curl -4 -fsSL https://matterbridge.io/scripts/install-alpine.sh | sh
#   curl -4 -fsSL https://matterbridge.io/scripts/install-alpine.sh | TZ=Europe/Rome sh
#
# Node.js comes from apk, so its version is whatever the running Alpine release ships.
# TZ defaults to Europe/Brussels (CET/CEST); legacy zone names like "CET" are not shipped,
# so use region zones.
# Curl downloads use IPv4 to avoid failing IPv6 connections in Docker on macOS.
#
# The install runs once and records INSTALL_STAMP (default /var/lib/matterbridge-install.done);
# a later run with the stamp present skips straight to the container command. Delete the stamp
# file to force a reinstall. Any arguments after the script are exec'd once the install is done,
# which makes the script usable as a container entrypoint. Piped runs pass no arguments, so they
# install and exit as before.
#
# Run from the repository root: local script as entrypoint, interactive shell afterwards.
#   docker run -it --pull always --hostname alpine --name alpine --network host -v "${PWD}/docs/scripts:/scripts:ro" --entrypoint sh alpine:latest /scripts/install-alpine.sh bash
#
# Restart that container later: the stamp is still there, so only the shell starts.
#   docker start -ai alpine
#
# Same, script fetched from the network. The stamp check guards the prelude as well, so a restart
# skips apk and curl; "_" stands in for $0, which leaves the trailing arguments as "$@" for the
# final exec:
#   docker run -it --pull always --hostname alpine --name alpine --network host --entrypoint sh alpine:latest -c 'if [ ! -e /var/lib/matterbridge-install.done ]; then apk add --no-cache curl && curl -4 -fsSL https://matterbridge.io/scripts/install-alpine.sh | sh || exit 1; fi; exec "$@"' _ bash
#
# Re-enter the running container with Bash to load the saved Bun environment:
#   docker exec -it alpine bash
#
# Drop the trailing command argument (and -it) to run the script and exit.
#

set -eu

TZ="${TZ:-Europe/Brussels}"
INSTALL_STAMP="${INSTALL_STAMP:-/var/lib/matterbridge-install.done}"
export TZ

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  command -v sudo >/dev/null 2>&1 || { echo "This script needs root or sudo." >&2; exit 1; }
  SUDO="sudo"
fi

if [ -e "$INSTALL_STAMP" ]; then
  echo "==> Already installed ($INSTALL_STAMP), skipping the installation"
else
  echo "==> Installing prerequisites"
  $SUDO apk add --no-cache ca-certificates curl tzdata unzip bash libstdc++ libgcc iproute2

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
  curl -4 -fsSL https://bun.com/install | bash
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

  # Record the completed installation so a restarted container skips it.
  $SUDO mkdir -p "$(dirname "$INSTALL_STAMP")"
  $SUDO touch "$INSTALL_STAMP"

  echo "==> Versions"
  node -v
  npm -v
  bun --version

  echo
  echo 'Run: . "$HOME/.bashrc"   (to load Bun in the current shell), or open a new Bash shell'
fi

# Entrypoint mode: hand control to the container command when one was given.
if [ "$#" -gt 0 ]; then
  exec "$@"
fi
