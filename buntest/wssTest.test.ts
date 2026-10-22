/**
 * @file buntest/wssTest.test.ts
 * @description This file contains the tests for a raw wss (WebSocket over TLS) server/client pair run under Bun.
 * @author Luca Liguori
 */

// Sets up a plain node:https server (no Matterbridge involved) secured with the mock certificates
// from packages/core/src/mock/certs, attaches a `ws` WebSocketServer to it, and enforces mTLS
// (requestCert + rejectUnauthorized: true on the server, so an untrusted or missing client
// certificate must fail the handshake). Client-side, it connects with both Bun's global
// `WebSocket` and the `ws` package's client — the one Matterbridge itself and every plugin
// actually import (see packages/core/vitest/frontend.test.ts) — using the CA/certificate pair
// signed by the same mock CA, to pin down exactly how each one needs its TLS options populated
// under Bun.
//
// Bun WebSocket TLS options vs Node
// ---------------------------------
// The `ws` package client accepts the TLS material (`ca`, `cert`, `key`, `rejectUnauthorized`)
// as top-level constructor options, the same way `https.request` does:
//   new WebSocket(url, { ca, cert, key, rejectUnauthorized })
// Bun's native WebSocket reads the TLS material only when nested under a `tls` option:
//   new WebSocket(url, { tls: { ca, cert, key, rejectUnauthorized } })
// Up to Bun 1.4.3 the `ws` package delegated to Bun's native WebSocket and ignored the top-level
// shape: the handshake failed against a self-signed/mTLS server with close code 1015
// (oven-sh/bun#31396). Since Bun 1.4.4 (oven-sh/bun#44618) the `ws` package client honors the
// top-level shape like Node does, while the global `WebSocket` still ignores it (as under Node)
// and a failed handshake closes with code 1006.
//
// Cases audited below, each run once against the global `WebSocket` and once against the `ws`
// package client to pin down where they behave the same under Bun and where they differ:
//   1a. Global `WebSocket`,  TLS material nested under `tls`             -> handshake succeeds, server authorizes the client cert.
//   1b. `ws` package client, TLS material nested under `tls`             -> same as (1a).
//   2a. Global `WebSocket`,  TLS material passed top-level (Node shape)  -> options ignored, handshake fails, close code 1006.
//   2b. `ws` package client, TLS material passed top-level (Node shape)  -> handshake succeeds, server authorizes the client cert (Bun >= 1.4.4).
//   3a. Global `WebSocket`,  `tls.ca` set but no client cert/key         -> server rejects the missing mTLS cert, close code 1006.
//   3b. `ws` package client, `tls.ca` set but no client cert/key         -> same as (3a).
//   4a. Global `WebSocket`,  `tls.rejectUnauthorized: false`, no `ca`    -> client skips validating the server's cert but still presents
//                                                                          its own valid client cert, so the server still authorizes it.
//   4b. `ws` package client, `tls.rejectUnauthorized: false`, no `ca`    -> same as (4a).
//
// Run from the repo root with:  bun test  (bunfig.toml scopes discovery to buntest/).

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:https';
import type { AddressInfo } from 'node:net';
import path from 'node:path';

import { WebSocketServer, WebSocket as WsPackageWebSocket } from 'ws';

const CERTS_DIR = path.join(process.cwd(), 'packages', 'core', 'src', 'mock', 'certs');

const serverCert = readFileSync(path.join(CERTS_DIR, 'server.crt'), 'utf8');
const serverKey = readFileSync(path.join(CERTS_DIR, 'server.key'), 'utf8');
const caCert = readFileSync(path.join(CERTS_DIR, 'ca.crt'), 'utf8');
const clientCert = readFileSync(path.join(CERTS_DIR, 'client.crt'), 'utf8');
const clientKey = readFileSync(path.join(CERTS_DIR, 'client.key'), 'utf8');

let httpsServer: Server;
let wss: WebSocketServer;
let port: number;
let lastAuthorized: boolean | undefined;

