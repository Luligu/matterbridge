/**
 * @file packages/core/src/devices/dishwasher.ts
 * @description This file contains the Dishwasher class.
 * @author Luca Liguori
 * @created 2025-05-25
 * @version 1.2.0
 * @license Apache-2.0
 *
 * Copyright 2025, 2026, 2027 Luca Liguori.
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

// @matter
import type { MaybePromise } from '@matter/general';
import { AttributeElement, CommandElement, EventElement, FieldElement } from '@matter/model';
import { DishwasherAlarmServer } from '@matter/node/behaviors/dishwasher-alarm';
import { DishwasherModeServer } from '@matter/node/behaviors/dishwasher-mode';
import { type EndpointNumber, Status, StatusResponseError } from '@matter/types';
import { DishwasherAlarm } from '@matter/types/clusters/dishwasher-alarm';
import { DishwasherMode } from '@matter/types/clusters/dishwasher-mode';
import { ModeBase } from '@matter/types/clusters/mode-base';
import { OnOff } from '@matter/types/clusters/on-off';
import type { OperationalState } from '@matter/types/clusters/operational-state';
import type { Semtag } from '@matter/types/globals';
import { debugStringify, nf } from 'node-ansi-logger';

// Matterbridge
import { MatterbridgeServer } from '../behaviors/matterbridgeServer.js';
import { MatterbridgeOnOffServer } from '../behaviors/onOffServer.js';
import { dishwasher, powerSource } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { createLevelTemperatureControlClusterServer, createNumberTemperatureControlClusterServer } from './temperatureControl.js';

/**
 * Options for configuring a {@link Dishwasher} endpoint.
 */
export interface DishwasherOptions {
  /** Endpoint operating mode. */
  mode?: 'server' | 'matter';
  /** Stable storage key for the endpoint. Defaults to `${name}-${serial}` with spaces removed. */
  id?: string;
  /** Explicit endpoint number. */
  number?: EndpointNumber;
  /** Semantic tags for endpoint disambiguation. */
  tagList?: Semtag[];
  /** Initial dishwasher mode. */
  currentMode?: number;
  /** Supported dishwasher modes. */
  supportedModes?: DishwasherMode.ModeOption[];
  /** Selected temperature-level index. */
  selectedTemperatureLevel?: number;
  /** Supported temperature-level labels. */
  supportedTemperatureLevels?: string[];
  /** Numeric temperature setpoint in hundredths of a degree Celsius. */
  temperatureSetpoint?: number;
  /** Minimum temperature in hundredths of a degree Celsius. */
  minTemperature?: number;
  /** Maximum temperature in hundredths of a degree Celsius. */
  maxTemperature?: number;
  /** Temperature step in hundredths of a degree Celsius. */
  step?: number;
  /** Initial operational state. */
  operationalState?: OperationalState.OperationalStateEnum;
}

/**
 * Matterbridge endpoint representing a dishwasher device.
 */
