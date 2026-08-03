<!-- eslint-disable markdown/no-multiple-h1 -->

# <img src="https://matterbridge.io/assets/matterbridge.svg" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge on Bun

[![matterbridge.io](https://img.shields.io/badge/matterbridge.io-online-brightgreen)](https://matterbridge.io)
[![Docker Image Size](https://img.shields.io/docker/image-size/luligu/matterbridge/bun?label=bun%20image%20size)](https://hub.docker.com/r/luligu/matterbridge/tags?name=bun)
[![ESM](https://img.shields.io/badge/ESM-Node.js-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![ESM](https://img.shields.io/badge/ESM-Bun-000000?logo=bun&logoColor=white)](https://bun.com)

---

# Run mattebridge with bun

## Install matterbridge globally with bun

```shell
bun add matterbridge --global --omit=dev
```

## Run matterbridge with bun

```shell
bunx --bun matterbridge
```

# Run matterbridge with the bun docker hub image (experimental)

The image (tag **bun** 69 MB) includes only Matterbridge, using the latest release published on npm. This image is based on `oven/bun:slim`. Plugins are not included in the image: they will be reinstalled on first run.

```shell
docker pull luligu/matterbridge:bun && docker run --name matterbridge -v ~/Matterbridge:/root/Matterbridge -v ~/.matterbridge:/root/.matterbridge -v ~/.mattercert:/root/.mattercert --network host --restart always --stop-timeout 60 -d luligu/matterbridge:bun
```

# Bun local image (development)

The **bun** image runs Matterbridge directly from the **local source files** with [Bun](https://bun.com) runtime.

- Base image: `oven/bun:slim` (Debian trixie slim + Bun).
- Install dependencies and link only (no build!) with Bun:
  - `bun install --omit=dev `
  - `bun link`

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
- [x] **Bun node:worker_threads module is unstable** The runtime randomly crashes on worker exit. See [Worker thread crash (SIGTRAP) on ARM64](#worker-thread-crash-sigtrap-on-arm64) for the full analysis and captured log.
- [x] **Bun needs process.exit() or worker.terminate().** If not called the memory is not released.
- [x] **Validate Bun/Node compatibility** of the full runtime over a longer run
      (commissioning, mDNS, plugin behaviors) — only short smoke starts verified.

## Known issue

- [ ] **Bun cannot resolve the container user name.** In the official Bun images,
      both `node:os` and `bun:os` return `username: "unknown"` and `shell: "unknown"`
      from `os.userInfo()`, even though they correctly return the UID, GID, and home
      directory. Consequently, Matterbridge sends `User: unknown` to the frontend
      system-information view instead of the container account (for example, `root`).
      Reproduce with `bun -e "import * as os from 'bun:os'; console.log(os.userInfo())"`.
- [ ] **Matter.js atomic writes fail under Bun on windows.** Repro with bun --eval "import { mkdir, open, rename, rm, readFile } from 'node:fs/promises'; const dir='C:/Users/lligu/.matterbridge/bun-rename-repro'; await rm(dir,{recursive:true,force:true}); await mkdir(dir,{recursive:true}); const final=dir+'/final'; await Bun.write(final,'old'); for (let i=0;i<1000;i++){ const tmp=final+'.tmp'; const handle=await open(tmp,'w'); const writer=handle.createWriteStream({encoding:'utf8',flush:true}); await new Promise((resolve,reject)=>{writer.on('finish',resolve);writer.on('error',reject);writer.write('new '+i);writer.end();}); await handle.close(); await rename(tmp,final); } console.log(await readFile(final,'utf8')); await rm(dir,{recursive:true,force:true});". The issue I openend on Bun repo has been merged and closed. Next release should have it fixed.

```typescript
// Change: FileStorageDriver.js
async #writeAndMoveFile(filepath, valueOrStream) {
  const tmpName = `${filepath}.tmp`;
  await writeFile(tmpName, valueOrStream, { encoding: "utf8", flush: true });
  await rename(tmpName, filepath);
}
```

```typescript
// Change: FileStorageDriver.js
import { isBunjs } from '../../util/runtimeChecks.js';
if (isBunjs()) {
  if (typeof valueOrStream === 'string') {
    await writeFile(tmpName, valueOrStream, { encoding: 'utf8', flush: true });
  } else {
    const value = new Uint8Array(await new Response(valueOrStream).arrayBuffer());
    await writeFile(tmpName, value, { flush: true });
  }
  await rename(tmpName, filepath);
  return;
}
```

```typescript
/**
 * @license
 * Copyright 2022-2026 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import * as assert from 'node:assert';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { FileStorageDriver } from '../../src/storage/fs/FileStorageDriver.js';

describe('FileStorageDriver Bun runtime', () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), 'matterjs-file-storage-bun-test-'));
  });

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  it('uses the Bun write path for string and stream values', async () => {
    const previousBun = process.versions.bun;
    Object.defineProperty(process.versions, 'bun', { value: '1', configurable: true });
    try {
      const storage = new FileStorageDriver(rootDir);
      await storage.initialize();
      await storage.set(['context'], 'text', 'value');
      assert.equal(await storage.get(['context'], 'text'), 'value');

      await storage.writeBlobFromStream(
        ['context'],
        'blob',
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new Uint8Array([1, 2, 3]));
            controller.close();
          },
        }),
      );
      await storage.close();

      const file = await readFile(join(rootDir, 'context.blob'));
      assert.deepEqual(new Uint8Array(file), new Uint8Array([1, 2, 3]));
    } finally {
      if (previousBun === undefined) {
        delete process.versions.bun;
      } else {
        Object.defineProperty(process.versions, 'bun', { value: previousBun, configurable: true });
      }
    }
  });
});
```
