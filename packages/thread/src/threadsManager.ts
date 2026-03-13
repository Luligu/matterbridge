/**
 * This file contains the ThreadsManager class.
 *
 * @file threadsManager.ts
 * @author Luca Liguori
 * @created 2026-03-07
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

/* eslint-disable jsdoc/no-defaults */

// istanbul ignore next 2 lines - loader/debug/verbose flags are only used for development and testing, not in production
// eslint-disable-next-line no-console
if (process.argv.includes('--loader') || process.argv.includes('-loader')) console.log('\u001B[32mThreadsManager loaded.\u001B[40;0m');

import fs from 'node:fs';
import path, { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Worker, WorkerOptions } from 'node:worker_threads';

import type { ParentPortMessage, ThreadNames, WorkerData, WorkerMessage } from '@matterbridge/types';
import { hasParameter } from '@matterbridge/utils/cli';
import { AnsiLogger, CYAN, db, debugStringify, LogLevel, MAGENTA, TimestampFormat } from 'node-ansi-logger';

import { BroadcastServer } from './broadcastServer.js';
import type { WorkerWrapper } from './workerWrapper.js';

interface ThreadInfo {
  /** Logical name used to identify the thread (also passed as workerData.threadName). */
  name: ThreadNames;
  /** Worker script/build artifact file name (resolved via resolvePath) or relative path. */
  path: string;
  /** Execution type (worker runs and exits, thread runs continuously). */
  type: 'worker' | 'thread';
  /** Last created Worker instance for this thread (if started). */
  worker?: Worker;
  /** Number of times this thread has been started via runThread(). */
  runCount?: number;
  /** Number of times this thread has encountered an error. */
  errorCount?: number;
  /** Timestamp in ms when the thread was last started (Date.now()). */
  lastStarted?: number;
  /** Timestamp in ms when the thread was last stopped (Date.now()). */
  lastStopped?: number;
  /** Duration in ms between last start and stop, if known. */
  lastDuration?: number;
  /** Timestamp in ms when the thread was last seen (Date.now()). */
  lastSeen?: number;
}

/**
 * ThreadsManager is responsible for managing and running different threads in the application.
 */
export class ThreadsManager {
  // istanbul ignore next 2 lines - debug/verbose flags are only used for development and testing, not in production
  private debug: boolean;
  private verbose: boolean;
  private tracker: boolean;
  private log: AnsiLogger;
  static logLevel: LogLevel;

  private server: BroadcastServer;
  private readonly boundMsgHandler = this.msgHandler.bind(this);

  private interval: NodeJS.Timeout;
  private intervalMs: number;

  private threads: ThreadInfo[] = [
    { name: 'CheckUpdates', path: 'workerCheckUpdates.js', type: 'worker' },
    { name: 'SystemCheck', path: 'workerSystemCheck.js', type: 'worker' },
    { name: 'GlobalPrefix', path: 'workerGlobalPrefix.js', type: 'worker' },
    { name: 'SpawnCommand', path: 'workerSpawnCommand.js', type: 'worker' },
  ];

  /**
   * Initialize the ThreadsManager by setting up the check interval, broadcast server, and listeners.
   *
   * @param {number} [intervalMs=10_000] - The delay in milliseconds for the interval handler. Defaults to 10 seconds (10000 ms).
   */
  constructor(intervalMs: number = 10_000) {
    // istanbul ignore next 3 lines - debug/verbose/tracker flags are only used for development and testing, not in production
    this.debug = hasParameter('debug') || hasParameter('verbose') || hasParameter('debug-threads') || hasParameter('verbose-threads');
    this.verbose = hasParameter('verbose') || hasParameter('verbose-threads');
    this.tracker = hasParameter('tracker') || hasParameter('tracker-threads');
    // Create a logger instance for the ThreadsManager
    this.log = new AnsiLogger({
      logName: 'ThreadsManager',
      logNameColor: MAGENTA,
      logTimestampFormat: TimestampFormat.TIME_MILLIS,
      // istanbul ignore next - debug/verbose flags are only used for development and testing, not in production
      logLevel: this.debug ? LogLevel.DEBUG : LogLevel.INFO,
    });
    // Set the static log level property for use in static methods
    ThreadsManager.logLevel = this.log.logLevel;

    // Create broadcast server and set up message handler
    this.server = new BroadcastServer('manager', this.log);
    this.server.on('broadcast_message', this.boundMsgHandler);

    // Set up an interval to log thread status every minute for debugging purposes
    this.intervalMs = intervalMs;
    this.interval = setInterval(this.intervalHandler.bind(this), this.intervalMs);

    // istanbul ignore next - debug/verbose flags are only used for development and testing, not in production
    if (this.verbose) this.log.notice(`ThreadsManager initialized. Listening for broadcast messages...`);
  }

