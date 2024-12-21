/**
 * This file contains the class MatterbridgeAccessoryPlatform.
 *
 * @file matterbridgePlatform.ts
 * @author Luca Liguori
 * @date 2024-03-21
 * @version 1.1.0
 *
 * Copyright 2024, 2025, 2026 Luca Liguori.
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

// Matterbridge
import { Matterbridge } from './matterbridge.js';
import { MatterbridgeDevice } from './matterbridgeDevice.js';

// AnsiLogger module
import { AnsiLogger, CYAN, LogLevel, nf } from 'node-ansi-logger';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { isValidArray, isValidObject } from './utils/utils.js';

// Storage module
import { NodeStorageManager } from 'node-persist-manager';

// Matter
import { EndpointNumber } from '@matter/main';

// Node.js module
import path from 'path';

// Platform types
export type PlatformConfigValue = string | number | boolean | bigint | object | undefined | null;

export type PlatformConfig = Record<string, PlatformConfigValue>;

export type PlatformSchemaValue = string | number | boolean | bigint | object | undefined | null;

export type PlatformSchema = Record<string, PlatformSchemaValue>;

/**
 * Represents the base Matterbridge platform.
 *
 */
export class MatterbridgePlatform {
  public matterbridge: Matterbridge;
  public log: AnsiLogger;
  public config: PlatformConfig = {};
  public name = ''; // Will be set by the loadPlugin() method using the package.json value.
  public type = ''; // Will be set by the extending classes.
  public version = ''; // Will be set by the loadPlugin() method using the package.json value.

  protected storage: NodeStorageManager;

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

