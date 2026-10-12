/**
 * @file packages/core/vitest/matterNode.quiet.test.ts
 * @description This file contains the tests for the MatterNode class without verbose, debug, file loggers and mDNS interface.
 * @author Luca Liguori
 */

const MATTER_PORT = 10500;
const NAME = 'MatterNodeQuiet';
const PASSCODE = 123462;
const DISCRIMINATOR = 3866;

import { Environment, LogFormat as MatterLogFormat } from '@matter/general';
import { getSharedMatterbridge } from '@matterbridge/test-utils/vitest/matter';
import { loggerDebugSpy, setupTest } from '@matterbridge/test-utils/vitest/setup';
import type { SharedMatterbridge } from '@matterbridge/types';
import { AnsiLogger, LogLevel } from 'node-ansi-logger';

import type { MatterbridgeEndpoint } from '../src/matterbridgeEndpoint.js';
import { MatterNode } from '../src/matterNode.js';
import type { Plugin } from '../src/pluginManager.js';

// Setup the test environment without --verbose and --debug
await setupTest(NAME, false, []);

const matterbridge: SharedMatterbridge = {
  ...getSharedMatterbridge(),
  bridgeMode: 'bridge',
  fileLogger: false,
  matterFileLogger: false,
  port: MATTER_PORT,
  discriminator: DISCRIMINATOR,
  passcode: PASSCODE,
  mdnsInterface: undefined,
};

