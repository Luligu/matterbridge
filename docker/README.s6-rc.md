# Home Assistant application package cache

The s6-rc service uses `/data/.npm-cache` for npm's cache. Home Assistant persists
the app's `/data` directory across container recreation. The service exports
`npm_config_cache`, so the startup installation and npm subprocesses launched by
Matterbridge for plugins share the cache.

The cache preserves downloaded package content, not the installed global module
tree. With `force_update: true`, a fresh container still resolves and installs
the selected `latest` or `dev` version. Warm cache reuse reduces downloads; it
does not make startup independent of the registry or skip installation work.

The installation marker in `/home/node` only skips installation when restarting
the service inside the same container. It is not a persistent installation marker.
