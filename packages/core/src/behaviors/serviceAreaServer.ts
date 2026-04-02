/**
 * This file contains the MatterbridgeServiceAreaServer class of Matterbridge.
 *
 * @file serviceAreaServer.ts
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

import { ServiceAreaServer } from '@matter/node/behaviors/service-area';
import { ServiceArea } from '@matter/types/clusters/service-area';

import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';
import { MatterbridgeServer } from './matterbridgeServer.js';

/**
 * ServiceArea server that validates and applies selected areas.
 */
export class MatterbridgeServiceAreaServer extends ServiceAreaServer {
  /**
   * Validates area IDs, updates selectedAreas, and forwards the request.
   *
   * @param {ServiceArea.SelectAreasRequest} request - Select-areas request payload.
   * @returns {Promise<ServiceArea.SelectAreasResponse>} The select-areas response.
   */
  override async selectAreas(request: ServiceArea.SelectAreasRequest): Promise<ServiceArea.SelectAreasResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Selecting areas [${request.newAreas.join(', ')}] (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('ServiceArea.selectAreas', {
      command: 'selectAreas',
      request,
      cluster: ServiceAreaServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ServiceArea.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeServiceAreaServer selectAreas called with: [${request.newAreas.join(', ')}]`);
    return await super.selectAreas(request);
  }
}
