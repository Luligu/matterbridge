/**
 * @file packages/core/src/devices/castingVideoClient.ts
 * @description This file contains the CastingVideoClient class.
 * @author Luca Liguori
 * @created 2026-08-20
 * @version 1.0.0
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
import { ApplicationBasic } from '@matter/types/clusters/application-basic';
import { ContentLauncher } from '@matter/types/clusters/content-launcher';
import { KeypadInput } from '@matter/types/clusters/keypad-input';
import { OnOff } from '@matter/types/clusters/on-off';
import type { EndpointNumber } from '@matter/types/datatype';

// Matterbridge
import { castingVideoClient, powerSource } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { createDefaultMediaBindingClusterServer, createDefaultMediaPowerSourceClusterServer, type MediaPowerSourceType } from './mediaHelpers.js';

/**
 * Options for configuring a {@link CastingVideoClient} instance.
 */
export interface CastingVideoClientOptions {
  /** Power source type. `'None'` omits the Power Source cluster entirely. */
  powerSourceType?: MediaPowerSourceType;
  /** Stable storage key for the endpoint. Defaults to `${name}-${serial}` with spaces removed. */
  id?: string;
  /** Explicit endpoint number. */
  number?: EndpointNumber;
}

/**
 * Matterbridge endpoint representing a casting video client device.
 */
export class CastingVideoClient extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the CastingVideoClient class.
   *
   * A Casting Video Client is a commissionable node which extends the Video Remote Control features with the
   * ability to initiate content launching. It is often associated with a Content App built by a specific Content
   * Provider. All required elements (OnOff, KeypadInput, ContentLauncher, ApplicationBasic) are client clusters,
   * advertised through the Binding cluster.
   *
   * @param {string} name - The name of the casting video client.
   * @param {string} serial - The serial number of the casting video client.
   * @param {CastingVideoClientOptions} [options] - Optional configuration values. Missing fields use defaults.
   *
   * Options defaults:
   *  - powerSourceType: 'Wired'
   *
   * @returns {CastingVideoClient} The CastingVideoClient instance.
   */
  constructor(name: string, serial: string, options: CastingVideoClientOptions = {}) {
    const { powerSourceType = 'Wired' } = options;
    super(powerSourceType === 'None' ? [castingVideoClient] : [castingVideoClient, powerSource], {
      id: options.id ?? `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}`,
      number: options.number,
    });
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Casting Video Client');
    createDefaultMediaPowerSourceClusterServer(this, powerSourceType);
    createDefaultMediaBindingClusterServer(this, [OnOff.id, KeypadInput.id, ContentLauncher.id, ApplicationBasic.id]);
  }
}
