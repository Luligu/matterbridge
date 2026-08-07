# Matterbridge Plugin Frontend Guide (v.1.0.0)

Use this guide when writing plugin code that interacts with a plugin's own frontend SPA: bundling and serving that SPA and its custom REST API.

This guidance is based on `packages/core/src/frontend.ts` and `packages/core/src/matterbridgePlatform.ts` in the `matterbridge` repository.

## Serving a plugin's bundled frontend SPA

When a plugin package contains a built SPA at `apps/frontend/build/index.html`, `pluginManager.ts` sets `plugin.frontendPath`. Matterbridge then automatically mounts these routes for the plugin:

- `/plugins/<pluginName>/*` serves the plugin's build output as static files.
- `/plugins/<pluginName>/api/:path` exposes the plugin REST namespace backed by `onFetch`, with JSON body parsing included.
- `/plugins/<pluginName>/{*splat}` serves the plugin's `index.html` as the SPA fallback for unmatched routes.

A plugin frontend must call its own `/plugins/<pluginName>/api/...` namespace rather than the core `/api/...` endpoints.

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
- Do not call core `/api/...` routes from a plugin's custom frontend. Use the plugin's own `/plugins/<pluginName>/api/...` namespace.
