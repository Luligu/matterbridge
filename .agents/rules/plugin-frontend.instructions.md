---
description: 'How a plugin serves its own frontend SPA and custom REST API via onFetch v.1.0.2'
---

# Matterbridge Plugin Frontend Guide

Use this guide when writing plugin code that interacts with a plugin's own frontend SPA: bundling and serving that SPA and its custom REST API.

This guidance is based on `packages/core/src/frontend.ts` and `packages/core/src/matterbridgePlatform.ts` in the `matterbridge` repository.

## Serving a plugin's bundled frontend SPA

When a plugin package contains a built SPA at `apps/frontend/build/index.html`, `pluginManager.ts` sets `plugin.frontendPath`. Matterbridge then automatically mounts these routes for the plugin:

- `/plugins/<pluginName>/*` serves the plugin's build output as static files.
- `/plugins/<pluginName>/api/:path` exposes the plugin REST namespace backed by `onFetch`, with JSON body parsing included.
- `/plugins/<pluginName>/{*splat}` serves the plugin's `index.html` as the SPA fallback for unmatched routes.

A plugin frontend must call its own plugin API namespace (built from `import.meta.env.BASE_URL`, see below) rather than the core `/api/...` endpoints.

## Preserve the base path through Home Assistant Ingress

Build plugin API URLs from Vite's `import.meta.env.BASE_URL`, without a leading slash on the appended path:

```ts
const response = await fetch(`${import.meta.env.BASE_URL}api/events`, {
  signal,
  headers: { Accept: 'application/json' },
});
```

The frontend template's `vite.config.ts` uses `/plugins/<pluginName>/` as its development base and `./` as its production base. Keep this arrangement and the development proxy for `${base}api`:

- In development, the request goes to `/plugins/<pluginName>/api/events` and Vite proxies it to Matterbridge.
- In production, `./api/events` resolves relative to the plugin frontend document, retaining any reverse proxy prefix.
- Through Home Assistant Ingress, `/api/hassio_ingress/<token>/plugins/<pluginName>/` therefore requests `/api/hassio_ingress/<token>/plugins/<pluginName>/api/events`.

Do not hardcode `fetch('/plugins/<pluginName>/api/events')`, a core `/api/...` URL or the Matterbridge host/port in frontend code. A root-relative URL discards the Ingress prefix and sends the request outside the addon route. The absolute plugin paths listed above describe server routes, not URLs to hardcode in browser requests.

## Open the plugin frontend with a trailing slash

Matterbridge always opens a plugin frontend at its directory URL with a trailing slash (`<basePath>plugins/<pluginName>/`). This is required, not cosmetic:

- **Relative URLs resolve against the document's directory.** The browser drops everything after the last `/` of the page URL. At `/plugins/my-plugin` the directory is `/plugins/`, so `./assets/index.js` becomes `/plugins/assets/index.js` and `./api/events` becomes `/plugins/api/events`. Both miss the plugin's routes, and the SPA does not even load its scripts and styles. At `/plugins/my-plugin/` they resolve to `/plugins/my-plugin/assets/index.js` and `/plugins/my-plugin/api/events`.
- **The server redirect breaks under Ingress.** When a directory is requested without the slash, `express.static` answers with a 301 to the same path plus `/`. Behind Home Assistant Ingress the proxy has already stripped `/api/hassio_ingress/<token>`. The redirect therefore points to `/plugins/<pluginName>/` at the Home Assistant origin root, outside the add-on. Adding the slash in the client avoids the redirect.
- **The slash goes on the path, before any query or hash.** The right form is `plugins/my-plugin/?device=1`; `plugins/my-plugin?device=1/` is wrong.

A device `configUrl` that starts with `/plugins/<pluginName>` or `./plugins/<pluginName>` opens the plugin frontend in the Matterbridge dialog. Matterbridge prefixes the base path and inserts the trailing slash before any query string. Prefer writing it with the slash anyway (`./plugins/<pluginName>/?device=<id>`) so the URL is also correct when opened directly.

Avoid nested history-based routes (for example `/plugins/<pluginName>/devices/42`). They change the document directory, and since the production `BASE_URL` is `./`, assets and API calls would resolve from the nested path. Use hash-based routing (`/plugins/<pluginName>/#/devices/42`) instead, which keeps the document at the plugin root.

Verify API requests during Vite development, direct Matterbridge access and Home Assistant Ingress access.

## Use `onFetch` for a plugin's custom API

The frontend WebSocket RPC protocol dispatches a fixed set of built-in `/api/...` methods and does not provide a plugin extension point. Override `onFetch` in the platform class when the plugin's frontend needs to communicate with plugin code.

### `onFetch` signature

```ts
async onFetch(method: string, path?: string, query?: Record<string, unknown>, body?: unknown): Promise<unknown>
```

Matterbridge calls this method for `GET`, `POST`, `PUT`, `PATCH`, and `DELETE` requests to `/plugins/<pluginName>/api/:path` for every enabled, error-free plugin.

- `method` is the HTTP method.
- `path` is the `:path` route parameter, such as `'devices'` or `'devices/42'`. It is optional in the TypeScript signature because tests and other code can call `onFetch` directly without a path. Requests through the mounted Express route always provide a non-empty string because `:path` must match at least one segment.
- `query` contains the query-string parameters.
- `body` contains the parsed request body for `POST`, `PUT`, and `PATCH` requests.
- Return a JSON-serializable value. Return `undefined` to produce a `404` response.
- A thrown error becomes a `500` response with `{ error: 'Internal error in plugin <name>' }`.
- `DELETE` returns `204` with no response body. Every other method returns `res.json(value)`.
- If `plugin.platform` is not running, Matterbridge returns `503` without calling `onFetch`.

The base implementation only logs the request and returns `undefined`, so override it to expose real endpoints.

## Avoid unsupported routing patterns

- Do not invent custom WebSocket method names for plugin frontend traffic. The WebSocket dispatch list is fixed; use `onFetch` through `/plugins/<pluginName>/api/...`.
- Do not call core `/api/...` routes from a plugin's custom frontend. Use the plugin's own namespace via `${import.meta.env.BASE_URL}api/...`.
