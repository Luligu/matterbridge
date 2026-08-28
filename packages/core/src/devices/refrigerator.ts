/**
 * @file packages/core/src/devices/refrigerator.ts
 * @description This file contains the Refrigerator class.
 * @author Luca Liguori
 * @created 2025-05-25
 * @version 1.3.0
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

// @matter
import type { MaybePromise } from '@matter/general';
import { AttributeElement, EventElement, FieldElement } from '@matter/model';
import { RefrigeratorAlarmServer } from '@matter/node/behaviors/refrigerator-alarm';
import { RefrigeratorAndTemperatureControlledCabinetModeServer } from '@matter/node/behaviors/refrigerator-and-temperature-controlled-cabinet-mode';
import type { EndpointNumber, Semtag } from '@matter/types';
import { ModeBase } from '@matter/types/clusters/mode-base';
import { RefrigeratorAndTemperatureControlledCabinetMode } from '@matter/types/clusters/refrigerator-and-temperature-controlled-cabinet-mode';
import { fireAndForget } from '@matterbridge/utils/wait';

// Matterbridge
import { MatterbridgeServer } from '../behaviors/matterbridgeServer.js';
import { powerSource, refrigerator, temperatureControlledCabinetCooler } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { createNumberTemperatureControlClusterServer } from './temperatureControl.js';

/**
 * Options for configuring a {@link Refrigerator} endpoint.
 */
export interface RefrigeratorOptions {
  /** Endpoint operating mode. */
  mode?: 'server' | 'matter';
  /** Stable storage key for the endpoint. Defaults to `${name}-${serial}` with spaces removed. */
  id?: string;
  /** Explicit endpoint number. */
  number?: EndpointNumber;
  /** Semantic tags for endpoint disambiguation. */
  tagList?: Semtag[];
  /** Initial refrigerator mode. Defaults to 1 (Auto). */
  currentMode?: number;
  /** Supported refrigerator modes. */
  supportedModes?: RefrigeratorAndTemperatureControlledCabinetMode.ModeOption[];
}

/**
 * Options for configuring a refrigerated Temperature Controlled Cabinet child endpoint.
 */
export interface RefrigeratorCabinetOptions {
  /** Stable storage key for the endpoint. Defaults to the cabinet name. */
  id?: string;
  /** Explicit endpoint number. */
  number?: EndpointNumber;
  /** Semantic tags for endpoint disambiguation. */
  tagList: Semtag[];
  /** Target temperature in hundredths of a degree Celsius. Defaults to 1000 (10°C). */
  targetTemperature?: number;
  /** Minimum temperature in hundredths of a degree Celsius. Defaults to -3000 (-30°C). */
  minTemperature?: number;
  /** Maximum temperature in hundredths of a degree Celsius. Defaults to 2000 (20°C). */
  maxTemperature?: number;
  /** Temperature step in hundredths of a degree Celsius. Defaults to 100 (1°C). */
  step?: number;
  /** Current temperature in hundredths of a degree Celsius. Defaults to 1000 (10°C). */
  currentTemperature?: number;
}

/**
 * Matterbridge endpoint representing a refrigerator device.
 */
