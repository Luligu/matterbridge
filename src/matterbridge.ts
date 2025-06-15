/**
 * This file contains the class Matterbridge.
 *
 * @file matterbridge.ts
 * @author Luca Liguori
 * @date 2023-12-29
 * @version 1.6.0
 *
 * Copyright 2023, 2024, 2025 Luca Liguori.
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

// Node.js modules
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import EventEmitter from 'node:events';
import { inspect } from 'node:util';

// AnsiLogger module
import { AnsiLogger, TimestampFormat, LogLevel, UNDERLINE, UNDERLINEOFF, YELLOW, db, debugStringify, BRIGHT, RESET, er, nf, rs, wr, RED, GREEN, zb, CYAN } from './logger/export.js';

// NodeStorage module
import { NodeStorageManager, NodeStorage } from './storage/export.js';

// Matterbridge
import { getParameter, getIntParameter, hasParameter, copyDirectory, withTimeout, waiter, isValidString, parseVersionString, isValidNumber, createDirectory } from './utils/export.js';
import { logInterfaces, getGlobalNodeModules } from './utils/network.js';
import { dev, MatterbridgeInformation, plg, RegisteredPlugin, SanitizedExposedFabricInformation, SanitizedSessionInformation, SessionInformation, SystemInformation, typ } from './matterbridgeTypes.js';
import { PluginManager } from './pluginManager.js';
import { DeviceManager } from './deviceManager.js';
import { MatterbridgeEndpoint, SerializedMatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { bridge } from './matterbridgeDeviceTypes.js';
import { Frontend } from './frontend.js';
import { addVirtualDevices } from './helpers.js';
import spawn from './utils/spawn.js';

// @matter
import {
  DeviceTypeId,
  Endpoint,
  Logger,
  LogLevel as MatterLogLevel,
  LogFormat as MatterLogFormat,
  VendorId,
  StorageContext,
  StorageManager,
  StorageService,
  Environment,
  ServerNode,
  FabricIndex,
  SessionsBehavior,
  UINT32_MAX,
  UINT16_MAX,
} from '@matter/main';
import { DeviceCertification, DeviceCommissioner, ExposedFabricInformation, FabricAction, MdnsService, PaseClient } from '@matter/main/protocol';
import { AggregatorEndpoint } from '@matter/main/endpoints';
import { BasicInformationServer } from '@matter/main/behaviors/basic-information';
import { BridgedDeviceBasicInformationServer } from '@matter/main/behaviors/bridged-device-basic-information';

/**
 * Represents the Matterbridge events.
 */
interface MatterbridgeEvent {
  shutdown: [];
  restart: [];
  update: [];
  initialize_started: [];
  initialize_completed: [];
  online: [nodeid: string];
  offline: [nodeid: string];
  cleanup_started: [];
  cleanup_completed: [];
  startmemorycheck: [];
  stopmemorycheck: [];
  startinspector: [];
  stopinspector: [];
  takeheapsnapshot: [];
  triggergarbagecollection: [];
}

/**
 * Represents the Matterbridge application.
 */
export class Matterbridge extends EventEmitter {
  public systemInformation: SystemInformation = {
    interfaceName: '',
    macAddress: '',
    ipv4Address: '',
    ipv6Address: '',
    nodeVersion: '',
    hostname: '',
    user: '',
    osType: '',
    osRelease: '',
    osPlatform: '',
    osArch: '',
    totalMemory: '',
    freeMemory: '',
    systemUptime: '',
    processUptime: '',
    cpuUsage: '',
    rss: '',
    heapTotal: '',
    heapUsed: '',
  };

  public matterbridgeInformation: MatterbridgeInformation = {
    homeDirectory: '',
    rootDirectory: '',
    matterbridgeDirectory: '',
    matterbridgePluginDirectory: '',
    matterbridgeCertDirectory: '',
    globalModulesDirectory: '',
    matterbridgeVersion: '',
    matterbridgeLatestVersion: '',
    matterbridgeDevVersion: '',
    matterbridgeSerialNumber: '',
    matterbridgeQrPairingCode: undefined,
    matterbridgeManualPairingCode: undefined,
    matterbridgeFabricInformations: [],
    matterbridgeSessionInformations: [],
    matterbridgePaired: false,
    matterbridgeAdvertise: false,
    bridgeMode: '',
    restartMode: '',
    virtualMode: 'outlet',
    readOnly: hasParameter('readonly') || hasParameter('shelly'),
    shellyBoard: hasParameter('shelly'),
    shellySysUpdate: false,
    shellyMainUpdate: false,
    profile: getParameter('profile'),
    loggerLevel: LogLevel.INFO,
    fileLogger: false,
    matterLoggerLevel: MatterLogLevel.INFO,
    matterFileLogger: false,
    mattermdnsinterface: undefined,
    matteripv4address: undefined,
    matteripv6address: undefined,
    matterPort: 5540,
    matterDiscriminator: undefined,
    matterPasscode: undefined,
    restartRequired: false,
    updateRequired: false,
  };

  public homeDirectory = '';
  public rootDirectory = '';
  public matterbridgeDirectory = '';
  public matterbridgePluginDirectory = '';
  public matterbridgeCertDirectory = '';
  public globalModulesDirectory = '';
  public matterbridgeVersion = '';
  public matterbridgeLatestVersion = '';
  public matterbridgeDevVersion = '';
  public matterbridgeQrPairingCode: string | undefined = undefined;
  public matterbridgeManualPairingCode: string | undefined = undefined;
  public matterbridgeFabricInformations: SanitizedExposedFabricInformation[] | undefined = undefined;
  public matterbridgeSessionInformations: SanitizedSessionInformation[] | undefined = undefined;
  public matterbridgePaired: boolean | undefined = undefined;
  public bridgeMode: 'bridge' | 'childbridge' | 'controller' | '' = '';
  public restartMode: 'service' | 'docker' | '' = '';
  public profile = getParameter('profile');
  public shutdown = false;
  public edge = true;
  private readonly failCountLimit = hasParameter('shelly') ? 600 : 120;

  public log!: AnsiLogger;
  public matterbrideLoggerFile = 'matterbridge' + (getParameter('profile') ? '.' + getParameter('profile') : '') + '.log';
  public matterLoggerFile = 'matter' + (getParameter('profile') ? '.' + getParameter('profile') : '') + '.log';
  public plugins!: PluginManager;
  public devices!: DeviceManager;
  public frontend = new Frontend(this);

  // Matterbridge storage
  public nodeStorage: NodeStorageManager | undefined;
  public nodeContext: NodeStorage | undefined;
  public nodeStorageName = 'storage' + (getParameter('profile') ? '.' + getParameter('profile') : '');

  // Cleanup
  private hasCleanupStarted = false;
  private initialized = false;
  private execRunningCount = 0;
  private startMatterInterval: NodeJS.Timeout | undefined;
  private checkUpdateInterval: NodeJS.Timeout | undefined;
  private checkUpdateTimeout: NodeJS.Timeout | undefined;
  private configureTimeout: NodeJS.Timeout | undefined;
  private reachabilityTimeout: NodeJS.Timeout | undefined;
  private endAdvertiseTimeout: NodeJS.Timeout | undefined;
  private sigintHandler: NodeJS.SignalsListener | undefined;
  private sigtermHandler: NodeJS.SignalsListener | undefined;
  private exceptionHandler: NodeJS.UncaughtExceptionListener | undefined;
  private rejectionHandler: NodeJS.UnhandledRejectionListener | undefined;

  // Matter environment
  environment = Environment.default;

  // Matter storage
  matterStorageName = 'matterstorage' + (getParameter('profile') ? '.' + getParameter('profile') : '');
  matterStorageService: StorageService | undefined;
  matterStorageManager: StorageManager | undefined;
  matterbridgeContext: StorageContext | undefined;
  controllerContext: StorageContext | undefined;

  // Matter parameters
  mdnsInterface: string | undefined; // matter server node mdnsInterface: e.g. 'eth0' or 'wlan0' or 'WiFi'
  ipv4address: string | undefined; // matter server node listeningAddressIpv4
  ipv6address: string | undefined; // matter server node listeningAddressIpv6
  port: number | undefined; // first server node port
  passcode: number | undefined; // first server node passcode
  discriminator: number | undefined; // first server node discriminator
  certification: DeviceCertification.Definition | undefined; // device certification

  serverNode: ServerNode<ServerNode.RootEndpoint> | undefined;
  aggregatorNode: Endpoint<AggregatorEndpoint> | undefined;
  aggregatorVendorId = VendorId(getIntParameter('vendorId') ?? 0xfff1);
  aggregatorVendorName = getParameter('vendorName') ?? 'Matterbridge';
  aggregatorProductId = getIntParameter('productId') ?? 0x8000;
  aggregatorProductName = getParameter('productName') ?? 'Matterbridge aggregator';

  protected static instance: Matterbridge | undefined;

  // We load asyncronously so is private
  protected constructor() {
    super();
  }

  /**
   * Emits an event of the specified type with the provided arguments.
   *
   * @template K - The type of the event.
   * @param {K} eventName - The name of the event to emit.
   * @param {...MatterbridgeEvent[K]} args - The arguments to pass to the event listeners.
   * @returns {boolean} - Returns true if the event had listeners, false otherwise.
   */
  override emit<K extends keyof MatterbridgeEvent>(eventName: K, ...args: MatterbridgeEvent[K]): boolean {
    return super.emit(eventName, ...args);
  }

  /**
   * Registers an event listener for the specified event type.
   *
   * @template K - The type of the event.
   * @param {K} eventName - The name of the event to listen for.
   * @param {(...args: MatterbridgeEvent[K]) => void} listener - The callback function to invoke when the event is emitted.
   * @returns {this} - Returns the instance of the Matterbridge class.
   */
  override on<K extends keyof MatterbridgeEvent>(eventName: K, listener: (...args: MatterbridgeEvent[K]) => void): this {
    return super.on(eventName, listener);
  }

  /**
   * Retrieves the list of Matterbridge devices.
   * @returns {MatterbridgeEndpoint[]} An array of MatterbridgeDevice objects.
   */
  getDevices(): MatterbridgeEndpoint[] {
    return this.devices.array();
  }

  /**
   * Retrieves the list of registered plugins.
   * @returns {RegisteredPlugin[]} An array of RegisteredPlugin objects.
   */
  getPlugins(): RegisteredPlugin[] {
    return this.plugins.array();
  }

  /**
   * Set the logger logLevel for the Matterbridge classes and call onChangeLoggerLevel() for each plugin.
   * @param {LogLevel} logLevel The logger logLevel to set.
   */
  async setLogLevel(logLevel: LogLevel) {
    if (this.log) this.log.logLevel = logLevel;
    this.matterbridgeInformation.loggerLevel = logLevel;
    this.frontend.logLevel = logLevel;
    MatterbridgeEndpoint.logLevel = logLevel;
    if (this.devices) this.devices.logLevel = logLevel;
    if (this.plugins) this.plugins.logLevel = logLevel;
    for (const plugin of this.plugins) {
      if (!plugin.platform || !plugin.platform.log || !plugin.platform.config) continue;
      plugin.platform.log.logLevel = plugin.platform.config.debug === true ? LogLevel.DEBUG : this.log.logLevel;
      await plugin.platform.onChangeLoggerLevel(plugin.platform.config.debug === true ? LogLevel.DEBUG : this.log.logLevel);
    }
    // Set the global logger callback for the WebSocketServer to the common minimum logLevel
    let callbackLogLevel = LogLevel.NOTICE;
    if (this.matterbridgeInformation.loggerLevel === LogLevel.INFO || this.matterbridgeInformation.matterLoggerLevel === MatterLogLevel.INFO) callbackLogLevel = LogLevel.INFO;
    if (this.matterbridgeInformation.loggerLevel === LogLevel.DEBUG || this.matterbridgeInformation.matterLoggerLevel === MatterLogLevel.DEBUG) callbackLogLevel = LogLevel.DEBUG;
    AnsiLogger.setGlobalCallback(this.frontend.wssSendMessage.bind(this.frontend), callbackLogLevel);
    this.log.debug(`WebSocketServer logger global callback set to ${callbackLogLevel}`);
  }

  /** ***********************************************************************************************************************************/
  /**                                              loadInstance() and cleanup() methods                                                 */
  /** ***********************************************************************************************************************************/

  /**
   * Loads an instance of the Matterbridge class.
   * If an instance already exists, return that instance.
   *
   * @param {boolean} initialize - Whether to initialize the Matterbridge instance after loading. Defaults to false.
   * @returns The loaded Matterbridge instance.
   */
  static async loadInstance(initialize = false) {
    if (!Matterbridge.instance) {
      // eslint-disable-next-line no-console
      if (hasParameter('debug')) console.log(GREEN + 'Creating a new instance of Matterbridge.', initialize ? 'Initializing...' : 'Not initializing...', rs);
      Matterbridge.instance = new Matterbridge();
      if (initialize) await Matterbridge.instance.initialize();
    }
    return Matterbridge.instance;
  }

