#!/bin/sh

FLAG_FILE="/matterbridge/.initialized"

echo "Welcome to the Matterbridge bun dev docker image."
echo "This image is intended for development and testing purposes only."
echo "It is based on oven/bun:slim and includes matterbridge and all official plugins built from the source (GitHub dev branch when available)."

if [ ! -f "$FLAG_FILE" ]; then

  # Optional packages

  # Create the flag file to indicate initialization has been done
  touch "$FLAG_FILE"
fi

DISTRO=$(awk -F= '/^PRETTY_NAME=/{gsub(/"/, "", $2); print $2}' /etc/os-release)
CODENAME=$(awk -F= '/^VERSION_CODENAME=/{print $2}' /etc/os-release)
echo "🖥️ Distro: $DISTRO ($CODENAME)"
echo "🧱 Architecture: $(uname -m)"
echo "🧩 Kernel Version: $(uname -r)"
echo "👤 User: $(whoami)"
echo "🏷️ Hostname: $(hostname)"
echo "📅 Date: $(date)"
echo "🥟 Bun version: $(bun -v)"
echo "📍 Bun location: $(command -v bun)"
echo "📦 Bun global prefix: ${BUN_INSTALL:-$HOME/.bun}/install/global/node_modules"

# Start the main process
exec "$@"
