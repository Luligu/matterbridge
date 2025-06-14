/**
 * This file contains the class MatterbridgePlatform.
 *
 * @file matterbridgePlatform.ts
 * @author Luca Liguori
 * @date 2024-03-21
 * @version 1.2.1
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
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { checkNotLatinCharacters } from './matterbridgeEndpointHelpers.js';
import { isValidArray, isValidObject, isValidString } from './utils/export.js';

// AnsiLogger module
import { AnsiLogger, CYAN, db, er, LogLevel, nf, wr } from './logger/export.js';

// Storage module
import { NodeStorage, NodeStorageManager } from './storage/export.js';

// Matter
import { EndpointNumber } from '@matter/main';

// Node.js module
import path from 'node:path';

// Platform types
export type PlatformConfigValue = string | number | boolean | bigint | object | undefined | null;

export type PlatformConfig = Record<string, PlatformConfigValue>;

export interface DefaultPlatformConfig {
  name: string;
  type: string;
  version: string;
  whiteList?: string[];
  blackList?: string[];
  debug: boolean;
  unregisterOnShutdown: boolean;
}

export type PlatformSchemaValue = string | number | boolean | bigint | object | undefined | null;

export type PlatformSchema = Record<string, PlatformSchemaValue>;

/**
 * Represents the base Matterbridge platform. It is extended by the MatterbridgeAccessoryPlatform and MatterbridgeServicePlatform classes.
 *
 */
export class MatterbridgePlatform {
  matterbridge: Matterbridge;
  log: AnsiLogger;
  config: PlatformConfig = {};
  name = ''; // Will be set by the loadPlugin() method using the package.json value.
  type = ''; // Will be set by the extending classes.
  version = '1.0.0'; // Will be set by the loadPlugin() method using the package.json value.

  // Platform storage
  storage: NodeStorageManager;
  context?: NodeStorage;

  // Device and entity selection
  readonly selectDevice = new Map<string, { serial: string; name: string; configUrl?: string; icon?: string; entities?: { name: string; description: string; icon?: string }[] }>();
  readonly selectEntity = new Map<string, { name: string; description: string; icon?: string }>();

  // Promises for storage
  private _contextReady: Promise<void>;
  private _selectDeviceContextReady: Promise<void>;
  private _selectEntityContextReady: Promise<void>;
  ready: Promise<void>;

  // Registered devices
  private readonly _registeredEndpoints = new Map<string, MatterbridgeEndpoint>(); // uniqueId, MatterbridgeEndpoint
  private readonly _registeredEndpointsByName = new Map<string, MatterbridgeEndpoint>(); // deviceName, MatterbridgeEndpoint

  // Stored devices
  private readonly _storedDevices = new Map<string, { pluginName: string; serial: string; name: string; configUrl?: string }>(); // serial, { serial, name }

