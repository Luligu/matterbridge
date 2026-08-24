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
import { DishwasherAlarmServer } from '@matter/node/behaviors/dishwasher-alarm';
import { DishwasherModeServer } from '@matter/node/behaviors/dishwasher-mode';
import type { EndpointNumber } from '@matter/types';
import { DishwasherMode } from '@matter/types/clusters/dishwasher-mode';
import { ModeBase } from '@matter/types/clusters/mode-base';
import { OnOff } from '@matter/types/clusters/on-off';
import type { OperationalState } from '@matter/types/clusters/operational-state';
import type { Semtag } from '@matter/types/globals';

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
    this.behaviors.require(DishwasherAlarmServer, {
      mask: { inflowError: true, drainError: true, doorError: true, tempTooLow: true, tempTooHigh: true, waterLevelError: true },
      state: { inflowError: false, drainError: false, doorError: false, tempTooLow: false, tempTooHigh: false, waterLevelError: false },
      supported: { inflowError: true, drainError: true, doorError: true, tempTooLow: true, tempTooHigh: true, waterLevelError: true },
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
      device.log.error(`DishwasherModeServer: changeToMode called with invalid mode ${request.newMode}`);
      return { status: ModeBase.ModeChangeStatus.InvalidInMode, statusText: 'Invalid mode' };
    }
  }
}
