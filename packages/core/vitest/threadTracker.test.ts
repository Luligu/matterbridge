/**
 * @file packages/core/vitest/threadTracker.test.ts
 * @description Tests Tracker thread initialization and lifetime.
 * @author Luca Liguori
 */

import { setupTest } from '@matterbridge/test-utils/vitest/setup';
import type { ThreadsWrapper } from '@matterbridge/thread/wrapper';
import { LogLevel } from 'node-ansi-logger';

// Setup the test environment
await setupTest('ThreadTracker', false);

describe('ThreadTracker', () => {
  const start = vi.fn();
  const stop = vi.fn();
  const createTracker = vi.fn();
  let wrapper: ThreadsWrapper;

  beforeEach(async () => {
    vi.resetModules();
    start.mockReset();
    stop.mockReset();
    createTracker.mockReset();
    vi.doMock('@matterbridge/utils/tracker', () => ({
      // oxlint-disable-next-line typescript/no-extraneous-class -- Mock the Tracker constructor without sampling.
      Tracker: class {
        constructor(...args: unknown[]) {
          createTracker(...args);
          return { start, stop };
        }
      },
    }));
    wrapper = (await import('../src/runners/threadTracker.js')).default;
    vi.spyOn(wrapper, 'logger').mockImplementation(() => {});
    vi.spyOn(wrapper.log, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    wrapper.destroy(true);
    vi.restoreAllMocks();
    vi.doUnmock('@matterbridge/utils/tracker');
  });

  test('should create the Tracker and start and stop it on startup and shutdown', async () => {
    await expect(wrapper.entrypoint(wrapper)).resolves.toBe(true);
    expect(wrapper.name).toBe('Tracker');
    expect(createTracker).toHaveBeenCalledWith('Tracker', false, false, true);
    expect(start).not.toHaveBeenCalled();
    await wrapper.startup?.(wrapper);
    expect(start).toHaveBeenCalledTimes(1);
    expect(stop).not.toHaveBeenCalled();
    await wrapper.shutdown?.(wrapper);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  test('should log the startup and shutdown events', async () => {
    await expect(wrapper.entrypoint(wrapper)).resolves.toBe(true);
    wrapper.emit('startup');
    wrapper.emit('shutdown');
    expect(wrapper.logger).toHaveBeenCalledWith(LogLevel.NOTICE, 'Tracker received startup');
    expect(wrapper.logger).toHaveBeenCalledWith(LogLevel.NOTICE, 'Tracker received shutdown');
    expect(start).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
  });

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
    await expect(wrapper.entrypoint(wrapper)).resolves.toBe(false);
    expect(start).not.toHaveBeenCalled();
  });
});
