/**
 * @file packages/thread/src/threadsManager.ts
 * @description This file contains the ThreadsManager class.
 * @author Luca Liguori
 * @created 2026-03-07
 * @version 1.3.0
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

/* oxlint-disable jsdoc/no-defaults */

/*
 * Worker lifecycle events, verified on Node.js v24.21.0 and Bun 1.4.2 (identical results).
 * 'exit' always fires exactly once and is the last event; 'error' always precedes it on a failure.
 * 'online' fires even when the worker module cannot be loaded.
 * The only case without 'exit' is the main process exiting or crashing: workers are killed with it.
 *
 * | How the worker ends        | Events                          | Exit code |
 * | -------------------------- | ------------------------------- | --------- |
 * | Code finishes normally     | online, message, exit           | 0         |
 * | process.exit(3)            | online, exit                    | 3         |
 * | Uncaught throw             | online, error, exit             | 1         |
 * | worker.terminate()         | online, message, exit           | 1         |
 * | Unhandled promise reject   | online, message, error, exit    | 1         |
 * | Worker file not found      | online, error, exit             | 1         |
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Worker, type WorkerOptions } from 'node:worker_threads';

import type { ParentPortMessage, ThreadNames, ThreadType, WorkerData, WorkerMessage } from '@matterbridge/types';
import { hasAnyParameter, hasParameter } from '@matterbridge/utils/cli';
import { getErrorMessage } from '@matterbridge/utils/error';
import { logModuleLoaded } from '@matterbridge/utils/loader';
import { fireAndForget } from '@matterbridge/utils/wait';
import { AnsiLogger, CYAN, db, debugStringify, ft, LogLevel, MAGENTA, TimestampFormat, wr } from 'node-ansi-logger';

import { BroadcastServer } from './broadcastServer.js';
import type { ThreadsWrapper } from './threadsWrapper.js';

logModuleLoaded('ThreadsManager');

interface ThreadInstanceInfo {
  /** Worker instance for this thread. */
  worker?: Worker;
  /** Timestamp in ms when the thread was last started (Date.now()). */
  lastStarted?: number;
  /** Timestamp in ms when the thread was last stopped (Date.now()). */
  lastStopped?: number;
  /** Duration in ms between last start and stop, if known. */
  lastDuration?: number;
  /** Timestamp in ms when the thread was last seen (Date.now()). */
  lastSeen?: number;
}
interface ThreadInfo {
  /** Logical name used to identify the thread (also passed as workerData.threadName). */
  name: ThreadNames;
  /** Worker script/build artifact file name (resolved via resolvePath) or relative path. */
  path: string;
  /** Execution type (worker runs and exits, thread runs continuously). */
  type: ThreadType;
  /** Whether multiple instances of this thread are allowed. */
  multiple?: boolean;
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
  /** Instances of this thread, if applicable. */
  instances?: ThreadInstanceInfo[];
}

/**
 * ThreadsManager is responsible for managing and running different threads in the application.
 */
export class ThreadsManager {
  private debug: boolean;
  private verbose: boolean;
  private tracker: boolean;
  private log: AnsiLogger;
  static logLevel: LogLevel;

  private server: BroadcastServer;
  private readonly boundMsgHandler = this.msgHandler.bind(this);

  private interval: NodeJS.Timeout;
  private intervalMs: number;
  private readonly coreDirectory: string;

  private threads: ThreadInfo[] = [
    { name: 'CheckUpdates', path: 'workerCheckUpdates.js', type: 'worker' },
    { name: 'SystemCheck', path: 'workerSystemCheck.js', type: 'worker' },
    { name: 'GlobalPrefix', path: 'workerGlobalPrefix.js', type: 'worker' },
    { name: 'SpawnCommand', path: 'workerSpawnCommand.js', type: 'worker' },
    { name: 'ArchiveCommand', path: 'workerArchiveCommand.js', type: 'worker' },
    { name: 'DockerVersion', path: 'workerDockerVersion.js', type: 'worker' },
    { name: 'Backend', path: 'threadBackend.js', type: 'thread' },
    { name: 'RootNode', path: 'threadRootNode.js', type: 'thread', multiple: true },
  ];

