/**
 * @file packages/core/src/behaviors/temperatureAlarmServer.ts
 * @description This file contains the MatterbridgeTemperatureAlarmServer class of Matterbridge.
 * @author Luca Liguori
 * @created 2026-09-02
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
import { AttributeElement, CommandElement, EventElement, FieldElement } from '@matter/model';
import { TemperatureAlarmServer } from '@matter/node/behaviors/temperature-alarm';
import { Status, StatusResponseError } from '@matter/types';
import { TemperatureAlarm } from '@matter/types/clusters/temperature-alarm';
import { debugStringify, nf } from 'node-ansi-logger';

import type { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';
import { MatterbridgeServer } from './matterbridgeServer.js';

/**
 * A Temperature Alarm `AlarmBitmap` with every bit of Matter 1.6.0 § 2.17.5.1 set to an explicit value.
 *
 * @remarks
 * Every bit of {@link TemperatureAlarm.Alarm} is optional, so a bitmap literal that forgets one still compiles and
 * silently reads back as `false`. Building the bitmaps of this server as `AlarmBitmap` makes TypeScript require all six.
 */
type AlarmBitmap = Required<TemperatureAlarm.Alarm>;

/**
 * The schema of the Temperature Alarm cluster with the inherited Alarm Base elements bound to the Temperature Alarm `AlarmBitmap`.
 *
 * @remarks
 * Matter 1.6.0 § 2.17.5.1 defines the six Temperature Alarm bits carried by the `Mask`, `Latch`, `State` and `Supported`
 * attributes (§ 1.15.6.1 to § 1.15.6.4), by the `Reset` and `ModifyEnabledAlarms` command fields (§ 1.15.7.1.1 and
 * § 1.15.7.2.1) and by the `Notify` event fields (§ 1.15.8.1). matter.js resolves those inherited elements in the scope of
 * the Alarm Base cluster, whose `AlarmBitmap` is empty, so every bit would be dropped on the wire. Redeclaring the elements
 * here moves them into the Temperature Alarm scope, where `AlarmBitmap` resolves to the derived cluster's bitmap.
 */
const MatterbridgeTemperatureAlarmSchema = TemperatureAlarmServer.schema.extend(
  {},
  AttributeElement({ name: 'Mask', id: 0x0000, type: 'AlarmBitmap', access: 'R V', conformance: 'M' }),
  AttributeElement({ name: 'Latch', id: 0x0001, type: 'AlarmBitmap', access: 'R V', conformance: 'RESET', quality: 'F' }),
  AttributeElement({ name: 'State', id: 0x0002, type: 'AlarmBitmap', access: 'R V', conformance: 'M' }),
  AttributeElement({ name: 'Supported', id: 0x0003, type: 'AlarmBitmap', access: 'R V', conformance: 'M', quality: 'F' }),
  CommandElement(
    { name: 'Reset', id: 0x0000, access: 'O', conformance: 'RESET', direction: 'request', response: 'status' },
    FieldElement({ name: 'Alarms', id: 0x0000, type: 'AlarmBitmap', conformance: 'M' }),
  ),
  CommandElement(
    { name: 'ModifyEnabledAlarms', id: 0x0001, access: 'O', conformance: 'O', direction: 'request', response: 'status' },
    FieldElement({ name: 'Mask', id: 0x0000, type: 'AlarmBitmap', conformance: 'M' }),
  ),
  EventElement(
    { name: 'Notify', id: 0x0000, access: 'V', conformance: 'M', priority: 'info' },
    FieldElement({ name: 'Active', id: 0x0000, type: 'AlarmBitmap', conformance: 'M' }),
    FieldElement({ name: 'Inactive', id: 0x0001, type: 'AlarmBitmap', conformance: 'M' }),
    FieldElement({ name: 'State', id: 0x0002, type: 'AlarmBitmap', conformance: 'M' }),
    FieldElement({ name: 'Mask', id: 0x0003, type: 'AlarmBitmap', conformance: 'M' }),
  ),
);

/**
 * Temperature Alarm server bound to {@link MatterbridgeTemperatureAlarmSchema}.
 *
 * @remarks
 * The schema must be replaced before selecting the features, since `with()` derives the supported feature map from the
 * schema of the class it is called on.
 */
