# Create the shared matterbridge bridge docker network

```shell
docker network inspect matterbridge || docker network create matterbridge
docker network ls
```

# Run Home Assitant and Matter Server in Docker Compose with Docker Desktop

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

# Open Matterbridge UI in the Matterbridge Plugin Dev Container

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

# Run the matterbridge reflector client on the shared matterbridge bridge docker network (only required if you want mDNS in the dev container to pair with a lan controller or to discover devices on the lan)

Local

```shell
docker run -dit --name reflector-client --network matterbridge reflector-client:latest
```

Docker bub

```shell
docker run -dit --name reflector-client --network matterbridge luligu/reflector-client:latest
```
