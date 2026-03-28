/**
 * This file contains the MatterbridgeValveConfigurationAndControlServer class of Matterbridge.
 *
 * @file valveConfigurationAndControlServer.ts
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

import { ValveConfigurationAndControlServer } from '@matter/node/behaviors/valve-configuration-and-control';
import { ValveConfigurationAndControl } from '@matter/types/clusters/valve-configuration-and-control';

import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';
import { MatterbridgeServer } from './matterbridgeServer.js';

/**
 * ValveConfigurationAndControl server that forwards valve commands to the Matterbridge command handler.
 */
export class MatterbridgeValveConfigurationAndControlServer extends ValveConfigurationAndControlServer.with(ValveConfigurationAndControl.Feature.Level) {
  /**
   * Forwards Open requests to the Matterbridge command handler and updates valve state.
   *
   * @param {ValveConfigurationAndControl.OpenRequest} request - Open request payload.
   */
  override async open(request: ValveConfigurationAndControl.OpenRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Opening valve to ${request.targetLevel ? request.targetLevel + '%' : 'fully opened'} ${request.openDuration ? 'for ' + request.openDuration + 's' : 'until closed'} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('ValveConfigurationAndControl.open', {
      command: 'open',
      request,
      cluster: ValveConfigurationAndControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ValveConfigurationAndControl.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeValveConfigurationAndControlServer: open called with openDuration: ${request.openDuration} targetLevel: ${request.targetLevel}`);
    this.state.targetState = ValveConfigurationAndControl.ValveState.Open;
    this.state.currentState = ValveConfigurationAndControl.ValveState.Open;
    this.state.targetLevel = request.targetLevel ?? 100;
    this.state.currentLevel = request.targetLevel ?? 100;
    this.state.openDuration = request.openDuration ?? this.state.defaultOpenDuration;
    if (this.state.openDuration === null) this.state.remainingDuration = null;
  }

  /**
   * Handles the Close command.
   */
  override async close(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Closing valve (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('ValveConfigurationAndControl.close', {
      command: 'close',
      request: {},
      cluster: ValveConfigurationAndControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ValveConfigurationAndControl.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeValveConfigurationAndControlServer: close called`);
    this.state.targetState = ValveConfigurationAndControl.ValveState.Closed;
    this.state.currentState = ValveConfigurationAndControl.ValveState.Closed;
    this.state.targetLevel = 0;
    this.state.currentLevel = 0;
    this.state.openDuration = null;
    this.state.remainingDuration = null;
  }
}
