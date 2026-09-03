/**
 * @file packages/core/vitest/behaviors/smokeCoAlarmServer.test.ts
 * @description This file contains the tests for smokeCoAlarmServer.
 * @author Luca Liguori
 */

const NAME = 'SmokeCoAlarmServer';
const MATTER_PORT = 13500;
const MATTER_CREATE_ONLY = true;

import { Status } from '@matter/types';
import { SmokeCoAlarm } from '@matter/types/clusters/smoke-co-alarm';
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

import { MatterbridgeSmokeCoAlarmServer } from '../../src/behaviors/smokeCoAlarmServer.js';
import { smokeCoAlarm } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';

// Setup the test environment
await setupTest(NAME, false);

describe('MatterbridgeSmokeCoAlarmServer', () => {
  let smoke: MatterbridgeEndpoint;

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

  test('Device type: smokeSensor', async () => {
    smoke = new MatterbridgeEndpoint(smokeCoAlarm, { id: 'smokeSensor' });
    smoke.createDefaultSmokeCOAlarmClusterServer();
    smoke.addRequiredClusterServers();
    expect(smoke).toBeDefined();
    expect(await addDevice(aggregator, smoke)).toBeTruthy();
  });

  test('SmokeCoAlarm server', async () => {
    expect(smoke.getAttribute(SmokeCoAlarm.id, 'smokeState')).toBe(SmokeCoAlarm.AlarmState.Normal);
    expect(smoke.getAttribute(SmokeCoAlarm.id, 'coState')).toBe(SmokeCoAlarm.AlarmState.Normal);

    // A single recording handler is registered for both invocations below, because only the first handler
    // registered for a command name is ever executed.
    const selfTestCalls: Array<{ cluster: string; endpoint: MatterbridgeEndpoint; request: object }> = [];
    smoke.addCommandHandler('selfTestRequest', (data) => {
      selfTestCalls.push({ cluster: data.cluster, endpoint: data.endpoint, request: data.request });
    });

    // Matter 1.6 Application Cluster Specification, 2.11.9.1.1 SelfTestRequest: a request is rejected with BUSY
    // when ExpressedState is not Normal (here forced via testInProgress).
    //
    // This also pins down the forwarding contract shared by every Matterbridge cluster server: the plugin command
    // handler is invoked before any validation, so a plugin sees the command even when the server then rejects it.
    await smoke.setAttribute(SmokeCoAlarm.id, 'testInProgress', true);
    await expect(smoke.invokeBehaviorCommand(SmokeCoAlarm, 'selfTestRequest')).rejects.toMatchObject({ code: Status.Busy });
    expect(selfTestCalls).toEqual([{ cluster: 'smokeCoAlarm', endpoint: smoke, request: {} }]);
    // The rejected request left the self-test state untouched: no transition to Testing.
    expect(smoke.getAttribute(SmokeCoAlarm.id, 'expressedState')).toBe(SmokeCoAlarm.ExpressedState.Normal);
    await smoke.setAttribute(SmokeCoAlarm.id, 'testInProgress', false);

    // Reduce the self-test duration so the timer-driven completion (#completeSelfTest) fires promptly and does not
    // leak a pending timer into later tests.
    const originalSelfTestDurationSeconds = MatterbridgeSmokeCoAlarmServer.selfTestDurationSeconds;
    MatterbridgeSmokeCoAlarmServer.selfTestDurationSeconds = 0;
    try {
      await smoke.invokeBehaviorCommand(SmokeCoAlarm, 'selfTestRequest');
      expect(selfTestCalls).toHaveLength(2);
      expect(selfTestCalls[1]).toEqual({ cluster: 'smokeCoAlarm', endpoint: smoke, request: {} });
      // With selfTestDurationSeconds reduced to 0, the completion timer may already have fired by the time control
      // returns here, so only the post-completion state (not the transient Testing state) is asserted deterministically.
      await vi.waitFor(() => {
        expect(smoke.getAttribute(SmokeCoAlarm.id, 'testInProgress')).toBe(false);
      });
      expect(smoke.getAttribute(SmokeCoAlarm.id, 'expressedState')).toBe(SmokeCoAlarm.ExpressedState.Normal);
    } finally {
      MatterbridgeSmokeCoAlarmServer.selfTestDurationSeconds = originalSelfTestDurationSeconds;
    }

    expect(smoke.getAttribute(SmokeCoAlarm.id, 'smokeState')).toBe(SmokeCoAlarm.AlarmState.Normal);
    expect(smoke.getAttribute(SmokeCoAlarm.id, 'coState')).toBe(SmokeCoAlarm.AlarmState.Normal);
  });
});
