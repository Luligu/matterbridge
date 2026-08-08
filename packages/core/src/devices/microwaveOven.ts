/**
 * @file packages/core/src/devices/microwaveOven.ts
 * @description This file contains the MicrowaveOven class.
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

/* oxlint-disable unicorn/no-negated-condition */
/* oxlint-disable typescript/no-unsafe-type-assertion */

// @matter
import { MicrowaveOvenControlServer } from '@matter/node/behaviors/microwave-oven-control';
import { MicrowaveOvenModeServer } from '@matter/node/behaviors/microwave-oven-mode';
import { MicrowaveOvenControl } from '@matter/types/clusters/microwave-oven-control';
import { MicrowaveOvenMode } from '@matter/types/clusters/microwave-oven-mode';
import { OperationalState } from '@matter/types/clusters/operational-state';

// Matterbridge
import { MatterbridgeServer } from '../behaviors/matterbridgeServer.js';
import { MatterbridgeOperationalStateServer } from '../behaviors/operationalStateServer.js';
import { microwaveOven, powerSource } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';

/**
 * Matterbridge endpoint representing a microwave oven device.
 */
export class MicrowaveOven extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the MicrowaveOven class.
   *
   * @param {string} name - The name of the microwave oven.
   * @param {string} serial - The serial number of the microwave oven.
   * @param {number} currentMode - The current mode of the microwave oven. Default is 1 = Auto.
   * @param {MicrowaveOvenMode.ModeOption[]} supportedModes - The supported modes of the microwave oven. Default is an array of all modes.
   * @param {number} powerSetting - The power level associated with the operation of the device. Default is 100.
   * @param {number} minPower - The minimum value to which the PowerSetting attribute can be set. Default is 10.
   * @param {number} maxPower - The maximum value to which the PowerSetting attribute can be set. Default is 100.
   * @param {number} powerStep - The increment of power that can be set on the server. Default is 10.
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
    powerSetting: number = 100,
    minPower: number = 10,
    maxPower: number = 100,
    powerStep: number = 10,
    cookTime: number = 60, // 1 minute
    maxCookTime: number = 3600, // 1 hour
  ) {
    super([microwaveOven, powerSource], { id: `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}` });
    this.createDefaultIdentifyClusterServer();
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Microwave Oven');
    this.createDefaultPowerSourceWiredClusterServer();
    this.createDefaultOperationalStateClusterServer(OperationalState.OperationalStateEnum.Stopped);
    this.createDefaultMicrowaveOvenModeClusterServer(currentMode, supportedModes);
    this.createDefaultMicrowaveOvenControlClusterServer(powerSetting, minPower, maxPower, powerStep, cookTime, maxCookTime);
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
   * @param {number} powerSetting - The power level associated with the operation of the device.
   * @param {number} minPower - The minimum value to which the PowerSetting attribute can be set.
   * @param {number} maxPower - The maximum value to which the PowerSetting attribute can be set.
   * @param {number} powerStep - The increment of power that can be set on the server.
   * @param {number} cookTime - The initial cook time.
   * @param {number} maxCookTime - The maximum cook time.
   *
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * - 8.13. Microwave Oven Control Cluster
   * - minPower, maxPower and powerStep are fixed attributes and cannot be changed at runtime.
   * - the maxCookTime is a fixed attribute and cannot be changed at runtime.
   */
  createDefaultMicrowaveOvenControlClusterServer(powerSetting: number, minPower: number, maxPower: number, powerStep: number, cookTime: number, maxCookTime: number): this {
    this.behaviors.require(MatterbridgeMicrowaveOvenControlServer.with(MicrowaveOvenControl.Feature.PowerAsNumber, MicrowaveOvenControl.Feature.PowerNumberLimits), {
      powerSetting,
      minPower, // Fixed attribute
      maxPower, // Fixed attribute
      powerStep, // Fixed attribute
      cookTime,
      maxCookTime, // Fixed attribute
    });
    return this;
  }
}

/**
 * Matterbridge Microwave Oven Control Server
 */
