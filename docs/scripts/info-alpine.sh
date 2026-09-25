#!/bin/sh
#
# Print the environment banner of an Alpine container.
#
# POSIX sh, so it also runs on the base image before Bash is installed.
#
# Usage inside a container:
#   sh /scripts/info-alpine.sh
#   curl -4 -fsSL https://matterbridge.io/scripts/info-alpine.sh | sh
#
# install-alpine.sh installs this script to INFO_SCRIPT (default /usr/local/bin/info-alpine.sh)
# and calls it from ~/.bashrc, so every new interactive Bash shell prints the banner.
# The runtime lines are selected from the commands actually present, so the same script covers
# Node.js only, Bun only, and images that ship both.
#

set -eu

DISTRO=$(awk -F= '/^PRETTY_NAME=/{gsub(/"/, "", $2); print $2}' /etc/os-release)
CODENAME=$(awk -F= '/^VERSION_CODENAME=/{print $2}' /etc/os-release)
# Alpine has no VERSION_CODENAME, so the codename is only appended when the release provides one.
if [ -n "$CODENAME" ]; then
  echo "🖥️ Distro: $DISTRO ($CODENAME)"
else
  echo "🖥️ Distro: $DISTRO"
fi
echo "🧱 Architecture: $(uname -m)"
echo "🧩 Kernel Version: $(uname -r)"
echo "👤 User: $(whoami)"
echo "🏷️ Hostname: $(hostname)"
echo "📅 Date: $(date)"

# Busybox has no "uptime -p" and no "free -h", so the Alpine banner reads /proc directly. The
# addresses match the Debian banner (default route source, eth0 IPv6); without a usable
# "ip route get" the IPv4 falls back to the first global address, then to hostname -i.
UPTIME=$(awk '{ t = int($1); d = int(t / 86400); h = int((t % 86400) / 3600); m = int((t % 3600) / 60);
  s = "up";
  if (d > 0) s = s sprintf(" %d day%s,", d, (d == 1 ? "" : "s"));
  if (d > 0 || h > 0) s = s sprintf(" %d hour%s,", h, (h == 1 ? "" : "s"));
  print s sprintf(" %d minute%s", m, (m == 1 ? "" : "s")) }' /proc/uptime 2>/dev/null || true)
echo "⏳ Uptime: ${UPTIME:-unavailable}"

# MemAvailable is in kB, so the used value is derived from it rather than from the "free" output.
MEMORY=$(awk '/^MemTotal:/ { total = $2 } /^MemAvailable:/ { available = $2 }
  END { if (total > 0) print sprintf("%.1fGi / %.1fGi", (total - available) / 1048576, total / 1048576) }' /proc/meminfo 2>/dev/null || true)
echo "🧠 Memory: ${MEMORY:-unavailable}"

IPV4=$(ip -4 route get 1 2>/dev/null | awk '{ print $7; exit }' || true)
[ -n "$IPV4" ] || IPV4=$(ip -4 addr show 2>/dev/null | awk '$1 == "inet" && substr($2, 1, 4) != "127." { split($2, a, "/"); print a[1]; exit }' || true)
[ -n "$IPV4" ] || IPV4=$(hostname -i 2>/dev/null | awk '{ print $1 }' || true)
echo "🌐 IPv4: ${IPV4:-unavailable}"

IPV6=$(ip -6 addr show dev eth0 2>/dev/null | awk '$1 == "inet6" { split($2, a, "/"); printf "%s ", a[1] }' || true)
echo "🌐 IPv6: ${IPV6:-none}"

# host.docker.internal and gateway.docker.internal are provided by Docker Desktop (or --add-host),
# so each line is printed only when the name resolves. IPv4 is listed first on glibc and musl alike.
docker_name_ips() {
  getent ahosts "$1" 2>/dev/null | awk '!seen[$1]++ { if (index($1, ":")) v6 = v6 $1 " "; else v4 = v4 $1 " " } END { printf "%s%s", v4, v6 }' || true
}
DOCKER_HOST_IPS=$(docker_name_ips host.docker.internal)
[ -z "$DOCKER_HOST_IPS" ] || echo "🏠 Docker host: $DOCKER_HOST_IPS"
DOCKER_GATEWAY_IPS=$(docker_name_ips gateway.docker.internal)
[ -z "$DOCKER_GATEWAY_IPS" ] || echo "🚪 Docker gateway: $DOCKER_GATEWAY_IPS"

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
