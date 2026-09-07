/**
 * @file vitest/devices/doorbell.test.ts
 * @description This file contains the tests for the Doorbell device.
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
 */

const NAME = 'DoorbellDevice';
const MATTER_PORT = 6006;
const MATTER_CREATE_ONLY = true;

import { ChimeClient } from '@matter/node/behaviors/chime';
import { Chime } from '@matter/types/clusters/chime';
import { Identify } from '@matter/types/clusters/identify';
import { PowerSource } from '@matter/types/clusters/power-source';
import { Switch } from '@matter/types/clusters/switch';
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

import { MatterbridgeBindingServer } from '../../src/behaviors/bindingServer.js';
import { Doorbell } from '../../src/devices/doorbell.js';

await setupTest(NAME);

describe('Doorbell', () => {
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

  it('should create a doorbell device with default options', async () => {
    const device = new Doorbell('Doorbell Default', 'DOORBELL-DEFAULT');
    expect(device.id).toBe('DoorbellDefault-DOORBELL-DEFAULT');
    expect(device.hasClusterServer(Identify.id)).toBeTruthy();
    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();
    expect(device.hasClusterServer(Switch.id)).toBeTruthy();

    // The required Chime client cluster is added automatically and should not trigger a "no client behavior found" warning.
    const clientList = (device.behaviors.optionsFor(MatterbridgeBindingServer) as { clientList?: number[] })?.clientList ?? [];
    expect(clientList).toEqual([Chime.id]);
    expect(device.type.clientClusters['chime']).toBe(ChimeClient);

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(Switch, 'numberOfPositions')).toBe(2);
    expect(device.getAttribute(Switch, 'currentPosition')).toBe(0);
  });

  it('should create a doorbell device with custom identify options', async () => {
    const device = new Doorbell('Doorbell Identify', 'DOORBELL-IDENTIFY', { identifyTime: 5, identifyType: Identify.IdentifyType.VisibleIndicator });
    expect(device.hasClusterServer(Identify.id)).toBeTruthy();

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(Identify, 'identifyTime')).toBe(5);
    expect(device.getAttribute(Identify, 'identifyType')).toBe(Identify.IdentifyType.VisibleIndicator);
  });

  it('should create a doorbell device with a rechargeable power source', async () => {
    const device = new Doorbell('Doorbell Rechargeable', 'DOORBELL-RECHARGEABLE', { powerSourceType: 'Rechargeable' });
    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(PowerSource, 'batChargeLevel')).toBe(PowerSource.BatChargeLevel.Ok);
  });

  it('should create a doorbell device with a replaceable power source', async () => {
    const device = new Doorbell('Doorbell Replaceable', 'DOORBELL-REPLACEABLE', { powerSourceType: 'Replaceable' });
    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(PowerSource, 'batReplacementDescription')).toBe('Battery type');
  });

  it('should create a doorbell device with a battery power source', async () => {
    const device = new Doorbell('Doorbell Battery', 'DOORBELL-BATTERY', { powerSourceType: 'Battery' });
    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(PowerSource, 'batChargeLevel')).toBe(PowerSource.BatChargeLevel.Ok);
  });

  it('should create a doorbell device with no power source', async () => {
    const device = new Doorbell('Doorbell None', 'DOORBELL-NONE', { powerSourceType: 'None' });
    expect(device.hasClusterServer(PowerSource.id)).toBeFalsy();

    expect(await addDevice(aggregator, device)).toBeTruthy();
  });

  it('should trigger a single press switch event', async () => {
    const device = new Doorbell('Doorbell Press', 'DOORBELL-PRESS', { powerSourceType: 'None' });
    expect(await addDevice(aggregator, device)).toBeTruthy();

    expect(await device.triggerSwitchEvent('Single', device.log)).toBeTruthy();
    expect(device.getAttribute(Switch, 'currentPosition')).toBe(0);
  });
});
