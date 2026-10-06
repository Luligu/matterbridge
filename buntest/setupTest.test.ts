/**
 * @file buntest/setupTest.test.ts
 * @description This file contains the tests for the bunSetupTest helpers.
 * @author Luca Liguori
 */

// Verifies the Bun setup helpers from @matterbridge/test-utils actually do their job:
//   - they set NAME / HOMEDIR / process.argv and create the home directory,
//   - they apply extra argv and environment variables,
//   - they install working logger/console spies,
//   - setDebug() restores and re-installs those spies,
//   - resetTest() undoes setupTest() and lets the same name be set up again.
// Run from the repo root with:  bun test  (bunfig.toml scopes discovery to buntest/).

import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { existsSync } from 'node:fs';
import path from 'node:path';

import {
  consoleDebugSpy,
  consoleErrorSpy,
  consoleInfoSpy,
  consoleLogSpy,
  consoleWarnSpy,
  HOMEDIR,
  loggerDebugSpy,
  loggerErrorSpy,
  loggerFatalSpy,
  loggerInfoSpy,
  loggerLogSpy,
  loggerNoticeSpy,
  loggerWarnSpy,
  log,
  NAME,
  originalProcessArgv,
  originalProcessEnv,
  resetTest,
  setDebug,
  setupTest,
} from '@matterbridge/test-utils/buntest';
import { AnsiLogger } from 'node-ansi-logger';

describe('bunSetupTest', () => {
  afterEach(() => {
    // Restore the spies, process.argv and process.env, and release the suite name for the next test.
    resetTest();
  });

  test('freezes the original process snapshots', () => {
    expect(Object.isFrozen(originalProcessArgv)).toBe(true);
    expect(Object.isFrozen(originalProcessEnv)).toBe(true);
  });

  test('sets NAME, HOMEDIR and process.argv and creates the home directory', async () => {
    await setupTest('SuiteOne');

    expect(NAME).toBe('SuiteOne');
    expect(HOMEDIR).toBe(path.join('.cache', 'bun', 'SuiteOne'));
    expect(process.argv).toEqual(['bun', 'SuiteOne']);
    expect(existsSync(HOMEDIR)).toBe(true);
    expect(log).toBeInstanceOf(AnsiLogger);
  });

  test('applies extra argv and environment variables', async () => {
    await setupTest('SuiteTwo', false, ['--verbose'], { MB_BUNTEST_ENV: 'enabled' });

    expect(process.argv).toEqual(['bun', 'SuiteTwo', '--verbose']);
    expect(process.env.MB_BUNTEST_ENV).toBe('enabled');
  });

  test('installs working logger and console spies', async () => {
    await setupTest('SuiteThree');

    for (const spy of [
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
    ]) {
      expect(spy).toBeDefined();
    }

    log.info('hello from the suite');
    expect(loggerInfoSpy).toHaveBeenCalled();

    // oxlint-disable-next-line eslint/no-console
    console.log('captured but suppressed');
    expect(consoleLogSpy).toHaveBeenCalledWith('captured but suppressed');
  });

  test('installs passthrough spies in debug mode', async () => {
    await setupTest('SuiteDebug', true);

    for (const spy of [loggerLogSpy, consoleLogSpy, consoleDebugSpy, consoleInfoSpy, consoleWarnSpy, consoleErrorSpy]) {
      expect(spy).toBeDefined();
    }
  });

  test('setupTest in debug mode drops the noop installed by a previous setupTest', async () => {
    // afterEach restores every spy, so these are the original implementations
    const originalLoggerLog = AnsiLogger.prototype.log;
    // oxlint-disable-next-line eslint/no-console
    const originalConsoleLog = console.log;

    await setupTest('SuiteMocked', false);
    expect(consoleLogSpy.getMockImplementation()).not.toBe(originalConsoleLog);

    await setupTest('SuitePassthrough', true);
    expect(loggerLogSpy.getMockImplementation()).toBe(originalLoggerLog);
    expect(consoleLogSpy.getMockImplementation()).toBe(originalConsoleLog);
  });

  test('setDebug toggles the spies without throwing', async () => {
    await setupTest('SuiteFour', false);

    await setDebug(true);
    expect(loggerLogSpy).toBeDefined();
    expect(consoleLogSpy).toBeDefined();

    await setDebug(false);
    // oxlint-disable-next-line eslint/no-console
    console.log('suppressed again');
    expect(consoleLogSpy).toHaveBeenCalledWith('suppressed again');
  });

  test('ignores a second setupTest with the same name', async () => {
    const stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      await setupTest('SuiteTwice');
      await setupTest('SuiteTwice', false, ['--ignored']);
      expect(process.argv).toEqual(['bun', 'SuiteTwice']);
      expect(stderrSpy).toHaveBeenCalledWith("setupTest: 'SuiteTwice' has already been set up. Call setupTest() once per test file.\n");
    } finally {
      stderrSpy.mockRestore();
    }
  });

  test('setDebug before setupTest does nothing', async () => {
    const stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      await setDebug(true);
      expect(stderrSpy).toHaveBeenCalledWith('setDebug() called before setupTest(): no spies to switch, ignoring.\n');
    } finally {
      stderrSpy.mockRestore();
    }
  });

  test('resetTest restores the process state and allows the same name again', async () => {
    // oxlint-disable-next-line eslint/no-console
    const originalConsoleLog = console.log;

    await setupTest('SuiteReset', false, ['--verbose'], { MB_BUNTEST_ENV: 'enabled' });
    resetTest();

    expect(process.argv).toEqual([...originalProcessArgv]);
    expect(process.env.MB_BUNTEST_ENV).toBeUndefined();
    // oxlint-disable-next-line eslint/no-console
    expect(console.log).toBe(originalConsoleLog);

    await setupTest('SuiteReset', false, ['--again']);
    expect(process.argv).toEqual(['bun', 'SuiteReset', '--again']);
  });

  test('rejects a name shorter than four characters', async () => {
    let rejected = false;
    await setupTest('abc').catch(() => {
      rejected = true;
    });
    expect(rejected).toBe(true);
  });

  test('rejects a name that could escape the home directory', async () => {
    // '../BunSetupEscape' resolves to .cache/BunSetupEscape, so even a stale build cannot touch real files
    let message = '';
    await setupTest('../BunSetupEscape').catch((error: unknown) => {
      message = error instanceof Error ? error.message : String(error);
    });
    expect(message).toContain('Use letters, digits, underscores and dashes only.');
  });
});
