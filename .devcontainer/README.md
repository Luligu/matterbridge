# Matterbridge Dev Containers v.2.1.0

Two dev container variants for Matterbridge, tuned for fast, repeatable start-up:

| Variant | Config                                 | Image                                    | Runtime    | Container user    |
| ------- | -------------------------------------- | ---------------------------------------- | ---------- | ----------------- |
| Node    | `.devcontainer/node/devcontainer.json` | `luligu/matterbridge:node-dev-container` | Node.js 24 | `node` (uid 1000) |
| Bun     | `.devcontainer/bun/devcontainer.json`  | `luligu/matterbridge:bun-dev-container`  | Bun 1.4    | `bun` (uid 1000)  |

Both images are Debian 13 (trixie), published on Docker Hub, and **shared across all Matterbridge repositories** — they contain nothing repository-specific.

Open with **Dev Containers: Reopen in Container** and pick the variant.

---

## Folder layout

```
.devcontainer/
├── README.md              ← this file
├── node/
│   ├── devcontainer.json  Node variant definition
│   ├── post-create.sh     Directory + ownership setup (runs once per container)
│   └── post-start.sh      install → build → link → frontend install → frontend build
└── bun/
    └── (same three files, bun equivalents)
```

There is deliberately no host-side script. `initializeCommand` is defined inline in `devcontainer.json` and
calls only `docker`, so the host needs no interpreter — see requirement 4. The two lifecycle scripts run
**inside** the container, where bash is guaranteed.

---

## What makes it fast

### Everything hot lives on ext4, not on the host filesystem

The workspace is bind-mounted from the host, but every directory with heavy or churn-prone I/O is a **named volume** backed by the VM's own ext4 disk. Host file sharing is never in the path for dependency installs or builds.

```
/workspaces/matterbridge                              → host bind mount (source + .git)
/workspaces/matterbridge/node_modules                 → volume (ext4)
/workspaces/matterbridge/apps/frontend/node_modules   → volume (ext4)
/workspaces/matterbridge/.cache                       → volume (ext4)
```

This is why `npm install`, `tsc` and `vite build` complete in well under a second each even though the source tree is shared from Windows or macOS.

### The VS Code server is cached once and reused everywhere

The external `vscode` volume holds the server binaries and the extension download cache, shared by **both** variants and every rebuild:

```
/vscode/vscode-server/bin/linux-x64/<commit>   symlinked into the container
/vscode/vscode-server/extensionsCache          ~344 MB of .vsix, reused
```

Server binaries are keyed by VS Code commit hash, so this cache survives container rebuilds and is refreshed only when VS Code itself updates. Baking the server into the image would go stale on every VS Code release — the volume is deliberately the better choice.

### Extensions install once, for both variants

A single shared `vscode-extensions` volume is mounted at `/home/<user>/.vscode-server/extensions`. Because both images use uid/gid 1000, the same volume works in either container.

Measured: the Node container seeded the volume in **15.3 s**; the Bun container's very first start afterwards reported all nine extensions _already installed_ and spent **0 s** on them.

> Do not run both variants at the same time. They share this volume, and the VS Code server writes `extensions.json` in it. Sequential switching is fine.

### The host bootstrap needs no interpreter, and still pulls every time

`initializeCommand` runs on the **host** before the container starts.

It is two `docker` commands in the object form, which the Dev Containers CLI runs **in parallel**. The
network check and the image pull overlap, so the pull is very nearly free in wall-clock terms:

### Volume mount points are pre-created in the image

A fresh named volume inherits ownership from the image directory at its mount point — but only if that directory exists. Both Dockerfiles therefore pre-create every fixed `$HOME` mount point (`Matterbridge`, `.matterbridge`, `.mattercert`, `.claude`, `.codex`, `.agents`, `.npm`, `.bun/install/cache`, `.bash-cache`, `.vscode-server/extensions`) before the `chown`, so new volumes come up owned by the container user instead of `root`.

The three workspace volumes cannot be handled this way — their path depends on the repository folder name, and these images are shared across repositories. They are fixed at runtime instead (below).

### Ownership is repaired only when it is actually wrong

`post-create.sh` used to run one recursive `chown` across the workspace and every volume — **159,372 files**, on paths that were already correct. It also generated ~19,000 filesystem events, enough to trip the VS Code file watcher.

It now checks each path first and only recurses when the owner does not match:

```bash
for path in . "${workspace_paths[@]}" "${home_paths[@]}"; do
  if [ "$(stat -c %u "$path")" != "$(id -u)" ]; then
    sudo chown -R "$(id -u):$(id -g)" "$path"
  fi
done
```

