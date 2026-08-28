/**
 * @file packages/core/vitest/behaviors/valveConfigurationAndControlServer.test.ts
 * @description This file contains the tests for valveConfigurationAndControlServer.
 * @author Luca Liguori
 */

const NAME = 'ValveConfigurationAndControlServer';
const MATTER_PORT = 12200;
const MATTER_CREATE_ONLY = true;

import { Status } from '@matter/types';
import { ValveConfigurationAndControl } from '@matter/types/clusters/valve-configuration-and-control';
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
import { LogLevel } from 'node-ansi-logger';

import { MatterbridgeValveConfigurationAndControlServer } from '../../src/behaviors/valveConfigurationAndControlServer.js';
import { waterValve } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';

const noFault = { generalFault: false, blocked: false, leaking: false, notConnected: false, shortCircuit: false, currentExceeded: false };

// Setup the test environment
await setupTest(NAME, false);

describe('Server clusters and behaviors', () => {
  let valve: MatterbridgeEndpoint;

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

  test('Create WaterValve device with the Level feature', async () => {
    valve = new MatterbridgeEndpoint(waterValve, { id: 'valve' });
    valve.createDefaultValveConfigurationAndControlClusterServer();
    valve.addRequiredClusterServers();
    expect(await addDevice(aggregator, valve)).toBeTruthy();

    expect(valve.getAttribute(ValveConfigurationAndControl.id, 'currentState')).toBe(ValveConfigurationAndControl.ValveState.Closed);
    expect(valve.getAttribute(ValveConfigurationAndControl.id, 'targetState')).toBe(ValveConfigurationAndControl.ValveState.Closed);
    expect(valve.getAttribute(ValveConfigurationAndControl.id, 'currentLevel')).toBe(0);
    expect(valve.getAttribute(ValveConfigurationAndControl.id, 'targetLevel')).toBe(0);
    expect(valve.getAttribute(ValveConfigurationAndControl.id, 'openDuration')).toBeNull();
    expect(valve.getAttribute(ValveConfigurationAndControl.id, 'remainingDuration')).toBeNull();
  });

  test('Open/Close Effect on Receipt with movementDuration/autoClose left at their disabled defaults', async () => {
    const expectValveAttributes = (expected: {
      currentState: number;
      targetState: number | null;
      currentLevel: number;
      targetLevel: number | null;
      openDuration: number | null;
      remainingDuration: number | null;
    }): void => {
      expect(valve.getAttribute(ValveConfigurationAndControl.id, 'currentState')).toBe(expected.currentState);
      expect(valve.getAttribute(ValveConfigurationAndControl.id, 'targetState')).toBe(expected.targetState);
      expect(valve.getAttribute(ValveConfigurationAndControl.id, 'currentLevel')).toBe(expected.currentLevel);
      expect(valve.getAttribute(ValveConfigurationAndControl.id, 'targetLevel')).toBe(expected.targetLevel);
      expect(valve.getAttribute(ValveConfigurationAndControl.id, 'openDuration')).toBe(expected.openDuration);
      expect(valve.getAttribute(ValveConfigurationAndControl.id, 'remainingDuration')).toBe(expected.remainingDuration);
    };

    // With movementDuration/autoClose left at their defaults (0/false, i.e. disabled), open()/close() set every
    // attribute required by the Matter spec's Effect on Receipt synchronously, but CurrentState stops at
    // Transitioning and TargetState/TargetLevel never revert to null, since completing the movement (and
    // auto-closing) is left entirely to the real device implementation.
    await valve.invokeBehaviorCommand(ValveConfigurationAndControl, 'open', { targetLevel: 50, openDuration: 60 });
    expectValveAttributes({
      currentState: ValveConfigurationAndControl.ValveState.Transitioning,
      targetState: ValveConfigurationAndControl.ValveState.Open,
      currentLevel: 0,
      targetLevel: 50,
      openDuration: 60,
      remainingDuration: 60,
    });

    await valve.setAttribute(ValveConfigurationAndControl.id, 'defaultOpenDuration', null);
    await valve.invokeBehaviorCommand(ValveConfigurationAndControl, 'open', {});
    expectValveAttributes({
      currentState: ValveConfigurationAndControl.ValveState.Transitioning,
      targetState: ValveConfigurationAndControl.ValveState.Open,
      currentLevel: 0,
      targetLevel: 100,
      openDuration: null,
      remainingDuration: null,
    });

    await valve.invokeBehaviorCommand(ValveConfigurationAndControl, 'close');
    expectValveAttributes({
      currentState: ValveConfigurationAndControl.ValveState.Transitioning,
      targetState: ValveConfigurationAndControl.ValveState.Closed,
      currentLevel: 0,
      targetLevel: 0,
      openDuration: null,
      remainingDuration: null,
    });
  });

  test('Open/Close are ignored with FailureDueToFault when a fault is registered', async () => {
    await valve.setAttribute(ValveConfigurationAndControl.id, 'valveFault', { ...noFault, generalFault: true });
    await expect(valve.invokeBehaviorCommand(ValveConfigurationAndControl, 'open', {})).rejects.toMatchObject({ code: Status.Failure, clusterCode: 2 });
    await expect(valve.invokeBehaviorCommand(ValveConfigurationAndControl, 'close')).rejects.toMatchObject({ code: Status.Failure, clusterCode: 2 });
    // The fault check runs before any state is touched.
    expect(valve.getAttribute(ValveConfigurationAndControl.id, 'currentState')).toBe(ValveConfigurationAndControl.ValveState.Transitioning);
    expect(valve.getAttribute(ValveConfigurationAndControl.id, 'targetState')).toBe(ValveConfigurationAndControl.ValveState.Closed);
    await valve.setAttribute(ValveConfigurationAndControl.id, 'valveFault', noFault);
  });

  test('Open rejects a TargetLevel not aligned to LevelStep, but always accepts 100', async () => {
    await valve.setAttribute(ValveConfigurationAndControl.id, 'levelStep', 10);
    await expect(valve.invokeBehaviorCommand(ValveConfigurationAndControl, 'open', { targetLevel: 15 })).rejects.toMatchObject({ code: Status.ConstraintError });
    await valve.invokeBehaviorCommand(ValveConfigurationAndControl, 'open', { targetLevel: 100 });
    expect(valve.getAttribute(ValveConfigurationAndControl.id, 'targetLevel')).toBe(100);
    await valve.setAttribute(ValveConfigurationAndControl.id, 'levelStep', 1);
  });

  test('movementDuration simulates the Open/Close movement completing', async () => {
    // No plugin manages this endpoint's physical valve, so movementDuration/autoClose enable the built-in
    // simulation directly (mirrors demoDevices.ts's WaterValve endpoint) instead of relying on
    // MATTERBRIDGE_CHIP_TEST's initialize() default.
    const timedValve = new MatterbridgeEndpoint(waterValve, { id: 'timedValve' });
    timedValve.createDefaultValveConfigurationAndControlClusterServer(undefined, undefined, 1000, false);
    timedValve.addRequiredClusterServers();
    expect(await addDevice(aggregator, timedValve)).toBeTruthy();

    // The completion timer is a Time.getTimer() under the hood (see valveConfigurationAndControlServer.ts),
    // so fake timers let this fire deterministically without waiting out the real duration.
    vi.useFakeTimers();
    try {
      await timedValve.invokeBehaviorCommand(ValveConfigurationAndControl, 'open', { targetLevel: 42 });
      expect(timedValve.getAttribute(ValveConfigurationAndControl.id, 'currentState')).toBe(ValveConfigurationAndControl.ValveState.Transitioning);
      expect(timedValve.getAttribute(ValveConfigurationAndControl.id, 'targetState')).toBe(ValveConfigurationAndControl.ValveState.Open);

      await vi.advanceTimersByTimeAsync(1000);
      expect(timedValve.getAttribute(ValveConfigurationAndControl.id, 'currentState')).toBe(ValveConfigurationAndControl.ValveState.Open);
      expect(timedValve.getAttribute(ValveConfigurationAndControl.id, 'currentLevel')).toBe(42);
      expect(timedValve.getAttribute(ValveConfigurationAndControl.id, 'targetState')).toBeNull();
      expect(timedValve.getAttribute(ValveConfigurationAndControl.id, 'targetLevel')).toBeNull();

      // A new Open cancels a movement still in flight from a previous command.
      await timedValve.invokeBehaviorCommand(ValveConfigurationAndControl, 'open', { targetLevel: 10 });
      await timedValve.invokeBehaviorCommand(ValveConfigurationAndControl, 'close');
      await vi.advanceTimersByTimeAsync(1000);
      expect(timedValve.getAttribute(ValveConfigurationAndControl.id, 'currentState')).toBe(ValveConfigurationAndControl.ValveState.Closed);
      expect(timedValve.getAttribute(ValveConfigurationAndControl.id, 'currentLevel')).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  test('autoClose simulates the RemainingDuration countdown and closes the valve once it reaches 0', async () => {
    const timedValve = new MatterbridgeEndpoint(waterValve, { id: 'autoCloseValve' });
    timedValve.createDefaultValveConfigurationAndControlClusterServer(undefined, undefined, 0, true);
    timedValve.addRequiredClusterServers();
    expect(await addDevice(aggregator, timedValve)).toBeTruthy();

    // The countdown timer is a Time.getPeriodicTimer() under the hood, ticking once per second.
    vi.useFakeTimers();
    try {
      await timedValve.invokeBehaviorCommand(ValveConfigurationAndControl, 'open', { openDuration: 3 });
      expect(timedValve.getAttribute(ValveConfigurationAndControl.id, 'remainingDuration')).toBe(3);

      // A tick that doesn't reach 0 only decrements RemainingDuration.
      await vi.advanceTimersByTimeAsync(1000);
      expect(timedValve.getAttribute(ValveConfigurationAndControl.id, 'remainingDuration')).toBe(2);
      expect(timedValve.getAttribute(ValveConfigurationAndControl.id, 'currentState')).toBe(ValveConfigurationAndControl.ValveState.Transitioning);

      // RemainingDuration cleared externally (e.g. by a plugin) between ticks: the next tick is a no-op.
      await timedValve.setAttribute(ValveConfigurationAndControl.id, 'remainingDuration', null);
      await vi.advanceTimersByTimeAsync(1000);
      expect(timedValve.getAttribute(ValveConfigurationAndControl.id, 'remainingDuration')).toBeNull();
      expect(timedValve.getAttribute(ValveConfigurationAndControl.id, 'currentState')).toBe(ValveConfigurationAndControl.ValveState.Transitioning);

      // A fresh Open with a 1-second OpenDuration reaches 0 on the first tick and auto-closes — i.e. calls
      // close() internally, exactly as if a Close command had been received. This endpoint's movementDuration
      // is 0 (disabled), so — just like a real Close command on this endpoint — CurrentState stops at
      // Transitioning rather than converging to Closed; TargetState/OpenDuration/RemainingDuration are the
      // attributes that unambiguously prove the internal Close ran.
      await timedValve.invokeBehaviorCommand(ValveConfigurationAndControl, 'open', { openDuration: 1 });
      await vi.advanceTimersByTimeAsync(1000);
      expect(timedValve.getAttribute(ValveConfigurationAndControl.id, 'currentState')).toBe(ValveConfigurationAndControl.ValveState.Transitioning);
      expect(timedValve.getAttribute(ValveConfigurationAndControl.id, 'targetState')).toBe(ValveConfigurationAndControl.ValveState.Closed);
      expect(timedValve.getAttribute(ValveConfigurationAndControl.id, 'openDuration')).toBeNull();
      expect(timedValve.getAttribute(ValveConfigurationAndControl.id, 'remainingDuration')).toBeNull();

      // A Close cancels an auto-close countdown still in flight: RemainingDuration is cleared immediately and
      // never reaches 0, so the countdown timer's close() is never triggered a second time.
      await timedValve.invokeBehaviorCommand(ValveConfigurationAndControl, 'open', { openDuration: 60 });
      await timedValve.invokeBehaviorCommand(ValveConfigurationAndControl, 'close');
      expect(timedValve.getAttribute(ValveConfigurationAndControl.id, 'openDuration')).toBeNull();
      expect(timedValve.getAttribute(ValveConfigurationAndControl.id, 'remainingDuration')).toBeNull();
      await vi.advanceTimersByTimeAsync(60_000);
      expect(timedValve.getAttribute(ValveConfigurationAndControl.id, 'currentState')).toBe(ValveConfigurationAndControl.ValveState.Transitioning);
      expect(timedValve.getAttribute(ValveConfigurationAndControl.id, 'targetState')).toBe(ValveConfigurationAndControl.ValveState.Closed);
    } finally {
      vi.useRealTimers();
    }
  });

  test('Level feature absent: Open/Close never touch CurrentLevel/TargetLevel', async () => {
    // The Level feature is required per endpoint (see createDefaultValveConfigurationAndControlClusterServer(),
    // which always passes ValveConfigurationAndControl.Feature.Level) — MatterbridgeValveConfigurationAndControlServer
    // itself supports being required without it, exercising the class's `this.features.level` branches.
    const noLevelValve = new MatterbridgeEndpoint(waterValve, { id: 'noLevelValve' });
    noLevelValve.behaviors.require(MatterbridgeValveConfigurationAndControlServer.with(), {
      currentState: ValveConfigurationAndControl.ValveState.Closed,
      targetState: ValveConfigurationAndControl.ValveState.Closed,
      openDuration: null,
      defaultOpenDuration: null,
      remainingDuration: null,
      valveFault: noFault,
      movementDuration: 1000,
      autoClose: false,
    });
    noLevelValve.addRequiredClusterServers();
    expect(await addDevice(aggregator, noLevelValve)).toBeTruthy();
    expect(noLevelValve.hasAttributeServer(ValveConfigurationAndControl.id, 'currentLevel')).toBe(false);
    expect(noLevelValve.hasAttributeServer(ValveConfigurationAndControl.id, 'targetLevel')).toBe(false);

    vi.useFakeTimers();
    try {
      // Open must not attempt to set (nonexistent) CurrentLevel/TargetLevel attributes.
      await noLevelValve.invokeBehaviorCommand(ValveConfigurationAndControl, 'open', {});
      expect(noLevelValve.getAttribute(ValveConfigurationAndControl.id, 'currentState')).toBe(ValveConfigurationAndControl.ValveState.Transitioning);
      expect(noLevelValve.getAttribute(ValveConfigurationAndControl.id, 'targetState')).toBe(ValveConfigurationAndControl.ValveState.Open);

      await vi.advanceTimersByTimeAsync(1000);
      expect(noLevelValve.getAttribute(ValveConfigurationAndControl.id, 'currentState')).toBe(ValveConfigurationAndControl.ValveState.Open);
      expect(noLevelValve.getAttribute(ValveConfigurationAndControl.id, 'targetState')).toBeNull();

      // Close must not attempt to set (nonexistent) TargetLevel either.
      await noLevelValve.invokeBehaviorCommand(ValveConfigurationAndControl, 'close');
      expect(noLevelValve.getAttribute(ValveConfigurationAndControl.id, 'currentState')).toBe(ValveConfigurationAndControl.ValveState.Transitioning);
      await vi.advanceTimersByTimeAsync(1000);
      expect(noLevelValve.getAttribute(ValveConfigurationAndControl.id, 'currentState')).toBe(ValveConfigurationAndControl.ValveState.Closed);
    } finally {
      vi.useRealTimers();
    }
  });
});
