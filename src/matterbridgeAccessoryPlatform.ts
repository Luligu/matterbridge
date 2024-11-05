/**
 * This file contains the class MatterbridgeAccessoryPlatform.
 *
 * @file matterbridgeAccessoryPlatform.ts
 * @author Luca Liguori
 * @date 2023-12-29
 * @version 1.0.5
 *
 * Copyright 2023, 2024, 2025 Luca Liguori.
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

import { Matterbridge } from './matterbridge.js';
import { MatterbridgePlatform, PlatformConfig } from './matterbridgePlatform.js';

import { AnsiLogger } from 'node-ansi-logger';

/**
 * Represents a Matterbridge accessory platform.
 *
 */
export class MatterbridgeAccessoryPlatform extends MatterbridgePlatform {
  /**
   * Creates an instance of MatterbridgeAccessoryPlatform.
   * @param {Matterbridge} matterbridge - The Matterbridge instance.
   * @param {AnsiLogger} log - The logger instance.
   * @param {PlatformConfig} config - The platform configuration.
   */
  constructor(matterbridge: Matterbridge, log: AnsiLogger, config: PlatformConfig) {
    super(matterbridge, log, config);

    this.type = 'AccessoryPlatform';
    config.type = this.type;

    this.log.debug(`Matterbridge${this.type} loaded`);
  }
}
