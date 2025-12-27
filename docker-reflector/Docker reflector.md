# Prerequisites

- Docker Desktop

## Dual Stack IPv4/IPv6 mDNS enabled and No filtering

![alt text](DockerDesktopSetup.png)

# Run Matterbridge in a Docker Desktop container

We use here named volumes for storage, plugins and mattercert.

We use matter port range 5550-5559 to allow childbridge mode and server node devices (RVCs).

```bash
docker run -it --name node24slim & \
  -p 8283:8283 -p 5550-5559:5550-5559/udp & \
  -v storage:/root/.matterbridge -v plugins:/root/Matterbridge -v mattercert:/root/.mattercert & \
  node:24-slim bash
```

```powershell
docker run -it --name node24slim `
  -p 8283:8283 -p 5550-5559:5550-5559/udp `
  -v storage:/root/.matterbridge -v plugins:/root/Matterbridge -v mattercert:/root/.mattercert `
  node:24-slim bash
```

Inside the container install and run matterbridge with start matter port 5550.

```bash
npm install -g matterbridge
matterbridge --port 5550
```

You will see that the frontend inside the container is listening on the conainer address

```text
[09:02:10.140] [Frontend] The frontend http server is listening on http://172.17.0.2:8283
[09:02:10.140] [Frontend] The frontend http server is listening on http://[fd3d:8954:ffe5::2]:8283
```

But since we mapped the port 8283, the frontend is available on the host with localhost your host ip or hostname and on the lan with your host ip or hostname.

In the same way the Matter port range 5550-5559 is mapped outside the container.

## What happens inside a Docker Desktop container

From another terminal run mb_mdns inside the container we created and run before

```bash
docker exec -it node24slim apt-get update
docker exec -it node24slim apt-get install -y --no-install-recommends iproute2 iputils-ping net-tools dnsutils tcpdump netcat-openbsd
docker exec -it node24slim ip a
docker exec -it node24slim mb_mdns
```

In a while you will see what Matterbridge mDNS packet advertised from the Docker Desktop container

![alt text](mDnsPacket.png)

### Issues we have there

1. The advertised mDNS cannot reach the host and the lan cause mDNS are not routed inside Docker Desktop

2. The advertised mDNS packet contains wrong A and AAAA records:

- the advertised address are relative to the container
- those address are not reachable from the host and from the lan

## Run the Madderbridge reflector client in the container we created and run before

```bash
docker exec -it node24slim mb_mdns --reflector-client
```

In a while you will see

![alt text](ReflectorClient.png)

## Run the Madderbridge reflector server on the host

```bash
npm install -g matterbridge
mb_mdns --reflector-server --filter _matterc._udp _matter._tcp
```

In a while you will see

![alt text](ReflectorServer.png)

# Run Home Assistant and Matter Server in Docker compose with Docker Desktop

Use this docker-compose.yml

```text
services:
  homeassistant:
    container_name: homeassistant
    image: ghcr.io/home-assistant/home-assistant:stable
    restart: unless-stopped
    depends_on:
      - matterserver
    ports:
      - "8123:8123"
    volumes:
      - ./homeassistant:/config
    environment:
      - TZ=Europe/Paris

  matterserver:
    container_name: matterserver
    image: ghcr.io/home-assistant-libs/python-matter-server:stable
    restart: unless-stopped
    ports:
      - "5580:5580"
      - "5540:5540/udp"
      - "5353:5353/udp"
    volumes:
      - ./matterserver:/data
    environment:
      - TZ=Europe/Paris
```

When asked by Home Assistant connect to Matter Server with **ws://matterserver:5580/ws**
