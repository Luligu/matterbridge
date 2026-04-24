const NAME = 'JestHelpersMatterjs';
const MATTER_PORT = 8501;

import { jest } from '@jest/globals';
import { ServerNode } from '@matter/node';
import { AnsiLogger, LogLevel, TimestampFormat } from 'node-ansi-logger';

import { bridge, onOffOutlet } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { flushAsync } from './jestFlushAsync.js';
import { logKeepAlives } from './jestLogAlive.js';
import {
  addDevice,
  aggregator,
  closeServerNodeStores,
  createServerNode,
  createTestEnvironment,
  deleteDevice,
  destroyTestEnvironment,
  environment,
  server,
  startServerNode,
  stopServerNode,
} from './jestMatterTest.js';
import { consoleDebugSpy, consoleErrorSpy, consoleInfoSpy, consoleLogSpy, consoleWarnSpy, loggerLogSpy, setDebug, setupTest } from './jestSetupTest.js';

process.argv.push('--debug');

describe('Matter.js test environment', () => {
  let deviceServer: MatterbridgeEndpoint;
  let deviceAggregator: MatterbridgeEndpoint;

  beforeAll(async () => {});

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

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

  test('should add a device to a matter.js server node', async () => {
    deviceServer = new MatterbridgeEndpoint(onOffOutlet, { id: 'outlet1' });
    deviceServer.addRequiredClusterServers();
    expect(await addDevice(server, deviceServer)).toBeTruthy();
  });

  test('should add a device to a matter.js aggregator node', async () => {
    deviceAggregator = new MatterbridgeEndpoint(onOffOutlet, { id: 'outlet2' });
    deviceAggregator.addRequiredClusterServers();
    expect(await addDevice(aggregator, deviceAggregator)).toBeTruthy();
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
