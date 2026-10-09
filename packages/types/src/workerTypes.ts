/**
 * @file packages/types/src/workerTypes.ts
 * @description This file contains the worker types.
 * @author Luca Liguori
 * @created 2025-11-25
 * @version 1.2.0
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

import type { LogLevel } from 'node-ansi-logger';

import type { SharedMatterbridge } from './matterbridgeTypes.js';

/** Thread names used in the thread system */
export type ThreadNames = 'SystemCheck' | 'GlobalPrefix' | 'CheckUpdates' | 'SpawnCommand' | 'ArchiveCommand' | 'DockerVersion' | 'Backend' | 'RootNode' | 'Tracker';

/** Thread type used in the thread system */
export type ThreadType = 'worker' | 'thread';

/** Base worker data for all workers, with a required execution type */
export interface BaseWorkerData {
  threadName: ThreadNames;
  type: ThreadType;
  logLevel: LogLevel;
  debug: boolean;
  verbose: boolean;
  tracker: boolean;
}

/** Worker data for spawn command worker */
export interface SpawnWorkerData {
  threadName: ThreadNames;
  type?: ThreadType;
  logLevel?: LogLevel;
  debug?: boolean;
  verbose?: boolean;
  tracker?: boolean;
  command: string;
  args: string[];
  packageCommand: 'install' | 'uninstall';
  packageName: string;
}

/** Worker data for archive command worker */
export interface ArchiveWorkerData {
  threadName: ThreadNames;
  type?: ThreadType;
  logLevel?: LogLevel;
  debug?: boolean;
  verbose?: boolean;
  tracker?: boolean;
  command: 'zip' | 'verify' | 'unzip';
  archivePath: string;
  sourcePaths: string[];
  destinationPath: string;
}

/** Worker data for root node worker. Without pluginName the root node runs in bridge mode with all the plugins */
export interface RootNodeWorkerData {
  threadName: ThreadNames;
  type?: ThreadType;
  logLevel?: LogLevel;
  debug?: boolean;
  verbose?: boolean;
  tracker?: boolean;
  sharedMatterbridge: SharedMatterbridge;
  pluginName?: string;
}

/** Worker data for all workers */
export type WorkerData = BaseWorkerData | SpawnWorkerData | ArchiveWorkerData | RootNodeWorkerData;

/**
 *  Type guard to check if the workerData is valid.
 *
 * @param {unknown} data - The worker data to check.
 * @returns {data is WorkerData} True if the data is valid worker data, false otherwise.
 */
export function isWorkerData(data: unknown): data is WorkerData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    (data.type === 'worker' || data.type === 'thread') &&
    'threadName' in data &&
    typeof data.threadName === 'string' &&
    'logLevel' in data &&
    typeof data.logLevel === 'string' &&
    'debug' in data &&
    typeof data.debug === 'boolean' &&
    'verbose' in data &&
    typeof data.verbose === 'boolean' &&
    'tracker' in data &&
    typeof data.tracker === 'boolean'
  );
}

/**
 * Type guard to check if the workerData is for the spawn command worker.
 *
 * @param {WorkerData} data - The worker data to check.
 * @returns {data is SpawnWorkerData} True if the data is for the spawn command worker, false otherwise.
 */
export function isSpawnWorkerData(data: unknown): data is SpawnWorkerData {
  return (
    isWorkerData(data) &&
    'command' in data &&
    typeof data.command === 'string' &&
    'args' in data &&
    Array.isArray(data.args) &&
    'packageCommand' in data &&
    (data.packageCommand === 'install' || data.packageCommand === 'uninstall') &&
    'packageName' in data &&
    typeof data.packageName === 'string'
  );
}

/**
 * Type guard to check if the workerData is for the archive command worker.
 *
 * @param {WorkerData} data - The worker data to check.
 * @returns {data is ArchiveWorkerData} True if the data is for the archive command worker, false otherwise.
 */
export function isArchiveWorkerData(data: unknown): data is ArchiveWorkerData {
  return (
    isWorkerData(data) &&
    'command' in data &&
    typeof data.command === 'string' &&
    'archivePath' in data &&
    typeof data.archivePath === 'string' &&
    'sourcePaths' in data &&
    Array.isArray(data.sourcePaths) &&
    'destinationPath' in data &&
    typeof data.destinationPath === 'string'
  );
}

/**
 * Type guard to check if the workerData is for the root node worker.
 *
 * @param {WorkerData} data - The worker data to check.
 * @returns {data is RootNodeWorkerData} True if the data is for the root node worker, false otherwise.
 */
export function isRootNodeWorkerData(data: unknown): data is RootNodeWorkerData {
  return (
    isWorkerData(data) &&
    'sharedMatterbridge' in data &&
    typeof data.sharedMatterbridge === 'object' &&
    data.sharedMatterbridge !== null &&
    (!('pluginName' in data) || data.pluginName === undefined || typeof data.pluginName === 'string')
  );
}

/** Control messages sent through parentPort manager <-> workers */
export type ParentPortMessage =
  // Worker -> manager: the worker started (sent by ThreadsWrapper when initialized)
  | { type: 'init'; threadName: ThreadNames; threadId: number; memoryUsage: NodeJS.MemoryUsage; success: boolean }
  // Manager -> worker: liveness check (sent by ThreadsManager on its interval)
  | { type: 'ping'; threadName: ThreadNames; threadId: number }
  // Worker -> manager: reply to a ping
  | { type: 'pong'; threadName: ThreadNames; threadId: number }
  // Worker -> manager: log message to be logged by the manager in the main thread
  | { type: 'log'; threadName: ThreadNames; threadId: number; logName: string | undefined; logLevel: LogLevel; message: string }
  // Worker -> manager: the worker finished, with its success result
  | { type: 'exit'; threadName: ThreadNames; threadId: number; memoryUsage: NodeJS.MemoryUsage; success: boolean }
  // Manager -> worker: request the worker to start up
  | { type: 'startup'; threadName: ThreadNames; threadId: number }
  // Manager -> worker: request the worker to shut down
  | { type: 'shutdown'; threadName: ThreadNames; threadId: number };
