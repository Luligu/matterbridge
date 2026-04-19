// src\evse.test.ts
/* eslint-disable jest/no-standalone-expect */

const NAME = 'Evse';
const MATTER_PORT = 8005;
const MATTER_CREATE_ONLY = true;

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
import { DeviceEnergyManagement } from '@matter/types/clusters/device-energy-management';
import { DeviceEnergyManagementMode } from '@matter/types/clusters/device-energy-management-mode';
import { ElectricalEnergyMeasurement } from '@matter/types/clusters/electrical-energy-measurement';
import { ElectricalPowerMeasurement } from '@matter/types/clusters/electrical-power-measurement';
import { EnergyEvse } from '@matter/types/clusters/energy-evse';
import { EnergyEvseMode } from '@matter/types/clusters/energy-evse-mode';
import { Identify } from '@matter/types/clusters/identify';
import { PowerSource } from '@matter/types/clusters/power-source';
import { LogLevel, stringify } from 'node-ansi-logger';

// Matterbridge
import { MatterbridgeDeviceEnergyManagementModeServer } from '../behaviors/deviceEnergyManagementModeServer.js';
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
import { evse } from '../matterbridgeDeviceTypes.js';
import { Evse, MatterbridgeEnergyEvseModeServer, MatterbridgeEnergyEvseServer } from './evse.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  let device: Evse;

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
    await createServerNode(MATTER_PORT, evse.code);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

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

  test('createDefaultEnergyEvseClusterServer argument normalization and chaining', () => {
    const requireSpy = jest.spyOn(device.behaviors, 'require').mockImplementation(() => undefined);
    // Call with all parameters
    device.createDefaultEnergyEvseClusterServer(EnergyEvse.State.PluggedInCharging, EnergyEvse.SupplyState.ChargingEnabled, EnergyEvse.FaultState.NoError);
    expect(requireSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        state: EnergyEvse.State.PluggedInCharging,
        supplyState: EnergyEvse.SupplyState.ChargingEnabled,
        faultState: EnergyEvse.FaultState.NoError,
        chargingEnabledUntil: null,
        circuitCapacity: 32000,
        minimumChargeCurrent: 6000,
        maximumChargeCurrent: 32000,
        userMaximumChargeCurrent: 32000,
        sessionId: null,
        sessionDuration: null,
        sessionEnergyCharged: null,
      }),
    );
    // Call with defaults
    device.createDefaultEnergyEvseClusterServer();
    expect(requireSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        state: EnergyEvse.State.NotPluggedIn,
        supplyState: EnergyEvse.SupplyState.ChargingEnabled,
        faultState: EnergyEvse.FaultState.NoError,
        chargingEnabledUntil: null,
        circuitCapacity: 32000,
        minimumChargeCurrent: 6000,
        maximumChargeCurrent: 32000,
        userMaximumChargeCurrent: 32000,
        sessionId: null,
        sessionDuration: null,
        sessionEnergyCharged: null,
      }),
    );
    // Chaining
    expect(device.createDefaultEnergyEvseClusterServer()).toBe(device);
    requireSpy.mockRestore();
  });

  test('add a Evse device', async () => {
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
        const sortedAttributeValue = Array.from(attributeValue as number[]).sort((a, b) => a - b);
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
        .sort(),
    ).toEqual(
      [
        'descriptor(0x1d).acceptedCommandList(0xfff9)=[  ]',
        'descriptor(0x1d).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'descriptor(0x1d).clientList(0x2)=[  ]',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 1292, revision: 2 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: false }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[ 3, 4, 5 ]',
        'descriptor(0x1d).serverList(0x1)=[ 3, 29, 64, 153, 157, 1026 ]',
        'energyEvse(0x99).acceptedCommandList(0xfff9)=[ 1, 2, 5, 6, 7 ]',
        'energyEvse(0x99).attributeList(0xfffb)=[ 0, 1, 2, 3, 5, 6, 7, 9, 35, 36, 37, 38, 64, 65, 66, 65528, 65529, 65531, 65532, 65533 ]',
        'energyEvse(0x99).chargingEnabledUntil(0x3)=null',
        'energyEvse(0x99).circuitCapacity(0x5)=32000',
        'energyEvse(0x99).clusterRevision(0xfffd)=3',
        'energyEvse(0x99).faultState(0x2)=0',
        'energyEvse(0x99).featureMap(0xfffc)={ chargingPreferences: true, soCReporting: false, plugAndCharge: false, rfid: false, v2X: false }',
        'energyEvse(0x99).generatedCommandList(0xfff8)=[ 0 ]',
        'energyEvse(0x99).maximumChargeCurrent(0x7)=32000',
        'energyEvse(0x99).minimumChargeCurrent(0x6)=6000',
        'energyEvse(0x99).nextChargeRequiredEnergy(0x25)=null',
        'energyEvse(0x99).nextChargeStartTime(0x23)=null',
        'energyEvse(0x99).nextChargeTargetSoC(0x26)=null',
        'energyEvse(0x99).nextChargeTargetTime(0x24)=null',
        'energyEvse(0x99).sessionDuration(0x41)=null',
        'energyEvse(0x99).sessionEnergyCharged(0x42)=null',
        'energyEvse(0x99).sessionId(0x40)=null',
        'energyEvse(0x99).state(0x0)=0',
        'energyEvse(0x99).supplyState(0x1)=1',
        'energyEvse(0x99).userMaximumChargeCurrent(0x9)=32000',
        'energyEvseMode(0x9d).acceptedCommandList(0xfff9)=[ 0 ]',
        'energyEvseMode(0x9d).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'energyEvseMode(0x9d).clusterRevision(0xfffd)=2',
        'energyEvseMode(0x9d).currentMode(0x1)=1',
        'energyEvseMode(0x9d).featureMap(0xfffc)={ onOff: false }',
        'energyEvseMode(0x9d).generatedCommandList(0xfff8)=[ 1 ]',
        "energyEvseMode(0x9d).supportedModes(0x0)=[ { label: 'On demand', mode: 1, modeTags: [ { mfgCode: undefined, value: 16384 } ] }, { label: 'Scheduled', mode: 2, modeTags: [ { mfgCode: undefined, value: 16385 } ] }, { label: 'Solar charging', mode: 3, modeTags: [ { mfgCode: undefined, value: 16386 } ] } ]",
        'fixedLabel(0x40).acceptedCommandList(0xfff9)=[  ]',
        'fixedLabel(0x40).attributeList(0xfffb)=[ 0, 65528, 65529, 65531, 65532, 65533 ]',
        'fixedLabel(0x40).clusterRevision(0xfffd)=1',
        'fixedLabel(0x40).featureMap(0xfffc)={  }',
        'fixedLabel(0x40).generatedCommandList(0xfff8)=[  ]',
        "fixedLabel(0x40).labelList(0x0)=[ { label: 'composed', value: 'EVSE' } ]",
        'identify(0x3).acceptedCommandList(0xfff9)=[ 0, 64 ]',
        'identify(0x3).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'identify(0x3).clusterRevision(0xfffd)=6',
        'identify(0x3).featureMap(0xfffc)={  }',
        'identify(0x3).generatedCommandList(0xfff8)=[  ]',
        'identify(0x3).identifyTime(0x0)=0',
        'identify(0x3).identifyType(0x1)=0',
        'temperatureMeasurement(0x402).acceptedCommandList(0xfff9)=[  ]',
        'temperatureMeasurement(0x402).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'temperatureMeasurement(0x402).clusterRevision(0xfffd)=4',
        'temperatureMeasurement(0x402).featureMap(0xfffc)={  }',
        'temperatureMeasurement(0x402).generatedCommandList(0xfff8)=[  ]',
        'temperatureMeasurement(0x402).maxMeasuredValue(0x2)=null',
        'temperatureMeasurement(0x402).measuredValue(0x0)=2400',
        'temperatureMeasurement(0x402).minMeasuredValue(0x1)=null',
        'temperatureMeasurement(0x402).tolerance(0x3)=0',
      ].sort(),
    );
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
