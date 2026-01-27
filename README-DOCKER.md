# <img src="https://matterbridge.io/matterbridge.svg" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge Docker configuration

[![npm version](https://img.shields.io/npm/v/matterbridge.svg)](https://www.npmjs.com/package/matterbridge)
[![npm downloads](https://img.shields.io/npm/dt/matterbridge.svg)](https://www.npmjs.com/package/matterbridge)
[![Docker Version](https://img.shields.io/docker/v/luligu/matterbridge?label=docker%20version&sort=semver)](https://hub.docker.com/r/luligu/matterbridge)
[![Docker Pulls](https://img.shields.io/docker/pulls/luligu/matterbridge.svg)](https://hub.docker.com/r/luligu/matterbridge)
![Node.js CI](https://github.com/Luligu/matterbridge/actions/workflows/build.yml/badge.svg)
![CodeQL](https://github.com/Luligu/matterbridge/actions/workflows/codeql.yml/badge.svg)
[![codecov](https://codecov.io/gh/Luligu/matterbridge/branch/main/graph/badge.svg)](https://codecov.io/gh/Luligu/matterbridge)

[![powered by](https://img.shields.io/badge/powered%20by-matter--history-blue)](https://www.npmjs.com/package/matter-history)
[![powered by](https://img.shields.io/badge/powered%20by-node--ansi--logger-blue)](https://www.npmjs.com/package/node-ansi-logger)
[![powered by](https://img.shields.io/badge/powered%20by-node--persist--manager-blue)](https://www.npmjs.com/package/node-persist-manager)

---

# Production configuration

## Run Matterbridge with Docker and Docker Compose

The Matterbridge Docker images (multi-arch manifest list for **linux/amd64** and **linux/arm64**) are published on [**Docker Hub**](https://hub.docker.com/r/luligu/matterbridge). If you use them, please consider starring the project on [**Docker Hub**](https://hub.docker.com/r/luligu/matterbridge).

The image (tag **latest**) includes Matterbridge and all official plugins, using the latest release published on npm. It is based on `node:22-bookworm-slim`. Since all official plugins are included, you can select and add a plugin without installing anything.

The image (tag **dev**) includes Matterbridge and all official plugins from the latest push on GitHub. It is based on `node:22-bookworm-slim`. Since all official plugins are included, you can select and add a plugin without installing anything. Note: if you update to the latest **dev** from the frontend, you will override the GitHub version with the latest **dev** published on npm.

The image (tag **ubuntu**) includes only Matterbridge, using the latest release published on npm. This image (**for test and development only**) is based on `ubuntu:latest` with Node.js 24 from NodeSource. Plugins are not included in the image; they will be installed on first run. This image preinstalls `bluetooth`, `build-essential`, and `python` packages (useful for plugins that require native builds).

The image (tag **alpine**) includes only Matterbridge, using the latest release published on npm. This image (**for test and development only**) is based on `node:24-alpine`. Plugins are not included in the image; they will be installed on first run.

### Docker health check

All images include a health check.

How health checks work in different scenarios:

- With Docker Compose: Docker monitors the health check and can restart the container (depending on your restart policy).
- With `docker run`: the health check still runs, but the container will not restart automatically when it becomes unhealthy.

You can manually check the health status:

```bash
docker exec -it matterbridge curl -v http://localhost:8283/health
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

```bash
sudo docker run --name matterbridge \
  -v ~/Matterbridge:/root/Matterbridge \
  -v ~/.matterbridge:/root/.matterbridge \
  -v ~/.mattercert:/root/.mattercert \
  --network host --restart always -d luligu/matterbridge:latest
```

You may need to adapt the paths to your setup.

### Run the container with extra parameters (e.g. frontend on port 8585)

```bash
sudo docker run --name matterbridge \
  -v ~/Matterbridge:/root/Matterbridge \
  -v ~/.matterbridge:/root/.matterbridge \
  -v ~/.mattercert:/root/.mattercert \
  --network host --restart always -d luligu/matterbridge:latest \
  matterbridge --docker --frontend 8585
```

If you override the command, always start it with `matterbridge --docker`.

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
docker compose up -d
```

Or start only the Matterbridge container with:

```bash
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
