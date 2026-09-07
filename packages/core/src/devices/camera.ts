/**
 * @file src/devices/camera.ts
 * @description This file contains the Camera class.
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

import { StreamUsage, ThreeLevelAuto } from '@matter/types';
import type { Viewport } from '@matter/types';
import { CameraAvSettingsUserLevelManagement } from '@matter/types/clusters/camera-av-settings-user-level-management';
import { CameraAvStreamManagement } from '@matter/types/clusters/camera-av-stream-management';
import { Identify } from '@matter/types/clusters/identify';

import { MatterbridgeCameraAvSettingsUserLevelManagementServer } from '../behaviors/cameraAvSettingsUserLevelManagementServer.js';
import { MatterbridgeCameraAvStreamManagementServer } from '../behaviors/cameraAvStreamManagementServer.js';
import { addWebRtcTransportRequestorClient } from '../behaviors/clients.js';
import { MatterbridgeWebRtcTransportProviderServer } from '../behaviors/webRtcTransportProviderServer.js';
// Matterbridge
import { camera, powerSource } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { type MatterbridgeEndpointOptions } from '../matterbridgeEndpointTypes.js';

/**
 * Options for configuring a {@link Camera} instance.
 *
 * The CameraAvStreamManagement Video, Audio, Snapshot and ImageControl features and the WebRtcTransportProvider cluster
 * are implemented; only the Answer/End invocations on the WebRtcTransportRequestor client (Offer invocation only is
 * implemented), required by the Matter specification for a fully compliant Camera device type, are not part of this example.
 */
export interface CameraOptions extends MatterbridgeEndpointOptions {
  /** Identify time in seconds. Default: 0 */
  identifyTime?: number;
  /** Identify type. Default: Identify.IdentifyType.None (the Identify cluster will not be created) */
  identifyType?: Identify.IdentifyType;

  /** Power source type. Default: Wired (with None, the Power Source cluster will not be created) */
  powerSourceType?: 'Rechargeable' | 'Replaceable' | 'Battery' | 'Wired' | 'None';

  /** Indicates whether the camera has a mechanical pan-tilt-zoom (PTZ) mechanism */
  ptz?: boolean;

  /** Indicates the maximum size, in bytes, of the content buffer used for pre-roll, queued transmissions and metadata */
  maxContentBufferSize?: number;
  /** Indicates the maximum network bandwidth, in bits per second, that the device would consume for the transmission of its media streams */
  maxNetworkBandwidth?: number;
  /** Indicates the list of stream usages that are supported by the camera */
  supportedStreamUsages?: StreamUsage[];
  /** Indicates the ranked stream usage priorities; only usages found in supportedStreamUsages can be included */
  streamUsagePriorities?: StreamUsage[];
  /** Indicates the maximum number of concurrent encoders supported by the camera */
  maxConcurrentEncoders?: number;
  /** Indicates the maximum data rate, in encoded pixels per second, that the camera can produce */
  maxEncodedPixelRate?: number;
  /** Indicates the video sensor parameters for the camera */
  videoSensorParams?: CameraAvStreamManagement.VideoSensorParams;
  /** Indicates the minimum resolution, in pixels, that the camera allows for its viewport */
  minViewportResolution?: CameraAvStreamManagement.VideoResolution;
  /** Indicates the rate distortion trade-off points between resolution, frame rate and bitrate for each supported hardware encoder */
  rateDistortionTradeOffPoints?: CameraAvStreamManagement.RateDistortionTradeOffPoints[];
  /** Indicates the current logical frame rate of the sensor in frames per second */
  currentFrameRate?: number;
  /** Indicates the viewport to apply to all streams */
  viewport?: Viewport;
  /** Indicates the audio capabilities of the microphone in terms of the codec used, supported sample rates and the number of channels */
  microphoneCapabilities?: CameraAvStreamManagement.AudioCapabilities;
  /** Indicates the list of supported snapshot capabilities */
  snapshotCapabilities?: CameraAvStreamManagement.SnapshotCapabilities[];

  /** Indicates the minimum value for the mechanical pan, in angular degrees */
  panMin?: number;
  /** Indicates the maximum value for the mechanical pan, in angular degrees */
  panMax?: number;
  /** Indicates the minimum value for the mechanical tilt, in angular degrees */
  tiltMin?: number;
  /** Indicates the maximum value for the mechanical tilt, in angular degrees */
  tiltMax?: number;
  /** Indicates the maximum value for the mechanical zoom */
  zoomMax?: number;
  /** Indicates the initial mechanical pan, tilt and zoom position */
  mptzPosition?: CameraAvSettingsUserLevelManagement.Mptz;
}

