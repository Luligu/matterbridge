# Matterbridge `s6-overlay` Rootfs

This directory is copied to `/` in [Dockerfile.s6-rc](../Dockerfile.s6-rc) and [Dockerfile.s6-rc-legacy](../Dockerfile.s6-rc-legacy) for the Matterbridge Home Assistant Application images.

## Version

- **`s6-overlay`:** `3.2.3.2` (`S6_OVERLAY_VERSION=3.2.3.2`)

## How it works

1. The container starts with `ENTRYPOINT ["/init"]` (`init: false` in the Home Assistant app `config.yaml` so `s6-overlay` runs as PID 1).
2. `s6-rc` reads service definitions from `/etc/s6-overlay/s6-rc.d/` and user bundles from `/etc/s6-overlay/user-bundles.d/`.
3. Because `matterbridge` is listed in `user-bundles.d/user/contents.d/matterbridge`, `s6-rc` starts it after `base` (`dependencies.d/base`).
4. `run` reads `/data/options.json`, installs/updates Matterbridge if `force_update` is enabled, and `exec`s `matterbridge` in the foreground.
5. On exit, `finish` propagates any non-zero exit code to `/run/s6-linux-init-container-results/exitcode` and halts the container. On stop, `timeout-kill` gives Matterbridge 55 s (`< 60` s `config.yaml` timeout) before `SIGKILL`.

## Files

| File                                                         | Content / Role                                                                                |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `etc/s6-overlay/user-bundles.d/user/contents.d/matterbridge` | Registers `matterbridge` in the `user` bundle<br>(`3.2.3.2+` path, replaces `s6-rc.d/user`).  |
| `etc/s6-overlay/s6-rc.d/matterbridge/type`                   | Service type: `longrun`.                                                                      |
| `etc/s6-overlay/s6-rc.d/matterbridge/dependencies.d/base`    | Ensures `base` is up before starting `matterbridge`.                                          |
| `etc/s6-overlay/s6-rc.d/matterbridge/timeout-kill`           | `55000` ms (55 s) stop timeout before `SIGKILL`<br>(under `config.yaml` `timeout: 60`).       |
| `etc/s6-overlay/s6-rc.d/matterbridge/run`                    | `#!/command/with-contenv sh` entrypoint script<br>(`chmod +x` in both Dockerfiles).           |
| `etc/s6-overlay/s6-rc.d/matterbridge/finish`                 | Writes non-zero exit code to<br>`/run/s6-linux-init-container-results/exitcode` and halts.    |
| `data/options.json`                                          | Default fallback options for standalone Docker runs<br>(overwritten by Supervisor).           |
