/**
 * @file packages/core/src/devices/microwaveOven.ts
 * @description This file contains the MicrowaveOven class.
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

/* oxlint-disable unicorn/no-negated-condition */
/* oxlint-disable typescript/no-unsafe-type-assertion */

// @matter
import { MicrowaveOvenControlServer } from '@matter/node/behaviors/microwave-oven-control';
import { MicrowaveOvenModeServer } from '@matter/node/behaviors/microwave-oven-mode';
import { Status, StatusResponseError, type EndpointNumber } from '@matter/types';
import { MicrowaveOvenControl } from '@matter/types/clusters/microwave-oven-control';
import { MicrowaveOvenMode } from '@matter/types/clusters/microwave-oven-mode';
import { OperationalState } from '@matter/types/clusters/operational-state';
import type { Semtag } from '@matter/types/globals';

// Matterbridge
import { MatterbridgeServer } from '../behaviors/matterbridgeServer.js';
import { MatterbridgeOperationalStateServer } from '../behaviors/operationalStateServer.js';
import { microwaveOven, powerSource } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';

/**
 * Options for configuring a {@link MicrowaveOven} endpoint.
 */
export interface MicrowaveOvenOptions {
  /** Endpoint operating mode. */
  mode?: 'server' | 'matter';
  /** Stable storage key for the endpoint. Defaults to `${name}-${serial}` with spaces removed. */
  id?: string;
  /** Explicit endpoint number. */
  number?: EndpointNumber;
  /** Semantic tags for endpoint disambiguation. */
  tagList?: Semtag[];
  /** Initial microwave mode. Defaults to 1 (Auto). */
  currentMode?: number;
  /** Supported microwave modes. */
  supportedModes?: MicrowaveOvenMode.ModeOption[];
  /** Initial power setting. Defaults to 100. */
  powerSetting?: number;
  /** Minimum power setting. Defaults to 10. */
  minPower?: number;
  /** Maximum power setting. Defaults to 100. */
  maxPower?: number;
  /** Power-setting step. Defaults to 10. */
  powerStep?: number;
  /** Initial cook time in seconds. Defaults to 60. */
  cookTime?: number;
  /** Maximum cook time in seconds. Defaults to 3600. */
  maxCookTime?: number;
}

/**
 * Matterbridge endpoint representing a microwave oven device.
 */
