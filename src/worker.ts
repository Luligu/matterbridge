/**
 * This file contains the worker functions.
 *
 * @file workers.ts
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

import { isMainThread, parentPort, threadId, Worker, workerData, WorkerOptions } from 'node:worker_threads';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { inspect } from 'node:util';

import { AnsiLogger, LogLevel } from 'node-ansi-logger';

import type { ParentPortMessage } from './workerTypes.js';

/**
 * Sends a control message to the parent through parentPort
 *
 * @param {ControlMessage} message - The control message to send.
 */
export function parentPost(message: ParentPortMessage): void {
  if (!parentPort) throw new Error(`WorkerServer ${workerData.threadName}: parentPort is not available.`);
  parentPort.postMessage(message);
}

/**
 * Sends a control message to the parent through parentPort to log a message.
 *
 * @param {string | undefined} logName - The name of the logger.
 * @param {LogLevel} logLevel - The log level of the message.
 * @param {string} message - The log message to send.
 */
export function parentLog(logName: string | undefined, logLevel: LogLevel, message: string): void {
  if (!parentPort) throw new Error(`WorkerServer ${workerData.threadName}: parentPort is not available.`);
  const logMessage: ParentPortMessage = { type: 'log', threadId, threadName: workerData.threadName, logName, logLevel, message };
  parentPort.postMessage(logMessage);
}

/**
 * Typed helper to create an ESM Worker.
 *
 * This function uses pathToFileURL to convert the relative path to a file URL,
 * which is necessary for ESM modules. It also sets the worker type to 'module'.
 *
 * @param {string} name - name of the worker
 * @param {string} relativePath - path to the worker file code: it must be an ESM module in javascript
 * @param {Record<string, boolean | number | string | object>} [workerData] - optional data to pass to the worker
 * @param {string[]} [argv] - optional command line arguments to pass to the worker. If not provided, inherits from the main thread.
 * @param {NodeJS.ProcessEnv} [env] - optional environment variables to pass to the worker. If not provided, inherits from the main thread.
 * @param {string[]} [execArgv] - optional execArgv to pass to the worker. If not provided no execArgv are passed.
 * @returns {Worker} - the created Worker instance
 *
 * @example
 * ```typescript
 * createESMWorker('NpmCommand', './dist/npmCommand.js', { command: 'npm list --global --depth=0' });
 * ```
 */
export function createESMWorker(name: string, relativePath: string, workerData?: Record<string, boolean | number | string | object>, argv?: string[], env?: NodeJS.ProcessEnv, execArgv?: string[]): Worker {
  const fileURL = pathToFileURL(resolve(relativePath));
  const options: WorkerOptions & { type: string } = {
    workerData: { ...workerData, threadName: name }, // Pass threadName in workerData cause worker_threads don't have it natively in node 20
    type: 'module',
    name,
    argv: argv ?? process.argv.slice(2), // Pass command line arguments to worker
    env: env ?? process.env, // Inherit environment variables
    execArgv, // execArgv for node like --inspect
  };
  return new Worker(fileURL, options);
}

/**
 * Log worker information.
 *
 * @param {AnsiLogger} log - The logger instance to use for logging.
 * @param {boolean} [logEnv] - Whether to log environment variables. Defaults to false.
 */
export function logWorkerInfo(log: AnsiLogger, logEnv: boolean = false): void {
  log.debug(`${isMainThread ? 'Main thread' : 'Worker thread'}: ${workerData?.threadName}:${threadId} Pid: ${process.pid}`);
  log.debug(`ParentPort: ${parentPort ? 'active' : 'not active'}`);
  log.debug(`WorkerData: ${workerData ? inspect(workerData, true, 10, true) : 'none'}`);
  const argv = process.argv.slice(2);
  log.debug(`Argv: ${argv.length ? argv.join(' ') : 'none'}`);
  log.debug(`Env: ${logEnv ? inspect(process.env, true, 10, true) : 'not logged'}`);
}
