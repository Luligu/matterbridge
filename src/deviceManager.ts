/**
 * This file contains the DeviceManager class.
 *
 * @file devices.ts
 * @author Luca Liguori
 * @date 2024-07-26
 * @version 1.0.10
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

// AnsiLogger module
import { AnsiLogger, BLUE, er, LogLevel, TimestampFormat } from './logger/export.js';

// NodeStorage module
import { NodeStorage } from './storage/export.js';

// Matterbridge
import { Matterbridge } from './matterbridge.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { dev } from './matterbridgeTypes.js';

/**
 * Manages Matterbridge devices.
 */
export class DeviceManager {
  private readonly _devices = new Map<string, MatterbridgeEndpoint>();
  private readonly matterbridge: Matterbridge;
  private readonly nodeContext: NodeStorage;
  private readonly log: AnsiLogger;

  /**
   * Creates an instance of DeviceManager.
   *
   * @param {Matterbridge} matterbridge - The Matterbridge instance.
   * @param {NodeStorage} nodeContext - The node storage context.
   */
  constructor(matterbridge: Matterbridge, nodeContext: NodeStorage) {
    this.matterbridge = matterbridge;
    this.nodeContext = nodeContext;
    this.log = new AnsiLogger({ logName: 'DeviceManager', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: matterbridge.log.logLevel });
    this.log.debug('Matterbridge device manager starting...');
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
   * Gets an array of all devices.
   *
   * @returns {MatterbridgeEndpoint[]} An array of all devices.
   */
  array(): MatterbridgeEndpoint[] {
    return Array.from(this._devices.values());
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
