/**
 * This file contains the class MatterbridgePlatform.
 *
 * @file matterbridgePlatform.ts
 * @author Luca Liguori
 * @created 2024-03-21
 * @version 1.6.1
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

// eslint-disable-next-line no-console
if (process.argv.includes('--loader') || process.argv.includes('-loader')) console.log('\u001B[32mMatterbridgePlatform loaded.\u001B[40;0m');

// Node.js modules
import path from 'node:path';

// Node AnsiLogger module
import { AnsiLogger, CYAN, db, er, LogLevel, nf, wr } from 'node-ansi-logger';
// Node Storage module
import { NodeStorage, NodeStorageManager } from 'node-persist-manager';
// Matter
import { EndpointNumber, VendorId } from '@matter/types/datatype';
import { Descriptor } from '@matter/types/clusters/descriptor';
import { BridgedDeviceBasicInformation } from '@matter/types/clusters/bridged-device-basic-information';
// Matterbridge
import { hasParameter, isValidArray, isValidObject, isValidString } from '@matterbridge/utils';

import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { checkNotLatinCharacters } from './matterbridgeEndpointHelpers.js';
import { bridgedNode } from './matterbridgeDeviceTypes.js';
import { ApiSelectDevice, ApiSelectEntity } from './frontendTypes.js';
import { SystemInformation } from './matterbridgeTypes.js';
import { BroadcastServer } from './broadcastServer.js';

// Platform types

/** Platform configuration value type. */
export type PlatformConfigValue = string | number | boolean | bigint | object | undefined | null;

/** Platform configuration type. */
export type PlatformConfig = { name: string; type: string; version: string; debug: boolean; unregisterOnShutdown: boolean } & Record<string, PlatformConfigValue>;

/** Platform schema value type. */
export type PlatformSchemaValue = string | number | boolean | bigint | object | undefined | null;

/** Platform schema type. */
export type PlatformSchema = Record<string, PlatformSchemaValue>;

/** A type representing a subset of readonly properties of Matterbridge for platform use. */
export type PlatformMatterbridge = {
  readonly systemInformation: Readonly<
    Pick<
      SystemInformation,
      | 'interfaceName'
      | 'macAddress'
      | 'ipv4Address'
      | 'ipv6Address'
      | 'nodeVersion'
      | 'hostname'
      | 'user'
      | 'osType'
      | 'osRelease'
      | 'osPlatform'
      | 'osArch'
      | 'totalMemory'
      | 'freeMemory'
      | 'systemUptime'
      | 'processUptime'
      | 'cpuUsage'
      | 'processCpuUsage'
      | 'rss'
      | 'heapTotal'
      | 'heapUsed'
    >
  >;
  readonly rootDirectory: string;
  readonly homeDirectory: string;
  readonly matterbridgeDirectory: string;
  readonly matterbridgePluginDirectory: string;
  readonly matterbridgeCertDirectory: string;
  readonly globalModulesDirectory: string;
  readonly matterbridgeVersion: string;
  readonly matterbridgeLatestVersion: string;
  readonly matterbridgeDevVersion: string;
  readonly frontendVersion: string;
  readonly bridgeMode: 'bridge' | 'childbridge' | 'controller' | '';
  readonly restartMode: 'service' | 'docker' | '';
  readonly virtualMode: 'disabled' | 'outlet' | 'light' | 'switch' | 'mounted_switch';
  readonly aggregatorVendorId: VendorId;
  readonly aggregatorVendorName: string;
  readonly aggregatorProductId: number;
  readonly aggregatorProductName: string;
};

/**
 * Represents the base Matterbridge platform. It is extended by the MatterbridgeAccessoryPlatform and MatterbridgeServicePlatform classes.
 *
 */
export class MatterbridgePlatform {
  /** The PlatformMatterbridge instance of this Platform. */
  readonly matterbridge: PlatformMatterbridge;
  /** The logger instance for this platform. Created by the PluginManager.load() method. */
  readonly log: AnsiLogger;
  /** The configuration for this platform. Set by the PluginManager.load() method using the stored config file. */
  config: PlatformConfig;
  /** The name of the platform. Set by the PluginManager.load() method using the package.json name value. */
  name = '';
  /** The type of the platform. Set by the extending classes: MatterbridgeDynamicPlatform and MatterbridgeAccessoryPlatform */
  type: 'DynamicPlatform' | 'AccessoryPlatform' | 'AnyPlatform' = 'AnyPlatform';
  /** The version of the platform. Set by the PluginManager.load() method using the package.json version value. */
  version = '1.0.0';

