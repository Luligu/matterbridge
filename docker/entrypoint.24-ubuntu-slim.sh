#!/bin/sh

FLAG_FILE=".initialized"

echo "Welcome to the Matterbridge node 24 ubuntu slim base docker image."
echo "It is based on ubuntu:latest and node 24 (https://nodejs.org/dist)."

if [ ! -f "$FLAG_FILE" ]; then

  # Optional packages

  # Create the flag file to indicate initialization has been done
  touch "$FLAG_FILE"
fi

DISTRO=$(awk -F= '/^PRETTY_NAME=/{gsub(/"/, "", $2); print $2}' /etc/os-release) && \
CODENAME=$(awk -F= '/^VERSION_CODENAME=/{print $2}' /etc/os-release) && \
echo "🖥️ Distro: $DISTRO ($CODENAME)" && \
echo "👤 User: $(whoami)" && \
echo "🏷️ Hostname: $(hostname)" && \
echo "🧱 Architecture: $(uname -m)" && \
echo "🧩 Kernel Version: $(uname -r)" && \
echo "📅 Date: $(date)" && \
echo "🟢 Node.js version: $(node -v)" && \
echo "🟣 Npm version: $(npm -v)"

# Start the main process
exec "$@"
