/**
 * This file contains the class WorkerWrapper.
 *
 * @file workerWrapper.ts
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

// istanbul ignore next 2 lines - loader/debug/verbose flags are only used for development and testing, not in production
// eslint-disable-next-line no-console
if (process.argv.includes('--loader') || process.argv.includes('-loader')) console.log('\u001B[32mWorkerWrapper loaded.\u001B[40;0m');

import { isMainThread, parentPort, threadId, workerData } from 'node:worker_threads';

import type { ParentPortMessage, ThreadNames, WorkerData } from '@matterbridge/types';
import { hasParameter } from '@matterbridge/utils/cli';
import { formatBytes } from '@matterbridge/utils/format';
import type { Tracker } from '@matterbridge/utils/tracker';
import { AnsiLogger, debugStringify, LogLevel, MAGENTA, TimestampFormat } from 'node-ansi-logger';

import { BroadcastServer } from './broadcastServer.js';
import { ThreadsManager } from './threadsManager.js';

/**
 * Worker wrapper
 * This class serves as a wrapper for worker threads in the Matterbridge application, providing a structured way to initialize, manage, and communicate with worker threads.
 * It handles the setup of logging, message passing between the worker and the parent thread, and ensures proper cleanup when the worker is destroyed.
 * The WorkerWrapper class abstracts away the complexities of working with worker threads, allowing developers to focus on the specific tasks that each worker thread needs to perform.
 */
export class WorkerWrapper {
  // istanbul ignore next 3 lines - debug/verbose flags are only used for development and testing, not in production
  debug = hasParameter('debug') || hasParameter('verbose') || hasParameter('debug-threads') || hasParameter('verbose-threads');
  verbose = hasParameter('verbose') || hasParameter('verbose-threads');
  useTracker = hasParameter('tracker') || hasParameter('tracker-threads');
  log: AnsiLogger;
  server: BroadcastServer;
  workerData: WorkerData | null = workerData;
  tracker: Tracker | undefined;

  /**
   * Initializes the worker by sending an init message to the parent and logging the initialization if debug is enabled.
   *
   * @param {ThreadNames} name - The name of the worker thread, used for logging and identification purposes.
   * @param { (worker: WorkerWrapper) => Promise<boolean> } callback - A callback function that is executed after the worker is initialized.
   */
  constructor(
    public name: ThreadNames,
    callback: (worker: WorkerWrapper) => Promise<boolean>,
  ) {
    // Update debug, verbose and tracker flags if workerData is available
    // istanbul ignore next 5 lines - debug/verbose flags are only used for development and testing, not in production
    if (this.workerData) {
      this.debug = this.workerData.debug || this.debug;
      this.verbose = this.workerData.verbose || this.verbose;
      this.useTracker = this.workerData.tracker || this.useTracker;
    }
    // istanbul ignore next - debug/verbose flags are only used for development and testing, not in production
    if (this.useTracker) {
      void import('@matterbridge/utils/tracker')
        .then(({ Tracker }) => {
          this.tracker = new Tracker(`Thread${this.name}`, this.debug, this.verbose);
          this.tracker.start();
          return undefined;
        })
        // istanbul ignore next - debug/verbose flags are only used for development and testing, not in production
        .catch((err) => {
          // eslint-disable-next-line no-console
          if (this.debug) console.error(`WorkerWrapper ${this.name}: failed to load Tracker`, err);
          return undefined;
        });
    }
    // Initialize logger
    this.log = new AnsiLogger({
      logName: this.name,
      logNameColor: MAGENTA,
      logTimestampFormat: TimestampFormat.TIME_MILLIS,
      logLevel: this.debug ? LogLevel.DEBUG : LogLevel.INFO,
    });

    // Initialize broadcast server
    this.server = new BroadcastServer('matterbridge', this.log);

    // Message handler for the worker, which listens for messages from the parent and handles them accordingly
    if (!isMainThread && parentPort && this.workerData) {
      parentPort.on('message', (message: ParentPortMessage) => {
        // istanbul ignore next - debug/verbose flags are only used for development and testing, not in production
        if (this.debug) this.log.debug(`Worker ${this.name}:${threadId} received message from parent: ${debugStringify(message)}`);
        switch (message.type) {
          case 'ping':
            this.parentLog(this.name, LogLevel.DEBUG, `Worker ${this.name}:${threadId} received ping message type from parent: ${debugStringify(message)}`);
            this.parentPost({ type: 'pong', threadId, threadName: this.name });
            this.parentLog(this.name, LogLevel.DEBUG, `Worker ${this.name}:${threadId} sent pong message type to parent: ${debugStringify(message)}`);
            break;
          case 'pong':
            this.parentLog(this.name, LogLevel.DEBUG, `Worker ${this.name}:${threadId} received pong message type from parent: ${debugStringify(message)}`);
            break;
          default:
            this.parentLog(this.name, LogLevel.WARN, `Worker ${this.name}:${threadId} received unknown message type from parent: ${debugStringify(message)}`);
        }
      });
    }

    // Send init message
    if (!isMainThread && parentPort && this.workerData) {
      this.parentPost({ type: 'init', threadId, threadName: this.name, memoryUsage: process.memoryUsage(), success: true });
      // istanbul ignore next - debug/verbose flags are only used for development and testing, not in production
      if (this.debug) this.parentLog(this.name, LogLevel.INFO, `Worker ${this.name}:${threadId} initialized.`);
    }

    // Log worker info
    // istanbul ignore next - debug/verbose flags are only used for development and testing, not in production
    if (this.verbose) this.logWorkerInfo(this.log, false);

    // Execute the callback function and destroy the worker with the success status returned by the callback
    setImmediate(async () => {
      const success = await callback(this);
      this.destroy(success);
    });
  }

