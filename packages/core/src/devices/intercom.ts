/**
 * @file src/devices/intercom.ts
 * @description This file contains the Intercom class.
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
import { addChimeClient, addWebRtcTransportProviderClient, addWebRtcTransportRequestorClient } from '../behaviors/clients.js';
import { createDefaultWebRtcTransportProviderClusterServer } from '../behaviors/webRtcTransportProviderServer.js';
import { createDefaultWebRtcTransportRequestorClusterServer } from '../behaviors/webRtcTransportRequestorServer.js';
// Matterbridge
import { intercom, powerSource } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { type MatterbridgeEndpointOptions } from '../matterbridgeEndpointTypes.js';

/**
 * Options for configuring an {@link Intercom} instance.
 */
export interface IntercomOptions extends MatterbridgeEndpointOptions {
  /** Identify time in seconds. Default: 0 */
  identifyTime?: number;
  /** Identify type. Default: Identify.IdentifyType.None (the Identify cluster will not be created) */
  identifyType?: Identify.IdentifyType;

  /** Power source type. Default: Wired (with None, the Power Source cluster will not be created) */
  powerSourceType?: 'Rechargeable' | 'Replaceable' | 'Battery' | 'Wired' | 'None';

  /** Indicates the maximum size, in bytes, of the content buffer used for pre-roll, queued transmissions and metadata */
  maxContentBufferSize?: number;
  /** Indicates the maximum network bandwidth, in bits per second, that the device would consume for the transmission of its media streams */
  maxNetworkBandwidth?: number;
  /** Indicates the list of stream usages that are supported by the intercom */
  supportedStreamUsages?: StreamUsage[];
  /** Indicates the ranked stream usage priorities; only usages found in supportedStreamUsages can be included */
  streamUsagePriorities?: StreamUsage[];
  /** Indicates the audio capabilities of the microphone in terms of the codec used, supported sample rates and the number of channels */
  microphoneCapabilities?: CameraAvStreamManagement.AudioCapabilities;
  /** Indicates the audio capabilities of the speaker in terms of the codec used, supported sample rates and the number of channels */
  speakerCapabilities?: CameraAvStreamManagement.AudioCapabilities;
  /** Indicates the type of two-way talk support the device has. Default: FullDuplex */
  twoWayTalkSupport?: CameraAvStreamManagement.TwoWayTalkSupportType;
}

/**
 * Matterbridge endpoint representing an intercom device.
 * Matter specs 1.6.0 chapter 16.4.
 */
export class Intercom extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the Intercom class.
   *
   * An Intercom device provides two-way on demand communication facilities between devices (e.g. room to room
   * systems, or an entry door to individual units in a multi-tenant building). The CameraAvStreamManagement cluster
   * is created with the Audio and Speaker features, as required for genuine two-way audio (the Video and Snapshot
   * features are not present; see Camera for a device implementing those). Unlike Camera and Audio Doorbell, an
   * Intercom both hosts and invokes WebRtcTransportProvider and WebRtcTransportRequestor: the required
   * WebRtcTransportProvider and WebRtcTransportRequestor server clusters are created on this endpoint, and the
   * required WebRtcTransportProvider and WebRtcTransportRequestor client clusters are added automatically by
   * {@link addWebRtcTransportProviderClient}/{@link addWebRtcTransportRequestorClient}, so this endpoint can both
   * receive and solicit WebRTC offers to/from a peer intercom. The optional Chime client cluster is added
   * automatically by {@link addChimeClient}, so a bound Chime device can be triggered.
   *
   * @param {string} name - The name of the intercom.
   * @param {string} serial - The serial number of the intercom.
   * @param {IntercomOptions} [options] - Optional configuration values. Missing fields use defaults.
   *
   * Options defaults:
   *  - identifyTime: 0
   *  - identifyType: Identify.IdentifyType.None (the Identify cluster will not be created)
   *  - powerSourceType: Wired (with None, the Power Source cluster will not be created)
   *
   *  - maxContentBufferSize: 65536 (64 KB)
   *  - maxNetworkBandwidth: 128000 (128 kbps)
   *  - supportedStreamUsages: [StreamUsage.LiveView]
   *  - streamUsagePriorities: same as supportedStreamUsages
   *  - microphoneCapabilities: { maxNumberOfChannels: 1, supportedCodecs: [AudioCodec.Opus], supportedSampleRates: [48000], supportedBitDepths: [16] }
   *  - speakerCapabilities: { maxNumberOfChannels: 1, supportedCodecs: [AudioCodec.Opus], supportedSampleRates: [48000], supportedBitDepths: [16] }
   *  - twoWayTalkSupport: CameraAvStreamManagement.TwoWayTalkSupportType.FullDuplex
   *
   * @returns {Intercom} The Intercom instance.
   */
  constructor(name: string, serial: string, options: IntercomOptions = {}) {
    const {
      identifyTime = 0,
      identifyType = Identify.IdentifyType.None,
      powerSourceType = 'Wired',
      maxContentBufferSize = 65_536,
      maxNetworkBandwidth = 128_000,
      supportedStreamUsages = [StreamUsage.LiveView],
      streamUsagePriorities = supportedStreamUsages,
      microphoneCapabilities = { maxNumberOfChannels: 1, supportedCodecs: [CameraAvStreamManagement.AudioCodec.Opus], supportedSampleRates: [48000], supportedBitDepths: [16] },
      speakerCapabilities = { maxNumberOfChannels: 1, supportedCodecs: [CameraAvStreamManagement.AudioCodec.Opus], supportedSampleRates: [48000], supportedBitDepths: [16] },
      twoWayTalkSupport = CameraAvStreamManagement.TwoWayTalkSupportType.FullDuplex,
      id,
      number,
      tagList,
      mode,
    } = options;
    super(powerSourceType === 'None' ? [intercom] : [intercom, powerSource], {
      id: id ?? `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}`,
      number,
      tagList,
      mode,
    });
    if (identifyType !== Identify.IdentifyType.None) {
      this.createDefaultIdentifyClusterServer(identifyTime, identifyType);
    }
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Intercom');
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
    createDefaultIntercomCameraAvStreamManagementClusterServer(this, {
      maxContentBufferSize,
      maxNetworkBandwidth,
      supportedStreamUsages,
      streamUsagePriorities,
      microphoneCapabilities,
      speakerCapabilities,
      twoWayTalkSupport,
    });
    createDefaultWebRtcTransportProviderClusterServer(this);
    createDefaultWebRtcTransportRequestorClusterServer(this);
    addWebRtcTransportProviderClient(this);
    addWebRtcTransportRequestorClient(this);
    addChimeClient(this);
    this.addRequiredClusters();
  }
}

