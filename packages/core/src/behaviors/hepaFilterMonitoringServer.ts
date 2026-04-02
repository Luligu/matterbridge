/**
 * This file contains the MatterbridgeHepaFilterMonitoringServer class of Matterbridge.
 *
 * @file hepaFilterMonitoringServer.ts
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

import { HepaFilterMonitoringServer } from '@matter/node/behaviors/hepa-filter-monitoring';
import { HepaFilterMonitoring } from '@matter/types/clusters/hepa-filter-monitoring';
import { ResourceMonitoring } from '@matter/types/clusters/resource-monitoring';

import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';
import { MatterbridgeServer } from './matterbridgeServer.js';

/**
 * HEPA filter monitoring server that forwards reset commands and updates condition state.
 */
export class MatterbridgeHepaFilterMonitoringServer extends HepaFilterMonitoringServer.with(ResourceMonitoring.Feature.Condition) {
  /**
   * Resets filter condition to 100%.
   */
  override async resetCondition(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Resetting condition (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('HepaFilterMonitoring.resetCondition', {
      command: 'resetCondition',
      request: {},
      cluster: MatterbridgeHepaFilterMonitoringServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof HepaFilterMonitoring.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    this.state.condition = 100;
    this.state.lastChangedTime = Math.floor(new Date().getTime() / 1000);
    device.log.debug(`MatterbridgeHepaFilterMonitoringServer: resetCondition called`);
  }
}
