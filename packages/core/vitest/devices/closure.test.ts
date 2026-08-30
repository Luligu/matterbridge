/**
 * @file packages/core/vitest/devices/closure.test.ts
 * @description This file contains the tests for the Closure device.
 * @author Luca Liguori
 */

const NAME = 'Closure';
const MATTER_PORT = 8022;
const MATTER_CREATE_ONLY = true;

import { ClosureCoveringTag, ClosurePanelTag, ClosureTag } from '@matter/node';
import { Status } from '@matter/types';
import { ClosureControl } from '@matter/types/clusters/closure-control';
import { ClosureDimension } from '@matter/types/clusters/closure-dimension';
import { Identify } from '@matter/types/clusters/identify';
import { PowerSource } from '@matter/types/clusters/power-source';
import { ThreeLevelAuto } from '@matter/types/globals';
import { loggerErrorSpy, loggerFatalSpy, loggerWarnSpy, setupTest } from '@matterbridge/vitest-utils';
import {
  addDevice,
  aggregator,
  createServerNode,
  createTestEnvironment,
  destroyTestEnvironment,
  flushServerNode,
  server,
  startServerNode,
  stopServerNode,
} from '@matterbridge/vitest-utils/matter';
import { stringify } from 'node-ansi-logger';

import { Closure } from '../../src/devices/closure.js';
import { closure } from '../../src/matterbridgeDeviceTypes.js';
import { getSemtag } from '../../src/matterbridgeEndpointHelpers.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  let device: Closure;
  let venetianBlind: Closure;
  let gate: Closure;

  beforeAll(async () => {
    // Setup the Matter test environment
    await createTestEnvironment();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    expect(loggerWarnSpy).not.toHaveBeenCalled();
    expect(loggerErrorSpy).not.toHaveBeenCalled();
    expect(loggerFatalSpy).not.toHaveBeenCalled();
  });

  afterAll(async () => {
    // Destroy the Matter test environment
    await destroyTestEnvironment();
    // Restore all mocks
    vi.restoreAllMocks();
  });

  test('create the server node', async () => {
    await createServerNode(MATTER_PORT, closure.code);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('create a closure device', () => {
    device = new Closure('Closure Test Device', 'CL123456');
    expect(device).toBeDefined();
    expect(device.id).toBe('ClosureTestDevice-CL123456');

    expect(device.hasClusterServer(Identify.id)).toBeTruthy();
    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();
    expect(device.hasClusterServer(ClosureControl.id)).toBeTruthy();
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'identify', 'powerSource', 'closureControl']);

    expect(device.getClusterServerOptions(ClosureControl.id)).toMatchObject({
      mainState: ClosureControl.MainState.Stopped,
    });
  });

  test('add a closure device', async () => {
    expect(await addDevice(server, device)).toBeTruthy();
  });

  test('check attributes after adding device to server', () => {
    expect(device.getMainState()).toBe(ClosureControl.MainState.Stopped);
  });

  test('set closure state helpers', async () => {
    await device.setFullOpened();
    expect(device.getAttribute(ClosureControl.id, 'countdownTime')).toBe(0);
    expect(device.getAttribute(ClosureControl.id, 'mainState')).toBe(ClosureControl.MainState.Stopped);
    expect(device.getAttribute(ClosureControl.id, 'currentErrorList')).toEqual([]);
    expect(device.getAttribute(ClosureControl.id, 'overallCurrentState')).toEqual({
      position: ClosureControl.CurrentPosition.FullyOpened,
      latch: false,
      speed: ThreeLevelAuto.Auto,
      secureState: false,
    });
    expect(device.getAttribute(ClosureControl.id, 'overallTargetState')).toEqual({
      position: ClosureControl.TargetPosition.MoveToFullyOpen,
      latch: false,
      speed: ThreeLevelAuto.Auto,
    });

    await device.setPartiallyOpened();
    expect(device.getAttribute(ClosureControl.id, 'countdownTime')).toBe(0);
    expect(device.getAttribute(ClosureControl.id, 'mainState')).toBe(ClosureControl.MainState.Stopped);
    expect(device.getAttribute(ClosureControl.id, 'currentErrorList')).toEqual([]);
    expect(device.getAttribute(ClosureControl.id, 'overallCurrentState')).toEqual({
      position: ClosureControl.CurrentPosition.PartiallyOpened,
      latch: false,
      speed: ThreeLevelAuto.Auto,
      secureState: false,
    });
    expect(device.getAttribute(ClosureControl.id, 'overallTargetState')).toEqual({
      position: null,
      latch: false,
      speed: ThreeLevelAuto.Auto,
    });

    await device.setFullyClosed();
    expect(device.getAttribute(ClosureControl.id, 'countdownTime')).toBe(0);
    expect(device.getAttribute(ClosureControl.id, 'mainState')).toBe(ClosureControl.MainState.Stopped);
    expect(device.getAttribute(ClosureControl.id, 'currentErrorList')).toEqual([]);
    expect(device.getAttribute(ClosureControl.id, 'overallCurrentState')).toEqual({
      position: ClosureControl.CurrentPosition.FullyClosed,
      latch: true,
      speed: ThreeLevelAuto.Auto,
      secureState: true,
    });
    expect(device.getAttribute(ClosureControl.id, 'overallTargetState')).toEqual({
      position: ClosureControl.TargetPosition.MoveToFullyClosed,
      latch: true,
      speed: ThreeLevelAuto.Auto,
    });

    await device.setState(
      {
        position: ClosureControl.CurrentPosition.FullyClosed,
        latch: false,
        speed: ThreeLevelAuto.Auto,
        secureState: false,
      },
      {
        position: ClosureControl.TargetPosition.MoveToFullyOpen,
        latch: false,
        speed: ThreeLevelAuto.Auto,
      },
      ClosureControl.MainState.WaitingForMotion,
      10,
      [ClosureControl.ClosureError.MaintenanceRequired],
    );
    expect(device.getAttribute(ClosureControl.id, 'countdownTime')).toBe(10);
    expect(device.getAttribute(ClosureControl.id, 'mainState')).toBe(ClosureControl.MainState.WaitingForMotion);
    expect(device.getAttribute(ClosureControl.id, 'currentErrorList')).toEqual([ClosureControl.ClosureError.MaintenanceRequired]);

    await device.setFullyClosed();
  });

  test('create closure devices with power source options', () => {
    const batteryClosure = new Closure('Closure Battery Test Device', 'CLBATTERY', { powerSourceType: 'Battery' });
    expect(batteryClosure.hasClusterServer(PowerSource.id)).toBeTruthy();
    expect(batteryClosure.getClusterServerOptions(PowerSource.id)).toMatchObject({
      batChargeLevel: PowerSource.BatChargeLevel.Ok,
      batReplaceability: PowerSource.BatReplaceability.Unspecified,
      description: 'Primary battery',
    });

    const rechargeableClosure = new Closure('Closure Rechargeable Test Device', 'CLRECHARGEABLE', { powerSourceType: 'Rechargeable' });
    expect(rechargeableClosure.hasClusterServer(PowerSource.id)).toBeTruthy();
    expect(rechargeableClosure.getClusterServerOptions(PowerSource.id)).toMatchObject({
      batChargeLevel: PowerSource.BatChargeLevel.Ok,
      batReplaceability: PowerSource.BatReplaceability.Unspecified,
      description: 'Primary battery',
    });

    const replaceableClosure = new Closure('Closure Replaceable Test Device', 'CLREPLACEABLE', { powerSourceType: 'Replaceable' });
    expect(replaceableClosure.hasClusterServer(PowerSource.id)).toBeTruthy();
    expect(replaceableClosure.getClusterServerOptions(PowerSource.id)).toMatchObject({
      batChargeLevel: PowerSource.BatChargeLevel.Ok,
      batReplaceability: PowerSource.BatReplaceability.UserReplaceable,
      description: 'Primary battery',
    });

    const closureWithoutPowerSource = new Closure('Closure No Power Source Test Device', 'CLNONE', { powerSourceType: 'None' });
    expect(closureWithoutPowerSource.hasClusterServer(PowerSource.id)).toBeFalsy();
    expect(closureWithoutPowerSource.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'identify', 'closureControl']);
  });

  test.each([
    {
      name: 'Ventilation',
      serial: 'CLVENTILATION',
      options: { ventilation: true },
      expectedFeatures: { ventilation: true, pedestrian: false, calibration: false },
      expectedCommands: [0, 1],
    },
    {
      name: 'Pedestrian',
      serial: 'CLPEDESTRIAN',
      options: { pedestrian: true },
      expectedFeatures: { ventilation: false, pedestrian: true, calibration: false },
      expectedCommands: [0, 1],
    },
    {
      name: 'Calibration',
      serial: 'CLCALIBRATION',
      options: { calibration: true },
      expectedFeatures: { ventilation: false, pedestrian: false, calibration: true },
      expectedCommands: [0, 1, 2],
    },
  ])('add only the $name optional feature', async ({ name, serial, options, expectedFeatures, expectedCommands }) => {
    const closureWithFeature = new Closure(`Closure ${name} Test Device`, serial, options);
    expect(await addDevice(server, closureWithFeature)).toBeTruthy();

    expect(closureWithFeature.getAttribute(ClosureControl.id, 'featureMap')).toMatchObject({
      positioning: true,
      motionLatching: true,
      speed: true,
      ...expectedFeatures,
    });
    expect(closureWithFeature.getAttribute(ClosureControl.id, 'acceptedCommandList')).toEqual(expectedCommands);
  });

  test('create and add a closure device with the Ventilation, Pedestrian, and Calibration features', async () => {
    gate = new Closure('Sliding Gate Test Device', 'CL789012', {
      ventilation: true,
      pedestrian: true,
      calibration: true,
    });
    expect(await addDevice(server, gate)).toBeTruthy();

    expect(gate.getAttribute(ClosureControl.id, 'featureMap')).toMatchObject({
      positioning: true,
      motionLatching: true,
      speed: true,
      ventilation: true,
      pedestrian: true,
      calibration: true,
    });
    expect(gate.getAttribute(ClosureControl.id, 'acceptedCommandList')).toEqual([0, 1, 2]);

    await gate.invokeBehaviorCommand('closureControl', 'ClosureControl.moveTo', {
      position: ClosureControl.TargetPosition.MoveToPedestrianPosition,
      latch: false,
    });
    expect(gate.getMainState()).toBe(ClosureControl.MainState.Moving);
    expect(gate.getAttribute(ClosureControl.id, 'overallTargetState')).toMatchObject({
      position: ClosureControl.TargetPosition.MoveToPedestrianPosition,
      latch: false,
    });

    await expect(gate.invokeBehaviorCommand('closureControl', 'ClosureControl.calibrate', {})).rejects.toMatchObject({ code: Status.InvalidInState });

    let calibrateForwarded = 0;
    gate.addCommandHandler('ClosureControl.calibrate', (data) => {
      calibrateForwarded++;
      expect(data.command).toBe('calibrate');
      expect(data.request).toEqual({});
      expect(data.cluster).toBe('closureControl');
      expect(data.endpoint).toBe(gate);
    });
    await gate.setAttribute(ClosureControl.id, 'mainState', ClosureControl.MainState.Stopped);
    await gate.invokeBehaviorCommand('closureControl', 'ClosureControl.calibrate', {});
    expect(calibrateForwarded).toBe(1);
    expect(gate.getMainState()).toBe(ClosureControl.MainState.Calibrating);

    await gate.invokeBehaviorCommand('closureControl', 'ClosureControl.calibrate', {});
    expect(calibrateForwarded).toBe(2);
    expect(gate.getMainState()).toBe(ClosureControl.MainState.Calibrating);
  });

  test('reject moveTo with invalid field constraints', async () => {
    // General Interaction Model requirement: an out-of-range enum or wrong-typed field is rejected with
    // CONSTRAINT_ERROR ahead of any state-dependent check, regardless of the device's current MainState.
    await expect(
      device.invokeBehaviorCommand('closureControl', 'ClosureControl.moveTo', {
        position: 99 as ClosureControl.TargetPosition,
      }),
    ).rejects.toMatchObject({ code: Status.ConstraintError });

    await expect(
      device.invokeBehaviorCommand('closureControl', 'ClosureControl.moveTo', {
        latch: 'yes' as unknown as boolean,
      }),
    ).rejects.toMatchObject({ code: Status.ConstraintError });

    await expect(
      device.invokeBehaviorCommand('closureControl', 'ClosureControl.moveTo', {
        speed: 99 as ThreeLevelAuto,
      }),
    ).rejects.toMatchObject({ code: Status.ConstraintError });

    // None of the rejected commands above touched state.
    expect(device.getMainState()).toBe(ClosureControl.MainState.Stopped);
  });

  test('invoke closure control commands', async () => {
    await device.setAttribute(ClosureControl.id, 'overallCurrentState', null);
    await device.setAttribute(ClosureControl.id, 'overallTargetState', null);
    await device.invokeBehaviorCommand('closureControl', 'ClosureControl.moveTo', {
      position: ClosureControl.TargetPosition.MoveToFullyOpen,
    });

    expect(device.getMainState()).toBe(ClosureControl.MainState.Moving);
    expect(device.getAttribute(ClosureControl.id, 'overallTargetState')).toEqual({
      position: ClosureControl.TargetPosition.MoveToFullyOpen,
      speed: ThreeLevelAuto.Auto,
    });

    await device.setAttribute(ClosureControl.id, 'overallCurrentState', {
      position: ClosureControl.CurrentPosition.FullyClosed,
      latch: true,
      speed: ThreeLevelAuto.Auto,
      secureState: true,
    });
    await device.setAttribute(ClosureControl.id, 'overallTargetState', null);
    // MoveTo requires at least one of position, latch, or speed (Matter spec §5.4.8.2, O.a+ choice conformance).
    await expect(device.invokeBehaviorCommand('closureControl', 'ClosureControl.moveTo', {})).rejects.toMatchObject({ code: Status.InvalidCommand });
    expect(device.getMainState()).toBe(ClosureControl.MainState.Moving);
    expect(device.getAttribute(ClosureControl.id, 'overallTargetState')).toBeNull();

    await device.invokeBehaviorCommand('closureControl', 'ClosureControl.moveTo', {
      position: ClosureControl.TargetPosition.MoveToFullyOpen,
      latch: false,
    });
    expect(device.getMainState()).toBe(ClosureControl.MainState.Moving);

    await device.invokeBehaviorCommand('closureControl', 'ClosureControl.stop', {});
    expect(device.getMainState()).toBe(ClosureControl.MainState.Stopped);

    await device.invokeBehaviorCommand('closureControl', 'ClosureControl.moveTo', {
      position: ClosureControl.TargetPosition.MoveToFullyClosed,
      latch: false,
    });
    expect(device.getMainState()).toBe(ClosureControl.MainState.Moving);

    await expect(
      device.invokeBehaviorCommand('closureControl', 'ClosureControl.moveTo', {
        position: ClosureControl.TargetPosition.MoveToFullyOpen,
      }),
    ).rejects.toMatchObject({ code: Status.InvalidInState });
    expect(device.getMainState()).toBe(ClosureControl.MainState.Moving);
    expect(device.getAttribute(ClosureControl.id, 'overallTargetState')).toEqual({
      position: ClosureControl.TargetPosition.MoveToFullyClosed,
      latch: false,
      speed: ThreeLevelAuto.Auto,
    });

    await device.invokeBehaviorCommand('closureControl', 'ClosureControl.moveTo', {
      position: ClosureControl.TargetPosition.MoveToFullyClosed,
      latch: false,
      speed: 1,
    });
    expect(device.getMainState()).toBe(ClosureControl.MainState.Moving);
    expect(device.getAttribute(ClosureControl.id, 'overallTargetState')).toMatchObject({
      position: ClosureControl.TargetPosition.MoveToFullyClosed,
      latch: false,
      speed: 1,
    });
    expect(device.getAttribute(ClosureControl.id, 'overallCurrentState')).toMatchObject({ speed: 1 });

    // An omitted position retains its previous target, while an omitted speed falls back to Auto.
    await device.invokeBehaviorCommand('closureControl', 'ClosureControl.moveTo', {
      latch: false,
    });
    expect(device.getMainState()).toBe(ClosureControl.MainState.Moving);
    expect(device.getAttribute(ClosureControl.id, 'overallTargetState')).toEqual({
      position: ClosureControl.TargetPosition.MoveToFullyClosed,
      latch: false,
      speed: ThreeLevelAuto.Auto,
    });

    // When the requested position, latch, and speed already match OverallCurrentState, MainState resolves directly to Stopped.
    await device.setAttribute(ClosureControl.id, 'overallCurrentState', {
      position: ClosureControl.CurrentPosition.FullyClosed,
      latch: false,
      speed: 2,
      secureState: true,
    });
    await device.invokeBehaviorCommand('closureControl', 'ClosureControl.moveTo', {
      position: ClosureControl.TargetPosition.MoveToFullyClosed,
      latch: false,
      speed: 2,
    });
    expect(device.getMainState()).toBe(ClosureControl.MainState.Stopped);
    expect(device.getAttribute(ClosureControl.id, 'overallTargetState')).toEqual({
      position: ClosureControl.TargetPosition.MoveToFullyClosed,
      latch: false,
      speed: 2,
    });
    await device.setAttribute(ClosureControl.id, 'overallCurrentState', {
      position: ClosureControl.CurrentPosition.FullyClosed,
      latch: true,
      speed: ThreeLevelAuto.Auto,
      secureState: true,
    });

    await device.setAttribute(ClosureControl.id, 'mainState', ClosureControl.MainState.Error);
    await device.setAttribute(ClosureControl.id, 'overallTargetState', {
      position: ClosureControl.TargetPosition.MoveToFullyClosed,
      latch: true,
      speed: ThreeLevelAuto.Auto,
    });
    await expect(
      device.invokeBehaviorCommand('closureControl', 'ClosureControl.moveTo', {
        position: ClosureControl.TargetPosition.MoveToFullyOpen,
      }),
    ).rejects.toMatchObject({ code: Status.InvalidInState });
    expect(device.getMainState()).toBe(ClosureControl.MainState.Error);
    expect(device.getAttribute(ClosureControl.id, 'overallTargetState')).toEqual({
      position: ClosureControl.TargetPosition.MoveToFullyClosed,
      latch: true,
      speed: ThreeLevelAuto.Auto,
    });

    // Stop always succeeds, but only transitions MainState to Stopped when it was Moving, WaitingForMotion, or
    // Calibrating (Matter spec §5.4.8.1); an unrelated state like Error is left untouched.
    await device.invokeBehaviorCommand('closureControl', 'ClosureControl.stop', {});
    expect(device.getMainState()).toBe(ClosureControl.MainState.Error);

    await device.setAttribute(ClosureControl.id, 'mainState', ClosureControl.MainState.Moving);
    await device.setAttribute(ClosureControl.id, 'overallTargetState', {
      position: ClosureControl.TargetPosition.MoveToFullyClosed,
      latch: false,
      speed: ThreeLevelAuto.Auto,
    });
  });

  test('trigger closure control events', async () => {
    await device.setFullyClosed();

    await device.triggerMovementCompleted();

    await device.triggerSecureStateChanged(false);

    await device.triggerOperationalError([ClosureControl.ClosureError.MaintenanceRequired]);
    expect(device.getMainState()).toBe(ClosureControl.MainState.Error);
    expect(device.getAttribute(ClosureControl.id, 'currentErrorList')).toEqual([ClosureControl.ClosureError.MaintenanceRequired]);

    await device.triggerOperationalError();
    expect(device.getMainState()).toBe(ClosureControl.MainState.Error);
    expect(device.getAttribute(ClosureControl.id, 'currentErrorList')).toEqual([]);

    // Restore the state left by the previous test so later attribute-snapshot assertions are unaffected.
    await device.setAttribute(ClosureControl.id, 'mainState', ClosureControl.MainState.Moving);
    await device.setAttribute(ClosureControl.id, 'overallTargetState', {
      position: ClosureControl.TargetPosition.MoveToFullyClosed,
      latch: false,
      speed: ThreeLevelAuto.Auto,
    });
  });

  test('simulate MoveTo completion via movementDuration', async () => {
    const timedDevice = new Closure('Closure Timed Test Device', 'CLTIMED', { movementDuration: 1000 });
    expect(await addDevice(server, timedDevice)).toBeTruthy();

    const movementCompleted = vi.fn();
    const secureStateChanged = vi.fn();
    (timedDevice.events as any).closureControl.movementCompleted.on(movementCompleted);
    (timedDevice.events as any).closureControl.secureStateChanged.on(secureStateChanged);

    // The completion timer is a plain setTimeout under the hood (see closure.ts), so fake timers let this fire
    // deterministically without waiting out the real 1s duration.
    vi.useFakeTimers();
    try {
      // Default state is fully closed and latched; moving to fully open while unlatching also flips SecureState.
      await timedDevice.invokeBehaviorCommand('closureControl', 'ClosureControl.moveTo', {
        position: ClosureControl.TargetPosition.MoveToFullyOpen,
        latch: false,
      });
      expect(timedDevice.getMainState()).toBe(ClosureControl.MainState.Moving);
      expect(timedDevice.getAttribute(ClosureControl.id, 'countdownTime')).toBe(1);

      await vi.advanceTimersByTimeAsync(1000);
      expect(timedDevice.getMainState()).toBe(ClosureControl.MainState.Stopped);
      expect(timedDevice.getAttribute(ClosureControl.id, 'countdownTime')).toBe(0);
      expect(timedDevice.getAttribute(ClosureControl.id, 'overallCurrentState')).toEqual({
        position: ClosureControl.CurrentPosition.FullyOpened,
        latch: false,
        speed: ThreeLevelAuto.Auto,
        secureState: false,
      });
      expect(movementCompleted).toHaveBeenCalledTimes(1);
      expect(secureStateChanged).toHaveBeenCalledTimes(1);
      expect(secureStateChanged.mock.calls[0]?.[0]).toMatchObject({ secureValue: false });

      // A second move that doesn't change the latch-derived SecureState should not re-trigger SecureStateChanged.
      movementCompleted.mockClear();
      secureStateChanged.mockClear();
      await timedDevice.invokeBehaviorCommand('closureControl', 'ClosureControl.moveTo', {
        position: ClosureControl.TargetPosition.MoveToFullyClosed,
        latch: false,
      });
      await vi.advanceTimersByTimeAsync(1000);
      expect(timedDevice.getAttribute(ClosureControl.id, 'overallCurrentState')).toEqual({
        position: ClosureControl.CurrentPosition.FullyClosed,
        latch: false,
        speed: ThreeLevelAuto.Auto,
        secureState: false,
      });
      expect(movementCompleted).toHaveBeenCalledTimes(1);
      expect(secureStateChanged).not.toHaveBeenCalled();

      // A position-only MoveTo with no prior OverallTargetState to carry a latch value forward falls back to
      // OverallCurrentState's own latch once the movement completes (the closure is currently unlatched, so
      // this doesn't trip the "position change requires latch false while latched" check).
      movementCompleted.mockClear();
      await timedDevice.setAttribute(ClosureControl.id, 'overallTargetState', null);
      await timedDevice.invokeBehaviorCommand('closureControl', 'ClosureControl.moveTo', {
        position: ClosureControl.TargetPosition.MoveToFullyOpen,
      });
      expect(timedDevice.getMainState()).toBe(ClosureControl.MainState.Moving);

      await vi.advanceTimersByTimeAsync(1000);
      expect(timedDevice.getAttribute(ClosureControl.id, 'overallCurrentState')).toEqual({
        position: ClosureControl.CurrentPosition.FullyOpened,
        latch: false,
        speed: ThreeLevelAuto.Auto,
        secureState: false,
      });
      expect(movementCompleted).toHaveBeenCalledTimes(1);

      // A latch-only MoveTo with no prior OverallTargetState to carry a position value forward falls back to
      // OverallCurrentState's own position once the movement completes.
      movementCompleted.mockClear();
      await timedDevice.setAttribute(ClosureControl.id, 'overallTargetState', null);
      await timedDevice.invokeBehaviorCommand('closureControl', 'ClosureControl.moveTo', {
        latch: true,
      });
      expect(timedDevice.getMainState()).toBe(ClosureControl.MainState.Moving);

      await vi.advanceTimersByTimeAsync(1000);
      expect(timedDevice.getAttribute(ClosureControl.id, 'overallCurrentState')).toEqual({
        position: ClosureControl.CurrentPosition.FullyOpened,
        latch: true,
        speed: ThreeLevelAuto.Auto,
        secureState: true,
      });
      expect(movementCompleted).toHaveBeenCalledTimes(1);

      // An explicit null position inherited from OverallTargetState (as left by e.g. setPartiallyOpened()) is
      // treated the same as an absent one: it also falls back to OverallCurrentState's own position.
      movementCompleted.mockClear();
      await timedDevice.setAttribute(ClosureControl.id, 'overallTargetState', { position: null, latch: true, speed: ThreeLevelAuto.Auto });
      await timedDevice.invokeBehaviorCommand('closureControl', 'ClosureControl.moveTo', {
        latch: false,
      });
      expect(timedDevice.getMainState()).toBe(ClosureControl.MainState.Moving);

      await vi.advanceTimersByTimeAsync(1000);
      expect(timedDevice.getAttribute(ClosureControl.id, 'overallCurrentState')).toEqual({
        position: ClosureControl.CurrentPosition.FullyOpened,
        latch: false,
        speed: ThreeLevelAuto.Auto,
        secureState: false,
      });
      expect(movementCompleted).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  test('simulate Calibrate completion via calibrationDuration', async () => {
    const timedDevice = new Closure('Closure Calibration Timed Test Device', 'CLCALTIMED', { calibration: true, calibrationDuration: 1000 });
    expect(await addDevice(server, timedDevice)).toBeTruthy();

    // The completion timer is a plain setTimeout under the hood (see closure.ts), so fake timers let this fire
    // deterministically without waiting out the real 1s duration.
    vi.useFakeTimers();
    try {
      await timedDevice.invokeBehaviorCommand('closureControl', 'ClosureControl.calibrate', {});
      expect(timedDevice.getMainState()).toBe(ClosureControl.MainState.Calibrating);
      expect(timedDevice.getAttribute(ClosureControl.id, 'countdownTime')).toBe(1);

      await vi.advanceTimersByTimeAsync(1000);
      expect(timedDevice.getMainState()).toBe(ClosureControl.MainState.Stopped);
      expect(timedDevice.getAttribute(ClosureControl.id, 'countdownTime')).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  test('create and add a closure device with two panels', async () => {
    venetianBlind = new Closure('Venetian Blind Test Device', 'CL654321', {
      tagList: [getSemtag(ClosureTag.Covering), getSemtag(ClosureCoveringTag.Venetian)],
    });
    venetianBlind.addPanel('Lift', [getSemtag(ClosurePanelTag.Lift)], 'lift', { motionLatching: true, speed: true });
    venetianBlind.addPanel('Tilt', [getSemtag(ClosurePanelTag.Tilt)], 'tilt', {
      resolution: 2,
      stepValue: 100,
      motionLatching: true,
      speed: true,
      latchControlModes: { remoteLatching: false, remoteUnlatching: true },
    });

    expect(venetianBlind.getChildEndpointByOriginalId('Lift')).toBeDefined();
    expect(venetianBlind.getChildEndpointByOriginalId('Lift')?.hasClusterServer(ClosureDimension.id)).toBeTruthy();
    expect(venetianBlind.getChildEndpointByOriginalId('Tilt')).toBeDefined();
    expect(venetianBlind.getChildEndpointByOriginalId('Tilt')?.getClusterServerOptions(ClosureDimension.id)).toMatchObject({
      currentState: { position: 0, latch: true, speed: ThreeLevelAuto.Auto },
      targetState: { position: 0, latch: true, speed: ThreeLevelAuto.Auto },
      resolution: 2,
      stepValue: 100,
      latchControlModes: { remoteLatching: false, remoteUnlatching: true },
    });

    expect(await addDevice(server, venetianBlind)).toBeTruthy();
    expect(venetianBlind.getChildEndpointByOriginalId('Lift')?.getAttribute('Descriptor', 'tagList')).toEqual([
      { mfgCode: null, namespaceId: ClosurePanelTag.Lift.namespaceId, tag: ClosurePanelTag.Lift.tag },
    ]);
    expect(venetianBlind.getChildEndpointByOriginalId('Tilt')?.getAttribute('Descriptor', 'tagList')).toEqual([
      { mfgCode: null, namespaceId: ClosurePanelTag.Tilt.namespaceId, tag: ClosurePanelTag.Tilt.tag },
    ]);
  });

  test('invoke closure dimension setTarget validation', async () => {
    const liftPanel = venetianBlind.getChildEndpointByOriginalId('Lift');
    const tiltPanel = venetianBlind.getChildEndpointByOriginalId('Tilt');
    expect(liftPanel).toBeDefined();
    expect(tiltPanel).toBeDefined();
    if (!liftPanel || !tiltPanel) return;

    // SetTarget requires at least one of position, latch, or speed (Matter spec §5.5.8.1, O.a+ choice conformance).
    await expect(liftPanel.invokeBehaviorCommand('closureDimension', 'ClosureDimension.setTarget', {})).rejects.toMatchObject({ code: Status.InvalidCommand });

    // percent100ths is constrained to 0-10000 (Matter spec §5.5.8.1.1).
    await expect(liftPanel.invokeBehaviorCommand('closureDimension', 'ClosureDimension.setTarget', { position: 10001 })).rejects.toMatchObject({
      code: Status.ConstraintError,
    });

    // ThreeLevelAutoEnum only defines Auto, Low, Medium and High (Matter spec §5.5.8.1.3).
    await expect(liftPanel.invokeBehaviorCommand('closureDimension', 'ClosureDimension.setTarget', { speed: 5 })).rejects.toMatchObject({
      code: Status.ConstraintError,
    });

    // The Lift panel defaults to a latched CurrentState, so a position change without an explicit latch: false
    // SHALL be rejected (Matter spec §5.5.8.1.4).
    await expect(liftPanel.invokeBehaviorCommand('closureDimension', 'ClosureDimension.setTarget', { position: 3000 })).rejects.toMatchObject({
      code: Status.InvalidInState,
    });
    await liftPanel.invokeBehaviorCommand('closureDimension', 'ClosureDimension.setTarget', { position: 3000, latch: false });
    expect(liftPanel.getAttribute(ClosureDimension.id, 'targetState')).toMatchObject({ position: 3000, latch: false });

    // The Tilt panel's LatchControlModes only allows remote unlatching, so a latch: true request requires manual
    // intervention and SHALL be rejected (Matter spec §5.5.8.1.2).
    await expect(tiltPanel.invokeBehaviorCommand('closureDimension', 'ClosureDimension.setTarget', { latch: true })).rejects.toMatchObject({
      code: Status.InvalidInState,
    });
    await tiltPanel.invokeBehaviorCommand('closureDimension', 'ClosureDimension.setTarget', { latch: false });
    expect(tiltPanel.getAttribute(ClosureDimension.id, 'targetState')).toMatchObject({ latch: false });

    // While the associated ClosureControl MainState is Error, SetTarget SHALL be rejected (Matter spec §5.5.8.1.4).
    await venetianBlind.setAttribute(ClosureControl.id, 'mainState', ClosureControl.MainState.Error);
    await expect(liftPanel.invokeBehaviorCommand('closureDimension', 'ClosureDimension.setTarget', { speed: ThreeLevelAuto.Low })).rejects.toMatchObject({
      code: Status.InvalidInState,
    });
    await venetianBlind.setAttribute(ClosureControl.id, 'mainState', ClosureControl.MainState.Stopped);

    // If all field values in the command match CurrentState, the command SHALL have no effect (Matter spec §5.5.8.1.4).
    await tiltPanel.setAttribute(ClosureDimension.id, 'currentState', { position: 1000, latch: false, speed: ThreeLevelAuto.Low });
    await tiltPanel.setAttribute(ClosureDimension.id, 'targetState', { position: 500, latch: false, speed: ThreeLevelAuto.Auto });
    await tiltPanel.invokeBehaviorCommand('closureDimension', 'ClosureDimension.setTarget', { position: 1000, latch: false, speed: ThreeLevelAuto.Low });
    expect(tiltPanel.getAttribute(ClosureDimension.id, 'targetState')).toEqual({ position: 500, latch: false, speed: ThreeLevelAuto.Auto });
  });

  test('invoke closure dimension step validation', async () => {
    const tiltPanel = venetianBlind.getChildEndpointByOriginalId('Tilt');
    expect(tiltPanel).toBeDefined();
    if (!tiltPanel) return;

    // CurrentState is unlatched here (left over from the previous test), so Step is allowed while MainState is Stopped.
    expect(tiltPanel.getAttribute(ClosureDimension.id, 'currentState')).toMatchObject({ latch: false });

    // While the associated ClosureControl MainState is Error, Step SHALL be rejected (Matter spec §5.5.8.2.4).
    await venetianBlind.setAttribute(ClosureControl.id, 'mainState', ClosureControl.MainState.Error);
    await expect(
      tiltPanel.invokeBehaviorCommand('closureDimension', 'ClosureDimension.step', {
        direction: ClosureDimension.StepDirection.Increase,
        numberOfSteps: 1,
      }),
    ).rejects.toMatchObject({ code: Status.InvalidInState });
    await venetianBlind.setAttribute(ClosureControl.id, 'mainState', ClosureControl.MainState.Stopped);

    await tiltPanel.invokeBehaviorCommand('closureDimension', 'ClosureDimension.step', {
      direction: ClosureDimension.StepDirection.Increase,
      numberOfSteps: 1,
    });
    expect(tiltPanel.getAttribute(ClosureDimension.id, 'targetState')).toMatchObject({ position: 1100 });
  });

  test('device forEachAttribute', () => {
    const attributes: {
      clusterName: string;
      clusterId: number;
      attributeName: string;
      attributeId: number;
      attributeValue: string | number | bigint | boolean | object | null | undefined;
    }[] = [];
    device.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
      if (attributeValue === undefined) return;

      expect(clusterName).toBeDefined();
      expect(typeof clusterName).toBe('string');
      expect(clusterName.length).toBeGreaterThanOrEqual(1);

      expect(clusterId).toBeDefined();
      expect(typeof clusterId).toBe('number');
      expect(clusterId).toBeGreaterThanOrEqual(1);

      expect(attributeName).toBeDefined();
      expect(typeof attributeName).toBe('string');
      expect(attributeName.length).toBeGreaterThanOrEqual(1);

      expect(attributeId).toBeDefined();
      expect(typeof attributeId).toBe('number');
      expect(attributeId).toBeGreaterThanOrEqual(0);

      if (['serverList', 'clientList', 'partsList', 'attributeList', 'acceptedCommandList', 'generatedCommandList'].includes(attributeName)) {
        const sortedAttributeValue = (attributeValue as number[]).toSorted((a, b) => a - b);
        attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue: sortedAttributeValue });
      } else {
        attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue });
      }
    });
    expect(
      attributes
        .map(
          ({ clusterName, clusterId, attributeName, attributeId, attributeValue }) =>
            `${clusterName}(0x${clusterId.toString(16)}).${attributeName}(0x${attributeId.toString(16)})=${stringify(attributeValue, false)}`,
        )
        .toSorted(),
    ).toEqual(
      [
        'closureControl(0x104).acceptedCommandList(0xfff9)=[ 0, 1 ]',
        'closureControl(0x104).attributeList(0xfffb)=[ 0, 1, 2, 3, 4, 5, 65528, 65529, 65531, 65532, 65533 ]',
        'closureControl(0x104).clusterRevision(0xfffd)=1',
        'closureControl(0x104).countdownTime(0x0)=0',
        'closureControl(0x104).currentErrorList(0x2)=[  ]',
        'closureControl(0x104).featureMap(0xfffc)={ positioning: true, motionLatching: true, instantaneous: false, speed: true, ventilation: false, pedestrian: false, calibration: false, protection: false, manuallyOperable: false }',
        'closureControl(0x104).generatedCommandList(0xfff8)=[  ]',
        'closureControl(0x104).latchControlModes(0x5)={ remoteLatching: true, remoteUnlatching: true }',
        'closureControl(0x104).mainState(0x1)=1',
        'closureControl(0x104).overallCurrentState(0x3)={ position: 0, latch: true, speed: 0, secureState: true }',
        'closureControl(0x104).overallTargetState(0x4)={ position: 0, latch: false, speed: 0 }',
        'descriptor(0x1d).acceptedCommandList(0xfff9)=[  ]',
        'descriptor(0x1d).attributeList(0xfffb)=[ 0, 1, 2, 3, 4, 65528, 65529, 65531, 65532, 65533 ]',
        'descriptor(0x1d).clientList(0x2)=[  ]',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 560, revision: 1 }, { deviceType: 17, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: true }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 3, 29, 47, 260 ]',
        'descriptor(0x1d).tagList(0x4)=[ { mfgCode: null, namespaceId: 68, tag: 0, label: undefined } ]',
        'identify(0x3).acceptedCommandList(0xfff9)=[ 0, 64 ]',
        'identify(0x3).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'identify(0x3).clusterRevision(0xfffd)=6',
        'identify(0x3).featureMap(0xfffc)={  }',
        'identify(0x3).generatedCommandList(0xfff8)=[  ]',
        'identify(0x3).identifyTime(0x0)=0',
        'identify(0x3).identifyType(0x1)=0',
        'powerSource(0x2f).acceptedCommandList(0xfff9)=[  ]',
        'powerSource(0x2f).attributeList(0xfffb)=[ 0, 1, 2, 5, 31, 65528, 65529, 65531, 65532, 65533 ]',
        'powerSource(0x2f).clusterRevision(0xfffd)=3',
        "powerSource(0x2f).description(0x2)='AC Power'",
        'powerSource(0x2f).endpointList(0x1f)=[ 2 ]',
        'powerSource(0x2f).featureMap(0xfffc)={ wired: true, battery: false, rechargeable: false, replaceable: false }',
        'powerSource(0x2f).generatedCommandList(0xfff8)=[  ]',
        'powerSource(0x2f).order(0x1)=0',
        'powerSource(0x2f).status(0x0)=1',
        'powerSource(0x2f).wiredCurrentType(0x5)=0',
      ].toSorted(),
    );
  });

  test('start the server node', async () => {
    if (!MATTER_CREATE_ONLY) await startServerNode();
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('stop the server node', async () => {
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
    if (MATTER_CREATE_ONLY) await flushServerNode();
    else await stopServerNode();
  });
});
