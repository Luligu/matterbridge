/**
 * @file vitest/devices/chime.test.ts
 * @description This file contains the tests for the Chime device.
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
 */

const NAME = 'ChimeDevice';
const MATTER_PORT = 6001;
const MATTER_CREATE_ONLY = true;

import { Chime as ChimeCluster } from '@matter/types/clusters/chime';
import { Identify } from '@matter/types/clusters/identify';
import { PowerSource } from '@matter/types/clusters/power-source';
import { loggerErrorSpy, loggerFatalSpy, loggerWarnSpy, setupTest } from '@matterbridge/vitest-utils';
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

import { Chime, createDefaultChimeClusterServer } from '../../src/devices/chime.js';

await setupTest(NAME);

describe('Chime', () => {
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

  it('should create a chime device with default options', async () => {
    const device = new Chime('Chime Default', 'CHIME-DEFAULT');
    expect(device.id).toBe('ChimeDefault-CHIME-DEFAULT');
    expect(device.hasClusterServer(Identify.id)).toBeFalsy();
    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();
    expect(device.hasClusterServer(ChimeCluster.id)).toBeTruthy();

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(ChimeCluster, 'installedChimeSounds')).toEqual([{ chimeId: 0, name: 'Default Chime' }]);
    expect(device.getAttribute(ChimeCluster, 'selectedChime')).toBe(0);
    expect(device.getAttribute(ChimeCluster, 'enabled')).toBe(true);
  });

  it('should create a chime device with identify enabled', async () => {
    const device = new Chime('Chime Identify', 'CHIME-IDENTIFY', { identifyTime: 5, identifyType: Identify.IdentifyType.AudibleBeep });
    expect(device.hasClusterServer(Identify.id)).toBeTruthy();

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(Identify, 'identifyTime')).toBe(5);
    expect(device.getAttribute(Identify, 'identifyType')).toBe(Identify.IdentifyType.AudibleBeep);
  });

  it('should create a chime device with a rechargeable power source', async () => {
    const device = new Chime('Chime Rechargeable', 'CHIME-RECHARGEABLE', { powerSourceType: 'Rechargeable' });
    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(PowerSource, 'batChargeLevel')).toBe(PowerSource.BatChargeLevel.Ok);
  });

  it('should create a chime device with a replaceable power source', async () => {
    const device = new Chime('Chime Replaceable', 'CHIME-REPLACEABLE', { powerSourceType: 'Replaceable' });
    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(PowerSource, 'batReplacementDescription')).toBe('Battery type');
  });

  it('should create a chime device with a battery power source', async () => {
    const device = new Chime('Chime Battery', 'CHIME-BATTERY', { powerSourceType: 'Battery' });
    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(PowerSource, 'batChargeLevel')).toBe(PowerSource.BatChargeLevel.Ok);
  });

  it('should create a chime device with no power source', async () => {
    const device = new Chime('Chime None', 'CHIME-NONE', { powerSourceType: 'None' });
    expect(device.hasClusterServer(PowerSource.id)).toBeFalsy();

    expect(await addDevice(aggregator, device)).toBeTruthy();
  });

  it('should create a chime device with custom chime sounds', async () => {
    const device = new Chime('Chime Custom', 'CHIME-CUSTOM', {
      installedChimeSounds: [
        { chimeId: 0, name: 'Default Chime' },
        { chimeId: 1, name: 'Chime 1' },
      ],
      selectedChime: 1,
      enabled: false,
    });

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(ChimeCluster, 'installedChimeSounds')).toEqual([
      { chimeId: 0, name: 'Default Chime' },
      { chimeId: 1, name: 'Chime 1' },
    ]);
    expect(device.getAttribute(ChimeCluster, 'selectedChime')).toBe(1);
    expect(device.getAttribute(ChimeCluster, 'enabled')).toBe(false);
  });

  it('should add createDefaultChimeClusterServer to an endpoint', () => {
    const device = new Chime('Chime Helper', 'CHIME-HELPER', { powerSourceType: 'None' });
    // The constructor already creates the Chime cluster server; calling the helper again should return the same endpoint.
    expect(createDefaultChimeClusterServer(device, [{ chimeId: 0, name: 'Default Chime' }], 0)).toBe(device);
  });
});
