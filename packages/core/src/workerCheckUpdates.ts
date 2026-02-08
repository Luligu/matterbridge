/**
 * This file contains the workerCheckUpdates functions.
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

import { AnsiLogger, LogLevel, TimestampFormat } from 'node-ansi-logger';
import { hasParameter, inspectError } from '@matterbridge/utils';

import { BroadcastServer } from './broadcastServer.js';
import { logWorkerInfo, parentLog, parentPost } from './worker.js';
import { checkUpdates } from './checkUpdates.js';

const debug = hasParameter('debug') || hasParameter('verbose');
const verbose = hasParameter('verbose');

// Send init message
if (!isMainThread && parentPort) {
  parentPost({ type: 'init', threadId, threadName: workerData.threadName, success: true });
  if (debug) parentLog('MatterbridgeCheckUpdates', LogLevel.INFO, `Worker ${workerData.threadName}:${threadId} initialized.`);
}

// Broadcast server
const log = new AnsiLogger({ logName: 'MatterbridgeCheckUpdates', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: debug ? LogLevel.DEBUG : LogLevel.INFO });
const server = new BroadcastServer('matterbridge', log);

// Log worker info
if (verbose) logWorkerInfo(log, verbose);

let success = false;
try {
  const shared = (await server.fetch({ type: 'matterbridge_shared', src: `matterbridge`, dst: 'matterbridge' })).result.data;
  await checkUpdates(shared);
  success = true;
  log.debug(`Check updates succeeded`);
  if (!isMainThread && parentPort) parentLog('MatterbridgeCheckUpdates', LogLevel.DEBUG, `Check updates succeeded`);
} catch (error) {
  // istanbul ignore next cause it's just an error log
  const errorMessage = inspectError(log, `Failed to check updates`, error);
  // istanbul ignore next cause it's just an error log
  if (!isMainThread && parentPort) parentLog('MatterbridgeCheckUpdates', LogLevel.ERROR, errorMessage);
}

// Close the broadcast server
server.close();

// Send exit message
if (!isMainThread && parentPort) {
  parentPost({ type: 'exit', threadId, threadName: workerData.threadName, success });
  if (debug) parentLog('MatterbridgeCheckUpdates', LogLevel.INFO, `Worker ${workerData.threadName}:${threadId} exiting with success: ${success}.`);
}
