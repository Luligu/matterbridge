/**
 * @file packages/core/src/matterNode.ts
 * @description This file contains the class MatterNode.
 * @author Luca Liguori
 * @created 2025-10-01
 * @version 1.1.3
 * @license Apache-2.0
 *
 * Copyright 2025, 2026, 2027 Luca Liguori.
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

/* oxlint-disable unicorn/no-negated-condition */
/* oxlint-disable max-lines */

// WARNING: Not released yet and excluded from Vitest coverage

// @matter
// oxlint-disable-next-line import/no-unassigned-import
import '@matter/nodejs';

// Node modules
import EventEmitter from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// @matter
import { Crypto, Environment, LogFormat as MatterLogFormat, LogLevel as MatterLogLevel, type StorageContext, type StorageManager, UINT16_MAX, UINT32_MAX } from '@matter/general';
import { Endpoint, ServerNode } from '@matter/node';
import { BasicInformationServer } from '@matter/node/behaviors/basic-information';
import { BridgedDeviceBasicInformationServer } from '@matter/node/behaviors/bridged-device-basic-information';
import { PowerSourceServer } from '@matter/node/behaviors/power-source';
import { AggregatorEndpoint } from '@matter/node/endpoints/aggregator';
import { type DeviceCertification, PaseClient } from '@matter/protocol';
import { PowerSource } from '@matter/types/clusters/power-source';
import { DeviceTypeId, EndpointNumber, VendorId } from '@matter/types/datatype';
// @matterbridge
import { BroadcastServer } from '@matterbridge/thread/server';
import type { BridgeStatus, PluginName, PluginStatusUpdate, SharedMatterbridge, WorkerMessage } from '@matterbridge/types';
import { dev, MATTER_STORAGE_DIR, NODE_STORAGE_DIR, plg } from '@matterbridge/types';
import { getIntParameter, getParameter, hasAnyParameter, hasParameter } from '@matterbridge/utils/cli';
import { getErrorMessage, inspectError } from '@matterbridge/utils/error';
import { logModuleLoaded } from '@matterbridge/utils/loader';
import { isValidInteger, isValidObject, isValidString, parseVersionString } from '@matterbridge/utils/validate';
import { fireAndForget, wait, withTimeout } from '@matterbridge/utils/wait';
// Ansi Logger module
import { AnsiLogger, BLUE, CYAN, db, debugStringify, er, LogLevel, nf, or, TimestampFormat, zb } from 'node-ansi-logger';
// Node persist manager module
import { NodeStorageManager } from 'node-persist-manager';

