/**
 * This file contains the MatterbridgeDeviceEnergyManagementModeServer class of Matterbridge.
 *
 * @file deviceEnergyManagementModeServer.ts
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
import { DeviceEnergyManagementModeServer } from '@matter/node/behaviors/device-energy-management-mode';
import { DeviceEnergyManagement } from '@matter/types/clusters/device-energy-management';
import { DeviceEnergyManagementMode } from '@matter/types/clusters/device-energy-management-mode';
import { ModeBase } from '@matter/types/clusters/mode-base';

import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';
import { MatterbridgeServer } from './matterbridgeServer.js';

/**
 * DeviceEnergyManagementMode server that validates and applies energy optimization modes.
 */
export class MatterbridgeDeviceEnergyManagementModeServer extends DeviceEnergyManagementModeServer {
  /**
   * Validates the requested mode, updates opt-out state, and forwards the request.
   *
   * @param {ModeBase.ChangeToModeRequest} request - Change-to-mode request payload.
   * @returns {Promise<ModeBase.ChangeToModeResponse>} The change-to-mode response.
   */
  override async changeToMode(request: ModeBase.ChangeToModeRequest): Promise<ModeBase.ChangeToModeResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Changing mode to ${request.newMode} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('DeviceEnergyManagementMode.changeToMode', {
      command: 'changeToMode',
      request,
      cluster: DeviceEnergyManagementModeServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DeviceEnergyManagementMode.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    const supported = this.state.supportedModes.find((mode) => mode.mode === request.newMode);
    if (!supported) {
      device.log.error(`MatterbridgeDeviceEnergyManagementModeServer changeToMode called with unsupported newMode: ${request.newMode}`);
      return { status: ModeBase.ModeChangeStatus.UnsupportedMode, statusText: 'Unsupported mode' };
    }
    this.state.currentMode = request.newMode;
    if (supported.modeTags.find((tag) => tag.value === DeviceEnergyManagementMode.ModeTag.NoOptimization)) {
      if (this.endpoint.behaviors.has(DeviceEnergyManagementServer)) {
        await this.endpoint.setStateOf(DeviceEnergyManagementServer.with(DeviceEnergyManagement.Feature.PowerForecastReporting, DeviceEnergyManagement.Feature.PowerAdjustment), {
          optOutState: DeviceEnergyManagement.OptOutState.OptOut,
        });
      }
    } else {
      if (this.endpoint.behaviors.has(DeviceEnergyManagementServer)) {
        await this.endpoint.setStateOf(DeviceEnergyManagementServer.with(DeviceEnergyManagement.Feature.PowerForecastReporting, DeviceEnergyManagement.Feature.PowerAdjustment), {
          optOutState: DeviceEnergyManagement.OptOutState.NoOptOut,
        });
      }
    }
    device.log.debug(`MatterbridgeDeviceEnergyManagementModeServer changeToMode called with newMode ${request.newMode} => ${supported.label}`);
    return await super.changeToMode(request);
  }
}
