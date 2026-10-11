/**
 * @file packages/core/buntest/threadBackend.test.ts
 * @description Tests Backend thread initialization and lifetime.
 * @author Luca Liguori
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, test, vi } from 'bun:test';

import { resetTest, setupTest } from '@matterbridge/test-utils/buntest/setup';
import { BroadcastServer } from '@matterbridge/thread/server';
import type { ThreadsWrapper } from '@matterbridge/thread/wrapper';
import type { SharedMatterbridge } from '@matterbridge/types';

// Setup the test environment
await setupTest('ThreadBackend', false);

describe('ThreadBackend', () => {
  const matterbridge = { matterbridgeVersion: '3.10.13' } as unknown as SharedMatterbridge;
  const start = vi.fn<() => Promise<void>>();
  const stop = vi.fn<() => Promise<void>>();
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
          return { start, stop };
        }
      },
    }));
    wrapper = (await import('../src/runners/threadBackend.js')).default;
    vi.spyOn(wrapper, 'logger').mockImplementation(() => {});
  });

  beforeEach(() => {
    start.mockReset().mockImplementation(async () => await Promise.resolve());
    stop.mockReset().mockImplementation(async () => await Promise.resolve());
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

  // The runner keeps the Backend in module state across tests: this test must run before any successful entrypoint
  test('should do nothing on startup and shutdown when the Backend was not created', async () => {
    await wrapper.startup?.(wrapper);
    await wrapper.shutdown?.(wrapper);
    expect(start).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
  });

  test('should report failure when fetching shared state fails', async () => {
    const fetchSpy = vi.spyOn(wrapper.server, 'fetch').mockRejectedValue(new Error('Shared state unavailable'));
    expect(await wrapper.entrypoint(wrapper)).toBe(false);
    fetchSpy.mockRestore();
    expect(createBackend).not.toHaveBeenCalled();
  });

  test('should report failure when Backend construction fails', async () => {
    createBackend.mockImplementation(() => {
      throw new Error('Backend construction failed');
    });
    expect(await wrapper.entrypoint(wrapper)).toBe(false);
    await wrapper.startup?.(wrapper);
    expect(start).not.toHaveBeenCalled();
  });

  test('should fetch shared state and create the Backend without starting it', async () => {
    expect(await wrapper.entrypoint(wrapper)).toBe(true);
    expect(wrapper.name).toBe('Backend');
    expect(createBackend).toHaveBeenCalledWith(matterbridge);
    expect(start).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
  });

  test('should start the Backend on startup and stop it on shutdown', async () => {
    expect(await wrapper.entrypoint(wrapper)).toBe(true);
    await wrapper.startup?.(wrapper);
    expect(start).toHaveBeenCalledTimes(1);
    expect(stop).not.toHaveBeenCalled();
    await wrapper.shutdown?.(wrapper);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  test('should reject startup when Backend start rejects', async () => {
    start.mockRejectedValue(new Error('Backend startup failed'));
    expect(await wrapper.entrypoint(wrapper)).toBe(true);
    let error: unknown;
    await wrapper.startup?.(wrapper).catch((err: unknown) => (error = err));
    expect((error as Error).message).toBe('Backend startup failed');
    expect(start).toHaveBeenCalledTimes(1);
  });
});
