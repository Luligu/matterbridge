<!-- eslint-disable markdown/no-multiple-h1 -->

# <img src="https://matterbridge.io/assets/matterbridge.svg" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge on Bun

[![matterbridge.io](https://img.shields.io/badge/matterbridge.io-online-brightgreen)](https://matterbridge.io)

---

# Bun docker hub image (experimental — for test and development only)

The image (tag **bun** 80 MB) includes only Matterbridge, using the latest release published on npm. This image (**for test and development only**) is based on `oven/bun:slim`. Plugins are not included in the image: they will be reinstalled on first run.

# Bun local image (experimental — for test and development only)

The **bun** image builds Matterbridge from the **local source files** and runs it on the
[Bun](https://bun.com) runtime instead of Node.js.

- Base image: `oven/bun:slim` (Debian trixie slim + Bun), mirroring the `node:24-trixie-slim` base of the `local` image.
- Builds exactly like the `local` image, with the npm commands adapted to Bun:
  - `npm ci` → `bun install`
  - `npm run build` → `bun run build` (backend `tsgo` build and frontend `vite` build are still run; the runtime uses the compiled `dist/`)
  - `npm prune --omit=dev` → `bun install --production`
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
      ([`npmPrefix.ts`](packages/utils/src/npmPrefix.ts), [`bunPrefix.ts`](packages/utils/src/bunPrefix.ts))
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

## Known limitations

- [ ] **Bun cannot resolve the container user name.** In the official Bun images,
      both `node:os` and `bun:os` return `username: "unknown"` and `shell: "unknown"`
      from `os.userInfo()`, even though they correctly return the UID, GID, and home
      directory. Consequently, Matterbridge sends `User: unknown` to the frontend
      system-information view instead of the container account (for example, `root`).
      Reproduce with `bun -e "import * as os from 'bun:os'; console.log(os.userInfo())"`.
      Matterbridge should fall back to resolving the reported UID from `/etc/passwd`
      when Bun reports an unknown user name.

## TODO

- [ ] **Clean up local-plugin detection after a Node-to-Bun Docker migration.**
      [`matterbridge.ts`](packages/core/src/matterbridge.ts) intentionally forces
      `isLocal = false` when running on Bun until stored Node plugin paths can be
      migrated safely.
- [ ] **Shrink the image further.** `oven/bun:slim` yields ~596 MB vs ~396 MB for
      the Node `local` image. `oven/bun:alpine` (142 MB base vs 269 MB slim) is the
      next lever if musl/Bun compatibility checks out.
- [ ] **Validate Bun/Node compatibility** of the full runtime over a longer run
      (commissioning, mDNS, plugin behaviors) — only short smoke starts verified.
