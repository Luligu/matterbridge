// src/airConditioner.test.ts
// Tests the AirConditioner device using the simplified options constructor.

const MATTER_PORT = 6031; // Unique test port (ensure no collision with other device tests)
const NAME = 'AirConditioner';
const HOMEDIR = path.join('jest', NAME);

import path from 'node:path';

import { jest } from '@jest/globals';
import { AnsiLogger } from 'node-ansi-logger';
// @matter
import { LogFormat as MatterLogFormat, LogLevel as MatterLogLevel, Environment } from '@matter/general';
import { DeviceTypeId, VendorId } from '@matter/types';
import { MdnsService } from '@matter/protocol';
import { ServerNode, Endpoint } from '@matter/node';
import { AggregatorEndpoint } from '@matter/node/endpoints/aggregator';
import { Identify, OnOff, PowerSource, Thermostat, ThermostatUserInterfaceConfiguration, FanControl, ThermostatCluster } from '@matter/types/clusters';

// Matterbridge helpers
import { addDevice, createTestEnvironment, setupTest, startServerNode, stopServerNode } from '../utils/jestHelpers.js';

import { AirConditioner } from './airConditioner.js';

// Setup the Matter test environment
createTestEnvironment(HOMEDIR);

// Setup the test environment
setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  let server: ServerNode<ServerNode.RootEndpoint>;
  let aggregator: Endpoint<AggregatorEndpoint>;
  let device: AirConditioner;

  beforeAll(async () => {});

  beforeEach(async () => {
    jest.clearAllMocks();
  });

  afterEach(async () => {});

  afterAll(async () => {
    jest.restoreAllMocks();
  });

  test('create and start the server node', async () => {
    [server, aggregator] = await startServerNode(NAME, MATTER_PORT);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('create an air conditioner device (defaults)', async () => {
    device = new AirConditioner('Air Conditioner Test Device', 'AC123456');
    expect(device).toBeDefined();
    expect(device.id).toBe('AirConditionerTestDevice-AC123456');

    // Cluster servers existence
    expect(device.hasClusterServer(Identify.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(PowerSource.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(OnOff.Cluster.id)).toBeTruthy(); // Dead Front On/Off cluster
    expect(device.hasClusterServer(Thermostat.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(ThermostatUserInterfaceConfiguration.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(FanControl.Cluster.id)).toBeTruthy();
  });

  test('create an air conditioner device (custom options)', async () => {
    const custom = new AirConditioner('Bedroom AC', 'AC654321', { localTemperature: 30, percentSetting: 40 });
    expect(custom).toBeDefined();
    expect(custom.id).toBe('BedroomAC-AC654321');
    expect(custom.getClusterServerOptions(Thermostat.Cluster.id)).toEqual({
      absMaxCoolSetpointLimit: 5000,
      absMaxHeatSetpointLimit: 5000,
      absMinCoolSetpointLimit: 0,
      absMinHeatSetpointLimit: 0,
      controlSequenceOfOperation: 4,
      localTemperature: 3000,
      maxCoolSetpointLimit: 5000,
      maxHeatSetpointLimit: 5000,
      minCoolSetpointLimit: 0,
      minHeatSetpointLimit: 0,
      minSetpointDeadBand: 10,
      occupiedCoolingSetpoint: 2500,
      occupiedHeatingSetpoint: 2100,
      systemMode: 1,
      thermostatRunningMode: 0,
      thermostatRunningState: {
        cool: false,
        coolStage2: false,
        fan: false,
        fanStage2: false,
        fanStage3: false,
        heat: false,
        heatStage2: false,
      },
    });
    expect(custom.getClusterServerOptions(ThermostatUserInterfaceConfiguration.Cluster.id)).toEqual({ keypadLockout: 0, scheduleProgrammingVisibility: 0, temperatureDisplayMode: 0 });
    expect(custom.getClusterServerOptions(FanControl.Cluster.id)).toEqual({ fanMode: 0, fanModeSequence: 2, percentSetting: 40, percentCurrent: 0 });
  });

  test('add air conditioner to server', async () => {
    expect(await addDevice(server, device)).toBeTruthy();
  });

  test('fan control attributes check', async () => {
    // Presence
    expect(device.hasAttributeServer(FanControl.Cluster, 'percentSetting')).toBe(true);
    expect(device.hasAttributeServer(FanControl.Cluster, 'percentCurrent')).toBe(true);
    expect(device.hasAttributeServer(FanControl.Cluster, 'fanMode')).toBe(true);
    expect(device.hasAttributeServer(FanControl.Cluster, 'fanModeSequence')).toBe(true);
    // Default values from constructor (0,0)
    expect(device.getAttribute(FanControl.Cluster.id, 'percentSetting')).toBe(0);
    expect(device.getAttribute(FanControl.Cluster.id, 'percentCurrent')).toBe(0);
    expect(device.getAttribute(FanControl.Cluster.id, 'fanMode')).toBe(FanControl.FanMode.Off);
    expect(device.getAttribute(FanControl.Cluster.id, 'fanModeSequence')).toBe(FanControl.FanModeSequence.OffLowMedHighAuto);
  });

  test('thermostat attributes check', async () => {
    // Presence
    expect(device.hasClusterServer(Thermostat.Cluster.id)).toBe(true);
    expect(device.hasClusterServer(ThermostatCluster.with(Thermostat.Feature.AutoMode, Thermostat.Feature.Cooling, Thermostat.Feature.Heating))).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'localTemperature')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'occupiedHeatingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'occupiedCoolingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'minSetpointDeadBand')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'minHeatSetpointLimit')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'maxHeatSetpointLimit')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'minCoolSetpointLimit')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'maxCoolSetpointLimit')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'systemMode')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'thermostatRunningMode')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'thermostatRunningState')).toBe(true);
    // Default values (scaled by 100 for temperatures and 10 for minSetpointDeadBand)
    expect(device.getAttribute(Thermostat.Cluster.id, 'localTemperature')).toBe(2300);
    expect(device.getAttribute(Thermostat.Cluster.id, 'occupiedHeatingSetpoint')).toBe(2100);
    expect(device.getAttribute(Thermostat.Cluster.id, 'occupiedCoolingSetpoint')).toBe(2500);
    expect(device.getAttribute(Thermostat.Cluster.id, 'minSetpointDeadBand')).toBe(10);
    expect(device.getAttribute(Thermostat.Cluster.id, 'minHeatSetpointLimit')).toBe(0);
    expect(device.getAttribute(Thermostat.Cluster.id, 'maxHeatSetpointLimit')).toBe(5000);
    expect(device.getAttribute(Thermostat.Cluster.id, 'minCoolSetpointLimit')).toBe(0);
    expect(device.getAttribute(Thermostat.Cluster.id, 'maxCoolSetpointLimit')).toBe(5000);
    expect(device.getAttribute(Thermostat.Cluster.id, 'systemMode')).toBe(1);
    expect(device.getAttribute(Thermostat.Cluster.id, 'thermostatRunningMode')).toBe(0);
    expect(device.getAttribute(Thermostat.Cluster.id, 'thermostatRunningState')).toEqual({
      cool: false,
      coolStage2: false,
      fan: false,
      fanStage2: false,
      fanStage3: false,
      heat: false,
      heatStage2: false,
    });
  });

  test('thermostat UI configuration attributes check', async () => {
    // Presence
    expect(device.hasClusterServer(ThermostatUserInterfaceConfiguration.Cluster.id)).toBe(true);
    expect(device.hasAttributeServer(ThermostatUserInterfaceConfiguration.Cluster.id, 'temperatureDisplayMode')).toBe(true);
    expect(device.hasAttributeServer(ThermostatUserInterfaceConfiguration.Cluster.id, 'keypadLockout')).toBe(true);
    expect(device.hasAttributeServer(ThermostatUserInterfaceConfiguration.Cluster.id, 'scheduleProgrammingVisibility')).toBe(true);
    // Default values
    expect(device.getAttribute(ThermostatUserInterfaceConfiguration.Cluster.id, 'temperatureDisplayMode')).toBe(0);
    expect(device.getAttribute(ThermostatUserInterfaceConfiguration.Cluster.id, 'keypadLockout')).toBe(0);
    expect(device.getAttribute(ThermostatUserInterfaceConfiguration.Cluster.id, 'scheduleProgrammingVisibility')).toBe(0);
  });

  test('device forEachAttribute', async () => {
    const attributes: { clusterName: string; clusterId: number; attributeName: string; attributeId: number; attributeValue: any }[] = [];
    device.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
      expect(clusterName).toBeDefined();
      expect(typeof clusterName).toBe('string');

      expect(clusterId).toBeDefined();
      expect(typeof clusterId).toBe('number');
      expect(clusterId).toBeGreaterThanOrEqual(1);

      expect(attributeName).toBeDefined();
      expect(typeof attributeName).toBe('string');

      expect(attributeId).toBeDefined();
      expect(typeof attributeId).toBe('number');
      expect(attributeId).toBeGreaterThanOrEqual(0);
      attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue });
    });
    expect(attributes.length).toBe(99);
  });

  test('close the server node', async () => {
    expect(server).toBeDefined();
    await stopServerNode(server);
  });
});
