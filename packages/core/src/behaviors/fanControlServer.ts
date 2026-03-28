/**
 * This file contains the MatterbridgeFanControlServer class of Matterbridge.
 *
 * @file fanControlServer.ts
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

import { FanControlServer } from '@matter/node/behaviors/fan-control';
import { FanControl } from '@matter/types/clusters/fan-control';

import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';
import { MatterbridgeServer } from './matterbridgeServer.js';

/**
 * FanControl server (auto + step) that forwards step commands to the Matterbridge command handler.
 */
export class MatterbridgeFanControlServer extends FanControlServer.with(FanControl.Feature.Auto, FanControl.Feature.Step) {
  /**
   * Forwards Step requests to the Matterbridge command handler and updates percentCurrent.
   *
   * @param {FanControl.StepRequest} request - Step request payload.
   */
  override async step(request: FanControl.StepRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Stepping fan with direction ${request.direction} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('FanControl.step', {
      command: 'step',
      request,
      cluster: FanControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof FanControl.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });

    const lookupStepDirection = ['Increase', 'Decrease'];
    device.log.debug(`MatterbridgeFanControlServer: step called with direction: ${lookupStepDirection[request.direction]} wrap: ${request.wrap} lowestOff: ${request.lowestOff}`);
    device.log.debug(`- current percentCurrent: ${this.state.percentCurrent}`);

    if (request.direction === FanControl.StepDirection.Increase) {
      if (request.wrap && this.state.percentCurrent === 100) {
        this.state.percentCurrent = request.lowestOff ? 0 : 10;
      } else this.state.percentCurrent = Math.min(this.state.percentCurrent + 10, 100);
    } else if (request.direction === FanControl.StepDirection.Decrease) {
      if (request.wrap && this.state.percentCurrent === (request.lowestOff ? 0 : 10)) {
        this.state.percentCurrent = 100;
      } else this.state.percentCurrent = Math.max(this.state.percentCurrent - 10, request.lowestOff ? 0 : 10);
    }
    device.log.debug('Set percentCurrent to:', this.state.percentCurrent);

    // step is not implemented in matter.js
    // await super.step(request);
  }
}
