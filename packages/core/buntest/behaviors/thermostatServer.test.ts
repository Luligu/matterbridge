/**
 * @file packages/core/buntest/behaviors/thermostatServer.test.ts
 * @description This file contains the bun tests for thermostatServer.
 * @author Luca Liguori
 */

const NAME = 'ThermostatServer';
const MATTER_PORT = 13400;

import { afterEach, describe, expect, setSystemTime, test, vi } from 'bun:test';

import { Thermostat } from '@matter/types/clusters/thermostat';
import { Status } from '@matter/types/globals';
import { addBridgedDevice, aggregator } from '@matterbridge/test-utils/buntest/matter';
import { loggerLogSpy, setupTest } from '@matterbridge/test-utils/buntest/setup';
import { LogLevel } from 'node-ansi-logger';

import { MatterbridgeThermostatServer } from '../../src/behaviors/thermostatServer.js';
import { thermostat } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';
import { advanceTimersByTimeAsync, expectCommand, recordCommand, useServerNode } from '../bunUtils.js';

await setupTest(NAME, false);

const { Feature, PresetScenario, SetpointRaiseLowerMode, SystemMode } = Thermostat;
const presetTypes: Thermostat.PresetType[] = [
  { presetScenario: PresetScenario.Occupied, numberOfPresets: 2, presetTypeFeatures: { automatic: false, supportsNames: true } },
  { presetScenario: PresetScenario.Unoccupied, numberOfPresets: 2, presetTypeFeatures: { automatic: false, supportsNames: true } },
];
const presets: Thermostat.Preset[] = [
  { presetHandle: Uint8Array.from([0]), presetScenario: PresetScenario.Occupied, name: 'Occupied', coolingSetpoint: 2500, heatingSetpoint: 2100, builtIn: null },
  { presetHandle: Uint8Array.from([1]), presetScenario: PresetScenario.Unoccupied, name: 'Unoccupied', coolingSetpoint: 2700, heatingSetpoint: 1900, builtIn: null },
];
const schedules: Thermostat.Schedule[] = [
  {
    scheduleHandle: Uint8Array.from([0]),
    systemMode: SystemMode.Auto,
    name: 'Weekdays',
    transitions: [{ dayOfWeek: { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true }, transitionTime: 420, coolingSetpoint: 2500, heatingSetpoint: 2100 }],
    builtIn: null,
  },
  {
    scheduleHandle: Uint8Array.from([1]),
    systemMode: SystemMode.Auto,
    name: 'Weekend',
    transitions: [{ dayOfWeek: { saturday: true, sunday: true }, transitionTime: 480, coolingSetpoint: 2700, heatingSetpoint: 1900 }],
    builtIn: null,
  },
];
const scheduleTypes: Thermostat.ScheduleType[] = [
  { systemMode: SystemMode.Auto, numberOfSchedules: 2, scheduleTypeFeatures: { supportsSetpoints: true, supportsNames: true, supportsPresets: false, supportsOff: false } },
];
// The common arguments of the createDefault*ThermostatClusterServer() helpers before their feature-specific ones.
const base = [23, 21, 25, 2, 0, 48, 2, 50, undefined, undefined, undefined, undefined] as const;

/**
 * Formats a handle as hex for comparisons that do not depend on the byte container type.
 *
 * @param {unknown} handle - The handle, or null.
 * @returns {string | null} The hex string, or null.
 */
const hex = (handle: unknown): string | null => (handle === null || handle === undefined ? null : Buffer.from(handle as Uint8Array).toString('hex'));

/**
 * Creates and adds a thermostat endpoint.
 *
 * @param {string} id - The endpoint id.
 * @param {(endpoint: MatterbridgeEndpoint) => void} [configure] - Creates the Thermostat cluster server (default: the required one).
 * @returns {Promise<MatterbridgeEndpoint>} The added thermostat.
 */
