// src\waterHeater.test.ts

const MATTER_PORT = 0;
const NAME = 'TemperatureControl';
const HOMEDIR = path.join('jest', NAME);

import path from 'node:path';

import { jest } from '@jest/globals';
// @matter

// Matterbridge
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import {
  setupTest,
} from '../jestutils/jestHelpers.js';
import { laundryDryer } from '../matterbridgeDeviceTypes.js';
import { createLevelTemperatureControlClusterServer, createNumberTemperatureControlClusterServer } from './temperatureControl.js';


// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge Water Heater', () => {
  let device: MatterbridgeEndpoint;

  beforeAll(async () => {});

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('create a water heater device with all parameters', async () => {
    device = new MatterbridgeEndpoint(laundryDryer, { id: 'TestDevice-001' });
    expect(device).toBeDefined();
    createNumberTemperatureControlClusterServer(device, 40 * 100, 30 * 100, 60 * 100, 10 * 100);
  });

  test('create a water heater device with all parameters', async () => {
    device = new MatterbridgeEndpoint(laundryDryer, { id: 'TestDevice-002' });
    expect(device).toBeDefined();
    createNumberTemperatureControlClusterServer(device);
  });

  test('create a water heater device with all parameters', async () => {
    device = new MatterbridgeEndpoint(laundryDryer, { id: 'TestDevice-002' });
    expect(device).toBeDefined();
    createLevelTemperatureControlClusterServer(device, 1, ['Cold', 'Warm', 'Hot', '30°', '40°', '60°', '80°']);
  });

  test('create a water heater device with all parameters', async () => {
    device = new MatterbridgeEndpoint(laundryDryer, { id: 'TestDevice-002' });
    expect(device).toBeDefined();
    createLevelTemperatureControlClusterServer(device);
  });
});
