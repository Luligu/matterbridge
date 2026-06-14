/* eslint-disable no-console */
import { LogLevel } from 'node-ansi-logger';
import { vi } from 'vitest';

import { consoleDebugSpy, consoleErrorSpy, consoleInfoSpy, consoleLogSpy, consoleWarnSpy, log, loggerLogSpy, setDebug, setupTest } from '../src/vitestSetupTest.js';

process.argv.push('--debug');

describe('Vitest Helpers', () => {
  const NAME = 'VitestHelpers';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  test('should setup test', async () => {
    await setupTest(NAME);
    await setupTest(NAME, true);
    await setupTest(NAME, false);
    log.log(LogLevel.INFO, 'Test setup completed');

    // Setup with extra argv and environment variables
    await setupTest(NAME, false, ['--verbose'], { VITEST_SETUP_TEST_ENV: 'enabled' });
    expect(process.argv).toEqual(['vitest', NAME, '--verbose']);
    expect(process.env.VITEST_SETUP_TEST_ENV).toBe('enabled');
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
    expect(loggerLogSpy).toBeDefined();
    expect(consoleLogSpy).toBeDefined();
    expect(consoleDebugSpy).toBeDefined();
    expect(consoleInfoSpy).toBeDefined();
    expect(consoleWarnSpy).toBeDefined();
    expect(consoleErrorSpy).toBeDefined();

    await setDebug(false);
    expect(loggerLogSpy.getMockImplementation()).toBeDefined();
    expect(consoleLogSpy.getMockImplementation()).toBeDefined();
    expect(consoleDebugSpy.getMockImplementation()).toBeDefined();
    expect(consoleInfoSpy.getMockImplementation()).toBeDefined();
    expect(consoleWarnSpy.getMockImplementation()).toBeDefined();
    expect(consoleErrorSpy.getMockImplementation()).toBeDefined();
    log.log(LogLevel.INFO, 'Test setup completed');
    console.log('Test setup completed');
    console.debug('Test setup completed');
    console.info('Test setup completed');
    console.warn('Test setup completed');
    console.error('Test setup completed');
  });
});
