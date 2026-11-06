/**
 * @file packages/core/buntest/behaviors/valveConfigurationAndControlServer.test.ts
 * @description This file contains the bun tests for valveConfigurationAndControlServer.
 * @author Luca Liguori
 */

const NAME = 'ValveConfigurationAndControlServer';
const MATTER_PORT = 12200;

import { afterEach, describe, expect, test, vi } from 'bun:test';

import { ValveConfigurationAndControl } from '@matter/types/clusters/valve-configuration-and-control';
import { Status } from '@matter/types/globals';
import { addBridgedDevice, aggregator } from '@matterbridge/test-utils/buntest/matter';
import { setupTest } from '@matterbridge/test-utils/buntest/setup';

import { MatterbridgeValveConfigurationAndControlServer } from '../../src/behaviors/valveConfigurationAndControlServer.js';
import { waterValve } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';
import { advanceTimersByTimeAsync, useServerNode } from '../bunUtils.js';

await setupTest(NAME, false);

const { ValveState } = ValveConfigurationAndControl;
const noFault = { generalFault: false, blocked: false, leaking: false, notConnected: false, shortCircuit: false, currentExceeded: false };
type ValveAttributes = {
  currentState: number;
  targetState: number | null;
  currentLevel: number | null;
  targetLevel: number | null;
  openDuration: number | null;
  remainingDuration: number | null;
};

/**
 * Reads the Effect-on-Receipt attributes of the valve.
 *
 * @param {MatterbridgeEndpoint} valve - The valve endpoint.
 * @param {(keyof ValveAttributes)[]} [names] - The attributes to read (default: all of them).
 * @returns {Partial<ValveAttributes>} The attribute values.
 */
const valveState = (
  valve: MatterbridgeEndpoint,
  names: (keyof ValveAttributes)[] = ['currentState', 'targetState', 'currentLevel', 'targetLevel', 'openDuration', 'remainingDuration'],
): Partial<ValveAttributes> => Object.fromEntries(names.map((name) => [name, valve.getAttribute(ValveConfigurationAndControl.id, name)]));

/**
 * Creates and adds a water valve with the Level feature.
 *
 * @param {string} id - The endpoint id.
 * @param {number} movementDuration - The simulated movement duration in ms (0 disables the simulation).
 * @param {boolean} autoClose - Whether the RemainingDuration countdown and auto-close are simulated.
 * @returns {Promise<MatterbridgeEndpoint>} The added valve.
 */
const addValve = async (id: string, movementDuration: number, autoClose: boolean): Promise<MatterbridgeEndpoint> => {
  const valve = new MatterbridgeEndpoint(waterValve, { id });
  valve.createDefaultValveConfigurationAndControlClusterServer(undefined, undefined, movementDuration, autoClose);
  valve.addRequiredClusterServers();
  expect(await addBridgedDevice(aggregator, valve, 0, 0, 0, 0)).toBeTruthy();
  return valve;
};

