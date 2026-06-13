// vitest\wait.test.ts

import { AnsiLogger, LogLevel } from 'node-ansi-logger';
import type { MockInstance } from 'vitest';

import { fireAndForget, wait, waiter, withTimeout } from '../src/wait.js';
import { loggerLogSpy, setupTest } from './vitestSetupTest.js';

// Setup the test environment
await setupTest('Wait', false);

describe('waiter()', () => {
  let clearTimeoutSpy: MockInstance<typeof global.clearTimeout>;
  let clearIntervalSpy: MockInstance<typeof global.clearInterval>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    // Spy on global timer clearances
    clearTimeoutSpy = vi.spyOn(global, 'clearTimeout').mockImplementation(() => {});
    clearIntervalSpy = vi.spyOn(global, 'clearInterval').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    // (log.debug as vi.Mock).mockRestore();
    clearTimeoutSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });

  it('resolves immediately with true if check returns true', async () => {
    const check = vi.fn().mockReturnValue(true);
    await expect(waiter('immediate', check as any)).resolves.toBe(true);
    expect(check).toHaveBeenCalledTimes(1);
  });

  it('resolves immediately with true if check returns true and logs when debug=true', async () => {
    const check = vi.fn().mockReturnValue(true);
    await expect(waiter('immediate-debug', check as any, false, 5000, 500, true)).resolves.toBe(true);
    expect(check).toHaveBeenCalledTimes(1);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Waiter "immediate-debug" already true');
  });

  it('resolves true when check becomes true before timeout', async () => {
    let calls = 0;
    const check = vi.fn().mockImplementation(() => ++calls >= 2);
    const promise = waiter('eventual', check as any, false, 1000, 100, false);

    // initial immediate check
    expect(check).toHaveBeenCalledTimes(1);
    // advance one interval to trigger second check
    vi.advanceTimersByTime(100);
    await expect(promise).resolves.toBe(true);
    expect(check).toHaveBeenCalledTimes(2);
    expect(clearTimeout).toHaveBeenCalled();
    expect(clearInterval).toHaveBeenCalled();
  });

  it('resolves true when check becomes true before timeout debug=true', async () => {
    let calls = 0;
    const check = vi.fn().mockImplementation(() => ++calls >= 2);
    const promise = waiter('eventual', check as any, false, 1000, 100, true);

    // initial immediate check
    expect(check).toHaveBeenCalledTimes(1);
    // advance one interval to trigger second check
    vi.advanceTimersByTime(100);
    await expect(promise).resolves.toBe(true);
    expect(check).toHaveBeenCalledTimes(2);
    expect(clearTimeout).toHaveBeenCalled();
    expect(clearInterval).toHaveBeenCalled();
    // Verify finish-for-true log
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Waiter "eventual" finished for true condition...');
  });

  it('resolves false on timeout when exitWithReject=false', async () => {
    const check = vi.fn().mockReturnValue(false);
    const promise = waiter('timeoutFalse', check as any, false, 500, 100);
    vi.advanceTimersByTime(500);
    await expect(promise).resolves.toBe(false);
    expect(clearTimeout).toHaveBeenCalled();
    expect(clearInterval).toHaveBeenCalled();
  });

  it('rejects on timeout when exitWithReject=true', async () => {
    const check = vi.fn().mockReturnValue(false);
    const promise = waiter('timeoutReject', check as any, true, 500, 100);
    vi.advanceTimersByTime(500);
    await expect(promise).rejects.toThrow('Waiter "timeoutReject" finished due to timeout');
    expect(clearTimeout).toHaveBeenCalled();
    expect(clearInterval).toHaveBeenCalled();
  });

  it('logs debug messages when debug=true', async () => {
    const check = vi.fn().mockReturnValue(false);
    const promise = waiter('dbg', check as any, false, 200, 100, true);

    // advance to timeout and await
    vi.advanceTimersByTime(200);
    await promise;

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Waiter "dbg" started...');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Waiter "dbg" finished for timeout...');
  });

  it('dont logs debug messages when debug=false', async () => {
    const check = vi.fn().mockReturnValue(false);
    const promise = waiter('dbg', check as any, false, 200, 100, false);

    // advance to timeout and await
    vi.advanceTimersByTime(200);
    await promise;

    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.DEBUG, 'Waiter "dbg" started...');
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.DEBUG, 'Waiter "dbg" finished for timeout...');
  });
});