/**
 * Initial state accepted by {@link createDefaultIntercomCameraAvStreamManagementClusterServer}.
 */
export interface IntercomCameraAvStreamManagementClusterOptions {
  /** Indicates the maximum size, in bytes, of the content buffer used for pre-roll, queued transmissions and metadata */
  maxContentBufferSize: number;
  /** Indicates the maximum network bandwidth, in bits per second, that the device would consume for the transmission of its media streams */
  maxNetworkBandwidth: number;
  /** Indicates the list of stream usages that are supported by the intercom */
  supportedStreamUsages: StreamUsage[];
  /** Indicates the ranked stream usage priorities; only usages found in supportedStreamUsages can be included */
  streamUsagePriorities: StreamUsage[];
  /** Indicates the audio capabilities of the microphone in terms of the codec used, supported sample rates and the number of channels */
  microphoneCapabilities: CameraAvStreamManagement.AudioCapabilities;
  /** Indicates the audio capabilities of the speaker in terms of the codec used, supported sample rates and the number of channels */
  speakerCapabilities: CameraAvStreamManagement.AudioCapabilities;
  /** Indicates the type of two-way talk support the device has */
  twoWayTalkSupport: CameraAvStreamManagement.TwoWayTalkSupportType;
}

/**
 * Creates a default CameraAvStreamManagement cluster server, specialized for the Audio and Speaker features, on the
 * given endpoint. The Video, Snapshot and ImageControl features are not enabled, as required by the Matter
 * specification for the Intercom device type. Unlike {@link createDefaultAudioCameraAvStreamManagementClusterServer}
 * in `src/devices/audioDoorbell.ts` (Audio only, one-way from the visitor to the resident), the Intercom needs the
 * Speaker feature too so it can both capture and play back audio for genuine two-way communication.
 *
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to create the CameraAvStreamManagement cluster server on.
 * @param {IntercomCameraAvStreamManagementClusterOptions} options - The initial state of the CameraAvStreamManagement cluster server.
 * @returns {MatterbridgeEndpoint} The endpoint with the CameraAvStreamManagement cluster server created.
 */
export function createDefaultIntercomCameraAvStreamManagementClusterServer(
  endpoint: MatterbridgeEndpoint,
  options: IntercomCameraAvStreamManagementClusterOptions,
): MatterbridgeEndpoint {
  endpoint.behaviors.require(MatterbridgeCameraAvStreamManagementServer.with(CameraAvStreamManagement.Feature.Audio, CameraAvStreamManagement.Feature.Speaker), {
    ...options,
    hardPrivacyModeOn: false,
    statusLightEnabled: false,
    allocatedAudioStreams: [],
    microphoneMuted: false,
    microphoneVolumeLevel: 128,
    microphoneMaxLevel: 254,
    microphoneMinLevel: 0,
    microphoneAgcEnabled: false,
    speakerMuted: false,
    speakerVolumeLevel: 128,
    speakerMaxLevel: 254,
    speakerMinLevel: 0,
  });
  return endpoint;
}
