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

## Install Podman if it is not already installed

```
cd ~
sudo apt update
sudo apt install podman -y
podman --version
```

## Run matterbridge with podman

The Matterbridge Docker image, which includes a manifest list for the linux/amd64, linux/arm64 and linux/arm/v7 architectures, is published on Docker Hub and can be used with podman.

Podman handles container restarts a little differently than Docker. The --restart always flag doesn’t work exactly the same. If you want the container to automatically restart when the system reboots or if it crashes, you can create a systemd unit for the Podman container.

### First create the Matterbridge directories

This will create the required directories if they don't exist

```
cd ~
mkdir -p ./Matterbridge
mkdir -p ./.matterbridge
sudo chown -R $USER:$USER ./Matterbridge ./.matterbridge
```

You may need to adapt the script to your setup:

- ./Matterbridge is the position outside of the container of your matterbridge plugin directory (inside your home directory).
- ./.matterbridge is the position outside of the container of your matterbridge storage directory (inside your home directory).

### Run the Podman container (root mode) and start it

The container must have full access to the host network (needed for matter mdns).

```
podman run --name matterbridge \
  -v ~/Matterbridge:/root/Matterbridge \
  -v ~/.matterbridge:/root/.matterbridge \
  --network host --restart always -d docker.io/luligu/matterbridge:latest
```

You may need to adapt the script to your setup:

- ~/Matterbridge is the position outside of the container of your matterbridge plugin directory.
- ~/.matterbridge is the position outside of the container of your matterbridge storage directory.

### Integrate the mattebridge podman container with systemd for automatic startup after reboots

```
podman generate systemd --name matterbridge --files --new
sudo mv container-matterbridge.service /etc/systemd/system/
sudo systemctl enable container-matterbridge
sudo systemctl start container-matterbridge
```

### Start the Podman container

```
podman start matterbridge
```

### Stop the Podman container

```
podman stop matterbridge
```

### Restart the Podman container

```
podman restart matterbridge
```

### Remove the Podman container

```
podman rm matterbridge
```

### Shows the logs

```
podman logs matterbridge
```

### Shows the logs real time (tail)

```
podman logs --tail 1000 -f matterbridge
```
