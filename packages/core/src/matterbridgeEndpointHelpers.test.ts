// src\matterbridgeEndpointHelpers.test.ts

const NAME = 'MatterbridgeEndpointHelpers';
const HOMEDIR = path.join('jest', NAME);

import path from 'node:path';

import { jest } from '@jest/globals';

import { setupTest } from './jestutils/jestHelpers.js';
import {
  getApparentElectricalPowerMeasurementClusterServer,
  getDefaultDeviceEnergyManagementClusterServer,
  getDefaultDeviceEnergyManagementModeClusterServer,
  getDefaultElectricalEnergyMeasurementClusterServer,
  getDefaultElectricalPowerMeasurementClusterServer,
  getDefaultFlowMeasurementClusterServer,
  getDefaultIlluminanceMeasurementClusterServer,
  getDefaultOccupancySensingClusterServer,
  getDefaultOperationalStateClusterServer,
  getDefaultPowerSourceBatteryClusterServer,
  getDefaultPowerSourceRechargeableBatteryClusterServer,
  getDefaultPowerSourceReplaceableBatteryClusterServer,
  getDefaultPressureMeasurementClusterServer,
  getDefaultRelativeHumidityMeasurementClusterServer,
  getDefaultTemperatureMeasurementClusterServer,
} from './matterbridgeEndpointHelpers.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Options helpers', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('options helpers', () => {
    expect(getDefaultPowerSourceBatteryClusterServer()).toBeDefined();
    expect(getDefaultPowerSourceReplaceableBatteryClusterServer()).toBeDefined();
    expect(getDefaultPowerSourceRechargeableBatteryClusterServer()).toBeDefined();
    expect(getDefaultElectricalEnergyMeasurementClusterServer()).toBeDefined();
    expect(getDefaultElectricalPowerMeasurementClusterServer()).toBeDefined();
    expect(getApparentElectricalPowerMeasurementClusterServer()).toBeDefined();
    expect(getDefaultDeviceEnergyManagementClusterServer()).toBeDefined();
    expect(getDefaultDeviceEnergyManagementModeClusterServer()).toBeDefined();
    expect(getDefaultOperationalStateClusterServer()).toBeDefined();
    expect(getDefaultTemperatureMeasurementClusterServer()).toBeDefined();
    expect(getDefaultRelativeHumidityMeasurementClusterServer()).toBeDefined();
    expect(getDefaultPressureMeasurementClusterServer()).toBeDefined();
    expect(getDefaultIlluminanceMeasurementClusterServer()).toBeDefined();
    expect(getDefaultFlowMeasurementClusterServer()).toBeDefined();
    expect(getDefaultOccupancySensingClusterServer()).toBeDefined();
  });
});
