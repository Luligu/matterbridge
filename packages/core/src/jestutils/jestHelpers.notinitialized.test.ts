import path from 'node:path';

import { jest } from '@jest/globals';
import { Endpoint, ServerNode } from '@matter/node';
import { AggregatorEndpoint } from '@matter/node/endpoints/aggregator';

import { Matterbridge } from '../matterbridge.js';
import { onOffOutlet } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import {
  addMatterbridgePlatform,
  createMatterbridgeEnvironment,
  destroyMatterbridgeEnvironment,
  matterbridge,
  startMatterbridgeEnvironment,
  stopMatterbridgeEnvironment,
} from './jestMatterbridgeTest.js';
import { addDevice, deleteDevice } from './jestMatterTest.js';
import { consoleDebugSpy, consoleErrorSpy, consoleInfoSpy, consoleLogSpy, consoleWarnSpy, loggerLogSpy, setDebug, setupTest } from './jestSetupTest.js';

process.argv.push('--debug');

describe('Matterbridge not initialized test environment', () => {
  const MATTER_PORT = 8502;
  const NAME = 'JestHelpersMatterbridgeNotInitialized';
  const HOMEDIR = path.join('.cache', 'jest', NAME);

  let server: ServerNode<ServerNode.RootEndpoint>;
  let aggregator: Endpoint<AggregatorEndpoint>;

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
    await createMatterbridgeEnvironment();
    expect(matterbridge).toBeDefined();
    expect(matterbridge).toBeInstanceOf(Matterbridge);
  });

  test('should start a Matterbridge instance', async () => {
    [server, aggregator] = await startMatterbridgeEnvironment(MATTER_PORT);
    expect(server).toBeDefined();
    expect(server).toBeInstanceOf(ServerNode);
    expect(aggregator).toBeDefined();
    expect(aggregator).toBeInstanceOf(Endpoint);
    expect(server.lifecycle.isOnline).toBeTruthy();
  });

  test('should add a Matterbridge platform', async () => {
    const platform = {
      name: 'JestHelpersPlatform',
      type: 'Any',
      version: '1.0.0',
      config: { name: 'JestHelpersPlatform', type: 'Any', version: '1.0.0', debug: false, unregisterOnShutdown: false },
    } as any;
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