describe('MatterbridgeValveConfigurationAndControlServer', () => {
  useServerNode(MATTER_PORT);

  afterEach(() => {
    vi.useRealTimers();
  });

  test('should enable the movement simulation and auto close on initialize when MATTERBRIDGE_CHIP_TEST is set', async () => {
    process.env.MATTERBRIDGE_CHIP_TEST = 'true';
    let valve: MatterbridgeEndpoint;
    try {
      valve = await addValve('chipTestValve', 0, false);
    } finally {
      delete process.env.MATTERBRIDGE_CHIP_TEST;
    }
    expect(valve.stateOf(MatterbridgeValveConfigurationAndControlServer)).toMatchObject({ movementDuration: 2000, autoClose: true });
  });

  test('Open/Close Effect on Receipt, fault and LevelStep validation with the simulation disabled', async () => {
    const valve = await addValve('valve', 0, false);
    expect(valveState(valve)).toEqual({
      currentState: ValveState.Closed,
      targetState: ValveState.Closed,
      currentLevel: 0,
      targetLevel: 0,
      openDuration: null,
      remainingDuration: null,
    });
    const open = async (request: ValveConfigurationAndControl.OpenRequest = {}): Promise<unknown> => valve.invokeBehaviorCommand(ValveConfigurationAndControl, 'open', request);
    const close = async (): Promise<unknown> => valve.invokeBehaviorCommand(ValveConfigurationAndControl, 'close');

    // Without simulation CurrentState stops at Transitioning: completing the movement is left to the device.
    await open({ targetLevel: 50, openDuration: 60 });
    expect(valveState(valve)).toEqual({
      currentState: ValveState.Transitioning,
      targetState: ValveState.Open,
      currentLevel: 0,
      targetLevel: 50,
      openDuration: 60,
      remainingDuration: 60,
    });
    await valve.setAttribute(ValveConfigurationAndControl.id, 'defaultOpenDuration', null);
    await open();
    expect(valveState(valve)).toEqual({
      currentState: ValveState.Transitioning,
      targetState: ValveState.Open,
      currentLevel: 0,
      targetLevel: 100,
      openDuration: null,
      remainingDuration: null,
    });
    await close();
    expect(valveState(valve)).toEqual({
      currentState: ValveState.Transitioning,
      targetState: ValveState.Closed,
      currentLevel: 0,
      targetLevel: 0,
      openDuration: null,
      remainingDuration: null,
    });

    // A registered fault rejects both commands with FailureDueToFault before any state change, and they are not announced.
    const emitted: string[] = [];
    valve.subscribeCommand(ValveConfigurationAndControl, 'open', () => emitted.push('open'));
    valve.subscribeCommand(ValveConfigurationAndControl, 'close', () => emitted.push('close'));
    await valve.setAttribute(ValveConfigurationAndControl.id, 'valveFault', { ...noFault, generalFault: true });
    expect(open()).rejects.toMatchObject({ code: Status.Failure, clusterCode: 2 });
    expect(close()).rejects.toMatchObject({ code: Status.Failure, clusterCode: 2 });
    expect(valveState(valve, ['currentState', 'targetState'])).toEqual({ currentState: ValveState.Transitioning, targetState: ValveState.Closed });
    await valve.setAttribute(ValveConfigurationAndControl.id, 'valveFault', noFault);
    expect(emitted).toEqual([]);
    await open();
    await close();
    expect(emitted).toEqual(['open', 'close']);

    // TargetLevel must be a multiple of LevelStep, except 100.
    await valve.setAttribute(ValveConfigurationAndControl.id, 'levelStep', 10);
    expect(open({ targetLevel: 15 })).rejects.toMatchObject({ code: Status.ConstraintError });
    await open({ targetLevel: 100 });
    expect(valve.getAttribute(ValveConfigurationAndControl.id, 'targetLevel')).toBe(100);
  });

  test('movementDuration completes the movement, and a new command cancels one in flight', async () => {
    const valve = await addValve('timedValve', 1000, false);
    vi.useFakeTimers();
    await valve.invokeBehaviorCommand(ValveConfigurationAndControl, 'open', { targetLevel: 42 });
    expect(valveState(valve, ['currentState', 'targetState'])).toEqual({ currentState: ValveState.Transitioning, targetState: ValveState.Open });
    await advanceTimersByTimeAsync(1000);
    expect(valveState(valve, ['currentState', 'currentLevel', 'targetState', 'targetLevel'])).toEqual({
      currentState: ValveState.Open,
      currentLevel: 42,
      targetState: null,
      targetLevel: null,
    });

    await valve.invokeBehaviorCommand(ValveConfigurationAndControl, 'open', { targetLevel: 10 });
    await valve.invokeBehaviorCommand(ValveConfigurationAndControl, 'close');
    await advanceTimersByTimeAsync(1000);
    expect(valveState(valve, ['currentState', 'currentLevel'])).toEqual({ currentState: ValveState.Closed, currentLevel: 0 });
  });

  test('autoClose counts RemainingDuration down and closes the valve at 0', async () => {
    const valve = await addValve('autoCloseValve', 0, true);
    vi.useFakeTimers();
    await valve.invokeBehaviorCommand(ValveConfigurationAndControl, 'open', { openDuration: 3 });
    expect(valve.getAttribute(ValveConfigurationAndControl.id, 'remainingDuration')).toBe(3);
    // A tick above 0 only decrements RemainingDuration.
    await advanceTimersByTimeAsync(1000, 10);
    expect(valveState(valve, ['remainingDuration', 'currentState'])).toEqual({ remainingDuration: 2, currentState: ValveState.Transitioning });
    // RemainingDuration cleared externally between ticks: the next tick is a no-op.
    await valve.setAttribute(ValveConfigurationAndControl.id, 'remainingDuration', null);
    await advanceTimersByTimeAsync(1000, 10);
    expect(valveState(valve, ['remainingDuration', 'currentState'])).toEqual({ remainingDuration: null, currentState: ValveState.Transitioning });

    // Reaching 0 runs the internal Close: TargetState Closed and both durations cleared (no movement simulation here).
    await valve.invokeBehaviorCommand(ValveConfigurationAndControl, 'open', { openDuration: 1 });
    await advanceTimersByTimeAsync(1000, 10);
    expect(valveState(valve, ['currentState', 'targetState', 'openDuration', 'remainingDuration'])).toEqual({
      currentState: ValveState.Transitioning,
      targetState: ValveState.Closed,
      openDuration: null,
      remainingDuration: null,
    });

    // A Close cancels a countdown in flight, so the timer never closes the valve a second time.
    await valve.invokeBehaviorCommand(ValveConfigurationAndControl, 'open', { openDuration: 60 });
    await valve.invokeBehaviorCommand(ValveConfigurationAndControl, 'close');
    expect(valveState(valve, ['openDuration', 'remainingDuration'])).toEqual({ openDuration: null, remainingDuration: null });
    await advanceTimersByTimeAsync(60_000, 100);
    expect(valveState(valve, ['currentState', 'targetState'])).toEqual({ currentState: ValveState.Transitioning, targetState: ValveState.Closed });
  });

  test('without the Level feature Open/Close never touch CurrentLevel/TargetLevel', async () => {
    const valve = new MatterbridgeEndpoint(waterValve, { id: 'noLevelValve' });
    valve.behaviors.require(MatterbridgeValveConfigurationAndControlServer.with(), {
      currentState: ValveState.Closed,
      targetState: ValveState.Closed,
      openDuration: null,
      defaultOpenDuration: null,
      remainingDuration: null,
      valveFault: noFault,
      movementDuration: 1000,
      autoClose: false,
    });
    valve.addRequiredClusterServers();
    expect(await addBridgedDevice(aggregator, valve, 0, 0, 0, 0)).toBeTruthy();
    expect(valve.hasAttributeServer(ValveConfigurationAndControl.id, 'currentLevel')).toBe(false);
    expect(valve.hasAttributeServer(ValveConfigurationAndControl.id, 'targetLevel')).toBe(false);

    vi.useFakeTimers();
    await valve.invokeBehaviorCommand(ValveConfigurationAndControl, 'open', {});
    expect(valveState(valve, ['currentState', 'targetState'])).toEqual({ currentState: ValveState.Transitioning, targetState: ValveState.Open });
    await advanceTimersByTimeAsync(1000);
    expect(valveState(valve, ['currentState', 'targetState'])).toEqual({ currentState: ValveState.Open, targetState: null });
    await valve.invokeBehaviorCommand(ValveConfigurationAndControl, 'close');
    expect(valve.getAttribute(ValveConfigurationAndControl.id, 'currentState')).toBe(ValveState.Transitioning);
    await advanceTimersByTimeAsync(1000);
    expect(valve.getAttribute(ValveConfigurationAndControl.id, 'currentState')).toBe(ValveState.Closed);
  });
});
