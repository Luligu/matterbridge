/**
 * @file packages/core/vitest/behaviors/thermostatServer.test.ts
 * @description This file contains the tests for thermostatServer.
 * @author Luca Liguori
 */

/* oxlint-disable vitest/no-commented-out-tests */

const NAME = 'ThermostatServer';
const MATTER_PORT = 13400;
const MATTER_CREATE_ONLY = true;

import { Bytes } from '@matter/general';
import { Status } from '@matter/types';
import { Thermostat } from '@matter/types/clusters/thermostat';
import { loggerLogSpy, setupTest } from '@matterbridge/vitest-utils';
import {
  addDevice,
  aggregator,
  createServerNode,
  createTestEnvironment,
  destroyTestEnvironment,
  flushServerNode,
  startServerNode,
  stopServerNode,
} from '@matterbridge/vitest-utils/matter';
import { LogLevel } from 'node-ansi-logger';

import { MatterbridgeThermostatServer } from '../../src/behaviors/thermostatServer.js';
import { thermostat } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';
import { expectCommand } from '../vitestUtils.js';

// Setup the test environment
await setupTest(NAME, false);

describe('MatterbridgeThermostatServer', () => {
  let thermo: MatterbridgeEndpoint;
  let thermostatPreset: MatterbridgeEndpoint;
  let thermostatSchedule: MatterbridgeEndpoint;
  let thermostatSuggestion: MatterbridgeEndpoint;

  const thermostatPresetTypes: Thermostat.PresetType[] = [
    { presetScenario: Thermostat.PresetScenario.Occupied, numberOfPresets: 2, presetTypeFeatures: { automatic: false, supportsNames: true } },
    { presetScenario: Thermostat.PresetScenario.Unoccupied, numberOfPresets: 2, presetTypeFeatures: { automatic: false, supportsNames: true } },
  ];
  const thermostatPresets: Thermostat.Preset[] = [
    { presetHandle: Uint8Array.from([0]), presetScenario: Thermostat.PresetScenario.Occupied, name: 'Occupied', coolingSetpoint: 2500, heatingSetpoint: 2100, builtIn: null },
    { presetHandle: Uint8Array.from([1]), presetScenario: Thermostat.PresetScenario.Unoccupied, name: 'Unoccupied', coolingSetpoint: 2700, heatingSetpoint: 1900, builtIn: null },
  ];

  function createPresetThermostatEndpoint(id: string): MatterbridgeEndpoint {
    const endpoint = new MatterbridgeEndpoint(thermostat, { id });
    endpoint.createDefaultPresetsThermostatClusterServer(
      23,
      21,
      25,
      2,
      0,
      48,
      2,
      50,
      undefined,
      undefined,
      undefined,
      undefined,
      Uint8Array.from([0]), // activePresetHandle: Uint8Array | null
      thermostatPresets, // presetsList: Thermostat.Preset[]
      thermostatPresetTypes, // presetTypesList: Thermostat.PresetType[]
    );
    endpoint.addRequiredClusterServers();
    return endpoint;
  }

  const thermostatScheduleTypes: Thermostat.ScheduleType[] = [
    {
      systemMode: Thermostat.SystemMode.Auto,
      numberOfSchedules: 2,
      scheduleTypeFeatures: { supportsSetpoints: true, supportsNames: true, supportsPresets: false, supportsOff: false },
    },
  ];
  const thermostatSchedules: Thermostat.Schedule[] = [
    {
      scheduleHandle: Uint8Array.from([0]),
      systemMode: Thermostat.SystemMode.Auto,
      name: 'Weekdays',
      transitions: [
        { dayOfWeek: { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true }, transitionTime: 420, coolingSetpoint: 2500, heatingSetpoint: 2100 },
      ],
      builtIn: null,
    },
    {
      scheduleHandle: Uint8Array.from([1]),
      systemMode: Thermostat.SystemMode.Auto,
      name: 'Weekend',
      transitions: [{ dayOfWeek: { saturday: true, sunday: true }, transitionTime: 480, coolingSetpoint: 2700, heatingSetpoint: 1900 }],
      builtIn: null,
    },
  ];

  function createScheduleThermostatEndpoint(id: string): MatterbridgeEndpoint {
    const endpoint = new MatterbridgeEndpoint(thermostat, { id });
    endpoint.createDefaultSchedulesThermostatClusterServer(
      23,
      21,
      25,
      2,
      0,
      48,
      2,
      50,
      undefined,
      undefined,
      undefined,
      undefined,
      Uint8Array.from([0]), // activeScheduleHandle: Uint8Array | null
      thermostatSchedules, // schedules: Thermostat.Schedule[]
      thermostatScheduleTypes, // scheduleTypes: Thermostat.ScheduleType[]
    );
    endpoint.addRequiredClusterServers();
    return endpoint;
  }

  function createThermostatSuggestionEndpoint(id: string): MatterbridgeEndpoint {
    const endpoint = new MatterbridgeEndpoint(thermostat, { id });
    endpoint.createDefaultThermostatSuggestionsClusterServer(
      23,
      21,
      25,
      2,
      0,
      48,
      2,
      50,
      undefined,
      undefined,
      undefined,
      undefined,
      Uint8Array.from([0]), // activePresetHandle: Uint8Array | null
      thermostatPresets, // presetsList: Thermostat.Preset[]
      thermostatPresetTypes, // presetTypesList: Thermostat.PresetType[]
      [], // thermostatSuggestions: Thermostat.ThermostatSuggestion[]
    );
    endpoint.addRequiredClusterServers();
    return endpoint;
  }

  beforeAll(async () => {
    // Setup the Matter test environment
    await createTestEnvironment();

    // Create the server node and aggregator
    await createServerNode(MATTER_PORT);

    // Start the server node if not in create-only mode
    if (!MATTER_CREATE_ONLY) await startServerNode();
  });

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterAll(async () => {
    // Stop or flush the server node depending on the create-only mode
    if (MATTER_CREATE_ONLY) await flushServerNode();
    else await stopServerNode();

    // Destroy the Matter test environment
    await destroyTestEnvironment();

    // Restore all mocks
    vi.restoreAllMocks();
  });

  test('Device type: thermostat', async () => {
    thermo = new MatterbridgeEndpoint(thermostat, { id: 'thermostat' });
    thermo.addRequiredClusterServers();
    expect(thermo).toBeDefined();
    expect(await addDevice(aggregator, thermo)).toBeTruthy();
  });

  test('Device type: thermostatPreset', async () => {
    thermostatPreset = createPresetThermostatEndpoint('thermostatPreset');
    expect(thermostatPreset).toBeDefined();
    expect(await addDevice(aggregator, thermostatPreset)).toBeTruthy();
  });

  test('Thermostat server', async () => {
    const setBothRequest = { mode: Thermostat.SetpointRaiseLowerMode.Both, amount: 5 };
    const setHeatRequest = { mode: Thermostat.SetpointRaiseLowerMode.Heat, amount: 5 };
    const setCoolRequest = { mode: Thermostat.SetpointRaiseLowerMode.Cool, amount: 5 };
    const initialThermostatCluster = thermo.getCluster(MatterbridgeThermostatServer);

    expect(initialThermostatCluster).toMatchObject({ occupiedHeatingSetpoint: 2100, occupiedCoolingSetpoint: 2500 });
    const thermostatBehavior = MatterbridgeThermostatServer.with(Thermostat.Feature.Heating, Thermostat.Feature.Cooling, Thermostat.Feature.AutoMode);
    expect((thermo.stateOf(thermostatBehavior) as any).acceptedCommandList).toEqual([0]);
    expect((thermo.stateOf(thermostatBehavior) as any).generatedCommandList).toEqual([]);

    await expectCommand(thermo, Thermostat, 'setpointRaiseLower', setBothRequest, (data) => {
      expect(data.cluster).toBe('thermostat');
    });

    let updatedThermostatCluster = thermo.getCluster(MatterbridgeThermostatServer);

    expect(updatedThermostatCluster).toMatchObject({ occupiedHeatingSetpoint: 2150, occupiedCoolingSetpoint: 2550 });

    await thermo.invokeBehaviorCommand('Thermostat', 'setpointRaiseLower', setHeatRequest);
    updatedThermostatCluster = thermo.getCluster(MatterbridgeThermostatServer);

    expect(updatedThermostatCluster).toMatchObject({ occupiedHeatingSetpoint: 2200, occupiedCoolingSetpoint: 2550 });

    await thermo.invokeBehaviorCommand('Thermostat', 'setpointRaiseLower', setCoolRequest);

    updatedThermostatCluster = thermo.getCluster(MatterbridgeThermostatServer);

    expect(updatedThermostatCluster).toMatchObject({ occupiedHeatingSetpoint: 2200, occupiedCoolingSetpoint: 2600 });
  });

  /*
  test('Thermostat server ignores undefined occupied setpoints', async () => {
    const executeHandler = jest.fn();
    const info = jest.fn();
    const debug = jest.fn();
    const thermostatState = { occupiedHeatingSetpoint: undefined, occupiedCoolingSetpoint: undefined };
    const endpoint = {
      maybeId: 'thermostatUndefinedSetpoints',
      maybeNumber: 1,
      stateOf: () => ({ log: { info, debug }, commandHandler: { executeHandler } }),
    };
    const thermostatServer = { state: thermostatState, endpoint } as unknown as MatterbridgeThermostatServer;

    await MatterbridgeThermostatServer.prototype.setpointRaiseLower.call(thermostatServer, { mode: Thermostat.SetpointRaiseLowerMode.Both, amount: 5 });

    expect(executeHandler).toHaveBeenCalledWith('Thermostat.setpointRaiseLower', {
      request: { mode: Thermostat.SetpointRaiseLowerMode.Both, amount: 5 },
      cluster: 'thermostat',
      attributes: thermostatState,
      endpoint,
    });
    expect(info).toHaveBeenCalled();
    expect(debug).toHaveBeenCalledWith('MatterbridgeThermostatServer: setpointRaiseLower called with mode: Both amount: 0.5');
    expect(thermostatState.occupiedHeatingSetpoint).toBeUndefined();
    expect(thermostatState.occupiedCoolingSetpoint).toBeUndefined();
  });
  */

  test('PresetThermostat server', async () => {
    thermostatPreset = createPresetThermostatEndpoint('thermostatPresetBehavior');
    expect(await addDevice(aggregator, thermostatPreset)).toBeTruthy();

    const formatPresetHandleForLog = (presetHandle: Uint8Array | null): string => (presetHandle ? `0x${Buffer.from(presetHandle).toString('hex')}` : 'null');
    const setHeatRequest = { mode: Thermostat.SetpointRaiseLowerMode.Heat, amount: 5 };
    const setCoolRequest = { mode: Thermostat.SetpointRaiseLowerMode.Cool, amount: 5 };
    const firstPresetRequest = { presetHandle: Uint8Array.from([0]) };
    const secondPresetRequest = { presetHandle: Uint8Array.from([1]) };
    const clearPresetRequest = { presetHandle: null };
    const invalidPresetRequest = { presetHandle: Uint8Array.from([9]) };
    const presetThermostatBehavior = MatterbridgeThermostatServer.with(
      Thermostat.Feature.Heating,
      Thermostat.Feature.Cooling,
      Thermostat.Feature.AutoMode,
      Thermostat.Feature.Presets,
    );
    const presetCalls: Array<{ cluster: string; endpoint: MatterbridgeEndpoint; request: object }> = [];

    thermostatPreset.addCommandHandler('setActivePresetRequest', (data) => {
      presetCalls.push({ cluster: data.cluster, endpoint: data.endpoint, request: data.request });
    });

    const expectPresetThermostatAttributes = (activePresetHandle: Uint8Array | null, occupiedHeatingSetpoint: number = 2100, occupiedCoolingSetpoint: number = 2500): void => {
      const presetThermostatCluster = thermostatPreset.getCluster(presetThermostatBehavior);

      expect(presetThermostatCluster).toMatchObject({
        localTemperature: 2300,
        systemMode: Thermostat.SystemMode.Auto,
        occupiedHeatingSetpoint,
        occupiedCoolingSetpoint,
        numberOfPresets: 2,
      });
      expect(presetThermostatCluster?.activePresetHandle === null ? null : JSON.stringify(Object.values(presetThermostatCluster?.activePresetHandle ?? {}))).toBe(
        activePresetHandle === null ? null : JSON.stringify(Array.from(activePresetHandle)),
      );
      expect(presetThermostatCluster?.presets).toHaveLength(2);
      expect(presetThermostatCluster?.presets?.[0]).toMatchObject({
        presetScenario: Thermostat.PresetScenario.Occupied,
        name: 'Occupied',
        coolingSetpoint: 2500,
        heatingSetpoint: 2100,
        builtIn: true,
      });
      expect(JSON.stringify(Object.values(presetThermostatCluster?.presets?.[0]?.presetHandle ?? {}))).toBe(JSON.stringify([0]));
      expect(presetThermostatCluster?.presets?.[1]).toMatchObject({
        presetScenario: Thermostat.PresetScenario.Unoccupied,
        name: 'Unoccupied',
        coolingSetpoint: 2700,
        heatingSetpoint: 1900,
        builtIn: true,
      });
      expect(JSON.stringify(Object.values(presetThermostatCluster?.presets?.[1]?.presetHandle ?? {}))).toBe(JSON.stringify([1]));
      expect(presetThermostatCluster?.presetTypes).toHaveLength(2);
      expect(presetThermostatCluster?.presetTypes?.[0]).toMatchObject({
        presetScenario: Thermostat.PresetScenario.Occupied,
        numberOfPresets: 2,
        presetTypeFeatures: { automatic: false, supportsNames: true },
      });
      expect(presetThermostatCluster?.presetTypes?.[1]).toMatchObject({
        presetScenario: Thermostat.PresetScenario.Unoccupied,
        numberOfPresets: 2,
        presetTypeFeatures: { automatic: false, supportsNames: true },
      });
    };

    expectPresetThermostatAttributes(Uint8Array.from([0]));

    await expectCommand(thermostatPreset, Thermostat, 'setpointRaiseLower', setHeatRequest, (data) => {
      expect(data.cluster).toBe('thermostat');
    });

    expectPresetThermostatAttributes(null, 2150, 2500);

    await thermostatPreset.invokeBehaviorCommand('Thermostat', 'setpointRaiseLower', setCoolRequest);

    expectPresetThermostatAttributes(null, 2150, 2550);

    await thermostatPreset.invokeBehaviorCommand('Thermostat', 'setActivePresetRequest', firstPresetRequest);

    expect(presetCalls[0]).toEqual({ cluster: 'thermostat', endpoint: thermostatPreset, request: firstPresetRequest });
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `MatterbridgeThermostatServer: setting preset to ${formatPresetHandleForLog(firstPresetRequest.presetHandle)} (endpoint ${thermostatPreset.id}.${thermostatPreset.number})`,
    );
    expectPresetThermostatAttributes(null, 2100, 2500);

    await thermostatPreset.invokeBehaviorCommand('Thermostat', 'setActivePresetRequest', secondPresetRequest);
    expect(presetCalls[1]).toEqual({ cluster: 'thermostat', endpoint: thermostatPreset, request: secondPresetRequest });
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `MatterbridgeThermostatServer: setting preset to ${formatPresetHandleForLog(secondPresetRequest.presetHandle)} (endpoint ${thermostatPreset.id}.${thermostatPreset.number})`,
    );
    expectPresetThermostatAttributes(null, 1900, 2700);

    await thermostatPreset.invokeBehaviorCommand('Thermostat', 'setActivePresetRequest', clearPresetRequest);
    expect(presetCalls[2]).toEqual({ cluster: 'thermostat', endpoint: thermostatPreset, request: clearPresetRequest });
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `MatterbridgeThermostatServer: setting preset to ${formatPresetHandleForLog(clearPresetRequest.presetHandle)} (endpoint ${thermostatPreset.id}.${thermostatPreset.number})`,
    );
    expectPresetThermostatAttributes(null, 1900, 2700);

    await expect(thermostatPreset.invokeBehaviorCommand('Thermostat', 'setActivePresetRequest', invalidPresetRequest)).rejects.toThrow('Requested PresetHandle not found');
    expect(presetCalls[3]).toEqual({ cluster: 'thermostat', endpoint: thermostatPreset, request: invalidPresetRequest });
    expect(presetCalls).toHaveLength(4);
    expectPresetThermostatAttributes(null, 1900, 2700);
  });

  test('ScheduleThermostat server', async () => {
    thermostatSchedule = createScheduleThermostatEndpoint('thermostatScheduleBehavior');
    expect(await addDevice(aggregator, thermostatSchedule)).toBeTruthy();

    const scheduleThermostatBehavior = MatterbridgeThermostatServer.with(
      Thermostat.Feature.Heating,
      Thermostat.Feature.Cooling,
      Thermostat.Feature.AutoMode,
      Thermostat.Feature.MatterScheduleConfiguration,
    );
    expect(thermostatSchedule.behaviors.has(scheduleThermostatBehavior)).toBeTruthy();
    expect(thermostatSchedule.behaviors.elementsOf(scheduleThermostatBehavior).commands.has('setActiveScheduleRequest')).toBeTruthy();

    const formatScheduleHandleForLog = (scheduleHandle: Uint8Array): string => `0x${Buffer.from(scheduleHandle).toString('hex')}`;
    const secondScheduleRequest = { scheduleHandle: Uint8Array.from([1]) };
    const invalidScheduleRequest = { scheduleHandle: Uint8Array.from([9]) };
    const scheduleCalls: Array<{ cluster: string; endpoint: MatterbridgeEndpoint; request: object }> = [];

    thermostatSchedule.addCommandHandler('setActiveScheduleRequest', (data) => {
      scheduleCalls.push({ cluster: data.cluster, endpoint: data.endpoint, request: data.request });
    });

    expect(thermostatSchedule.getAttribute(Thermostat.id, 'activeScheduleHandle')).toEqual(Uint8Array.from([0]));

    await thermostatSchedule.invokeBehaviorCommand('Thermostat', 'setActiveScheduleRequest', secondScheduleRequest);
    expect(scheduleCalls[0]).toEqual({ cluster: 'thermostat', endpoint: thermostatSchedule, request: secondScheduleRequest });
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `MatterbridgeThermostatServer: setting schedule to ${formatScheduleHandleForLog(secondScheduleRequest.scheduleHandle)} (endpoint ${thermostatSchedule.id}.${thermostatSchedule.number})`,
    );
    expect(thermostatSchedule.getAttribute(Thermostat.id, 'activeScheduleHandle')).toEqual(Uint8Array.from([1]));

    // The stored activeScheduleHandle must be a defensive copy, not a reference to the request payload.
    secondScheduleRequest.scheduleHandle[0] = 0xff;
    expect(thermostatSchedule.getAttribute(Thermostat.id, 'activeScheduleHandle')).toEqual(Uint8Array.from([1]));

    await expect(thermostatSchedule.invokeBehaviorCommand('Thermostat', 'setActiveScheduleRequest', invalidScheduleRequest)).rejects.toMatchObject({ code: Status.InvalidCommand });
    expect(scheduleCalls[1]).toEqual({ cluster: 'thermostat', endpoint: thermostatSchedule, request: invalidScheduleRequest });
    expect(scheduleCalls).toHaveLength(2);
    // The active schedule handle must not change when the requested schedule handle is invalid.
    expect(thermostatSchedule.getAttribute(Thermostat.id, 'activeScheduleHandle')).toEqual(Uint8Array.from([1]));
  });

  test('ThermostatSuggestion server', async () => {
    thermostatSuggestion = createThermostatSuggestionEndpoint('thermostatSuggestionBehavior');
    expect(await addDevice(aggregator, thermostatSuggestion)).toBeTruthy();

    const addCalls: Array<{ cluster: string; endpoint: MatterbridgeEndpoint; request: object }> = [];
    const removeCalls: Array<{ cluster: string; endpoint: MatterbridgeEndpoint; request: object }> = [];

    thermostatSuggestion.addCommandHandler('addThermostatSuggestion', (data) => {
      addCalls.push({ cluster: data.cluster, endpoint: data.endpoint, request: data.request });
    });
    thermostatSuggestion.addCommandHandler('removeThermostatSuggestion', (data) => {
      removeCalls.push({ cluster: data.cluster, endpoint: data.endpoint, request: data.request });
    });

    expect(thermostatSuggestion.getAttribute(Thermostat.id, 'maxThermostatSuggestions')).toBe(5);
    expect(thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestions')).toHaveLength(0);
    expect(thermostatSuggestion.getAttribute(Thermostat.id, 'activePresetHandle')).toEqual(Uint8Array.from([0]));

    // Freeze the clock so EffectiveTime/ExpirationTime comparisons below are deterministic.
    const now = new Date('2026-01-15T10:00:00Z');
    vi.useFakeTimers();
    try {
      vi.setSystemTime(now);
      const nowSeconds = Math.floor(now.getTime() / 1000);

      // A suggestion referencing an existing preset that is already effective (EffectiveTime in the past) is accepted
      // and immediately applied: CurrentThermostatSuggestion, ActivePresetHandle and ThermostatSuggestionNotFollowingReason
      // are updated, mirroring connectedhomeip's ReEvaluateCurrentSuggestion().
      const explicitRequest = { presetHandle: Uint8Array.from([1]), effectiveTime: nowSeconds - 60, expirationInMinutes: 30 };
      await thermostatSuggestion.invokeBehaviorCommand('Thermostat', 'addThermostatSuggestion', explicitRequest);
      expect(addCalls[0]).toEqual({ cluster: 'thermostat', endpoint: thermostatSuggestion, request: explicitRequest });
      let suggestions = thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestions');
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0]).toMatchObject({ uniqueId: 0, effectiveTime: nowSeconds - 60, expirationTime: nowSeconds - 60 + 1800 });
      expect(JSON.stringify(Object.values(suggestions[0].presetHandle))).toBe(JSON.stringify([1]));
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'currentThermostatSuggestion')).toMatchObject({ uniqueId: 0 });
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'activePresetHandle')).toEqual(Uint8Array.from([1]));
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestionNotFollowingReason')).toBeNull();

      // A null effectiveTime means "immediately": the server fills in the current time. Since the first suggestion
      // became effective earlier, it keeps being the earliest active one and stays current.
      const immediateRequest = { presetHandle: Uint8Array.from([0]), effectiveTime: null, expirationInMinutes: 60 };
      await thermostatSuggestion.invokeBehaviorCommand('Thermostat', 'addThermostatSuggestion', immediateRequest);
      expect(addCalls[1]).toEqual({ cluster: 'thermostat', endpoint: thermostatSuggestion, request: immediateRequest });
      suggestions = thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestions');
      expect(suggestions).toHaveLength(2);
      expect(suggestions[1].uniqueId).toBe(1);
      expect(suggestions[1].effectiveTime).toBe(nowSeconds);
      expect(suggestions[1].expirationTime).toBe(nowSeconds + 3600);
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'currentThermostatSuggestion')).toMatchObject({ uniqueId: 0 });
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'activePresetHandle')).toEqual(Uint8Array.from([1]));

      // An EffectiveTime more than 24 hours in the future is rejected.
      const futureRequest = { presetHandle: Uint8Array.from([0]), effectiveTime: nowSeconds + 24 * 60 * 60 + 1, expirationInMinutes: 30 };
      await expect(thermostatSuggestion.invokeBehaviorCommand('Thermostat', 'addThermostatSuggestion', futureRequest)).rejects.toThrow(
        'requested EffectiveTime is more than 24 hours in the future',
      );
      expect(addCalls[2]).toEqual({ cluster: 'thermostat', endpoint: thermostatSuggestion, request: futureRequest });
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestions')).toHaveLength(2);

      // An unknown PresetHandle is rejected, but the command is still forwarded to the command handler first.
      const invalidPresetRequest = { presetHandle: Uint8Array.from([9]), effectiveTime: nowSeconds, expirationInMinutes: 30 };
      await expect(thermostatSuggestion.invokeBehaviorCommand('Thermostat', 'addThermostatSuggestion', invalidPresetRequest)).rejects.toThrow('requested PresetHandle not found');
      expect(addCalls[3]).toEqual({ cluster: 'thermostat', endpoint: thermostatSuggestion, request: invalidPresetRequest });
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestions')).toHaveLength(2);

      // Fill the list up to MaxThermostatSuggestions (5) with suggestions that are not yet effective (2+ hours out),
      // then the next add is rejected as ResourceExhausted. None of them preempt the already-active current one.
      for (let i = 0; i < 3; i++) {
        await thermostatSuggestion.invokeBehaviorCommand('Thermostat', 'addThermostatSuggestion', {
          presetHandle: Uint8Array.from([0]),
          effectiveTime: nowSeconds + 7200 + i * 60,
          expirationInMinutes: 30,
        });
      }
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestions')).toHaveLength(5);
      const overflowRequest = { presetHandle: Uint8Array.from([0]), effectiveTime: nowSeconds, expirationInMinutes: 30 };
      await expect(thermostatSuggestion.invokeBehaviorCommand('Thermostat', 'addThermostatSuggestion', overflowRequest)).rejects.toThrow(
        'maximum number of thermostat suggestions reached',
      );
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestions')).toHaveLength(5);
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'currentThermostatSuggestion')).toMatchObject({ uniqueId: 0 });

      // Removing a different, not-yet-effective suggestion (uniqueId 4) keeps CurrentThermostatSuggestion unchanged.
      const removeOtherRequest = { uniqueId: 4 };
      await thermostatSuggestion.invokeBehaviorCommand('Thermostat', 'removeThermostatSuggestion', removeOtherRequest);
      expect(removeCalls[0]).toEqual({ cluster: 'thermostat', endpoint: thermostatSuggestion, request: removeOtherRequest });
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestions')).toHaveLength(4);
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'currentThermostatSuggestion')).toMatchObject({ uniqueId: 0 });

      // Removing the current suggestion (uniqueId 0) re-evaluates and applies the next earliest already-active one
      // (uniqueId 1), syncing ActivePresetHandle to it: the thermostat keeps following a suggestion automatically.
      const removeCurrentRequest = { uniqueId: 0 };
      await thermostatSuggestion.invokeBehaviorCommand('Thermostat', 'removeThermostatSuggestion', removeCurrentRequest);
      expect(removeCalls[1]).toEqual({ cluster: 'thermostat', endpoint: thermostatSuggestion, request: removeCurrentRequest });
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestions')).toHaveLength(3);
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'currentThermostatSuggestion')).toMatchObject({ uniqueId: 1 });
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'activePresetHandle')).toEqual(Uint8Array.from([0]));

      // An unknown UniqueID is rejected, but the command is still forwarded to the command handler first.
      const invalidRemoveRequest = { uniqueId: 99 };
      await expect(thermostatSuggestion.invokeBehaviorCommand('Thermostat', 'removeThermostatSuggestion', invalidRemoveRequest)).rejects.toThrow('requested UniqueID not found');
      expect(removeCalls[2]).toEqual({ cluster: 'thermostat', endpoint: thermostatSuggestion, request: invalidRemoveRequest });
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestions')).toHaveLength(3);

      // Once the current suggestion's ExpirationTime elapses and no other suggestion is effective yet, the next
      // add/remove call prunes the expired entry and clears CurrentThermostatSuggestion; ActivePresetHandle, which
      // reflects the last-followed preset, is intentionally left untouched (mirrors the reference behavior).
      // ThermostatSuggestionNotFollowingReason is set here to a non-null value beforehand to verify it is cleared
      // alongside CurrentThermostatSuggestion rather than leaking a stale reason (Matter spec: "If the
      // CurrentThermostatSuggestion attribute is null, this attribute shall be set to null").
      await thermostatSuggestion.setAttribute(Thermostat.id, 'thermostatSuggestionNotFollowingReason', { ongoingHold: true });
      vi.setSystemTime(new Date((nowSeconds + 3601) * 1000));
      await thermostatSuggestion.invokeBehaviorCommand('Thermostat', 'removeThermostatSuggestion', { uniqueId: 3 });
      expect(removeCalls[3]).toEqual({ cluster: 'thermostat', endpoint: thermostatSuggestion, request: { uniqueId: 3 } });
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestions')).toHaveLength(1);
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'currentThermostatSuggestion')).toBeNull();
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'activePresetHandle')).toEqual(Uint8Array.from([0]));
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestionNotFollowingReason')).toBeNull();

      // A suggestion that becomes current, then expires, is pruned and re-evaluated as part of the next add/remove
      // call. If that call is itself rejected by a later validation (here EffectiveTime > 24h in the future), the
      // prune/re-evaluate performed earlier in the same command must not leak out: matter.js runs each command in
      // its own transaction and discards every mutation when the handler throws (LocalActorContext.act rejects the
      // transaction on error), so CurrentThermostatSuggestion/ThermostatSuggestions/ActivePresetHandle/
      // ThermostatSuggestionNotFollowingReason stay exactly as they were before the rejected command.
      await thermostatSuggestion.invokeBehaviorCommand('Thermostat', 'addThermostatSuggestion', {
        presetHandle: Uint8Array.from([1]),
        effectiveTime: null,
        expirationInMinutes: 1,
      });
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'currentThermostatSuggestion')).toMatchObject({ uniqueId: 0 });
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'activePresetHandle')).toEqual(Uint8Array.from([1]));

      await thermostatSuggestion.setAttribute(Thermostat.id, 'thermostatSuggestionNotFollowingReason', { ongoingHold: true });
      vi.setSystemTime(new Date(Date.now() + 61_000)); // past the uniqueId 0 suggestion's 1-minute ExpirationTime
      const currentSeconds = Math.floor(Date.now() / 1000);
      const rejectedRequest = { presetHandle: Uint8Array.from([0]), effectiveTime: currentSeconds + 25 * 60 * 60, expirationInMinutes: 30 };
      await expect(thermostatSuggestion.invokeBehaviorCommand('Thermostat', 'addThermostatSuggestion', rejectedRequest)).rejects.toThrow(
        'requested EffectiveTime is more than 24 hours in the future',
      );
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestions')).toHaveLength(2);
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'currentThermostatSuggestion')).toMatchObject({ uniqueId: 0 });
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'activePresetHandle')).toEqual(Uint8Array.from([1]));
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestionNotFollowingReason')).toMatchObject({ ongoingHold: true });

      // The next successful command finally prunes the now-expired suggestion and re-evaluates: CurrentThermostatSuggestion
      // becomes null and ThermostatSuggestionNotFollowingReason is cleared; ActivePresetHandle is left untouched.
      await thermostatSuggestion.invokeBehaviorCommand('Thermostat', 'removeThermostatSuggestion', { uniqueId: 2 });
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestions')).toHaveLength(0);
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'currentThermostatSuggestion')).toBeNull();
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'activePresetHandle')).toEqual(Uint8Array.from([1]));
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestionNotFollowingReason')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
    expect(thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestions')).toHaveLength(0);
    expect(thermostatSuggestion.getAttribute(Thermostat.id, 'currentThermostatSuggestion')).toBeNull();

    // Seed 3 ThermostatSuggestions entries, all referencing preset 0, to set up the Presets removal cascade below (the
    // scenario above already drains the list to empty, so it is reseeded here through real add commands, matching the
    // earlier scenarios, rather than the try/finally-scoped flow above). The first, being immediately effective,
    // becomes CurrentThermostatSuggestion as part of the add command's own re-evaluation. Removing preset 0 via a
    // Presets atomic write deletes the referencing entries and, since CurrentThermostatSuggestion references that
    // preset, nulls it (Matter 1.6 Application Cluster Spec § 4.3.11.50, points 1-2). matter.js only fires
    // `presets$AtomicChanged` through a committed atomic write (AtomicWriteHandler), which local-actor/command-context
    // test writes bypass entirely, so the event is emitted directly here, matching how AtomicWriteHandler.commitWrite()
    // does it.
    for (let i = 0; i < 3; i++) {
      await thermostatSuggestion.invokeBehaviorCommand('Thermostat', 'addThermostatSuggestion', {
        presetHandle: Uint8Array.from([0]),
        effectiveTime: null,
        expirationInMinutes: 30,
      });
    }
    expect(thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestions')).toHaveLength(3);
    expect(thermostatSuggestion.getAttribute(Thermostat.id, 'currentThermostatSuggestion')).toMatchObject({ presetHandle: Uint8Array.from([0]) });

    const thermostatSuggestionBehavior = MatterbridgeThermostatServer.with(
      Thermostat.Feature.Heating,
      Thermostat.Feature.Cooling,
      Thermostat.Feature.AutoMode,
      Thermostat.Feature.Presets,
      Thermostat.Feature.ThermostatSuggestions,
    );
    const presetsWithoutPreset0 = thermostatPresets.filter((p) => p.presetHandle === null || !Bytes.areEqual(p.presetHandle, Uint8Array.from([0])));
    thermostatSuggestion.eventsOf(thermostatSuggestionBehavior).presets$AtomicChanged?.emit(presetsWithoutPreset0, thermostatPresets, undefined as never);
    // The reactor runs in its own dedicated, independently-committed transaction (matching production), so its
    // effect is not necessarily visible synchronously after emit() returns.
    await vi.waitFor(() => {
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestions')).toHaveLength(0);
    });
    expect(thermostatSuggestion.getAttribute(Thermostat.id, 'currentThermostatSuggestion')).toBeNull();

    // Regression test: CurrentThermostatSuggestion must be nulled whenever its own PresetHandle was removed, even
    // when the ThermostatSuggestions list itself is unaffected (already empty here, so its length doesn't change).
    // Matter 1.6 Application Cluster Spec § 4.3.11.50 point 1 applies to CurrentThermostatSuggestion independently
    // of point 2 (which only covers ThermostatSuggestions entries).
    await thermostatSuggestion.setAttribute(Thermostat.id, 'currentThermostatSuggestion', {
      uniqueId: 5,
      presetHandle: Uint8Array.from([1]),
      effectiveTime: 1700000000,
      expirationTime: 1700001800,
    });
    const presetsWithoutPreset1 = presetsWithoutPreset0.filter((p) => p.presetHandle === null || !Bytes.areEqual(p.presetHandle, Uint8Array.from([1])));
    thermostatSuggestion.eventsOf(thermostatSuggestionBehavior).presets$AtomicChanged?.emit(presetsWithoutPreset1, presetsWithoutPreset0, undefined as never);
    await vi.waitFor(() => {
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'currentThermostatSuggestion')).toBeNull();
    });
    expect(thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestions')).toHaveLength(0);
  });

  test('removeThermostatSuggestionsForRemovedPresets branch coverage', () => {
    // Exercises MatterbridgeThermostatServer['removeThermostatSuggestionsForRemovedPresets'] directly against a stub
    // state/endpoint, mirroring the private-method call pattern used for setpointRaiseLower above. This sidesteps
    // matter.js's Presets struct validation on presets$AtomicChanged (which rejects a committed entry with a null
    // PresetHandle), letting each branch be exercised with data that would not otherwise reach the reactor.
    const info = vi.fn();
    const debug = vi.fn();
    const endpoint = {
      maybeId: 'thermostatSuggestionBranches',
      maybeNumber: 1,
      stateOf: (): { log: { info: typeof info; debug: typeof debug } } => ({ log: { info, debug } }),
    };
    const callReactor = (state: Record<string, unknown>, newPresets: Thermostat.Preset[], oldPresets: Thermostat.Preset[]): void => {
      const server = { state, endpoint } as unknown as MatterbridgeThermostatServer;
      (
        MatterbridgeThermostatServer.prototype as unknown as { removeThermostatSuggestionsForRemovedPresets: (n: Thermostat.Preset[], o: Thermostat.Preset[]) => void }
      ).removeThermostatSuggestionsForRemovedPresets.call(server, newPresets, oldPresets);
    };
    const pendingPreset: Thermostat.Preset = {
      presetHandle: null,
      presetScenario: Thermostat.PresetScenario.Sleep,
      name: 'Pending',
      coolingSetpoint: 2600,
      heatingSetpoint: 2000,
      builtIn: null,
    };
    const preset2: Thermostat.Preset = {
      presetHandle: Uint8Array.from([2]),
      presetScenario: Thermostat.PresetScenario.Wake,
      name: 'Preset2',
      coolingSetpoint: 2600,
      heatingSetpoint: 2000,
      builtIn: null,
    };
    const preset3: Thermostat.Preset = {
      presetHandle: Uint8Array.from([3]),
      presetScenario: Thermostat.PresetScenario.Vacation,
      name: 'Preset3',
      coolingSetpoint: 2600,
      heatingSetpoint: 2000,
      builtIn: null,
    };
    const suggestionForPreset2: Thermostat.ThermostatSuggestion = { uniqueId: 10, presetHandle: Uint8Array.from([2]), effectiveTime: 1700000000, expirationTime: 1700003600 };
    const suggestionForPreset3: Thermostat.ThermostatSuggestion = { uniqueId: 11, presetHandle: Uint8Array.from([3]), effectiveTime: 1700000000, expirationTime: 1700003600 };

    // Line 76 false branch + line 84 true branch: a Preset with a null PresetHandle (skipped, not deduped through
    // Bytes.toHex(null)) among presets that are only added, never removed, so the reactor returns early untouched.
    const state1 = { thermostatSuggestions: [suggestionForPreset2], currentThermostatSuggestion: suggestionForPreset2, thermostatSuggestionNotFollowingReason: null };
    callReactor(state1, [pendingPreset, preset2, preset3], [pendingPreset, preset2]);
    expect(state1.thermostatSuggestions).toEqual([suggestionForPreset2]);
    expect(state1.currentThermostatSuggestion).toBe(suggestionForPreset2);
    expect(info).not.toHaveBeenCalled();

    // Line 97 true branch: a Preset is removed, but neither ThermostatSuggestions nor CurrentThermostatSuggestion
    // reference it, so the reactor returns early once it determines neither changed.
    const state2 = { thermostatSuggestions: [suggestionForPreset2], currentThermostatSuggestion: suggestionForPreset2, thermostatSuggestionNotFollowingReason: null };
    callReactor(state2, [pendingPreset, preset2], [pendingPreset, preset2, preset3]);
    expect(state2.thermostatSuggestions).toEqual([suggestionForPreset2]);
    expect(state2.currentThermostatSuggestion).toBe(suggestionForPreset2);
    expect(info).not.toHaveBeenCalled();

    // Line 106 false branch: the removed Preset is referenced by a ThermostatSuggestions entry (pruned) but not by
    // CurrentThermostatSuggestion, which is left untouched.
    const state3 = {
      thermostatSuggestions: [suggestionForPreset2, suggestionForPreset3],
      currentThermostatSuggestion: suggestionForPreset2,
      thermostatSuggestionNotFollowingReason: { ongoingHold: true },
    };
    callReactor(state3, [pendingPreset, preset2], [pendingPreset, preset2, preset3]);
    expect(state3.thermostatSuggestions).toEqual([suggestionForPreset2]);
    expect(state3.currentThermostatSuggestion).toBe(suggestionForPreset2);
    expect(state3.thermostatSuggestionNotFollowingReason).toEqual({ ongoingHold: true });
    expect(info).toHaveBeenCalledTimes(1);
  });
});
