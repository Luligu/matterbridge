/**
 * @file packages/core/buntest/behaviors/operationalStateServer.test.ts
 * @description This file contains the bun tests for operationalStateServer.
 * @author Luca Liguori
 */

const NAME = 'OperationalStateServer';
const MATTER_PORT = 12300;

import { describe, expect, test, vi } from 'bun:test';

import { OperationalState } from '@matter/types/clusters/operational-state';
import { addBridgedDevice, aggregator } from '@matterbridge/test-utils/buntest/matter';
import { setupTest } from '@matterbridge/test-utils/buntest/setup';

import { MatterbridgeOperationalStateServer } from '../../src/behaviors/operationalStateServer.js';
import { laundryWasher } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';
import { advanceTimersByTimeAsync, recordCommand, type RecordedCommand, useServerNode } from '../bunUtils.js';

await setupTest(NAME, false);

type Command = 'pause' | 'stop' | 'start' | 'resume';
const { ErrorState, OperationalStateEnum: State } = OperationalState;
const fullyOperational = { errorStateId: ErrorState.NoError, errorStateDetails: 'Fully operational' };
const ok = { commandResponseState: fullyOperational };
const noError = (details: string): OperationalState.OperationalCommandResponse => ({ commandResponseState: { errorStateId: ErrorState.NoError, errorStateDetails: details } });
const invalid = (command: 'Pause' | 'Resume'): OperationalState.OperationalCommandResponse => ({
  commandResponseState: { errorStateId: ErrorState.CommandInvalidInState, errorStateDetails: `Not ${command}-compatible in the current operational state` },
});

/**
 * Creates and adds a laundry washer with the OperationalState cluster.
 *
 * @param {string} id - The endpoint id.
 * @returns {Promise<{ washer: MatterbridgeEndpoint; invoke: (command: Command) => Promise<OperationalState.OperationalCommandResponse>; state: () => unknown }>} The washer and its helpers.
 */
async function addWasher(
  id: string,
): Promise<{ washer: MatterbridgeEndpoint; invoke: (command: Command) => Promise<OperationalState.OperationalCommandResponse>; state: () => unknown }> {
  const washer = new MatterbridgeEndpoint(laundryWasher, { id });
  washer.createDefaultOperationalStateClusterServer();
  washer.addRequiredClusterServers();
  expect(await addBridgedDevice(aggregator, washer, 0, 0, 0, 0)).toBeTruthy();
  // act() returns the command response, which invokeBehaviorCommand() discards.
  const invoke = async (command: Command): Promise<OperationalState.OperationalCommandResponse> =>
    washer.act(async (agent) => agent.get(MatterbridgeOperationalStateServer)[command]());
  const state = (): unknown => washer.getAttribute(OperationalState.id, 'operationalState');
  return { washer, invoke, state };
}

describe('MatterbridgeOperationalStateServer', () => {
  useServerNode(MATTER_PORT);

  test('every command is forwarded first, then answered per the state machine (§ 1.14.6)', async () => {
    const { washer, invoke, state } = await addWasher('operationalStateWasher');
    const calls: Record<Command, RecordedCommand[]> = {
      pause: recordCommand(washer, 'pause'),
      stop: recordCommand(washer, 'stop'),
      start: recordCommand(washer, 'start'),
      resume: recordCommand(washer, 'resume'),
    };
    const emitted: Command[] = [];
    for (const command of ['pause', 'stop', 'start', 'resume'] as const) washer.subscribeCommand(OperationalState, command, () => emitted.push(command));
    expect(state()).toBe(State.Stopped);

    // [command, response, OperationalState after it, announced]
    const sequence: [Command, OperationalState.OperationalCommandResponse, OperationalState.OperationalStateEnum, boolean][] = [
      ['pause', invalid('Pause'), State.Stopped, false],
      ['start', ok, State.Running, true],
      ['start', noError('Already running'), State.Running, false],
      ['pause', ok, State.Paused, true],
      ['pause', noError('Already paused'), State.Paused, false],
      ['resume', ok, State.Running, true],
      ['resume', noError('Already running'), State.Running, false],
      ['stop', ok, State.Stopped, true],
      ['stop', noError('Already stopped'), State.Stopped, false],
      ['resume', invalid('Resume'), State.Stopped, false],
    ];
    for (const [command, response, after] of sequence) {
      expect(await invoke(command)).toEqual(response);
      expect(state()).toBe(after);
      expect(washer.getAttribute(OperationalState.id, 'operationalError')).toEqual(fullyOperational);
    }
    // Every request reached the plugin, accepted or not; only the completed ones were announced.
    for (const command of ['pause', 'stop', 'start', 'resume'] as const) expect(calls[command]).toHaveLength(sequence.filter(([name]) => name === command).length);
    expect(calls.pause[0]).toEqual({ cluster: 'operationalState', endpoint: washer, request: {} });
    expect(emitted).toEqual(sequence.filter(([, , , announced]) => announced).map(([command]) => command));

    // In the Error state Pause, Resume and Start are refused, Stop still succeeds.
    await washer.setAttribute(OperationalState.id, 'operationalState', State.Error);
    expect(await invoke('pause')).toEqual(invalid('Pause'));
    expect(await invoke('resume')).toEqual(invalid('Resume'));
    expect(await invoke('start')).toEqual({
      commandResponseState: { errorStateId: ErrorState.UnableToStartOrResume, errorStateDetails: 'Unable to start while in the Error state' },
    });
    expect(state()).toBe(State.Error);
    expect(await invoke('stop')).toEqual(ok);
    expect(state()).toBe(State.Stopped);
  });

  test.each([
    ['a plain Start then Stop', [['start'], [5000], ['stop']], { totalOperationalTime: 5, pausedTime: 0 }],
    ['a Pause/Resume cycle', [['start'], [2000], ['pause'], [3000], ['resume'], [4000], ['stop']], { totalOperationalTime: 9, pausedTime: 3 }],
    ['a Stop while Paused', [['start'], [1000], ['pause'], [2000], ['stop']], { totalOperationalTime: 3, pausedTime: 2 }],
    ['a Start while Paused', [['start'], [1000], ['pause'], [2000], ['start'], [4000], ['stop']], { totalOperationalTime: 7, pausedTime: 2 }],
  ] as const)('OperationCompletion after %s reports the operational and paused time (§ 1.14.7.2)', async (label, steps, times) => {
    const { washer, invoke, state } = await addWasher(`completion${label.replace(/\W/g, '')}`);
    const completions: unknown[] = [];
    washer.eventsOf(MatterbridgeOperationalStateServer).operationCompletion.on((event) => {
      completions.push(JSON.parse(JSON.stringify(event)));
    });
    vi.useFakeTimers();
    try {
      for (const [step] of steps) {
        if (typeof step === 'number') await advanceTimersByTimeAsync(step, step);
        else await invoke(step);
      }
    } finally {
      vi.useRealTimers();
    }
    expect(completions).toEqual([{ completionErrorCode: ErrorState.NoError, ...times }]);
    expect(state()).toBe(State.Stopped);
    // A Stop while already Stopped takes no action and emits nothing.
    await invoke('stop');
    expect(completions).toHaveLength(1);
  });

  test('Resume falls back to Running when the device was Paused externally', async () => {
    const { washer, invoke, state } = await addWasher('externallyPausedWasher');
    await washer.setAttribute(OperationalState.id, 'operationalState', State.Paused);
    expect(await invoke('resume')).toEqual(ok);
    expect(state()).toBe(State.Running);
  });
});
