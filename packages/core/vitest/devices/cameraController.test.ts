/**
 * @file packages/core/vitest/devices/cameraController.test.ts
 * @description This file contains the tests for the CameraController device.
 * @author Luca Liguori
 */

const NAME = 'CameraControllerDevice';
const MATTER_PORT = 6012;
const MATTER_CREATE_ONLY = true;

import { WebRtcTransportProviderClient } from '@matter/node/behaviors/web-rtc-transport-provider';
import { WebRtcTransportRequestorServer } from '@matter/node/behaviors/web-rtc-transport-requestor';
import { Identify } from '@matter/types/clusters/identify';
import { PowerSource } from '@matter/types/clusters/power-source';
import { WebRtcTransportDefinitions } from '@matter/types/clusters/web-rtc-transport-definitions';
import { WebRtcTransportProvider } from '@matter/types/clusters/web-rtc-transport-provider';
import { WebRtcTransportRequestor } from '@matter/types/clusters/web-rtc-transport-requestor';
import {
  addBridgedDevice,
  aggregator,
  createServerNode,
  createTestEnvironment,
  destroyTestEnvironment,
  flushServerNode,
  startServerNode,
  stopServerNode,
} from '@matterbridge/test-utils/vitest/matter';
import { loggerErrorSpy, loggerFatalSpy, loggerWarnSpy, setupTest } from '@matterbridge/test-utils/vitest/setup';
import { stringify } from 'node-ansi-logger';

import { MatterbridgeBindingServer } from '../../src/behaviors/bindingServer.js';
import { MatterbridgeWebRtcTransportRequestorServer } from '../../src/behaviors/webRtcTransportRequestorServer.js';
import { CameraController } from '../../src/devices/cameraController.js';

// Setup the test environment
await setupTest(NAME, false);

