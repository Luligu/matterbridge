# <img src="https://github.com/Luligu/matterbridge/blob/main/frontend/public/matterbridge%2064x64.png" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge

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

The Matterbridge Docker image, which includes a manifest list for the linux/amd64, linux/arm64 and linux/arm/v7 architectures, is published on Docker Hub.

### First create the Matterbridge directories

This will create the required directories in your home directory if they don't exist

```
cd ~
mkdir -p ./Matterbridge
mkdir -p ./.matterbridge
sudo chown -R $USER:$USER ./Matterbridge ./.matterbridge
```

You may need to adapt the script to your setup.

### Add your user to docker group

If you don't want to use sudo with docker commands, run this command:

```
sudo groupadd docker
sudo usermod -aG docker $USER
```

### Run the Docker container and start it

The container must have full access to the host network (needed for mdns).

```
docker run --name matterbridge \
  -v ${HOME}/Matterbridge:/root/Matterbridge \
  -v ${HOME}/.matterbridge:/root/.matterbridge \
  --network host --restart always -d luligu/matterbridge:latest
```

You may need to adapt the script to your setup.

### Run with docker compose

The docker-compose.yml file is available in the docker directory of the package

```
services:
  matterbridge:
    container_name: matterbridge
    image: luligu/matterbridge:latest # Matterbridge image with the latest tag
    network_mode: host # Ensures the Matter mdns works
    restart: always # Ensures the container always restarts automatically
    volumes:
      - "${HOME}/Matterbridge:/root/Matterbridge" # Mounts the Matterbridge plugin directory
      - "${HOME}/.matterbridge:/root/.matterbridge" # Mounts the Matterbridge storage directory
```

copy it in the home directory or edit the existing one to add the matterbridge service.

Then start docker compose with:

```
docker compose up -d
```

### Stop with docker compose

```
docker compose down
```

### Update with docker compose

```
docker compose pull
```

### Inspect the container

```
docker container inspect matterbridge
```

### Start the Docker container

```
docker start matterbridge
```

### Stop the Docker container

```
docker stop matterbridge
```

### Restart the Docker container

```
docker restart matterbridge
```

### Shows the logs

```
docker logs matterbridge
```

### Shows the logs real time (tail)

```
docker logs --tail 1000 -f matterbridge
```
