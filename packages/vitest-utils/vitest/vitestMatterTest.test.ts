const NAME = 'VitestHelpersMatterjs';
const MATTER_PORT = 9800;

import { ServerNode } from '@matter/node';
import { OnOffServer } from '@matter/node/behaviors/on-off';
import { bridge, MatterbridgeAccessoryPlatform, MatterbridgeDynamicPlatform, MatterbridgeEndpoint, onOffPlugInUnit } from '@matterbridge/core';
import { AnsiLogger, LogLevel, TimestampFormat } from 'node-ansi-logger';
import { vi } from 'vitest';

import { flushAsync } from '../src/flushAsync.js';
import { logKeepAlives } from '../src/logKeepAlives.js';
import {
  getEnhancedMoveToHueAndSaturationRequest,
  getEnhancedMoveToHueRequest,
  getMoveToColorRequest,
  getMoveToColorTemperatureRequest,
  getMoveToHueAndSaturationRequest,
  getMoveToHueRequest,
  getMoveToLevelRequest,
  getMoveToSaturationRequest,
} from '../src/matterRequest.js';
import {
  addBridgedEndpointMatterbridgeSpy,
  addDevice,
  addMatterbridge,
  addVirtualEndpointMatterbridgeSpy,
  aggregator,
  assertAllEndpointNumbersPersisted,
  closeServerNodeStores,
  createServerNode,
  createTestEnvironment,
  deleteDevice,
  destroyTestEnvironment,
  environment,
  flushAllEndpointNumberPersistence,
  flushServerNode,
  getMatterbridge,
  removeAllBridgedEndpointsMatterbridgeSpy,
  removeBridgedEndpointMatterbridgeSpy,
  server,
  startServerNode,
  stopServerNode,
} from '../src/vitestMatterTest.js';
import { consoleDebugSpy, consoleErrorSpy, consoleInfoSpy, consoleLogSpy, consoleWarnSpy, log, loggerLogSpy, setDebug, setupTest } from '../src/vitestSetupTest.js';

process.argv.push('--debug');

