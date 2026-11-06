/**
 * @file packages/core/buntest/behaviors/thermostatServer.test.ts
 * @description This file contains the bun tests for thermostatServer.
 * @author Luca Liguori
 */

const NAME = 'ThermostatServer';
const MATTER_PORT = 13400;

import { afterEach, describe, expect, setSystemTime, test, vi } from 'bun:test';

import { Bytes } from '@matter/general';
import { Thermostat } from '@matter/types/clusters/thermostat';
import { Status } from '@matter/types/globals';
import { addBridgedDevice, aggregator } from '@matterbridge/test-utils/buntest/matter';
import { loggerLogSpy, setupTest } from '@matterbridge/test-utils/buntest/setup';
import { LogLevel } from 'node-ansi-logger';

import { MatterbridgeThermostatServer } from '../../src/behaviors/thermostatServer.js';
import { thermostat } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';
import { expectCommand, recordCommand, useServerNode, waitFor } from '../bunUtils.js';

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
      expectState(null, heating, cooling);
    }
    expect(device.invokeBehaviorCommand('Thermostat', 'setActivePresetRequest', { presetHandle: Uint8Array.from([9]) })).rejects.toThrow('Requested PresetHandle not found');
    expectState(null, 1900, 2700);
    expect(calls.map((call) => hex((call.request as { presetHandle: unknown }).presetHandle))).toEqual(['00', '01', null, '09']);
    expect(calls.every((call) => call.cluster === 'thermostat' && call.endpoint === device)).toBe(true);
    expect(emitted).toEqual(expect.arrayContaining(['00', null]));
    expect(emitted).not.toContain('09');
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
    // The stored handle is a defensive copy of the request payload.
    request.scheduleHandle[0] = 0xff;
    expect(active()).toBe('01');
    expect(device.invokeBehaviorCommand('Thermostat', 'setActiveScheduleRequest', { scheduleHandle: Uint8Array.from([9]) })).rejects.toMatchObject({ code: Status.InvalidCommand });
    expect(active()).toBe('01');
    expect(calls).toHaveLength(2);
    // Only the accepted request is announced, with the handle it carried at the time.
    expect(emitted).toEqual(['01']);
  });

  test('thermostat suggestions are validated, applied, pruned on expiry and rolled back with a rejected command', async () => {
    const device = await addThermostat('thermostatSuggestionBehavior', (endpoint) =>
      endpoint.createDefaultThermostatSuggestionsClusterServer(...base, Uint8Array.from([0]), presets, presetTypes, []),
    );
    const adds = recordCommand(device, 'addThermostatSuggestion');
    const removes = recordCommand(device, 'removeThermostatSuggestion');
    const emittedRemove: unknown[] = [];
    device.subscribeCommand(Thermostat, 'removeThermostatSuggestion', (data) => emittedRemove.push(data.request));
    const read = (name: 'thermostatSuggestions' | 'currentThermostatSuggestion' | 'activePresetHandle' | 'thermostatSuggestionNotFollowingReason'): unknown =>
      device.getAttribute(Thermostat.id, name);
    const suggestions = (): Thermostat.ThermostatSuggestion[] => read('thermostatSuggestions') as Thermostat.ThermostatSuggestion[];
    const currentId = (): number | null => (read('currentThermostatSuggestion') as { uniqueId: number } | null)?.uniqueId ?? null;
    const add = async (handle: number, effectiveTime: number | null, expirationInMinutes: number): Promise<unknown> =>
      device.invokeBehaviorCommand('Thermostat', 'addThermostatSuggestion', { presetHandle: Uint8Array.from([handle]), effectiveTime, expirationInMinutes });
    const remove = async (uniqueId: number): Promise<unknown> => device.invokeBehaviorCommand('Thermostat', 'removeThermostatSuggestion', { uniqueId });
    expect(device.getAttribute(Thermostat.id, 'maxThermostatSuggestions')).toBe(5);
    expect([suggestions(), hex(read('activePresetHandle'))]).toEqual([[], '00']);

    // A frozen clock makes the EffectiveTime and ExpirationTime checks deterministic.
    const now = new Date('2026-01-15T10:00:00Z');
    setSystemTime(now);
    const nowSeconds = Math.floor(now.getTime() / 1000);
    // An already effective suggestion is accepted and followed at once.
    await add(1, nowSeconds - 60, 30);
    expect(suggestions()).toHaveLength(1);
    expect(suggestions()[0]).toMatchObject({ uniqueId: 0, effectiveTime: nowSeconds - 60, expirationTime: nowSeconds - 60 + 1800 });
    expect([currentId(), hex(read('activePresetHandle')), read('thermostatSuggestionNotFollowingReason')]).toEqual([0, '01', null]);
    // A null EffectiveTime means now; the earlier one stays current.
    await add(0, null, 60);
    expect(suggestions()[1]).toMatchObject({ uniqueId: 1, effectiveTime: nowSeconds, expirationTime: nowSeconds + 3600 });
    expect([currentId(), hex(read('activePresetHandle'))]).toEqual([0, '01']);
    // More than 24 h ahead and an unknown preset are rejected, after being forwarded.
    expect(add(0, nowSeconds + 24 * 60 * 60 + 1, 30)).rejects.toThrow('requested EffectiveTime is more than 24 hours in the future');
    expect(add(9, nowSeconds, 30)).rejects.toThrow('requested PresetHandle not found');
    expect([adds.length, suggestions().length]).toEqual([4, 2]);
    // Up to MaxThermostatSuggestions, then RESOURCE_EXHAUSTED; future ones do not preempt the current one.
    for (let i = 0; i < 3; i++) await add(0, nowSeconds + 7200 + i * 60, 30);
    expect(add(0, nowSeconds, 30)).rejects.toThrow('maximum number of thermostat suggestions reached');
    expect([suggestions().length, currentId()]).toEqual([5, 0]);

    // Removing another suggestion keeps the current one; removing the current one follows the next active one.
    await remove(4);
    expect([suggestions().length, currentId()]).toEqual([4, 0]);
    await remove(0);
    expect([suggestions().length, currentId(), hex(read('activePresetHandle'))]).toEqual([3, 1, '00']);
    expect(remove(99)).rejects.toThrow('requested UniqueID not found');
    expect(removes.map((call) => call.request)).toEqual([{ uniqueId: 4 }, { uniqueId: 0 }, { uniqueId: 99 }]);

    // Past the expiry, the next command prunes it and clears the current suggestion and its not-following reason.
    await device.setAttribute(Thermostat.id, 'thermostatSuggestionNotFollowingReason', { ongoingHold: true });
    setSystemTime(new Date((nowSeconds + 3601) * 1000));
    await remove(3);
    expect([suggestions().length, currentId(), hex(read('activePresetHandle')), read('thermostatSuggestionNotFollowingReason')]).toEqual([1, null, '00', null]);

    // A command rejected after the prune leaves every attribute as it was: the transaction is rolled back.
    await add(1, null, 1);
    expect([currentId(), hex(read('activePresetHandle'))]).toEqual([0, '01']);
    await device.setAttribute(Thermostat.id, 'thermostatSuggestionNotFollowingReason', { ongoingHold: true });
    setSystemTime(new Date(Date.now() + 61_000));
    expect(add(0, Math.floor(Date.now() / 1000) + 25 * 60 * 60, 30)).rejects.toThrow('requested EffectiveTime is more than 24 hours in the future');
    expect([suggestions().length, currentId(), hex(read('activePresetHandle'))]).toEqual([2, 0, '01']);
    expect(read('thermostatSuggestionNotFollowingReason')).toMatchObject({ ongoingHold: true });
    // The next successful command prunes it.
    await remove(2);
    expect([suggestions().length, currentId(), hex(read('activePresetHandle')), read('thermostatSuggestionNotFollowingReason')]).toEqual([0, null, '01', null]);
    setSystemTime();
    expect(emittedRemove).toContainEqual({ uniqueId: 4 });
    expect(emittedRemove).not.toContainEqual({ uniqueId: 99 });

    // Removing a preset through Presets drops the suggestions that reference it, and the current one (§ 4.3.11.50).
    // A committed atomic write is what emits presets$AtomicChanged, so the event is emitted directly.
    for (let i = 0; i < 3; i++) await add(0, null, 30);
    expect([suggestions().length, hex((read('currentThermostatSuggestion') as { presetHandle: unknown }).presetHandle)]).toEqual([3, '00']);
    const behavior = MatterbridgeThermostatServer.with(Feature.Heating, Feature.Cooling, Feature.AutoMode, Feature.Presets, Feature.ThermostatSuggestions);
    const without = (list: Thermostat.Preset[], handle: number): Thermostat.Preset[] =>
      list.filter((preset) => preset.presetHandle === null || !Bytes.areEqual(preset.presetHandle, Uint8Array.from([handle])));
    const withoutPreset0 = without(presets, 0);
    device.eventsOf(behavior).presets$AtomicChanged?.emit(withoutPreset0, presets, undefined as never);
    await waitFor(() => suggestions().length === 0);
    expect(currentId()).toBeNull();
    // The current suggestion is cleared when its preset goes, even with an empty list.
    await device.setAttribute(Thermostat.id, 'currentThermostatSuggestion', {
      uniqueId: 5,
      presetHandle: Uint8Array.from([1]),
      effectiveTime: 1700000000,
      expirationTime: 1700001800,
    });
    device.eventsOf(behavior).presets$AtomicChanged?.emit(without(withoutPreset0, 1), withoutPreset0, undefined as never);
    await waitFor(() => currentId() === null);
    expect(suggestions()).toEqual([]);
  });

  test('removeThermostatSuggestionsForRemovedPresets leaves unrelated suggestions alone', () => {
    // Called directly on a stub: matter.js validation would refuse a committed Preset with a null PresetHandle.
    const info = vi.fn();
    const endpoint = { maybeId: 'thermostatSuggestionBranches', maybeNumber: 1, stateOf: (): object => ({ log: { info, debug: vi.fn() } }) };
    const callReactor = (state: Record<string, unknown>, newPresets: Thermostat.Preset[], oldPresets: Thermostat.Preset[]): void => {
      const server = { state, endpoint } as unknown as MatterbridgeThermostatServer;
      (
        MatterbridgeThermostatServer.prototype as unknown as { removeThermostatSuggestionsForRemovedPresets: (n: Thermostat.Preset[], o: Thermostat.Preset[]) => void }
      ).removeThermostatSuggestionsForRemovedPresets.call(server, newPresets, oldPresets);
    };
    const preset = (handle: number | null, presetScenario: Thermostat.PresetScenario, name: string): Thermostat.Preset => ({
      presetHandle: handle === null ? null : Uint8Array.from([handle]),
      presetScenario,
      name,
      coolingSetpoint: 2600,
      heatingSetpoint: 2000,
      builtIn: null,
    });
    const pending = preset(null, PresetScenario.Sleep, 'Pending');
    const preset2 = preset(2, PresetScenario.Wake, 'Preset2');
    const preset3 = preset(3, PresetScenario.Vacation, 'Preset3');
    const suggestion = (uniqueId: number, handle: number): Thermostat.ThermostatSuggestion => ({
      uniqueId,
      presetHandle: Uint8Array.from([handle]),
      effectiveTime: 1700000000,
      expirationTime: 1700003600,
    });
    const for2 = suggestion(10, 2);
    const for3 = suggestion(11, 3);

    // Presets only added (a null handle among them is skipped): nothing changes.
    const added = { thermostatSuggestions: [for2], currentThermostatSuggestion: for2, thermostatSuggestionNotFollowingReason: null };
    callReactor(added, [pending, preset2, preset3], [pending, preset2]);
    expect([added.thermostatSuggestions, added.currentThermostatSuggestion]).toEqual([[for2], for2]);
    // A removed preset no suggestion references: nothing changes.
    const unreferenced = { thermostatSuggestions: [for2], currentThermostatSuggestion: for2, thermostatSuggestionNotFollowingReason: null };
    callReactor(unreferenced, [pending, preset2], [pending, preset2, preset3]);
    expect([unreferenced.thermostatSuggestions, unreferenced.currentThermostatSuggestion]).toEqual([[for2], for2]);
    expect(info).not.toHaveBeenCalled();
    // A removed preset only a listed suggestion references: that one is pruned, the current one is kept.
    const listed = { thermostatSuggestions: [for2, for3], currentThermostatSuggestion: for2, thermostatSuggestionNotFollowingReason: { ongoingHold: true } };
    callReactor(listed, [pending, preset2], [pending, preset2, preset3]);
    expect([listed.thermostatSuggestions, listed.currentThermostatSuggestion, listed.thermostatSuggestionNotFollowingReason]).toEqual([[for2], for2, { ongoingHold: true }]);
    expect(info).toHaveBeenCalledTimes(1);
  });
});
