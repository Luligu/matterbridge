#!/usr/bin/env bash

set -euo pipefail

echo "Running Matterbridge Bun Dev Container initialize.sh..."

echo "1.initialize - Creating the Matterbridge Docker network..."
docker network inspect matterbridge >/dev/null 2>&1 || docker network create matterbridge

echo "2.initialize - Pulling the Bun dev container image..."
docker pull luligu/matterbridge:bun-dev-container

echo "3.initialize - Setting script permissions..."
chmod +x .devcontainer/bun/*.sh

echo "4.initialize - Initialization completed!"
