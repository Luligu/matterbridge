// src\evse.test.ts

const MATTER_PORT = 6019;
const NAME = 'Evse';
const HOMEDIR = path.join('jest', NAME);

import path from 'node:path';

import { jest } from '@jest/globals';
import { AnsiLogger, LogLevel } from 'node-ansi-logger';
// matter.js
import { ServerNode, Endpoint } from '@matter/main';
import { AggregatorEndpoint } from '@matter/main/endpoints/aggregator';
import { Identify, PowerSource, ElectricalEnergyMeasurement, ElectricalPowerMeasurement, DeviceEnergyManagement, DeviceEnergyManagementMode, EnergyEvse } from '@matter/main/clusters';
import { EnergyEvseServer, EnergyEvseModeServer, DeviceEnergyManagementModeServer } from '@matter/node/behaviors';

// Matterbridge
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { invokeBehaviorCommand } from '../matterbridgeEndpointHelpers.js';
import { MatterbridgeDeviceEnergyManagementModeServer } from '../matterbridgeBehaviors.js';
import { addDevice, createTestEnvironment, loggerLogSpy, setupTest, startServerNode, stopServerNode } from '../utils/jestHelpers.js';

import { Evse, MatterbridgeEnergyEvseServer, MatterbridgeEnergyEvseModeServer } from './evse.js';

// Setup the Matter test environment
createTestEnvironment(HOMEDIR);

// Setup the test environment
setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  let server: ServerNode<ServerNode.RootEndpoint>;
  let aggregator: Endpoint<AggregatorEndpoint>;
  let device: MatterbridgeEndpoint;

  beforeAll(async () => {});

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {});

  afterAll(async () => {
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('create and start the server node', async () => {
    [server, aggregator] = await startServerNode(NAME, MATTER_PORT);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('create a Evse device', async () => {
    device = new Evse('EVSE Test Device', 'EVSE12456');
    device.createDefaultDeviceEnergyManagementModeClusterServer();
    expect(device).toBeDefined();
    expect(device.id).toBe('EVSETestDevice-EVSE12456');
    expect(device.hasClusterServer(Identify.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(PowerSource.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(ElectricalEnergyMeasurement.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(ElectricalPowerMeasurement.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(DeviceEnergyManagement.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(DeviceEnergyManagementMode.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(EnergyEvseServer)).toBeTruthy();
    expect(device.hasClusterServer(EnergyEvseModeServer)).toBeTruthy();
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
    expect(attributes.length).toBe(112);
  });

  test('invoke MatterbridgeDeviceEnergyManagementModeServer commands', async () => {
    expect(device.behaviors.has(DeviceEnergyManagementModeServer)).toBeTruthy();
    expect(device.behaviors.has(MatterbridgeDeviceEnergyManagementModeServer)).toBeTruthy();
    expect(device.behaviors.elementsOf(DeviceEnergyManagementModeServer).commands.has('changeToMode')).toBeTruthy();
    expect(device.behaviors.elementsOf(MatterbridgeDeviceEnergyManagementModeServer).commands.has('changeToMode')).toBeTruthy();
    expect((device as any).state['deviceEnergyManagementMode'].acceptedCommandList).toEqual([0]);
    expect((device as any).state['deviceEnergyManagementMode'].generatedCommandList).toEqual([1]);
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'deviceEnergyManagementMode', 'changeToMode', { newMode: 0 }); // 0 is not a valid mode
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `MatterbridgeDeviceEnergyManagementModeServer changeToMode called with unsupported newMode: 0`);
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'deviceEnergyManagementMode', 'changeToMode', { newMode: 1 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Changing mode to 1 (endpoint ${device.id}.${device.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeDeviceEnergyManagementModeServer changeToMode called with newMode 1 => No Energy Management (Forecast reporting only)`);
  });

  test('invoke MatterbridgeEnergyEvseServer commands', async () => {
    expect(device.behaviors.has(EnergyEvseServer)).toBeTruthy();
    expect(device.behaviors.has(MatterbridgeEnergyEvseServer)).toBeTruthy();
    expect(device.behaviors.elementsOf(EnergyEvseServer).commands.has('disable')).toBeTruthy();
    expect(device.behaviors.elementsOf(MatterbridgeEnergyEvseServer).commands.has('disable')).toBeTruthy();
    expect(device.behaviors.elementsOf(EnergyEvseServer).commands.has('enableCharging')).toBeTruthy();
    expect(device.behaviors.elementsOf(MatterbridgeEnergyEvseServer).commands.has('enableCharging')).toBeTruthy();
    expect((device as any).state['energyEvse'].acceptedCommandList).toEqual([1, 2]);
    expect((device as any).state['energyEvse'].generatedCommandList).toEqual([]);
    expect((device.stateOf(MatterbridgeEnergyEvseServer) as any).acceptedCommandList).toEqual([1, 2]);
    expect((device.stateOf(MatterbridgeEnergyEvseServer) as any).generatedCommandList).toEqual([]);
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'energyEvse', 'disable');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeEnergyEvseServer disable called`);
    jest.clearAllMocks();
    await device.setAttribute('energyEvse', 'state', EnergyEvse.State.PluggedInCharging);
    await invokeBehaviorCommand(device, 'energyEvse', 'disable');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeEnergyEvseServer disable called`);
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'energyEvse', 'enableCharging', { chargingEnabledUntil: null, minimumChargeCurrent: 6000, maximumChargeCurrent: 0 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeEnergyEvseServer enableCharging called`);
    jest.clearAllMocks();
    await device.setAttribute('energyEvse', 'state', EnergyEvse.State.PluggedInDemand);
    await invokeBehaviorCommand(device, 'energyEvse', 'enableCharging', { chargingEnabledUntil: null, minimumChargeCurrent: 6000, maximumChargeCurrent: 0 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeEnergyEvseServer enableCharging called`);
  });

  test('invoke MatterbridgeEvseModeServer commands', async () => {
    expect(device.behaviors.has(EnergyEvseModeServer)).toBeTruthy();
    expect(device.behaviors.has(MatterbridgeEnergyEvseModeServer)).toBeTruthy();
    expect(device.behaviors.elementsOf(EnergyEvseModeServer).commands.has('changeToMode')).toBeTruthy();
    expect(device.behaviors.elementsOf(MatterbridgeEnergyEvseModeServer).commands.has('changeToMode')).toBeTruthy();
    expect((device as any).state['energyEvseMode'].acceptedCommandList).toEqual([0]);
    expect((device as any).state['energyEvseMode'].generatedCommandList).toEqual([1]);
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'energyEvseMode', 'changeToMode', { newMode: 0 }); // 0 is not a valid mode
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `MatterbridgeEnergyEvseModeServer changeToMode called with unsupported newMode: 0`);
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'energyEvseMode', 'changeToMode', { newMode: 1 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Changing mode to 1 (endpoint ${device.id}.${device.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeEnergyEvseModeServer changeToMode called with newMode 1 => On demand`);
  });

  test('close the server node', async () => {
    expect(server).toBeDefined();
    await stopServerNode(server);
  });
});