  private terminateWorkers = new Set<Worker>();

  /**
   * Initialize the ThreadsManager by setting up the check interval, broadcast server, and listeners.
   *
   * @param {string} coreDirectory - The directory of the `@matterbridge/core` cli module (its `src` or `dist` directory), used to resolve the core runners.
   * @param {number} [intervalMs=60_000] - The delay in milliseconds for the interval handler. Defaults to 60 seconds (60000 ms).
   */
  constructor(coreDirectory: string, intervalMs: number = 60_000) {
    this.debug = hasAnyParameter('debug', 'verbose', 'debug-threads', 'verbose-threads');
    this.verbose = hasAnyParameter('verbose', 'verbose-threads');
    this.tracker = hasAnyParameter('tracker', 'tracker-threads');
    // Create a logger instance for the ThreadsManager
    this.log = new AnsiLogger({
      logName: 'ThreadsManager',
      logNameColor: MAGENTA,
      logTimestampFormat: TimestampFormat.TIME_MILLIS,
      logLevel: this.debug ? LogLevel.DEBUG : LogLevel.INFO,
      logWithColors: !hasParameter('no-ansi') && process.env.NO_COLOR !== '1',
    });
    // Set the static log level property for use in static methods
    ThreadsManager.logLevel = this.log.logLevel;

    // Create broadcast server and set up message handler
    this.server = new BroadcastServer('manager', this.log);
    this.server.on('broadcast_message', this.boundMsgHandler);

    // Set up an interval to log thread status every minute for debugging purposes
    this.intervalMs = intervalMs;
    this.coreDirectory = coreDirectory;
    this.interval = setInterval(this.intervalHandler.bind(this), this.intervalMs);

    if (this.verbose) this.log.notice(`ThreadsManager initialized. Listening for broadcast messages...`);
  }

  /**
   * Clean up resources used by the ThreadsManager, such as the interval and broadcast servers.
   */
  destroy(): void {
    // Clear the interval
    clearInterval(this.interval);
    this.terminateExitedWorkers();
    // Close broadcast servers and remove listeners
    this.server.off('broadcast_message', this.boundMsgHandler);
    this.server.close();
    if (this.verbose) this.log.notice(`ThreadsManager destroyed. Broadcast server closed.`);
  }

