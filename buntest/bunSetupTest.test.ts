// buntest/bunSetupTest.test.ts

// Verifies the Bun setup helpers in ./bunSetupTest.ts actually do their job:
//   - they set NAME / HOMEDIR / process.argv and create the home directory,
//   - they apply extra argv and environment variables,
//   - they install working logger/console spies,
//   - setDebug() restores and re-installs those spies.
// Run from the repo root with:  bun test  (bunfig.toml scopes discovery to buntest/).

import { afterEach, describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { AnsiLogger } from 'node-ansi-logger';

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
  setDebug,
  setupTest,
} from './bunSetupTest.js';

describe('bunSetupTest', () => {
  afterEach(() => {
    // Restore every installed spy so suppressed console output returns for the reporter.
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
      spy?.mockRestore();
    }
    // Reset the process state mutated by setupTest.
    process.argv = [...originalProcessArgv];
    delete process.env.MB_BUNTEST_ENV;
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

  test('rejects a name shorter than four characters', async () => {
    let rejected = false;
    await setupTest('abc').catch(() => {
      rejected = true;
    });
    expect(rejected).toBe(true);
  });
});
