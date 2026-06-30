<!-- eslint-disable markdown/no-multiple-h1 -->

# <img src="https://matterbridge.io/assets/matterbridge.svg" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge on Bun

[![matterbridge.io](https://img.shields.io/badge/matterbridge.io-online-brightgreen)](https://matterbridge.io)
[![Docker Image Size](https://img.shields.io/docker/image-size/luligu/matterbridge/bun?label=bun%20image%20size)](https://hub.docker.com/r/luligu/matterbridge/tags?name=bun)
[![ESM](https://img.shields.io/badge/ESM-Node.js-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![ESM](https://img.shields.io/badge/ESM-Bun-000000?logo=bun&logoColor=white)](https://bun.com)

---

# Bun local development in container

```bash
docker pull oven/bun:latest && docker run -dit --network matterbridge -p 8283:8283 --name bun-development oven/bun:latest bash
docker exec -it bun-development bash
```

## inside the container clone, build and run matterbridge

```bash
apt-get update && apt-get install -y git
git clone --depth 1 --single-branch --no-tags --branch dev https://github.com/Luligu/matterbridge.git && cd matterbridge
bun install
bun run build
cd apps/frontend
bun install
bun run build
cd ../..
bun link
matterbridge --docker --logger debug --debug
```

# Bun docker hub image (experimental — for test and development only)

The image (tag **bun** 69 MB) includes only Matterbridge, using the latest release published on npm. This image is based on `oven/bun:slim`. Plugins are not included in the image: they will be reinstalled on first run.

# Bun local image (experimental — for test and development only)

The **bun** image builds Matterbridge from the **local source files** and runs it on the
[Bun](https://bun.com) runtime instead of Node.js.

- Base image: `oven/bun:slim` (Debian trixie slim + Bun), mirroring the `node:24-trixie-slim` base of the `local` image.
- Builds exactly like the `local` image, with the npm commands adapted to Bun:
  - `npm ci` → `bun install`
  - `npm run build` → `bun run build` (backend `tsgo` build and frontend `vite` build are still run; the runtime uses the compiled `dist/`)
  - `npm prune --omit=dev` → `bun install --omit=dev`
  - `npm cache clean` → `bun pm cache rm`
  - `npm link` → `bun link`

## Files

| File                                                                                   | Purpose                                                                      |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [`docker/Dockerfile.local.bun`](docker/Dockerfile.local.bun)                           | The Bun image definition                                                     |
| [`docker/Dockerfile.local.bun.dockerignore`](docker/Dockerfile.local.bun.dockerignore) | Per-Dockerfile build context (keeps source, drops `.git`/`chip`/`scripts`/…) |
| [`docker/entrypoint.local.bun.sh`](docker/entrypoint.local.bun.sh)                     | Entrypoint banner (prints the Bun version)                                   |

## Scripts

```bash
npm run docker:build:localbun   # build the image (matterbridge:local-bun)
npm run docker:run:localbun     # run it (container matterbridge-local-bun, port 8283)
npm run docker:exec:localbun    # open a shell in the running container
npm run docker:log:localbun     # follow the container logs
```

## Status

The core bridge runs on Bun: it creates its directories, initializes the Matter
node storage, and brings up the server node and endpoints. The web frontend is
built and served. See the TODO list below for the known limitations.

---

# Bun port status

The approach is to detect if running in `bun` with isBun() and switch the
package-manager command and global-modules paths to Bun where needed.

## Done

- [x] **Global package resolution.** `bun link` (in `Dockerfile.bun`) registers the
      local build as the global `matterbridge` package — and installs all CLI bins
      and their exec bits — so plugins resolve `import 'matterbridge'`. This is the
      full `npm link` replacement.
- [x] **`npm root -g` discovery.** `getGlobalNodeModules()` returns
      `getGlobalBunModules()` when running on Bun (there is no `bun root -g`; the path is
      derived from `$BUN_INSTALL` / `~/.bun`).
      ([`npmPrefix.ts`](packages/utils/src/npmPrefix.ts), [`runtimeBun.ts`](packages/utils/src/runtimeBun.ts))
- [x] **Plugin path resolution.** `PluginManager` resolves plugins from the Bun
      global modules dir when running on Bun. ([`pluginManager.ts`](packages/core/src/pluginManager.ts))
- [x] **Runtime-aware package management.** Plugin installation, uninstallation,
      uploaded tarball installation, Matterbridge updates, and Docker-recreate
      recovery use Bun commands when running on Bun. The SpawnCommand worker also
      supports Bun on Windows and through `sudo`.
      ([`pluginManager.ts`](packages/core/src/pluginManager.ts), [`frontend.ts`](packages/core/src/frontend.ts), [`backendExpress.ts`](packages/core/src/backendExpress.ts), [`spawnCommand.ts`](packages/thread/src/spawnCommand.ts))
- [x] **Auto-reinstall on Docker recreate.** Uses `isBun() ? 'bun' : 'npm'`.
      ([`matterbridge.ts`](packages/core/src/matterbridge.ts))
- [x] **`--add` local plugin.** When running on Bun, the plugin is no longer treated as
      "local", so the `npm link matterbridge` step is skipped (`bun link` already
      provides resolution). ([`matterbridge.ts`](packages/core/src/matterbridge.ts))
- [x] **The threads doesn't flag no running after exit.**

## Known issue

- [ ] **Bun node:worker_threads module is unstable** The runtime randomly crashes on worker exit. See [Worker thread crash (SIGTRAP) on ARM64](#worker-thread-crash-sigtrap-on-arm64) for the full analysis and captured log.
- [ ] **Bun needs process.exit() or worker.terminate().** If not called the memory is not released.
- [ ] **Bun cannot resolve the container user name.** In the official Bun images,
      both `node:os` and `bun:os` return `username: "unknown"` and `shell: "unknown"`
      from `os.userInfo()`, even though they correctly return the UID, GID, and home
      directory. Consequently, Matterbridge sends `User: unknown` to the frontend
      system-information view instead of the container account (for example, `root`).
      Reproduce with `bun -e "import * as os from 'bun:os'; console.log(os.userInfo())"`.
- [ ] **Matter.js atomic writes fail under Bun on windows.** Repro with bun --eval "import { mkdir, open, rename, rm, readFile } from 'node:fs/promises'; const dir='C:/Users/lligu/.matterbridge/bun-rename-repro'; await rm(dir,{recursive:true,force:true}); await mkdir(dir,{recursive:true}); const final=dir+'/final'; await Bun.write(final,'old'); for (let i=0;i<1000;i++){ const tmp=final+'.tmp'; const handle=await open(tmp,'w'); const writer=handle.createWriteStream({encoding:'utf8',flush:true}); await new Promise((resolve,reject)=>{writer.on('finish',resolve);writer.on('error',reject);writer.write('new '+i);writer.end();}); await handle.close(); await rename(tmp,final); } console.log(await readFile(final,'utf8')); await rm(dir,{recursive:true,force:true});"

```typescript
  // Change: FileStorageDriver.js
  async #writeAndMoveFile(filepath, valueOrStream) {
    const tmpName = `${filepath}.tmp`;
    await writeFile(tmpName, valueOrStream, { encoding: "utf8", flush: true });
    await rename(tmpName, filepath);
  }
```

## TODO

- [ ] **Validate Bun/Node compatibility** of the full runtime over a longer run
      (commissioning, mDNS, plugin behaviors) — only short smoke starts verified.

---

# Worker thread crash (SIGTRAP) on ARM64

Detailed analysis of the `node:worker_threads` instability listed under [Known issue](#known-issue).

## Symptom

The whole process dies with **no output** — nothing on stdout/stderr, `docker logs` is empty, and the container reports `ExitCode=0` / `OOMKilled=false`. It then restarts under `--restart always`, so it looks like the process "just killed itself."

## Environment

- **Bun:** 1.3.14
- **Arch:** ARM64 (Apple Silicon / Windows‑ARM under WSL2)
- **Worker:** `CheckUpdates` — the heaviest worker (multiple dynamic `import()`s plus `fetch()` to `matterbridge.io` and the npm registry), so it stays busy longest and is most likely to be running native work when it is torn down.

## Diagnosis

The only trace is in the **kernel ring buffer** (`dmesg`), where the worker thread (named `CheckUpdates` via `WorkerOptions.name`) is reported receiving **fatal signal 5 (`SIGTRAP`)** — a deliberate trap instruction emitted by Bun's own native (JSC/JIT) code, i.e. an assertion / `unreachable`. A native `SIGTRAP` bypasses Bun's JS panic printer, which is why it is silent (no `oh no: Bun has crashed` report).

The crash is **deterministic in location, random in timing**. Across three separate crashes the faulting `pc`/`lr` offsets (`…1ae0` / `…1ac0`) and registers (`x17 = 0x05c11250`, `x15 = 0x003c47b5`, `x8 = 0x87`, …) are identical — only the high base address differs (ASLR). Same instruction in the same Bun code path every time. The crashes also land ~3–5 minutes apart, matching the periodic update-check cycle.

There is **no `Code:` disassembly or `Call trace:`** line — this WSL2 ARM64 kernel stops at the `x0` register. The register dump below is the complete payload `dmesg` provides; a symbolized native backtrace would require a core dump or `BUN_CRASH_REPORT_DIR`.

## How to inspect

```bash
dmesg | grep -i bun                              # all bun crashes
dmesg -T | grep -i "fatal signal"                # with wall-clock timestamps
dmesg -w | grep -i bun | tee ~/bun-crashes.log   # capture future crashes
```

`dmesg` is the WSL2 VM kernel's buffer (shared across containers and the host distro). It is volatile — cleared on `wsl --shutdown` and wrapped when full — so `tee` it to a file to keep a durable copy.

## Captured log

Three consecutive crashes, each immediately followed by the container's `veth` teardown as it restarts.

```text
[17065.328952] bun: CheckUpdates: potentially unexpected fatal signal 5.
[17065.332612] CPU: 7 UID: 0 PID: 26406 Comm: CheckUpdates Not tainted 6.18.33.2-microsoft-standard-WSL2 #1 PREEMPT(none)
[17065.332633] Hardware name: Microsoft Corporation Virtual Machine/Virtual Machine, BIOS Hyper-V UEFI Release v4.1 09/25/2025
[17065.332642] pstate: 00001000 (nzcv daif -PAN -UAO -TCO -DIT +SSBS BTYPE=--)
[17065.332655] pc : 0000fc0f05c01ae0
[17065.332661] lr : 0000fc0f05c01ac0
[17065.332666] sp : 0000fc0e6d3a1600
[17065.332671] x29: 0000fc0e6d3a16b0 x28: 0000000000000df4 x27: 0000000000000dc0
[17065.332691] x26: fff0000000000000 x25: 0000000000000001 x24: 0000fc0e6f3fdab0
[17065.332710] x23: 0000fc0e54fe13e0 x22: 0000000000003fff x21: 0000fc0e59ca9010
[17065.332728] x20: 0000fc0e54e45ca8 x19: 0000fc0e5419c960 x18: 0000000000000000
[17065.332746] x17: 0000000005c11250 x16: 0000000000000001 x15: 00000000003c47b5
[17065.332764] x14: 0000000000000008 x13: 0000000000000000 x12: 0000fc0f05de4640
[17065.332781] x11: 0000000000000000 x10: 0000fc0f05bf5ce8 x9 : 0000fc0e59cc1010
[17065.332799] x8 : 0000000000000087 x7 : 0000000000000000 x6 : 0000000000000000
[17065.336940] x5 : 0000000000000000 x4 : 0000000000000020 x3 : 0000000000000008
[17065.336958] x2 : 0000000000000000 x1 : 0000fc0e6d3a1608 x0 : 0000000000000000

[17368.725178] bun: CheckUpdates: potentially unexpected fatal signal 5.
[17368.729999] CPU: 5 UID: 0 PID: 27987 Comm: CheckUpdates Not tainted 6.18.33.2-microsoft-standard-WSL2 #1 PREEMPT(none)
[17368.730011] Hardware name: Microsoft Corporation Virtual Machine/Virtual Machine, BIOS Hyper-V UEFI Release v4.1 09/25/2025
[17368.730017] pstate: 00001000 (nzcv daif -PAN -UAO -TCO -DIT +SSBS BTYPE=--)
[17368.730026] pc : 0000fd6d68f61ae0
[17368.730031] lr : 0000fd6d68f61ac0
[17368.730035] sp : 0000fd6d20771600
[17368.730038] x29: 0000fd6d207716b0 x28: 0000000000000df8 x27: 0000000000000dc0
[17368.730053] x26: ff00000000000000 x25: 0000000000000001 x24: 0000fd6d393cdaf0
[17368.730067] x23: 0000fd6bb7fb0ea0 x22: 0000000000003fff x21: 0000fd6d3c31b010
[17368.730079] x20: 0000fd6bb7a228c8 x19: 0000fd6bb7153b20 x18: 0000000000000000
[17368.730092] x17: 0000000005c11250 x16: 0000000000000001 x15: 00000000003c47b5
[17368.730105] x14: 0000000000000008 x13: 0000000000000000 x12: 0000fd6d69147640
[17368.730117] x11: 0000000000000000 x10: 0000fd6d68f55ce8 x9 : 0000fd6d3c333010
[17368.730130] x8 : 0000000000000087 x7 : 0000000000000000 x6 : 0000000000000000
[17368.730142] x5 : 0000000000000000 x4 : 0000000000000020 x3 : 0000000000000008
[17368.730154] x2 : 0000000000000000 x1 : 0000fd6d20771608 x0 : 0000000000000000

[17579.904983] bun: CheckUpdates: potentially unexpected fatal signal 5.
[17579.905014] CPU: 4 UID: 0 PID: 30820 Comm: CheckUpdates Not tainted 6.18.33.2-microsoft-standard-WSL2 #1 PREEMPT(none)
[17579.905028] Hardware name: Microsoft Corporation Virtual Machine/Virtual Machine, BIOS Hyper-V UEFI Release v4.1 09/25/2025
[17579.905035] pstate: 00001000 (nzcv daif -PAN -UAO -TCO -DIT +SSBS BTYPE=--)
[17579.905046] pc : 0000f4103f781ae0
[17579.905052] lr : 0000f4103f781ac0
[17579.905057] sp : 0000f41000f915b0
[17579.905063] x29: 0000f41000f91660 x28: 0000000000000df3 x27: 0000000000000dc0
[17579.905083] x26: fff8000000000000 x25: 0000000000000001 x24: 0000f3ff9e05daa0
[17579.905102] x23: 0000f3ff8eee1bc0 x22: 0000000000003fff x21: 0000f3ff93c71010
[17579.905120] x20: 0000f3ff8e9514c8 x19: 0000f3ff8e444de0 x18: 0000000000000000
[17579.905137] x17: 0000000005c11250 x16: 0000000000000001 x15: 00000000003c47b5
[17579.905155] x14: 0000000000000008 x13: 0000000000000000 x12: 0000f4103f96f640
[17579.905173] x11: 0000000000000000 x10: 0000f4103f775ce8 x9 : 0000f3ff93c89010
[17579.905191] x8 : 0000000000000087 x7 : 0000000000000000 x6 : 0000000000000000
[17579.905208] x5 : 0000000000000000 x4 : 0000000000000020 x3 : 0000000000000008
[17579.905225] x2 : 0000000000000000 x1 : 0000f41000f915b8 x0 : 0000000000000000
```
