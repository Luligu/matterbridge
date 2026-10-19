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

import type { MatterNode } from '../matterNode.js';

logModuleLoaded('RootNode', '\u001B[35m');

export default new ThreadsWrapper('RootNode', entrypoint, startup, shutdown);

let matterNode: MatterNode | undefined;

async function entrypoint(worker: ThreadsWrapper): Promise<boolean> {
  worker.logger(LogLevel.INFO, 'Creating MatterNode...');
  try {
    if (!isRootNodeWorkerData(worker.workerData)) {
      worker.logger(LogLevel.ERROR, 'Invalid MatterNode worker data');
      return false;
    }
    const { sharedMatterbridge, pluginName } = worker.workerData;
    const target = pluginName ? `plugin ${pluginName}` : 'Matterbridge';
    worker.logger(LogLevel.DEBUG, `Importing MatterNode for ${target}...`);
    const { MatterNode } = await import('../matterNode.js');
    worker.logger(LogLevel.DEBUG, `Creating instance for ${target}...`);
    matterNode = new MatterNode(sharedMatterbridge, pluginName);
    worker.logger(LogLevel.DEBUG, `Instance for ${target} created.`);
    return true;
  } catch (error) {
    const errorMessage = inspectError(worker.log, `Failed to create MatterNode`, error);
    worker.logger(LogLevel.ERROR, errorMessage);
    return false;
  }
}

async function startup(worker: ThreadsWrapper): Promise<void> {
  if (!matterNode) return;
  worker.logger(LogLevel.INFO, `Starting up MatterNode for ${matterNode.storeId}...`);
  worker.logger(LogLevel.DEBUG, `Creating MatterNode for ${matterNode.storeId}...`);
  await matterNode.create();
  worker.logger(LogLevel.DEBUG, `Starting MatterNode for ${matterNode.storeId}...`);
  await matterNode.start();
  worker.logger(LogLevel.DEBUG, `MatterNode for ${matterNode.storeId} started`);
}

async function shutdown(worker: ThreadsWrapper): Promise<void> {
  if (!matterNode) return;
  worker.logger(LogLevel.INFO, `Shutting down MatterNode for ${matterNode.storeId}...`);
  worker.logger(LogLevel.DEBUG, `Stopping MatterNode for ${matterNode.storeId}...`);
  await matterNode.stop();
  worker.logger(LogLevel.DEBUG, `MatterNode for ${matterNode.storeId} stopped`);
  await matterNode.destroy();
  worker.logger(LogLevel.DEBUG, `MatterNode for ${matterNode.storeId} destroyed`);
  matterNode = undefined;
}
