/**
 * @file packages/core/vitest/behaviors/operationalStateServer.test.ts
 * @description This file contains the tests for operationalStateServer.
 * @author Luca Liguori
 */

const NAME = 'OperationalStateServer';
const MATTER_PORT = 12300;
const MATTER_CREATE_ONLY = true;

import { OperationalState } from '@matter/types/clusters/operational-state';
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

import { MatterbridgeOperationalStateServer } from '../../src/behaviors/operationalStateServer.js';
import { laundryWasher } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';
import type { CommandHandlerFunction } from '../../src/matterbridgeEndpointCommandHandler.js';

const fullyOperational = { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Fully operational' };

// Setup the test environment
await setupTest(NAME, false);

describe('Server clusters and behaviors', () => {
  let washer: MatterbridgeEndpoint;
  let pauseHandler: ReturnType<typeof vi.fn<CommandHandlerFunction<'pause'>>>;
  let stopHandler: ReturnType<typeof vi.fn<CommandHandlerFunction<'stop'>>>;
  let startHandler: ReturnType<typeof vi.fn<CommandHandlerFunction<'start'>>>;
  let resumeHandler: ReturnType<typeof vi.fn<CommandHandlerFunction<'resume'>>>;

  const invoke = async (command: 'pause' | 'stop' | 'start' | 'resume'): Promise<OperationalState.OperationalCommandResponse> =>
    washer.act(async (agent) => agent.get(MatterbridgeOperationalStateServer)[command]());

  const expectAttributes = (operationalState: OperationalState.OperationalStateEnum, operationalError = fullyOperational): void => {
    expect(washer.getAttribute(OperationalState.id, 'operationalState')).toBe(operationalState);
    expect(washer.getAttribute(OperationalState.id, 'operationalError')).toEqual(operationalError);
  };

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

  test('Create OperationalState device', async () => {
    washer = new MatterbridgeEndpoint(laundryWasher, { id: 'operationalStateWasher' });
    washer.createDefaultOperationalStateClusterServer();
    washer.addRequiredClusterServers();
    expect(await addDevice(aggregator, washer)).toBeTruthy();

    // Every command is always forwarded to the plugin's command handler first, unconditionally, regardless of
    // the conformance branch it then falls into below.
    pauseHandler = vi.fn<CommandHandlerFunction<'pause'>>();
    stopHandler = vi.fn<CommandHandlerFunction<'stop'>>();
    startHandler = vi.fn<CommandHandlerFunction<'start'>>();
    resumeHandler = vi.fn<CommandHandlerFunction<'resume'>>();
    washer.addCommandHandler('pause', pauseHandler);
    washer.addCommandHandler('stop', stopHandler);
    washer.addCommandHandler('start', startHandler);
    washer.addCommandHandler('resume', resumeHandler);

    expectAttributes(OperationalState.OperationalStateEnum.Stopped);
  });

  test('Pause: not Pause-compatible from Stopped responds CommandInvalidInState and forwards to the plugin first (Table 3)', async () => {
    await expect(invoke('pause')).resolves.toEqual({
      commandResponseState: { errorStateId: OperationalState.ErrorState.CommandInvalidInState, errorStateDetails: 'Not Pause-compatible in the current operational state' },
    });
    expect(pauseHandler).toHaveBeenCalledTimes(1);
    expect(pauseHandler.mock.calls[0][0]).toMatchObject({ command: 'pause', request: {}, endpoint: washer });
    // Attributes are untouched, per "SHALL take no further action".
    expectAttributes(OperationalState.OperationalStateEnum.Stopped);
  });

  test('Start: success from Stopped forwards to the plugin and sets Running (§ 1.14.6.3)', async () => {
    await expect(invoke('start')).resolves.toEqual({ commandResponseState: fullyOperational });
    expect(startHandler).toHaveBeenCalledTimes(1);
    expectAttributes(OperationalState.OperationalStateEnum.Running);
  });

  test('Start: already Running responds NoError but forwards to the plugin and takes no further action', async () => {
    await expect(invoke('start')).resolves.toEqual({
      commandResponseState: { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Already running' },
    });
    expect(startHandler).toHaveBeenCalledTimes(1);
    expectAttributes(OperationalState.OperationalStateEnum.Running);
  });

  test('Pause: success from Running forwards to the plugin and sets Paused, remembering the prior state (§ 1.14.6.1)', async () => {
    await expect(invoke('pause')).resolves.toEqual({ commandResponseState: fullyOperational });
    expect(pauseHandler).toHaveBeenCalledTimes(1);
    expectAttributes(OperationalState.OperationalStateEnum.Paused);
  });

  test('Pause: already Paused responds NoError but forwards to the plugin and takes no further action', async () => {
    await expect(invoke('pause')).resolves.toEqual({
      commandResponseState: { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Already paused' },
    });
    expect(pauseHandler).toHaveBeenCalledTimes(1);
    expectAttributes(OperationalState.OperationalStateEnum.Paused);
  });

  test('Resume: success from Paused forwards to the plugin and restores the state prior to Pause (§ 1.14.6.4)', async () => {
    await expect(invoke('resume')).resolves.toEqual({ commandResponseState: fullyOperational });
    expect(resumeHandler).toHaveBeenCalledTimes(1);
    // The device was Running when pause() was called above, so resume() SHALL restore Running.
    expectAttributes(OperationalState.OperationalStateEnum.Running);
  });

  test('Resume: already Running responds NoError but forwards to the plugin and takes no further action', async () => {
    await expect(invoke('resume')).resolves.toEqual({
      commandResponseState: { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Already running' },
    });
    expect(resumeHandler).toHaveBeenCalledTimes(1);
    expectAttributes(OperationalState.OperationalStateEnum.Running);
  });

  test('Stop: success from Running forwards to the plugin and sets Stopped (§ 1.14.6.2)', async () => {
    await expect(invoke('stop')).resolves.toEqual({ commandResponseState: fullyOperational });
    expect(stopHandler).toHaveBeenCalledTimes(1);
    expectAttributes(OperationalState.OperationalStateEnum.Stopped);
  });

  test('Stop: already Stopped responds NoError but forwards to the plugin and takes no further action', async () => {
    await expect(invoke('stop')).resolves.toEqual({
      commandResponseState: { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Already stopped' },
    });
    expect(stopHandler).toHaveBeenCalledTimes(1);
    expectAttributes(OperationalState.OperationalStateEnum.Stopped);
  });

  test('Resume: not Resume-compatible from Stopped responds CommandInvalidInState and forwards to the plugin first (Table 4)', async () => {
    await expect(invoke('resume')).resolves.toEqual({
      commandResponseState: { errorStateId: OperationalState.ErrorState.CommandInvalidInState, errorStateDetails: 'Not Resume-compatible in the current operational state' },
    });
    expect(resumeHandler).toHaveBeenCalledTimes(1);
    expectAttributes(OperationalState.OperationalStateEnum.Stopped);
  });

  test('Pause, Resume and Start all refuse the Error state, but Stop still succeeds', async () => {
    await washer.setAttribute(OperationalState.id, 'operationalState', OperationalState.OperationalStateEnum.Error);

    await expect(invoke('pause')).resolves.toEqual({
      commandResponseState: { errorStateId: OperationalState.ErrorState.CommandInvalidInState, errorStateDetails: 'Not Pause-compatible in the current operational state' },
    });
    expect(pauseHandler).toHaveBeenCalledTimes(1);
    expectAttributes(OperationalState.OperationalStateEnum.Error, fullyOperational);

    await expect(invoke('resume')).resolves.toEqual({
      commandResponseState: { errorStateId: OperationalState.ErrorState.CommandInvalidInState, errorStateDetails: 'Not Resume-compatible in the current operational state' },
    });
    expect(resumeHandler).toHaveBeenCalledTimes(1);
    expectAttributes(OperationalState.OperationalStateEnum.Error, fullyOperational);

    // "A device that is unable to honor the Start command for whatever reason SHALL respond ... with an
    // ErrorStateID of UnableToStartOrResume" (§ 1.14.6.3): the device cannot start out of Error until the
    // error is cleared, e.g. via Stop below.
    await expect(invoke('start')).resolves.toEqual({
      commandResponseState: { errorStateId: OperationalState.ErrorState.UnableToStartOrResume, errorStateDetails: 'Unable to start while in the Error state' },
    });
    expect(startHandler).toHaveBeenCalledTimes(1);
    expectAttributes(OperationalState.OperationalStateEnum.Error, fullyOperational);

    // Stop has no compatibility table in the base cluster: it still succeeds unconditionally, clearing Error.
    await expect(invoke('stop')).resolves.toEqual({ commandResponseState: fullyOperational });
    expect(stopHandler).toHaveBeenCalledTimes(1);
    expectAttributes(OperationalState.OperationalStateEnum.Stopped);

    await expect(invoke('start')).resolves.toEqual({ commandResponseState: fullyOperational });
    expect(startHandler).toHaveBeenCalledTimes(2);
    expectAttributes(OperationalState.OperationalStateEnum.Running);
  });

  test('OperationCompletion is emitted by Stop for a plain Start-then-Stop operation, with PausedTime 0 (§ 1.14.7.2)', async () => {
    const operationCompletion = vi.fn();
    washer.eventsOf(MatterbridgeOperationalStateServer).operationCompletion.on(operationCompletion);

    // washer is Running from the previous test; get to a clean Stopped baseline first without counting it.
    await invoke('stop');
    operationCompletion.mockClear();

    vi.useFakeTimers();
    try {
      await invoke('start');
      await vi.advanceTimersByTimeAsync(5000);
      await invoke('stop');
    } finally {
      vi.useRealTimers();
    }

    expect(operationCompletion).toHaveBeenCalledTimes(1);
    expect(operationCompletion.mock.calls[0][0]).toEqual({ completionErrorCode: OperationalState.ErrorState.NoError, totalOperationalTime: 5, pausedTime: 0 });
    expectAttributes(OperationalState.OperationalStateEnum.Stopped);
  });

  test('OperationCompletion accumulates PausedTime across a Pause/Resume cycle before Stop', async () => {
    const operationCompletion = vi.fn();
    washer.eventsOf(MatterbridgeOperationalStateServer).operationCompletion.on(operationCompletion);

    vi.useFakeTimers();
    try {
      await invoke('start');
      await vi.advanceTimersByTimeAsync(2000);
      await invoke('pause');
      await vi.advanceTimersByTimeAsync(3000);
      await invoke('resume');
      await vi.advanceTimersByTimeAsync(4000);
      await invoke('stop');
    } finally {
      vi.useRealTimers();
    }

    expect(operationCompletion).toHaveBeenCalledTimes(1);
    // TotalOperationalTime "includes any time spent while paused" (§ 1.14.7.2.2): 2 + 3 + 4 = 9s.
    expect(operationCompletion.mock.calls[0][0]).toEqual({ completionErrorCode: OperationalState.ErrorState.NoError, totalOperationalTime: 9, pausedTime: 3 });
  });

  test('OperationCompletion is not emitted by an already-Stopped Stop, taking no further action', async () => {
    const operationCompletion = vi.fn();
    washer.eventsOf(MatterbridgeOperationalStateServer).operationCompletion.on(operationCompletion);

    await invoke('stop'); // already Stopped from the previous test
    expect(operationCompletion).not.toHaveBeenCalled();
  });

  test('Stop received while Paused closes out the in-progress paused segment before computing PausedTime', async () => {
    const operationCompletion = vi.fn();
    washer.eventsOf(MatterbridgeOperationalStateServer).operationCompletion.on(operationCompletion);

    vi.useFakeTimers();
    try {
      await invoke('start');
      await vi.advanceTimersByTimeAsync(1000);
      await invoke('pause');
      await vi.advanceTimersByTimeAsync(2000);
      await invoke('stop'); // Stop while still Paused, never Resumed.
    } finally {
      vi.useRealTimers();
    }

    expect(operationCompletion).toHaveBeenCalledTimes(1);
    expect(operationCompletion.mock.calls[0][0]).toEqual({ completionErrorCode: OperationalState.ErrorState.NoError, totalOperationalTime: 3, pausedTime: 2 });
    expectAttributes(OperationalState.OperationalStateEnum.Stopped);
  });

  test('Start received while Paused (instead of Resume) closes out the paused segment without resetting the operation timer', async () => {
    const operationCompletion = vi.fn();
    washer.eventsOf(MatterbridgeOperationalStateServer).operationCompletion.on(operationCompletion);

    vi.useFakeTimers();
    try {
      await invoke('start');
      await vi.advanceTimersByTimeAsync(1000);
      await invoke('pause');
      await vi.advanceTimersByTimeAsync(2000);
      await invoke('start'); // Start while Paused (instead of Resume) preserves the original operation start time.
      await vi.advanceTimersByTimeAsync(4000);
      await invoke('stop');
    } finally {
      vi.useRealTimers();
    }

    expect(operationCompletion).toHaveBeenCalledTimes(1);
    // TotalOperationalTime is the full 1 + 2 + 4 = 7s span since the original Start, not just the 4s since this Start.
    expect(operationCompletion.mock.calls[0][0]).toEqual({ completionErrorCode: OperationalState.ErrorState.NoError, totalOperationalTime: 7, pausedTime: 2 });
  });

  test('Resume falls back to Running when Paused externally, without a prior Pause command', async () => {
    const externallyPausedWasher = new MatterbridgeEndpoint(laundryWasher, { id: 'externallyPausedWasher' });
    externallyPausedWasher.createDefaultOperationalStateClusterServer();
    externallyPausedWasher.addRequiredClusterServers();
    expect(await addDevice(aggregator, externallyPausedWasher)).toBeTruthy();

    // Simulate the device having been paused by means outside of this cluster (e.g. a manual button press),
    // so the Pause command handler above never ran and never recorded a prior operational state.
    await externallyPausedWasher.setAttribute(OperationalState.id, 'operationalState', OperationalState.OperationalStateEnum.Paused);

    const response = await externallyPausedWasher.act(async (agent) => agent.get(MatterbridgeOperationalStateServer).resume());
    expect(response).toEqual({ commandResponseState: fullyOperational });
    expect(externallyPausedWasher.getAttribute(OperationalState.id, 'operationalState')).toBe(OperationalState.OperationalStateEnum.Running);
  });
});
