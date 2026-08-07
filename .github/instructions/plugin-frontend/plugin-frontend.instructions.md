---
name: 'Matterbridge Plugin Frontend Guide v.1.0.0'
description: 'How a plugin serves its own frontend SPA and custom REST API via onFetch'
applyTo: 'apps/frontend/**, src/*.ts'
---

# Matterbridge Plugin Frontend Guide

Use this guide when writing plugin code that interacts with a plugin's own frontend SPA: bundling and serving that SPA and its custom REST API.

This guide is based on `packages/core/src/frontend.ts` and `packages/core/src/matterbridgePlatform.ts` in the `matterbridge` repository.

## Serving a plugin's own bundled frontend SPA

If the plugin package ships a built SPA at `apps/frontend/build/index.html`, `pluginManager.ts` sets `plugin.frontendPath` and Matterbridge automatically mounts, per plugin:

- `/plugins/<pluginName>/*` — static hosting of the plugin's build output.
- `/plugins/<pluginName>/api/:path` — the `onFetch`-backed REST namespace described below (JSON body parsing included).
- `/plugins/<pluginName>/{*splat}` — SPA fallback serving the plugin's own `index.html` for unmatched routes.

A plugin's own frontend should call its own namespace (`/plugins/<pluginName>/api/...`), not the core `/api/...` endpoints.

## The plugin-extensible hook: `onFetch`

The frontend's WebSocket RPC protocol is a fixed dispatch of built-in `/api/...` methods, and it has no plugin extension point. The one method that hands control back to plugin code for a plugin's own frontend is `onFetch`, declared on `MatterbridgePlatform` and meant to be overridden in your platform class.

### `onFetch` — custom plugin REST API

```ts
async onFetch(method: string, path?: string, query?: Record<string, unknown>, body?: unknown): Promise<unknown>
```

Called by the Matterbridge frontend for plugin API requests. Reached via `GET|POST|PUT|PATCH|DELETE /plugins/<pluginName>/api/:path`, mounted automatically for every enabled, error-free plugin.

- `method` — HTTP method.
- `path` — the `:path` route param (e.g. `'devices'`, `'devices/42'`). Typed optional on `onFetch` because the method can be called directly (e.g. in tests) without one; via the real mounted route it is always a defined string, since Express requires `:path` to match at least one segment.
- `query` — query string parameters.
- `body` — request body (`POST`/`PUT`/`PATCH`).
- Return a JSON-serializable value, or `undefined` to respond with **404**.
- A thrown error becomes a **500** `{ error: 'Internal error in plugin <name>' }`.
- `DELETE` responds **204** with no body; every other method responds `res.json(value)`.
- If `plugin.platform` isn't running yet, the frontend returns **503** before calling `onFetch`.

The default base-class implementation logs and returns `undefined` (404) — override it to expose real endpoints.

## Avoid these mistakes

- Do not invent a custom WebSocket method name expecting the frontend to route to it — the WS dispatch is a fixed core method list with no plugin extension point. Use `onFetch` under `/plugins/<pluginName>/api/...` for a plugin's own frontend traffic.
- Do not build a plugin's custom frontend to call core `/api/...` routes — use `/plugins/<pluginName>/api/...`, backed by your own `onFetch`.