export class Refrigerator extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the Refrigerator class.
   *
   * @param {string} name - The name of the refrigerator.
   * @param {string} serial - The serial number of the refrigerator.
   * @param {RefrigeratorOptions} [options] - Endpoint and initial mode configuration.
   *
   * @remarks
   * 13.2 A refrigerator represents a device that contains one or more cabinets that are capable of chilling or
   * freezing food. Examples of consumer products that MAY make use of this device type include refrigerators,
   * freezers, and wine coolers.
   * A refrigerator is always defined via endpoint composition.
   * - Use `addCabinet` to add one or more cabinets to the refrigerator.
   */
  constructor(name: string, serial: string, options?: RefrigeratorOptions);

  /**
   * Creates an instance using the legacy positional configuration.
   *
   * @deprecated Pass an {@link RefrigeratorOptions} object as the third argument instead.
   */
  constructor(name: string, serial: string, currentMode?: number, supportedModes?: RefrigeratorAndTemperatureControlledCabinetMode.ModeOption[]);

  constructor(name: string, serial: string, optionsOrCurrentMode?: RefrigeratorOptions | number, supportedModes?: RefrigeratorAndTemperatureControlledCabinetMode.ModeOption[]) {
    const options: RefrigeratorOptions = typeof optionsOrCurrentMode === 'object' ? optionsOrCurrentMode : { currentMode: optionsOrCurrentMode, supportedModes };
    const configuredSupportedModes = options.supportedModes ?? [
      { label: 'Auto', mode: 1, modeTags: [{ value: RefrigeratorAndTemperatureControlledCabinetMode.ModeTag.Auto }] },
      { label: 'RapidCool', mode: 2, modeTags: [{ value: RefrigeratorAndTemperatureControlledCabinetMode.ModeTag.RapidCool }] },
      { label: 'RapidFreeze', mode: 3, modeTags: [{ value: RefrigeratorAndTemperatureControlledCabinetMode.ModeTag.RapidFreeze }] },
    ];
    super([refrigerator, powerSource], {
      id: options.id ?? `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}`,
      number: options.number,
      tagList: options.tagList,
      mode: options.mode,
    });
    this.createDefaultIdentifyClusterServer();
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Refrigerator');
    this.createDefaultPowerSourceWiredClusterServer();
    fireAndForget(this.addFixedLabel('composed', 'Refrigerator'), this.log, 'Error adding composed label to Refrigerator');
    this.createDefaultRefrigeratorAndTemperatureControlledCabinetModeClusterServer(this, options.currentMode ?? 1, configuredSupportedModes);
    this.createDefaultRefrigeratorAlarmClusterServer(this, false);
  }

  /**
   * Adds a Level Temperature Controlled Cabinet Cooler to the refrigerator.
   *
   * @param {string} name - The name of the cabinet.
   * @param {RefrigeratorCabinetOptions} options - Endpoint and temperature-control configuration.
   *
   * @returns {MatterbridgeEndpoint} The MatterbridgeEndpoint instance representing the cabinet.
   *
   * @remarks
   * 13.4.1 A Temperature Controlled Cabinet Cooler is a device that provides a cooled space for chilling food.
   * It is typically installed within a refrigerator.
   *
   * Example usage with specific namespace tags:
   * ```
   *  refrigerator.addCabinet('Refrigerator Top', [
   *    { mfgCode: null, namespaceId: PositionTag.Top.namespaceId, tag: PositionTag.Top.tag, label: 'Refrigerator Top' },
   *    { mfgCode: null, namespaceId: RefrigeratorTag.Refrigerator.namespaceId, tag: RefrigeratorTag.Refrigerator.tag, label: RefrigeratorTag.Refrigerator.label },
   *  ]);
   *  refrigerator.addCabinet('Freezer Bottom', [
   *    { mfgCode: null, namespaceId: PositionTag.Bottom.namespaceId, tag: PositionTag.Bottom.tag, label: 'Freezer Bottom' },
   *    { mfgCode: null, namespaceId: RefrigeratorTag.Freezer.namespaceId, tag: RefrigeratorTag.Freezer.tag, label: RefrigeratorTag.Freezer.label },
   *  ]);
   * ```
   */
  addCabinet(name: string, options: RefrigeratorCabinetOptions): MatterbridgeEndpoint;

  /**
   * Adds a cabinet using the legacy positional configuration.
   *
   * @deprecated Pass an {@link RefrigeratorCabinetOptions} object as the second argument instead.
   */
  addCabinet(
    name: string,
    tagList: Semtag[],
    targetTemperature?: number,
    minTemperature?: number,
    maxTemperature?: number,
    step?: number,
    currentTemperature?: number,
  ): MatterbridgeEndpoint;

  addCabinet(
    name: string,
    optionsOrTagList: RefrigeratorCabinetOptions | Semtag[],
    targetTemperature?: number,
    minTemperature?: number,
    maxTemperature?: number,
    step?: number,
    currentTemperature?: number,
  ): MatterbridgeEndpoint {
    const options: RefrigeratorCabinetOptions = Array.isArray(optionsOrTagList)
      ? { tagList: optionsOrTagList, targetTemperature, minTemperature, maxTemperature, step, currentTemperature }
      : optionsOrTagList;
    const cabinet = this.addChildDeviceType(options.id ?? name, temperatureControlledCabinetCooler, { number: options.number, tagList: options.tagList });
    cabinet.log.logName = name;
    createNumberTemperatureControlClusterServer(
      cabinet,
      options.targetTemperature ?? 10 * 100,
      options.minTemperature ?? -30 * 100,
      options.maxTemperature ?? 20 * 100,
      options.step ?? 1 * 100,
    );
    cabinet.createDefaultTemperatureMeasurementClusterServer(options.currentTemperature ?? 10 * 100);
    return cabinet;
  }

  /**
   * Creates a default RefrigeratorAndTemperatureControlledCabinetMode Cluster Server.
   *
   * @param {MatterbridgeEndpoint} endpoint - The Matterbridge endpoint instance.
   * @param {number} currentMode - The current mode of the oven.
   * @param {RefrigeratorAndTemperatureControlledCabinetMode.ModeOption[]} supportedModes - The supported modes for the refrigerator and temperature controlled cabinet.
   *
   * @returns {MatterbridgeEndpoint} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * - supportedModes is a fixed attribute. It cannot be changed at runtime.
   * - currentMode persists across reboots.
   */
  createDefaultRefrigeratorAndTemperatureControlledCabinetModeClusterServer(
    endpoint: MatterbridgeEndpoint,
    currentMode: number,
    supportedModes: RefrigeratorAndTemperatureControlledCabinetMode.ModeOption[],
  ): MatterbridgeEndpoint {
    endpoint.behaviors.require(MatterbridgeRefrigeratorAndTemperatureControlledCabinetModeServer, {
      supportedModes,
      currentMode,
    });
    return endpoint;
  }

  /**
   * Creates a default RefrigeratorAlarm Cluster Server.
   *
   * @param {MatterbridgeEndpoint} endpoint - The Matterbridge endpoint instance.
   * @param {boolean} doorOpen - Indicates if the refrigerator door is open.
   *
   * @returns {MatterbridgeEndpoint} The updated MatterbridgeEndpoint instance.
   */
  createDefaultRefrigeratorAlarmClusterServer(endpoint: MatterbridgeEndpoint, doorOpen: boolean = false): MatterbridgeEndpoint {
    endpoint.behaviors.require(MatterbridgeRefrigeratorAlarmServer, {
      mask: { doorOpen: true },
      supported: { doorOpen: true },
      state: { doorOpen },
    });
    return endpoint;
  }

  /**
   * Sets the door open state for a specific cabinet.
   *
   * @param {boolean} doorOpen - Indicates if the door is open.
   * @returns {MatterbridgeEndpoint} The updated MatterbridgeEndpoint instance.
   */
  async setDoorOpenState(doorOpen: boolean): Promise<MatterbridgeEndpoint> {
    await this.setAttribute('RefrigeratorAlarm', 'state', { doorOpen }, this.log);
    return this;
  }

  /**
   * Triggers the notify event for door open state on a specific cabinet.
   *
   * @param {boolean} doorOpen - Indicates if the door is open.
   * @returns {MatterbridgeEndpoint} The updated MatterbridgeEndpoint instance.
   */
  async triggerDoorOpenState(doorOpen: boolean): Promise<MatterbridgeEndpoint> {
    if (doorOpen) {
      await this.triggerEvent(
        'RefrigeratorAlarm',
        'notify',
        {
          active: { doorOpen: true },
          inactive: { doorOpen: false },
          state: { doorOpen: true },
          mask: { doorOpen: true },
        },
        this.log,
      );
    } else {
      await this.triggerEvent(
        'RefrigeratorAlarm',
        'notify',
        {
          active: { doorOpen: false },
          inactive: { doorOpen: true },
          state: { doorOpen: false },
          mask: { doorOpen: true },
        },
        this.log,
      );
    }
    return this;
  }
}

