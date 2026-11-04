/**
 * @file packages/core/buntest/behaviors/smokeCoAlarmServer.test.ts
 * @description This file contains the bun tests for smokeCoAlarmServer.
 * @author Luca Liguori
 */

const NAME = 'SmokeCoAlarmServer';
const MATTER_PORT = 13500;

import { describe, expect, test } from 'bun:test';

import { SmokeCoAlarm } from '@matter/types/clusters/smoke-co-alarm';
import { Status } from '@matter/types/globals';
import { addBridgedDevice, aggregator } from '@matterbridge/test-utils/buntest/matter';
import { setupTest } from '@matterbridge/test-utils/buntest/setup';

import { MatterbridgeSmokeCoAlarmServer } from '../../src/behaviors/smokeCoAlarmServer.js';
import { powerSource, smokeCoAlarm } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';
import { recordCommand, useServerNode, waitFor } from '../bunUtils.js';

await setupTest(NAME, false);

describe('MatterbridgeSmokeCoAlarmServer', () => {
  useServerNode(MATTER_PORT);

  test('selfTestRequest is forwarded first, rejected with BUSY while a test runs, otherwise completes', async () => {
    const smoke = new MatterbridgeEndpoint([smokeCoAlarm, powerSource], { id: 'smokeSensor' });
    smoke.createDefaultSmokeCOAlarmClusterServer();
    smoke.createDefaultPowerSourceReplaceableBatteryClusterServer();
    smoke.addRequiredClusterServers();
    expect(await addBridgedDevice(aggregator, smoke, 0, 0, 0, 0)).toBeTruthy();

    const emitted: unknown[] = [];
    smoke.subscribeCommand(SmokeCoAlarm, 'selfTestRequest', (data) => emitted.push(data.request));
    const calls = recordCommand(smoke, 'selfTestRequest');

    // Matter 1.6.1 § 2.11.7.1: rejected with BUSY while a self-test is in progress, yet the plugin still saw it first.
    await smoke.setAttribute(SmokeCoAlarm.id, 'testInProgress', true);
    expect(smoke.invokeBehaviorCommand(SmokeCoAlarm, 'selfTestRequest')).rejects.toMatchObject({ code: Status.Busy });
    expect(calls).toEqual([{ cluster: 'smokeCoAlarm', endpoint: smoke, request: {} }]);
    expect(smoke.getAttribute(SmokeCoAlarm.id, 'expressedState')).toBe(SmokeCoAlarm.ExpressedState.Normal);
    expect(emitted).toEqual([]);

    // An accepted self-test with a 0 s duration completes right away and is announced.
    await smoke.setAttribute(SmokeCoAlarm.id, 'testInProgress', false);
    const originalDuration = MatterbridgeSmokeCoAlarmServer.selfTestDurationSeconds;
    MatterbridgeSmokeCoAlarmServer.selfTestDurationSeconds = 0;
    try {
      await smoke.invokeBehaviorCommand(SmokeCoAlarm, 'selfTestRequest');
      expect(calls).toHaveLength(2);
      await waitFor(() => smoke.getAttribute(SmokeCoAlarm.id, 'testInProgress') === false);
    } finally {
      MatterbridgeSmokeCoAlarmServer.selfTestDurationSeconds = originalDuration;
    }
    expect(smoke.getAttribute(SmokeCoAlarm.id, 'expressedState')).toBe(SmokeCoAlarm.ExpressedState.Normal);
    expect(smoke.getAttribute(SmokeCoAlarm.id, 'smokeState')).toBe(SmokeCoAlarm.AlarmState.Normal);
    expect(smoke.getAttribute(SmokeCoAlarm.id, 'coState')).toBe(SmokeCoAlarm.AlarmState.Normal);
    expect(emitted).toEqual([{}]);
  });
});