describe('CameraController', () => {
  let defaultDevice: CameraController;

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

  it('should create a camera controller device with default options', async () => {
    const device = new CameraController('Camera Controller Default', 'CAMERACONTROLLER-DEFAULT');
    expect(device.id).toBe('CameraControllerDefault-CAMERACONTROLLER-DEFAULT');
    expect(device.hasClusterServer(Identify.id)).toBeFalsy();
    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();
    // The WebRtcTransportRequestor server cluster is required for this device type (Matter 1.6.0 § 16.8.3).
    expect(device.hasClusterServer(WebRtcTransportRequestor.id)).toBeTruthy();
    expect(device.hasClusterServer(WebRtcTransportProvider.id)).toBeFalsy();

    // The required WebRtcTransportProvider client cluster is added automatically and should not trigger a
    // "no client behavior found" warning.
    const clientList = (device.behaviors.optionsFor(MatterbridgeBindingServer) as { clientList?: number[] })?.clientList ?? [];
    expect(clientList).toEqual([WebRtcTransportProvider.id]);
    expect(device.type.clientClusters['webRtcTransportProvider']).toBe(WebRtcTransportProviderClient);

    expect(await addBridgedDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(WebRtcTransportRequestor, 'currentSessions')).toEqual([]);
  });

  it('should create the default device for the attribute snapshot', async () => {
    defaultDevice = new CameraController('Camera Controller Snapshot', 'CAMERACONTROLLER-SNAPSHOT');
    expect(await addBridgedDevice(aggregator, defaultDevice)).toBeTruthy();
  });

  it('should expose the expected attributes on the device', () => {
    const attributes: {
      clusterName: string;
      clusterId: number;
      attributeName: string;
      attributeId: number;
      attributeValue: string | number | bigint | boolean | object | null | undefined;
    }[] = [];
    defaultDevice.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
      if (attributeValue === undefined) return;
      // Sort arrays for consistent snapshot testing
      if (['serverList', 'clientList', 'partsList', 'attributeList', 'acceptedCommandList', 'generatedCommandList'].includes(attributeName)) {
        const sortedAttributeValue = (attributeValue as number[]).toSorted((a, b) => a - b);
        attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue: sortedAttributeValue });
      } else {
        attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue });
      }
    });
    expect(
      attributes
        .map(
          ({ clusterName, clusterId, attributeName, attributeId, attributeValue }) =>
            `${clusterName}(0x${clusterId.toString(16)}).${attributeName}(0x${attributeId.toString(16)})=${stringify(attributeValue, false)}`,
        )
        .toSorted(),
    ).toEqual(
      [
        'binding(0x1e).acceptedCommandList(0xfff9)=[  ]',
        'binding(0x1e).attributeList(0xfffb)=[ 0, 65528, 65529, 65531, 65532, 65533 ]',
        'binding(0x1e).binding(0x0)=[  ]',
        'binding(0x1e).clusterRevision(0xfffd)=1',
        'binding(0x1e).featureMap(0xfffc)={  }',
        'binding(0x1e).generatedCommandList(0xfff8)=[  ]',
        'bridgedDeviceBasicInformation(0x39).acceptedCommandList(0xfff9)=[  ]',
        'bridgedDeviceBasicInformation(0x39).attributeList(0xfffb)=[ 1, 2, 3, 4, 5, 7, 8, 9, 10, 13, 14, 15, 17, 18, 24, 65528, 65529, 65531, 65532, 65533 ]',
        'bridgedDeviceBasicInformation(0x39).clusterRevision(0xfffd)=6',
        'bridgedDeviceBasicInformation(0x39).configurationVersion(0x18)=1',
        'bridgedDeviceBasicInformation(0x39).featureMap(0xfffc)={ bridgedIcdSupport: false }',
        'bridgedDeviceBasicInformation(0x39).generatedCommandList(0xfff8)=[  ]',
        'bridgedDeviceBasicInformation(0x39).hardwareVersion(0x7)=1',
        "bridgedDeviceBasicInformation(0x39).hardwareVersionString(0x8)='1.0.0'",
        "bridgedDeviceBasicInformation(0x39).nodeLabel(0x5)='Camera Controller Snapshot'",
        'bridgedDeviceBasicInformation(0x39).productId(0x4)=32768',
        "bridgedDeviceBasicInformation(0x39).productLabel(0xe)='Matter Endpoint'",
        "bridgedDeviceBasicInformation(0x39).productName(0x3)='Matterbridge Camera Controller'",
        "bridgedDeviceBasicInformation(0x39).productUrl(0xd)='https://matterbridge.io'",
        'bridgedDeviceBasicInformation(0x39).reachable(0x11)=true',
        "bridgedDeviceBasicInformation(0x39).serialNumber(0xf)='CAMERACONTROLLER-SNAPSHOT'",
        'bridgedDeviceBasicInformation(0x39).softwareVersion(0x9)=1',
        "bridgedDeviceBasicInformation(0x39).softwareVersionString(0xa)='1.0.0'",
        "bridgedDeviceBasicInformation(0x39).uniqueId(0x12)='3a19afa41a973ed774a98ee3fa842a62'",
        'bridgedDeviceBasicInformation(0x39).vendorId(0x2)=65521',
        "bridgedDeviceBasicInformation(0x39).vendorName(0x1)='Matterbridge'",
        'descriptor(0x1d).acceptedCommandList(0xfff9)=[  ]',
        'descriptor(0x1d).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'descriptor(0x1d).clientList(0x2)=[ 1363 ]',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 327, revision: 1 }, { deviceType: 17, revision: 1 }, { deviceType: 19, revision: 3 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: false }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 29, 30, 47, 57, 1364 ]',
        'powerSource(0x2f).acceptedCommandList(0xfff9)=[  ]',
        'powerSource(0x2f).attributeList(0xfffb)=[ 0, 1, 2, 5, 31, 65528, 65529, 65531, 65532, 65533 ]',
        'powerSource(0x2f).clusterRevision(0xfffd)=3',
        "powerSource(0x2f).description(0x2)='AC Power'",
        'powerSource(0x2f).endpointList(0x1f)=[ 3 ]',
        'powerSource(0x2f).featureMap(0xfffc)={ wired: true, battery: false, rechargeable: false, replaceable: false }',
        'powerSource(0x2f).generatedCommandList(0xfff8)=[  ]',
        'powerSource(0x2f).order(0x1)=0',
        'powerSource(0x2f).status(0x0)=1',
        'powerSource(0x2f).wiredCurrentType(0x5)=0',
        'webRtcTransportRequestor(0x554).acceptedCommandList(0xfff9)=[ 0, 1, 2, 3 ]',
        'webRtcTransportRequestor(0x554).attributeList(0xfffb)=[ 0, 65528, 65529, 65531, 65532, 65533 ]',
        'webRtcTransportRequestor(0x554).clusterRevision(0xfffd)=2',
        'webRtcTransportRequestor(0x554).currentSessions(0x0)=[  ]',
        'webRtcTransportRequestor(0x554).featureMap(0xfffc)={  }',
        'webRtcTransportRequestor(0x554).generatedCommandList(0xfff8)=[  ]',
      ].toSorted(),
    );
  });

  it.each([
    ['Rechargeable', PowerSource.BatChargeLevel.Ok],
    ['Replaceable', PowerSource.BatChargeLevel.Ok],
    ['Battery', PowerSource.BatChargeLevel.Ok],
  ] as const)('should create a camera controller device with a %s power source', async (powerSourceType, expectedChargeLevel) => {
    const device = new CameraController(`Camera Controller ${powerSourceType}`, `CAMERACONTROLLER-${powerSourceType.toUpperCase()}`, { powerSourceType });
    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();

    expect(await addBridgedDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(PowerSource, 'batChargeLevel')).toBe(expectedChargeLevel);
  });

  it('should create a camera controller device with a replaceable power source description', async () => {
    const device = new CameraController('Camera Controller Replaceable Description', 'CAMERACONTROLLER-REPLACEABLE-DESCRIPTION', { powerSourceType: 'Replaceable' });

    expect(await addBridgedDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(PowerSource, 'batReplacementDescription')).toBe('Battery type');
  });

  it('should create a camera controller device with no power source', async () => {
    const device = new CameraController('Camera Controller None', 'CAMERACONTROLLER-NONE', { powerSourceType: 'None' });
    expect(device.hasClusterServer(PowerSource.id)).toBeFalsy();

    expect(await addBridgedDevice(aggregator, device)).toBeTruthy();
  });

  it.each(['offer', 'answer', 'iceCandidates', 'end'] as const)('should notify %s subscribers only after the inherited handler succeeds', async (command) => {
    const request = {
      webRtcSessionId: 1,
      sdp: 'sdp',
      iceCandidates: [{ candidate: 'candidate', sdpMid: null, sdpmLineIndex: null }],
      reason: WebRtcTransportDefinitions.WebRtcEndReason.IceFailed,
    };
    const device = new CameraController(`Camera Controller ${command}`, `CAMERACONTROLLER-${command}`);
    expect(await addBridgedDevice(aggregator, device)).toBeTruthy();
    const listener = vi.fn();
    device.subscribeCommand(WebRtcTransportRequestor.id, command, listener);
    const handler = vi.spyOn(WebRtcTransportRequestorServer.prototype, command).mockImplementation(async () => {
      expect(listener).not.toHaveBeenCalled();
    });
    try {
      await device.act(async (agent) => agent.get(MatterbridgeWebRtcTransportRequestorServer)[command](request));
      expect(handler).toHaveBeenCalledWith(request);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ command, cluster: 'webRtcTransportRequestor', request, endpoint: device, context: expect.anything() }));

      listener.mockClear();
      handler.mockRejectedValueOnce(new Error('Rejected signaling'));
      await expect(device.act(async (agent) => agent.get(MatterbridgeWebRtcTransportRequestorServer)[command](request))).rejects.toThrow('Rejected signaling');
      expect(listener).not.toHaveBeenCalled();
    } finally {
      handler.mockRestore();
    }
  });
});
