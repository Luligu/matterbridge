/**
 * This file contains the MatterbridgeDeviceEnergyManagementServer class of Matterbridge.
 *
 * @file deviceEnergyManagementServer.ts
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

import { DeviceEnergyManagementServer } from '@matter/node/behaviors/device-energy-management';
import { DeviceEnergyManagement } from '@matter/types/clusters/device-energy-management';

import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';
import { MatterbridgeServer } from './matterbridgeServer.js';

/**
 * DeviceEnergyManagement server forwarding energy management commands to the Matterbridge command handler.
 */
export class MatterbridgeDeviceEnergyManagementServer extends DeviceEnergyManagementServer.with(
  DeviceEnergyManagement.Feature.PowerForecastReporting,
  DeviceEnergyManagement.Feature.PowerAdjustment,
) {
  /**
   * Forwards PowerAdjustRequest requests to the Matterbridge command handler.
   *
   * @param {DeviceEnergyManagement.PowerAdjustRequest} request - Power-adjust request payload.
   */
  override async powerAdjustRequest(request: DeviceEnergyManagement.PowerAdjustRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Adjusting power to ${request.power} duration ${request.duration} cause ${request.cause} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('DeviceEnergyManagement.powerAdjustRequest', {
      command: 'powerAdjustRequest',
      request,
      cluster: DeviceEnergyManagementServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DeviceEnergyManagement.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeDeviceEnergyManagementServer powerAdjustRequest called with power ${request.power} duration ${request.duration} cause ${request.cause}`);
  }

  /**
   * Cancels an in-progress power adjustment.
   */
  override async cancelPowerAdjustRequest(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Cancelling power adjustment (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('DeviceEnergyManagement.cancelPowerAdjustRequest', {
      command: 'cancelPowerAdjustRequest',
      request: {},
      cluster: DeviceEnergyManagementServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DeviceEnergyManagement.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeDeviceEnergyManagementServer cancelPowerAdjustRequest called`);
  }
}