On a first create the workspace volumes are empty, so the recursion is instant; afterwards every path is already correct and it is a handful of `stat` calls.

**22 s → 0.077 s** on a first create, **0.050 s** steady state.

### Measured impact

| Optimisation                                 | Before | After                           |
| -------------------------------------------- | ------ | ------------------------------- |
| WSL probing disabled (host setting)          | 3.4 s  | 0 s                             |
| Host bootstrap (`initializeCommand`)         | ~2.1 s | ~0.9 s, and no host interpreter |
| Extension install (second variant / rebuild) | 15.3 s | 0 s                             |
| `post-create.sh` ownership pass              | 22 s   | 0.077 s                         |
| Time to "Launching Dev Containers helper"    | 7.45 s | ~3.2 s                          |

---

## Requirements — Docker VMM high-performance VM

This setup targets **Docker Desktop on Windows or macOS using Docker VMM** (the libkrun-based VM).
Tested on Docker Desktop 4.89.0.

> **On macOS there is nothing to configure.** Docker Desktop already selects Docker VMM by default
> (rather than the Apple Virtualization framework) and shares `/Users` itself during installation, so
> requirements 1–3 are satisfied out of the box — skip to requirement 4. Verified on a real macOS host.
>
> **Requirements 1–3 are Windows-only.** Windows defaults to the WSL2 backend, shares no directory
> until you add one, and enables WSL service forwarding — so all three need attention there.

### 1. Enable Docker VMM

**macOS: already the default, nothing to do.**

Windows — Docker Desktop → **Settings → General → Choose how to run Docker containers → Docker VMM**
(the alternatives are WSL2 and Hyper-V).

Docker still marks this option **BETA**, and describes the trade-off as: Docker VMM is the fastest
across common developer tasks, WSL2 is the most stable and suitable for most use cases, and Hyper-V
suits managed or restricted environments. This dev container is tuned for the Docker VMM path — if
you switch to WSL2 or Hyper-V, requirement 2 below no longer applies in the same way, and requirement
3 becomes relevant again.

Verify — there must be **no** `docker-desktop` WSL distro, and the engine reports a linuxkit kernel:

```bash
wsl -l -v                       # no docker-desktop / docker-desktop-data entries
docker info | grep -i kernel    # Kernel Version: ...-linuxkit
```

### 2. Use Virtual file shares (VirtioFS), not Synchronized file shares

**This is the setting that matters most, and getting it wrong breaks git silently.**

**macOS: nothing to do** — the installer shares `/Users` for you, through the passthrough filesystem. The
warning below still matters if you ever create a Synchronized file share over your repository by hand; you
just will not get one by accident.

Windows — Docker Desktop → **Settings → Resources → File sharing**. Add your repositories' parent folder (e.g. `C:\Users\<you>\GitHub`) under **Virtual file shares**, and make sure it is **not** covered by a **Synchronized file share**.

Under Docker VMM a host path must be shared explicitly — there is no implicit bind mount — so one of the two mechanisms must cover the repository:

| Mechanism                          | Mount type  | `mmap`             | Git inside the container |
| ---------------------------------- | ----------- | ------------------ | ------------------------ |
| Virtual file shares (VirtioFS)     | `virtiofs`  | works              | works                    |
| Synchronized file shares (Mutagen) | `selfowner` | **fails `ENODEV`** | **completely broken**    |

Git memory-maps `.git/index` and `.git/config`. On a synchronized share every git command fails with:

```
fatal: .git/index: unable to map index file: No such device
```

VS Code's Git extension cannot enumerate anything, so the Source Control panel renders an **empty list — "0 changes" — on a dirty tree**. It looks like a clean repository rather than a broken one, which is how it costs you work. Ordinary reads and writes are unaffected, so builds and installs succeed and nothing else hints at the problem.

Verify after any change:

```bash
docker exec matterbridge-node sh -c 'grep " /workspaces/matterbridge " /proc/mounts; \
  cd /workspaces/matterbridge && git status --short | head -5'
```

Expect `virtiofs` and a real file list. If you see `selfowner`, you are on a synchronized share.

The performance cost of choosing VirtioFS here is small, because `node_modules`, the frontend `node_modules` and `.cache` are all ext4 volumes — the share only ever carries the source tree and `.git`.

### 3. Disable WSL service forwarding in VS Code

**macOS: not applicable** — the setting has no effect off Windows, by its own definition.

`dev.containers.forwardWSLServices` defaults to `true`, and on Windows it makes the Dev Containers extension connect to your default WSL distro on every start to look for an SSH agent and X display to forward. With Docker VMM there is no WSL in the picture at all, and if a distro is installed this costs ~3.4 s of cold boot for nothing.