export class MatterbridgeMicrowaveOvenControlServer extends MicrowaveOvenControlServer.with(
  MicrowaveOvenControl.Feature.PowerAsNumber,
  MicrowaveOvenControl.Feature.PowerNumberLimits,
) {
  /**
   * Initializes the server.
   */
  override async initialize(): Promise<void> {
    await super.initialize();
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info('MatterbridgeMicrowaveOvenControlServer initialized');
  }

  // 8.13.6.2. SetCookingParameters Command
  /**
   * Handles the MicrowaveOvenControl `SetCookingParameters` command.
   *
   * @param {MicrowaveOvenControl.SetCookingParametersRequest} request - Cooking parameter request payload.
   */
  override async setCookingParameters(request: MicrowaveOvenControl.SetCookingParametersRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeMicrowaveOvenControlServer: setCookingParameters (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('MicrowaveOvenControl.setCookingParameters', {
      command: 'setCookingParameters',
      request,
      cluster: MicrowaveOvenControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof MicrowaveOvenControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });

    // 8.13.6.2.1. CookMode Field. Default to Normal mode if not present.
    if (request.cookMode !== undefined) {
      device.log.info(`MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting cookMode to ${request.cookMode}`);
      await this.endpoint.setStateOf(MicrowaveOvenModeServer, { currentMode: request.cookMode });
    } else {
      device.log.info(`MatterbridgeMicrowaveOvenControlServer: setCookingParameters called with no cookMode so set to Normal`);
      const supportedModes = this.endpoint.stateOf(MicrowaveOvenModeServer).supportedModes;
      const normalMode = supportedModes.find((mode) => mode.modeTags.some((tag) => tag.value === MicrowaveOvenMode.ModeTag.Normal));
      await this.endpoint.setStateOf(MicrowaveOvenModeServer, { currentMode: normalMode?.mode });
    }

    // 8.13.6.2.2. CookTime Field. Default to 30 seconds.
    if (request.cookTime !== undefined && request.cookTime >= 0 && request.cookTime <= this.state.maxCookTime) {
      device.log.info(`MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting cookTime to ${request.cookTime}`);
      this.state.cookTime = request.cookTime;
    } else {
      device.log.info(`MatterbridgeMicrowaveOvenControlServer: setCookingParameters called with no cookTime so set to 30sec.`);
      this.state.cookTime = 30;
    }

    // 8.13.6.2.3. PowerSetting Field. Default to MaxPower if not present.
    if (request.powerSetting !== undefined && request.powerSetting >= this.state.minPower && request.powerSetting <= this.state.maxPower) {
      device.log.info(`MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting powerSetting to ${request.powerSetting}`);
      this.state.powerSetting = request.powerSetting;
    } else {
      device.log.info(`MatterbridgeMicrowaveOvenControlServer: setCookingParameters called with no powerSetting so set to maxPower`);
      this.state.powerSetting = this.state.maxPower;
    }

    // 8.13.6.2.5. StartAfterSetting Field. Default to false.
    if (request.startAfterSetting === true) {
      device.log.info(`MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting startAfterSetting = true`);
      await this.endpoint.setStateOf(MatterbridgeOperationalStateServer, { operationalState: OperationalState.OperationalStateEnum.Running });
    }
  }

  // 8.13.6.3. AddMoreTime Command
  /**
   * Handles the MicrowaveOvenControl `AddMoreTime` command.
   *
   * @param {MicrowaveOvenControl.AddMoreTimeRequest} request - Additional time request payload.
   */
  override async addMoreTime(request: MicrowaveOvenControl.AddMoreTimeRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeMicrowaveOvenControlServer: addMoreTime (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('MicrowaveOvenControl.addMoreTime', {
      command: 'addMoreTime',
      request,
      cluster: MicrowaveOvenControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof MicrowaveOvenControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    if (request.timeToAdd !== undefined && request.timeToAdd > 0 && this.state.cookTime + request.timeToAdd <= this.state.maxCookTime) {
      device.log.info(`MatterbridgeMicrowaveOvenControlServer: addMoreTime called setting cookTime to ${this.state.cookTime + request.timeToAdd}`);
      this.state.cookTime += request.timeToAdd;
    } else {
      device.log.error(`MatterbridgeMicrowaveOvenControlServer: addMoreTime called with invalid cookTime ${request.timeToAdd}`);
    }
  }
}
