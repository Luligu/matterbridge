/**
 * @file packages/thread/vitest/threadBackend.test.ts
 * @description Tests Backend thread initialization and lifetime.
 * @author Luca Liguori
 */

import { BroadcastServer } from '../src/broadcastServer.js';
import type { WorkerWrapper } from '../src/workerWrapper.js';
import { matterbridge } from './sharedMatterbridge.js';

const start = vi.fn<() => Promise<void>>();
const destroy = vi.fn();
const createBackend = vi.fn();
let wrapper: WorkerWrapper;
let responder: BroadcastServer;

beforeEach(async () => {
  vi.resetModules();
  start.mockReset().mockImplementation(async () => await Promise.resolve());
  destroy.mockClear();
  createBackend.mockReset();
  vi.doMock('@matterbridge/core/backend', () => ({
    // oxlint-disable-next-line typescript/no-extraneous-class -- Mock the Backend constructor without starting real servers.
    Backend: class {
      constructor(shared: unknown) {
        createBackend(shared);
        return { start, destroy };
      }
    },
  }));
  wrapper = (await import('../src/threadBackend.js')).default;
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
  vi.doUnmock('@matterbridge/core/backend');
});

test('should fetch shared state and await Backend startup without destroying it', async () => {
  let completeStartup: () => void = () => {};
  start.mockReturnValue(
    new Promise<void>((resolve) => {
      completeStartup = resolve;
    }),
  );
  const result = wrapper.callback(wrapper);
  await vi.waitFor(() => expect(start).toHaveBeenCalledOnce());
  expect(createBackend).toHaveBeenCalledWith(matterbridge);
  expect(wrapper.name).toBe('Backend');
  expect(destroy).not.toHaveBeenCalled();
  completeStartup();
  await expect(result).resolves.toBe(true);
  expect(destroy).not.toHaveBeenCalled();
});

test('should report failure when fetching shared state fails', async () => {
  vi.spyOn(wrapper.server, 'fetch').mockRejectedValue(new Error('Shared state unavailable'));
  await expect(wrapper.callback(wrapper)).resolves.toBe(false);
  expect(createBackend).not.toHaveBeenCalled();
  expect(start).not.toHaveBeenCalled();
  expect(destroy).not.toHaveBeenCalled();
});

test('should report failure when Backend construction fails', async () => {
  createBackend.mockImplementation(() => {
    throw new Error('Backend construction failed');
  });
  await expect(wrapper.callback(wrapper)).resolves.toBe(false);
  expect(start).not.toHaveBeenCalled();
  expect(destroy).not.toHaveBeenCalled();
});

test('should report failure when Backend startup rejects', async () => {
  start.mockRejectedValue(new Error('Backend startup failed'));
  await expect(wrapper.callback(wrapper)).resolves.toBe(false);
  expect(start).toHaveBeenCalledOnce();
  expect(destroy).not.toHaveBeenCalled();
});