In VS Code **user** settings (`settings.json`):

```jsonc
"dev.containers.forwardWSLServices": false
```

The setting is `application`-scoped: it is ignored in workspace settings and in `devcontainer.json`, so it must live in user settings and cannot be committed with the repository.

A correct start shows no `wsl` commands in the Dev Containers log and reaches `Check Docker is running` in ~100 ms.

### 4. Nothing else on the host

Docker is the only requirement. `initializeCommand` runs **on the host**, before the container exists, and
deliberately uses nothing but the `docker` CLI — no Node.js, no Bun, no bash. The container is the only
toolchain you need to install.

```jsonc
"initializeCommand": {
  "network": "docker network inspect matterbridge --format ok || docker network create --ipv6 matterbridge",
  "pull": "docker pull luligu/matterbridge:node-dev-container"
}
```

The object form runs its entries **in parallel**, each through the host shell — `cmd.exe` on Windows,
`/bin/sh` elsewhere. `||` is one of the few constructs both shells share, and it is needed because
`docker network create` is not idempotent (it exits 1 if the network exists, and any non-zero exit aborts
the container start).

The pull is unconditional by design. It costs ~0.9 s, hides almost entirely behind the network check
running alongside it, and removes the failure mode where a developer silently runs a months-old image
because nothing ever told them to refresh it.

> **The pull refreshes the image, not an existing container.** A container keeps the image it was created
> from for its whole life, and the Dev Containers extension reuses containers by label without ever
> comparing them against the current image. So after a new image is published you must run
> **Dev Containers: Rebuild Container** to actually pick it up. To check whether your container is behind:
>
> ```bash
> docker inspect matterbridge-node --format '{{.Image}}'                        # image it was built from
> docker image inspect luligu/matterbridge:node-dev-container --format '{{.Id}}' # what the tag points to
> ```
>
> Different values mean the container predates the current image.

### 5. Set `TZ` on the host

The container inherits the host timezone via `"containerEnv": { "TZ": "${localEnv:TZ}" }`. Set `TZ` (e.g. `Europe/Paris`) on the host or container logs will use UTC.

### 6. The `matterbridge` Docker network

Created automatically by the `network` entry of `initializeCommand` if missing, equivalent to:

```bash
docker network create --ipv6 matterbridge
```

Containers join it so they can reach each other by name — the default bridge only offers `ip:port`. The frontend is published as a dual-stack binding on `[::]:8283:8283`, so `http://localhost:8283` and `http://[::1]:8283` both work without VS Code port forwarding.

### Optional — turn off CLI hints and Docker Debug

By default Docker Desktop appends a `What's next: Try Docker Debug ...` block after every
`docker exec`. `postCreateCommand` and `postStartCommand` are both `docker exec` calls, so this
advertisement lands in the middle of the Dev Containers log twice on every start, directly after
your own script output — where it reads as if the script printed it.

Docker Desktop → **Settings → General**, and clear both:

- **Show CLI Hints** — "Get CLI hints and tips when running Docker commands in the CLI"
- **Enable Docker Debug by default**

These write the equivalent keys into `~/.docker/config.json`:

```jsonc
"plugins": { "-x-cli-hints": { "enabled": "false" } },
"features": { "hooks": "false" }
```

Use the settings UI rather than hand-editing the file — Docker Desktop rewrites `config.json` on
update and on settings changes, so a manual edit can be reverted.

Purely cosmetic: nothing about the container changes, only the log gets readable.

---

## What is in the images

Both images are `Debian 13 (trixie)` and share an identical package set, installed with
`--no-install-recommends` to keep them lean.

### Runtimes

|         | Node image                   | Bun image            |
| ------- | ---------------------------- | -------------------- |
| Base    | `node:24-trixie-slim`        | `oven/bun:slim`      |
| Runtime | Node.js 24.20.0, npm 11.19.0 | Bun 1.4.2            |
| User    | `node` (uid/gid 1000)        | `bun` (uid/gid 1000) |

The Bun image also ships an `npm` shim at `/usr/local/bin/npm` that forwards to `bun`, and Bun's own Node
fallback at `/usr/local/bun-node-fallback-bin/node`, so tooling that shells out to `npm` or `node` keeps
working.

### Packages

