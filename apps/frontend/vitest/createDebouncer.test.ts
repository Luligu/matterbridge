import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDebouncer } from '../src/utils/createDebouncer';

describe('createDebouncer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs the callback after the configured delay', () => {
    const callback = vi.fn();
    const run = createDebouncer(250);

    run(callback);

    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(249);
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('clears the previous timer when scheduled again', () => {
    const first = vi.fn();
    const second = vi.fn();
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
    const run = createDebouncer(100);

    run(first);
    run(second);

    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('allows a new timer after the previous callback has completed', () => {
    const callback = vi.fn();
    const run = createDebouncer(50);

    run(callback);
    vi.advanceTimersByTime(50);

    run(callback);
    vi.advanceTimersByTime(50);

    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('cancels a pending timer and is safe to call when idle', () => {
    const callback = vi.fn();
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
    const run = createDebouncer(100);

    run(callback);
    run.cancel();
    run.cancel();

    vi.advanceTimersByTime(100);

    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(callback).not.toHaveBeenCalled();
  });
});
