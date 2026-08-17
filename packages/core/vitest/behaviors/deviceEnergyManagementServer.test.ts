/**
 * @file packages/core/vitest/behaviors/deviceEnergyManagementServer.test.ts
 * @description This file contains the tests for deviceEnergyManagementServer.
 * @author Luca Liguori
 */

const NAME = 'DeviceEnergyManagementServer';
const MATTER_PORT = 11800;
const MATTER_CREATE_ONLY = true;

import { DeviceEnergyManagement } from '@matter/types/clusters/device-energy-management';
import { wait } from '@matterbridge/utils/wait';
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

import { deviceEnergyManagement } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Client clusters and behaviors', () => {
  let esa: MatterbridgeEndpoint;

  const capability = [{ minPower: 500_000, maxPower: 2_000_000, minDuration: 10, maxDuration: 60 }];

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

  afterEach(() => {});

  afterAll(async () => {
    // Stop or flush the server node depending on the create-only mode
    if (MATTER_CREATE_ONLY) await flushServerNode();
    else await stopServerNode();

    // Destroy the Matter test environment
    await destroyTestEnvironment();
    // Restore all mocks
    vi.restoreAllMocks();
  });

  test('Create deviceEnergyManagement device', async () => {
    esa = new MatterbridgeEndpoint(deviceEnergyManagement, { id: 'deviceEnergyManagement' });
    expect(esa).toBeDefined();
    esa.createDefaultDeviceEnergyManagementClusterServer();
    esa.addRequiredClusterServers();
    expect(await addDevice(aggregator, esa)).toBeDefined();
    expect(esa.getAttribute(DeviceEnergyManagement, 'esaState')).toBe(DeviceEnergyManagement.EsaState.Online);
    expect(esa.getAttribute(DeviceEnergyManagement, 'powerAdjustmentCapability')).toBeNull();
    expect(esa.getAttribute(DeviceEnergyManagement, 'optOutState')).toBe(DeviceEnergyManagement.OptOutState.NoOptOut);
  });

  test('PowerAdjustRequest is rejected without PowerAdjustmentCapability', async () => {
    await expect(
      esa.invokeBehaviorCommand(DeviceEnergyManagement, 'powerAdjustRequest', { power: 1_000_000, duration: 10, cause: DeviceEnergyManagement.AdjustmentCause.LocalOptimization }),
    ).rejects.toThrow('No power adjustment capability available');
  });

  test('PowerAdjustRequest is rejected when Power or Duration is out of range', async () => {
    await esa.setAttribute(DeviceEnergyManagement, 'powerAdjustmentCapability', {
      powerAdjustCapability: capability,
      cause: DeviceEnergyManagement.PowerAdjustReason.NoAdjustment,
    });

    await expect(
      esa.invokeBehaviorCommand(DeviceEnergyManagement, 'powerAdjustRequest', { power: 2_000_001, duration: 10, cause: DeviceEnergyManagement.AdjustmentCause.LocalOptimization }),
    ).rejects.toThrow('Power or duration out of range');
    await expect(
      esa.invokeBehaviorCommand(DeviceEnergyManagement, 'powerAdjustRequest', { power: 1_000_000, duration: 9, cause: DeviceEnergyManagement.AdjustmentCause.LocalOptimization }),
    ).rejects.toThrow('Power or duration out of range');
    expect(esa.getAttribute(DeviceEnergyManagement, 'esaState')).toBe(DeviceEnergyManagement.EsaState.Online);
  });

  test('PowerAdjustRequest activates the session and emits PowerAdjustStart once', async () => {
    const powerAdjustStart = vi.fn();
    const powerAdjustEnd = vi.fn();
    (esa.events as any).deviceEnergyManagement.powerAdjustStart.on(powerAdjustStart);
    (esa.events as any).deviceEnergyManagement.powerAdjustEnd.on(powerAdjustEnd);

    await esa.invokeBehaviorCommand(DeviceEnergyManagement, 'powerAdjustRequest', {
      power: 2_000_000,
      duration: 60,
      cause: DeviceEnergyManagement.AdjustmentCause.LocalOptimization,
    });
    expect(esa.getAttribute(DeviceEnergyManagement, 'esaState')).toBe(DeviceEnergyManagement.EsaState.PowerAdjustActive);
    expect(esa.getAttribute(DeviceEnergyManagement, 'powerAdjustmentCapability')).toMatchObject({ cause: DeviceEnergyManagement.PowerAdjustReason.LocalOptimizationAdjustment });
    expect(powerAdjustStart).toHaveBeenCalledTimes(1);

    // A cause-only update while already active must not restart the session (no second PowerAdjustStart).
    await esa.invokeBehaviorCommand(DeviceEnergyManagement, 'powerAdjustRequest', {
      power: 2_000_000,
      duration: 60,
      cause: DeviceEnergyManagement.AdjustmentCause.GridOptimization,
    });
    expect(esa.getAttribute(DeviceEnergyManagement, 'esaState')).toBe(DeviceEnergyManagement.EsaState.PowerAdjustActive);
    expect(esa.getAttribute(DeviceEnergyManagement, 'powerAdjustmentCapability')).toMatchObject({ cause: DeviceEnergyManagement.PowerAdjustReason.GridOptimizationAdjustment });
    expect(powerAdjustStart).toHaveBeenCalledTimes(1);
    expect(powerAdjustEnd).not.toHaveBeenCalled();
  });

  test('CancelPowerAdjustRequest ends the active session', async () => {
    const powerAdjustEnd = vi.fn();
    (esa.events as any).deviceEnergyManagement.powerAdjustEnd.on(powerAdjustEnd);

    await esa.invokeBehaviorCommand(DeviceEnergyManagement, 'cancelPowerAdjustRequest');
    expect(esa.getAttribute(DeviceEnergyManagement, 'esaState')).toBe(DeviceEnergyManagement.EsaState.Online);
    expect(esa.getAttribute(DeviceEnergyManagement, 'powerAdjustmentCapability')).toMatchObject({ cause: DeviceEnergyManagement.PowerAdjustReason.NoAdjustment });
    expect(powerAdjustEnd).toHaveBeenCalledTimes(1);
    expect(powerAdjustEnd.mock.calls[0]?.[0]).toMatchObject({ cause: DeviceEnergyManagement.Cause.Cancelled });
  });

  test('CancelPowerAdjustRequest is rejected when nothing is active', async () => {
    await expect(esa.invokeBehaviorCommand(DeviceEnergyManagement, 'cancelPowerAdjustRequest')).rejects.toThrow('No power adjustment is currently active');
  });

  test('PowerAdjustRequest is rejected for an opted-out cause', async () => {
    await esa.setAttribute(DeviceEnergyManagement, 'optOutState', DeviceEnergyManagement.OptOutState.LocalOptOut);
    await expect(
      esa.invokeBehaviorCommand(DeviceEnergyManagement, 'powerAdjustRequest', { power: 1_000_000, duration: 10, cause: DeviceEnergyManagement.AdjustmentCause.LocalOptimization }),
    ).rejects.toThrow('User has opted out of this adjustment cause');
    await esa.setAttribute(DeviceEnergyManagement, 'optOutState', DeviceEnergyManagement.OptOutState.NoOptOut);
  });

  test('OptOutState change cancels only a matching-cause active session', async () => {
    const powerAdjustEnd = vi.fn();
    (esa.events as any).deviceEnergyManagement.powerAdjustEnd.on(powerAdjustEnd);

    await esa.invokeBehaviorCommand(DeviceEnergyManagement, 'powerAdjustRequest', {
      power: 2_000_000,
      duration: 60,
      cause: DeviceEnergyManagement.AdjustmentCause.GridOptimization,
    });
    expect(esa.getAttribute(DeviceEnergyManagement, 'esaState')).toBe(DeviceEnergyManagement.EsaState.PowerAdjustActive);

    // Opting out of Local must not affect a Grid-caused active session.
    await esa.setAttribute(DeviceEnergyManagement, 'optOutState', DeviceEnergyManagement.OptOutState.LocalOptOut);
    expect(esa.getAttribute(DeviceEnergyManagement, 'esaState')).toBe(DeviceEnergyManagement.EsaState.PowerAdjustActive);
    expect(powerAdjustEnd).not.toHaveBeenCalled();

    // Opting out of Grid must cancel the Grid-caused active session as if CancelPowerAdjustRequest had been sent.
    await esa.setAttribute(DeviceEnergyManagement, 'optOutState', DeviceEnergyManagement.OptOutState.OptOut);
    expect(esa.getAttribute(DeviceEnergyManagement, 'esaState')).toBe(DeviceEnergyManagement.EsaState.Online);
    expect(esa.getAttribute(DeviceEnergyManagement, 'powerAdjustmentCapability')).toMatchObject({ cause: DeviceEnergyManagement.PowerAdjustReason.NoAdjustment });
    expect(powerAdjustEnd).toHaveBeenCalledTimes(1);
    expect(powerAdjustEnd.mock.calls[0]?.[0]).toMatchObject({ cause: DeviceEnergyManagement.Cause.UserOptOut });

    await esa.setAttribute(DeviceEnergyManagement, 'optOutState', DeviceEnergyManagement.OptOutState.NoOptOut);
  });

  test('OptOutState change cancels a matching Local-caused active session', async () => {
    const powerAdjustEnd = vi.fn();
    (esa.events as any).deviceEnergyManagement.powerAdjustEnd.on(powerAdjustEnd);

    await esa.invokeBehaviorCommand(DeviceEnergyManagement, 'powerAdjustRequest', {
      power: 2_000_000,
      duration: 60,
      cause: DeviceEnergyManagement.AdjustmentCause.LocalOptimization,
    });
    expect(esa.getAttribute(DeviceEnergyManagement, 'esaState')).toBe(DeviceEnergyManagement.EsaState.PowerAdjustActive);

    // Opting out of Grid must not affect a Local-caused active session.
    await esa.setAttribute(DeviceEnergyManagement, 'optOutState', DeviceEnergyManagement.OptOutState.GridOptOut);
    expect(esa.getAttribute(DeviceEnergyManagement, 'esaState')).toBe(DeviceEnergyManagement.EsaState.PowerAdjustActive);
    expect(powerAdjustEnd).not.toHaveBeenCalled();

    // Opting out of Local must cancel the Local-caused active session.
    await esa.setAttribute(DeviceEnergyManagement, 'optOutState', DeviceEnergyManagement.OptOutState.OptOut);
    expect(esa.getAttribute(DeviceEnergyManagement, 'esaState')).toBe(DeviceEnergyManagement.EsaState.Online);
    expect(powerAdjustEnd).toHaveBeenCalledTimes(1);
    expect(powerAdjustEnd.mock.calls[0]?.[0]).toMatchObject({ cause: DeviceEnergyManagement.Cause.UserOptOut });

    await esa.setAttribute(DeviceEnergyManagement, 'optOutState', DeviceEnergyManagement.OptOutState.NoOptOut);
  });

  test('CancelPowerAdjustRequest tolerates PowerAdjustmentCapability being cleared while active', async () => {
    const powerAdjustEnd = vi.fn();
    (esa.events as any).deviceEnergyManagement.powerAdjustEnd.on(powerAdjustEnd);

    await esa.invokeBehaviorCommand(DeviceEnergyManagement, 'powerAdjustRequest', {
      power: 2_000_000,
      duration: 60,
      cause: DeviceEnergyManagement.AdjustmentCause.LocalOptimization,
    });
    expect(esa.getAttribute(DeviceEnergyManagement, 'esaState')).toBe(DeviceEnergyManagement.EsaState.PowerAdjustActive);

    // Something else (e.g. a TestEventTrigger) clears PowerAdjustmentCapability while a session is active.
    await esa.setAttribute(DeviceEnergyManagement, 'powerAdjustmentCapability', null);

    await esa.invokeBehaviorCommand(DeviceEnergyManagement, 'cancelPowerAdjustRequest');
    expect(esa.getAttribute(DeviceEnergyManagement, 'esaState')).toBe(DeviceEnergyManagement.EsaState.Online);
    expect(esa.getAttribute(DeviceEnergyManagement, 'powerAdjustmentCapability')).toMatchObject({
      powerAdjustCapability: [],
      cause: DeviceEnergyManagement.PowerAdjustReason.NoAdjustment,
    });
    expect(powerAdjustEnd).toHaveBeenCalledTimes(1);

    await esa.setAttribute(DeviceEnergyManagement, 'powerAdjustmentCapability', {
      powerAdjustCapability: capability,
      cause: DeviceEnergyManagement.PowerAdjustReason.NoAdjustment,
    });
  });

  test('An active session completes naturally after its requested duration', async () => {
    const powerAdjustEnd = vi.fn();
    (esa.events as any).deviceEnergyManagement.powerAdjustEnd.on(powerAdjustEnd);

    await esa.invokeBehaviorCommand(DeviceEnergyManagement, 'powerAdjustRequest', {
      power: 2_000_000,
      duration: 10,
      cause: DeviceEnergyManagement.AdjustmentCause.LocalOptimization,
    });
    expect(esa.getAttribute(DeviceEnergyManagement, 'esaState')).toBe(DeviceEnergyManagement.EsaState.PowerAdjustActive);

    await wait(11_000);
    expect(esa.getAttribute(DeviceEnergyManagement, 'esaState')).toBe(DeviceEnergyManagement.EsaState.Online);
    expect(powerAdjustEnd).toHaveBeenCalledTimes(1);
    expect(powerAdjustEnd.mock.calls[0]?.[0]).toMatchObject({ cause: DeviceEnergyManagement.Cause.NormalCompletion });
  }, 15_000);
});
