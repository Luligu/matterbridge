/**
 * This file contains the DeviceManager class.
 *
 * @file devices.ts
 * @author Luca Liguori
 * @created 2024-07-26
 * @version 1.1.2
 * @license Apache-2.0
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
 * limitations under the License.
 */

// AnsiLogger module
import { AnsiLogger, BLUE, CYAN, db, debugStringify, er, LogLevel, TimestampFormat } from 'node-ansi-logger';
// Matterbridge
import { hasParameter } from '@matterbridge/utils';

import type { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { type BaseDevice, dev } from './matterbridgeTypes.js';
import { BroadcastServer } from './broadcastServer.js';
import { WorkerMessage } from './broadcastServerTypes.js';

/**
 * Converts a MatterbridgeEndpoint to a BaseDevice.
 *
 * @param {MatterbridgeEndpoint} device The MatterbridgeEndpoint to convert.
 * @returns {BaseDevice} The converted BaseDevice.
 */
export function toBaseDevice(device: MatterbridgeEndpoint | BaseDevice): BaseDevice {
  return {
    // MatterbridgeEndpoint properties
    mode: device.mode,
    plugin: device.plugin,
    configUrl: device.configUrl,
    deviceName: device.deviceName,
    serialNumber: device.serialNumber,
    uniqueId: device.uniqueId,
    vendorId: device.vendorId,
    vendorName: device.vendorName,
    productId: device.productId,
    productName: device.productName,
    softwareVersion: device.softwareVersion,
    softwareVersionString: device.softwareVersionString,
    hardwareVersion: device.hardwareVersion,
    hardwareVersionString: device.hardwareVersionString,
    productUrl: device.productUrl,
    tagList: device.tagList,
    originalId: device.originalId,
    name: device.name,
    deviceType: device.deviceType,
    // Endpoint properties
    number: device.number,
    id: device.id,
  };
}

/**
 * Manages Matterbridge devices.
 */
export class DeviceManager {
  private readonly _devices = new Map<string, MatterbridgeEndpoint>();
  private readonly log: AnsiLogger;
  private readonly server: BroadcastServer;
  private readonly debug = hasParameter('debug') || hasParameter('verbose');
  private readonly verbose = hasParameter('verbose');

  /**
   * Creates an instance of DeviceManager.
   */
  constructor() {
    this.log = new AnsiLogger({ logName: 'DeviceManager', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: hasParameter('debug') ? LogLevel.DEBUG : LogLevel.INFO });
    this.log.debug('Matterbridge device manager starting...');
    this.server = new BroadcastServer('devices', this.log);
    this.server.on('broadcast_message', this.msgHandler.bind(this));
    this.log.debug('Matterbridge device manager started');
  }

  destroy(): void {
    this.server.off('broadcast_message', this.msgHandler.bind(this));
    this.server.close();
  }

  private async msgHandler(msg: WorkerMessage) {
    if (this.server.isWorkerRequest(msg)) {
      if (this.verbose) this.log.debug(`Received request message ${CYAN}${msg.type}${db} from ${CYAN}${msg.src}${db}: ${debugStringify(msg)}${db}`);
      switch (msg.type) {
        case 'get_log_level':
          this.server.respond({ ...msg, result: { logLevel: this.log.logLevel } });
          break;
        case 'set_log_level':
          this.log.logLevel = msg.params.logLevel;
          this.server.respond({ ...msg, result: { logLevel: this.log.logLevel } });
          break;
        case 'devices_length':
          this.server.respond({ ...msg, result: { length: this.length } });
          break;
        case 'devices_size':
          this.server.respond({ ...msg, result: { size: this.size } });
          break;
        case 'devices_has':
          this.server.respond({ ...msg, result: { has: this.has(msg.params.uniqueId) } });
          break;
        case 'devices_get':
          {
            const endpoint = this.get(msg.params.uniqueId);
            this.server.respond({ ...msg, result: { device: endpoint ? toBaseDevice(endpoint) : undefined } });
          }
          break;
        case 'devices_set':
          this.server.respond({ ...msg, result: { device: this.set(toBaseDevice(msg.params.device) as unknown as MatterbridgeEndpoint) as unknown as BaseDevice } });
          break;
        case 'devices_remove':
          this.server.respond({ ...msg, result: { success: this.remove(toBaseDevice(msg.params.device) as unknown as MatterbridgeEndpoint) } });
          break;
        case 'devices_clear':
          this.clear();
          this.server.respond({ ...msg, result: { success: true } });
          break;
        case 'devices_basearray':
          this.server.respond({ ...msg, result: { devices: this.baseArray(msg.params.pluginName) } });
          break;
        default:
          if (this.verbose) this.log.debug(`Unknown broadcast message ${CYAN}${msg.type}${db} from ${CYAN}${msg.src}${db}`);
      }
    }
  }

  /**
   * Gets the number of devices.
   *
   * @returns {number} The number of devices.
   */
  get length(): number {
    return this._devices.size;
  }

  /**
   * Gets the number of devices.
   *
   * @returns {number} The number of devices.
   */
  get size(): number {
    return this._devices.size;
  }

  /**
   * Checks if a device with the specified unique ID exists.
   *
   * @param {string} uniqueId - The unique ID of the device.
   * @returns {boolean} True if the device exists, false otherwise.
   */
  has(uniqueId: string): boolean {
    return this._devices.has(uniqueId);
  }

  /**
   * Gets a device by its unique ID.
   *
   * @param {string} uniqueId - The unique ID of the device.
   * @returns {MatterbridgeEndpoint | undefined} The device, or undefined if not found.
   */
  get(uniqueId: string): MatterbridgeEndpoint | undefined {
    return this._devices.get(uniqueId);
  }

  /**
   * Adds a device to the manager.
   *
   * @param {MatterbridgeEndpoint} device - The device to add.
   * @returns {MatterbridgeEndpoint} The added device.
   * @throws {Error} If the device does not have a unique ID.
   */
  set(device: MatterbridgeEndpoint): MatterbridgeEndpoint {
    if (!device.uniqueId) throw new Error(`The device ${dev}${device.deviceName}${er} has not been initialized: uniqueId is required`);
    if (this._devices.has(device.uniqueId)) this.log.error(`The device ${dev}${device.deviceName}${er} with uniqueId ${BLUE}${device.uniqueId}${er} serialNumber ${BLUE}${device.serialNumber}${er} is already in the device manager`);
    this._devices.set(device.uniqueId, device);
    return device;
  }

  /**
   * Removes a device from the manager.
   *
   * @param {MatterbridgeEndpoint} device - The device to remove.
   * @returns {boolean} True if the device was removed, false otherwise.
   * @throws {Error} If the device does not have a unique ID.
   */
  remove(device: MatterbridgeEndpoint): boolean {
    if (!device.uniqueId) throw new Error(`The device ${dev}${device.deviceName}${er} has not been initialized: uniqueId is required`);
    if (!this._devices.has(device.uniqueId)) this.log.error(`The device ${dev}${device.deviceName}${er} with uniqueId ${BLUE}${device.uniqueId}${er} serialNumber ${BLUE}${device.serialNumber}${er} is not registered in the device manager`);
    return this._devices.delete(device.uniqueId);
  }

  /**
   * Clears all devices from the manager.
   */
  clear(): void {
    this._devices.clear();
  }

  /**
   * Converts a MatterbridgeEndpoint to a BaseDevice.
   *
   * @param {MatterbridgeEndpoint} device The MatterbridgeEndpoint to convert.
   * @returns {BaseDevice} The converted BaseDevice.
   */
  private toBaseDevice(device: MatterbridgeEndpoint): BaseDevice {
    return toBaseDevice(device);
  }

  /**
   * Gets an array of all devices.
   *
   * @returns {MatterbridgeEndpoint[]} An array of all devices.
   */
  array(): MatterbridgeEndpoint[] {
    return Array.from(this._devices.values());
  }

  /**
   * Gets a base array of all devices suitable for serialization.
   *
   * @param {string} [pluginName] - Optional plugin name to filter devices.
   * @returns {ApiDevices[]} A base array of all devices.
   */
  baseArray(pluginName?: string): BaseDevice[] {
    const devices: BaseDevice[] = [];
    for (const device of Array.from(this._devices.values())) {
      // Filter by pluginName if provided
      if (pluginName && pluginName !== device.plugin) continue;
      devices.push(this.toBaseDevice(device));
    }
    return devices;
  }

  /**
   * Iterates over all devices.
   *
   * @returns {IterableIterator<MatterbridgeEndpoint>} An iterator for the devices.
   */
  [Symbol.iterator]() {
    return this._devices.values();
  }

  /**
   * Asynchronously iterates over each device and calls the provided callback function.
   *
   * @param {(device: MatterbridgeEndpoint) => Promise<void>} callback - The callback function to call with each device.
   * @returns {Promise<void>} A promise that resolves when all callbacks have been called.
   */
  async forEach(callback: (device: MatterbridgeEndpoint) => Promise<void>): Promise<void> {
    if (this.size === 0) return;

    const tasks = Array.from(this._devices.values()).map(async (device) => {
      try {
        await callback(device);
      } catch (error) {
        this.log.error(`Error processing forEach device ${dev}${device.deviceName}${er} serialNumber ${BLUE}${device.serialNumber}${er} uniqueId: ${BLUE}${device.uniqueId}${er}:`, error);
      }
    });
    await Promise.all(tasks);
  }

  /**
   * Sets the log level.
   *
   * @param {LogLevel} logLevel - The log level to set.
   */
  set logLevel(logLevel: LogLevel) {
    this.log.logLevel = logLevel;
  }
}
