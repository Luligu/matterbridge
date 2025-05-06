# <img src="frontend/public/matterbridge.svg" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge

[![npm version](https://img.shields.io/npm/v/matterbridge.svg)](https://www.npmjs.com/package/matterbridge)
[![npm downloads](https://img.shields.io/npm/dt/matterbridge.svg)](https://www.npmjs.com/package/matterbridge)
[![Docker Version](https://img.shields.io/docker/v/luligu/matterbridge?label=docker%20version&sort=semver)](https://hub.docker.com/r/luligu/matterbridge)
[![Docker Pulls](https://img.shields.io/docker/pulls/luligu/matterbridge.svg)](https://hub.docker.com/r/luligu/matterbridge)
![Node.js CI](https://github.com/Luligu/matterbridge/actions/workflows/build.yml/badge.svg)

[![power by](https://img.shields.io/badge/powered%20by-matter--history-blue)](https://www.npmjs.com/package/matter-history)
[![power by](https://img.shields.io/badge/powered%20by-node--ansi--logger-blue)](https://www.npmjs.com/package/node-ansi-logger)
[![power by](https://img.shields.io/badge/powered%20by-node--persist--manager-blue)](https://www.npmjs.com/package/node-persist-manager)

---

# Advanced configuration

## Run matterbridge with docker and docker compose

The Matterbridge Docker image, which includes a manifest list for the linux/amd64, linux/arm64 and linux/arm/v7 architectures, is published on **Docker Hub**.

The image (tag **latest**) includes matterbridge and all plugins with the latest release (as published on npm). You can just pull the new image and matterbridge with all plugins will be the latest release published on npm.

The image (tag **dev**) includes matterbridge and all plugins with the dev release (as pushed on GitHub). You can just pull the new image and matterbridge with all plugins will be the latest release pushed on GitHub. It is possible that the devs are outdated by published latests.

You can directly select and add a plugin without installing it.

It is based on node:22-bookworm-slim and integrates the health check.

How Health Checks Work in Different Scenarios

With docker-compose

Docker monitors the health check and can restart the container if needed.

With docker run

The health check still runs in the background, but:
The container doesn’t restart automatically if it becomes unhealthy.

You can manually check the health status:

```bash
docker exec -it matterbridge curl -v http://localhost:8283/health
```

### First create the Matterbridge directories

This will create the required directories in your home directory if they don't exist

```bash
cd ~
mkdir -p ~/Matterbridge
mkdir -p ~/.matterbridge
sudo chown -R $USER:$USER ~/Matterbridge ~/.matterbridge
```

You may need to adapt the script to your setup.

### Add your user to docker group

If you don't want to use sudo with docker commands, run this command:

```bash
sudo groupadd docker
sudo usermod -aG docker $USER
```

After adding your user to the docker group, you need to log out and log back in for the changes to take effect. This ensures that your current session recognizes the group membership change.

### Run the Docker container and start it

The container must have full access to the host network (needed for mdns).

```bash
sudo docker run --name matterbridge \
  -v ~/Matterbridge:/root/Matterbridge \
  -v ~/.matterbridge:/root/.matterbridge \
  --network host --restart always -d luligu/matterbridge:latest
```

You may need to adapt the script to your setup.

### Run with docker compose

The docker-compose.yml file is available in the docker directory of the package

```
services:
  matterbridge:
    container_name: matterbridge
    image: luligu/matterbridge:latest                         # Matterbridge image with the tag latest
    network_mode: host                                        # Ensures the Matter mdns works
    restart: always                                           # Ensures the container always restarts automatically
    volumes:
      - "${HOME}/Matterbridge:/root/Matterbridge"             # Mounts the Matterbridge plugin directory
      - "${HOME}/.matterbridge:/root/.matterbridge"           # Mounts the Matterbridge storage directory
```

Copy it in the home directory or edit the existing one to add the matterbridge service.

Then start docker compose with:

```bash
docker compose up -d
```

or start only the matterbridge container with:

```bash
docker compose up -d matterbridge
```

### Stop with docker compose

```bash
docker compose down
```

### Update with docker compose

This will pull the new matterbridge image and restart the matterbridge container.

```bash
docker compose pull matterbridge
docker compose up -d --no-deps matterbridge
```

### Inspect the container

```bash
docker container inspect matterbridge
```

### Start the Docker container

```bash
docker start matterbridge
```

### Stop the Docker container

```bash
docker stop matterbridge
```

### Restart the Docker container

```bash
docker restart matterbridge
```

### Shows the logs

```bash
docker logs matterbridge
```

### Shows the logs for a time interval

```bash
docker logs \
  --since "2025-04-19T00:00:00" \
  --until "2025-04-19T00:02:00" \
  matterbridge
```

### Shows the logs real time (tail)

```bash
docker logs --tail 1000 -f matterbridge
```