  /** Platform node storage manager created in the matterbridgeDirectory with the plugin name. */
  readonly #storage: NodeStorageManager;
  /** Platform context in the storage of matterbridgeDirectory. Use await platform.ready to access it early. */
  context?: NodeStorage;

  /** Indicates whether the platform is is fully initialized (including context and selects). */
  isReady = false;
  /** Indicates whether the platform has been loaded. */
  isLoaded = false;
  /** Indicates whether the platform has been started. */
  isStarted = false;
  /** Indicates whether the platform has been configured. */
  isConfigured = false;
  /** Indicates whether the platform is shutting down. */
  isShuttingDown = false;

  // Device and entity select in the plugin config UI
  readonly #selectDevices = new Map<string, { serial: string; name: string; configUrl?: string; icon?: string; entities?: { name: string; description: string; icon?: string }[] }>();
  readonly #selectEntities = new Map<string, { name: string; description: string; icon?: string }>();

  // Promises for platform initialization. They are grouped in MatterbridgePlatform.ready with Promise.all.
  readonly #contextReady: Promise<void>;
  readonly #selectDeviceContextReady: Promise<void>;
  readonly #selectEntityContextReady: Promise<void>;
  /** The ready promise for the platform, which resolves when the platform is fully initialized (including context and selects). Await platform.ready if you access the platform context or select early. */
  readonly ready: Promise<void>;

  /** Registered MatterbridgeEndpoint map keyed by uniqueId */
  readonly #registeredEndpoints = new Map<string, MatterbridgeEndpoint>();

  /** Broadcast server */
  readonly #server: BroadcastServer;
  readonly #debug = hasParameter('debug') || hasParameter('verbose');
  readonly #verbose = hasParameter('verbose');

  /** MatterNode helper injected by the PluginManager.load() method */
  #addBridgedEndpoint: ((pluginName: string, device: MatterbridgeEndpoint) => Promise<void>) | undefined;
  /** MatterNode helper injected by the PluginManager.load() method */
  #removeBridgedEndpoint: ((pluginName: string, device: MatterbridgeEndpoint) => Promise<void>) | undefined;
  /** MatterNode helper injected by the PluginManager.load() method */
  #removeAllBridgedEndpoints: ((pluginName: string, delay?: number) => Promise<void>) | undefined;
  /** MatterNode helper injected by the PluginManager.load() method */
  #addVirtualEndpoint: ((pluginName: string, name: string, type: 'light' | 'outlet' | 'switch' | 'mounted_switch', callback: () => Promise<void>) => Promise<boolean>) | undefined;

  /**
   * MatterNode helpers injected by the PluginManager.load() method
   *
   * @param {(pluginName: string, device: MatterbridgeEndpoint) => Promise<void>} addBridgedEndpoint - Function to add a bridged endpoint.
   * @param {(pluginName: string, device: MatterbridgeEndpoint) => Promise<void>} removeBridgedEndpoint - Function to remove a bridged endpoint.
   * @param {(pluginName: string, delay?: number) => Promise<void>} removeAllBridgedEndpoints - Function to remove all bridged endpoints.
   * @param {(pluginName: string, name: string, type: 'light' | 'outlet' | 'switch' | 'mounted_switch', callback: () => Promise<void>) => Promise<boolean>} addVirtualEndpoint - Function to add a virtual endpoint.
   */
  private setMatterNode:
    | ((
        addBridgedEndpoint: (pluginName: string, device: MatterbridgeEndpoint) => Promise<void>,
        removeBridgedEndpoint: (pluginName: string, device: MatterbridgeEndpoint) => Promise<void>,
        removeAllBridgedEndpoints: (pluginName: string, delay?: number) => Promise<void>,
        addVirtualEndpoint: (pluginName: string, name: string, type: 'light' | 'outlet' | 'switch' | 'mounted_switch', callback: () => Promise<void>) => Promise<boolean>,
      ) => void)
    | undefined = (
    addBridgedEndpoint: (pluginName: string, device: MatterbridgeEndpoint) => Promise<void>,
    removeBridgedEndpoint: (pluginName: string, device: MatterbridgeEndpoint) => Promise<void>,
    removeAllBridgedEndpoints: (pluginName: string, delay?: number) => Promise<void>,
    addVirtualEndpoint: (pluginName: string, name: string, type: 'light' | 'outlet' | 'switch' | 'mounted_switch', callback: () => Promise<void>) => Promise<boolean>,
  ) => {
    this.#addBridgedEndpoint = addBridgedEndpoint;
    this.#removeBridgedEndpoint = removeBridgedEndpoint;
    this.#removeAllBridgedEndpoints = removeAllBridgedEndpoints;
    this.#addVirtualEndpoint = addVirtualEndpoint;
    this.setMatterNode = undefined;
  };