  /**
   * Creates an instance of the base MatterbridgePlatform.
   * It is extended by the MatterbridgeAccessoryPlatform and MatterbridgeServicePlatform classes.
   * Each plugin must extend the MatterbridgeAccessoryPlatform and MatterbridgeServicePlatform classes.
   *
   * @param {Matterbridge} matterbridge - The Matterbridge instance.
   * @param {AnsiLogger} log - The logger instance.
   * @param {PlatformConfig} config - The platform configuration.
   */
  constructor(matterbridge: Matterbridge, log: AnsiLogger, config: PlatformConfig) {
    this.matterbridge = matterbridge;
    this.log = log;
    this.config = config;

    // create the NodeStorageManager for the plugin platform
    if (!isValidString(this.config.name) || this.config.name === '') throw new Error('Platform: the plugin name is missing or invalid.');
    this.log.debug(`Creating storage for plugin ${this.config.name} in ${path.join(this.matterbridge.matterbridgeDirectory, this.config.name)}`);
    this.storage = new NodeStorageManager({
      dir: path.join(this.matterbridge.matterbridgeDirectory, this.config.name),
      writeQueue: false,
      expiredInterval: undefined,
      logging: false,
      forgiveParseErrors: true,
    });

    // create the context storage for the plugin platform
    this.log.debug(`Creating context for plugin ${this.config.name}`);
    this._contextReady = this.storage.createStorage('context').then((context) => {
      this.context = context;
      this.context.remove('endpointMap'); // Remove the old endpointMap TODO: remove in future versions
      this.log.debug(`Created context for plugin ${this.config.name}`);
    });

    // create the selectDevice storage for the plugin platform
    this.log.debug(`Loading selectDevice for plugin ${this.config.name}`);
    this._selectDeviceContextReady = this.storage.createStorage('selectDevice').then(async (context) => {
      const selectDevice = await context.get<{ serial: string; name: string; icon?: string; entities?: { name: string; description: string; icon?: string }[] }[]>('selectDevice', []);
      for (const device of selectDevice) this.selectDevice.set(device.serial, device);
      this.log.debug(`Loaded ${this.selectDevice.size} selectDevice for plugin ${this.config.name}`);
    });

    // create the selectEntity storage for the plugin platform
    this.log.debug(`Loading selectEntity for plugin ${this.config.name}`);
    this._selectEntityContextReady = this.storage.createStorage('selectEntity').then(async (context) => {
      const selectEntity = await context.get<{ name: string; description: string; icon?: string }[]>('selectEntity', []);
      for (const entity of selectEntity) this.selectEntity.set(entity.name, entity);
      this.log.debug(`Loaded ${this.selectEntity.size} selectEntity for plugin ${this.config.name}`);
    });

    // Create the `ready` promise for the platform
    this.ready = Promise.all([this._contextReady, this._selectDeviceContextReady, this._selectEntityContextReady]).then(() => {
      this.log.debug(`MatterbridgePlatform for plugin ${this.config.name} is fully initialized`);
    });
  }

  /**
   * This method must be overridden in the extended class.
   * It is called when the platform is started.
   * Use this method to create the MatterbridgeEndpoints and call this.registerDevice().
   * @param {string} [reason] - The reason for starting.
   * @throws {Error} - Throws an error if the method is not overridden.
   */
  async onStart(reason?: string) {
    this.log.error('Plugins must override onStart.', reason);
    throw new Error('Plugins must override onStart.');
  }

  /**
   * This method can be overridden in the extended class. In this case always call super.onConfigure() to save the select and run checkEndpointNumbers().
   * It is called after the platform has started.
   * Use this method to perform any configuration of your devices and to override the value of the attributes that are persistent and stored in the
   * matter storage (i.e. the onOff attribute of the OnOff cluster).
   */
  async onConfigure() {
    this.log.debug(`Configuring platform ${this.name}`);

    // Save the selectDevice and selectEntity
    await this.saveSelects();

    // Check and update the endpoint numbers
    await this.checkEndpointNumbers();
  }

  /**
   * This method can be overridden in the extended class. In this case always call super.onShutdown() to save the selects, run checkEndpointNumbers() and cleanup memory.
   * It is called when the platform is shutting down.
   * Use this method to clean up any resources you used in the constructor or onStart.
   * @param {string} [reason] - The reason for shutting down.
   */
  async onShutdown(reason?: string) {
    this.log.debug(`Shutting down platform ${this.name}`, reason);

    // Save the selectDevice and selectEntity
    await this.saveSelects();

    // Check and update the endpoint numbers
    await this.checkEndpointNumbers();

    // Cleanup memory
    this.selectDevice.clear();
    this.selectEntity.clear();
    this._registeredEndpoints.clear();
    this._registeredEndpointsByName.clear();
    this._storedDevices.clear();

    // Close the storage
    await this.context?.close();
    this.context = undefined;
    await this.storage?.close();
  }

  /**
   * Called when the logger level is changed.
   * @param {LogLevel} logLevel The new logger level.
   */
  async onChangeLoggerLevel(logLevel: LogLevel) {
    this.log.debug(`The plugin doesn't override onChangeLoggerLevel. Logger level set to: ${logLevel}`);
  }

