/**
 * This file contains the MatterbridgeModeSelectServer class of Matterbridge.
 *
 * @file modeSelectServer.ts
 * @author Luca Liguori
 * @created 2026-03-28
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

import { ModeSelectServer } from '@matter/node/behaviors/mode-select';
import { ModeSelect } from '@matter/types/clusters/mode-select';

import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';
import { MatterbridgeServer } from './matterbridgeServer.js';

/**
 * ModeSelect server that forwards mode changes to the Matterbridge command handler.
 */
export class MatterbridgeModeSelectServer extends ModeSelectServer {
  /**
   * Forwards ChangeToMode requests to the Matterbridge command handler.
   *
   * @param {ModeSelect.ChangeToModeRequest} request - Change-to-mode request payload.
   */
  override async changeToMode(request: ModeSelect.ChangeToModeRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Changing mode to ${request.newMode} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('ModeSelect.changeToMode', {
      command: 'changeToMode',
      request,
      cluster: ModeSelectServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ModeSelect.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeModeSelectServer: changeToMode called with mode: ${request.newMode}`);
    await super.changeToMode(request);
  }
}
