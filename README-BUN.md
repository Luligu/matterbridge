# <img src="https://matterbridge.io/assets/matterbridge.svg" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge on Bun

[![matterbridge.io](https://img.shields.io/badge/matterbridge.io-online-brightgreen)](https://matterbridge.io)
[![Docker Image Size](https://img.shields.io/docker/image-size/luligu/matterbridge/bun?label=bun%20image%20size)](https://hub.docker.com/r/luligu/matterbridge/tags?name=bun)
[![ESM](https://img.shields.io/badge/ESM-Node.js-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![ESM](https://img.shields.io/badge/ESM-Bun-000000?logo=bun&logoColor=white)](https://bun.com)

---

# What is Bun

[Bun](https://bun.com) is an all-in-one JavaScript and TypeScript toolkit: a runtime, package manager, bundler, and test runner in a single executable. It is designed as a drop-in replacement for Node.js and runs most npm packages and Node.js APIs unchanged.

## Why it is so fast

- It runs on **JavaScriptCore**, the engine behind Safari, which is tuned for fast startup and low memory use.
- It is written in **Zig**, a low-level systems language, so the core APIs (file system, networking, HTTP, WebSocket) are native code, not JavaScript layers.
- It runs **TypeScript directly**, without a separate compile step.
- Its **package manager** uses a global cache and hard links, so installs are much faster than npm.

## Why I invest in Bun

I believe Bun is the future of the JavaScript runtime. In December 2025 [Anthropic acquired Bun](https://bun.com/blog/bun-joins-anthropic), and it now powers Claude Code and the Claude Agent SDK. Bun stays open source and MIT-licensed, and now has long-term backing. That is why I spend time making Matterbridge and its plugins run well on Bun.

## Bun documentation

- [Bun docs](https://bun.com/docs)
- [Installation](https://bun.com/docs/installation)
- [Runtime](https://bun.com/docs/runtime)
- [Node.js compatibility](https://bun.com/docs/runtime/nodejs-compat)
- [Package manager](https://bun.com/docs/pm/cli/install)

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

# Bun docker image

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

# Bun projects

## Matterbridge on a Raspberry Pi Zero 2 W

A headless Pi Zero 2 W (512 MB RAM) running Matterbridge on Bun, with zram swap, a trimmed service list, and the graphics stack disabled to free RAM. Tested with a bridge of 50 devices.

See [Matterbridge on a Raspberry Pi Zero 2 W](Raspi-zero-2w-matterbridge.md) for the full setup.

## Matterbridge on a Raspberry Pi 4 Model B

A headless Pi 4 Model B (8 GB RAM) running Matterbridge on Bun as the only runtime, with no swap, no Docker, passwordless sudo, a trimmed service list, and the graphics stack disabled.

See [Matterbridge on a Raspberry Pi 4 Model B](Raspi-4b-matterbridge.md) for the full setup.

# Status

The core bridge runs on Bun: it creates its directories, initializes the Matter
node storage, and brings up the server node and endpoints. The web frontend is
built and served. See the TODO list below for the known limitations.

---

## Known issues (checked on Bun 1.4.4)

- [ ] **Bun docker image cannot resolve the container user name.** In the official Bun images,
      both `node:os` and `bun:os` return `username: "unknown"` and `shell: "unknown"`
      from `os.userInfo()`, even though they correctly return the UID, GID, and home
      directory. Consequently, Matterbridge sends `User: unknown` to the frontend
      system-information view instead of the container account (for example, `root`).
      Reproduce with `bun -e "import * as os from 'bun:os'; console.log(os.userInfo())"`.
      Still present in `oven/bun:1.4.4-slim`. Tracked upstream:
      [oven-sh/bun#39859](https://github.com/oven-sh/bun/issues/39859) and
      [oven-sh/bun#25171](https://github.com/oven-sh/bun/issues/25171) (both open).

## Fixed in Bun 1.4.4

- [x] **The `ws` package client ignored top-level TLS options under Bun (up to 1.4.3).** Under Node, the
      `ws` package client accepts the TLS material (`ca`, `cert`, `key`, `rejectUnauthorized`) as
      top-level constructor options, the same way `https.request` does:
      `new WebSocket(url, { ca, cert, key, rejectUnauthorized })`. Up to Bun 1.4.3 the `ws` package
      delegated to Bun's native `WebSocket` implementation, which only reads TLS options nested
      under a `tls` field (`new WebSocket(url, { tls: { ca, cert, key, rejectUnauthorized } })`), and
      silently fell back to Bun's default TLS settings, so the handshake failed against a
      self-signed/mTLS server with a `close` event, code 1015 ("TLS handshake failed"). This bit
      `matterbridge-hass`'s `HomeAssistant.connect()`, which opens an outbound `wss://` connection to
      Home Assistant with a custom CA and/or `rejectUnauthorized: false`.
      Since Bun 1.4.4 the `ws` package client honors the top-level shape like Node does. The global
      `WebSocket` still reads TLS options only under `tls` (Node's global `WebSocket` ignores the
      top-level shape too), and a failed handshake now closes with code 1006 instead of 1015.
      The workaround (pass the TLS fields **both** top-level and nested under `tls` in the same
      options object) still works on Node and on every Bun release; drop the `tls` copy only when
      Bun 1.4.3 and older no longer need to be supported.
      Asserted by [packages/core/buntest/wssTest.test.ts](./packages/core/buntest/wssTest.test.ts).
      Reported upstream: [oven-sh/bun#31396](https://github.com/oven-sh/bun/issues/31396), fixed by
      [oven-sh/bun#44618](https://github.com/oven-sh/bun/pull/44618), released in Bun 1.4.4.

- [x] **`bun test --coverage` never counted implicit class constructors as called (up to 1.4.3).** A
      derived class without its own constructor gets the default
      `constructor(...args) { super(...args); }` from the language, and it runs on every `new`.
      JavaScriptCore recorded that synthesized constructor as a function that never executed, so
      `% Funcs` dropped below 100% in every file of `packages/core/src/devices` that defines a
      `Matterbridge…Server` behavior class (for example
      [laundryDryer.ts](./packages/core/src/devices/laundryDryer.ts) at 83.33%). On Bun 1.4.4 all of
      them report 100% functions.
      Do not add `constructor(...args) { super(...args); }` only to satisfy the report: it is
      useless code and the implicit constructor is the correct form.
      Reported upstream: [oven-sh/bun#42730](https://github.com/oven-sh/bun/issues/42730), fixed by
      [oven-sh/bun#45677](https://github.com/oven-sh/bun/pull/45677), released in Bun 1.4.4.

## Coverage line reporting since Bun 1.4.4

The same fix ([oven-sh/bun#45677](https://github.com/oven-sh/bun/pull/45677)) makes Bun report
the exact lines that never ran. Up to Bun 1.4.3 the full `npm run test:bun:coverage` run reported
100% lines; on Bun 1.4.4 it reports 99.88% lines and 99.97% functions (was 98.97%). There is no
test regression: the newly uncovered lines are code Bun never runs, which Bun 1.4.3 counted as covered:

- Node-only fallbacks, for example the `process.hrtime`/`delay` branches in
  [runtimeBun.ts](./packages/utils/src/runtimeBun.ts) and the `global.gc` branch in
  [tracker.ts](./packages/utils/src/tracker.ts).
- Blocks excluded with `v8 ignore` comments, which Bun does not honor (it has no line-level
  ignore), for example the `MATTERBRIDGE_CHIP_TEST` branches in
  [closure.ts](./packages/core/src/devices/closure.ts) and
  [matterNode.ts](./packages/core/src/matterNode.ts).
- `catch` blocks no Bun test triggers, for example in
  [matterNode.ts](./packages/core/src/matterNode.ts).

`coverageThreshold` is not enabled in [bunfig.toml](./bunfig.toml), so the lower line figure does
not fail the run.
