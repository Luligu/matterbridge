/**
 * @file packages/core/src/devices/chime.ts
 * @description This file contains the Chime class.
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
 * @created 2026-07-13
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

import type { Chime as ChimeCluster } from '@matter/types/clusters/chime';
import { Identify } from '@matter/types/clusters/identify';

import { type ChimeId, createDefaultChimeClusterServer } from '../behaviors/chimeServer.js';
// Matterbridge
import { chime, powerSource } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { MatterbridgeEndpointOptions } from '../matterbridgeEndpointTypes.js';

/**
 * Options for configuring an {@link Chime} instance.
 *
 * All temperatures in °C. Typical valid range 0–50 unless otherwise noted.
 */
export interface ChimeOptions extends MatterbridgeEndpointOptions {
  /** Identify time in seconds. Default: 0 */
  identifyTime?: number;
  /** Identify type. Default: Identify.IdentifyType.None (the Identify cluster will not be created) */
  identifyType?: Identify.IdentifyType;

  /** Power source type. Default: Wired (with None, the Power Source cluster will not be created) */
  powerSourceType?: 'Rechargeable' | 'Replaceable' | 'Battery' | 'Wired' | 'None';

  /** Installed chime sounds */
  installedChimeSounds?: ChimeCluster.ChimeSound[];
  /** Id of the currently selected chime sound in the installedChimeSounds array */
  selectedChime?: ChimeId;
  /** Whether the Chime cluster server is enabled */
  enabled?: boolean;
}

/**
 * Matterbridge endpoint representing a chime device.
 * Matter specs 1.6.0 chapter 16.7.
 */
export class Chime extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the Chime class.
   *
   * A Chime is a device which at a minimum is capable of producing audible alerts.
   *
   * @param {string} name - The name of the chime.
   * @param {string} serial - The serial number of the chime.
   * @param {ChimeOptions} [options] - Optional configuration values. Missing fields use defaults.
   *
   * Options defaults:
   *  - identifyTime: 0
   *  - identifyType: Identify.IdentifyType.None (the Identify cluster will not be created)
   *  - powerSourceType: Wired (with None, the Power Source cluster will not be created)
   *
   *  - installedChimeSounds: [{ chimeId: 0, name: 'Default Chime' }]
   *  - selectedChime: 0
   *  - enabled: true
   *
   * @returns {Chime} The Chime instance.
   */
  constructor(name: string, serial: string, options: ChimeOptions = {}) {
    const {
      identifyTime = 0,
      identifyType = Identify.IdentifyType.None,
      powerSourceType = 'Wired',
      installedChimeSounds = [
        {
          chimeId: 0,
          name: 'Default Chime',
        },
      ],
      selectedChime = 0,
      enabled = true,
      id,
      number,
      tagList,
      mode,
    } = options;
    super(powerSourceType === 'None' ? [chime] : [chime, powerSource], { id: id ?? `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}`, number, tagList, mode });
    if (identifyType !== Identify.IdentifyType.None) {
      this.createDefaultIdentifyClusterServer(identifyTime, identifyType);
    }
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Chime');
    switch (powerSourceType) {
      case 'Rechargeable':
        this.createDefaultPowerSourceRechargeableBatteryClusterServer();
        break;
      case 'Replaceable':
        this.createDefaultPowerSourceReplaceableBatteryClusterServer();
        break;
      case 'Battery':
        this.createDefaultPowerSourceBatteryClusterServer();
        break;
      case 'Wired':
        this.createDefaultPowerSourceWiredClusterServer();
        break;
      case 'None':
        break;
      // No default
    }
    createDefaultChimeClusterServer(this, installedChimeSounds, selectedChime, enabled);
    this.addRequiredClusters();
  }
}
