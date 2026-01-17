/**
 * This file contains the class MatterNode.
 *
 * @file matterNode.ts
 * @author Luca Liguori
 * @created 2025-10-01
 * @version 1.0.0
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

// Node modules
import path from 'node:path';
import fs from 'node:fs';
import EventEmitter from 'node:events';

// AnsiLogger module
import { AnsiLogger, BLUE, CYAN, db, debugStringify, er, LogLevel, nf, or, TimestampFormat, zb } from 'node-ansi-logger';
// Node persist manager module
import { NodeStorageManager } from 'node-persist-manager';
// @matter
import '@matter/nodejs';
import { Logger, Diagnostic, LogLevel as MatterLogLevel, LogFormat as MatterLogFormat, StorageContext, StorageManager, StorageService, UINT32_MAX, UINT16_MAX, Environment } from '@matter/general';
import { DeviceCertification, ExposedFabricInformation, MdnsService } from '@matter/protocol';
import { VendorId, DeviceTypeId } from '@matter/types';
import { ServerNode, Endpoint, SessionsBehavior } from '@matter/node';
import { AggregatorEndpoint } from '@matter/node/endpoints/aggregator';
import { BasicInformationServer } from '@matter/node/behaviors/basic-information';
import { BridgedDeviceBasicInformationServer } from '@matter/node/behaviors/bridged-device-basic-information';

// Matterbridge
import type { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { SharedMatterbridge, ApiMatter, Plugin, SanitizedExposedFabricInformation, SanitizedSession, dev, MATTER_LOGGER_FILE, MATTER_STORAGE_NAME, plg, PluginName, NODE_STORAGE_DIR, MATTERBRIDGE_LOGGER_FILE } from './matterbridgeTypes.js';
import { bridge } from './matterbridgeDeviceTypes.js';
import { getIntParameter, getParameter, hasParameter } from './utils/commandLine.js';
import { copyDirectory } from './utils/copyDirectory.js';
import { isValidNumber, isValidString, parseVersionString } from './utils/isValid.js';
import { wait, withTimeout } from './utils/wait.js';
import { inspectError } from './utils/error.js';
import { BroadcastServer } from './broadcastServer.js';
import { WorkerMessage } from './broadcastServerTypes.js';
import { toBaseDevice } from './deviceManager.js';
import { PluginManager } from './pluginManager.js';
import type { Matterbridge } from './matterbridge.js';
import { MatterbridgePlatform } from './matterbridgePlatform.js';
import { addVirtualDevice } from './helpers.js';

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
  private readonly log = new AnsiLogger({ logName: 'MatterNode', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });
  /** Matter logger */
  private readonly matterLog = new AnsiLogger({ logName: 'MatterNode', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });

  /** Matter environment default */
  private readonly environment = Environment.default;

  /** Matter storage id */
  storeId: string | undefined;
  /** Matter mdns service from environment default */
  matterMdnsService: MdnsService | undefined;
  /** Matter storage service from environment default */
  matterStorageService: StorageService | undefined;
  /** Matter storage manager created with name 'Matterbridge' */
  matterStorageManager: StorageManager | undefined;
  /** Matter storage context created in the storage manager with name 'persist' */
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
  serverNode: ServerNode<ServerNode.RootEndpoint> | undefined;
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

  /** Advertising nodes map: time advertising started keyed by storeId */
  advertisingNodes = new Map<string, number>();

  /** Plugins */
  readonly pluginManager: PluginManager;

  /** Dependant MatterNodes keyed by device id */
  readonly dependantMatterNodes = new Map<string, MatterNode>();

  /** Broadcast server */
  private readonly server: BroadcastServer;
  private readonly debug = hasParameter('debug') || hasParameter('verbose');
  private readonly verbose = hasParameter('verbose');

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
    this.log.logNameColor = '\x1b[38;5;65m';
    if (this.debug) this.log.debug(`MatterNode ${this.pluginName ? 'for plugin ' + this.pluginName : 'bridge'} loading...`);

    // Setup Matter parameters
    this.port = matterbridge.port;
    this.passcode = matterbridge.passcode;
    this.discriminator = matterbridge.discriminator;

    // Setup the broadcast server
    this.server = new BroadcastServer('matter', this.log);
    this.server.on('broadcast_message', this.msgHandler.bind(this));
    if (this.verbose) this.log.debug(`BroadcastServer is ready`);

    // Ensure the matterbridge directory exists
    fs.mkdirSync(matterbridge.matterbridgeDirectory, { recursive: true });

    // Setup the plugin manager with thread server closed
    this.pluginManager = new PluginManager(this.matterbridge as Matterbridge);
    this.pluginManager.logLevel = this.debug ? LogLevel.DEBUG : LogLevel.INFO;
    // @ts-expect-error access private property
    this.pluginManager.server.close();
    if (this.verbose) this.log.debug(`PluginManager is ready`);

    // Setup the matter environment
    this.environment.vars.set('log.level', MatterLogLevel.DEBUG);
    this.environment.vars.set('log.format', MatterLogFormat.ANSI);
    this.environment.vars.set('path.root', path.join(matterbridge.matterbridgeDirectory, MATTER_STORAGE_NAME));
    this.environment.vars.set('runtime.signals', false);
    this.environment.vars.set('runtime.exitcode', false);
    if (this.verbose) this.log.debug(`Matter Environment is ready`);

    // Ensure MdnsService is registered in the default environment
    this.matterMdnsService = new MdnsService(this.environment);
    setImmediate(async () => {
      await this.matterMdnsService?.construction.ready;
      if (this.verbose) this.log.debug(`Matter MdnsService is ready`);
    });

    // Setup the matterbridge logger
    if (this.matterbridge.fileLogger) {
      AnsiLogger.setGlobalLogfile(path.join(this.matterbridge.matterbridgeDirectory, MATTERBRIDGE_LOGGER_FILE), this.matterbridge.logLevel);
    }

    // Setup the matter logger
    Logger.destinations.default.write = this.createDestinationMatterLogger();
    const levels = ['debug', 'info', 'notice', 'warn', 'error', 'fatal'] as const;
    if (this.verbose) this.log.debug(`Matter logLevel: ${levels[Logger.level as MatterLogLevel]} fileLogger: ${matterbridge.matterFileLogger}.`);

    if (this.debug) this.log.debug(`MatterNode ${this.pluginName ? 'for plugin ' + this.pluginName : 'bridge'} loaded`);
  }

  /**
   * Handles incoming messages from the broadcast server.
   *
   * @param {WorkerMessage} msg - The incoming message.
   */
  async msgHandler(msg: WorkerMessage) {
    if (this.server.isWorkerRequest(msg) && (msg.dst === 'all' || msg.dst === 'matter')) {
      if (this.verbose) this.log.debug(`Received broadcast request ${CYAN}${msg.type}${db} from ${CYAN}${msg.src}${db}: ${debugStringify(msg)}${db}`);
      switch (msg.type) {
        case 'get_log_level':
          this.server.respond({ ...msg, result: { logLevel: this.log.logLevel } });
          break;
        case 'set_log_level':
          this.log.logLevel = msg.params.logLevel;
          this.server.respond({ ...msg, result: { logLevel: this.log.logLevel } });
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
          break;
        default:
          if (this.verbose) this.log.debug(`Unknown broadcast response ${CYAN}${msg.type}${db} from ${CYAN}${msg.src}${db}`);
      }
    }
  }

  /**
   * Destroys the Matter instance.
   * It closes the mDNS service and the broadcast server.
   *
   * @param {boolean} closeMdns - Whether to close the mDNS service. Default is true.
   * @returns {Promise<void>} A promise that resolves when the instance is destroyed.
   */
  async destroy(closeMdns: boolean = true): Promise<void> {
    if (this.verbose) this.log.debug(`Destroying MatterNode instance for ${this.storeId}...`);

    // Close mDNS service
    if (closeMdns) {
      if (this.verbose) this.log.debug(`Closing Matter MdnsService for ${this.storeId}...`);
      await this.matterMdnsService?.close();
      if (this.verbose) this.log.debug(`Closed Matter MdnsService for ${this.storeId}`);
    }

    // Close the plugin manager
    this.pluginManager.destroy();

    // Close the broadcast server
    this.server.close();

    // Yield to the Node.js event loop to allow all resources to be released
    await this.yieldToNode();

    if (this.verbose) this.log.debug(`Destroyed MatterNode instance for ${this.storeId}`);
  }

  async create(): Promise<void> {
    this.log.info('Creating Matter node...');

    // Start matter storage
    await this.startMatterStorage();

    // Load plugins from storage
    // @ts-expect-error access private property
    this.pluginManager.matterbridge.nodeStorage = new NodeStorageManager({ dir: path.join(this.matterbridge.matterbridgeDirectory, NODE_STORAGE_DIR), writeQueue: false, expiredInterval: undefined, logging: false });
    // @ts-expect-error access private property
    this.pluginManager.matterbridge.nodeContext = await this.pluginManager.matterbridge.nodeStorage.createStorage('matterbridge');
    await this.pluginManager.loadFromStorage();

    // Create Matter node for a server mode device
    if (this.pluginName && this.device && this.device.deviceName) {
      this.log.debug(`Creating MatterNode instance for server node device ${CYAN}${this.device.deviceName}${db}...`);
      await this.createDeviceServerNode(this.pluginName, this.device);
      this.log.debug(`Created MatterNode instance for server node device ${CYAN}${this.device.deviceName}${db}`);
      this.emit('ready', this.device.deviceName.replace(/[ .]/g, ''));
      return;
    }

    if (!this.pluginName) {
      this.log.debug('Creating MatterNode instance for all plugins...');

      await this.createMatterbridgeServerNode();

      // Load all enabled plugins
      this.log.debug('Loading all plugins...');
      const loadPromises: Promise<MatterbridgePlatform | undefined>[] = [];
      for (const plugin of this.pluginManager.array().filter((p) => p.enabled)) {
        loadPromises.push(this.pluginManager.load(plugin));
      }
      await Promise.all(loadPromises);
      this.log.debug('Loaded all plugins');

      this.log.debug('Created MatterNode instance for all plugins');
      this.emit('ready', 'Matterbridge');
    } else {
      this.log.debug(`Creating MatterNode instance for plugin ${CYAN}${this.pluginName}${db}...`);

      // Load only the specified plugin
      this.log.debug(`Loading plugin ${CYAN}${this.pluginName}${db}...`);
      await this.pluginManager.load(this.pluginName);
      this.log.debug(`Loaded plugin ${CYAN}${this.pluginName}${db}`);

      this.log.debug(`Created MatterNode instance for plugin ${CYAN}${this.pluginName}${db}`);
      this.emit('ready', this.pluginName);
    }

    this.log.info('Created Matter node');
    await this.yieldToNode();
  }

  async start(): Promise<void> {
    if (!this.serverNode && !this.pluginName) throw new Error('Matter server node not created yet. Call create() first.');
    this.log.info('Starting MatterNode...');

    // Start Matter node for a server mode device
    if (this.pluginName && this.device && this.device.deviceName) {
      // Start the server node
      this.log.debug(`Starting MatterNode for server device ${this.pluginName}:${this.device.deviceName}...`);
      await this.startServerNode();
      this.log.debug(`Started MatterNode for server device ${this.pluginName}:${this.device.deviceName}`);
      return;
    }

    if (!this.pluginName) {
      // Start all loaded plugins
      this.log.debug('Starting all plugins...');
      const startPromises: Promise<Plugin | undefined>[] = [];
      for (const plugin of this.pluginManager.array().filter((p) => p.enabled && p.loaded)) {
        startPromises.push(this.pluginManager.start(plugin, 'Starting MatterNode'));
      }
      await Promise.all(startPromises);
      this.log.debug('Started all plugins');

      // Start the server node
      this.log.debug('Starting MatterNode for all plugins...');
      await this.startServerNode();
      this.log.debug('Started MatterNode for all plugins');

      // Configure all loaded plugins
      this.log.debug('Configuring all plugins...');
      const configurePromises: Promise<Plugin | undefined>[] = [];
      for (const plugin of this.pluginManager.array().filter((p) => p.enabled && p.started)) {
        configurePromises.push(this.pluginManager.configure(plugin));
      }
      await Promise.all(configurePromises);
      this.log.debug('Configured all plugins');
    } else {
      // Start the loaded plugin
      await this.pluginManager.start(this.pluginName, 'Starting MatterNode');

      // Start the server node
      this.log.debug(`Starting MatterNode for plugin ${this.pluginName}...`);
      await this.startServerNode();
      this.log.debug(`Started MatterNode for plugin ${this.pluginName}`);

      // Configure the plugin
      await this.pluginManager.configure(this.pluginName);
    }

    // Start the dependant MatterNodes
    this.log.debug(`Starting dependant MatterNodes...`);
    for (const dependantMatterNode of this.dependantMatterNodes.values()) {
      await dependantMatterNode.start();
    }
    this.log.debug(`Started dependant MatterNodes`);

    this.log.info('Started MatterNode');
    await this.yieldToNode();
  }

  async stop(): Promise<void> {
    if (!this.serverNode) throw new Error('Matter server node not created yet. Call create() first.');
    this.log.info('Stopping MatterNode...');

    // Stop Matter node for a server mode device
    if (this.pluginName && this.device && this.device.deviceName) {
      // Stop the server node
      this.log.debug(`Stopping MatterNode for server device ${this.pluginName}:${this.device.deviceName}...`);
      await this.stopServerNode();
      this.serverNode = undefined;
      this.aggregatorNode = undefined;
      await this.stopMatterStorage();
      await this.destroy(false); // Do not close mDNS since it is shared
      this.log.debug(`Stopped MatterNode for server device ${this.pluginName}:${this.device.deviceName}`);
      this.log.info('Stopped MatterNode');
      await this.yieldToNode();
      return;
    }

    if (!this.pluginName) {
      this.log.debug('Stopping all plugins...');

      const shutdownPromises: Promise<Plugin | undefined>[] = [];
      for (const plugin of this.pluginManager.array().filter((p) => p.enabled && p.started)) {
        shutdownPromises.push(this.pluginManager.shutdown(plugin, 'Stopping MatterNode'));
      }
      await Promise.all(shutdownPromises);

      this.log.debug('Stopped all plugins');
    } else {
      this.log.debug(`Stopping plugin ${this.pluginName}...`);

      await this.pluginManager.shutdown(this.pluginName, 'Stopping MatterNode');

      this.log.debug(`Stopped plugin ${this.pluginName}`);
    }

    // Stop the dependant MatterNodes
    this.log.debug(`Stopping dependant MatterNodes...`);
    for (const dependantMatterNode of this.dependantMatterNodes.values()) {
      await dependantMatterNode.stop();
    }
    this.log.debug(`Stopped dependant MatterNodes`);

    await this.stopServerNode();
    this.serverNode = undefined;
    this.aggregatorNode = undefined;

    await this.stopMatterStorage();

    this.log.info('Stopped MatterNode');
    await this.yieldToNode();
  }

  /**
   * Creates a MatterLogger function to show the matter.js log messages in AnsiLogger (console and frontend).
   * It also logs to file (matter.log) if fileLogger is true.
   *
   * @returns {Function} The MatterLogger function. \x1b[35m for violet \x1b[34m is blue
   */
  createDestinationMatterLogger(): (text: string, message: Diagnostic.Message) => void {
    this.matterLog.logNameColor = '\x1b[34m'; // Blue matter.js Logger
    if (this.matterbridge.matterFileLogger) {
      this.matterLog.logFilePath = path.join(this.matterbridge.matterbridgeDirectory, MATTER_LOGGER_FILE);
    }

    return (text: string, message: Diagnostic.Message) => {
      // 2024-08-21 08:55:19.488 DEBUG InteractionMessenger Sending DataReport chunk with 28 attributes and 0 events: 1004 bytes
      const logger = text.slice(44, 44 + 20).trim();
      const msg = text.slice(65);
      this.matterLog.logName = logger;
      this.matterLog.log(MatterLogLevel.names[message.level as number] as LogLevel, msg);
    };
  }

  /**
   * Starts the matter storage with name Matterbridge and performs a backup.
   *
   * @returns {Promise<void>} - A promise that resolves when the storage is started.
   */
  async startMatterStorage(): Promise<void> {
    // Setup Matter storage
    this.log.info(`Starting matter node storage...`);
    this.matterStorageService = this.environment.get(StorageService);
    this.log.info(`Started matter node storage in ${CYAN}${this.matterStorageService.location}${nf}`);

    // Backup matter storage since it is created/opened correctly
    await this.backupMatterStorage(path.join(this.matterbridge.matterbridgeDirectory, MATTER_STORAGE_NAME), path.join(this.matterbridge.matterbridgeDirectory, MATTER_STORAGE_NAME + '.backup'));
  }

  /**
   * Makes a backup copy of the specified matter storage directory.
   *
   * @param {string} storageName - The name of the storage directory to be backed up.
   * @param {string} backupName - The name of the backup directory to be created.
   * @private
   * @returns {Promise<void>} A promise that resolves when the has been done.
   */
  async backupMatterStorage(storageName: string, backupName: string): Promise<void> {
    this.log.info(`Creating matter node storage backup from ${CYAN}${storageName}${nf} to ${CYAN}${backupName}${nf}...`);
    try {
      await copyDirectory(storageName, backupName);
      this.log.info('Created matter node storage backup');
    } catch (error) {
      // istanbul ignore next if
      if (error instanceof Error && (error as NodeJS.ErrnoException)?.code === 'ENOENT') {
        this.log.info(`No matter node storage found to backup from ${CYAN}${storageName}${nf} to ${CYAN}${backupName}${nf}`);
      } else {
        this.log.error(`Error creating matter node storage backup from ${storageName} to ${backupName}:`, error);
      }
    }
  }

  /**
   * Stops the matter storage.
   *
   * @returns {Promise<void>} A promise that resolves when the storage is stopped.
   */
  async stopMatterStorage(): Promise<void> {
    this.log.info('Closing matter node storage...');
    await this.matterStorageManager?.close();
    this.matterStorageService = undefined;
    this.matterStorageManager = undefined;
    this.matterStorageContext = undefined;
    this.log.info('Closed matter node storage');
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
   * @returns {Promise<StorageContext>} The storage context for the commissioning server.
   * @throws {Error} If the storage service is not initialized.
   */
  async createServerNodeContext(storeId: string, deviceName: string, deviceType: DeviceTypeId, vendorId: VendorId, vendorName: string, productId: number, productName: string, serialNumber?: string, uniqueId?: string): Promise<StorageContext> {
    if (!this.matterStorageService) {
      throw new Error('No storage service initialized');
    }
    const { randomBytes } = await import('node:crypto');

    this.log.info(`Creating server node storage context "${storeId}.persist" for ${storeId}...`);
    const storageManager = await this.matterStorageService.open(storeId);
    const storageContext = storageManager.createContext('persist');
    const random = randomBytes(8).toString('hex');
    await storageContext.set('storeId', storeId);
    await storageContext.set('deviceName', deviceName);
    await storageContext.set('deviceType', deviceType);
    await storageContext.set('vendorId', vendorId);
    await storageContext.set('vendorName', vendorName.slice(0, 32));
    await storageContext.set('productId', productId);
    await storageContext.set('productName', productName.slice(0, 32));
    await storageContext.set('nodeLabel', productName.slice(0, 32));
    await storageContext.set('productLabel', productName.slice(0, 32));
    await storageContext.set('serialNumber', await storageContext.get('serialNumber', serialNumber ? serialNumber.slice(0, 32) : 'SN' + random));
    await storageContext.set('uniqueId', await storageContext.get('uniqueId', uniqueId ? uniqueId.slice(0, 32) : 'UI' + random));
    await storageContext.set('softwareVersion', isValidNumber(parseVersionString(this.matterbridge.matterbridgeVersion), 0, UINT32_MAX) ? parseVersionString(this.matterbridge.matterbridgeVersion) : 1);
    await storageContext.set('softwareVersionString', isValidString(this.matterbridge.matterbridgeVersion, 5, 64) ? this.matterbridge.matterbridgeVersion : '1.0.0');
    await storageContext.set('hardwareVersion', isValidNumber(parseVersionString(this.matterbridge.systemInformation.osRelease), 0, UINT16_MAX) ? parseVersionString(this.matterbridge.systemInformation.osRelease) : 1);
    await storageContext.set('hardwareVersionString', isValidString(this.matterbridge.systemInformation.osRelease, 5, 64) ? this.matterbridge.systemInformation.osRelease : '1.0.0');

    this.log.debug(`Created server node storage context "${storeId}.persist" for ${storeId}:`);
    this.log.debug(`- storeId: ${await storageContext.get('storeId')}`);
    this.log.debug(`- deviceName: ${await storageContext.get('deviceName')}`);
    this.log.debug(`- deviceType: ${await storageContext.get('deviceType')}(0x${(await storageContext.get('deviceType'))?.toString(16).padStart(4, '0')})`);
    this.log.debug(`- vendorId: ${await storageContext.get('vendorId')}`);
    this.log.debug(`- vendorName: ${await storageContext.get('vendorName')}`);
    this.log.debug(`- productId: ${await storageContext.get('productId')}`);
    this.log.debug(`- productName: ${await storageContext.get('productName')}`);
    this.log.debug(`- nodeLabel: ${await storageContext.get('nodeLabel')}`);
    this.log.debug(`- productLabel: ${await storageContext.get('productLabel')}`);
    this.log.debug(`- serialNumber: ${await storageContext.get('serialNumber')}`);
    this.log.debug(`- uniqueId: ${await storageContext.get('uniqueId')}`);
    this.log.debug(`- softwareVersion: ${await storageContext.get('softwareVersion')}`);
    this.log.debug(`- softwareVersionString: ${await storageContext.get('softwareVersionString')}`);
    this.log.debug(`- hardwareVersion: ${await storageContext.get('hardwareVersion')}`);
    this.log.debug(`- hardwareVersionString: ${await storageContext.get('hardwareVersionString')}`);
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
  async createServerNode(port: number = 5540, passcode: number = 20252026, discriminator: number = 3850): Promise<ServerNode<ServerNode.RootEndpoint>> {
    if (!this.matterStorageContext) {
      throw new Error('Matter server node context not created yet. Call createServerNodeContext() first.');
    }
    const storeId = await this.matterStorageContext.get<string>('storeId');
    this.log.notice(`Creating server node for ${storeId} on port ${port} with passcode ${passcode} and discriminator ${discriminator}...`);

    /**
     * Create a Matter ServerNode, which contains the Root Endpoint and all relevant data and configuration
     */
    const serverNode = await ServerNode.create({
      // Required: Give the Node a unique ID which is used to store the state of this node
      id: storeId,

      // Provide the environment to run this node in
      environment: this.environment,

      // Provide Network relevant configuration like the port
      network: {
        listeningAddressIpv4: this.ipv4Address,
        listeningAddressIpv6: this.ipv6Address,
        port,
      },

      // Provide the certificate for the device
      operationalCredentials: {
        certification: this.certification,
      },

      // Provide Commissioning relevant settings
      commissioning: {
        passcode,
        discriminator,
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
        nodeLabel: await this.matterStorageContext.get<string>('nodeLabel'),

        serialNumber: await this.matterStorageContext.get<string>('serialNumber'),
        uniqueId: await this.matterStorageContext.get<string>('uniqueId'),

        softwareVersion: await this.matterStorageContext.get<number>('softwareVersion'),
        softwareVersionString: await this.matterStorageContext.get<string>('softwareVersionString'),
        hardwareVersion: await this.matterStorageContext.get<number>('hardwareVersion'),
        hardwareVersionString: await this.matterStorageContext.get<string>('hardwareVersionString'),

        reachable: true,
      },
    });

    /**
     * This event is triggered when the device is initially commissioned successfully.
     * This means: It is added to the first fabric.
     */
    serverNode.lifecycle.commissioned.on(() => {
      this.log.notice(`Server node for ${storeId} was initially commissioned successfully!`);
      this.advertisingNodes.delete(storeId);
      this.server.request({ type: 'frontend_refreshrequired', src: 'matter', dst: 'frontend', params: { changed: 'matter', matter: { ...this.getServerNodeData(serverNode) } } });
    });

    /** This event is triggered when all fabrics are removed from the device, usually it also does a factory reset then. */
    serverNode.lifecycle.decommissioned.on(() => {
      this.log.notice(`Server node for ${storeId} was fully decommissioned successfully!`);
      this.advertisingNodes.delete(storeId);
      this.server.request({ type: 'frontend_refreshrequired', src: 'matter', dst: 'frontend', params: { changed: 'matter', matter: { ...this.getServerNodeData(serverNode) } } });
      this.server.request({ type: 'frontend_snackbarmessage', src: 'matter', dst: 'frontend', params: { message: `${storeId} is offline`, timeout: 5, severity: 'warning' } });
    });

    /** This event is triggered when the device went online. This means that it is discoverable in the network. */
    serverNode.lifecycle.online.on(async () => {
      this.log.notice(`Server node for ${storeId} is online`);
      if (!serverNode.lifecycle.isCommissioned) {
        this.log.notice(`Server node for ${storeId} is not commissioned. Pair to commission ...`);
        this.advertisingNodes.set(storeId, Date.now());
        const { qrPairingCode, manualPairingCode } = serverNode.state.commissioning.pairingCodes;
        this.log.notice(`QR Code URL: https://project-chip.github.io/connectedhomeip/qrcode.html?data=${qrPairingCode}`);
        this.log.notice(`Manual pairing code: ${manualPairingCode}`);
      } else {
        this.log.notice(`Server node for ${storeId} is already commissioned. Waiting for controllers to connect ...`);
        this.advertisingNodes.delete(storeId);
      }
      this.server.request({ type: 'frontend_refreshrequired', src: 'matter', dst: 'frontend', params: { changed: 'matter', matter: { ...this.getServerNodeData(serverNode) } } });
      this.server.request({ type: 'frontend_snackbarmessage', src: 'matter', dst: 'frontend', params: { message: `${storeId} is online`, timeout: 5, severity: 'success' } });
      this.emit('online', storeId);
    });

    /** This event is triggered when the device went offline. it is not longer discoverable or connectable in the network. */
    serverNode.lifecycle.offline.on(() => {
      this.log.notice(`Server node for ${storeId} is offline`);
      this.advertisingNodes.delete(storeId);
      this.server.request({ type: 'frontend_refreshrequired', src: 'matter', dst: 'frontend', params: { changed: 'matter', matter: { ...this.getServerNodeData(serverNode) } } });
      this.server.request({ type: 'frontend_snackbarmessage', src: 'matter', dst: 'frontend', params: { message: `${storeId} is offline`, timeout: 5, severity: 'warning' } });
      this.emit('offline', storeId);
    });

    /**
     * This event is triggered when a fabric is added, removed or updated on the device. Use this if more granular
     * information is needed.
     */
    serverNode.events.commissioning.fabricsChanged.on((fabricIndex, fabricAction) => {
      let action = '';
      switch (fabricAction) {
        case 'added':
          this.advertisingNodes.delete(storeId); // The advertising stops when a fabric is added
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
      this.server.request({ type: 'frontend_refreshrequired', src: 'matter', dst: 'frontend', params: { changed: 'matter', matter: { ...this.getServerNodeData(serverNode) } } });
    });

    /**
     * This event is triggered when an operative new session was opened by a Controller.
     * It is not triggered for the initial commissioning process, just afterwards for real connections.
     */
    serverNode.events.sessions.opened.on((session) => {
      this.log.notice(`Session opened on server node for ${storeId}: ${debugStringify(session)}`);
      this.server.request({ type: 'frontend_refreshrequired', src: 'matter', dst: 'frontend', params: { changed: 'matter', matter: { ...this.getServerNodeData(serverNode) } } });
    });

    /**
     * This event is triggered when an operative session is closed by a Controller or because the Device goes offline.
     */
    serverNode.events.sessions.closed.on((session) => {
      this.log.notice(`Session closed on server node for ${storeId}: ${debugStringify(session)}`);
      this.server.request({ type: 'frontend_refreshrequired', src: 'matter', dst: 'frontend', params: { changed: 'matter', matter: { ...this.getServerNodeData(serverNode) } } });
    });

    /** This event is triggered when a subscription gets added or removed on an operative session. */
    serverNode.events.sessions.subscriptionsChanged.on((session) => {
      this.log.notice(`Session subscriptions changed on server node for ${storeId}: ${debugStringify(session)}`);
      this.server.request({ type: 'frontend_refreshrequired', src: 'matter', dst: 'frontend', params: { changed: 'matter', matter: { ...this.getServerNodeData(serverNode) } } });
    });

    this.storeId = storeId;
    this.log.info(`Created server node for ${this.storeId}`);
    return serverNode;
  }

  /**
   * Gets the matter serializable data of the specified server node.
   *
   * @param {ServerNode} [serverNode] - The server node to start.
   * @returns {ApiMatter} The serializable data of the server node.
   */
  getServerNodeData(serverNode: ServerNode<ServerNode.RootEndpoint>): ApiMatter {
    const advertiseTime = this.advertisingNodes.get(serverNode.id) || 0;
    return {
      id: serverNode.id,
      online: serverNode.lifecycle.isOnline,
      commissioned: serverNode.state.commissioning.commissioned,
      advertising: advertiseTime > Date.now() - 15 * 60 * 1000,
      advertiseTime,
      windowStatus: serverNode.state.administratorCommissioning.windowStatus,
      qrPairingCode: serverNode.state.commissioning.pairingCodes.qrPairingCode,
      manualPairingCode: serverNode.state.commissioning.pairingCodes.manualPairingCode,
      fabricInformations: this.sanitizeFabricInformations(Object.values(serverNode.state.commissioning.fabrics)),
      sessionInformations: this.sanitizeSessionInformation(Object.values(serverNode.state.sessions.sessions)),
      serialNumber: serverNode.state.basicInformation.serialNumber,
    };
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
      // istanbul ignore next
      this.log.error(`Failed to start ${this.serverNode.id} server node: ${error instanceof Error ? error.message : error}`);
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
      // istanbul ignore next
      this.log.error(`Failed to close ${this.serverNode.id} server node: ${error instanceof Error ? error.message : error}`);
    }
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
    const aggregatorNode = new Endpoint(AggregatorEndpoint, { id: `${await this.matterStorageContext.get<string>('storeId')}` });
    this.log.info(`Created ${await this.matterStorageContext.get<string>('storeId')} aggregator`);
    return aggregatorNode;
  }

  /**
   * Creates the matterbridge server node.
   *
   * @returns {Promise<ServerNode<ServerNode.RootEndpoint>>} A promise that resolves to the created matterbridge server node.
   */
  async createMatterbridgeServerNode(): Promise<ServerNode<ServerNode.RootEndpoint>> {
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
    );
    this.serverNode = await this.createServerNode(this.port ? this.port++ : undefined, this.passcode ? this.passcode++ : undefined, this.discriminator ? this.discriminator++ : undefined);
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
   * @param {Plugin | PluginName} plugin - The plugin to configure.
   * @param {MatterbridgeEndpoint} device - The device to associate with the plugin.
   * @returns {Promise<ServerNode<ServerNode.RootEndpoint> | undefined>} A promise that resolves to the server node for the accessory plugin.
   */
  async createAccessoryPlugin(plugin: Plugin | PluginName, device: MatterbridgeEndpoint): Promise<ServerNode<ServerNode.RootEndpoint> | undefined> {
    if (typeof plugin === 'string') {
      const _plugin = this.pluginManager.get(plugin);
      if (!_plugin) throw new Error(`Plugin ${BLUE}${this.pluginName}${er} not found`);
      plugin = _plugin;
    }
    if (!plugin.locked && device.deviceType && device.deviceName && device.vendorId && device.vendorName && device.productId && device.productName) {
      plugin.locked = true;
      this.log.debug(`Creating accessory plugin ${plg}${plugin.name}${db} server node...`);
      this.matterStorageContext = await this.createServerNodeContext(plugin.name, device.deviceName, DeviceTypeId(device.deviceType), VendorId(device.vendorId), device.vendorName, device.productId, device.productName);
      this.serverNode = await this.createServerNode(this.port ? this.port++ : undefined, this.passcode ? this.passcode++ : undefined, this.discriminator ? this.discriminator++ : undefined);
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
   * @param {Plugin | PluginName} plugin - The plugin to configure.
   * @returns {Promise<ServerNode<ServerNode.RootEndpoint> | undefined>} A promise that resolves to the server node for the dynamic plugin.
   */
  async createDynamicPlugin(plugin: Plugin | PluginName): Promise<ServerNode<ServerNode.RootEndpoint> | undefined> {
    if (typeof plugin === 'string') {
      const _plugin = this.pluginManager.get(plugin);
      if (!_plugin) throw new Error(`Plugin ${BLUE}${this.pluginName}${er} not found`);
      plugin = _plugin;
    }
    if (!plugin.locked) {
      plugin.locked = true;
      this.log.debug(`Creating dynamic plugin ${plg}${plugin.name}${db} server node...`);
      this.matterStorageContext = await this.createServerNodeContext(plugin.name, 'Matterbridge', this.aggregatorDeviceType, this.aggregatorVendorId, this.aggregatorVendorName, this.aggregatorProductId, plugin.description);
      this.serverNode = await this.createServerNode(this.port ? this.port++ : undefined, this.passcode ? this.passcode++ : undefined, this.discriminator ? this.discriminator++ : undefined);
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
   * @param {Plugin | PluginName} plugin - The plugin to configure.
   * @param {MatterbridgeEndpoint} device - The device to associate with the plugin.
   * @returns {Promise<ServerNode<ServerNode.RootEndpoint> | undefined>} A promise that resolves to the server node for the device with mode server.
   */
  async createDeviceServerNode(plugin: Plugin | PluginName, device: MatterbridgeEndpoint): Promise<ServerNode<ServerNode.RootEndpoint> | undefined> {
    if (typeof plugin === 'string') {
      const _plugin = this.pluginManager.get(plugin);
      if (!_plugin) throw new Error(`Plugin ${BLUE}${this.pluginName}${er} not found`);
      plugin = _plugin;
    }
    if (device.mode === 'server' && device.deviceType && device.deviceName && device.vendorId && device.vendorName && device.productId && device.productName) {
      this.log.debug(`Creating device ${plg}${plugin.name}${db}:${dev}${device.deviceName}${db} server node...`);
      this.matterStorageContext = await this.createServerNodeContext(device.deviceName.replace(/[ .]/g, ''), device.deviceName, DeviceTypeId(device.deviceType), VendorId(device.vendorId), device.vendorName, device.productId, device.productName);
      this.serverNode = await this.createServerNode(this.port ? this.port++ : undefined, this.passcode ? this.passcode++ : undefined, this.discriminator ? this.discriminator++ : undefined);
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
        matterNode.port = this.port ? this.port++ : undefined;
        matterNode.passcode = this.passcode ? this.passcode++ : undefined;
        matterNode.discriminator = this.discriminator ? this.discriminator++ : undefined;
        this.dependantMatterNodes.set(device.id, matterNode);
        await matterNode.create();
        this.log.debug(`Created MatterNode for device ${plg}${pluginName}${db}:${dev}${device.deviceName}${db} (${zb}${device.name}${db})`);
      } catch (error) {
        inspectError(this.log, `Error creating MatterNode for device ${plg}${pluginName}${er}:${dev}${device.deviceName}${er} (${zb}${device.name}${er})`, error);
        return;
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
          return;
        }
      } else {
        // Register and add the device to the Matter aggregator node
        this.log.debug(`Adding bridged endpoint ${plg}${pluginName}${db}:${dev}${device.deviceName}${db} (${zb}${device.name}${db})...`);
        if (!this.aggregatorNode) throw new Error(`Aggregator node not found for endpoint ${plg}${pluginName}${er}:${dev}${device.deviceName}${er} (${zb}${device.name}${er})`);
        try {
          await this.aggregatorNode.add(device);
        } catch (error) {
          inspectError(this.log, `Matter error adding bridged endpoint ${plg}${pluginName}${er}:${dev}${device.deviceName}${er} (${zb}${device.name}${er})`, error);
          return;
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
          return;
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
          return;
        }
      }
    }
    if (plugin.registeredDevices !== undefined) plugin.registeredDevices++;
    // Add the device to the DeviceManager
    await this.server.fetch({ type: 'devices_set', src: this.server.name, dst: 'devices', params: { device: toBaseDevice(device) } });

    // Add the device to the DeviceManager
    await device.construction.ready;

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

    // Remove the device from the Matter aggregator node
    if (this.matterbridge.bridgeMode === 'bridge') {
      if (!this.aggregatorNode) throw new Error(`Error removing bridged endpoint ${plg}${pluginName}${er}:${dev}${device.deviceName}${er} (${zb}${device.name}${er}): aggregator node not found`);
      await device.delete();
    } else if (this.matterbridge.bridgeMode === 'childbridge') {
      if (plugin.type === 'AccessoryPlatform') {
        if (!this.serverNode) throw new Error(`Error removing endpoint ${plg}${pluginName}${er}:${dev}${device.deviceName}${er} (${zb}${device.name}${er}): server node not found`);
        await device.delete();
      } else if (plugin.type === 'DynamicPlatform') {
        if (!this.aggregatorNode) throw new Error(`Error removing bridged endpoint ${plg}${pluginName}${er}:${dev}${device.deviceName}${er} (${zb}${device.name}${er}): aggregator node not found`);
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
  async subscribeAttributeChanged(plugin: Plugin, device: MatterbridgeEndpoint): Promise<void> {
    if (!plugin || !device || !device.plugin || !device.serialNumber || !device.uniqueId || !device.maybeNumber) return;
    this.log.debug(`Subscribing attributes for endpoint ${plg}${plugin.name}${db}:${dev}${device.deviceName}${db}:${or}${device.id}${db}:${or}${device.number}${db} (${zb}${device.name}${db})`);
    // Subscribe to the reachable$Changed event of the BasicInformationServer cluster server of the server node in childbridge mode
    if (this.matterbridge.bridgeMode === 'childbridge' && plugin.type === 'AccessoryPlatform' && this.serverNode) {
      this.serverNode.eventsOf(BasicInformationServer).reachable$Changed?.on((reachable: boolean) => {
        this.log.debug(`Accessory endpoint ${plg}${plugin.name}${nf}:${dev}${device.deviceName}${nf}:${or}${device.id}${nf}:${or}${device.number}${nf} is ${reachable ? 'reachable' : 'unreachable'}`);
        this.server.request({
          type: 'frontend_attributechanged',
          src: 'matter',
          dst: 'frontend',
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          params: { plugin: device.plugin!, serialNumber: device.serialNumber!, uniqueId: device.uniqueId!, number: device.number, id: device.id, cluster: 'BasicInformation', attribute: 'reachable', value: reachable },
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
      { cluster: 'WindowCovering', attribute: 'operationalStatus' },
      { cluster: 'WindowCovering', attribute: 'currentPositionLiftPercent100ths' },
      { cluster: 'DoorLock', attribute: 'lockState' },
      { cluster: 'PumpConfigurationAndControl', attribute: 'pumpStatus' },
      { cluster: 'FanControl', attribute: 'fanMode' },
      { cluster: 'FanControl', attribute: 'fanModeSequence' },
      { cluster: 'FanControl', attribute: 'percentSetting' },
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
        this.log.debug(`Subscribing to endpoint ${plg}${plugin.name}${db}:${dev}${device.deviceName}${db}:${or}${device.id}${db}:${or}${device.number}${db} attribute ${dev}${sub.cluster}${db}.${dev}${sub.attribute}${db} changes...`);
        await device.subscribeAttribute(sub.cluster, sub.attribute, (value: number | string | boolean | null) => {
          this.log.debug(`Bridged endpoint ${plg}${plugin.name}${db}:${dev}${device.deviceName}${db}:${or}${device.id}${db}:${or}${device.number}${db} attribute ${dev}${sub.cluster}${db}.${dev}${sub.attribute}${db} changed to ${CYAN}${value}${db}`);
          this.server.request({
            type: 'frontend_attributechanged',
            src: 'matter',
            dst: 'frontend',
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            params: { plugin: device.plugin!, serialNumber: device.serialNumber!, uniqueId: device.uniqueId!, number: device.number, id: device.id, cluster: sub.cluster, attribute: sub.attribute, value: value },
          });
        });
      }
      for (const child of device.getChildEndpoints()) {
        if (child.hasAttributeServer(sub.cluster, sub.attribute)) {
          this.log.debug(`Subscribing to child endpoint ${plg}${plugin.name}${db}:${dev}${device.deviceName}${db}:${or}${child.id}${db}:${or}${child.number}${db} attribute ${dev}${sub.cluster}${db}.${dev}${sub.attribute}${db} changes...`);
          await child.subscribeAttribute(sub.cluster, sub.attribute, (value: number | string | boolean | null) => {
            this.log.debug(
              `Bridged child endpoint ${plg}${plugin.name}${db}:${dev}${device.deviceName}${db}:${or}${child.id}${db}:${or}${child.number}${db} attribute ${dev}${sub.cluster}${db}.${dev}${sub.attribute}${db} changed to ${CYAN}${value}${db}`,
            );
            this.server.request({
              type: 'frontend_attributechanged',
              src: 'matter',
              dst: 'frontend',
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              params: { plugin: device.plugin!, serialNumber: device.serialNumber!, uniqueId: device.uniqueId!, number: child.number, id: child.id, cluster: sub.cluster, attribute: sub.attribute, value: value },
            });
          });
        }
      }
    }
  }

  /**
   * Sanitizes the fabric information by converting bigint properties to strings because `res.json` doesn't support bigint.
   *
   * @param {ExposedFabricInformation[]} fabricInfo - The array of exposed fabric information objects.
   * @returns {SanitizedExposedFabricInformation[]} An array of sanitized exposed fabric information objects.
   */
  sanitizeFabricInformations(fabricInfo: ExposedFabricInformation[]): SanitizedExposedFabricInformation[] {
    return fabricInfo.map((info) => {
      return {
        fabricIndex: info.fabricIndex,
        fabricId: info.fabricId.toString(),
        nodeId: info.nodeId.toString(),
        rootNodeId: info.rootNodeId.toString(),
        rootVendorId: info.rootVendorId,
        rootVendorName: this.getVendorIdName(info.rootVendorId),
        label: info.label,
      } as SanitizedExposedFabricInformation;
    });
  }

  /**
   * Sanitizes the session information by converting bigint properties to strings because `res.json` doesn't support bigint.
   *
   * @param {SessionsBehavior.Session[]} sessions - The array of session information objects.
   * @returns {SanitizedSession[]} An array of sanitized session information objects.
   */
  sanitizeSessionInformation(sessions: SessionsBehavior.Session[]): SanitizedSession[] {
    return sessions
      .filter((session) => session.isPeerActive)
      .map((session) => {
        return {
          name: session.name,
          nodeId: session.nodeId.toString(),
          peerNodeId: session.peerNodeId.toString(),
          fabric: session.fabric
            ? {
                fabricIndex: session.fabric.fabricIndex,
                fabricId: session.fabric.fabricId.toString(),
                nodeId: session.fabric.nodeId.toString(),
                rootNodeId: session.fabric.rootNodeId.toString(),
                rootVendorId: session.fabric.rootVendorId,
                rootVendorName: this.getVendorIdName(session.fabric.rootVendorId),
                label: session.fabric.label,
              }
            : undefined,
          isPeerActive: session.isPeerActive,
          lastInteractionTimestamp: session.lastInteractionTimestamp?.toString(),
          lastActiveTimestamp: session.lastActiveTimestamp?.toString(),
          numberOfActiveSubscriptions: session.numberOfActiveSubscriptions,
        } as SanitizedSession;
      });
  }

  /**
   * Sets the reachability of the specified server node and trigger the corresponding event.
   *
   * @param {boolean} reachable - A boolean indicating the reachability status to set.
   */
  async setServerReachability(reachable: boolean) {
    await this.serverNode?.setStateOf(BasicInformationServer, { reachable });
    this.serverNode?.act((agent) => this.serverNode?.eventsOf(BasicInformationServer).reachableChanged?.emit({ reachableNewValue: reachable }, agent.context));
  }

  /**
   * Sets the reachability of the specified aggregator node bridged devices and trigger.
   *
   * @param {Endpoint<AggregatorEndpoint>} aggregatorNode - The aggregator node to set the reachability for.
   * @param {boolean} reachable - A boolean indicating the reachability status to set.
   */
  async setAggregatorReachability(aggregatorNode: Endpoint<AggregatorEndpoint>, reachable: boolean) {
    for (const child of aggregatorNode.parts) {
      this.log.debug(`Setting reachability of ${(child as unknown as MatterbridgeEndpoint)?.deviceName} to ${reachable}`);
      await child.setStateOf(BridgedDeviceBasicInformationServer, { reachable });
      child.act((agent) => child.eventsOf(BridgedDeviceBasicInformationServer).reachableChanged.emit({ reachableNewValue: true }, agent.context));
    }
  }

  getVendorIdName = (vendorId: number | undefined) => {
    if (!vendorId) return '';
    let vendorName = '(Unknown vendorId)';
    switch (vendorId) {
      case 4937:
        vendorName = '(AppleHome)';
        break;
      case 4996:
        vendorName = '(AppleKeyChain)';
        break;
      case 4362:
        vendorName = '(SmartThings)';
        break;
      case 4939:
        vendorName = '(HomeAssistant)';
        break;
      case 24582:
        vendorName = '(GoogleHome)';
        break;
      case 4631:
        vendorName = '(Alexa)';
        break;
      case 4701:
        vendorName = '(Tuya)';
        break;
      case 4718:
        vendorName = '(Xiaomi)';
        break;
      case 4742:
        vendorName = '(eWeLink)';
        break;
      case 5264:
        vendorName = '(Shelly)';
        break;
      case 0x1488:
        vendorName = '(ShortcutLabsFlic)';
        break;
      case 65521: // 0xFFF1
        vendorName = '(MatterTest)';
        break;
    }
    return vendorName;
  };

  /**
   * Yield to the Node.js event loop:
   * 1. Flushes the current microtask queue (Promise/async continuations queued so far).
   * 2. Yields one macrotask turn (setImmediate) and then its microtasks.
   * 3. Waits a bit (setTimeout) to allow other macrotasks to run.
   *
   * This does **not** guarantee that every promise in the process is settled,
   * but it gives all already-scheduled work a very good chance to run before continuing.
   *
   * @param {number} [timeout] - Optional timeout in milliseconds to wait after yielding. Default is 100 ms (minimum 10 ms).
   * @returns {Promise<void>}
   */
  async yieldToNode(timeout: number = 100): Promise<void> {
    // 1. Let all currently queued microtasks run
    await Promise.resolve();

    // 2. Yield to the next event-loop turn (macrotask + its microtasks)
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });

    // 3. Pause a bit to allow other macrotasks to run
    await new Promise<void>((resolve) => {
      setTimeout(resolve, Math.min(timeout, 10));
    });
  }
}
