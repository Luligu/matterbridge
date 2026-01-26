/**
 * This file contains the workerGlobalPrefix functions.
 *
 * @file workerGlobalPrefix.ts
 * @author Luca Liguori
 * @created 2025-11-25
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

import { threadId, isMainThread, parentPort, workerData } from 'node:worker_threads';

import { AnsiLogger, LogLevel, TimestampFormat } from 'node-ansi-logger';
import { getGlobalNodeModules, hasParameter, inspectError } from '@matterbridge/utils';

import { BroadcastServer } from './broadcastServer.js';
import { logWorkerInfo, parentLog, parentPost } from './worker.js';

const debug = hasParameter('debug') || hasParameter('verbose');
const verbose = hasParameter('verbose');

// Send init message
// istanbul ignore next cause it's available only in worker threads
if (!isMainThread && parentPort) {
  parentPost({ type: 'init', threadId, threadName: workerData.threadName, success: true });
  if (debug) parentLog('MatterbridgePrefix', LogLevel.INFO, `Worker ${workerData.threadName}:${threadId} initialized.`);
}

// Broadcast server
const log = new AnsiLogger({ logName: 'MatterbridgePrefix', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: debug ? LogLevel.DEBUG : LogLevel.INFO });
const server = new BroadcastServer('matterbridge', log);

// Log worker info
if (verbose) logWorkerInfo(log, verbose);

let prefix: string;
let success = false;
try {
  prefix = await getGlobalNodeModules();
  log.debug(`Global node_modules Directory: ${prefix}`);
  server.request({ type: 'matterbridge_global_prefix', src: `matterbridge`, dst: 'matterbridge', params: { prefix } });
  success = true;
  if (!isMainThread && parentPort) parentLog('MatterbridgePrefix', LogLevel.DEBUG, `Global node_modules Directory: ${prefix}`);
} catch (error) {
  // istanbul ignore next cause it's just an error log
  const errorMessage = inspectError(log, `Failed to get global node modules`, error);
  // istanbul ignore next cause it's just an error log
  if (!isMainThread && parentPort) parentLog('MatterbridgePrefix', LogLevel.ERROR, errorMessage);
}
server.close();

// Send exit message
// istanbul ignore next cause it's available only in worker threads
if (!isMainThread && parentPort) {
  parentPost({ type: 'exit', threadId, threadName: workerData.threadName, success });
  if (debug) parentLog('MatterbridgePrefix', LogLevel.INFO, `Worker ${workerData.threadName}:${threadId} exiting with success: ${success}.`);
}
