/**
 * This file contains the MatterbridgeIdentifyServer class of Matterbridge.
 *
 * @file identifyServer.ts
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

import { IdentifyServer } from '@matter/node/behaviors/identify';
import { Identify } from '@matter/types/clusters/identify';

import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';
import { MatterbridgeServer } from './matterbridgeServer.js';

/**
 * Identify server that forwards Identify commands to the Matterbridge command handler.
 */
export class MatterbridgeIdentifyServer extends IdentifyServer {
  /**
   * Forwards Identify requests to the Matterbridge command handler.
   *
   * @param {Identify.IdentifyRequest} request - Identify request payload.
   */
  override async identify(request: Identify.IdentifyRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Identifying device for ${request.identifyTime} seconds (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('Identify.identify', {
      command: 'identify',
      request,
      cluster: IdentifyServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof Identify.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeIdentifyServer: identify called`);
    await super.identify(request);
  }

  /**
   * Forwards TriggerEffect requests to the Matterbridge command handler.
   *
   * @param {Identify.TriggerEffectRequest} request - Trigger-effect request payload.
   */
  override async triggerEffect(request: Identify.TriggerEffectRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Triggering effect ${request.effectIdentifier} variant ${request.effectVariant} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('Identify.triggerEffect', {
      command: 'triggerEffect',
      request,
      cluster: IdentifyServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof Identify.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeIdentifyServer: triggerEffect called`);
    await super.triggerEffect(request);
  }
}
