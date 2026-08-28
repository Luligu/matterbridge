/**
 * @file packages/core/vitest/devices/evse.test.ts
 * @description This file contains the tests for the Evse device.
 * @author Luca Liguori
 */

const NAME = 'Evse';
const MATTER_PORT = 8005;
const MATTER_CREATE_ONLY = true;

import { Time } from '@matter/general';
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
import { DeviceEnergyManagement } from '@matter/types/clusters/device-energy-management';
import { DeviceEnergyManagementMode } from '@matter/types/clusters/device-energy-management-mode';
import { ElectricalEnergyMeasurement } from '@matter/types/clusters/electrical-energy-measurement';
import { ElectricalPowerMeasurement } from '@matter/types/clusters/electrical-power-measurement';
import { EnergyEvse } from '@matter/types/clusters/energy-evse';
import { EnergyEvseMode } from '@matter/types/clusters/energy-evse-mode';
import { Identify } from '@matter/types/clusters/identify';
import { PowerSource } from '@matter/types/clusters/power-source';
import { EndpointNumber } from '@matter/types/datatype';
import { loggerErrorSpy, loggerFatalSpy, loggerLogSpy, loggerWarnSpy, setupTest } from '@matterbridge/vitest-utils';
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
} from '@matterbridge/vitest-utils/matter';
import { LogLevel, stringify } from 'node-ansi-logger';