  /**
   * Called when a plugin config includes an action button or an action button with text field.
   * @param {string} action The action triggered by the button in plugin config.
   * @param {string} value The value of the field of the action button.
   * @param {string} id The id of the schema associated with the action.
   * @param {PlatformConfig} formData The changed form data of the plugin.
   *
   * @remarks
   * This method can be overridden in the extended class.
   *
   * Use this method to handle the action defined in the plugin schema:
   * ```json
   *  "addDevice": {
   *      "description": "Manually add a device that has not been discovered with mdns:",
   *      "type": "boolean",
   *      "buttonText": "ADD",      // The text on the button. This is used when the action doesn't include a text field.
   *      "buttonField": "ADD",     // The text on the button. This is used when the action includes a text field.
   *      "buttonClose": false,     // optional, default is false. When true, the dialog will close after the action is sent.
   *      "buttonSave": false,      // optional, default is false. When true, the dialog will close and trigger the restart required after the action is sent.
   *      "textPlaceholder": "Enter the device IP address",   // optional: the placeholder text for the text field.
   *      "default": false
   *  },
   * ```
   */
  async onAction(action: string, value?: string, id?: string, formData?: PlatformConfig) {
    this.log.debug(`The plugin ${CYAN}${this.name}${db} doesn't override onAction. Received action ${CYAN}${action}${db}${value ? ' with ' + CYAN + value + db : ''} ${id ? ' for schema ' + CYAN + id + db : ''}`, formData);
  }

  /**
   * Called when the plugin config has been updated.
   * @param {PlatformConfig} config The new plugin config.
   */
  async onConfigChanged(config: PlatformConfig) {
    this.log.debug(`The plugin ${CYAN}${config.name}${db} doesn't override onConfigChanged. Received new config.`);
  }

  /**
   * Checks if a device with this name is already registered in the platform.
   * @param {string} deviceName - The device name to check.
   * @returns {boolean} True if the device is already registered, false otherwise.
   */
  hasDeviceName(deviceName: string): boolean {
    return this._registeredEndpointsByName.has(deviceName);
  }

  /**
   * Registers a device with the Matterbridge platform.
   * @param {MatterbridgeEndpoint} device - The device to register.
   */
  async registerDevice(device: MatterbridgeEndpoint) {
    device.plugin = this.name;
    if (device.deviceName && this._registeredEndpointsByName.has(device.deviceName)) {
      this.log.error(`Device with name ${CYAN}${device.deviceName}${er} is already registered. The device will not be added. Please change the device name.`);
      return;
    }
    if (device.deviceName && checkNotLatinCharacters(device.deviceName)) {
      this.log.debug(`Device with name ${CYAN}${device.deviceName}${db} has non latin characters.`);
    }
    await this.matterbridge.addBridgedEndpoint(this.name, device);
    if (device.uniqueId) this._registeredEndpoints.set(device.uniqueId, device);
    if (device.deviceName) this._registeredEndpointsByName.set(device.deviceName, device);
  }

  /**
   * Unregisters a device registered with the Matterbridge platform.
   * @param {MatterbridgeEndpoint} device - The device to unregister.
   */
  async unregisterDevice(device: MatterbridgeEndpoint) {
    await this.matterbridge.removeBridgedEndpoint(this.name, device);
    if (device.uniqueId) this._registeredEndpoints.delete(device.uniqueId);
    if (device.deviceName) this._registeredEndpointsByName.delete(device.deviceName);
  }

  /**
   * Unregisters all devices registered with the Matterbridge platform.
   *
   * @param {number} [delay=0] - The delay in milliseconds between removing each bridged endpoint (default: 0).
   */
  async unregisterAllDevices(delay = 0) {
    await this.matterbridge.removeAllBridgedEndpoints(this.name, delay);
    this._registeredEndpoints.clear();
    this._registeredEndpointsByName.clear();
  }

  /**
   * Saves the select devices and entities to storage.
   *
   * This method saves the current state of `selectDevice` and `selectEntity` maps to their respective storage.
   * It logs the number of items being saved and ensures that the storage is properly closed after saving.
   *
   * @returns {Promise<void>} A promise that resolves when the save operation is complete.
   */
  private async saveSelects(): Promise<void> {
    if (this.storage) {
      this.log.debug(`Saving ${this.selectDevice.size} selectDevice...`);
      const selectDevice = await this.storage.createStorage('selectDevice');
      await selectDevice.set('selectDevice', Array.from(this.selectDevice.values()));
      await selectDevice.close();

      this.log.debug(`Saving ${this.selectEntity.size} selectEntity...`);
      const selectEntity = await this.storage.createStorage('selectEntity');
      await selectEntity.set('selectEntity', Array.from(this.selectEntity.values()));
      await selectEntity.close();
    }
  }

