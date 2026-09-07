/**
 * @file vitest/behaviors/chimeServer.test.ts
 * @description This file contains the tests for the MatterbridgeChimeServer behavior.
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
 */

const NAME = 'ChimeServerBehavior';
const MATTER_PORT = 6002;
const MATTER_CREATE_ONLY = true;

import { Chime as ChimeCluster } from '@matter/types/clusters/chime';
import { loggerDebugSpy, loggerErrorSpy, loggerFatalSpy, loggerInfoSpy, loggerWarnSpy, setupTest } from '@matterbridge/vitest-utils';
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

import { createDefaultChimeClusterServer, MatterbridgeChimeServer } from '../../src/behaviors/chimeServer.js';
import { Chime } from '../../src/devices/chime.js';

await setupTest(NAME);

describe('MatterbridgeChimeServer', () => {
  let device: Chime;

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

  afterEach(() => {
    // No errors logged during tests
    expect(loggerWarnSpy).not.toHaveBeenCalled();
    expect(loggerErrorSpy).not.toHaveBeenCalled();
    expect(loggerFatalSpy).not.toHaveBeenCalled();
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

  it('should create and register a chime device using the MatterbridgeChimeServer behavior', async () => {
    device = new Chime('Chime Behavior', 'CHIME-BEHAVIOR', {
      installedChimeSounds: [
        { chimeId: 0, name: 'Default Chime' },
        { chimeId: 1, name: 'Chime 1' },
      ],
      selectedChime: 0,
      enabled: true,
    });
    expect(device.behaviors.has(MatterbridgeChimeServer)).toBeTruthy();
    expect(await addDevice(aggregator, device)).toBeTruthy();
  });

  it('should play the selected chime sound when no chimeId is provided', async () => {
    await expect(device.invokeBehaviorCommand(ChimeCluster, 'playChimeSound', {})).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('playing chime sound 0'));
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining('MatterbridgeChimeServer: playChimeSound called with chimeId 0'));
  });

  it('should play the requested chime sound when a chimeId is provided', async () => {
    await expect(device.invokeBehaviorCommand(ChimeCluster, 'playChimeSound', { chimeId: 1 })).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('playing chime sound 1'));
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining('MatterbridgeChimeServer: playChimeSound called with chimeId 1'));
  });

  it('should reject with NotFound when the requested chimeId is not in installedChimeSounds', async () => {
    await expect(device.invokeBehaviorCommand(ChimeCluster, 'playChimeSound', { chimeId: 99 })).rejects.toThrow('chime sound 99 is not present in installedChimeSounds');

    expect(loggerInfoSpy).not.toHaveBeenCalledWith(expect.stringContaining('playing chime sound 99'));
  });

  it('should accept writing SelectedChime to a chimeId present in installedChimeSounds', async () => {
    await expect(device.setAttribute(ChimeCluster, 'selectedChime', 1, device.log)).resolves.toBe(true);
    expect(device.getAttribute(ChimeCluster, 'selectedChime')).toBe(1);

    await device.setAttribute(ChimeCluster, 'selectedChime', 0, device.log);
  });

  it('should reject with NotFound when writing SelectedChime to a chimeId not in installedChimeSounds', async () => {
    await expect(device.setAttribute(ChimeCluster, 'selectedChime', 99, device.log)).rejects.toThrow('chime sound 99 is not present in installedChimeSounds');
    expect(device.getAttribute(ChimeCluster, 'selectedChime')).toBe(0);
  });

  it('should succeed with no side effects when enabled is false', async () => {
    await device.setAttribute(ChimeCluster, 'enabled', false, device.log);
    vi.clearAllMocks();

    await expect(device.invokeBehaviorCommand(ChimeCluster, 'playChimeSound', {})).resolves.toBeUndefined();

    expect(loggerInfoSpy).not.toHaveBeenCalled();
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining('MatterbridgeChimeServer: playChimeSound called but chime is disabled'));

    await device.setAttribute(ChimeCluster, 'enabled', true, device.log);
  });

  it('should add createDefaultChimeClusterServer to an endpoint', () => {
    const device = new Chime('Chime Helper', 'CHIME-HELPER', { powerSourceType: 'None' });
    // The constructor already creates the Chime cluster server; calling the helper again should return the same endpoint.
    expect(createDefaultChimeClusterServer(device, [{ chimeId: 0, name: 'Default Chime' }], 0)).toBe(device);
  });
});
