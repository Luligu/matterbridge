/**
 * @file packages/core/src/behaviors/deviceEnergyManagementModeServer.ts
 * @description This file contains the MatterbridgeDeviceEnergyManagementModeServer class of Matterbridge.
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

import { DeviceEnergyManagementServer } from '@matter/node/behaviors/device-energy-management';
import { DeviceEnergyManagementModeServer } from '@matter/node/behaviors/device-energy-management-mode';
import { DeviceEnergyManagement } from '@matter/types/clusters/device-energy-management';
import { DeviceEnergyManagementMode } from '@matter/types/clusters/device-energy-management-mode';
import { ModeBase } from '@matter/types/clusters/mode-base';

import type { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
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
    device.log.info(`MatterbridgeDeviceEnergyManagementModeServer: changing mode to ${request.newMode} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('DeviceEnergyManagementMode.changeToMode', {
      command: 'changeToMode',
      request,
      cluster: DeviceEnergyManagementModeServer.id,
      attributes: this.state,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    const supported = this.state.supportedModes.find((mode) => mode.mode === request.newMode);
    // Matter 1.6.0 § 1.10.7.1.1: Reject ChangeToMode with UnsupportedMode if NewMode matches no SupportedModes entry.
    if (!supported) {
      device.log.error(
        `MatterbridgeDeviceEnergyManagementModeServer: changeToMode called with unsupported newMode ${request.newMode} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
      return { status: ModeBase.ModeChangeStatus.UnsupportedMode, statusText: 'Unsupported mode' };
    }
    // Matter 1.6.0 § 1.10.7.1.1: Set CurrentMode to NewMode when the transition succeeds.
    this.state.currentMode = request.newMode;
    // Matter 1.6.0 § 9.8.7.1.1: A mode tagged NoOptimization prohibits energy usage optimization, so opt the ESA out of adjustment.
    if (supported.modeTags.find((tag) => tag.value === DeviceEnergyManagementMode.ModeTag.NoOptimization)) {
      if (this.endpoint.behaviors.has(DeviceEnergyManagementServer)) {
        await this.endpoint.setStateOf(DeviceEnergyManagementServer.with(DeviceEnergyManagement.Feature.PowerForecastReporting, DeviceEnergyManagement.Feature.PowerAdjustment), {
          optOutState: DeviceEnergyManagement.OptOutState.OptOut,
        });
      }
    } else {
      // Matter 1.6.0 §§ 9.8.7.1.2-9.8.7.1.4: A mode tagged DeviceOptimization, LocalOptimization, or GridOptimization permits energy usage optimization, so clear the ESA's opt-out.
      if (this.endpoint.behaviors.has(DeviceEnergyManagementServer)) {
        await this.endpoint.setStateOf(DeviceEnergyManagementServer.with(DeviceEnergyManagement.Feature.PowerForecastReporting, DeviceEnergyManagement.Feature.PowerAdjustment), {
          optOutState: DeviceEnergyManagement.OptOutState.NoOptOut,
        });
      }
    }
    device.log.debug(
      `MatterbridgeDeviceEnergyManagementModeServer: changeToMode called with newMode ${request.newMode} => ${supported.label} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    // Matter 1.6.0 § 1.10.7.1.1: Transition into the mode associated with NewMode and respond with Success, or with a product-specific status and StatusText when the device is unable to transition.
    return await super.changeToMode(request);
  }
}