| Package           | Version  | Why it is there                                                                                                                                                                                               |
| ----------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `avahi-utils`     | 0.8      | `avahi-browse`, `avahi-resolve`, `avahi-publish` — mDNS debugging for Matter pairing                                                                                                                          |
| `bubblewrap`      | 0.12.0   | `bwrap` — sandboxing, required by some agent CLIs                                                                                                                                                             |
| `btop`            | 1.3.2    | process/resource monitor                                                                                                                                                                                      |
| `ca-certificates` | 20250419 | TLS trust store for HTTPS                                                                                                                                                                                     |
| `curl`            | 8.14.1   | HTTP client                                                                                                                                                                                                   |
| `dnsutils`        | —        | `dig`, `nslookup`, `host` — DNS debugging                                                                                                                                                                     |
| `fd-find`         | 10.2.0   | fast file finder, symlinked to `fd` at `/usr/local/bin/fd`                                                                                                                                                    |
| `fzf`             | 0.60.3   | fuzzy finder                                                                                                                                                                                                  |
| `git`             | 2.47.3   | version control                                                                                                                                                                                               |
| `iproute2`        | 6.15.0   | `ip` — network interface and route inspection                                                                                                                                                                 |
| `iputils-ping`    | 20240905 | `ping`                                                                                                                                                                                                        |
| `jq`              | 1.7.1    | JSON processing                                                                                                                                                                                               |
| `nano`            | 8.4      | in-terminal editor                                                                                                                                                                                            |
| `openssh-client`  | —        | `ssh`, `ssh-keygen`, `ssh-add`, `scp`, `sftp` — SSH git remotes, forwarded agent, SSH commit signing. Agent forwarding also needs an agent running on the host: macOS starts one by default, Windows does not |
| `procps`          | 4.0.4    | `ps`, `top`, `free`                                                                                                                                                                                           |
| `ripgrep`         | 14.1.1   | fast recursive search (`rg`)                                                                                                                                                                                  |
| `shellcheck`      | 0.10.0   | shell script linting — used on the lifecycle scripts                                                                                                                                                          |
| `shfmt`           | 3.8.0    | shell script formatting                                                                                                                                                                                       |
| `sudo`            | 1.9.16p2 | passwordless sudo for the container user, via `/etc/sudoers.d/<user>`                                                                                                                                         |
| `unzip`           | 6.0      | archive extraction                                                                                                                                                                                            |

### Deliberately not installed

**`gnupg`** — only needed to forward a GPG agent for signed commits. It pulls 15 packages (~7 MB) for a
feature this setup does not use, and GPG agent forwarding from a Windows host is the fragile path. If you
want signed commits, SSH signing via the already-present `ssh-keygen` is the better route. This is why
`gpgconf: not found` appears in the log — a negative capability probe, not an error.

**`docker` / `oras` / `skopeo`** — the container has no Docker CLI and no socket. The extension probes for
one to pull dev container _Features_ from a registry; this setup uses none, so the probe failing is
expected.

### Image conventions

- Bash history is synced across terminals (`shopt -s histappend` plus a `PROMPT_COMMAND` hook) and stored
  on the `bash-cache` volume, with `HISTSIZE=100000` / `HISTFILESIZE=200000`. Debian's stock `.bashrc`
  assignments are stripped at build time so those `ENV` values actually survive into interactive shells.
- Every fixed `$HOME` volume mount point is pre-created and owned by the container user, so fresh volumes
  are seeded correctly instead of coming up `root`-owned.

---

## Volumes

Thirteen volumes are declared per variant, plus the external `vscode` volume injected by the Dev
Containers extension. `<repo>` below is `${localWorkspaceFolderBasename}`, and `~` is `/home/node`
or `/home/bun` depending on the variant.

### Workspace volumes

Mounted inside `${containerWorkspaceFolder}` (`/workspaces/<repo>`). These keep all heavy I/O on the
VM's ext4 disk instead of the host file share. **None can be pre-created in the image** — their path
depends on the repository folder name, and the images are shared across repositories — so they are
the ones `post-create.sh` still has to fix ownership on, on first create.

| Mount point                  | Node volume                         | Bun volume                         | Shared between variants |
| ---------------------------- | ----------------------------------- | ---------------------------------- | ----------------------- |
| `node_modules`               | `<repo>-node-node_modules`          | `<repo>-bun-node_modules`          | no                      |
| `apps/frontend/node_modules` | `<repo>-node-frontend-node_modules` | `<repo>-bun-frontend-node_modules` | no                      |
| `.cache`                     | `<repo>-cache`                      | `<repo>-cache`                     | **yes**                 |

Node and Bun keep separate `node_modules` volumes so the two runtimes never share installed
dependencies. `.cache` is deliberately not variant-suffixed — both use the same build cache.

