/**
 * @file vitest/devices/cameraController.test.ts
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
import { WebRtcTransportProvider } from '@matter/types/clusters/web-rtc-transport-provider';
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
import { MatterbridgeWebRtcTransportRequestorServer } from '../../src/behaviors/webRtcTransportRequestorServer.js';
import { CameraController } from '../../src/devices/cameraController.js';

await setupTest(NAME);

describe('CameraController', () => {
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

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(WebRtcTransportRequestor, 'currentSessions')).toEqual([]);
  });

  it.each([
    ['Rechargeable', PowerSource.BatChargeLevel.Ok],
    ['Replaceable', PowerSource.BatChargeLevel.Ok],
    ['Battery', PowerSource.BatChargeLevel.Ok],
  ] as const)('should create a camera controller device with a %s power source', async (powerSourceType, expectedChargeLevel) => {
    const device = new CameraController(`Camera Controller ${powerSourceType}`, `CAMERACONTROLLER-${powerSourceType.toUpperCase()}`, { powerSourceType });
    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(PowerSource, 'batChargeLevel')).toBe(expectedChargeLevel);
  });

  it('should create a camera controller device with a replaceable power source description', async () => {
    const device = new CameraController('Camera Controller Replaceable Description', 'CAMERACONTROLLER-REPLACEABLE-DESCRIPTION', { powerSourceType: 'Replaceable' });

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(PowerSource, 'batReplacementDescription')).toBe('Battery type');
  });

  it('should create a camera controller device with no power source', async () => {
    const device = new CameraController('Camera Controller None', 'CAMERACONTROLLER-NONE', { powerSourceType: 'None' });
    expect(device.hasClusterServer(PowerSource.id)).toBeFalsy();

    expect(await addDevice(aggregator, device)).toBeTruthy();
  });

  it.each(['offer', 'answer', 'iceCandidates', 'end'] as const)('should notify %s subscribers only after the inherited handler succeeds', async (command) => {
    const request = { webRtcSessionId: 1, sdp: 'sdp', iceCandidates: [{ candidate: 'candidate', sdpMid: null, sdpmLineIndex: null }], reason: 0 };
    const device = new CameraController(`Camera Controller ${command}`, `CAMERACONTROLLER-${command}`);
    expect(await addDevice(aggregator, device)).toBeTruthy();
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