// Server for RefrigeratorAndTemperatureControlledCabinetMode
/**
 * Refrigerator/cabinet mode server that forwards mode changes to the device implementation.
 */
export class MatterbridgeRefrigeratorAndTemperatureControlledCabinetModeServer extends RefrigeratorAndTemperatureControlledCabinetModeServer {
  /**
   * Initializes the server.
   */
  override initialize(): void {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info('MatterbridgeRefrigeratorAndTemperatureControlledCabinetModeServer initialized');
  }
  /**
   * Handles the RefrigeratorAndTemperatureControlledCabinetMode `ChangeToMode` command.
   *
   * @param {ModeBase.ChangeToModeRequest} request - Mode change request payload.
   * @returns {ModeBase.ChangeToModeResponse} Command response with change status.
   */
  override changeToMode(request: ModeBase.ChangeToModeRequest): MaybePromise<ModeBase.ChangeToModeResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    const supportedMode = this.state.supportedModes.find((supportedMode) => supportedMode.mode === request.newMode);
    if (supportedMode) {
      device.log.info(
        `MatterbridgeRefrigeratorAndTemperatureControlledCabinetModeServer: changeToMode (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber}) called with mode ${supportedMode.mode} = ${supportedMode.label}`,
      );
      this.state.currentMode = request.newMode;
      return { status: ModeBase.ModeChangeStatus.Success, statusText: 'Success' };
    } else {
      device.log.error(
        `MatterbridgeRefrigeratorAndTemperatureControlledCabinetModeServer: changeToMode (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber}) called with invalid mode ${request.newMode}`,
      );
      return { status: ModeBase.ModeChangeStatus.InvalidInMode, statusText: 'Invalid mode' };
    }
  }
}

