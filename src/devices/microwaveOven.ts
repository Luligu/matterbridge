/**
 * @description This file contains the MicrowaveOven class.
 * @file src/devices/microwaveOven.ts
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
import { MaybePromise } from '@matter/general';
import { OperationalState } from '@matter/types/clusters/operational-state';
import { MicrowaveOvenMode } from '@matter/types/clusters/microwave-oven-mode';
import { MicrowaveOvenControl } from '@matter/types/clusters/microwave-oven-control';
import { MicrowaveOvenControlServer } from '@matter/node/behaviors/microwave-oven-control';
import { MicrowaveOvenModeServer } from '@matter/node/behaviors/microwave-oven-mode';

// Matterbridge
import { microwaveOven, powerSource } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { MatterbridgeServer, MatterbridgeOperationalStateServer } from '../matterbridgeBehaviors.js';

export class MicrowaveOven extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the MicrowaveOven class.
   *
   * @param {string} name - The name of the microwave oven.
   * @param {string} serial - The serial number of the microwave oven.
   * @param {number} currentMode - The current mode of the microwave oven. Default is 1 = Auto.
   * @param {MicrowaveOvenMode.ModeOption[]} supportedModes - The supported modes of the microwave oven. Default is an array of all modes.
   * @param {number} selectedWattIndex - The selected wattage index. Default is 5 (600W).
   * @param {number[]} supportedWatts - The supported wattages. Default is an array of all standard microwave wattages.
   * @param {number} cookTime - The initial cook time in seconds. Default is 60 seconds.
   * @param {number} maxCookTime - The maximum cook time in seconds. Default is 3600 seconds (1 hour).
   *
   * @remarks
   * - 8.12. Microwave Oven Mode Cluster
   * - Exactly one entry in the SupportedModes attribute SHALL include the Normal mode tag in the ModeTags field.
   * - The Normal and Defrost mode tags are mutually exclusive and SHALL NOT both be used together in a mode’s ModeTags.
   */
  constructor(
    name: string,
    serial: string,
    currentMode: number = 1,
    supportedModes: MicrowaveOvenMode.ModeOption[] = [
      { label: 'Auto', mode: 1, modeTags: [{ value: MicrowaveOvenMode.ModeTag.Auto }] },
      { label: 'Quick', mode: 2, modeTags: [{ value: MicrowaveOvenMode.ModeTag.Quick }] },
      { label: 'Quiet', mode: 3, modeTags: [{ value: MicrowaveOvenMode.ModeTag.Quiet }] },
      { label: 'Min', mode: 4, modeTags: [{ value: MicrowaveOvenMode.ModeTag.Min }] },
      { label: 'Max', mode: 5, modeTags: [{ value: MicrowaveOvenMode.ModeTag.Max }] },
      { label: 'Normal', mode: 6, modeTags: [{ value: MicrowaveOvenMode.ModeTag.Normal }] },
      { label: 'Defrost', mode: 7, modeTags: [{ value: MicrowaveOvenMode.ModeTag.Defrost }] },
    ],
    selectedWattIndex: number = 5,
    supportedWatts: number[] = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000],
    cookTime: number = 60, // 1 minute
    maxCookTime: number = 3600, // 1 hour
  ) {
    super([microwaveOven, powerSource], { uniqueStorageKey: `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}` }, true);
    this.createDefaultIdentifyClusterServer();
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Microwave Oven');
    this.createDefaultPowerSourceWiredClusterServer();
    this.createDefaultOperationalStateClusterServer(OperationalState.OperationalStateEnum.Stopped);
    this.createDefaultMicrowaveOvenModeClusterServer(currentMode, supportedModes);
    this.createDefaultMicrowaveOvenControlClusterServer(selectedWattIndex, supportedWatts, cookTime, maxCookTime);
  }

  /**
   * Creates a default MicrowaveOvenMode Cluster Server.
   * There is no changeToMode command in the spec, so this is not implemented.
   * The Microwave is controlled by the MicrowaveOvenControl cluster.
   *
   * @param {number} currentMode - The current mode of the oven.
   * @param {MicrowaveOvenMode.ModeOption[]} supportedModes - The supported modes.
   *
   * @returns {MatterbridgeEndpoint} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * - 8.12. Microwave Oven Mode Cluster
   * - the supported modes are fixed and cannot be changed at runtime.
   * - the current mode is persistent among reboots.
   * - Exactly one entry in the SupportedModes attribute SHALL include the Normal mode tag in the ModeTags field.
   * - The Normal and Defrost mode tags are mutually exclusive and SHALL NOT both be used together in a mode’s ModeTags.
   */
  createDefaultMicrowaveOvenModeClusterServer(currentMode: number, supportedModes: MicrowaveOvenMode.ModeOption[]): this {
    this.behaviors.require(MicrowaveOvenModeServer, {
      supportedModes, // Fixed attribute
      currentMode, // Persistent attribute
    });
    return this;
  }

  /**
   * Creates a default MicrowaveOvenControl Cluster Server.
   *
   * @param {number} selectedWattIndex - The selected watt index.
   * @param {number[]} supportedWatts - The supported watt values.
   * @param {number} cookTime - The initial cook time.
   * @param {number} maxCookTime - The maximum cook time.
   *
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * - 8.13. Microwave Oven Control Cluster
   * - the supported watt values are fixed and cannot be changed at runtime.
   * - the maxCookTime is a fixed attribute and cannot be changed at runtime.
   */
  createDefaultMicrowaveOvenControlClusterServer(selectedWattIndex: number, supportedWatts: number[], cookTime: number, maxCookTime: number): this {
    this.behaviors.require(MatterbridgeMicrowaveOvenControlServer.with(MicrowaveOvenControl.Feature.PowerInWatts), {
      supportedWatts, // Fixed attribute
      selectedWattIndex,
      cookTime,
      maxCookTime, // Fixed attribute
    });
    return this;
  }
}

