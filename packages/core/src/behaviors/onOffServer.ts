/**
 * This file contains the MatterbridgeOnOffServer class of Matterbridge.
 *
 * @file onOffServer.ts
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

import { OnOffServer } from '@matter/node/behaviors/on-off';
import { OnOff } from '@matter/types/clusters/on-off';

import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';
import { MatterbridgeServer } from './matterbridgeServer.js';

/**
 * OnOff server that forwards On/Off commands to the Matterbridge command handler.
 */
export class MatterbridgeOnOffServer extends OnOffServer {
  /**
   * Handles the On command.
   */
  override async on(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Switching device on (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('OnOff.on', {
      command: 'on',
      request: {},
      cluster: OnOffServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof OnOff.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeOnOffServer: on called`);
    await super.on();
  }

  /**
   * Handles the Off command.
   */
  override async off(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Switching device off (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('OnOff.off', {
      command: 'off',
      request: {},
      cluster: OnOffServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof OnOff.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeOnOffServer: off called`);
    await super.off();
  }

  /**
   * Handles the Toggle command.
   */
  override async toggle(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Toggle device on/off (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('OnOff.toggle', {
      command: 'toggle',
      request: {},
      cluster: OnOffServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof OnOff.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeOnOffServer: toggle called`);
    await super.toggle();
  }
}
