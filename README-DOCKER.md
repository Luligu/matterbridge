# <img src="https://matterbridge.io/assets/matterbridge.svg" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge Docker configuration

[![npm version](https://img.shields.io/npm/v/matterbridge.svg)](https://www.npmjs.com/package/matterbridge)
[![npm downloads](https://img.shields.io/npm/dt/matterbridge.svg)](https://www.npmjs.com/package/matterbridge)
[![Docker Version](https://img.shields.io/docker/v/luligu/matterbridge/latest?label=docker%20version)](https://hub.docker.com/r/luligu/matterbridge)
[![Docker Pulls](https://img.shields.io/docker/pulls/luligu/matterbridge?label=docker%20pulls)](https://hub.docker.com/r/luligu/matterbridge)
![Node.js CI](https://github.com/Luligu/matterbridge/actions/workflows/build.yml/badge.svg)
![CodeQL](https://github.com/Luligu/matterbridge/actions/workflows/codeql.yml/badge.svg)
[![codecov](https://codecov.io/gh/Luligu/matterbridge/branch/main/graph/badge.svg)](https://codecov.io/gh/Luligu/matterbridge)
[![styled with prettier](https://img.shields.io/badge/styled_with-Prettier-f8bc45.svg?logo=prettier)](https://prettier.io/)
[![linted with eslint](https://img.shields.io/badge/linted_with-ES_Lint-4B32C3.svg?logo=eslint)](https://eslint.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![ESM](https://img.shields.io/badge/ESM-Node.js-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![matterbridge.io](https://img.shields.io/badge/matterbridge.io-online-brightgreen)](https://matterbridge.io)

[![powered by](https://img.shields.io/badge/powered%20by-matter--history-blue)](https://www.npmjs.com/package/matter-history)
[![powered by](https://img.shields.io/badge/powered%20by-node--ansi--logger-blue)](https://www.npmjs.com/package/node-ansi-logger)
[![powered by](https://img.shields.io/badge/powered%20by-node--persist--manager-blue)](https://www.npmjs.com/package/node-persist-manager)

---

# Production configuration

## Run Matterbridge with Docker and Docker Compose

The Matterbridge Docker images (multi-arch manifest list for **linux/amd64** and **linux/arm64**) are published on [**Docker Hub**](https://hub.docker.com/r/luligu/matterbridge). If you use them, please consider starring the project on [**Docker Hub**](https://hub.docker.com/r/luligu/matterbridge).

The image (tag **latest** 87 MB) includes Matterbridge and all official plugins, using the latest release published on npm. It is based on `node:24-trixie-slim`. Since all official plugins are included, you can select and add a plugin without installing anything.

The image (tag **dev** 99 MB) includes Matterbridge and all official plugins from the latest push on GitHub. It is based on `node:24-trixie-slim`. Since all official plugins are included, you can select and add a plugin without installing anything. Note: if you update to the latest **dev** from the frontend, you will override the GitHub version with the latest **dev** published on npm. The frontend shows if you are currently running the GitHub release or the latest or dev npm release.

The image (tag **ubuntu** 87 MB) includes only Matterbridge, using the latest release published on npm. This image (**for test and development only**) is based on `ubuntu:latest` with Node.js 24 from NodeSource. Plugins are not included in the image: they will be installed on first run. This image, on the first run, preinstalls `bluetooth`, `build-essential`, and `python` packages (useful for plugins that require native builds).

The image (tag **alpine** 58 MB) includes only Matterbridge, using the latest release published on npm. This image (**for test and development only**) is based on `node:24-alpine`. Plugins are not included in the image: they will be installed on first run.

The image (tag **s6-rc** 83 MB) includes only Matterbridge, using the latest release published on npm. This image is based on `node:24-trixie-slim`, supports `arm64`, `amd64` and integrates the `s6-rc overlay` system. Plugins are not included in the image: they will be installed on first run. It is only used for the [Matterbridge Home Assistant Application](https://github.com/Luligu/matterbridge-home-assistant-addon).

The image (tag **s6-rc-legacy** 83 MB) includes only Matterbridge, using the latest release published on npm. This image is based on `node:22-bullseye-slim`, supports `arm64`, `amd64` and `arm/v7` and integrates the `s6-rc overlay` system. Plugins are not included in the image: they will be installed on first run. It is only used for the legacy [Matterbridge Home Assistant Application (Legacy)](https://github.com/Luligu/matterbridge-home-assistant-addon-legacy).

### Matterbridge chip-tool docker image

The image (tag **chip-test** 400MB) is based on `ubuntu:latest` with Node.js 24 LTS from NodeSource and includes the connectedhomeip repository with chip-tool, chip-cert and all components required for yaml and phyton tests. The matterbridge instance inside the container is already paired in the chip-tool fabric to execute yaml tests and in the python harness fabric to execute python tests. In the container, the chip environment and phyton environment are already active. Just open a shell inside the container with bash and run the tests. Matterbridge frontend is as usual on port 8283. No volumes or port mapping needed.

### Matterbridge docker base images

The image (tag **24-ubuntu-slim** 83 MB) is based on `ubuntu:latest` with Node.js 24 LTS from NodeSource. It is used to build the **ubuntu** image but can also be used to open a shell in ubuntu latest with node 24 (node doesn't publish node:24-ubuntu).

### Docker health check

All images include a health check.

How health checks work in different scenarios:

- With Docker Compose: Docker monitors the health check and can restart the container (depending on your restart policy).
- With `docker run`: the health check still runs, but the container will not restart automatically when it becomes unhealthy.

You can manually check the health status:

```bash
docker exec -it matterbridge mb_health
```

### Create the Matterbridge directories first

This creates the required directories in your home directory (if they don't already exist):

```bash
cd ~
mkdir -p ~/Matterbridge
mkdir -p ~/.matterbridge
mkdir -p ~/.mattercert
sudo chown -R $USER:$USER ~/Matterbridge ~/.matterbridge ~/.mattercert
```

You may need to adapt the paths to your setup.

### Add your user to the docker group

If you don't want to use sudo with docker commands, run this command:

```bash
sudo groupadd docker
sudo usermod -aG docker $USER
```

After adding your user to the `docker` group, log out and log back in so your current session picks up the new group membership.

### Run the container

The container must have full access to the host network (needed for mDNS and the Matter protocol).

Linux (bash):

```bash
sudo docker pull luligu/matterbridge:latest
sudo docker stop matterbridge 2>/dev/null
sudo docker rm matterbridge 2>/dev/null
sudo docker run --name matterbridge \
  -v ~/Matterbridge:/root/Matterbridge \
  -v ~/.matterbridge:/root/.matterbridge \
  -v ~/.mattercert:/root/.mattercert \
  --network host --restart always -d luligu/matterbridge:latest
```

You may need to adapt the paths to your setup.

### Run the container with extra parameters (e.g. frontend on port 8585)

```bash
sudo docker pull luligu/matterbridge:latest
sudo docker stop matterbridge 2>/dev/null
sudo docker rm matterbridge 2>/dev/null
sudo docker run --name matterbridge \
  -v ~/Matterbridge:/root/Matterbridge \
  -v ~/.matterbridge:/root/.matterbridge \
  -v ~/.mattercert:/root/.mattercert \
  --network host --restart always -d luligu/matterbridge:latest \
  matterbridge --docker --frontend 8585
```

If you override the command, always start it with `matterbridge --docker`.

**If you change the frontend port (or enable https), overriding the default command of the images, docker will report the container unhealty unless you add the --no-healthcheck param**.

### How to run a double instance of matterbridge

In edge cases when you need a double instance of a matterbridge plugin (like for zigbee2mqtt when you have two mqtt brokers), you can run a double instance of matterbridge using the profiles.

```bash
cd ~
mkdir -p ~/matterbridge-one
mkdir -p ~/matterbridge-two
sudo chown -R $USER:$USER ~/matterbridge-one ~/matterbridge-two
sudo docker pull luligu/matterbridge:latest
sudo docker stop matterbridge-one 2>/dev/null
sudo docker rm matterbridge-one 2>/dev/null
sudo docker run --name matterbridge-one -v ~/matterbridge-one/Matterbridge:/root/Matterbridge -v ~/matterbridge-one/.matterbridge:/root/.matterbridge -v ~/matterbridge-one/.mattercert:/root/.mattercert --network host --restart always --no-healthcheck -d luligu/matterbridge:latest matterbridge --docker --frontend 8081 --port 5540 --profile BrokerOne
sudo docker stop matterbridge-two 2>/dev/null
sudo docker rm matterbridge-two 2>/dev/null
sudo docker run --name matterbridge-two -v ~/matterbridge-two/Matterbridge:/root/Matterbridge -v ~/matterbridge-two/.matterbridge:/root/.matterbridge -v ~/matterbridge-two/.mattercert:/root/.mattercert --network host --restart always --no-healthcheck -d luligu/matterbridge:latest matterbridge --docker --frontend 8082 --port 5560 --profile BrokerTwo
```

The first instance (profile BrokerOne) has the frontend on port 8081 and Matter port starting at 5540.

The second instance (profile BrokerTwo) has the frontend on port 8082 and Matter port starting at 5560.

Both instances have healthcheck disabled.

### Run with Docker Compose

The `docker-compose.yml` file is available in the `docker` directory of this repository:

```yaml
services:
  matterbridge:
    container_name: matterbridge
    image: luligu/matterbridge:latest                         # Matterbridge image with the tag latest
    network_mode: host                                        # Ensures the Matter mDNS works
    restart: always                                           # Ensures the container always restarts automatically
    volumes:
      - "${HOME}/Matterbridge:/root/Matterbridge"             # Mounts the Matterbridge plugin directory
      - "${HOME}/.matterbridge:/root/.matterbridge"           # Mounts the Matterbridge storage directory
      - "${HOME}/.mattercert:/root/.mattercert"               # Mounts the Matterbridge certificate directory
```

Copy it to your home directory or edit your existing compose file to add the Matterbridge service.

Then start Docker Compose with:

```bash
docker compose pull matterbridge
docker compose up -d
```

Or start only the Matterbridge container with:

```bash
docker compose pull matterbridge
docker compose up -d matterbridge
```

If you need to start Matterbridge with extra parameters (e.g. frontend on port 8585), override the default command by adding a `command` line to the service:

```yaml
services:
  matterbridge:
    ...
    command: ["matterbridge", "--docker", "--frontend", "8585"]
```

If you override the command, always start it with `["matterbridge", "--docker"]`.

**If you change the frontend port (or enable https), overriding the default command of the images, docker will report the container unhealty unless you add:**.

```yaml
    healthcheck:
      disable: true
```

### Stop with Docker Compose

```bash
docker compose down
```

### Update with Docker Compose

This pulls the new Matterbridge image and restarts only the Matterbridge container:

```bash
docker compose pull matterbridge
docker compose up -d --no-deps --force-recreate matterbridge
```

This pulls all images and restarts all containers:

```bash
docker compose pull
docker compose down
docker compose up -d
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

### Show the logs

```bash
docker logs matterbridge
```

### Show the logs for a time interval

```bash
docker logs \
  --since "2025-04-19T00:00:00" \
  --until "2025-04-19T00:02:00" \
  matterbridge
```

### Show the logs in real time (tail)

```bash
docker logs --tail 1000 -f matterbridge
```

### Prevent log growth

If you want to prevent Docker logs from growing too much, you can configure Docker's logging options globally.

**Warning**: This will restart Docker and affect all running containers.

```bash
sudo nano /etc/docker/daemon.json
```

Add or update the logging configuration in `daemon.json`:

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "100m",
    "max-file": "3"
  }
}
```

Where:

- `max-size`: Maximum size of each log file (e.g., "10m", "100m", "1g")
- `max-file`: Maximum number of log files to keep

Save the file and restart Docker:

```bash
sudo systemctl restart docker
```

**Note**: This configuration applies to new containers. Existing containers must be recreated to use the new logging settings.

## Run with Docker Desktop and mDNS Reflector on Windows

Windows (PowerShell) with Docker Desktop (use the [**Matterbridge mDNS Reflector**](https://matterbridge.io/reflector/Reflector.html) if you want to pair with a controller on the local network):

```powershell
docker pull luligu/matterbridge:latest
docker stop matterbridge 2>$null
docker rm matterbridge 2>$null
docker run --name matterbridge `
  -p 8283:8283 -p 5540-5559:5540-5559/udp `
  -v ${env:USERPROFILE}/Matterbridge:/root/Matterbridge `
  -v ${env:USERPROFILE}/.matterbridge:/root/.matterbridge `
  -v ${env:USERPROFILE}/.mattercert:/root/.mattercert `
  --restart always -d luligu/matterbridge:latest matterbridge --docker --frontend 8283 --port 5540
```

Windows (Command Prompt) with Docker Desktop (use the [**Matterbridge mDNS Reflector**](https://matterbridge.io/reflector/Reflector.html) if you want to pair with a controller on the local network):

```cmd
docker pull luligu/matterbridge:latest
docker stop matterbridge 2>nul
docker rm matterbridge 2>nul
docker run --name matterbridge ^
  -p 8283:8283 -p 5540-5559:5540-5559/udp ^
  -v %USERPROFILE%/Matterbridge:/root/Matterbridge ^
  -v %USERPROFILE%/.matterbridge:/root/.matterbridge ^
  -v %USERPROFILE%/.mattercert:/root/.mattercert ^
  --restart always -d luligu/matterbridge:latest matterbridge --docker --frontend 8283 --port 5540
```

## Run with Docker Desktop and mDNS Reflector on macOS

macOS (bash/zsh) with Docker Desktop (use the [**Matterbridge mDNS Reflector**](https://matterbridge.io/reflector/Reflector.html) if you want to pair with a controller on the local network):

```zsh
sudo docker pull luligu/matterbridge:latest
sudo docker stop matterbridge 2>/dev/null
sudo docker rm matterbridge 2>/dev/null
sudo docker run --name matterbridge \
  -p 8283:8283 -p 5540-5559:5540-5559/udp \
  -v ~/Matterbridge:/root/Matterbridge \
  -v ~/.matterbridge:/root/.matterbridge \
  -v ~/.mattercert:/root/.mattercert \
  --restart always -d luligu/matterbridge:latest matterbridge --docker --frontend 8283 --port 5540
```
