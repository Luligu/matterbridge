/**
 * @description This file contains the Vitest base helpers.
 * @file src/helpers.test.ts
 * @author Luca Liguori
 * @created 2025-12-31
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

import { rmSync } from 'node:fs';
import path from 'node:path';

import type { MockInstance } from 'vitest';
// Imports from node-ansi-logger
import { AnsiLogger, LogLevel, TimestampFormat } from 'node-ansi-logger';

export const originalProcessArgv = Object.freeze([...process.argv]);
export const originalProcessEnv = Object.freeze({ ...process.env } as Record<string, string | undefined>);

// Spy on logger methods
export let loggerLogSpy: MockInstance<typeof AnsiLogger.prototype.log>;
export let loggerDebugSpy: MockInstance<typeof AnsiLogger.prototype.debug>;
export let loggerInfoSpy: MockInstance<typeof AnsiLogger.prototype.info>;
export let loggerNoticeSpy: MockInstance<typeof AnsiLogger.prototype.notice>;
export let loggerWarnSpy: MockInstance<typeof AnsiLogger.prototype.warn>;
export let loggerErrorSpy: MockInstance<typeof AnsiLogger.prototype.error>;
export let loggerFatalSpy: MockInstance<typeof AnsiLogger.prototype.fatal>;

// Spy on console methods
export let consoleLogSpy: MockInstance<typeof console.log>;
export let consoleDebugSpy: MockInstance<typeof console.debug>;
export let consoleInfoSpy: MockInstance<typeof console.info>;
export let consoleWarnSpy: MockInstance<typeof console.warn>;
export let consoleErrorSpy: MockInstance<typeof console.error>;

export let NAME: string;
export let HOMEDIR: string;
export let log: AnsiLogger;

/**
 * Setup the Vitest environment:
 * - it will remove any existing home directory
 * - setup the spies for logging
 *
 * @param {string} name The name of the test suite.
 * @param {boolean} debug If true, the logging is not mocked.
 */
export async function setupTest(name: string, debug: boolean = false): Promise<void> {
  expect(name).toBeDefined();
  expect(typeof name).toBe('string');
  expect(name.length).toBeGreaterThanOrEqual(4);
  NAME = name;
  HOMEDIR = path.join('temp', name);

  // Create the AnsiLogger instance
  log = new AnsiLogger({ logName: 'Vitest', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.INFO });

  // Cleanup any existing home directory
  rmSync(HOMEDIR, { recursive: true, force: true });

  const { vi } = await import('vitest');
  loggerDebugSpy = vi.spyOn(AnsiLogger.prototype, 'debug');
  loggerInfoSpy = vi.spyOn(AnsiLogger.prototype, 'info');
  loggerNoticeSpy = vi.spyOn(AnsiLogger.prototype, 'notice');
  loggerWarnSpy = vi.spyOn(AnsiLogger.prototype, 'warn');
  loggerErrorSpy = vi.spyOn(AnsiLogger.prototype, 'error');
  loggerFatalSpy = vi.spyOn(AnsiLogger.prototype, 'fatal');

  if (debug) {
    loggerLogSpy = vi.spyOn(AnsiLogger.prototype, 'log');
    consoleLogSpy = vi.spyOn(console, 'log');
    consoleDebugSpy = vi.spyOn(console, 'debug');
    consoleInfoSpy = vi.spyOn(console, 'info');
    consoleWarnSpy = vi.spyOn(console, 'warn');
    consoleErrorSpy = vi.spyOn(console, 'error');
  } else {
    loggerLogSpy = vi.spyOn(AnsiLogger.prototype, 'log').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  }
}

/**
 * Set or unset the debug mode.
 *
 * @param {boolean} debug If true, the logging is not mocked.
 * @returns {Promise<void>} A promise that resolves when the debug mode is set.
 */
export async function setDebug(debug: boolean): Promise<void> {
  const { vi } = await import('vitest');
  if (debug) {
    loggerLogSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleDebugSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();

    loggerLogSpy = vi.spyOn(AnsiLogger.prototype, 'log');
    consoleLogSpy = vi.spyOn(console, 'log');
    consoleDebugSpy = vi.spyOn(console, 'debug');
    consoleInfoSpy = vi.spyOn(console, 'info');
    consoleWarnSpy = vi.spyOn(console, 'warn');
    consoleErrorSpy = vi.spyOn(console, 'error');
  } else {
    loggerLogSpy = vi.spyOn(AnsiLogger.prototype, 'log').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  }
}
