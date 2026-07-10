/**
 * @file buntest/parallel.worker.ts
 * @description Worker used by runtime.test.ts to keep several Bun workers alive at once.
 * @author Luca Liguori
 * @created 2026-06-26
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

import { parentPort, workerData } from 'node:worker_threads';

const index = typeof workerData === 'object' && workerData && 'index' in workerData ? Number(workerData.index) : -1;

parentPort?.on('message', (msg: unknown) => {
  setTimeout(() => {
    parentPort?.postMessage({ index, reply: `echo:${String(msg)}` });
    process.exit(0);
  }, 100);
});
