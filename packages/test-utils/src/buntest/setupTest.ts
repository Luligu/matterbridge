/**
 * @description This file contains the Bun Setup helpers.
 * @file buntest/bunSetupTest.ts
 * @author Luca Liguori
 * @created 2026-06-26
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

import { expect, type Mock } from 'bun:test';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

import { AnsiLogger, LogLevel, TimestampFormat } from 'node-ansi-logger';

// Freeze the original process arguments and environment variables to allow resetting them in tests
export const originalProcessArgv = Object.freeze([...process.argv]);
export const originalProcessEnv = Object.freeze({ ...process.env } as Record<string, string | undefined>);

// Spy on logger methods
export let loggerLogSpy: Mock<typeof AnsiLogger.prototype.log>;
export let loggerDebugSpy: Mock<typeof AnsiLogger.prototype.debug>;
export let loggerInfoSpy: Mock<typeof AnsiLogger.prototype.info>;
export let loggerNoticeSpy: Mock<typeof AnsiLogger.prototype.notice>;
export let loggerWarnSpy: Mock<typeof AnsiLogger.prototype.warn>;
export let loggerErrorSpy: Mock<typeof AnsiLogger.prototype.error>;
export let loggerFatalSpy: Mock<typeof AnsiLogger.prototype.fatal>;

// Spy on console methods
export let consoleLogSpy: Mock<typeof console.log>;
export let consoleDebugSpy: Mock<typeof console.debug>;
export let consoleInfoSpy: Mock<typeof console.info>;
export let consoleWarnSpy: Mock<typeof console.warn>;
export let consoleErrorSpy: Mock<typeof console.error>;

export let NAME: string;
export let HOMEDIR: string;

export let log: AnsiLogger;

const noop = (): void => undefined;

/**
 * Setup the Bun environment:
 * - it will remove any existing home directory
 * - setup the spies for logging
 * - process.argv will be set to ['bun', name, ...argv]
 * - the provided environment variables will be set on process.env
 *
 * @param {string} name The name of the test suite.
 * @param {boolean} debug If true, the logging is not mocked.
 * @param {string[]} argv Additional process.argv arguments to set after the 'bun' and name entries.
 * @param {Record<string, string>} env Environment variables to set on process.env.
 *
 * @example
 * ```typescript
 * import { consoleDebugSpy, consoleErrorSpy, consoleInfoSpy, consoleLogSpy, consoleWarnSpy, loggerLogSpy, setDebug, setupTest } from './bunSetupTest.ts';
 *
 * // Setup the test environment
 * await setupTest(NAME, false);
 *
 * // Setup the test environment with extra argv and environment variables
 * await setupTest(NAME, false, ['--verbose'], { MATTERBRIDGE_REMOVE_ALL_ENDPOINT_TIMEOUT_MS: '10' });
 * ```
 */
export async function setupTest(name: string, debug: boolean = false, argv: string[] = [], env: Record<string, string> = {}): Promise<void> {
  expect(name).toBeDefined();
  expect(typeof name).toBe('string');
  expect(name.length).toBeGreaterThanOrEqual(4);
  NAME = name;
  HOMEDIR = path.join('.cache', 'bun', name);
  process.argv = ['bun', name, ...argv];

  // Set the provided environment variables
  for (const [key, value] of Object.entries(env)) {
    process.env[key] = value;
  }

  // Create the exported log
  log = new AnsiLogger({ logName: name, logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });

  // Cleanup any existing home directory
  rmSync(HOMEDIR, { recursive: true, force: true });
  mkdirSync(HOMEDIR, { recursive: true });

  const { spyOn } = await import('bun:test');
  loggerDebugSpy = spyOn(AnsiLogger.prototype, 'debug');
  loggerInfoSpy = spyOn(AnsiLogger.prototype, 'info');
  loggerNoticeSpy = spyOn(AnsiLogger.prototype, 'notice');
  loggerWarnSpy = spyOn(AnsiLogger.prototype, 'warn');
  loggerErrorSpy = spyOn(AnsiLogger.prototype, 'error');
  loggerFatalSpy = spyOn(AnsiLogger.prototype, 'fatal');
  if (debug) {
    loggerLogSpy = spyOn(AnsiLogger.prototype, 'log');
    consoleLogSpy = spyOn(console, 'log');
    consoleDebugSpy = spyOn(console, 'debug');
    consoleInfoSpy = spyOn(console, 'info');
    consoleWarnSpy = spyOn(console, 'warn');
    consoleErrorSpy = spyOn(console, 'error');
  } else {
    loggerLogSpy = spyOn(AnsiLogger.prototype, 'log').mockImplementation(noop);
    consoleLogSpy = spyOn(console, 'log').mockImplementation(noop);
    consoleDebugSpy = spyOn(console, 'debug').mockImplementation(noop);
    consoleInfoSpy = spyOn(console, 'info').mockImplementation(noop);
    consoleWarnSpy = spyOn(console, 'warn').mockImplementation(noop);
    consoleErrorSpy = spyOn(console, 'error').mockImplementation(noop);
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
  const { spyOn } = await import('bun:test');
  if (debug) {
    loggerLogSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleDebugSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    loggerLogSpy = spyOn(AnsiLogger.prototype, 'log');
    consoleLogSpy = spyOn(console, 'log');
    consoleDebugSpy = spyOn(console, 'debug');
    consoleInfoSpy = spyOn(console, 'info');
    consoleWarnSpy = spyOn(console, 'warn');
    consoleErrorSpy = spyOn(console, 'error');
  } else {
    loggerLogSpy = spyOn(AnsiLogger.prototype, 'log').mockImplementation(noop);
    consoleLogSpy = spyOn(console, 'log').mockImplementation(noop);
    consoleDebugSpy = spyOn(console, 'debug').mockImplementation(noop);
    consoleInfoSpy = spyOn(console, 'info').mockImplementation(noop);
    consoleWarnSpy = spyOn(console, 'warn').mockImplementation(noop);
    consoleErrorSpy = spyOn(console, 'error').mockImplementation(noop);
  }
}