async function addThermostat(id: string, configure?: (endpoint: MatterbridgeEndpoint) => void): Promise<MatterbridgeEndpoint> {
  const endpoint = new MatterbridgeEndpoint(thermostat, { id });
  configure?.(endpoint);
  endpoint.addRequiredClusterServers();
  expect(await addBridgedDevice(aggregator, endpoint, 0, 0, 0, 0)).toBeTruthy();
  return endpoint;
}

describe('MatterbridgeThermostatServer', () => {
  useServerNode(MATTER_PORT);

  afterEach(() => {
    vi.useRealTimers();
    setSystemTime();
  });

  test('setpointRaiseLower raises the heating, cooling or both occupied setpoints', async () => {
    const thermo = await addThermostat('thermostat');
    const behavior = MatterbridgeThermostatServer.with(Feature.Heating, Feature.Cooling, Feature.AutoMode);
    const state = thermo.stateOf(behavior) as unknown as { acceptedCommandList: number[]; generatedCommandList: number[] };
    expect([[...state.acceptedCommandList], [...state.generatedCommandList]]).toEqual([[0], []]);
    const emitted: unknown[] = [];
    thermo.subscribeCommand(Thermostat, 'setpointRaiseLower', (data) => emitted.push(data.request));
    const setpoints = (): unknown => thermo.getCluster(MatterbridgeThermostatServer);
    expect(setpoints()).toMatchObject({ occupiedHeatingSetpoint: 2100, occupiedCoolingSetpoint: 2500 });

    const both = { mode: SetpointRaiseLowerMode.Both, amount: 5 };
    await expectCommand(thermo, Thermostat, 'setpointRaiseLower', both, (data) => expect(data.cluster).toBe('thermostat'));
    expect(setpoints()).toMatchObject({ occupiedHeatingSetpoint: 2150, occupiedCoolingSetpoint: 2550 });
    await thermo.invokeBehaviorCommand('Thermostat', 'setpointRaiseLower', { mode: SetpointRaiseLowerMode.Heat, amount: 5 });
    expect(setpoints()).toMatchObject({ occupiedHeatingSetpoint: 2200, occupiedCoolingSetpoint: 2550 });
    await thermo.invokeBehaviorCommand('Thermostat', 'setpointRaiseLower', { mode: SetpointRaiseLowerMode.Cool, amount: 5 });
    expect(setpoints()).toMatchObject({ occupiedHeatingSetpoint: 2200, occupiedCoolingSetpoint: 2600 });
    expect(emitted).toContainEqual(both);
  });

  test('presets: setpointRaiseLower clears the active preset, setActivePresetRequest applies or clears one', async () => {
    const device = await addThermostat('thermostatPresetBehavior', (endpoint) =>
      endpoint.createDefaultPresetsThermostatClusterServer(...base, Uint8Array.from([0]), presets, presetTypes),
    );
    const behavior = MatterbridgeThermostatServer.with(Feature.Heating, Feature.Cooling, Feature.AutoMode, Feature.Presets);
    const emitted: unknown[] = [];
    device.subscribeCommand(Thermostat, 'setActivePresetRequest', (data) => emitted.push(hex(data.request.presetHandle)));
    const calls = recordCommand(device, 'setActivePresetRequest');

    /**
     * Checks the preset thermostat attributes.
     *
     * @param {number[] | null} active - The ActivePresetHandle bytes, or null.
     * @param {number} heating - The OccupiedHeatingSetpoint.
     * @param {number} cooling - The OccupiedCoolingSetpoint.
     * @returns {void}
     */
    const expectState = (active: number[] | null, heating: number, cooling: number): void => {
      const cluster = device.getCluster(behavior);
      expect(cluster).toMatchObject({
        localTemperature: 2300,
        systemMode: SystemMode.Auto,
        occupiedHeatingSetpoint: heating,
        occupiedCoolingSetpoint: cooling,
        numberOfPresets: 2,
      });
      expect(hex(cluster?.activePresetHandle)).toBe(active === null ? null : hex(Uint8Array.from(active)));
      expect(cluster?.presets?.map((preset) => [hex(preset.presetHandle), preset.name, preset.heatingSetpoint, preset.coolingSetpoint, preset.builtIn])).toEqual([
        ['00', 'Occupied', 2100, 2500, true],
        ['01', 'Unoccupied', 1900, 2700, true],
      ]);
      expect(cluster?.presetTypes).toMatchObject(presetTypes);
    };
    const label = `(endpoint ${device.id}.${device.number})`;
    expectState([0], 2100, 2500);
    await expectCommand(device, Thermostat, 'setpointRaiseLower', { mode: SetpointRaiseLowerMode.Heat, amount: 5 }, (data) => expect(data.cluster).toBe('thermostat'));
    expectState(null, 2150, 2500);
    await device.invokeBehaviorCommand('Thermostat', 'setpointRaiseLower', { mode: SetpointRaiseLowerMode.Cool, amount: 5 });
    expectState(null, 2150, 2550);

    // A preset applies its setpoints, null clears it, an unknown handle is rejected after being forwarded.
    for (const [handle, logged, heating, cooling] of [
      [Uint8Array.from([0]), '0x00', 2100, 2500],
      [Uint8Array.from([1]), '0x01', 1900, 2700],
      [null, 'null', 1900, 2700],
    ] as const) {
      await device.invokeBehaviorCommand('Thermostat', 'setActivePresetRequest', { presetHandle: handle });
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeThermostatServer: setting preset to ${logged} ${label}`);
      expectState(handle === null ? null : Array.from(handle), heating, cooling);
    }
    expect(device.invokeBehaviorCommand('Thermostat', 'setActivePresetRequest', { presetHandle: Uint8Array.from([9]) })).rejects.toThrow('Requested PresetHandle not found');
    expectState(null, 1900, 2700);
    expect(calls.map((call) => hex((call.request as { presetHandle: unknown }).presetHandle))).toEqual(['00', '01', null, '09']);
    expect(calls.every((call) => call.cluster === 'thermostat' && call.endpoint === device)).toBe(true);
    expect(emitted).toEqual(['00', '01', null]);
  });

  test('should forward suggestion commands and emit only accepted requests', async () => {
    const device = await addThermostat('thermostatSuggestionBehavior', (endpoint) =>
      endpoint.createDefaultThermostatSuggestionsClusterServer(...base, Uint8Array.from([0]), presets, presetTypes),
    );
    const adds = recordCommand(device, 'addThermostatSuggestion');
    const removes = recordCommand(device, 'removeThermostatSuggestion');
    const emittedAdd: unknown[] = [];
    const emittedRemove: unknown[] = [];
    const emittedPreset = vi.fn();
    device.subscribeCommand(Thermostat, 'addThermostatSuggestion', (data) => emittedAdd.push(data.request));
    device.subscribeCommand(Thermostat, 'removeThermostatSuggestion', (data) => emittedRemove.push(data.request));
    device.subscribeCommand(Thermostat, 'setActivePresetRequest', emittedPreset);

    vi.useFakeTimers();
    const now = Date.parse('2026-01-15T10:00:00Z');
    setSystemTime(new Date(now));
    const request = { presetHandle: Uint8Array.from([1]), effectiveTime: null, expirationInMinutes: 1 };
    const unknownPreset = { ...request, presetHandle: Uint8Array.from([9]) };
    const tooLate = { ...request, effectiveTime: now / 1000 + 86_401 };
    expect(device.invokeBehaviorCommand('Thermostat', 'addThermostatSuggestion', unknownPreset)).rejects.toMatchObject({ code: Status.NotFound });
    expect(device.invokeBehaviorCommand('Thermostat', 'addThermostatSuggestion', tooLate)).rejects.toMatchObject({ code: Status.InvalidCommand });
    expect(device.getAttribute(Thermostat.id, 'thermostatSuggestions')).toEqual([]);

    await device.invokeBehaviorCommand('Thermostat', 'addThermostatSuggestion', request);
    const [suggestion] = device.getAttribute(Thermostat.id, 'thermostatSuggestions');
    expect(suggestion).toMatchObject({ effectiveTime: now / 1000, expirationTime: now / 1000 + 60 });
    expect(device.getAttribute(Thermostat.id, 'currentThermostatSuggestion')).toMatchObject({ uniqueId: suggestion.uniqueId });
    expect(hex(device.getAttribute(Thermostat.id, 'activePresetHandle'))).toBe('01');
    expect(device.getAttribute(Thermostat.id, 'occupiedHeatingSetpoint')).toBe(1900);
    expect(emittedPreset).not.toHaveBeenCalled();

    const unknownId = { uniqueId: (suggestion.uniqueId + 1) % 256 };
    const removeRequest = { uniqueId: suggestion.uniqueId };
    expect(device.invokeBehaviorCommand('Thermostat', 'removeThermostatSuggestion', unknownId)).rejects.toMatchObject({ code: Status.NotFound });
    await device.invokeBehaviorCommand('Thermostat', 'removeThermostatSuggestion', removeRequest);
    expect(device.getAttribute(Thermostat.id, 'currentThermostatSuggestion')).toBeNull();
    expect(adds.map((call) => call.request)).toEqual([unknownPreset, tooLate, request]);
    expect(removes.map((call) => call.request)).toEqual([unknownId, removeRequest]);
    expect(emittedAdd).toEqual([request]);
    expect(emittedRemove).toEqual([removeRequest]);

    await device.invokeBehaviorCommand('Thermostat', 'addThermostatSuggestion', request);
    await advanceTimersByTimeAsync(60_000, 60_000);
    expect(device.getAttribute(Thermostat.id, 'thermostatSuggestions')).toEqual([]);
    expect(device.getAttribute(Thermostat.id, 'currentThermostatSuggestion')).toBeNull();
    expect(device.getAttribute(Thermostat.id, 'thermostatSuggestionNotFollowingReason')).toBeNull();
    expect(hex(device.getAttribute(Thermostat.id, 'activePresetHandle'))).toBe('01');
    expect(emittedRemove).toEqual([removeRequest]);
  });

  test('schedules: setActiveScheduleRequest stores a copy of a known handle and rejects an unknown one', async () => {
    const device = await addThermostat('thermostatScheduleBehavior', (endpoint) =>
      endpoint.createDefaultSchedulesThermostatClusterServer(...base, Uint8Array.from([0]), schedules, scheduleTypes),
    );
    const behavior = MatterbridgeThermostatServer.with(Feature.Heating, Feature.Cooling, Feature.AutoMode, Feature.MatterScheduleConfiguration);
    expect(device.behaviors.elementsOf(behavior).commands.has('setActiveScheduleRequest')).toBeTruthy();
    const emitted: unknown[] = [];
    device.subscribeCommand(Thermostat, 'setActiveScheduleRequest', (data) => emitted.push(hex(data.request.scheduleHandle)));
    const calls = recordCommand(device, 'setActiveScheduleRequest');
    const active = (): string | null => hex(device.getAttribute(Thermostat.id, 'activeScheduleHandle'));
    expect(active()).toBe('00');

    const request = { scheduleHandle: Uint8Array.from([1]) };
    await device.invokeBehaviorCommand('Thermostat', 'setActiveScheduleRequest', request);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeThermostatServer: setting schedule to 0x01 (endpoint ${device.id}.${device.number})`);
    expect(active()).toBe('01');
    expect(device.invokeBehaviorCommand('Thermostat', 'setActiveScheduleRequest', { scheduleHandle: Uint8Array.from([9]) })).rejects.toMatchObject({ code: Status.InvalidCommand });
    expect(active()).toBe('01');
    expect(calls).toHaveLength(2);
    // Only the accepted request is announced, with the handle it carried at the time.
    expect(emitted).toEqual(['01']);
  });
});
