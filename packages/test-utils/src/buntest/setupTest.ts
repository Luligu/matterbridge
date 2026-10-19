/**
 * @file packages/test-utils/src/buntest/setupTest.ts
 * @description This file contains the Bun Setup helpers.
 * @author Luca Liguori
 * @created 2026-06-26
 * @version 1.1.0
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

import type { Mock } from 'bun:test';
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

// Names are joined into HOMEDIR and that directory is removed, so anything that could escape
// .cache/bun is rejected: path.join('.cache', 'bun', '../../src') collapses to 'src'.
const VALID_NAME = /^[A-Za-z0-9_-]+$/;

// True once installSpies() has installed the spies.
let initialized = false;

// Suite names already set up. Test files share one module registry, so 'called once' can only be
// enforced per suite name: one setupTest() call per test file, not one per process.
const configured = new Set<string>();

/**
 * The spies currently installed, in a shape that only exposes what the restore loop needs.
 *
 * @returns {{ mockRestore: () => void }[]} The installed logger and console spies.
 */
function installedSpies(): { mockRestore: () => void }[] {
  return [
    loggerLogSpy,
    loggerDebugSpy,
    loggerInfoSpy,
    loggerNoticeSpy,
    loggerWarnSpy,
    loggerErrorSpy,
    loggerFatalSpy,
    consoleLogSpy,
    consoleDebugSpy,
    consoleInfoSpy,
    consoleWarnSpy,
    consoleErrorSpy,
  ];
}

/**
 * Install the logger and console spies, replacing any that are already installed.
 *
 * `spyOn` returns the mock already attached to a target instead of wrapping it again, so every
 * previous spy is restored first. Without that, a mocked implementation would survive into debug
 * mode and the output would stay silenced.
 *
 * @param {boolean} debug If true, the spies pass the calls through to the original implementation.
 * @returns {Promise<void>} A promise that resolves once the spies are installed.
 */
async function installSpies(debug: boolean): Promise<void> {
  // Imported here, not at module scope, so that importing this file does not pull in bun:test.
  const { spyOn } = await import('bun:test');

  if (initialized) {
    for (const spy of installedSpies()) {
      spy.mockRestore();
    }
  }

  loggerLogSpy = spyOn(AnsiLogger.prototype, 'log');
  loggerDebugSpy = spyOn(AnsiLogger.prototype, 'debug');
  loggerInfoSpy = spyOn(AnsiLogger.prototype, 'info');
  loggerNoticeSpy = spyOn(AnsiLogger.prototype, 'notice');
  loggerWarnSpy = spyOn(AnsiLogger.prototype, 'warn');
  loggerErrorSpy = spyOn(AnsiLogger.prototype, 'error');
  loggerFatalSpy = spyOn(AnsiLogger.prototype, 'fatal');
  consoleLogSpy = spyOn(console, 'log');
  consoleDebugSpy = spyOn(console, 'debug');
  consoleInfoSpy = spyOn(console, 'info');
  consoleWarnSpy = spyOn(console, 'warn');
  consoleErrorSpy = spyOn(console, 'error');

  if (!debug) {
    loggerLogSpy.mockImplementation(noop);
    consoleLogSpy.mockImplementation(noop);
    consoleDebugSpy.mockImplementation(noop);
    consoleInfoSpy.mockImplementation(noop);
    consoleWarnSpy.mockImplementation(noop);
    consoleErrorSpy.mockImplementation(noop);
  }

  initialized = true;
}

/**
 * Setup the Bun environment:
 * - it will remove any existing home directory
 * - setup the spies for logging
 * - process.argv will be set to ['bun', name, ...argv]
 * - the provided environment variables will be set on process.env
 *
 * @param {string} name The name of the test suite. Letters, digits, underscores and dashes only.
 * @param {boolean} debug If true, the logging is not mocked.
 * @param {string[]} argv Additional process.argv arguments to set after the 'bun' and name entries.
 * @param {Record<string, string>} env Environment variables to set on process.env.
 *
 * @throws {Error} When the name is shorter than four characters or contains characters that could escape the home directory.
 *
 * @remarks Logs an error and returns without doing anything when the same name is set up more than
 * once. Call it once per test file, or call resetTest() first.
 *
 * Use `mock.restore()` only in `afterAll`, together with resetTest(). In `afterEach`, a
 * `beforeEach` or a test body it also restores the logger and console spies installed here, so the
 * exported spies stop recording for the rest of the file. To clean up after each test, restore only
 * the spies that test created, for example by keeping them in a list and calling `mockRestore()` on
 * each one in `afterEach`.
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
  if (typeof name !== 'string' || name.length < 4) {
    throw new Error(`setupTest: invalid name '${name}'. Use at least four characters.`);
  }
  if (!VALID_NAME.test(name)) {
    throw new Error(`setupTest: invalid name '${name}'. Use letters, digits, underscores and dashes only.`);
  }
  if (configured.has(name)) {
    // Written to stderr, not console.error, so the message survives a mocked console
    process.stderr.write(`setupTest: '${name}' has already been set up. Call setupTest() once per test file.\n`);
    return;
  }
  configured.add(name);
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

  await installSpies(debug);
}

/**
 * Set or unset the debug mode.
 *
 * Logs an error and does nothing when called before setupTest(), since there are no spies to switch over.
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
  if (!initialized) {
    // Written to stderr, not console.error, so the message survives a mocked console
    process.stderr.write('setDebug() called before setupTest(): no spies to switch, ignoring.\n');
    return;
  }
  await installSpies(debug);
}

/**
 * Undo what setupTest() did:
 * - restores AnsiLogger.prototype and the console methods
 * - restores process.argv and process.env to the values captured when this module was loaded
 * - lets setupTest() run again for the same suite name
 *
 * Does nothing harmful when setupTest() has not run. It does not remove the home directory, so
 * anything written there is still available afterwards.
 *
 * @returns {void}
 *
 * @example
 * ```typescript
 * afterAll(() => {
 *   // Reset the test environment before the next test.
 *   resetTest();
 * });
 * ```
 */
export function resetTest(): void {
  if (initialized) {
    for (const spy of installedSpies()) {
      spy.mockRestore();
    }
    initialized = false;
  }
  if (NAME) configured.delete(NAME);

  process.argv = [...originalProcessArgv];
  for (const key of Object.keys(process.env)) {
    if (!(key in originalProcessEnv)) Reflect.deleteProperty(process.env, key);
  }
  for (const [key, value] of Object.entries(originalProcessEnv)) {
    if (value !== undefined) process.env[key] = value;
  }
}
