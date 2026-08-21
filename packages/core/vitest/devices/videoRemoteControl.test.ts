/**
 * @file packages/core/vitest/devices/videoRemoteControl.test.ts
 * @description This file contains the tests for the VideoRemoteControl device.
 * @author Luca Liguori
 */

const NAME = 'VideoRemoteControl';
const MATTER_PORT = 8028;
const MATTER_CREATE_ONLY = true;

// @matter
import { KeypadInputClient } from '@matter/node/behaviors/keypad-input';
import { MediaPlaybackClient } from '@matter/node/behaviors/media-playback';
import { OnOffClient } from '@matter/node/behaviors/on-off';
import { KeypadInput } from '@matter/types/clusters/keypad-input';
import { MediaPlayback } from '@matter/types/clusters/media-playback';
import { OnOff } from '@matter/types/clusters/on-off';
import { PowerSource } from '@matter/types/clusters/power-source';
import { loggerErrorSpy, loggerFatalSpy, loggerWarnSpy, setupTest } from '@matterbridge/vitest-utils';
import {
  addDevice,
  aggregator,
  createServerNode,
  createTestEnvironment,
  deleteDevice,
  destroyTestEnvironment,
  flushServerNode,
  server,
  startServerNode,
  stopServerNode,
} from '@matterbridge/vitest-utils/matter';

import { MatterbridgeBindingServer } from '../../src/behaviors/bindingServer.js';
import { VideoRemoteControl } from '../../src/devices/videoRemoteControl.js';
import { videoRemoteControl } from '../../src/matterbridgeDeviceTypes.js';
import type { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  let device: MatterbridgeEndpoint;

  beforeAll(async () => {
    // Setup the Matter test environment
    await createTestEnvironment();
  });

  beforeEach(() => {
    // Clear all mocks
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
    await createServerNode(MATTER_PORT, videoRemoteControl.code);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('create a video remote control device', () => {
    device = new VideoRemoteControl('VideoRemoteControl Test Device', 'VRC123456');
    expect(device).toBeDefined();
    expect(device.id).toBe('VideoRemoteControlTestDevice-VRC123456');

    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();
    // Defaults to powerSourceType 'Battery'.
    expect(device.getClusterServerOptions(PowerSource.id)).toHaveProperty('batChargeLevel');

    const clientList = (device.getClusterServerOptions(MatterbridgeBindingServer) as { clientList?: number[] } | undefined)?.clientList;
    expect(clientList).toContain(OnOff.id);
    expect(clientList).toContain(MediaPlayback.id);
    expect(clientList).toContain(KeypadInput.id);

    // createDefaultMediaBindingClusterServer populates endpoint.type.clientClusters directly, since these
    // client behaviors have no entry in matterbridgeEndpointHelpers.ts's generic lookup table.
    expect(device.type.clientClusters['onOff']).toBe(OnOffClient);
    expect(device.type.clientClusters['mediaPlayback']).toBe(MediaPlaybackClient);
    expect(device.type.clientClusters['keypadInput']).toBe(KeypadInputClient);
  });

  test('create a video remote control device with powerSourceType None', () => {
    const noneDevice = new VideoRemoteControl('VideoRemoteControl None Device', 'VRC000001', { powerSourceType: 'None' });
    expect(noneDevice.hasClusterServer(PowerSource.id)).toBeFalsy();
  });

  test('add a video remote control device', async () => {
    expect(await addDevice(server, device)).toBeTruthy();
  });

  test('remove the video remote control device', async () => {
    expect(await deleteDevice(server, device)).toBeTruthy();
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
