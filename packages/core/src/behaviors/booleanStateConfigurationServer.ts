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
  /**
   * Registers reactions that emit alarm-state and sensor-fault events when their source attributes change.
   *
   * @returns {MaybePromise} Nothing when initialization completes synchronously.
   */
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

  /**
   * Emits the current active and suppressed alarm modes through the AlarmsStateChanged event.
   *
   * @returns {void}
   */
  #emitAlarmsStateChanged(): void {
    this.events.alarmsStateChanged?.emit({ alarmsActive: this.state.alarmsActive, alarmsSuppressed: this.state.alarmsSuppressed }, this.context);
  }

  /**
   * Emits the updated sensor fault bitmap through the SensorFault event.
   *
   * @param {BooleanStateConfiguration.SensorFault} sensorFault - Current sensor fault bitmap.
   * @returns {void}
   */
  #emitSensorFault(sensorFault: BooleanStateConfiguration.SensorFault): void {
    this.events.sensorFault?.emit({ sensorFault }, this.context);
  }

  /**
   * Merges requested alarm modes into the modes already suppressed.
   *
   * @param {BooleanStateConfiguration.AlarmMode} alarmsToSuppress - Alarm modes requested for suppression.
   * @returns {BooleanStateConfiguration.AlarmMode} Combined suppressed alarm modes.
   */
  #mergeAlarmsSuppressed(alarmsToSuppress: BooleanStateConfiguration.AlarmMode): BooleanStateConfiguration.AlarmMode {
    return {
      visual: [this.state.alarmsSuppressed.visual, alarmsToSuppress.visual].some(Boolean),
      audible: [this.state.alarmsSuppressed.audible, alarmsToSuppress.audible].some(Boolean),
    };
  }

  /**
   * Applies the requested enabled modes and clears active or suppressed modes that become disabled.
   *
   * @param {BooleanStateConfiguration.AlarmMode} alarmsToEnableDisable - Alarm modes to enable or disable.
   * @returns {void}
   */
  #applyAlarmsEnabled(alarmsToEnableDisable: BooleanStateConfiguration.AlarmMode): void {
    const alarmsEnabled = {
      visual: Boolean(alarmsToEnableDisable.visual),
      audible: Boolean(alarmsToEnableDisable.audible),
    };

    // Matter 1.6.0 § 1.8.7.2.2: Set AlarmsEnabled to the requested bitmap when all alarm modes are valid.
    this.state.alarmsEnabled = alarmsEnabled;
    // Matter 1.6.0 § 1.8.7.2.2: Clear active alarm modes when they are disabled.
    this.state.alarmsActive = {
      visual: Boolean(this.state.alarmsActive.visual && alarmsEnabled.visual),
      audible: Boolean(this.state.alarmsActive.audible && alarmsEnabled.audible),
    };
    // Matter 1.6.0 § 1.8.7.2.2: Clear suppressed alarm modes when they are disabled.
    this.state.alarmsSuppressed = {
      visual: Boolean(this.state.alarmsSuppressed.visual && alarmsEnabled.visual),
      audible: Boolean(this.state.alarmsSuppressed.audible && alarmsEnabled.audible),
    };
  }

  /**
   * Validates that every requested alarm mode is supported by the server.
   *
   * @param {BooleanStateConfiguration.AlarmMode} alarms - Alarm modes to validate.
   * @returns {void}
   * @throws {StatusResponseError} With CONSTRAINT_ERROR when a requested alarm mode is unsupported.
   */
  #assertAlarmModesSupported(alarms: BooleanStateConfiguration.AlarmMode): void {
    // Matter 1.6.0 § 1.8.7.1.2 and § 1.8.7.2.2: Reject the command with CONSTRAINT_ERROR if any requested alarm mode is unsupported.
    if ([Boolean(alarms.visual && !this.state.alarmsSupported.visual), Boolean(alarms.audible && !this.state.alarmsSupported.audible)].some(Boolean)) {
      throw new StatusResponseError(
        `MatterbridgeBooleanStateConfigurationServer: requested alarm mode is not supported (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ConstraintError,
      );
    }
  }

  /**
   * Validates that every requested alarm mode is active and enabled before suppression.
   *
   * @param {BooleanStateConfiguration.AlarmMode} alarmsToSuppress - Alarm modes requested for suppression.
   * @returns {void}
   * @throws {StatusResponseError} With INVALID_IN_STATE when a requested alarm mode is inactive or disabled.
   */
  #assertSuppressAlarmAllowed(alarmsToSuppress: BooleanStateConfiguration.AlarmMode): void {
    // Matter 1.6.0 § 1.8.7.1.2: Reject suppression with INVALID_IN_STATE if a requested alarm mode is inactive or disabled.
    if (
      [
        Boolean(alarmsToSuppress.visual && (!this.state.alarmsActive.visual || !this.state.alarmsEnabled?.visual)),
        Boolean(alarmsToSuppress.audible && (!this.state.alarmsActive.audible || !this.state.alarmsEnabled?.audible)),
      ].some(Boolean)
    ) {
      throw new StatusResponseError(
        `MatterbridgeBooleanStateConfigurationServer: requested alarm mode is not active (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.InvalidInState,
      );
    }
  }

  /**
   * Forwards SuppressAlarm requests to the Matterbridge command handler and then updates AlarmsSuppressed.
   *
   * @param {BooleanStateConfiguration.SuppressAlarmRequest} request - Suppress-alarm request payload.
   * @returns {Promise<void>} Resolves after forwarding, validation, and state update complete.
   */
  override async suppressAlarm(request: BooleanStateConfiguration.SuppressAlarmRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeBooleanStateConfigurationServer: suppressing alarm ${debugStringify(request.alarmsToSuppress)}${nf} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('BooleanStateConfiguration.suppressAlarm', {
      command: 'suppressAlarm',
      request,
      cluster: BooleanStateConfigurationServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof BooleanStateConfiguration)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    // Matter 1.6.0 § 1.8.7.1.2: Reject the command with CONSTRAINT_ERROR if any requested alarm mode is unsupported.
    this.#assertAlarmModesSupported(request.alarmsToSuppress);
    // Matter 1.6.0 § 1.8.7.1.2: Reject suppression with INVALID_IN_STATE if a requested alarm mode is inactive or disabled.
    this.#assertSuppressAlarmAllowed(request.alarmsToSuppress);
    // Matter 1.6.0 § 1.8.7.1.2: Set each valid requested mode in AlarmsSuppressed while preserving modes already suppressed.
    this.state.alarmsSuppressed = this.#mergeAlarmsSuppressed(request.alarmsToSuppress);
    device.log.debug(`MatterbridgeBooleanStateConfigurationServer: suppressAlarm called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
  }

  /**
   * Forwards EnableDisableAlarm requests to the Matterbridge command handler and then updates alarm attributes.
   *
   * @param {BooleanStateConfiguration.EnableDisableAlarmRequest} request - Enable/disable-alarm request payload.
   * @returns {Promise<void>} Resolves after forwarding, validation, and state updates complete.
   */
  override async enableDisableAlarm(request: BooleanStateConfiguration.EnableDisableAlarmRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeBooleanStateConfigurationServer: enabling/disabling alarm ${debugStringify(request.alarmsToEnableDisable)}${nf} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('BooleanStateConfiguration.enableDisableAlarm', {
      command: 'enableDisableAlarm',
      request,
      cluster: BooleanStateConfigurationServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof BooleanStateConfiguration)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    // Matter 1.6.0 § 1.8.7.2.2: Reject the command with CONSTRAINT_ERROR if any requested alarm mode is unsupported.
    this.#assertAlarmModesSupported(request.alarmsToEnableDisable);
    // Matter 1.6.0 § 1.8.7.2.2: Apply the requested enabled modes and clear active or suppressed modes that become disabled.
    this.#applyAlarmsEnabled(request.alarmsToEnableDisable);
    device.log.debug(`MatterbridgeBooleanStateConfigurationServer: enableDisableAlarm called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
  }
}
