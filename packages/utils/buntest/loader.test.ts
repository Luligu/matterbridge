/**
 * @file packages/utils/buntest/loader.test.ts
 * @description This file contains the tests for loader.
 * @author Luca Liguori
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'bun:test';

import { consoleLogSpy, resetTest, setupTest } from '@matterbridge/test-utils/buntest/setup';

import { logModuleLoaded } from '../src/loader.js';

// setupTest() is called once per test file, so the flagged argv is the default for this suite and
// the single un-flagged case sets its own.
const LOADER_ARGV = ['bun', 'LoaderTest', '--loader'];

// Mocks AnsiLogger.prototype.log and the console methods, and sets process.argv to LOADER_ARGV.
await setupTest('LoaderTest', false, ['--loader']);

describe('logModuleLoaded()', () => {
  beforeEach(() => {
    process.argv = [...LOADER_ARGV];
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
    resetTest();
  });

  it('does nothing when --loader is not in process.argv', () => {
    process.argv = ['bun', 'LoaderTest'];

    logModuleLoaded('my-module');

    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it('logs when --loader is in process.argv', () => {
    logModuleLoaded('my-module');
    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
  });

  it('uses the default green ANSI color', () => {
    logModuleLoaded('my-module');
    const message: string = consoleLogSpy.mock.calls[0][0];
    expect(message).toContain('\u001B[32m');
  });

  it('uses a custom color when provided', () => {
    logModuleLoaded('my-module', '\u001B[34m');
    const message: string = consoleLogSpy.mock.calls[0][0];
    expect(message).toContain('\u001B[34m');
  });

  it('includes the module name and "loaded." in the message', () => {
    logModuleLoaded('test-package');
    const message: string = consoleLogSpy.mock.calls[0][0];
    expect(message).toContain('test-package loaded.');
  });

  it('ends the message with the ANSI reset sequence', () => {
    logModuleLoaded('my-module');
    const message: string = consoleLogSpy.mock.calls[0][0];
    expect(message).toContain('\u001B[40;0m');
  });

  it('includes a timestamp in HH:MM:SS.mmm format', () => {
    logModuleLoaded('my-module');
    const message: string = consoleLogSpy.mock.calls[0][0];
    expect(message).toMatch(/\[\d{2}:\d{2}:\d{2}\.\d{3}\]/);
  });
});
