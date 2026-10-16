/**
 * @file packages/core/vitest/threadRootNode.test.ts
 * @description Tests RootNode thread initialization and lifetime.
 * @author Luca Liguori
 */

import { setupTest } from '@matterbridge/test-utils/vitest/setup';
import type { ThreadsWrapper } from '@matterbridge/thread/wrapper';
import type { RootNodeWorkerData, SharedMatterbridge, WorkerData } from '@matterbridge/types';
import { LogLevel } from 'node-ansi-logger';

// Setup the test environment
await setupTest('ThreadRootNode', false);

describe('ThreadRootNode', () => {
  const sharedMatterbridge = { matterbridgeVersion: '3.10.13' } as unknown as SharedMatterbridge;
  const workerData: RootNodeWorkerData = {
    threadName: 'RootNode',
    type: 'thread',
    logLevel: LogLevel.INFO,
    debug: false,
    verbose: false,
    tracker: false,
    sharedMatterbridge,
    pluginName: 'matterbridge-test',
  };
  const create = vi.fn<() => Promise<void>>();
  const start = vi.fn<() => Promise<void>>();
  const stop = vi.fn<() => Promise<void>>();
  const destroy = vi.fn<() => Promise<void>>();
  const createMatterNode = vi.fn();
  let wrapper: ThreadsWrapper;

  beforeEach(async () => {
    vi.resetModules();
    create.mockReset().mockImplementation(async () => await Promise.resolve());
    start.mockReset().mockImplementation(async () => await Promise.resolve());
    stop.mockReset().mockImplementation(async () => await Promise.resolve());
    destroy.mockReset().mockImplementation(async () => await Promise.resolve());
    createMatterNode.mockReset();
    vi.doMock('../src/matterNode.js', () => ({
      // oxlint-disable-next-line typescript/no-extraneous-class -- Mock the MatterNode constructor without starting a real server node.
      MatterNode: class {
        constructor(shared: unknown, pluginName: unknown) {
          createMatterNode(shared, pluginName);
          return { storeId: 'matterbridge-test', create, start, stop, destroy };
        }
      },
    }));
    wrapper = (await import('../src/runners/threadRootNode.js')).default;
    vi.spyOn(wrapper, 'logger').mockImplementation(() => {});
    vi.spyOn(wrapper.log, 'log').mockImplementation(() => {});
    wrapper.workerData = { ...workerData };
  });

  afterEach(() => {
    wrapper.destroy(true);
    vi.restoreAllMocks();
    vi.doUnmock('../src/matterNode.js');
  });

  test('should create the MatterNode for the plugin without starting it', async () => {
    await expect(wrapper.entrypoint(wrapper)).resolves.toBe(true);
    expect(wrapper.name).toBe('RootNode');
    expect(createMatterNode).toHaveBeenCalledWith(sharedMatterbridge, 'matterbridge-test');
    expect(create).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });

  test('should create the MatterNode in bridge mode without a plugin name', async () => {
    const { pluginName: _, ...bridgeWorkerData } = workerData;
    wrapper.workerData = bridgeWorkerData;
    await expect(wrapper.entrypoint(wrapper)).resolves.toBe(true);
    expect(createMatterNode).toHaveBeenCalledWith(sharedMatterbridge, undefined);
  });

  test('should create and start the MatterNode on startup and stop and destroy it on shutdown', async () => {
    await expect(wrapper.entrypoint(wrapper)).resolves.toBe(true);
    await wrapper.startup?.(wrapper);
    expect(create).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledTimes(1);
    expect(stop).not.toHaveBeenCalled();
    await wrapper.shutdown?.(wrapper);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledTimes(1);
    // The MatterNode is released after shutdown
    await wrapper.startup?.(wrapper);
    await wrapper.shutdown?.(wrapper);
    expect(start).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  test('should do nothing on startup and shutdown when the MatterNode was not created', async () => {
    await wrapper.startup?.(wrapper);
    await wrapper.shutdown?.(wrapper);
    expect(create).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
  });

  test('should report failure when the worker data is missing', async () => {
    wrapper.workerData = null;
    await expect(wrapper.entrypoint(wrapper)).resolves.toBe(false);
    expect(createMatterNode).not.toHaveBeenCalled();
  });

  test('should report failure when the worker data is not root node worker data', async () => {
    const { sharedMatterbridge: _, ...rest } = workerData;
    wrapper.workerData = rest as WorkerData;
    await expect(wrapper.entrypoint(wrapper)).resolves.toBe(false);
    expect(createMatterNode).not.toHaveBeenCalled();
  });

  test('should report failure when MatterNode construction fails', async () => {
    createMatterNode.mockImplementation(() => {
      throw new Error('MatterNode construction failed');
    });
    await expect(wrapper.entrypoint(wrapper)).resolves.toBe(false);
    await wrapper.startup?.(wrapper);
    expect(create).not.toHaveBeenCalled();
  });

  test('should reject startup when MatterNode creation rejects', async () => {
    create.mockRejectedValue(new Error('MatterNode creation failed'));
    await expect(wrapper.entrypoint(wrapper)).resolves.toBe(true);
    await expect(wrapper.startup?.(wrapper)).rejects.toThrow('MatterNode creation failed');
    expect(start).not.toHaveBeenCalled();
  });

  test('should reject startup when MatterNode start rejects', async () => {
    start.mockRejectedValue(new Error('MatterNode startup failed'));
    await expect(wrapper.entrypoint(wrapper)).resolves.toBe(true);
    await expect(wrapper.startup?.(wrapper)).rejects.toThrow('MatterNode startup failed');
    expect(create).toHaveBeenCalledTimes(1);
  });
});
