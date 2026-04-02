/**
 * This file contains the MatterbridgeThermostatServer and MatterbridgePresetThermostatServer classes of Matterbridge.
 *
 * @file thermostatServer.ts
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

import { ThermostatServer } from '@matter/node/behaviors/thermostat';
import { Thermostat } from '@matter/types/clusters/thermostat';

import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';
import { MatterbridgeServer } from './matterbridgeServer.js';

/**
 * Thermostat server (cooling/heating/auto/presets) with Matterbridge-specific command handling.
 */
export class MatterbridgeThermostatServer extends ThermostatServer.with(
  Thermostat.Feature.Cooling,
  Thermostat.Feature.Heating,
  Thermostat.Feature.AutoMode,
  Thermostat.Feature.Presets,
) {
  /**
   * Initializes thermostat behavior and adjusts command lists to avoid unsupported atomic commands.
   */
  override async initialize() {
    await super.initialize();

    this.endpoint.construction.onSuccess(async () => {
      const device = this.endpoint.stateOf(MatterbridgeServer);
      device.log.debug(`Removing atomic commands (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
      // @ts-expect-error cause acceptedCommandList and generatedCommandList are not typed in the cluster state
      await this.endpoint.setStateOf(ThermostatServer, {
        acceptedCommandList: [0],
        generatedCommandList: [],
      });
    });
  }

  /**
   * Forwards SetpointRaiseLower requests to the Matterbridge command handler and updates occupied setpoints.
   *
   * @param {Thermostat.SetpointRaiseLowerRequest} request - Setpoint-raise/lower request payload.
   */
  override async setpointRaiseLower(request: Thermostat.SetpointRaiseLowerRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Setting setpoint by ${request.amount} in mode ${request.mode} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('Thermostat.setpointRaiseLower', {
      command: 'setpointRaiseLower',
      request,
      cluster: ThermostatServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof Thermostat.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    const lookupSetpointAdjustMode = ['Heat', 'Cool', 'Both'];
    device.log.debug(`MatterbridgeThermostatServer: setpointRaiseLower called with mode: ${lookupSetpointAdjustMode[request.mode]} amount: ${request.amount / 10}`);
    await super.setpointRaiseLower(request);
  }

  /**
   * Forwards SetActivePresetRequest requests to the Matterbridge command handler.
   *
   * @param {Thermostat.SetActivePresetRequest} request - Set-active-preset request payload.
   */
  override async setActivePresetRequest(request: Thermostat.SetActivePresetRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    const presetHandle = request.presetHandle ? `0x${Buffer.from(request.presetHandle).toString('hex')}` : 'null';
    device.log.info(`Setting preset to ${presetHandle} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('Thermostat.setActivePresetRequest', {
      command: 'setActivePresetRequest',
      request,
      cluster: ThermostatServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof Thermostat.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeThermostatServer: setActivePresetRequest called with presetHandle: ${presetHandle}`);
    await super.setActivePresetRequest(request);
    const activePresetHandle = this.state.activePresetHandle ? `0x${Buffer.from(this.state.activePresetHandle).toString('hex')}` : 'null';
    device.log.debug(
      `MatterbridgeThermostatServer: setActivePresetRequest completed with activePresetHandle: ${activePresetHandle} occupiedHeatingSetpoint: ${this.state.occupiedHeatingSetpoint} occupiedCoolingSetpoint: ${this.state.occupiedCoolingSetpoint}`,
    );
  }
}

/**
 * Thermostat server with Presets feature enabled and Matterbridge-specific command handling.
 *
 * @deprecated This server is deprecated in favor of using MatterbridgeThermostatServer with the Presets feature.
 */
export class MatterbridgePresetThermostatServer extends ThermostatServer.with(
  Thermostat.Feature.Presets,
  Thermostat.Feature.Cooling,
  Thermostat.Feature.Heating,
  Thermostat.Feature.AutoMode,
) {}
