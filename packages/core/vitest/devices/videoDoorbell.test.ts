/**
 * @file vitest/devices/videoDoorbell.test.ts
 * @description This file contains the tests for the VideoDoorbell device.
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
 */

const NAME = 'VideoDoorbellDevice';
const MATTER_PORT = 6011;
const MATTER_CREATE_ONLY = true;

import { ChimeClient } from '@matter/node/behaviors/chime';
import { WebRtcTransportRequestorClient } from '@matter/node/behaviors/web-rtc-transport-requestor';
import { StreamUsage } from '@matter/types';
import { CameraAvStreamManagement } from '@matter/types/clusters/camera-av-stream-management';
import { Chime } from '@matter/types/clusters/chime';
import { FixedLabel } from '@matter/types/clusters/fixed-label';
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
import { VideoDoorbell } from '../../src/devices/videoDoorbell.js';

await setupTest(NAME);

describe('VideoDoorbell', () => {
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

  it('should create a video doorbell device with default options and the mandatory camera and doorbell', async () => {
    const device = new VideoDoorbell('Video Doorbell Default', 'VIDEO-DOORBELL-DEFAULT');
    expect(device.id).toBe('VideoDoorbellDefault-VIDEO-DOORBELL-DEFAULT');
    expect(device.deviceName).toBe('Video Doorbell Default');
    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();
    expect(device.hasClusterServer(Identify.id)).toBeFalsy();

    const cameraChild = device.getChildEndpointById('Camera');
    expect(cameraChild).toBeDefined();
    expect(cameraChild?.hasClusterServer(Identify.id)).toBeFalsy();
    expect(cameraChild?.hasClusterServer(CameraAvStreamManagement.id)).toBeTruthy();

    // The required WebRtcTransportRequestor client cluster is added automatically on the Camera child endpoint and
    // should not trigger a "no client behavior found" warning.
    const cameraClientList = (cameraChild?.behaviors.optionsFor(MatterbridgeBindingServer) as { clientList?: number[] })?.clientList ?? [];
    expect(cameraClientList).toEqual([WebRtcTransportRequestor.id]);
    expect(cameraChild?.type.clientClusters['webRtcTransportRequestor']).toBe(WebRtcTransportRequestorClient);

    const doorbellChild = device.getChildEndpointById('Doorbell');
    expect(doorbellChild).toBeDefined();
    expect(doorbellChild?.hasClusterServer(Identify.id)).toBeTruthy();
    expect(doorbellChild?.hasClusterServer(Switch.id)).toBeTruthy();

    // The required Chime client cluster is added automatically on the Doorbell child endpoint and should not
    // trigger a "no client behavior found" warning.
    const doorbellClientList = (doorbellChild?.behaviors.optionsFor(MatterbridgeBindingServer) as { clientList?: number[] })?.clientList ?? [];
    expect(doorbellClientList).toEqual([Chime.id]);
    expect(doorbellChild?.type.clientClusters['chime']).toBe(ChimeClient);

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(FixedLabel, 'labelList')).toEqual([{ label: 'composed', value: 'VideoDoorbell' }]);
    expect(cameraChild?.getAttribute(CameraAvStreamManagement, 'maxContentBufferSize')).toBe(4_194_304);
    expect(cameraChild?.getAttribute(CameraAvStreamManagement, 'maxNetworkBandwidth')).toBe(10_000_000);
    expect(doorbellChild?.getAttribute(Switch, 'numberOfPositions')).toBe(2);
    expect(doorbellChild?.getAttribute(Switch, 'currentPosition')).toBe(0);
  });

  it('should create the mandatory doorbell with custom doorbellOptions', async () => {
    const device = new VideoDoorbell('Video Doorbell Doorbell Options', 'VIDEO-DOORBELL-DOORBELL-OPTIONS', {
      doorbellOptions: {
        name: 'Front Doorbell',
        tagList: [{ mfgCode: null, namespaceId: 8, tag: 0, label: 'Front' }],
        identifyTime: 5,
        identifyType: Identify.IdentifyType.VisibleIndicator,
      },
    });
    const doorbellChild = device.getChildEndpointById('FrontDoorbell');
    expect(doorbellChild).toBeDefined();

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(doorbellChild?.getAttribute(Identify, 'identifyTime')).toBe(5);
    expect(doorbellChild?.getAttribute(Identify, 'identifyType')).toBe(Identify.IdentifyType.VisibleIndicator);
  });

  it('should create a video doorbell device with the camera identify enabled', async () => {
    const device = new VideoDoorbell('Video Doorbell Identify', 'VIDEO-DOORBELL-IDENTIFY', {
      cameraOptions: { identifyTime: 5, identifyType: Identify.IdentifyType.VisibleIndicator },
    });
    const cameraChild = device.getChildEndpointById('Camera');
    expect(cameraChild?.hasClusterServer(Identify.id)).toBeTruthy();

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(cameraChild?.getAttribute(Identify, 'identifyTime')).toBe(5);
    expect(cameraChild?.getAttribute(Identify, 'identifyType')).toBe(Identify.IdentifyType.VisibleIndicator);
  });

  it.each([
    ['Rechargeable', PowerSource.BatChargeLevel.Ok],
    ['Replaceable', PowerSource.BatChargeLevel.Ok],
    ['Battery', PowerSource.BatChargeLevel.Ok],
  ] as const)('should create a video doorbell device with a %s power source', async (powerSourceType, expectedChargeLevel) => {
    const device = new VideoDoorbell(`Video Doorbell ${powerSourceType}`, `VIDEO-DOORBELL-${powerSourceType.toUpperCase()}`, { powerSourceType });
    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(PowerSource, 'batChargeLevel')).toBe(expectedChargeLevel);
  });

  it('should create a video doorbell device with no power source', async () => {
    const device = new VideoDoorbell('Video Doorbell None', 'VIDEO-DOORBELL-NONE', { powerSourceType: 'None' });
    expect(device.hasClusterServer(PowerSource.id)).toBeFalsy();

    expect(await addDevice(aggregator, device)).toBeTruthy();
  });

  it('should add additional doorbells with tags and trigger a switch event', async () => {
    const device = new VideoDoorbell('Video Doorbell Multi Doorbell', 'VIDEO-DOORBELL-MULTI-DOORBELL');
    const left = device.addDoorbell('Left Doorbell', [{ mfgCode: null, namespaceId: 8, tag: 0, label: 'Left' }]);
    const right = device.addDoorbell('Right Doorbell', [{ mfgCode: null, namespaceId: 8, tag: 1, label: 'Right' }]);
    expect(left.id).toBe('LeftDoorbell');
    expect(right.id).toBe('RightDoorbell');

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(await left.triggerSwitchEvent('Single', left.log)).toBeTruthy();
    expect(left.getAttribute(Switch, 'currentPosition')).toBe(0);
  });

  it('should create a video doorbell device with custom stream usages on the camera child', async () => {
    const device = new VideoDoorbell('Video Doorbell Custom', 'VIDEO-DOORBELL-CUSTOM', {
      cameraOptions: {
        supportedStreamUsages: [StreamUsage.LiveView],
        streamUsagePriorities: [StreamUsage.LiveView],
      },
    });
    const cameraChild = device.getChildEndpointById('Camera');

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(cameraChild?.getAttribute(CameraAvStreamManagement, 'supportedStreamUsages')).toEqual([StreamUsage.LiveView]);
    expect(cameraChild?.getAttribute(CameraAvStreamManagement, 'streamUsagePriorities')).toEqual([StreamUsage.LiveView]);
  });

  it('should create a video doorbell device with custom werift offer options on the camera child', async () => {
    const weriftOfferOptions: WeriftOfferOptions = { video: true, audio: false, videoSource: 'test', audioSource: 'none', videoResolution: '1280x720' };
    const device = new VideoDoorbell('Video Doorbell Werift', 'VIDEO-DOORBELL-WERIFT', { cameraOptions: { weriftOfferOptions } });

    expect(await addDevice(aggregator, device)).toBeTruthy();
    const cameraChild = device.getChildEndpointById('Camera');
    expect(cameraChild?.stateOf(MatterbridgeWebRtcTransportProviderServer).weriftOfferOptions).toEqual(weriftOfferOptions);
  });
});