/**
 * Matterbridge endpoint representing a camera device.
 */
export class Camera extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the Camera class.
   *
   * A Camera device provides interfaces for controlling and transporting captured media. This example only implements the
   * CameraAvStreamManagement cluster with the Video, Audio, Snapshot and ImageControl features enabled, and the WebRtcTransportProvider cluster.
   *
   * @param {string} name - The name of the camera.
   * @param {string} serial - The serial number of the camera.
   * @param {CameraOptions} [options] - Optional configuration values. Missing fields use defaults.
   *
   * Options defaults:
   *  - identifyTime: 0
   *  - identifyType: Identify.IdentifyType.None (the Identify cluster will not be created)
   *
   *  - maxContentBufferSize: 4194304 (4 MB)
   *  - maxNetworkBandwidth: 10000000 (10 Mbps)
   *  - supportedStreamUsages: [StreamUsage.LiveView, StreamUsage.Recording]
   *  - streamUsagePriorities: same as supportedStreamUsages
   *  - maxConcurrentEncoders: 1
   *  - maxEncodedPixelRate: 124416000 (1920x1080 @ 60 fps — must cover videoSensorParams' sensor resolution × maxFps, Matter 1.6/1.5.1 §11.2.7.2; verified by TC_AVSM_2_13)
   *  - videoSensorParams: { sensorWidth: 1920, sensorHeight: 1080, maxFps: 60 } (the sensor's overall peak frame rate — Matter 1.6/1.5.1 §11.2.6.6.3 — not tied to any one resolution; only achievable at lower resolutions in practice)
   *  - minViewportResolution: { width: 640, height: 360 }
   *  - rateDistortionTradeOffPoints: [{ resolution: 640x480, minBitRate: 250000 }, { resolution: 1280x720, minBitRate: 500000 }, { resolution: 1920x1080, minBitRate: 1000000 }], each with codec: VideoCodec.H264
   *  - currentFrameRate: 30
   *  - viewport: { x1: 0, y1: 0, x2: sensorWidth, y2: sensorHeight }
   *  - imageRotation: 0
   *  - imageFlipHorizontal: false
   *  - imageFlipVertical: false
   *  - microphoneCapabilities: { maxNumberOfChannels: 1, supportedCodecs: [AudioCodec.Opus], supportedSampleRates: [48000], supportedBitDepths: [16] }
   *  - snapshotCapabilities: [{ resolution: 640x480 }, { resolution: 1280x720 }, { resolution: 1920x1080 }], each with maxFrameRate: 10, imageCodec: ImageCodec.Jpeg, requiresEncodedPixels: false
   *
   *  - ptz: false (the CameraAvSettingsUserLevelManagement cluster will not be created)
   *  - panMin: -170, panMax: 170 (angular degrees)
   *  - tiltMin: -20, tiltMax: 90 (angular degrees)
   *  - zoomMax: 10
   *  - mptzPosition: { pan: 0, tilt: 0, zoom: 1 }
   *
   * @returns {Camera} The Camera instance.
   */
  constructor(name: string, serial: string, options: CameraOptions = {}) {
    const {
      identifyTime = 0,
      identifyType = Identify.IdentifyType.None,
      powerSourceType = 'Wired',
      ptz = false,
      maxContentBufferSize = 4_194_304,
      maxNetworkBandwidth = 10_000_000,
      supportedStreamUsages = [StreamUsage.LiveView, StreamUsage.Recording],
      streamUsagePriorities = supportedStreamUsages,
      maxConcurrentEncoders = 1,
      maxEncodedPixelRate = 1920 * 1080 * 60,
      videoSensorParams = { sensorWidth: 1920, sensorHeight: 1080, maxFps: 60 },
      minViewportResolution = { width: 640, height: 360 },
      rateDistortionTradeOffPoints = [
        { codec: CameraAvStreamManagement.VideoCodec.H264, resolution: { width: 640, height: 480 }, minBitRate: 250_000 },
        { codec: CameraAvStreamManagement.VideoCodec.H264, resolution: { width: 1280, height: 720 }, minBitRate: 500_000 },
        { codec: CameraAvStreamManagement.VideoCodec.H264, resolution: { width: 1920, height: 1080 }, minBitRate: 1_000_000 },
      ],
      currentFrameRate = 30,
      viewport = { x1: 0, y1: 0, x2: videoSensorParams.sensorWidth, y2: videoSensorParams.sensorHeight },
      microphoneCapabilities = { maxNumberOfChannels: 1, supportedCodecs: [CameraAvStreamManagement.AudioCodec.Opus], supportedSampleRates: [48000], supportedBitDepths: [16] },
      snapshotCapabilities = [
        { resolution: { width: 640, height: 480 }, maxFrameRate: 10, imageCodec: CameraAvStreamManagement.ImageCodec.Jpeg, requiresEncodedPixels: false },
        { resolution: { width: 1280, height: 720 }, maxFrameRate: 10, imageCodec: CameraAvStreamManagement.ImageCodec.Jpeg, requiresEncodedPixels: false },
        { resolution: { width: 1920, height: 1080 }, maxFrameRate: 10, imageCodec: CameraAvStreamManagement.ImageCodec.Jpeg, requiresEncodedPixels: false },
      ],
      panMin = -170,
      panMax = 170,
      tiltMin = -20,
      tiltMax = 90,
      zoomMax = 10,
      mptzPosition = { pan: 0, tilt: 0, zoom: 1 },
      id,
      number,
      tagList,
      mode,
    } = options;
    super(powerSourceType === 'None' ? [camera] : [camera, powerSource], { id: id ?? `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}`, number, tagList, mode });
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
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Camera');
    createDefaultCameraAvStreamManagementClusterServer(this, {
      maxContentBufferSize,
      maxNetworkBandwidth,
      supportedStreamUsages,
      streamUsagePriorities,
      maxConcurrentEncoders,
      maxEncodedPixelRate,
      videoSensorParams,
      minViewportResolution,
      rateDistortionTradeOffPoints,
      currentFrameRate,
      viewport,
      microphoneCapabilities,
      snapshotCapabilities,
    });
    if (ptz) createDefaultCameraAvSettingsUserLevelManagementClusterServer(this, { panMin, panMax, tiltMin, tiltMax, zoomMax, mptzPosition });
    createDefaultWebRtcTransportProviderClusterServer(this);
    addWebRtcTransportRequestorClient(this);
    this.addRequiredClusters();
  }
}

/**
 * Initial state accepted by {@link createDefaultCameraAvStreamManagementClusterServer}.
 */
export interface CameraAvStreamManagementClusterOptions {
  /** Indicates the maximum size, in bytes, of the content buffer used for pre-roll, queued transmissions and metadata */
  maxContentBufferSize: number;
  /** Indicates the maximum network bandwidth, in bits per second, that the device would consume for the transmission of its media streams */
  maxNetworkBandwidth: number;
  /** Indicates the list of stream usages that are supported by the camera */
  supportedStreamUsages: StreamUsage[];
  /** Indicates the ranked stream usage priorities; only usages found in supportedStreamUsages can be included */
  streamUsagePriorities: StreamUsage[];
  /** Indicates the maximum number of concurrent encoders supported by the camera */
  maxConcurrentEncoders: number;
  /** Indicates the maximum data rate, in encoded pixels per second, that the camera can produce */
  maxEncodedPixelRate: number;
  /** Indicates the video sensor parameters for the camera */
  videoSensorParams: CameraAvStreamManagement.VideoSensorParams;
  /** Indicates the minimum resolution, in pixels, that the camera allows for its viewport */
  minViewportResolution: CameraAvStreamManagement.VideoResolution;
  /** Indicates the rate distortion trade-off points between resolution, frame rate and bitrate for each supported hardware encoder */
  rateDistortionTradeOffPoints: CameraAvStreamManagement.RateDistortionTradeOffPoints[];
  /** Indicates the current logical frame rate of the sensor in frames per second */
  currentFrameRate: number;
  /** Indicates the viewport to apply to all streams */
  viewport: Viewport;
  /** Indicates the audio capabilities of the microphone in terms of the codec used, supported sample rates and the number of channels */
  microphoneCapabilities: CameraAvStreamManagement.AudioCapabilities;
  /** Indicates the list of supported snapshot capabilities */
  snapshotCapabilities: CameraAvStreamManagement.SnapshotCapabilities[];
}

/**
 * Creates a default CameraAvStreamManagement cluster server, with the Video, Audio, Snapshot and ImageControl features
 * enabled, on the given endpoint.
 *
 * The ImageControl feature is required here (even though it doesn't implement any real image-processing logic) so
 * that this endpoint's registered behavior matches {@link MatterbridgeCameraAvStreamManagementServer}'s own declared
 * feature set (Video, Audio, Snapshot, ImageControl): `webRtcTransportProviderServer.ts`'s automatic stream
 * assignment gates on `endpoint.behaviors.has(MatterbridgeCameraAvStreamManagementServer)`, which requires an exact
 * match against that base class, not just a compatible subset. Removing ImageControl here would make that check
 * fail and break WebRTC SolicitOffer/ProvideOffer automatic stream selection for this device.
 *
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to create the CameraAvStreamManagement cluster server on.
 * @param {CameraAvStreamManagementClusterOptions} options - The initial state of the CameraAvStreamManagement cluster server.
 * @returns {MatterbridgeEndpoint} The endpoint with the CameraAvStreamManagement cluster server created.
 */
export function createDefaultCameraAvStreamManagementClusterServer(endpoint: MatterbridgeEndpoint, options: CameraAvStreamManagementClusterOptions): MatterbridgeEndpoint {
  endpoint.behaviors.require(
    MatterbridgeCameraAvStreamManagementServer.with(
      CameraAvStreamManagement.Feature.Video,
      CameraAvStreamManagement.Feature.Audio,
      CameraAvStreamManagement.Feature.Snapshot,
      CameraAvStreamManagement.Feature.ImageControl,
    ),
    {
      ...options,
      hardPrivacyModeOn: false,
      statusLightEnabled: false,
      statusLightBrightness: ThreeLevelAuto.Auto,
      allocatedVideoStreams: [],
      allocatedAudioStreams: [],
      allocatedSnapshotStreams: [],
      microphoneMuted: false,
      microphoneVolumeLevel: 128,
      microphoneMaxLevel: 254,
      microphoneMinLevel: 0,
      microphoneAgcEnabled: false,
      imageRotation: 0,
      imageFlipVertical: false,
      imageFlipHorizontal: false,
    },
  );
  return endpoint;
}

/**
 * Initial state accepted by {@link createDefaultCameraAvSettingsUserLevelManagementClusterServer}.
 */
export interface CameraAvSettingsUserLevelManagementClusterOptions {
  /** Indicates the minimum value for the mechanical pan, in angular degrees */
  panMin: number;
  /** Indicates the maximum value for the mechanical pan, in angular degrees */
  panMax: number;
  /** Indicates the minimum value for the mechanical tilt, in angular degrees */
  tiltMin: number;
  /** Indicates the maximum value for the mechanical tilt, in angular degrees */
  tiltMax: number;
  /** Indicates the maximum value for the mechanical zoom */
  zoomMax: number;
  /** Indicates the initial mechanical pan, tilt and zoom position */
  mptzPosition: CameraAvSettingsUserLevelManagement.Mptz;
}

/**
 * Creates a default CameraAvSettingsUserLevelManagement cluster server, with the MechanicalPan, MechanicalTilt and
 * MechanicalZoom features enabled, on the given endpoint.
 *
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to create the CameraAvSettingsUserLevelManagement cluster server on.
 * @param {CameraAvSettingsUserLevelManagementClusterOptions} options - The initial state of the CameraAvSettingsUserLevelManagement cluster server.
 * @returns {MatterbridgeEndpoint} The endpoint with the CameraAvSettingsUserLevelManagement cluster server created.
 */
export function createDefaultCameraAvSettingsUserLevelManagementClusterServer(
  endpoint: MatterbridgeEndpoint,
  options: CameraAvSettingsUserLevelManagementClusterOptions,
): MatterbridgeEndpoint {
  endpoint.behaviors.require(
    MatterbridgeCameraAvSettingsUserLevelManagementServer.with(
      CameraAvSettingsUserLevelManagement.Feature.MechanicalPan,
      CameraAvSettingsUserLevelManagement.Feature.MechanicalTilt,
      CameraAvSettingsUserLevelManagement.Feature.MechanicalZoom,
    ),
    {
      ...options,
      movementState: CameraAvSettingsUserLevelManagement.PhysicalMovement.Idle,
    },
  );
  return endpoint;
}

/**
 * Creates a default WebRtcTransportProvider cluster server on the given endpoint.
 *
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to create the WebRtcTransportProvider cluster server on.
 * @returns {MatterbridgeEndpoint} The endpoint with the WebRtcTransportProvider cluster server created.
 */
export function createDefaultWebRtcTransportProviderClusterServer(endpoint: MatterbridgeEndpoint): MatterbridgeEndpoint {
  endpoint.behaviors.require(MatterbridgeWebRtcTransportProviderServer, { currentSessions: [] });
  return endpoint;
}
