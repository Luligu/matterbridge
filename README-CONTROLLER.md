# <img src="https://matterbridge.io/assets/matterbridge.svg" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge controller

[![npm version](https://img.shields.io/npm/v/matterbridge.svg)](https://www.npmjs.com/package/matterbridge)
[![npm downloads](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/Luligu/b21088ab9c9f2b119b42c33f0fef218d/raw/npm.json)](https://www.npmjs.com/package/matterbridge)
[![Docker Version](https://img.shields.io/docker/v/luligu/matterbridge/latest?label=docker%20version)](https://hub.docker.com/r/luligu/matterbridge)
[![Docker Pulls](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/Luligu/b21088ab9c9f2b119b42c33f0fef218d/raw/docker.json)](https://hub.docker.com/r/luligu/matterbridge)
![Node.js CI](https://github.com/Luligu/matterbridge/actions/workflows/build.yml/badge.svg)
![CodeQL](https://github.com/Luligu/matterbridge/actions/workflows/codeql.yml/badge.svg)
[![Codecov](https://codecov.io/gh/Luligu/matterbridge/branch/main/graph/badge.svg)](https://codecov.io/gh/Luligu/matterbridge)
[![tested with Vitest](https://img.shields.io/badge/tested_with-Vitest-6E9F18.svg?logo=vitest&logoColor=white)](https://vitest.dev)
[![styled with Oxc](https://img.shields.io/badge/styled_with-Oxc-9BE4E0.svg?logo=oxc&logoColor=white)](https://oxc.rs/docs/guide/usage/formatter.html)
[![linted with Oxc](https://img.shields.io/badge/linted_with-Oxc-9BE4E0.svg?logo=oxc&logoColor=white)](https://oxc.rs/docs/guide/usage/linter.html)
[![TypeScript Native](https://img.shields.io/badge/TypeScript_Native-3178C6?logo=typescript&logoColor=white)](https://github.com/microsoft/typescript-go)
[![ESM](https://img.shields.io/badge/ESM-Node.js-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![ESM](https://img.shields.io/badge/ESM-Bun-000000?logo=bun&logoColor=white)](https://bun.com)
[![matterbridge.io](https://img.shields.io/badge/matterbridge.io-online-brightgreen)](https://matterbridge.io)

[![powered by](https://img.shields.io/badge/powered%20by-matter--history-blue)](https://www.npmjs.com/package/matter-history)
[![powered by](https://img.shields.io/badge/powered%20by-node--ansi--logger-blue)](https://www.npmjs.com/package/node-ansi-logger)
[![powered by](https://img.shields.io/badge/powered%20by-node--persist--manager-blue)](https://www.npmjs.com/package/node-persist-manager)

---

## Controller mode

Controller identity and known peers are persisted in `matterstorage/MatterbridgeController`, separately from bridge storage. Controller mode does not start the frontend. By default, matter.js uses an available port assigned by the operating system. Pass `--port` only if you need a fixed listening port.

### Start the controller

Connect all commissioned peers:

```bash
matterbridge --controller
```

### Discover devices

Discover commissionable devices:

```bash
matterbridge --controller --discover
```

### List peers

List all known peers labeled `commissioned` or `discovered`, with separate known-node and paired-node counts:

```bash
matterbridge --controller --peers
```

### Pair with a manual pairing code

Replace the example pairing code with your device's code. `--node 1` assigns the local peer name `peer1` when discovery creates a new peer; choose an unused number or omit `--node` to assign one automatically. If the device already has a stored discovery record, matter.js reuses that record and its local node number. Check `--peers` after pairing.

```bash
matterbridge --controller --pair --pairingcode 32902218933 --node 1
```

### Pair with a discriminator and passcode

Replace the example discriminator (0–4095) and passcode with your device's values:

```bash
matterbridge --controller --pair --discriminator 3840 --passcode 20202021 --node 1
```

### Connect one peer

Use the local node number shown by `--peers`. The examples below use Node 1:

```bash
matterbridge --controller --node 1
```

### Trace attribute and event reports

```bash
matterbridge --controller --node 1 --trace-peer
```

### Dump Basic Information

Read and log the peer's Basic Information:

```bash
matterbridge --controller --node 1 --dump-peer
```

### Unpair one peer

Decommission Node 1:

```bash
matterbridge --controller --unpair --node 1
```

### Unpair all peers

Decommission all commissioned peers:

```bash
matterbridge --controller --unpairall
```

### Reset controller storage

Clear the controller identity, credentials, and all known peers, then exit. Bridge and plugin storage are preserved. This only clears local storage: previously paired devices retain the controller's fabric. Use `--unpairall` first to remove it from reachable devices.

```bash
matterbridge --controller --reset
```

### Development tests

The VS Code tasks `Test: MatterController` (Vitest) and `Buntest: MatterController` (Bun) run isolated controller tests with coverage. Both suites use fake peers, in-memory storage, and a file-backed reset regression test.
