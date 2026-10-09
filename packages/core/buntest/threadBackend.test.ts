/**
 * @file packages/core/buntest/threadBackend.test.ts
 * @description Tests Backend thread initialization and lifetime.
 * @author Luca Liguori
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, test, vi } from 'bun:test';

import { flushAsync } from '@matterbridge/test-utils';
import { resetTest, setupTest } from '@matterbridge/test-utils/buntest/setup';
import { BroadcastServer } from '@matterbridge/thread/server';
import type { ThreadsWrapper } from '@matterbridge/thread/wrapper';
import type { SharedMatterbridge } from '@matterbridge/types';

// Setup the test environment
await setupTest('ThreadBackend', false);

describe('ThreadBackend', () => {
  const matterbridge = { matterbridgeVersion: '3.10.13' } as unknown as SharedMatterbridge;
  const start = vi.fn<() => Promise<void>>();
  const destroy = vi.fn();
  const createBackend = vi.fn();
  let wrapper: ThreadsWrapper;
  let responder: BroadcastServer;

  beforeAll(async () => {
    // Mock the Backend module before the runner imports it lazily, so no real servers are started.
    await mock.module('../src/backend.js', () => ({
      // oxlint-disable-next-line typescript/no-extraneous-class -- Mock the Backend constructor without starting real servers.
      Backend: class {
        constructor(shared: unknown) {
          createBackend(shared);
          return { start, destroy };
        }
      },
    }));
    wrapper = (await import('../src/runners/threadBackend.js')).default;
    vi.spyOn(wrapper, 'logger').mockImplementation(() => {});
  });

  beforeEach(() => {
    start.mockReset().mockImplementation(async () => await Promise.resolve());
    destroy.mockClear();
    createBackend.mockReset();
    responder = new BroadcastServer('matterbridge', wrapper.log);
    responder.on('broadcast_message', (msg) => {
      if (responder.isWorkerRequest(msg) && msg.type === 'matterbridge_shared') {
        responder.respond({ ...msg, result: { data: matterbridge, success: true } });
      }
    });
  });

  afterEach(() => {
    responder.close();
  });

  afterAll(() => {
    wrapper.destroy(true);
    mock.restore();
    resetTest();
  });

  test('should fetch shared state and await Backend startup without destroying it', async () => {
    let completeStartup: () => void = () => {};
    start.mockReturnValue(
      new Promise<void>((resolve) => {
        completeStartup = resolve;
      }),
    );
    const result = wrapper.entrypoint(wrapper);
    for (let i = 0; i < 50 && start.mock.calls.length === 0; i++) await flushAsync(1, 10, 0);
    expect(start).toHaveBeenCalledTimes(1);
    expect(createBackend).toHaveBeenCalledWith(matterbridge);
    expect(wrapper.name).toBe('Backend');
    expect(destroy).not.toHaveBeenCalled();
    completeStartup();
    expect(await result).toBe(true);
    expect(destroy).not.toHaveBeenCalled();
  });

  test('should report failure when fetching shared state fails', async () => {
    const fetchSpy = vi.spyOn(wrapper.server, 'fetch').mockRejectedValue(new Error('Shared state unavailable'));
    expect(await wrapper.entrypoint(wrapper)).toBe(false);
    fetchSpy.mockRestore();
    expect(createBackend).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
    expect(destroy).not.toHaveBeenCalled();
  });

  test('should report failure when Backend construction fails', async () => {
    createBackend.mockImplementation(() => {
      throw new Error('Backend construction failed');
    });
    expect(await wrapper.entrypoint(wrapper)).toBe(false);
    expect(start).not.toHaveBeenCalled();
    expect(destroy).not.toHaveBeenCalled();
  });

  test('should report failure when Backend startup rejects', async () => {
    start.mockRejectedValue(new Error('Backend startup failed'));
    expect(await wrapper.entrypoint(wrapper)).toBe(false);
    expect(start).toHaveBeenCalledTimes(1);
    expect(destroy).not.toHaveBeenCalled();
  });
});
