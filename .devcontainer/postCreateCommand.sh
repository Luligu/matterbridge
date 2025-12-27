#!/usr/bin/env bash

# postCreateCommand.sh

# This script runs after the Dev Container is created to set up the dev container environment.

set -euo pipefail

echo "1 - Installing updates and scripts..."
sudo npm install -g npm npm-check-updates shx

echo "2 - Creating directories..."
sudo mkdir -p /home/node/Matterbridge /home/node/.matterbridge /home/node/.mattercert

echo "3 - Setting permissions..."
sudo chown -R node:node . /home/node/Matterbridge /home/node/.matterbridge /home/node/.mattercert

echo "4 - Building the package..."
npm install
npm run build
npm link
npm outdated || true

echo "5 - Setup completed!"
