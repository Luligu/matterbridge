/**
 * @file packages/core/vitest/behaviors/temperatureAlarmServer.test.ts
 * @description This file contains the tests for temperatureAlarmServer.
 * @author Luca Liguori
 */

const NAME = 'TemperatureAlarmServer';
const MATTER_PORT = 12500;
const MATTER_CREATE_ONLY = true;

import { Status, TlvOfModel } from '@matter/types';
import { TemperatureAlarm } from '@matter/types/clusters/temperature-alarm';
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
import { debugStringify, LogLevel, nf } from 'node-ansi-logger';

import { MatterbridgeTemperatureAlarmServer } from '../../src/behaviors/temperatureAlarmServer.js';
import { temperatureSensor } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';
import type { CommandHandlerPayload } from '../../src/matterbridgeEndpointCommandHandler.js';

const noAlarm = {
  criticalOverTemperatureAlarm: false,
  majorOverTemperatureAlarm: false,
  minorOverTemperatureAlarm: false,
  minorUnderTemperatureAlarm: false,
  majorUnderTemperatureAlarm: false,
  criticalUnderTemperatureAlarm: false,
};
const criticalAlarms = alarms('criticalOverTemperatureAlarm', 'criticalUnderTemperatureAlarm');
const overAlarms = alarms('criticalOverTemperatureAlarm', 'majorOverTemperatureAlarm', 'minorOverTemperatureAlarm');
const underAlarms = alarms('minorUnderTemperatureAlarm', 'majorUnderTemperatureAlarm', 'criticalUnderTemperatureAlarm');
const allAlarms = alarms(...(Object.keys(noAlarm) as (keyof typeof noAlarm)[]));

/**
 * Builds a full Temperature Alarm bitmap with the given bits set and every other bit cleared.
 *
 * @param {(keyof typeof noAlarm)[]} bits - The alarm bits to set.
 * @returns {typeof noAlarm} The resulting alarm bitmap.
 */
function alarms(...bits: (keyof typeof noAlarm)[]): typeof noAlarm {
  return { ...noAlarm, ...Object.fromEntries(bits.map((bit) => [bit, true])) };
}

// Setup the test environment
await setupTest(NAME, false);

