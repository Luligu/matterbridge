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

import { threadId, isMainThread, parentPort, workerData } from 'node:worker_threads';

import { AnsiLogger, LogLevel, MAGENTA, TimestampFormat } from 'node-ansi-logger';
import { hasParameter, inspectError } from '@matterbridge/utils';

import { checkUpdates } from './checkUpdates.js';
import { logWorkerInfo, parentLog, parentPost, threadLogger } from './worker.js';
import { BroadcastServer } from './broadcastServer.js';

const debug = hasParameter('debug') || hasParameter('verbose') || hasParameter('debug-worker') || hasParameter('verbose-worker');
const verbose = hasParameter('verbose') || hasParameter('verbose-worker');
const name = 'MatterbridgeCheckUpdates';

// Send init message
if (!isMainThread && parentPort) {
  parentPost({ type: 'init', threadId, threadName: workerData.threadName, success: true });
  if (debug) parentLog(name, LogLevel.INFO, `Worker ${workerData.threadName}:${threadId} initialized.`);
}

// Broadcast server
const log = new AnsiLogger({
  logName: name,
  logNameColor: MAGENTA,
  logTimestampFormat: TimestampFormat.TIME_MILLIS,
  logLevel: debug ? LogLevel.DEBUG : LogLevel.INFO,
});
const server = new BroadcastServer('matterbridge', log);

// Log worker info
if (verbose) logWorkerInfo(log, verbose);

threadLogger(name, LogLevel.INFO, `Starting check updates...`);
let success = false;
try {
  const shared = (await server.fetch({ type: 'matterbridge_shared', src: `matterbridge`, dst: 'matterbridge' }, 1000)).result.data;
  await checkUpdates(shared);
  threadLogger(name, LogLevel.INFO, `Check updates succeeded`);
  success = true;
} catch (error) {
  const errorMessage = inspectError(log, `Failed to check updates`, error);
  threadLogger(name, LogLevel.ERROR, errorMessage);
}

// Close the broadcast server
server.close();

// Send exit message
if (!isMainThread && parentPort) {
  parentPost({ type: 'exit', threadId, threadName: workerData.threadName, success });
  if (debug) parentLog(name, LogLevel.INFO, `Worker ${workerData.threadName}:${threadId} exiting with success: ${success}.`);
}