const MatterbridgeRefrigeratorAlarmSchema = RefrigeratorAlarmServer.schema.extend(
  {},
  AttributeElement({ name: 'Mask', id: 0x0000, type: 'AlarmBitmap', access: 'R V', conformance: 'M' }),
  AttributeElement({ name: 'State', id: 0x0002, type: 'AlarmBitmap', access: 'R V', conformance: 'M' }),
  AttributeElement({ name: 'Supported', id: 0x0003, type: 'AlarmBitmap', access: 'R V', conformance: 'M', quality: 'F' }),
  EventElement(
    { name: 'Notify', id: 0x0000, access: 'V', conformance: 'M', priority: 'info' },
    FieldElement({ name: 'Active', id: 0x0000, type: 'AlarmBitmap', conformance: 'M' }),
    FieldElement({ name: 'Inactive', id: 0x0001, type: 'AlarmBitmap', conformance: 'M' }),
    FieldElement({ name: 'State', id: 0x0002, type: 'AlarmBitmap', conformance: 'M' }),
    FieldElement({ name: 'Mask', id: 0x0003, type: 'AlarmBitmap', conformance: 'M' }),
  ),
);

/**
 * Refrigerator Alarm server with the inherited alarm attributes bound to the Refrigerator-specific AlarmBitmap.
 *
 * @remarks
 * Matter 1.6 Application Cluster Specification §8.8.6.1 and Alarm Base §1.15.6.3, §1.15.6.4, and §1.15.8.1
 * define `DoorOpen` as bit 0 of `Mask`, `State`, `Supported`, and the `Notify` event's bitmap fields. Redeclaring
 * these inherited elements makes their wire schema resolve the Refrigerator Alarm cluster's `AlarmBitmap`, rather
 * than the empty base-cluster bitmap.
 */
export class MatterbridgeRefrigeratorAlarmServer extends RefrigeratorAlarmServer {
  static override readonly schema = MatterbridgeRefrigeratorAlarmSchema;
}
