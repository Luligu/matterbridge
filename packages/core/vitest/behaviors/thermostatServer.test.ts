/**
 * @file packages/core/vitest/behaviors/thermostatServer.test.ts
 * @description This file contains the tests for thermostatServer.
 * @author Luca Liguori
 */

/* oxlint-disable vitest/no-commented-out-tests */

const NAME = 'ThermostatServer';
const MATTER_PORT = 13400;
const MATTER_CREATE_ONLY = true;

import { Thermostat } from '@matter/types/clusters/thermostat';
import { Status } from '@matter/types/globals';
import {
  addBridgedDevice,
  aggregator,
  createServerNode,
  createTestEnvironment,
  destroyTestEnvironment,
  flushServerNode,
  startServerNode,
  stopServerNode,
} from '@matterbridge/test-utils/vitest/matter';
import { loggerLogSpy, setupTest } from '@matterbridge/test-utils/vitest/setup';
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
    expect(await addBridgedDevice(aggregator, thermo)).toBeTruthy();
  });

  test('Device type: thermostatPreset', async () => {
    thermostatPreset = createPresetThermostatEndpoint('thermostatPreset');
    expect(thermostatPreset).toBeDefined();
    expect(await addBridgedDevice(aggregator, thermostatPreset)).toBeTruthy();
  });

  test('Thermostat server', async () => {
    // Collect the requests announced to subscribeCommand() listeners
    const emitted: unknown[] = [];
    thermo.subscribeCommand(Thermostat, 'setpointRaiseLower', (data) => emitted.push(data.request));
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
    expect(emitted).toContainEqual(setBothRequest);
  });

  /*
  test('Thermostat server ignores undefined occupied setpoints', async () => {
    const executeHandler = vi.fn();
    const info = vi.fn();
    const debug = vi.fn();
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
    expect(await addBridgedDevice(aggregator, thermostatPreset)).toBeTruthy();
    // Collect the requests announced to subscribeCommand() listeners
    const emitted: unknown[] = [];
    thermostatPreset.subscribeCommand(Thermostat, 'setActivePresetRequest', (data) => emitted.push(data.request));

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
    expectPresetThermostatAttributes(firstPresetRequest.presetHandle, 2100, 2500);

    await thermostatPreset.invokeBehaviorCommand('Thermostat', 'setActivePresetRequest', secondPresetRequest);
    expect(presetCalls[1]).toEqual({ cluster: 'thermostat', endpoint: thermostatPreset, request: secondPresetRequest });
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `MatterbridgeThermostatServer: setting preset to ${formatPresetHandleForLog(secondPresetRequest.presetHandle)} (endpoint ${thermostatPreset.id}.${thermostatPreset.number})`,
    );
    expectPresetThermostatAttributes(secondPresetRequest.presetHandle, 1900, 2700);

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
    expect(emitted).toEqual([firstPresetRequest, secondPresetRequest, clearPresetRequest]);
  });

  test('should forward suggestion commands and emit only accepted requests', async () => {
    const device = createThermostatSuggestionEndpoint('thermostatSuggestionBehavior');
    expect(await addBridgedDevice(aggregator, device)).toBeTruthy();
    const add = vi.fn();
    const remove = vi.fn();
    const emittedAdd = vi.fn();
    const emittedRemove = vi.fn();
    const emittedPreset = vi.fn();
    device.addCommandHandler('addThermostatSuggestion', (data) => add(data.request));
    device.addCommandHandler('removeThermostatSuggestion', (data) => remove(data.request));
    device.subscribeCommand(Thermostat, 'addThermostatSuggestion', (data) => emittedAdd(data.request));
    device.subscribeCommand(Thermostat, 'removeThermostatSuggestion', (data) => emittedRemove(data.request));
    device.subscribeCommand(Thermostat, 'setActivePresetRequest', emittedPreset);

    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    try {
      const now = Date.parse('2026-01-15T10:00:00Z');
      vi.setSystemTime(now);
      const request = { presetHandle: Uint8Array.from([1]), effectiveTime: null, expirationInMinutes: 1 };
      const unknownPreset = { ...request, presetHandle: Uint8Array.from([9]) };
      const tooLate = { ...request, effectiveTime: now / 1000 + 86_401 };
      await expect(device.invokeBehaviorCommand('Thermostat', 'addThermostatSuggestion', unknownPreset)).rejects.toMatchObject({ code: Status.NotFound });
      await expect(device.invokeBehaviorCommand('Thermostat', 'addThermostatSuggestion', tooLate)).rejects.toMatchObject({ code: Status.InvalidCommand });
      expect(device.getAttribute(Thermostat.id, 'thermostatSuggestions')).toEqual([]);

      await device.invokeBehaviorCommand('Thermostat', 'addThermostatSuggestion', request);
      const [suggestion] = device.getAttribute(Thermostat.id, 'thermostatSuggestions');
      expect(suggestion).toMatchObject({ effectiveTime: now / 1000, expirationTime: now / 1000 + 60 });
      expect(device.getAttribute(Thermostat.id, 'currentThermostatSuggestion')).toMatchObject({ uniqueId: suggestion.uniqueId });
      expect(device.getAttribute(Thermostat.id, 'activePresetHandle')).toEqual(Uint8Array.from([1]));
      expect(device.getAttribute(Thermostat.id, 'occupiedHeatingSetpoint')).toBe(1900);
      expect(emittedPreset).not.toHaveBeenCalled();

      const unknownId = { uniqueId: (suggestion.uniqueId + 1) % 256 };
      const removeRequest = { uniqueId: suggestion.uniqueId };
      await expect(device.invokeBehaviorCommand('Thermostat', 'removeThermostatSuggestion', unknownId)).rejects.toMatchObject({ code: Status.NotFound });
      await device.invokeBehaviorCommand('Thermostat', 'removeThermostatSuggestion', removeRequest);
      expect(device.getAttribute(Thermostat.id, 'currentThermostatSuggestion')).toBeNull();
      expect(add.mock.calls).toEqual([[unknownPreset], [tooLate], [request]]);
      expect(remove.mock.calls).toEqual([[unknownId], [removeRequest]]);
      expect(emittedAdd.mock.calls).toEqual([[request]]);
      expect(emittedRemove.mock.calls).toEqual([[removeRequest]]);

      await device.invokeBehaviorCommand('Thermostat', 'addThermostatSuggestion', request);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(device.getAttribute(Thermostat.id, 'thermostatSuggestions')).toEqual([]);
      expect(device.getAttribute(Thermostat.id, 'currentThermostatSuggestion')).toBeNull();
      expect(device.getAttribute(Thermostat.id, 'thermostatSuggestionNotFollowingReason')).toBeNull();
      expect(device.getAttribute(Thermostat.id, 'activePresetHandle')).toEqual(Uint8Array.from([1]));
      expect(emittedRemove.mock.calls).toEqual([[removeRequest]]);
    } finally {
      vi.useRealTimers();
    }
  });

  test('ScheduleThermostat server', async () => {
    thermostatSchedule = createScheduleThermostatEndpoint('thermostatScheduleBehavior');
    expect(await addBridgedDevice(aggregator, thermostatSchedule)).toBeTruthy();
    // Collect the requests announced to subscribeCommand() listeners
    const emitted: unknown[] = [];
    thermostatSchedule.subscribeCommand(Thermostat, 'setActiveScheduleRequest', (data) => emitted.push(data.request));

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

    await expect(thermostatSchedule.invokeBehaviorCommand('Thermostat', 'setActiveScheduleRequest', invalidScheduleRequest)).rejects.toMatchObject({ code: Status.InvalidCommand });
    expect(scheduleCalls[1]).toEqual({ cluster: 'thermostat', endpoint: thermostatSchedule, request: invalidScheduleRequest });
    expect(scheduleCalls).toHaveLength(2);
    // The active schedule handle must not change when the requested schedule handle is invalid.
    expect(thermostatSchedule.getAttribute(Thermostat.id, 'activeScheduleHandle')).toEqual(Uint8Array.from([1]));
    // Only the accepted schedule request is announced
    expect(emitted).toEqual([secondScheduleRequest]);
  });
});
