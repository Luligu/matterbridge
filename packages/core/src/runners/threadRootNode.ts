/**
 * @file packages/core/src/runners/threadRootNode.ts
 * @description This file contains the threadRootNode thread.
 * @author Luca Liguori
 * @created 2026-10-07
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

import { ThreadsWrapper } from '@matterbridge/thread/wrapper';
import { isRootNodeWorkerData } from '@matterbridge/types';
import { inspectError } from '@matterbridge/utils/error';
import { logModuleLoaded } from '@matterbridge/utils/loader';
import { LogLevel } from 'node-ansi-logger';

logModuleLoaded('RootNode', '\u001B[35m');

export default new ThreadsWrapper('RootNode', async (worker) => {
  worker.logger(LogLevel.INFO, 'Creating root node...');
  try {
    if (!isRootNodeWorkerData(worker.workerData)) {
      worker.logger(LogLevel.ERROR, 'Invalid root node worker data');
      return false;
    }
    const { sharedMatterbridge, pluginName } = worker.workerData;
    const target = pluginName ? `plugin ${pluginName}` : 'bridge';
    worker.logger(LogLevel.DEBUG, `Importing MatterNode for ${target}...`);
    const { MatterNode } = await import('../matterNode.js');
    worker.logger(LogLevel.DEBUG, 'MatterNode imported; creating instance...');
    const matterNode = new MatterNode(sharedMatterbridge, pluginName);
    await matterNode.create();
    worker.logger(LogLevel.DEBUG, 'Starting MatterNode...');
    // Start the matter node. It will keep running until explicitly stopped.
    await matterNode.start();
    worker.logger(LogLevel.DEBUG, `Root node for ${target} started`);
    return true;
  } catch (error) {
    const errorMessage = inspectError(worker.log, 'Failed to create root node', error);
    worker.logger(LogLevel.ERROR, errorMessage);
    return false;
  }
});
