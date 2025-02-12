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

It is based on node:22-bookworm-slim and integrates the health check.

How Health Checks Work in Different Scenarios

With docker-compose

Docker monitors the health check and can restart the container if needed.

With docker run

The health check still runs in the background, but:
The container doesn’t restart automatically if it becomes unhealthy.
You must manually check the health status:

docker exec -it matterbridge curl -v http://localhost:8283/health

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

After adding your user to the docker group, you need to log out and log back in for the changes to take effect. This ensures that your current session recognizes the group membership change.

### Run the Docker container and start it

The container must have full access to the host network (needed for mdns).

```
sudo docker run --name matterbridge \
  -v /home/<USER>/Matterbridge:/root/Matterbridge \
  -v /home/<USER>/.matterbridge:/root/.matterbridge \
  --network host --restart always -d luligu/matterbridge:latest
```

Replace USER with your user name (i.e. ubuntu or pi).

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
      - "/home/<USER>/Matterbridge:/root/Matterbridge"        # Mounts the Matterbridge plugin directory
      - "/home/<USER>/.matterbridge:/root/.matterbridge"      # Mounts the Matterbridge storage directory
```

Replace USER with your user name (i.e. ubuntu or pi: "/home/ubuntu/Matterbridge:/root/Matterbridge").

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
