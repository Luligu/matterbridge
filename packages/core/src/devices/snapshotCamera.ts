/**
 * @file packages/core/src/devices/snapshotCamera.ts
 * @description This file contains the SnapshotCamera class.
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

import { StreamUsage } from '@matter/types';
import { CameraAvStreamManagement } from '@matter/types/clusters/camera-av-stream-management';
import { Identify } from '@matter/types/clusters/identify';

import { MatterbridgeCameraAvStreamManagementServer } from '../behaviors/cameraAvStreamManagementServer.js';
import { powerSource, snapshotCamera } from '../matterbridgeDeviceTypes.js';
// Matterbridge
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { type MatterbridgeEndpointOptions } from '../matterbridgeEndpointTypes.js';

/**
 * Options for configuring a {@link SnapshotCamera} instance.
 */
export interface SnapshotCameraOptions extends MatterbridgeEndpointOptions {
  /** Identify time in seconds. Default: 0 */
  identifyTime?: number;
  /** Identify type. Default: Identify.IdentifyType.None (the Identify cluster will not be created) */
  identifyType?: Identify.IdentifyType;

  /** Power source type. Default: Wired (with None, the Power Source cluster will not be created) */
  powerSourceType?: 'Rechargeable' | 'Replaceable' | 'Battery' | 'Wired' | 'None';

  /** Maximum number of concurrent encoders supported by the camera */
  maxConcurrentEncoders?: number;
  /** Maximum data rate in encoded pixels per second that the camera can produce */
  maxEncodedPixelRate?: number;
  /** Maximum size of the content buffer in bytes */
  maxContentBufferSize?: number;
  /** List of supported snapshot capabilities */
  snapshotCapabilities?: CameraAvStreamManagement.SnapshotCapabilities[];
  /** Maximum network bandwidth in bits per second that the camera would consume for the transmission of its media streams */
  maxNetworkBandwidth?: number;
  /** List of stream usages supported by the camera */
  supportedStreamUsages?: StreamUsage[];
  /** List of stream usages in decreasing order of priority */
  streamUsagePriorities?: StreamUsage[];
}

/**
 * Matterbridge endpoint representing a snapshot camera device.
 */
export class SnapshotCamera extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the SnapshotCamera class.
   *
   * A Snapshot Camera is a camera which can only support retrieving still images on-demand via the Capture
   * Snapshot command in the Camera AV Stream Management cluster.
   *
   * The CameraAvStreamManagement Snapshot and ImageControl features are implemented; the Video and Audio features
   * are not part of this example (see the Camera device for one implementing those).
   *
   * @param {string} name - The name of the snapshot camera.
   * @param {string} serial - The serial number of the snapshot camera.
   * @param {SnapshotCameraOptions} [options] - Optional configuration values. Missing fields use defaults.
   *
   * Options defaults:
   *  - identifyTime: 0
   *  - identifyType: Identify.IdentifyType.None (the Identify cluster will not be created)
   *  - powerSourceType: Wired (with None, the Power Source cluster will not be created)
   *
   *  - maxConcurrentEncoders: 1
   *  - maxEncodedPixelRate: 10000000
   *  - maxContentBufferSize: 1024
   *  - snapshotCapabilities: [{ resolution: 640x480 }, { resolution: 1280x720 }, { resolution: 1920x1080 }], each with maxFrameRate: 10, imageCodec: ImageCodec.Jpeg, requiresEncodedPixels: false
   *  - maxNetworkBandwidth: 10000
   *  - supportedStreamUsages: [StreamUsage.Recording]
   *  - streamUsagePriorities: [StreamUsage.Recording]
   *
   * @returns {SnapshotCamera} The SnapshotCamera instance.
   */
  constructor(name: string, serial: string, options: SnapshotCameraOptions = {}) {
    const {
      identifyTime = 0,
      identifyType = Identify.IdentifyType.None,

      powerSourceType = 'Wired',

      maxConcurrentEncoders = 1,
      maxEncodedPixelRate = 10000000,
      maxContentBufferSize = 1024,
      snapshotCapabilities = [
        { resolution: { width: 640, height: 480 }, maxFrameRate: 10, imageCodec: CameraAvStreamManagement.ImageCodec.Jpeg, requiresEncodedPixels: false },
        { resolution: { width: 1280, height: 720 }, maxFrameRate: 10, imageCodec: CameraAvStreamManagement.ImageCodec.Jpeg, requiresEncodedPixels: false },
        { resolution: { width: 1920, height: 1080 }, maxFrameRate: 10, imageCodec: CameraAvStreamManagement.ImageCodec.Jpeg, requiresEncodedPixels: false },
      ],
      maxNetworkBandwidth = 10000,
      supportedStreamUsages = [StreamUsage.Recording],
      streamUsagePriorities = [StreamUsage.Recording],
      id,
      number,
      tagList,
      mode,
    } = options;
    super(powerSourceType === 'None' ? [snapshotCamera] : [snapshotCamera, powerSource], {
      id: id ?? `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}`,
      number,
      tagList,
      mode,
    });
    if (identifyType !== Identify.IdentifyType.None) {
      this.createDefaultIdentifyClusterServer(identifyTime, identifyType);
    }
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Snapshot Camera');
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
    createDefaultSnapshotCameraAvStreamManagementClusterServer(this, {
      maxConcurrentEncoders,
      maxEncodedPixelRate,
      maxContentBufferSize,
      snapshotCapabilities,
      maxNetworkBandwidth,
      supportedStreamUsages,
      streamUsagePriorities,
    });
    this.addRequiredClusters();
  }
}

export interface SnapshotCameraAvStreamManagementClusterOptions {
  maxConcurrentEncoders: number;
  maxEncodedPixelRate: number;
  maxContentBufferSize: number;
  snapshotCapabilities: CameraAvStreamManagement.SnapshotCapabilities[];
  maxNetworkBandwidth: number;
  supportedStreamUsages: StreamUsage[];
  streamUsagePriorities: StreamUsage[];
}

/**
 *  Creates a default CameraAvStreamManagement cluster server, specialized for the Snapshot feature, on the given endpoint.
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to create the CameraAvStreamManagement cluster server on.
 * @param {SnapshotCameraAvStreamManagementClusterOptions} options - The options for configuring the CameraAvStreamManagement cluster server.
 * @returns {MatterbridgeEndpoint} The endpoint with the CameraAvStreamManagement cluster server created.
 */
export function createDefaultSnapshotCameraAvStreamManagementClusterServer(
  endpoint: MatterbridgeEndpoint,
  options: SnapshotCameraAvStreamManagementClusterOptions,
): MatterbridgeEndpoint {
  endpoint.behaviors.require(MatterbridgeCameraAvStreamManagementServer.with(CameraAvStreamManagement.Feature.Snapshot), {
    // mandatory attributes
    maxContentBufferSize: options.maxContentBufferSize, // M
    maxNetworkBandwidth: options.maxNetworkBandwidth, // M
    supportedStreamUsages: options.supportedStreamUsages, // M
    streamUsagePriorities: options.streamUsagePriorities, // M
    // CameraAvStreamManagement.Feature.Snapshot
    maxConcurrentEncoders: options.maxConcurrentEncoders, // VDO | SNP
    maxEncodedPixelRate: options.maxEncodedPixelRate, // VDO | SNP
    snapshotCapabilities: options.snapshotCapabilities, // SNP
    allocatedSnapshotStreams: [], // SNP, persisted by matter.js — never seeded from options
  });
  return endpoint;
}
