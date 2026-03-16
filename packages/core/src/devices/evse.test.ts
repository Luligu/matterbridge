/* eslint-disable jest/no-standalone-expect */
// src\evse.test.ts

const MATTER_PORT = 8005;
const NAME = 'Evse';
const HOMEDIR = path.join('.cache', 'jest', NAME);
const MATTER_CREATE_ONLY = true;

import path from 'node:path';

import { jest } from '@jest/globals';
import {
  DeviceEnergyManagementModeServer,
  DeviceEnergyManagementServer,
  ElectricalEnergyMeasurementServer,
  ElectricalPowerMeasurementServer,
  EnergyEvseModeServer,
  EnergyEvseServer,
  PowerSourceServer,
  TemperatureMeasurementServer,
} from '@matter/node/behaviors';
// @matter
import {
  DeviceEnergyManagement,
  DeviceEnergyManagementMode,
  ElectricalEnergyMeasurement,
  ElectricalPowerMeasurement,
  EnergyEvse,
  EnergyEvseMode,
  Identify,
  PowerSource,
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
import { MatterbridgeDeviceEnergyManagementModeServer } from '../matterbridgeBehaviorsServer.js';
import { evse } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { Evse, MatterbridgeEnergyEvseModeServer, MatterbridgeEnergyEvseServer } from './evse.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
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
    await startServerNode(NAME, MATTER_PORT, evse.code, MATTER_CREATE_ONLY);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  }, 10000);

  test('create a Evse device', async () => {
    device = new Evse('EVSE Test Device', 'EVSE12456');
    expect(device).toBeDefined();
    expect(device.id).toBe('EVSETestDevice-EVSE12456');
    expect(device.hasClusterServer(Identify.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(EnergyEvseServer)).toBeTruthy();
    expect(device.hasClusterServer(EnergyEvseModeServer)).toBeTruthy();
    expect(device.hasClusterServer(TemperatureMeasurementServer)).toBeTruthy();
    expect(device.hasClusterServer(PowerSourceServer)).toBeFalsy();
    expect(device.hasClusterServer(ElectricalPowerMeasurementServer)).toBeFalsy();
    expect(device.hasClusterServer(ElectricalEnergyMeasurementServer)).toBeFalsy();
    expect(device.hasClusterServer(DeviceEnergyManagementServer)).toBeFalsy();
    expect(device.getChildEndpointById('PowerSource')?.hasClusterServer(PowerSource.Cluster.id)).toBeTruthy();
    expect(device.getChildEndpointById('ElectricalSensor')?.hasClusterServer(ElectricalEnergyMeasurement.Cluster.id)).toBeTruthy();
    expect(device.getChildEndpointById('ElectricalSensor')?.hasClusterServer(ElectricalPowerMeasurement.Cluster.id)).toBeTruthy();
    expect(device.getChildEndpointById('DeviceEnergyManagement')?.hasClusterServer(DeviceEnergyManagement.Cluster.id)).toBeTruthy();
    expect(device.getChildEndpointById('DeviceEnergyManagement')?.hasClusterServer(DeviceEnergyManagementMode.Cluster.id)).toBeTruthy();
  });

  test('add a Evse device', async () => {
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
    expect(attributes.length).toBe(61);
  });

  test('invoke MatterbridgeDeviceEnergyManagementModeServer commands', async () => {
    const dem = device.getChildEndpointById('DeviceEnergyManagement');
    expect(dem).toBeDefined();
    if (!dem) return;
    expect(dem.behaviors.has(DeviceEnergyManagementModeServer)).toBeTruthy();
    expect(dem.behaviors.has(MatterbridgeDeviceEnergyManagementModeServer)).toBeTruthy();
    expect(dem.behaviors.elementsOf(DeviceEnergyManagementModeServer).commands.has('changeToMode')).toBeTruthy();
    expect(dem.behaviors.elementsOf(MatterbridgeDeviceEnergyManagementModeServer).commands.has('changeToMode')).toBeTruthy();
    expect((dem as any).state['deviceEnergyManagementMode'].acceptedCommandList).toEqual([0]);
    expect((dem as any).state['deviceEnergyManagementMode'].generatedCommandList).toEqual([1]);
    jest.clearAllMocks();
    await dem.invokeBehaviorCommand(DeviceEnergyManagementModeServer, 'changeToMode', { newMode: 0 }); // 0 is not a valid mode
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `MatterbridgeDeviceEnergyManagementModeServer changeToMode called with unsupported newMode: 0`);
    jest.clearAllMocks();
    await dem.invokeBehaviorCommand(DeviceEnergyManagementModeServer, 'changeToMode', { newMode: 1 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Changing mode to 1 (endpoint ${dem.id}.${dem.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.DEBUG,
      `MatterbridgeDeviceEnergyManagementModeServer changeToMode called with newMode 1 => No Energy Management (Forecast reporting only)`,
    );
  });

  test('invoke MatterbridgeEnergyEvseServer commands', async () => {
    expect(device.behaviors.has(EnergyEvseServer)).toBeTruthy();
    expect(device.behaviors.has(MatterbridgeEnergyEvseServer)).toBeTruthy();
    expect(device.behaviors.elementsOf(EnergyEvseServer).commands.has('disable')).toBeTruthy();
    expect(device.behaviors.elementsOf(MatterbridgeEnergyEvseServer).commands.has('disable')).toBeTruthy();
    expect(device.behaviors.elementsOf(EnergyEvseServer).commands.has('enableCharging')).toBeTruthy();
    expect(device.behaviors.elementsOf(MatterbridgeEnergyEvseServer).commands.has('enableCharging')).toBeTruthy();
    expect((device as any).state['energyEvse'].acceptedCommandList).toEqual([1, 2, 5, 6, 7]);
    expect((device as any).state['energyEvse'].generatedCommandList).toEqual([0]);
    expect((device.stateOf(MatterbridgeEnergyEvseServer) as any).acceptedCommandList).toEqual([1, 2, 5, 6, 7]);
    expect((device.stateOf(MatterbridgeEnergyEvseServer) as any).generatedCommandList).toEqual([0]);

    jest.clearAllMocks();
    await device.invokeBehaviorCommand(EnergyEvseServer, 'disable');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeEnergyEvseServer disable called`);

    jest.clearAllMocks();
    await device.setAttribute('energyEvse', 'state', EnergyEvse.State.PluggedInCharging);
    await device.invokeBehaviorCommand(EnergyEvseServer, 'disable');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeEnergyEvseServer disable called`);

    jest.clearAllMocks();
    await device.invokeBehaviorCommand(EnergyEvseServer, 'enableCharging', { chargingEnabledUntil: null, minimumChargeCurrent: 6000, maximumChargeCurrent: 0 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeEnergyEvseServer enableCharging called`);

    jest.clearAllMocks();
    await device.setAttribute('energyEvse', 'state', EnergyEvse.State.PluggedInDemand);
    await device.invokeBehaviorCommand(EnergyEvseServer, 'enableCharging', { chargingEnabledUntil: null, minimumChargeCurrent: 6000, maximumChargeCurrent: 0 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeEnergyEvseServer enableCharging called`);

    jest.clearAllMocks();
    await device.invokeBehaviorCommand(EnergyEvseServer.with(EnergyEvse.Feature.ChargingPreferences), 'setTargets', { chargingTargetSchedules: [] });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`SetTargets`));

    jest.clearAllMocks();
    await device.invokeBehaviorCommand(EnergyEvseServer.with(EnergyEvse.Feature.ChargingPreferences), 'getTargets');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`GetTargets`));

    jest.clearAllMocks();
    await device.invokeBehaviorCommand(EnergyEvseServer.with(EnergyEvse.Feature.ChargingPreferences), 'clearTargets');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`ClearTargets`));
  });

  test('invoke MatterbridgeEvseModeServer commands', async () => {
    expect(device.behaviors.has(EnergyEvseModeServer)).toBeTruthy();
    expect(device.behaviors.has(MatterbridgeEnergyEvseModeServer)).toBeTruthy();
    expect(device.behaviors.elementsOf(EnergyEvseModeServer).commands.has('changeToMode')).toBeTruthy();
    expect(device.behaviors.elementsOf(MatterbridgeEnergyEvseModeServer).commands.has('changeToMode')).toBeTruthy();
    expect((device as any).state['energyEvseMode'].acceptedCommandList).toEqual([0]);
    expect((device as any).state['energyEvseMode'].generatedCommandList).toEqual([1]);

    jest.clearAllMocks();
    await device.invokeBehaviorCommand(EnergyEvseModeServer, 'changeToMode', { newMode: 0 }); // 0 is not a valid mode
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `MatterbridgeEnergyEvseModeServer changeToMode called with unsupported newMode: 0`);

    jest.clearAllMocks();
    await device.invokeBehaviorCommand(EnergyEvseModeServer, 'changeToMode', { newMode: 1 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Changing mode to 1 (endpoint ${device.id}.${device.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeEnergyEvseModeServer changeToMode called with newMode 1 => On demand`);
  });

  test('close the server node', async () => {
    expect(server).toBeDefined();
    await stopServerNode(server, MATTER_CREATE_ONLY);
  });
});