class TemperatureAlarmBaseServer extends TemperatureAlarmServer {
  static override readonly schema = MatterbridgeTemperatureAlarmSchema;
}

/**
 * Temperature Alarm server with the Alarm Base `Reset` feature and the Temperature Alarm `OverTemperature` and
 * `UnderTemperature` features.
 *
 * @remarks
 * matter.js ships no implementation for the Alarm Base cluster and only a bare behavior for the derived Temperature Alarm
 * cluster, so the `Reset` and `ModifyEnabledAlarms` commands and the mandatory `Notify` event are implemented here.
 *
 * Matter 1.6.0 § 2.17.4 gives `OverTemperature` and `UnderTemperature` the choice conformance `O.a+`, and they are the only
 * two rows of that table in choice set `a`. Per Matter 1.6.0 Core § 7.3.14 this reads: neither feature is mandatory on its
 * own, but a conformant server SHALL support at least one of them. Both is fine, neither is not. This server enables both,
 * which is why it carries `CriticalOverTemperatureThreshold` (conformance `OVER`) and `CriticalUnderTemperatureThreshold`
 * (conformance `UNDER`). Enabling neither would leave the cluster non-conformant even though every row says "optional".
 *
 * The `Notify` event is emitted automatically whenever the `State` attribute changes, so a plugin that raises or clears an
 * alarm only has to update `State`. `CriticalOverTemperatureThreshold` and `CriticalUnderTemperatureThreshold` are
 * read-only over the wire: the plugin owns the temperature evaluation and updates `State` accordingly.
 *
 * `ModifyEnabledAlarms` is optional (Matter 1.6.0 § 1.15.7), but it does not need `enable({ commands: ... })`: matter.js
 * adds an optional command to `AcceptedCommandList` when the behavior provides a real implementation, and this server
 * overrides it. `enable()` is only needed for optional elements matter.js cannot detect that way, such as optional events.
 */
