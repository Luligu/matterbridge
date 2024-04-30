/**
 * This file contains the class MatterbridgeAccessoryPlatform.
 *
 * @file matterbridgePlatform.ts
 * @author Luca Liguori
 * @date 2024-03-21
 * @version 1.0.0
 *
 * Copyright 2024 Luca Liguori.
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

import { Matterbridge, PlatformConfig } from './matterbridge.js';
import { AnsiLogger } from 'node-ansi-logger';

/**
 * Represents the base Matterbridge platform.
 *
 */
export class MatterbridgePlatform {
  protected matterbridge: Matterbridge;
  protected log: AnsiLogger;
  protected config: PlatformConfig = {};
  protected name = ''; // Will be set by the loadPlugin() method using the package.json value.
  protected type = ''; // Will be set by the extending classes.
  protected version = ''; // Will be set by the loadPlugin() method using the package.json value.

  /**
   * Creates an instance of the base MatterbridgePlatform.
   * @param {Matterbridge} matterbridge - The Matterbridge instance.
   * @param {AnsiLogger} log - The logger instance.
   * @param {PlatformConfig} config - The platform configuration.
   */
  constructor(matterbridge: Matterbridge, log: AnsiLogger, config: PlatformConfig) {
    this.matterbridge = matterbridge;
    this.log = log;
    this.config = config;
  }
}
