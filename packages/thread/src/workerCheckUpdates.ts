/**
 * This file contains the workerCheckUpdates thread.
 *
 * @file workerCheckUpdates.ts
 * @author Luca Liguori
 * @created 2025-11-25
 * @version 1.1.0
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

import { inspectError } from '@matterbridge/utils/error';
import { LogLevel } from 'node-ansi-logger';

import { checkUpdates } from './checkUpdates.js';
import { WorkerWrapper } from './workerWrapper.js';

new WorkerWrapper('GlobalPrefix', async (worker) => {
  worker.logger(LogLevel.INFO, `Starting check updates...`);
  let success = false;
  try {
    const shared = (await worker.server.fetch({ type: 'matterbridge_shared', src: `matterbridge`, dst: 'matterbridge' }, 5000)).result.data;
    await checkUpdates(shared);
    worker.logger(LogLevel.INFO, `Check updates succeeded`);
    success = true;
  } catch (error) {
    const errorMessage = inspectError(worker.log, `Failed to check updates`, error);
    worker.logger(LogLevel.ERROR, errorMessage);
  }
  return success;
});
