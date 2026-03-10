/**
 * This file contains the workerSpawnCommand thread.
 *
 * @file workerSpawnCommand.ts
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

import { isSpawnWorkerData } from '@matterbridge/types';
import { LogLevel } from 'node-ansi-logger';

import { spawnCommand } from './spawnCommand.js';
import { WorkerWrapper } from './workerWrapper.js';

new WorkerWrapper('SpawnCommand', async (worker) => {
  if (!isSpawnWorkerData(worker.workerData)) {
    worker.logger(LogLevel.ERROR, `SpawnCommand invalid parameters`);
    return false;
  }
  worker.logger(
    LogLevel.INFO,
    `Starting spawn command ${worker.workerData.command} with args ${worker.workerData.args.join(' ')} and package command ${worker.workerData.packageCommand} for package ${worker.workerData.packageName}...`,
  );
  const success = await spawnCommand(worker.workerData.command, worker.workerData.args, worker.workerData.packageCommand, worker.workerData.packageName);
  if (success) worker.logger(LogLevel.INFO, `Spawn command ${worker.workerData.command} with args ${worker.workerData.args.join(' ')} executed successfully`);
  else worker.logger(LogLevel.ERROR, `Spawn command ${worker.workerData.command} with args ${worker.workerData.args.join(' ')} failed`);
  worker.server.respond({
    type: 'manager_spawn_response',
    src: `manager`,
    dst: 'all',
    result: {
      command: worker.workerData.command,
      args: worker.workerData.args,
      packageCommand: worker.workerData.packageCommand,
      packageName: worker.workerData.packageName,
      success,
    },
  });
  return success;
});
