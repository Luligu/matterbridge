/**
 * @file packages/core/src/behaviors/serviceAreaServer.ts
 * @description This file contains the MatterbridgeServiceAreaServer class of Matterbridge.
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

/* oxlint-disable typescript/no-unsafe-type-assertion */

import { ServiceAreaServer } from '@matter/node/behaviors/service-area';
import { ServiceArea } from '@matter/types/clusters/service-area';

import type { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';
import { MatterbridgeServer } from './matterbridgeServer.js';

/**
 * ServiceArea server that validates and applies selected areas.
 */
export class MatterbridgeServiceAreaServer extends ServiceAreaServer.with(ServiceArea.Feature.ProgressReporting) {
  /** The endpoint that owns this behavior. Narrowed to MatterbridgeEndpoint: this server is only ever added to a Matterbridge endpoint. */
  declare readonly endpoint: MatterbridgeEndpoint;

  /**
   * Validates area IDs, updates selectedAreas, and forwards the request.
   *
   * @param {ServiceArea.SelectAreasRequest} request - Select-areas request payload.
   * @returns {Promise<ServiceArea.SelectAreasResponse>} The select-areas response.
   */
  override async selectAreas(request: ServiceArea.SelectAreasRequest): Promise<ServiceArea.SelectAreasResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeServiceAreaServer: selecting areas [${request.newAreas.join(', ')}] (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('ServiceArea.selectAreas', {
      command: 'selectAreas',
      request,
      cluster: ServiceAreaServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ServiceArea)['attributes']>,
      endpoint: this.endpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeServiceAreaServer: selectAreas called with [${request.newAreas.join(', ')}] (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 1.17.7.1.2: Reject the request with UnsupportedArea, InvalidSet or InvalidInMode as applicable, otherwise respond Success and set SelectedAreas to the NewAreas value.
    const response = await super.selectAreas(request);
    // matter.js reports a rejected SelectAreas through the response status, so only a successful one is emitted.
    if (response.status === ServiceArea.SelectAreasStatus.Success) this.endpoint.emitCommand(ServiceArea, 'selectAreas', request, this.context);
    return response;
  }

  /**
   * Validates the skipped area, marks it Skipped in the progress list when supported, and forwards the request.
   *
   * @param {ServiceArea.SkipAreaRequest} request - Skip-area request payload.
   * @returns {Promise<ServiceArea.SkipAreaResponse>} The skip-area response.
   *
   * @remarks
   * CurrentArea handling after a skip is plugin/device specific and is intentionally left untouched here.
   */
  override async skipArea(request: ServiceArea.SkipAreaRequest): Promise<ServiceArea.SkipAreaResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeServiceAreaServer: skipping area ${request.skippedArea} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('ServiceArea.skipArea', {
      command: 'skipArea',
      request,
      cluster: ServiceAreaServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ServiceArea)['attributes']>,
      endpoint: this.endpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeServiceAreaServer: skipArea called with ${request.skippedArea} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 1.17.7.3: Reject the request with InvalidAreaList or InvalidSkippedArea as applicable, otherwise respond Success.
    const result = this.assertSkipServiceArea(request);
    // ProgressReporting may not be enabled on this instance, so progress can be undefined.
    if (result.status === ServiceArea.SkipAreaStatus.Success && this.state.progress !== undefined) {
      this.state.progress = this.state.progress.map((area) =>
        area.areaId === request.skippedArea
          ? { areaId: area.areaId, status: ServiceArea.OperationalStatus.Skipped, totalOperationalTime: area.totalOperationalTime, estimatedTime: area.estimatedTime }
          : area,
      );
    }
    return result;
  }
}
