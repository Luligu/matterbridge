/**
 * This file contains the MatterbridgeLevelControlServer class of Matterbridge.
 *
 * @file levelControlServer.ts
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

import { LevelControlServer } from '@matter/node/behaviors/level-control';
import { LevelControl } from '@matter/types/clusters/level-control';

import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';
import { MatterbridgeServer } from './matterbridgeServer.js';

/**
 * LevelControl server that forwards level commands to the Matterbridge command handler.
 */
export class MatterbridgeLevelControlServer extends LevelControlServer {
  /**
   * Forwards MoveToLevel requests to the Matterbridge command handler.
   *
   * @param {LevelControl.MoveToLevelRequest} request - Move-to-level request payload.
   */
  override async moveToLevel(request: LevelControl.MoveToLevelRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Setting level to ${request.level} with transitionTime ${request.transitionTime} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('LevelControl.moveToLevel', {
      command: 'moveToLevel',
      request,
      cluster: LevelControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof LevelControl.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeLevelControlServer: moveToLevel called`);
    await super.moveToLevel(request);
  }

  /**
   * Forwards MoveToLevelWithOnOff requests to the Matterbridge command handler.
   *
   * @param {LevelControl.MoveToLevelRequest} request - Move-to-level request payload.
   */
  override async moveToLevelWithOnOff(request: LevelControl.MoveToLevelRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Setting level to ${request.level} with transitionTime ${request.transitionTime} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('LevelControl.moveToLevelWithOnOff', {
      command: 'moveToLevelWithOnOff',
      request,
      cluster: LevelControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof LevelControl.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeLevelControlServer: moveToLevelWithOnOff called`);
    await super.moveToLevelWithOnOff(request);
  }
}
