// src\matterbridgeEndpointHelpers.test.ts

const NAME = 'MatterbridgeEndpointHelpers';
const MATTER_PORT = 11300;
const HOMEDIR = path.join('jest', NAME);

import path from 'node:path';

import { jest } from '@jest/globals';
import { Logger } from '@matter/general';
import { BindingServer } from '@matter/node/behaviors/binding';
import { IdentifyClient, IdentifyServer } from '@matter/node/behaviors/identify';
import { OnOffClient } from '@matter/node/behaviors/on-off';
import { Identify } from '@matter/types/clusters/identify';

import {
  aggregator,
  createMatterbridgeEnvironment,
  destroyMatterbridgeEnvironment,
  setupTest,
  startMatterbridgeEnvironment,
  stopMatterbridgeEnvironment,
} from './jestutils/jestHelpers.js';
import { onOffSwitch } from './matterbridgeDeviceTypes.js';
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
} from './matterbridgeEndpointHelpers.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Options helpers', () => {
  let device: MatterbridgeEndpoint;

  beforeAll(async () => {
    // Create Matterbridge environment
    await createMatterbridgeEnvironment(NAME);
    await startMatterbridgeEnvironment(MATTER_PORT);
  });

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {});

  afterAll(async () => {
    // Destroy Matterbridge environment
    await stopMatterbridgeEnvironment();
    await destroyMatterbridgeEnvironment();
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

  // eslint-disable-next-line jest/no-commented-out-tests
  /*
  test('client cluster', async () => {
    device = new MatterbridgeEndpoint(onOffSwitch, { id: 'test-device' });
    expect(device).toBeDefined();
    device.behaviors.require(IdentifyServer, {
      identifyTime: 5,
      identifyType: Identify.IdentifyType.AudibleBeep,
    });
    device.behaviors.require(BindingServer);
    device.behaviors.require(IdentifyClient, {
      identifyTime: 5,
      identifyType: Identify.IdentifyType.AudibleBeep,
    });
    device.behaviors.require(OnOffClient, {
      onOff: false,
    });
    Logger.get('client').notice('Device behaviors:', device.behaviors);
    expect(await aggregator.add(device)).toBeDefined();
    Logger.get('client').notice('Device behaviors:', device);
  });
  */
});
