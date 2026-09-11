/**
 * @file vitest/devices/floodlightCamera.test.ts
 * @description This file contains the tests for the FloodlightCamera device.
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
 */

const NAME = 'FloodlightCameraDevice';
const MATTER_PORT = 6004;
const MATTER_CREATE_ONLY = true;

import { WebRtcTransportRequestorClient } from '@matter/node/behaviors/web-rtc-transport-requestor';
import { StreamUsage } from '@matter/types';
import { CameraAvStreamManagement } from '@matter/types/clusters/camera-av-stream-management';
import { FixedLabel } from '@matter/types/clusters/fixed-label';
import { Identify } from '@matter/types/clusters/identify';
import { OnOff } from '@matter/types/clusters/on-off';
import { PowerSource } from '@matter/types/clusters/power-source';
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
import { FloodlightCamera } from '../../src/devices/floodlightCamera.js';

await setupTest(NAME);

describe('FloodlightCamera', () => {
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

  it('should create a floodlight camera device with default options and the mandatory light', async () => {
    const device = new FloodlightCamera('Floodlight Camera Default', 'FLOODLIGHT-CAMERA-DEFAULT');
    expect(device.id).toBe('FloodlightCameraDefault-FLOODLIGHT-CAMERA-DEFAULT');
    expect(device.deviceName).toBe('Floodlight Camera Default');
    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();
    expect(device.hasClusterServer(Identify.id)).toBeFalsy();

    const light = device.getChildEndpointById('Light');
    expect(light).toBeDefined();
    expect(light?.hasClusterServer(Identify.id)).toBeTruthy();
    expect(light?.hasClusterServer(OnOff.id)).toBeTruthy();

    const cameraChild = device.getChildEndpointById('Camera');
    expect(cameraChild).toBeDefined();
    expect(cameraChild?.hasClusterServer(Identify.id)).toBeFalsy();
    expect(cameraChild?.hasClusterServer(CameraAvStreamManagement.id)).toBeTruthy();

    // The required WebRtcTransportRequestor client cluster is added automatically on the Camera child endpoint and
    // should not trigger a "no client behavior found" warning.
    const clientList = (cameraChild?.behaviors.optionsFor(MatterbridgeBindingServer) as { clientList?: number[] })?.clientList ?? [];
    expect(clientList).toEqual([WebRtcTransportRequestor.id]);
    expect(cameraChild?.type.clientClusters['webRtcTransportRequestor']).toBe(WebRtcTransportRequestorClient);

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(FixedLabel, 'labelList')).toEqual([{ label: 'composed', value: 'FloodlightCamera' }]);
    expect(light?.getAttribute(OnOff, 'onOff')).toBe(false);
    expect(cameraChild?.getAttribute(CameraAvStreamManagement, 'maxContentBufferSize')).toBe(4_194_304);
    expect(cameraChild?.getAttribute(CameraAvStreamManagement, 'maxNetworkBandwidth')).toBe(10_000_000);
  });

  it('should create the mandatory light with custom lightOptions', async () => {
    const device = new FloodlightCamera('Floodlight Camera Light Options', 'FLOODLIGHT-CAMERA-LIGHT-OPTIONS', {
      lightOptions: { name: 'Front Floodlight', tagList: [{ mfgCode: null, namespaceId: 8, tag: 0, label: 'Front' }], onOff: true },
    });
    const light = device.getChildEndpointById('FrontFloodlight');
    expect(light).toBeDefined();

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(light?.getAttribute(OnOff, 'onOff')).toBe(true);
  });

  it('should create a floodlight camera device with the camera identify enabled', async () => {
    const device = new FloodlightCamera('Floodlight Camera Identify', 'FLOODLIGHT-CAMERA-IDENTIFY', {
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
  ] as const)('should create a floodlight camera device with a %s power source', async (powerSourceType, expectedChargeLevel) => {
    const device = new FloodlightCamera(`Floodlight Camera ${powerSourceType}`, `FLOODLIGHT-CAMERA-${powerSourceType.toUpperCase()}`, { powerSourceType });
    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(PowerSource, 'batChargeLevel')).toBe(expectedChargeLevel);
  });

  it('should create a floodlight camera device with no power source', async () => {
    const device = new FloodlightCamera('Floodlight Camera None', 'FLOODLIGHT-CAMERA-NONE', { powerSourceType: 'None' });
    expect(device.hasClusterServer(PowerSource.id)).toBeFalsy();

    expect(await addDevice(aggregator, device)).toBeTruthy();
  });

  it('should add additional lights with tags and a custom initial state', async () => {
    const device = new FloodlightCamera('Floodlight Camera Multi Light', 'FLOODLIGHT-CAMERA-MULTI-LIGHT');
    const left = device.addLight('Left Floodlight', [{ mfgCode: null, namespaceId: 8, tag: 0, label: 'Left' }], true);
    const right = device.addLight('Right Floodlight', [{ mfgCode: null, namespaceId: 8, tag: 1, label: 'Right' }]);
    expect(left.id).toBe('LeftFloodlight');
    expect(right.id).toBe('RightFloodlight');

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(left.getAttribute(OnOff, 'onOff')).toBe(true);
    expect(right.getAttribute(OnOff, 'onOff')).toBe(false);
  });

  it('should create a floodlight camera device with custom stream usages on the camera child', async () => {
    const device = new FloodlightCamera('Floodlight Camera Custom', 'FLOODLIGHT-CAMERA-CUSTOM', {
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

  it('should create a floodlight camera device with custom werift offer options on the camera child', async () => {
    const weriftOfferOptions: WeriftOfferOptions = { video: true, audio: false, videoSource: 'test', audioSource: 'none', videoResolution: '1280x720' };
    const device = new FloodlightCamera('Floodlight Camera Werift', 'FLOODLIGHT-CAMERA-WERIFT', { cameraOptions: { weriftOfferOptions } });

    expect(await addDevice(aggregator, device)).toBeTruthy();
    const cameraChild = device.getChildEndpointById('Camera');
    expect(cameraChild?.stateOf(MatterbridgeWebRtcTransportProviderServer).weriftOfferOptions).toEqual(weriftOfferOptions);
  });
});
