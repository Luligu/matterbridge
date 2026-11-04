/**
 * @file packages/core/buntest/behaviors/windowCoveringServer.test.ts
 * @description This file contains the bun tests for windowCoveringServer.
 * @author Luca Liguori
 */

const NAME = 'WindowCoveringServer';
const MATTER_PORT = 13300;

import { afterEach, describe, expect, spyOn, test, vi } from 'bun:test';

import { WindowCoveringServer } from '@matter/node/behaviors/window-covering';
import { WindowCovering } from '@matter/types/clusters/window-covering';
import { flushAsync } from '@matterbridge/test-utils';
import { addBridgedDevice, aggregator } from '@matterbridge/test-utils/buntest/matter';
import { loggerLogSpy, setupTest } from '@matterbridge/test-utils/buntest/setup';
import { wait } from '@matterbridge/utils/wait';
import { LogLevel } from 'node-ansi-logger';

import { MatterbridgeWindowCoveringServer } from '../../src/behaviors/windowCoveringServer.js';
import { windowCovering } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';
import { advanceTimersByTimeAsync, expectCommand, useServerNode } from '../bunUtils.js';

await setupTest(NAME, false);

const { MovementStatus } = WindowCovering;
const { Stopped, Opening, Closing } = MovementStatus;
const MOVEMENT_DURATION = 1000;
type Command = 'upOrOpen' | 'downOrClose' | 'stopMotion' | 'goToLiftPercentage' | 'goToTiltPercentage';
type Attribute =
  | 'operationalStatus'
  | 'currentPositionLiftPercent100ths'
  | 'targetPositionLiftPercent100ths'
  | 'currentPositionTiltPercent100ths'
  | 'targetPositionTiltPercent100ths';
const requestOf: Record<Command, Record<string, number> | undefined> = {
  upOrOpen: undefined,
  downOrClose: undefined,
  stopMotion: undefined,
  goToLiftPercentage: { liftPercent100thsValue: 5000 },
  goToTiltPercentage: { tiltPercent100thsValue: 5000 },
};

/**
 * Creates and adds a window covering.
 *
 * @param {string} id - The endpoint id.
 * @param {(endpoint: MatterbridgeEndpoint) => void} [configure] - Creates the WindowCovering cluster server (default: the required lift server).
 * @returns {Promise<MatterbridgeEndpoint>} The added cover.
 */
async function addCover(id: string, configure?: (endpoint: MatterbridgeEndpoint) => void): Promise<MatterbridgeEndpoint> {
  const cover = new MatterbridgeEndpoint(windowCovering, { id });
  configure?.(cover);
  cover.addRequiredClusterServers();
  expect(await addBridgedDevice(aggregator, cover, 0, 0, 0, 0)).toBeTruthy();
  return cover;
}

/**
 * Reads WindowCovering attributes.
 *
 * @param {MatterbridgeEndpoint} cover - The cover.
 * @param {Attribute[]} names - The attributes to read.
 * @returns {Record<string, unknown>} The values by name.
 */
const read = (cover: MatterbridgeEndpoint, ...names: Attribute[]): Record<string, unknown> =>
  Object.fromEntries(names.map((name) => [name, cover.getAttribute(WindowCovering.id, name)]));

/**
 * Advances the fake clock in movementDuration steps until the simulated movement completes.
 *
 * @param {() => boolean} condition - Signals that the movement has completed.
 * @returns {Promise<void>} Resolves once the condition holds.
 */
async function advanceMovement(condition: () => boolean): Promise<void> {
  for (let step = 0; step < 10 && !condition(); step++) await advanceTimersByTimeAsync(MOVEMENT_DURATION);
  expect(condition()).toBe(true);
}

