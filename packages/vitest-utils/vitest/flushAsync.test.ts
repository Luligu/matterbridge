import { vi } from 'vitest';

import { flushAsync } from '../src/flushAsync.js';

describe('flushAsync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should yield the default ticks and pause when called without parameters', async () => {
    const setImmediateSpy = vi.spyOn(globalThis, 'setImmediate');
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    await expect(flushAsync()).resolves.toBeUndefined();
    expect(setImmediateSpy).toHaveBeenCalledTimes(3);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 250);
  });

  test('should yield the requested ticks and pause when called with parameters', async () => {
    const setImmediateSpy = vi.spyOn(globalThis, 'setImmediate');
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    await expect(flushAsync(2, 5, 50)).resolves.toBeUndefined();
    expect(setImmediateSpy).toHaveBeenCalledTimes(2);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 50);
  });

  test('should skip the final timer when pause is 0', async () => {
    const setImmediateSpy = vi.spyOn(globalThis, 'setImmediate');
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    await expect(flushAsync(1, 1, 0)).resolves.toBeUndefined();
    expect(setImmediateSpy).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });

  test('should resolve without scheduling when ticks, microTurns and pause are 0', async () => {
    const setImmediateSpy = vi.spyOn(globalThis, 'setImmediate');
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    await expect(flushAsync(0, 0, 0)).resolves.toBeUndefined();
    expect(setImmediateSpy).not.toHaveBeenCalled();
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });
});
