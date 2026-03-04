/**
 * @description  Matter 1.5 Irrigation System device class.
 * @file src/devices/irrigationSystem.ts
 * @author Luca Liguori
 * @created 2026-03-02
 * @version 1.0.0
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

import { LocationTag } from '@matter/main/node';
import { OperationalState } from '@matter/types/clusters/operational-state';
import { Semtag } from '@matter/types/globals';

import { irrigationSystem, waterValve } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';

export interface IrrigationSystemOptions {
  operationalState?: OperationalState.OperationalStateEnum;
  flowMeasuredValue?: number | null;
}

/**
 * Matterbridge endpoint representing an irrigation system device.
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
    super([irrigationSystem], { id: `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}` });

    this.createDefaultIdentifyClusterServer();
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Irrigation System');

    // Optional clusters included by default for this device class.
    this.createDefaultOperationalStateClusterServer(options.operationalState ?? OperationalState.OperationalStateEnum.Stopped);
    this.createDefaultFlowMeasurementClusterServer(options.flowMeasuredValue ?? null);
  }

  /*
   * Helper method to add a new irrigation zone to the system.
   * Each zone is represented as a child device of type Water Valve, with the appropriate tags.
   */
  /**
   * Adds a new irrigation zone child endpoint.
   *
   * @param {Semtag} tag - Semantic tag describing the zone.
   * @returns {this} The current endpoint instance for chaining.
   */
  addZone(tag: Semtag) {
    this.addChildDeviceType(`Zone ${tag.tag}`, waterValve, { tagList: [tag, LocationTag.Zone] })
      .createDefaultValveConfigurationAndControlClusterServer()
      .addRequiredClusterServers();
    return this;
  }
}