/**
 * Matterbridge Microwave Oven Control Server
 */
export class MatterbridgeMicrowaveOvenControlServer extends MicrowaveOvenControlServer.with(MicrowaveOvenControl.Feature.PowerInWatts) {
  override initialize() {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info('MatterbridgeMicrowaveOvenControlServer initialized');
  }

  // 8.13.6.2. SetCookingParameters Command
  override setCookingParameters(request: MicrowaveOvenControl.SetCookingParametersRequest): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeMicrowaveOvenControlServer: setCookingParameters (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('setCookingParameters', { request, cluster: MicrowaveOvenControl.Cluster.id, attributes: this.state, endpoint: this.endpoint });

    // 8.13.6.2.1. CookMode Field. Default to Normal mode if not present.
    if (request.cookMode !== undefined) {
      device.log.info(`MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting cookMode to ${request.cookMode}`);
      this.endpoint.setStateOf(MicrowaveOvenModeServer, { currentMode: request.cookMode });
    } else {
      device.log.info(`MatterbridgeMicrowaveOvenControlServer: setCookingParameters called with no cookMode so set to Normal`);
      const supportedModes = this.endpoint.stateOf(MicrowaveOvenModeServer).supportedModes;
      const normalMode = supportedModes.find((mode) => mode.modeTags.some((tag) => tag.value === MicrowaveOvenMode.ModeTag.Normal));
      this.endpoint.setStateOf(MicrowaveOvenModeServer, { currentMode: normalMode?.mode });
    }

    // 8.13.6.2.2. CookTime Field. Default to 30 seconds.
    if (request.cookTime !== undefined && request.cookTime >= 0 && request.cookTime <= this.state.maxCookTime) {
      device.log.info(`MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting cookTime to ${request.cookTime}`);
      this.state.cookTime = request.cookTime;
    } else {
      device.log.info(`MatterbridgeMicrowaveOvenControlServer: setCookingParameters called with no cookTime so set to 30sec.`);
      this.state.cookTime = 30;
    }

    // 8.13.6.2.4. WattSettingIndex Field. Default the highest Watt setting for the selected CookMode.
    if (request.wattSettingIndex !== undefined && request.wattSettingIndex >= 0 && request.wattSettingIndex < this.state.supportedWatts.length) {
      device.log.info(`MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting selectedWattIndex to ${request.wattSettingIndex}`);
      this.state.selectedWattIndex = request.wattSettingIndex;
    } else {
      device.log.info(`MatterbridgeMicrowaveOvenControlServer: setCookingParameters called with no wattSettingIndex so set to the highest Watt setting for the selected CookMode`);
      this.state.selectedWattIndex = this.state.supportedWatts.length - 1;
    }

    // 8.13.6.2.5. StartAfterSetting Field. Default to false.
    if (request.startAfterSetting === true) {
      device.log.info(`MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting startAfterSetting = true`);
      this.endpoint.setStateOf(MatterbridgeOperationalStateServer, { operationalState: OperationalState.OperationalStateEnum.Running });
    }
  }

  // 8.13.6.3. AddMoreTime Command
  override addMoreTime(request: MicrowaveOvenControl.AddMoreTimeRequest): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeMicrowaveOvenControlServer: addMoreTime (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('addMoreTime', { request, cluster: MicrowaveOvenControl.Cluster.id, attributes: this.state, endpoint: this.endpoint });
    if (request.timeToAdd !== undefined && request.timeToAdd > 0 && this.state.cookTime + request.timeToAdd <= this.state.maxCookTime) {
      device.log.info(`MatterbridgeMicrowaveOvenControlServer: addMoreTime called setting cookTime to ${this.state.cookTime + request.timeToAdd}`);
      this.state.cookTime += request.timeToAdd;
    } else {
      device.log.error(`MatterbridgeMicrowaveOvenControlServer: addMoreTime called with invalid cookTime ${request.timeToAdd}`);
    }
  }
}
