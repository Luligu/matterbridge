/**
 * This file contains the workerGlobalPrefix thread.
 *
 * @file workerGlobalPrefix.ts
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
import { getGlobalNodeModules } from '@matterbridge/utils/npm-prefix';
import { LogLevel } from 'node-ansi-logger';

import { WorkerWrapper } from './workerWrapper.js';

export default new WorkerWrapper('GlobalPrefix', async (worker) => {
  let prefix: string;
  worker.logger(LogLevel.INFO, `Starting global prefix check...`);
  let success = false;
  try {
    prefix = await getGlobalNodeModules();
    worker.server.request({ type: 'matterbridge_global_prefix', src: `matterbridge`, dst: 'matterbridge', params: { prefix } });
    worker.logger(LogLevel.INFO, `Global node_modules directory: ${prefix}`);
    success = true;
  } catch (error) {
    const errorMessage = inspectError(worker.log, `Failed to get global node modules`, error);
    worker.logger(LogLevel.ERROR, errorMessage);
  }
  return success;
});
