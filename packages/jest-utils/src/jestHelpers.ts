/**
 * @description This file contains the Jest base helpers.
 * @file src/helpers.test.ts
 * @author Luca Liguori
 * @created 2025-09-03
 * @version 1.0.14
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

import { rmSync } from 'node:fs';
import path from 'node:path';

import type { jest } from '@jest/globals';
// Imports from node-ansi-logger
import { AnsiLogger, LogLevel, TimestampFormat } from 'node-ansi-logger';

export const originalProcessArgv = Object.freeze([...process.argv]);
export const originalProcessEnv = Object.freeze({ ...process.env } as Record<string, string | undefined>);

// Spy on logger methods
export let loggerLogSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.log>;
export let loggerDebugSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.debug>;
export let loggerInfoSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.info>;
export let loggerNoticeSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.notice>;
export let loggerWarnSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.warn>;
export let loggerErrorSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.error>;
export let loggerFatalSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.fatal>;

// Spy on console methods
export let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
export let consoleDebugSpy: jest.SpiedFunction<typeof console.log>;
export let consoleInfoSpy: jest.SpiedFunction<typeof console.log>;
export let consoleWarnSpy: jest.SpiedFunction<typeof console.log>;
export let consoleErrorSpy: jest.SpiedFunction<typeof console.log>;

export let NAME: string;
export let HOMEDIR: string;
export let log: AnsiLogger;

/**
 * Setup the Jest environment:
 * - it will remove any existing home directory
 * - setup the spies for logging
 *
 * @param {string} name The name of the test suite.
 * @param {boolean} debug If true, the logging is not mocked.
 *
 * @example
 * ```typescript
 * import { consoleDebugSpy, consoleErrorSpy, consoleInfoSpy, consoleLogSpy, consoleWarnSpy, loggerLogSpy, setDebug, setupTest } from './jestutils/jestHelpers.js';
 *
 * // Setup the test environment
 * await setupTest(NAME, false);
 * ```
 */
export async function setupTest(name: string, debug: boolean = false): Promise<void> {
  expect(name).toBeDefined();
  expect(typeof name).toBe('string');
  expect(name.length).toBeGreaterThanOrEqual(4);
  NAME = name;
  HOMEDIR = path.join('temp', name);

  // Create the AnsiLogger instance
  log = new AnsiLogger({ logName: 'Jest', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.INFO });

  // Cleanup any existing home directory
  rmSync(HOMEDIR, { recursive: true, force: true });

  const { jest } = await import('@jest/globals');
  loggerDebugSpy = jest.spyOn(AnsiLogger.prototype, 'debug');
  loggerInfoSpy = jest.spyOn(AnsiLogger.prototype, 'info');
  loggerNoticeSpy = jest.spyOn(AnsiLogger.prototype, 'notice');
  loggerWarnSpy = jest.spyOn(AnsiLogger.prototype, 'warn');
  loggerErrorSpy = jest.spyOn(AnsiLogger.prototype, 'error');
  loggerFatalSpy = jest.spyOn(AnsiLogger.prototype, 'fatal');
  if (debug) {
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log');
    consoleLogSpy = jest.spyOn(console, 'log');
    consoleDebugSpy = jest.spyOn(console, 'debug');
    consoleInfoSpy = jest.spyOn(console, 'info');
    consoleWarnSpy = jest.spyOn(console, 'warn');
    consoleErrorSpy = jest.spyOn(console, 'error');
  } else {
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  }
}

/**
 * Set or unset the debug mode.
 *
 * @param {boolean} debug If true, the logging is not mocked.
 * @returns {Promise<void>} A promise that resolves when the debug mode is set.
 *
 * @example
 * ```typescript
 * // Set the debug mode in test environment
 * await setDebug(true);
 * ```
 *
 * ```typescript
 * // Reset the debug mode in test environment
 * await setDebug(false);
 * ```
 */
export async function setDebug(debug: boolean): Promise<void> {
  const { jest } = await import('@jest/globals');
  if (debug) {
    loggerLogSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleDebugSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log');
    consoleLogSpy = jest.spyOn(console, 'log');
    consoleDebugSpy = jest.spyOn(console, 'debug');
    consoleInfoSpy = jest.spyOn(console, 'info');
    consoleWarnSpy = jest.spyOn(console, 'warn');
    consoleErrorSpy = jest.spyOn(console, 'error');
  } else {
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  }
}