export class Dishwasher extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the Dishwasher class.
   *
   * @param {string} name - The name of the dish washer.
   * @param {string} serial - The serial number of the dish washer.
   * @param {DishwasherOptions} [options] - Endpoint and initial cluster configuration.
   *
   * Remarks:
   * - If `temperatureSetpoint` is provided, the `createNumberTemperatureControlClusterServer` method will be used to create the TemperatureControl Cluster Server with features TemperatureNumber and TemperatureStep.
   * - If `temperatureSetpoint` is not provided, the `createLevelTemperatureControlClusterServer` method will be used to create the TemperatureControl Cluster Server with feature TemperatureLevel.
   */
  constructor(name: string, serial: string, options?: DishwasherOptions);

  /**
   * Creates an instance using the legacy positional configuration.
   *
   * @deprecated Pass an {@link DishwasherOptions} object as the third argument instead.
   */
  // oxfmt-ignore
  constructor(name: string, serial: string, currentMode?: number, supportedModes?: DishwasherMode.ModeOption[], selectedTemperatureLevel?: number, supportedTemperatureLevels?: string[], temperatureSetpoint?: number, minTemperature?: number, maxTemperature?: number, step?: number, operationalState?: OperationalState.OperationalStateEnum);

  constructor(
    name: string,
    serial: string,
    optionsOrCurrentMode?: DishwasherOptions | number,
    supportedModes?: DishwasherMode.ModeOption[],
    selectedTemperatureLevel?: number,
    supportedTemperatureLevels?: string[],
    temperatureSetpoint?: number,
    minTemperature?: number,
    maxTemperature?: number,
    step?: number,
    operationalState?: OperationalState.OperationalStateEnum,
  ) {
    const options: DishwasherOptions =
      typeof optionsOrCurrentMode === 'object'
        ? optionsOrCurrentMode
        : {
            currentMode: optionsOrCurrentMode,
            supportedModes,
            selectedTemperatureLevel,
            supportedTemperatureLevels,
            temperatureSetpoint,
            minTemperature,
            maxTemperature,
            step,
            operationalState,
          };
    super([dishwasher, powerSource], {
      id: options.id ?? `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}`,
      number: options.number,
      tagList: options.tagList,
      mode: options.mode,
    });
    this.createDefaultIdentifyClusterServer();
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Dishwasher');
    this.createDefaultPowerSourceWiredClusterServer();
    this.createDeadFrontOnOffClusterServer(true);
    this.createDefaultDishwasherModeClusterServer(options.currentMode, options.supportedModes);
    this.createDefaultDishwasherAlarmClusterServer();
    if (options.temperatureSetpoint) createNumberTemperatureControlClusterServer(this, options.temperatureSetpoint, options.minTemperature, options.maxTemperature, options.step);
    else createLevelTemperatureControlClusterServer(this, options.selectedTemperatureLevel, options.supportedTemperatureLevels);
    this.createDefaultOperationalStateClusterServer(options.operationalState);
  }

  /**
   * Creates a default Dishwasher Mode Cluster Server.
   *
   * @param {number} currentMode - The current mode of the dishwasher. Persistent attribute.
   * @param {DishwasherMode.ModeOption[]} supportedModes - The supported modes of the dishwasher. Defaults to a set of common modes (Light, Normal, Heavy). Fixed attribute.
   *
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultDishwasherModeClusterServer(
    currentMode: number = 2,
    supportedModes: DishwasherMode.ModeOption[] = [
      { label: 'Light', mode: 1, modeTags: [{ value: DishwasherMode.ModeTag.Light }] },
      { label: 'Normal', mode: 2, modeTags: [{ value: DishwasherMode.ModeTag.Normal }] },
      { label: 'Heavy', mode: 3, modeTags: [{ value: DishwasherMode.ModeTag.Heavy }] },
    ],
  ): this {
    this.behaviors.require(MatterbridgeDishwasherModeServer, {
      supportedModes,
      currentMode,
    });
    return this;
  }

  /**
   * Creates a default Dishwasher Alarm Cluster Server.
   *
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultDishwasherAlarmClusterServer(): this {
    this.behaviors.require(MatterbridgeDishwasherAlarmServer, {
      mask: { inflowError: false, drainError: false, doorError: true, tempTooLow: false, tempTooHigh: false, waterLevelError: false },
      latch: { inflowError: false, drainError: false, doorError: false, tempTooLow: false, tempTooHigh: false, waterLevelError: false },
      state: { inflowError: false, drainError: false, doorError: false, tempTooLow: false, tempTooHigh: false, waterLevelError: false },
      supported: { inflowError: false, drainError: false, doorError: true, tempTooLow: false, tempTooHigh: false, waterLevelError: false },
    });
    return this;
  }
}

/**
 * DishwasherMode server that forwards mode changes and reacts to on/off state.
 */
