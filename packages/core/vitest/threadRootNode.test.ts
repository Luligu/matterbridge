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
  const createMatterNode = vi.fn();
  let wrapper: ThreadsWrapper;

  beforeEach(async () => {
    vi.resetModules();
    create.mockReset().mockImplementation(async () => await Promise.resolve());
    start.mockReset().mockImplementation(async () => await Promise.resolve());
    createMatterNode.mockReset();
    vi.doMock('../src/matterNode.js', () => ({
      // oxlint-disable-next-line typescript/no-extraneous-class -- Mock the MatterNode constructor without starting a real server node.
      MatterNode: class {
        constructor(shared: unknown, pluginName: unknown) {
          createMatterNode(shared, pluginName);
          return { create, start };
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

  test('should create and start the MatterNode for the plugin', async () => {
    await expect(wrapper.entrypoint(wrapper)).resolves.toBe(true);
    expect(wrapper.name).toBe('RootNode');
    expect(createMatterNode).toHaveBeenCalledWith(sharedMatterbridge, 'matterbridge-test');
    expect(create).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledTimes(1);
  });

  test('should create and start the MatterNode in bridge mode without a plugin name', async () => {
    const { pluginName: _, ...bridgeWorkerData } = workerData;
    wrapper.workerData = bridgeWorkerData;
    await expect(wrapper.entrypoint(wrapper)).resolves.toBe(true);
    expect(createMatterNode).toHaveBeenCalledWith(sharedMatterbridge, undefined);
    expect(create).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledTimes(1);
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
    expect(create).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });

  test('should report failure when MatterNode creation rejects', async () => {
    create.mockRejectedValue(new Error('MatterNode creation failed'));
    await expect(wrapper.entrypoint(wrapper)).resolves.toBe(false);
    expect(start).not.toHaveBeenCalled();
  });

  test('should report failure when MatterNode startup rejects', async () => {
    start.mockRejectedValue(new Error('MatterNode startup failed'));
    await expect(wrapper.entrypoint(wrapper)).resolves.toBe(false);
    expect(create).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledTimes(1);
  });
});
