/**
 * @file packages/core/buntest/behaviors/temperatureAlarmServer.test.ts
 * @description This file contains the bun tests for temperatureAlarmServer.
 * @author Luca Liguori
 */

const NAME = 'TemperatureAlarmServer';
const MATTER_PORT = 12500;

import { describe, expect, test } from 'bun:test';

import { TemperatureAlarm } from '@matter/types/clusters/temperature-alarm';
import { Status } from '@matter/types/globals';
import { TlvOfModel } from '@matter/types/tlv';
import { addBridgedDevice, aggregator } from '@matterbridge/test-utils/buntest/matter';
import { loggerLogSpy, setupTest } from '@matterbridge/test-utils/buntest/setup';
import { debugStringify, LogLevel, nf } from 'node-ansi-logger';

import { MatterbridgeTemperatureAlarmServer } from '../../src/behaviors/temperatureAlarmServer.js';
import { temperatureSensor } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';
import { useServerNode } from '../bunUtils.js';

await setupTest(NAME, false);

const noAlarm = {
  criticalOverTemperatureAlarm: false,
  majorOverTemperatureAlarm: false,
  minorOverTemperatureAlarm: false,
  minorUnderTemperatureAlarm: false,
  majorUnderTemperatureAlarm: false,
  criticalUnderTemperatureAlarm: false,
};
type AlarmBits = typeof noAlarm;

/**
 * Builds a full Temperature Alarm bitmap with the given bits set and every other bit cleared.
 *
 * @param {(keyof AlarmBits)[]} bits - The alarm bits to set.
 * @returns {AlarmBits} The resulting alarm bitmap.
 */
function alarms(...bits: (keyof AlarmBits)[]): AlarmBits {
  return { ...noAlarm, ...Object.fromEntries(bits.map((bit) => [bit, true])) };
}

const criticalAlarms = alarms('criticalOverTemperatureAlarm', 'criticalUnderTemperatureAlarm');
const overAlarms = alarms('criticalOverTemperatureAlarm', 'majorOverTemperatureAlarm', 'minorOverTemperatureAlarm');
const underAlarms = alarms('minorUnderTemperatureAlarm', 'majorUnderTemperatureAlarm', 'criticalUnderTemperatureAlarm');
const allAlarms = alarms(...(Object.keys(noAlarm) as (keyof AlarmBits)[]));

/**
 * Creates and adds a temperature sensor with the TemperatureAlarm cluster, recording its Notify events.
 *
 * @param {string} id - The endpoint id.
 * @param {AlarmBits} supported - The supported (and initially enabled and latched) alarms.
 * @returns {Promise<{ sensor: MatterbridgeEndpoint; notifications: unknown[] }>} The sensor and its live Notify list.
 */
async function addSensor(id: string, supported: AlarmBits): Promise<{ sensor: MatterbridgeEndpoint; notifications: unknown[] }> {
  const sensor = new MatterbridgeEndpoint(temperatureSensor, { id });
  sensor.behaviors.require(MatterbridgeTemperatureAlarmServer, {
    mask: supported,
    latch: supported,
    state: noAlarm,
    supported,
    criticalOverTemperatureThreshold: 4000,
    criticalUnderTemperatureThreshold: -1000,
  });
  sensor.addRequiredClusterServers();
  expect(await addBridgedDevice(aggregator, sensor, 0, 0, 0, 0)).toBeTruthy();
  const notifications: unknown[] = [];
  sensor.eventsOf(MatterbridgeTemperatureAlarmServer).notify.on((event) => {
    notifications.push(event);
  });
  return { sensor, notifications };
}

