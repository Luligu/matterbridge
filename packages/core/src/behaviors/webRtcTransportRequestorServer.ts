/**
 * @file src/behaviors/webRtcTransportRequestorServer.ts
 * @description This file contains the helper that creates a default WebRtcTransportRequestor cluster server on a MatterbridgeEndpoint.
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
 * @created 2026-07-20
 * @version 1.0.0
 * @license Apache-2.0
 *
 * Copyright 2026, 2027, 2028 Luca Liguori.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { WebRtcTransportRequestorServer } from '@matter/node/behaviors/web-rtc-transport-requestor';

import type { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';

/**
 * Creates a default WebRtcTransportRequestor cluster server on the given endpoint, using matter.js's own default
 * implementation directly (no Matterbridge specialization is needed): it validates incoming Offer/Answer/
 * IceCandidates/End invokes against the session's originating fabric and peer node, tracks live sessions in the
 * currentSessions attribute, and re-emits the signaling through its Events observables, so a real WebRTC peer
 * connection could be driven from those events. This example does not subscribe to those events, so it only
 * bookkeeps sessions without applying the signaling to a real peer connection; see
 * `MatterbridgeWebRtcTransportProviderServer` in `src/behaviors/webRtcTransportProviderServer.ts` for the provider
 * side, which does drive a real werift peer connection.
 *
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to create the WebRtcTransportRequestor cluster server on.
 * @returns {MatterbridgeEndpoint} The endpoint with the WebRtcTransportRequestor cluster server created.
 */
export function createDefaultWebRtcTransportRequestorClusterServer(endpoint: MatterbridgeEndpoint): MatterbridgeEndpoint {
  endpoint.behaviors.require(WebRtcTransportRequestorServer, { currentSessions: [] });
  return endpoint;
}
