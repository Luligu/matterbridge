/**
 * @file vitest/behaviors/webRtcTransportRequestorServer.test.ts
 * @description This file contains the tests for the MatterbridgeWebRtcTransportRequestorServer behavior.
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
 */

const NAME = 'WebRtcTransportRequestorServerBehavior';
const MATTER_PORT = 6007;
const MATTER_CREATE_ONLY = true;

import { WebRtcTransportRequestorServer } from '@matter/node/behaviors/web-rtc-transport-requestor';
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

import { createDefaultWebRtcTransportRequestorClusterServer, MatterbridgeWebRtcTransportRequestorServer } from '../../src/behaviors/webRtcTransportRequestorServer.js';
import { Intercom } from '../../src/devices/intercom.js';
import { intercom } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';

await setupTest(NAME);

/** The payload used for all the signaling commands: each command reads only the fields it needs. */
const request = { webRtcSessionId: 1, sdp: 'sdp', iceCandidates: [{ candidate: 'candidate', sdpMid: null, sdpmLineIndex: null }], reason: 0 };

describe('MatterbridgeWebRtcTransportRequestorServer', () => {
  let device: Intercom;

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

  it('should create and register an intercom device using the MatterbridgeWebRtcTransportRequestorServer behavior', async () => {
    device = new Intercom('WebRtc Requestor Behavior', 'WEBRTC-REQUESTOR-BEHAVIOR');
    expect(device.behaviors.has(MatterbridgeWebRtcTransportRequestorServer)).toBeTruthy();

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(WebRtcTransportRequestor, 'currentSessions')).toEqual([]);
  });

  it('should create the cluster server with no tracked sessions on a plain endpoint', async () => {
    const endpoint = new MatterbridgeEndpoint(intercom, { id: 'WebRtcRequestorClusterServer' });
    expect(createDefaultWebRtcTransportRequestorClusterServer(endpoint)).toBe(endpoint);
    expect(endpoint.behaviors.has(MatterbridgeWebRtcTransportRequestorServer)).toBeTruthy();

    expect(await addDevice(aggregator, endpoint)).toBeTruthy();
    expect(endpoint.getAttribute(WebRtcTransportRequestor, 'currentSessions')).toEqual([]);
  });

  it.each(['offer', 'answer', 'iceCandidates', 'end'] as const)('should notify the %s subscribers only after the inherited handler succeeds', async (command) => {
    const listener = vi.fn();
    device.subscribeCommand(WebRtcTransportRequestor, command, listener, device.log);

    // The inherited handler needs an authenticated remote session to resolve the session id, so it is replaced here:
    // the command observable must be emitted after it, never before.
    const handler = vi.spyOn(WebRtcTransportRequestorServer.prototype, command).mockImplementation(async () => {
      expect(listener).not.toHaveBeenCalled();
    });

    try {
      await device.act(async (agent) => agent.get(MatterbridgeWebRtcTransportRequestorServer)[command](request));

      expect(handler).toHaveBeenCalledWith(request);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({ command, cluster: 'webRtcTransportRequestor', request, endpoint: device, context: expect.anything() });

      // A command rejected by the inherited handler does not notify the subscribers.
      listener.mockClear();
      handler.mockRejectedValueOnce(new Error('Rejected signaling'));
      await expect(device.act(async (agent) => agent.get(MatterbridgeWebRtcTransportRequestorServer)[command](request))).rejects.toThrow('Rejected signaling');

      expect(listener).not.toHaveBeenCalled();
    } finally {
      handler.mockRestore();
    }
  });

  it.each(['offer', 'answer', 'iceCandidates', 'end'] as const)('should not notify the %s subscribers when the inherited handler has no remote session', async (command) => {
    const listener = vi.fn();
    device.subscribeCommand(WebRtcTransportRequestor, command, listener, device.log);

    await expect(device.act(async (agent) => agent.get(MatterbridgeWebRtcTransportRequestorServer)[command](request))).rejects.toThrow(
      'This operation requires an authenticated remote session',
    );

    expect(listener).not.toHaveBeenCalled();
  });
});
