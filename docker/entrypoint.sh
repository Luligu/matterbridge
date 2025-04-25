#!/bin/sh

FLAG_FILE="/matterbridge/.initialized"

if [ ! -f "$FLAG_FILE" ]; then
  echo "Welcome to the Matterbridge edge docker image."

  echo "Installing bluetooth essentials:"
  apt-get install -y --no-install-recommends \
    bluetooth bluez libbluetooth-dev libudev-dev build-essential libcap2-bin \
    python3
  setcap 'cap_net_raw+eip' "$(which node)"

  echo "Node.Js version:"
  node -v

  echo "Npm version:"
  npm -v

  # Create the flag file to indicate initialization has been done
  touch "$FLAG_FILE"
fi

# Start the main process
exec "$@"