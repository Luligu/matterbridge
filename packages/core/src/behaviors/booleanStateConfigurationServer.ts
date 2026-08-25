/**
 * @file packages/core/src/behaviors/booleanStateConfigurationServer.ts
 * @description This file contains the MatterbridgeBooleanStateConfigurationServer class of Matterbridge.
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
/* oxlint-disable typescript/unbound-method */

import type { MaybePromise } from '@matter/general';
import { BooleanStateConfigurationServer } from '@matter/node/behaviors/boolean-state-configuration';
import { Status, StatusResponseError } from '@matter/types';
import { BooleanStateConfiguration } from '@matter/types/clusters/boolean-state-configuration';
import { debugStringify, nf } from 'node-ansi-logger';

import type { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';
import { MatterbridgeServer } from './matterbridgeServer.js';

/**
 * BooleanStateConfiguration server that forwards alarm control commands to the Matterbridge command handler.
 * If the `AlarmsStateChanged` event is enabled it is emitted automatically on `AlarmsActive` or `AlarmsSuppressed` changes.
 * If the `SensorFault` event is enabled it is emitted automatically on `SensorFault` changes.
 * The cluster has no separate trigger-condition attribute, so plugins that know a physical trigger is met must update
 * `AlarmsActive` when enabling alarms requires immediate activation.
 */
export class MatterbridgeBooleanStateConfigurationServer extends BooleanStateConfigurationServer.with(
  BooleanStateConfiguration.Feature.Visual,
  BooleanStateConfiguration.Feature.Audible,
  BooleanStateConfiguration.Feature.AlarmSuppress,
  BooleanStateConfiguration.Feature.SensitivityLevel,
  BooleanStateConfiguration.Feature.FaultEvents,
) {
  override initialize(): MaybePromise {
    /* v8 ignore next -- Visual and Audible are enabled by this server's Base behavior. */
    if (this.features.visual || this.features.audible) {
      this.reactTo(this.events.alarmsActive$Changed, this.#emitAlarmsStateChanged);
      this.reactTo(this.events.alarmsSuppressed$Changed, this.#emitAlarmsStateChanged);
    }
    /* v8 ignore else -- FaultEvents is enabled by this server's Base behavior. */
    if (this.features.faultEvents) {
      const sensorFaultChanged = this.events.sensorFault$Changed;
      /* v8 ignore else -- sensorFault$Changed exists when FaultEvents is enabled. */
      if (sensorFaultChanged) this.reactTo(sensorFaultChanged, this.#emitSensorFault);
    }
  }

  #emitAlarmsStateChanged(): void {
    this.events.alarmsStateChanged?.emit({ alarmsActive: this.state.alarmsActive, alarmsSuppressed: this.state.alarmsSuppressed }, this.context);
  }

  #emitSensorFault(sensorFault: BooleanStateConfiguration.SensorFault): void {
    this.events.sensorFault?.emit({ sensorFault }, this.context);
  }

  #mergeAlarmsSuppressed(alarmsToSuppress: BooleanStateConfiguration.AlarmMode): BooleanStateConfiguration.AlarmMode {
    return {
      visual: [this.state.alarmsSuppressed.visual, alarmsToSuppress.visual].some(Boolean),
      audible: [this.state.alarmsSuppressed.audible, alarmsToSuppress.audible].some(Boolean),
    };
  }

  #applyAlarmsEnabled(alarmsToEnableDisable: BooleanStateConfiguration.AlarmMode): void {
    const alarmsEnabled = {
      visual: Boolean(alarmsToEnableDisable.visual),
      audible: Boolean(alarmsToEnableDisable.audible),
    };

    this.state.alarmsEnabled = alarmsEnabled;
    this.state.alarmsActive = {
      visual: Boolean(this.state.alarmsActive.visual && alarmsEnabled.visual),
      audible: Boolean(this.state.alarmsActive.audible && alarmsEnabled.audible),
    };
    this.state.alarmsSuppressed = {
      visual: Boolean(this.state.alarmsSuppressed.visual && alarmsEnabled.visual),
      audible: Boolean(this.state.alarmsSuppressed.audible && alarmsEnabled.audible),
    };
  }

  #assertAlarmModesSupported(alarms: BooleanStateConfiguration.AlarmMode): void {
    if ([Boolean(alarms.visual && !this.state.alarmsSupported.visual), Boolean(alarms.audible && !this.state.alarmsSupported.audible)].some(Boolean)) {
      throw new StatusResponseError(`Requested alarm mode is not supported (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`, Status.ConstraintError);
    }
  }

  #assertSuppressAlarmAllowed(alarmsToSuppress: BooleanStateConfiguration.AlarmMode): void {
    if (
      [
        Boolean(alarmsToSuppress.visual && (!this.state.alarmsActive.visual || !this.state.alarmsEnabled?.visual)),
        Boolean(alarmsToSuppress.audible && (!this.state.alarmsActive.audible || !this.state.alarmsEnabled?.audible)),
      ].some(Boolean)
    ) {
      throw new StatusResponseError(`Requested alarm mode is not active (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`, Status.InvalidInState);
    }
  }

  /**
   * Forwards SuppressAlarm requests to the Matterbridge command handler and then updates AlarmsSuppressed.
   *
   * @param {BooleanStateConfiguration.SuppressAlarmRequest} request - Suppress-alarm request payload.
   */
  override async suppressAlarm(request: BooleanStateConfiguration.SuppressAlarmRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Suppressing alarm ${debugStringify(request.alarmsToSuppress)}${nf} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('BooleanStateConfiguration.suppressAlarm', {
      command: 'suppressAlarm',
      request,
      cluster: BooleanStateConfigurationServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof BooleanStateConfiguration)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    this.#assertAlarmModesSupported(request.alarmsToSuppress);
    this.#assertSuppressAlarmAllowed(request.alarmsToSuppress);
    this.state.alarmsSuppressed = this.#mergeAlarmsSuppressed(request.alarmsToSuppress);
    device.log.debug(`MatterbridgeBooleanStateConfigurationServer: suppressAlarm called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
  }

  /**
   * Forwards EnableDisableAlarm requests to the Matterbridge command handler and then updates alarm attributes.
   *
   * @param {BooleanStateConfiguration.EnableDisableAlarmRequest} request - Enable/disable-alarm request payload.
   */
  override async enableDisableAlarm(request: BooleanStateConfiguration.EnableDisableAlarmRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Enabling/disabling alarm ${debugStringify(request.alarmsToEnableDisable)}${nf} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('BooleanStateConfiguration.enableDisableAlarm', {
      command: 'enableDisableAlarm',
      request,
      cluster: BooleanStateConfigurationServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof BooleanStateConfiguration)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    this.#assertAlarmModesSupported(request.alarmsToEnableDisable);
    this.#applyAlarmsEnabled(request.alarmsToEnableDisable);
    device.log.debug(`MatterbridgeBooleanStateConfigurationServer: enableDisableAlarm called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
  }
}
