#!/usr/bin/env bash
#
# Install Node.js (from the official tarball) and Bun on a Debian/Ubuntu container.
#
# Usage inside a container (runs as root):
#   curl -4 -fsSL https://matterbridge.io/scripts/install-debian.sh | bash
#   curl -4 -fsSL https://matterbridge.io/scripts/install-debian.sh | NODE_VERSION=24.10.0 TZ=Europe/Rome bash
#
# NODE_VERSION defaults to "lts" (newest Active/Maintenance LTS release). Use "latest" for the
# newest release of any line, or an explicit version like 24.10.0.
# TZ defaults to Europe/Brussels (CET/CEST). Legacy zone names like "CET" are not in Debian 13's
# base tzdata package, so use region zones.
# Downloads use IPv4 to avoid failing IPv6 connections in Docker on macOS.
# New Bash shells retain TZ and use noninteractive package configuration defaults.
#
# The install runs once and records INSTALL_STAMP (default /var/lib/matterbridge-install.done);
# a later run with the stamp present skips straight to the container command. Delete the stamp
# file to force a reinstall. Any arguments after the script are exec'd once the install is done,
# which makes the script usable as a container entrypoint. Piped runs pass no arguments, so they
# install and exit as before.
#
# Run from the repository root: local script as entrypoint, interactive shell afterwards.
#   docker run -it --pull always --hostname debian --name debian --network host -v "${PWD}/docs/scripts:/scripts:ro" --entrypoint bash debian:latest /scripts/install-debian.sh bash
#   docker run -it --pull always --hostname ubuntu --name ubuntu --network host -v "${PWD}/docs/scripts:/scripts:ro" --entrypoint bash ubuntu:latest /scripts/install-debian.sh bash
#
# Restart that container later: the stamp is still there, so only the shell starts.
#   docker start -ai debian
#   docker start -ai ubuntu
#
# Same, script fetched from the network (the base image has no curl yet). The stamp check guards
# the prelude as well, so a restart skips apt-get and curl; "_" stands in for $0, which leaves the
# trailing arguments as "$@" for the final exec:
#   docker run -it --pull always --hostname debian --name debian --network host --entrypoint bash debian:latest -c 'if [ ! -e /var/lib/matterbridge-install.done ]; then apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && curl -4 -fsSL https://matterbridge.io/scripts/install-debian.sh | bash || exit 1; fi; exec "$@"' _ bash
#   docker run -it --pull always --hostname ubuntu --name ubuntu --network host --entrypoint bash ubuntu:latest -c 'if [ ! -e /var/lib/matterbridge-install.done ]; then apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && curl -4 -fsSL https://matterbridge.io/scripts/install-debian.sh | bash || exit 1; fi; exec "$@"' _ bash
#
# Re-enter the running container with an interactive Bash shell to load Bun:
#   docker exec -it debian bash
# Re-enter the running Ubuntu container with an interactive Bash shell to load Bun:
#   docker exec -it ubuntu bash
#
# Drop the trailing command argument (and -it) to run the script and exit.
#

set -euo pipefail

NODE_VERSION="${NODE_VERSION:-lts}"
TZ="${TZ:-Europe/Brussels}"
INSTALL_STAMP="${INSTALL_STAMP:-/var/lib/matterbridge-install.done}"

export DEBIAN_FRONTEND=noninteractive
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
  $SUDO apt-get update
  $SUDO apt-get install -y --no-install-recommends tzdata curl ca-certificates xz-utils libatomic1 unzip iproute2

  echo "==> Setting timezone to $TZ"
  [ -f "/usr/share/zoneinfo/$TZ" ] || { echo "Unknown timezone: $TZ" >&2; exit 1; }
  $SUDO ln -fs "/usr/share/zoneinfo/$TZ" /etc/localtime
  $SUDO dpkg-reconfigure -f noninteractive tzdata
  printf '%s\n' "$TZ" | $SUDO tee /etc/timezone >/dev/null

  # Keep package configuration noninteractive in new Bash shells.
  # Read TZ from the persisted system setting so timezone changes remain effective.
  for SHELL_EXPORT in 'export DEBIAN_FRONTEND=noninteractive' 'export TZ="$(cat /etc/timezone)"'; do
    if ! grep -Fqx "$SHELL_EXPORT" "$HOME/.bashrc" 2>/dev/null; then
      printf '\n%s\n' "$SHELL_EXPORT" >> "$HOME/.bashrc"
    fi
  done

  case "$NODE_VERSION" in
    lts | latest)
      curl -4 -fsSL https://nodejs.org/dist/index.json -o /tmp/node-index.json
      if [ "$NODE_VERSION" = "lts" ]; then
        # First entry whose "lts" field is a codename string rather than false.
        NODE_VERSION="$(sed -n '/"lts":"/{s/.*"version":"v\([^"]*\)".*/\1/p;q;}' /tmp/node-index.json)"
      else
        NODE_VERSION="$(sed -n '/"version":"v/{s/.*"version":"v\([^"]*\)".*/\1/p;q;}' /tmp/node-index.json)"
      fi
      rm -f /tmp/node-index.json
      [ -n "$NODE_VERSION" ] || { echo "Could not resolve the Node.js version." >&2; exit 1; }
      ;;
  esac

  ARCH="$(uname -m | sed 's/x86_64/x64/; s/aarch64/arm64/; s/armv7l/armv7l/')"

  echo "==> Installing Node.js v$NODE_VERSION ($ARCH)"
  curl -4 -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${ARCH}.tar.xz" -o /tmp/node.tar.xz
  $SUDO tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1
  rm -f /tmp/node.tar.xz

  echo "==> Installing Bun"
  export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
  curl -4 -fsSL https://bun.com/install | bash
  export PATH="$BUN_INSTALL/bin:$PATH"

  # Persist the install directory for interactive Bash shells, including custom BUN_INSTALL paths.
  # Single-quote the value so spaces and shell metacharacters remain literal.
  BUN_PROFILE_EXPORT="export BUN_INSTALL='$(printf '%s' "$BUN_INSTALL" | sed "s/'/'\\\\''/g")'"
  if ! grep -Fqx "$BUN_PROFILE_EXPORT" "$HOME/.bashrc" 2>/dev/null; then
    {
      printf '\n# Bun environment for Debian/Ubuntu interactive Bash shells\n%s\n' "$BUN_PROFILE_EXPORT"
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
  echo "Open a new shell or run: source ~/.bashrc   (to get bun on PATH)"
fi

# Entrypoint mode: hand control to the container command when one was given.
if [ "$#" -gt 0 ]; then
  exec "$@"
fi
