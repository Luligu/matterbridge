/**
 * @description This file contains the Jest helpers.
 * @file src/jest/helpers.test.ts
 * @author Luca Liguori
 * @created 2025-09-03
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

/* eslint-disable jest/no-export */
import { jest } from '@jest/globals';
import { Endpoint, ServerNode, ServerNodeStore } from '@matter/main';

/**
 * Advance the Node.js event loop deterministically to allow chained asynchronous work (Promises scheduled in
 * microtasks and follow‑up macrotasks) to complete inside tests without adding arbitrary long timeouts.
 *
 * Rationale / How it works:
 *  1. A call to {@link setImmediate} yields one macrotask tick. This is often enough to start internal deferred
 *     persistence or batching processes that were scheduled in the current turn.
 *  2. A sequence of `Promise.resolve()` awaits yields back to the microtask queue repeatedly so that *progressively*
 *     added `.then()` callbacks (chained scheduling) can drain. We do this a configurable number of times because
 *     each callback can schedule another.
 *  3. (Optional) A short `setTimeout` pause (default 100ms) is added as a defensive final barrier for IO‑backed
 *     operations (e.g. file persistence) that hop onto the timer queue. Set to `0` or `undefined` to skip when not
 *     needed for speed‑critical tests.
 *
 * You should prefer this utility over sprinkling raw `await new Promise(r => setTimeout(r, X))` with arbitrary X
 * because it is: (a) intention‑revealing, (b) usually faster (default only a few immediates + microtasks), and
 * (c) tunable per test scenario.
 *
 * NOTE: This does not guarantee OS level network IO completion—only JavaScript task queue progression inside the
 *       current process. Increase `ticks` or set a small `pause` if a library defers work one more macrotask later.
 *
 * @param {number} ticks       Number of macrotask (setImmediate) turns to yield (default 3).
 * @param {number} microTurns  Number of microtask drains (Promise.resolve chains) after macrotask yielding (default 10).
 * @param {number} pause       Final timer delay in ms; set 0 to disable (default 100).
 * @returns {Promise<void>}        Resolves after the requested event loop advancement has completed.
 */
export async function flushAsync(ticks: number = 3, microTurns: number = 10, pause: number = 100): Promise<void> {
  for (let i = 0; i < ticks; i++) await new Promise((resolve) => setImmediate(resolve));
  for (let i = 0; i < microTurns; i++) await Promise.resolve();
  if (pause) await new Promise((resolve) => setTimeout(resolve, pause));
}

/**
 * Flush (await) the lazy endpoint number persistence mechanism used by matter.js.
 *
 * Background:
 *  assignNumber() batches persistence (store.saveNumber + updating __nextNumber__) via an internal promise (#numbersPersisted).
 *  Calling endpointStores.close() waits for the current batch only. If new endpoints were added in the same macrotask
 *  cycle additional micro/macro turns might be needed to ensure the batch started. We defensively yield macrotasks
 *  (setImmediate) and then await close() multiple rounds.
 *
 * @param {ServerNode} targetServer  The server whose endpoint numbering persistence should be flushed.
 * @param {number} rounds Number of macrotask + close cycles to run (2 is usually sufficient; 1 often works).
 * @returns {Promise<void>}          Resolves when pending number persistence batches have completed.
 */
export async function flushAllEndpointNumberPersistence(targetServer: ServerNode, rounds: number = 2): Promise<void> {
  const nodeStore = targetServer.env.get(ServerNodeStore);
  for (let i = 0; i < rounds; i++) {
    await new Promise((resolve) => setImmediate(resolve));
    await nodeStore.endpointStores.close();
  }
}

/**
 * Collect all endpoints in the server endpoint tree (root -> descendants).
 *
 * NOTE: Uses the public parts iterable on each Endpoint. Order is depth-first.
 *
 * @param {Endpoint} root  Root endpoint (typically the ServerNode root endpoint cast as Endpoint).
 * @returns {Endpoint[]}   Flat array including the root and every descendant once.
 */
function collectAllEndpoints(root: Endpoint): Endpoint[] {
  const list: Endpoint[] = [];
  const walk = (ep: Endpoint) => {
    list.push(ep);
    if (ep.parts) {
      for (const child of ep.parts as any) {
        walk(child as Endpoint);
      }
    }
  };
  walk(root);
  return list;
}

/**
 * Assert that every endpoint attached to the server has an assigned and (batch-)persisted endpoint number.
 *
 * This waits for any outstanding number persistence batch (endpointStores.close()), then traverses the endpoint
 * graph and asserts:
 *  - Root endpoint: number is 0 (allowing undefined to coerce to 0 via nullish coalescing check).
 *  - All other endpoints: number > 0.
 *
 * This validates allocation + completion of persistence batches but does not re-load from disk. For full durability
 * verification a restart or direct storage reads would be required.
 *
 * @param {ServerNode} targetServer The server whose endpoint numbers are verified.
 * @returns {Promise<void>}         Resolves when assertions complete.
 */
export async function assertAllEndpointNumbersPersisted(targetServer: ServerNode): Promise<number> {
  const nodeStore = targetServer.env.get(ServerNodeStore);
  // Ensure any pending persistence finished (flush any in-flight batch promise)
  await nodeStore.endpointStores.close();
  const all = collectAllEndpoints(targetServer as unknown as Endpoint);
  for (const ep of all) {
    const store = nodeStore.storeForEndpoint(ep);
    if (ep.maybeNumber === 0) {
      expect(store.number ?? 0).toBe(0); // root
    } else {
      expect(store.number).toBeGreaterThan(0);
    }
  }
  return all.length;
}

describe('Jest utils', () => {
  test('create the server node', async () => {
    expect(1).toBe(1);
  });
});
