/**
 * @description This file contains the bin mb_health to check the Matterbridge health endpoint.
 * @file src/mb_health.ts
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

import http from 'node:http';
import https from 'node:https';

/**
 * Checks the Matterbridge health endpoint.
 *
 * @param {string} url The URL to fetch.
 * @param {number} timeoutMs The timeout in milliseconds.
 * @returns {Promise<boolean>} True if the endpoint responds with a 2xx status code.
 */
export function checkHealth(url: string, timeoutMs: number): Promise<boolean> {
  return fetchHealth(url, timeoutMs)
    .then(({ ok }) => ok)
    .catch(() => false);
}

/**
 * Fetches the health endpoint response.
 *
 * @param {string} url The URL to fetch.
 * @param {number} timeoutMs The timeout in milliseconds.
 * @returns {Promise<{ ok: boolean; statusCode: number; body: string; json?: unknown }>} The response details.
 */
export function fetchHealth(url: string, timeoutMs: number): Promise<{ ok: boolean; statusCode: number; body: string; json?: unknown }> {
  return new Promise((resolve) => {
    const parsedUrl = new URL(url);
    const requestImpl = parsedUrl.protocol === 'https:' ? https : http;

    const request = requestImpl.request(
      {
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'cache-control': 'no-store',
          accept: 'application/json',
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

          let json: unknown | undefined;
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
export async function mbHealthCli(url: string, timeoutMs: number, exitFn: (code: number) => never | void = process.exit): Promise<void> {
  const { ok, statusCode, body, json } = await fetchHealth(url, timeoutMs);

  if (json !== undefined) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(json, null, 2));
  } else if (body) {
    // eslint-disable-next-line no-console
    console.log(body);
  } else {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ ok, statusCode }, null, 2));
  }

  exitFn(ok ? 0 : 1);
}

/**
 * Default CLI entrypoint for `mb_health`.
 *
 * @param {(code: number) => never | void} exitFn Exit function (defaults to process.exit).
 * @returns {Promise<void>} Resolves when done.
 */
export async function mbHealthMain(exitFn: (code: number) => never | void = process.exit): Promise<void> {
  await mbHealthCli('http://localhost:8283/health', 5000, exitFn);
}

/**
 * Docker HEALTHCHECK usage:
 *
 * ```dockerfile
 * # After installing the matterbridge package globally (so the `mb_health` bin is on PATH)
 * HEALTHCHECK --interval=60s --timeout=10s --start-period=60s --retries=5 \
 *   CMD mb_health || exit 1
 * ```
 */
