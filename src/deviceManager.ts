/**
 * This file contains the DeviceManager class.
 *
 * @file devices.ts
 * @author Luca Liguori
 * @date 2024-07-26
 * @version 1.0.8
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

// NodeStorage and AnsiLogger modules
import { AnsiLogger, BLUE, er, LogLevel, TimestampFormat } from './logger/export.js';
import { NodeStorage } from './storage/export.js';

// Matterbridge
import { Matterbridge } from './matterbridge.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { dev } from './matterbridgeTypes.js';

export class DeviceManager {
  private readonly _devices = new Map<string, MatterbridgeEndpoint>();
  private readonly matterbridge: Matterbridge;
  private readonly nodeContext: NodeStorage;
  private readonly log: AnsiLogger;

  constructor(matterbridge: Matterbridge, nodeContext: NodeStorage) {
    this.matterbridge = matterbridge;
    this.nodeContext = nodeContext;
    this.log = new AnsiLogger({ logName: 'DeviceManager', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: matterbridge.log.logLevel });
    this.log.debug('Matterbridge device manager starting...');
  }

  get length(): number {
    return this._devices.size;
  }

  get size(): number {
    return this._devices.size;
  }

  has(uniqueId: string): boolean {
    return this._devices.has(uniqueId);
  }

  get(uniqueId: string): MatterbridgeEndpoint | undefined {
    return this._devices.get(uniqueId);
  }

  set(device: MatterbridgeEndpoint): MatterbridgeEndpoint {
    if (!device.uniqueId) throw new Error(`The device ${dev}${device.deviceName}${er} has not been initialized: uniqueId is required`);
    if (this._devices.has(device.uniqueId)) this.log.error(`The device ${dev}${device.deviceName}${er} with uniqueId ${BLUE}${device.uniqueId}${er} serialNumber ${BLUE}${device.serialNumber}${er} is already in the device manager`);
    this._devices.set(device.uniqueId, device);
    return device;
  }

  remove(device: MatterbridgeEndpoint): boolean {
    if (!device.uniqueId) throw new Error(`The device ${dev}${device.deviceName}${er} has not been initialized: uniqueId is required`);
    if (!this._devices.has(device.uniqueId)) this.log.error(`The device ${dev}${device.deviceName}${er} with uniqueId ${BLUE}${device.uniqueId}${er} serialNumber ${BLUE}${device.serialNumber}${er} is not registered in the device manager`);
    return this._devices.delete(device.uniqueId);
  }

  clear(): void {
    this._devices.clear();
  }

  array(): MatterbridgeEndpoint[] {
    return Array.from(this._devices.values());
  }

  [Symbol.iterator]() {
    return this._devices.values();
  }

  async forEach(callback: (device: MatterbridgeEndpoint) => Promise<void>): Promise<void> {
    const tasks = Array.from(this._devices.values()).map(async (device) => {
      try {
        await callback(device);
      } catch (error) {
        this.log.error(`Error processing forEach device ${dev}${device.deviceName}${er} serialNumber ${BLUE}${device.serialNumber}${er} uniqueId: ${BLUE}${device.uniqueId}${er}:`, error);
        // throw error;
      }
    });
    await Promise.all(tasks);
  }

  get logLevel(): LogLevel {
    return this.log.logLevel;
  }

  set logLevel(logLevel: LogLevel) {
    this.log.logLevel = logLevel;
  }

  /*
  async loadFromStorage(): Promise<MatterbridgeDevice[]> {
    // Load the array from storage and convert it to a map
    const devicesArray = await this.nodeContext.get<MatterbridgeDevice[]>('devices', []);
    for (const device of devicesArray) this._devices.set(device.uniqueId, device);
    return devicesArray;
  }

  async saveToStorage(): Promise<number> {
    // Convert the map to an array
    const devices: MatterbridgeDevice[] = [];
    const deviceArrayFromMap = Array.from(this._devices.values());
    for (const device of deviceArrayFromMap) {
      devices.push({
        name: plugin.name,
        path: plugin.path,
        type: plugin.type,
        version: plugin.version,
        description: plugin.description,
        author: plugin.author,
        enabled: plugin.enabled,
        qrPairingCode: plugin.qrPairingCode,
        manualPairingCode: plugin.manualPairingCode,
      });
    }
    await this.nodeContext.set<MatterbridgeDevice[]>('devices', devices);
    this.log.debug(`Saved ${BLUE}${devices.length}${db} devices to storage`);
    return devices.length;
  }
  */
}
