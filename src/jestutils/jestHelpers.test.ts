import { jest } from '@jest/globals';
import { Endpoint, ServerNode } from '@matter/node';

import { Matterbridge } from '../matterbridge.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { onOffOutlet } from '../matterbridgeDeviceTypes.js';

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
  startMatterbridgeEnvironment,
  startServerNode,
  stopMatterbridgeEnvironment,
  stopServerNode,
} from './jestHelpers.js';

process.argv.push('--debug');

describe('Matterbridge instance', () => {
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
    await setupTest('JestHelpers');
    expect(loggerLogSpy).toBeDefined();
    expect(consoleLogSpy).toBeDefined();
    expect(consoleDebugSpy).toBeDefined();
    expect(consoleInfoSpy).toBeDefined();
    expect(consoleWarnSpy).toBeDefined();
    expect(consoleErrorSpy).toBeDefined();
  });

  test('should setup debug mode false', async () => {
    await setupTest('JestHelpers', false);
    expect(loggerLogSpy).toBeDefined();
    expect(consoleLogSpy).toBeDefined();
    expect(consoleDebugSpy).toBeDefined();
    expect(consoleInfoSpy).toBeDefined();
    expect(consoleWarnSpy).toBeDefined();
    expect(consoleErrorSpy).toBeDefined();
  });

  test('should setup debug mode true', async () => {
    await setupTest('JestHelpers', true);
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
    await createMatterbridgeEnvironment('JestHelpers');
    expect(matterbridge).toBeDefined();
    expect(matterbridge).toBeInstanceOf(Matterbridge);
  });

  test('should start a Matterbridge instance', async () => {
    await startMatterbridgeEnvironment(6000);
    expect(server).toBeDefined();
    expect(server).toBeInstanceOf(ServerNode);
    expect(aggregator).toBeDefined();
    expect(aggregator).toBeInstanceOf(Endpoint);
    expect(server.lifecycle.isOnline).toBeTruthy();
  });

  test('should add a Matterbridge platform', async () => {
    const platform = { type: 'Any', version: '1.0.0' } as any;
    addMatterbridgePlatform(platform, 'JestHelpersPlatform');
    expect(platform.name).toBe('JestHelpersPlatform');
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
  let device: MatterbridgeEndpoint;

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

  test('should set debug mode', async () => {
    setDebug(true);
    expect(loggerLogSpy).toBeDefined();
    expect(consoleLogSpy).toBeDefined();
    expect(consoleDebugSpy).toBeDefined();
    expect(consoleInfoSpy).toBeDefined();
    expect(consoleWarnSpy).toBeDefined();
    expect(consoleErrorSpy).toBeDefined();
    setDebug(false);
  });

  test('should create a matter.js environment', async () => {
    createTestEnvironment('JestHelpers');
    expect(environment).toBeDefined();
  });

  test('should start a matter.js server node', async () => {
    await startServerNode('JestHelpers', 6000);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('should add a device to a matter.js server node', async () => {
    device = new MatterbridgeEndpoint(onOffOutlet, { id: 'outlet1' });
    expect(await addDevice(aggregator, device)).toBeTruthy();
  });

  test('should flushAsync', async () => {
    expect(await flushAsync()).toBeUndefined();
  });

  test('should flushAsync with parameters', async () => {
    expect(await flushAsync(1, 1, 0)).toBeUndefined();
  });

  test('should delete a device from a matter.js server node', async () => {
    expect(await deleteDevice(aggregator, device)).toBeTruthy();
  });

  test('should stop a matter.js server node', async () => {
    await stopServerNode(server);
    expect(server).toBeDefined();
    expect(server).toBeInstanceOf(ServerNode);
  });
});