### Home volumes — per repository

Matterbridge runtime state, kept out of the source tree so it survives rebuilds and never reaches
git. Shared between the two variants, so plugins and pairings carry over when you switch runtime.

| Mount point       | Volume           | Contents                     |
| ----------------- | ---------------- | ---------------------------- |
| `~/Matterbridge`  | `<repo>-plugins` | installed plugins            |
| `~/.matterbridge` | `<repo>-storage` | node-persist storage, config |
| `~/.mattercert`   | `<repo>-cert`    | certificates                 |

### Home volumes — shared across all repositories

Caches and tool state with no repository affinity. One copy serves every Matterbridge repo and both
variants.

| Mount point                   | Volume              | Contents                     |
| ----------------------------- | ------------------- | ---------------------------- |
| `~/.vscode-server/extensions` | `vscode-extensions` | installed VS Code extensions |
| `~/.npm`                      | `npm-cache`         | npm cache                    |
| `~/.bun/install/cache`        | `bun-cache`         | bun install cache            |
| `~/.bash-cache`               | `bash-cache`        | bash history (`HISTFILE`)    |
| `~/.claude`                   | `claude`            | Claude Code state            |
| `~/.codex`                    | `codex`             | Codex state                  |
| `~/.agents`                   | `agents`            | agent state                  |

Every mount point in both home tables is pre-created in the Dockerfiles, so a fresh volume is seeded
owned by the container user rather than `root`.

### Outside the workspace and home

| Mount point | Volume              | Notes                                                                                                                                                                     |
| ----------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/vscode`   | `vscode` (external) | VS Code server binaries + `extensionsCache`. Injected by the Dev Containers extension, not declared in `devcontainer.json`. Shared by every dev container on the machine. |

---

## Troubleshooting

**Source Control shows "0 changes" on a dirty tree** — you are on a Synchronized file share. See requirement 2.

**Everything is uniformly slow — every step takes ~3 s, startup takes 40 s+** — the container came up with
no network, and every operation that resolves a name is burning the full DNS timeout. This happens when
you switch between the Node and Bun variants faster than the previous container releases port 8283.

Both variants publish `[::]:8283:8283`. On a bridge network the published port is wired up _as part of
attaching the network endpoint_, so if the port is still held, the attach fails — and `docker start`
leaves the container **running with no network at all** instead of reporting an error:

```
Error response from daemon: failed to set up container networking: driver failed programming
external connectivity on endpoint <name>: Bind for :::8283 failed: port is already allocated
```

Tell-tale signs in the log:

```
sudo: unable to resolve host <container-id>: Temporary failure in name resolution
error POST getaddrinfo EAI_AGAIN mobile.events.data.microsoft.com
Error: Unable to retrieve mac address (unexpected format)
```

Confirm it — `NetworkMode` says `matterbridge` but `Networks` is empty:

```bash
docker inspect matterbridge-node --format '{{.HostConfig.NetworkMode}} / [{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}]'
```

Fix — stop the other variant and restart:

```bash
docker stop matterbridge-bun && docker restart matterbridge-node
```

Avoid it by checking the previous container is gone before opening the other variant:

```bash
docker ps --format "{{.Names}} {{.Status}}"    # empty output means you are clear
```

Docker is not the bottleneck here — stopping takes ~250 ms (PID 1 traps SIGTERM) and starting takes
~250 ms. The race is with VS Code deciding to shut the old container down, which happens when the old
window's connection tears down.

A rebuild always works because `docker run` fails loudly on a port conflict, so you never reach the
half-initialised state. Do **not** "fix" this by giving each variant its own host port: the two
variants co-mount eleven volumes, including `matterbridge-storage`, `matterbridge-plugins`,
`matterbridge-cert` and `vscode-extensions`. The port collision is effectively a safety interlock
against running two Matterbridge instances against the same storage.

**Extensions reinstall on every rebuild** — the `vscode-extensions` volume was removed, or the two variants are fighting over it because both are running.

**Startup pauses ~3 s before the Docker check** — `dev.containers.forwardWSLServices` is still enabled. See requirement 3.

**Stale entries in the extension cache** — `/vscode/vscode-server/extensionsCache` keeps superseded `.vsix` files indefinitely, because every start touches all of them. They are root-owned; remove obsolete versions with:

```bash
docker exec matterbridge-node sudo rm -f /vscode/vscode-server/extensionsCache/<old-entry>
```

**`gpgconf: not found` in the log** — a capability probe, not an error. GnuPG is deliberately not installed;
see "Deliberately not installed". Harmless unless you want GPG-signed commits from inside the container.