  /**
   * Clears all the select device and entity maps.
   *
   * @returns {void}
   */
  async clearSelect(): Promise<void> {
    this.selectDevice.clear();
    this.selectEntity.clear();
    await this.saveSelects();
  }

  /**
   * Clears the select for a single device.
   *
   * @param {string} serial - The serial of the device to clear.
   * @returns {void}
   */
  async clearDeviceSelect(serial: string): Promise<void> {
    this.selectDevice.delete(serial);
    await this.saveSelects();
  }

  /**
   * Set the select device in the platform map.
   *
   * @param {string} serial - The serial number of the device.
   * @param {string} name - The name of the device.
   * @param {string} [configUrl] - The configuration URL of the device.
   * @param {string} [icon] - The icon of the device: 'wifi', 'ble', 'hub'
   * @param {Array<{ name: string; description: string; icon?: string }>} [entities] - The entities associated with the device.
   * @returns {void}
   */
  setSelectDevice(serial: string, name: string, configUrl?: string, icon?: string, entities?: { name: string; description: string; icon?: string }[]): void {
    const device = this.selectDevice.get(serial);
    if (device) {
      device.serial = serial;
      device.name = name;
      if (configUrl) device.configUrl = configUrl;
      if (icon) device.icon = icon;
      if (entities) device.entities = entities;
    } else {
      this.selectDevice.set(serial, { serial, name, configUrl, icon, entities });
    }
  }

  /**
   * Set the select device entity in the platform map.
   *
   * @param {string} serial - The serial number of the device.
   * @param {string} entityName - The name of the entity.
   * @param {string} entityDescription - The description of the entity.
   * @param {string} [entityIcon] - The icon of the entity: 'wifi', 'ble', 'hub', 'component', 'matter'
   * @returns {void}
   */
  setSelectDeviceEntity(serial: string, entityName: string, entityDescription: string, entityIcon?: string): void {
    const device = this.selectDevice.get(serial);
    if (device) {
      if (!device.entities) device.entities = [];
      if (!device.entities.find((entity) => entity.name === entityName)) device.entities.push({ name: entityName, description: entityDescription, icon: entityIcon });
    }
  }

  /**
   * Retrieves the select devices from the platform map.
   *
   * @returns {{ pluginName: string; serial: string; name: string; configUrl?: string; icon?: string; entities?: { name: string; description: string; icon?: string }[] }[]} The selected devices array.
   */
  getSelectDevices(): { pluginName: string; serial: string; name: string; configUrl?: string; icon?: string; entities?: { name: string; description: string; icon?: string }[] }[] {
    const selectDevices: { pluginName: string; serial: string; name: string; configUrl?: string; icon?: string; entities?: { name: string; description: string; icon?: string }[] }[] = [];
    for (const device of this.selectDevice.values()) {
      selectDevices.push({ pluginName: this.name, ...device });
    }
    return selectDevices;
  }

  /**
   * Set the select entity in the platform map.
   *
   * @param {string} name - The entity name.
   * @param {string} description - The entity description.
   * @param {string} [icon] - The entity icon: 'wifi', 'ble', 'hub', 'component', 'matter'
   * @returns {void}
   */
  setSelectEntity(name: string, description: string, icon?: string): void {
    this.selectEntity.set(name, { name, description, icon });
  }

