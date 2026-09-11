/**
 * @file vitest/devices/audioDoorbell.test.ts
 * @description This file contains the tests for the AudioDoorbell device.
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
 */

const NAME = 'AudioDoorbellDevice';
const MATTER_PORT = 6008;
const MATTER_CREATE_ONLY = true;

import { ChimeClient } from '@matter/node/behaviors/chime';
import { WebRtcTransportRequestorClient } from '@matter/node/behaviors/web-rtc-transport-requestor';
import { StreamUsage } from '@matter/types';
import { CameraAvStreamManagement } from '@matter/types/clusters/camera-av-stream-management';
import { Chime } from '@matter/types/clusters/chime';
import { Identify } from '@matter/types/clusters/identify';
import { PowerSource } from '@matter/types/clusters/power-source';
import { Switch } from '@matter/types/clusters/switch';
import { WebRtcTransportRequestor } from '@matter/types/clusters/web-rtc-transport-requestor';
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
import { MatterbridgeWebRtcTransportProviderServer } from '../../src/behaviors/webRtcTransportProviderServer.js';
import type { WeriftOfferOptions } from '../../src/behaviors/weriftSession.js';
import { AudioDoorbell } from '../../src/devices/audioDoorbell.js';

await setupTest(NAME);

describe('AudioDoorbell', () => {
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

  it('should create an audio doorbell device with default options', async () => {
    const device = new AudioDoorbell('Audio Doorbell Default', 'AUDIO-DOORBELL-DEFAULT');
    expect(device.id).toBe('AudioDoorbellDefault-AUDIO-DOORBELL-DEFAULT');
    expect(device.hasClusterServer(Identify.id)).toBeTruthy();
    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();
    expect(device.hasClusterServer(Switch.id)).toBeTruthy();
    expect(device.hasClusterServer(CameraAvStreamManagement.id)).toBeTruthy();

    // The required Chime and WebRtcTransportRequestor client clusters are added automatically and should not
    // trigger a "no client behavior found" warning.
    const clientList = (device.behaviors.optionsFor(MatterbridgeBindingServer) as { clientList?: number[] })?.clientList ?? [];
    expect(clientList).toEqual([Chime.id, WebRtcTransportRequestor.id]);
    expect(device.type.clientClusters['chime']).toBe(ChimeClient);
    expect(device.type.clientClusters['webRtcTransportRequestor']).toBe(WebRtcTransportRequestorClient);

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(Switch, 'numberOfPositions')).toBe(2);
    expect(device.getAttribute(Switch, 'currentPosition')).toBe(0);
    expect(device.getAttribute(CameraAvStreamManagement, 'maxContentBufferSize')).toBe(65_536);
    expect(device.getAttribute(CameraAvStreamManagement, 'maxNetworkBandwidth')).toBe(128_000);
    expect(device.getAttribute(CameraAvStreamManagement, 'supportedStreamUsages')).toEqual([StreamUsage.LiveView]);
    expect(device.getAttribute(CameraAvStreamManagement, 'streamUsagePriorities')).toEqual([StreamUsage.LiveView]);
    // A default audio stream is self-allocated on construction (see MatterbridgeCameraAvStreamManagementServer#initialize).
    expect(device.getAttribute(CameraAvStreamManagement, 'allocatedAudioStreams')).toEqual([expect.objectContaining({ audioStreamId: 0, streamUsage: StreamUsage.LiveView })]);
    expect(device.getAttribute(CameraAvStreamManagement, 'microphoneCapabilities')).toEqual({
      maxNumberOfChannels: 1,
      supportedCodecs: [CameraAvStreamManagement.AudioCodec.Opus],
      supportedSampleRates: [48000],
      supportedBitDepths: [16],
    });
  });

  it('should create an audio doorbell device with custom identify options', async () => {
    const device = new AudioDoorbell('Audio Doorbell Identify', 'AUDIO-DOORBELL-IDENTIFY', { identifyTime: 5, identifyType: Identify.IdentifyType.VisibleIndicator });
    expect(device.hasClusterServer(Identify.id)).toBeTruthy();

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(Identify, 'identifyTime')).toBe(5);
    expect(device.getAttribute(Identify, 'identifyType')).toBe(Identify.IdentifyType.VisibleIndicator);
  });

  it.each([
    ['Rechargeable', PowerSource.BatChargeLevel.Ok],
    ['Replaceable', PowerSource.BatChargeLevel.Ok],
    ['Battery', PowerSource.BatChargeLevel.Ok],
  ] as const)('should create an audio doorbell device with a %s power source', async (powerSourceType, expectedChargeLevel) => {
    const device = new AudioDoorbell(`Audio Doorbell ${powerSourceType}`, `AUDIO-DOORBELL-${powerSourceType.toUpperCase()}`, { powerSourceType });
    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(PowerSource, 'batChargeLevel')).toBe(expectedChargeLevel);
  });

  it('should create an audio doorbell device with no power source', async () => {
    const device = new AudioDoorbell('Audio Doorbell None', 'AUDIO-DOORBELL-NONE', { powerSourceType: 'None' });
    expect(device.hasClusterServer(PowerSource.id)).toBeFalsy();

    expect(await addDevice(aggregator, device)).toBeTruthy();
  });

  it('should trigger a single press switch event', async () => {
    const device = new AudioDoorbell('Audio Doorbell Press', 'AUDIO-DOORBELL-PRESS', { powerSourceType: 'None' });
    expect(await addDevice(aggregator, device)).toBeTruthy();

    expect(await device.triggerSwitchEvent('Single', device.log)).toBeTruthy();
    expect(device.getAttribute(Switch, 'currentPosition')).toBe(0);
  });

  it('should create an audio doorbell device with custom stream usages', async () => {
    const device = new AudioDoorbell('Audio Doorbell Custom', 'AUDIO-DOORBELL-CUSTOM', {
      supportedStreamUsages: [StreamUsage.LiveView, StreamUsage.Recording],
      streamUsagePriorities: [StreamUsage.LiveView, StreamUsage.Recording],
    });

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(CameraAvStreamManagement, 'supportedStreamUsages')).toEqual([StreamUsage.LiveView, StreamUsage.Recording]);
    expect(device.getAttribute(CameraAvStreamManagement, 'streamUsagePriorities')).toEqual([StreamUsage.LiveView, StreamUsage.Recording]);
  });

  it('should create an audio doorbell device with custom werift offer options', async () => {
    const weriftOfferOptions: WeriftOfferOptions = { video: false, audio: true, videoSource: 'none', audioSource: 'test' };
    const device = new AudioDoorbell('Audio Doorbell Werift', 'AUDIO-DOORBELL-WERIFT', { weriftOfferOptions });

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.stateOf(MatterbridgeWebRtcTransportProviderServer).weriftOfferOptions).toEqual(weriftOfferOptions);
  });
});
