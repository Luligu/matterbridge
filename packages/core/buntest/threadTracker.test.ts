/**
 * @file packages/core/buntest/threadTracker.test.ts
 * @description Tests Tracker thread initialization and lifetime.
 * @author Luca Liguori
 */

import { afterAll, beforeAll, beforeEach, describe, expect, mock, test, vi } from 'bun:test';

import { resetTest, setupTest } from '@matterbridge/test-utils/buntest/setup';
import type { ThreadsWrapper } from '@matterbridge/thread/wrapper';
import { LogLevel } from 'node-ansi-logger';

// Setup the test environment
await setupTest('ThreadTracker', false);

describe('ThreadTracker', () => {
  const start = vi.fn();
  const stop = vi.fn();
  const createTracker = vi.fn();
  let wrapper: ThreadsWrapper;
  let logger: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    // Mock the Tracker module before the runner imports it, so no real sampling is started.
    await mock.module('@matterbridge/utils/tracker', () => ({
      // oxlint-disable-next-line typescript/no-extraneous-class -- Mock the Tracker constructor without sampling.
      Tracker: class {
        constructor(...args: unknown[]) {
          createTracker(...args);
          return { start, stop };
        }
      },
    }));
    wrapper = (await import('../src/runners/threadTracker.js')).default;
    logger = vi.spyOn(wrapper, 'logger').mockImplementation(() => {});
  });

  beforeEach(() => {
    start.mockReset();
    stop.mockReset();
    createTracker.mockReset();
    logger.mockClear();
    wrapper.removeAllListeners('startup');
    wrapper.removeAllListeners('shutdown');
  });

  afterAll(() => {
    wrapper.destroy(true);
    mock.restore();
    resetTest();
  });

  // The runner keeps the Tracker in module state across tests: this test must run before any successful entrypoint
  test('should do nothing on startup and shutdown when the Tracker was not created', async () => {
    await wrapper.startup?.(wrapper);
    await wrapper.shutdown?.(wrapper);
    expect(start).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
  });

  test('should report failure when Tracker construction fails', async () => {
    createTracker.mockImplementation(() => {
      throw new Error('Tracker construction failed');
    });
    expect(await wrapper.entrypoint(wrapper)).toBe(false);
    expect(logger).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Failed to create tracker'));
    expect(wrapper.listenerCount('startup')).toBe(0);
    expect(start).not.toHaveBeenCalled();
  });

  test('should create the Tracker and start and stop it on startup and shutdown', async () => {
    expect(await wrapper.entrypoint(wrapper)).toBe(true);
    expect(wrapper.name).toBe('Tracker');
    expect(createTracker).toHaveBeenCalledWith('Tracker', false, false, true);
    expect(logger).toHaveBeenCalledWith(LogLevel.DEBUG, 'Tracker created');
    expect(start).not.toHaveBeenCalled();

    await wrapper.startup?.(wrapper);
    expect(start).toHaveBeenCalledTimes(1);
    expect(stop).not.toHaveBeenCalled();

    await wrapper.shutdown?.(wrapper);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  test('should log the startup and shutdown events', async () => {
    expect(await wrapper.entrypoint(wrapper)).toBe(true);
    wrapper.emit('startup');
    wrapper.emit('shutdown');
    expect(logger).toHaveBeenCalledWith(LogLevel.NOTICE, 'Tracker received startup');
    expect(logger).toHaveBeenCalledWith(LogLevel.NOTICE, 'Tracker received shutdown');
    expect(start).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
  });
});