  /**
   * Retrieve the select entities.
   *
   * @returns {{ pluginName: string; name: string; description: string; icon?: string }[]} The select entities array.
   */
  getSelectEntities(): { pluginName: string; name: string; description: string; icon?: string }[] {
    const selectEntities: { pluginName: string; name: string; description: string; icon?: string }[] = [];
    for (const entity of this.selectEntity.values()) {
      selectEntities.push({ pluginName: this.name, ...entity });
    }
    return selectEntities;
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
   * @deprecated This method is deprecated and will be removed in future versions. Use validateDevice instead.
   */
  validateDeviceWhiteBlackList(device: string | string[], log = true): boolean {
    return this.validateDevice(device, log);
  }

  /**
   * Validates if a device is allowed based on the whitelist and blacklist configurations.
   * The blacklist has priority over the whitelist.
   *
   * @param {string | string[]} device - The device name(s) to validate.
   * @param {boolean} [log=true] - Whether to log the validation result.
   * @returns {boolean} - Returns true if the device is allowed, false otherwise.
   *
   */
  validateDevice(device: string | string[], log = true): boolean {
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
   * @deprecated This method is deprecated and will be removed in future versions. Use validateEntity instead.
   */
  validateEntityBlackList(device: string, entity: string, log = true): boolean {
    return this.validateEntity(device, entity, log);
  }

  /**
   * Validates if an entity is allowed based on the entity blacklist and device-entity blacklist configurations.
   *
   * @param {string} device - The device to which the entity belongs.
   * @param {string} entity - The entity to validate.
   * @param {boolean} [log=true] - Whether to log the validation result.
   * @returns {boolean} - Returns true if the entity is allowed, false otherwise.
   *
   */
  validateEntity(device: string, entity: string, log = true): boolean {
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

  /**
   * Checks and updates the endpoint numbers for Matterbridge devices.
   *
   * This method retrieves the list of Matterbridge devices and their child endpoints,
   * compares their current endpoint numbers with the stored ones, and updates the storage
   * if there are any changes. It logs the changes and updates the endpoint numbers accordingly.
   *
   * @returns {Promise<number>} The size of the updated endpoint map, or -1 if storage is not available.
   */
  async checkEndpointNumbers(): Promise<number> {
    if (!this.storage) return -1;
    this.log.debug('Checking endpoint numbers...');
    const context = await this.storage.createStorage('endpointNumbers');
    const separator = '|.|';
    const endpointMap = new Map<string, EndpointNumber>(await context.get<[string, EndpointNumber][]>('endpointMap', []));

    for (const device of this.matterbridge.getDevices().filter((d) => d.plugin === this.name)) {
      if (device.uniqueId === undefined || device.maybeNumber === undefined) {
        this.log.debug(`Not checking device ${device.deviceName} without uniqueId or maybeNumber`);
        continue;
      }
      if (endpointMap.has(device.uniqueId) && endpointMap.get(device.uniqueId) !== device.maybeNumber) {
        this.log.warn(`Endpoint number for device ${CYAN}${device.deviceName}${wr} changed from ${CYAN}${endpointMap.get(device.uniqueId)}${wr} to ${CYAN}${device.maybeNumber}${wr}`);
        endpointMap.set(device.uniqueId, device.maybeNumber);
      }
      if (!endpointMap.has(device.uniqueId)) {
        this.log.debug(`Setting endpoint number for device ${CYAN}${device.uniqueId}${db} to ${CYAN}${device.maybeNumber}${db}`);
        endpointMap.set(device.uniqueId, device.maybeNumber);
      }
      for (const child of device.getChildEndpoints() as MatterbridgeEndpoint[]) {
        if (!child.maybeId || !child.maybeNumber) continue;
        if (endpointMap.has(device.uniqueId + separator + child.id) && endpointMap.get(device.uniqueId + separator + child.id) !== child.maybeNumber) {
          this.log.warn(`Child endpoint number for device ${CYAN}${device.deviceName}${wr}.${CYAN}${child.id}${wr} changed from ${CYAN}${endpointMap.get(device.uniqueId + separator + child.id)}${wr} to ${CYAN}${child.maybeNumber}${wr}`);
          endpointMap.set(device.uniqueId + separator + child.id, child.maybeNumber);
        }
        if (!endpointMap.has(device.uniqueId + separator + child.id)) {
          this.log.debug(`Setting child endpoint number for device ${CYAN}${device.uniqueId}${db}.${CYAN}${child.id}${db} to ${CYAN}${child.maybeNumber}${db}`);
          endpointMap.set(device.uniqueId + separator + child.id, child.maybeNumber);
        }
      }
    }
    this.log.debug('Saving endpointNumbers...');
    await context.set('endpointMap', Array.from(endpointMap.entries()));
    await context.close();
    this.log.debug('Endpoint numbers check completed.');
    return endpointMap.size;
  }
}
