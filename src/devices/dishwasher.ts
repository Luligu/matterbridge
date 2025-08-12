/**
 * @description This file contains the Dishwasher class.
 * @file src/devices/dishwasher.ts
 * @author Luca Liguori
 * @created 2025-05-25
 * @version 1.1.0
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

// Imports from @matter
import { MaybePromise } from '@matter/main';
import { OperationalState } from '@matter/main/clusters/operational-state';
import { TemperatureControl } from '@matter/main/clusters/temperature-control';
import { ModeBase } from '@matter/main/clusters/mode-base';
import { DishwasherModeServer } from '@matter/main/behaviors/dishwasher-mode';
import { DishwasherAlarmServer } from '@matter/main/behaviors/dishwasher-alarm';
import { DishwasherMode } from '@matter/main/clusters/dishwasher-mode';

// Matterbridge
import { dishwasher, powerSource } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { MatterbridgeOnOffServer, MatterbridgeServer } from '../matterbridgeBehaviors.js';

import { MatterbridgeLevelTemperatureControlServer, MatterbridgeNumberTemperatureControlServer } from './temperatureControl.js';

export class Dishwasher extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the DishWasher class.
   *
   * @param {string} name - The name of the dish washer.
   * @param {string} serial - The serial number of the dish washer.
   * @param {number} [currentMode] - The current mode of the dish washer. Defaults to 2 (Normal mode). Dead Front OnOff Cluster will set this to 2 when turned off. Persistent attribute.
   * @param {DishwasherMode.ModeOption[]} [supportedModes] - The supported modes of the dish washer. Defaults to a set of common modes (which include Light, Normal, Heavy). Fixed attribute.
   * @param {number} [selectedTemperatureLevel] - The selected temperature level as an index of the supportedTemperatureLevels array. Defaults to 1 (which corresponds to 'Warm').
   * @param {string[]} [supportedTemperatureLevels] - The supported temperature levels. Defaults to ['Cold', 'Warm', 'Hot', '30°', '40°', '60°', '80°']. Fixed attribute.
   * @param {number} [temperatureSetpoint] - The temperature setpoint * 100. Defaults to 40 * 100 (which corresponds to 40°C).
   * @param {number} [minTemperature] - The minimum temperature * 100. Defaults to 30 * 100 (which corresponds to 30°C). Fixed attribute.
   * @param {number} [maxTemperature] - The maximum temperature * 100. Defaults to 60 * 100 (which corresponds to 60°C). Fixed attribute.
   * @param {number} [step] - The step size for temperature changes. Defaults to 10 * 100 (which corresponds to 10°C). Fixed attribute.
   * @param {OperationalState.OperationalStateEnum} [operationalState] - The operational state of the laundry washer. Defaults to OperationalState.OperationalStateEnum.Off.
   *
   * Remarks:
   * - If `temperatureSetpoint` is provided, the `createNumberTemperatureControlClusterServer` method will be used to create the TemperatureControl Cluster Server with features TemperatureNumber and TemperatureStep.
   * - If `temperatureSetpoint` is not provided, the `createLevelTemperatureControlClusterServer` method will be used to create the TemperatureControl Cluster Server with feature TemperatureLevel.
   */
  constructor(
    name: string,
    serial: string,
    currentMode?: number,
    supportedModes?: DishwasherMode.ModeOption[],
    selectedTemperatureLevel?: number,
    supportedTemperatureLevels?: string[],
    temperatureSetpoint?: number,
    minTemperature?: number,
    maxTemperature?: number,
    step?: number,
    operationalState?: OperationalState.OperationalStateEnum,
  ) {
    super([dishwasher, powerSource], { uniqueStorageKey: `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}` }, true);
    this.createDefaultIdentifyClusterServer();
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Dishwasher');
    this.createDefaultPowerSourceWiredClusterServer();
    this.createDeadFrontOnOffClusterServer(true);
    this.createDefaultDishwasherModeClusterServer(currentMode, supportedModes);
    this.createDefaultDishwasherAlarmClusterServer();
    if (temperatureSetpoint) this.createNumberTemperatureControlClusterServer(temperatureSetpoint, minTemperature, maxTemperature, step);
    else this.createLevelTemperatureControlClusterServer(selectedTemperatureLevel, supportedTemperatureLevels);
    this.createDefaultOperationalStateClusterServer(operationalState);
  }

  /**
   * Creates a TemperatureControl Cluster Server with feature TemperatureLevel.
   *
   * @param {number} selectedTemperatureLevel - The selected temperature level as an index of the supportedTemperatureLevels array. Defaults to 1 (which corresponds to 'Warm').
   * @param {string[]} supportedTemperatureLevels - The supported temperature levels. Defaults to ['Cold', 'Warm', 'Hot', '30°', '40°', '60°', '80°'].
   *
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createLevelTemperatureControlClusterServer(selectedTemperatureLevel: number = 1, supportedTemperatureLevels: string[] = ['Cold', 'Warm', 'Hot', '30°', '40°', '60°', '80°']): this {
    this.behaviors.require(MatterbridgeLevelTemperatureControlServer.with(TemperatureControl.Feature.TemperatureLevel), {
      selectedTemperatureLevel,
      supportedTemperatureLevels,
    });
    return this;
  }

  /**
   * Creates a TemperatureControl Cluster Server with features TemperatureNumber and TemperatureStep.
   *
   * @param {number} temperatureSetpoint - The temperature setpoint * 100. Defaults to 40 * 100 (which corresponds to 40°C).
   * @param {number} minTemperature - The minimum temperature * 100. Defaults to 30 * 100 (which corresponds to 30°C). Fixed attribute.
   * @param {number} maxTemperature - The maximum temperature * 100. Defaults to 60 * 100 (which corresponds to 60°C). Fixed attribute.
   * @param {number} [step] - The step size for temperature changes. Defaults to 10 * 100 (which corresponds to 10°C). Fixed attribute.
   *
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createNumberTemperatureControlClusterServer(temperatureSetpoint: number = 40 * 100, minTemperature: number = 30 * 100, maxTemperature: number = 60 * 100, step: number = 10 * 100): this {
    this.behaviors.require(MatterbridgeNumberTemperatureControlServer.with(TemperatureControl.Feature.TemperatureNumber, TemperatureControl.Feature.TemperatureStep), {
      temperatureSetpoint,
      minTemperature, // Fixed attribute
      maxTemperature, // Fixed attribute
      step, // Fixed attribute
    });
    return this;
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

export class MatterbridgeDishwasherModeServer extends DishwasherModeServer {
  override initialize() {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeDishwasherModeServer initialized: currentMode is ${this.state.currentMode}`);
    this.state.currentMode = 2;
    this.reactTo(this.agent.get(MatterbridgeOnOffServer).events.onOff$Changed, this.handleOnOffChange);
  }

  // Dead Front OnOff Cluster
  protected handleOnOffChange(onOff: boolean) {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    if (onOff === false) {
      device.log.info('OnOffServer changed to OFF: setting Dead Front state to Manufacturer Specific');
      this.state.currentMode = 2;
    }
  }

  override changeToMode(request: ModeBase.ChangeToModeRequest): MaybePromise<ModeBase.ChangeToModeResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`ChangeToMode (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('changeToMode', { request, cluster: DishwasherModeServer.id, attributes: this.state, endpoint: this.endpoint });
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
