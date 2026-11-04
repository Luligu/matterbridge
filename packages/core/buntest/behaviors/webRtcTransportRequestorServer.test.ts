/**
 * @file packages/core/buntest/behaviors/webRtcTransportRequestorServer.test.ts
 * @description This file contains the bun tests for webRtcTransportRequestorServer.
 * @author Luca Liguori
 */

const NAME = 'WebRtcTransportRequestorServerBehavior';
const MATTER_PORT = 6007;

import { afterEach, describe, expect, spyOn, test, vi } from 'bun:test';

import { WebRtcTransportRequestorServer } from '@matter/node/behaviors/web-rtc-transport-requestor';
import { WebRtcTransportDefinitions } from '@matter/types/clusters/web-rtc-transport-definitions';
import { WebRtcTransportRequestor } from '@matter/types/clusters/web-rtc-transport-requestor';
import { addBridgedDevice, aggregator } from '@matterbridge/test-utils/buntest/matter';
import { loggerErrorSpy, loggerFatalSpy, loggerWarnSpy, setupTest } from '@matterbridge/test-utils/buntest/setup';

import { createDefaultWebRtcTransportRequestorClusterServer, MatterbridgeWebRtcTransportRequestorServer } from '../../src/behaviors/webRtcTransportRequestorServer.js';
import { Intercom } from '../../src/devices/intercom.js';
import { intercom } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';
import { useServerNode } from '../bunUtils.js';

await setupTest(NAME, false);

/** The payload used for all the signaling commands: each command reads only the fields it needs. */
const request = {
  webRtcSessionId: 1,
  sdp: 'sdp',
  iceCandidates: [{ candidate: 'candidate', sdpMid: null, sdpmLineIndex: null }],
  reason: WebRtcTransportDefinitions.WebRtcEndReason.IceFailed,
};
const commands = ['offer', 'answer', 'iceCandidates', 'end'] as const;

describe('MatterbridgeWebRtcTransportRequestorServer', () => {
  useServerNode(MATTER_PORT);
  let device: Intercom;

  afterEach(() => {
    expect(loggerWarnSpy).not.toHaveBeenCalled();
    expect(loggerErrorSpy).not.toHaveBeenCalled();
    expect(loggerFatalSpy).not.toHaveBeenCalled();
  });

  test('the Intercom device and the helper install the server with no tracked sessions', async () => {
    device = new Intercom('WebRtc Requestor Behavior', 'WEBRTC-REQUESTOR-BEHAVIOR');
    expect(device.behaviors.has(MatterbridgeWebRtcTransportRequestorServer)).toBeTruthy();
    expect(await addBridgedDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(device.getAttribute(WebRtcTransportRequestor, 'currentSessions')).toEqual([]);

    // The helper on a plain endpoint, checked without adding it to the server.
    const endpoint = new MatterbridgeEndpoint(intercom, { id: 'WebRtcRequestorClusterServer' });
    expect(createDefaultWebRtcTransportRequestorClusterServer(endpoint)).toBe(endpoint);
    expect(endpoint.behaviors.has(MatterbridgeWebRtcTransportRequestorServer)).toBeTruthy();
  });

  test.each(commands)('%s notifies the subscribers only after the inherited handler succeeds', async (command) => {
    const listener = vi.fn();
    device.subscribeCommand(WebRtcTransportRequestor, command, listener, device.log);
    // The inherited handler needs an authenticated remote session, so it is replaced: the observable must follow it.
    const handler = spyOn(WebRtcTransportRequestorServer.prototype, command).mockImplementation(async () => {
      expect(listener).not.toHaveBeenCalled();
    });
    const invoke = async (): Promise<void> => device.act(async (agent) => agent.get(MatterbridgeWebRtcTransportRequestorServer)[command](request));
    try {
      await invoke();
      expect(handler).toHaveBeenCalledWith(request);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({ command, cluster: 'webRtcTransportRequestor', request, endpoint: device, context: expect.anything() });

      // Rejected by the inherited handler: not announced.
      listener.mockClear();
      handler.mockRejectedValueOnce(new Error('Rejected signaling'));
      expect(invoke()).rejects.toThrow('Rejected signaling');
      expect(listener).not.toHaveBeenCalled();
    } finally {
      handler.mockRestore();
    }

    // The real inherited handler rejects without a remote session: not announced either.
    expect(invoke()).rejects.toThrow('This operation requires an authenticated remote session');
    expect(listener).not.toHaveBeenCalled();
  });
});