export class MatterbridgeTemperatureAlarmServer extends TemperatureAlarmBaseServer.with(
  TemperatureAlarm.Feature.Reset,
  TemperatureAlarm.Feature.OverTemperature,
  TemperatureAlarm.Feature.UnderTemperature,
) {
  /**
   * Registers the reaction that emits the Notify event when the State attribute changes.
   *
   * @returns {MaybePromise} Nothing when initialization completes synchronously.
   */
  override initialize(): MaybePromise {
    this.reactTo(this.events.state$Changed, this.#emitNotify);
  }

  /**
   * Emits the Notify event with the alarms that became active, the alarms that became inactive, and the resulting state.
   *
   * @param {TemperatureAlarm.Alarm} state - The new value of the State attribute.
   * @param {TemperatureAlarm.Alarm} oldState - The previous value of the State attribute.
   * @returns {void}
   */
  #emitNotify(state: TemperatureAlarm.Alarm, oldState: TemperatureAlarm.Alarm): void {
    // Matter 1.6.0 § 1.15.8.1.1: Active indicates those alarms that have become active.
    const active: AlarmBitmap = {
      criticalOverTemperatureAlarm: Boolean(state.criticalOverTemperatureAlarm && !oldState.criticalOverTemperatureAlarm),
      majorOverTemperatureAlarm: Boolean(state.majorOverTemperatureAlarm && !oldState.majorOverTemperatureAlarm),
      minorOverTemperatureAlarm: Boolean(state.minorOverTemperatureAlarm && !oldState.minorOverTemperatureAlarm),
      minorUnderTemperatureAlarm: Boolean(state.minorUnderTemperatureAlarm && !oldState.minorUnderTemperatureAlarm),
      majorUnderTemperatureAlarm: Boolean(state.majorUnderTemperatureAlarm && !oldState.majorUnderTemperatureAlarm),
      criticalUnderTemperatureAlarm: Boolean(state.criticalUnderTemperatureAlarm && !oldState.criticalUnderTemperatureAlarm),
    };
    // Matter 1.6.0 § 1.15.8.1.2: Inactive indicates those alarms that have become inactive.
    const inactive: AlarmBitmap = {
      criticalOverTemperatureAlarm: Boolean(!state.criticalOverTemperatureAlarm && oldState.criticalOverTemperatureAlarm),
      majorOverTemperatureAlarm: Boolean(!state.majorOverTemperatureAlarm && oldState.majorOverTemperatureAlarm),
      minorOverTemperatureAlarm: Boolean(!state.minorOverTemperatureAlarm && oldState.minorOverTemperatureAlarm),
      minorUnderTemperatureAlarm: Boolean(!state.minorUnderTemperatureAlarm && oldState.minorUnderTemperatureAlarm),
      majorUnderTemperatureAlarm: Boolean(!state.majorUnderTemperatureAlarm && oldState.majorUnderTemperatureAlarm),
      criticalUnderTemperatureAlarm: Boolean(!state.criticalUnderTemperatureAlarm && oldState.criticalUnderTemperatureAlarm),
    };
    // Matter 1.6.0 § 1.15.8.1: Generate Notify when one or more alarms change state, carrying a copy of the new State (§ 1.15.8.1.4) and of the Mask attribute (§ 1.15.8.1.3).
    this.events.notify.emit({ active, inactive, state, mask: this.state.mask }, this.context);
  }

  /**
   * Validates that every alarm set in the requested bitmap is supported by the server.
   *
   * @param {TemperatureAlarm.Alarm} alarms - The requested alarm bitmap.
   * @param {Status.Failure | Status.InvalidCommand} status - The status code reported when an alarm is unsupported.
   * @returns {void}
   * @throws {StatusResponseError} With the given status code when a requested alarm is not supported.
   */
  #assertAlarmsSupported(alarms: TemperatureAlarm.Alarm, status: Status.Failure | Status.InvalidCommand): void {
    const unsupported: AlarmBitmap = {
      criticalOverTemperatureAlarm: Boolean(alarms.criticalOverTemperatureAlarm && !this.state.supported.criticalOverTemperatureAlarm),
      majorOverTemperatureAlarm: Boolean(alarms.majorOverTemperatureAlarm && !this.state.supported.majorOverTemperatureAlarm),
      minorOverTemperatureAlarm: Boolean(alarms.minorOverTemperatureAlarm && !this.state.supported.minorOverTemperatureAlarm),
      minorUnderTemperatureAlarm: Boolean(alarms.minorUnderTemperatureAlarm && !this.state.supported.minorUnderTemperatureAlarm),
      majorUnderTemperatureAlarm: Boolean(alarms.majorUnderTemperatureAlarm && !this.state.supported.majorUnderTemperatureAlarm),
      criticalUnderTemperatureAlarm: Boolean(alarms.criticalUnderTemperatureAlarm && !this.state.supported.criticalUnderTemperatureAlarm),
    };
    // Matter 1.6.0 § 1.15.7.1.1 and § 1.15.7.2.1: Reject the command when it sets a bit of an alarm the Supported attribute does not report, with FAILURE for Reset and INVALID_COMMAND for ModifyEnabledAlarms.
    if (Object.values(unsupported).some(Boolean)) {
      throw new StatusResponseError(
        `MatterbridgeTemperatureAlarmServer: requested alarm is not supported (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        status,
      );
    }
  }

  /**
   * Clears the requested alarms from the State attribute, preserving the alarms that were not requested.
   *
   * @param {TemperatureAlarm.Alarm} alarms - The alarms to reset to inactive.
   * @returns {AlarmBitmap} The resulting State bitmap.
   */
  #clearAlarms(alarms: TemperatureAlarm.Alarm): AlarmBitmap {
    // Matter 1.6.0 § 1.15.7.1.1: Reset every alarm set in the Alarms field to inactive in the State attribute and leave the other alarms untouched.
    return {
      criticalOverTemperatureAlarm: Boolean(this.state.state.criticalOverTemperatureAlarm && !alarms.criticalOverTemperatureAlarm),
      majorOverTemperatureAlarm: Boolean(this.state.state.majorOverTemperatureAlarm && !alarms.majorOverTemperatureAlarm),
      minorOverTemperatureAlarm: Boolean(this.state.state.minorOverTemperatureAlarm && !alarms.minorOverTemperatureAlarm),
      minorUnderTemperatureAlarm: Boolean(this.state.state.minorUnderTemperatureAlarm && !alarms.minorUnderTemperatureAlarm),
      majorUnderTemperatureAlarm: Boolean(this.state.state.majorUnderTemperatureAlarm && !alarms.majorUnderTemperatureAlarm),
      criticalUnderTemperatureAlarm: Boolean(this.state.state.criticalUnderTemperatureAlarm && !alarms.criticalUnderTemperatureAlarm),
    };
  }

  /**
   * Clears from the State attribute the alarms that are not enabled by the given Mask.
   *
   * @param {TemperatureAlarm.Alarm} mask - The new value of the Mask attribute.
   * @returns {AlarmBitmap} The resulting State bitmap.
   */
  #applyMaskToState(mask: TemperatureAlarm.Alarm): AlarmBitmap {
    // Matter 1.6.0 § 1.15.7.2.1: Update the State attribute to reflect the alarm set enabled by the new Mask value, so an alarm that is no longer enabled becomes inactive.
    return {
      criticalOverTemperatureAlarm: Boolean(this.state.state.criticalOverTemperatureAlarm && mask.criticalOverTemperatureAlarm),
      majorOverTemperatureAlarm: Boolean(this.state.state.majorOverTemperatureAlarm && mask.majorOverTemperatureAlarm),
      minorOverTemperatureAlarm: Boolean(this.state.state.minorOverTemperatureAlarm && mask.minorOverTemperatureAlarm),
      minorUnderTemperatureAlarm: Boolean(this.state.state.minorUnderTemperatureAlarm && mask.minorUnderTemperatureAlarm),
      majorUnderTemperatureAlarm: Boolean(this.state.state.majorUnderTemperatureAlarm && mask.majorUnderTemperatureAlarm),
      criticalUnderTemperatureAlarm: Boolean(this.state.state.criticalUnderTemperatureAlarm && mask.criticalUnderTemperatureAlarm),
    };
  }

  /**
   * Forwards Reset requests to the Matterbridge command handler and then resets the requested alarms.
   *
   * @param {TemperatureAlarm.ResetRequest} request - The reset request payload.
   * @returns {Promise<void>} Resolves after forwarding, validation, and the state update complete.
   */
  override async reset(request: TemperatureAlarm.ResetRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeTemperatureAlarmServer: resetting alarms ${debugStringify(request.alarms)}${nf} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('TemperatureAlarm.reset', {
      command: 'reset',
      request,
      cluster: MatterbridgeTemperatureAlarmServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof TemperatureAlarm)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    // Matter 1.6.0 § 1.15.7.1.1: Respond with FAILURE when a requested alarm cannot be reset because it is not supported.
    this.#assertAlarmsSupported(request.alarms, Status.Failure);
    // Matter 1.6.0 § 1.15.7.1.1: Reset every requested alarm to inactive in the State attribute.
    this.state.state = this.#clearAlarms(request.alarms);
  }

  /**
   * Forwards ModifyEnabledAlarms requests to the Matterbridge command handler and then updates the Mask and State attributes.
   *
   * @param {TemperatureAlarm.ModifyEnabledAlarmsRequest} request - The modify-enabled-alarms request payload.
   * @returns {Promise<void>} Resolves after forwarding, validation, and the state updates complete.
   */
  override async modifyEnabledAlarms(request: TemperatureAlarm.ModifyEnabledAlarmsRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeTemperatureAlarmServer: modifying enabled alarms ${debugStringify(request.mask)}${nf} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('TemperatureAlarm.modifyEnabledAlarms', {
      command: 'modifyEnabledAlarms',
      request,
      cluster: MatterbridgeTemperatureAlarmServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof TemperatureAlarm)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    // Matter 1.6.0 § 1.15.7.2.1: Reject the command with INVALID_COMMAND when the Mask sets a bit of an alarm that is not supported.
    this.#assertAlarmsSupported(request.mask, Status.InvalidCommand);
    // Matter 1.6.0 § 1.15.7.2.1: On success set the Mask attribute to the Mask field of the command.
    this.state.mask = request.mask;
    // Matter 1.6.0 § 1.15.7.2.1: Then update the State attribute to reflect the alarm set enabled by the new Mask value.
    this.state.state = this.#applyMaskToState(request.mask);
  }
}
