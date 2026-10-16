/**
 * @file packages/core/vitest/threadBackend.test.ts
 * @description Tests Backend thread initialization and lifetime.
 * @author Luca Liguori
 */

import { setupTest } from '@matterbridge/test-utils/vitest/setup';
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

  beforeEach(async () => {
    vi.resetModules();
    start.mockReset().mockImplementation(async () => await Promise.resolve());
    stop.mockReset().mockImplementation(async () => await Promise.resolve());
    createBackend.mockReset();
    vi.doMock('../src/backend.js', () => ({
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
    vi.spyOn(wrapper.log, 'log').mockImplementation(() => {});
    responder = new BroadcastServer('matterbridge', wrapper.log);
    responder.on('broadcast_message', (msg) => {
      if (responder.isWorkerRequest(msg) && msg.type === 'matterbridge_shared') {
        responder.respond({ ...msg, result: { data: matterbridge, success: true } });
      }
    });
  });

  afterEach(() => {
    responder.close();
    wrapper.destroy(true);
    vi.restoreAllMocks();
    vi.doUnmock('../src/backend.js');
  });

  test('should fetch shared state and create the Backend without starting it', async () => {
    await expect(wrapper.entrypoint(wrapper)).resolves.toBe(true);
    expect(wrapper.name).toBe('Backend');
    expect(createBackend).toHaveBeenCalledWith(matterbridge);
    expect(start).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
  });

  test('should start the Backend on startup and stop it on shutdown', async () => {
    await expect(wrapper.entrypoint(wrapper)).resolves.toBe(true);
    await wrapper.startup?.(wrapper);
    expect(start).toHaveBeenCalledTimes(1);
    expect(stop).not.toHaveBeenCalled();
    await wrapper.shutdown?.(wrapper);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  test('should do nothing on startup and shutdown when the Backend was not created', async () => {
    await wrapper.startup?.(wrapper);
    await wrapper.shutdown?.(wrapper);
    expect(start).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
  });

  test('should report failure when fetching shared state fails', async () => {
    vi.spyOn(wrapper.server, 'fetch').mockRejectedValue(new Error('Shared state unavailable'));
    await expect(wrapper.entrypoint(wrapper)).resolves.toBe(false);
    expect(createBackend).not.toHaveBeenCalled();
  });

  test('should report failure when Backend construction fails', async () => {
    createBackend.mockImplementation(() => {
      throw new Error('Backend construction failed');
    });
    await expect(wrapper.entrypoint(wrapper)).resolves.toBe(false);
    await wrapper.startup?.(wrapper);
    expect(start).not.toHaveBeenCalled();
  });

  test('should reject startup when Backend start rejects', async () => {
    start.mockRejectedValue(new Error('Backend startup failed'));
    await expect(wrapper.entrypoint(wrapper)).resolves.toBe(true);
    await expect(wrapper.startup?.(wrapper)).rejects.toThrow('Backend startup failed');
    expect(start).toHaveBeenCalledTimes(1);
  });
});
