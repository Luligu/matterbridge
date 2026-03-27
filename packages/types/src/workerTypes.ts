/**
 * This file contains the worker types.
 *
 * @file workerTypes.ts
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

import type { LogLevel } from 'node-ansi-logger';

/** Thread names used in the thread system */
export type ThreadNames = 'SystemCheck' | 'GlobalPrefix' | 'CheckUpdates' | 'SpawnCommand' | 'ArchiveCommand' | 'DockerVersion';

/** Base worker data for all workers */
export type BaseWorkerData = { threadName: ThreadNames; logLevel: LogLevel; debug: boolean; verbose: boolean; tracker: boolean };

/** Worker data for spawn command worker */
export type SpawnWorkerData = {
  threadName: ThreadNames;
  logLevel?: LogLevel;
  debug?: boolean;
  verbose?: boolean;
  tracker?: boolean;
  command: string;
  args: string[];
  packageCommand: 'install' | 'uninstall';
  packageName: string;
};

/** Worker data for archive command worker */
export type ArchiveWorkerData = {
  threadName: ThreadNames;
  logLevel?: LogLevel;
  debug?: boolean;
  verbose?: boolean;
  tracker?: boolean;
  command: 'zip' | 'verify' | 'unzip';
  archivePath: string;
  sourcePaths: string[];
  destinationPath: string;
};

/** Worker data for all workers */
export type WorkerData = BaseWorkerData | SpawnWorkerData | ArchiveWorkerData;

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
    typeof data === 'object' &&
    data !== null &&
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
    typeof data === 'object' &&
    data !== null &&
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

/** Control messages sent through parentPort manager <-> workers */
export type ParentPortMessage =
  | { type: 'init'; threadName: ThreadNames; threadId: number; memoryUsage: NodeJS.MemoryUsage; success: boolean }
  | { type: 'ping'; threadName: ThreadNames; threadId: number }
  | { type: 'pong'; threadName: ThreadNames; threadId: number }
  | { type: 'log'; threadName: ThreadNames; threadId: number; logName: string | undefined; logLevel: LogLevel; message: string }
  | { type: 'exit'; threadName: ThreadNames; threadId: number; memoryUsage: NodeJS.MemoryUsage; success: boolean };