describe('MatterbridgeTemperatureAlarmServer', () => {
  useServerNode(MATTER_PORT);

  test('the schema encodes every AlarmBitmap field with the TemperatureAlarm bits', () => {
    // Without the schema override every AlarmBitmap resolves in the Alarm Base scope, which has no bits.
    const { attributes, commands, events } = MatterbridgeTemperatureAlarmServer.schema.conformant;
    const roundTrip = (model: Parameters<typeof TlvOfModel>[0] | undefined, value: unknown): void => {
      expect(model).toBeDefined();
      if (!model) return;
      const schema = TlvOfModel(model);
      expect(schema.decode(schema.encode(value))).toEqual(value);
    };
    for (const name of ['Mask', 'Latch', 'State', 'Supported'])
      roundTrip(
        [...attributes].find((model) => model.name === name),
        criticalAlarms,
      );
    roundTrip(
      [...commands].find((model) => model.name === 'Reset'),
      { alarms: criticalAlarms },
    );
    roundTrip(
      [...commands].find((model) => model.name === 'ModifyEnabledAlarms'),
      { mask: criticalAlarms },
    );
    roundTrip(
      [...events].find((model) => model.name === 'Notify'),
      { active: criticalAlarms, inactive: noAlarm, state: criticalAlarms, mask: criticalAlarms },
    );
  });

  test('Notify, Reset and ModifyEnabledAlarms on a sensor supporting the critical alarms', async () => {
    const { sensor, notifications } = await addSensor('temperatureAlarm', criticalAlarms);
    const elements = sensor.behaviors.elementsOf(MatterbridgeTemperatureAlarmServer);
    expect([elements.commands.has('reset'), elements.commands.has('modifyEnabledAlarms'), elements.events.has('notify')]).toEqual([true, true, true]);
    // ModifyEnabledAlarms (1) is optional and listed because the server implements it.
    expect(sensor.getAttribute(TemperatureAlarm.id, 'acceptedCommandList')).toEqual([0, 1]);
    expect(sensor.getAttribute(TemperatureAlarm.id, 'criticalOverTemperatureThreshold')).toBe(4000);
    expect(sensor.getAttribute(TemperatureAlarm.id, 'criticalUnderTemperatureThreshold')).toBe(-1000);
    const state = (): unknown => sensor.getAttribute(TemperatureAlarm.id, 'state');
    const label = `(endpoint ${sensor.id}.${sensor.number})`;
    const emitted: string[] = [];
    sensor.subscribeCommand(TemperatureAlarm, 'reset', (data) => emitted.push(data.command));
    sensor.subscribeCommand(TemperatureAlarm, 'modifyEnabledAlarms', (data) => emitted.push(data.command));

    // Every State change emits Notify with the alarms that became active and inactive.
    await sensor.setAttribute(TemperatureAlarm.id, 'state', alarms('criticalOverTemperatureAlarm'));
    await sensor.setAttribute(TemperatureAlarm.id, 'state', alarms('criticalUnderTemperatureAlarm'));
    expect(notifications).toEqual([
      { active: alarms('criticalOverTemperatureAlarm'), inactive: noAlarm, state: alarms('criticalOverTemperatureAlarm'), mask: criticalAlarms },
      { active: alarms('criticalUnderTemperatureAlarm'), inactive: alarms('criticalOverTemperatureAlarm'), state: alarms('criticalUnderTemperatureAlarm'), mask: criticalAlarms },
    ]);

    // Reset: the handler runs before any change, then only the requested alarm is reset.
    await sensor.setAttribute(TemperatureAlarm.id, 'state', criticalAlarms);
    notifications.length = 0;
    const resetRequest = { alarms: alarms('criticalOverTemperatureAlarm') };
    const resetSeen: unknown[] = [];
    const resetHandler = (data: { request: unknown; attributes: { state: unknown } }): void => {
      resetSeen.push([data.request, data.attributes.state]);
    };
    sensor.addCommandHandler('TemperatureAlarm.reset', resetHandler);
    await sensor.invokeBehaviorCommand(TemperatureAlarm, 'reset', resetRequest);
    sensor.removeCommandHandler('TemperatureAlarm.reset', resetHandler);
    expect(resetSeen).toEqual([[resetRequest, criticalAlarms]]);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeTemperatureAlarmServer: resetting alarms ${debugStringify(resetRequest.alarms)}${nf} ${label}`);
    expect(state()).toEqual(alarms('criticalUnderTemperatureAlarm'));
    expect(notifications).toEqual([{ active: noAlarm, inactive: alarms('criticalOverTemperatureAlarm'), state: alarms('criticalUnderTemperatureAlarm'), mask: criticalAlarms }]);
    // Resetting an unsupported alarm is FAILURE and leaves State untouched.
    expect(sensor.invokeBehaviorCommand(TemperatureAlarm, 'reset', { alarms: alarms('minorOverTemperatureAlarm') })).rejects.toMatchObject({ code: Status.Failure });
    expect(state()).toEqual(alarms('criticalUnderTemperatureAlarm'));

    // ModifyEnabledAlarms: the handler sees the old Mask, then the Mask changes and the alarm it disables clears.
    notifications.length = 0;
    const maskRequest = { mask: alarms('criticalOverTemperatureAlarm') };
    const maskSeen: unknown[] = [];
    const maskHandler = (data: { request: unknown; attributes: { mask: unknown } }): void => {
      maskSeen.push([data.request, data.attributes.mask]);
    };
    sensor.addCommandHandler('TemperatureAlarm.modifyEnabledAlarms', maskHandler);
    await sensor.invokeBehaviorCommand(TemperatureAlarm, 'modifyEnabledAlarms', maskRequest);
    sensor.removeCommandHandler('TemperatureAlarm.modifyEnabledAlarms', maskHandler);
    expect(maskSeen).toEqual([[maskRequest, criticalAlarms]]);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeTemperatureAlarmServer: modifying enabled alarms ${debugStringify(maskRequest.mask)}${nf} ${label}`);
    expect(sensor.getAttribute(TemperatureAlarm.id, 'mask')).toEqual(maskRequest.mask);
    expect(state()).toEqual(noAlarm);
    expect(notifications).toEqual([{ active: noAlarm, inactive: alarms('criticalUnderTemperatureAlarm'), state: noAlarm, mask: maskRequest.mask }]);
    // Enabling an unsupported alarm is INVALID_COMMAND and leaves the Mask untouched.
    expect(sensor.invokeBehaviorCommand(TemperatureAlarm, 'modifyEnabledAlarms', { mask: alarms('majorUnderTemperatureAlarm') })).rejects.toMatchObject({
      code: Status.InvalidCommand,
    });
    expect(sensor.getAttribute(TemperatureAlarm.id, 'mask')).toEqual(maskRequest.mask);
    // Only the accepted commands are announced.
    expect(emitted).toEqual(['reset', 'modifyEnabledAlarms']);
  });

  test('every alarm bit is carried by Notify, reset by Reset and cleared by ModifyEnabledAlarms', async () => {
    const { sensor, notifications } = await addSensor('temperatureAlarmFull', allAlarms);
    expect(sensor.getAttribute(TemperatureAlarm.id, 'supported')).toEqual(allAlarms);
    const state = (): unknown => sensor.getAttribute(TemperatureAlarm.id, 'state');
    const reset = async (bits: AlarmBits): Promise<unknown> => sensor.invokeBehaviorCommand(TemperatureAlarm, 'reset', { alarms: bits });
    const modify = async (mask: AlarmBits): Promise<unknown> => sensor.invokeBehaviorCommand(TemperatureAlarm, 'modifyEnabledAlarms', { mask });

    await sensor.setAttribute(TemperatureAlarm.id, 'state', allAlarms);
    expect(notifications.at(-1)).toEqual({ active: allAlarms, inactive: noAlarm, state: allAlarms, mask: allAlarms });
    await reset(allAlarms);
    expect(state()).toEqual(noAlarm);
    expect(notifications.at(-1)).toEqual({ active: noAlarm, inactive: allAlarms, state: noAlarm, mask: allAlarms });
    // A Mask enabling every alarm leaves an all-active State untouched.
    await sensor.setAttribute(TemperatureAlarm.id, 'state', allAlarms);
    await modify(allAlarms);
    expect([sensor.getAttribute(TemperatureAlarm.id, 'mask'), state()]).toEqual([allAlarms, allAlarms]);
    await reset(overAlarms);
    expect(state()).toEqual(underAlarms);
    await modify(overAlarms);
    expect([sensor.getAttribute(TemperatureAlarm.id, 'mask'), state()]).toEqual([overAlarms, noAlarm]);
    // Resetting alarms that are already inactive is a no-op.
    await reset(allAlarms);
    expect(state()).toEqual(noAlarm);
  });
});