export class MatterbridgeDishwasherModeServer extends DishwasherModeServer {
  /**
   * Initializes mode defaults and hooks on/off changes.
   */
  override initialize(): void {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeDishwasherModeServer initialized: currentMode is ${this.state.currentMode}`);
    this.state.currentMode = 2;
    // oxlint-disable-next-line typescript/unbound-method
    this.reactTo(this.agent.get(MatterbridgeOnOffServer.with(OnOff.Feature.DeadFrontBehavior)).events.onOff$Changed, this.handleOnOffChange);
  }

  // Dead Front OnOff Cluster
  protected handleOnOffChange(onOff: boolean): void {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    /* v8 ignore next */
    if (!onOff) {
      device.log.info('OnOffServer changed to OFF: setting Dead Front state to Manufacturer Specific');
      this.state.currentMode = 2;
    }
  }

  /**
   * Handles the DishwasherMode `ChangeToMode` command.
   *
   * @remarks
   * Matter 1.6 Application Cluster Specification §1.10.7.1.1 requires `UnsupportedMode` when `NewMode` does not
   * match any `SupportedModes` entry. Section 1.10.7.2 requires an empty `StatusText` for `UnsupportedMode`.
   *
   * @param {ModeBase.ChangeToModeRequest} request - Mode change request payload.
   * @returns {ModeBase.ChangeToModeResponse} Command response with change status.
   */
  override async changeToMode(request: ModeBase.ChangeToModeRequest): Promise<ModeBase.ChangeToModeResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`ChangeToMode (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('DishwasherMode.changeToMode', {
      command: 'changeToMode',
      request,
      cluster: DishwasherModeServer.id,
      attributes: this.state,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    const supportedMode = this.state.supportedModes.find((supportedMode) => supportedMode.mode === request.newMode);
    if (supportedMode) {
      device.log.info(`DishwasherModeServer: changeToMode called with mode ${supportedMode.mode} => ${supportedMode.label}`);
      this.state.currentMode = request.newMode;
      return { status: ModeBase.ModeChangeStatus.Success, statusText: 'Success' };
    } else {
      device.log.error(`DishwasherModeServer: changeToMode called with unsupported mode ${request.newMode}`);
      return { status: ModeBase.ModeChangeStatus.UnsupportedMode, statusText: '' };
    }
  }
}

const MatterbridgeDishwasherAlarmSchema = DishwasherAlarmServer.schema.extend(
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
 * A Dishwasher Alarm `AlarmBitmap` with every bit of Matter 1.6.0 § 8.4.4.1 set to an explicit value.
 *
 * @remarks
 * Every bit of {@link DishwasherAlarm.Alarm} is optional, so a bitmap literal that forgets one still compiles and silently
 * reads back as `false`. Building the bitmaps of this server as `DishwasherAlarmBitmap` makes TypeScript require all six.
 */
type DishwasherAlarmBitmap = Required<DishwasherAlarm.Alarm>;

/**
 * Dishwasher Alarm server bound to {@link MatterbridgeDishwasherAlarmSchema}.
 *
 * @remarks
 * The schema must be replaced before selecting the features, since `with()` derives the supported feature map from the
 * schema of the class it is called on.
 */
class DishwasherAlarmBaseServer extends DishwasherAlarmServer {
  static override readonly schema = MatterbridgeDishwasherAlarmSchema;
}

/**
 * Dishwasher Alarm server with the Alarm Base `Reset` feature, its inherited alarm elements bound to the
 * Dishwasher-specific `AlarmBitmap`.
 *
 * @remarks
 * Matter 1.6.0 § 8.4.4.1 and Alarm Base § 1.15.6.1 to § 1.15.6.4 and § 1.15.8.1 define the dishwasher alarm bits carried by
 * `Mask`, `Latch`, `State`, `Supported`, the `Reset` and `ModifyEnabledAlarms` command fields and the `Notify` event.
 * Redeclaring these inherited elements makes their wire schema resolve the Dishwasher Alarm cluster's `AlarmBitmap`, rather
 * than the empty base-cluster bitmap.
 *
 * matter.js ships no implementation for the Alarm Base cluster and only a bare behavior for the derived Dishwasher Alarm
 * cluster, so the `Reset` and `ModifyEnabledAlarms` commands and the mandatory `Notify` event are implemented here.
 *
 * Dishwasher Alarm does not override the Alarm Base commands (Matter 1.6.0 § 8.4 defines only the `AlarmBitmap`), so both
 * `Reset` (gated by the `RESET` feature, enabled here) and the optional `ModifyEnabledAlarms` are permitted, unlike
 * {@link MatterbridgeRefrigeratorAlarmServer} where both are disallowed.
 *
 * The `Notify` event is emitted automatically whenever the `State` attribute changes, so a plugin that raises or clears an
 * alarm only has to update `State`.
 */
export class MatterbridgeDishwasherAlarmServer extends DishwasherAlarmBaseServer.with(DishwasherAlarm.Feature.Reset) {
  /**
   * Registers the reaction that emits the Notify event when the State attribute changes.
   *
   * @returns {MaybePromise} Nothing when initialization completes synchronously.
   */
  override initialize(): MaybePromise {
    // oxlint-disable-next-line typescript/unbound-method
    this.reactTo(this.events.state$Changed, this.#emitNotify);
  }

  /**
   * Emits the Notify event with the alarms that became active, the alarms that became inactive, and the resulting state.
   *
   * @param {DishwasherAlarm.Alarm} state - The new value of the State attribute.
   * @param {DishwasherAlarm.Alarm} oldState - The previous value of the State attribute.
   * @returns {void}
   */
  #emitNotify(state: DishwasherAlarm.Alarm, oldState: DishwasherAlarm.Alarm): void {
    // Matter 1.6.0 § 1.15.8.1.1: Active indicates those alarms that have become active.
    const active: DishwasherAlarmBitmap = {
      inflowError: Boolean(state.inflowError && !oldState.inflowError),
      drainError: Boolean(state.drainError && !oldState.drainError),
      doorError: Boolean(state.doorError && !oldState.doorError),
      tempTooLow: Boolean(state.tempTooLow && !oldState.tempTooLow),
      tempTooHigh: Boolean(state.tempTooHigh && !oldState.tempTooHigh),
      waterLevelError: Boolean(state.waterLevelError && !oldState.waterLevelError),
    };
    // Matter 1.6.0 § 1.15.8.1.2: Inactive indicates those alarms that have become inactive.
    const inactive: DishwasherAlarmBitmap = {
      inflowError: Boolean(!state.inflowError && oldState.inflowError),
      drainError: Boolean(!state.drainError && oldState.drainError),
      doorError: Boolean(!state.doorError && oldState.doorError),
      tempTooLow: Boolean(!state.tempTooLow && oldState.tempTooLow),
      tempTooHigh: Boolean(!state.tempTooHigh && oldState.tempTooHigh),
      waterLevelError: Boolean(!state.waterLevelError && oldState.waterLevelError),
    };
    // Matter 1.6.0 § 1.15.8.1: Generate Notify when one or more alarms change state, carrying a copy of the new State (§ 1.15.8.1.4) and of the Mask attribute (§ 1.15.8.1.3).
    this.events.notify.emit({ active, inactive, state, mask: this.state.mask }, this.context);
  }

  /**
   * Validates that every alarm set in the requested bitmap is supported by the server.
   *
   * @param {DishwasherAlarm.Alarm} alarms - The requested alarm bitmap.
   * @param {Status.Failure | Status.InvalidCommand} status - The status code reported when an alarm is unsupported.
   * @returns {void}
   * @throws {StatusResponseError} With the given status code when a requested alarm is not supported.
   */
  #assertAlarmsSupported(alarms: DishwasherAlarm.Alarm, status: Status.Failure | Status.InvalidCommand): void {
    const unsupported: DishwasherAlarmBitmap = {
      inflowError: Boolean(alarms.inflowError && !this.state.supported.inflowError),
      drainError: Boolean(alarms.drainError && !this.state.supported.drainError),
      doorError: Boolean(alarms.doorError && !this.state.supported.doorError),
      tempTooLow: Boolean(alarms.tempTooLow && !this.state.supported.tempTooLow),
      tempTooHigh: Boolean(alarms.tempTooHigh && !this.state.supported.tempTooHigh),
      waterLevelError: Boolean(alarms.waterLevelError && !this.state.supported.waterLevelError),
    };
    // Matter 1.6.0 § 1.15.7.1.1 and § 1.15.7.2.1: Reject the command when it sets a bit of an alarm the Supported attribute does not report, with FAILURE for Reset and INVALID_COMMAND for ModifyEnabledAlarms.
    if (Object.values(unsupported).some(Boolean)) {
      throw new StatusResponseError(`MatterbridgeDishwasherAlarmServer: requested alarm is not supported (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`, status);
    }
  }

  /**
   * Clears the requested alarms from the State attribute, preserving the alarms that were not requested.
   *
   * @param {DishwasherAlarm.Alarm} alarms - The alarms to reset to inactive.
   * @returns {DishwasherAlarmBitmap} The resulting State bitmap.
   */
  #clearAlarms(alarms: DishwasherAlarm.Alarm): DishwasherAlarmBitmap {
    // Matter 1.6.0 § 1.15.7.1.1: Reset every alarm set in the Alarms field to inactive in the State attribute and leave the other alarms untouched.
    return {
      inflowError: Boolean(this.state.state.inflowError && !alarms.inflowError),
      drainError: Boolean(this.state.state.drainError && !alarms.drainError),
      doorError: Boolean(this.state.state.doorError && !alarms.doorError),
      tempTooLow: Boolean(this.state.state.tempTooLow && !alarms.tempTooLow),
      tempTooHigh: Boolean(this.state.state.tempTooHigh && !alarms.tempTooHigh),
      waterLevelError: Boolean(this.state.state.waterLevelError && !alarms.waterLevelError),
    };
  }

  /**
   * Clears from the State attribute the alarms that are not enabled by the given Mask.
   *
   * @param {DishwasherAlarm.Alarm} mask - The new value of the Mask attribute.
   * @returns {DishwasherAlarmBitmap} The resulting State bitmap.
   */
  #applyMaskToState(mask: DishwasherAlarm.Alarm): DishwasherAlarmBitmap {
    // Matter 1.6.0 § 1.15.7.2.1: Update the State attribute to reflect the alarm set enabled by the new Mask value, so an alarm that is no longer enabled becomes inactive.
    return {
      inflowError: Boolean(this.state.state.inflowError && mask.inflowError),
      drainError: Boolean(this.state.state.drainError && mask.drainError),
      doorError: Boolean(this.state.state.doorError && mask.doorError),
      tempTooLow: Boolean(this.state.state.tempTooLow && mask.tempTooLow),
      tempTooHigh: Boolean(this.state.state.tempTooHigh && mask.tempTooHigh),
      waterLevelError: Boolean(this.state.state.waterLevelError && mask.waterLevelError),
    };
  }

  /**
   * Forwards Reset requests to the Matterbridge command handler and then resets the requested alarms.
   *
   * @param {DishwasherAlarm.ResetRequest} request - The reset request payload.
   * @returns {Promise<void>} Resolves after forwarding, validation, and the state update complete.
   */
  override async reset(request: DishwasherAlarm.ResetRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeDishwasherAlarmServer: resetting alarms ${debugStringify(request.alarms)}${nf} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('DishwasherAlarm.reset', {
      command: 'reset',
      request,
      cluster: MatterbridgeDishwasherAlarmServer.id,
      attributes: this.state,
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
   * @param {DishwasherAlarm.ModifyEnabledAlarmsRequest} request - The modify-enabled-alarms request payload.
   * @returns {Promise<void>} Resolves after forwarding, validation, and the state updates complete.
   */
  override async modifyEnabledAlarms(request: DishwasherAlarm.ModifyEnabledAlarmsRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeDishwasherAlarmServer: modifying enabled alarms ${debugStringify(request.mask)}${nf} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('DishwasherAlarm.modifyEnabledAlarms', {
      command: 'modifyEnabledAlarms',
      request,
      cluster: MatterbridgeDishwasherAlarmServer.id,
      attributes: this.state,
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
