/**
 * @file packages/core/vitest/behaviors/windowCoveringServer.test.ts
 * @description This file contains the tests for windowCoveringServer.
 * @author Luca Liguori
 */

const NAME = 'WindowCoveringServer';
const MATTER_PORT = 13300;
const MATTER_CREATE_ONLY = true;

import { WindowCoveringServer } from '@matter/node/behaviors/window-covering';
import { WindowCovering } from '@matter/types/clusters/window-covering';
import { wait, waiter } from '@matterbridge/utils/wait';
import { flushAsync, loggerLogSpy, setupTest } from '@matterbridge/vitest-utils';
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

import { MatterbridgeWindowCoveringServer } from '../../src/behaviors/windowCoveringServer.js';
import { windowCovering } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';
import { expectCommand } from '../vitestUtils.js';

// Setup the test environment
await setupTest(NAME, false);

/*
 * The movement simulation completes on a real timer, so the tests below poll for the completion to become
 * observable with waiter() instead of sleeping for a fixed amount, which on a loaded CI runner can expire before
 * the timer has fired. waiter() rejects on timeout (exitWithReject), so a stuck simulation fails the test.
 */
const MOVEMENT_TIMEOUT = 15000;
const MOVEMENT_INTERVAL = 20;

describe('MatterbridgeWindowCoveringServer', () => {
  let coverLift: MatterbridgeEndpoint;
  let coverLiftTilt: MatterbridgeEndpoint;
  let coverTilt: MatterbridgeEndpoint;

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

  test('Device type: coverLift', async () => {
    coverLift = new MatterbridgeEndpoint(windowCovering, { id: 'coverLift' });
    coverLift.addRequiredClusterServers();
    expect(coverLift).toBeDefined();
    expect(await addDevice(aggregator, coverLift)).toBeTruthy();
  });

  test('Device type: coverLiftTilt', async () => {
    coverLiftTilt = new MatterbridgeEndpoint(windowCovering, { id: 'coverLiftTilt' });
    coverLiftTilt.createDefaultLiftTiltWindowCoveringClusterServer();
    coverLiftTilt.addRequiredClusterServers();
    expect(coverLiftTilt).toBeDefined();
    expect(await addDevice(aggregator, coverLiftTilt)).toBeTruthy();
  });

  test('Device type: coverTilt', async () => {
    // movementDuration > 0 enables the built-in movement simulation, so operationalStatus reflects the direction while moving.
    coverTilt = new MatterbridgeEndpoint(windowCovering, { id: 'coverTilt' });
    coverTilt.createDefaultTiltWindowCoveringClusterServer(5000, WindowCovering.WindowCoveringType.TiltBlindTiltOnly, WindowCovering.EndProductType.InteriorVenetianBlind, 60_000);
    coverTilt.addRequiredClusterServers();
    expect(coverTilt).toBeDefined();
    expect(await addDevice(aggregator, coverTilt)).toBeTruthy();
  });

  test('LiftWindowCovering server', async () => {
    const expectLiftCoverAttributes = (expected: {
      operationalStatus: { global: number; lift: number };
      currentPositionLiftPercent100ths: number;
      targetPositionLiftPercent100ths: number;
    }): void => {
      expect(coverLift.getAttribute(WindowCovering.id, 'operationalStatus')).toEqual(expected.operationalStatus);
      expect(coverLift.getAttribute(WindowCovering.id, 'currentPositionLiftPercent100ths')).toBe(expected.currentPositionLiftPercent100ths);
      expect(coverLift.getAttribute(WindowCovering.id, 'targetPositionLiftPercent100ths')).toBe(expected.targetPositionLiftPercent100ths);
    };

    await expectCommand(coverLift, WindowCovering, 'upOrOpen', undefined, (data) => {
      expect(data.cluster).toBe('windowCovering');
    });
    expectLiftCoverAttributes({
      operationalStatus: { global: WindowCovering.MovementStatus.Stopped, lift: WindowCovering.MovementStatus.Stopped },
      currentPositionLiftPercent100ths: 0,
      targetPositionLiftPercent100ths: 0,
    });

    await expectCommand(coverLift, WindowCovering, 'downOrClose', undefined, (data) => {
      expect(data.cluster).toBe('windowCovering');
    });
    expectLiftCoverAttributes({
      operationalStatus: { global: WindowCovering.MovementStatus.Stopped, lift: WindowCovering.MovementStatus.Stopped },
      currentPositionLiftPercent100ths: 0,
      targetPositionLiftPercent100ths: 10000,
    });

    await expectCommand(coverLift, WindowCovering, 'stopMotion', undefined, (data) => {
      expect(data.cluster).toBe('windowCovering');
    });
    expectLiftCoverAttributes({
      operationalStatus: { global: WindowCovering.MovementStatus.Stopped, lift: WindowCovering.MovementStatus.Stopped },
      currentPositionLiftPercent100ths: 0,
      targetPositionLiftPercent100ths: 10000,
    });

    await expectCommand(coverLift, WindowCovering, 'goToLiftPercentage', { liftPercent100thsValue: 5000 }, (data) => {
      expect(data.cluster).toBe('windowCovering');
    });
    expectLiftCoverAttributes({
      operationalStatus: { global: WindowCovering.MovementStatus.Stopped, lift: WindowCovering.MovementStatus.Stopped },
      currentPositionLiftPercent100ths: 0,
      targetPositionLiftPercent100ths: 5000,
    });
  });

  test('LiftTiltWindowCovering server', async () => {
    const expectLiftTiltCoverAttributes = (expected: {
      operationalStatus: { global: number; lift: number; tilt: number };
      currentPositionLiftPercent100ths: number;
      targetPositionLiftPercent100ths: number;
      currentPositionTiltPercent100ths: number;
      targetPositionTiltPercent100ths: number;
    }): void => {
      expect(coverLiftTilt.getAttribute(WindowCovering.id, 'operationalStatus')).toEqual(expected.operationalStatus);
      expect(coverLiftTilt.getAttribute(WindowCovering.id, 'currentPositionLiftPercent100ths')).toBe(expected.currentPositionLiftPercent100ths);
      expect(coverLiftTilt.getAttribute(WindowCovering.id, 'targetPositionLiftPercent100ths')).toBe(expected.targetPositionLiftPercent100ths);
      expect(coverLiftTilt.getAttribute(WindowCovering.id, 'currentPositionTiltPercent100ths')).toBe(expected.currentPositionTiltPercent100ths);
      expect(coverLiftTilt.getAttribute(WindowCovering.id, 'targetPositionTiltPercent100ths')).toBe(expected.targetPositionTiltPercent100ths);
    };

    await expectCommand(coverLiftTilt, WindowCovering, 'upOrOpen', undefined, (data) => {
      expect(data.cluster).toBe('windowCovering');
    });
    expectLiftTiltCoverAttributes({
      operationalStatus: { global: WindowCovering.MovementStatus.Stopped, lift: WindowCovering.MovementStatus.Stopped, tilt: WindowCovering.MovementStatus.Stopped },
      currentPositionLiftPercent100ths: 0,
      targetPositionLiftPercent100ths: 0,
      currentPositionTiltPercent100ths: 0,
      targetPositionTiltPercent100ths: 0,
    });

    await expectCommand(coverLiftTilt, WindowCovering, 'downOrClose', undefined, (data) => {
      expect(data.cluster).toBe('windowCovering');
    });
    expectLiftTiltCoverAttributes({
      operationalStatus: { global: WindowCovering.MovementStatus.Stopped, lift: WindowCovering.MovementStatus.Stopped, tilt: WindowCovering.MovementStatus.Stopped },
      currentPositionLiftPercent100ths: 0,
      targetPositionLiftPercent100ths: 10000,
      currentPositionTiltPercent100ths: 0,
      targetPositionTiltPercent100ths: 10000,
    });

    await expectCommand(coverLiftTilt, WindowCovering, 'stopMotion', undefined, (data) => {
      expect(data.cluster).toBe('windowCovering');
    });
    expectLiftTiltCoverAttributes({
      operationalStatus: { global: WindowCovering.MovementStatus.Stopped, lift: WindowCovering.MovementStatus.Stopped, tilt: WindowCovering.MovementStatus.Stopped },
      currentPositionLiftPercent100ths: 0,
      targetPositionLiftPercent100ths: 10000,
      currentPositionTiltPercent100ths: 0,
      targetPositionTiltPercent100ths: 10000,
    });

    await expectCommand(coverLiftTilt, WindowCovering, 'goToLiftPercentage', { liftPercent100thsValue: 5000 }, (data) => {
      expect(data.cluster).toBe('windowCovering');
    });
    expectLiftTiltCoverAttributes({
      operationalStatus: { global: WindowCovering.MovementStatus.Stopped, lift: WindowCovering.MovementStatus.Stopped, tilt: WindowCovering.MovementStatus.Stopped },
      currentPositionLiftPercent100ths: 0,
      targetPositionLiftPercent100ths: 5000,
      currentPositionTiltPercent100ths: 0,
      targetPositionTiltPercent100ths: 10000,
    });

    await expectCommand(coverLiftTilt, WindowCovering, 'goToTiltPercentage', { tiltPercent100thsValue: 5000 }, (data) => {
      expect(data.cluster).toBe('windowCovering');
    });
    expectLiftTiltCoverAttributes({
      operationalStatus: { global: WindowCovering.MovementStatus.Stopped, lift: WindowCovering.MovementStatus.Stopped, tilt: WindowCovering.MovementStatus.Stopped },
      currentPositionLiftPercent100ths: 0,
      targetPositionLiftPercent100ths: 5000,
      currentPositionTiltPercent100ths: 0,
      targetPositionTiltPercent100ths: 5000,
    });
  });

  test('TiltWindowCovering server', async () => {
    // A Tilt-only server has no lift field in operationalStatus (Matter 1.6.0 Application Cluster Spec 5.3.5.3.2),
    // and global must still track the tilt movement while the covering is moving.
    // Each command is invoked once: expectCommand registers a handler per call and only the first handler
    // registered for a command name is executed.
    const expectTiltCoverAttributes = (expected: {
      operationalStatus: { global: number; tilt: number };
      currentPositionTiltPercent100ths: number;
      targetPositionTiltPercent100ths: number;
    }): void => {
      expect(coverTilt.getAttribute(WindowCovering.id, 'operationalStatus')).toEqual(expected.operationalStatus);
      expect(coverTilt.getAttribute(WindowCovering.id, 'currentPositionTiltPercent100ths')).toBe(expected.currentPositionTiltPercent100ths);
      expect(coverTilt.getAttribute(WindowCovering.id, 'targetPositionTiltPercent100ths')).toBe(expected.targetPositionTiltPercent100ths);
    };

    expectTiltCoverAttributes({
      operationalStatus: { global: WindowCovering.MovementStatus.Stopped, tilt: WindowCovering.MovementStatus.Stopped },
      currentPositionTiltPercent100ths: 5000,
      targetPositionTiltPercent100ths: 5000,
    });

    await expectCommand(coverTilt, WindowCovering, 'upOrOpen', undefined, (data) => {
      expect(data.cluster).toBe('windowCovering');
    });
    expectTiltCoverAttributes({
      operationalStatus: { global: WindowCovering.MovementStatus.Opening, tilt: WindowCovering.MovementStatus.Opening },
      currentPositionTiltPercent100ths: 5000,
      targetPositionTiltPercent100ths: 0,
    });

    await expectCommand(coverTilt, WindowCovering, 'downOrClose', undefined, (data) => {
      expect(data.cluster).toBe('windowCovering');
    });
    expectTiltCoverAttributes({
      operationalStatus: { global: WindowCovering.MovementStatus.Closing, tilt: WindowCovering.MovementStatus.Closing },
      currentPositionTiltPercent100ths: 5000,
      targetPositionTiltPercent100ths: 10000,
    });

    await expectCommand(coverTilt, WindowCovering, 'goToTiltPercentage', { tiltPercent100thsValue: 2000 }, (data) => {
      expect(data.cluster).toBe('windowCovering');
    });
    expectTiltCoverAttributes({
      operationalStatus: { global: WindowCovering.MovementStatus.Opening, tilt: WindowCovering.MovementStatus.Opening },
      currentPositionTiltPercent100ths: 5000,
      targetPositionTiltPercent100ths: 2000,
    });

    // StopMotion also cancels the pending movement simulation, so no timer outlives the test.
    await expectCommand(coverTilt, WindowCovering, 'stopMotion', undefined, (data) => {
      expect(data.cluster).toBe('windowCovering');
    });
    expectTiltCoverAttributes({
      operationalStatus: { global: WindowCovering.MovementStatus.Stopped, tilt: WindowCovering.MovementStatus.Stopped },
      currentPositionTiltPercent100ths: 5000,
      targetPositionTiltPercent100ths: 5000,
    });
  });

  test('invoke MatterbridgeWindowCoveringServer commands', async () => {
    const coverLiftServer = MatterbridgeWindowCoveringServer.with(WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift);
    // expect(coverLift.behaviors.has(WindowCoveringServer)).toBeTruthy();
    expect(coverLift.behaviors.has(coverLiftServer)).toBeTruthy();
    expect(coverLift.behaviors.elementsOf(coverLiftServer).commands.has('upOrOpen')).toBeTruthy();
    expect(coverLift.behaviors.elementsOf(coverLiftServer).commands.has('downOrClose')).toBeTruthy();
    expect(coverLift.behaviors.elementsOf(coverLiftServer).commands.has('stopMotion')).toBeTruthy();
    expect(coverLift.behaviors.elementsOf(coverLiftServer).commands.has('goToLiftPercentage')).toBeTruthy();
    expect(coverLift.behaviors.elementsOf(coverLiftServer).commands.has('goToTiltPercentage')).toBeFalsy();
    expect((coverLift.stateOf(coverLiftServer) as any).acceptedCommandList).toEqual([0, 1, 2, 5]);
    expect((coverLift.stateOf(coverLiftServer) as any).generatedCommandList).toEqual([]);
    await coverLift.invokeBehaviorCommand('windowCovering', 'upOrOpen');
    await coverLift.invokeBehaviorCommand('windowCovering', 'downOrClose');
    await coverLift.invokeBehaviorCommand('windowCovering', 'stopMotion');
    await coverLift.invokeBehaviorCommand('windowCovering', 'goToLiftPercentage', { liftPercent100thsValue: 5000 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeWindowCoveringServer: opening cover (endpoint ${coverLift.id}.${coverLift.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeWindowCoveringServer: closing cover (endpoint ${coverLift.id}.${coverLift.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeWindowCoveringServer: stopping cover (endpoint ${coverLift.id}.${coverLift.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `MatterbridgeWindowCoveringServer: setting cover lift percentage to 5000 (endpoint ${coverLift.id}.${coverLift.number})`,
    );
  });

  test('invoke MatterbridgeWindowCoveringServer with tilt commands', async () => {
    const coverLiftTiltServer = MatterbridgeWindowCoveringServer.with(
      WindowCovering.Feature.Lift,
      WindowCovering.Feature.PositionAwareLift,
      WindowCovering.Feature.Tilt,
      WindowCovering.Feature.PositionAwareTilt,
    );
    expect(coverLiftTilt.behaviors.has(WindowCoveringServer)).toBeTruthy();
    expect(coverLiftTilt.behaviors.has(coverLiftTiltServer)).toBeTruthy();
    expect(coverLiftTilt.behaviors.elementsOf(coverLiftTiltServer).commands.has('upOrOpen')).toBeTruthy();
    expect(coverLiftTilt.behaviors.elementsOf(coverLiftTiltServer).commands.has('downOrClose')).toBeTruthy();
    expect(coverLiftTilt.behaviors.elementsOf(coverLiftTiltServer).commands.has('stopMotion')).toBeTruthy();
    expect(coverLiftTilt.behaviors.elementsOf(coverLiftTiltServer).commands.has('goToLiftPercentage')).toBeTruthy();
    expect(coverLiftTilt.behaviors.elementsOf(coverLiftTiltServer).commands.has('goToTiltPercentage')).toBeTruthy();
    expect((coverLiftTilt.stateOf(coverLiftTiltServer) as any).acceptedCommandList).toEqual([0, 1, 2, 5, 8]);
    expect((coverLiftTilt.stateOf(coverLiftTiltServer) as any).generatedCommandList).toEqual([]);
    await coverLiftTilt.invokeBehaviorCommand('windowCovering', 'upOrOpen');
    await coverLiftTilt.invokeBehaviorCommand('windowCovering', 'downOrClose');
    await coverLiftTilt.invokeBehaviorCommand('windowCovering', 'stopMotion');
    await coverLiftTilt.invokeBehaviorCommand('windowCovering', 'goToLiftPercentage', { liftPercent100thsValue: 5000 });
    await coverLiftTilt.invokeBehaviorCommand('windowCovering', 'goToTiltPercentage', { tiltPercent100thsValue: 5000 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeWindowCoveringServer: opening cover (endpoint ${coverLiftTilt.id}.${coverLiftTilt.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeWindowCoveringServer: closing cover (endpoint ${coverLiftTilt.id}.${coverLiftTilt.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeWindowCoveringServer: stopping cover (endpoint ${coverLiftTilt.id}.${coverLiftTilt.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `MatterbridgeWindowCoveringServer: setting cover lift percentage to 5000 (endpoint ${coverLiftTilt.id}.${coverLiftTilt.number})`,
    );
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `MatterbridgeWindowCoveringServer: setting cover tilt percentage to 5000 (endpoint ${coverLiftTilt.id}.${coverLiftTilt.number})`,
    );
  });

  test('simulate WindowCovering movement completion via movementDuration', async () => {
    const timedCover = new MatterbridgeEndpoint(windowCovering, { id: 'WindowCoverTimed' });
    // movementDuration must stay comfortably longer than a command round trip, so the mid-movement assertions below
    // are not racing the completion timer on a slow runner.
    timedCover.createDefaultLiftTiltWindowCoveringClusterServer(0, 0, undefined, undefined, 1000);
    timedCover.addRequiredClusterServers();
    expect(await addDevice(aggregator, timedCover)).toBeTruthy();

    await timedCover.invokeBehaviorCommand('windowCovering', 'goToLiftPercentage', { liftPercent100thsValue: 10000 });
    expect(timedCover.getAttribute(WindowCovering, 'operationalStatus')).toMatchObject({
      global: WindowCovering.MovementStatus.Closing,
      lift: WindowCovering.MovementStatus.Closing,
    });
    expect(timedCover.getAttribute(WindowCovering, 'currentPositionLiftPercent100ths')).toBe(0);

    await waiter('lift movement complete', () => timedCover.getAttribute(WindowCovering, 'currentPositionLiftPercent100ths') === 10000, true, MOVEMENT_TIMEOUT, MOVEMENT_INTERVAL);
    expect(timedCover.getAttribute(WindowCovering, 'currentPositionLiftPercent100ths')).toBe(10000);
    expect(timedCover.getAttribute(WindowCovering, 'operationalStatus')).toMatchObject({
      global: WindowCovering.MovementStatus.Stopped,
      lift: WindowCovering.MovementStatus.Stopped,
    });

    await timedCover.invokeBehaviorCommand('windowCovering', 'goToTiltPercentage', { tiltPercent100thsValue: 10000 });
    expect(timedCover.getAttribute(WindowCovering, 'operationalStatus')).toMatchObject({
      global: WindowCovering.MovementStatus.Closing,
      tilt: WindowCovering.MovementStatus.Closing,
    });

    await waiter('tilt movement complete', () => timedCover.getAttribute(WindowCovering, 'currentPositionTiltPercent100ths') === 10000, true, MOVEMENT_TIMEOUT, MOVEMENT_INTERVAL);
    expect(timedCover.getAttribute(WindowCovering, 'currentPositionTiltPercent100ths')).toBe(10000);
    expect(timedCover.getAttribute(WindowCovering, 'operationalStatus')).toMatchObject({
      global: WindowCovering.MovementStatus.Stopped,
      tilt: WindowCovering.MovementStatus.Stopped,
    });

    // StopMotion cancels an in-flight simulation before it completes and settles target = current.
    await timedCover.invokeBehaviorCommand('windowCovering', 'goToLiftPercentage', { liftPercent100thsValue: 0 });
    expect(timedCover.getAttribute(WindowCovering, 'operationalStatus')).toMatchObject({ lift: WindowCovering.MovementStatus.Opening });
    await timedCover.invokeBehaviorCommand('windowCovering', 'stopMotion', undefined, () => timedCover.getAttribute(WindowCovering, 'targetPositionLiftPercent100ths') === 10000);
    expect(timedCover.getAttribute(WindowCovering, 'currentPositionLiftPercent100ths')).toBe(10000);
    expect(timedCover.getAttribute(WindowCovering, 'targetPositionLiftPercent100ths')).toBe(10000);
    expect(timedCover.getAttribute(WindowCovering, 'operationalStatus')).toMatchObject({
      global: WindowCovering.MovementStatus.Stopped,
      lift: WindowCovering.MovementStatus.Stopped,
    });
  });

  test('invoke MatterbridgeWindowCoveringServer with tilt-only commands', async () => {
    const coverTiltOnly = new MatterbridgeEndpoint(windowCovering, { id: 'WindowCoverTiltOnly' });
    coverTiltOnly.createDefaultTiltWindowCoveringClusterServer();
    coverTiltOnly.addRequiredClusterServers();
    expect(await addDevice(aggregator, coverTiltOnly)).toBeTruthy();

    const coverTiltOnlyServer = MatterbridgeWindowCoveringServer.with(WindowCovering.Feature.Tilt, WindowCovering.Feature.PositionAwareTilt);
    expect(coverTiltOnly.behaviors.has(coverTiltOnlyServer)).toBeTruthy();
    expect(coverTiltOnly.behaviors.elementsOf(coverTiltOnlyServer).commands.has('upOrOpen')).toBeTruthy();
    expect(coverTiltOnly.behaviors.elementsOf(coverTiltOnlyServer).commands.has('downOrClose')).toBeTruthy();
    expect(coverTiltOnly.behaviors.elementsOf(coverTiltOnlyServer).commands.has('stopMotion')).toBeTruthy();
    expect(coverTiltOnly.behaviors.elementsOf(coverTiltOnlyServer).commands.has('goToLiftPercentage')).toBeFalsy();
    expect(coverTiltOnly.behaviors.elementsOf(coverTiltOnlyServer).commands.has('goToTiltPercentage')).toBeTruthy();

    // upOrOpen/downOrClose on a tilt-only server (no Lift feature) exercise the lift-feature-absent branch of the
    // per-axis movement simulation gate, since only the tilt half of each command applies here.
    await coverTiltOnly.invokeBehaviorCommand('windowCovering', 'upOrOpen');
    await coverTiltOnly.invokeBehaviorCommand('windowCovering', 'downOrClose');
    await coverTiltOnly.invokeBehaviorCommand('windowCovering', 'stopMotion');
    await coverTiltOnly.invokeBehaviorCommand('windowCovering', 'goToTiltPercentage', { tiltPercent100thsValue: 5000 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeWindowCoveringServer: opening cover (endpoint ${coverTiltOnly.id}.${coverTiltOnly.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeWindowCoveringServer: closing cover (endpoint ${coverTiltOnly.id}.${coverTiltOnly.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeWindowCoveringServer: stopping cover (endpoint ${coverTiltOnly.id}.${coverTiltOnly.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `MatterbridgeWindowCoveringServer: setting cover tilt percentage to 5000 (endpoint ${coverTiltOnly.id}.${coverTiltOnly.number})`,
    );
  });

  test('WindowCovering stopMotion resets only the axis the server supports when movementDuration is enabled', async () => {
    // A lift-only server (no Tilt feature) exercises the tilt-feature-absent branch of stopMotion's per-axis
    // reset; a tilt-only server (no Lift feature) exercises the lift-feature-absent branch.
    const liftOnlyTimed = new MatterbridgeEndpoint(windowCovering, { id: 'WindowCoverLiftOnlyTimed' });
    liftOnlyTimed.createDefaultWindowCoveringClusterServer();
    liftOnlyTimed.addRequiredClusterServers();
    expect(await addDevice(aggregator, liftOnlyTimed)).toBeTruthy();
    await liftOnlyTimed.setAttribute(MatterbridgeWindowCoveringServer, 'movementDuration', 1000);
    await liftOnlyTimed.invokeBehaviorCommand('windowCovering', 'goToLiftPercentage', { liftPercent100thsValue: 10000 });
    expect(liftOnlyTimed.getAttribute(WindowCovering, 'operationalStatus')).toMatchObject({
      global: WindowCovering.MovementStatus.Closing,
      lift: WindowCovering.MovementStatus.Closing,
    });
    await liftOnlyTimed.invokeBehaviorCommand('windowCovering', 'stopMotion');
    expect(liftOnlyTimed.getAttribute(WindowCovering, 'targetPositionLiftPercent100ths')).toBe(0);
    expect(liftOnlyTimed.getAttribute(WindowCovering, 'operationalStatus')).toEqual({
      global: WindowCovering.MovementStatus.Stopped,
      lift: WindowCovering.MovementStatus.Stopped,
    });

    const tiltOnlyTimed = new MatterbridgeEndpoint(windowCovering, { id: 'WindowCoverTiltOnlyTimed' });
    tiltOnlyTimed.createDefaultTiltWindowCoveringClusterServer();
    tiltOnlyTimed.addRequiredClusterServers();
    expect(await addDevice(aggregator, tiltOnlyTimed)).toBeTruthy();
    await tiltOnlyTimed.setAttribute(MatterbridgeWindowCoveringServer, 'movementDuration', 1000);
    await tiltOnlyTimed.invokeBehaviorCommand('windowCovering', 'goToTiltPercentage', { tiltPercent100thsValue: 10000 });
    expect(tiltOnlyTimed.getAttribute(WindowCovering, 'operationalStatus')).toMatchObject({
      global: WindowCovering.MovementStatus.Closing,
      tilt: WindowCovering.MovementStatus.Closing,
    });
    await tiltOnlyTimed.invokeBehaviorCommand('windowCovering', 'stopMotion');
    expect(tiltOnlyTimed.getAttribute(WindowCovering, 'targetPositionTiltPercent100ths')).toBe(0);
    expect(tiltOnlyTimed.getAttribute(WindowCovering, 'operationalStatus')).toEqual({
      global: WindowCovering.MovementStatus.Stopped,
      tilt: WindowCovering.MovementStatus.Stopped,
    });
  });

  test('WindowCovering movement simulation edge cases', async () => {
    const edgeCover = new MatterbridgeEndpoint(windowCovering, { id: 'WindowCoverEdge' });
    edgeCover.createDefaultLiftTiltWindowCoveringClusterServer(0, 0, undefined, undefined, 1000);
    edgeCover.addRequiredClusterServers();
    expect(await addDevice(aggregator, edgeCover)).toBeTruthy();

    // Already-at-target: goToLiftPercentage/goToTiltPercentage to the current position (0) computes Stopped and
    // never schedules a completion timer.
    await edgeCover.invokeBehaviorCommand('windowCovering', 'goToLiftPercentage', { liftPercent100thsValue: 0 });
    expect(edgeCover.getAttribute(WindowCovering, 'operationalStatus')).toEqual({
      global: WindowCovering.MovementStatus.Stopped,
      lift: WindowCovering.MovementStatus.Stopped,
      tilt: WindowCovering.MovementStatus.Stopped,
    });
    await edgeCover.invokeBehaviorCommand('windowCovering', 'goToTiltPercentage', { tiltPercent100thsValue: 0 });
    expect(edgeCover.getAttribute(WindowCovering, 'operationalStatus')).toEqual({
      global: WindowCovering.MovementStatus.Stopped,
      lift: WindowCovering.MovementStatus.Stopped,
      tilt: WindowCovering.MovementStatus.Stopped,
    });

    // A null target (an out-of-band value the real Matter command flow never produces, since both fields are
    // mandatory non-nullable numbers, but invokeBehaviorCommand's loosely-typed test-only overload allows forcing
    // it) leaves the simulation untouched: neither #startLiftMovement nor #startTiltMovement is invoked.
    await edgeCover.invokeBehaviorCommand('windowCovering', 'goToLiftPercentage', { liftPercent100thsValue: null });
    expect(edgeCover.getAttribute(WindowCovering, 'targetPositionLiftPercent100ths')).toBeNull();
    expect(edgeCover.getAttribute(WindowCovering, 'operationalStatus')).toEqual({
      global: WindowCovering.MovementStatus.Stopped,
      lift: WindowCovering.MovementStatus.Stopped,
      tilt: WindowCovering.MovementStatus.Stopped,
    });
    await edgeCover.invokeBehaviorCommand('windowCovering', 'goToTiltPercentage', { tiltPercent100thsValue: null });
    expect(edgeCover.getAttribute(WindowCovering, 'targetPositionTiltPercent100ths')).toBeNull();
    expect(edgeCover.getAttribute(WindowCovering, 'operationalStatus')).toEqual({
      global: WindowCovering.MovementStatus.Stopped,
      lift: WindowCovering.MovementStatus.Stopped,
      tilt: WindowCovering.MovementStatus.Stopped,
    });

    // Simulate operationalStatus becoming unreadable exactly when a completion handler re-reads the sibling axis
    // (see the `this.state` transaction-context comment in windowCoveringServer.ts): the handler falls back to
    // Stopped for that axis instead of propagating the missing value.
    //
    // Nulling out every 'operationalStatus' read while nullOperationalStatus is true (instead of consuming a single
    // mocked call) avoids depending on the exact order of getAttribute calls made during the movement, which was
    // flaky: unrelated calls (e.g. currentPositionLiftPercent100ths) could consume a one-shot mock before the
    // completion handler's own read did.
    let nullOperationalStatus = false;
    const originalGetAttribute = edgeCover.getAttribute.bind(edgeCover);
    const getAttributeSpy = vi.spyOn(edgeCover, 'getAttribute').mockImplementation((cluster: unknown, attribute: unknown) => {
      if (attribute === 'operationalStatus' && nullOperationalStatus) return null;
      return originalGetAttribute(cluster as never, attribute as never);
    });
    try {
      await edgeCover.invokeBehaviorCommand('windowCovering', 'goToLiftPercentage', { liftPercent100thsValue: 10000 });
      nullOperationalStatus = true;
      await waiter('lift movement complete', () => originalGetAttribute(WindowCovering, 'currentPositionLiftPercent100ths') === 10000, true, MOVEMENT_TIMEOUT, MOVEMENT_INTERVAL);
      nullOperationalStatus = false;
      expect(edgeCover.getAttribute(WindowCovering, 'currentPositionLiftPercent100ths')).toBe(10000);
      expect(edgeCover.getAttribute(WindowCovering, 'operationalStatus')).toEqual({
        global: WindowCovering.MovementStatus.Stopped,
        lift: WindowCovering.MovementStatus.Stopped,
        tilt: WindowCovering.MovementStatus.Stopped,
      });

      await edgeCover.invokeBehaviorCommand('windowCovering', 'goToTiltPercentage', { tiltPercent100thsValue: 10000 });
      nullOperationalStatus = true;
      await waiter('tilt movement complete', () => originalGetAttribute(WindowCovering, 'currentPositionTiltPercent100ths') === 10000, true, MOVEMENT_TIMEOUT, MOVEMENT_INTERVAL);
      nullOperationalStatus = false;
      expect(edgeCover.getAttribute(WindowCovering, 'currentPositionTiltPercent100ths')).toBe(10000);
      expect(edgeCover.getAttribute(WindowCovering, 'operationalStatus')).toEqual({
        global: WindowCovering.MovementStatus.Stopped,
        lift: WindowCovering.MovementStatus.Stopped,
        tilt: WindowCovering.MovementStatus.Stopped,
      });
    } finally {
      getAttributeSpy.mockRestore();
    }
  });

  test('a command invoked while the behavior lock is held waits for it instead of failing', async () => {
    // The movement simulation completes in a timer callback that runs with `{ lock: true }`, so a command can
    // legitimately arrive while another transaction holds the behavior lock. invokeBehaviorCommand mirrors the real
    // invoke path and takes the lock asynchronously, so this waits instead of throwing a synchronous-transaction-conflict.
    const lockCover = new MatterbridgeEndpoint(windowCovering, { id: 'WindowCoverLock' });
    lockCover.createDefaultLiftTiltWindowCoveringClusterServer();
    lockCover.addRequiredClusterServers();
    expect(await addDevice(aggregator, lockCover)).toBeTruthy();

    // Hold the windowCovering behavior lock in a separate transaction for longer than the command needs to reach
    // its first state write.
    const holder = lockCover.act(async (agent) => {
      const transaction = agent.context.transaction;
      transaction.addResourcesSync((agent as unknown as Record<string, object>)['windowCovering']);
      transaction.beginSync();
      await wait(300);
    });
    await flushAsync(3, 10, 0);

    await lockCover.invokeBehaviorCommand('windowCovering', 'goToLiftPercentage', { liftPercent100thsValue: 5000 });
    await holder;
    expect(lockCover.getAttribute(WindowCovering, 'targetPositionLiftPercent100ths')).toBe(5000);
  });

  test('WindowCovering syncs currentPositionLift/TiltPercentage from the Percent100ths attributes, including back to null', async () => {
    const percentageCover = new MatterbridgeEndpoint(windowCovering, { id: 'WindowCoverPercentage' });
    percentageCover.createDefaultLiftTiltWindowCoveringClusterServer();
    percentageCover.addRequiredClusterServers();
    expect(await addDevice(aggregator, percentageCover)).toBeTruthy();

    await percentageCover.setAttribute(WindowCovering, 'currentPositionLiftPercent100ths', 5000);
    expect(percentageCover.getAttribute(WindowCovering, 'currentPositionLiftPercentage')).toBe(50);
    await percentageCover.setAttribute(WindowCovering, 'currentPositionLiftPercent100ths', null);
    expect(percentageCover.getAttribute(WindowCovering, 'currentPositionLiftPercentage')).toBeNull();

    await percentageCover.setAttribute(WindowCovering, 'currentPositionTiltPercent100ths', 5000);
    expect(percentageCover.getAttribute(WindowCovering, 'currentPositionTiltPercentage')).toBe(50);
    await percentageCover.setAttribute(WindowCovering, 'currentPositionTiltPercent100ths', null);
    expect(percentageCover.getAttribute(WindowCovering, 'currentPositionTiltPercentage')).toBeNull();
  });
});
