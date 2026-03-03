// src\matterbridgeEndpointHelpers.test.ts

const NAME = 'MatterbridgeEndpointHelpers';
const MATTER_PORT = 11300;
const HOMEDIR = path.join('jest', NAME);
const MATTER_CREATE_ONLY = true;

import path from 'node:path';

import { jest } from '@jest/globals';
import { NumberTag, PowerSourceTag } from '@matter/node';
import { VendorId } from '@matter/types';

import { createMatterbridgeEnvironment, destroyMatterbridgeEnvironment, setupTest, startMatterbridgeEnvironment, stopMatterbridgeEnvironment } from './jestutils/jestHelpers.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
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
  getSemtag,
} from './matterbridgeEndpointHelpers.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Options helpers', () => {
  let device: MatterbridgeEndpoint;

  beforeAll(async () => {
    // Create Matterbridge environment
    await createMatterbridgeEnvironment(NAME, MATTER_CREATE_ONLY);
    await startMatterbridgeEnvironment(MATTER_PORT, MATTER_CREATE_ONLY);
  });

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {});

  afterAll(async () => {
    // Destroy Matterbridge environment
    await stopMatterbridgeEnvironment(MATTER_CREATE_ONLY);
    await destroyMatterbridgeEnvironment(undefined, undefined, !MATTER_CREATE_ONLY);
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('getSemtag helper', () => {
    expect(getSemtag(PowerSourceTag.Solar)).toEqual({ label: null, mfgCode: null, namespaceId: PowerSourceTag.Solar.namespaceId, tag: PowerSourceTag.Solar.tag });
    expect(getSemtag(NumberTag.TwentyFour, 'My Label')).toEqual({ label: 'My Label', mfgCode: null, namespaceId: NumberTag.TwentyFour.namespaceId, tag: NumberTag.TwentyFour.tag });
    expect(getSemtag(NumberTag.One, 'My Label', VendorId(12))).toEqual({
      label: 'My Label',
      mfgCode: 12,
      namespaceId: 7,
      tag: 1,
    });
    expect(getSemtag(NumberTag.One, '   0123456789012345678901234567890123456789012345678901234567890123456789   ', VendorId(12))).toEqual({
      label: '0123456789012345678901234567890123456789012345678901234567890123', // Label should be trimmed to 64 characters
      mfgCode: 12,
      namespaceId: 7,
      tag: 1,
    });
    expect(NumberTag.Two).toEqual({ label: 'Two', mfgCode: null, namespaceId: 7, tag: 2 });
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
