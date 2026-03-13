/* eslint-disable jest/no-standalone-expect */
// src\waterHeater.test.ts

const MATTER_PORT = 8016;
const NAME = 'WaterHeater';
const HOMEDIR = path.join('.cache', 'jest', NAME);
const MATTER_CREATE_ONLY = true;

import path from 'node:path';

import { jest } from '@jest/globals';
// @matter
import { ThermostatServer, WaterHeaterManagementServer, WaterHeaterModeServer } from '@matter/node/behaviors';
import {
  DeviceEnergyManagement,
  DeviceEnergyManagementMode,
  ElectricalEnergyMeasurement,
  ElectricalPowerMeasurement,
  Identify,
  PowerSource,
  TemperatureMeasurement,
  Thermostat,
  WaterHeaterManagement,
} from '@matter/types/clusters';
import { LogLevel } from 'node-ansi-logger';

// Matterbridge
import {
  addDevice,
  aggregator,
  createTestEnvironment,
  destroyTestEnvironment,
  loggerErrorSpy,
  loggerFatalSpy,
  loggerLogSpy,
  loggerWarnSpy,
  server,
  setupTest,
  startServerNode,
  stopServerNode,
} from '../jestutils/jestHelpers.js';
import { MatterbridgeThermostatServer } from '../matterbridgeBehaviorsServer.js';
import { waterHeater } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { invokeBehaviorCommand } from '../matterbridgeEndpointHelpers.js';
import { MatterbridgeWaterHeaterManagementServer, MatterbridgeWaterHeaterModeServer, WaterHeater } from './waterHeater.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge Water Heater', () => {
  let device: MatterbridgeEndpoint;

  beforeAll(async () => {
    // Setup the Matter test environment
    createTestEnvironment(NAME, MATTER_CREATE_ONLY);
  });

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    expect(loggerWarnSpy).not.toHaveBeenCalled();
    expect(loggerErrorSpy).not.toHaveBeenCalled();
    expect(loggerFatalSpy).not.toHaveBeenCalled();
  });

  afterAll(async () => {
    // Destroy the Matter test environment
    await destroyTestEnvironment(MATTER_CREATE_ONLY);
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('create and start the server node', async () => {
    await startServerNode(NAME, MATTER_PORT, waterHeater.code, MATTER_CREATE_ONLY);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  }, 10000);

  test('create a water heater device with all parameters', async () => {
    device = new WaterHeater(
      'Water Heater Test Device',
      'WH123456',
      50,
      55,
      20,
      80,
      { immersionElement1: true, immersionElement2: true, heatPump: true, boiler: true, other: true },
      90,
    );
    expect(device).toBeDefined();
    expect(device.id).toBe('WaterHeaterTestDevice-WH123456');
    expect(device.hasClusterServer(Identify.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(WaterHeaterManagementServer)).toBeTruthy();
    expect(device.hasClusterServer(WaterHeaterModeServer)).toBeTruthy();
    expect(device.hasClusterServer(ThermostatServer)).toBeTruthy();
    expect(device.getChildEndpointById('PowerSource')?.hasClusterServer(PowerSource.Cluster.id)).toBeTruthy();
    expect(device.getChildEndpointById('ElectricalSensor')?.hasClusterServer(ElectricalEnergyMeasurement.Cluster.id)).toBeTruthy();
    expect(device.getChildEndpointById('ElectricalSensor')?.hasClusterServer(ElectricalPowerMeasurement.Cluster.id)).toBeTruthy();
    expect(device.getChildEndpointById('DeviceEnergyManagement')?.hasClusterServer(DeviceEnergyManagement.Cluster.id)).toBeTruthy();
    expect(device.getChildEndpointById('DeviceEnergyManagement')?.hasClusterServer(DeviceEnergyManagementMode.Cluster.id)).toBeTruthy();
  });

  test('create a water heater device with no parameter', async () => {
    device = new WaterHeater('Water Heater Test Device', 'WH123456');
    expect(device).toBeDefined();
    expect(device.id).toBe('WaterHeaterTestDevice-WH123456');
    expect(device.hasClusterServer(Identify.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(WaterHeaterManagementServer)).toBeTruthy();
    expect(device.hasClusterServer(WaterHeaterModeServer)).toBeTruthy();
    expect(device.hasClusterServer(ThermostatServer)).toBeTruthy();
    expect(device.getChildEndpointById('PowerSource')?.hasClusterServer(PowerSource.Cluster.id)).toBeTruthy();
    expect(device.getChildEndpointById('ElectricalSensor')?.hasClusterServer(ElectricalEnergyMeasurement.Cluster.id)).toBeTruthy();
    expect(device.getChildEndpointById('ElectricalSensor')?.hasClusterServer(ElectricalPowerMeasurement.Cluster.id)).toBeTruthy();
    expect(device.getChildEndpointById('DeviceEnergyManagement')?.hasClusterServer(DeviceEnergyManagement.Cluster.id)).toBeTruthy();
    expect(device.getChildEndpointById('DeviceEnergyManagement')?.hasClusterServer(DeviceEnergyManagementMode.Cluster.id)).toBeTruthy();
  });

  test('add a water heater device', async () => {
    expect(await addDevice(server, device)).toBeTruthy();
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
    expect(attributes.length).toBe(74);
  });

  test('invoke MatterbridgeThermostatServer commands', async () => {
    expect(device.behaviors.has(ThermostatServer)).toBeTruthy();
    expect(device.behaviors.has(MatterbridgeThermostatServer.with(Thermostat.Feature.Heating))).toBeTruthy();
    expect(device.behaviors.elementsOf(MatterbridgeThermostatServer.with(Thermostat.Feature.Heating)).commands.has('setpointRaiseLower')).toBeTruthy();
    expect((device.stateOf(MatterbridgeThermostatServer.with(Thermostat.Feature.Heating)) as any).acceptedCommandList).toEqual([0]);
    expect((device.stateOf(MatterbridgeThermostatServer.with(Thermostat.Feature.Heating)) as any).generatedCommandList).toEqual([]);

    jest.clearAllMocks();
    const occupiedHeatingSetpoint = device.stateOf(MatterbridgeThermostatServer.with(Thermostat.Feature.Heating)).occupiedHeatingSetpoint;
    expect(occupiedHeatingSetpoint).toBeDefined();
    if (!occupiedHeatingSetpoint) return;
    await invokeBehaviorCommand(device, 'thermostat', 'setpointRaiseLower', { mode: Thermostat.SetpointRaiseLowerMode.Heat, amount: 5 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Setting setpoint by 5 in mode ${Thermostat.SetpointRaiseLowerMode.Heat} (endpoint ${device.id}.${device.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Set occupiedHeatingSetpoint to ${(occupiedHeatingSetpoint + 50) / 100}`);
    expect(device.stateOf(MatterbridgeThermostatServer.with(Thermostat.Feature.Heating)).occupiedHeatingSetpoint).toBe(occupiedHeatingSetpoint + 50);
  });

  test('invoke MatterbridgeWaterHeaterManagementServer commands', async () => {
    expect(device.behaviors.has(WaterHeaterManagementServer)).toBeTruthy();
    expect(device.behaviors.has(MatterbridgeWaterHeaterManagementServer)).toBeTruthy();
    expect(device.behaviors.elementsOf(WaterHeaterManagementServer).commands.has('boost')).toBeTruthy();
    expect(device.behaviors.elementsOf(MatterbridgeWaterHeaterManagementServer).commands.has('boost')).toBeTruthy();
    expect(device.behaviors.elementsOf(WaterHeaterManagementServer).commands.has('cancelBoost')).toBeTruthy();
    expect(device.behaviors.elementsOf(MatterbridgeWaterHeaterManagementServer).commands.has('cancelBoost')).toBeTruthy();
    expect((device as any).state['waterHeaterManagement'].acceptedCommandList).toEqual([0, 1]);
    expect((device as any).state['waterHeaterManagement'].generatedCommandList).toEqual([]);
    expect((device.stateOf(MatterbridgeWaterHeaterManagementServer) as any).acceptedCommandList).toEqual([0, 1]);
    expect((device.stateOf(MatterbridgeWaterHeaterManagementServer) as any).generatedCommandList).toEqual([]);

    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'waterHeaterManagement', 'boost', { boostInfo: { duration: 60 } });
    expect(device.stateOf(WaterHeaterManagementServer).boostState).toBe(WaterHeaterManagement.BoostState.Active);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Boost (endpoint ${device.id}.${device.number})`);

    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'waterHeaterManagement', 'cancelBoost', {});
    expect(device.stateOf(WaterHeaterManagementServer).boostState).toBe(WaterHeaterManagement.BoostState.Inactive);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Cancel boost (endpoint ${device.id}.${device.number})`);
  });

  test('invoke MatterbridgeWaterHeaterModeServer commands', async () => {
    expect(device.behaviors.has(WaterHeaterModeServer)).toBeTruthy();
    expect(device.behaviors.has(MatterbridgeWaterHeaterModeServer)).toBeTruthy();
    expect(device.behaviors.elementsOf(WaterHeaterModeServer).commands.has('changeToMode')).toBeTruthy();
    expect(device.behaviors.elementsOf(MatterbridgeWaterHeaterModeServer).commands.has('changeToMode')).toBeTruthy();
    expect((device as any).state['waterHeaterMode'].acceptedCommandList).toEqual([0]);
    expect((device as any).state['waterHeaterMode'].generatedCommandList).toEqual([1]);
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'waterHeaterMode', 'changeToMode', { newMode: 0 }); // 0 is not a valid mode
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `MatterbridgeWaterHeaterModeServer changeToMode called with unsupported newMode: 0`);
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'waterHeaterMode', 'changeToMode', { newMode: 1 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Changing mode to 1 (endpoint ${device.id}.${device.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeWaterHeaterModeServer changeToMode called with newMode 1 => Auto`);
  });

  test('close the server node', async () => {
    expect(server).toBeDefined();
    await stopServerNode(server, MATTER_CREATE_ONLY);
  });
});
