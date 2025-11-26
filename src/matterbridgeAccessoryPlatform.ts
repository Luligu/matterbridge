/**
 * This file contains the class MatterbridgeAccessoryPlatform.
 *
 * @file matterbridgeAccessoryPlatform.ts
 * @author Luca Liguori
 * @created 2023-12-29
 * @version 1.0.6
 * @license Apache-2.0
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
 * limitations under the License.
 */

// eslint-disable-next-line no-console
if (process.argv.includes('--loader') || process.argv.includes('-loader')) console.log('\u001B[32mMatterbridgeAccessoryPlatform loaded.\u001B[40;0m');

// AnsiLogger module
import { AnsiLogger } from 'node-ansi-logger';

// Matterbridge
import { MatterbridgePlatform, PlatformConfig, PlatformMatterbridge } from './matterbridgePlatform.js';

/**
 * Represents a Matterbridge accessory platform.
 *
 * This class extends the MatterbridgePlatform class.
 */
export class MatterbridgeAccessoryPlatform extends MatterbridgePlatform {
  /**
   * Creates an instance of MatterbridgeAccessoryPlatform.
   *
   * @param {PlatformMatterbridge} matterbridge - The PlatformMatterbridge instance.
   * @param {AnsiLogger} log - The logger instance.
   * @param {PlatformConfig} config - The platform configuration.
   */
  constructor(matterbridge: PlatformMatterbridge, log: AnsiLogger, config: PlatformConfig) {
    super(matterbridge, log, config);

    this.type = 'AccessoryPlatform';
    config.type = this.type;

    this.log.debug(`Matterbridge${this.type} loaded`);
  }
}