  /**
   * Creates an instance of the base MatterbridgePlatform.
   * Each plugin must extend the MatterbridgeDynamicPlatform or MatterbridgeAccessoryPlatform class.
   * MatterbridgePlatform cannot be instantiated directly, it can only be extended by the MatterbridgeDynamicPlatform or MatterbridgeAccessoryPlatform class.
   *
   * @param {PlatformMatterbridge} matterbridge - The PlatformMatterbridge instance.
   * @param {AnsiLogger} log - The logger instance.
   * @param {PlatformConfig} config - The platform configuration.
   */
  protected constructor(matterbridge: PlatformMatterbridge, log: AnsiLogger, config: PlatformConfig) {
    this.matterbridge = matterbridge;
    this.log = log;
    this.config = config;
    this.#server = new BroadcastServer('platform', this.log);

    if (this.#debug && !this.#verbose) this.log.debug(`Creating MatterbridgePlatform for plugin ${this.config.name}`);
    if (this.#verbose) this.log.debug(`Creating MatterbridgePlatform for plugin ${this.config.name} with config:\n${JSON.stringify(this.config, null, 2)}\n`);

    // create the NodeStorageManager for the plugin platform
    if (!isValidString(this.config.name, 1)) {
      this.#server.close();
      throw new Error('Platform: the plugin name is missing or invalid.');
    }
    this.log.debug(`Creating storage for plugin ${this.config.name} in ${path.join(this.matterbridge.matterbridgeDirectory, this.config.name)}`);
    this.#storage = new NodeStorageManager({
      dir: path.join(this.matterbridge.matterbridgeDirectory, this.config.name),
      writeQueue: false,
      expiredInterval: undefined,
      logging: false,
      forgiveParseErrors: true,
    });

    // create the context storage for the plugin platform
    this.log.debug(`Creating context for plugin ${this.config.name}`);
    this.#contextReady = this.#storage.createStorage('context').then((context) => {
      this.context = context;
      this.log.debug(`Created context for plugin ${this.config.name}`);
      return;
    });

    // create the selectDevice storage for the plugin platform
    this.log.debug(`Loading selectDevice for plugin ${this.config.name}`);
    this.#selectDeviceContextReady = this.#storage.createStorage('selectDevice').then(async (context) => {
      const selectDevice = await context.get<{ serial: string; name: string; icon?: string; entities?: { name: string; description: string; icon?: string }[] }[]>('selectDevice', []);
      for (const device of selectDevice) this.#selectDevices.set(device.serial, device);
      this.log.debug(`Loaded ${this.#selectDevices.size} selectDevice for plugin ${this.config.name}`);
      return;
    });

    // create the selectEntity storage for the plugin platform
    this.log.debug(`Loading selectEntity for plugin ${this.config.name}`);
    this.#selectEntityContextReady = this.#storage.createStorage('selectEntity').then(async (context) => {
      const selectEntity = await context.get<{ name: string; description: string; icon?: string }[]>('selectEntity', []);
      for (const entity of selectEntity) this.#selectEntities.set(entity.name, entity);
      this.log.debug(`Loaded ${this.#selectEntities.size} selectEntity for plugin ${this.config.name}`);
      return;
    });

    // Create the `ready` promise for the platform
    this.ready = Promise.all([this.#contextReady, this.#selectDeviceContextReady, this.#selectEntityContextReady]).then(() => {
      this.log.debug(`MatterbridgePlatform for plugin ${this.config.name} is fully initialized`);
      this.isReady = true;
      return;
    });
  }

  /**
   * Destroys the platform, cleaning up memory, closing storage and broadcast server.
   */
  private async destroy() {
    if (this.#verbose) this.log.debug(`Destroying MatterbridgePlatform for plugin ${this.config.name}`);

    // Cleanup memory
    this.#selectDevices.clear();
    this.#selectEntities.clear();
    this.#registeredEndpoints.clear();

    // Close the storage
    await this.context?.close();
    this.context = undefined;
    await this.#storage?.close();

    // Close the broadcast server
    this.#server.close();

    if (this.#verbose) this.log.debug(`Destroyed MatterbridgePlatform for plugin ${this.config.name}`);
    this.isReady = false;
  }

  /**
   * This method shall be overridden in the extended class.
   * It is called when the platform is started.
   * Use this method to create the MatterbridgeEndpoints and call this.registerDevice().
   *
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
   *
   * @param {string} [reason] - The reason for shutting down.
   */
  async onShutdown(reason?: string) {
    this.log.debug(`Shutting down platform ${this.name}`, reason);

    // Save the selectDevice and selectEntity
    await this.saveSelects();

    // Check and update the endpoint numbers
    await this.checkEndpointNumbers();

    // Cleanup memory and close storage and broadcast server
    await this.destroy();
  }

  /**
   * Called when the logger level is changed.
   *
   * @param {LogLevel} logLevel The new logger level.
   */
  async onChangeLoggerLevel(logLevel: LogLevel) {
    this.log.debug(`The plugin doesn't override onChangeLoggerLevel. Logger level set to: ${logLevel}`);
  }

  /**
   * Called when a plugin config includes an action button or an action button with text field.
   *
   * @param {string} action The action triggered by the button in plugin config.
   * @param {string} value The value of the field of the action button.
   * @param {string} id The id of the schema associated with the action.
   * @param {PlatformConfig} formData The changed form data of the plugin.
   *
   * @remarks
   * This method can be overridden in the extended class.
   *
   * @example
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
   *
   * @param {PlatformConfig} config The new plugin config.
   */
  async onConfigChanged(config: PlatformConfig) {
    this.log.debug(`The plugin ${CYAN}${config.name}${db} doesn't override onConfigChanged. Received new config.`);
  }

  /**
   * Save the platform configuration to the platform config JSON.
   *
   * @param {PlatformConfig} [config] - The platform configuration to save.
   * @returns {void}
   */
  saveConfig(config: PlatformConfig): void {
    this.#server.request({ type: 'plugins_saveconfigfromjson', src: 'platform', dst: 'plugins', params: { name: this.name, config } });
  }

  /**
   * Get the platform schema for the config editor. This will retrieve the schema from the Matterbridge plugin manager.
   *
   * @returns {Promise<PlatformSchema | undefined>} The platform schema.
   */
  async getSchema(): Promise<PlatformSchema | undefined> {
    return (await this.#server.fetch({ type: 'plugins_getschema', src: 'platform', dst: 'plugins', params: { name: this.name } })).result.schema;
  }

  /**
   * Set the platform schema for the config editor. This will update the schema in the Matterbridge plugin manager but will not change the schema file.
   * It must be called from onStart() to update the schema in the plugin.
   * Calling this method from the platform constructor will have no effect.
   *
   * @param {PlatformSchema} [schema] - The platform schema to set.
   * @returns {void}
   */
  setSchema(schema: PlatformSchema): void {
    this.#server.request({ type: 'plugins_setschema', src: 'platform', dst: 'plugins', params: { name: this.name, schema } });
  }

  /**
   * Sends a restart required message to the frontend.
   *
   * @param {boolean} [snackbar] - If true, shows a snackbar notification. Default is true.
   * @param {boolean} [fixed] - If true, shows a fixed notification. Default is false.
   * @returns {void}
   */
  wssSendRestartRequired(snackbar: boolean = true, fixed: boolean = false): void {
    this.#server.request({ type: 'frontend_restartrequired', src: 'platform', dst: 'frontend', params: { snackbar, fixed } });
  }

  /**
   * Sends an open snackbar message to all connected clients.
   *
   * @param {string} message - The message to send.
   * @param {number} timeout - The timeout in seconds for the snackbar message. Default is 5 seconds.
   * @param {'info' | 'warning' | 'error' | 'success'} severity - The severity of the message.
   * possible values are: 'info', 'warning', 'error', 'success'. Default is 'info'.
   *
   * @remarks
   * If timeout is 0, the snackbar message will be displayed until closed by the user.
   */
  wssSendSnackbarMessage(message: string, timeout?: number, severity?: 'error' | 'success' | 'info' | 'warning'): void {
    this.#server.request({ type: 'frontend_snackbarmessage', src: 'platform', dst: 'frontend', params: { message, timeout, severity } });
  }

  /**
   * Retrieves the number of devices registered with the platform.
   *
   * @returns {number} The number of registered devices.
   */
  size(): number {
    return this.#registeredEndpoints.size;
  }

  /**
   * Retrieves the devices registered with the platform.
   *
   * @returns {MatterbridgeEndpoint[]} The registered devices.
   */
  getDevices(): MatterbridgeEndpoint[] {
    return Array.from(this.#registeredEndpoints.values());
  }

  /**
   * Retrieves a registered device by its name.
   *
   * @param {string} deviceName - The device name to search for.
   * @returns {MatterbridgeEndpoint | undefined} The registered device or undefined if not found.
   */
  getDeviceByName(deviceName: string): MatterbridgeEndpoint | undefined {
    return Array.from(this.#registeredEndpoints.values()).find((device) => device.deviceName === deviceName);
  }

  /**
   * Retrieves a registered device by its uniqueId.
   *
   * @param {string} uniqueId - The device unique ID to search for.
   * @returns {MatterbridgeEndpoint | undefined} The registered device or undefined if not found.
   */
  getDeviceByUniqueId(uniqueId: string): MatterbridgeEndpoint | undefined {
    return Array.from(this.#registeredEndpoints.values()).find((device) => device.uniqueId === uniqueId);
  }

  /**
   * Retrieves a registered device by its serialNumber.
   *
   * @param {string} serialNumber - The device serial number to search for.
   * @returns {MatterbridgeEndpoint | undefined} The registered device or undefined if not found.
   */
  getDeviceBySerialNumber(serialNumber: string): MatterbridgeEndpoint | undefined {
    return Array.from(this.#registeredEndpoints.values()).find((device) => device.serialNumber === serialNumber);
  }

  /**
   * Retrieves a registered device by its id.
   *
   * @param {string} id - The device id to search for.
   * @returns {MatterbridgeEndpoint | undefined} The registered device or undefined if not found.
   */
  getDeviceById(id: string): MatterbridgeEndpoint | undefined {
    return Array.from(this.#registeredEndpoints.values()).find((device) => device.maybeId === id);
  }

  /**
   * Retrieves a registered device by its originalId.
   *
   * @param {string} originalId - The device originalId to search for.
   * @returns {MatterbridgeEndpoint | undefined} The registered device or undefined if not found.
   */
  getDeviceByOriginalId(originalId: string): MatterbridgeEndpoint | undefined {
    return Array.from(this.#registeredEndpoints.values()).find((device) => device.originalId === originalId);
  }

  /**
   * Retrieves a registered device by its number.
   *
   * @param {EndpointNumber | number} number - The device number to search for.
   * @returns {MatterbridgeEndpoint | undefined} The registered device or undefined if not found.
   */
  getDeviceByNumber(number: EndpointNumber | number): MatterbridgeEndpoint | undefined {
    return Array.from(this.#registeredEndpoints.values()).find((device) => device.maybeNumber === number);
  }

  /**
   * Checks if a device with this name is already registered in the platform.
   *
   * @param {string} deviceName - The device name to check.
   * @returns {boolean} True if the device is already registered, false otherwise.
   */
  hasDeviceName(deviceName: string): boolean {
    return Array.from(this.#registeredEndpoints.values()).find((device) => device.deviceName === deviceName) !== undefined;
    // return this.registeredEndpointsByName.has(deviceName);
  }

  /**
   * Checks if a device with this uniqueId is already registered in the platform.
   *
   * @param {string} deviceUniqueId - The device unique ID to check.
   * @returns {boolean} True if the device is already registered, false otherwise.
   */
  hasDeviceUniqueId(deviceUniqueId: string): boolean {
    return this.#registeredEndpoints.has(deviceUniqueId);
  }

  /**
   * Registers a virtual device with the Matterbridge platform.
   * Virtual devices are only supported in bridge mode and childbridge mode with a DynamicPlatform.
   *
   * The virtual device is created as an instance of `Endpoint` with the provided device type.
   * When the virtual device is turned on, the provided callback function is executed.
   * The onOff state of the virtual device always reverts to false when the device is turned on.
   *
   * @param { string } name - The name of the virtual device.
   * @param { 'light' | 'outlet' | 'switch' | 'mounted_switch' } type - The type of the virtual device.
   * @param { () => Promise<void> } callback - The callback to call when the virtual device is turned on.
   *
   * @returns {Promise<boolean>} A promise that resolves to true if the virtual device was successfully registered, false otherwise.
   *
   * @remarks
   * The virtual devices don't show up in the device list of the frontend.
   * Type 'switch' is not supported by Alexa and 'mounted_switch' is not supported by Apple Home.
   */
  async registerVirtualDevice(name: string, type: 'light' | 'outlet' | 'switch' | 'mounted_switch', callback: () => Promise<void>): Promise<boolean> {
    return (await this.#addVirtualEndpoint?.(this.name, name, type, callback)) ?? false;
  }

  /**
   * Registers a device with the Matterbridge platform and performs validation checks.
   *
   * This method also checks if the implementation called createDefaultBasicInformationClusterServer() instead of createDefaultBridgedDeviceBasicInformationClusterServer().
   *
   * This is correct with Accessory platforms so we check if we are running in bridge mode and add the bridgedNode and the BridgedDeviceBasicInformation cluster.
   *
   * If we are in bridge mode, we add the bridgedNode device type and the BridgedDeviceBasicInformation cluster.
   *
   * If we are in childbridge mode and the plugin is a 'DynamicPlatform', we add the bridgedNode device type and the BridgedDeviceBasicInformation cluster.
   *
   * if we are in childbridge mode and the plugin is a 'AccessoryPlatform', the device is not bridged so no action is taken.
   *
   * If the device.mode = 'server', the device is not bridged so no action is taken.
   *
   * If the device.mode = 'matter', the device is not bridged so no action is taken.
   *
   * @param {MatterbridgeEndpoint} device - The device to register.
   */
  async registerDevice(device: MatterbridgeEndpoint) {
    device.plugin = this.name;
    if (!device.uniqueId) {
      this.log.error(
        `Device with name ${CYAN}${device.deviceName}${er} has no uniqueId. Did you forget to call createDefaultBasicInformationClusterServer() or createDefaultBridgedDeviceBasicInformationClusterServer()? The device will not be added.`,
      );
      return;
    }
    if (!device.deviceName) {
      this.log.error(`Device with uniqueId ${CYAN}${device.uniqueId}${er} has no deviceName. The device will not be added.`);
      return;
    }
    if (!device.serialNumber) {
      this.log.error(`Device with uniqueId ${CYAN}${device.uniqueId}${er} has no serialNumber. The device will not be added.`);
      return;
    }
    if (this.hasDeviceName(device.deviceName)) {
      this.log.error(`Device with name ${CYAN}${device.deviceName}${er} is already registered. The device will not be added. Please change the device name.`);
      return;
    }
    if (checkNotLatinCharacters(device.deviceName)) {
      this.log.debug(`Device with name ${CYAN}${device.deviceName}${db} has non latin characters.`);
    }

    // Validate bridgedNode and BridgedDeviceBasicInformation cluster
    if (device.mode === undefined && (this.matterbridge.bridgeMode === 'bridge' || (this.matterbridge.bridgeMode === 'childbridge' && this.type === 'DynamicPlatform'))) {
      // If the device is a bridged device, we add the bridgedNode to the deviceTypes map and to the Descriptor Cluster options
      if (!device.deviceTypes.has(bridgedNode.code)) {
        this.log.debug(`Device with name ${CYAN}${device.deviceName}${db} has no bridgedNode device type. Adding it...`);
        device.deviceTypes.set(bridgedNode.code, bridgedNode);
        const options = device.getClusterServerOptions(Descriptor.Cluster.id);
        if (options) {
          const deviceTypeList = options.deviceTypeList as { deviceType: number; revision: number }[];
          if (!deviceTypeList.find((dt) => dt.deviceType === bridgedNode.code)) {
            deviceTypeList.push({ deviceType: bridgedNode.code, revision: bridgedNode.revision });
          }
        }
      }

      // If the device is a bridged device, we add the BridgedDeviceBasicInformation cluster
      if (!device.hasClusterServer(BridgedDeviceBasicInformation.Cluster.id)) {
        this.log.debug(`Device with name ${CYAN}${device.deviceName}${db} has no BridgedDeviceBasicInformation cluster. Adding it...`);
        device.createDefaultBridgedDeviceBasicInformationClusterServer(
          device.deviceName,
          device.serialNumber,
          device.vendorId,
          device.vendorName,
          device.productName,
          device.softwareVersion,
          device.softwareVersionString,
          device.hardwareVersion,
          device.hardwareVersionString,
        );
      }
    }

    await this.#addBridgedEndpoint?.(this.name, device);
    this.#registeredEndpoints.set(device.uniqueId, device);
  }

  /**
   * Unregisters a device registered with the Matterbridge platform.
   *
   * @param {MatterbridgeEndpoint} device - The device to unregister.
   */
  async unregisterDevice(device: MatterbridgeEndpoint) {
    await this.#removeBridgedEndpoint?.(this.name, device);
    if (device.uniqueId) this.#registeredEndpoints.delete(device.uniqueId);
  }

  /**
   * Unregisters all devices registered with the Matterbridge platform.
   *
   * @param {number} [delay] - The delay in milliseconds between removing each bridged endpoint (default: 0).
   */
  async unregisterAllDevices(delay: number = 0) {
    await this.#removeAllBridgedEndpoints?.(this.name, delay);
    this.#registeredEndpoints.clear();
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
    if (this.#storage) {
      this.log.debug(`Saving ${this.#selectDevices.size} selectDevice...`);
      const selectDevice = await this.#storage.createStorage('selectDevice');
      await selectDevice.set('selectDevice', Array.from(this.#selectDevices.values()));
      await selectDevice.close();

      this.log.debug(`Saving ${this.#selectEntities.size} selectEntity...`);
      const selectEntity = await this.#storage.createStorage('selectEntity');
      await selectEntity.set('selectEntity', Array.from(this.#selectEntities.values()));
      await selectEntity.close();
    }
  }

  /**
   * Clears all the select device and entity maps and saves the changes to the storage.
   *
   * @returns {void}
   */
  async clearSelect(): Promise<void> {
    this.#selectDevices.clear();
    this.#selectEntities.clear();
    await this.saveSelects();
  }

  /**
   * Clears the select for a single device and saves the changes to the storage.
   *
   * @param {string} serial - The serial of the device to clear.
   * @returns {void}
   */
  async clearDeviceSelect(serial: string): Promise<void> {
    this.#selectDevices.delete(serial);
    await this.saveSelects();
  }

  /**
   * Clears the select for a single entity and saves the changes to the storage.
   *
   * @param {string} name - The name of the entity to clear.
   * @returns {void}
   */
  async clearEntitySelect(name: string): Promise<void> {
    this.#selectEntities.delete(name);
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
   *
   * @remarks
   * In the schema use selectFrom: 'serial' or 'name'
   * ```json
   * "whiteList": {
   *   "description": "Only the devices in the list will be exposed.",
   *   "type": "array",
   *   "items": {
   *     "type": "string"
   *   },
   *   "uniqueItems": true,
   *   "selectFrom": "name"
   * },
   * ```
   */
  setSelectDevice(serial: string, name: string, configUrl?: string, icon?: string, entities?: { name: string; description: string; icon?: string }[]): void {
    const device = this.#selectDevices.get(serial);
    if (device) {
      device.serial = serial;
      device.name = name;
      if (configUrl) device.configUrl = configUrl;
      if (icon) device.icon = icon;
      if (entities) device.entities = entities;
    } else {
      this.#selectDevices.set(serial, { serial, name, configUrl, icon, entities });
    }
  }

  /**
   * Retrieve a select device by serial.
   *
   * @param {string} serial - The serial number of the device.
   * @returns {{ serial: string; name: string; configUrl?: string; icon?: string; entities?: { name: string; description: string; icon?: string }[] } | undefined} The select device or undefined if not found.
   */
  getSelectDevice(serial: string): { serial: string; name: string; configUrl?: string; icon?: string; entities?: { name: string; description: string; icon?: string }[] } | undefined {
    return this.#selectDevices.get(serial);
  }

  /**
   * Set the select device entity in the platform map.
   *
   * @param {string} serial - The serial number of the device.
   * @param {string} entityName - The name of the entity.
   * @param {string} entityDescription - The description of the entity.
   * @param {string} [entityIcon] - The icon of the entity: 'wifi', 'ble', 'hub', 'component', 'matter'
   * @returns {void}
   *
   * @remarks
   * In the schema use selectDeviceEntityFrom: 'name' or 'description'
   * ```json
   * "deviceEntityBlackList": {
   *   "description": "List of entities not to be exposed for a single device.",
   *   "type": "object",
   *   "uniqueItems": true,
   *   "selectFrom": "name",
   *   "additionalProperties": {
   *     "description": "List of entities not to be exposed for this device.",
   *     "type": "array",
   *     "items": {
   *       "type": "string"
   *     },
   *     "uniqueItems": true,
   *     "selectDeviceEntityFrom": "name"
   *   }
   * },
   * ```
   */
  setSelectDeviceEntity(serial: string, entityName: string, entityDescription: string, entityIcon?: string): void {
    const device = this.#selectDevices.get(serial);
    if (device) {
      if (!device.entities) device.entities = [];
      if (!device.entities.find((entity) => entity.name === entityName)) device.entities.push({ name: entityName, description: entityDescription, icon: entityIcon });
    }
  }

  /**
   * Retrieves the select devices from the platform map.
   *
   * @returns {ApiSelectDevice[]} The selected devices array.
   */
  getSelectDevices(): ApiSelectDevice[] {
    const selectDevices: ApiSelectDevice[] = [];
    for (const device of this.#selectDevices.values()) {
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
   *
   * @remarks
   * In the schema use selectEntityFrom: 'name' or 'description'
   * ```json
   * "entityBlackList": {
   *   "description": "The entities in the list will not be exposed.",
   *   "type": "array",
   *   "items": {
   *     "type": "string"
   *   },
   *   "uniqueItems": true,
   *   "selectEntityFrom": "name"
   * },
   * ```
   */
  setSelectEntity(name: string, description: string, icon?: string): void {
    this.#selectEntities.set(name, { name, description, icon });
  }

  /**
   * Retrieve a select entity by name.
   *
   * @param {string} name - The name of the entity.
   * @returns {{ name: string; description: string; icon?: string } | undefined} The select entity or undefined if not found.
   */
  getSelectEntity(name: string):
    | {
        name: string;
        description: string;
        icon?: string | undefined;
      }
    | undefined {
    return this.#selectEntities.get(name);
  }

  /**
   * Retrieve the select entities.
   *
   * @returns {ApiSelectEntity[]} The select entities array.
   */
  getSelectEntities(): ApiSelectEntity[] {
    const selectEntities: ApiSelectEntity[] = [];
    for (const entity of this.#selectEntities.values()) {
      selectEntities.push({ pluginName: this.name, ...entity });
    }
    return selectEntities;
  }

  /**
   * Verifies if the Matterbridge version meets the required version.
   * If not, it destroys the platform cause the implementation may not call destroy().
   *
   * @param {string} requiredVersion - The required version to compare against.
   * @param {boolean} [destroy] - Whether to destroy the platform if the version check fails. Default is true.
   * @returns {boolean} True if the Matterbridge version meets or exceeds the required version, false otherwise.
   */
  verifyMatterbridgeVersion(requiredVersion: string, destroy: boolean = true): boolean {
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

    if (!compareVersions(this.matterbridge.matterbridgeVersion, requiredVersion)) {
      if (destroy) this.destroy();
      return false;
    }
    return true;
  }

  /**
   * Validates if a device is allowed based on the whitelist and blacklist configurations.
   * The blacklist has priority over the whitelist.
   *
   * @param {string | string[]} device - The device name(s) to validate.
   * @param {boolean} [log] - Whether to log the validation result.
   * @returns {boolean} - Returns true if the device is allowed, false otherwise.
   */
  validateDevice(device: string | string[], log: boolean = true): boolean {
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
   * Validates if an entity is allowed based on the entity blacklist and device-entity blacklist configurations.
   *
   * @param {string} device - The device to which the entity belongs.
   * @param {string} entity - The entity to validate.
   * @param {boolean} [log] - Whether to log the validation result.
   * @returns {boolean} - Returns true if the entity is allowed, false otherwise.
   */
  validateEntity(device: string, entity: string, log: boolean = true): boolean {
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
   * Clears all stored endpoint numbers for checkEndpointNumbers().
   *
   * @returns {Promise<void>} A promise that resolves when the endpoint numbers have been cleared.
   */
  private async clearEndpointNumbers(): Promise<void> {
    const context = await this.#storage.createStorage('endpointNumbers');
    await context.set('endpointMap', []);
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
  private async checkEndpointNumbers(): Promise<number> {
    this.log.debug('Checking endpoint numbers...');
    const context = await this.#storage.createStorage('endpointNumbers');
    const separator = '|.|';
    const endpointMap = new Map<string, EndpointNumber>(await context.get<[string, EndpointNumber][]>('endpointMap', []));

    for (const device of this.getDevices()) {
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