describe('MatterNode quiet', () => {
  let matter: MatterNode;

  beforeAll(() => {
    const savedNoColor = process.env.NO_COLOR;
    process.env.NO_COLOR = '1';
    const setGlobalLogfileSpy = vi.spyOn(AnsiLogger, 'setGlobalLogfile');
    try {
      matter = new MatterNode(matterbridge);
      expect(setGlobalLogfileSpy).not.toHaveBeenCalled();
    } finally {
      setGlobalLogfileSpy.mockRestore();
      if (savedNoColor === undefined) delete process.env.NO_COLOR;
      else process.env.NO_COLOR = savedNoColor;
    }
  });

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterAll(() => {
    // Restore all mocks
    vi.restoreAllMocks();
  });

  test('should create a quiet MatterNode when verbose, debug, file loggers and mDNS interface are disabled', async () => {
    expect(matter).toBeInstanceOf(MatterNode);
    // @ts-expect-error access private property
    expect(matter.pluginManager.log.logLevel).toBe(LogLevel.INFO);
    expect(Environment.default.vars.get('log.format')).toBe(MatterLogFormat.PLAIN);
    expect(matter.mdnsInterface).toBeUndefined();

    // Let the MdnsService ready callback run
    await matter.matterMdnsService?.construction.ready;
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(loggerDebugSpy).not.toHaveBeenCalledWith('Matter MdnsService is ready');
  });

  test('should handle broadcast messages without debug logs when verbose is disabled', async () => {
    await matter.msgHandler({ type: 'unknown', id: 1, timestamp: Date.now(), src: 'test', dst: 'matter', params: {} } as any);
    await matter.msgHandler({ type: 'unknown', id: 2, timestamp: Date.now(), src: 'test', dst: 'matter', result: {} } as any);
    expect(loggerDebugSpy).not.toHaveBeenCalledWith(expect.stringContaining('broadcast request'));
    expect(loggerDebugSpy).not.toHaveBeenCalledWith(expect.stringContaining('broadcast response'));
  });

  test('should wait the default 2000 ms when MATTERBRIDGE_REMOVE_ALL_ENDPOINT_TIMEOUT_MS is not set', async () => {
    const savedTimeout = process.env.MATTERBRIDGE_REMOVE_ALL_ENDPOINT_TIMEOUT_MS;
    delete process.env.MATTERBRIDGE_REMOVE_ALL_ENDPOINT_TIMEOUT_MS;
    const realSetTimeout = globalThis.setTimeout;
    const getSpy = vi.spyOn(matter.pluginManager, 'get').mockReturnValueOnce({ name: 'matterbridge-quiet', registeredDevices: 0 } as Plugin);
    // @ts-expect-error access private property
    const fetchSpy = vi.spyOn(matter.server, 'fetch').mockResolvedValueOnce({ result: { devices: [] } });
    // Run the default 2000 ms delay immediately
    const setTimeoutSpy = vi
      .spyOn(globalThis, 'setTimeout')
      .mockImplementation(((callback: () => void, ms?: number) => realSetTimeout(callback, ms === 2000 ? 0 : ms)) as typeof setTimeout);
    try {
      await matter.removeAllBridgedEndpoints('matterbridge-quiet', 10);
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 2000);
    } finally {
      setTimeoutSpy.mockRestore();
      fetchSpy.mockRestore();
      getSpy.mockRestore();
      if (savedTimeout !== undefined) process.env.MATTERBRIDGE_REMOVE_ALL_ENDPOINT_TIMEOUT_MS = savedTimeout;
    }
  });

  test('should skip subscriptions and callbacks when the plugin or device data is incomplete', async () => {
    const plugin = { name: 'matterbridge-quiet', type: 'AccessoryPlatform' } as Plugin;
    const callbacks: ((value: boolean) => void)[] = [];
    const subscribe = (cluster: string, attribute: string, callback: (value: boolean) => void): number => callbacks.push(callback);
    const hasOnOff = (cluster: string, attribute: string): boolean => cluster === 'OnOff' && attribute === 'onOff';
    const child = { id: 'child', number: 3, hasAttributeServer: hasOnOff, subscribeAttribute: subscribe };
    const device = {
      plugin: 'matterbridge-quiet',
      serialNumber: 'SN1234567890',
      uniqueId: 'UI1234567890',
      maybeNumber: 2,
      number: 2,
      id: 'device',
      deviceName: 'Device',
      name: 'Device',
      hasAttributeServer: hasOnOff,
      subscribeAttribute: subscribe,
      getChildEndpoints: (): (typeof child)[] => [child],
    };

    // Incomplete plugin or device: nothing is subscribed
    await matter.subscribeAttributeChanged(undefined as unknown as Plugin, device as unknown as MatterbridgeEndpoint);
    await matter.subscribeAttributeChanged(plugin, { ...device, maybeNumber: undefined } as unknown as MatterbridgeEndpoint);
    expect(callbacks).toHaveLength(0);

    // Accessory plugin in childbridge mode: reachable, device and child callbacks
    (matterbridge as any).bridgeMode = 'childbridge';
    matter.serverNode = { eventsOf: () => ({ reachable$Changed: { on: (callback: (value: boolean) => void): number => callbacks.push(callback) } }) } as any;
    try {
      await matter.subscribeAttributeChanged(plugin, device as unknown as MatterbridgeEndpoint);
    } finally {
      matter.serverNode = undefined;
      (matterbridge as any).bridgeMode = 'bridge';
    }
    expect(callbacks).toHaveLength(3);

    // @ts-expect-error access private property
    const requestSpy = vi.spyOn(matter.server, 'request');
    for (const callback of callbacks) callback(true);
    expect(requestSpy).toHaveBeenCalledTimes(3);

    // The device lost its plugin: the callbacks are ignored
    requestSpy.mockClear();
    device.plugin = '';
    for (const callback of callbacks) callback(false);
    expect(requestSpy).not.toHaveBeenCalled();
    requestSpy.mockRestore();
  });

  test('should destroy the MatterNode without debug logs when verbose is disabled', async () => {
    await matter.destroy();
    expect(loggerDebugSpy).not.toHaveBeenCalledWith(expect.stringContaining('Destroying MatterNode instance'));
    expect(loggerDebugSpy).not.toHaveBeenCalledWith(expect.stringContaining('Destroyed MatterNode instance'));
  });
});
