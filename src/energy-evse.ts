/**
 * This file contains the WaterHeater class.
 *
 * @file waterHeater.ts
 * @author Luca Liguori
 * @date 2025-05-18
 * @version 1.0.0
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

// Matterbridge
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { evse } from './matterbridgeDeviceTypes.js';
import { MatterbridgeEnergyEvseServer, MatterbridgeEnergyEvseModeServer } from './matterbridgeBehaviors.js';

// Matter.js
import { EnergyEvse, EnergyEvseMode } from '@matter/main/clusters';

export class WaterHeater extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the EVSE class.
   *
   * @param {string} name - The name of the EVSE.
   * @param {string} serial - The serial number of the EVSE.
   */
  constructor(
    name: string,
    serial: string,
  ) {
    super(Evse, { uniqueStorageKey: `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}` }, true);
    this.createDefaultIdentifyClusterServer()
      .createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge EVSE')
      .createDefaultPowerSourceWiredClusterServer()
      .createDefaultEnergyEvseClusterServer()
      .createDefaultEnergyEvseModeClusterServer();
  }

  /**
   * Creates a default EnergyEvseServer Cluster Server.
   *
   */
  createDefaultEnergyEvseClusterServer(
    
  ): this {
    this.behaviors.require(MatterbridgeEnergyEvseServer.with(), {
      
    });
    return this;
  }

  /**
   * Creates a default EnergyEvseMode Cluster Server.
   *
   * @param {number} [currentMode] - The current mode of the EnergyEvseMode cluster. Defaults to mode 1 (EnergyEvseMode.ModeTag.Auto).
   * @param {EnergyEvseMode.ModeOption[]} [supportedModes] - The supported modes for the EnergyEvseMode cluster. Defaults all cluster modes.
   *
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultEnergyEvseModeClusterServer(currentMode?: number, supportedModes?: EnergyEvseMode.ModeOption[]): this {
    this.behaviors.require(MatterbridgeEnergyEvseModeServer, {
      supportedModes: supportedModes ?? [
        { label: 'Auto', mode: 1, modeTags: [{ value: EnergyEvseMode.ModeTag.Auto }] },
        { label: 'Quick', mode: 2, modeTags: [{ value: EnergyEvseMode.ModeTag.Quick }] },
      ],
      currentMode: currentMode ?? 1,
    });
    return this;
  }
}
