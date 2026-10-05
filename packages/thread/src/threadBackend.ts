/**
 * @file packages/thread/src/threadBackend.ts
 * @description This file contains the threadBackend thread.
 * @author Luca Liguori
 * @created 2026-10-05
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

import { inspectError } from '@matterbridge/utils/error';
import { logModuleLoaded } from '@matterbridge/utils/loader';
import { LogLevel } from 'node-ansi-logger';

import { WorkerWrapper } from './workerWrapper.js';

logModuleLoaded('Backend', '\u001B[35m');

export default new WorkerWrapper('Backend', async (worker) => {
  worker.logger(LogLevel.INFO, 'Creating backend...');
  try {
    const shared = (await worker.server.fetch({ type: 'matterbridge_shared', src: 'matterbridge', dst: 'matterbridge' }, 1000)).result.data;
    const { Backend } = await import('@matterbridge/core/backend');
    const backend = new Backend(shared);
    // Start the backend server. It will keep running until explicitly stopped.
    await backend.start();
    return true;
  } catch (error) {
    const errorMessage = inspectError(worker.log, 'Failed to create backend', error);
    worker.logger(LogLevel.ERROR, errorMessage);
    return false;
  }
});
