/**
 * @file packages/core/buntest/threadRootNode.test.ts
 * @description Tests RootNode thread initialization and lifetime.
 * @author Luca Liguori
 */

import { afterAll, beforeAll, beforeEach, describe, expect, mock, test, vi } from 'bun:test';

import { resetTest, setupTest } from '@matterbridge/test-utils/buntest/setup';
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

  beforeAll(async () => {
    // Mock the MatterNode module before the runner imports it lazily, so no real server node is started.
    await mock.module('../src/matterNode.js', () => ({
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
  });

  beforeEach(() => {
    create.mockReset().mockImplementation(async () => await Promise.resolve());
    start.mockReset().mockImplementation(async () => await Promise.resolve());
    stop.mockReset().mockImplementation(async () => await Promise.resolve());
    destroy.mockReset().mockImplementation(async () => await Promise.resolve());
    createMatterNode.mockReset();
    wrapper.workerData = { ...workerData };
  });

  afterAll(() => {
    wrapper.destroy(true);
    mock.restore();
    resetTest();
  });

  // The runner keeps the MatterNode in module state across tests: this test must run before any successful entrypoint
  test('should do nothing on startup and shutdown when the MatterNode was not created', async () => {
    await wrapper.startup?.(wrapper);
    await wrapper.shutdown?.(wrapper);
    expect(create).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
  });

  test('should create the MatterNode for the plugin without starting it', async () => {
    expect(await wrapper.entrypoint(wrapper)).toBe(true);
    expect(wrapper.name).toBe('RootNode');
    expect(createMatterNode).toHaveBeenCalledWith(sharedMatterbridge, 'matterbridge-test');
    expect(create).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });

  test('should create the MatterNode in bridge mode without a plugin name', async () => {
    const { pluginName: _, ...bridgeWorkerData } = workerData;
    wrapper.workerData = bridgeWorkerData;
    expect(await wrapper.entrypoint(wrapper)).toBe(true);
    expect(createMatterNode).toHaveBeenCalledWith(sharedMatterbridge, undefined);
  });

  test('should create and start the MatterNode on startup and stop and destroy it on shutdown', async () => {
    expect(await wrapper.entrypoint(wrapper)).toBe(true);
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

  test('should report failure when the worker data is missing', async () => {
    wrapper.workerData = null;
    expect(await wrapper.entrypoint(wrapper)).toBe(false);
    expect(createMatterNode).not.toHaveBeenCalled();
  });

  test('should report failure when the worker data is not root node worker data', async () => {
    const { sharedMatterbridge: _, ...rest } = workerData;
    wrapper.workerData = rest as WorkerData;
    expect(await wrapper.entrypoint(wrapper)).toBe(false);
    expect(createMatterNode).not.toHaveBeenCalled();
  });

  test('should report failure when MatterNode construction fails', async () => {
    createMatterNode.mockImplementation(() => {
      throw new Error('MatterNode construction failed');
    });
    expect(await wrapper.entrypoint(wrapper)).toBe(false);
    expect(create).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });

  test('should reject startup when MatterNode creation rejects', async () => {
    create.mockRejectedValue(new Error('MatterNode creation failed'));
    expect(await wrapper.entrypoint(wrapper)).toBe(true);
    let error: unknown;
    await wrapper.startup?.(wrapper).catch((err: unknown) => (error = err));
    expect((error as Error).message).toBe('MatterNode creation failed');
    expect(start).not.toHaveBeenCalled();
  });

  test('should reject startup when MatterNode start rejects', async () => {
    start.mockRejectedValue(new Error('MatterNode startup failed'));
    expect(await wrapper.entrypoint(wrapper)).toBe(true);
    let error: unknown;
    await wrapper.startup?.(wrapper).catch((err: unknown) => (error = err));
    expect((error as Error).message).toBe('MatterNode startup failed');
    expect(create).toHaveBeenCalledTimes(1);
  });
});
