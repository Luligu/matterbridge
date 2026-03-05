// src\matterbridgeEndpointHelpers.test.ts

const NAME = 'MatterbridgeEndpointHelpers';
const MATTER_PORT = 11300;
const HOMEDIR = path.join('jest', NAME);
const MATTER_CREATE_ONLY = true;

import path from 'node:path';

import { jest } from '@jest/globals';
import { NumberTag, PowerSourceTag } from '@matter/node';
import { VendorId } from '@matter/types';
import { db, er, hk, or } from 'node-ansi-logger';

import {
  addDevice,
  aggregator,
  createMatterbridgeEnvironment,
  destroyMatterbridgeEnvironment,
  log,
  setupTest,
  startMatterbridgeEnvironment,
  stopMatterbridgeEnvironment,
} from './jestutils/jestHelpers.js';
import { temperatureSensor } from './matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import {
  getApparentElectricalPowerMeasurementClusterServer,
  getCluster,
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
  setCluster,
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
    expect(getSemtag(PowerSourceTag.Solar)).toEqual({ mfgCode: null, namespaceId: PowerSourceTag.Solar.namespaceId, tag: PowerSourceTag.Solar.tag });
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

  test('getCluster setCluster helper', async () => {
    device = new MatterbridgeEndpoint(temperatureSensor, { id: 'TestEndpoint' });
    device.createDefaultTemperatureMeasurementClusterServer(2200, 1000, 5000);
    device.addRequiredClusterServers();
    expect(device.hasClusterServer('TemperatureMeasurement')).toBe(true);

    const cluster = getCluster(device, 'TemperatureMeasurement', log);
    expect(cluster).toBeUndefined();
    expect(device.log.error).toHaveBeenCalledWith(expect.stringContaining(`getCluster ${hk}TemperatureMeasurement${er} error:`));

    const cluster0 = await setCluster(device, 'TemperatureMeasurement', { measuredValue: 2000 }, log);
    expect(cluster0).toBeFalsy();
    expect(device.log.error).toHaveBeenCalledWith(expect.stringContaining(`setCluster ${hk}TemperatureMeasurement${er} error:`));

    await addDevice(aggregator, device);

    const cluster1 = getCluster(device, 'NonExistentCluster', log);
    expect(cluster1).toBeUndefined();
    expect(device.log.error).toHaveBeenCalledWith(`getCluster error: cluster not found on endpoint ${or}${device.maybeId}${er}:${or}${device.maybeNumber}${er}`);

    const cluster2 = await setCluster(device, 'NonExistentCluster', { measuredValue: 2000 }, log);
    expect(cluster2).toBeFalsy();
    expect(device.log.error).toHaveBeenCalledWith(`setCluster error: cluster not found on endpoint ${or}${device.maybeId}${er}:${or}${device.maybeNumber}${er}`);

    const cluster3 = device.getCluster('TemperatureMeasurement', log);
    expect(cluster3).toMatchObject({ measuredValue: 2200, minMeasuredValue: 1000, maxMeasuredValue: 5000, tolerance: 0 });
    expect(device.log.info).toHaveBeenCalledWith(expect.stringContaining(`${db}Get endpoint ${or}${device.id}${db}:${or}${device.number}${db} cluster`));

    const cluster4 = await device.setCluster('TemperatureMeasurement', { measuredValue: 2000, minMeasuredValue: 0, maxMeasuredValue: 6000, tolerance: 100 }, log);
    expect(cluster4).toBeTruthy();
    expect(device.log.info).toHaveBeenCalledWith(expect.stringContaining(`${db}Set endpoint ${or}${device.id}${db}:${or}${device.number}${db} cluster`));

    const cluster5 = getCluster(device, 'TemperatureMeasurement', log);
    expect(cluster5).toMatchObject({ measuredValue: 2000, minMeasuredValue: 0, maxMeasuredValue: 6000, tolerance: 100 });
    expect(device.log.info).toHaveBeenCalledWith(expect.stringContaining(`${db}Get endpoint ${or}${device.id}${db}:${or}${device.number}${db} cluster`));
  });
});