export class MicrowaveOven extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the MicrowaveOven class.
   *
   * @param {string} name - The name of the microwave oven.
   * @param {string} serial - The serial number of the microwave oven.
   * @param {MicrowaveOvenOptions} [options] - Endpoint, mode, power, and cook-time configuration.
   *
   * @remarks
   * - 8.12. Microwave Oven Mode Cluster
   * - Exactly one entry in the SupportedModes attribute SHALL include the Normal mode tag in the ModeTags field.
   * - The Normal and Defrost mode tags are mutually exclusive and SHALL NOT both be used together in a mode’s ModeTags.
   */
  constructor(name: string, serial: string, options?: MicrowaveOvenOptions);

  /**
   * Creates an instance using the legacy positional configuration.
   *
   * @deprecated Pass an {@link MicrowaveOvenOptions} object as the third argument instead.
   */
  // oxfmt-ignore
  constructor(name: string, serial: string, currentMode?: number, supportedModes?: MicrowaveOvenMode.ModeOption[], powerSetting?: number, minPower?: number, maxPower?: number, powerStep?: number, cookTime?: number, maxCookTime?: number);

  constructor(
    name: string,
    serial: string,
    optionsOrCurrentMode?: MicrowaveOvenOptions | number,
    supportedModes?: MicrowaveOvenMode.ModeOption[],
    powerSetting?: number,
    minPower?: number,
    maxPower?: number,
    powerStep?: number,
    cookTime?: number,
    maxCookTime?: number,
  ) {
    const options: MicrowaveOvenOptions =
      typeof optionsOrCurrentMode === 'object'
        ? optionsOrCurrentMode
        : { currentMode: optionsOrCurrentMode, supportedModes, powerSetting, minPower, maxPower, powerStep, cookTime, maxCookTime };
    const configuredSupportedModes = options.supportedModes ?? [
      { label: 'Auto', mode: 1, modeTags: [{ value: MicrowaveOvenMode.ModeTag.Auto }] },
      { label: 'Quick', mode: 2, modeTags: [{ value: MicrowaveOvenMode.ModeTag.Quick }] },
      { label: 'Quiet', mode: 3, modeTags: [{ value: MicrowaveOvenMode.ModeTag.Quiet }] },
      { label: 'Min', mode: 4, modeTags: [{ value: MicrowaveOvenMode.ModeTag.Min }] },
      { label: 'Max', mode: 5, modeTags: [{ value: MicrowaveOvenMode.ModeTag.Max }] },
      { label: 'Normal', mode: 6, modeTags: [{ value: MicrowaveOvenMode.ModeTag.Normal }] },
      { label: 'Defrost', mode: 7, modeTags: [{ value: MicrowaveOvenMode.ModeTag.Defrost }] },
    ];
    super([microwaveOven, powerSource], {
      id: options.id ?? `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}`,
      number: options.number,
      tagList: options.tagList,
      mode: options.mode,
    });
    this.createDefaultIdentifyClusterServer();
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Microwave Oven');
    this.createDefaultPowerSourceWiredClusterServer();
    this.createDefaultOperationalStateClusterServer(OperationalState.OperationalStateEnum.Stopped);
    this.createDefaultMicrowaveOvenModeClusterServer(options.currentMode ?? 1, configuredSupportedModes);
    this.createDefaultMicrowaveOvenControlClusterServer(
      options.powerSetting ?? 100,
      options.minPower ?? 10,
      options.maxPower ?? 100,
      options.powerStep ?? 10,
      options.cookTime ?? 60,
      options.maxCookTime ?? 3600,
    );
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
  /** The endpoint that owns this behavior. Narrowed to MatterbridgeEndpoint: this server is only ever added to a Matterbridge endpoint. */
  declare readonly endpoint: MatterbridgeEndpoint;

  /**
   * Initializes the server.
   */
  override async initialize(): Promise<void> {
    await super.initialize();
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeMicrowaveOvenControlServer: initialized (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
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
      endpoint: this.endpoint,
      context: this.context,
    });

    const supportedModes = this.endpoint.stateOf(MicrowaveOvenModeServer).supportedModes;

    // Matter 1.6.0 § 8.13.6.2.1 and § 8.13.6.2.6: Reject the command with CONSTRAINT_ERROR, leaving state unchanged, if CookMode is not one of the SupportedModes of the Microwave Oven Mode cluster.
    if (request.cookMode !== undefined && !supportedModes.some((mode) => mode.mode === request.cookMode)) {
      throw new StatusResponseError(
        `MatterbridgeMicrowaveOvenControlServer: cookMode ${request.cookMode} is not a supported mode (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ConstraintError,
      );
    }

    // Matter 1.6.0 § 8.13.6.2.2 and § 8.13.6.2.6: Reject the command with CONSTRAINT_ERROR, leaving state unchanged, if CookTime is outside 1 to MaxCookTime.
    if (request.cookTime !== undefined && (request.cookTime < 1 || request.cookTime > this.state.maxCookTime)) {
      throw new StatusResponseError(
        `MatterbridgeMicrowaveOvenControlServer: cookTime ${request.cookTime} must be between 1 and maxCookTime ${this.state.maxCookTime} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ConstraintError,
      );
    }

    // Matter 1.6.0 § 8.13.6.2.3: Reject the command with CONSTRAINT_ERROR if PowerSetting is outside MinPower to MaxPower or (PowerSetting - MinPower) is not a multiple of PowerStep.
    if (
      request.powerSetting !== undefined &&
      (request.powerSetting < this.state.minPower || request.powerSetting > this.state.maxPower || (request.powerSetting - this.state.minPower) % this.state.powerStep !== 0)
    ) {
      throw new StatusResponseError(
        `MatterbridgeMicrowaveOvenControlServer: powerSetting ${request.powerSetting} must be between minPower ${this.state.minPower} and maxPower ${this.state.maxPower} in steps of ${this.state.powerStep} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ConstraintError,
      );
    }

    if (request.cookMode !== undefined) {
      device.log.info(
        `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting cookMode to ${request.cookMode} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
      // Matter 1.6.0 § 8.13.6.2.1: Set the CurrentMode attribute of the Microwave Oven Mode cluster to the CookMode field.
      await this.endpoint.setStateOf(MicrowaveOvenModeServer, { currentMode: request.cookMode });
    } else {
      device.log.info(
        `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called with no cookMode so set to Normal (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
      const normalMode = supportedModes.find((mode) => mode.modeTags.some((tag) => tag.value === MicrowaveOvenMode.ModeTag.Normal));
      // Matter 1.6.0 § 8.13.6.2.1: If CookMode is missing, set CurrentMode to a mode having the Normal mode tag.
      await this.endpoint.setStateOf(MicrowaveOvenModeServer, { currentMode: normalMode?.mode });
    }

    if (request.cookTime !== undefined) {
      device.log.info(
        `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting cookTime to ${request.cookTime} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
      // Matter 1.6.0 § 8.13.6.2.6: Set the CookTime attribute to the included CookTime field.
      this.state.cookTime = request.cookTime;
    } else {
      device.log.info(
        `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called with no cookTime so set to 30sec. (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
      // Matter 1.6.0 § 8.13.6.2.2: If CookTime is missing, set the CookTime attribute to 30 seconds.
      this.state.cookTime = 30;
    }

    if (request.powerSetting !== undefined) {
      device.log.info(
        `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting powerSetting to ${request.powerSetting} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
      // Matter 1.6.0 § 8.13.6.2.6: Set the PowerSetting attribute to the included PowerSetting field.
      this.state.powerSetting = request.powerSetting;
    } else {
      device.log.info(
        `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called with no powerSetting so set to maxPower (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
      // Matter 1.6.0 § 8.13.6.2.3: If PowerSetting is missing and MaxPower is supported, set the PowerSetting attribute to MaxPower.
      this.state.powerSetting = this.state.maxPower;
    }

    if (request.startAfterSetting === true) {
      device.log.info(
        `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting startAfterSetting = true (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
      // Matter 1.6.0 § 8.13.6.2.6: If StartAfterSetting is TRUE, oven operation SHALL start.
      await this.endpoint.setStateOf(MatterbridgeOperationalStateServer, { operationalState: OperationalState.OperationalStateEnum.Running });
    }
    this.endpoint.emitCommand(MicrowaveOvenControl, 'setCookingParameters', request, this.context);
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
      endpoint: this.endpoint,
      context: this.context,
    });

    // Matter 1.6.0 § 8.13.6.3 and § 8.13.6.3.2: Reject the command with CONSTRAINT_ERROR, and ignore it, if TimeToAdd is below 1 or CookTime plus TimeToAdd exceeds MaxCookTime.
    if (request.timeToAdd < 1 || this.state.cookTime + request.timeToAdd > this.state.maxCookTime) {
      throw new StatusResponseError(
        `MatterbridgeMicrowaveOvenControlServer: addMoreTime called with invalid timeToAdd ${request.timeToAdd} for cookTime ${this.state.cookTime} and maxCookTime ${this.state.maxCookTime} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ConstraintError,
      );
    }

    device.log.info(
      `MatterbridgeMicrowaveOvenControlServer: addMoreTime called setting cookTime to ${this.state.cookTime + request.timeToAdd} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    // Matter 1.6.0 § 8.13.6.3.2: Add TimeToAdd to the CookTime attribute.
    this.state.cookTime += request.timeToAdd;

    // Matter 1.6.0 § 8.13.6.3.2: Add TimeToAdd to the CountdownTime attribute of the Operational State cluster on the same endpoint.
    if (this.endpoint.behaviors.has(MatterbridgeOperationalStateServer)) {
      const countdownTime = this.endpoint.stateOf(MatterbridgeOperationalStateServer).countdownTime;
      if (countdownTime !== null && countdownTime !== undefined) {
        await this.endpoint.setStateOf(MatterbridgeOperationalStateServer, { countdownTime: countdownTime + request.timeToAdd });
      }
    }
    this.endpoint.emitCommand(MicrowaveOvenControl, 'addMoreTime', request, this.context);
  }
}
