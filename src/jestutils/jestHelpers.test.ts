import path from 'node:path';

import { jest } from '@jest/globals';
import { Endpoint, ServerNode } from '@matter/node';

import { Matterbridge } from '../matterbridge.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { bridge, onOffOutlet } from '../matterbridgeDeviceTypes.js';

import {
  addDevice,
  addMatterbridgePlatform,
  aggregator,
  consoleDebugSpy,
  consoleErrorSpy,
  consoleInfoSpy,
  consoleLogSpy,
  consoleWarnSpy,
  createMatterbridgeEnvironment,
  createTestEnvironment,
  deleteDevice,
  destroyMatterbridgeEnvironment,
  environment,
  flushAsync,
  loggerLogSpy,
  matterbridge,
  server,
  setDebug,
  setupTest,
  startMatterbridge,
  startMatterbridgeEnvironment,
  startServerNode,
  stopMatterbridge,
  stopMatterbridgeEnvironment,
  stopServerNode,
} from './jestHelpers.js';

process.argv.push('--debug');

describe('Matterbridge instance', () => {
  const MATTER_PORT = 8501;
  const NAME = 'JestHelpersMatterbridge';
  const HOMEDIR = path.join('jest', NAME);

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

  test('should setup debug mode false as default', async () => {
    await setupTest(NAME);
    expect(loggerLogSpy).toBeDefined();
    expect(consoleLogSpy).toBeDefined();
    expect(consoleDebugSpy).toBeDefined();
    expect(consoleInfoSpy).toBeDefined();
    expect(consoleWarnSpy).toBeDefined();
    expect(consoleErrorSpy).toBeDefined();
  });

  test('should setup debug mode false', async () => {
    await setupTest(NAME, false);
    expect(loggerLogSpy).toBeDefined();
    expect(consoleLogSpy).toBeDefined();
    expect(consoleDebugSpy).toBeDefined();
    expect(consoleInfoSpy).toBeDefined();
    expect(consoleWarnSpy).toBeDefined();
    expect(consoleErrorSpy).toBeDefined();
  });

  test('should setup debug mode true', async () => {
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
    setDebug(false);
  });

  test('should create a Matterbridge instance', async () => {
    await createMatterbridgeEnvironment(NAME);
    expect(matterbridge).toBeDefined();
    expect(matterbridge).toBeInstanceOf(Matterbridge);
  });

  test('should start a Matterbridge instance', async () => {
    await startMatterbridgeEnvironment(MATTER_PORT);
    expect(server).toBeDefined();
    expect(server).toBeInstanceOf(ServerNode);
    expect(aggregator).toBeDefined();
    expect(aggregator).toBeInstanceOf(Endpoint);
    expect(server.lifecycle.isOnline).toBeTruthy();
  });

  test('should add a Matterbridge platform', async () => {
    const platform = { name: 'JestHelpersPlatform', type: 'Any', version: '1.0.0', config: { name: 'JestHelpersPlatform', type: 'Any', version: '1.0.0', debug: false, unregisterOnShutdown: false } } as any;
    addMatterbridgePlatform(platform);
    expect(platform.name).toBe('JestHelpersPlatform');
  });

  test('should add a device to the server node', async () => {
    deviceServer = new MatterbridgeEndpoint(onOffOutlet, { id: 'outlet1' });
    deviceServer.addRequiredClusterServers();
    expect(await addDevice(server, deviceServer)).toBeTruthy();
    const state = deviceServer.state;
    // process.stdout.write(`${NAME} added device to server with state: ${JSON.stringify(state, null, 2)}\n`);
    expect(await deleteDevice(server, deviceServer)).toBeTruthy();
  });

  test('should add a device to the aggregator node', async () => {
    deviceAggregator = new MatterbridgeEndpoint(onOffOutlet, { id: 'outlet2' });
    deviceAggregator.addRequiredClusterServers();
    expect(await addDevice(aggregator, deviceAggregator)).toBeTruthy();
    const state = deviceAggregator.state;
    // process.stdout.write(`${NAME} added device to aggregator with state: ${JSON.stringify(state, null, 2)}\n`);
    expect(await deleteDevice(aggregator, deviceAggregator)).toBeTruthy();
  });

  test('should stop a Matterbridge instance', async () => {
    await stopMatterbridgeEnvironment();
    expect(server.lifecycle.isOnline).toBeFalsy();
  });

  test('should destroy a Matterbridge instance', async () => {
    expect(matterbridge).toBeDefined();
    expect(matterbridge).toBeInstanceOf(Matterbridge);
    await destroyMatterbridgeEnvironment();
    // @ts-expect-error - accessing private member for testing
    expect(Matterbridge.instance).toBeUndefined();
  });
});

describe('Matter.js instance', () => {
  const MATTER_PORT = 8502;
  const NAME = 'JestHelpersMatterjs';
  const HOMEDIR = path.join('jest', NAME);

  let deviceServer: MatterbridgeEndpoint;
  let deviceAggregator: MatterbridgeEndpoint;

  beforeAll(async () => {
    await setDebug(true);
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

  test('should stop a matter.js server node', async () => {
    await stopServerNode(server);
    expect(server).toBeDefined();
    expect(server).toBeInstanceOf(ServerNode);
  });
});

describe('Matterbridge active instance', () => {
  beforeAll(async () => {
    await setupTest('MatterbridgeInitialized', false);
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

  test('should start the active Matterbridge instance in bridge mode', async () => {
    await startMatterbridge('bridge');
    expect(matterbridge).toBeDefined();
  });

  test('should stop the active Matterbridge instance in bridge mode', async () => {
    await stopMatterbridge();
    // @ts-expect-error - accessing private member for testing
    expect(Matterbridge.instance).toBeUndefined();
  });

  test('should start the active Matterbridge instance in childbridge mode', async () => {
    await startMatterbridge('childbridge');
    expect(matterbridge).toBeDefined();
  });

  test('should stop the active Matterbridge instance in childbridge mode', async () => {
    await stopMatterbridge();
    // @ts-expect-error - accessing private member for testing
    expect(Matterbridge.instance).toBeUndefined();
  });
});