    // create the NodeStorageManager for the plugin platform
    this.storage = new NodeStorageManager({
      dir: path.join(this.matterbridge.matterbridgeDirectory, this.name),
      writeQueue: false,
      expiredInterval: undefined,
      logging: false,
      forgiveParseErrors: true,
    });
  }

  protected async checkEndpointNumbers() {
    const context = await this.storage.createStorage('context');
    const separator = '|.|';
    const endpointMap = new Map<string, EndpointNumber>(await context.get<[string, EndpointNumber][]>('endpointMap', []));

    for (const device of this.matterbridge.getDevices().filter((d) => d.plugin === this.name)) {
      if (!device.uniqueId || !device.maybeNumber) continue;
      if (endpointMap.get(device.uniqueId) !== device.maybeNumber) {
        this.log.warn(`Endpoint number for device ${device.uniqueId} changed from ${endpointMap.get(device.uniqueId)} to ${device.maybeNumber}`);
      }
      this.log.debug(`Setting endpoint for device ${device.uniqueId} with number ${device.maybeNumber}`);
      endpointMap.set(device.uniqueId, device.maybeNumber);
      for (const child of device.getChildEndpoints() as MatterbridgeDevice[] | MatterbridgeEndpoint[]) {
        const childId = child instanceof MatterbridgeEndpoint ? child.id : child.uniqueStorageKey;
        if (!childId || !child.maybeNumber) continue;
        if (endpointMap.get(device.uniqueId + separator + childId) !== child.maybeNumber) {
          this.log.warn(`Child endpoint number for device ${child.uniqueId}.${childId} changed from ${endpointMap.get(device.uniqueId + separator + childId)} to ${child.maybeNumber}`);
        }
        this.log.debug(`Setting child endpoint for device ${device.uniqueId + separator + childId} with number ${child.maybeNumber}`);
        endpointMap.set(device.uniqueId + separator + childId, child.maybeNumber);
      }
    }
    await context.set('endpointMap', Array.from(endpointMap.entries()));
  }

  /**
   * This method must be overridden in the extended class.
   * It is called when the platform is started.
   * Use this method to create the MatterbridgeDevice and call this.registerDevice().
   * @param {string} [reason] - The reason for starting.
   * @throws {Error} - Throws an error if the method is not overridden.
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
    this.log.debug("The plugin doesn't override onConfigure.");
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
   * Sets the logger level and logs a debug message indicating that the plugin doesn't override this method.
   * @param {LogLevel} logLevel The new logger level.
   */
  async onChangeLoggerLevel(logLevel: LogLevel) {
    this.log.debug(`The plugin doesn't override onChangeLoggerLevel. Logger level set to: ${logLevel}`);
  }

  /**
   * Registers a device with the Matterbridge platform.
   * @param {MatterbridgeDevice} device - The device to register.
   */
  async registerDevice(device: MatterbridgeDevice | MatterbridgeEndpoint) {
    device.plugin = this.name;
    if (device instanceof MatterbridgeDevice) await this.matterbridge.addBridgedDevice(this.name, device);
    if (device instanceof MatterbridgeEndpoint) await this.matterbridge.addBridgedEndpoint(this.name, device);
  }

  /**
   * Unregisters a device registered with the Matterbridge platform.
   * @param {MatterbridgeDevice} device - The device to unregister.
   */
  async unregisterDevice(device: MatterbridgeDevice | MatterbridgeEndpoint) {
    if (device instanceof MatterbridgeDevice) await this.matterbridge.removeBridgedDevice(this.name, device);
    if (device instanceof MatterbridgeEndpoint) await this.matterbridge.removeBridgedEndpoint(this.name, device);
  }

  /**
   * Unregisters all devices registered with the Matterbridge platform.
   */
  async unregisterAllDevices() {
    if (this.matterbridge.edge) await this.matterbridge.removeAllBridgedEndpoints(this.name);
    else await this.matterbridge.removeAllBridgedDevices(this.name);
  }

  /**
   * Verifies if the Matterbridge version meets the required version.
   * @param {string} requiredVersion - The required version to compare against.
   * @returns {boolean} True if the Matterbridge version meets or exceeds the required version, false otherwise.
   */
  verifyMatterbridgeVersion(requiredVersion: string): boolean {
    const compareVersions = (matterbridgeVersion: string, requiredVersion: string): boolean => {
      const stripTag = (v: string) => {
        const parts = v.split('-');
        return parts[0];
      };
      const v1Parts = stripTag(matterbridgeVersion).split('.').map(Number);
      const v2Parts = stripTag(requiredVersion).split('.').map(Number);
      for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
        const v1Part = v1Parts[i] || 0;
        const v2Part = v2Parts[i] || 0;
        if (v1Part < v2Part) {
          return false;
        } else if (v1Part > v2Part) {
          return true;
        }
      }
      return true;
    };

    if (!compareVersions(this.matterbridge.matterbridgeVersion, requiredVersion)) return false;
    return true;
  }

  /**
   * Validates if a device is allowed based on the whitelist and blacklist configurations.
   * The blacklist has priority over the whitelist.
   *
   * @param {string | string[]} device - The device name(s) to validate.
   * @param {boolean} [log=true] - Whether to log the validation result.
   * @returns {boolean} - Returns true if the device is allowed, false otherwise.
   */
  validateDeviceWhiteBlackList(device: string | string[], log = true): boolean {
    if (!Array.isArray(device)) device = [device];

    let blackListBlocked = 0;
    if (isValidArray(this.config.blackList, 1)) {
      for (const d of device) if (this.config.blackList.includes(d)) blackListBlocked++;
    }
    if (blackListBlocked > 0) {
      if (log) this.log.info(`Skipping device ${CYAN}${device.join(', ')}${nf} because in blacklist`);
      return false;
    }

    let whiteListPassed = 0;
    if (isValidArray(this.config.whiteList, 1)) {
      for (const d of device) if (this.config.whiteList.includes(d)) whiteListPassed++;
    } else whiteListPassed++;
    if (whiteListPassed > 0) {
      return true;
    }
    if (log) this.log.info(`Skipping device ${CYAN}${device.join(', ')}${nf} because not in whitelist`);
    return false;
  }

  /**
   * Validates if an entity is allowed based on the entity whitelist and blacklist and the device-entity blacklist configurations.
   *
   * @param {string} device - The device to which the entity belongs.
   * @param {string} entity - The entity to validate.
   * @param {boolean} [log=true] - Whether to log the validation result.
   * @returns {boolean} - Returns true if the entity is allowed, false otherwise.
   */
  validateEntity(device: string, entity: string, log = true): boolean {
    return this.validateEntityBlackList(device, entity, log);
  }

  /**
   * Validates if an entity is allowed based on the entity blacklist and device-entity blacklist configurations.
   *
   * @param {string} device - The device to which the entity belongs.
   * @param {string} entity - The entity to validate.
   * @param {boolean} [log=true] - Whether to log the validation result.
   * @returns {boolean} - Returns true if the entity is allowed, false otherwise.
   */
  validateEntityBlackList(device: string, entity: string, log = true): boolean {
    if (isValidArray(this.config.entityBlackList, 1) && this.config.entityBlackList.find((e) => e === entity)) {
      if (log) this.log.info(`Skipping entity ${CYAN}${entity}${nf} because in entityBlackList`);
      return false;
    }
    if (isValidArray(this.config.entityWhiteList, 1) && !this.config.entityWhiteList.find((e) => e === entity)) {
      if (log) this.log.info(`Skipping entity ${CYAN}${entity}${nf} because not in entityWhiteList`);
      return false;
    }
    if (isValidObject(this.config.deviceEntityBlackList, 1) && device in this.config.deviceEntityBlackList && (this.config.deviceEntityBlackList as Record<string, string[]>)[device].includes(entity)) {
      if (log) this.log.info(`Skipping entity ${CYAN}${entity}${nf} for device ${CYAN}${device}${nf} because in deviceEntityBlackList`);
      return false;
    }
    return true;
  }
}
