/**
 * @file packages/core/src/devices/laundryWasher.ts
 * @description This file contains the LaundryWasher class.
 * @author Luca Liguori
 * @created 2025-05-25
 * @version 1.4.0
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
import { LaundryWasherControlsServer } from '@matter/node/behaviors/laundry-washer-controls';
import { LaundryWasherModeServer } from '@matter/node/behaviors/laundry-washer-mode';
import { Status, StatusResponseError, type EndpointNumber } from '@matter/types';
import { LaundryWasherControls } from '@matter/types/clusters/laundry-washer-controls';
import { LaundryWasherMode } from '@matter/types/clusters/laundry-washer-mode';
import { ModeBase } from '@matter/types/clusters/mode-base';
import { OnOff } from '@matter/types/clusters/on-off';
import type { OperationalState } from '@matter/types/clusters/operational-state';
import type { Semtag } from '@matter/types/globals';

// Matterbridge
import { MatterbridgeServer } from '../behaviors/matterbridgeServer.js';
import { MatterbridgeOnOffServer } from '../behaviors/onOffServer.js';
import { laundryWasher, powerSource } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { createLevelTemperatureControlClusterServer, createNumberTemperatureControlClusterServer } from './temperatureControl.js';

/**
 * Options for configuring a {@link LaundryWasher} endpoint.
 */
export interface LaundryWasherOptions {
  /** Endpoint operating mode. */
  mode?: 'server' | 'matter';
  /** Stable storage key for the endpoint. Defaults to `${name}-${serial}` with spaces removed. */
  id?: string;
  /** Explicit endpoint number. */
  number?: EndpointNumber;
  /** Semantic tags for endpoint disambiguation. */
  tagList?: Semtag[];
  /** Initial washer mode. */
  currentMode?: number;
  /** Supported washer modes. */
  supportedModes?: LaundryWasherMode.ModeOption[];
  /** Current spin-speed index. */
  spinSpeedCurrent?: number;
  /** Supported spin-speed labels. */
  spinSpeeds?: string[];
  /** Selected number of rinses. */
  numberOfRinses?: LaundryWasherControls.NumberOfRinses;
  /** Supported rinse counts. */
  supportedRinses?: LaundryWasherControls.NumberOfRinses[];
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
 * Matterbridge endpoint representing a laundry washer device.
 */
export class LaundryWasher extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the LaundryWasher class.
   *
   * @param {string} name - The name of the laundry washer.
   * @param {string} serial - The serial number of the laundry washer.
   * @param {LaundryWasherOptions} [options] - Endpoint and initial cluster configuration.
   *
   * Remarks:
   * - If `temperatureSetpoint` is provided, the `createNumberTemperatureControlClusterServer` method will be used to create the TemperatureControl Cluster Server with features TemperatureNumber and TemperatureStep.
   * - If `temperatureSetpoint` is not provided, the `createLevelTemperatureControlClusterServer` method will be used to create the TemperatureControl Cluster Server with feature TemperatureLevel.
   */
  constructor(name: string, serial: string, options?: LaundryWasherOptions);

  /**
   * Creates an instance using the legacy positional configuration.
   *
   * @deprecated Pass an {@link LaundryWasherOptions} object as the third argument instead.
   */
  // oxfmt-ignore
  constructor(name: string, serial: string, currentMode?: number, supportedModes?: LaundryWasherMode.ModeOption[], spinSpeedCurrent?: number, spinSpeeds?: string[], numberOfRinses?: LaundryWasherControls.NumberOfRinses, supportedRinses?: LaundryWasherControls.NumberOfRinses[], selectedTemperatureLevel?: number, supportedTemperatureLevels?: string[], temperatureSetpoint?: number, minTemperature?: number, maxTemperature?: number, step?: number, operationalState?: OperationalState.OperationalStateEnum);

  constructor(
    name: string,
    serial: string,
    optionsOrCurrentMode?: LaundryWasherOptions | number,
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
    const options: LaundryWasherOptions =
      typeof optionsOrCurrentMode === 'object'
        ? optionsOrCurrentMode
        : {
            currentMode: optionsOrCurrentMode,
            supportedModes,
            spinSpeedCurrent,
            spinSpeeds,
            numberOfRinses,
            supportedRinses,
            selectedTemperatureLevel,
            supportedTemperatureLevels,
            temperatureSetpoint,
            minTemperature,
            maxTemperature,
            step,
            operationalState,
          };
    super([laundryWasher, powerSource], {
      id: options.id ?? `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}`,
      number: options.number,
      tagList: options.tagList,
      mode: options.mode,
    });
    this.createDefaultIdentifyClusterServer();
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Laundry Washer');
    this.createDefaultPowerSourceWiredClusterServer();
    this.createDeadFrontOnOffClusterServer(true);
    this.createDefaultLaundryWasherModeClusterServer(options.currentMode, options.supportedModes);
    this.createDefaultLaundryWasherControlsClusterServer(options.spinSpeedCurrent, options.spinSpeeds, options.numberOfRinses, options.supportedRinses);
    if (options.temperatureSetpoint) createNumberTemperatureControlClusterServer(this, options.temperatureSetpoint, options.minTemperature, options.maxTemperature, options.step);
    else createLevelTemperatureControlClusterServer(this, options.selectedTemperatureLevel, options.supportedTemperatureLevels);
    this.createDefaultOperationalStateClusterServer(options.operationalState);
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
    currentMode: number = 2,
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
    spinSpeedCurrent: number = 2,
    spinSpeeds: string[] = ['400', '800', '1200', '1600'],
    numberOfRinses: LaundryWasherControls.NumberOfRinses = LaundryWasherControls.NumberOfRinses.Normal,
    supportedRinses: LaundryWasherControls.NumberOfRinses[] = [
      LaundryWasherControls.NumberOfRinses.None,
      LaundryWasherControls.NumberOfRinses.Normal,
      LaundryWasherControls.NumberOfRinses.Max,
      LaundryWasherControls.NumberOfRinses.Extra,
    ],
  ): this {
    this.behaviors.require(MatterbridgeLaundryWasherControlsServer, {
      spinSpeeds,
      spinSpeedCurrent, // Writable and nullable
      supportedRinses,
      numberOfRinses, // Writable
    });
    return this;
  }
}