describe('MatterbridgeWindowCoveringServer', () => {
  useServerNode(MATTER_PORT);

  afterEach(() => {
    vi.useRealTimers();
  });

  test('the lift cover forwards each command and matter.js updates the target', async () => {
    const cover = await addCover('coverLift');
    const steps: [Command, number][] = [
      ['upOrOpen', 0],
      ['downOrClose', 10000],
      ['stopMotion', 10000],
      ['goToLiftPercentage', 5000],
    ];
    for (const [command, target] of steps) {
      await expectCommand(cover, WindowCovering, command, requestOf[command], (data) => expect(data.cluster).toBe('windowCovering'));
      expect(read(cover, 'operationalStatus', 'currentPositionLiftPercent100ths', 'targetPositionLiftPercent100ths')).toEqual({
        operationalStatus: { global: Stopped, lift: Stopped },
        currentPositionLiftPercent100ths: 0,
        targetPositionLiftPercent100ths: target,
      });
    }
  });

  test('the lift and tilt cover forwards each command and matter.js updates both targets', async () => {
    const cover = await addCover('coverLiftTilt', (endpoint) => endpoint.createDefaultLiftTiltWindowCoveringClusterServer());
    const steps: [Command, number, number][] = [
      ['upOrOpen', 0, 0],
      ['downOrClose', 10000, 10000],
      ['stopMotion', 10000, 10000],
      ['goToLiftPercentage', 5000, 10000],
      ['goToTiltPercentage', 5000, 5000],
    ];
    for (const [command, liftTarget, tiltTarget] of steps) {
      await expectCommand(cover, WindowCovering, command, requestOf[command], (data) => expect(data.cluster).toBe('windowCovering'));
      expect(
        read(
          cover,
          'operationalStatus',
          'currentPositionLiftPercent100ths',
          'targetPositionLiftPercent100ths',
          'currentPositionTiltPercent100ths',
          'targetPositionTiltPercent100ths',
        ),
      ).toEqual({
        operationalStatus: { global: Stopped, lift: Stopped, tilt: Stopped },
        currentPositionLiftPercent100ths: 0,
        targetPositionLiftPercent100ths: liftTarget,
        currentPositionTiltPercent100ths: 0,
        targetPositionTiltPercent100ths: tiltTarget,
      });
    }
  });

  test('a moving tilt-only cover reports the direction in global and tilt, with no lift field (§ 5.3.5.3.2)', async () => {
    // movementDuration 60 s: the simulation is running but never completes within the test, and stopMotion cancels it.
    const cover = await addCover('coverTilt', (endpoint) =>
      endpoint.createDefaultTiltWindowCoveringClusterServer(5000, WindowCovering.WindowCoveringType.TiltBlindTiltOnly, WindowCovering.EndProductType.TiltOnlyInteriorBlind, 60_000),
    );
    const state = (status: number, target: number): Record<string, unknown> => ({
      operationalStatus: { global: status, tilt: status },
      currentPositionTiltPercent100ths: 5000,
      targetPositionTiltPercent100ths: target,
    });
    expect(read(cover, 'operationalStatus', 'currentPositionTiltPercent100ths', 'targetPositionTiltPercent100ths')).toEqual(state(Stopped, 5000));
    const steps: [Command, object | undefined, number, number][] = [
      ['upOrOpen', undefined, Opening, 0],
      ['downOrClose', undefined, Closing, 10000],
      ['goToTiltPercentage', { tiltPercent100thsValue: 2000 }, Opening, 2000],
      ['stopMotion', undefined, Stopped, 5000],
    ];
    for (const [command, request, status, target] of steps) {
      await expectCommand(cover, WindowCovering, command, request, (data) => expect(data.cluster).toBe('windowCovering'));
      expect(read(cover, 'operationalStatus', 'currentPositionTiltPercent100ths', 'targetPositionTiltPercent100ths')).toEqual(state(status, target));
    }
  });

  test.each([
    [
      'lift',
      [WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift],
      [0, 1, 2, 5],
      ['upOrOpen', 'downOrClose', 'stopMotion', 'goToLiftPercentage'],
      'goToTiltPercentage',
    ],
    [
      'lift and tilt',
      [WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift, WindowCovering.Feature.Tilt, WindowCovering.Feature.PositionAwareTilt],
      [0, 1, 2, 5, 8],
      ['upOrOpen', 'downOrClose', 'stopMotion', 'goToLiftPercentage', 'goToTiltPercentage'],
      undefined,
    ],
    [
      'tilt-only',
      [WindowCovering.Feature.Tilt, WindowCovering.Feature.PositionAwareTilt],
      undefined,
      ['upOrOpen', 'downOrClose', 'stopMotion', 'goToTiltPercentage'],
      'goToLiftPercentage',
    ],
  ] as const)('the %s server accepts its commands, logs them and notifies the subscribers', async (label, features, acceptedCommandList, commands, missing) => {
    const cover = await addCover(`WindowCover${label.replace(/\W/g, '')}Commands`, (endpoint) => {
      if (label === 'lift and tilt') endpoint.createDefaultLiftTiltWindowCoveringClusterServer();
      else if (label === 'tilt-only') endpoint.createDefaultTiltWindowCoveringClusterServer();
    });
    const server = MatterbridgeWindowCoveringServer.with(...features);
    expect(cover.behaviors.has(server)).toBeTruthy();
    if (label === 'lift and tilt') expect(cover.behaviors.has(WindowCoveringServer)).toBeTruthy();
    const elements = cover.behaviors.elementsOf(server).commands;
    for (const command of commands) expect(elements.has(command)).toBe(true);
    if (missing) expect(elements.has(missing)).toBe(false);
    if (acceptedCommandList) {
      const state = cover.stateOf(server) as unknown as { acceptedCommandList: number[]; generatedCommandList: number[] };
      expect([...state.acceptedCommandList]).toEqual([...acceptedCommandList]);
      expect([...state.generatedCommandList]).toEqual([]);
    }
    const emitted: string[] = [];
    for (const command of commands) cover.subscribeCommand(WindowCovering, command, () => emitted.push(command));
    for (const command of commands) {
      const request = requestOf[command];
      if (request === undefined) await cover.invokeBehaviorCommand('windowCovering', command);
      else await cover.invokeBehaviorCommand('windowCovering', command, request);
    }
    const label2 = `(endpoint ${cover.id}.${cover.number})`;
    const messages: Record<Command, string> = {
      upOrOpen: 'opening cover',
      downOrClose: 'closing cover',
      stopMotion: 'stopping cover',
      goToLiftPercentage: 'setting cover lift percentage to 5000',
      goToTiltPercentage: 'setting cover tilt percentage to 5000',
    };
    for (const command of commands) expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeWindowCoveringServer: ${messages[command]} ${label2}`);
    expect(emitted).toEqual([...commands]);
  });

  test('movementDuration simulates the lift and tilt movements, and stopMotion cancels one in flight', async () => {
    const cover = await addCover('WindowCoverTimed', (endpoint) => endpoint.createDefaultLiftTiltWindowCoveringClusterServer(0, 0, undefined, undefined, MOVEMENT_DURATION));
    const status = (): unknown => cover.getAttribute(WindowCovering, 'operationalStatus');
    vi.useFakeTimers();
    await cover.invokeBehaviorCommand('windowCovering', 'goToLiftPercentage', { liftPercent100thsValue: 10000 });
    expect(status()).toMatchObject({ global: Closing, lift: Closing });
    expect(cover.getAttribute(WindowCovering, 'currentPositionLiftPercent100ths')).toBe(0);
    await advanceMovement(() => cover.getAttribute(WindowCovering, 'currentPositionLiftPercent100ths') === 10000);
    expect(status()).toMatchObject({ global: Stopped, lift: Stopped });
    await cover.invokeBehaviorCommand('windowCovering', 'goToTiltPercentage', { tiltPercent100thsValue: 10000 });
    expect(status()).toMatchObject({ global: Closing, tilt: Closing });
    await advanceMovement(() => cover.getAttribute(WindowCovering, 'currentPositionTiltPercent100ths') === 10000);
    expect(status()).toMatchObject({ global: Stopped, tilt: Stopped });
    vi.useRealTimers();

    // stopMotion before completion settles the target on the current position.
    await cover.invokeBehaviorCommand('windowCovering', 'goToLiftPercentage', { liftPercent100thsValue: 0 });
    expect(status()).toMatchObject({ lift: Opening });
    await cover.invokeBehaviorCommand('windowCovering', 'stopMotion');
    await flushAsync(undefined, undefined, 0);
    expect(read(cover, 'currentPositionLiftPercent100ths', 'targetPositionLiftPercent100ths')).toEqual({
      currentPositionLiftPercent100ths: 10000,
      targetPositionLiftPercent100ths: 10000,
    });
    expect(status()).toMatchObject({ global: Stopped, lift: Stopped });
  });

  test.each([
    [
      'lift',
      (endpoint: MatterbridgeEndpoint): MatterbridgeEndpoint => endpoint.createDefaultWindowCoveringClusterServer(),
      'goToLiftPercentage',
      { liftPercent100thsValue: 10000 },
      'lift',
    ],
    [
      'tilt',
      (endpoint: MatterbridgeEndpoint): MatterbridgeEndpoint => endpoint.createDefaultTiltWindowCoveringClusterServer(),
      'goToTiltPercentage',
      { tiltPercent100thsValue: 10000 },
      'tilt',
    ],
  ] as const)('stopMotion on a %s-only server resets only that axis', async (label, configure, command, request, axis) => {
    const cover = await addCover(`WindowCover${label}OnlyTimed`, configure);
    await cover.setAttribute(MatterbridgeWindowCoveringServer, 'movementDuration', 1000);
    await cover.invokeBehaviorCommand('windowCovering', command, request);
    expect(cover.getAttribute(WindowCovering, 'operationalStatus')).toMatchObject({ global: Closing, [axis]: Closing });
    await cover.invokeBehaviorCommand('windowCovering', 'stopMotion');
    expect(cover.getAttribute(WindowCovering.id, axis === 'lift' ? 'targetPositionLiftPercent100ths' : 'targetPositionTiltPercent100ths')).toBe(0);
    expect(cover.getAttribute(WindowCovering, 'operationalStatus')).toEqual({ global: Stopped, [axis]: Stopped });
  });

  test('the movement simulation handles an already-reached target, a null target and an unreadable OperationalStatus', async () => {
    const cover = await addCover('WindowCoverEdge', (endpoint) => endpoint.createDefaultLiftTiltWindowCoveringClusterServer(0, 0, undefined, undefined, MOVEMENT_DURATION));
    const allStopped = { global: Stopped, lift: Stopped, tilt: Stopped };
    // Going to the current position, or to a null target, schedules nothing.
    for (const request of [{ liftPercent100thsValue: 0 }, { tiltPercent100thsValue: 0 }, { liftPercent100thsValue: null }, { tiltPercent100thsValue: null }]) {
      await cover.invokeBehaviorCommand(
        'windowCovering',
        'liftPercent100thsValue' in request ? 'goToLiftPercentage' : 'goToTiltPercentage',
        request as unknown as Record<string, number | null>,
      );
      expect(cover.getAttribute(WindowCovering, 'operationalStatus')).toEqual(allStopped);
    }
    expect(read(cover, 'targetPositionLiftPercent100ths', 'targetPositionTiltPercent100ths')).toEqual({
      targetPositionLiftPercent100ths: null,
      targetPositionTiltPercent100ths: null,
    });

    // OperationalStatus unreadable while the completion handler re-reads the other axis: it falls back to Stopped.
    let nullOperationalStatus = false;
    const originalGetAttribute = cover.getAttribute.bind(cover);
    const getAttributeSpy = spyOn(cover, 'getAttribute').mockImplementation(((cluster: never, attribute: never) =>
      attribute === 'operationalStatus' && nullOperationalStatus ? null : originalGetAttribute(cluster, attribute)) as typeof cover.getAttribute);
    vi.useFakeTimers();
    try {
      for (const [command, request, attribute] of [
        ['goToLiftPercentage', { liftPercent100thsValue: 10000 }, 'currentPositionLiftPercent100ths'],
        ['goToTiltPercentage', { tiltPercent100thsValue: 10000 }, 'currentPositionTiltPercent100ths'],
      ] as const) {
        await cover.invokeBehaviorCommand('windowCovering', command, request);
        nullOperationalStatus = true;
        await advanceMovement(() => originalGetAttribute(WindowCovering.id, attribute) === 10000);
        nullOperationalStatus = false;
        expect(cover.getAttribute(WindowCovering, 'operationalStatus')).toEqual(allStopped);
      }
    } finally {
      getAttributeSpy.mockRestore();
    }
  });

  test('a command invoked while the behavior lock is held waits for it', async () => {
    // The movement simulation completes inside a { lock: true } transaction, so a command can arrive while it runs.
    const cover = await addCover('WindowCoverLock', (endpoint) => endpoint.createDefaultLiftTiltWindowCoveringClusterServer());
    const holder = cover.act(async (agent) => {
      const transaction = agent.context.transaction;
      transaction.addResourcesSync((agent as unknown as Record<string, object>)['windowCovering']);
      transaction.beginSync();
      await wait(300);
    });
    await flushAsync(3, 10, 0);
    await cover.invokeBehaviorCommand('windowCovering', 'goToLiftPercentage', { liftPercent100thsValue: 5000 });
    await holder;
    expect(cover.getAttribute(WindowCovering, 'targetPositionLiftPercent100ths')).toBe(5000);
  });

  test('CurrentPositionLift/TiltPercentage follow the Percent100ths attributes, including null', async () => {
    const cover = await addCover('WindowCoverPercentage', (endpoint) => endpoint.createDefaultLiftTiltWindowCoveringClusterServer());
    for (const axis of ['Lift', 'Tilt'] as const) {
      for (const [value, expected] of [
        [5000, 50],
        [null, null],
      ] as const) {
        await cover.setAttribute(WindowCovering.id, `currentPosition${axis}Percent100ths`, value);
        expect(cover.getAttribute(WindowCovering.id, `currentPosition${axis}Percentage`)).toBe(expected);
      }
    }
  });
});
