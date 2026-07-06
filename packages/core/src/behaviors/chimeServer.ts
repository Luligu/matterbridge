/**
 * @file packages/core/src/behaviors/chimeServer.ts
 * @description This file contains the MatterbridgeChimeServer class of Matterbridge.
 * @author Luca Liguori
 * @created 2026-07-06
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

/* oxlint-disable typescript/no-unsafe-type-assertion */

import { ChimeServer } from '@matter/node/behaviors/chime';
import type { Chime } from '@matter/types/clusters/chime';

import type { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';
import { MatterbridgeServer } from './matterbridgeServer.js';

/**
 * Chime server that forwards the PlayChimeSound command to the Matterbridge command handler and generates the ChimeStartedPlaying event.
 */
export class MatterbridgeChimeServer extends ChimeServer {
  /**
   * Handles the PlayChimeSound command.
   * Plays the chime sound passed in the request or, if none is passed, the currently selected chime, and generates the ChimeStartedPlaying event.
   *
   * @param {Chime.PlayChimeSoundRequest} request - PlayChimeSound request payload.
   */
  override async playChimeSound(request: Chime.PlayChimeSoundRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    const chimeId = request.chimeId ?? this.state.selectedChime;
    device.log.info(`Playing chime sound ${chimeId} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('Chime.playChimeSound', {
      command: 'playChimeSound',
      request,
      cluster: ChimeServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof Chime)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeChimeServer: playChimeSound called with chimeId ${chimeId}`);
    this.events.chimeStartedPlaying.emit({ chimeId }, this.context);
  }
}
