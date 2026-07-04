/**
 * @file packages/thread/src/export.ts
 * @description Thread package entrypoint exports.
 * @author Luca Liguori
 * @created 2026-03-04
 * @version 1.0.0
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

export * from './broadcastServer.js';
export * from './threadsManager.js';
/**
 * Export the systemCheck thread module.
 */
/* v8 ignore next */
// oxlint-disable-next-line typescript/explicit-function-return-type typescript/explicit-module-boundary-types
export async function systemCheck() {
  await import('./workerSystemCheck.js');
}
