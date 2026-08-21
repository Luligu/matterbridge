/**
 * @file packages/core/src/devices/videoRemoteControl.ts
 * @description This file contains the VideoRemoteControl class.
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
import { KeypadInput } from '@matter/types/clusters/keypad-input';
import { MediaPlayback } from '@matter/types/clusters/media-playback';
import { OnOff } from '@matter/types/clusters/on-off';
import type { EndpointNumber } from '@matter/types/datatype';

// Matterbridge
import { powerSource, videoRemoteControl } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { createDefaultMediaBindingClusterServer, createDefaultMediaPowerSourceClusterServer, type MediaPowerSourceType } from './mediaHelpers.js';

/**
 * Options for configuring a {@link VideoRemoteControl} instance.
 */
export interface VideoRemoteControlOptions {
  /** Power source type. `'None'` omits the Power Source cluster entirely. */
  powerSourceType?: MediaPowerSourceType;
  /** Stable storage key for the endpoint. Defaults to `${name}-${serial}` with spaces removed. */
  id?: string;
  /** Explicit endpoint number. */
  number?: EndpointNumber;
}

/**
 * Matterbridge endpoint representing a video remote control device.
 */
export class VideoRemoteControl extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the VideoRemoteControl class.
   *
   * A Video Remote Control is a commissionable node used to control basic features including, at a minimum, the
   * ability to initiate keypad navigation and media playback. All required elements (OnOff, MediaPlayback,
   * KeypadInput) are client clusters, advertised through the Binding cluster.
   *
   * @param {string} name - The name of the video remote control.
   * @param {string} serial - The serial number of the video remote control.
   * @param {VideoRemoteControlOptions} [options] - Optional configuration values. Missing fields use defaults.
   *
   * Options defaults:
   *  - powerSourceType: 'Battery'
   *
   * @returns {VideoRemoteControl} The VideoRemoteControl instance.
   */
  constructor(name: string, serial: string, options: VideoRemoteControlOptions = {}) {
    const { powerSourceType = 'Battery' } = options;
    super(powerSourceType === 'None' ? [videoRemoteControl] : [videoRemoteControl, powerSource], {
      id: options.id ?? `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}`,
      number: options.number,
    });
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Video Remote Control');
    createDefaultMediaPowerSourceClusterServer(this, powerSourceType);
    createDefaultMediaBindingClusterServer(this, [OnOff.id, MediaPlayback.id, KeypadInput.id]);
  }
}
