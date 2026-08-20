/**
 * @file packages/core/src/devices/contentApp.ts
 * @description This file contains the ContentApp class.
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
import { VendorId } from '@matter/types/datatype';
import type { EndpointNumber } from '@matter/types/datatype';

// Matterbridge
import { contentApp, powerSource } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import {
  createDefaultApplicationBasicClusterServer,
  createDefaultApplicationLauncherClusterServer,
  createDefaultKeypadInputClusterServer,
  createDefaultMediaPowerSourceClusterServer,
  type MediaPowerSourceType,
} from './mediaHelpers.js';

/**
 * Options for configuring a {@link ContentApp} instance.
 */
export interface ContentAppOptions {
  /** Human readable (displayable) name of the Content App assigned by the vendor. */
  applicationName?: string;
  /** Connectivity Standards Alliance issued vendor ID for the catalog. */
  catalogVendorId?: number;
  /** Application identifier, unique within the catalog. */
  applicationId?: string;
  /** Current running status of the application. */
  status?: ApplicationBasic.ApplicationStatus;
  /** Human readable (displayable) version of the Content App assigned by the vendor. */
  applicationVersion?: string;
  /** List of vendor IDs allowed to interact with the Content App. */
  allowedVendorList?: VendorId[];
  /** Power source type. `'None'` omits the Power Source cluster entirely. */
  powerSourceType?: MediaPowerSourceType;
  /** Stable storage key for the endpoint. Defaults to `${name}-${serial}` with spaces removed. */
  id?: string;
  /** Explicit endpoint number. */
  number?: EndpointNumber;
}

/**
 * Matterbridge endpoint representing a Content App running on a Casting Video Player.
 */
export class ContentApp extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the ContentApp class.
   *
   * A Content App is usually an application built by a Content Provider and exists as a separate endpoint on a
   * Casting Video Player with a Content App Platform.
   *
   * @param {string} name - The name of the Content App.
   * @param {string} serial - The serial number of the Content App.
   * @param {ContentAppOptions} [options] - Optional configuration values. Missing fields use defaults.
   *
   * Options defaults:
   *  - applicationName: name
   *  - catalogVendorId: 0xfff1
   *  - applicationId: 'matterbridge-content-app'
   *  - status: ActiveVisibleFocus
   *  - applicationVersion: '1.0.0'
   *  - allowedVendorList: [0xfff1]
   *  - powerSourceType: 'Wired'
   *
   * @returns {ContentApp} The ContentApp instance.
   */
  constructor(name: string, serial: string, options: ContentAppOptions = {}) {
    const {
      applicationName = name,
      catalogVendorId = 0xfff1,
      applicationId = 'matterbridge-content-app',
      status = ApplicationBasic.ApplicationStatus.ActiveVisibleFocus,
      applicationVersion = '1.0.0',
      allowedVendorList = [VendorId(0xfff1)],
      powerSourceType = 'Wired',
    } = options;
    super(powerSourceType === 'None' ? [contentApp] : [contentApp, powerSource], {
      id: options.id ?? `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}`,
      number: options.number,
    });
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Content App');
    createDefaultMediaPowerSourceClusterServer(this, powerSourceType);
    createDefaultKeypadInputClusterServer(this);
    createDefaultApplicationLauncherClusterServer(this);
    createDefaultApplicationBasicClusterServer(this, applicationName, catalogVendorId, applicationId, status, applicationVersion, allowedVendorList);
  }
}
