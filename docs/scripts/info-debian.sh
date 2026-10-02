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
echo "⏳ Uptime: $(uptime -p 2>/dev/null || echo 'unavailable')"
if command -v free >/dev/null 2>&1; then
  echo "🧠 Memory: $(free -h | awk '/^Mem:/{print $3 " / " $2}')"
else
  echo "🧠 Memory: unavailable"
fi
echo "🌐 IPv4: $(ip -4 route get 1 2>/dev/null | awk '{print $7; exit}' || echo 'unavailable')"
echo "🌐 IPv6: $(ip -6 addr show dev eth0 2>/dev/null | awk '/inet6/{gsub(/\/.*$/,"",$2); print $2}' | tr '\n' ' ' || echo 'none')"

# host.docker.internal and gateway.docker.internal are provided by Docker Desktop (or --add-host),
# so each line is printed only when the name resolves. IPv4 is listed first on glibc and musl alike.
docker_name_ips() {
  getent ahosts "$1" 2>/dev/null | awk '!seen[$1]++ { if (index($1, ":")) v6 = v6 $1 " "; else v4 = v4 $1 " " } END { printf "%s%s", v4, v6 }' || true
}
DOCKER_HOST_IPS=$(docker_name_ips host.docker.internal)
[ -z "$DOCKER_HOST_IPS" ] || echo "🏠 Docker host: $DOCKER_HOST_IPS"
DOCKER_GATEWAY_IPS=$(docker_name_ips gateway.docker.internal)
[ -z "$DOCKER_GATEWAY_IPS" ] || echo "🚪 Docker gateway: $DOCKER_GATEWAY_IPS"

# CPU temperature (if available)
for zone in /sys/class/thermal/thermal_zone*; do
  [ -r "$zone/temp" ] || continue
  printf '🌡️ CPU Temp (%s): ' "$(cat "$zone/type")"
  awk '{printf "%.1f°C\n", $1/1000}' "$zone/temp"
done

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
        echo "🗃️ Npm cache: $(npm config get cache)"
        echo "📦 Npm global prefix: $(npm root -g)"
        ;;
    esac
    ;;
esac

if command -v bun >/dev/null 2>&1; then
  echo "🥟 Bun version: $(bun -v)"
  echo "📍 Bun location: $(command -v bun)"
  echo "🗃️ Bun cache: ${BUN_INSTALL:-$HOME/.bun}/install/cache"
  echo "📦 Bun global prefix: ${BUN_INSTALL:-$HOME/.bun}/install/global/node_modules"
fi

# The Docker CLI is only present when the image ships it (or when the socket is bind mounted),
# so the version line is printed from the command output and falls back to a "not installed" note.
if DOCKER_VER="$(docker -v 2>/dev/null)"; then
  echo "🐳 $DOCKER_VER"
  # The CLI can be installed without a reachable daemon (no bind mounted socket), so a failing
  # "docker ps" is reported as such instead of being shown as an empty container list.
  if DOCKER_PS="$(docker ps --format '{{.Names}} ({{.Image}}) - {{.Status}}' 2>/dev/null)"; then
    if [ -n "$DOCKER_PS" ]; then
      echo "$DOCKER_PS" | sed 's/^/  🚢 /'
    else
      echo "  🚢 No running containers"
    fi
  else
    echo "  🚢 Docker daemon not reachable"
  fi
else
  echo "🐳 Docker: not installed"
fi
