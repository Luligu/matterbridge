/* eslint-disable no-console */
import { jest } from '@jest/globals';
import { LogLevel } from 'node-ansi-logger';

import { consoleDebugSpy, consoleErrorSpy, consoleInfoSpy, consoleLogSpy, consoleWarnSpy, log, loggerLogSpy, setDebug, setupTest } from './jestHelpers.js';

process.argv.push('--debug');

describe('Jest Helpers', () => {
  const NAME = 'JestHelpers';

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  test('should setup test', async () => {
    await setupTest(NAME);
    await setupTest(NAME, true);
    await setupTest(NAME, false);
    log.log(LogLevel.INFO, 'Test setup completed');
    console.log('Test setup completed');
    console.debug('Test setup completed');
    console.info('Test setup completed');
    console.warn('Test setup completed');
    console.error('Test setup completed');
    expect(loggerLogSpy).toBeDefined();
    expect(consoleLogSpy).toBeDefined();
    expect(consoleDebugSpy).toBeDefined();
    expect(consoleInfoSpy).toBeDefined();
    expect(consoleWarnSpy).toBeDefined();
    expect(consoleErrorSpy).toBeDefined();
  });

  test('should set debug mode', async () => {
    await setDebug(true);
    await setDebug(false);
    log.log(LogLevel.INFO, 'Test setup completed');
    console.log('Test setup completed');
    console.debug('Test setup completed');
    console.info('Test setup completed');
    console.warn('Test setup completed');
    console.error('Test setup completed');
    expect(loggerLogSpy).toBeDefined();
    expect(consoleLogSpy).toBeDefined();
    expect(consoleDebugSpy).toBeDefined();
    expect(consoleInfoSpy).toBeDefined();
    expect(consoleWarnSpy).toBeDefined();
    expect(consoleErrorSpy).toBeDefined();
  });
});