describe('Server clusters and behaviors', () => {
  let sensor: MatterbridgeEndpoint;
  let fullSensor: MatterbridgeEndpoint;
  const notifyEvents: unknown[] = [];
  const fullNotifyEvents: unknown[] = [];

  beforeAll(async () => {
    // Set log level to debug for better visibility during tests
    MatterbridgeEndpoint.logLevel = LogLevel.DEBUG;

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
    notifyEvents.length = 0;
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

  test('Create a TemperatureSensor device with the TemperatureAlarm cluster', async () => {
    sensor = new MatterbridgeEndpoint(temperatureSensor, { id: 'temperatureAlarm' });
    sensor.behaviors.require(MatterbridgeTemperatureAlarmServer, {
      mask: criticalAlarms,
      latch: criticalAlarms,
      state: noAlarm,
      supported: criticalAlarms,
      criticalOverTemperatureThreshold: 4000,
      criticalUnderTemperatureThreshold: -1000,
    });
    sensor.addRequiredClusterServers();
    expect(await addDevice(aggregator, sensor)).toBeTruthy();

    expect(sensor.behaviors.has(MatterbridgeTemperatureAlarmServer)).toBeTruthy();
    expect(sensor.behaviors.elementsOf(MatterbridgeTemperatureAlarmServer).commands.has('reset')).toBeTruthy();
    expect(sensor.behaviors.elementsOf(MatterbridgeTemperatureAlarmServer).commands.has('modifyEnabledAlarms')).toBeTruthy();
    expect(sensor.behaviors.elementsOf(MatterbridgeTemperatureAlarmServer).events.has('notify')).toBeTruthy();
    // Reset (0) comes from the Reset feature, ModifyEnabledAlarms (1) is optional and is accepted because the server implements it,
    // so no enable({ commands: { modifyEnabledAlarms: true } }) is needed. Dropping the override drops command 1 from this list.
    expect(sensor.getAttribute(TemperatureAlarm.id, 'acceptedCommandList')).toEqual([0, 1]);
    expect(sensor.getAttribute(TemperatureAlarm.id, 'criticalOverTemperatureThreshold')).toBe(4000);
    expect(sensor.getAttribute(TemperatureAlarm.id, 'criticalUnderTemperatureThreshold')).toBe(-1000);
    expect(sensor.getAttribute(TemperatureAlarm.id, 'state')).toEqual(noAlarm);

    const notify = sensor.eventsOf(MatterbridgeTemperatureAlarmServer).notify;
    expect(notify).toBeDefined();
    notify.on((event) => {
      notifyEvents.push(event);
    });
  });

  test('Encode the alarm attributes with the TemperatureAlarm AlarmBitmap', () => {
    // Without the schema override every AlarmBitmap element resolves in the Alarm Base scope, whose bitmap has no bits,
    // and every alarm is silently dropped on the wire.
    for (const attributeName of ['Mask', 'Latch', 'State', 'Supported']) {
      const attribute = [...MatterbridgeTemperatureAlarmServer.schema.conformant.attributes].find(({ name }) => name === attributeName);
      expect(attribute).toBeDefined();
      if (!attribute) continue;
      const schema = TlvOfModel(attribute);
      expect(schema.decode(schema.encode(criticalAlarms))).toEqual(criticalAlarms);
    }
  });

  test('Encode the Reset and ModifyEnabledAlarms command fields with the TemperatureAlarm AlarmBitmap', () => {
    const reset = [...MatterbridgeTemperatureAlarmServer.schema.conformant.commands].find(({ name }) => name === 'Reset');
    const modifyEnabledAlarms = [...MatterbridgeTemperatureAlarmServer.schema.conformant.commands].find(({ name }) => name === 'ModifyEnabledAlarms');
    expect(reset).toBeDefined();
    expect(modifyEnabledAlarms).toBeDefined();
    if (!reset || !modifyEnabledAlarms) return;

    const resetSchema = TlvOfModel(reset);
    expect(resetSchema.decode(resetSchema.encode({ alarms: criticalAlarms }))).toEqual({ alarms: criticalAlarms });

    const modifyEnabledAlarmsSchema = TlvOfModel(modifyEnabledAlarms);
    expect(modifyEnabledAlarmsSchema.decode(modifyEnabledAlarmsSchema.encode({ mask: criticalAlarms }))).toEqual({ mask: criticalAlarms });
  });

  test('Encode the Notify event fields with the TemperatureAlarm AlarmBitmap', () => {
    const notifyEvent = [...MatterbridgeTemperatureAlarmServer.schema.conformant.events].find(({ name }) => name === 'Notify');
    expect(notifyEvent).toBeDefined();
    if (!notifyEvent) return;

    const schema = TlvOfModel(notifyEvent);
    const event = { active: criticalAlarms, inactive: noAlarm, state: criticalAlarms, mask: criticalAlarms };
    expect(schema.decode(schema.encode(event))).toEqual(event);
  });

  test('A State change emits the Notify event with the active and inactive alarms', async () => {
    await sensor.setAttribute(TemperatureAlarm.id, 'state', alarms('criticalOverTemperatureAlarm'));
    expect(notifyEvents).toHaveLength(1);
    expect(notifyEvents[0]).toEqual({
      active: alarms('criticalOverTemperatureAlarm'),
      inactive: noAlarm,
      state: alarms('criticalOverTemperatureAlarm'),
      mask: criticalAlarms,
    });

    await sensor.setAttribute(TemperatureAlarm.id, 'state', alarms('criticalUnderTemperatureAlarm'));
    expect(notifyEvents).toHaveLength(2);
    expect(notifyEvents[1]).toEqual({
      active: alarms('criticalUnderTemperatureAlarm'),
      inactive: alarms('criticalOverTemperatureAlarm'),
      state: alarms('criticalUnderTemperatureAlarm'),
      mask: criticalAlarms,
    });
  });

  test('Reset forwards to the command handler and resets the requested alarms', async () => {
    await sensor.setAttribute(TemperatureAlarm.id, 'state', criticalAlarms);
    vi.clearAllMocks();
    notifyEvents.length = 0;

    let handled = false;
    const resetHandler = (data: CommandHandlerPayload<'TemperatureAlarm.reset'>): void => {
      handled = true;
      expect(data.endpoint).toBe(sensor);
      expect(data.request).toEqual({ alarms: alarms('criticalOverTemperatureAlarm') });
      // The command handler runs before any validation or state update.
      expect(data.attributes.state).toEqual(criticalAlarms);
    };
    sensor.addCommandHandler('TemperatureAlarm.reset', resetHandler);

    await sensor.invokeBehaviorCommand(TemperatureAlarm, 'reset', { alarms: alarms('criticalOverTemperatureAlarm') });
    expect(handled).toBe(true);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `MatterbridgeTemperatureAlarmServer: resetting alarms ${debugStringify(alarms('criticalOverTemperatureAlarm'))}${nf} (endpoint ${sensor.id}.${sensor.number})`,
    );
    // Only the requested alarm is reset.
    expect(sensor.getAttribute(TemperatureAlarm.id, 'state')).toEqual(alarms('criticalUnderTemperatureAlarm'));
    expect(notifyEvents).toHaveLength(1);
    expect(notifyEvents[0]).toEqual({
      active: noAlarm,
      inactive: alarms('criticalOverTemperatureAlarm'),
      state: alarms('criticalUnderTemperatureAlarm'),
      mask: criticalAlarms,
    });
    sensor.removeCommandHandler('TemperatureAlarm.reset', resetHandler);
  });

  test('Reset rejects an unsupported alarm with FAILURE', async () => {
    await expect(sensor.invokeBehaviorCommand(TemperatureAlarm, 'reset', { alarms: alarms('minorOverTemperatureAlarm') })).rejects.toMatchObject({
      code: Status.Failure,
    });
    // The state is left untouched.
    expect(sensor.getAttribute(TemperatureAlarm.id, 'state')).toEqual(alarms('criticalUnderTemperatureAlarm'));
  });

  test('ModifyEnabledAlarms forwards to the command handler, updates the Mask and clears the disabled alarms', async () => {
    let handled = false;
    const modifyHandler = (data: CommandHandlerPayload<'TemperatureAlarm.modifyEnabledAlarms'>): void => {
      handled = true;
      expect(data.request).toEqual({ mask: alarms('criticalOverTemperatureAlarm') });
      // The command handler runs before the Mask is updated.
      expect(data.attributes.mask).toEqual(criticalAlarms);
    };
    sensor.addCommandHandler('TemperatureAlarm.modifyEnabledAlarms', modifyHandler);

    await sensor.invokeBehaviorCommand(TemperatureAlarm, 'modifyEnabledAlarms', { mask: alarms('criticalOverTemperatureAlarm') });
    expect(handled).toBe(true);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `MatterbridgeTemperatureAlarmServer: modifying enabled alarms ${debugStringify(alarms('criticalOverTemperatureAlarm'))}${nf} (endpoint ${sensor.id}.${sensor.number})`,
    );
    expect(sensor.getAttribute(TemperatureAlarm.id, 'mask')).toEqual(alarms('criticalOverTemperatureAlarm'));
    // The active CriticalUnderTemperature alarm is no longer enabled by the Mask, so it becomes inactive.
    expect(sensor.getAttribute(TemperatureAlarm.id, 'state')).toEqual(noAlarm);
    expect(notifyEvents).toHaveLength(1);
    expect(notifyEvents[0]).toEqual({
      active: noAlarm,
      inactive: alarms('criticalUnderTemperatureAlarm'),
      state: noAlarm,
      mask: alarms('criticalOverTemperatureAlarm'),
    });
    sensor.removeCommandHandler('TemperatureAlarm.modifyEnabledAlarms', modifyHandler);
  });

  test('Create a second TemperatureSensor device supporting every alarm', async () => {
    fullSensor = new MatterbridgeEndpoint(temperatureSensor, { id: 'temperatureAlarmFull' });
    fullSensor.behaviors.require(MatterbridgeTemperatureAlarmServer, {
      mask: allAlarms,
      latch: allAlarms,
      state: noAlarm,
      supported: allAlarms,
      criticalOverTemperatureThreshold: 4000,
      criticalUnderTemperatureThreshold: -1000,
    });
    fullSensor.addRequiredClusterServers();
    expect(await addDevice(aggregator, fullSensor)).toBeTruthy();
    expect(fullSensor.getAttribute(TemperatureAlarm.id, 'supported')).toEqual(allAlarms);

    const notify = fullSensor.eventsOf(MatterbridgeTemperatureAlarmServer).notify;
    expect(notify).toBeDefined();
    notify.on((event) => {
      fullNotifyEvents.push(event);
    });
  });

  test('Every alarm bit is carried by Notify, reset by Reset and cleared by ModifyEnabledAlarms', async () => {
    // Every alarm becomes active at once.
    await fullSensor.setAttribute(TemperatureAlarm.id, 'state', allAlarms);
    expect(fullNotifyEvents.at(-1)).toEqual({ active: allAlarms, inactive: noAlarm, state: allAlarms, mask: allAlarms });

    // Resetting every alarm makes them all inactive.
    await fullSensor.invokeBehaviorCommand(TemperatureAlarm, 'reset', { alarms: allAlarms });
    expect(fullSensor.getAttribute(TemperatureAlarm.id, 'state')).toEqual(noAlarm);
    expect(fullNotifyEvents.at(-1)).toEqual({ active: noAlarm, inactive: allAlarms, state: noAlarm, mask: allAlarms });

    // A Mask that enables every alarm leaves an all-active State untouched.
    await fullSensor.setAttribute(TemperatureAlarm.id, 'state', allAlarms);
    await fullSensor.invokeBehaviorCommand(TemperatureAlarm, 'modifyEnabledAlarms', { mask: allAlarms });
    expect(fullSensor.getAttribute(TemperatureAlarm.id, 'mask')).toEqual(allAlarms);
    expect(fullSensor.getAttribute(TemperatureAlarm.id, 'state')).toEqual(allAlarms);

    // Resetting only the over-temperature alarms leaves the under-temperature ones active.
    await fullSensor.invokeBehaviorCommand(TemperatureAlarm, 'reset', { alarms: overAlarms });
    expect(fullSensor.getAttribute(TemperatureAlarm.id, 'state')).toEqual(underAlarms);

    // Disabling the under-temperature alarms in the Mask clears them from State.
    await fullSensor.invokeBehaviorCommand(TemperatureAlarm, 'modifyEnabledAlarms', { mask: overAlarms });
    expect(fullSensor.getAttribute(TemperatureAlarm.id, 'mask')).toEqual(overAlarms);
    expect(fullSensor.getAttribute(TemperatureAlarm.id, 'state')).toEqual(noAlarm);

    // Resetting alarms that are already inactive is a no-op.
    await fullSensor.invokeBehaviorCommand(TemperatureAlarm, 'reset', { alarms: allAlarms });
    expect(fullSensor.getAttribute(TemperatureAlarm.id, 'state')).toEqual(noAlarm);
  });

  test('ModifyEnabledAlarms rejects an unsupported alarm with INVALID_COMMAND', async () => {
    await expect(sensor.invokeBehaviorCommand(TemperatureAlarm, 'modifyEnabledAlarms', { mask: alarms('majorUnderTemperatureAlarm') })).rejects.toMatchObject({
      code: Status.InvalidCommand,
    });
    // The mask is left untouched.
    expect(sensor.getAttribute(TemperatureAlarm.id, 'mask')).toEqual(alarms('criticalOverTemperatureAlarm'));
  });
});