// matterbridge
import { addVirtualDevice } from './helpers.js';
import type { Matterbridge } from './matterbridge.js';
import { bridge } from './matterbridgeDeviceTypes.js';
import type { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import type { MatterbridgePlatform } from './matterbridgePlatform.js';
import { setupLoggers } from './matterLogger.js';
import { deleteAdvertisingNode, getServerNodeData, setAdvertisingNode, toBaseDevice } from './matterNodeHelpers.js';
import { startMatterStorage, stopMatterStorage } from './matterStorage.js';
import { type Plugin, PluginManager } from './pluginManager.js';

logModuleLoaded('MatterNode');

/**
 * Represents the Matter events.
 */
interface MatterEvents {
  ready: [nodeId: string];
  online: [nodeId: string];
  offline: [nodeId: string];
  closed: [];
}

/**
 * Represents the Matter class.
 */
export class MatterNode extends EventEmitter<MatterEvents> {
  /** Matterbridge logger */
  private readonly log = new AnsiLogger({ logName: 'MatterNode', logNameColor: '\x1b[38;5;65m', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });
  /** Matter logger */
  private readonly matterLog = new AnsiLogger({ logName: 'MatterNode', logNameColor: '\x1b[34m', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });

  /** Matter environment default */
  private readonly environment = Environment.default;

  /** Matter storage id */
  storeId: string;
  /** Matter storage manager opened with the storeId */
  matterStorageManager: StorageManager | undefined;
  /** Matter storage context created in the storage manager with name 'matterbridge' */
  matterStorageContext: StorageContext | undefined;

  /** Matter mdns interface name e.g. 'eth0' or 'wlan0' or 'Wi-Fi' */
  mdnsInterface: string | undefined;
  /** Matter listeningAddressIpv4 address */
  ipv4Address: string | undefined;
  /** Matter listeningAddressIpv6 address */
  ipv6Address: string | undefined;
  /** Matter commissioning port It is incremented in childbridge mode. */
  port: number | undefined;
  /** Matter commissioning passcode. It is incremented in childbridge mode. */
  passcode: number | undefined;
  /** Matter commissioning discriminator. It is incremented in childbridge mode. */
  discriminator: number | undefined;
  /** Matter device certification */
  certification: DeviceCertification.Configuration | undefined;

  /** Matter server node */
  serverNode: ServerNode | undefined;
  /** Matter aggregator node */
  aggregatorNode: Endpoint<AggregatorEndpoint> | undefined;
  // Default values for the aggregator node
  aggregatorVendorId = VendorId(getIntParameter('vendorId') ?? 0xfff1);
  aggregatorVendorName = getParameter('vendorName') ?? 'Matterbridge';
  aggregatorProductId = getIntParameter('productId') ?? 0x8000;
  aggregatorProductName = getParameter('productName') ?? 'Matterbridge aggregator';
  aggregatorDeviceType = DeviceTypeId(getIntParameter('deviceType') ?? bridge.code);
  aggregatorSerialNumber = getParameter('serialNumber');
  aggregatorUniqueId = getParameter('uniqueId');

  /** Plugins */
  readonly pluginManager: PluginManager;

  /** Dependant MatterNodes for device with mode 'server' keyed by device id */
  readonly dependantMatterNodes = new Map<string, MatterNode>();

  /** Broadcast server */
  private readonly server: BroadcastServer;
  private readonly debug = hasAnyParameter('debug', 'verbose', 'debug-node', 'verbose-node');
  private readonly verbose = hasAnyParameter('verbose', 'verbose-node');

  /**
   * Creates an instance of the Matter class.
   *
   * @param {SharedMatterbridge} matterbridge - The shared matterbridge instance.
   * @param {PluginName} [pluginName] - The plugin name (optional). If not provided, it is assumed to be the main matter node instance and all plugins are included.
   * @param {MatterbridgeEndpoint} [device] - The matterbridge endpoint device (optional). It is used to create a server mode device.
   */
  constructor(
    private readonly matterbridge: SharedMatterbridge,
    private readonly pluginName?: PluginName,
    private readonly device?: MatterbridgeEndpoint,
  ) {
    super();
    this.log.logLevel = matterbridge.logLevel;
    this.matterLog.logLevel = matterbridge.matterLogLevel;
    if (this.debug) this.log.debug(`MatterNode ${this.pluginName ? 'for plugin ' + this.pluginName : 'bridge'} loading...`);

    // Setup the storeId of the server node: Matterbridge in bridge mode, the plugin name in childbridge mode or the device name for a server mode device
    this.storeId = this.device?.deviceName ? this.device.deviceName.replace(/[ .]/g, '') : (this.pluginName ?? 'Matterbridge');

    // Setup Matter parameters
    this.port = matterbridge.port;
    this.passcode = matterbridge.passcode;
    this.discriminator = matterbridge.discriminator;
    this.mdnsInterface = matterbridge.mdnsInterface;

    // Setup the broadcast server
    this.server = new BroadcastServer('matter', this.log);
    this.server.on('broadcast_message', (msg) => fireAndForget(this.msgHandler(msg), this.log, 'Broadcast message handler'));
    if (this.verbose) this.log.debug(`BroadcastServer is ready`);

    // Setup the plugin manager with thread server closed
    const injectMatterbridge = {
      ...this.matterbridge,
      getPlatformMatterbridge: (): SharedMatterbridge => this.matterbridge,
      addBridgedEndpoint: this.addBridgedEndpoint.bind(this),
      removeBridgedEndpoint: this.removeBridgedEndpoint.bind(this),
      removeAllBridgedEndpoints: this.removeAllBridgedEndpoints.bind(this),
      addVirtualEndpoint: this.addVirtualEndpoint.bind(this),
    };
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    this.pluginManager = new PluginManager(injectMatterbridge as unknown as Matterbridge);
    // @ts-expect-error access private property
    this.pluginManager.server.close();
    this.pluginManager.logLevel = matterbridge.logLevel;
    if (this.verbose) this.log.debug(`PluginManager is ready`);

    // Setup the matter environment
    this.environment.vars.set('log.level', MatterLogLevel.DEBUG);
    this.environment.vars.set('log.format', hasParameter('no-ansi') || process.env.NO_COLOR === '1' ? MatterLogFormat.PLAIN : MatterLogFormat.ANSI);
    this.environment.vars.set('path.root', path.join(matterbridge.matterbridgeDirectory, MATTER_STORAGE_DIR));
    this.environment.vars.set('runtime.signals', false);
    this.environment.vars.set('runtime.exitcode', false);
    this.environment.vars.set('endpoint.validation', 'warn');
    if (this.mdnsInterface) this.environment.vars.set('mdns.networkInterface', this.mdnsInterface);
    if (this.verbose) this.log.debug(`Matter Environment is ready`);

    // Setup the matterbridge and matter loggers
    setupLoggers(matterbridge, this.log, this.matterLog, this.verbose);

    if (this.debug) this.log.debug(`MatterNode for ${this.storeId} loaded`);
  }

  /**
   * Handles incoming messages from the broadcast server.
   *
   * @param {WorkerMessage} msg - The incoming message.
   */
  async msgHandler(msg: WorkerMessage): Promise<void> {
    if (this.server.isWorkerRequest(msg)) {
      if (this.verbose) this.log.debug(`Received broadcast request ${CYAN}${msg.type}${db} from ${CYAN}${msg.src}${db}: ${debugStringify(msg)}${db}`);
      switch (msg.type) {
        case 'get_log_level':
          this.server.respond({ ...msg, result: { logLevel: this.log.logLevel } });
          break;
        case 'set_log_level':
          this.log.logLevel = msg.params.logLevel;
          this.server.respond({ ...msg, result: { logLevel: this.log.logLevel } });
          break;
        case 'matter_start':
          // Only the MatterNode with the requested storeId responds. Dependant MatterNodes are started by their parent MatterNode.
          if (this.device || msg.params.storeId !== this.storeId) break;
          try {
            await this.create();
            await this.start();
            this.server.respond({ ...msg, result: { storeId: this.storeId, success: true } });
          } catch (error) {
            inspectError(this.log, `Error starting MatterNode ${this.storeId}`, error);
          }
          break;
        case 'matter_stop':
          // Only the MatterNode with the requested storeId responds. Dependant MatterNodes are stopped by their parent MatterNode.
          if (this.device || msg.params.storeId !== this.storeId) break;
          try {
            await this.stop();
            // Respond before destroy() closes the broadcast server
            this.server.respond({ ...msg, result: { storeId: this.storeId, success: true } });
            await this.destroy();
          } catch (error) {
            inspectError(this.log, `Error stopping MatterNode ${this.storeId}`, error);
          }
          break;
        case 'matter_apimatter':
          // Every MatterNode (dependant ones included) receives the request: only the one owning the server node responds
          if (this.serverNode?.id === msg.params.id) this.server.respond({ ...msg, result: { matter: getServerNodeData(this.serverNode) } });
          break;
        default:
          if (this.verbose) this.log.debug(`Unknown broadcast request ${CYAN}${msg.type}${db} from ${CYAN}${msg.src}${db}`);
      }
    }
    if (this.server.isWorkerResponse(msg) && (msg.dst === 'all' || msg.dst === 'matter')) {
      if (this.verbose) this.log.debug(`Received broadcast response ${CYAN}${msg.type}${db} from ${CYAN}${msg.src}${db}: ${debugStringify(msg)}${db}`);
      switch (msg.type) {
        case 'get_log_level':
        case 'set_log_level':
        case 'matterbridge_platform':
        case 'matterbridge_shared':
          break;
        default:
          if (this.verbose) this.log.debug(`Unknown broadcast response ${CYAN}${msg.type}${db} from ${CYAN}${msg.src}${db}`);
      }
    }
  }

  /**
   * Destroys the Matter instance.
   * It closes the plugin manager and the broadcast server. The MdnsService is managed by matter.js: it is closed when the last ServerNode using it closes.
   *
   * @returns {Promise<void>} A promise that resolves when the instance is destroyed.
   */
  async destroy(): Promise<void> {
    if (this.verbose) this.log.debug(`Destroying MatterNode instance for ${this.storeId}...`);

    // Close the plugin manager
    this.pluginManager.destroy();

    // Close the broadcast server
    this.server.close();

    // Yield to the Node.js event loop to allow all resources to be released
    await this.yieldToNode();

    if (this.verbose) this.log.debug(`Destroyed MatterNode instance for ${this.storeId}`);
  }

  /**
   * Creates and initializes the Matter node, storage, and plugins.
   */
  async create(): Promise<void> {
    this.log.info(`Creating Matter node for ${this.storeId}...`);

    // Setup Matter parameters
    const { result } = await this.server.fetch({ type: 'matterbridge_matterdata', src: this.server.name, dst: 'matterbridge' });
    this.port = result.port;
    this.passcode = result.passcode;
    this.discriminator = result.discriminator;
    this.log.debug(
      `Loaded Matter node parameters for ${this.storeId}: port ${CYAN}${this.port}${db} passcode ${CYAN}${this.passcode}${db} discriminator ${CYAN}${this.discriminator}${db}`,
    );

    // Start matter storage
    await this.startMatterStorage();

    // Load plugins from storage
    // @ts-expect-error access private property
    this.pluginManager.matterbridge.nodeStorage = new NodeStorageManager({
      dir: path.join(this.matterbridge.matterbridgeDirectory, NODE_STORAGE_DIR),
      writeQueue: false,
      expiredInterval: undefined,
      logging: false,
    });
    // @ts-expect-error access private property
    this.pluginManager.matterbridge.nodeContext = await this.pluginManager.matterbridge.nodeStorage.createStorage('matterbridge');
    await this.pluginManager.loadFromStorage();

    // Create Matter node for a server mode device
    if (this.pluginName && this.device?.deviceName) {
      this.log.debug(`Creating MatterNode instance for server node device ${CYAN}${this.device.deviceName}${db}...`);
      await this.createDeviceServerNode(this.pluginName, this.device);
      this.log.debug(`Created MatterNode instance for server node device ${CYAN}${this.device.deviceName}${db}`);
      this.emit('ready', this.device.deviceName.replace(/[ .]/g, ''));
      return;
    }

    if (this.pluginName) {
      this.log.debug(`Creating MatterNode instance for plugin ${CYAN}${this.pluginName}${db}...`);

      // Load only the specified plugin
      this.log.debug(`Loading plugin ${CYAN}${this.pluginName}${db}...`);
      await this.pluginManager.load(this.pluginName);
      this.pluginStatusUpdate(this.pluginName, { loaded: this.pluginManager.get(this.pluginName)?.loaded });
      this.log.debug(`Loaded plugin ${CYAN}${this.pluginName}${db}`);

      this.log.debug(`Created MatterNode instance for plugin ${CYAN}${this.pluginName}${db}`);
      this.emit('ready', this.pluginName);
    } else {
      this.log.debug('Creating MatterNode instance for all plugins...');

      await this.createMatterbridgeServerNode();

      // Load all enabled plugins
      this.log.debug('Loading all plugins...');
      const loadPromises: Promise<MatterbridgePlatform | undefined>[] = [];
      for (const plugin of this.pluginManager.array().filter((p) => p.enabled)) {
        loadPromises.push(this.pluginManager.load(plugin));
      }
      await Promise.all(loadPromises);
      for (const plugin of this.pluginManager.array().filter((p) => p.enabled)) {
        this.pluginStatusUpdate(plugin.name, { loaded: plugin.loaded });
      }
      this.log.debug('Loaded all plugins');

      this.log.debug('Created MatterNode instance for all plugins');
      this.emit('ready', 'Matterbridge');
    }

    this.log.info(`Created Matter node for ${this.storeId}`);
    await this.yieldToNode();
  }

  /**
   * Starts the Matter node and any dependant nodes.
   */
  async start(): Promise<void> {
    if (!this.serverNode && !this.pluginName) throw new Error(`Matter server node for ${this.storeId} not created yet. Call create() first.`);
    this.log.info(`Starting MatterNode for ${this.storeId}...`);

    // Start Matter node for a server mode device
    if (this.pluginName && this.device?.deviceName) {
      // Start the server node
      this.log.debug(`Starting MatterNode for server device ${this.pluginName}:${this.device.deviceName}...`);
      await this.startServerNode();
      this.log.debug(`Started MatterNode for server device ${this.pluginName}:${this.device.deviceName}`);
      return;
    }

    if (!this.pluginName) {
      // Start all loaded plugins
      this.log.debug(`Starting all plugins for ${this.storeId}...`);
      const startPromises: Promise<Plugin | undefined>[] = [];
      for (const plugin of this.pluginManager.array().filter((p) => p.enabled && p.loaded)) {
        startPromises.push(this.pluginManager.start(plugin, 'Starting MatterNode'));
      }
      await Promise.all(startPromises);
      for (const plugin of this.pluginManager.array().filter((p) => p.enabled)) {
        this.pluginStatusUpdate(plugin.name, { started: plugin.started, registeredDevices: plugin.registeredDevices });
      }
      this.log.debug(`Started all plugins for ${this.storeId}`);

      // Start the server node
      this.log.debug(`Starting MatterNode for ${this.storeId}...`);
      await this.startServerNode();
      this.log.debug(`Started MatterNode for ${this.storeId}`);

      // Configure all loaded plugins
      this.log.debug(`Configuring all plugins for ${this.storeId}...`);
      const configurePromises: Promise<Plugin | undefined>[] = [];
      for (const plugin of this.pluginManager.array().filter((p) => p.enabled && p.started)) {
        configurePromises.push(this.pluginManager.configure(plugin));
      }
      await Promise.all(configurePromises);
      for (const plugin of this.pluginManager.array().filter((p) => p.enabled)) {
        this.pluginStatusUpdate(plugin.name, { configured: plugin.configured });
      }
      this.log.debug(`Configured all plugins for ${this.storeId}`);
    } else {
      // Start the loaded plugin
      this.log.debug(`Starting plugin ${this.pluginName}...`);
      await this.pluginManager.start(this.pluginName, 'Starting MatterNode');
      const plugin = this.pluginManager.get(this.pluginName);
      this.pluginStatusUpdate(this.pluginName, { started: plugin?.started, registeredDevices: plugin?.registeredDevices });
      this.log.debug(`Started plugin ${this.pluginName}...`);

      // Start the server node
      this.log.debug(`Starting MatterNode for plugin ${this.storeId}...`);
      await this.startServerNode();
      this.log.debug(`Started MatterNode for plugin ${this.storeId}`);

      // Configure the plugin
      this.log.debug(`Configuring plugin ${this.pluginName}...`);
      await this.pluginManager.configure(this.pluginName);
      this.pluginStatusUpdate(this.pluginName, { configured: this.pluginManager.get(this.pluginName)?.configured });
      this.log.debug(`Configured plugin ${this.pluginName}...`);
    }

    // Start the dependant MatterNodes
    this.log.debug(`Starting dependant MatterNodes for ${this.storeId}...`);
    for (const dependantMatterNode of this.dependantMatterNodes.values()) {
      await dependantMatterNode.start();
    }
    this.log.debug(`Started dependant MatterNodes for ${this.storeId}`);

    this.log.info(`Started MatterNode for ${this.storeId}`);
    await this.yieldToNode();
  }

  /**
   * Stops the Matter node and releases associated resources.
   */
  async stop(): Promise<void> {
    if (!this.serverNode) throw new Error(`Matter server node for ${this.storeId} not created yet. Call create() first.`);
    this.log.info(`Stopping MatterNode for ${this.storeId}...`);

    // Stop Matter node for a server mode device
    if (this.pluginName && this.device?.deviceName) {
      // Stop the server node
      this.log.debug(`Stopping MatterNode for server device ${this.pluginName}:${this.device.deviceName}...`);
      await this.stopServerNode();
      this.serverNode = undefined;
      this.aggregatorNode = undefined;
      await this.stopMatterStorage();
      await this.destroy();
      this.log.debug(`Stopped MatterNode for server device ${this.pluginName}:${this.device.deviceName}`);
      this.log.info(`Stopped MatterNode for ${this.storeId}`);
      await this.yieldToNode();
      return;
    }

    if (!this.pluginName) {
      this.log.debug(`Stopping all plugins for ${this.storeId}...`);

      const shutdownPromises: Promise<Plugin | undefined>[] = [];
      for (const plugin of this.pluginManager.array().filter((p) => p.enabled && p.started)) {
        shutdownPromises.push(this.pluginManager.shutdown(plugin, 'Stopping MatterNode'));
      }
      await Promise.all(shutdownPromises);

      this.log.debug(`Stopped all plugins for ${this.storeId}`);
    } else {
      this.log.debug(`Stopping plugin ${this.pluginName}...`);

      await this.pluginManager.shutdown(this.pluginName, 'Stopping MatterNode');

      this.log.debug(`Stopped plugin ${this.pluginName}`);
    }

    // Stop the dependant MatterNodes
    this.log.debug(`Stopping dependant MatterNodes for ${this.storeId}...`);
    for (const dependantMatterNode of this.dependantMatterNodes.values()) {
      await dependantMatterNode.stop();
    }
    this.log.debug(`Stopped dependant MatterNodes for ${this.storeId}`);

    await this.stopServerNode();
    this.serverNode = undefined;
    this.aggregatorNode = undefined;

    await this.stopMatterStorage();

    this.log.info(`Stopped MatterNode for ${this.storeId}`);
    await this.yieldToNode();
  }

  /**
   * Starts the matter storage of the storeId: opens its storage manager, performs a backup and migrates the legacy 'persist' context.
   *
   * @returns {Promise<void>} - A promise that resolves when the storage is started.
   */
  async startMatterStorage(): Promise<void> {
    this.matterStorageManager = await startMatterStorage(this.matterbridge, this.storeId, this.log);
  }

  /**
   * Stops the matter storage.
   *
   * @returns {Promise<void>} A promise that resolves when the storage is stopped.
   */
  async stopMatterStorage(): Promise<void> {
    if (this.matterStorageManager) await stopMatterStorage(this.matterStorageManager, this.log);
    this.matterStorageManager = undefined;
    this.matterStorageContext = undefined;
    this.emit('closed');
  }

  /**
   * Creates a server node storage context.
   *
   * @param {string} storeId - The storeId.
   * @param {string} deviceName - The name of the device.
   * @param {DeviceTypeId} deviceType - The device type of the device.
   * @param {VendorId} vendorId - The vendor ID.
   * @param {string} vendorName - The vendor name.
   * @param {number} productId - The product ID.
   * @param {string} productName - The product name.
   * @param {string} [serialNumber] - The serial number of the device (optional).
   * @param {string} [uniqueId] - The unique ID of the device (optional).
   * @param {number} [softwareVersion] - The software version of the device. Default is 1.
   * @param {string} [softwareVersionString] - The software version string of the device. Default is '1.0.0'.
   * @param {number} [hardwareVersion] - The hardware version of the device. Default is 1.
   * @param {string} [hardwareVersionString] - The hardware version string of the device. Default is '1.0.0'.
   * @param {string} [productLabel] - The product label (optional, default is 'Matter Endpoint').
   * @param {string} [productUrl] - The product URL (optional, default is 'https://matterbridge.io').
   * @param {number} [configurationVersion] - The configuration version (optional, default is 1).
   * @returns {Promise<StorageContext>} The storage context for the commissioning server.
   * @throws {Error} If the storage service is not initialized.
   */
  async createServerNodeContext(
    storeId: string,
    deviceName: string,
    deviceType: DeviceTypeId,
    vendorId: VendorId,
    vendorName: string,
    productId: number,
    productName: string,
    serialNumber?: string,
    uniqueId?: string,
    softwareVersion: number = 1,
    softwareVersionString: string = '1.0.0',
    hardwareVersion: number = 1,
    hardwareVersionString: string = '1.0.0',
    productLabel: string = 'Matter Endpoint',
    productUrl: string = 'https://matterbridge.io',
    configurationVersion: number = 1,
  ): Promise<StorageContext> {
    if (!this.matterStorageManager) {
      throw new Error('No storage manager initialized');
    }
    const { randomBytes } = await import('node:crypto');

    this.log.info(`Creating server node storage context "${storeId}.matterbridge" for ${storeId}...`);
    const storageContext = this.matterStorageManager.createContext('matterbridge');
    const random = randomBytes(8).toString('hex');

    /**
     * Writes a primitive initialization value only when missing or different.
     *
     * @param {string} key The storage key.
     * @param {string | number} value The desired value.
     * @returns {Promise<void>} Resolves after any required write completes.
     */
    async function setIfDifferent(key: string, value: string | number): Promise<void> {
      if (!(await storageContext.has(key)) || (await storageContext.get(key)) !== value) {
        await storageContext.set(key, value);
      }
    }

    await setIfDifferent('storeId', storeId);
    await setIfDifferent('deviceName', deviceName);
    await setIfDifferent('deviceType', deviceType);
    await setIfDifferent('vendorId', vendorId);
    await setIfDifferent('vendorName', vendorName.slice(0, 32));
    await setIfDifferent('productId', productId);
    await setIfDifferent('productName', productName.slice(0, 32));
    await setIfDifferent('productLabel', productLabel.replace(vendorName, '').trim().slice(0, 64));
    await setIfDifferent('productUrl', isValidString(productUrl, 8, 256) && productUrl.startsWith('https://') ? productUrl : 'https://matterbridge.io');
    await setIfDifferent('nodeLabel', deviceName.slice(0, 32));
    await setIfDifferent('serialNumber', await storageContext.get('serialNumber', serialNumber ? serialNumber.slice(0, 32) : 'SN' + random));
    await setIfDifferent('uniqueId', await storageContext.get('uniqueId', uniqueId ? uniqueId.slice(0, 32) : 'UI' + random));
    await setIfDifferent('softwareVersion', isValidInteger(softwareVersion, 0, UINT32_MAX) ? softwareVersion : 1);
    await setIfDifferent('softwareVersionString', isValidString(softwareVersionString, 1, 64) ? softwareVersionString : '1.0.0');
    await setIfDifferent('hardwareVersion', isValidInteger(hardwareVersion, 0, UINT16_MAX) ? hardwareVersion : 1);
    await setIfDifferent('hardwareVersionString', isValidString(hardwareVersionString, 1, 64) ? hardwareVersionString : '1.0.0');
    await setIfDifferent('configurationVersion', isValidInteger(configurationVersion, 1, UINT32_MAX) ? configurationVersion : 1);

    this.log.debug(`Created server node storage context "${storeId}.matterbridge" for ${storeId}:`);
    this.log.debug(`- storeId: ${await storageContext.get('storeId')}`);
    this.log.debug(`- deviceName: ${await storageContext.get('deviceName')}`);
    this.log.debug(`- deviceType: ${await storageContext.get('deviceType')}(0x${(await storageContext.get('deviceType'))?.toString(16).padStart(4, '0')})`);
    this.log.debug(`- vendorId: ${await storageContext.get('vendorId')}`);
    this.log.debug(`- vendorName: ${await storageContext.get('vendorName')}`);
    this.log.debug(`- productId: ${await storageContext.get('productId')}`);
    this.log.debug(`- productName: ${await storageContext.get('productName')}`);
    this.log.debug(`- productLabel: ${await storageContext.get('productLabel')}`);
    this.log.debug(`- productUrl: ${await storageContext.get('productUrl')}`);
    this.log.debug(`- nodeLabel: ${await storageContext.get('nodeLabel')}`);
    this.log.debug(`- serialNumber: ${await storageContext.get('serialNumber')}`);
    this.log.debug(`- uniqueId: ${await storageContext.get('uniqueId')}`);
    this.log.debug(`- softwareVersion: ${await storageContext.get('softwareVersion')}`);
    this.log.debug(`- softwareVersionString: ${await storageContext.get('softwareVersionString')}`);
    this.log.debug(`- hardwareVersion: ${await storageContext.get('hardwareVersion')}`);
    this.log.debug(`- hardwareVersionString: ${await storageContext.get('hardwareVersionString')}`);
    this.log.debug(`- configurationVersion: ${await storageContext.get('configurationVersion')}`);
    return storageContext;
  }

  /**
   * Creates a server node.
   *
   * @param {number} [port] - The port number for the server node. Defaults to 5540.
   * @param {number} [passcode] - The passcode for the server node. Defaults to 20242025.
   * @param {number} [discriminator] - The discriminator for the server node. Defaults to 3850.
   * @returns {Promise<ServerNode<ServerNode.RootEndpoint>>} A promise that resolves to the created server node.
   * @throws {Error} If the matter storage context is not created yet.
   */
  async createServerNode(port: number = 5540, passcode: number = 20252026, discriminator: number = 3850): Promise<ServerNode> {
    if (!this.matterStorageContext) {
      throw new Error('Matter server node context not created yet. Call createServerNodeContext() first.');
    }
    const storeId = await this.matterStorageContext.get<string>('storeId');
    this.log.notice(`Creating server node for ${storeId} on port ${port} with passcode ${passcode} and discriminator ${discriminator}...`);
    this.log.debug(`- storeId: ${await this.matterStorageContext.get('storeId')}`);
    this.log.debug(`- deviceName: ${await this.matterStorageContext.get('deviceName')}`);
    this.log.debug(`- deviceType: ${await this.matterStorageContext.get('deviceType')}(0x${(await this.matterStorageContext.get('deviceType'))?.toString(16).padStart(4, '0')})`);
    this.log.debug(`- vendorId: ${await this.matterStorageContext.get('vendorId')}`);
    this.log.debug(`- vendorName: ${await this.matterStorageContext.get('vendorName')}`);
    this.log.debug(`- productId: ${await this.matterStorageContext.get('productId')}`);
    this.log.debug(`- productName: ${await this.matterStorageContext.get('productName')}`);
    this.log.debug(`- productLabel: ${await this.matterStorageContext.get('productLabel')}`);
    this.log.debug(`- productUrl: ${await this.matterStorageContext.get('productUrl')}`);
    this.log.debug(`- nodeLabel: ${await this.matterStorageContext.get('nodeLabel')}`);
    this.log.debug(`- serialNumber: ${await this.matterStorageContext.get('serialNumber')}`);
    this.log.debug(`- uniqueId: ${await this.matterStorageContext.get('uniqueId')}`);
    this.log.debug(`- softwareVersion: ${await this.matterStorageContext.get('softwareVersion')}`);
    this.log.debug(`- softwareVersionString: ${await this.matterStorageContext.get('softwareVersionString')}`);
    this.log.debug(`- hardwareVersion: ${await this.matterStorageContext.get('hardwareVersion')}`);
    this.log.debug(`- hardwareVersionString: ${await this.matterStorageContext.get('hardwareVersionString')}`);
    this.log.debug(`- configurationVersion: ${await this.matterStorageContext.get('configurationVersion')}`);

    // Validate the passcode
    let validPasscode = passcode;
    if (passcode < 0 || passcode > 99999999) {
      this.log.warn(`Invalid passcode ${passcode} for server node ${storeId}. Passcode must be between 0 and 99999999. Generating a random passcode...`);
      validPasscode = PaseClient.generateRandomPasscode(this.environment.get(Crypto));
    }

    // Validate the discriminator
    let validDiscriminator = discriminator;
    if (discriminator < 0 || discriminator > 0xfff) {
      this.log.warn(`Invalid discriminator ${discriminator} for server node ${storeId}. Discriminator must be between 0 and 4095 (0xFFF). Generating a random discriminator...`);
      validDiscriminator = PaseClient.generateRandomDiscriminator(this.environment.get(Crypto));
    }

    let rootEndpoint;
    if (hasParameter('root-power-source') || process.env.MATTERBRIDGE_CHIP_TEST) {
      this.log.warn(' ****************************************************************************************');
      this.log.warn(' * Adding the PowerSource cluster server to the root endpoint.                           *');
      this.log.warn(' ****************************************************************************************');
      rootEndpoint = ServerNode.RootEndpoint.with(PowerSourceServer.with(PowerSource.Feature.Wired));
    } else {
      rootEndpoint = ServerNode.RootEndpoint;
    }
    // v8 ignore if - No test cause is just chip test entry point for the TestEventTrigger on GeneralDiagnostics.
    if (process.env.MATTERBRIDGE_CHIP_TEST && fs.existsSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'chipTests.js'))) {
      this.log.warn(' ****************************************************************************************');
      this.log.warn(' * MATTERBRIDGE_CHIP_TEST environment variable is set. Running TestEventTrigger server. *');
      this.log.warn(' ****************************************************************************************');
      const { MatterbridgeGeneralDiagnosticsServer } = await import('./chipTests.js');
      rootEndpoint = rootEndpoint.with(MatterbridgeGeneralDiagnosticsServer);
    }

    /**
     * Create a Matter ServerNode, which contains the Root Endpoint and all relevant data and configuration
     */
    const serverNode = await ServerNode.create(rootEndpoint, {
      // Required: Give the Node a unique ID which is used to store the state of this node
      id: storeId,

      // Provide the environment to run this node in
      environment: this.environment,

      // Provide Network relevant configuration like the port
      network: {
        listeningAddressIpv4: this.ipv4Address,
        listeningAddressIpv6: this.ipv6Address,
        port,
        tcp: true,
        transportPreference: 'udp',
      },

      // Provide the certificate for the device
      operationalCredentials: {
        certification: this.certification,
      },

      // Provide Commissioning relevant settings
      commissioning: {
        passcode: validPasscode,
        discriminator: validDiscriminator,
      },

      // Provide Node announcement settings
      productDescription: {
        name: await this.matterStorageContext.get<string>('deviceName'),
        deviceType: DeviceTypeId(await this.matterStorageContext.get<number>('deviceType')),
        vendorId: VendorId(await this.matterStorageContext.get<number>('vendorId')),
        productId: await this.matterStorageContext.get<number>('productId'),
      },

      // Provide defaults for the BasicInformation cluster on the Root endpoint
      basicInformation: {
        vendorId: VendorId(await this.matterStorageContext.get<number>('vendorId')),
        vendorName: await this.matterStorageContext.get<string>('vendorName'),

        productId: await this.matterStorageContext.get<number>('productId'),
        productName: await this.matterStorageContext.get<string>('productName'),
        productLabel: await this.matterStorageContext.get<string>('productLabel'),
        productUrl: await this.matterStorageContext.get<string>('productUrl'),

        nodeLabel: await this.matterStorageContext.get<string>('nodeLabel'),

        serialNumber: await this.matterStorageContext.get<string>('serialNumber'),
        uniqueId: await this.matterStorageContext.get<string>('uniqueId'),

        softwareVersion: await this.matterStorageContext.get<number>('softwareVersion'),
        softwareVersionString: await this.matterStorageContext.get<string>('softwareVersionString'),
        hardwareVersion: await this.matterStorageContext.get<number>('hardwareVersion'),
        hardwareVersionString: await this.matterStorageContext.get<string>('hardwareVersionString'),

        configurationVersion: await this.matterStorageContext.get<number>('configurationVersion'),

        reachable: true,
      },

      ...(hasParameter('root-power-source') || process.env.MATTERBRIDGE_CHIP_TEST
        ? {
            powerSource: {
              status: PowerSource.PowerSourceStatus.Active,
              order: 0,
              description: 'AC Power',
              // Matter 1.6.0 § 11.7.7.32: an empty EndpointList means the source powers the entire node. On a bridge the root power
              // source only powers the root endpoint: the bridged endpoints have their own (or an unknown) power source.
              endpointList: [EndpointNumber(0)],
              wiredCurrentType: PowerSource.WiredCurrentType.Ac,
            },
          }
        : {}),
    });

    /**
     * This event is triggered when the device is initially commissioned successfully.
     * This means: It is added to the first fabric.
     */
    serverNode.lifecycle.commissioned.on(() => {
      this.log.notice(`Server node for ${storeId} was initially commissioned successfully!`);
      deleteAdvertisingNode(storeId);
      this.server.request({ type: 'frontend_refreshrequired', src: 'matter', dst: 'frontend', params: { changed: 'matter', matter: { ...getServerNodeData(serverNode) } } });
    });

    /** This event is triggered when all fabrics are removed from the device, usually it also does a factory reset then. */
    serverNode.lifecycle.decommissioned.on(() => {
      this.log.notice(`Server node for ${storeId} was fully decommissioned successfully!`);
      deleteAdvertisingNode(storeId);
      this.server.request({ type: 'frontend_refreshrequired', src: 'matter', dst: 'frontend', params: { changed: 'matter', matter: { ...getServerNodeData(serverNode) } } });
      this.server.request({ type: 'frontend_snackbarmessage', src: 'matter', dst: 'frontend', params: { message: `${storeId} is offline`, timeout: 5, severity: 'warning' } });
      // The server node is reset to factory defaults and the subscribeAttribute listeners of the plugins are lost (#657)
      this.log.notice(`Server node for ${storeId} was reset to factory defaults: restart Matterbridge before pairing it again`);
      this.server.request({ type: 'frontend_restartrequired', src: 'matter', dst: 'frontend', params: { snackbar: true, fixed: true } });
      this.server.request({
        type: 'frontend_snackbarmessage',
        src: 'matter',
        dst: 'frontend',
        params: { message: `Server node for ${storeId} was reset to factory defaults: restart Matterbridge before pairing it again`, timeout: 10, severity: 'warning' },
      });
    });

    /** This event is triggered when the device went online. This means that it is discoverable in the network. */
    serverNode.lifecycle.online.on(() => {
      this.log.notice(`Server node for ${storeId} is online`);
      this.log.info(`Configuration version for server node ${storeId} is ${serverNode.state.basicInformation.configurationVersion}`);
      if (hasParameter('configuration-version')) {
        let configurationVersion = getIntParameter('configuration-version') ?? serverNode.state.basicInformation.configurationVersion + 1;
        configurationVersion = Math.min(Math.max(configurationVersion, 1), UINT32_MAX);
        fireAndForget(serverNode.setStateOf(BasicInformationServer, { configurationVersion }), this.log, `Failed to set configuration version for server node ${storeId}`);
        this.log.notice(`Configuration version for server node ${storeId} is now ${configurationVersion}`);
      }
      if (!serverNode.lifecycle.isCommissioned) {
        this.log.notice(`Server node for ${storeId} is not commissioned. Pair to commission ...`);
        setAdvertisingNode(storeId, Date.now());
        const { qrPairingCode, manualPairingCode } = serverNode.state.commissioning.pairingCodes;
        this.log.notice(`QR Code URL: https://project-chip.github.io/connectedhomeip/qrcode.html?data=${qrPairingCode}`);
        this.log.notice(`Manual pairing code: ${manualPairingCode}`);
      } else {
        this.log.notice(`Server node for ${storeId} is already commissioned. Waiting for controllers to connect ...`);
        deleteAdvertisingNode(storeId);
      }
      this.server.request({ type: 'frontend_refreshrequired', src: 'matter', dst: 'frontend', params: { changed: 'matter', matter: { ...getServerNodeData(serverNode) } } });
      this.server.request({ type: 'frontend_snackbarmessage', src: 'matter', dst: 'frontend', params: { message: `${storeId} is online`, timeout: 5, severity: 'success' } });
      this.emit('online', storeId);
    });

    /** This event is triggered when the device went offline. it is not longer discoverable or connectable in the network. */
    serverNode.lifecycle.offline.on(() => {
      this.log.notice(`Server node for ${storeId} is offline`);
      deleteAdvertisingNode(storeId);
      this.server.request({ type: 'frontend_refreshrequired', src: 'matter', dst: 'frontend', params: { changed: 'matter', matter: { ...getServerNodeData(serverNode) } } });
      this.server.request({ type: 'frontend_snackbarmessage', src: 'matter', dst: 'frontend', params: { message: `${storeId} is offline`, timeout: 5, severity: 'warning' } });
      this.emit('offline', storeId);
    });

    /**
     * This event is triggered when a fabric is added, removed or updated on the device. Use this if more granular
     * information is needed.
     */
    serverNode.events.commissioning.fabricsChanged.on((fabricIndex, fabricAction) => {
      let action = '';
      // oxlint-disable-next-line default-case
      switch (fabricAction) {
        case 'added':
          deleteAdvertisingNode(storeId); // The advertising stops when a fabric is added
          action = 'added';
          break;
        case 'deleted':
          action = 'removed';
          break;
        case 'updated':
          action = 'updated';
          break;
      }
      this.log.notice(`Commissioned fabric index ${fabricIndex} ${action} on server node for ${storeId}: ${debugStringify(serverNode.state.commissioning.fabrics[fabricIndex])}`);
      this.server.request({ type: 'frontend_refreshrequired', src: 'matter', dst: 'frontend', params: { changed: 'matter', matter: { ...getServerNodeData(serverNode) } } });
    });

    /**
     * This event is triggered when an operative new session was opened by a Controller.
     * It is not triggered for the initial commissioning process, just afterwards for real connections.
     */
    serverNode.events.sessions.opened.on((session) => {
      this.log.notice(`Session opened on server node for ${storeId}: ${debugStringify(session)}`);
      this.server.request({ type: 'frontend_refreshrequired', src: 'matter', dst: 'frontend', params: { changed: 'matter', matter: { ...getServerNodeData(serverNode) } } });
    });

    /**
     * This event is triggered when an operative session is closed by a Controller or because the Device goes offline.
     */
    serverNode.events.sessions.closed.on((session) => {
      this.log.notice(`Session closed on server node for ${storeId}: ${debugStringify(session)}`);
      this.server.request({ type: 'frontend_refreshrequired', src: 'matter', dst: 'frontend', params: { changed: 'matter', matter: { ...getServerNodeData(serverNode) } } });
    });

    /** This event is triggered when a subscription gets added or removed on an operative session. */
    serverNode.events.sessions.subscriptionsChanged.on((session) => {
      this.log.notice(`Session subscriptions changed on server node for ${storeId}: ${debugStringify(session)}`);
      this.server.request({ type: 'frontend_refreshrequired', src: 'matter', dst: 'frontend', params: { changed: 'matter', matter: { ...getServerNodeData(serverNode) } } });
    });

    this.storeId = storeId;
    this.log.info(`Created server node for ${this.storeId}`);
    return serverNode;
  }

  /**
   * Starts the specified server node.
   *
   * @param {number} [timeout] - The timeout in milliseconds for starting the server node. Defaults to 30 seconds.
   * @returns {Promise<void>} A promise that resolves when the server node has started.
   * @throws {Error} If the server node is not created yet.
   */
  async startServerNode(timeout: number = 30000): Promise<void> {
    if (!this.serverNode) {
      throw new Error('Matter server node not created yet. Call create() first.');
    }
    this.log.notice(`Starting ${this.serverNode.id} server node...`);
    try {
      await withTimeout(this.serverNode.start(), timeout);
      this.log.notice(`Started ${this.serverNode.id} server node`);
    } catch (error) {
      /* v8 ignore next */
      this.log.error(`Failed to start ${this.serverNode.id} server node: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Stops the specified server node.
   *
   * @param {number} [timeout] - The timeout in milliseconds for stopping the server node. Defaults to 30 seconds.
   * @returns {Promise<void>} A promise that resolves when the server node has stopped.
   * @throws {Error} If the server node is not created yet.
   */
  async stopServerNode(timeout: number = 30000): Promise<void> {
    if (!this.serverNode) {
      throw new Error('Matter server node not created yet. Call create() first.');
    }
    this.log.notice(`Closing ${this.serverNode.id} server node`);
    try {
      await withTimeout(this.serverNode.close(), timeout);
      this.log.info(`Closed ${this.serverNode.id} server node`);
    } catch (error) {
      /* v8 ignore next */
      this.log.error(`Failed to close ${this.serverNode.id} server node: ${getErrorMessage(error)}`);
    }
    deleteAdvertisingNode(this.serverNode.id);
  }

  /**
   * Creates an aggregator node with the specified storage context.
   *
   * @returns {Promise<Endpoint<AggregatorEndpoint>>} A promise that resolves to the created aggregator node.
   * @throws {Error} If the matter storage context is not created yet.
   */
  async createAggregatorNode(): Promise<Endpoint<AggregatorEndpoint>> {
    if (!this.matterStorageContext) {
      throw new Error('Matter server node context not created yet. Call createServerNodeContext() first.');
    }
    this.log.notice(`Creating ${await this.matterStorageContext.get<string>('storeId')} aggregator...`);
    const aggregatorNode = new Endpoint(AggregatorEndpoint, { id: await this.matterStorageContext.get<string>('storeId') });
    this.log.info(`Created ${await this.matterStorageContext.get<string>('storeId')} aggregator`);
    return aggregatorNode;
  }

  /**
   * Creates the matterbridge server node.
   *
   * @returns {Promise<ServerNode<ServerNode.RootEndpoint>>} A promise that resolves to the created matterbridge server node.
   */
  async createMatterbridgeServerNode(): Promise<ServerNode> {
    this.log.debug(`Creating ${plg}Matterbridge${db} server node...`);
    this.matterStorageContext = await this.createServerNodeContext(
      'Matterbridge', // storeId
      'Matterbridge', // deviceName
      this.aggregatorDeviceType,
      this.aggregatorVendorId,
      this.aggregatorVendorName,
      this.aggregatorProductId,
      this.aggregatorProductName,
      this.aggregatorSerialNumber,
      this.aggregatorUniqueId,
      parseVersionString(this.matterbridge.matterbridgeVersion),
      this.matterbridge.matterbridgeVersion,
      parseVersionString(this.matterbridge.systemInformation.osRelease),
      this.matterbridge.systemInformation.osRelease,
      'Matter Bridge',
      'https://matterbridge.io',
      1,
    );
    this.serverNode = await this.createServerNode(this.port, this.passcode, this.discriminator);
    this.aggregatorNode = await this.createAggregatorNode();
    this.log.debug(`Adding ${plg}Matterbridge${db} aggregator node...`);
    await this.serverNode.add(this.aggregatorNode);
    this.log.debug(`Added ${plg}Matterbridge${db} aggregator node`);
    await this.serverNode.construction.ready;
    await this.aggregatorNode.construction.ready;
    this.log.debug(`Created ${plg}Matterbridge${db} server node`);
    return this.serverNode;
  }

  /**
   * Creates and configures the server node for an accessory plugin for a given device.
   *
   * @param {Plugin | PluginName} pluginOrName - The plugin, or its name, to configure.
   * @param {MatterbridgeEndpoint} device - The device to associate with the plugin.
   * @returns {Promise<ServerNode<ServerNode.RootEndpoint> | undefined>} A promise that resolves to the server node for the accessory plugin.
   */
  async createAccessoryPlugin(pluginOrName: Plugin | PluginName, device: MatterbridgeEndpoint): Promise<ServerNode | undefined> {
    const plugin = typeof pluginOrName === 'string' ? this.pluginManager.get(pluginOrName) : pluginOrName;
    if (!plugin) throw new Error(`Plugin ${BLUE}${this.pluginName}${er} not found`);
    if (!plugin.locked && device.deviceType && device.deviceName && device.vendorId && device.vendorName && device.productId && device.productName) {
      plugin.locked = true;
      this.log.debug(`Creating accessory plugin ${plg}${plugin.name}${db} server node...`);
      this.matterStorageContext = await this.createServerNodeContext(
        plugin.name,
        device.deviceName,
        DeviceTypeId(device.deviceType),
        VendorId(device.vendorId),
        device.vendorName,
        device.productId,
        device.productName,
        device.serialNumber,
        device.uniqueId,
        device.softwareVersion,
        device.softwareVersionString,
        device.hardwareVersion,
        device.hardwareVersionString,
        device.productLabel,
        device.productUrl,
        device.configurationVersion,
      );
      this.serverNode = await this.createServerNode(this.port, this.passcode, this.discriminator);
      this.log.debug(`Adding ${plg}${plugin.name}${db}:${dev}${device.deviceName}${db} to ${plg}${plugin.name}${db} server node...`);
      await this.serverNode.add(device);
      this.log.debug(`Added ${plg}${plugin.name}${db}:${dev}${device.deviceName}${db} to ${plg}${plugin.name}${db} server node`);
      await this.serverNode.construction.ready;
      await device.construction.ready;
      this.log.debug(`Created accessory plugin ${plg}${plugin.name}${db} server node`);
    }
    return this.serverNode;
  }

  /**
   * Creates and configures the server node and the aggregator node for a dynamic plugin.
   *
   * @param {Plugin | PluginName} pluginOrName - The plugin, or its name, to configure.
   * @returns {Promise<ServerNode<ServerNode.RootEndpoint> | undefined>} A promise that resolves to the server node for the dynamic plugin.
   */
  async createDynamicPlugin(pluginOrName: Plugin | PluginName): Promise<ServerNode | undefined> {
    const plugin = typeof pluginOrName === 'string' ? this.pluginManager.get(pluginOrName) : pluginOrName;
    if (!plugin) throw new Error(`Plugin ${BLUE}${this.pluginName}${er} not found`);
    if (!plugin.locked) {
      plugin.locked = true;
      this.log.debug(`Creating dynamic plugin ${plg}${plugin.name}${db} server node...`);
      this.matterStorageContext = await this.createServerNodeContext(
        plugin.name,
        plugin.description,
        this.aggregatorDeviceType,
        this.aggregatorVendorId,
        this.aggregatorVendorName,
        this.aggregatorProductId,
        this.aggregatorProductName,
        undefined,
        undefined,
        parseVersionString(this.matterbridge.matterbridgeVersion),
        this.matterbridge.matterbridgeVersion,
        parseVersionString(this.matterbridge.systemInformation.osRelease),
        this.matterbridge.systemInformation.osRelease,
        plugin.description,
        plugin.homepage ?? 'https://matterbridge.io',
        plugin.configurationVersion,
      );
      this.serverNode = await this.createServerNode(this.port, this.passcode, this.discriminator);
      this.log.debug(`Creating dynamic plugin ${plg}${plugin.name}${db} aggregator node...`);
      this.aggregatorNode = await this.createAggregatorNode();
      this.log.debug(`Adding dynamic plugin ${plg}${plugin.name}${db} aggregator node...`);
      await this.serverNode.add(this.aggregatorNode);
      this.log.debug(`Added dynamic plugin ${plg}${plugin.name}${db} aggregator node`);
      await this.serverNode.construction.ready;
      await this.aggregatorNode.construction.ready;
      this.log.debug(`Created dynamic plugin ${plg}${plugin.name}${db} server node`);
    }
    return this.serverNode;
  }

  /**
   * Creates and configures the server node for a single not bridged device.
   *
   * @param {Plugin | PluginName} pluginOrName - The plugin, or its name, to configure.
   * @param {MatterbridgeEndpoint} device - The device to associate with the plugin.
   * @returns {Promise<ServerNode<ServerNode.RootEndpoint> | undefined>} A promise that resolves to the server node for the device with mode server.
   */
  async createDeviceServerNode(pluginOrName: Plugin | PluginName, device: MatterbridgeEndpoint): Promise<ServerNode | undefined> {
    const plugin = typeof pluginOrName === 'string' ? this.pluginManager.get(pluginOrName) : pluginOrName;
    if (!plugin) throw new Error(`Plugin ${BLUE}${this.pluginName}${er} not found`);
    if (device.mode === 'server' && device.deviceType && device.deviceName && device.vendorId && device.vendorName && device.productId && device.productName) {
      this.log.debug(`Creating device ${plg}${plugin.name}${db}:${dev}${device.deviceName}${db} server node...`);
      this.matterStorageContext = await this.createServerNodeContext(
        device.deviceName.replace(/[ .]/g, ''),
        device.deviceName,
        DeviceTypeId(device.deviceType),
        VendorId(device.vendorId),
        device.vendorName,
        device.productId,
        device.productName,
        device.serialNumber,
        device.uniqueId,
        device.softwareVersion,
        device.softwareVersionString,
        device.hardwareVersion,
        device.hardwareVersionString,
        device.productLabel,
        device.productUrl,
        device.configurationVersion,
      );
      this.serverNode = await this.createServerNode(this.port, this.passcode, this.discriminator);
      this.log.debug(`Adding ${plg}${plugin.name}${db}:${dev}${device.deviceName}${db} to server node...`);
      await this.serverNode.add(device);
      this.log.debug(`Added ${plg}${plugin.name}${db}:${dev}${device.deviceName}${db} to server node`);
      await this.serverNode.construction.ready;
      await device.construction.ready;
      this.log.debug(`Created device ${plg}${plugin.name}${db}:${dev}${device.deviceName}${db} server node`);
    }
    return this.serverNode;
  }

  /**
   * Adds a MatterbridgeEndpoint to the specified plugin.
   *
   * @param {string} pluginName - The name of the plugin.
   * @param {MatterbridgeEndpoint} device - The device to add as a bridged endpoint.
   * @returns {Promise<MatterbridgeEndpoint | undefined>} A promise that resolves to the added bridged endpoint, or undefined if there was an error.
   */
  async addBridgedEndpoint(pluginName: string, device: MatterbridgeEndpoint): Promise<MatterbridgeEndpoint | undefined> {
    // Check if the plugin is registered
    const plugin = this.pluginManager.get(pluginName);
    if (!plugin) throw new Error(`Error adding bridged endpoint ${plg}${pluginName}${er}:${dev}${device.deviceName}${er} (${zb}${device.name}${er}): plugin not found`);
    if (device.mode === 'server') {
      try {
        this.log.debug(`Creating MatterNode for device ${plg}${pluginName}${db}:${dev}${device.deviceName}${db} (${zb}${device.name}${db})...`);
        // Create the MatterNode to manage the device
        const matterNode = new MatterNode(this.matterbridge, pluginName, device);
        this.dependantMatterNodes.set(device.id, matterNode);
        await matterNode.create();
        this.log.debug(`Created MatterNode for device ${plg}${pluginName}${db}:${dev}${device.deviceName}${db} (${zb}${device.name}${db})`);
      } catch (error) {
        inspectError(this.log, `Error creating MatterNode for device ${plg}${pluginName}${er}:${dev}${device.deviceName}${er} (${zb}${device.name}${er})`, error);
        return undefined;
      }
    } else if (this.matterbridge.bridgeMode === 'bridge') {
      if (device.mode === 'matter') {
        // Register and add the device to the Matter server node
        this.log.debug(`Adding matter endpoint ${plg}${pluginName}${db}:${dev}${device.deviceName}${db} (${zb}${device.name}${db})...`);
        if (!this.serverNode) throw new Error(`Server node not found for matter endpoint ${plg}${pluginName}${er}:${dev}${device.deviceName}${er} (${zb}${device.name}${er})`);
        try {
          await this.serverNode.add(device);
        } catch (error) {
          inspectError(this.log, `Matter error adding matter endpoint ${plg}${pluginName}${er}:${dev}${device.deviceName}${er} (${zb}${device.name}${er})`, error);
          return undefined;
        }
      } else {
        // Register and add the device to the Matter aggregator node
        this.log.debug(`Adding bridged endpoint ${plg}${pluginName}${db}:${dev}${device.deviceName}${db} (${zb}${device.name}${db})...`);
        if (!this.aggregatorNode) throw new Error(`Aggregator node not found for endpoint ${plg}${pluginName}${er}:${dev}${device.deviceName}${er} (${zb}${device.name}${er})`);
        try {
          await this.aggregatorNode.add(device);
        } catch (error) {
          inspectError(this.log, `Matter error adding bridged endpoint ${plg}${pluginName}${er}:${dev}${device.deviceName}${er} (${zb}${device.name}${er})`, error);
          return undefined;
        }
      }
    } else if (this.matterbridge.bridgeMode === 'childbridge') {
      // Register and add the device to the plugin server node
      if (plugin.type === 'AccessoryPlatform') {
        try {
          this.log.debug(`Adding accessory endpoint ${plg}${pluginName}${db}:${dev}${device.deviceName}${db} (${zb}${device.name}${db})...`);
          if (this.serverNode) {
            await this.serverNode.add(device);
          } else {
            await this.createAccessoryPlugin(plugin, device);
          }
        } catch (error) {
          inspectError(this.log, `Matter error adding accessory endpoint ${plg}${pluginName}${er}:${dev}${device.deviceName}${er} (${zb}${device.name}${er})`, error);
          return undefined;
        }
      }
      // Register and add the device to the plugin aggregator node
      if (plugin.type === 'DynamicPlatform') {
        try {
          this.log.debug(`Adding bridged endpoint ${plg}${pluginName}${db}:${dev}${device.deviceName}${db} (${zb}${device.name}${db})...`);
          if (!this.serverNode) {
            // Fast plugins can add another device before the server node is ready, so we wait for the server node to be ready
            await this.createDynamicPlugin(plugin);
          }
          if (device.mode === 'matter') await this.serverNode?.add(device);
          else await this.aggregatorNode?.add(device);
        } catch (error) {
          inspectError(this.log, `Matter error adding bridged endpoint ${plg}${pluginName}${er}:${dev}${device.deviceName}${er} (${zb}${device.name}${er})`, error);
          return undefined;
        }
      }
    }
    if (plugin.registeredDevices !== undefined) plugin.registeredDevices++;

    // Add the device to the DeviceManager
    await device.construction.ready;
    await this.server.fetch({ type: 'devices_set', src: this.server.name, dst: 'devices', params: { device: toBaseDevice(device) } });

    // Subscribe to the attributes changed event
    await this.subscribeAttributeChanged(plugin, device);
    this.log.info(`Added endpoint #${plugin.registeredDevices} ${plg}${pluginName}${nf}:${dev}${device.deviceName}${nf} (${zb}${device.name}${nf})`);
    await this.yieldToNode(10);
    return device;
  }

  /**
   * Removes a MatterbridgeEndpoint from the specified plugin.
   *
   * @param {string} pluginName - The name of the plugin.
   * @param {MatterbridgeEndpoint} device - The device to remove as a bridged endpoint.
   * @returns {Promise<MatterbridgeEndpoint | undefined>} A promise that resolves to the removed bridged endpoint, or undefined if there was an error.
   */
  async removeBridgedEndpoint(pluginName: string, device: MatterbridgeEndpoint): Promise<MatterbridgeEndpoint | undefined> {
    this.log.debug(`Removing bridged endpoint ${plg}${pluginName}${db}:${dev}${device.deviceName}${db} (${zb}${device.name}${db})...`);

    // Check if the plugin is registered
    const plugin = this.pluginManager.get(pluginName);
    if (!plugin) throw new Error(`Error removing bridged endpoint ${plg}${pluginName}${er}:${dev}${device.deviceName}${er} (${zb}${device.name}${er}): plugin not found`);

    if (device.mode === 'server') {
      // Close and remove the MatterNode managing the device. The MdnsService is managed by matter.js and closed when the last ServerNode closes.
      const matterNode = this.dependantMatterNodes.get(device.id);
      if (matterNode) {
        this.log.debug(`Closing MatterNode for device ${plg}${pluginName}${db}:${dev}${device.deviceName}${db} (${zb}${device.name}${db})...`);
        await matterNode.stop();
        await matterNode.destroy();
        this.dependantMatterNodes.delete(device.id);
        this.log.debug(`Closed MatterNode for device ${plg}${pluginName}${db}:${dev}${device.deviceName}${db} (${zb}${device.name}${db})`);
      }
    } else if (this.matterbridge.bridgeMode === 'bridge') {
      if (!this.aggregatorNode)
        throw new Error(`Error removing bridged endpoint ${plg}${pluginName}${er}:${dev}${device.deviceName}${er} (${zb}${device.name}${er}): aggregator node not found`);
      await device.delete();
    } else if (this.matterbridge.bridgeMode === 'childbridge') {
      if (plugin.type === 'AccessoryPlatform') {
        if (!this.serverNode) throw new Error(`Error removing endpoint ${plg}${pluginName}${er}:${dev}${device.deviceName}${er} (${zb}${device.name}${er}): server node not found`);
        await device.delete();
      } else if (plugin.type === 'DynamicPlatform') {
        if (!this.aggregatorNode)
          throw new Error(`Error removing bridged endpoint ${plg}${pluginName}${er}:${dev}${device.deviceName}${er} (${zb}${device.name}${er}): aggregator node not found`);
        await device.delete();
      }
    }
    this.log.info(`Removed bridged endpoint #${plugin.registeredDevices} ${plg}${pluginName}${nf}:${dev}${device.deviceName}${nf} (${zb}${device.name}${nf})`);
    if (plugin.registeredDevices !== undefined) plugin.registeredDevices--;
    // Remove the device from the DeviceManager
    await this.server.fetch({ type: 'devices_remove', src: this.server.name, dst: 'devices', params: { device: toBaseDevice(device) } });
    await this.yieldToNode(10);
    return device;
  }

  /**
   * Removes all bridged endpoints from the specified plugin.
   *
   * @param {string} pluginName - The name of the plugin.
   * @param {number} [delay] - The delay in milliseconds between removing each bridged endpoint (default: 0).
   * @returns {Promise<void>} A promise that resolves when all bridged endpoints have been removed.
   *
   * @remarks
   * This method iterates through all devices in the DeviceManager and removes each bridged endpoint associated with the specified plugin.
   * It also applies a delay between each removal if specified.
   * The delay is useful to allow the controllers to receive a single subscription for each device removed.
   */
  async removeAllBridgedEndpoints(pluginName: string, delay: number = 0): Promise<void> {
    // Check if the plugin is registered
    const plugin = this.pluginManager.get(pluginName);
    if (!plugin) throw new Error(`Error removing all bridged endpoints for plugin ${plg}${pluginName}${er}: plugin not found`);
    this.log.debug(`Removing all #${plugin.registeredDevices} bridged endpoints for plugin ${plg}${pluginName}${db}${delay > 0 ? ` with delay ${delay} ms` : ''}...`);
    const devices = (await this.server.fetch({ type: 'devices_basearray', src: this.server.name, dst: 'devices', params: { pluginName } })).result.devices;
    for (const device of devices) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion typescript/prefer-nullish-coalescing
      const endpoint = (this.aggregatorNode?.parts.get(device.id || '') || this.serverNode?.parts.get(device.id || '')) as MatterbridgeEndpoint | undefined;
      if (!endpoint) throw new Error(`Endpoint ${plg}${pluginName}${er}:${dev}${device.deviceName}${er} id ${device.id} not found removing all endpoints`);
      this.log.debug(`Removing bridged endpoint ${plg}${pluginName}${db}:${dev}${device.deviceName}${db} (${zb}${endpoint?.name}${db})...`);
      await endpoint.delete();
      this.log.info(`Removed bridged endpoint #${plugin.registeredDevices} ${plg}${pluginName}${nf}:${dev}${device.deviceName}${nf} (${zb}${endpoint?.name}${nf})`);
      if (plugin.registeredDevices !== undefined) plugin.registeredDevices--;
      // Remove the device from the DeviceManager
      await this.server.fetch({ type: 'devices_remove', src: this.server.name, dst: 'devices', params: { device: toBaseDevice(device) } });
      await this.yieldToNode(10);
      if (delay > 0) await wait(delay);
    }
    if (delay > 0) await wait(Number(process.env['MATTERBRIDGE_REMOVE_ALL_ENDPOINT_TIMEOUT_MS']) || 2000);
  }

  /**
   * Registers a virtual device with the Matterbridge platform.
   * Virtual devices are only supported in bridge mode and childbridge mode with a DynamicPlatform.
   *
   * The virtual device is created as an instance of `Endpoint` with the provided device type.
   * When the virtual device is turned on, the provided callback function is executed.
   * The onOff state of the virtual device always reverts to false when the device is turned on.
   *
   * @param {string} pluginName - The name of the plugin.
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
  async addVirtualEndpoint(pluginName: string, name: string, type: 'light' | 'outlet' | 'switch' | 'mounted_switch', callback: () => Promise<void>): Promise<boolean> {
    this.log.debug(`Creating virtual device ${plg}${pluginName}${db}:${dev}${name}${db}...`);
    const plugin = this.pluginManager.get(pluginName);
    if (!plugin) {
      this.log.error(`Error adding virtual endpoint ${plg}${pluginName}${er}:${dev}${name}${er}: plugin not found`);
      return false;
    }
    if (this.matterbridge.bridgeMode === 'childbridge' && plugin.type !== 'DynamicPlatform') {
      this.log.error(`Virtual devices are only supported in bridge mode and childbridge mode with a DynamicPlatform`);
      return false;
    }
    if (!this.aggregatorNode) {
      this.log.error(`Aggregator node not found for plugin ${plg}${plugin.name}${er} adding virtual endpoint ${dev}${name}${er}`);
      return false;
    }
    if (this.aggregatorNode.parts.has(name.replaceAll(' ', '') + ':' + type)) {
      this.log.error(`Virtual device ${plg}${pluginName}${er}:${dev}${name}${er} already registered. Please use a different name.`);
      return false;
    }
    await addVirtualDevice(this.aggregatorNode, name.slice(0, 32), type, callback);
    this.log.debug(`Created virtual device ${plg}${pluginName}${db}:${dev}${name}${db}`);
    await this.yieldToNode(10);
    return true;
  }

  /**
   * Subscribes to the attribute change event for the given device and plugin.
   * Specifically, it listens for changes in the 'reachable' attribute of the
   * BridgedDeviceBasicInformationServer cluster server of the bridged device or BasicInformationServer cluster server of server node.
   *
   * @param {Plugin} plugin - The plugin associated with the device.
   * @param {MatterbridgeEndpoint} device - The device to subscribe to attribute changes for.
   * @returns {Promise<void>} A promise that resolves when the subscription is set up.
   */
  // oxlint-disable-next-line typescript/require-await
  async subscribeAttributeChanged(plugin: Plugin, device: MatterbridgeEndpoint): Promise<void> {
    if (!plugin || !device?.plugin || !device.serialNumber || !device.uniqueId || !device.maybeNumber) return;
    this.log.debug(
      `Subscribing attributes for endpoint ${plg}${plugin.name}${db}:${dev}${device.deviceName}${db}:${or}${device.id}${db}:${or}${device.number}${db} (${zb}${device.name}${db})`,
    );
    // Subscribe to the reachable$Changed event of the BasicInformationServer cluster server of the server node in childbridge mode
    if (this.matterbridge.bridgeMode === 'childbridge' && plugin.type === 'AccessoryPlatform' && this.serverNode) {
      this.serverNode.eventsOf(BasicInformationServer).reachable$Changed?.on((reachable: boolean) => {
        if (!device.plugin || !device.serialNumber || !device.uniqueId) return;
        this.log.debug(
          `Accessory endpoint ${plg}${plugin.name}${nf}:${dev}${device.deviceName}${nf}:${or}${device.id}${nf}:${or}${device.number}${nf} is ${reachable ? 'reachable' : 'unreachable'}`,
        );
        this.server.request({
          type: 'frontend_attributechanged',
          src: 'matter',
          dst: 'frontend',

          params: {
            plugin: device.plugin,
            serialNumber: device.serialNumber,
            uniqueId: device.uniqueId,
            number: device.number,
            id: device.id,
            cluster: 'BasicInformation',
            attribute: 'reachable',
            value: reachable,
          },
        });
      });
    }

    const subscriptions: { cluster: string; attribute: string }[] = [
      { cluster: 'BridgedDeviceBasicInformation', attribute: 'reachable' },
      { cluster: 'OnOff', attribute: 'onOff' },
      { cluster: 'LevelControl', attribute: 'currentLevel' },
      { cluster: 'ColorControl', attribute: 'colorMode' },
      { cluster: 'ColorControl', attribute: 'currentHue' },
      { cluster: 'ColorControl', attribute: 'currentSaturation' },
      { cluster: 'ColorControl', attribute: 'currentX' },
      { cluster: 'ColorControl', attribute: 'currentY' },
      { cluster: 'ColorControl', attribute: 'colorTemperatureMireds' },
      { cluster: 'Thermostat', attribute: 'localTemperature' },
      { cluster: 'Thermostat', attribute: 'occupiedCoolingSetpoint' },
      { cluster: 'Thermostat', attribute: 'occupiedHeatingSetpoint' },
      { cluster: 'Thermostat', attribute: 'systemMode' },
      { cluster: 'Thermostat', attribute: 'thermostatRunningMode' },
      { cluster: 'Thermostat', attribute: 'thermostatRunningState' },
      { cluster: 'WindowCovering', attribute: 'operationalStatus' },
      { cluster: 'WindowCovering', attribute: 'currentPositionLiftPercent100ths' },
      { cluster: 'DoorLock', attribute: 'lockState' },
      { cluster: 'PumpConfigurationAndControl', attribute: 'pumpStatus' },
      { cluster: 'FanControl', attribute: 'fanMode' },
      { cluster: 'FanControl', attribute: 'fanModeSequence' },
      { cluster: 'FanControl', attribute: 'percentSetting' },
      { cluster: 'FanControl', attribute: 'percentCurrent' },
      { cluster: 'ModeSelect', attribute: 'currentMode' },
      { cluster: 'RvcRunMode', attribute: 'currentMode' },
      { cluster: 'RvcCleanMode', attribute: 'currentMode' },
      { cluster: 'RvcOperationalState', attribute: 'operationalState' },
      { cluster: 'RvcOperationalState', attribute: 'operationalError' },
      { cluster: 'ServiceArea', attribute: 'currentArea' },
      { cluster: 'AirQuality', attribute: 'airQuality' },
      { cluster: 'TotalVolatileOrganicCompoundsConcentrationMeasurement', attribute: 'measuredValue' },
      { cluster: 'BooleanState', attribute: 'stateValue' },
      { cluster: 'OccupancySensing', attribute: 'occupancy' },
      { cluster: 'IlluminanceMeasurement', attribute: 'measuredValue' },
      { cluster: 'TemperatureMeasurement', attribute: 'measuredValue' },
      { cluster: 'RelativeHumidityMeasurement', attribute: 'measuredValue' },
      { cluster: 'PressureMeasurement', attribute: 'measuredValue' },
      { cluster: 'FlowMeasurement', attribute: 'measuredValue' },
      { cluster: 'SmokeCoAlarm', attribute: 'smokeState' },
      { cluster: 'SmokeCoAlarm', attribute: 'coState' },
    ];
    for (const sub of subscriptions) {
      if (device.hasAttributeServer(sub.cluster, sub.attribute)) {
        this.log.debug(
          `Subscribing to endpoint ${plg}${plugin.name}${db}:${dev}${device.deviceName}${db}:${or}${device.id}${db}:${or}${device.number}${db} attribute ${dev}${sub.cluster}${db}.${dev}${sub.attribute}${db} changes...`,
        );
        device.subscribeAttribute(sub.cluster, sub.attribute, (value: number | string | boolean | null) => {
          if (!device.plugin || !device.serialNumber || !device.uniqueId) return;
          this.log.debug(
            `Bridged endpoint ${plg}${plugin.name}${db}:${dev}${device.deviceName}${db}:${or}${device.id}${db}:${or}${device.number}${db} attribute ${dev}${sub.cluster}${db}.${dev}${sub.attribute}${db} changed to ${CYAN}${isValidObject(value) ? debugStringify(value) : value}${db}`,
          );
          this.server.request({
            type: 'frontend_attributechanged',
            src: 'matter',
            dst: 'frontend',
            params: {
              plugin: device.plugin,
              serialNumber: device.serialNumber,
              uniqueId: device.uniqueId,
              number: device.number,
              id: device.id,
              cluster: sub.cluster,
              attribute: sub.attribute,
              value: value,
            },
          });
        });
      }
      for (const child of device.getChildEndpoints()) {
        if (child.hasAttributeServer(sub.cluster, sub.attribute)) {
          this.log.debug(
            `Subscribing to child endpoint ${plg}${plugin.name}${db}:${dev}${device.deviceName}${db}:${or}${child.id}${db}:${or}${child.number}${db} attribute ${dev}${sub.cluster}${db}.${dev}${sub.attribute}${db} changes...`,
          );
          child.subscribeAttribute(sub.cluster, sub.attribute, (value: number | string | boolean | null) => {
            if (!device.plugin || !device.serialNumber || !device.uniqueId) return;
            this.log.debug(
              `Bridged child endpoint ${plg}${plugin.name}${db}:${dev}${device.deviceName}${db}:${or}${child.id}${db}:${or}${child.number}${db} attribute ${dev}${sub.cluster}${db}.${dev}${sub.attribute}${db} changed to ${CYAN}${isValidObject(value) ? debugStringify(value) : value}${db}`,
            );
            this.server.request({
              type: 'frontend_attributechanged',
              src: 'matter',
              dst: 'frontend',
              params: {
                plugin: device.plugin,
                serialNumber: device.serialNumber,
                uniqueId: device.uniqueId,
                number: child.number,
                id: child.id,
                cluster: sub.cluster,
                attribute: sub.attribute,
                value: value,
              },
            });
          });
        }
      }
    }
  }

  /**
   * Sets the reachability of the specified server node and trigger the corresponding event.
   *
   * @param {boolean} reachable - A boolean indicating the reachability status to set.
   */
  async setServerReachability(reachable: boolean): Promise<void> {
    await this.serverNode?.setStateOf(BasicInformationServer, { reachable });
    this.serverNode?.act((agent) => this.serverNode?.eventsOf(BasicInformationServer).reachableChanged?.emit({ reachableNewValue: reachable }, agent.context));
  }

  /**
   * Sets the reachability of the specified aggregator node bridged devices and trigger.
   *
   * @param {Endpoint<AggregatorEndpoint>} aggregatorNode - The aggregator node to set the reachability for.
   * @param {boolean} reachable - A boolean indicating the reachability status to set.
   */
  async setAggregatorReachability(aggregatorNode: Endpoint<AggregatorEndpoint>, reachable: boolean): Promise<void> {
    for (const child of aggregatorNode.parts) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      this.log.debug(`Setting reachability of ${(child as unknown as MatterbridgeEndpoint)?.deviceName} to ${reachable}`);
      await child.setStateOf(BridgedDeviceBasicInformationServer, { reachable });
      child.act((agent) => child.eventsOf(BridgedDeviceBasicInformationServer).reachableChanged.emit({ reachableNewValue: true }, agent.context));
    }
  }

  /**
   * Sends a plugin status update to the global plugin manager and to the frontend.
   *
   * @param {string} pluginName - The name of the plugin.
   * @param {PluginStatusUpdate} status - The status properties to update.
   * @returns {void}
   */
  pluginStatusUpdate(pluginName: string, status: PluginStatusUpdate): void {
    // Update the global plugin manager the frontend api plugins come from
    this.server.request({ type: 'plugins_set', src: 'matter', dst: 'plugins', params: { plugin: { name: pluginName, ...status } } });
    this.server.request({
      type: 'frontend_broadcast_message',
      src: 'matter',
      dst: 'frontend',
      params: { msg: { id: 0, src: 'Matterbridge', dst: 'Frontend', method: 'plugin_status_update', success: true, response: { plugin: pluginName, status } } },
    });
  }

  /**
   * Sends a matterbridge status update to the frontend.
   *
   * @param {BridgeStatus} status - The new matterbridge status.
   * @returns {void}
   */
  matterbridgeStatusUpdate(status: BridgeStatus): void {
    this.server.request({
      type: 'frontend_broadcast_message',
      src: 'matter',
      dst: 'frontend',
      params: { msg: { id: 0, src: 'Matterbridge', dst: 'Frontend', method: 'matterbridge_status_update', success: true, response: { status } } },
    });
  }

  /**
   * Yield to the Node.js event loop:
   * 1. Flushes the current microtask queue (Promise/async continuations queued so far).
   * 2. Yields one macrotask turn (setImmediate) and then its microtasks.
   * 3. Waits a bit (setTimeout) to allow other macrotasks to run.
   *
   * This does **not** guarantee that every promise in the process is settled,
   * but it gives all already-scheduled work a very good chance to run before continuing.
   *
   * @param {number} [timeout] - Optional timeout in milliseconds to wait after yielding. Default is 10 ms (minimum 10 ms).
   * @returns {Promise<void>}
   */
  async yieldToNode(timeout: number = 10): Promise<void> {
    // 1. Let all currently queued microtasks run
    await Promise.resolve();

    // 2. Yield to the next event-loop turn (macrotask + its microtasks)
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });

    // 3. Pause to allow other macrotasks to run
    await new Promise<void>((resolve) => {
      setTimeout(resolve, Math.min(timeout, 10));
    });
  }
}