/**
 * Laundry Washer Controls server enforcing the SpinSpeedCurrent index constraint.
 */
export class MatterbridgeLaundryWasherControlsServer extends LaundryWasherControlsServer.with(LaundryWasherControls.Feature.Spin, LaundryWasherControls.Feature.Rinse) {
  /**
   * Registers validation for SpinSpeedCurrent writes.
   */
  override initialize(): void {
    // oxlint-disable-next-line typescript/unbound-method
    this.reactTo(this.events.spinSpeedCurrent$Changing, this.#validateSpinSpeedCurrent);
  }

  /**
   * Validates a requested spin-speed index.
   *
   * @remarks
   * Matter 1.6 Application Cluster Specification §8.6.6.2: `SpinSpeedCurrent` is an index into `SpinSpeeds`.
   * A write that does not match a valid index SHALL receive `CONSTRAINT_ERROR`. A null value remains valid and
   * indicates that the selected cycle has no spin speed.
   *
   * @param {number | null} spinSpeedCurrent - Requested SpinSpeedCurrent value.
   */
  #validateSpinSpeedCurrent(spinSpeedCurrent: number | null): void {
    if (spinSpeedCurrent !== null && spinSpeedCurrent >= this.state.spinSpeeds.length) {
      throw new StatusResponseError(`SpinSpeedCurrent ${spinSpeedCurrent} is not a valid SpinSpeeds index`, Status.ConstraintError);
    }
  }
}

/**
 * LaundryWasherMode server that forwards mode changes and reacts to on/off state.
 */
export class MatterbridgeLaundryWasherModeServer extends LaundryWasherModeServer {
  /**
   * Initializes the server and hooks on/off changes.
   */
  override initialize(): void {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeLaundryWasherModeServer initialized: currentMode is ${this.state.currentMode}`);
    // oxlint-disable-next-line typescript/unbound-method
    this.reactTo(this.agent.get(MatterbridgeOnOffServer.with(OnOff.Feature.DeadFrontBehavior)).events.onOff$Changed, this.handleOnOffChange);
  }

  // Dead Front OnOff Cluster
  protected handleOnOffChange(onOff: boolean): void {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`HandleOnOffChange (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    /* v8 ignore next */
    if (!onOff) {
      device.log.notice('OnOffServer changed to OFF: setting Dead Front state to Manufacturer Specific');
      this.state.currentMode = 2;
    }
  }

  /**
   * Handles the LaundryWasherMode `ChangeToMode` command.
   *
   * @remarks
   * Matter 1.6 Application Cluster Specification §1.10.7.1.1: if `NewMode` does not match the `Mode` field of
   * any `SupportedModes` entry, `ChangeToModeResponse.Status` SHALL indicate `UnsupportedMode`. Section 1.10.7.2
   * additionally requires `StatusText` to be an empty string when the status is `UnsupportedMode`.
   *
   * @param {ModeBase.ChangeToModeRequest} request - Mode change request payload.
   * @returns {ModeBase.ChangeToModeResponse} Command response with change status.
   */
  override async changeToMode(request: ModeBase.ChangeToModeRequest): Promise<ModeBase.ChangeToModeResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`ChangeToMode (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('LaundryWasherMode.changeToMode', {
      command: 'changeToMode',
      request,
      cluster: LaundryWasherModeServer.id,
      attributes: this.state,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    const supportedMode = this.state.supportedModes.find((supportedMode) => supportedMode.mode === request.newMode);
    if (!supportedMode) {
      device.log.error(`MatterbridgeLaundryWasherModeServer: changeToMode called with unsupported mode ${request.newMode}`);
      return { status: ModeBase.ModeChangeStatus.UnsupportedMode, statusText: '' };
    }
    device.log.debug(`MatterbridgeLaundryWasherModeServer: changeToMode called with mode ${supportedMode.mode} => ${supportedMode.label}`);
    this.state.currentMode = request.newMode;
    return { status: ModeBase.ModeChangeStatus.Success, statusText: 'Success' };
  }
}
