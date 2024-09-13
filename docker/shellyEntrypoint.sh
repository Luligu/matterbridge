#!/bin/sh

FLAG_FILE="/app/.initialized"

if [ ! -f "$FLAG_FILE" ]; then
  echo "Welcome to the Matterbridge docker image for Shelly gateway."
  echo "Node.Js version:"
  node -v
  echo "Npm version:"
  npm -v
  echo "Adding matterbridge-shelly plugin..."
  
  matterbridge -add matterbridge-shelly

  # Create the flag file to indicate initialization has been done
  touch "$FLAG_FILE"
fi

# Start the main process
exec "$@"