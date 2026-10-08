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
  const destroy = vi.fn();
  const createBackend = vi.fn();
  let wrapper: ThreadsWrapper;
  let responder: BroadcastServer;

  beforeEach(async () => {
    vi.resetModules();
    start.mockReset().mockImplementation(async () => await Promise.resolve());
    destroy.mockClear();
    createBackend.mockReset();
    vi.doMock('../src/backend.js', () => ({
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

  test('should fetch shared state and await Backend startup without destroying it', async () => {
    let completeStartup: () => void = () => {};
    start.mockReturnValue(
      new Promise<void>((resolve) => {
        completeStartup = resolve;
      }),
    );
    const result = wrapper.entrypoint(wrapper);
    await vi.waitFor(() => expect(start).toHaveBeenCalledTimes(1));
    expect(createBackend).toHaveBeenCalledWith(matterbridge);
    expect(wrapper.name).toBe('Backend');
    expect(destroy).not.toHaveBeenCalled();
    completeStartup();
    await expect(result).resolves.toBe(true);
    expect(destroy).not.toHaveBeenCalled();
  });

  test('should report failure when fetching shared state fails', async () => {
    vi.spyOn(wrapper.server, 'fetch').mockRejectedValue(new Error('Shared state unavailable'));
    await expect(wrapper.entrypoint(wrapper)).resolves.toBe(false);
    expect(createBackend).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
    expect(destroy).not.toHaveBeenCalled();
  });

  test('should report failure when Backend construction fails', async () => {
    createBackend.mockImplementation(() => {
      throw new Error('Backend construction failed');
    });
    await expect(wrapper.entrypoint(wrapper)).resolves.toBe(false);
    expect(start).not.toHaveBeenCalled();
    expect(destroy).not.toHaveBeenCalled();
  });

  test('should report failure when Backend startup rejects', async () => {
    start.mockRejectedValue(new Error('Backend startup failed'));
    await expect(wrapper.entrypoint(wrapper)).resolves.toBe(false);
    expect(start).toHaveBeenCalledTimes(1);
    expect(destroy).not.toHaveBeenCalled();
  });
});
