/**
 * @file packages/core/src/behaviors/waterTankLevelMonitoringServer.ts
 * @description This file contains the MatterbridgeWaterTankLevelMonitoringServer class of Matterbridge.
 * @author Luca Liguori
 * @created 2026-09-01
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

import { WaterTankLevelMonitoringServer } from '@matter/node/behaviors/water-tank-level-monitoring';
import { ResourceMonitoring } from '@matter/types/clusters/resource-monitoring';
import type { WaterTankLevelMonitoring } from '@matter/types/clusters/water-tank-level-monitoring';

import type { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';
import { MatterbridgeServer } from './matterbridgeServer.js';

/**
 * Water tank level monitoring server that forwards reset commands and updates condition state.
 */
export class MatterbridgeWaterTankLevelMonitoringServer extends WaterTankLevelMonitoringServer.with(
  ResourceMonitoring.Feature.Condition,
  ResourceMonitoring.Feature.Warning,
  ResourceMonitoring.Feature.ReplacementProductList,
) {
  /**
   * Resets the water tank condition to 100%.
   */
  override async resetCondition(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeWaterTankLevelMonitoringServer: resetting condition (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('WaterTankLevelMonitoring.resetCondition', {
      command: 'resetCondition',
      request: {},
      cluster: MatterbridgeWaterTankLevelMonitoringServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof WaterTankLevelMonitoring)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    // Matter 1.6.0 § 2.8.7.1: Reset Condition and ChangeIndicator to indicate full resource availability, as initially configured.
    this.state.condition = 100;
    this.state.changeIndication = ResourceMonitoring.ChangeIndication.Ok;
    // Matter 1.6.0 § 2.8.7.1: Invocation of this command may update LastChangedTime based on the server's clock.
    this.state.lastChangedTime = Math.floor(new Date().getTime() / 1000);
    device.log.debug(`MatterbridgeWaterTankLevelMonitoringServer: resetCondition called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
  }
}
