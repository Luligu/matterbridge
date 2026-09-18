/**
 * @file packages/core/src/devices/cameraController.ts
 * @description This file contains the CameraController class.
 * @author Luca Liguori
 * @created 2026-09-13
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

import { addWebRtcTransportProviderClient } from '../behaviors/clients.js';
import { createDefaultWebRtcTransportRequestorClusterServer } from '../behaviors/webRtcTransportRequestorServer.js';
// Matterbridge
import { cameraController, powerSource } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { MatterbridgeEndpointOptions } from '../matterbridgeEndpointTypes.js';

/**
 * Options for configuring a {@link CameraController} instance.
 */
export interface CameraControllerOptions extends MatterbridgeEndpointOptions {
  /** Power source type. Default: Wired (with None, the Power Source cluster will not be created) */
  powerSourceType?: 'Rechargeable' | 'Replaceable' | 'Battery' | 'Wired' | 'None';
}

/**
 * Matterbridge endpoint representing a camera controller device.
 * Matter specs 1.6.0 chapter 16.8.
 */
export class CameraController extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the CameraController class.
   *
   * A Camera Controller device provides interfaces for controlling and managing camera devices. It is not a pure
   * controller device: besides the required WebRtcTransportProvider client cluster, used to invoke the WebRTC
   * signaling commands on a peer Camera device, it also hosts the required WebRtcTransportRequestor server cluster,
   * on which the peer Camera device invokes the WebRTC signaling commands in the other direction.
   *
   * The Identify, Power Source, Occupancy Sensing, Zone Management, Camera AV Stream Management, Camera AV Settings
   * User Level Management, Push AV Stream Transport, TLS Certificate Management and TLS Client Management client
   * clusters are optional for this device type and are not created.
   *
   * @param {string} name - The name of the camera controller.
   * @param {string} serial - The serial number of the camera controller.
   * @param {CameraControllerOptions} [options] - Optional configuration values. Missing fields use defaults.
   *
   * Options defaults:
   *  - powerSourceType: Wired (with None, the Power Source cluster will not be created)
   *
   * @returns {CameraController} The CameraController instance.
   */
  constructor(name: string, serial: string, options: CameraControllerOptions = {}) {
    const { powerSourceType = 'Wired', id, number, tagList, mode } = options;
    super(powerSourceType === 'None' ? [cameraController] : [cameraController, powerSource], {
      id: id ?? `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}`,
      number,
      tagList,
      mode,
    });
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Camera Controller');
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
    createDefaultWebRtcTransportRequestorClusterServer(this);
    addWebRtcTransportProviderClient(this);
    this.addRequiredClusters();
  }
}