  /**
   * Clean up resources used by the ThreadsManager, such as the interval and broadcast servers.
   */
  destroy() {
    // Clear the interval
    clearInterval(this.interval);
    // Close broadcast servers and remove listeners
    this.server.off('broadcast_message', this.boundMsgHandler);
    this.server.close();
    // istanbul ignore next - debug/verbose flags are only used for development and testing, not in production
    if (this.verbose) this.log.notice(`ThreadsManager destroyed. Broadcast server closed.`);
  }

  /**
   * Handle incoming messages from the broadcast server.
   *
   * @param {WorkerMessage} msg - The message received from the broadcast server.
   */
  private async msgHandler(msg: WorkerMessage) {
    if (this.server.isWorkerRequest(msg) && (msg.dst === 'all' || msg.dst === 'manager')) {
      // istanbul ignore next - debug/verbose flags are only used for development and testing, not in production
      if (this.verbose) this.log.debug(`Received broadcast request ${CYAN}${msg.type}${db} from ${CYAN}${msg.src}${db}: ${debugStringify(msg)}${db}`);
      switch (msg.type) {
        case 'get_log_level':
          this.server.respond({ ...msg, result: { logLevel: this.log.logLevel } });
          break;
        case 'set_log_level':
          if (!this.debug) {
            this.log.logLevel = msg.params.logLevel;
            ThreadsManager.logLevel = msg.params.logLevel;
          }
          this.server.respond({ ...msg, result: { logLevel: this.log.logLevel } });
          break;
        case 'manager_run':
          try {
            this.runThread(msg.params.name, msg.params.workerData, msg.params.argv, msg.params.env, msg.params.execArgv, msg.params.pipedOutput);
            this.server.respond({ ...msg, result: { success: true } });
          } catch (err) {
            this.log.warn(`Failed to run thread ${CYAN}${msg.params.name}${db}: ${(err as Error).message}`);
            this.server.respond({ ...msg, result: { success: false } });
          }
          break;
        default:
          // istanbul ignore next - debug/verbose flags are only used for development and testing, not in production
          if (this.verbose) this.log.debug(`Unknown broadcast request ${CYAN}${msg.type}${db} from ${CYAN}${msg.src}${db}`);
      }
    }
  }

  private intervalHandler() {
    this.log.debug(
      `Threads status:\n${this.threads.map((t) => `${t.name} running: ${t.worker ? 'yes' : 'no'}, lastSeen: ${t.lastSeen ? new Date(t.lastSeen).toISOString() : 'never'}, runs: ${t.runCount ?? 0}, errors: ${t.errorCount ?? 0}`).join('\n')}`,
    );
    for (const thread of this.threads) {
      if (thread.worker && Date.now() - (thread.lastSeen || 0) > this.intervalMs) {
        const msg: ParentPortMessage = { type: 'ping', threadId: thread.worker.threadId, threadName: thread.name };
        thread.worker.postMessage(msg);
      }
      if (thread.worker && Date.now() - (thread.lastSeen || 0) > this.intervalMs * 2) {
        this.log.warn(`Thread ${CYAN}${thread.name}${db} has not been seen for more than ${this.intervalMs * 2} ms. It may be unresponsive.`);
      }
    }
  }

