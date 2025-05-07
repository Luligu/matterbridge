/**
 * This file contains the wait, waiter and withTimeout functions.
 *
 * @file wait.ts
 * @author Luca Liguori
 * @date 2025-02-16
 * @version 1.0.0
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
 * limitations under the License. *
 */

// AnsiLogger module
import { AnsiLogger, LogLevel, TimestampFormat } from '../logger/export.js';

export const log = new AnsiLogger({ logName: 'MatterbridgeUtils', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.INFO });

/**
 * Asynchronous waiter function that resolves when the provided condition is met or rejects on timeout.
 * @param {string} name - The name of the waiter.
 * @param {() => boolean} check - A function that checks the condition. Should return a boolean.
 * @param {boolean} [exitWithReject=false] - Optional. If true, the promise will be rejected on timeout. Default is false.
 * @param {number} [resolveTimeout=5000] - Optional. The timeout duration in milliseconds. Default is 5000ms.
 * @param {number} [resolveInterval=500] - Optional. The interval duration in milliseconds between condition checks. Default is 500ms.
 * @param {boolean} [debug=false] - Optional. If true, debug messages will be logged to the console. Default is false.
 * @returns {Promise<boolean>} A promise that resolves to true when the condition is met, or false if the timeout occurs.
 */
export async function waiter(name: string, check: () => boolean, exitWithReject = false, resolveTimeout = 5000, resolveInterval = 500, debug = false): Promise<boolean> {
  if (check()) return true;
  log.logLevel = LogLevel.DEBUG;
  log.logName = 'Waiter';
  if (debug) log.debug(`Waiter "${name}" started...`);
  return new Promise<boolean>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      if (debug) log.debug(`Waiter "${name}" finished for timeout...`);
      clearTimeout(timeoutId);
      clearInterval(intervalId);
      if (exitWithReject) reject(new Error(`Waiter "${name}" finished due to timeout`));
      else resolve(false);
    }, resolveTimeout);

    const intervalId = setInterval(() => {
      if (check()) {
        if (debug) log.debug(`Waiter "${name}" finished for true condition...`);
        clearTimeout(timeoutId);
        clearInterval(intervalId);
        resolve(true);
      }
    }, resolveInterval);
  });
}

/**
 * Asynchronously waits for a specified amount of time.
 * @param {number} timeout - The duration to wait in milliseconds. Default is 1000ms.
 * @param {string} name - The name of the wait operation. Default is undefined.
 * @param {boolean} debug - Whether to enable debug logging. Default is false.
 * @returns {Promise<void>} A Promise that resolves after the specified timeout.
 */
export async function wait(timeout = 1000, name?: string, debug = false): Promise<void> {
  log.logLevel = LogLevel.DEBUG;
  log.logName = 'Wait';
  if (debug) log.debug(`Wait "${name}" started...`);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      if (debug) log.debug(`Wait "${name}" finished...`);
      clearTimeout(timeoutId);
      resolve();
    }, timeout);
  });
}

/**
 * Wraps a promise with a timeout. If the promise does not resolve or reject within the specified time, it will be rejected.
 * @param {Promise<T>} promise - The promise to wrap.
 * @param {number} ms - The timeout duration in milliseconds.
 * @returns {Promise<T>} A new promise that resolves or rejects based on the original promise and the timeout.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Operation timed out')), ms);
    promise
      .then((result) => {
        clearTimeout(timer); // Prevent memory leak
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer); // Ensure timeout does not fire if promise rejects first
        reject(error);
      });
  });
}
