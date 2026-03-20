/**
 * This file contains the workerArchiveCommand thread.
 *
 * @file workerArchiveCommand.ts
 * @author Luca Liguori
 * @created 2026-03-14
 * @version 1.0.0
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

import { isArchiveWorkerData } from '@matterbridge/types';
import { LogLevel } from 'node-ansi-logger';

import { WorkerWrapper } from './workerWrapper.js';
import { createZip, readZip, unZip } from './zipjs.js';

export default new WorkerWrapper('ArchiveCommand', async (worker) => {
  if (!isArchiveWorkerData(worker.workerData)) {
    worker.logger(LogLevel.ERROR, `ArchiveCommand invalid parameters`);
    return false;
  }
  worker.logger(
    LogLevel.INFO,
    `Starting archive command ${worker.workerData.command} on ${worker.workerData.archivePath} with source paths ${worker.workerData.sourcePaths.join(', ')} and destination path ${worker.workerData.destinationPath}...`,
  );
  let success: boolean = false;
  // istanbul ignore else
  if (worker.workerData.command === 'zip') success = (await createZip(worker.workerData.archivePath, worker.workerData.sourcePaths)) > 0;
  else if (worker.workerData.command === 'verify') success = (await readZip(worker.workerData.archivePath)).length > 0;
  else if (worker.workerData.command === 'unzip') success = (await unZip(worker.workerData.archivePath, worker.workerData.destinationPath)).length > 0;
  if (success)
    worker.logger(
      LogLevel.INFO,
      `Archive command ${worker.workerData.command} on ${worker.workerData.archivePath} with source paths ${worker.workerData.sourcePaths.join(', ')} and destination path ${worker.workerData.destinationPath} executed successfully`,
    );
  else
    worker.logger(
      LogLevel.ERROR,
      `Archive command ${worker.workerData.command} on ${worker.workerData.archivePath} with source paths ${worker.workerData.sourcePaths.join(', ')} and destination path ${worker.workerData.destinationPath} failed`,
    );
  worker.server.respond({
    type: 'manager_archive_response',
    src: `manager`,
    dst: 'frontend',
    id: worker.server.getUniqueId(),
    result: {
      command: worker.workerData.command,
      archivePath: worker.workerData.archivePath,
      sourcePaths: worker.workerData.sourcePaths,
      destinationPath: worker.workerData.destinationPath,
      success,
    },
  });
  return success;
});
