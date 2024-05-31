/**
 * This file contains the class MatterbridgeDynamicPlatform.
 *
 * @file matterbridgeDynamicPlatform.ts
 * @author Luca Liguori
 * @date 2023-12-29
 * @version 1.0.5
 *
 * Copyright 2023, 2024 Luca Liguori.
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
import { MatterbridgePlatform } from './matterbridgePlatform.js';
import { MatterbridgeDevice } from './matterbridgeDevice.js';
import { AnsiLogger } from 'node-ansi-logger';

/**
 * Represents a dynamic platform for Matterbridge.
 *
 */
export class MatterbridgeDynamicPlatform extends MatterbridgePlatform {
  /**
   * Creates an instance of MatterbridgeDynamicPlatform.
   * @param {Matterbridge} matterbridge - The Matterbridge instance.
   * @param {AnsiLogger} log - The logger instance.
   * @param {PlatformConfig} config - The platform configuration.
   */
  constructor(matterbridge: Matterbridge, log: AnsiLogger, config: PlatformConfig) {
    super(matterbridge, log, config);

    this.type = 'DynamicPlatform';

    this.log.debug(`Matterbridge${this.type} loaded`);
  }

  /**
   * This method must be overridden in the extended class.
   * It is called when the platform is started.
   * Use this method to create all the MatterbridgeDevice and call this.registerDevice() for each device.
   * @param {string} [reason] - The reason for starting.
   * @throws {Error} - Throws an error if not overridden.
   */
  async onStart(reason?: string) {
    this.log.error('Plugins must override onStart.', reason);
    throw new Error('Plugins must override onStart.');
  }

  /**
   * This method can be overridden in the extended class.
   * It is called after the platform has been commissioned.
   * Use this method to perform any configuration of your devices.
   */
  async onConfigure() {
    this.log.debug("**The plugin doesn't override onConfigure.");
  }

  /**
   * This method can be overridden in the extended class.
   * It is called when the platform is shutting down.
   * Use this method to clean up any resources.
   * @param {string} [reason] - The reason for shutting down.
   */
  async onShutdown(reason?: string) {
    this.log.debug("The plugin doesn't override onShutdown.", reason);
  }

  /**
   * Registers a device with the Matterbridge platform.
   * @param {MatterbridgeDevice} device - The device to register.
   */
  async registerDevice(device: MatterbridgeDevice) {
    await this.matterbridge.addBridgedDevice(this.name, device);
  }

  /**
   * Unregisters a device registered with the Matterbridge platform.
   * @param {MatterbridgeDevice} device - The device to unregister.
   */
  async unregisterDevice(device: MatterbridgeDevice) {
    await this.matterbridge.removeBridgedDevice(this.name, device);
  }

  /**
   * Unregisters all devices registered with the Matterbridge platform.
   */
  async unregisterAllDevices() {
    await this.matterbridge.removeAllBridgedDevices(this.name);
  }
}
