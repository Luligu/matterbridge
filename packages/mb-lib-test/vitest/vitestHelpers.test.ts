/* eslint-disable no-console */
import { vi } from 'vitest';
import { LogLevel } from 'node-ansi-logger';

import { consoleDebugSpy, consoleErrorSpy, consoleInfoSpy, consoleLogSpy, consoleWarnSpy, log, loggerLogSpy, setDebug, setupTest } from '../src/vitestutils/vitestHelpers.js';

process.argv.push('--debug');

describe('Vitest Helpers', () => {
  const NAME = 'VitestHelpers';

  beforeAll(async () => {
    await setupTest(NAME, true);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
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
  });
});
