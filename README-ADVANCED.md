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

## Run matterbridge as a daemon with systemctl (Linux only)

Create a systemctl configuration file for Matterbridge

```
sudo nano /etc/systemd/system/matterbridge.service
```

Add the following to this file, replacing twice (!) USER with your user name (e.g. WorkingDirectory=/home/pi/Matterbridge and User=pi):

You may need to adapt the configuration to your setup:
 - execStart on some linux distribution can also be ExecStart==/usr/bin/matterbridge -service

```
[Unit]
Description=matterbridge
After=network-online.target

[Service]
Type=simple
ExecStart=matterbridge -service
WorkingDirectory=/home/<USER>/Matterbridge
StandardOutput=inherit
StandardError=inherit
Restart=always
RestartSec=10s
TimeoutStopSec=30s
User=<USER>

[Install]
WantedBy=multi-user.target
```

If you modify it after, then run:

```
sudo systemctl daemon-reload
```

### Start Matterbridge

```
sudo systemctl start matterbridge
```

### Stop Matterbridge

```
sudo systemctl stop matterbridge
```

### Show Matterbridge status

```
sudo systemctl status matterbridge.service
```

### View the log of Matterbridge in real time (this will show the log with colors)

```
sudo journalctl -u matterbridge.service -f --output cat
```

### Delete the logs older then 3 days (all of them not only the ones of Matterbridge!)

```
sudo journalctl --vacuum-time=3d
```

### Enable Matterbridge to start automatically on boot

```
sudo systemctl enable matterbridge.service
```

### Disable Matterbridge from starting automatically on boot

```
sudo systemctl disable matterbridge.service
```

## Run matterbridge with docker

The Matterbridge Docker image, which includes a manifest list for the linux/amd64, linux/arm64 and linux/arm/v7 architectures, is published on Docker Hub.

### First create the Matterbridge directories

This will create the required directories if they don't exist

```
cd ~
mkdir -p ./Matterbridge
mkdir -p ./.matterbridge
sudo chown -R $USER:$USER ./Matterbridge ./.matterbridge
```
You may need to adapt the script to your setup.

### Run the Docker container and start it

The container has full access to the host network (needed for mdns).

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

