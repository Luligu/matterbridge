// vitest/devices/temperatureControl.test.ts

const NAME = 'TemperatureControl';
const MATTER_PORT = 8024;
const MATTER_CREATE_ONLY = true;

import { loggerErrorSpy, loggerFatalSpy, loggerWarnSpy, setupTest } from '@matterbridge/vitest-utils';
import {
  addDevice,
  aggregator,
  createServerNode,
  createTestEnvironment,
  destroyTestEnvironment,
  flushServerNode,
  server,
  startServerNode,
  stopServerNode,
} from '@matterbridge/vitest-utils/matter';

import { createLevelTemperatureControlClusterServer, createNumberTemperatureControlClusterServer } from '../../src/devices/temperatureControl.js';
import { laundryDryer, laundryWasher } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge Temperature Control', () => {
  let device: MatterbridgeEndpoint;

  beforeAll(async () => {
    // Setup the Matter test environment
    await createTestEnvironment();
  });

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    expect(loggerWarnSpy).not.toHaveBeenCalled();
    expect(loggerErrorSpy).not.toHaveBeenCalled();
    expect(loggerFatalSpy).not.toHaveBeenCalled();
  });

  afterAll(async () => {
    // Destroy the Matter test environment
    await destroyTestEnvironment();
    // Restore all mocks
    vi.restoreAllMocks();
  });

  test('create the server node', async () => {
    await createServerNode(MATTER_PORT);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('create a laundryDryer device with all parameters', async () => {
    device = new MatterbridgeEndpoint(laundryDryer, { id: 'TestDevice-001' });
    expect(device).toBeDefined();
    createNumberTemperatureControlClusterServer(device, 40 * 100, 30 * 100, 60 * 100, 10 * 100);
    expect(await addDevice(aggregator, device)).toBeTruthy();
  });

  test('create a laundryDryer device with default parameters', async () => {
    device = new MatterbridgeEndpoint(laundryDryer, { id: 'TestDevice-002' });
    expect(device).toBeDefined();
    createNumberTemperatureControlClusterServer(device);
    expect(await addDevice(aggregator, device)).toBeTruthy();
  });

  test('create a laundryWasher device with all parameters', async () => {
    device = new MatterbridgeEndpoint(laundryWasher, { id: 'TestDevice-003' });
    expect(device).toBeDefined();
    createLevelTemperatureControlClusterServer(device, 1, ['Cold', 'Warm', 'Hot', '30°', '40°', '60°', '80°']);
    expect(await addDevice(aggregator, device)).toBeTruthy();
  });

  test('create a laundryWasher device with default parameters', async () => {
    device = new MatterbridgeEndpoint(laundryWasher, { id: 'TestDevice-004' });
    expect(device).toBeDefined();
    createLevelTemperatureControlClusterServer(device);
    expect(await addDevice(aggregator, device)).toBeTruthy();
  });

  test('create a laundryWasher device with custom parameters', async () => {
    device = new MatterbridgeEndpoint(laundryWasher, { id: 'TestDevice-005' });
    expect(device).toBeDefined();
    createLevelTemperatureControlClusterServer(device, 0, ['Warm']);
    expect(await addDevice(aggregator, device)).toBeTruthy();
  });

  test('start the server node', async () => {
    if (!MATTER_CREATE_ONLY) await startServerNode();
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('stop the server node', async () => {
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
    if (MATTER_CREATE_ONLY) await flushServerNode();
    else await stopServerNode();
  });
});