  /**
   * Run a thread by name.
   *
   * @param {string} name - The name of the thread to run.
   * @param {WorkerData} [workerData] - Optional data to pass to the worker.
   * @param {string[]} [argv] - Optional command line arguments to pass to the worker. If not provided, inherits from the main thread.
   * @param {NodeJS.ProcessEnv} [env] - Optional environment variables to pass to the worker. If not provided, inherits from the main thread.
   * @param {string[]} [execArgv] - Optional execArgv to pass to the worker. If not provided no execArgv are passed.
   * @param {boolean} [pipedOutput] - Whether to pipe the worker's stdout and stderr. Defaults to false.
   *
   * @returns {Worker} The created worker instance.
   *
   * @throws {Error} If the thread with the given name is not found.
   * @throws {Error} If the thread is already running.
   */
  runThread(name: string, workerData?: WorkerData, argv?: string[], env?: NodeJS.ProcessEnv, execArgv?: string[], pipedOutput: boolean = false): Worker {
    const threadInfo = this.threads.find((t) => t.name === name);
    if (!threadInfo) {
      throw new Error(`Thread ${name} not found`);
    }
    if (threadInfo.worker) {
      throw new Error(`Thread ${name} is already running with thread ID ${threadInfo.worker.threadId}`);
    }

    const path = this.resolvePath(threadInfo.path);
    this.log.debug(`Starting thread ${threadInfo.name} from path ${path} type ${threadInfo.type}...`);

    threadInfo.lastStarted = undefined;
    threadInfo.lastStopped = undefined;
    threadInfo.lastDuration = undefined;

    threadInfo.worker = this.createESMWorker(
      threadInfo.name,
      path,
      { ...workerData, debug: this.debug, verbose: this.verbose, logLevel: this.log.logLevel }, // Pass debug/verbose/logLevel/tracker in workerData for workers to adjust their logging behavior
      argv,
      env,
      execArgv,
      pipedOutput,
    );

    const worker = threadInfo.worker;

    worker.once('online', () => {
      threadInfo.runCount = (threadInfo.runCount ?? 0) + 1;
      threadInfo.lastStarted = Date.now();
      threadInfo.lastSeen = Date.now();
      this.log.debug(`Thread ${threadInfo.name} is online started at ${new Date(threadInfo.lastStarted).toISOString()} with thread id ${worker.threadId}`);
    });

    worker.once('exit', () => {
      const stoppedAt = Date.now();
      threadInfo.lastStopped = stoppedAt;
      threadInfo.lastDuration = Math.max(0, stoppedAt - (threadInfo.lastStarted ?? stoppedAt));
      threadInfo.worker = undefined;
      threadInfo.lastSeen = Date.now();
      this.log.debug(`Thread ${threadInfo.name} has exited at ${new Date(threadInfo.lastStopped).toISOString()} after running for ${threadInfo.lastDuration} ms`);
    });

    worker.on('message', (message: ParentPortMessage) => {
      threadInfo.lastSeen = Date.now();
      // istanbul ignore next - debug/verbose flags are only used for development and testing, not in production
      if (this.verbose) this.log.debug(`Thread ${threadInfo.name} sent a message at ${new Date().toISOString()}: ${debugStringify(message)}`);
      if (message.type === 'log') {
        AnsiLogger.create({ logName: threadInfo.name, logNameColor: MAGENTA, logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: this.log.logLevel }).log(
          message.logLevel,
          message.message,
        );
      }
    });

    worker.on('messageerror', () => {
      threadInfo.errorCount = (threadInfo.errorCount ?? 0) + 1;
      this.log.error(`Thread ${threadInfo.name} encountered a message error at ${new Date().toISOString()}`);
    });

    worker.once('error', () => {
      threadInfo.errorCount = (threadInfo.errorCount ?? 0) + 1;
      const stoppedAt = Date.now();
      threadInfo.lastStopped = stoppedAt;
      threadInfo.lastDuration = Math.max(0, stoppedAt - (threadInfo.lastStarted ?? stoppedAt));
      threadInfo.worker = undefined;
      this.log.error(`Thread ${threadInfo.name} encountered an error at ${new Date(threadInfo.lastStopped).toISOString()} after running for ${threadInfo.lastDuration} ms`);
    });

    this.log.debug(`Started thread ${threadInfo.name} from path ${path} type ${threadInfo.type} with thread id ${worker.threadId}`);

    return threadInfo.worker;
  }

