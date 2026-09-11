# <img src="https://matterbridge.io/assets/matterbridge.svg" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge on Bun

[![matterbridge.io](https://img.shields.io/badge/matterbridge.io-online-brightgreen)](https://matterbridge.io)
[![Docker Image Size](https://img.shields.io/docker/image-size/luligu/matterbridge/bun?label=bun%20image%20size)](https://hub.docker.com/r/luligu/matterbridge/tags?name=bun)
[![ESM](https://img.shields.io/badge/ESM-Node.js-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![ESM](https://img.shields.io/badge/ESM-Bun-000000?logo=bun&logoColor=white)](https://bun.com)

---

# Run matterbridge with bun

## Install matterbridge globally with bun

```shell
bun add matterbridge --global --omit=dev
```

## Run matterbridge with bun

```shell
bunx --bun matterbridge
```

# Run matterbridge with the bun docker hub image

The image (tag **bun** 69 MB) includes only Matterbridge, using the latest release published on npm. This image is based on `oven/bun:slim`. Plugins are not included in the image: they will be reinstalled on first run.

```shell
docker pull luligu/matterbridge:bun && docker run --name matterbridge -v ~/Matterbridge:/root/Matterbridge -v ~/.matterbridge:/root/.matterbridge -v ~/.mattercert:/root/.mattercert --network host --restart always --stop-timeout 60 -d luligu/matterbridge:bun
```

# Bun image installed from npm

The **bun** image installs the latest Matterbridge release from npm and runs it with the [Bun](https://bun.com) runtime.

- Base image: `oven/bun:slim`.
- Installs Matterbridge globally from npm with `bun install matterbridge --global --omit=dev`.
- Removes Bun caches, package documentation, TypeScript sources, source maps, declarations, and unused Matter.js `src` and `cjs` directories to reduce the image size.
- Checks container health every 60 seconds with `mb_health`.
- Starts Matterbridge with `bun --bun /usr/local/bin/matterbridge --docker`.
- Uses `docker/entrypoint.bun.sh` to print the container environment before starting Matterbridge.

## Files

| File                                                                       | Purpose                                                    |
| -------------------------------------------------------------------------- | ---------------------------------------------------------- |
| [`docker/Dockerfile.bun`](docker/Dockerfile.bun)                           | Builds the Bun image with Matterbridge installed from npm  |
| [`docker/Dockerfile.bun.dockerignore`](docker/Dockerfile.bun.dockerignore) | Limits the Docker build context                            |
| [`docker/entrypoint.bun.sh`](docker/entrypoint.bun.sh)                     | Prints container and Bun details, then starts Matterbridge |

## Scripts

```bash
npm run docker:build:local:bun   # build the local image (matterbridge:bun)
npm run docker:run:local:bun     # run the local image (container matterbridge-bun-local, port 8283)
npm run docker:run:hub:bun       # pull and run luligu/matterbridge:bun
npm run docker:buildx:cloud:bun  # build and publish the multi-platform image
```

# Bun local image with no production build (development)

The **local-bun** image copies the local Matterbridge source tree and runs it directly with the [Bun](https://bun.com) runtime. It does not create a production TypeScript build.

- Base image: `oven/bun:slim`.
- Generates the Bun package exports with `bun scripts/bun-exports.mjs`.
- Installs production dependencies with `bun install --omit=dev`.
- Installs and builds the web frontend with Bun, then removes its development sources and dependencies.
- Links the local Matterbridge package globally with `bun link`.
- Removes Bun caches, temporary files, and unused Matter.js `src` and `cjs` directories to reduce the image size.
- Checks container health every 60 seconds with `mb_health`.
- Starts Matterbridge with `bun --bun bin/matterbridge.js --docker`.
- Uses `docker/entrypoint.local.bun.sh` to print the container environment before starting Matterbridge.

## Files

| File                                                                                   | Purpose                                                    |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| [`docker/Dockerfile.local.bun`](docker/Dockerfile.local.bun)                           | Builds the development image from the local source tree    |
| [`docker/Dockerfile.local.bun.dockerignore`](docker/Dockerfile.local.bun.dockerignore) | Limits the Docker build context                            |
| [`docker/entrypoint.local.bun.sh`](docker/entrypoint.local.bun.sh)                     | Prints container and Bun details, then starts Matterbridge |

## Scripts

```bash
npm run docker:build:localbun   # build the image (matterbridge:local-bun)
npm run docker:run:localbun     # run it (container matterbridge-local-bun, port 8283)
npm run docker:exec:localbun    # open a shell in the running container
npm run docker:log:localbun     # follow the container logs
```

# Status

The core bridge runs on Bun: it creates its directories, initializes the Matter
node storage, and brings up the server node and endpoints. The web frontend is
built and served. See the TODO list below for the known limitations.

---

## Known issue with release 1.4.0

- [ ] **Bun docker image cannot resolve the container user name.** In the official Bun images,
      both `node:os` and `bun:os` return `username: "unknown"` and `shell: "unknown"`
      from `os.userInfo()`, even though they correctly return the UID, GID, and home
      directory. Consequently, Matterbridge sends `User: unknown` to the frontend
      system-information view instead of the container account (for example, `root`).
      Reproduce with `bun -e "import * as os from 'bun:os'; console.log(os.userInfo())"`.

- [ ] **The `ws` package client ignores top-level TLS options under Bun.** Under Node, both the
      global `WebSocket` and the `ws` package client accept the TLS material (`ca`, `cert`, `key`,
      `rejectUnauthorized`) as top-level constructor options, the same way `https.request` does:
      `new WebSocket(url, { ca, cert, key, rejectUnauthorized })`. Under Bun, the `ws` package
      delegates to Bun's native `WebSocket` implementation, which only reads TLS options nested
      under a `tls` field (`new WebSocket(url, { tls: { ca, cert, key, rejectUnauthorized } })`).
      Passing the Node-style top-level options under Bun does not throw — it silently falls back
      to Bun's default TLS settings, so the handshake fails against a self-signed/mTLS server with
      a `close` event, code 1015 ("TLS handshake failed"), or the connection is torn down entirely
      (code 1006) if the server also requires a client certificate. This bit `matterbridge-hass`'s
      `HomeAssistant.connect()`, which opens an outbound `wss://` connection to Home Assistant with
      a custom CA and/or `rejectUnauthorized: false` and previously passed those fields top-level
      only.
      Workaround (works identically on both Node and Bun, no runtime detection needed): pass the
      TLS fields **both** top-level and nested under `tls` in the same options object — each
      runtime reads the shape it understands and ignores the other.
      Reproduced and asserted by [buntest/wssTest.test.ts](./buntest/wssTest.test.ts).
      Reported upstream: [oven-sh/bun#31396](https://github.com/oven-sh/bun/issues/31396) (open,
      "WebSocket npm fails TLS handshake with self signed certificates"), with a fix proposed in
      [oven-sh/bun#31397](https://github.com/oven-sh/bun/pull/31397) (open, not yet merged) —
      revisit dropping the workaround once that lands in a release.
