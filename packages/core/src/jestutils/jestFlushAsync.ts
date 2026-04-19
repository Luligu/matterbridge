/**
 * @description This file contains the Jest FlushAsync helper.
 * @file src/jestFlushAsync.ts
 * @author Luca Liguori
 * @created 2026-04-19
 * @version 1.0.1
 * @license Apache-2.0
 *
 * Copyright 2026, 2027, 2028 Luca Liguori.
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
 * Advance the Node.js event loop deterministically to allow chained asynchronous work (Promises scheduled in
 * microtasks and follow‑up macrotasks) to complete inside tests without adding arbitrary long timeouts.
 *
 * NOTE: This does not guarantee OS level network IO completion—only JavaScript task queue progression inside the
 *       current process.
 *
 * @param {number} ticks       Number of macrotask (setImmediate) turns to yield (default 3).
 * @param {number} microTurns  Number of microtask drains (Promise.resolve chains) after macrotask yielding (default 10).
 * @param {number} pause       Final timer delay in ms; set 0 to disable (default 250ms).
 * @returns {Promise<void>}        Resolves after the requested event loop advancement has completed.
 */
export async function flushAsync(ticks: number = 3, microTurns: number = 10, pause: number = 250): Promise<void> {
  for (let i = 0; i < ticks; i++) await new Promise((resolve) => setImmediate(resolve));
  for (let i = 0; i < microTurns; i++) await Promise.resolve();
  if (pause) await new Promise((resolve) => setTimeout(resolve, pause));
}
