/**
 * This file contains the LaundryWasher class.
 *
 * @file laundryWasher.ts
 * @author Luca Liguori
 * @date 2025-05-25
 * @version 1.1.0
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
 * limitations under the License. *
 */

// Imports from @matter
import { MaybePromise } from '@matter/main';

import { OperationalState } from '@matter/main/clusters/operational-state';
import { LaundryWasherControls } from '@matter/main/clusters/laundry-washer-controls';
import { LaundryWasherMode } from '@matter/main/clusters/laundry-washer-mode';
import { TemperatureControl } from '@matter/main/clusters/temperature-control';
import { ModeBase } from '@matter/main/clusters/mode-base';

import { TemperatureControlServer } from '@matter/main/behaviors/temperature-control';
import { LaundryWasherModeServer } from '@matter/main/behaviors/laundry-washer-mode';
import { LaundryWasherControlsServer } from '@matter/main/behaviors/laundry-washer-controls';

// Matterbridge
import { laundryWasher } from './matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { MatterbridgeOnOffServer, MatterbridgeServer } from './matterbridgeBehaviors.js';

export class LaundryWasher extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the LaundryWasher class.
   *
   * @param {string} name - The name of the laundry washer.
   * @param {string} serial - The serial number of the laundry washer.
   * @param {number} [currentMode=2] - The current mode of the laundry washer. Defaults to 2 (Normal mode). Dead Front OnOff Cluster will set this to 2 when turned off. Persistent attribute.
   * @param {LaundryWasherMode.ModeOption[]} [supportedModes] - The supported modes of the laundry washer. Defaults to a set of common modes (which include Delicate, Normal, Heavy, and Whites). Fixed attribute.
   * @param {number} [spinSpeedCurrent=2] - The current spin speed as index of the spinSpeeds array. Defaults to 2 (which corresponds to '1200').
   * @param {string[]} [spinSpeeds] - The supported spin speeds. Defaults to ['400', '800', '1200', '1600'].
   * @param {LaundryWasherControls.NumberOfRinses} [numberOfRinses=LaundryWasherControls.NumberOfRinses.Normal] - The number of rinses. Defaults to LaundryWasherControls.NumberOfRinses.Normal (which corresponds to 1 rinse).
   * @param {LaundryWasherControls.NumberOfRinses[]} [supportedRinses] - The supported rinses. Defaults to [NumberOfRinses.None, NumberOfRinses.Normal, NumberOfRinses.Max, NumberOfRinses.Extra].
   * @param {number} [selectedTemperatureLevel=1] - The selected temperature level as an index of the supportedTemperatureLevels array. Defaults to 1 (which corresponds to 'Warm').
   * @param {string[]} [supportedTemperatureLevels] - The supported temperature levels. Defaults to ['Cold', 'Warm', 'Hot', '30°', '40°', '60°', '80°']. Fixed attribute.
   * @param {number} [temperatureSetpoint] - The temperature setpoint * 100. Defaults to 40 * 100 (which corresponds to 40°C).
   * @param {number} [minTemperature=30 * 100] - The minimum temperature * 100. Defaults to 30 * 100 (which corresponds to 30°C). Fixed attribute.
   * @param {number} [maxTemperature=60 * 100] - The maximum temperature * 100. Defaults to 60 * 100 (which corresponds to 60°C). Fixed attribute.
   * @param {number} [step=10 * 100] - The step size for temperature changes. Defaults to 10 * 100 (which corresponds to 10°C). Fixed attribute.
   * @param {OperationalState.OperationalStateEnum} [operationalState=OperationalState.OperationalStateEnum.Off] - The operational state of the laundry washer. Defaults to OperationalState.OperationalStateEnum.Off.
   *
   * @remarks
   * - If `temperatureSetpoint` is provided, the `createNumberTemperatureControlClusterServer` method will be used to create the TemperatureControl Cluster Server with features TemperatureNumber and TemperatureStep.
   * - If `temperatureSetpoint` is not provided, the `createLevelTemperatureControlClusterServer` method will be used to create the TemperatureControl Cluster Server with feature TemperatureLevel.
   *
   */
  constructor(
    name: string,
    serial: string,
    currentMode?: number,
    supportedModes?: LaundryWasherMode.ModeOption[],
    spinSpeedCurrent?: number,
    spinSpeeds?: string[],
    numberOfRinses?: LaundryWasherControls.NumberOfRinses,
    supportedRinses?: LaundryWasherControls.NumberOfRinses[],
    selectedTemperatureLevel?: number,
    supportedTemperatureLevels?: string[],
    temperatureSetpoint?: number,
    minTemperature?: number,
    maxTemperature?: number,
    step?: number,
    operationalState?: OperationalState.OperationalStateEnum,
  ) {
    super(laundryWasher, { uniqueStorageKey: `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}` }, true);
    this.createDefaultIdentifyClusterServer();
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Laundry Washer');
    this.createDefaultPowerSourceWiredClusterServer();
    this.createDeadFrontOnOffClusterServer(true);
    this.createDefaultLaundryWasherModeClusterServer(currentMode, supportedModes);
    this.createDefaultLaundryWasherControlsClusterServer(spinSpeedCurrent, spinSpeeds, numberOfRinses, supportedRinses);
    if (temperatureSetpoint) this.createNumberTemperatureControlClusterServer(temperatureSetpoint, minTemperature, maxTemperature, step);
    else this.createLevelTemperatureControlClusterServer(selectedTemperatureLevel, supportedTemperatureLevels);
    this.createDefaultOperationalStateClusterServer(operationalState);
  }

  /**
   * Creates a default Laundry Washer Mode Cluster Server.
   *
   * @param {number} currentMode - The current mode of the laundry washer. Defaults to 2 (Normal mode). Dead Front OnOff Cluster will set this to 2 when turned off. Persistent attribute.
   * @param {LaundryWasherMode.ModeOption[]} supportedModes - The supported modes of the laundry washer. Defaults to a set of common modes (which include Delicate, Normal, Heavy, and Whites). Fixed attribute.
   *
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultLaundryWasherModeClusterServer(
    currentMode = 2,
    supportedModes: LaundryWasherMode.ModeOption[] = [
      { label: 'Delicate', mode: 1, modeTags: [{ value: LaundryWasherMode.ModeTag.Delicate }] },
      { label: 'Normal', mode: 2, modeTags: [{ value: LaundryWasherMode.ModeTag.Normal }] },
      { label: 'Heavy', mode: 3, modeTags: [{ value: LaundryWasherMode.ModeTag.Heavy }] },
      { label: 'Whites', mode: 4, modeTags: [{ value: LaundryWasherMode.ModeTag.Whites }] },
    ],
  ): this {
    this.behaviors.require(MatterbridgeLaundryWasherModeServer, {
      supportedModes, // Fixed attribute.
      currentMode, // Persistent attribute.
    });
    return this;
  }

  /**
   * Creates a Laundry Washer Controls Cluster Server with feature Spin for selecting the spin speed and feature Rinse for selecting the number of rinses.
   *
   * @param {number} spinSpeedCurrent - The current spin speed as index of the spinSpeeds array. Default to 2 (which corresponds to '1200').
   * @param {string[]} spinSpeeds - The supported spin speeds. Default to ['400', '800', '1200', '1600'].
   * @param {LaundryWasherControls.NumberOfRinses} numberOfRinses - The number of rinses. Default to LaundryWasherControls.NumberOfRinses.Normal (which corresponds to 1 rinse).
   * @param {LaundryWasherControls.NumberOfRinses[]} supportedRinses - The supported rinses. Default to [NumberOfRinses.None, NumberOfRinses.Normal, NumberOfRinses.Max, NumberOfRinses.Extra].
   *
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultLaundryWasherControlsClusterServer(
    spinSpeedCurrent = 2,
    spinSpeeds: string[] = ['400', '800', '1200', '1600'],
    numberOfRinses: LaundryWasherControls.NumberOfRinses = LaundryWasherControls.NumberOfRinses.Normal,
    supportedRinses: LaundryWasherControls.NumberOfRinses[] = [LaundryWasherControls.NumberOfRinses.None, LaundryWasherControls.NumberOfRinses.Normal, LaundryWasherControls.NumberOfRinses.Max, LaundryWasherControls.NumberOfRinses.Extra],
  ): this {
    this.behaviors.require(LaundryWasherControlsServer.with(LaundryWasherControls.Feature.Spin, LaundryWasherControls.Feature.Rinse), {
      spinSpeeds,
      spinSpeedCurrent, // Writable and nullable
      supportedRinses,
      numberOfRinses, // Writable
    });
    return this;
  }

  /**
   * Creates a TemperatureControl Cluster Server with feature TemperatureLevel.
   *
   * @param {number} selectedTemperatureLevel - The selected temperature level as an index of the supportedTemperatureLevels array. Defaults to 1 (which corresponds to 'Warm').
   * @param {string[]} supportedTemperatureLevels - The supported temperature levels. Defaults to ['Cold', 'Warm', 'Hot', '30°', '40°', '60°', '80°']. Fixed attribute.
   *
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createLevelTemperatureControlClusterServer(selectedTemperatureLevel = 1, supportedTemperatureLevels = ['Cold', 'Warm', 'Hot', '30°', '40°', '60°', '80°']): this {
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
   * @param {number} [step=1] - The step size for temperature changes. Defaults to 10 * 100 (which corresponds to 10°C). Fixed attribute.
   *
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createNumberTemperatureControlClusterServer(temperatureSetpoint = 40 * 100, minTemperature = 30 * 100, maxTemperature = 60 * 100, step = 10 * 100): this {
    this.behaviors.require(MatterbridgeNumberTemperatureControlServer.with(TemperatureControl.Feature.TemperatureNumber, TemperatureControl.Feature.TemperatureStep), {
      temperatureSetpoint,
      minTemperature, // Fixed attribute
      maxTemperature, // Fixed attribute
      step, // Fixed attribute
    });
    return this;
  }
}

export class MatterbridgeLevelTemperatureControlServer extends TemperatureControlServer.with(TemperatureControl.Feature.TemperatureLevel) {
  override initialize() {
    if (this.state.supportedTemperatureLevels.length >= 2) {
      const device = this.endpoint.stateOf(MatterbridgeServer);
      device.log.info(`MatterbridgeLevelTemperatureControlServer initialized with selectedTemperatureLevel ${this.state.selectedTemperatureLevel} and supportedTemperatureLevels: ${this.state.supportedTemperatureLevels.join(', ')}`);
    }
  }

  override setTemperature(request: TemperatureControl.SetTemperatureRequest): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`SetTemperature (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('setTemperature', { request, attributes: this.state, endpoint: this.endpoint });
    if (request.targetTemperatureLevel !== undefined && request.targetTemperatureLevel >= 0 && request.targetTemperatureLevel < this.state.supportedTemperatureLevels.length) {
      device.log.debug(`MatterbridgeLevelTemperatureControlServer: setTemperature called setting selectedTemperatureLevel to ${request.targetTemperatureLevel}: ${this.state.supportedTemperatureLevels[request.targetTemperatureLevel]}`);
      this.state.selectedTemperatureLevel = request.targetTemperatureLevel;
    } else {
      device.log.error(`MatterbridgeLevelTemperatureControlServer: setTemperature called with invalid targetTemperatureLevel ${request.targetTemperatureLevel}`);
    }
  }
}

export class MatterbridgeNumberTemperatureControlServer extends TemperatureControlServer.with(TemperatureControl.Feature.TemperatureNumber, TemperatureControl.Feature.TemperatureStep) {
  override initialize() {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeNumberTemperatureControlServer initialized with temperatureSetpoint ${this.state.temperatureSetpoint} minTemperature ${this.state.minTemperature} maxTemperature ${this.state.maxTemperature} step ${this.state.step}`);
  }

  override setTemperature(request: TemperatureControl.SetTemperatureRequest): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`SetTemperature (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('setTemperature', { request, attributes: this.state, endpoint: this.endpoint });
    if (request.targetTemperature !== undefined && request.targetTemperature >= this.state.minTemperature && request.targetTemperature <= this.state.maxTemperature) {
      device.log.debug(`MatterbridgeNumberTemperatureControlServer: setTemperature called setting temperatureSetpoint to ${request.targetTemperature}`);
      this.state.temperatureSetpoint = request.targetTemperature;
    } else {
      device.log.error(`MatterbridgeNumberTemperatureControlServer: setTemperature called with invalid targetTemperature ${request.targetTemperature}`);
    }
  }
}

export class MatterbridgeLaundryWasherModeServer extends LaundryWasherModeServer {
  override initialize() {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeLaundryWasherModeServer initialized: currentMode is ${this.state.currentMode}`);
    this.reactTo(this.agent.get(MatterbridgeOnOffServer).events.onOff$Changed, this.handleOnOffChange);
  }

  // Dead Front OnOff Cluster
  protected handleOnOffChange(onOff: boolean) {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`HandleOnOffChange (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    if (onOff === false) {
      device.log.notice('OnOffServer changed to OFF: setting Dead Front state to Manufacturer Specific');
      this.state.currentMode = 2;
    }
  }

  override changeToMode(request: ModeBase.ChangeToModeRequest): MaybePromise<ModeBase.ChangeToModeResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`ChangeToMode (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('changeToMode', { request, attributes: this.state, endpoint: this.endpoint });
    const supportedMode = this.state.supportedModes.find((supportedMode) => supportedMode.mode === request.newMode);
    if (supportedMode) {
      device.commandHandler.executeHandler('changeToMode', { request, attributes: this.state, endpoint: this.endpoint });
      device.log.debug(`MatterbridgeLaundryWasherModeServer: changeToMode called with mode ${supportedMode.mode} => ${supportedMode.label}`);
      this.state.currentMode = request.newMode;
      return { status: ModeBase.ModeChangeStatus.Success, statusText: 'Success' };
    } else {
      device.log.error(`MatterbridgeLaundryWasherModeServer: changeToMode called with invalid mode ${request.newMode}`);
      return { status: ModeBase.ModeChangeStatus.InvalidInMode, statusText: 'Invalid mode' };
    }
  }
}