  /**
   *  Run a thread's code in the main thread instead of a thread.
   *
   * @param {string} name - The name of the thread to run in the main thread.
   * @param {WorkerData | null} [workerData] - Optional data to pass to the thread code.
   * @returns {Promise<boolean>} True if the thread code ran successfully, false otherwise.
   *
   * @throws {Error} If the thread with the given name is not found.
   */
  async runInMainThread(name: string, workerData: WorkerData | null = null): Promise<boolean> {
    const threadInfo = this.threads.find((t) => t.name === name);
    if (!threadInfo) {
      throw new Error(`Thread ${name} not found`);
    }

    this.log.debug(`Running thread ${threadInfo.name} in the main thread...`);

    let success = false;
    const workerWrapper: WorkerWrapper = (await import(this.resolvePath(threadInfo.path))).default;
    if (workerWrapper && typeof workerWrapper === 'object' && workerWrapper.name === name && workerWrapper.callback && typeof workerWrapper.callback === 'function') {
      workerWrapper.workerData = workerData;
      success = await workerWrapper.callback(workerWrapper);
      workerWrapper.destroy(success);
    }

    this.log.debug(`Finished running thread ${threadInfo.name} in the main thread.`);
    return success;
  }

  /**
   * Resolve a file path located in the `@matterbridge/thread` distribution directory.
   *
   * @remarks
   * Matterbridge spawns ESM workers from built JavaScript files (e.g. `workerCheckUpdates.js`).
   * Depending on how the code is executed:
   * - **Production**: `import.meta.url` points inside `.../node_modules/@matterbridge/thread/dist/...`
   *   and the worker file is usually alongside the current module.
   * - **Development / tests**: `import.meta.url` may point inside `.../packages/thread/src/...`
   *   while the worker file exists in `.../packages/thread/dist/...`.
   *
   * This helper tries both locations and returns the first existing candidate.
   *
   * @param {string} fileName - Worker/build artifact file name, e.g. `workerGlobalPrefix.js`.
   * @returns {string} Absolute path to the resolved file. If none exists, returns the first candidate (best effort).
   */
  resolvePath(fileName: string): string {
    const currentModuleDirectory = path.dirname(fileURLToPath(import.meta.url));
    // This core package's src or dist directory or the global installation dist directory for thread package
    const candidates = [
      path.join(currentModuleDirectory, fileName), // Current dist directory for production
      path.join(currentModuleDirectory, '..', 'dist', fileName), // Current src directory for jest tests
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate;
    }
    return candidates[0];
  }

  /**
   * Typed helper to create an ESM Worker.
   *
   * This method uses pathToFileURL to convert the relative path to a file URL,
   * which is necessary for ESM modules. It also sets the worker type to 'module'.
   *
   * @param {string} name - name of the worker
   * @param {string} relativePath - path to the worker file code: it must be an ESM module in javascript
   * @param {Record<string, boolean | number | string | object>} [workerData] - optional data to pass to the worker
   * @param {string[]} [argv] - optional command line arguments to pass to the worker. If not provided, inherits from the main thread.
   * @param {NodeJS.ProcessEnv} [env] - optional environment variables to pass to the worker. If not provided, inherits from the main thread.
   * @param {string[]} [execArgv] - optional execArgv to pass to the worker. If not provided no execArgv are passed.
   * @param {boolean} [pipedOutput] - whether to pipe the worker's stdout and stderr. Defaults to false.
   * @returns {Worker} - the created Worker instance
   *
   * @example
   * ```typescript
   * createESMWorker('NpmCommand', './dist/npmCommand.js', { command: 'npm list --global --depth=0' });
   * ```
   */
  createESMWorker(
    name: string,
    relativePath: string,
    workerData?: Record<string, boolean | number | string | object>,
    argv?: string[],
    env?: NodeJS.ProcessEnv,
    execArgv?: string[],
    pipedOutput: boolean = false,
  ): Worker {
    const fileURL = pathToFileURL(resolve(relativePath));
    const options: WorkerOptions & { type: string } = {
      workerData: { ...workerData, threadName: name, debug: this.debug, verbose: this.verbose, logLevel: this.log.logLevel, tracker: this.tracker }, // Pass threadName in workerData cause worker_threads don't have it natively in node 20
      type: 'module',
      name,
      argv: argv ?? process.argv.slice(2), // Pass command line arguments to worker
      env: env ?? process.env, // Inherit environment variables
      execArgv, // execArgv for node like --inspect
      stdout: pipedOutput, // When true, worker.stdout becomes a Readable stream (otherwise null)
      stderr: pipedOutput, // When true, worker.stderr becomes a Readable stream (otherwise null)
    };
    // istanbul ignore next - debug/verbose flags are only used for development and testing, not in production
    if (this.verbose) this.log.debug(`Creating ESM Worker ${name} with file URL ${fileURL.href} and options ${debugStringify(options)}`);
    return new Worker(fileURL, options);
  }
}
