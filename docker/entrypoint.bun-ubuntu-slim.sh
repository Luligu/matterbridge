#!/bin/sh

FLAG_FILE="/home/ubuntu/.initialized"

echo "Welcome to the Matterbridge bun ubuntu slim base docker image."
echo "It is based on ubuntu:latest and bun (https://github.com/oven-sh/bun)."

if [ ! -f "$FLAG_FILE" ]; then

  # Optional packages

  # Create the flag file to indicate initialization has been done
  touch "$FLAG_FILE"
fi

DISTRO=$(awk -F= '/^PRETTY_NAME=/{gsub(/"/, "", $2); print $2}' /etc/os-release) && \
CODENAME=$(awk -F= '/^VERSION_CODENAME=/{print $2}' /etc/os-release) && \
echo "🖥️ Distro: $DISTRO ($CODENAME)" && \
echo "🧱 Architecture: $(uname -m)" && \
echo "🧩 Kernel Version: $(uname -r)" && \
echo "👤 User: $(whoami)" && \
echo "🏷️ Hostname: $(hostname)" && \
echo "📅 Date: $(date)" && \
echo "🥟 Bun version: $(bun -v)" && \
echo "📍 Bun location: $(command -v bun)"

# Start the main process
exec "$@"
