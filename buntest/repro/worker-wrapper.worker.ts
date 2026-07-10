/**
 * @file buntest/repro/worker-wrapper.worker.ts
 * @description WorkerWrapper repro worker.
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

import { parentPort } from 'node:worker_threads';

import { LogLevel } from 'node-ansi-logger';

// @ts-expect-error: Import from TypeScript src file with .ts extension
import { WorkerWrapper } from '../../packages/thread/src/workerWrapper.ts';

if (!parentPort) throw new Error('parentPort is not available');

export default new WorkerWrapper('DockerVersion', async (worker) => {
  worker.logger(LogLevel.INFO, 'WorkerWrapper repro starting');

  worker.logger(LogLevel.INFO, 'WorkerWrapper repro external fetch skipped');

  parentPort?.on('message', (message: unknown) => {
    if (message === 'ping') {
      parentPort?.postMessage(`echo:${message}`);
    }
  });

  const response = await worker.server.fetch({ type: 'get_log_level', src: 'matterbridge', dst: 'manager' }, 5_000);
  worker.logger(LogLevel.INFO, `WorkerWrapper repro manager log level: ${response.result.logLevel}`);

  return true;
});
