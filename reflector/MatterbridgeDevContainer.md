# <img src="https://matterbridge.io/assets/matterbridge.svg" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp; Matterbridge Dev Container

## Using the Dev Container

- Docker Desktop or Docker Engine are required to use the Dev Container.
- Devcontainer works correctly on Linux, macOS, Windows, WSL2.
- The devcontainer provides Node.js, npm, TypeScript, ESLint, Prettier, Jest, Vitest and other tools and extensions pre-installed and configured.
- The dev branch of Matterbridge is already build and installed into the Dev Container and linked to the plugin. The plugin is automatically added to matterbridge.
- The devcontainer is optimized using named mounts for node_modules, .cache and matterbridge.
- You can run, build, and test your plugin directly inside the container.
- To open a terminal in the devcontainer, use the VS Code terminal after the container starts.
- All commands (npm, tsc, matterbridge etc.) will run inside the container environment.
- All the source files are on the host.

## Dev containers networking limitations

Dev containers have networking limitations depending on the host OS and Docker setup.

• Docker Desktop on Windows or macOS:

- Runs inside a VM
- Host networking mode is NOT available
- Use the Matterbridge Plugin Dev Container system (https://matterbridge.io/reflector/MatterbridgeDevContainer.html) for development and testing. It provides a similar environment to the native Linux setup with the following features:

  ✅ Is possible to pair with an Home Assistant instance running in docker compose on the same host

  ✅ Remote and local network access (cloud services, internet APIs) works normally

  ✅ Matterbridge and plugins work normally

  ✅ Matterbridge frontend works normally

- Use the Matterbridge mDNS Reflector with the Matterbridge Plugin Dev Container system (https://matterbridge.io/reflector/Reflector.html) if you want to pair with a controller on the local network with the following features:

  ✅ Is possible to pair with a controller running on the local network using mDNS reflector

  ✅ Remote and local network access (cloud services, internet APIs) works normally

  ✅ Matterbridge and plugins work normally

  ✅ Matterbridge frontend works normally

• Native Linux or WSL 2 with Docker Engine CLI integration:

- ✅ Host networking IS available (with --network=host)
- ✅ Full local network access is supported
- ✅ Matterbridge and plugins work correctly, including pairing
- ✅ Matterbridge frontend works normally

## Create the shared matterbridge bridge docker network

```shell
docker network inspect matterbridge || docker network create matterbridge
docker network ls
```

## Run Home Assistant and Matter Server in Docker Compose with Docker Desktop

Will join the matterbridge bridge docker network.

The matterbridge-dev-container-docker-compose.yml is available [here](https://matterbridge.io/reflector/matterbridge-dev-container-docker-compose.yml).

```shell
docker network inspect matterbridge || docker network create matterbridge
docker compose -p matterbridge-dev-container -f matterbridge-dev-container-docker-compose.yml down
docker compose -p matterbridge-dev-container -f matterbridge-dev-container-docker-compose.yml pull
docker compose -p matterbridge-dev-container -f matterbridge-dev-container-docker-compose.yml up -d --force-recreate
```

The Matterbridge UI is available on port 8283.

The Home Assistant UI is available on port 8123.

The Matter Server UI is available on port 5580.

The first time you run the docker compose, you will be asked for the Matter Server address, use matterserver as address instead of localhost (**ws://matterserver:5580/ws**).

## Open Matterbridge UI in the Matterbridge Plugin Dev Container

Features:

- will create and join the matterbridge bridge docker network
- will expose port 8283 for the frontend
- will expose ports 5540-5549 for Matter (we use range here so you can also run in childbridge mode and use devices with mode server)
- all data persists in docker named volumes (extremely fast)
- no need to use a lan controller

Run from the Dev Container terminal:

```shell
matterbridge
```

The first time you run the matterbridge plugin dev container, matterbridge will be build locally from the GitHub dev branch. Rebuild the dev container to update Matterbridge.

You can now pair matterbridge (the plugin is already added to matterbridge) to the Matter Server instance running in container.

## Run the matterbridge reflector client on the shared matterbridge bridge docker network (only required if you want mDNS in the dev container to pair with a lan controller or to discover devices on the lan)

Follow the instruction in [Matterbridge mDNS reflector](Reflector.md)
