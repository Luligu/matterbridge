/**
 * @file packages/core/src/mb_health.ts
 * @description This file contains the bin mb_health to check the Matterbridge health endpoint.
 * @author Luca Liguori
 * @created 2026-01-28
 * @version 1.0.0
 * @license Apache-2.0
 *
 * Copyright 2025, 2026, 2027 Luca Liguori.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Docker HEALTHCHECK usage:
 *
 * ```dockerfile
 * # After installing the matterbridge package globally (so the `mb_health` bin is on PATH)
 * HEALTHCHECK --interval=60s --timeout=10s --start-period=60s --retries=5 \
 *   CMD mb_health || exit 1
 * ```
 *
 * When no URL is passed, mb_health resolves the frontend endpoint (port and
 * http/https protocol) from the configuration stored by the main Matterbridge
 * process, falling back to http://localhost:8283/health. An explicit URL can
 * still be passed as the first argument to override the detected endpoint.
 */

import http from 'node:http';
import https from 'node:https';

import { NODE_STORAGE_DIR } from '@matterbridge/types';
import { logModuleLoaded } from '@matterbridge/utils/loader';

logModuleLoaded('mb-health');

const DEFAULT_MB_HEALTH_URL = 'http://localhost:8283/health';
const DEFAULT_MB_HEALTH_PORT = 8283;

/**
 * Checks the Matterbridge health endpoint.
 *
 * @param {string} url The URL to fetch.
 * @param {number} timeoutMs The timeout in milliseconds.
 * @returns {Promise<boolean>} True if the endpoint responds with a 2xx status code.
 */
export async function checkHealth(url: string, timeoutMs: number): Promise<boolean> {
  try {
    const { ok } = await fetchHealth(url, timeoutMs);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Fetches the health endpoint response.
 *
 * @param {string} url The URL to fetch.
 * @param {number} timeoutMs The timeout in milliseconds.
 * @returns {Promise<{ ok: boolean; statusCode: number; body: string; json?: unknown }>} The response details.
 */
export async function fetchHealth(url: string, timeoutMs: number): Promise<{ ok: boolean; statusCode: number; body: string; json?: unknown }> {
  return new Promise((resolve) => {
    const parsedUrl = new URL(url);
    const requestImpl = parsedUrl.protocol === 'https:' ? https : http;
    const isHttps = parsedUrl.protocol === 'https:';

    const request = requestImpl.request(
      {
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        ...(isHttps ? { rejectUnauthorized: false } : {}),
        headers: {
          'cache-control': 'no-store',
          'accept': 'application/json',
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on('end', () => {
          const statusCode = response.statusCode ?? 0;
          const ok = statusCode >= 200 && statusCode < 300;
          const body = Buffer.concat(chunks).toString('utf8');

          let json: unknown;
          try {
            if (body.trim().length > 0) json = JSON.parse(body);
          } catch {
            json = undefined;
          }

          resolve({ ok, statusCode, body, json });
        });
        response.on('error', () => {
          resolve({ ok: false, statusCode: response.statusCode ?? 0, body: '' });
        });
      },
    );

    request.on('error', () => resolve({ ok: false, statusCode: 0, body: '' }));
    request.setTimeout(timeoutMs, () => {
      request.destroy();
      resolve({ ok: false, statusCode: 0, body: '' });
    });
    request.end();
  });
}

/**
 * Returns the exit code for the health check.
 *
 * @param {string} url The URL to fetch.
 * @param {number} timeoutMs The timeout in milliseconds.
 * @returns {Promise<number>} Exit code (0 if ok, 1 otherwise).
 */
export async function mbHealthExitCode(url: string, timeoutMs: number): Promise<number> {
  try {
    const { ok } = await fetchHealth(url, timeoutMs);
    return ok ? 0 : 1;
  } catch {
    return 1;
  }
}

/**
 * CLI runner for mb_health.
 *
 * @param {string} url The URL to fetch.
 * @param {number} timeoutMs The timeout in milliseconds.
 * @param {(code: number) => never | void} exitFn Exit function (defaults to process.exit).
 * @returns {Promise<void>} Resolves when done.
 */
// oxlint-disable-next-line typescript/unbound-method
export async function mbHealthCli(url: string, timeoutMs: number, exitFn: (code: number) => never | void = process.exit): Promise<void> {
  const { ok, statusCode, body, json } = await fetchHealth(url, timeoutMs);

  if (json !== undefined) {
    // oxlint-disable-next-line no-console
    console.log(JSON.stringify(json, null, 2));
  } else if (body) {
    // oxlint-disable-next-line no-console
    console.log(body);
  } else {
    // oxlint-disable-next-line no-console
    console.log(JSON.stringify({ ok, statusCode }, null, 2));
  }

  exitFn(ok ? 0 : 1);
}

/**
 * Resolves the frontend health URL when none is provided.
 *
 * It reads the frontend port and protocol (http/https) persisted by the main
 * Matterbridge process in its node storage, so that the health check follows
 * the configured frontend instead of always probing the default port.
 *
 * @returns {Promise<string>} The health URL to probe.
 */
async function resolveFrontendHealthUrl(): Promise<string> {
  try {
    const { default: os } = await import('node:os');
    const { default: path } = await import('node:path');
    const { NodeStorageManager } = await import('node-persist-manager');
    const nodeStorage = new NodeStorageManager({ dir: path.join(os.homedir(), '.matterbridge', NODE_STORAGE_DIR), writeQueue: false, expiredInterval: undefined, logging: false });
    const nodeContext = await nodeStorage.createStorage('matterbridge');
    const port = await nodeContext.get<number>('frontendport', DEFAULT_MB_HEALTH_PORT);
    const ssl = (await nodeContext.get<boolean>('frontendssl', false)) || (await nodeContext.get<boolean>('frontendmtls', false));
    return `${ssl ? 'https' : 'http'}://localhost:${port}/health`;
  } catch {
    return DEFAULT_MB_HEALTH_URL;
  }
}

/**
 * Default CLI entrypoint for `mb_health`.
 *
 * @param {(code: number) => never | void} exitFn Exit function (defaults to process.exit).
 * @param {string} url Optional URL to fetch (defaults to the frontend URL resolved from the Matterbridge configuration, falling back to http://localhost:8283/health).
 * @returns {Promise<void>} Resolves when done.
 */
// oxlint-disable-next-line typescript/unbound-method
export async function mbHealthMain(exitFn: (code: number) => never | void = process.exit, url?: string): Promise<void> {
  const healthUrl = url ?? (await resolveFrontendHealthUrl());
  await mbHealthCli(healthUrl, 5000, exitFn);
}
