// vitest\loader.test.ts

import { logModuleLoaded } from '../src/loader.js';
import { consoleLogSpy, setupTest } from './vitestSetupTest.js';

// Setup the test environment
await setupTest('Loader', false);

describe('logModuleLoaded()', () => {
  const ORIGINAL_ARGV = process.argv;

  beforeEach(() => {
    vi.clearAllMocks();
    process.argv = ['node', 'script.js'];
  });

  afterAll(() => {
    process.argv = ORIGINAL_ARGV;
    vi.restoreAllMocks();
  });

  it('does nothing when --loader is not in process.argv', () => {
    logModuleLoaded('my-module');
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it('logs when --loader is in process.argv', () => {
    process.argv = [...process.argv, '--loader'];
    logModuleLoaded('my-module');
    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
  });

  it('uses the default green ANSI color', () => {
    process.argv = [...process.argv, '--loader'];
    logModuleLoaded('my-module');
    const message: string = consoleLogSpy.mock.calls[0][0];
    expect(message).toContain('[32m');
  });

  it('uses a custom color when provided', () => {
    process.argv = [...process.argv, '--loader'];
    logModuleLoaded('my-module', '[34m');
    const message: string = consoleLogSpy.mock.calls[0][0];
    expect(message).toContain('[34m');
  });

  it('includes the module name and "loaded." in the message', () => {
    process.argv = [...process.argv, '--loader'];
    logModuleLoaded('test-package');
    const message: string = consoleLogSpy.mock.calls[0][0];
    expect(message).toContain('test-package loaded.');
  });

  it('ends the message with the ANSI reset sequence', () => {
    process.argv = [...process.argv, '--loader'];
    logModuleLoaded('my-module');
    const message: string = consoleLogSpy.mock.calls[0][0];
    expect(message).toContain('[40;0m');
  });

  it('includes a timestamp in HH:MM:SS.mmm format', () => {
    process.argv = [...process.argv, '--loader'];
    logModuleLoaded('my-module');
    const message: string = consoleLogSpy.mock.calls[0][0];
    expect(message).toMatch(/\[\d{2}:\d{2}:\d{2}\.\d{3}\]/);
  });
});