  /**
   * Call cleanup() and dispose MdnsService.
   *
   * @deprecated This method is deprecated and is ONLY used for jest tests.
   */
  async destroyInstance() {
    this.log.info(`Destroy instance...`);
    // Save server nodes to close
    const servers: ServerNode<ServerNode.RootEndpoint>[] = [];
    if (this.bridgeMode === 'bridge') {
      if (this.serverNode) servers.push(this.serverNode);
    }
    if (this.bridgeMode === 'childbridge') {
      for (const plugin of this.plugins.array()) {
        if (plugin.serverNode) servers.push(plugin.serverNode);
      }
    }
    // Let any already‐queued microtasks run first
    await Promise.resolve();
    // Cleanup
    await this.cleanup('destroying instance...', false);
    // Close servers mdns service
    this.log.info(`Dispose ${servers.length} MdnsService...`);
    for (const server of servers) {
      await server.env.get(MdnsService)[Symbol.asyncDispose]();
      this.log.info(`Closed ${server.id} MdnsService`);
    }
    // Let any already‐queued microtasks run first
    await Promise.resolve();
    // Wait for the cleanup to finish
    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });
  }

  /**
   * Initializes the Matterbridge application.
   *
   * @remarks
   * This method performs the necessary setup and initialization steps for the Matterbridge application.
   * It displays the help information if the 'help' parameter is provided, sets up the logger, checks the
   * node version, registers signal handlers, initializes storage, and parses the command line.
   *
   * @returns A Promise that resolves when the initialization is complete.
   */
  public async initialize() {
    // Emit the initialize_started event
    this.emit('initialize_started');

    // Create the matterbridge logger
    this.log = new AnsiLogger({ logName: 'Matterbridge', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: hasParameter('debug') ? LogLevel.DEBUG : LogLevel.INFO });

    // Set the restart mode
    if (hasParameter('service')) this.restartMode = 'service';
    if (hasParameter('docker')) this.restartMode = 'docker';

    // Set the matterbridge home directory
    this.homeDirectory = getParameter('homedir') ?? os.homedir();
    this.matterbridgeInformation.homeDirectory = this.homeDirectory;
    await createDirectory(this.homeDirectory, 'Matterbridge Home Directory', this.log);

    // Set the matterbridge directory
    this.matterbridgeDirectory = path.join(this.homeDirectory, '.matterbridge');
    this.matterbridgeInformation.matterbridgeDirectory = this.matterbridgeDirectory;
    await createDirectory(this.matterbridgeDirectory, 'Matterbridge Directory', this.log);
    await createDirectory(path.join(this.matterbridgeDirectory, 'certs'), 'Matterbridge Frontend Certificate Directory', this.log);
    await createDirectory(path.join(this.matterbridgeDirectory, 'uploads'), 'Matterbridge Frontend Uploads Directory', this.log);

    // Set the matterbridge plugin directory
    this.matterbridgePluginDirectory = path.join(this.homeDirectory, 'Matterbridge');
    this.matterbridgeInformation.matterbridgePluginDirectory = this.matterbridgePluginDirectory;
    await createDirectory(this.matterbridgePluginDirectory, 'Matterbridge Plugin Directory', this.log);

    // Set the matterbridge cert directory
    this.matterbridgeCertDirectory = path.join(this.homeDirectory, '.mattercert');
    this.matterbridgeInformation.matterbridgeCertDirectory = this.matterbridgeCertDirectory;
    await createDirectory(this.matterbridgeCertDirectory, 'Matterbridge Matter Certificate Directory', this.log);

    // Set the matterbridge root directory
    const { fileURLToPath } = await import('node:url');
    const currentFileDirectory = path.dirname(fileURLToPath(import.meta.url));
    this.rootDirectory = path.resolve(currentFileDirectory, '../');
    this.matterbridgeInformation.rootDirectory = this.rootDirectory;

    // Setup the matter environment
    this.environment.vars.set('log.level', MatterLogLevel.INFO);
    this.environment.vars.set('log.format', MatterLogFormat.ANSI);
    this.environment.vars.set('path.root', path.join(this.matterbridgeDirectory, this.matterStorageName));
    this.environment.vars.set('runtime.signals', false);
    this.environment.vars.set('runtime.exitcode', false);

    // Register process handlers
    this.registerProcessHandlers();

    // Initialize nodeStorage and nodeContext
    try {
      this.log.debug(`Creating node storage manager: ${CYAN}${this.nodeStorageName}${db}`);
      this.nodeStorage = new NodeStorageManager({ dir: path.join(this.matterbridgeDirectory, this.nodeStorageName), writeQueue: false, expiredInterval: undefined, logging: false });
      this.log.debug('Creating node storage context for matterbridge');
      this.nodeContext = await this.nodeStorage.createStorage('matterbridge');
      // TODO: Remove this code when node-persist-manager is updated
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const keys = (await (this.nodeStorage as any)?.storage.keys()) as string[];
      for (const key of keys) {
        this.log.debug(`Checking node storage manager key: ${CYAN}${key}${db}`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (this.nodeStorage as any)?.storage.get(key);
      }
      const storages = await this.nodeStorage.getStorageNames();
      for (const storage of storages) {
        this.log.debug(`Checking storage: ${CYAN}${storage}${db}`);
        const nodeContext = await this.nodeStorage?.createStorage(storage);
        // TODO: Remove this code when node-persist-manager is updated
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const keys = (await (nodeContext as any)?.storage.keys()) as string[];
        keys.forEach(async (key) => {
          this.log.debug(`Checking key: ${CYAN}${storage}:${key}${db}`);
          await nodeContext?.get(key);
        });
      }
      // Creating a backup of the node storage since it is not corrupted
      this.log.debug('Creating node storage backup...');
      await copyDirectory(path.join(this.matterbridgeDirectory, this.nodeStorageName), path.join(this.matterbridgeDirectory, this.nodeStorageName + '.backup'));
      this.log.debug('Created node storage backup');
    } catch (error) {
      // Restoring the backup of the node storage since it is corrupted
      this.log.error(`Error creating node storage manager and context: ${error instanceof Error ? error.message : error}`);
      if (hasParameter('norestore')) {
        this.log.fatal(`The matterbridge node storage is corrupted. Parameter -norestore found: exiting...`);
        await this.cleanup('Fatal error creating node storage manager and context for matterbridge');
        return;
      }
      this.log.notice(`The matterbridge storage is corrupted. Restoring it with backup...`);
      await copyDirectory(path.join(this.matterbridgeDirectory, this.nodeStorageName + '.backup'), path.join(this.matterbridgeDirectory, this.nodeStorageName));
      this.log.notice(`The matterbridge storage has been restored with backup`);
    }
    if (!this.nodeStorage || !this.nodeContext) {
      this.log.fatal('Fatal error creating node storage manager and context for matterbridge');
      throw new Error('Fatal error creating node storage manager and context for matterbridge');
    }

    // Set the first port to use for the commissioning server (will be incremented in childbridge mode)
    this.port = getIntParameter('port') ?? (await this.nodeContext.get<number>('matterport', 5540)) ?? 5540;

    // Set the first passcode to use for the commissioning server (will be incremented in childbridge mode)
    this.passcode = getIntParameter('passcode') ?? (await this.nodeContext.get<number>('matterpasscode')) ?? PaseClient.generateRandomPasscode();

    // Set the first discriminator to use for the commissioning server (will be incremented in childbridge mode)
    this.discriminator = getIntParameter('discriminator') ?? (await this.nodeContext.get<number>('matterdiscriminator')) ?? PaseClient.generateRandomDiscriminator();

    // Certificate management
    const pairingFilePath = path.join(this.matterbridgeCertDirectory, 'pairing.json');
    try {
      await fs.access(pairingFilePath, fs.constants.R_OK);
      const pairingFileContent = await fs.readFile(pairingFilePath, 'utf8');
      const pairingFileJson = JSON.parse(pairingFileContent) as {
        vendorId?: number;
        vendorName?: string;
        productId?: number;
        productName?: string;
        passcode?: number;
        discriminator?: number;
        remoteUrl?: string;
        privateKey?: string;
        certificate?: string;
        intermediateCertificate?: string;
        declaration?: string;
      };

      // Set the vendorId, vendorName, productId and productName if they are present in the pairing file
      if (isValidNumber(pairingFileJson.vendorId)) this.aggregatorVendorId = VendorId(pairingFileJson.vendorId);
      if (isValidString(pairingFileJson.vendorName, 3)) this.aggregatorVendorName = pairingFileJson.vendorName;
      if (isValidNumber(pairingFileJson.productId)) this.aggregatorProductId = VendorId(pairingFileJson.productId);
      if (isValidString(pairingFileJson.productName, 3)) this.aggregatorProductName = pairingFileJson.productName;

      // Override the passcode and discriminator if they are present in the pairing file
      if (isValidNumber(pairingFileJson.passcode) && isValidNumber(pairingFileJson.discriminator)) {
        this.passcode = pairingFileJson.passcode;
        this.discriminator = pairingFileJson.discriminator;
        this.log.info(`Pairing file ${CYAN}${pairingFilePath}${nf} found. Using passcode ${CYAN}${this.passcode}${nf} and discriminator ${CYAN}${this.discriminator}${nf} from pairing file.`);
      }
      // Set the certification if it is present in the pairing file
      if (pairingFileJson.privateKey && pairingFileJson.certificate && pairingFileJson.intermediateCertificate && pairingFileJson.declaration) {
        const hexStringToUint8Array = (hexString: string) => {
          const matches = hexString.match(/.{1,2}/g);
          return matches ? new Uint8Array(matches.map((byte) => parseInt(byte, 16))) : new Uint8Array();
        };
        // const hexString = Buffer.from('Test string', 'utf-8').toString('hex');
        // console.log(hexString, Buffer.from(hexStringToUint8Array(hexString)).toString('utf-8'));

        this.certification = {
          privateKey: hexStringToUint8Array(pairingFileJson.privateKey),
          certificate: hexStringToUint8Array(pairingFileJson.certificate),
          intermediateCertificate: hexStringToUint8Array(pairingFileJson.intermediateCertificate),
          declaration: hexStringToUint8Array(pairingFileJson.declaration),
        };
        this.log.info(`Pairing file ${CYAN}${pairingFilePath}${nf} found. Using privateKey, certificate, intermediateCertificate and declaration from pairing file.`);
      }
    } catch (error) {
      this.log.debug(`Pairing file ${CYAN}${pairingFilePath}${db} not found: ${error instanceof Error ? error.message : error}`);
    }

    // Store the passcode, discriminator and port in the node context
    await this.nodeContext.set<number>('matterport', this.port);
    await this.nodeContext.set<number>('matterpasscode', this.passcode);
    await this.nodeContext.set<number>('matterdiscriminator', this.discriminator);
    this.log.debug(`Initializing server node for Matterbridge on port ${this.port} with passcode ${this.passcode} and discriminator ${this.discriminator}`);

    // Set matterbridge logger level (context: matterbridgeLogLevel)
    if (hasParameter('logger')) {
      const level = getParameter('logger');
      if (level === 'debug') {
        this.log.logLevel = LogLevel.DEBUG;
      } else if (level === 'info') {
        this.log.logLevel = LogLevel.INFO;
      } else if (level === 'notice') {
        this.log.logLevel = LogLevel.NOTICE;
      } else if (level === 'warn') {
        this.log.logLevel = LogLevel.WARN;
      } else if (level === 'error') {
        this.log.logLevel = LogLevel.ERROR;
      } else if (level === 'fatal') {
        this.log.logLevel = LogLevel.FATAL;
      } else {
        this.log.warn(`Invalid matterbridge logger level: ${level}. Using default level "info".`);
        this.log.logLevel = LogLevel.INFO;
      }
    } else {
      this.log.logLevel = await this.nodeContext.get<LogLevel>('matterbridgeLogLevel', this.matterbridgeInformation.shellyBoard ? LogLevel.NOTICE : LogLevel.INFO);
    }
    this.frontend.logLevel = this.log.logLevel;
    MatterbridgeEndpoint.logLevel = this.log.logLevel;
    this.matterbridgeInformation.loggerLevel = this.log.logLevel;

    // Create the file logger for matterbridge (context: matterbridgeFileLog)
    if (hasParameter('filelogger') || (await this.nodeContext.get<boolean>('matterbridgeFileLog', false))) {
      AnsiLogger.setGlobalLogfile(path.join(this.matterbridgeDirectory, this.matterbrideLoggerFile), this.log.logLevel, true);
      this.matterbridgeInformation.fileLogger = true;
    }

    this.log.notice('Matterbridge is starting...');

    this.log.debug(`Matterbridge logLevel: ${this.log.logLevel} fileLoger: ${this.matterbridgeInformation.fileLogger}.`);

    if (this.profile !== undefined) this.log.debug(`Matterbridge profile: ${this.profile}.`);

    // Set matter.js logger level, format and logger (context: matterLogLevel)
    if (hasParameter('matterlogger')) {
      const level = getParameter('matterlogger');
      if (level === 'debug') {
        Logger.level = MatterLogLevel.DEBUG;
      } else if (level === 'info') {
        Logger.level = MatterLogLevel.INFO;
      } else if (level === 'notice') {
        Logger.level = MatterLogLevel.NOTICE;
      } else if (level === 'warn') {
        Logger.level = MatterLogLevel.WARN;
      } else if (level === 'error') {
        Logger.level = MatterLogLevel.ERROR;
      } else if (level === 'fatal') {
        Logger.level = MatterLogLevel.FATAL;
      } else {
        this.log.warn(`Invalid matter.js logger level: ${level}. Using default level "info".`);
        Logger.level = MatterLogLevel.INFO;
      }
    } else {
      Logger.level = (await this.nodeContext.get<number>('matterLogLevel', this.matterbridgeInformation.shellyBoard ? MatterLogLevel.NOTICE : MatterLogLevel.INFO)) as MatterLogLevel;
    }
    Logger.format = MatterLogFormat.ANSI;
    Logger.setLogger('default', this.createMatterLogger());
    this.matterbridgeInformation.matterLoggerLevel = Logger.defaultLogLevel;

    // Create the file logger for matter.js (context: matterFileLog)
    if (hasParameter('matterfilelogger') || (await this.nodeContext.get<boolean>('matterFileLog', false))) {
      this.matterbridgeInformation.matterFileLogger = true;
      Logger.addLogger('matterfilelogger', await this.createMatterFileLogger(path.join(this.matterbridgeDirectory, this.matterLoggerFile), true), {
        defaultLogLevel: Logger.defaultLogLevel,
        logFormat: MatterLogFormat.PLAIN,
      });
    }
    this.log.debug(`Matter logLevel: ${Logger.defaultLogLevel} fileLoger: ${this.matterbridgeInformation.matterFileLogger}.`);

    // Log network interfaces
    const networkInterfaces = os.networkInterfaces();
    const availableAddresses = Object.entries(networkInterfaces);
    const availableInterfaces = Object.keys(networkInterfaces);
    for (const [ifaceName, ifaces] of availableAddresses) {
      if (ifaces && ifaces.length > 0) {
        this.log.debug(`Network interface: ${CYAN}${ifaceName}${db}:`);
        ifaces.forEach((iface) => {
          this.log.debug(`- ${CYAN}${iface.family}${db} address ${CYAN}${iface.address}${db} netmask ${CYAN}${iface.netmask}${db} mac ${CYAN}${iface.mac}${db} scopeid ${CYAN}${iface.scopeid}${db} ${iface.internal ? 'internal' : 'external'}`);
        });
      }
    }

    // Set the interface to use for matter server node mdnsInterface
    if (hasParameter('mdnsinterface')) {
      this.mdnsInterface = getParameter('mdnsinterface');
    } else {
      this.mdnsInterface = await this.nodeContext.get<string>('mattermdnsinterface', undefined);
      if (this.mdnsInterface === '') this.mdnsInterface = undefined;
    }
    // Validate mdnsInterface
    if (this.mdnsInterface) {
      if (!availableInterfaces.includes(this.mdnsInterface)) {
        this.log.error(`Invalid mdnsInterface: ${this.mdnsInterface}. Available interfaces are: ${availableInterfaces.join(', ')}. Using all available interfaces.`);
        this.mdnsInterface = undefined;
        await this.nodeContext.remove('mattermdnsinterface');
      } else {
        this.log.info(`Using mdnsInterface ${CYAN}${this.mdnsInterface}${nf} for the Matter MdnsBroadcaster.`);
      }
    }
    if (this.mdnsInterface) this.environment.vars.set('mdns.networkInterface', this.mdnsInterface);

    // Set the listeningAddressIpv4 for the matter commissioning server
    if (hasParameter('ipv4address')) {
      this.ipv4address = getParameter('ipv4address');
    } else {
      this.ipv4address = await this.nodeContext.get<string>('matteripv4address', undefined);
      if (this.ipv4address === '') this.ipv4address = undefined;
    }
    // Validate ipv4address
    if (this.ipv4address) {
      let isValid = false;
      for (const [ifaceName, ifaces] of availableAddresses) {
        if (ifaces && ifaces.find((iface) => iface.address === this.ipv4address)) {
          this.log.info(`Using ipv4address ${CYAN}${this.ipv4address}${nf} on interface ${CYAN}${ifaceName}${nf} for the Matter server node.`);
          isValid = true;
          break;
        }
      }
      if (!isValid) {
        this.log.error(`Invalid ipv4address: ${this.ipv4address}. Using all available addresses.`);
        this.ipv4address = undefined;
        await this.nodeContext.remove('matteripv4address');
      }
    }

    // Set the listeningAddressIpv6 for the matter commissioning server
    if (hasParameter('ipv6address')) {
      this.ipv6address = getParameter('ipv6address');
    } else {
      this.ipv6address = await this.nodeContext?.get<string>('matteripv6address', undefined);
      if (this.ipv6address === '') this.ipv6address = undefined;
    }
    // Validate ipv6address
    if (this.ipv6address) {
      let isValid = false;
      for (const [ifaceName, ifaces] of availableAddresses) {
        if (ifaces && ifaces.find((iface) => (iface.scopeid === undefined || iface.scopeid === 0) && iface.address === this.ipv6address)) {
          this.log.info(`Using ipv6address ${CYAN}${this.ipv6address}${nf} on interface ${CYAN}${ifaceName}${nf} for the Matter server node.`);
          isValid = true;
          break;
        }
        if (ifaces && ifaces.find((iface) => iface.scopeid && iface.scopeid > 0 && iface.address + '%' + (process.platform === 'win32' ? iface.scopeid : ifaceName) === this.ipv6address)) {
          this.log.info(`Using ipv6address ${CYAN}${this.ipv6address}${nf} on interface ${CYAN}${ifaceName}${nf} for the Matter server node.`);
          isValid = true;
          break;
        }
      }
      if (!isValid) {
        this.log.error(`Invalid ipv6address: ${this.ipv6address}. Using all available addresses.`);
        this.ipv6address = undefined;
        await this.nodeContext.remove('matteripv6address');
      }
    }

    // Initialize the virtual mode
    if (hasParameter('novirtual')) {
      this.matterbridgeInformation.virtualMode = 'disabled';
      await this.nodeContext.set<string>('virtualmode', 'disabled');
    } else {
      this.matterbridgeInformation.virtualMode = (await this.nodeContext.get<string>('virtualmode', 'outlet')) as 'disabled' | 'outlet' | 'light' | 'switch' | 'mounted_switch';
    }
    this.log.debug(`Virtual mode ${this.matterbridgeInformation.virtualMode}.`);

    // Initialize PluginManager
    this.plugins = new PluginManager(this);
    await this.plugins.loadFromStorage();
    this.plugins.logLevel = this.log.logLevel;

    // Initialize DeviceManager
    this.devices = new DeviceManager(this, this.nodeContext);
    this.devices.logLevel = this.log.logLevel;

    // Get the plugins from node storage and create the plugins node storage contexts
    for (const plugin of this.plugins) {
      const packageJson = await this.plugins.parse(plugin);
      if (packageJson === null && !hasParameter('add') && !hasParameter('remove') && !hasParameter('enable') && !hasParameter('disable') && !hasParameter('reset') && !hasParameter('factoryreset')) {
        // Try to reinstall the plugin from npm (for Docker pull and external plugins)
        // We don't do this when the add and other parameters are set because we shut down the process after adding the plugin
        this.log.info(`Error parsing plugin ${plg}${plugin.name}${nf}. Trying to reinstall it from npm.`);
        try {
          await spawn.spawnCommand(this, 'npm', ['install', '-g', plugin.name, '--omit=dev', '--verbose']);
          this.log.info(`Plugin ${plg}${plugin.name}${nf} reinstalled.`);
          plugin.error = false;
        } catch (error) {
          plugin.error = true;
          plugin.enabled = false;
          this.log.error(`Error installing plugin ${plg}${plugin.name}${er}. The plugin is disabled.`, error instanceof Error ? error.message : error);
        }
      }
      this.log.debug(`Creating node storage context for plugin  ${plg}${plugin.name}${db}`);
      plugin.nodeContext = await this.nodeStorage.createStorage(plugin.name);
      await plugin.nodeContext.set<string>('name', plugin.name);
      await plugin.nodeContext.set<string>('type', plugin.type);
      await plugin.nodeContext.set<string>('path', plugin.path);
      await plugin.nodeContext.set<string>('version', plugin.version);
      await plugin.nodeContext.set<string>('description', plugin.description);
      await plugin.nodeContext.set<string>('author', plugin.author);
    }

    // Log system info and create .matterbridge directory
    await this.logNodeAndSystemInfo();
    this.log.notice(
      `Matterbridge version ${this.matterbridgeVersion} ` +
        `${hasParameter('bridge') || (!hasParameter('childbridge') && (await this.nodeContext?.get<string>('bridgeMode', '')) === 'bridge') ? 'mode bridge ' : ''}` +
        `${hasParameter('childbridge') || (!hasParameter('bridge') && (await this.nodeContext?.get<string>('bridgeMode', '')) === 'childbridge') ? 'mode childbridge ' : ''}` +
        `${hasParameter('controller') ? 'mode controller ' : ''}` +
        `${this.restartMode !== '' ? 'restart mode ' + this.restartMode + ' ' : ''}` +
        `running on ${this.systemInformation.osType} (v.${this.systemInformation.osRelease}) platform ${this.systemInformation.osPlatform} arch ${this.systemInformation.osArch}`,
    );

    // Check node version and throw error
    const minNodeVersion = 18;
    const nodeVersion = process.versions.node;
    const versionMajor = parseInt(nodeVersion.split('.')[0]);
    if (versionMajor < minNodeVersion) {
      this.log.error(`Node version ${versionMajor} is not supported. Please upgrade to ${minNodeVersion} or above.`);
      throw new Error(`Node version ${versionMajor} is not supported. Please upgrade to ${minNodeVersion} or above.`);
    }

    // Parse command line
    await this.parseCommandLine();

    // Emit the initialize_completed event
    this.emit('initialize_completed');
    this.initialized = true;
  }

  /**
   * Parses the command line arguments and performs the corresponding actions.
   * @private
   * @returns {Promise<void>} A promise that resolves when the command line arguments have been processed, or the process exits.
   */
  private async parseCommandLine(): Promise<void> {
    if (hasParameter('help')) {
      this.log.info(`\nUsage: matterbridge [options]\n
      Options:
      - help:                  show the help
      - bridge:                start Matterbridge in bridge mode
      - childbridge:           start Matterbridge in childbridge mode
      - port [port]:           start the commissioning server on the given port (default 5540)
      - mdnsinterface [name]:  set the interface to use for the matter server mdnsInterface (default all interfaces)
      - ipv4address [address]: set the ipv4 interface address to use for the matter listener (default all interfaces)
      - ipv6address [address]: set the ipv6 interface address to use for the matter listener (default all interfaces)
      - frontend [port]:       start the frontend on the given port (default 8283)
      - logger:                set the matterbridge logger level: debug | info | notice | warn | error | fatal (default info)
      - filelogger             enable the matterbridge file logger (matterbridge.log)
      - matterlogger:          set the matter.js logger level: debug | info | notice | warn | error | fatal (default info)
      - matterfilelogger       enable the matter.js file logger (matter.log)
      - reset:                 remove the commissioning for Matterbridge (bridge mode). Shutdown Matterbridge before using it!
      - factoryreset:          remove all commissioning information and reset all internal storages. Shutdown Matterbridge before using it!
      - list:                  list the registered plugins
      - loginterfaces:         log the network interfaces (usefull for finding the name of the interface to use with -mdnsinterface option)
      - logstorage:            log the node storage
      - sudo:                  force the use of sudo to install or update packages if the internal logic fails
      - nosudo:                force not to use sudo to install or update packages if the internal logic fails
      - norestore:             force not to automatically restore the matterbridge node storage and the matter storage from backup if it is corrupted
      - novirtual:             disable the creation of the virtual devices Restart, Update and Reboot Matterbridge
      - ssl:                   enable SSL for the frontend and WebSockerServer (certificates in .matterbridge/certs directory cert.pem, key.pem and ca.pem (optional))
      - vendorId:              override the default vendorId 0xfff1
      - vendorName:            override the default vendorName "Matterbridge"
      - productId:             override the default productId 0x8000
      - productName:           override the default productName "Matterbridge aggregator"
      - service:               enable the service mode (used in the systemctl configuration file)
      - docker:                enable the docker mode (used in the docker image)
      - homedir:               override the home directory (default: os.homedir())
      - add [plugin path]:     register the plugin from the given absolute or relative path
      - add [plugin name]:     register the globally installed plugin with the given name
      - remove [plugin path]:  remove the plugin from the given absolute or relative path
      - remove [plugin name]:  remove the globally installed plugin with the given name
      - enable [plugin path]:  enable the plugin from the given absolute or relative path
      - enable [plugin name]:  enable the globally installed plugin with the given name
      - disable [plugin path]: disable the plugin from the given absolute or relative path
      - disable [plugin name]: disable the globally installed plugin with the given name
      - reset [plugin path]:   remove the commissioning for the plugin from the given absolute or relative path (childbridge mode). Shutdown Matterbridge before using it!
      - reset [plugin name]:   remove the commissioning for the globally installed plugin (childbridge mode). Shutdown Matterbridge before using it!${rs}`);
      this.shutdown = true;
      return;
    }

    if (hasParameter('list')) {
      this.log.info(`│ Registered plugins (${this.plugins.length})`);
      let index = 0;
      for (const plugin of this.plugins) {
        if (index !== this.plugins.length - 1) {
          this.log.info(`├─┬─ plugin ${plg}${plugin.name}${nf}: "${plg}${BRIGHT}${plugin.description}${RESET}${nf}" type: ${typ}${plugin.type}${nf} ${plugin.enabled ? GREEN : RED}enabled ${plugin.paired ? GREEN : RED}paired${nf}`);
          this.log.info(`│ └─ entry ${UNDERLINE}${db}${plugin.path}${UNDERLINEOFF}${db}`);
        } else {
          this.log.info(`└─┬─ plugin ${plg}${plugin.name}${nf}: "${plg}${BRIGHT}${plugin.description}${RESET}${nf}" type: ${typ}${plugin.type}${nf} ${plugin.enabled ? GREEN : RED}enabled ${plugin.paired ? GREEN : RED}paired${nf}`);
          this.log.info(`  └─ entry ${UNDERLINE}${db}${plugin.path}${UNDERLINEOFF}${db}`);
        }
        index++;
      }
      const serializedRegisteredDevices = await this.nodeContext?.get<SerializedMatterbridgeEndpoint[]>('devices', []);
      this.log.info(`│ Registered devices (${serializedRegisteredDevices?.length})`);
      serializedRegisteredDevices?.forEach((device, index) => {
        if (index !== serializedRegisteredDevices.length - 1) {
          this.log.info(`├─┬─ plugin ${plg}${device.pluginName}${nf} device: ${dev}${device.deviceName}${nf} uniqueId: ${YELLOW}${device.uniqueId}${nf}`);
          this.log.info(`│ └─ endpoint ${RED}${device.endpoint}${nf} ${typ}${device.endpointName}${nf} ${debugStringify(device.clusterServersId)}`);
        } else {
          this.log.info(`└─┬─ plugin ${plg}${device.pluginName}${nf} device: ${dev}${device.deviceName}${nf} uniqueId: ${YELLOW}${device.uniqueId}${nf}`);
          this.log.info(`  └─ endpoint ${RED}${device.endpoint}${nf} ${typ}${device.endpointName}${nf} ${debugStringify(device.clusterServersId)}`);
        }
      });
      this.shutdown = true;
      return;
    }

    if (hasParameter('logstorage')) {
      this.log.info(`${plg}Matterbridge${nf} storage log`);
      await this.nodeContext?.logStorage();
      for (const plugin of this.plugins) {
        this.log.info(`${plg}${plugin.name}${nf} storage log`);
        await plugin.nodeContext?.logStorage();
      }
      this.shutdown = true;
      return;
    }

    if (hasParameter('loginterfaces')) {
      this.log.info(`${plg}Matterbridge${nf} network interfaces log`);
      logInterfaces();
      this.shutdown = true;
      return;
    }

    if (getParameter('add')) {
      this.log.debug(`Adding plugin ${getParameter('add')}`);
      await this.plugins.add(getParameter('add') as string);
      this.shutdown = true;
      return;
    }
    if (getParameter('remove')) {
      this.log.debug(`Removing plugin ${getParameter('remove')}`);
      await this.plugins.remove(getParameter('remove') as string);
      this.shutdown = true;
      return;
    }
    if (getParameter('enable')) {
      this.log.debug(`Enabling plugin ${getParameter('enable')}`);
      await this.plugins.enable(getParameter('enable') as string);
      this.shutdown = true;
      return;
    }
    if (getParameter('disable')) {
      this.log.debug(`Disabling plugin ${getParameter('disable')}`);
      await this.plugins.disable(getParameter('disable') as string);
      this.shutdown = true;
      return;
    }

    if (hasParameter('factoryreset')) {
      this.initialized = true;
      await this.shutdownProcessAndFactoryReset();
      this.shutdown = true;
      return;
    }

    // Start the matter storage and create the matterbridge context
    try {
      await this.startMatterStorage();
    } catch (error) {
      this.log.fatal(`Fatal error creating matter storage: ${error instanceof Error ? error.message : error}`);
      throw new Error(`Fatal error creating matter storage: ${error instanceof Error ? error.message : error}`);
    }

    // Clear the matterbridge context if the reset parameter is set
    if (hasParameter('reset') && getParameter('reset') === undefined) {
      this.initialized = true;
      await this.shutdownProcessAndReset();
      this.shutdown = true;
      return;
    }

    // Clear matterbridge plugin context if the reset parameter is set
    if (hasParameter('reset') && getParameter('reset') !== undefined) {
      this.log.debug(`Reset plugin ${getParameter('reset')}`);
      const plugin = this.plugins.get(getParameter('reset') as string);
      if (plugin) {
        const matterStorageManager = await this.matterStorageService?.open(plugin.name);
        if (!matterStorageManager) {
          this.log.error(`Plugin ${plg}${plugin.name}${er} storageManager not found`);
        } else {
          await matterStorageManager.createContext('events')?.clearAll();
          await matterStorageManager.createContext('fabrics')?.clearAll();
          await matterStorageManager.createContext('root')?.clearAll();
          await matterStorageManager.createContext('sessions')?.clearAll();
          await matterStorageManager.createContext('persist')?.clearAll();
          this.log.info(`Reset commissionig for plugin ${plg}${plugin.name}${nf} done! Remove the device from the controller.`);
        }
      } else {
        this.log.warn(`Plugin ${plg}${getParameter('reset')}${wr} not registerd in matterbridge`);
      }
      await this.stopMatterStorage();
      this.shutdown = true;
      return;
    }

    // Initialize frontend
    if (getIntParameter('frontend') !== 0 || getIntParameter('frontend') === undefined) await this.frontend.start(getIntParameter('frontend'));

    // Check in 30 seconds the latest and dev versions of matterbridge and the plugins
    this.checkUpdateTimeout = setTimeout(async () => {
      const { checkUpdates } = await import('./update.js');
      checkUpdates(this);
    }, 30 * 1000).unref();

    // Check each 12 hours the latest and dev versions of matterbridge and the plugins
    this.checkUpdateInterval = setInterval(
      async () => {
        const { checkUpdates } = await import('./update.js');
        checkUpdates(this);
      },
      12 * 60 * 60 * 1000, // 12 hours
    ).unref();

    // Start the matterbridge in mode test
    if (hasParameter('test')) {
      this.bridgeMode = 'bridge';
      MatterbridgeEndpoint.bridgeMode = 'bridge';
      return;
    }

    // Start the matterbridge in mode controller
    if (hasParameter('controller')) {
      this.bridgeMode = 'controller';
      await this.startController();
      return;
    }

    // Check if the bridge mode is set and start matterbridge in bridge mode if not set
    if (!hasParameter('bridge') && !hasParameter('childbridge') && (await this.nodeContext?.get<string>('bridgeMode', '')) === '') {
      this.log.info('Setting default matterbridge start mode to bridge');
      await this.nodeContext?.set<string>('bridgeMode', 'bridge');
    }

    // Start matterbridge in bridge mode
    if (hasParameter('bridge') || (!hasParameter('childbridge') && (await this.nodeContext?.get<string>('bridgeMode', '')) === 'bridge')) {
      this.bridgeMode = 'bridge';
      MatterbridgeEndpoint.bridgeMode = 'bridge';
      this.log.debug(`Starting matterbridge in mode ${this.bridgeMode}`);
      await this.startBridge();
      return;
    }

    // Start matterbridge in childbridge mode
    if (hasParameter('childbridge') || (!hasParameter('bridge') && (await this.nodeContext?.get<string>('bridgeMode', '')) === 'childbridge')) {
      this.bridgeMode = 'childbridge';
      MatterbridgeEndpoint.bridgeMode = 'childbridge';
      this.log.debug(`Starting matterbridge in mode ${this.bridgeMode}`);
      await this.startChildbridge();
      return;
    }
  }

  /**
   * Asynchronously loads and starts the registered plugins.
   *
   * This method is responsible for initializing and starting all enabled plugins.
   * It ensures that each plugin is properly loaded and started before the bridge starts.
   *
   * @returns {Promise<void>} A promise that resolves when all plugins have been loaded and started.
   */
  private async startPlugins(): Promise<void> {
    // Check, load and start the plugins
    for (const plugin of this.plugins) {
      plugin.configJson = await this.plugins.loadConfig(plugin);
      plugin.schemaJson = await this.plugins.loadSchema(plugin);
      // Check if the plugin is available
      if (!(await this.plugins.resolve(plugin.path))) {
        this.log.error(`Plugin ${plg}${plugin.name}${er} not found or not validated. Disabling it.`);
        plugin.enabled = false;
        plugin.error = true;
        continue;
      }
      if (!plugin.enabled) {
        this.log.info(`Plugin ${plg}${plugin.name}${nf} not enabled`);
        continue;
      }
      plugin.error = false;
      plugin.locked = false;
      plugin.loaded = false;
      plugin.started = false;
      plugin.configured = false;
      plugin.registeredDevices = undefined;
      plugin.addedDevices = undefined;
      plugin.qrPairingCode = undefined;
      plugin.manualPairingCode = undefined;
      this.plugins.load(plugin, true, 'Matterbridge is starting'); // No await do it asyncronously
    }
    this.frontend.wssSendRefreshRequired('plugins');
  }

  /**
   * Registers the process handlers for uncaughtException, unhandledRejection, SIGINT and SIGTERM.
   * When either of these signals are received, the cleanup method is called with an appropriate message.
   */
  private registerProcessHandlers() {
    this.log.debug(`Registering uncaughtException and unhandledRejection handlers...`);
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');

    this.exceptionHandler = async (error: Error) => {
      const errorMessage = error instanceof Error ? error.message : error;
      const errorInspect = inspect(error, { depth: 10 });
      this.log.error(`Unhandled Exception detected: ${errorMessage}\nstack: ${errorInspect}}`);
    };
    process.on('uncaughtException', this.exceptionHandler);

    this.rejectionHandler = async (reason, promise) => {
      const errorMessage = reason instanceof Error ? reason.message : reason;
      const errorInspect = inspect(reason, { depth: 10 });
      this.log.error(`Unhandled Rejection detected: ${promise}\nreason: ${errorMessage}\nstack: ${errorInspect}`);
    };
    process.on('unhandledRejection', this.rejectionHandler);

    this.log.debug(`Registering SIGINT and SIGTERM signal handlers...`);

    this.sigintHandler = async () => {
      await this.cleanup('SIGINT received, cleaning up...');
    };
    process.on('SIGINT', this.sigintHandler);

    this.sigtermHandler = async () => {
      await this.cleanup('SIGTERM received, cleaning up...');
    };
    process.on('SIGTERM', this.sigtermHandler);
  }

  /**
   * Deregisters the process uncaughtException, unhandledRejection, SIGINT and SIGTERM signal handlers.
   */
  private deregisterProcessHandlers() {
    this.log.debug(`Deregistering uncaughtException and unhandledRejection handlers...`);

    if (this.exceptionHandler) process.off('uncaughtException', this.exceptionHandler);
    this.exceptionHandler = undefined;

    if (this.rejectionHandler) process.off('unhandledRejection', this.rejectionHandler);
    this.rejectionHandler = undefined;

    this.log.debug(`Deregistering SIGINT and SIGTERM signal handlers...`);

    if (this.sigintHandler) process.off('SIGINT', this.sigintHandler);
    this.sigintHandler = undefined;

    if (this.sigtermHandler) process.off('SIGTERM', this.sigtermHandler);
    this.sigtermHandler = undefined;
  }

  /**
   * Logs the node and system information.
   */
  private async logNodeAndSystemInfo() {
    // IP address information
    const networkInterfaces = os.networkInterfaces();
    this.systemInformation.interfaceName = '';
    this.systemInformation.ipv4Address = '';
    this.systemInformation.ipv6Address = '';
    for (const [interfaceName, interfaceDetails] of Object.entries(networkInterfaces)) {
      // this.log.debug(`Checking interface: '${interfaceName}' for '${this.mdnsInterface}'`);
      if (this.mdnsInterface && interfaceName !== this.mdnsInterface) continue;
      if (!interfaceDetails) {
        break;
      }
      for (const detail of interfaceDetails) {
        if (detail.family === 'IPv4' && !detail.internal && this.systemInformation.ipv4Address === '') {
          this.systemInformation.interfaceName = interfaceName;
          this.systemInformation.ipv4Address = detail.address;
          this.systemInformation.macAddress = detail.mac;
        } else if (detail.family === 'IPv6' && !detail.internal && this.systemInformation.ipv6Address === '') {
          this.systemInformation.interfaceName = interfaceName;
          this.systemInformation.ipv6Address = detail.address;
          this.systemInformation.macAddress = detail.mac;
        }
      }
      if (this.systemInformation.ipv4Address !== '' || this.systemInformation.ipv6Address !== '') {
        this.log.debug(`Using interface: '${this.systemInformation.interfaceName}'`);
        this.log.debug(`- with MAC address: '${this.systemInformation.macAddress}'`);
        this.log.debug(`- with IPv4 address: '${this.systemInformation.ipv4Address}'`);
        this.log.debug(`- with IPv6 address: '${this.systemInformation.ipv6Address}'`);
        break;
      }
    }

    // Node information
    this.systemInformation.nodeVersion = process.versions.node;
    const versionMajor = parseInt(this.systemInformation.nodeVersion.split('.')[0]);
    const versionMinor = parseInt(this.systemInformation.nodeVersion.split('.')[1]);
    const versionPatch = parseInt(this.systemInformation.nodeVersion.split('.')[2]);

    // Host system information
    this.systemInformation.hostname = os.hostname();
    this.systemInformation.user = os.userInfo().username;
    this.systemInformation.osType = os.type(); // "Windows_NT", "Darwin", etc.
    this.systemInformation.osRelease = os.release(); // Kernel version
    this.systemInformation.osPlatform = os.platform(); // "win32", "linux", "darwin", etc.
    this.systemInformation.osArch = os.arch(); // "x64", "arm", etc.
    this.systemInformation.totalMemory = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2) + ' GB'; // Convert to GB
    this.systemInformation.freeMemory = (os.freemem() / 1024 / 1024 / 1024).toFixed(2) + ' GB'; // Convert to GB
    this.systemInformation.systemUptime = (os.uptime() / 60 / 60).toFixed(2) + ' hours'; // Convert to hours

    // Log the system information
    this.log.debug('Host System Information:');
    this.log.debug(`- Hostname: ${this.systemInformation.hostname}`);
    this.log.debug(`- User: ${this.systemInformation.user}`);
    this.log.debug(`- Interface: ${this.systemInformation.interfaceName}`);
    this.log.debug(`- MAC Address: ${this.systemInformation.macAddress}`);
    this.log.debug(`- IPv4 Address: ${this.systemInformation.ipv4Address}`);
    this.log.debug(`- IPv6 Address: ${this.systemInformation.ipv6Address}`);
    this.log.debug(`- Node.js: ${versionMajor}.${versionMinor}.${versionPatch}`);
    this.log.debug(`- OS Type: ${this.systemInformation.osType}`);
    this.log.debug(`- OS Release: ${this.systemInformation.osRelease}`);
    this.log.debug(`- Platform: ${this.systemInformation.osPlatform}`);
    this.log.debug(`- Architecture: ${this.systemInformation.osArch}`);
    this.log.debug(`- Total Memory: ${this.systemInformation.totalMemory}`);
    this.log.debug(`- Free Memory: ${this.systemInformation.freeMemory}`);
    this.log.debug(`- System Uptime: ${this.systemInformation.systemUptime}`);

    // Log directories
    this.log.debug(`Root Directory: ${this.rootDirectory}`);
    this.log.debug(`Home Directory: ${this.homeDirectory}`);
    this.log.debug(`Matterbridge Directory: ${this.matterbridgeDirectory}`);
    this.log.debug(`Matterbridge Plugin Directory: ${this.matterbridgePluginDirectory}`);
    this.log.debug(`Matterbridge Matter Certificate Directory: ${this.matterbridgeCertDirectory}`);

    // Global node_modules directory
    if (this.nodeContext) this.globalModulesDirectory = this.matterbridgeInformation.globalModulesDirectory = await this.nodeContext.get<string>('globalModulesDirectory', '');
    if (this.globalModulesDirectory === '') {
      // First run of Matterbridge so the node storage is empty
      try {
        this.execRunningCount++;
        this.matterbridgeInformation.globalModulesDirectory = this.globalModulesDirectory = await getGlobalNodeModules();
        this.execRunningCount--;
        this.log.debug(`Global node_modules Directory: ${this.globalModulesDirectory}`);
        await this.nodeContext?.set<string>('globalModulesDirectory', this.globalModulesDirectory);
      } catch (error) {
        this.log.error(`Error getting global node_modules directory: ${error}`);
      }
    } else this.log.debug(`Global node_modules Directory: ${this.globalModulesDirectory}`);
    /* removed cause is too expensive for the shelly board and not really needed. Why should the globalModulesDirectory change?
    else {
      this.getGlobalNodeModules()
        .then(async (globalModulesDirectory) => {
          this.globalModulesDirectory = globalModulesDirectory;
          this.matterbridgeInformation.globalModulesDirectory = this.globalModulesDirectory;
          this.log.debug(`Global node_modules Directory: ${this.globalModulesDirectory}`);
          await this.nodeContext?.set<string>('globalModulesDirectory', this.globalModulesDirectory);
        })
        .catch((error) => {
          this.log.error(`Error getting global node_modules directory: ${error}`);
        });
    }*/

    // Matterbridge version
    const packageJson = JSON.parse(await fs.readFile(path.join(this.rootDirectory, 'package.json'), 'utf-8'));
    this.matterbridgeVersion = this.matterbridgeLatestVersion = this.matterbridgeDevVersion = packageJson.version;
    this.matterbridgeInformation.matterbridgeVersion = this.matterbridgeInformation.matterbridgeLatestVersion = this.matterbridgeInformation.matterbridgeDevVersion = packageJson.version;
    this.log.debug(`Matterbridge Version: ${this.matterbridgeVersion}`);

    // Matterbridge latest version (will be set in the checkUpdate function)
    if (this.nodeContext) this.matterbridgeLatestVersion = this.matterbridgeInformation.matterbridgeLatestVersion = await this.nodeContext.get<string>('matterbridgeLatestVersion', this.matterbridgeVersion);
    this.log.debug(`Matterbridge Latest Version: ${this.matterbridgeLatestVersion}`);

    // Matterbridge dev version (will be set in the checkUpdate function)
    if (this.nodeContext) this.matterbridgeDevVersion = this.matterbridgeInformation.matterbridgeDevVersion = await this.nodeContext.get<string>('matterbridgeDevVersion', this.matterbridgeVersion);
    this.log.debug(`Matterbridge Dev Version: ${this.matterbridgeDevVersion}`);

    // Current working directory
    const currentDir = process.cwd();
    this.log.debug(`Current Working Directory: ${currentDir}`);

    // Command line arguments (excluding 'node' and the script name)
    const cmdArgs = process.argv.slice(2).join(' ');
    this.log.debug(`Command Line Arguments: ${cmdArgs}`);
  }

  /**
   * Creates a MatterLogger function to show the matter.js log messages in AnsiLogger (for the frontend).
   *
   * @returns {Function} The MatterLogger function.
   */
  private createMatterLogger(): (level: MatterLogLevel, formattedLog: string) => void {
    const matterLogger = new AnsiLogger({ logName: 'Matter', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });

    return (level: MatterLogLevel, formattedLog: string) => {
      const logger = formattedLog.slice(44, 44 + 20).trim();
      const message = formattedLog.slice(65);
      matterLogger.logName = logger;
      switch (level) {
        case MatterLogLevel.DEBUG:
          matterLogger.log(LogLevel.DEBUG, message);
          break;
        case MatterLogLevel.INFO:
          matterLogger.log(LogLevel.INFO, message);
          break;
        case MatterLogLevel.NOTICE:
          matterLogger.log(LogLevel.NOTICE, message);
          break;
        case MatterLogLevel.WARN:
          matterLogger.log(LogLevel.WARN, message);
          break;
        case MatterLogLevel.ERROR:
          matterLogger.log(LogLevel.ERROR, message);
          break;
        case MatterLogLevel.FATAL:
          matterLogger.log(LogLevel.FATAL, message);
          break;
        default:
          matterLogger.log(LogLevel.DEBUG, message);
          break;
      }
    };
  }

  /**
   * Creates a Matter File Logger.
   *
   * @param {string} filePath - The path to the log file.
   * @param {boolean} [unlink=false] - Whether to unlink the log file before creating a new one.
   * @returns {Function} - A function that logs formatted messages to the log file.
   */
  public async createMatterFileLogger(filePath: string, unlink = false) {
    // 2024-08-21 08:55:19.488 DEBUG InteractionMessenger Sending DataReport chunk with 28 attributes and 0 events: 1004 bytes
    let fileSize = 0;
    if (unlink) {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        this.log.debug(`Error unlinking the log file ${CYAN}${filePath}${db}: ${error instanceof Error ? error.message : error}`);
      }
    }

    return async (level: MatterLogLevel, formattedLog: string) => {
      if (fileSize > 100000000) return;
      fileSize += formattedLog.length;
      if (fileSize > 100000000) {
        await fs.appendFile(filePath, `Logging on file has been stoppped because the file size is greater then 100MB.` + os.EOL);
        return;
      }

      const now = new Date();
      const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;

      const message = formattedLog.slice(24);
      const parts = message.split(' ');
      const logger = parts[1];
      const finalMessage = parts.slice(2).join(' ') + os.EOL;

      switch (level) {
        case MatterLogLevel.DEBUG:
          await fs.appendFile(filePath, `[${timestamp}] [${logger}] [debug] ${finalMessage}`);
          break;
        case MatterLogLevel.INFO:
          await fs.appendFile(filePath, `[${timestamp}] [${logger}] [info] ${finalMessage}`);
          break;
        case MatterLogLevel.NOTICE:
          await fs.appendFile(filePath, `[${timestamp}] [${logger}] [notice] ${finalMessage}`);
          break;
        case MatterLogLevel.WARN:
          await fs.appendFile(filePath, `[${timestamp}] [${logger}] [warn] ${finalMessage}`);
          break;
        case MatterLogLevel.ERROR:
          await fs.appendFile(filePath, `[${timestamp}] [${logger}] [error] ${finalMessage}`);
          break;
        case MatterLogLevel.FATAL:
          await fs.appendFile(filePath, `[${timestamp}] [${logger}] [fatal] ${finalMessage}`);
          break;
        default:
          await fs.appendFile(filePath, `[${timestamp}] [${logger}] ${finalMessage}`);
          break;
      }
    };
  }

  /**
   * Restarts the process by exiting the current instance and loading a new instance.
   */
  async restartProcess() {
    await this.cleanup('restarting...', true);
  }

  /**
   * Shut down the process by exiting the current process.
   */
  async shutdownProcess() {
    await this.cleanup('shutting down...', false);
  }

  /**
   * Update matterbridge and and shut down the process.
   */
  async updateProcess() {
    this.log.info('Updating matterbridge...');
    try {
      await spawn.spawnCommand(this, 'npm', ['install', '-g', 'matterbridge', '--omit=dev', '--verbose']);
      this.log.info('Matterbridge has been updated. Full restart required.');
    } catch (error) {
      this.log.error('Error updating matterbridge:', error instanceof Error ? error.message : error);
    }
    this.frontend.wssSendRestartRequired();
    await this.cleanup('updating...', false);
  }

  /**
   * Unregister all devices and shut down the process.
   */
  async unregisterAndShutdownProcess() {
    this.log.info('Unregistering all devices and shutting down...');
    for (const plugin of this.plugins) {
      await this.removeAllBridgedEndpoints(plugin.name, 250);
    }
    this.log.debug('Waiting for the MessageExchange to finish...');
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second for MessageExchange to finish
    this.log.debug('Cleaning up and shutting down...');
    await this.cleanup('unregistered all devices and shutting down...', false);
  }

  /**
   * Reset commissioning and shut down the process.
   */
  async shutdownProcessAndReset() {
    await this.cleanup('shutting down with reset...', false);
  }

  /**
   * Factory reset and shut down the process.
   */
  async shutdownProcessAndFactoryReset() {
    await this.cleanup('shutting down with factory reset...', false);
  }

  /**
   * Cleans up the Matterbridge instance.
   * @param {string} message - The cleanup message.
   * @param {boolean} [restart=false] - Indicates whether to restart the instance after cleanup. Default is `false`.
   * @returns A promise that resolves when the cleanup is completed.
   */
  protected async cleanup(message: string, restart = false): Promise<void> {
    if (this.initialized && !this.hasCleanupStarted) {
      this.emit('cleanup_started');
      this.hasCleanupStarted = true;
      this.log.info(message);

      // Clear the start matter interval
      if (this.startMatterInterval) {
        clearInterval(this.startMatterInterval);
        this.startMatterInterval = undefined;
        this.log.debug('Start matter interval cleared');
      }

      // Clear the check update timeout
      if (this.checkUpdateTimeout) {
        clearInterval(this.checkUpdateTimeout);
        this.checkUpdateTimeout = undefined;
        this.log.debug('Check update timeout cleared');
      }

      // Clear the check update interval
      if (this.checkUpdateInterval) {
        clearInterval(this.checkUpdateInterval);
        this.checkUpdateInterval = undefined;
        this.log.debug('Check update interval cleared');
      }

      // Clear the configure timeout
      if (this.configureTimeout) {
        clearTimeout(this.configureTimeout);
        this.configureTimeout = undefined;
        this.log.debug('Matterbridge configure timeout cleared');
      }

      // Clear the reachability timeout
      if (this.reachabilityTimeout) {
        clearTimeout(this.reachabilityTimeout);
        this.reachabilityTimeout = undefined;
        this.log.debug('Matterbridge reachability timeout cleared');
      }

      // Calling the shutdown method of each plugin and clear the plugins reachability timeout
      for (const plugin of this.plugins) {
        if (!plugin.enabled || plugin.error) continue;
        await this.plugins.shutdown(plugin, 'Matterbridge is closing: ' + message, false);
        if (plugin.reachabilityTimeout) {
          clearTimeout(plugin.reachabilityTimeout);
          plugin.reachabilityTimeout = undefined;
          this.log.debug(`Plugin ${plg}${plugin.name}${db} reachability timeout cleared`);
        }
      }

      // Stop matter server nodes
      this.log.notice(`Stopping matter server nodes in ${this.bridgeMode} mode...`);
      this.log.debug('Waiting for the MessageExchange to finish...');
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second for MessageExchange to finish
      if (this.bridgeMode === 'bridge') {
        if (this.serverNode) {
          await this.stopServerNode(this.serverNode);
          this.serverNode = undefined;
        }
      }
      if (this.bridgeMode === 'childbridge') {
        for (const plugin of this.plugins.array()) {
          if (plugin.serverNode) {
            await this.stopServerNode(plugin.serverNode);
            plugin.serverNode = undefined;
          }
        }
      }
      this.log.notice('Stopped matter server nodes');

      // Matter commisioning reset
      if (message === 'shutting down with reset...') {
        this.log.info('Resetting Matterbridge commissioning information...');
        await this.matterStorageManager?.createContext('events')?.clearAll();
        await this.matterStorageManager?.createContext('fabrics')?.clearAll();
        await this.matterStorageManager?.createContext('root')?.clearAll();
        await this.matterStorageManager?.createContext('sessions')?.clearAll();
        await this.matterbridgeContext?.clearAll();
        this.log.info('Matter storage reset done! Remove the bridge from the controller.');
      }

      // Stop matter storage
      await this.stopMatterStorage();

      // Stop the frontend
      await this.frontend.stop();

      // Remove the matterfilelogger
      try {
        Logger.removeLogger('matterfilelogger');
      } catch (error) {
        this.log.debug(`Error removing the matterfilelogger for file ${CYAN}${path.join(this.matterbridgeDirectory, this.matterLoggerFile)}${db}: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Close the matterbridge node storage and context
      if (this.nodeStorage && this.nodeContext) {
        /*
        TODO: Implement serialization of registered devices in edge mode
        this.log.info('Saving registered devices...');
        const serializedRegisteredDevices: SerializedMatterbridgeEndpoint[] = [];
        this.devices.forEach(async (device) => {
          const serializedMatterbridgeDevice = MatterbridgeEndpoint.serialize(device);
          // this.log.info(`- ${serializedMatterbridgeDevice.deviceName}${rs}\n`, serializedMatterbridgeDevice);
          if (serializedMatterbridgeDevice) serializedRegisteredDevices.push(serializedMatterbridgeDevice);
        });
        await this.nodeContext.set<SerializedMatterbridgeEndpoint[]>('devices', serializedRegisteredDevices);
        this.log.info(`Saved registered devices (${serializedRegisteredDevices?.length})`);
        */

        // Clear nodeContext and nodeStorage (they just need 1000ms to write the data to disk)
        this.log.debug(`Closing node storage context for ${plg}Matterbridge${db}...`);
        await this.nodeContext.close();
        this.nodeContext = undefined;
        // Clear nodeContext for each plugin (they just need 1000ms to write the data to disk)
        for (const plugin of this.plugins) {
          if (plugin.nodeContext) {
            this.log.debug(`Closing node storage context for plugin ${plg}${plugin.name}${db}...`);
            await plugin.nodeContext.close();
            plugin.nodeContext = undefined;
          }
        }
        this.log.debug('Closing node storage manager...');
        await this.nodeStorage.close();
        this.nodeStorage = undefined;
      } else {
        this.log.error('Error close the matterbridge node storage and context: nodeStorage or nodeContext not found!');
      }
      this.plugins.clear();
      this.devices.clear();

      // Factory reset
      if (message === 'shutting down with factory reset...') {
        try {
          // Delete matter storage directory with its subdirectories and backup
          const dir = path.join(this.matterbridgeDirectory, this.matterStorageName);
          this.log.info(`Removing matter storage directory: ${dir}`);
          await fs.rm(dir, { recursive: true });
          const backup = path.join(this.matterbridgeDirectory, this.matterStorageName + '.backup');
          this.log.info(`Removing matter storage backup directory: ${backup}`);
          await fs.rm(backup, { recursive: true });
        } catch (error) {
          if (error instanceof Error && (error as NodeJS.ErrnoException).code !== 'ENOENT') {
            this.log.error(`Error removing matter storage directory: ${error}`);
          }
        }
        try {
          // Delete matterbridge storage directory with its subdirectories and backup
          const dir = path.join(this.matterbridgeDirectory, this.nodeStorageName);
          this.log.info(`Removing matterbridge storage directory: ${dir}`);
          await fs.rm(dir, { recursive: true });
          const backup = path.join(this.matterbridgeDirectory, this.nodeStorageName + '.backup');
          this.log.info(`Removing matterbridge storage backup directory: ${backup}`);
          await fs.rm(backup, { recursive: true });
        } catch (error) {
          if (error instanceof Error && (error as NodeJS.ErrnoException).code !== 'ENOENT') {
            this.log.error(`Error removing matterbridge storage directory: ${error}`);
          }
        }
        this.log.info('Factory reset done! Remove all paired fabrics from the controllers.');
      }

      // Deregisters the process handlers
      this.deregisterProcessHandlers();

      if (restart) {
        if (message === 'updating...') {
          this.log.info('Cleanup completed. Updating...');
          Matterbridge.instance = undefined;
          this.emit('update'); // Restart the process but the update has been done before. TODO move all updates to the cli
        } else if (message === 'restarting...') {
          this.log.info('Cleanup completed. Restarting...');
          Matterbridge.instance = undefined;
          this.emit('restart');
        }
      } else {
        this.log.notice('Cleanup completed. Shutting down...');
        Matterbridge.instance = undefined;
        this.emit('shutdown');
      }
      this.hasCleanupStarted = false;
      this.initialized = false;
      this.emit('cleanup_completed');
    } else {
      this.log.debug('Cleanup already started...');
    }
  }

  /**
   * Creates and configures the server node for an accessory plugin for a given device.
   *
   * @param {RegisteredPlugin} plugin - The plugin to configure.
   * @param {MatterbridgeEndpoint} device - The device to associate with the plugin.
   * @param {boolean} [start=false] - Whether to start the server node after adding the device.
   * @returns {Promise<void>} A promise that resolves when the server node for the accessory plugin is created and configured.
   */
  private async createAccessoryPlugin(plugin: RegisteredPlugin, device: MatterbridgeEndpoint, start = false): Promise<void> {
    if (!plugin.locked && device.deviceName && device.vendorId && device.productId && device.vendorName && device.productName) {
      plugin.locked = true;
      plugin.device = device;
      plugin.storageContext = await this.createServerNodeContext(plugin.name, device.deviceName, DeviceTypeId(device.deviceType), device.vendorId, device.vendorName, device.productId, device.productName);
      plugin.serverNode = await this.createServerNode(plugin.storageContext, this.port ? this.port++ : undefined, this.passcode ? this.passcode++ : undefined, this.discriminator ? this.discriminator++ : undefined);
      plugin.serialNumber = await plugin.storageContext.get('serialNumber', '');
      this.log.debug(`Adding ${plg}${plugin.name}${db}:${dev}${device.deviceName}${db} to ${plg}${plugin.name}${db} server node`);
      await plugin.serverNode.add(device);
      if (start) await this.startServerNode(plugin.serverNode);
    }
  }

  /**
   * Creates and configures the server node for a dynamic plugin.
   *
   * @param {RegisteredPlugin} plugin - The plugin to configure.
   * @param {boolean} [start=false] - Whether to start the server node after adding the aggregator node.
   * @returns {Promise<void>} A promise that resolves when the server node for the dynamic plugin is created and configured.
   */
  private async createDynamicPlugin(plugin: RegisteredPlugin, start = false): Promise<void> {
    if (!plugin.locked) {
      plugin.locked = true;
      plugin.storageContext = await this.createServerNodeContext(plugin.name, 'Matterbridge', bridge.code, this.aggregatorVendorId, this.aggregatorVendorName, this.aggregatorProductId, plugin.description);
      plugin.serverNode = await this.createServerNode(plugin.storageContext, this.port ? this.port++ : undefined, this.passcode ? this.passcode++ : undefined, this.discriminator ? this.discriminator++ : undefined);
      plugin.aggregatorNode = await this.createAggregatorNode(plugin.storageContext);
      plugin.serialNumber = await plugin.storageContext.get('serialNumber', '');
      await plugin.serverNode.add(plugin.aggregatorNode);
      if (start) await this.startServerNode(plugin.serverNode);
    }
  }

  /**
   * Starts the Matterbridge in bridge mode.
   * @private
   * @returns {Promise<void>} A promise that resolves when the Matterbridge is started.
   */
  private async startBridge(): Promise<void> {
    // Plugins are configured by a timer when matter server is started and plugin.configured is set to true
    if (!this.matterStorageManager) throw new Error('No storage manager initialized');
    if (!this.matterbridgeContext) throw new Error('No storage context initialized');

    this.serverNode = await this.createServerNode(this.matterbridgeContext, this.port ? this.port++ : undefined, this.passcode ? this.passcode++ : undefined, this.discriminator ? this.discriminator++ : undefined);
    this.aggregatorNode = await this.createAggregatorNode(this.matterbridgeContext);
    await this.serverNode.add(this.aggregatorNode);

    await addVirtualDevices(this, this.aggregatorNode);

    await this.startPlugins();

    this.log.debug('Starting start matter interval in bridge mode');
    let failCount = 0;
    this.startMatterInterval = setInterval(async () => {
      for (const plugin of this.plugins) {
        if (!plugin.enabled) continue;
        if (plugin.error) {
          clearInterval(this.startMatterInterval);
          this.startMatterInterval = undefined;
          this.log.debug('Cleared startMatterInterval interval for Matterbridge for plugin in error state');
          this.log.error(`The plugin ${plg}${plugin.name}${er} is in error state.`);
          this.log.error('The bridge will not start until the problem is solved to prevent the controllers from deleting all registered devices.');
          this.log.error('If you want to start the bridge disable the plugin in error state and restart.');
          this.frontend.wssSendSnackbarMessage(`The plugin ${plugin.name} is in error state. Check the logs.`, 0, 'error');
          return;
        }

        if (!plugin.loaded || !plugin.started) {
          this.log.debug(`Waiting (failSafeCount=${failCount}/${this.failCountLimit}) in startMatterInterval interval for plugin ${plg}${plugin.name}${db} loaded: ${plugin.loaded} started: ${plugin.started}...`);
          failCount++;
          if (failCount > this.failCountLimit) {
            this.log.error(`Error waiting for plugin ${plg}${plugin.name}${er} to load and start. Plugin is in error state.`);
            plugin.error = true;
          }
          return;
        }
      }
      clearInterval(this.startMatterInterval);
      this.startMatterInterval = undefined;
      this.log.debug('Cleared startMatterInterval interval for Matterbridge');

      // Start the Matter server node
      this.startServerNode(this.serverNode);

      // Configure the plugins
      this.configureTimeout = setTimeout(async () => {
        for (const plugin of this.plugins) {
          if (!plugin.enabled || !plugin.loaded || !plugin.started || plugin.error) continue;
          try {
            if ((await this.plugins.configure(plugin)) === undefined) {
              if (plugin.configured !== true) this.frontend.wssSendSnackbarMessage(`The plugin ${plugin.name} failed to configure. Check the logs.`, 0, 'error');
            }
          } catch (error) {
            plugin.error = true;
            this.log.error(`Error configuring plugin ${plg}${plugin.name}${er}`, error);
          }
        }
        this.frontend.wssSendRefreshRequired('plugins');
      }, 30 * 1000);

      // Setting reachability to true
      this.reachabilityTimeout = setTimeout(() => {
        this.log.info(`Setting reachability to true for ${plg}Matterbridge${db}`);
        if (this.aggregatorNode) this.setAggregatorReachability(this.aggregatorNode, true);
        this.frontend.wssSendRefreshRequired('reachability');
      }, 60 * 1000);
    }, 1000);
  }

  /**
   * Starts the Matterbridge in childbridge mode.
   * @private
   * @returns {Promise<void>} A promise that resolves when the Matterbridge is started.
   */
  private async startChildbridge(): Promise<void> {
    if (!this.matterStorageManager) throw new Error('No storage manager initialized');

    await this.startPlugins();

    this.log.debug('Starting start matter interval in childbridge mode...');
    let failCount = 0;
    this.startMatterInterval = setInterval(async () => {
      let allStarted = true;
      for (const plugin of this.plugins) {
        if (!plugin.enabled) continue;
        if (plugin.error) {
          clearInterval(this.startMatterInterval);
          this.startMatterInterval = undefined;
          this.log.debug('Cleared startMatterInterval interval for a plugin in error state');
          this.log.error(`The plugin ${plg}${plugin.name}${er} is in error state.`);
          this.log.error('The bridge will not start until the problem is solved to prevent the controllers from deleting all registered devices.');
          this.log.error('If you want to start the bridge disable the plugin in error state and restart.');
          this.frontend.wssSendSnackbarMessage(`The plugin ${plugin.name} is in error state. Check the logs.`, 0, 'error');
          return;
        }

        this.log.debug(`Checking plugin ${plg}${plugin.name}${db} to start matter in childbridge mode...`);
        if (!plugin.loaded || !plugin.started) {
          allStarted = false;
          this.log.debug(`Waiting (failSafeCount=${failCount}/${this.failCountLimit}) for plugin ${plg}${plugin.name}${db} to load (${plugin.loaded}) and start (${plugin.started}) ...`);
          failCount++;
          if (failCount > this.failCountLimit) {
            this.log.error(`Error waiting for plugin ${plg}${plugin.name}${er} to load and start. Plugin is in error mode.`);
            plugin.error = true;
          }
        }
      }
      if (!allStarted) return;
      clearInterval(this.startMatterInterval);
      this.startMatterInterval = undefined;
      this.log.debug('Cleared startMatterInterval interval in childbridge mode');

      // Configure the plugins
      this.configureTimeout = setTimeout(async () => {
        for (const plugin of this.plugins) {
          if (!plugin.enabled || !plugin.loaded || !plugin.started || plugin.error) continue;
          try {
            if ((await this.plugins.configure(plugin)) === undefined) {
              if (plugin.configured !== true) this.frontend.wssSendSnackbarMessage(`The plugin ${plugin.name} failed to configure. Check the logs.`, 0, 'error');
            }
          } catch (error) {
            plugin.error = true;
            this.log.error(`Error configuring plugin ${plg}${plugin.name}${er}`, error);
          }
        }
        this.frontend.wssSendRefreshRequired('plugins');
      }, 30 * 1000);

      for (const plugin of this.plugins) {
        if (!plugin.enabled || plugin.error) continue;
        if (plugin.type !== 'DynamicPlatform' && (!plugin.addedDevices || plugin.addedDevices === 0)) {
          this.log.error(`Plugin ${plg}${plugin.name}${er} didn't add any devices to Matterbridge. Verify the plugin configuration.`);
          continue;
        }
        if (!plugin.serverNode) {
          this.log.error(`Server node not found for plugin ${plg}${plugin.name}${er}`);
          continue;
        }
        if (!plugin.storageContext) {
          this.log.error(`Storage context not found for plugin ${plg}${plugin.name}${er}`);
          continue;
        }
        if (!plugin.nodeContext) {
          this.log.error(`Node storage context not found for plugin ${plg}${plugin.name}${er}`);
          continue;
        }
        // Start the Matter server node
        this.startServerNode(plugin.serverNode);

        // Setting reachability to true
        plugin.reachabilityTimeout = setTimeout(() => {
          this.log.info(`Setting reachability to true for ${plg}${plugin.name}${nf} type ${plugin.type} server node ${plugin.serverNode !== undefined} aggregator node ${plugin.aggregatorNode !== undefined} device ${plugin.device !== undefined}`);
          if (plugin.type === 'DynamicPlatform' && plugin.aggregatorNode) this.setAggregatorReachability(plugin.aggregatorNode, true);
          this.frontend.wssSendRefreshRequired('reachability');
        }, 60 * 1000);
      }
    }, 1000);
  }

  /**
   * Starts the Matterbridge controller.
   * @private
   * @returns {Promise<void>} A promise that resolves when the Matterbridge is started.
   */
  protected async startController(): Promise<void> {
    /*
    if (!this.matterStorageManager) {
      this.log.error('No storage manager initialized');
      await this.cleanup('No storage manager initialized');
      return;
    }
    this.log.info('Creating context: mattercontrollerContext');
    this.controllerContext = this.matterStorageManager.createContext('mattercontrollerContext');
    if (!this.controllerContext) {
      this.log.error('No storage context mattercontrollerContext initialized');
      await this.cleanup('No storage context mattercontrollerContext initialized');
      return;
    }

    this.log.debug('Starting matterbridge in mode', this.bridgeMode);
    this.matterServer = await this.createMatterServer(this.storageManager);
    this.log.info('Creating matter commissioning controller');
    this.commissioningController = new CommissioningController({
      autoConnect: false,
    });
    this.log.info('Adding matter commissioning controller to matter server');
    await this.matterServer.addCommissioningController(this.commissioningController);

    this.log.info('Starting matter server');
    await this.matterServer.start();
    this.log.info('Matter server started');
  const commissioningOptions: ControllerCommissioningFlowOptions = {
      regulatoryLocation: GeneralCommissioning.RegulatoryLocationType.IndoorOutdoor,
      regulatoryCountryCode: 'XX',
    };
const commissioningController = new CommissioningController({
  environment: {
      environment,
      id: uniqueId,
  },
  autoConnect: false, // Do not auto connect to the commissioned nodes
  adminFabricLabel,
});

    if (hasParameter('pairingcode')) {
      this.log.info('Pairing device with pairingcode:', getParameter('pairingcode'));
      const pairingCode = getParameter('pairingcode');
      const ip = this.controllerContext.has('ip') ? this.controllerContext.get<string>('ip') : undefined;
      const port = this.controllerContext.has('port') ? this.controllerContext.get<number>('port') : undefined;

      let longDiscriminator, setupPin, shortDiscriminator;
      if (pairingCode !== undefined) {
        const pairingCodeCodec = ManualPairingCodeCodec.decode(pairingCode);
        shortDiscriminator = pairingCodeCodec.shortDiscriminator;
        longDiscriminator = undefined;
        setupPin = pairingCodeCodec.passcode;
        this.log.info(`Data extracted from pairing code: ${Logger.toJSON(pairingCodeCodec)}`);
      } else {
        longDiscriminator = await this.controllerContext.get('longDiscriminator', 3840);
        if (longDiscriminator > 4095) throw new Error('Discriminator value must be less than 4096');
        setupPin = this.controllerContext.get('pin', 20202021);
      }
      if ((shortDiscriminator === undefined && longDiscriminator === undefined) || setupPin === undefined) {
        throw new Error('Please specify the longDiscriminator of the device to commission with -longDiscriminator or provide a valid passcode with -passcode');
      }

      const options = {
        commissioning: commissioningOptions,
        discovery: {
          knownAddress: ip !== undefined && port !== undefined ? { ip, port, type: 'udp' } : undefined,
          identifierData: longDiscriminator !== undefined ? { longDiscriminator } : shortDiscriminator !== undefined ? { shortDiscriminator } : {},
        },
        passcode: setupPin,
      } as NodeCommissioningOptions;
      this.log.info('Commissioning with options:', options);
      const nodeId = await this.commissioningController.commissionNode(options);
      this.log.info(`Commissioning successfully done with nodeId: ${nodeId}`);
      this.log.info('ActiveSessionInformation:', this.commissioningController.getActiveSessionInformation());
    } // (hasParameter('pairingcode'))

    if (hasParameter('unpairall')) {
      this.log.info('***Commissioning controller unpairing all nodes...');
      const nodeIds = this.commissioningController.getCommissionedNodes();
      for (const nodeId of nodeIds) {
        this.log.info('***Commissioning controller unpairing node:', nodeId);
        await this.commissioningController.removeNode(nodeId);
      }
      return;
    }

    if (hasParameter('discover')) {
      // const discover = await this.commissioningController.discoverCommissionableDevices({ productId: 0x8000, deviceType: 0xfff1 });
      // console.log(discover);
    }

    if (!this.commissioningController.isCommissioned()) {
      this.log.info('***Commissioning controller is not commissioned: use matterbridge -controller -pairingcode [pairingcode] to commission a device');
      return;
    }

    const nodeIds = this.commissioningController.getCommissionedNodes();
    this.log.info(`***Commissioning controller is commissioned ${this.commissioningController.isCommissioned()} and has ${nodeIds.length} nodes commisioned: `);
    for (const nodeId of nodeIds) {
      this.log.info(`***Connecting to commissioned node: ${nodeId}`);

      const node = await this.commissioningController.connectNode(nodeId, {
        autoSubscribe: false,
        attributeChangedCallback: (peerNodeId, { path: { nodeId, clusterId, endpointId, attributeName }, value }) =>
          this.log.info(`***Commissioning controller attributeChangedCallback ${peerNodeId}: attribute ${nodeId}/${endpointId}/${clusterId}/${attributeName} changed to ${Logger.toJSON(value)}`),
        eventTriggeredCallback: (peerNodeId, { path: { nodeId, clusterId, endpointId, eventName }, events }) =>
          this.log.info(`***Commissioning controller eventTriggeredCallback ${peerNodeId}: Event ${nodeId}/${endpointId}/${clusterId}/${eventName} triggered with ${Logger.toJSON(events)}`),
        stateInformationCallback: (peerNodeId, info) => {
          switch (info) {
            case NodeStateInformation.Connected:
              this.log.info(`***Commissioning controller stateInformationCallback ${peerNodeId}: Node ${nodeId} connected`);
              break;
            case NodeStateInformation.Disconnected:
              this.log.info(`***Commissioning controller stateInformationCallback ${peerNodeId}: Node ${nodeId} disconnected`);
              break;
            case NodeStateInformation.Reconnecting:
              this.log.info(`***Commissioning controller stateInformationCallback ${peerNodeId}: Node ${nodeId} reconnecting`);
              break;
            case NodeStateInformation.WaitingForDeviceDiscovery:
              this.log.info(`***Commissioning controller stateInformationCallback ${peerNodeId}: Node ${nodeId} waiting for device discovery`);
              break;
            case NodeStateInformation.StructureChanged:
              this.log.info(`***Commissioning controller stateInformationCallback ${peerNodeId}: Node ${nodeId} structure changed`);
              break;
            case NodeStateInformation.Decommissioned:
              this.log.info(`***Commissioning controller stateInformationCallback ${peerNodeId}: Node ${nodeId} decommissioned`);
              break;
            default:
              this.log.info(`***Commissioning controller stateInformationCallback ${peerNodeId}: Node ${nodeId} NodeStateInformation.${info}`);
              break;
          }
        },
      });

      node.logStructure();

      // Get the interaction client
      this.log.info('Getting the interaction client');
      const interactionClient = await node.getInteractionClient();
      let cluster;
      let attributes;

      // Log BasicInformationCluster
      cluster = BasicInformationCluster;
      attributes = await interactionClient.getMultipleAttributes({
        attributes: [{ clusterId: cluster.id }],
      });
      if (attributes.length > 0) this.log.info(`Cluster: ${idn}${cluster.name}${rs}${nf} attributes:`);
      attributes.forEach((attribute) => {
        this.log.info(
          `- endpoint ${or}${attribute.path.endpointId}${nf} cluster ${hk}${getClusterNameById(attribute.path.clusterId)}${nf} (${hk}0x${attribute.path.clusterId.toString(16)}${nf}) attribute ${zb}${attribute.path.attributeName}${nf} (${zb}0x${attribute.path.attributeId.toString(16)}${nf}): ${typeof attribute.value === 'object' ? stringify(attribute.value) : attribute.value}`,
        );
      });

      // Log PowerSourceCluster
      cluster = PowerSourceCluster;
      attributes = await interactionClient.getMultipleAttributes({
        attributes: [{ clusterId: cluster.id }],
      });
      if (attributes.length > 0) this.log.info(`Cluster: ${idn}${cluster.name}${rs}${nf} attributes:`);
      attributes.forEach((attribute) => {
        this.log.info(
          `- endpoint ${or}${attribute.path.endpointId}${nf} cluster ${hk}${getClusterNameById(attribute.path.clusterId)}${nf} (${hk}0x${attribute.path.clusterId.toString(16)}${nf}) attribute ${zb}${attribute.path.attributeName}${nf} (${zb}0x${attribute.path.attributeId.toString(16)}${nf}): ${typeof attribute.value === 'object' ? stringify(attribute.value) : attribute.value}`,
        );
      });

      // Log ThreadNetworkDiagnostics
      cluster = ThreadNetworkDiagnosticsCluster;
      attributes = await interactionClient.getMultipleAttributes({
        attributes: [{ clusterId: cluster.id }],
      });
      if (attributes.length > 0) this.log.info(`Cluster: ${idn}${cluster.name}${rs}${nf} attributes:`);
      attributes.forEach((attribute) => {
        this.log.info(
          `- endpoint ${or}${attribute.path.endpointId}${nf} cluster ${hk}${getClusterNameById(attribute.path.clusterId)}${nf} (${hk}0x${attribute.path.clusterId.toString(16)}${nf}) attribute ${zb}${attribute.path.attributeName}${nf} (${zb}0x${attribute.path.attributeId.toString(16)}${nf}): ${typeof attribute.value === 'object' ? stringify(attribute.value) : attribute.value}`,
        );
      });

      // Log SwitchCluster
      cluster = SwitchCluster;
      attributes = await interactionClient.getMultipleAttributes({
        attributes: [{ clusterId: cluster.id }],
      });
      if (attributes.length > 0) this.log.info(`Cluster: ${idn}${cluster.name}${rs}${nf} attributes:`);
      attributes.forEach((attribute) => {
        this.log.info(
          `- endpoint ${or}${attribute.path.endpointId}${nf} cluster ${hk}${getClusterNameById(attribute.path.clusterId)}${nf} (${hk}0x${attribute.path.clusterId.toString(16)}${nf}) attribute ${zb}${attribute.path.attributeName}${nf} (${zb}0x${attribute.path.attributeId.toString(16)}${nf}): ${typeof attribute.value === 'object' ? stringify(attribute.value) : attribute.value}`,
        );
      });

      this.log.info('Subscribing to all attributes and events');
      await node.subscribeAllAttributesAndEvents({
        ignoreInitialTriggers: false,
        attributeChangedCallback: ({ path: { nodeId, clusterId, endpointId, attributeName }, version, value }) =>
          this.log.info(
            `***${db}Commissioning controller attributeChangedCallback version ${version}: attribute ${BLUE}${nodeId}${db}/${or}${endpointId}${db}/${hk}${getClusterNameById(clusterId)}${db}/${zb}${attributeName}${db} changed to ${typeof value === 'object' ? debugStringify(value ?? { none: true }) : value}`,
          ),
        eventTriggeredCallback: ({ path: { nodeId, clusterId, endpointId, eventName }, events }) => {
          this.log.info(
            `***${db}Commissioning controller eventTriggeredCallback: event ${BLUE}${nodeId}${db}/${or}${endpointId}${db}/${hk}${getClusterNameById(clusterId)}${db}/${zb}${eventName}${db} triggered with ${debugStringify(events ?? { none: true })}`,
          );
        },
      });
      this.log.info('Subscribed to all attributes and events');
    }
    */
  }

  /** ***********************************************************************************************************************************/
  /**                                                     Matter.js methods                                                             */
  /** ***********************************************************************************************************************************/

  /**
   * Starts the matter storage with name Matterbridge, create the matterbridge context and performs a backup.
   * @returns {Promise<void>} - A promise that resolves when the storage is started.
   */
  private async startMatterStorage(): Promise<void> {
    // Setup Matter storage
    this.log.info(`Starting matter node storage...`);

    this.matterStorageService = this.environment.get(StorageService);
    this.log.info(`Matter node storage service created: ${this.matterStorageService.location}`);

    this.matterStorageManager = await this.matterStorageService.open('Matterbridge');
    this.log.info('Matter node storage manager "Matterbridge" created');

    this.matterbridgeContext = await this.createServerNodeContext('Matterbridge', 'Matterbridge', bridge.code, this.aggregatorVendorId, this.aggregatorVendorName, this.aggregatorProductId, this.aggregatorProductName);
    this.matterbridgeInformation.matterbridgeSerialNumber = await this.matterbridgeContext.get('serialNumber', '');

    this.log.info('Matter node storage started');

    // Backup matter storage since it is created/opened correctly
    await this.backupMatterStorage(path.join(this.matterbridgeDirectory, this.matterStorageName), path.join(this.matterbridgeDirectory, this.matterStorageName + '.backup'));
  }

  /**
   * Makes a backup copy of the specified matter storage directory.
   *
   * @param storageName - The name of the storage directory to be backed up.
   * @param backupName - The name of the backup directory to be created.
   * @returns {Promise<void>} A promise that resolves when the has been done.
   */
  private async backupMatterStorage(storageName: string, backupName: string): Promise<void> {
    this.log.info('Creating matter node storage backup...');
    try {
      await copyDirectory(storageName, backupName);
      this.log.info('Created matter node storage backup');
    } catch (error) {
      this.log.error(`Error creating matter node storage backup from ${storageName} to ${backupName}:`, error);
    }
  }

  /**
   * Stops the matter storage.
   * @returns {Promise<void>} A promise that resolves when the storage is stopped.
   */
  private async stopMatterStorage(): Promise<void> {
    this.log.info('Closing matter node storage...');
    await this.matterStorageManager?.close();
    this.matterStorageService = undefined;
    this.matterStorageManager = undefined;
    this.matterbridgeContext = undefined;
    this.log.info('Matter node storage closed');
  }

  /**
   * Creates a server node storage context.
   *
   * @param {string} pluginName - The name of the plugin.
   * @param {string} deviceName - The name of the device.
   * @param {DeviceTypeId} deviceType - The device type of the device.
   * @param {number} vendorId - The vendor ID.
   * @param {string} vendorName - The vendor name.
   * @param {number} productId - The product ID.
   * @param {string} productName - The product name.
   * @param {string} [serialNumber] - The serial number of the device (optional).
   * @returns {Promise<StorageContext>} The storage context for the commissioning server.
   */
  private async createServerNodeContext(pluginName: string, deviceName: string, deviceType: DeviceTypeId, vendorId: number, vendorName: string, productId: number, productName: string, serialNumber?: string): Promise<StorageContext> {
    const { randomBytes } = await import('node:crypto');
    if (!this.matterStorageService) throw new Error('No storage service initialized');

    this.log.info(`Creating server node storage context "${pluginName}.persist" for ${pluginName}...`);
    const storageManager = await this.matterStorageService.open(pluginName);
    const storageContext = storageManager.createContext('persist');
    const random = randomBytes(8).toString('hex');
    await storageContext.set('storeId', pluginName);
    await storageContext.set('deviceName', deviceName);
    await storageContext.set('deviceType', deviceType);
    await storageContext.set('vendorId', vendorId);
    await storageContext.set('vendorName', vendorName.slice(0, 32));
    await storageContext.set('productId', productId);
    await storageContext.set('productName', productName.slice(0, 32));
    await storageContext.set('nodeLabel', productName.slice(0, 32));
    await storageContext.set('productLabel', productName.slice(0, 32));
    await storageContext.set('serialNumber', await storageContext.get('serialNumber', serialNumber ? serialNumber.slice(0, 32) : 'SN' + random));
    await storageContext.set('uniqueId', await storageContext.get('uniqueId', 'UI' + random));
    await storageContext.set('softwareVersion', isValidNumber(parseVersionString(this.matterbridgeVersion), 0, UINT32_MAX) ? parseVersionString(this.matterbridgeVersion) : 1);
    await storageContext.set('softwareVersionString', isValidString(this.matterbridgeVersion, 5, 64) ? this.matterbridgeVersion : '1.0.0');
    await storageContext.set('hardwareVersion', isValidNumber(parseVersionString(this.systemInformation.osRelease), 0, UINT16_MAX) ? parseVersionString(this.systemInformation.osRelease) : 1);
    await storageContext.set('hardwareVersionString', isValidString(this.systemInformation.osRelease, 5, 64) ? this.systemInformation.osRelease : '1.0.0');

    this.log.debug(`Created server node storage context "${pluginName}.persist" for ${pluginName}:`);
    this.log.debug(`- storeId: ${await storageContext.get('storeId')}`);
    this.log.debug(`- deviceName: ${await storageContext.get('deviceName')}`);
    this.log.debug(`- deviceType: ${await storageContext.get('deviceType')}(0x${(await storageContext.get('deviceType'))?.toString(16).padStart(4, '0')})`);
    this.log.debug(`- serialNumber: ${await storageContext.get('serialNumber')}`);
    this.log.debug(`- uniqueId: ${await storageContext.get('uniqueId')}`);
    this.log.debug(`- softwareVersion: ${await storageContext.get('softwareVersion')} softwareVersionString: ${await storageContext.get('softwareVersionString')}`);
    this.log.debug(`- hardwareVersion: ${await storageContext.get('hardwareVersion')} hardwareVersionString: ${await storageContext.get('hardwareVersionString')}`);
    return storageContext;
  }

  /**
   * Creates a server node.
   *
   * @param {StorageContext} storageContext - The storage context for the server node.
   * @param {number} [port=5540] - The port number for the server node. Defaults to 5540.
   * @param {number} [passcode=20242025] - The passcode for the server node. Defaults to 20242025.
   * @param {number} [discriminator=3850] - The discriminator for the server node. Defaults to 3850.
   * @returns {Promise<ServerNode<ServerNode.RootEndpoint>>} A promise that resolves to the created server node.
   */
  private async createServerNode(storageContext: StorageContext, port = 5540, passcode = 20242025, discriminator = 3850): Promise<ServerNode<ServerNode.RootEndpoint>> {
    const storeId = await storageContext.get<string>('storeId');
    this.log.notice(`Creating server node for ${storeId} on port ${port} with passcode ${passcode} and discriminator ${discriminator}...`);
    this.log.debug(`- deviceName: ${await storageContext.get('deviceName')}`);
    this.log.debug(`- deviceType: ${await storageContext.get('deviceType')}(0x${(await storageContext.get('deviceType'))?.toString(16).padStart(4, '0')})`);
    this.log.debug(`- serialNumber: ${await storageContext.get('serialNumber')}`);
    this.log.debug(`- uniqueId: ${await storageContext.get('uniqueId')}`);
    this.log.debug(`- softwareVersion: ${await storageContext.get('softwareVersion')} softwareVersionString: ${await storageContext.get('softwareVersionString')}`);
    this.log.debug(`- hardwareVersion: ${await storageContext.get('hardwareVersion')} hardwareVersionString: ${await storageContext.get('hardwareVersionString')}`);

    /**
     * Create a Matter ServerNode, which contains the Root Endpoint and all relevant data and configuration
     */
    const serverNode = await ServerNode.create({
      // Required: Give the Node a unique ID which is used to store the state of this node
      id: storeId,

      // Provide Network relevant configuration like the port
      // Optional when operating only one device on a host, Default port is 5540
      network: {
        listeningAddressIpv4: this.ipv4address,
        listeningAddressIpv6: this.ipv6address,
        port,
      },

      // Provide the certificate for the device
      operationalCredentials: {
        certification: this.certification,
      },

      // Provide Commissioning relevant settings
      // Optional for development/testing purposes
      commissioning: {
        passcode,
        discriminator,
      },

      // Provide Node announcement settings
      // Optional: If Ommitted some development defaults are used
      productDescription: {
        name: await storageContext.get<string>('deviceName'),
        deviceType: DeviceTypeId(await storageContext.get<number>('deviceType')),
      },

      // Provide defaults for the BasicInformation cluster on the Root endpoint
      // Optional: If Omitted some development defaults are used
      basicInformation: {
        vendorId: VendorId(await storageContext.get<number>('vendorId')),
        vendorName: await storageContext.get<string>('vendorName'),

        productId: await storageContext.get<number>('productId'),
        productName: await storageContext.get<string>('productName'),
        productLabel: await storageContext.get<string>('productName'),
        nodeLabel: await storageContext.get<string>('productName'),

        serialNumber: await storageContext.get<string>('serialNumber'),
        uniqueId: await storageContext.get<string>('uniqueId'),

        softwareVersion: await storageContext.get<number>('softwareVersion'),
        softwareVersionString: await storageContext.get<string>('softwareVersionString'),
        hardwareVersion: await storageContext.get<number>('hardwareVersion'),
        hardwareVersionString: await storageContext.get<string>('hardwareVersionString'),

        reachable: true,
      },
    });

    const sanitizeFabrics = (fabrics: Record<FabricIndex, ExposedFabricInformation>, resetSessions = false) => {
      // New type of fabric information: Record<FabricIndex, ExposedFabricInformation>
      const sanitizedFabrics = this.sanitizeFabricInformations(Array.from(Object.values(fabrics)));
      this.log.info(`Fabrics: ${debugStringify(sanitizedFabrics)}`);
      if (this.bridgeMode === 'bridge') {
        this.matterbridgeFabricInformations = sanitizedFabrics;
        if (resetSessions) this.matterbridgeSessionInformations = undefined; // Changed cause Invoke Matterbridge.operationalCredentials.updateFabricLabel is sent after the session is created
        this.matterbridgePaired = true;
      }
      if (this.bridgeMode === 'childbridge') {
        const plugin = this.plugins.get(storeId);
        if (plugin) {
          plugin.fabricInformations = sanitizedFabrics;
          if (resetSessions) plugin.sessionInformations = undefined; // Changed cause Invoke Matterbridge.operationalCredentials.updateFabricLabel is sent after the session is created
          plugin.paired = true;
        }
      }
    };

    /**
     * This event is triggered when the device is initially commissioned successfully.
     * This means: It is added to the first fabric.
     */
    serverNode.lifecycle.commissioned.on(() => {
      this.log.notice(`Server node for ${storeId} was initially commissioned successfully!`);
      clearTimeout(this.endAdvertiseTimeout);
    });

    /** This event is triggered when all fabrics are removed from the device, usually it also does a factory reset then. */
    serverNode.lifecycle.decommissioned.on(() => this.log.notice(`Server node for ${storeId} was fully decommissioned successfully!`));

    /** This event is triggered when the device went online. This means that it is discoverable in the network. */
    serverNode.lifecycle.online.on(async () => {
      this.log.notice(`Server node for ${storeId} is online`);

      if (!serverNode.lifecycle.isCommissioned) {
        this.log.notice(`Server node for ${storeId} is not commissioned. Pair to commission ...`);
        const { qrPairingCode, manualPairingCode } = serverNode.state.commissioning.pairingCodes;
        if (this.bridgeMode === 'bridge') {
          this.matterbridgeQrPairingCode = qrPairingCode;
          this.matterbridgeManualPairingCode = manualPairingCode;
          this.matterbridgeFabricInformations = undefined;
          this.matterbridgeSessionInformations = undefined;
          this.matterbridgePaired = false;
          this.log.notice(`QR Code URL: https://project-chip.github.io/connectedhomeip/qrcode.html?data=${qrPairingCode}`);
          this.log.notice(`Manual pairing code: ${manualPairingCode}`);
          if (this.matterStorageService) {
            const storageManager = await this.matterStorageService.open(storeId);
            const storageContext = storageManager.createContext('persist');
            await storageContext.set('qrPairingCode', qrPairingCode);
            await storageContext.set('manualPairingCode', manualPairingCode);
          }
        }
        if (this.bridgeMode === 'childbridge') {
          const plugin = this.plugins.get(storeId);
          if (plugin) {
            plugin.qrPairingCode = qrPairingCode;
            plugin.manualPairingCode = manualPairingCode;
            plugin.fabricInformations = undefined;
            plugin.sessionInformations = undefined;
            plugin.paired = false;
            this.log.notice(`QR Code URL: https://project-chip.github.io/connectedhomeip/qrcode.html?data=${qrPairingCode}`);
            this.log.notice(`Manual pairing code: ${manualPairingCode}`);
            if (this.matterStorageService) {
              const storageManager = await this.matterStorageService.open(storeId);
              const storageContext = storageManager.createContext('persist');
              await storageContext.set('qrPairingCode', qrPairingCode);
              await storageContext.set('manualPairingCode', manualPairingCode);
            }
          }
        }
        // Set a timeout to show that advertising stops after 15 minutes if not commissioned
        this.startEndAdvertiseTimer(serverNode);
      } else {
        this.log.notice(`Server node for ${storeId} is already commissioned. Waiting for controllers to connect ...`);
        sanitizeFabrics(serverNode.state.commissioning.fabrics, true);
      }
      this.frontend.wssSendRefreshRequired('plugins');
      this.frontend.wssSendRefreshRequired('settings');
      this.frontend.wssSendSnackbarMessage(`${storeId} is online`, 5, 'success');
      this.emit('online', storeId);
    });

    /** This event is triggered when the device went offline. it is not longer discoverable or connectable in the network. */
    serverNode.lifecycle.offline.on(() => {
      this.log.notice(`Server node for ${storeId} is offline`);
      if (this.bridgeMode === 'bridge') {
        this.matterbridgeQrPairingCode = undefined;
        this.matterbridgeManualPairingCode = undefined;
        this.matterbridgeFabricInformations = undefined;
        this.matterbridgeSessionInformations = undefined;
        this.matterbridgePaired = undefined;
      }
      if (this.bridgeMode === 'childbridge') {
        const plugin = this.plugins.get(storeId);
        if (plugin) {
          plugin.qrPairingCode = undefined;
          plugin.manualPairingCode = undefined;
          plugin.fabricInformations = undefined;
          plugin.sessionInformations = undefined;
          plugin.paired = undefined;
        }
      }
      this.frontend.wssSendRefreshRequired('plugins');
      this.frontend.wssSendRefreshRequired('settings');
      this.frontend.wssSendSnackbarMessage(`${storeId} is offline`, 5, 'warning');
      this.emit('offline', storeId);
    });

    /**
     * This event is triggered when a fabric is added, removed or updated on the device. Use this if more granular
     * information is needed.
     */
    serverNode.events.commissioning.fabricsChanged.on((fabricIndex, fabricAction) => {
      let action = '';
      switch (fabricAction) {
        case FabricAction.Added:
          action = 'added';
          break;
        case FabricAction.Removed:
          action = 'removed';
          break;
        case FabricAction.Updated:
          action = 'updated';
          break;
      }
      this.log.notice(`Commissioned fabric index ${fabricIndex} ${action} on server node for ${storeId}: ${debugStringify(serverNode.state.commissioning.fabrics[fabricIndex])}`);
      sanitizeFabrics(serverNode.state.commissioning.fabrics);
      this.frontend.wssSendRefreshRequired('fabrics');
    });

    const sanitizeSessions = (sessions: SessionsBehavior.Session[]) => {
      const sanitizedSessions = this.sanitizeSessionInformation(
        sessions.map((session) => ({
          ...session,
          secure: session.name.startsWith('secure'),
        })),
      );
      this.log.debug(`Sessions: ${debugStringify(sanitizedSessions)}`);
      if (this.bridgeMode === 'bridge') {
        this.matterbridgeSessionInformations = sanitizedSessions;
      }
      if (this.bridgeMode === 'childbridge') {
        const plugin = this.plugins.get(storeId);
        if (plugin) {
          plugin.sessionInformations = sanitizedSessions;
        }
      }
    };

    /**
     * This event is triggered when an operative new session was opened by a Controller.
     * It is not triggered for the initial commissioning process, just afterwards for real connections.
     */
    serverNode.events.sessions.opened.on((session) => {
      this.log.notice(`Session opened on server node for ${storeId}: ${debugStringify(session)}`);
      sanitizeSessions(Object.values(serverNode.state.sessions.sessions));
      this.frontend.wssSendRefreshRequired('sessions');
    });

    /**
     * This event is triggered when an operative session is closed by a Controller or because the Device goes offline.
     */
    serverNode.events.sessions.closed.on((session) => {
      this.log.notice(`Session closed on server node for ${storeId}: ${debugStringify(session)}`);
      sanitizeSessions(Object.values(serverNode.state.sessions.sessions));
      this.frontend.wssSendRefreshRequired('sessions');
    });

    /** This event is triggered when a subscription gets added or removed on an operative session. */
    serverNode.events.sessions.subscriptionsChanged.on((session) => {
      this.log.notice(`Session subscriptions changed on server node for ${storeId}: ${debugStringify(session)}`);
      sanitizeSessions(Object.values(serverNode.state.sessions.sessions));
      this.frontend.wssSendRefreshRequired('sessions');
    });

    this.log.info(`Created server node for ${storeId}`);
    return serverNode;
  }

  /**
   * Starts the 15 minutes timer to advice that advertising for the specified server node is ended.
   *
   * @param {ServerNode} [matterServerNode] - The server node to start.
   * @param {string} storeId - The store ID of the server node.
   */
  private startEndAdvertiseTimer(matterServerNode: ServerNode) {
    if (this.endAdvertiseTimeout) {
      this.log.debug(`Clear ${matterServerNode.id} server node end advertise timer`);
      clearTimeout(this.endAdvertiseTimeout);
    }
    this.log.debug(`Starting ${matterServerNode.id} server node end advertise timer`);
    this.endAdvertiseTimeout = setTimeout(
      () => {
        if (matterServerNode.lifecycle.isCommissioned) return;
        if (this.bridgeMode === 'bridge') {
          this.matterbridgeQrPairingCode = undefined;
          this.matterbridgeManualPairingCode = undefined;
        }
        if (this.bridgeMode === 'childbridge') {
          const plugin = this.plugins.get(matterServerNode.id);
          if (plugin) {
            plugin.qrPairingCode = undefined;
            plugin.manualPairingCode = undefined;
          }
        }
        this.frontend.wssSendRefreshRequired('plugins');
        this.frontend.wssSendRefreshRequired('settings');
        this.frontend.wssSendRefreshRequired('fabrics');
        this.frontend.wssSendRefreshRequired('sessions');
        this.frontend.wssSendSnackbarMessage(`Advertising on server node for ${matterServerNode.id} stopped. Restart to commission.`, 0);
        this.log.notice(`Advertising on server node for ${matterServerNode.id} stopped. Restart to commission.`);
      },
      15 * 60 * 1000,
    ).unref();
  }

  /**
   * Starts the specified server node.
   *
   * @param {ServerNode} [matterServerNode] - The server node to start.
   * @returns {Promise<void>} A promise that resolves when the server node has started.
   */
  private async startServerNode(matterServerNode?: ServerNode): Promise<void> {
    if (!matterServerNode) return;
    this.log.notice(`Starting ${matterServerNode.id} server node`);
    await matterServerNode.start();
  }

  /**
   * Stops the specified server node.
   *
   * @param {ServerNode} matterServerNode - The server node to stop.
   * @param {number} [timeout=30000] - The timeout in milliseconds for stopping the server node. Defaults to 30 seconds.
   * @returns {Promise<void>} A promise that resolves when the server node has stopped.
   */
  private async stopServerNode(matterServerNode: ServerNode, timeout = 30000): Promise<void> {
    if (!matterServerNode) return;
    this.log.notice(`Closing ${matterServerNode.id} server node`);

    try {
      await withTimeout(matterServerNode.close(), timeout);
      this.log.info(`Closed ${matterServerNode.id} server node`);
    } catch (error) {
      this.log.error(`Failed to close ${matterServerNode.id} server node: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Advertises the specified server node.
   *
   * @param {ServerNode} [matterServerNode] - The server node to advertise.
   * @returns {Promise<{ qrPairingCode: string, manualPairingCode: string } | undefined>} A promise that resolves to the pairing codes if the server node is advertised, or undefined if not.
   */
  async advertiseServerNode(matterServerNode?: ServerNode): Promise<{ qrPairingCode: string; manualPairingCode: string } | undefined> {
    if (matterServerNode) {
      await matterServerNode.env.get(DeviceCommissioner)?.allowBasicCommissioning();
      const { qrPairingCode, manualPairingCode } = matterServerNode.state.commissioning.pairingCodes;
      this.log.notice(`Started advertising for ${matterServerNode.id} with the following pairing codes: qrPairingCode ${qrPairingCode}, manualPairingCode ${manualPairingCode}`);
      return { qrPairingCode, manualPairingCode };
    }
  }

  /**
   * Stop advertise the specified server node.
   *
   * @param {ServerNode} [matterServerNode] - The server node to advertise.
   * @returns {Promise<void>} A promise that resolves when the server node has stopped advertising.
   */
  async stopAdvertiseServerNode(matterServerNode?: ServerNode): Promise<void> {
    if (matterServerNode && matterServerNode.lifecycle.isOnline) {
      await matterServerNode.env.get(DeviceCommissioner)?.endCommissioning();
      this.log.notice(`Stopped advertising for ${matterServerNode.id}`);
    }
  }

  /**
   * Creates an aggregator node with the specified storage context.
   *
   * @param {StorageContext} storageContext - The storage context for the aggregator node.
   * @returns {Promise<Endpoint<AggregatorEndpoint>>} A promise that resolves to the created aggregator node.
   */
  private async createAggregatorNode(storageContext: StorageContext): Promise<Endpoint<AggregatorEndpoint>> {
    this.log.notice(`Creating ${await storageContext.get<string>('storeId')} aggregator...`);
    const aggregatorNode = new Endpoint(AggregatorEndpoint, { id: `${await storageContext.get<string>('storeId')}` });
    this.log.info(`Created ${await storageContext.get<string>('storeId')} aggregator`);
    return aggregatorNode;
  }

  /**
   * Adds a MatterbridgeEndpoint to the specified plugin.
   *
   * @param {string} pluginName - The name of the plugin.
   * @param {MatterbridgeEndpoint} device - The device to add as a bridged endpoint.
   * @returns {Promise<void>} A promise that resolves when the bridged endpoint has been added.
   */
  async addBridgedEndpoint(pluginName: string, device: MatterbridgeEndpoint): Promise<void> {
    // Check if the plugin is registered
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      this.log.error(`Error adding bridged endpoint ${dev}${device.deviceName}${er} (${zb}${device.id}${er}) plugin ${plg}${pluginName}${er} not found`);
      return;
    }
    if (this.bridgeMode === 'bridge') {
      // Register and add the device to the matterbridge aggregator node
      this.log.debug(`Adding bridged endpoint ${plg}${pluginName}${db}:${dev}${device.deviceName}${db} to Matterbridge aggregator node`);
      if (!this.aggregatorNode) {
        this.log.error('Aggregator node not found for Matterbridge');
        return;
      }
      try {
        await this.aggregatorNode.add(device);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : error;
        const errorInspect = inspect(error, { depth: 10 });
        this.log.error(`Error adding bridged endpoint ${dev}${device.deviceName}${er} (${zb}${device.id}${er}) for plugin ${plg}${pluginName}${er}: ${errorMessage}\nstack: ${errorInspect}`);
        return;
      }
    } else if (this.bridgeMode === 'childbridge') {
      // Register and add the device to the plugin server node
      if (plugin.type === 'AccessoryPlatform') {
        try {
          this.log.debug(`Creating endpoint ${dev}${device.deviceName}${db} for AccessoryPlatform plugin ${plg}${plugin.name}${db} server node`);
          if (plugin.serverNode) {
            this.log.error(`The plugin ${plg}${plugin.name}${er} has already added a device. Only one device is allowed per AccessoryPlatform plugin.`);
            return;
          }
          await this.createAccessoryPlugin(plugin, device);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : error;
          const errorInspect = inspect(error, { depth: 10 });
          this.log.error(`Error creating endpoint ${dev}${device.deviceName}${er} (${zb}${device.id}${er}) for AccessoryPlatform plugin ${plg}${pluginName}${er} server node: ${errorMessage}\nstack: ${errorInspect}`);
          return;
        }
      }
      // Register and add the device to the plugin aggregator node
      if (plugin.type === 'DynamicPlatform') {
        try {
          this.log.debug(`Adding bridged endpoint ${dev}${device.deviceName}${db} for DynamicPlatform plugin ${plg}${plugin.name}${db} aggregator node`);
          await this.createDynamicPlugin(plugin);
          // Fast plugins can add another device before the server node is created
          await waiter(`createDynamicPlugin(${plugin.name})`, () => plugin.serverNode?.hasParts === true);
          if (!plugin.aggregatorNode) {
            this.log.error(`Aggregator node not found for plugin ${plg}${plugin.name}${er}`);
            return;
          }
          await plugin.aggregatorNode.add(device);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : error;
          const errorInspect = inspect(error, { depth: 10 });
          this.log.error(`Error adding bridged endpoint ${dev}${device.deviceName}${er} (${zb}${device.id}${er}) for DynamicPlatform plugin ${plg}${pluginName}${er} aggregator node: ${errorMessage}\nstack: ${errorInspect}`);
          return;
        }
      }
    }
    if (plugin.registeredDevices !== undefined) plugin.registeredDevices++;
    if (plugin.addedDevices !== undefined) plugin.addedDevices++;
    // Add the device to the DeviceManager
    this.devices.set(device);
    // Subscribe to the reachable$Changed event
    await this.subscribeAttributeChanged(plugin, device);
    this.log.info(`Added and registered bridged endpoint (${plugin.registeredDevices}/${plugin.addedDevices}) ${dev}${device.deviceName}${nf} (${dev}${device.id}${nf}) for plugin ${plg}${pluginName}${nf}`);
  }

  /**
   * Removes a MatterbridgeEndpoint from the specified plugin.
   *
   * @param {string} pluginName - The name of the plugin.
   * @param {MatterbridgeEndpoint} device - The device to remove as a bridged endpoint.
   * @returns {Promise<void>} A promise that resolves when the bridged endpoint has been removed.
   */
  async removeBridgedEndpoint(pluginName: string, device: MatterbridgeEndpoint): Promise<void> {
    this.log.debug(`Removing bridged endpoint ${plg}${pluginName}${db}:${dev}${device.deviceName}${db} (${zb}${device.name}${db}) for plugin ${plg}${pluginName}${db}`);

    // Check if the plugin is registered
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      this.log.error(`Error removing bridged endpoint ${dev}${device.deviceName}${er} (${zb}${device.name}${er}) for plugin ${plg}${pluginName}${er}: plugin not found`);
      return;
    }
    // Register and add the device to the matterbridge aggregator node
    if (this.bridgeMode === 'bridge') {
      if (!this.aggregatorNode) {
        this.log.error(`Error removing bridged endpoint ${dev}${device.deviceName}${er} (${zb}${device.name}${er}) for plugin ${plg}${pluginName}${er}: aggregator node not found`);
        return;
      }
      await device.delete();
      this.log.info(`Removed bridged endpoint(${plugin.registeredDevices}/${plugin.addedDevices}) ${dev}${device.deviceName}${nf} (${zb}${device.name}${nf}) for plugin ${plg}${pluginName}${nf}`);
      if (plugin.registeredDevices !== undefined) plugin.registeredDevices--;
      if (plugin.addedDevices !== undefined) plugin.addedDevices--;
    } else if (this.bridgeMode === 'childbridge') {
      if (plugin.type === 'AccessoryPlatform') {
        // Nothing to do here since the server node has no aggregator node but only the device itself
      } else if (plugin.type === 'DynamicPlatform') {
        if (!plugin.aggregatorNode) {
          this.log.error(`Error removing bridged endpoint ${dev}${device.deviceName}${er} (${zb}${device.name}${er}) for plugin ${plg}${pluginName}${er}: aggregator node not found`);
          return;
        }
        await device.delete();
      }
      this.log.info(`Removed bridged endpoint(${plugin.registeredDevices}/${plugin.addedDevices}) ${dev}${device.deviceName}${nf} (${zb}${device.name}${nf}) for plugin ${plg}${pluginName}${nf}`);
      if (plugin.registeredDevices !== undefined) plugin.registeredDevices--;
      if (plugin.addedDevices !== undefined) plugin.addedDevices--;
    }
    // Remove the device from the DeviceManager
    this.devices.remove(device);
  }

  /**
   * Removes all bridged endpoints from the specified plugin.
   *
   * @param {string} pluginName - The name of the plugin.
   * @param {number} [delay=0] - The delay in milliseconds between removing each bridged endpoint (default: 0).
   * @returns {Promise<void>} A promise that resolves when all bridged endpoints have been removed.
   *
   * @remarks
   * This method iterates through all devices in the DeviceManager and removes each bridged endpoint associated with the specified plugin.
   * It also applies a delay between each removal if specified.
   * The delay is useful to allow the controllers to receive a single subscription for each device removed.
   */
  async removeAllBridgedEndpoints(pluginName: string, delay = 0): Promise<void> {
    this.log.debug(`Removing all bridged endpoints for plugin ${plg}${pluginName}${db}${delay > 0 ? ` with delay ${delay} ms` : ''}`);
    for (const device of this.devices.array().filter((device) => device.plugin === pluginName)) {
      await this.removeBridgedEndpoint(pluginName, device);
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    }
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  /**
   * Subscribes to the attribute change event for the given device and plugin.
   * Specifically, it listens for changes in the 'reachable' attribute of the
   * BridgedDeviceBasicInformationServer cluster server of the bridged device or BasicInformationServer cluster server of server node.
   *
   * @param {RegisteredPlugin} plugin - The plugin associated with the device.
   * @param {MatterbridgeEndpoint} device - The device to subscribe to attribute changes for.
   * @returns {Promise<void>} A promise that resolves when the subscription is set up.
   */
  private async subscribeAttributeChanged(plugin: RegisteredPlugin, device: MatterbridgeEndpoint): Promise<void> {
    this.log.info(`Subscribing attributes for endpoint ${dev}${device.deviceName}${nf} (${dev}${device.id}${nf}) plugin ${plg}${plugin.name}${nf}`);
    if (this.bridgeMode === 'childbridge' && plugin.type === 'AccessoryPlatform' && plugin.serverNode) {
      plugin.serverNode.eventsOf(BasicInformationServer).reachable$Changed?.on((reachable: boolean) => {
        this.log.info(`Accessory endpoint ${dev}${device.deviceName}${nf} (${dev}${device.id}${nf}) is ${reachable ? 'reachable' : 'unreachable'}`);
        this.frontend.wssSendAttributeChangedMessage(device.plugin, device.serialNumber, device.uniqueId, 'BasicInformationServer', 'reachable', reachable);
      });
    }
    if (device.hasClusterServer(BridgedDeviceBasicInformationServer)) {
      device.eventsOf(BridgedDeviceBasicInformationServer).reachable$Changed.on((reachable: boolean) => {
        this.log.info(`Bridged endpoint ${dev}${device.deviceName}${nf} (${dev}${device.id}${nf}) is ${reachable ? 'reachable' : 'unreachable'}`);
        this.frontend.wssSendAttributeChangedMessage(device.plugin, device.serialNumber, device.uniqueId, 'BridgedDeviceBasicInformationServer', 'reachable', reachable);
      });
    }
  }

  /**
   * Sanitizes the fabric information by converting bigint properties to strings because `res.json` doesn't support bigint.
   *
   * @param {ExposedFabricInformation[]} fabricInfo - The array of exposed fabric information objects.
   * @returns {SanitizedExposedFabricInformation[]} An array of sanitized exposed fabric information objects.
   */
  private sanitizeFabricInformations(fabricInfo: ExposedFabricInformation[]): SanitizedExposedFabricInformation[] {
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
   * @param {SessionInformation[]} sessionInfo - The array of session information objects.
   * @returns {SanitizedSessionInformation[]} An array of sanitized session information objects.
   */
  private sanitizeSessionInformation(sessionInfo: SessionInformation[]) {
    return sessionInfo
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
          secure: session.secure,
          lastInteractionTimestamp: session.lastInteractionTimestamp?.toString(),
          lastActiveTimestamp: session.lastActiveTimestamp?.toString(),
          numberOfActiveSubscriptions: session.numberOfActiveSubscriptions,
        } as SanitizedSessionInformation;
      });
  }

  /**
   * Sets the reachability of the specified aggregator node bridged devices and trigger.
   * @param {Endpoint<AggregatorEndpoint>} aggregatorNode - The aggregator node to set the reachability for.
   * @param {boolean} reachable - A boolean indicating the reachability status to set.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async setAggregatorReachability(aggregatorNode: Endpoint<AggregatorEndpoint>, reachable: boolean) {
    /*
    for (const child of aggregatorNode.parts) {
      this.log.debug(`Setting reachability of ${(child as unknown as MatterbridgeEndpoint)?.deviceName} to ${reachable}`);
      await child.setStateOf(BridgedDeviceBasicInformationServer, { reachable });
      child.act((agent) => child.eventsOf(BridgedDeviceBasicInformationServer).reachableChanged.emit({ reachableNewValue: true }, agent.context));
    }
    */
  }

  private getVendorIdName = (vendorId: number | undefined) => {
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
      case 65521:
        vendorName = '(MatterServer)';
        break;
    }
    return vendorName;
  };
}
