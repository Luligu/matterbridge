// src\waterHeater.test.ts
/* eslint-disable jest/no-standalone-expect */

const NAME = 'WaterHeater';
const MATTER_PORT = 8016;
const MATTER_CREATE_ONLY = true;

import { jest } from '@jest/globals';
// @matter
import { ThermostatServer, WaterHeaterManagementServer, WaterHeaterModeServer } from '@matter/node/behaviors';
import { DeviceEnergyManagement } from '@matter/types/clusters/device-energy-management';
import { DeviceEnergyManagementMode } from '@matter/types/clusters/device-energy-management-mode';
import { ElectricalEnergyMeasurement } from '@matter/types/clusters/electrical-energy-measurement';
import { ElectricalPowerMeasurement } from '@matter/types/clusters/electrical-power-measurement';
import { Identify } from '@matter/types/clusters/identify';
import { PowerSource } from '@matter/types/clusters/power-source';
import { Thermostat } from '@matter/types/clusters/thermostat';
import { WaterHeaterManagement } from '@matter/types/clusters/water-heater-management';
import { LogLevel, stringify } from 'node-ansi-logger';

// Matterbridge
import { MatterbridgeThermostatServer } from '../behaviors/thermostatServer.js';
// Jest utilities for Matter testing
import {
  addDevice,
  aggregator,
  createServerNode,
  createTestEnvironment,
  destroyTestEnvironment,
  flushServerNode,
  server,
  startServerNode,
  stopServerNode,
} from '../jestutils/jestMatterTest.js';
import { loggerErrorSpy, loggerFatalSpy, loggerLogSpy, loggerWarnSpy, setupTest } from '../jestutils/jestSetupTest.js';
import { waterHeater } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeWaterHeaterManagementServer, MatterbridgeWaterHeaterModeServer, WaterHeater } from './waterHeater.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge Water Heater', () => {
  let device: WaterHeater;

  beforeAll(async () => {
    // Setup the Matter test environment
    await createTestEnvironment();
  });

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
    // Destroy the Matter test environment
    await destroyTestEnvironment();
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('create the server node', async () => {
    await createServerNode(MATTER_PORT, waterHeater.code);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

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

  test('createDefaultWaterHeaterManagementClusterServer argument normalization and chaining', () => {
    const requireSpy = jest.spyOn(device.behaviors, 'require').mockImplementation(() => undefined);
    // Call with all parameters
    device.createDefaultWaterHeaterManagementClusterServer(
      { immersionElement1: true, immersionElement2: true },
      { immersionElement1: false, immersionElement2: true },
      77,
      WaterHeaterManagement.BoostState.Active,
    );
    expect(requireSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        heaterTypes: { immersionElement1: true, immersionElement2: true },
        heatDemand: { immersionElement1: false, immersionElement2: true },
        tankPercentage: 77,
        boostState: WaterHeaterManagement.BoostState.Active,
      }),
    );
    // Call with defaults
    device.createDefaultWaterHeaterManagementClusterServer();
    expect(requireSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        heaterTypes: { immersionElement1: true },
        heatDemand: {},
        tankPercentage: 100,
        boostState: WaterHeaterManagement.BoostState.Inactive,
      }),
    );
    // Chaining
    expect(device.createDefaultWaterHeaterManagementClusterServer()).toBe(device);
    requireSpy.mockRestore();
  });

  test('add a water heater device', async () => {
    expect(await addDevice(server, device)).toBeTruthy();
  });

  test('device forEachAttribute', async () => {
    const attributes: {
      clusterName: string;
      clusterId: number;
      attributeName: string;
      attributeId: number;
      attributeValue: string | number | bigint | boolean | object | null | undefined;
    }[] = [];
    device.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
      if (attributeValue === undefined) return;

      expect(clusterName).toBeDefined();
      expect(typeof clusterName).toBe('string');
      expect(clusterName.length).toBeGreaterThanOrEqual(1);

      expect(clusterId).toBeDefined();
      expect(typeof clusterId).toBe('number');
      expect(clusterId).toBeGreaterThanOrEqual(1);

      expect(attributeName).toBeDefined();
      expect(typeof attributeName).toBe('string');
      expect(attributeName.length).toBeGreaterThanOrEqual(1);

      expect(attributeId).toBeDefined();
      expect(typeof attributeId).toBe('number');
      expect(attributeId).toBeGreaterThanOrEqual(0);

      if (['serverList', 'clientList', 'partsList', 'attributeList', 'acceptedCommandList', 'generatedCommandList'].includes(attributeName)) {
        const sortedAttributeValue = (attributeValue as number[]).toSorted((a, b) => a - b);
        attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue: sortedAttributeValue });
      } else {
        attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue });
      }
    });
    expect(
      attributes
        .map(
          ({ clusterName, clusterId, attributeName, attributeId, attributeValue }) =>
            `${clusterName}(0x${clusterId.toString(16)}).${attributeName}(0x${attributeId.toString(16)})=${stringify(attributeValue, false)}`,
        )
        .toSorted(),
    ).toEqual(
      [
        'descriptor(0x1d).acceptedCommandList(0xfff9)=[  ]',
        'descriptor(0x1d).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'descriptor(0x1d).clientList(0x2)=[  ]',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 1295, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: false }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[ 3, 4, 5 ]',
        'descriptor(0x1d).serverList(0x1)=[ 3, 29, 64, 148, 158, 513 ]',
        'fixedLabel(0x40).acceptedCommandList(0xfff9)=[  ]',
        'fixedLabel(0x40).attributeList(0xfffb)=[ 0, 65528, 65529, 65531, 65532, 65533 ]',
        'fixedLabel(0x40).clusterRevision(0xfffd)=1',
        'fixedLabel(0x40).featureMap(0xfffc)={  }',
        'fixedLabel(0x40).generatedCommandList(0xfff8)=[  ]',
        "fixedLabel(0x40).labelList(0x0)=[ { label: 'composed', value: 'Water Heater' } ]",
        'identify(0x3).acceptedCommandList(0xfff9)=[ 0, 64 ]',
        'identify(0x3).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'identify(0x3).clusterRevision(0xfffd)=6',
        'identify(0x3).featureMap(0xfffc)={  }',
        'identify(0x3).generatedCommandList(0xfff8)=[  ]',
        'identify(0x3).identifyTime(0x0)=0',
        'identify(0x3).identifyType(0x1)=0',
        'thermostat(0x201).absMaxHeatSetpointLimit(0x4)=8000',
        'thermostat(0x201).absMinHeatSetpointLimit(0x3)=2000',
        'thermostat(0x201).acceptedCommandList(0xfff9)=[ 0 ]',
        'thermostat(0x201).attributeList(0xfffb)=[ 0, 3, 4, 18, 21, 22, 27, 28, 41, 65528, 65529, 65531, 65532, 65533 ]',
        'thermostat(0x201).clusterRevision(0xfffd)=9',
        'thermostat(0x201).controlSequenceOfOperation(0x1b)=2',
        'thermostat(0x201).featureMap(0xfffc)={ heating: true, cooling: false, occupancy: false, scheduleConfiguration: false, setback: false, autoMode: false, localTemperatureNotExposed: false, matterScheduleConfiguration: false, presets: false }',
        'thermostat(0x201).generatedCommandList(0xfff8)=[  ]',
        'thermostat(0x201).localTemperature(0x0)=5000',
        'thermostat(0x201).maxHeatSetpointLimit(0x16)=8000',
        'thermostat(0x201).minHeatSetpointLimit(0x15)=2000',
        'thermostat(0x201).occupiedHeatingSetpoint(0x12)=5500',
        'thermostat(0x201).systemMode(0x1c)=4',
        'thermostat(0x201).thermostatRunningState(0x29)={ heat: false, cool: false, fan: false, heatStage2: false, coolStage2: false, fanStage2: false, fanStage3: false }',
        'waterHeaterManagement(0x94).acceptedCommandList(0xfff9)=[ 0, 1 ]',
        'waterHeaterManagement(0x94).attributeList(0xfffb)=[ 0, 1, 4, 5, 65528, 65529, 65531, 65532, 65533 ]',
        'waterHeaterManagement(0x94).boostState(0x5)=0',
        'waterHeaterManagement(0x94).clusterRevision(0xfffd)=2',
        'waterHeaterManagement(0x94).featureMap(0xfffc)={ energyManagement: false, tankPercent: true }',
        'waterHeaterManagement(0x94).generatedCommandList(0xfff8)=[  ]',
        'waterHeaterManagement(0x94).heatDemand(0x1)={ immersionElement1: false, immersionElement2: false, heatPump: false, boiler: false, other: false }',
        'waterHeaterManagement(0x94).heaterTypes(0x0)={ immersionElement1: true, immersionElement2: false, heatPump: false, boiler: false, other: false }',
        'waterHeaterManagement(0x94).tankPercentage(0x4)=90',
        'waterHeaterMode(0x9e).acceptedCommandList(0xfff9)=[ 0 ]',
        'waterHeaterMode(0x9e).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'waterHeaterMode(0x9e).clusterRevision(0xfffd)=1',
        'waterHeaterMode(0x9e).currentMode(0x1)=1',
        'waterHeaterMode(0x9e).featureMap(0xfffc)={ onOff: false }',
        'waterHeaterMode(0x9e).generatedCommandList(0xfff8)=[ 1 ]',
        "waterHeaterMode(0x9e).supportedModes(0x0)=[ { label: 'Auto', mode: 1, modeTags: [ { mfgCode: undefined, value: 0 } ] }, { label: 'Quick', mode: 2, modeTags: [ { mfgCode: undefined, value: 1 } ] }, { label: 'Quiet', mode: 3, modeTags: [ { mfgCode: undefined, value: 2 } ] }, { label: 'LowNoise', mode: 4, modeTags: [ { mfgCode: undefined, value: 3 } ] }, { label: 'LowEnergy', mode: 5, modeTags: [ { mfgCode: undefined, value: 4 } ] }, { label: 'Vacation', mode: 6, modeTags: [ { mfgCode: undefined, value: 5 } ] }, { label: 'Min', mode: 7, modeTags: [ { mfgCode: undefined, value: 6 } ] }, { label: 'Max', mode: 8, modeTags: [ { mfgCode: undefined, value: 7 } ] }, { label: 'Night', mode: 9, modeTags: [ { mfgCode: undefined, value: 8 } ] }, { label: 'Day', mode: 10, modeTags: [ { mfgCode: undefined, value: 9 } ] }, { label: 'Off', mode: 11, modeTags: [ { mfgCode: undefined, value: 16384 } ] }, { label: 'Manual', mode: 12, modeTags: [ { mfgCode: undefined, value: 16385 } ] }, { label: 'Timed', mode: 13, modeTags: [ { mfgCode: undefined, value: 16386 } ] } ]",
      ].toSorted(),
    );
  });

  test('invoke MatterbridgeThermostatServer commands', async () => {
    // expect(device.behaviors.has(ThermostatServer.with(Thermostat.Feature.Heating))).toBeTruthy();
    expect(device.behaviors.has(MatterbridgeThermostatServer.with(Thermostat.Feature.Heating))).toBeTruthy();
    expect(device.behaviors.elementsOf(MatterbridgeThermostatServer.with(Thermostat.Feature.Heating)).commands.has('setpointRaiseLower')).toBeTruthy();
    expect((device.stateOf(MatterbridgeThermostatServer.with(Thermostat.Feature.Heating)) as any).acceptedCommandList).toEqual([0]);
    expect((device.stateOf(MatterbridgeThermostatServer.with(Thermostat.Feature.Heating)) as any).generatedCommandList).toEqual([]);

    jest.clearAllMocks();
    const occupiedHeatingSetpoint = device.stateOf(MatterbridgeThermostatServer.with(Thermostat.Feature.Heating)).occupiedHeatingSetpoint;
    expect(occupiedHeatingSetpoint).toBeDefined();
    if (!occupiedHeatingSetpoint) return;
    await device.invokeBehaviorCommand('thermostat', 'setpointRaiseLower', { mode: Thermostat.SetpointRaiseLowerMode.Heat, amount: 5 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Setting setpoint by 5 in mode ${Thermostat.SetpointRaiseLowerMode.Heat} (endpoint ${device.id}.${device.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'MatterbridgeThermostatServer: setpointRaiseLower called with mode: Heat amount: 0.5');
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
    await device.invokeBehaviorCommand('waterHeaterManagement', 'boost', { boostInfo: { duration: 60 } });
    expect(device.stateOf(WaterHeaterManagementServer).boostState).toBe(WaterHeaterManagement.BoostState.Active);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Boost (endpoint ${device.id}.${device.number})`);

    jest.clearAllMocks();
    await device.invokeBehaviorCommand('waterHeaterManagement', 'cancelBoost', {});
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
    await device.invokeBehaviorCommand('waterHeaterMode', 'changeToMode', { newMode: 0 }); // 0 is not a valid mode
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `MatterbridgeWaterHeaterModeServer changeToMode called with unsupported newMode: 0`);
    jest.clearAllMocks();
    await device.invokeBehaviorCommand('waterHeaterMode', 'changeToMode', { newMode: 1 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Changing mode to 1 (endpoint ${device.id}.${device.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeWaterHeaterModeServer changeToMode called with newMode 1 => Auto`);
  });

  test('start the server node', async () => {
    if (!MATTER_CREATE_ONLY) await startServerNode();
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('stop the server node', async () => {
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
    if (MATTER_CREATE_ONLY) await flushServerNode();
    else await stopServerNode();
  });
});
