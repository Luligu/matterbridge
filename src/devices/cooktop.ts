/**
 * @description This file contains the Cooktop class.
 * @file src/devices/cooktop.ts
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
import { Semtag } from '@matter/types';

// Matterbridge
import { cookSurface, cooktop, powerSource } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';

import { createLevelTemperatureControlClusterServer } from './temperatureControl.js';

export class Cooktop extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the Cooktop class.
   *
   * @param {string} name - The name of the cooktop.
   * @param {string} serial - The serial number of the cooktop.
   *
   * @remarks
   * 13.8 A cooktop is a cooking surface that heats food either by transferring currents from an electromagnetic
   * field located below the glass surface directly to the magnetic induction cookware placed
   * above or through traditional gas or electric burners.
   *
   * 13.8.4 A Cooktop SHALL be composed of zero or more endpoints with the Cook Surface device type.
   * An Cooktop is always defined via endpoint composition.
   * - Use `addSurface` to add one or more surfaces to the cooktop.
   */
  constructor(name: string, serial: string) {
    super([cooktop, powerSource], { id: `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}` });
    this.createDefaultIdentifyClusterServer();
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Cooktop');
    this.createDefaultPowerSourceWiredClusterServer();
    this.createOffOnlyOnOffClusterServer(true);
    this.addFixedLabel('composed', 'Cooktop');
  }

  /**
   * Adds a surface to the cooktop.
   *
   * @param {string} name - The name of the surface.
   * @param {Semtag[]} tagList - The tagList associated with the surface.
   * @param {number} selectedTemperatureLevel - The selected temperature level as an index of the supportedTemperatureLevels array. Defaults to 2 (which corresponds to 'Level 3').
   * @param {string[]} supportedTemperatureLevels - The list of supported temperature levels for the surface. Defaults to ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5'].
   *
   * @returns {MatterbridgeEndpoint} The MatterbridgeEndpoint instance representing the surface.
   *
   * @remarks
   * 13.7 A Cook Surface device type represents a heating object on a cooktop or other similar device. It
   * SHALL only be used when composed as part of another device type.
   *
   * The OffOnly feature is required for the On/Off cluster in this device type due to safety requirements.
   * TemperatureLevel is the only valid temperature control mode.
   */
  addSurface(name: string, tagList: Semtag[], selectedTemperatureLevel: number = 2, supportedTemperatureLevels: string[] = ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5']): MatterbridgeEndpoint {
    const surface = this.addChildDeviceType(name, cookSurface, { tagList }, true);
    surface.log.logName = name;
    createLevelTemperatureControlClusterServer(surface, selectedTemperatureLevel, supportedTemperatureLevels);
    surface.createDefaultTemperatureMeasurementClusterServer(2000);
    surface.createOffOnlyOnOffClusterServer(true);
    return surface;
  }
}
