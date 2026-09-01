/**
 * @file packages/core/src/behaviors/temperatureAlarmServer.ts
 * @description This file contains the MatterbridgeTemperatureAlarmServer class of Matterbridge.
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
/* oxlint-disable typescript/unbound-method */

import type { MaybePromise } from '@matter/general';
import { TemperatureAlarmServer } from '@matter/node/behaviors/temperature-alarm';
import { Status, StatusResponseError } from '@matter/types';
import type { TemperatureAlarm } from '@matter/types/clusters/temperature-alarm';

import type { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';
import { MatterbridgeServer } from './matterbridgeServer.js';

/**
 * The bit names of the {@link TemperatureAlarm.Alarm} bitmap, in cluster order.
 */
const ALARM_BITS = [
  'criticalOverTemperatureAlarm',
  'majorOverTemperatureAlarm',
  'minorOverTemperatureAlarm',
  'minorUnderTemperatureAlarm',
  'majorUnderTemperatureAlarm',
  'criticalUnderTemperatureAlarm',
] as const;

/**
 * Normalizes a possibly-sparse {@link TemperatureAlarm.Alarm} bitmap to an object with an explicit boolean for
 * every bit, matching how bitmap attributes are stored elsewhere in Matterbridge (e.g. BooleanStateConfiguration).
 *
 * @param {TemperatureAlarm.Alarm} alarm - The (possibly partial) bitmap to normalize. Defaults to an empty object.
 * @returns {TemperatureAlarm.Alarm} A new bitmap with every bit explicitly set to `true` or `false`.
 */
export function normalizeTemperatureAlarm(alarm: TemperatureAlarm.Alarm = {}): TemperatureAlarm.Alarm {
  const normalized: TemperatureAlarm.Alarm = {};
  for (const bit of ALARM_BITS) normalized[bit] = Boolean(alarm[bit]);
  return normalized;
}

const MatterbridgeTemperatureAlarmServerBase = TemperatureAlarmServer.enable({
  events: { notify: true },
  commands: { modifyEnabledAlarms: true },
});

/**
 * Temperature Alarm server that forwards ModifyEnabledAlarms requests to the Matterbridge command handler, updates
 * the Mask and State attributes accordingly, and emits the Notify event when the State attribute changes.
 *
 * No feature is enabled on this base class: {@link MatterbridgeEndpoint.createDefaultTemperatureAlarmClusterServer}
 * applies `.with(TemperatureAlarm.Feature.OverTemperature | TemperatureAlarm.Feature.UnderTemperature)` depending on
 * which critical thresholds it is given. The MajorThreshold/MinorThreshold, adjustable-threshold, and Reset features
 * are never enabled.
 */
export class MatterbridgeTemperatureAlarmServer extends MatterbridgeTemperatureAlarmServerBase {
  /**
   * Registers a reaction that emits the Notify event when the State attribute changes.
   *
   * @returns {MaybePromise} Nothing when initialization completes synchronously.
   */
  override initialize(): MaybePromise {
    this.reactTo(this.events.state$Changed, this.#emitNotify);
  }

  /**
   * Emits the Notify event with the alarm bits that became active or inactive between the previous and current
   * State attribute values.
   *
   * @param {TemperatureAlarm.Alarm} state - The new State attribute value.
   * @param {TemperatureAlarm.Alarm} oldState - The previous State attribute value.
   * @returns {void}
   */
  #emitNotify(state: TemperatureAlarm.Alarm, oldState: TemperatureAlarm.Alarm): void {
    const active: TemperatureAlarm.Alarm = {};
    const inactive: TemperatureAlarm.Alarm = {};
    for (const bit of ALARM_BITS) {
      const now = Boolean(state[bit]);
      const before = Boolean(oldState[bit]);
      active[bit] = now && !before;
      inactive[bit] = !now && before;
    }
    this.events.notify.emit({ active, inactive, state, mask: this.state.mask }, this.context);
  }

  /**
   * Validates that every bit set in the requested mask is a bit the device declares as supported.
   *
   * @param {TemperatureAlarm.Alarm} mask - The requested mask bitmap.
   * @returns {void}
   * @throws {StatusResponseError} With InvalidCommand when a requested bit is not supported.
   */
  #assertMaskSupported(mask: TemperatureAlarm.Alarm): void {
    // Matter 1.6.0 § 1.15.7.2.1: Reject with InvalidCommand a Mask that sets bits for alarms which are not supported.
    for (const bit of ALARM_BITS) {
      if (mask[bit] && !this.state.supported[bit]) {
        throw new StatusResponseError(
          `MatterbridgeTemperatureAlarmServer: requested alarm "${bit}" is not supported (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
          Status.InvalidCommand,
        );
      }
    }
  }

  /**
   * Forwards ModifyEnabledAlarms requests to the Matterbridge command handler, then updates the Mask attribute to
   * the requested value and clears any State bits that are no longer enabled.
   *
   * @param {TemperatureAlarm.ModifyEnabledAlarmsRequest} request - Modify-enabled-alarms request payload.
   * @returns {Promise<void>} Resolves after forwarding, validation, and state updates complete.
   */
  override async modifyEnabledAlarms(request: TemperatureAlarm.ModifyEnabledAlarmsRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeTemperatureAlarmServer: modifying enabled alarms (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('TemperatureAlarm.modifyEnabledAlarms', {
      command: 'modifyEnabledAlarms',
      request,
      cluster: MatterbridgeTemperatureAlarmServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof TemperatureAlarm)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    // Matter 1.6.0 § 1.15.7.2.1: Reject with InvalidCommand a Mask that sets bits for alarms which are not supported.
    this.#assertMaskSupported(request.mask);
    // Matter 1.6.0 § 1.15.7.2.2: On success, set the Mask attribute to the requested value.
    const mask = normalizeTemperatureAlarm(request.mask);
    this.state.mask = mask;
    // Matter 1.6.0 § 1.15.7.2.2: Update State to reflect the new Mask; a disabled alarm cannot remain active.
    const state: TemperatureAlarm.Alarm = {};
    for (const bit of ALARM_BITS) state[bit] = Boolean(this.state.state[bit]) && mask[bit];
    this.state.state = state;
    device.log.debug(`MatterbridgeTemperatureAlarmServer: modifyEnabledAlarms called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
  }
}
