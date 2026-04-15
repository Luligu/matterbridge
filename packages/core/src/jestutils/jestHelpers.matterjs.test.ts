import path from 'node:path';

import { jest } from '@jest/globals';
import { ServerNode } from '@matter/node';
import { AnsiLogger, LogLevel, TimestampFormat } from 'node-ansi-logger';

import { bridge, onOffOutlet } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import {
  addDevice,
  aggregator,
  closeServerNodeStores,
  consoleDebugSpy,
  consoleErrorSpy,
  consoleInfoSpy,
  consoleLogSpy,
  consoleWarnSpy,
  createServerNode,
  createTestEnvironment,
  deleteDevice,
  destroyTestEnvironment,
  environment,
  flushAsync,
  loggerLogSpy,
  logKeepAlives,
  server,
  setDebug,
  setupTest,
  startServerNode,
  stopServerNode,
} from './jestHelpers.js';

process.argv.push('--debug');

describe('Matter.js test environment', () => {
  const MATTER_PORT = 8501;
  const NAME = 'JestHelpersMatterjs';
  const HOMEDIR = path.join('.cache', 'jest', NAME);

  let deviceServer: MatterbridgeEndpoint;
  let deviceAggregator: MatterbridgeEndpoint;

  beforeAll(async () => {
    await setupTest(NAME, true);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
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
    createTestEnvironment(NAME);
    expect(environment).toBeDefined();
  });

  test('should create a matter.js server node', async () => {
    await createServerNode(NAME, MATTER_PORT, bridge.code);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('should start a matter.js server node', async () => {
    await startServerNode(NAME, MATTER_PORT, bridge.code);
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
    // process.stdout.write(`${NAME} deleting device from server with state: ${JSON.stringify(state, null, 2)}\n`);
    expect(await deleteDevice(server, deviceServer)).toBeTruthy();
  });

  test('should delete a device from a matter.js aggregator node', async () => {
    const state = deviceAggregator.state;
    // process.stdout.write(`${NAME} deleting device from aggregator with state: ${JSON.stringify(state, null, 2)}\n`);
    expect(await deleteDevice(aggregator, deviceAggregator)).toBeTruthy();
  });

  test('should close the ServerNodeStores of a matter.js environment', async () => {
    await closeServerNodeStores();
    expect(environment).toBeDefined();
  });

  test('should stop a matter.js server node', async () => {
    await stopServerNode(server);
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