describe('bunWssTest', () => {
  beforeAll(async () => {
    // mTLS: the server requests a client certificate and rejects the handshake if it is not trusted.
    httpsServer = createServer({ cert: serverCert, key: serverKey, ca: caCert, requestCert: true, rejectUnauthorized: true });
    wss = new WebSocketServer({ server: httpsServer });
    wss.on('connection', (_ws, req) => {
      lastAuthorized = (req.socket as unknown as { authorized?: boolean }).authorized;
    });
    await new Promise<void>((resolve) => {
      httpsServer.listen(0, () => resolve());
    });
    port = (httpsServer.address() as AddressInfo).port;
  });

  afterAll(async () => {
    wss.close();
    await new Promise<void>((resolve) => httpsServer.close(() => resolve()));
  });

  test('1a. global WebSocket connects and authorizes the client when TLS material is nested under `tls` (Bun style)', async () => {
    lastAuthorized = undefined;
    const client = new WebSocket(`wss://localhost:${port}`, {
      tls: { ca: caCert, cert: clientCert, key: clientKey, rejectUnauthorized: true },
    });

    await new Promise<void>((resolve, reject) => {
      client.addEventListener('open', () => resolve());
      client.addEventListener('error', (event) => reject(new Error(`WebSocket error: ${(event as ErrorEvent).message ?? event.type}`)));
    });

    expect(client.readyState).toBe(WebSocket.OPEN);
    expect(Boolean(lastAuthorized)).toBe(true);

    client.close();
    await new Promise<void>((resolve) => client.addEventListener('close', () => resolve()));
  });

  test('1b. `ws` package client connects and authorizes the client when TLS material is nested under `tls` (Bun style)', async () => {
    lastAuthorized = undefined;
    const client = new WsPackageWebSocket(`wss://localhost:${port}`, {
      // `tls` is a Bun-specific extension not covered by the `ws` package's own (Node-oriented) types.
      tls: { ca: caCert, cert: clientCert, key: clientKey, rejectUnauthorized: true },
    } as any);

    await new Promise<void>((resolve, reject) => {
      client.on('open', () => resolve());
      client.on('error', (error) => reject(error));
    });

    expect(client.readyState).toBe(WsPackageWebSocket.OPEN);
    expect(Boolean(lastAuthorized)).toBe(true);

    client.close();
    await new Promise<void>((resolve) => client.on('close', () => resolve()));
  });

  test('2a. global WebSocket ignores the client TLS material passed top-level instead of under `tls`', async () => {
    lastAuthorized = undefined;
    const client = new WebSocket(`wss://localhost:${port}`, {
      // Intentionally the Node shape (top-level, not nested under `tls`) to prove Bun ignores it.
      ca: caCert,
      cert: clientCert,
      key: clientKey,
      rejectUnauthorized: true,
    } as any);

    const closeEvent = await new Promise<CloseEvent>((resolve) => {
      client.addEventListener('close', (event) => resolve(event));
      client.addEventListener('error', () => {
        // The handshake failure surfaces as both an error and a close event; wait for close to assert on the code.
      });
    });

    // The global WebSocket ignores the top-level TLS options (as under Node) and fails the TLS handshake against the self-signed CA.
    expect(closeEvent.code).toBe(1006);
    expect(lastAuthorized).toBeUndefined();
  });

  test('2b. `ws` package client connects and authorizes the client when TLS material is passed top-level (Node style)', async () => {
    lastAuthorized = undefined;
    const client = new WsPackageWebSocket(`wss://localhost:${port}`, {
      // Same Node shape as 2a: since Bun 1.4.4 the `ws` package client honors these top-level fields.
      ca: caCert,
      cert: clientCert,
      key: clientKey,
      rejectUnauthorized: true,
    });

    await new Promise<void>((resolve, reject) => {
      client.on('open', () => resolve());
      client.on('error', (error) => reject(error));
    });

    expect(client.readyState).toBe(WsPackageWebSocket.OPEN);
    expect(Boolean(lastAuthorized)).toBe(true);

    client.close();
    await new Promise<void>((resolve) => client.on('close', () => resolve()));
  });

  test('3a. global WebSocket rejects the handshake when the client presents no certificate to a server that requires mTLS', async () => {
    lastAuthorized = undefined;
    const client = new WebSocket(`wss://localhost:${port}`, {
      tls: { ca: caCert, rejectUnauthorized: true },
    });

    const closeEvent = await new Promise<CloseEvent>((resolve) => {
      client.addEventListener('close', (event) => resolve(event));
      client.addEventListener('error', () => {
        // The connection is torn down by the server before the TLS handshake completes.
      });
    });

    expect(closeEvent.code).toBe(1006);
    expect(lastAuthorized).toBeUndefined();
  });

  test('3b. `ws` package client rejects the handshake when the client presents no certificate to a server that requires mTLS', async () => {
    lastAuthorized = undefined;
    const client = new WsPackageWebSocket(`wss://localhost:${port}`, {
      tls: { ca: caCert, rejectUnauthorized: true },
    } as any);

    const closeEvent = await new Promise<{ code: number }>((resolve) => {
      client.on('close', (code) => resolve({ code }));
      client.on('error', () => {
        // The connection is torn down by the server before the TLS handshake completes.
      });
    });

    expect(closeEvent.code).toBe(1006);
    expect(lastAuthorized).toBeUndefined();
  });

  test('4a. global WebSocket connects without validating the server CA when `tls.rejectUnauthorized` is false', async () => {
    lastAuthorized = undefined;
    const client = new WebSocket(`wss://localhost:${port}`, {
      tls: { cert: clientCert, key: clientKey, rejectUnauthorized: false },
    });

    await new Promise<void>((resolve, reject) => {
      client.addEventListener('open', () => resolve());
      client.addEventListener('error', (event) => reject(new Error(`WebSocket error: ${(event as ErrorEvent).message ?? event.type}`)));
    });

    expect(client.readyState).toBe(WebSocket.OPEN);
    // The server still authorizes the connection because the client certificate itself is CA-signed and valid;
    // `rejectUnauthorized: false` here only means the client skipped validating the *server's* certificate.
    expect(Boolean(lastAuthorized)).toBe(true);

    client.close();
    await new Promise<void>((resolve) => client.addEventListener('close', () => resolve()));
  });

  test('4b. `ws` package client connects without validating the server CA when `tls.rejectUnauthorized` is false', async () => {
    lastAuthorized = undefined;
    const client = new WsPackageWebSocket(`wss://localhost:${port}`, {
      tls: { cert: clientCert, key: clientKey, rejectUnauthorized: false },
    } as any);

    await new Promise<void>((resolve, reject) => {
      client.on('open', () => resolve());
      client.on('error', (error) => reject(error));
    });

    expect(client.readyState).toBe(WsPackageWebSocket.OPEN);
    expect(Boolean(lastAuthorized)).toBe(true);

    client.close();
    await new Promise<void>((resolve) => client.on('close', () => resolve()));
  });
});