  /**
   * Handle incoming messages from the broadcast server.
   *
   * @param {WorkerMessage} msg - The message received from the broadcast server.
   */
  private msgHandler(msg: WorkerMessage): void {
    if (this.server.isWorkerRequest(msg) && (msg.dst === 'all' || msg.dst === 'manager')) {
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
            this.log.warn(`Failed to run thread ${CYAN}${msg.params.name}${wr}: ${getErrorMessage(err)}`);
            this.server.respond({ ...msg, result: { success: false } });
          }
          break;
        default:
          if (this.verbose) this.log.debug(`Unknown broadcast request ${CYAN}${msg.type}${db} from ${CYAN}${msg.src}${db}`);
      }
    }
  }

  /**
   * Terminate all workers that have exited.
   */
  private terminateExitedWorkers(): void {
    if (this.terminateWorkers.size > 0) {
      this.log.debug(`Terminating ${this.terminateWorkers.size} workers that have exited...`);
      for (const worker of this.terminateWorkers) {
        try {
          this.log.debug(`Terminating worker with thread id ${worker.threadId}...`);
          fireAndForget(worker.terminate(), this.log, `Failed to terminate worker with thread id ${worker.threadId}`);
        } catch (error) {
          this.log.error(`Failed to terminate worker with thread id ${worker.threadId}: ${getErrorMessage(error)}`);
        }
      }
      this.terminateWorkers.clear();
    }
  }

  /**
   * Handle the interval for checking thread statuses and terminating exited workers.
   */
  private intervalHandler(): void {
    // Log the status of each thread, including whether it is running, its thread ID, last seen time, run count, and error count.
    for (const thread of this.threads) {
      if (!thread.multiple) {
        this.log.debug(
          `Thread ${thread.name} running: ${thread.worker ? 'yes' : 'no'}, threadId: ${thread.worker?.threadId ?? 'none'}, lastSeen: ${thread.lastSeen ? new Date(thread.lastSeen).toISOString() : 'never'}, runs: ${thread.runCount ?? 0}, errors: ${thread.errorCount ?? 0}`,
        );
        continue;
      }
      const instances = thread.instances ?? [];
      this.log.debug(
        `Thread ${thread.name} instances: ${instances.length}, running: ${instances.filter((instance) => instance.worker).length}, runs: ${thread.runCount ?? 0}, errors: ${thread.errorCount ?? 0}`,
      );
      instances.forEach((instance, index) => {
        this.log.debug(
          `- instance ${index} running: ${instance.worker ? 'yes' : 'no'}, threadId: ${instance.worker?.threadId ?? 'none'}, lastSeen: ${instance.lastSeen ? new Date(instance.lastSeen).toISOString() : 'never'}, lastStarted: ${instance.lastStarted ? new Date(instance.lastStarted).toISOString() : 'never'}, lastStopped: ${instance.lastStopped ? new Date(instance.lastStopped).toISOString() : 'never'}, lastDuration: ${instance.lastDuration ?? 'none'} ms`,
        );
      });
    }
    // Terminate any workers that have exited before checking for stale threads.
    this.terminateExitedWorkers();
    // Check each thread to see if it is stale and needs to be pinged or warned about.
    for (const thread of this.threads) {
      // A multiple thread keeps its workers in instances, the others in the thread info itself
      for (const info of [thread, ...(thread.instances ?? [])] as (ThreadInfo | ThreadInstanceInfo)[]) {
        if (info.worker && Date.now() - (info.lastSeen ?? 0) > this.intervalMs) {
          const msg: ParentPortMessage = { type: 'ping', threadId: info.worker.threadId, threadName: thread.name };
          info.worker.postMessage(msg);
        }
        if (info.worker && Date.now() - (info.lastSeen ?? 0) > this.intervalMs * 2) {
          this.log.warn(`Thread ${CYAN}${thread.name}${db} has not been seen for more than ${this.intervalMs * 2} ms. It may be unresponsive.`);
        }
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
    if (threadInfo.worker && !threadInfo.multiple) {
      throw new Error(`Thread ${name} is already running with thread ID ${threadInfo.worker.threadId}`);
    }

    const path = this.resolvePath(threadInfo.path);
    if (!fs.existsSync(path)) {
      throw new Error(`Thread ${name} file not found at path ${path}`);
    }
    this.log.debug(`Starting thread ${threadInfo.name} from path ${path} type ${threadInfo.type}${threadInfo.multiple ? ` instances: ${threadInfo.instances?.length}` : ''}...`);

    threadInfo.lastStarted = undefined;
    threadInfo.lastStopped = undefined;
    threadInfo.lastDuration = undefined;

    const worker = this.createESMWorker(
      threadInfo.name,
      path,
      { ...workerData, type: threadInfo.type, debug: this.debug, verbose: this.verbose, tracker: this.tracker, logLevel: this.log.logLevel }, // Pass debug/verbose/logLevel/tracker in workerData for workers to adjust their logging behavior
      argv,
      env,
      execArgv,
      pipedOutput,
    );

    if (threadInfo.multiple) {
      threadInfo.instances ??= [];
      threadInfo.instances.push({ worker });
    } else threadInfo.worker = worker;

    worker.once('online', () => {
      const now = Date.now();
      const info = ([threadInfo, ...(threadInfo.instances ?? [])] as (ThreadInfo | ThreadInstanceInfo)[]).find((info) => info.worker === worker);
      if (info) {
        info.lastSeen = now;
        info.lastStarted = now;
      }
      this.log.debug(`Thread ${threadInfo.name} is online at ${new Date(now).toISOString()}`);
    });

    worker.once('exit', () => {
      const now = Date.now();
      const info = ([threadInfo, ...(threadInfo.instances ?? [])] as (ThreadInfo | ThreadInstanceInfo)[]).find((info) => info.worker === worker);
      if (info) {
        info.lastSeen = now;
        info.lastStopped = now;
        info.lastDuration = Math.max(0, now - (info.lastStarted ?? now));
        info.worker = undefined;
      }
      this.log.debug(`Thread ${threadInfo.name} has exited at ${new Date(now).toISOString()} after ${info?.lastDuration ?? 0} ms`);
      this.terminateWorkers.delete(worker);
    });

    worker.on('message', (message: ParentPortMessage) => {
      const now = Date.now();
      const info = ([threadInfo, ...(threadInfo.instances ?? [])] as (ThreadInfo | ThreadInstanceInfo)[]).find((info) => info.worker === worker);
      if (info) {
        info.lastSeen = now;
      }
      if (this.verbose) this.log.debug(`Thread ${threadInfo.name} sent a message at ${new Date(now).toISOString()}: ${debugStringify(message)}`);
      if (message.type === 'init') {
        threadInfo.runCount = (threadInfo.runCount ?? 0) + 1;
        this.log.debug(`Thread ${threadInfo.name} is online started at ${new Date(now).toISOString()} with thread id ${worker.threadId}`);
      } else if (message.type === 'pong') {
        this.log.debug(`Thread ${threadInfo.name} received a pong at ${new Date(now).toISOString()}`);
      } else if (message.type === 'log') {
        AnsiLogger.create({ logName: threadInfo.name, logNameColor: MAGENTA, logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: this.log.logLevel }).log(
          message.logLevel,
          message.message,
        );
      } else if (message.type === 'exit') {
        if (!message.success) {
          threadInfo.errorCount = (threadInfo.errorCount ?? 0) + 1;
        }
        this.terminateWorkers.add(worker);
        this.log.debug(`Thread ${threadInfo.name} has exited at ${new Date(now).toISOString()} with thread id ${worker.threadId}`);
      }
    });

    worker.on('messageerror', () => {
      const now = Date.now();
      const info = ([threadInfo, ...(threadInfo.instances ?? [])] as (ThreadInfo | ThreadInstanceInfo)[]).find((info) => info.worker === worker);
      if (info) {
        info.lastSeen = now;
        threadInfo.errorCount = (threadInfo.errorCount ?? 0) + 1;
      }
      this.log.error(`Thread ${threadInfo.name} encountered a message error at ${new Date(now).toISOString()}`);
    });

    worker.once('error', (error) => {
      const now = Date.now();
      const info = ([threadInfo, ...(threadInfo.instances ?? [])] as (ThreadInfo | ThreadInstanceInfo)[]).find((info) => info.worker === worker);
      if (info) {
        info.lastSeen = now;
        info.lastStopped = now;
        info.lastDuration = Math.max(0, now - (info.lastStarted ?? now));
        threadInfo.errorCount = (threadInfo.errorCount ?? 0) + 1;
        info.worker = undefined;
      }
      this.terminateWorkers.add(worker);
      this.log.error(`Thread ${threadInfo.name} encountered an error at ${new Date(now).toISOString()} after running for ${info?.lastDuration} ms: ${getErrorMessage(error)}`);
    });

    this.log.debug(`Started thread ${threadInfo.name} from path ${path} type ${threadInfo.type} with thread id ${worker.threadId}`);

    return worker;
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
    const threadsWrapper: ThreadsWrapper = (await import(this.resolvePath(threadInfo.path))).default;
    if (threadsWrapper && typeof threadsWrapper === 'object' && threadsWrapper.name === name && threadsWrapper.entrypoint && typeof threadsWrapper.entrypoint === 'function') {
      threadsWrapper.workerData = workerData ? { ...workerData, type: threadInfo.type } : null;
      try {
        success = await threadsWrapper.entrypoint(threadsWrapper);
      } finally {
        if (!success || threadInfo.type !== 'thread') threadsWrapper.destroy(success);
      }
    }

    this.log.debug(`Finished running thread ${threadInfo.name} in the main thread.`);
    return success;
  }

  /**
   * Resolve a file path located in the `@matterbridge/thread` distribution directory or in the `@matterbridge/core` runners directory.
   *
   * @remarks
   * Matterbridge spawns ESM workers from built JavaScript files (e.g. `workerCheckUpdates.js`).
   * Depending on how the code is executed:
   * - **Production**: `import.meta.url` points inside `.../node_modules/@matterbridge/thread/dist/...`
   *   and the worker file is usually alongside the current module.
   * - **Development / tests**: `import.meta.url` may point inside `.../packages/thread/src/...`
   *   while the worker file exists in `.../packages/thread/dist/...`.
   * - **Bun**: the worker file exists in `.../packages/thread/src/...` (with `.ts` extension).
   * - **Bundled**: when the package is bundled, the worker files live in a `workers/`
   *   subdirectory alongside the current module (`.../dist/workers/...`).
   *
   * The same locations are then tried, from the core directory (the directory of the `@matterbridge/core` cli module), for the core runners: `<core>/runners`, `<core>/../dist/runners` and `<core>/../src/runners` (bun).
   * The core directory comes from the cli `import.meta.url`, so it is correct for hoisted, nested, isolated and bundled layouts.
   *
   * This helper tries all the locations and returns the first existing candidate.
   *
   * @param {string} fileName - Worker/build artifact file name, e.g. `workerGlobalPrefix.js`.
   * @returns {string} Absolute path to the resolved file. If none exists, returns the first candidate (best effort).
   */
  resolvePath(fileName: string): string {
    const threadDirectory = path.dirname(fileURLToPath(import.meta.url));
    const candidates = [
      // This thread package's src or dist directory or the global installation dist directory for thread package
      path.join(threadDirectory, fileName), // Current dist directory for production
      path.join(threadDirectory, '..', 'dist', fileName), // Current src directory for tests
      path.join(threadDirectory, '..', 'src', fileName.replace(/\.js$/, '.ts')), // Current src directory for bun
      path.join(threadDirectory, 'workers', fileName), // Current dist workers directory for bundled workers
      // The core package's src or dist runners directory
      path.join(this.coreDirectory, 'runners', fileName), // Core dist runners directory for production and bundled
      path.join(this.coreDirectory, '..', 'dist', 'runners', fileName), // Core src directory for tests
      path.join(this.coreDirectory, '..', 'src', 'runners', fileName.replace(/\.js$/, '.ts')), // Core src runners directory for bun
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate;
    }
    this.log.fatal(`Could not find "${fileName}" in any of the candidate paths: ${debugStringify(candidates)}${ft}. Returning the first candidate as a best effort.`);
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
    const fileURL = pathToFileURL(path.resolve(relativePath));
    const options: WorkerOptions = {
      workerData: { ...workerData, threadName: name, debug: this.debug, verbose: this.verbose, tracker: this.tracker, logLevel: this.log.logLevel }, // Pass threadName in workerData cause worker_threads don't have it natively in node 20
      name,
      argv: argv ?? process.argv.slice(2), // Pass command line arguments to worker
      env: env ?? process.env, // Inherit environment variables
      execArgv, // execArgv for node like --inspect
      stdout: pipedOutput, // When true, worker.stdout becomes a Readable stream (otherwise null)
      stderr: pipedOutput, // When true, worker.stderr becomes a Readable stream (otherwise null)
    };
    if (this.verbose) this.log.debug(`Creating ESM Worker ${name} with file URL ${fileURL.href} and options ${debugStringify(options)}`);
    return new Worker(fileURL, options);
  }
}
