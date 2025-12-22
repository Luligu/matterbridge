#!/usr/bin/env bash
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

echo "5 - Setup completed!"
