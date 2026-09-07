/**
 * @file src/devices/audioDoorbell.ts
 * @description This file contains the AudioDoorbell class.
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
 * @created 2026-07-20
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
import { addChimeClient, addWebRtcTransportRequestorClient } from '../behaviors/clients.js';
import { createDefaultWebRtcTransportProviderClusterServer } from '../behaviors/webRtcTransportProviderServer.js';
// Matterbridge
import { audioDoorbell, powerSource } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { type MatterbridgeEndpointOptions } from '../matterbridgeEndpointTypes.js';

/**
 * Options for configuring an {@link AudioDoorbell} instance.
 */
export interface AudioDoorbellOptions extends MatterbridgeEndpointOptions {
  /** Identify time in seconds. Default: 0 */
  identifyTime?: number;
  /** Identify type. The Identify cluster is always created because it is a required server cluster for the Audio Doorbell device type. Default: Identify.IdentifyType.None */
  identifyType?: Identify.IdentifyType;

  /** Power source type. Default: Wired (with None, the Power Source cluster will not be created) */
  powerSourceType?: 'Rechargeable' | 'Replaceable' | 'Battery' | 'Wired' | 'None';

  /** Indicates the maximum size, in bytes, of the content buffer used for pre-roll, queued transmissions and metadata */
  maxContentBufferSize?: number;
  /** Indicates the maximum network bandwidth, in bits per second, that the device would consume for the transmission of its media streams */
  maxNetworkBandwidth?: number;
  /** Indicates the list of stream usages that are supported by the audio doorbell */
  supportedStreamUsages?: StreamUsage[];
  /** Indicates the ranked stream usage priorities; only usages found in supportedStreamUsages can be included */
  streamUsagePriorities?: StreamUsage[];
  /** Indicates the audio capabilities of the microphone in terms of the codec used, supported sample rates and the number of channels */
  microphoneCapabilities?: CameraAvStreamManagement.AudioCapabilities;
}

/**
 * Matterbridge endpoint representing an audio doorbell device.
 * Matter specs 1.6.0 chapter 16.5.
 */
export class AudioDoorbell extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the AudioDoorbell class.
   *
   * An Audio Doorbell device is composed in all cases with a generic switch to provide a doorbell with Audio only
   * streaming. The Switch cluster is created with the MomentarySwitch feature only, and the CameraAvStreamManagement
   * cluster is created with the Audio feature only (the Video and Snapshot features are not present in this device
   * type). The required Chime and WebRtcTransportRequestor client clusters are added automatically by
   * {@link addRequiredClusters}/{@link addWebRtcTransportRequestorClient}, so a bound Chime device can be triggered
   * when the doorbell button is pressed and a bound controller can be solicited for a WebRTC offer.
   *
   * @param {string} name - The name of the audio doorbell.
   * @param {string} serial - The serial number of the audio doorbell.
   * @param {AudioDoorbellOptions} [options] - Optional configuration values. Missing fields use defaults.
   *
   * Options defaults:
   *  - identifyTime: 0
   *  - identifyType: Identify.IdentifyType.None
   *  - powerSourceType: Wired (with None, the Power Source cluster will not be created)
   *
   *  - maxContentBufferSize: 65536 (64 KB)
   *  - maxNetworkBandwidth: 128000 (128 kbps)
   *  - supportedStreamUsages: [StreamUsage.LiveView]
   *  - streamUsagePriorities: same as supportedStreamUsages
   *  - microphoneCapabilities: { maxNumberOfChannels: 1, supportedCodecs: [AudioCodec.Opus], supportedSampleRates: [48000], supportedBitDepths: [16] }
   *
   * @returns {AudioDoorbell} The AudioDoorbell instance.
   */
  constructor(name: string, serial: string, options: AudioDoorbellOptions = {}) {
    const {
      identifyTime = 0,
      identifyType = Identify.IdentifyType.None,
      powerSourceType = 'Wired',
      maxContentBufferSize = 65_536,
      maxNetworkBandwidth = 128_000,
      supportedStreamUsages = [StreamUsage.LiveView],
      streamUsagePriorities = supportedStreamUsages,
      microphoneCapabilities = { maxNumberOfChannels: 1, supportedCodecs: [CameraAvStreamManagement.AudioCodec.Opus], supportedSampleRates: [48000], supportedBitDepths: [16] },
      id,
      number,
      tagList,
      mode,
    } = options;
    super(powerSourceType === 'None' ? [audioDoorbell] : [audioDoorbell, powerSource], {
      id: id ?? `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}`,
      number,
      tagList,
      mode,
    });
    this.createDefaultIdentifyClusterServer(identifyTime, identifyType);
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Audio Doorbell');
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
    this.createDefaultMomentarySwitchClusterServer();
    createDefaultAudioCameraAvStreamManagementClusterServer(this, {
      maxContentBufferSize,
      maxNetworkBandwidth,
      supportedStreamUsages,
      streamUsagePriorities,
      microphoneCapabilities,
    });
    createDefaultWebRtcTransportProviderClusterServer(this);
    addChimeClient(this);
    addWebRtcTransportRequestorClient(this);
    this.addRequiredClusters();
  }
}

/**
 * Initial state accepted by {@link createDefaultAudioCameraAvStreamManagementClusterServer}.
 */
export interface AudioCameraAvStreamManagementClusterOptions {
  /** Indicates the maximum size, in bytes, of the content buffer used for pre-roll, queued transmissions and metadata */
  maxContentBufferSize: number;
  /** Indicates the maximum network bandwidth, in bits per second, that the device would consume for the transmission of its media streams */
  maxNetworkBandwidth: number;
  /** Indicates the list of stream usages that are supported by the audio doorbell */
  supportedStreamUsages: StreamUsage[];
  /** Indicates the ranked stream usage priorities; only usages found in supportedStreamUsages can be included */
  streamUsagePriorities: StreamUsage[];
  /** Indicates the audio capabilities of the microphone in terms of the codec used, supported sample rates and the number of channels */
  microphoneCapabilities: CameraAvStreamManagement.AudioCapabilities;
}

/**
 * Creates a default CameraAvStreamManagement cluster server, specialized for the Audio feature only, on the given
 * endpoint. The Video, Snapshot and ImageControl features are not enabled, as required by the Matter specification
 * for the Audio Doorbell device type.
 *
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to create the CameraAvStreamManagement cluster server on.
 * @param {AudioCameraAvStreamManagementClusterOptions} options - The initial state of the CameraAvStreamManagement cluster server.
 * @returns {MatterbridgeEndpoint} The endpoint with the CameraAvStreamManagement cluster server created.
 */
export function createDefaultAudioCameraAvStreamManagementClusterServer(
  endpoint: MatterbridgeEndpoint,
  options: AudioCameraAvStreamManagementClusterOptions,
): MatterbridgeEndpoint {
  endpoint.behaviors.require(MatterbridgeCameraAvStreamManagementServer.with(CameraAvStreamManagement.Feature.Audio), {
    ...options,
    hardPrivacyModeOn: false,
    statusLightEnabled: false,
    allocatedAudioStreams: [],
    microphoneMuted: false,
    microphoneVolumeLevel: 128,
    microphoneMaxLevel: 254,
    microphoneMinLevel: 0,
    microphoneAgcEnabled: false,
  });
  return endpoint;
}
