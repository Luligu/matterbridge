/**
 * This file contains the MatterbridgeBooleanStateConfigurationServer class of Matterbridge.
 *
 * @file booleanStateConfigurationServer.ts
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

import { BooleanStateConfigurationServer } from '@matter/node/behaviors/boolean-state-configuration';
import { BooleanStateConfiguration } from '@matter/types/clusters/boolean-state-configuration';

import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';
import { MatterbridgeServer } from './matterbridgeServer.js';

/**
 * BooleanStateConfiguration server that forwards alarm control commands to the Matterbridge command handler.
 */
export class MatterbridgeBooleanStateConfigurationServer extends BooleanStateConfigurationServer.with(
  BooleanStateConfiguration.Feature.Visual,
  BooleanStateConfiguration.Feature.Audible,
  BooleanStateConfiguration.Feature.SensitivityLevel,
) {
  /**
   * Forwards EnableDisableAlarm requests to the Matterbridge command handler.
   *
   * @param {BooleanStateConfiguration.EnableDisableAlarmRequest} request - Enable/disable-alarm request payload.
   */
  override async enableDisableAlarm(request: BooleanStateConfiguration.EnableDisableAlarmRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Enabling/disabling alarm ${request.alarmsToEnableDisable} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('BooleanStateConfiguration.enableDisableAlarm', {
      command: 'enableDisableAlarm',
      request,
      cluster: BooleanStateConfigurationServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof BooleanStateConfiguration.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeBooleanStateConfigurationServer: enableDisableAlarm called`);
  }
}