describe('wait()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('completes after the specified timeout', async () => {
    const promise = wait(500);
    vi.advanceTimersByTime(500);
    await expect(promise).resolves.toBeUndefined();
  });

  it('resolves without debug when debug=false', async () => {
    const promise = wait(300, 'test-op', false);
    vi.advanceTimersByTime(300);
    await expect(promise).resolves.toBeUndefined();
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.DEBUG, 'Wait "test-op" started...');
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.DEBUG, 'Wait "test-op" finished...');
  });

  it('logs debug messages when debug=true', async () => {
    const promise = wait(200, 'myWait', true);
    vi.advanceTimersByTime(200);
    await promise;
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Wait "myWait" started...');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Wait "myWait" finished...');
  });

  it('uses defaults when no args provided', async () => {
    const promise = wait();
    vi.advanceTimersByTime(1000);
    await expect(promise).resolves.toBeUndefined();
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Wait'));
  });
});

describe('withTimeout()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should resolves if the original promise fulfills before timeout', async () => {
    const promise = new Promise<string>((resolve) => {
      setTimeout(() => resolve('done'), 50);
    });
    const wrapped = withTimeout(promise, 100);

    // Advance time to just before timeout
    vi.advanceTimersByTime(50);
    await expect(wrapped).resolves.toBe('done');
  });

  it('should rejects with timeout error if promise takes too long', async () => {
    const promise = new Promise<string>((resolve) => {
      setTimeout(() => resolve('late'), 200);
    });
    const wrapped = withTimeout(promise, 100);

    // Advance time past the timeout
    vi.advanceTimersByTime(100);
    await expect(wrapped).rejects.toThrow('Operation timed out');
  });

  it('should not rejects with timeout error if promise takes too long', async () => {
    const promise = new Promise<string>((resolve) => {
      setTimeout(() => resolve('late'), 200);
    });
    const wrapped = withTimeout(promise, 100, false);

    // Advance time past the timeout
    vi.advanceTimersByTime(100);
    await expect(wrapped).resolves.toBe(undefined);
  });

  it('should rejects with the original error if promise rejects before timeout', async () => {
    const originalError = new Error('failure');
    const promise = new Promise<string>((resolve, reject) => {
      setTimeout(() => reject(originalError), 50);
    });
    const wrapped = withTimeout(promise, 100);

    vi.advanceTimersByTime(50);
    await expect(wrapped).rejects.toBe(originalError);
  });

  it('should not rejects with the original error if promise rejects before timeout', async () => {
    const originalError = new Error('failure');
    const promise = new Promise<string>((resolve, reject) => {
      setTimeout(() => reject(originalError), 50);
    });
    const wrapped = withTimeout(promise, 100, false);

    vi.advanceTimersByTime(50);
    await expect(wrapped).resolves.toBe(undefined);
  });

  it('clears timer upon resolution to avoid leaks', async () => {
    const promise = new Promise<string>((resolve) => {
      setTimeout(() => resolve('ok'), 50);
    });
    const wrapped = withTimeout(promise);

    // Spy on clearTimeout to ensure it's called
    const clearSpy = vi.spyOn(global, 'clearTimeout');

    vi.advanceTimersByTime(50);
    await wrapped;

    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('clears timer upon rejection to avoid leaks', async () => {
    const promise = new Promise<string>((resolve, reject) => {
      setTimeout(() => reject(new Error('fail')), 50);
    });
    const wrapped = withTimeout(promise, 100);

    const clearSpy = vi.spyOn(global, 'clearTimeout');

    vi.advanceTimersByTime(50);
    await expect(wrapped).rejects.toThrow('fail');

    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});

describe('fireAndForget()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should log the rejection error when the promise rejects', async () => {
    const log = new AnsiLogger({ logName: 'FireAndForgetTest', logLevel: LogLevel.DEBUG });

    fireAndForget(Promise.reject(new Error('boom')), log, 'publishUpdate');
    await Promise.resolve();

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('publishUpdate failed: boom'));
  });

  it('should not log an error when the promise resolves', async () => {
    const log = new AnsiLogger({ logName: 'FireAndForgetTest', logLevel: LogLevel.DEBUG });

    fireAndForget(Promise.resolve('ok'), log, 'publishUpdate');
    await Promise.resolve();

    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('publishUpdate failed:'));
  });
});