import { MatterbridgeDeviceEnergyManagementModeServer } from '../../src/behaviors/deviceEnergyManagementModeServer.js';
import { Evse, MatterbridgeEnergyEvseModeServer, MatterbridgeEnergyEvseServer } from '../../src/devices/evse.js';
import { evse } from '../../src/matterbridgeDeviceTypes.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  let device: Evse;

  beforeAll(async () => {
    // Setup the Matter test environment
    await createTestEnvironment();
  });

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    expect(loggerWarnSpy).not.toHaveBeenCalled();
    expect(loggerErrorSpy).not.toHaveBeenCalled();
    expect(loggerFatalSpy).not.toHaveBeenCalled();
  });

  afterAll(async () => {
    // Destroy the Matter test environment
    await destroyTestEnvironment();
    // Restore all mocks
    vi.restoreAllMocks();
  });

  test('create the server node', async () => {
    await createServerNode(MATTER_PORT, evse.code);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('create a Evse device', () => {
    device = new Evse('EVSE Test Device', 'EVSE12456');
    expect(device).toBeDefined();
    expect(device.id).toBe('EVSETestDevice-EVSE12456');
    expect(device.hasClusterServer(Identify.id)).toBeTruthy();
    expect(device.hasClusterServer(EnergyEvseServer)).toBeTruthy();
    expect(device.hasClusterServer(EnergyEvseModeServer)).toBeTruthy();
    expect(device.hasClusterServer(TemperatureMeasurementServer)).toBeTruthy();
    expect(device.hasClusterServer(PowerSourceServer)).toBeFalsy();
    expect(device.hasClusterServer(ElectricalPowerMeasurementServer)).toBeFalsy();
    expect(device.hasClusterServer(ElectricalEnergyMeasurementServer)).toBeFalsy();
    expect(device.hasClusterServer(DeviceEnergyManagementServer)).toBeFalsy();
    expect(device.getChildEndpointById('PowerSource')?.hasClusterServer(PowerSource.id)).toBeTruthy();
    expect(device.getChildEndpointById('ElectricalSensor')?.hasClusterServer(ElectricalEnergyMeasurement.id)).toBeTruthy();
    expect(device.getChildEndpointById('ElectricalSensor')?.hasClusterServer(ElectricalPowerMeasurement.id)).toBeTruthy();
    expect(device.getChildEndpointById('DeviceEnergyManagement')?.hasClusterServer(DeviceEnergyManagement.id)).toBeTruthy();
    expect(device.getChildEndpointById('DeviceEnergyManagement')?.hasClusterServer(DeviceEnergyManagementMode.id)).toBeTruthy();
  });

  test('create an Evse with explicit endpoint and measurement options', () => {
    const tagList = [{ mfgCode: null, namespaceId: 1, tag: 1, label: 'One' }];
    const optionsDevice = new Evse('EVSE', 'EVSE-OPTIONS', {
      id: 'EvseOptions',
      number: EndpointNumber(14_01),
      tagList,
      currentMode: 1,
      supportedModes: [{ label: 'Manual', mode: 1, modeTags: [{ value: EnergyEvseMode.ModeTag.Manual }] }],
      state: EnergyEvse.State.PluggedInDemand,
      supplyState: EnergyEvse.SupplyState.Disabled,
      faultState: EnergyEvse.FaultState.NoError,
      voltage: 230_000,
      current: 10_000,
      power: 2_300_000,
      energy: 5_000,
      absMinPower: 1_000,
      absMaxPower: 7_400_000,
    });
    expect(optionsDevice.id).toBe('EvseOptions');
    expect(optionsDevice.number).toBe(EndpointNumber(14_01));
    expect(optionsDevice.tagList).toEqual(tagList);
  });

  test('create an Evse with an empty options object', () => {
    expect(new Evse('EVSE Defaults', 'EVSE-DEFAULTS', {})).toBeDefined();
  });

  test('createDefaultEnergyEvseClusterServer argument normalization and chaining', () => {
    const requireSpy = vi.spyOn(device.behaviors, 'require').mockImplementation(() => {});
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

  test('device forEachAttribute', () => {
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
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 1292, revision: 2 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: false }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[ 3, 4, 5 ]',
        'descriptor(0x1d).serverList(0x1)=[ 3, 29, 64, 153, 157, 1026 ]',
        'energyEvse(0x99).acceptedCommandList(0xfff9)=[ 1, 2, 4, 5, 6, 7 ]',
        'energyEvse(0x99).attributeList(0xfffb)=[ 0, 1, 2, 3, 5, 6, 7, 9, 35, 36, 37, 38, 64, 65, 66, 65528, 65529, 65531, 65532, 65533 ]',
        'energyEvse(0x99).chargingEnabledUntil(0x3)=null',
        'energyEvse(0x99).circuitCapacity(0x5)=32000',
        'energyEvse(0x99).clusterRevision(0xfffd)=4',
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
        'temperatureMeasurement(0x402).clusterRevision(0xfffd)=6',
        'temperatureMeasurement(0x402).featureMap(0xfffc)={  }',
        'temperatureMeasurement(0x402).generatedCommandList(0xfff8)=[  ]',
        'temperatureMeasurement(0x402).maxMeasuredValue(0x2)=null',
        'temperatureMeasurement(0x402).measuredValue(0x0)=2400',
        'temperatureMeasurement(0x402).minMeasuredValue(0x1)=null',
        'temperatureMeasurement(0x402).tolerance(0x3)=0',
      ].toSorted(),
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
    vi.clearAllMocks();
    await dem.invokeBehaviorCommand(DeviceEnergyManagementModeServer, 'changeToMode', { newMode: 0 }); // 0 is not a valid mode
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `MatterbridgeDeviceEnergyManagementModeServer changeToMode called with unsupported newMode: 0`);
    vi.clearAllMocks();
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
    expect((device as any).state['energyEvse'].acceptedCommandList).toEqual([1, 2, 4, 5, 6, 7]);
    expect((device as any).state['energyEvse'].generatedCommandList).toEqual([0]);
    expect((device.stateOf(MatterbridgeEnergyEvseServer) as any).acceptedCommandList).toEqual([1, 2, 4, 5, 6, 7]);
    expect((device.stateOf(MatterbridgeEnergyEvseServer) as any).generatedCommandList).toEqual([0]);

    vi.clearAllMocks();
    await device.invokeBehaviorCommand(EnergyEvseServer, 'disable');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeEnergyEvseServer: disable called (endpoint ${device.id}.${device.number})`);

    vi.clearAllMocks();
    await device.setAttribute('energyEvse', 'state', EnergyEvse.State.PluggedInCharging);
    await device.invokeBehaviorCommand(EnergyEvseServer, 'disable');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeEnergyEvseServer: disable called (endpoint ${device.id}.${device.number})`);

    vi.clearAllMocks();
    await device.invokeBehaviorCommand(EnergyEvseServer, 'enableCharging', { chargingEnabledUntil: null, minimumChargeCurrent: 6000, maximumChargeCurrent: 0 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeEnergyEvseServer: enableCharging called (endpoint ${device.id}.${device.number})`);

    vi.clearAllMocks();
    await device.invokeBehaviorCommand(EnergyEvseServer, 'enableCharging', { chargingEnabledUntil: null, minimumChargeCurrent: 6000, maximumChargeCurrent: 60_000 });
    expect(device.getAttribute(EnergyEvse.id, 'maximumChargeCurrent')).toBe(32_000);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeEnergyEvseServer: enableCharging called (endpoint ${device.id}.${device.number})`);

    await device.invokeBehaviorCommand(EnergyEvseServer, 'enableCharging', { chargingEnabledUntil: null, minimumChargeCurrent: 6000, maximumChargeCurrent: 12_000 });
    vi.useFakeTimers();
    try {
      await device.setAttribute('energyEvse', 'userMaximumChargeCurrent', 6_000);
      await vi.advanceTimersByTimeAsync(0);
      expect(device.getAttribute(EnergyEvse.id, 'maximumChargeCurrent')).toBe(6_000);
      await device.setAttribute('energyEvse', 'userMaximumChargeCurrent', 32_000);
      await vi.advanceTimersByTimeAsync(0);
    } finally {
      vi.useRealTimers();
    }

    vi.clearAllMocks();
    await device.setAttribute('energyEvse', 'state', EnergyEvse.State.PluggedInDemand);
    await device.invokeBehaviorCommand(EnergyEvseServer, 'enableCharging', { chargingEnabledUntil: null, minimumChargeCurrent: 6000, maximumChargeCurrent: 0 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeEnergyEvseServer: enableCharging called (endpoint ${device.id}.${device.number})`);

    vi.clearAllMocks();
    const allDays = new EnergyEvse.TargetDayOfWeek(0x7f);
    const weekdayTarget = { targetTimeMinutesPastMidnight: 720, addedEnergy: 25_000_000 };
    await device.invokeBehaviorCommand(EnergyEvseServer.with(EnergyEvse.Feature.ChargingPreferences), 'setTargets', {
      chargingTargetSchedules: [{ dayOfWeekForSequence: allDays, chargingTargets: [weekdayTarget] }],
    });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`setTargets`));

    vi.clearAllMocks();
    const targets = await device.act(async (agent) => agent.get(MatterbridgeEnergyEvseServer).getTargets());
    expect(targets).toEqual({ chargingTargetSchedules: [{ dayOfWeekForSequence: allDays, chargingTargets: [weekdayTarget] }] });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`getTargets`));

    // Matter 1.6.0 § 9.3.9.5.2 replaces only the days selected by the update, preserving the other days.
    await device.invokeBehaviorCommand(EnergyEvseServer.with(EnergyEvse.Feature.ChargingPreferences), 'setTargets', {
      chargingTargetSchedules: [{ dayOfWeekForSequence: new EnergyEvse.TargetDayOfWeek(0x40), chargingTargets: [] }],
    });
    expect(await device.act(async (agent) => agent.get(MatterbridgeEnergyEvseServer).getTargets())).toEqual({
      chargingTargetSchedules: [
        { dayOfWeekForSequence: new EnergyEvse.TargetDayOfWeek(0x3f), chargingTargets: [weekdayTarget] },
        { dayOfWeekForSequence: new EnergyEvse.TargetDayOfWeek(0x40), chargingTargets: [] },
      ],
    });

    await expect(
      device.invokeBehaviorCommand(EnergyEvseServer.with(EnergyEvse.Feature.ChargingPreferences), 'setTargets', {
        chargingTargetSchedules: [
          { dayOfWeekForSequence: new EnergyEvse.TargetDayOfWeek(0x01), chargingTargets: [weekdayTarget] },
          { dayOfWeekForSequence: new EnergyEvse.TargetDayOfWeek(0x01), chargingTargets: [weekdayTarget] },
        ],
      }),
    ).rejects.toThrow('each day may occur in only one ChargingTargetSchedule');

    await expect(
      device.act(async (agent) =>
        agent.get(MatterbridgeEnergyEvseServer).setTargets({
          chargingTargetSchedules: [
            {
              dayOfWeekForSequence: new EnergyEvse.TargetDayOfWeek(0x40),
              chargingTargets: Array.from({ length: 11 }, (_, index) => ({ targetTimeMinutesPastMidnight: index * 60, targetSoC: 100 })),
            },
          ],
        }),
      ),
    ).rejects.toThrow('a ChargingTargetSchedule supports at most 10 charging targets');

    vi.clearAllMocks();
    await device.setAttribute('energyEvse', 'state', EnergyEvse.State.NotPluggedIn);
    await device.invokeBehaviorCommand(EnergyEvseServer.with(EnergyEvse.Feature.ChargingPreferences), 'setTargets', { chargingTargetSchedules: [] });
    await device.invokeBehaviorCommand(EnergyEvseServer.with(EnergyEvse.Feature.ChargingPreferences), 'clearTargets');
    expect(await device.act(async (agent) => agent.get(MatterbridgeEnergyEvseServer).getTargets())).toEqual({ chargingTargetSchedules: [] });
    expect(device.getAttribute(EnergyEvse.id, 'nextChargeStartTime')).toBeNull();
    expect(device.getAttribute(EnergyEvse.id, 'nextChargeTargetTime')).toBeNull();
    expect(device.getAttribute(EnergyEvse.id, 'nextChargeRequiredEnergy')).toBeNull();
    expect(device.getAttribute(EnergyEvse.id, 'nextChargeTargetSoC')).toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`clearTargets`));
  });

  test('invoke MatterbridgeEnergyEvseServer startDiagnostics command', async () => {
    expect(device.behaviors.elementsOf(EnergyEvseServer).commands.has('startDiagnostics')).toBeTruthy();
    expect(device.behaviors.elementsOf(MatterbridgeEnergyEvseServer).commands.has('startDiagnostics')).toBeTruthy();

    vi.clearAllMocks();
    await device.setAttribute('energyEvse', 'supplyState', EnergyEvse.SupplyState.Disabled);
    await device.invokeBehaviorCommand(EnergyEvseServer, 'startDiagnostics');
    expect(device.getAttribute(EnergyEvse.id, 'supplyState')).toBe(EnergyEvse.SupplyState.DisabledDiagnostics);
    expect(device.getAttribute(EnergyEvse.id, 'nextChargeStartTime')).toBeNull();
    expect(device.getAttribute(EnergyEvse.id, 'nextChargeTargetTime')).toBeNull();
    expect(device.getAttribute(EnergyEvse.id, 'nextChargeRequiredEnergy')).toBeNull();
    expect(device.getAttribute(EnergyEvse.id, 'nextChargeTargetSoC')).toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeEnergyEvseServer: startDiagnostics called (endpoint ${device.id}.${device.number})`);

    // Matter 1.6.0 § 9.3.9.4.1: StartDiagnostics is only valid while charging is disabled.
    await expect(device.invokeBehaviorCommand(EnergyEvseServer, 'startDiagnostics')).rejects.toThrow('diagnostics can only start while charging is disabled');

    // Matter 1.6.0 § 9.3.9.2.4: EnableCharging is rejected while diagnostics are active.
    await expect(
      device.invokeBehaviorCommand(EnergyEvseServer, 'enableCharging', { chargingEnabledUntil: null, minimumChargeCurrent: 6_000, maximumChargeCurrent: 32_000 }),
    ).rejects.toThrow('cannot enable charging while diagnostics are active');

    // Restore a normal supply state for subsequent tests.
    await device.setAttribute('energyEvse', 'supplyState', EnergyEvse.SupplyState.ChargingEnabled);
  });

  test('derive the next charging target when scheduled charging is enabled', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 27, 12, 0, 0));
    try {
      await device.setAttribute('energyEvse', 'state', EnergyEvse.State.PluggedInDemand);
      await device.invokeBehaviorCommand(EnergyEvseServer.with(EnergyEvse.Feature.ChargingPreferences), 'setTargets', {
        chargingTargetSchedules: [
          {
            dayOfWeekForSequence: new EnergyEvse.TargetDayOfWeek(0x7f),
            chargingTargets: [{ targetTimeMinutesPastMidnight: 23 * 60 + 59, addedEnergy: 25_000_000 }],
          },
        ],
      });
      await device.invokeBehaviorCommand(EnergyEvseServer, 'enableCharging', {
        chargingEnabledUntil: null,
        minimumChargeCurrent: 6_000,
        maximumChargeCurrent: 32_000,
      });

      const expectedTargetTime = Math.floor(new Date(2026, 7, 27, 23, 59, 0).getTime() / 1000);
      expect(device.getAttribute(EnergyEvse.id, 'nextChargeTargetTime')).toBe(expectedTargetTime);
      expect(device.getAttribute(EnergyEvse.id, 'nextChargeStartTime')).toBeLessThan(expectedTargetTime);
      expect(device.getAttribute(EnergyEvse.id, 'nextChargeRequiredEnergy')).toBe(25_000_000);
      expect(device.getAttribute(EnergyEvse.id, 'nextChargeTargetSoC')).toBeNull();

      // Matter 1.6.0 §§ 9.3.8.14-15 make the energy and SoC attributes mutually descriptive for the next target.
      await device.invokeBehaviorCommand(EnergyEvseServer.with(EnergyEvse.Feature.ChargingPreferences), 'setTargets', {
        chargingTargetSchedules: [
          {
            dayOfWeekForSequence: new EnergyEvse.TargetDayOfWeek(0x7f),
            chargingTargets: [
              { targetTimeMinutesPastMidnight: 2, targetSoC: 100 },
              { targetTimeMinutesPastMidnight: 1, targetSoC: 100 },
            ],
          },
        ],
      });
      expect(device.getAttribute(EnergyEvse.id, 'nextChargeRequiredEnergy')).toBeNull();
      expect(device.getAttribute(EnergyEvse.id, 'nextChargeTargetSoC')).toBe(100);

      await device.invokeBehaviorCommand(EnergyEvseServer.with(EnergyEvse.Feature.ChargingPreferences), 'setTargets', {
        chargingTargetSchedules: [
          {
            dayOfWeekForSequence: new EnergyEvse.TargetDayOfWeek(0x7f),
            chargingTargets: [{ targetTimeMinutesPastMidnight: 1 }],
          },
        ],
      });
      expect(device.getAttribute(EnergyEvse.id, 'nextChargeTargetSoC')).toBeNull();
    } finally {
      await device.invokeBehaviorCommand(EnergyEvseServer.with(EnergyEvse.Feature.ChargingPreferences), 'clearTargets');
      vi.useRealTimers();
    }
  });

  test('stop charging and emit EnergyTransferStopped when ChargingEnabledUntil expires', async () => {
    vi.useFakeTimers();
    try {
      const energyTransferStopped = vi.fn();
      (device.events as any).energyEvse.energyTransferStopped.on(energyTransferStopped);
      await device.setAttribute('energyEvse', 'state', EnergyEvse.State.PluggedInDemand);
      await device.setAttribute('energyEvse', 'sessionId', 7);

      await device.invokeBehaviorCommand(EnergyEvseServer, 'enableCharging', {
        chargingEnabledUntil: Math.floor(Time.nowMs / 1000) + 5,
        minimumChargeCurrent: 6_000,
        maximumChargeCurrent: 32_000,
      });
      expect(device.getAttribute(EnergyEvse.id, 'state')).toBe(EnergyEvse.State.PluggedInCharging);

      await vi.advanceTimersByTimeAsync(5_000);
      expect(device.getAttribute(EnergyEvse.id, 'state')).toBe(EnergyEvse.State.PluggedInDemand);
      expect(device.getAttribute(EnergyEvse.id, 'supplyState')).toBe(EnergyEvse.SupplyState.Disabled);
      expect(energyTransferStopped).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 7,
          state: EnergyEvse.State.PluggedInCharging,
          reason: EnergyEvse.EnergyTransferStoppedReason.EvseStopped,
          energyTransferred: 0,
        }),
        expect.anything(),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  test('invoke MatterbridgeEvseModeServer commands', async () => {
    expect(device.behaviors.has(EnergyEvseModeServer)).toBeTruthy();
    expect(device.behaviors.has(MatterbridgeEnergyEvseModeServer)).toBeTruthy();
    expect(device.behaviors.elementsOf(EnergyEvseModeServer).commands.has('changeToMode')).toBeTruthy();
    expect(device.behaviors.elementsOf(MatterbridgeEnergyEvseModeServer).commands.has('changeToMode')).toBeTruthy();
    expect((device as any).state['energyEvseMode'].acceptedCommandList).toEqual([0]);
    expect((device as any).state['energyEvseMode'].generatedCommandList).toEqual([1]);

    vi.clearAllMocks();
    await device.invokeBehaviorCommand(EnergyEvseModeServer, 'changeToMode', { newMode: 0 }); // 0 is not a valid mode
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.ERROR,
      `MatterbridgeEnergyEvseModeServer: changeToMode called with unsupported newMode: 0 (endpoint ${device.id}.${device.number})`,
    );

    vi.clearAllMocks();
    await device.invokeBehaviorCommand(EnergyEvseModeServer, 'changeToMode', { newMode: 1 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeEnergyEvseModeServer: changing mode to 1 (endpoint ${device.id}.${device.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.DEBUG,
      `MatterbridgeEnergyEvseModeServer: changeToMode called with newMode 1 => On demand (endpoint ${device.id}.${device.number})`,
    );
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
