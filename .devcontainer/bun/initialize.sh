#!/usr/bin/env bash

# .devcontainer/bun/initialize.sh v.2.0.0

# This script runs on the host before the Dev Container is created to set up the Docker environment.

set -euo pipefail

echo $'\033[36m'"[$(date '+%Y-%m-%d %H:%M:%S')]"$'\033[0m' "Running Matterbridge Bun Dev Container initialize.sh..."

echo $'\033[36m'"[$(date '+%Y-%m-%d %H:%M:%S')]"$'\033[0m' "1.initialize - Creating the Matterbridge Docker network..."
docker network inspect matterbridge >/dev/null 2>&1 || docker network create --ipv6 matterbridge

echo $'\033[36m'"[$(date '+%Y-%m-%d %H:%M:%S')]"$'\033[0m' "2.initialize - Pulling the Bun dev container image..."
docker pull luligu/matterbridge:bun-dev-container

echo $'\033[36m'"[$(date '+%Y-%m-%d %H:%M:%S')]"$'\033[0m' "3.initialize - Setting script permissions..."
chmod +x .devcontainer/bun/*.sh

echo $'\033[36m'"[$(date '+%Y-%m-%d %H:%M:%S')]"$'\033[0m' "4.initialize - Initialization completed!"
