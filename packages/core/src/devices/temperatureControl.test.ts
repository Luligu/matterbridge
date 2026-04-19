// src\temperatureControl.test.ts
/* eslint-disable jest/no-standalone-expect */

const NAME = 'TemperatureControl';

import { jest } from '@jest/globals';

// Matterbridge
import { loggerErrorSpy, loggerFatalSpy, loggerWarnSpy, setupTest } from '../jestutils/jestSetupTest.js';
import { laundryDryer, laundryWasher } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { createLevelTemperatureControlClusterServer, createNumberTemperatureControlClusterServer } from './temperatureControl.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge Temperature Control', () => {
  let device: MatterbridgeEndpoint;

  beforeAll(async () => {});

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    expect(loggerWarnSpy).not.toHaveBeenCalled();
    expect(loggerErrorSpy).not.toHaveBeenCalled();
    expect(loggerFatalSpy).not.toHaveBeenCalled();
  });

  afterAll(async () => {
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('create a laundryDryer device with all parameters', async () => {
    device = new MatterbridgeEndpoint(laundryDryer, { id: 'TestDevice-001' });
    expect(device).toBeDefined();
    createNumberTemperatureControlClusterServer(device, 40 * 100, 30 * 100, 60 * 100, 10 * 100);
  });

  test('create a laundryDryer device with default parameters', async () => {
    device = new MatterbridgeEndpoint(laundryDryer, { id: 'TestDevice-002' });
    expect(device).toBeDefined();
    createNumberTemperatureControlClusterServer(device);
  });

  test('create a laundryWasher device with all parameters', async () => {
    device = new MatterbridgeEndpoint(laundryWasher, { id: 'TestDevice-003' });
    expect(device).toBeDefined();
    createLevelTemperatureControlClusterServer(device, 1, ['Cold', 'Warm', 'Hot', '30°', '40°', '60°', '80°']);
  });

  test('create a laundryWasher device with default parameters', async () => {
    device = new MatterbridgeEndpoint(laundryWasher, { id: 'TestDevice-004' });
    expect(device).toBeDefined();
    createLevelTemperatureControlClusterServer(device);
  });

  test('create a laundryWasher device with custom parameters', async () => {
    device = new MatterbridgeEndpoint(laundryWasher, { id: 'TestDevice-005' });
    expect(device).toBeDefined();
    createLevelTemperatureControlClusterServer(device, 0, ['Warm']);
  });
});
