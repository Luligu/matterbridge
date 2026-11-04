/**
 * @file packages/core/buntest/behaviors/booleanStateConfigurationServer.test.ts
 * @description This file contains the bun tests for booleanStateConfigurationServer.
 * @author Luca Liguori
 */

const NAME = 'BooleanStateConfigurationServer';
const MATTER_PORT = 13600;

import { describe, expect, test } from 'bun:test';

import { BooleanStateConfiguration } from '@matter/types/clusters/boolean-state-configuration';
import { Status } from '@matter/types/globals';
import { addBridgedDevice, aggregator } from '@matterbridge/test-utils/buntest/matter';
import { setupTest } from '@matterbridge/test-utils/buntest/setup';

import { contactSensor } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';
import { expectCommand, useServerNode } from '../bunUtils.js';

await setupTest(NAME, false);

describe('MatterbridgeBooleanStateConfigurationServer', () => {
  useServerNode(MATTER_PORT);

  test('suppressAlarm and enableDisableAlarm validate, update the state and the events fire', async () => {
    const contact = new MatterbridgeEndpoint(contactSensor, { id: 'contactSensor' });
    contact.createDefaultBooleanStateConfigurationClusterServer();
    contact.addRequiredClusterServers();
    expect(await addBridgedDevice(aggregator, contact, 0, 0, 0, 0)).toBeTruthy();

    const attribute = (name: 'alarmsActive' | 'alarmsEnabled' | 'alarmsSuppressed' | 'alarmsSupported'): unknown => contact.getAttribute(BooleanStateConfiguration.id, name);
    const both = { visual: true, audible: true };
    const none = { visual: false, audible: false };
    const suppressAlarmRequest = { alarmsToSuppress: { audible: true, visual: true } };
    const enableDisableAlarmRequest = { alarmsToEnableDisable: { audible: true, visual: true } };
    const emitted: string[] = [];
    contact.subscribeCommand(BooleanStateConfiguration, 'suppressAlarm', (data) => emitted.push(data.command));
    contact.subscribeCommand(BooleanStateConfiguration, 'enableDisableAlarm', (data) => emitted.push(data.command));
    expect([attribute('alarmsActive'), attribute('alarmsEnabled'), attribute('alarmsSuppressed'), attribute('alarmsSupported')]).toEqual([none, both, none, both]);

    // Suppressing an inactive alarm is INVALID_IN_STATE.
    expect(contact.invokeBehaviorCommand(BooleanStateConfiguration, 'suppressAlarm', suppressAlarmRequest)).rejects.toMatchObject({ code: Status.InvalidInState });
    // Requesting an unsupported alarm mode is CONSTRAINT_ERROR for both commands.
    await contact.setAttribute('booleanStateConfiguration', 'alarmsActive', { audible: true, visual: true });
    await contact.setAttribute('booleanStateConfiguration', 'alarmsSupported', { audible: true, visual: false });
    expect(contact.invokeBehaviorCommand(BooleanStateConfiguration, 'suppressAlarm', suppressAlarmRequest)).rejects.toMatchObject({ code: Status.ConstraintError });
    expect(contact.invokeBehaviorCommand(BooleanStateConfiguration, 'enableDisableAlarm', enableDisableAlarmRequest)).rejects.toMatchObject({ code: Status.ConstraintError });
    expect([attribute('alarmsEnabled'), attribute('alarmsSuppressed')]).toEqual([both, none]);

    // Supported and active: both commands succeed.
    await contact.setAttribute('booleanStateConfiguration', 'alarmsSupported', { audible: true, visual: true });
    await expectCommand(contact, BooleanStateConfiguration, 'suppressAlarm', suppressAlarmRequest, (data) => expect(data.cluster).toBe('booleanStateConfiguration'));
    expect(attribute('alarmsSuppressed')).toEqual(both);
    await expectCommand(contact, BooleanStateConfiguration, 'enableDisableAlarm', enableDisableAlarmRequest, (data) => expect(data.cluster).toBe('booleanStateConfiguration'));
    expect([attribute('alarmsActive'), attribute('alarmsEnabled'), attribute('alarmsSupported')]).toEqual([both, both, both]);

    // AlarmsStateChanged fires on AlarmsActive and AlarmsSuppressed changes, SensorFault on SensorFault changes.
    await contact.setAttribute('booleanStateConfiguration', 'alarmsSuppressed', { audible: false, visual: false });
    const events: unknown[] = [];
    contact.eventsOf('booleanStateConfiguration').alarmsStateChanged?.on((event) => {
      events.push(event);
    });
    contact.eventsOf('booleanStateConfiguration').sensorFault?.on((event) => {
      events.push(event);
    });
    await contact.setAttribute('booleanStateConfiguration', 'alarmsActive', { audible: true, visual: false });
    await contact.setAttribute('booleanStateConfiguration', 'alarmsSuppressed', { audible: true, visual: true });
    await contact.setAttribute('booleanStateConfiguration', 'sensorFault', { generalFault: true });
    expect(events).toEqual([
      { alarmsActive: { audible: true, visual: false }, alarmsSuppressed: { visual: false, audible: false } },
      { alarmsActive: { audible: true, visual: false }, alarmsSuppressed: { audible: true, visual: true } },
      { sensorFault: { generalFault: true } },
    ]);
    // Rejected commands are not announced, accepted ones are.
    expect(emitted).toEqual(['suppressAlarm', 'enableDisableAlarm']);
  });
});
