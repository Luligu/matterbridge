/**
 * @file packages/core/vitest/behaviors/booleanStateConfigurationServer.test.ts
 * @description This file contains the tests for booleanStateConfigurationServer.
 * @author Luca Liguori
 */

const NAME = 'BooleanStateConfigurationServer';
const MATTER_PORT = 13600;
const MATTER_CREATE_ONLY = true;

import { Status } from '@matter/types';
import { BooleanStateConfiguration } from '@matter/types/clusters/boolean-state-configuration';
import { setupTest } from '@matterbridge/vitest-utils';
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

import { contactSensor } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';
import { expectCommand } from '../vitestUtils.js';

// Setup the test environment
await setupTest(NAME, false);

describe('MatterbridgeBooleanStateConfigurationServer', () => {
  let contact: MatterbridgeEndpoint;

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

  test('Device type: contactSensor', async () => {
    contact = new MatterbridgeEndpoint(contactSensor, { id: 'contactSensor' });
    contact.createDefaultBooleanStateConfigurationClusterServer();
    contact.addRequiredClusterServers();
    expect(contact).toBeDefined();
    expect(await addDevice(aggregator, contact)).toBeTruthy();
  });

  test('BooleanStateConfiguration server', async () => {
    const suppressAlarmRequest = { alarmsToSuppress: { audible: true, visual: true } };
    const enableDisableAlarmRequest = { alarmsToEnableDisable: { audible: true, visual: true } };

    expect(contact.getAttribute(BooleanStateConfiguration.id, 'alarmsActive')).toEqual({ visual: false, audible: false });
    expect(contact.getAttribute(BooleanStateConfiguration.id, 'alarmsEnabled')).toEqual({ visual: true, audible: true });
    expect(contact.getAttribute(BooleanStateConfiguration.id, 'alarmsSuppressed')).toEqual({ visual: false, audible: false });
    expect(contact.getAttribute(BooleanStateConfiguration.id, 'alarmsSupported')).toEqual({ visual: true, audible: true });

    await expect(contact.invokeBehaviorCommand(BooleanStateConfiguration, 'suppressAlarm', suppressAlarmRequest)).rejects.toMatchObject({ code: Status.InvalidInState });
    expect(contact.getAttribute(BooleanStateConfiguration.id, 'alarmsSuppressed')).toEqual({ visual: false, audible: false });

    await contact.setAttribute('booleanStateConfiguration', 'alarmsActive', { audible: true, visual: true });
    await contact.setAttribute('booleanStateConfiguration', 'alarmsSupported', { audible: true, visual: false });
    await expect(contact.invokeBehaviorCommand(BooleanStateConfiguration, 'suppressAlarm', suppressAlarmRequest)).rejects.toMatchObject({ code: Status.ConstraintError });
    expect(contact.getAttribute(BooleanStateConfiguration.id, 'alarmsSuppressed')).toEqual({ visual: false, audible: false });

    await expect(contact.invokeBehaviorCommand(BooleanStateConfiguration, 'enableDisableAlarm', enableDisableAlarmRequest)).rejects.toMatchObject({ code: Status.ConstraintError });
    expect(contact.getAttribute(BooleanStateConfiguration.id, 'alarmsEnabled')).toEqual({ visual: true, audible: true });

    await contact.setAttribute('booleanStateConfiguration', 'alarmsSupported', { audible: true, visual: true });
    await expectCommand(contact, BooleanStateConfiguration, 'suppressAlarm', suppressAlarmRequest, (data) => {
      expect(data.cluster).toBe('booleanStateConfiguration');
    });
    expect(contact.getAttribute(BooleanStateConfiguration.id, 'alarmsSuppressed')).toEqual({ visual: true, audible: true });

    await expectCommand(contact, BooleanStateConfiguration, 'enableDisableAlarm', enableDisableAlarmRequest, (data) => {
      expect(data.cluster).toBe('booleanStateConfiguration');
    });

    expect(contact.getAttribute(BooleanStateConfiguration.id, 'alarmsActive')).toEqual({ visual: true, audible: true });
    expect(contact.getAttribute(BooleanStateConfiguration.id, 'alarmsEnabled')).toEqual({ visual: true, audible: true });
    expect(contact.getAttribute(BooleanStateConfiguration.id, 'alarmsSupported')).toEqual({ visual: true, audible: true });

    await contact.setAttribute('booleanStateConfiguration', 'alarmsSuppressed', { audible: false, visual: false });
    const alarmsStateChangedEvents: unknown[] = [];
    const alarmsStateChanged = contact.eventsOf('booleanStateConfiguration').alarmsStateChanged;
    expect(alarmsStateChanged).toBeDefined();
    alarmsStateChanged?.on((event) => {
      alarmsStateChangedEvents.push(event);
    });

    await contact.setAttribute('booleanStateConfiguration', 'alarmsActive', { audible: true, visual: false });
    expect(alarmsStateChangedEvents).toHaveLength(1);
    expect(alarmsStateChangedEvents[0]).toEqual({ alarmsActive: { audible: true, visual: false }, alarmsSuppressed: { visual: false, audible: false } });

    await contact.setAttribute('booleanStateConfiguration', 'alarmsSuppressed', { audible: true, visual: true });
    expect(alarmsStateChangedEvents).toHaveLength(2);
    expect(alarmsStateChangedEvents[1]).toEqual({ alarmsActive: { audible: true, visual: false }, alarmsSuppressed: { audible: true, visual: true } });

    const sensorFaultEvents: unknown[] = [];
    const sensorFault = contact.eventsOf('booleanStateConfiguration').sensorFault;
    expect(sensorFault).toBeDefined();
    sensorFault?.on((event) => {
      sensorFaultEvents.push(event);
    });

    await contact.setAttribute('booleanStateConfiguration', 'sensorFault', { generalFault: true });
    expect(sensorFaultEvents).toHaveLength(1);
    expect(sensorFaultEvents[0]).toEqual({ sensorFault: { generalFault: true } });
  });
});