  /**
   * Destroys the worker by closing the broadcast server and sending an exit message to the parent with the success status.
   *
   * @param {boolean} success - Indicates whether the worker completed its task successfully, which is included in the exit message sent to the parent.
   */
  destroy(success: boolean): void {
    // Close the tracker if it exists
    // istanbul ignore next - debug/verbose flags are only used for development and testing, not in production
    if (this.tracker) this.tracker.stop();

    // Close the broadcast server
    this.server.close();

    // Send exit message to parent and close parentPort
    if (!isMainThread && parentPort && this.workerData) {
      // istanbul ignore next - debug/verbose flags are only used for development and testing, not in production
      if (this.debug) this.parentLog(this.name, LogLevel.INFO, `Worker ${this.name}:${threadId} exiting with success: ${success}.`);
      this.parentPost({ type: 'exit', threadId, threadName: this.name, memoryUsage: process.memoryUsage(), success });
      parentPort.close();
    }
  }

  /**
   * Sends a control message to the parent through parentPort
   *
   * @param {ControlMessage} message - The control message to send.
   * @returns {void}
   * @throws {Error} If parentPort is not available.
   */
  parentPost(message: ParentPortMessage): void {
    if (!parentPort) throw new Error(`WorkerServer ${this.name}: parentPort is not available.`);
    parentPort.postMessage(message);
    // istanbul ignore next - debug/verbose flags are only used for development and testing, not in production
    if (this.debug) this.log.debug(`Worker ${this.name}:${threadId} sent message to parent: ${debugStringify(message)}`);
  }

  /**
   * Sends a control message to the parent through parentPort to log a message.
   *
   * @param {string | undefined} logName - The name of the logger.
   * @param {LogLevel} logLevel - The log level of the message.
   * @param {string} message - The log message to send.
   * @returns {void}
   * @throws {Error} If parentPort is not available.
   */
  parentLog(logName: string | undefined, logLevel: LogLevel, message: string): void {
    if (!parentPort) throw new Error(`WorkerServer ${this.name}: parentPort is not available.`);
    const logMessage: ParentPortMessage = { type: 'log', threadId, threadName: this.name, logName, logLevel, message };
    parentPort.postMessage(logMessage);
    // istanbul ignore next - debug/verbose flags are only used for development and testing, not in production
    if (this.debug) this.log.debug(`Worker ${this.name}:${threadId} sent log to parent: ${logName} ${logLevel} ${message}`);
  }

  /**
   *  Logs a message in the worker logger or sends it to the parent logger.
   *
   * @param {LogLevel} level - The log level of the message.
   * @param {string} message - The log message to log.
   * @returns {void}
   */
  logger(level: LogLevel, message: string): void {
    if (!isMainThread && parentPort) this.parentLog(this.name, level, message);
    else AnsiLogger.create({ logName: this.name, logNameColor: MAGENTA, logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: ThreadsManager.logLevel }).log(level, message);
  }

  /**
   * Log worker information either in the worker logger or the parent logger depending on whether it's running in a worker thread or the main thread.
   *
   * @param {AnsiLogger} log - The logger instance to use for logging.
   * @param {boolean} [logEnv] - Whether to log environment variables. Defaults to false.
   * @returns {void}
   */
  logWorkerInfo(log: AnsiLogger, logEnv: boolean = false): void {
    log.debug(`${isMainThread ? 'Main thread' : 'Worker thread'}: ${this.name}:${threadId} Pid: ${process.pid}`);
    log.debug(`ParentPort: ${parentPort ? 'active' : 'not active'}`);
    log.debug(`WorkerData: ${this.workerData ? debugStringify(this.workerData) : 'none'}`);
    const argv = process.argv.slice(2);
    log.debug(`Argv: ${argv.length ? argv.join(' ') : 'none'}`);
    log.debug(`Env: ${logEnv ? debugStringify(process.env) : 'not logged'}`);
    log.debug(`Memory: ${formatBytes(process.memoryUsage().heapTotal)} total, ${formatBytes(process.memoryUsage().heapUsed)} used`);
  }
}