describe('Matter.js test environment', () => {
  let deviceServer: MatterbridgeEndpoint;
  let deviceAggregator: MatterbridgeEndpoint;

  beforeAll(async () => {});

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {});

  afterAll(() => {
    vi.restoreAllMocks();
  });

  test('should setup the test', async () => {
    await setupTest(NAME, false);
    expect(loggerLogSpy).toBeDefined();
    expect(consoleLogSpy).toBeDefined();
    expect(consoleDebugSpy).toBeDefined();
    expect(consoleInfoSpy).toBeDefined();
    expect(consoleWarnSpy).toBeDefined();
    expect(consoleErrorSpy).toBeDefined();
    await setupTest(NAME, true);
    expect(loggerLogSpy).toBeDefined();
    expect(consoleLogSpy).toBeDefined();
    expect(consoleDebugSpy).toBeDefined();
    expect(consoleInfoSpy).toBeDefined();
    expect(consoleWarnSpy).toBeDefined();
    expect(consoleErrorSpy).toBeDefined();
  });

  test('should set debug mode', async () => {
    await setDebug(true);
    expect(loggerLogSpy).toBeDefined();
    expect(consoleLogSpy).toBeDefined();
    expect(consoleDebugSpy).toBeDefined();
    expect(consoleInfoSpy).toBeDefined();
    expect(consoleWarnSpy).toBeDefined();
    expect(consoleErrorSpy).toBeDefined();
    await setDebug(false);
    expect(loggerLogSpy).toBeDefined();
    expect(consoleLogSpy).toBeDefined();
    expect(consoleDebugSpy).toBeDefined();
    expect(consoleInfoSpy).toBeDefined();
    expect(consoleWarnSpy).toBeDefined();
    expect(consoleErrorSpy).toBeDefined();
  });

  test('should create a matter.js environment', async () => {
    await createTestEnvironment();
    expect(environment).toBeDefined();
  });

  test('should reject startServerNode when the server node is not created', async () => {
    expect(server).toBeUndefined();
    expect(aggregator).toBeUndefined();
    await expect(startServerNode()).rejects.toThrow('Server node and aggregator must be created before starting the server');
  });

  test('should create a matter.js server node', async () => {
    await createServerNode(MATTER_PORT, bridge.code);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('should start a matter.js server node', async () => {
    await startServerNode();
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('should create an Accessory platform', async () => {
    const matterbridge = getMatterbridge();
    const config = { name: 'VitestHelpersPlatform', type: 'Any', version: '1.0.0', debug: false, unregisterOnShutdown: false };
    const platform = new MatterbridgeAccessoryPlatform(matterbridge, log, config);
    expect(platform).toBeDefined();
    addMatterbridge(platform);
    expect(platform.name).toBe('VitestHelpersPlatform');
    await platform.onShutdown();
  });

  test('should create a Dynamic platform', async () => {
    const matterbridge = getMatterbridge();
    const config = { name: 'VitestHelpersPlatform', type: 'Any', version: '1.0.0', debug: false, unregisterOnShutdown: false };
    const platform = new MatterbridgeDynamicPlatform(matterbridge, log, config);
    expect(platform).toBeDefined();
    addMatterbridge(platform);
    expect(platform.name).toBe('VitestHelpersPlatform');
    await platform.onShutdown();
  });

  test('should add a device to a matter.js server node', async () => {
    deviceServer = new MatterbridgeEndpoint(onOffPlugInUnit, { id: 'outlet1' });
    deviceServer.addRequiredClusters();
    expect(await addDevice(server, deviceServer)).toBeTruthy();
  });

  test('should add a device to a matter.js aggregator node', async () => {
    deviceAggregator = new MatterbridgeEndpoint(onOffPlugInUnit, { id: 'outlet2' });
    deviceAggregator.addRequiredClusters();
    expect(await addDevice(aggregator, deviceAggregator)).toBeTruthy();
  });

  test('should get the requests', async () => {
    expect(getMoveToLevelRequest(100, 0, false)).toBeDefined();
    expect(getMoveToColorTemperatureRequest(250, 0, false)).toBeDefined();
    expect(getMoveToHueRequest(100, 0, false)).toBeDefined();
    expect(getEnhancedMoveToHueRequest(30000, 0, false)).toBeDefined();
    expect(getMoveToSaturationRequest(100, 0, false)).toBeDefined();
    expect(getMoveToHueAndSaturationRequest(100, 100, 0, false)).toBeDefined();
    expect(getEnhancedMoveToHueAndSaturationRequest(30000, 100, 0, false)).toBeDefined();
    expect(getMoveToColorRequest(30000, 30000, 0, false)).toBeDefined();
  });

  test('should delete a device from a matter.js server node', async () => {
    const state = deviceServer.state;
    expect(await deleteDevice(server, deviceServer)).toBeTruthy();
  });

  test('should delete a device from a matter.js aggregator node', async () => {
    const state = deviceAggregator.state;
    expect(await deleteDevice(aggregator, deviceAggregator)).toBeTruthy();
  });

  test('should close server node stores', async () => {
    await closeServerNodeStores();
    await closeServerNodeStores(server);
    expect(server).toBeDefined();
    expect(server).toBeInstanceOf(ServerNode);
  });

  test('should stop a matter.js server node', async () => {
    await stopServerNode();
    expect(server).toBeDefined();
    expect(server).toBeInstanceOf(ServerNode);
  });

  test('should create a matter.js server node without starting it', async () => {
    await createServerNode(MATTER_PORT);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('should reject startServerNode when the server start fails', async () => {
    const startSpy = vi.spyOn(server, 'start').mockRejectedValueOnce(new Error('Start failed'));
    await expect(startServerNode()).rejects.toThrow('Start failed');
    startSpy.mockRestore();
  });

  test('should assert all endpoint numbers persisted on a server node without parts', async () => {
    const fakeServer = {
      env: { get: () => ({ endpointStores: { close: async () => {} }, storeForEndpoint: () => ({ number: undefined }) }) },
      maybeNumber: 0,
      parts: undefined,
    } as unknown as ServerNode;
    await expect(assertAllEndpointNumbersPersisted(fakeServer)).resolves.toBe(1);
  });

  test('should addBridgedEndpoint removeBridgedEndpoint removeAllBridgedEndpoints addVirtualEndpoint', async () => {
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
    expect(aggregator.parts.size).toBe(0);
    await flushAllEndpointNumberPersistence(server);

    const device = new MatterbridgeEndpoint(onOffPlugInUnit, { id: 'outlet3' });
    device.addRequiredClusters();
    await expect(addBridgedEndpointMatterbridgeSpy('vitest', device)).resolves.toBeTruthy();
    expect(addBridgedEndpointMatterbridgeSpy).toHaveBeenCalledWith('vitest', device);
    expect(aggregator.parts.size).toBe(1);

    const callback = vi.fn(async () => {});
    await expect(addVirtualEndpointMatterbridgeSpy('vitest', 'Restart Matterbridge', 'switch', callback)).resolves.toBeTruthy();
    expect(addVirtualEndpointMatterbridgeSpy).toHaveBeenCalledWith('vitest', 'Restart Matterbridge', 'switch', callback);
    expect(aggregator.parts.size).toBe(2);

    const virtual = [...aggregator.parts].find((part) => part.id === 'RestartMatterbridge:switch');
    expect(virtual).toBeDefined();
    if (!virtual) throw new Error('Virtual endpoint not found');
    expect(virtual.stateOf(OnOffServer).onOff).toBe(false);
    await virtual.setStateOf(OnOffServer, { onOff: true });
    await flushAsync(1, 1, 100);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(virtual.stateOf(OnOffServer).onOff).toBe(false);

    await expect(removeBridgedEndpointMatterbridgeSpy('vitest', device)).resolves.toBeTruthy();
    expect(removeBridgedEndpointMatterbridgeSpy).toHaveBeenCalledWith('vitest', device);
    expect(aggregator.parts.size).toBe(1);

    await expect(removeAllBridgedEndpointsMatterbridgeSpy('vitest')).resolves.toBeTruthy();
    expect(removeAllBridgedEndpointsMatterbridgeSpy).toHaveBeenCalledWith('vitest');
    expect(aggregator.parts.size).toBe(0);
    await flushAllEndpointNumberPersistence(server);
  });

  test('should reject addBridgedEndpoint removeBridgedEndpoint removeAllBridgedEndpoints addVirtualEndpoint', async () => {
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
    expect(aggregator.parts.size).toBe(0);
    await flushAllEndpointNumberPersistence(server);

    // addBridgedEndpoint and addVirtualEndpoint reject when the aggregator add fails
    const addSpy = vi.spyOn(aggregator, 'add').mockImplementation(async () => {
      throw new Error('Add failed');
    });
    const device = new MatterbridgeEndpoint(onOffPlugInUnit, { id: 'outlet4' });
    device.addRequiredClusters();
    await expect(addBridgedEndpointMatterbridgeSpy('vitest', device)).rejects.toThrow('Add failed');
    const callback = vi.fn(async () => {});
    await expect(addVirtualEndpointMatterbridgeSpy('vitest', 'Restart Matterbridge', 'switch', callback)).rejects.toThrow('Add failed');
    addSpy.mockRestore();
    expect(aggregator.parts.size).toBe(0);

    // removeBridgedEndpoint and removeAllBridgedEndpoints reject when the device delete fails
    await expect(addBridgedEndpointMatterbridgeSpy('vitest', device)).resolves.toBeTruthy();
    expect(aggregator.parts.size).toBe(1);
    const deleteSpy = vi.spyOn(device, 'delete').mockRejectedValue(new Error('Delete failed'));
    await expect(removeBridgedEndpointMatterbridgeSpy('vitest', device)).rejects.toThrow('Delete failed');
    await expect(removeAllBridgedEndpointsMatterbridgeSpy('vitest')).rejects.toThrow('Delete failed');
    expect(aggregator.parts.size).toBe(1);
    deleteSpy.mockRestore();

    await expect(removeAllBridgedEndpointsMatterbridgeSpy('vitest')).resolves.toBeTruthy();
    expect(aggregator.parts.size).toBe(0);
    await flushAllEndpointNumberPersistence(server);
  });

  test('should flush a matter.js server node', async () => {
    await flushServerNode();
    expect(server).toBeDefined();
    expect(server).toBeInstanceOf(ServerNode);
  });

  test('should destroy a matter.js environment', async () => {
    await destroyTestEnvironment();
    expect(environment).toBeDefined();
  });
});
