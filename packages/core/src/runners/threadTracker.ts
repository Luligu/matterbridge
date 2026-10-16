/**
 * @file packages/core/src/runners/threadTracker.ts
 * @description This file contains the threadTracker thread.
 * @author Luca Liguori
 * @created 2026-10-08
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
import { inspectError } from '@matterbridge/utils/error';
import { logModuleLoaded } from '@matterbridge/utils/loader';
import type { Tracker } from '@matterbridge/utils/tracker';
import { LogLevel } from 'node-ansi-logger';

logModuleLoaded('Tracker', '\u001B[35m');

export default new ThreadsWrapper('Tracker', entrypoint, startup, shutdown);

let tracker: Tracker | undefined;

async function entrypoint(worker: ThreadsWrapper): Promise<boolean> {
  worker.logger(LogLevel.INFO, 'Creating tracker...');
  try {
    worker.logger(LogLevel.DEBUG, 'Importing Tracker...');
    const { Tracker } = await import('@matterbridge/utils/tracker');
    worker.logger(LogLevel.DEBUG, 'Tracker imported; creating instance...');
    tracker = new Tracker('Tracker', false, false, true);
    worker.logger(LogLevel.DEBUG, 'Tracker instance created');
    // Register the listeners before any await: the manager sends startup as soon as the thread is loaded.
    worker.on('startup', () => {
      worker.logger(LogLevel.NOTICE, 'Tracker received startup');
    });
    worker.on('shutdown', () => {
      worker.logger(LogLevel.NOTICE, 'Tracker received shutdown');
    });
    worker.logger(LogLevel.DEBUG, 'Tracker created');
    return true;
  } catch (error) {
    const errorMessage = inspectError(worker.log, 'Failed to create tracker', error);
    worker.logger(LogLevel.ERROR, errorMessage);
    return false;
  }
}

// oxlint-disable-next-line typescript/require-await
async function startup(worker: ThreadsWrapper): Promise<void> {
  if (!tracker) return;
  worker.logger(LogLevel.DEBUG, 'Starting up tracker...');
  tracker.start();
  worker.logger(LogLevel.DEBUG, 'Tracker startup complete');
}

// oxlint-disable-next-line typescript/require-await
async function shutdown(worker: ThreadsWrapper): Promise<void> {
  if (!tracker) return;
  worker.logger(LogLevel.DEBUG, 'Shutting down tracker...');
  tracker.stop();
  worker.logger(LogLevel.DEBUG, 'Tracker shutdown complete');
}
