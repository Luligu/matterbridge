const NAME = 'JestHelpersMatterjs';
const MATTER_PORT = 9800;

import { jest } from '@jest/globals';
import { ServerNode } from '@matter/node';
import { bridge, MatterbridgeAccessoryPlatform, MatterbridgeDynamicPlatform, MatterbridgeEndpoint, onOffPlugInUnit } from '@matterbridge/core';
import { AnsiLogger, LogLevel, TimestampFormat } from 'node-ansi-logger';

import { flushAsync } from '../src/flushAsync.js';
import {
  addDevice,
  addMatterbridge,
  aggregator,
  closeServerNodeStores,
  createServerNode,
  createTestEnvironment,
  deleteDevice,
  destroyTestEnvironment,
  environment,
  getMatterbridge,
  server,
  startServerNode,
  stopServerNode,
} from '../src/jestMatterTest.js';
import { consoleDebugSpy, consoleErrorSpy, consoleInfoSpy, consoleLogSpy, consoleWarnSpy, log, loggerLogSpy, setDebug, setupTest } from '../src/jestSetupTest.js';
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

process.argv.push('--debug');

describe('Matter.js test environment', () => {
  let deviceServer: MatterbridgeEndpoint;
  let deviceAggregator: MatterbridgeEndpoint;

  beforeAll(async () => {});

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {});

  afterAll(() => {
    jest.restoreAllMocks();
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
    const matterbridge = await getMatterbridge();
    const config = { name: 'JestHelpersPlatform', type: 'Any', version: '1.0.0', debug: false, unregisterOnShutdown: false };
    const platform = new MatterbridgeAccessoryPlatform(matterbridge, log, config);
    expect(platform).toBeDefined();
    addMatterbridge(platform);
    expect(platform.name).toBe('JestHelpersPlatform');
    await platform.onShutdown();
  });

  test('should create a Dynamic platform', async () => {
    const matterbridge = await getMatterbridge();
    const config = { name: 'JestHelpersPlatform', type: 'Any', version: '1.0.0', debug: false, unregisterOnShutdown: false };
    const platform = new MatterbridgeDynamicPlatform(matterbridge, log, config);
    expect(platform).toBeDefined();
    addMatterbridge(platform);
    expect(platform.name).toBe('JestHelpersPlatform');
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

  test('should flushAsync', async () => {
    expect(await flushAsync()).toBeUndefined();
  });

  test('should flushAsync with parameters', async () => {
    expect(await flushAsync(1, 1, 100)).toBeUndefined();
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
    expect(server).toBeDefined();
    expect(server).toBeInstanceOf(ServerNode);
  });

  test('should stop a matter.js server node', async () => {
    await stopServerNode();
    expect(server).toBeDefined();
    expect(server).toBeInstanceOf(ServerNode);
  });

  test('should destroy a matter.js environment', async () => {
    await destroyTestEnvironment();
    expect(environment).toBeDefined();
  });

  test('should log keepAlive of matter.js environment', async () => {
    const log = new AnsiLogger({ logName: 'Matterbrdige instance', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });
    logKeepAlives(log);
    expect(environment).toBeDefined();
  });
});
