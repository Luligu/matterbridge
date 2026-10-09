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

  test('should create the Tracker and start and stop it on startup and shutdown', async () => {
    expect(await wrapper.entrypoint(wrapper)).toBe(true);
    expect(wrapper.name).toBe('Tracker');
    expect(createTracker).toHaveBeenCalledWith('Tracker', true, false, true);
    expect(logger).toHaveBeenCalledWith(LogLevel.DEBUG, 'Tracker created');
    expect(start).not.toHaveBeenCalled();

    wrapper.emit('startup');
    expect(start).toHaveBeenCalledTimes(1);
    expect(stop).not.toHaveBeenCalled();
    expect(logger).toHaveBeenCalledWith(LogLevel.NOTICE, 'Tracker received startup');

    wrapper.emit('shutdown');
    expect(stop).toHaveBeenCalledTimes(1);
    expect(logger).toHaveBeenCalledWith(LogLevel.NOTICE, 'Tracker received shutdown');
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
});
