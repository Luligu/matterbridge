/**
 * @file packages/core/src/devices/irrigationSystem.ts
 * @description Matter 1.5 Irrigation System device class.
 * @author Luca Liguori
 * @created 2026-03-02
 * @version 1.2.0
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

import { CommonLocationTag } from '@matter/main/node';
import type { EndpointNumber } from '@matter/types';
import { OperationalState } from '@matter/types/clusters/operational-state';
import type { Semtag } from '@matter/types/globals';
import { fireAndForget } from '@matterbridge/utils';

import { MatterbridgeValveConfigurationAndControlServer } from '../behaviors/valveConfigurationAndControlServer.js';
import { irrigationSystem, powerSource, waterValve } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { getSemtag } from '../matterbridgeEndpointHelpers.js';

export interface IrrigationSystemOptions {
  /** Battery or Wired */
  batteryPowered?: boolean;
  /** Initial operationalState */
  operationalState?: OperationalState.OperationalStateEnum;
  /** Flow measurement in 10 x m3/h. This is an optional attribute that may be included if the irrigation system has a flow measurement capability. */
  flowMeasuredValue?: number | null;
  /** Whether the system automatically opens all zone valves when operationalState changes to Running, and closes them on Paused and Stopped. Defaults to `false` (disabled). */
  autoOpenClose?: boolean;
  /** Semantic tags for endpoint disambiguation. */
  tagList?: Semtag[];
  /** Stable storage key for the endpoint. Defaults to `${name}-${serial}` with spaces removed. */
  id?: string;
  /** Explicit endpoint number. */
  number?: EndpointNumber;
}

/**
 * Matterbridge endpoint representing an irrigation system device.
 * Add at least one irrigation zone using the `addZone` method to represent the individual zones of the irrigation system.
 * Each zone is represented as a child device of type Water Valve, with the appropriate tags.
 * The `addZone` method allows you to specify a semantic tag for each zone, which can be used to describe the zone's number.
 */
export class IrrigationSystem extends MatterbridgeEndpoint {
  /**
   * Creates an IrrigationSystem endpoint and configures default clusters.
   *
   * @param {string} name - Human-readable device name.
   * @param {string} serial - Device serial number.
   * @param {IrrigationSystemOptions} [options] - Optional initial operational state and attributes.
   */
  constructor(name: string, serial: string, options: IrrigationSystemOptions = {}) {
    super([irrigationSystem, powerSource], { id: options.id ?? `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}`, number: options.number, tagList: options.tagList });

    this.createDefaultIdentifyClusterServer();
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Irrigation System');
    if (options.batteryPowered) {
      this.createDefaultPowerSourceBatteryClusterServer();
    } else {
      this.createDefaultPowerSourceWiredClusterServer();
    }

    // Optional clusters included by default for this device class.
    this.createDefaultOperationalStateClusterServer(options.operationalState ?? OperationalState.OperationalStateEnum.Stopped);
    if (options.flowMeasuredValue !== undefined) this.createDefaultFlowMeasurementClusterServer(options.flowMeasuredValue);
    fireAndForget(this.addFixedLabel('composed', 'IrrigationSystem'), this.log, 'IrrigationSystem addFixedLabel');
    this.addRequiredClusterServers();

    // Subscribe to the OperationalState cluster's OperationalState attribute changes to log state changes.
    if (options.autoOpenClose !== true) return;
    this.subscribeAttribute(OperationalState, 'operationalState', (value) => {
      switch (value) {
        case OperationalState.OperationalStateEnum.Stopped:
          this.log.info('IrrigationSystem operationalState changed to: Stopped');
          fireAndForget(this.closeAllZones(), this.log, 'IrrigationSystem closeAllZones');
          break;
        case OperationalState.OperationalStateEnum.Running:
          this.log.info('IrrigationSystem operationalState changed to: Running');
          fireAndForget(this.openAllZones(), this.log, 'IrrigationSystem openAllZones');
          break;
        case OperationalState.OperationalStateEnum.Paused:
          this.log.info('IrrigationSystem operationalState changed to: Paused');
          fireAndForget(this.closeAllZones(), this.log, 'IrrigationSystem closeAllZones');
          break;
        case OperationalState.OperationalStateEnum.Error:
          this.log.info('IrrigationSystem operationalState changed to: Error');
          break;
        // No default
      }
    });
  }

  /**
   * Helper method to add a new irrigation zone to the system.
   * Each zone is represented as a child device of type Water Valve, with the appropriate tags.
   *
   * @param {Semtag} tag - Semantic tag describing the zone (e.g. CommonNumberTag.One).
   * @param {string} [id] - Stable storage key for the zone endpoint.
   * @param {EndpointNumber} [number] - Explicit endpoint number for the zone.
   * @param {number} [movementDuration] - Simulated duration, in milliseconds, that the zone valve's Open/Close movement takes to complete. A non-positive value disables the built-in simulation, leaving completion to the real device implementation. Defaults to 0 (disabled).
   * @param {boolean} [autoClose] - Whether the zone valve's RemainingDuration countdown timer auto-closes it once it reaches 0. Defaults to `false` (disabled), leaving auto-close to the real device implementation.
   * @returns {this} The current endpoint instance for chaining.
   */
  addZone(tag: Semtag, id?: string, number?: EndpointNumber, movementDuration?: number, autoClose?: boolean): this {
    this.addChildDeviceType(`Zone ${tag.tag}`, waterValve, { tagList: [getSemtag(tag), getSemtag(CommonLocationTag.Zone)], id, number })
      .createDefaultValveConfigurationAndControlClusterServer(undefined, undefined, movementDuration, autoClose)
      .addRequiredClusterServers();
    return this;
  }

  /**
   * Opens the ValveConfigurationAndControl cluster of every child zone endpoint.
   *
   * @returns {Promise<void>} A promise that resolves when all zone valves have been commanded to open.
   */
  async openAllZones(): Promise<void> {
    await Promise.all(
      this.getChildEndpoints()
        .filter((child) => child.hasClusterServer(MatterbridgeValveConfigurationAndControlServer))
        .map(async (child) => child.act(async (agent) => agent.get(MatterbridgeValveConfigurationAndControlServer).open({}))),
    );
  }

  /**
   * Closes the ValveConfigurationAndControl cluster of every child zone endpoint.
   *
   * @returns {Promise<void>} A promise that resolves when all zone valves have been commanded to close.
   */
  async closeAllZones(): Promise<void> {
    await Promise.all(
      this.getChildEndpoints()
        .filter((child) => child.hasClusterServer(MatterbridgeValveConfigurationAndControlServer))
        .map(async (child) => child.act(async (agent) => agent.get(MatterbridgeValveConfigurationAndControlServer).close())),
    );
  }
}
