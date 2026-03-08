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

import { workerData } from 'node:worker_threads';

import { LogLevel } from 'node-ansi-logger';

import { spawnCommand } from './spawnCommand.js';
import { WorkerWrapper } from './workerWrapper.js';

new WorkerWrapper('GlobalPrefix', async (worker) => {
  worker.logger(
    LogLevel.INFO,
    `Starting spawn command ${workerData.command} with args ${workerData.args.join(' ')} and package command ${workerData.packageCommand} for package ${workerData.packageName}...`,
  );
  const success = await spawnCommand(workerData.command, workerData.args, workerData.packageCommand, workerData.packageName);
  if (success) worker.logger(LogLevel.INFO, `Spawn command ${workerData.command} with args ${workerData.args.join(' ')} executed successfully`);
  else worker.logger(LogLevel.ERROR, `Spawn command ${workerData.command} with args ${workerData.args.join(' ')} failed`);
  return success;
});
