#!/usr/bin/env bash
#
# Install Node.js (from the official tarball) and Bun on a Debian/Ubuntu container.
#
# Usage inside a container (runs as root):
#   curl -fsSL https://matterbridge.io/scripts/install-debian.sh | bash
#   curl -fsSL https://matterbridge.io/scripts/install-debian.sh | NODE_VERSION=24.10.0 TZ=Europe/Rome bash
#
# NODE_VERSION defaults to "lts" (newest Active/Maintenance LTS release). Use "latest" for the
# newest release of any line, or an explicit version like 24.10.0.
# TZ defaults to Europe/Brussels (CET/CEST). Legacy zone names like "CET" are not in Debian 13's
# base tzdata package, so use region zones.
# New Bash shells retain TZ and use noninteractive package configuration defaults.
#
# Run from the repository root: local script, interactive shell afterwards:
#   docker run -it --rm --pull always --hostname debian --name debian --network host -v "${PWD}/docs/scripts:/scripts:ro" debian:latest bash -c 'bash /scripts/install-debian.sh && exec bash'
#   docker run -it --rm --pull always --hostname ubuntu --name ubuntu --network host -v "${PWD}/docs/scripts:/scripts:ro" ubuntu:latest bash -c 'bash /scripts/install-debian.sh && exec bash'
#
# Same, script fetched from the network (the base image has no curl yet):
#   docker run -it --rm --pull always --hostname debian --name debian --network host debian:latest bash -c 'apt-get update && apt-get install -y curl && curl -fsSL https://matterbridge.io/scripts/install-debian.sh | bash && exec bash'
#   docker run -it --rm --pull always --hostname ubuntu --name ubuntu --network host ubuntu:latest bash -c 'apt-get update && apt-get install -y curl && curl -fsSL https://matterbridge.io/scripts/install-debian.sh | bash && exec bash'
#
# Re-enter the running container with an interactive Bash shell to load Bun:
#   docker exec -it debian bash
# Re-enter the running Ubuntu container with an interactive Bash shell to load Bun:
#   docker exec -it ubuntu bash
#
# Drop the trailing "&& exec bash" (and -it) to run the script and exit.
#

set -euo pipefail

NODE_VERSION="${NODE_VERSION:-lts}"
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
    curl -fsSL https://nodejs.org/dist/index.json -o /tmp/node-index.json
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
curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${ARCH}.tar.xz" -o /tmp/node.tar.xz
$SUDO tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1
rm -f /tmp/node.tar.xz

echo "==> Installing Bun"
export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
curl -fsSL https://bun.com/install | bash
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

echo "==> Versions"
node -v
npm -v
bun --version

echo
echo "Open a new shell or run: source ~/.bashrc   (to get bun on PATH)"
