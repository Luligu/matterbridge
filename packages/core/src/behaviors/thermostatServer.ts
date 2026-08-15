/**
 * @file packages/core/src/behaviors/thermostatServer.ts
 * @description This file contains the MatterbridgeThermostatServer and MatterbridgePresetThermostatServer classes of Matterbridge.
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

import { Bytes } from '@matter/general';
import { ThermostatServer } from '@matter/node/behaviors/thermostat';
import { StatusResponse } from '@matter/types';
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
      attributes: this.state as unknown as ClusterAttributeValues<(typeof Thermostat)['attributes']>,
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
      attributes: this.state as unknown as ClusterAttributeValues<(typeof Thermostat)['attributes']>,
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

  /**
   * Forwards SetActiveScheduleRequest requests to the Matterbridge command handler and updates the active schedule handle.
   *
   * @param {Thermostat.SetActiveScheduleRequest} request - Set-active-schedule request payload.
   *
   * @remarks
   * matter.js does not yet provide a default implementation of this command (the MatterScheduleConfiguration feature
   * is not implemented by `ThermostatServer` in `@matter/node`), so validation and state handling are done here.
   */
  override async setActiveScheduleRequest(request: Thermostat.SetActiveScheduleRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    const scheduleHandle = `0x${Buffer.from(request.scheduleHandle).toString('hex')}`;
    device.log.info(`Setting schedule to ${scheduleHandle} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('Thermostat.setActiveScheduleRequest', {
      command: 'setActiveScheduleRequest',
      request,
      cluster: ThermostatServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof Thermostat)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    const schedule = this.state.schedules.find((s) => s.scheduleHandle !== null && Bytes.areEqual(s.scheduleHandle, request.scheduleHandle));
    if (schedule === undefined) {
      throw new StatusResponse.InvalidCommandError('Requested ScheduleHandle not found');
    }
    this.state.activeScheduleHandle = Uint8Array.from(request.scheduleHandle);
    device.log.debug(`MatterbridgeThermostatServer: setActiveScheduleRequest completed with activeScheduleHandle: ${scheduleHandle}`);
  }

  /**
   * Removes expired entries (ExpirationTime at or before now) from ThermostatSuggestions, mirroring
   * `RemoveExpiredSuggestions()` in connectedhomeip's `src/app/clusters/thermostat-server/ThermostatClusterSuggestions.cpp`.
   */
  private removeExpiredThermostatSuggestions(): void {
    const now = Math.floor(Date.now() / 1000);
    this.state.thermostatSuggestions = this.state.thermostatSuggestions.filter((s) => s.expirationTime > now);
  }

  /**
   * Re-evaluates CurrentThermostatSuggestion, mirroring `ReEvaluateCurrentSuggestion()` in connectedhomeip's
   * `examples/thermostat/thermostat-common/src/thermostat-delegate-impl.cpp`: the suggestion with the earliest
   * EffectiveTime among those already active (EffectiveTime <= now) becomes current. ThermostatSuggestionNotFollowingReason
   * is cleared whenever CurrentThermostatSuggestion changes, including when it becomes null, so it never keeps
   * describing a suggestion that is no longer current. When a new suggestion becomes current, ActivePresetHandle is
   * synced to it; when no suggestion is active, ActivePresetHandle is left untouched.
   */
  private reEvaluateCurrentThermostatSuggestion(): void {
    const now = Math.floor(Date.now() / 1000);
    let current: Thermostat.ThermostatSuggestion | null = null;
    for (const s of this.state.thermostatSuggestions) {
      if (s.effectiveTime <= now && (current === null || s.effectiveTime < current.effectiveTime)) current = s;
    }
    if (this.state.currentThermostatSuggestion?.uniqueId === current?.uniqueId) return;
    this.state.currentThermostatSuggestion = current;
    this.state.thermostatSuggestionNotFollowingReason = null;
    if (current !== null) {
      this.state.activePresetHandle = Uint8Array.from(current.presetHandle);
    }
  }

  /**
   * Forwards AddThermostatSuggestion requests to the Matterbridge command handler and appends the new suggestion.
   *
   * @param {Thermostat.AddThermostatSuggestionRequest} request - Add-thermostat-suggestion request payload.
   * @returns {Promise<Thermostat.AddThermostatSuggestionResponse>} The generated UniqueID of the added suggestion.
   *
   * @remarks
   * matter.js does not yet provide a default implementation of this command (the ThermostatSuggestions feature
   * is not implemented by `ThermostatServer` in `@matter/node`), so validation, list bookkeeping, and applying the
   * suggestion (re-evaluating CurrentThermostatSuggestion / ActivePresetHandle) are done here.
   */
  override async addThermostatSuggestion(request: Thermostat.AddThermostatSuggestionRequest): Promise<Thermostat.AddThermostatSuggestionResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    const presetHandle = `0x${Buffer.from(request.presetHandle).toString('hex')}`;
    device.log.info(`Adding thermostat suggestion for preset ${presetHandle} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('Thermostat.addThermostatSuggestion', {
      command: 'addThermostatSuggestion',
      request,
      cluster: ThermostatServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof Thermostat)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    if (this.state.presets.find((p) => p.presetHandle !== null && Bytes.areEqual(p.presetHandle, request.presetHandle)) === undefined) {
      throw new StatusResponse.NotFoundError('Requested PresetHandle not found');
    }
    // Remove expired suggestions before checking capacity, so a list full of stale entries does not block a valid add.
    this.removeExpiredThermostatSuggestions();
    if (this.state.thermostatSuggestions.length >= this.state.maxThermostatSuggestions) {
      throw new StatusResponse.ResourceExhaustedError('Maximum number of thermostat suggestions reached');
    }
    const currentTime = Math.floor(Date.now() / 1000);
    const effectiveTime = request.effectiveTime ?? currentTime;
    if (effectiveTime > currentTime + 24 * 60 * 60) {
      throw new StatusResponse.InvalidCommandError('EffectiveTime cannot be more than 24 hours in the future');
    }
    const usedUniqueIds = new Set(this.state.thermostatSuggestions.map((s) => s.uniqueId));
    let uniqueId = 0;
    while (usedUniqueIds.has(uniqueId)) uniqueId++;
    const suggestion: Thermostat.ThermostatSuggestion = {
      uniqueId,
      presetHandle: Uint8Array.from(request.presetHandle),
      effectiveTime,
      expirationTime: effectiveTime + request.expirationInMinutes * 60,
    };
    this.state.thermostatSuggestions = [...this.state.thermostatSuggestions, suggestion];
    this.reEvaluateCurrentThermostatSuggestion();
    device.log.debug(`MatterbridgeThermostatServer: addThermostatSuggestion completed with uniqueId: ${uniqueId}`);
    return { uniqueId };
  }

  /**
   * Forwards RemoveThermostatSuggestion requests to the Matterbridge command handler and removes the suggestion.
   *
   * @param {Thermostat.RemoveThermostatSuggestionRequest} request - Remove-thermostat-suggestion request payload.
   *
   * @remarks
   * matter.js does not yet provide a default implementation of this command (the ThermostatSuggestions feature
   * is not implemented by `ThermostatServer` in `@matter/node`), so validation, list bookkeeping, and applying the
   * next suggestion (re-evaluating CurrentThermostatSuggestion / ActivePresetHandle) are done here.
   */
  override async removeThermostatSuggestion(request: Thermostat.RemoveThermostatSuggestionRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Removing thermostat suggestion ${request.uniqueId} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('Thermostat.removeThermostatSuggestion', {
      command: 'removeThermostatSuggestion',
      request,
      cluster: ThermostatServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof Thermostat)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    const suggestion = this.state.thermostatSuggestions.find((s) => s.uniqueId === request.uniqueId);
    if (suggestion === undefined) {
      throw new StatusResponse.NotFoundError('Requested UniqueID not found');
    }
    this.state.thermostatSuggestions = this.state.thermostatSuggestions.filter((s) => s.uniqueId !== request.uniqueId);
    this.removeExpiredThermostatSuggestions();
    this.reEvaluateCurrentThermostatSuggestion();
    device.log.debug(`MatterbridgeThermostatServer: removeThermostatSuggestion completed for uniqueId: ${request.uniqueId}`);
  }
}
