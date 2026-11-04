/**
 * @file packages/core/buntest/behaviors/clients.test.ts
 * @description This file contains the bun tests for the client cluster helpers.
 * @author Luca Liguori
 */

const NAME = 'ClientsBehavior';

import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test';

import { ChimeClient } from '@matter/node/behaviors/chime';
import { WebRtcTransportProviderClient } from '@matter/node/behaviors/web-rtc-transport-provider';
import { WebRtcTransportRequestorClient } from '@matter/node/behaviors/web-rtc-transport-requestor';
import { Chime } from '@matter/types/clusters/chime';
import { Identify } from '@matter/types/clusters/identify';
import { WebRtcTransportProvider } from '@matter/types/clusters/web-rtc-transport-provider';
import { WebRtcTransportRequestor } from '@matter/types/clusters/web-rtc-transport-requestor';
import { createTestEnvironment, destroyTestEnvironment } from '@matterbridge/test-utils/buntest/matter';
import { loggerErrorSpy, loggerFatalSpy, loggerWarnSpy, setupTest } from '@matterbridge/test-utils/buntest/setup';

import { MatterbridgeBindingServer } from '../../src/behaviors/bindingServer.js';
import { addChimeClient, addWebRtcTransportProviderClient, addWebRtcTransportRequestorClient } from '../../src/behaviors/clients.js';
import { Camera } from '../../src/devices/camera.js';
import { Intercom } from '../../src/devices/intercom.js';
import { doorbell } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';

await setupTest(NAME, false);

/**
 * Returns the Binding server clientList option of an endpoint.
 *
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to read.
 * @returns {number[]} The clientList option, or an empty list when the option is not set.
 */
const clientListOf = (endpoint: MatterbridgeEndpoint): number[] => (endpoint.behaviors.optionsFor(MatterbridgeBindingServer) as { clientList?: number[] })?.clientList ?? [];

const helpers = [
  ['addChimeClient', addChimeClient, Chime.id, 'chime', ChimeClient],
  ['addWebRtcTransportRequestorClient', addWebRtcTransportRequestorClient, WebRtcTransportRequestor.id, 'webRtcTransportRequestor', WebRtcTransportRequestorClient],
  ['addWebRtcTransportProviderClient', addWebRtcTransportProviderClient, WebRtcTransportProvider.id, 'webRtcTransportProvider', WebRtcTransportProviderClient],
] as const;

// The helpers only configure endpoints that are never added to a node, so the suite needs no server node.
describe('client cluster helpers', () => {
  beforeAll(async () => {
    await createTestEnvironment();
  });

  afterEach(() => {
    expect(loggerWarnSpy).not.toHaveBeenCalled();
    expect(loggerErrorSpy).not.toHaveBeenCalled();
    expect(loggerFatalSpy).not.toHaveBeenCalled();
  });

  afterAll(async () => {
    await destroyTestEnvironment();
  });

  test.each(helpers)('%s creates, merges into or reuses the Binding server clientList', (name, addClient, clusterId, clusterName, client) => {
    // No Binding server yet: one is created and the client cluster is registered.
    const created = new MatterbridgeEndpoint([doorbell], { id: `${name}Create` });
    expect(created.behaviors.has(MatterbridgeBindingServer)).toBeFalsy();
    expect(addClient(created)).toBe(created);
    expect(created.behaviors.has(MatterbridgeBindingServer)).toBeTruthy();
    expect(clientListOf(created)).toEqual([clusterId]);
    expect(created.type.clientClusters[clusterName]).toBe(client);
    // Called again: no duplicate entry.
    expect(addClient(created)).toBe(created);
    expect(clientListOf(created)).toEqual([clusterId]);

    // An existing clientList is extended.
    const merged = new MatterbridgeEndpoint([doorbell], { id: `${name}Merge` });
    merged.behaviors.require(MatterbridgeBindingServer, { clientList: [Identify.id] });
    expect(addClient(merged)).toBe(merged);
    expect(clientListOf(merged)).toEqual([Identify.id, clusterId]);

    // An existing Binding server without a clientList option gets one.
    const noOptions = new MatterbridgeEndpoint([doorbell], { id: `${name}NoOptions` });
    noOptions.behaviors.require(MatterbridgeBindingServer);
    expect(addClient(noOptions)).toBe(noOptions);
    expect(clientListOf(noOptions)).toEqual([clusterId]);
  });

  test('the device classes already register their client clusters', () => {
    const camera = new Camera('Clients WebRtc', 'CLIENTS-WEBRTC');
    expect(addWebRtcTransportRequestorClient(camera)).toBe(camera);
    expect(clientListOf(camera)).toEqual([WebRtcTransportRequestor.id]);

    const intercom = new Intercom('Clients WebRtc Provider', 'CLIENTS-WEBRTC-PROVIDER');
    expect(addWebRtcTransportProviderClient(intercom)).toBe(intercom);
    expect(clientListOf(intercom)).toEqual([WebRtcTransportProvider.id, WebRtcTransportRequestor.id, Chime.id]);
  });
});
