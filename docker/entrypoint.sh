#!/bin/sh

FLAG_FILE="/matterbridge/.initialized"

if [ ! -f "$FLAG_FILE" ]; then
  echo "Welcome to the Matterbridge docker image."

  echo "Installing bluetooth essentials:"
  apt-get update
  apt-get install -y --no-install-recommends \
    bluetooth bluez libbluetooth-dev libudev-dev build-essential libcap2-bin \
    python3
  setcap 'cap_net_raw+eip' "$(which node)"

  DISTRO=$(awk -F= '/^PRETTY_NAME=/{gsub(/"/, "", $2); print $2}' /etc/os-release) && \
  CODENAME=$(awk -F= '/^VERSION_CODENAME=/{print $2}' /etc/os-release) && \
  echo "🖥️ Distro: $DISTRO ($CODENAME)" && \
  echo "👤 User: $(whoami)" && \
  echo "🧱 Architecture: $(uname -m)" && \
  echo "🧩 Kernel Version: $(uname -r)" && \
  echo "⏳ Uptime: $(uptime -p || echo 'unavailable')" && \
  echo "📅 Date: $(date)" && \
  echo "🟢 Node.js version: $(node -v)" && \
  echo "🟣 Npm version: $(npm -v)"

  # Create the flag file to indicate initialization has been done
  touch "$FLAG_FILE"
fi

# Start the main process
exec "$@"