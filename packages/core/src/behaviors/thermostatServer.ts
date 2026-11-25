/**
 * @file packages/core/src/behaviors/thermostatServer.ts
 * @description This file contains the MatterbridgeThermostatServer class.
 * @author Luca Liguori
 * @created 2026-03-28
 * @version 1.0.1
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

import { ThermostatServer } from '@matter/node/behaviors/thermostat';
import { Thermostat } from '@matter/types/clusters/thermostat';

import type { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';
import { MatterbridgeServer } from './matterbridgeServer.js';

/**
 * Thermostat server (cooling/heating/auto/presets/schedules/suggestions) with Matterbridge-specific command handling.
 */
export class MatterbridgeThermostatServer extends ThermostatServer.with(
  Thermostat.Feature.Cooling,
  Thermostat.Feature.Heating,
  Thermostat.Feature.AutoMode,
  Thermostat.Feature.Presets,
  Thermostat.Feature.MatterScheduleConfiguration,
  Thermostat.Feature.ThermostatSuggestions,
) {
  /** The endpoint that owns this behavior. Narrowed to MatterbridgeEndpoint: this server is only ever added to a Matterbridge endpoint. */
  declare readonly endpoint: MatterbridgeEndpoint;

  /**
   * Forwards SetpointRaiseLower requests to the Matterbridge command handler and updates occupied setpoints.
   *
   * @param {Thermostat.SetpointRaiseLowerRequest} request - Setpoint-raise/lower request payload.
   */
  override async setpointRaiseLower(request: Thermostat.SetpointRaiseLowerRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeThermostatServer: setting setpoint by ${request.amount} in mode ${request.mode} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('Thermostat.setpointRaiseLower', {
      command: 'setpointRaiseLower',
      request,
      cluster: ThermostatServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof Thermostat)['attributes']>,
      endpoint: this.endpoint,
      context: this.context,
    });
    const lookupSetpointAdjustMode = ['Heat', 'Cool', 'Both'];
    device.log.debug(
      `MatterbridgeThermostatServer: setpointRaiseLower called with mode: ${lookupSetpointAdjustMode[request.mode]} amount: ${request.amount / 10} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    // Matter 1.6.1 § 4.3.12.1.3: Add Amount to the setpoints indicated by Mode, clamping the result to the MinCoolSetpointLimit, MaxCoolSetpointLimit, MinHeatSetpointLimit and MaxHeatSetpointLimit limits.
    await super.setpointRaiseLower(request);
    this.endpoint.emitCommand(Thermostat, 'setpointRaiseLower', request, this.context);
  }

  /**
   * Forwards SetActivePresetRequest requests to the Matterbridge command handler.
   *
   * @param {Thermostat.SetActivePresetRequest} request - Set-active-preset request payload.
   */
  override async setActivePresetRequest(request: Thermostat.SetActivePresetRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    const presetHandle = request.presetHandle ? `0x${Buffer.from(request.presetHandle).toString('hex')}` : 'null';
    device.log.info(`MatterbridgeThermostatServer: setting preset to ${presetHandle} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('Thermostat.setActivePresetRequest', {
      command: 'setActivePresetRequest',
      request,
      cluster: ThermostatServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof Thermostat)['attributes']>,
      endpoint: this.endpoint,
      context: this.context,
    });
    device.log.debug(
      `MatterbridgeThermostatServer: setActivePresetRequest called with presetHandle: ${presetHandle} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    // Matter 1.6.1 § 4.3.12.3.2: Clear ActivePresetHandle when PresetHandle is null, otherwise reject an unknown handle with INVALID_COMMAND, set ActivePresetHandle and adjust the setpoints to the preset.
    await super.setActivePresetRequest(request);
    const activePresetHandle = this.state.activePresetHandle ? `0x${Buffer.from(this.state.activePresetHandle).toString('hex')}` : 'null';
    device.log.debug(
      `MatterbridgeThermostatServer: setActivePresetRequest completed with activePresetHandle: ${activePresetHandle} occupiedHeatingSetpoint: ${this.state.occupiedHeatingSetpoint} occupiedCoolingSetpoint: ${this.state.occupiedCoolingSetpoint} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    this.endpoint.emitCommand(Thermostat, 'setActivePresetRequest', request, this.context);
  }

  /**
   * Forwards SetActiveScheduleRequest requests to the Matterbridge command handler, then delegates to matter.js to validate
   * the handle and set ActiveScheduleHandle.
   *
   * @param {Thermostat.SetActiveScheduleRequest} request - Set-active-schedule request payload.
   *
   * @remarks
   * matter.js only stores ActiveScheduleHandle: it does not run the schedule. Plugins that run schedules must apply each
   * transition themselves: its preset (ActivePresetHandle), system mode or setpoints.
   */
  override async setActiveScheduleRequest(request: Thermostat.SetActiveScheduleRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    const scheduleHandle = `0x${Buffer.from(request.scheduleHandle).toString('hex')}`;
    device.log.info(`MatterbridgeThermostatServer: setting schedule to ${scheduleHandle} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('Thermostat.setActiveScheduleRequest', {
      command: 'setActiveScheduleRequest',
      request,
      cluster: ThermostatServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof Thermostat)['attributes']>,
      endpoint: this.endpoint,
      context: this.context,
    });
    // Matter 1.6.1 § 4.3.12.2.2: Reject an unknown schedule handle and store the matching handle as ActiveScheduleHandle.
    await super.setActiveScheduleRequest(request);
    device.log.debug(
      `MatterbridgeThermostatServer: setActiveScheduleRequest completed with activeScheduleHandle: ${scheduleHandle} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    this.endpoint.emitCommand(Thermostat, 'setActiveScheduleRequest', request, this.context);
  }

  /**
   * Forwards AddThermostatSuggestion requests to the Matterbridge command handler, then delegates to matter.js to validate
   * and append the suggestion and re-evaluate CurrentThermostatSuggestion.
   *
   * @param {Thermostat.AddThermostatSuggestionRequest} request - Add-thermostat-suggestion request payload.
   * @returns {Promise<Thermostat.AddThermostatSuggestionResponse>} The generated UniqueID of the added suggestion.
   *
   * @remarks
   * The plugin handler is a notification only: it runs before validation, and the suggestion may become effective later.
   * Following a suggestion activates its preset without calling setActivePresetRequest, so plugins observe the resulting
   * ActivePresetHandle and setpoint changes through attribute subscriptions.
   */
  override async addThermostatSuggestion(request: Thermostat.AddThermostatSuggestionRequest): Promise<Thermostat.AddThermostatSuggestionResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    const presetHandle = `0x${Buffer.from(request.presetHandle).toString('hex')}`;
    device.log.info(`MatterbridgeThermostatServer: adding thermostat suggestion for preset ${presetHandle} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('Thermostat.addThermostatSuggestion', {
      command: 'addThermostatSuggestion',
      request,
      cluster: ThermostatServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof Thermostat)['attributes']>,
      endpoint: this.endpoint,
      context: this.context,
    });
    // Matter 1.6.1 § 4.3.12.4.4: Validate and append the suggestion, then re-evaluate which suggestion to follow.
    const response = await super.addThermostatSuggestion(request);
    device.log.debug(
      `MatterbridgeThermostatServer: addThermostatSuggestion completed with uniqueId: ${response.uniqueId} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    this.endpoint.emitCommand(Thermostat, 'addThermostatSuggestion', request, this.context);
    return response;
  }

  /**
   * Forwards RemoveThermostatSuggestion requests to the Matterbridge command handler, then delegates to matter.js to
   * remove the suggestion and re-evaluate CurrentThermostatSuggestion.
   *
   * @param {Thermostat.RemoveThermostatSuggestionRequest} request - Remove-thermostat-suggestion request payload.
   *
   * @remarks
   * The plugin handler is a notification only: it runs before validation. Removing the current suggestion may activate
   * the preset of another suggestion that becomes current; with none, ActivePresetHandle stays as it is. Plugins observe
   * the resulting changes through attribute subscriptions.
   */
  override async removeThermostatSuggestion(request: Thermostat.RemoveThermostatSuggestionRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeThermostatServer: removing thermostat suggestion ${request.uniqueId} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('Thermostat.removeThermostatSuggestion', {
      command: 'removeThermostatSuggestion',
      request,
      cluster: ThermostatServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof Thermostat)['attributes']>,
      endpoint: this.endpoint,
      context: this.context,
    });
    // Matter 1.6.1 § 4.3.12.6.2: Reject an unknown UniqueID, otherwise remove the suggestion and re-evaluate.
    await super.removeThermostatSuggestion(request);
    device.log.debug(
      `MatterbridgeThermostatServer: removeThermostatSuggestion completed for uniqueId: ${request.uniqueId} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    this.endpoint.emitCommand(Thermostat, 'removeThermostatSuggestion', request, this.context);
  }
}
