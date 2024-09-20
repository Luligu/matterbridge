/**
 * This file contains the class Matterbridge.
 *
 * @file matterbridge.ts
 * @author Luca Liguori
 * @date 2023-12-29
 * @version 1.5.2
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
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import { ExecException, exec, spawn } from 'child_process';
import { Server, createServer } from 'http';
import * as http from 'http';
import https from 'https';
import EventEmitter from 'events';
import express from 'express';
import os from 'os';
import path from 'path';
import WebSocket, { WebSocketServer } from 'ws';

// NodeStorage and AnsiLogger modules
import { NodeStorageManager, NodeStorage } from 'node-persist-manager';
import { AnsiLogger, TimestampFormat, LogLevel, UNDERLINE, UNDERLINEOFF, YELLOW, db, debugStringify, stringify, BRIGHT, RESET, er, nf, rs, wr, RED, GREEN, zb, hk, or, idn, BLUE, CYAN, nt } from 'node-ansi-logger';

// Matterbridge
import { MatterbridgeDevice, SerializedMatterbridgeDevice } from './matterbridgeDevice.js';
import { logInterfaces, wait, waiter, createZip } from './utils/utils.js';
import { BaseRegisteredPlugin, MatterbridgeInformation, RegisteredDevice, RegisteredPlugin, SanitizedExposedFabricInformation, SanitizedSessionInformation, SessionInformation, SystemInformation } from './matterbridgeTypes.js';
import { PluginManager } from './pluginManager.js';
import { DeviceManager } from './deviceManager.js';

// @project-chip/matter-node.js
import { CommissioningController, CommissioningServer, MatterServer, NodeCommissioningOptions } from '@project-chip/matter-node.js';
import {
  BasicInformationCluster,
  BridgedDeviceBasicInformation,
  BridgedDeviceBasicInformationCluster,
  ClusterServer,
  FixedLabelCluster,
  GeneralCommissioning,
  PowerSourceCluster,
  SwitchCluster,
  ThreadNetworkDiagnosticsCluster,
  getClusterNameById,
} from '@project-chip/matter-node.js/cluster';
import { DeviceTypeId, EndpointNumber, VendorId } from '@project-chip/matter-node.js/datatype';
import { Aggregator, DeviceTypes, Endpoint, NodeStateInformation } from '@project-chip/matter-node.js/device';
import { Format, Level, Logger } from '@project-chip/matter-node.js/log';
import { ManualPairingCodeCodec, QrCodeSchema } from '@project-chip/matter-node.js/schema';
import { StorageBackendDisk, StorageBackendJsonFile, StorageContext, StorageManager } from '@project-chip/matter-node.js/storage';
import { getParameter, getIntParameter, hasParameter } from '@project-chip/matter-node.js/util';
import { CryptoNode } from '@project-chip/matter-node.js/crypto';
import { CommissioningOptions } from '@project-chip/matter-node.js/protocol';
import { ExposedFabricInformation } from '@project-chip/matter-node.js/fabric';
import { Specification } from '@project-chip/matter-node.js/model';

// Default colors
const plg = '\u001B[38;5;33m';
const dev = '\u001B[38;5;79m';
const typ = '\u001B[38;5;207m';

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
  };

  public matterbridgeInformation: MatterbridgeInformation = {
    homeDirectory: '',
    rootDirectory: '',
    matterbridgeDirectory: '',
    matterbridgePluginDirectory: '',
    globalModulesDirectory: '',
    matterbridgeVersion: '',
    matterbridgeLatestVersion: '',
    matterbridgeQrPairingCode: undefined,
    matterbridgeManualPairingCode: undefined,
    matterbridgeFabricInformations: [],
    matterbridgeSessionInformations: [],
    matterbridgePaired: false,
    matterbridgeConnected: false,
    bridgeMode: '',
    restartMode: '',
    loggerLevel: LogLevel.INFO,
    fileLogger: false,
    matterLoggerLevel: Level.INFO,
    matterFileLogger: false,
    mattermdnsinterface: undefined,
    matteripv4address: undefined,
    matteripv6address: undefined,
    restartRequired: false,
    refreshRequired: false,
  };

  public homeDirectory = '';
  public rootDirectory = '';
  public matterbridgeDirectory = '';
  public matterbridgePluginDirectory = '';
  public globalModulesDirectory = '';
  public matterbridgeVersion = '';
  public matterbridgeLatestVersion = '';
  public matterbridgeQrPairingCode: string | undefined = undefined;
  public matterbridgeManualPairingCode: string | undefined = undefined;
  public matterbridgeFabricInformations: SanitizedExposedFabricInformation[] = [];
  public matterbridgeSessionInformations: SanitizedSessionInformation[] = [];
  public matterbridgePaired = false;
  public matterbridgeConnected = false;
  public bridgeMode: 'bridge' | 'childbridge' | 'controller' | '' = '';
  public restartMode: 'service' | 'docker' | '' = '';
  public profile = getParameter('profile');

  public log!: AnsiLogger;
  private matterbrideLoggerFile = 'matterbridge' + (getParameter('profile') ? '.' + getParameter('profile') : '') + '.log';
  private matterLoggerFile = 'matter' + (getParameter('profile') ? '.' + getParameter('profile') : '') + '.log';
  private plugins!: PluginManager;
  private devices!: DeviceManager;
  private registeredDevices: RegisteredDevice[] = [];
  private nodeStorage: NodeStorageManager | undefined;
  private nodeContext: NodeStorage | undefined;
  private matterStorageName = 'matterbridge' + (getParameter('profile') ? '.' + getParameter('profile') : '') + '.json';
  private nodeStorageName = 'storage' + (getParameter('profile') ? '.' + getParameter('profile') : '');

  // Cleanup
  private hasCleanupStarted = false;
  private initialized = false;
  private execRunningCount = 0;
  private startMatterInterval: NodeJS.Timeout | undefined;
  private cleanupTimeout1: NodeJS.Timeout | undefined;
  private cleanupTimeout2: NodeJS.Timeout | undefined;
  private checkUpdateInterval: NodeJS.Timeout | undefined;
  private configureTimeout: NodeJS.Timeout | undefined;
  private reachabilityTimeout: NodeJS.Timeout | undefined;
  private sigintHandler: NodeJS.SignalsListener | undefined;
  private sigtermHandler: NodeJS.SignalsListener | undefined;

  // Frontend
  private expressApp: express.Express | undefined;
  private httpServer: Server | undefined;
  private httpsServer: Server | undefined;
  private webSocketServer: WebSocketServer | undefined;

  // Matter
  private mdnsInterface: string | undefined; // matter server mdnsInterface: e.g. 'eth0' or 'wlan0' or 'WiFi'
  private ipv4address: string | undefined; // matter commissioning server listeningAddressIpv4
  private ipv6address: string | undefined; // matter commissioning server listeningAddressIpv6
  private port = 5540; // first commissioning server port
  private passcode?: number; // first commissioning server passcode
  private discriminator?: number; // first commissioning server discriminator
  private storageManager: StorageManager | undefined;
  private matterbridgeContext: StorageContext | undefined;
  private mattercontrollerContext: StorageContext | undefined;
  private matterServer: MatterServer | undefined;
  private matterAggregator: Aggregator | undefined;
  private commissioningServer: CommissioningServer | undefined;
  private commissioningController: CommissioningController | undefined;

  private static instance: Matterbridge | undefined;

  // We load asyncronously so is private
  private constructor() {
    super();
  }

  /** ***********************************************************************************************************************************/
  /**                                              loadInstance() and cleanup() methods                                                 */
  /** ***********************************************************************************************************************************/

  /**
   * Loads an instance of the Matterbridge class.
   * If an instance already exists, return that instance.
   *
   * @param initialize - Whether to initialize the Matterbridge instance after loading.
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
   * Call cleanup().
   * @deprecated This method is deprecated and is only used for jest tests.
   *
   */
  async destroyInstance() {
    await this.cleanup('destroying instance...', false);
    await waiter(
      'destroying instance...',
      () => {
        return this.initialized === false && this.execRunningCount <= 0 ? true : false;
      },
      false,
      60000,
      100,
      false,
    );
    await wait(1000, 'Wait for the global node_modules and matterbridge version', false);
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
    // Set the first port to use for the commissioning server (will be incremented in childbridge mode)
    this.port = getIntParameter('port') ?? 5540;
    // Set the first passcode to use for the commissioning server (will be incremented in childbridge mode)
    this.passcode = getIntParameter('passcode');
    // Set the first discriminator to use for the commissioning server (will be incremented in childbridge mode)
    this.discriminator = getIntParameter('discriminator');

    // Set the restart mode
    if (hasParameter('service')) this.restartMode = 'service';
    if (hasParameter('docker')) this.restartMode = 'docker';

    // Set the matterbridge directory
    this.homeDirectory = getParameter('homedir') ?? os.homedir();
    this.matterbridgeDirectory = path.join(this.homeDirectory, '.matterbridge');

    // Initialize nodeStorage and nodeContext
    // this.log.debug(`Creating node storage manager: ${CYAN}${this.nodeStorageName}${db}`);
    this.nodeStorage = new NodeStorageManager({ dir: path.join(this.matterbridgeDirectory, this.nodeStorageName), writeQueue: false, expiredInterval: undefined, logging: false });
    // this.log.debug('Creating node storage context for matterbridge');
    this.nodeContext = await this.nodeStorage.createStorage('matterbridge');

    // Create matterbridge logger
    this.log = new AnsiLogger({ logName: 'Matterbridge', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.INFO });

    // Create the file logger for matterbridge (context: matterbridgeFileLog)
    if (hasParameter('filelogger') || (await this.nodeContext.get<boolean>('matterbridgeFileLog', false))) {
      AnsiLogger.setGlobalLogfile(path.join(this.matterbridgeDirectory, this.matterbrideLoggerFile), LogLevel.DEBUG, true);
      this.matterbridgeInformation.fileLogger = true;
    }

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
      this.log.logLevel = await this.nodeContext.get<LogLevel>('matterbridgeLogLevel', LogLevel.INFO);
    }
    MatterbridgeDevice.logLevel = this.log.logLevel;

    this.log.notice('Matterbridge is starting...');

    this.log.debug(`Matterbridge logLevel: ${this.log.logLevel} fileLoger: ${this.matterbridgeInformation.fileLogger}.`);

    // Set matter.js logger level, format and logger (context: matterLogLevel)
    if (hasParameter('matterlogger')) {
      const level = getParameter('matterlogger');
      if (level === 'debug') {
        Logger.defaultLogLevel = Level.DEBUG;
      } else if (level === 'info') {
        Logger.defaultLogLevel = Level.INFO;
      } else if (level === 'notice') {
        Logger.defaultLogLevel = Level.NOTICE;
      } else if (level === 'warn') {
        Logger.defaultLogLevel = Level.WARN;
      } else if (level === 'error') {
        Logger.defaultLogLevel = Level.ERROR;
      } else if (level === 'fatal') {
        Logger.defaultLogLevel = Level.FATAL;
      } else {
        this.log.warn(`Invalid matter.js logger level: ${level}. Using default level "info".`);
        Logger.defaultLogLevel = Level.INFO;
      }
    } else {
      Logger.defaultLogLevel = await this.nodeContext.get<number>('matterLogLevel', Level.INFO);
    }
    Logger.format = Format.ANSI;
    Logger.setLogger('default', this.createMatterLogger());

    // Create the file logger for matter.js (context: matterFileLog)
    if (hasParameter('matterfilelogger') || (await this.nodeContext.get<boolean>('matterFileLog', false))) {
      this.matterbridgeInformation.matterFileLogger = true;
      Logger.addLogger('matterfilelogger', await this.createMatterFileLogger(path.join(this.matterbridgeDirectory, this.matterLoggerFile), true), {
        defaultLogLevel: Level.DEBUG,
        logFormat: Format.PLAIN,
      });
    }
    this.log.debug(`Matter logLevel: ${Logger.defaultLogLevel} fileLoger: ${this.matterbridgeInformation.matterFileLogger}.`);

    // Set the interface to use for the matter server mdnsInterface
    if (hasParameter('mdnsinterface')) {
      this.mdnsInterface = getParameter('mdnsinterface');
    } else {
      this.mdnsInterface = await this.nodeContext?.get<string>('mattermdnsinterface', undefined);
      if (this.mdnsInterface === '') this.mdnsInterface = undefined;
    }

    // Set the listeningAddressIpv4 for the matter commissioning server
    if (hasParameter('ipv4address')) {
      this.ipv4address = getParameter('ipv4address');
    } else {
      this.ipv4address = await this.nodeContext?.get<string>('matteripv4address', undefined);
      if (this.ipv4address === '') this.ipv4address = undefined;
    }

    // Set the listeningAddressIpv6 for the matter commissioning server
    if (hasParameter('ipv6address')) {
      this.ipv6address = getParameter('ipv6address');
    } else {
      this.ipv6address = await this.nodeContext?.get<string>('matteripv6address', undefined);
      if (this.ipv6address === '') this.ipv6address = undefined;
    }

    // Initialize PluginManager
    this.plugins = new PluginManager(this);
    await this.plugins.loadFromStorage();

    // Initialize DeviceManager
    this.devices = new DeviceManager(this, this.nodeContext);

    // Get the plugins from node storage and create the plugins node storage contexts
    for (const plugin of this.plugins) {
      const packageJson = await this.plugins.parse(plugin);
      if (packageJson === null && !hasParameter('add')) {
        // Try to reinstall the plugin from npm (for Docker pull and external plugins)
        // We don't do this when the add parameter is set because we shut down the process after adding the plugin
        this.log.info(`Error parsing plugin ${plg}${plugin.name}${nf}. Trying to reinstall it from npm.`);
        try {
          await this.spawnCommand('npm', ['install', '-g', plugin.name]);
          this.log.info(`Plugin ${plg}${plugin.name}${nf} reinstalled.`);
          plugin.error = false;
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
          plugin.error = true;
          plugin.enabled = false;
          this.log.error(`Error installing plugin ${plg}${plugin.name}${er}. The plugin is disabled.`);
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

    // Register SIGINT SIGTERM signal handlers
    this.registerSignalHandlers();

    // Parse command line
    await this.parseCommandLine();

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
      - matterlogger:          set the matter.js logger level: debug | info | notice | warn | error | fatal (default info)
      - reset:                 remove the commissioning for Matterbridge (bridge mode). Shutdown Matterbridge before using it!
      - factoryreset:          remove all commissioning information and reset all internal storages. Shutdown Matterbridge before using it!
      - list:                  list the registered plugins
      - loginterfaces:         log the network interfaces (usefull for finding the name of the interface to use with -mdnsinterface option)
      - logstorage:            log the node storage
      - sudo:                  force the use of sudo to install or update packages if the internal logic fails
      - nosudo:                force not to use sudo to install or update packages if the internal logic fails
      - ssl:                   enable SSL for the frontend and WebSockerServer (certificates in .matterbridge/certs directory cert.pem, key.pem and ca.pem (optional))
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
      this.emit('shutdown');
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
      const serializedRegisteredDevices = await this.nodeContext?.get<SerializedMatterbridgeDevice[]>('devices', []);
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
      this.emit('shutdown');
      return;
    }

    if (hasParameter('logstorage')) {
      this.log.info(`${plg}Matterbridge${nf} storage log`);
      await this.nodeContext?.logStorage();
      for (const plugin of this.plugins) {
        this.log.info(`${plg}${plugin.name}${nf} storage log`);
        await plugin.nodeContext?.logStorage();
      }
      this.emit('shutdown');
      return;
    }

    if (hasParameter('loginterfaces')) {
      this.log.info(`${plg}Matterbridge${nf} network interfaces log`);
      logInterfaces();
      this.emit('shutdown');
      return;
    }

    if (getParameter('add')) {
      this.log.debug(`Adding plugin ${getParameter('add')}`);
      // await this.executeCommandLine(getParameter('add') as string, 'add');
      await this.plugins.add(getParameter('add') as string);
      this.emit('shutdown');
      return;
    }
    if (getParameter('remove')) {
      this.log.debug(`Removing plugin ${getParameter('remove')}`);
      // await this.executeCommandLine(getParameter('remove') as string, 'remove');
      await this.plugins.remove(getParameter('remove') as string);
      this.emit('shutdown');
      return;
    }
    if (getParameter('enable')) {
      this.log.debug(`Enabling plugin ${getParameter('enable')}`);
      // await this.executeCommandLine(getParameter('enable') as string, 'enable');
      await this.plugins.enable(getParameter('enable') as string);
      this.emit('shutdown');
      return;
    }
    if (getParameter('disable')) {
      this.log.debug(`Disabling plugin ${getParameter('disable')}`);
      // await this.executeCommandLine(getParameter('disable') as string, 'disable');
      await this.plugins.disable(getParameter('disable') as string);
      this.emit('shutdown');
      return;
    }

    if (hasParameter('factoryreset')) {
      try {
        // Delete matter storage file
        await fs.unlink(path.join(this.matterbridgeDirectory, this.matterStorageName));
      } catch (err) {
        this.log.error(`Error deleting storage: ${err}`);
      }
      try {
        // Delete node storage directory with its subdirectories
        await fs.rm(path.join(this.matterbridgeDirectory, this.nodeStorageName), { recursive: true });
      } catch (err) {
        this.log.error(`Error removing storage directory: ${err}`);
      }
      this.log.info('Factory reset done! Remove all paired devices from the controllers.');
      this.nodeContext = undefined;
      this.nodeStorage = undefined;
      this.plugins.clear();
      this.registeredDevices = [];
      this.emit('shutdown');
      return;
    }

    // Start the matter storage and create the matterbridge context
    await this.startMatterStorage('json', path.join(this.matterbridgeDirectory, this.matterStorageName));
    this.log.debug(`Creating commissioning server context for ${plg}Matterbridge${db}`);
    this.matterbridgeContext = await this.createCommissioningServerContext('Matterbridge', 'Matterbridge', DeviceTypes.AGGREGATOR.code, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge aggregator');

    if (hasParameter('reset') && getParameter('reset') === undefined) {
      this.log.info('Resetting Matterbridge commissioning information...');
      await this.matterbridgeContext?.clearAll();
      await this.stopMatterStorage();
      this.log.info('Reset done! Remove the device from the controller.');
      this.emit('shutdown');
      return;
    }

    if (getParameter('reset') && getParameter('reset') !== undefined) {
      this.log.debug(`Reset plugin ${getParameter('reset')}`);
      const plugin = this.plugins.get(getParameter('reset') as string);
      if (plugin) {
        if (!this.storageManager) this.log.error(`Plugin ${plg}${plugin.name}${er} storageManager not found`);
        const context = this.storageManager?.createContext(plugin.name);
        if (!context) this.log.error(`Plugin ${plg}${plugin.name}${er} context not found`);
        await context?.clearAll();
        this.log.info(`Reset commissionig for plugin ${plg}${plugin.name}${nf} done! Remove the device from the controller.`);
      } else {
        this.log.warn(`Plugin ${plg}${getParameter('reset')}${wr} not registerd in matterbridge`);
      }
      await this.stopMatterStorage();
      this.emit('shutdown');
      return;
    }

    // Initialize frontend
    if (getIntParameter('frontend') !== 0 || getIntParameter('frontend') === undefined) await this.initializeFrontend(getIntParameter('frontend'));

    // Check each 60 minutes the latest versions
    this.checkUpdateInterval = setInterval(
      () => {
        this.getMatterbridgeLatestVersion();
        for (const plugin of this.plugins) {
          this.getPluginLatestVersion(plugin);
        }
      },
      60 * 60 * 1000,
    );

    if (hasParameter('test')) {
      this.bridgeMode = 'bridge';
      MatterbridgeDevice.bridgeMode = 'bridge';
      await this.startTest();
      return;
    }

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

    if (hasParameter('bridge') || (!hasParameter('childbridge') && (await this.nodeContext?.get<string>('bridgeMode', '')) === 'bridge')) {
      this.bridgeMode = 'bridge';
      MatterbridgeDevice.bridgeMode = 'bridge';

      if (!this.storageManager) throw new Error('No storage manager initialized');

      this.log.debug('Starting matterbridge in mode', this.bridgeMode);
      this.matterServer = this.createMatterServer(this.storageManager);

      this.log.debug(`Creating commissioning server for ${plg}Matterbridge${db}`);
      this.commissioningServer = await this.createCommisioningServer(this.matterbridgeContext, 'Matterbridge');
      this.log.debug(`Creating matter aggregator for ${plg}Matterbridge${db}`);
      this.matterAggregator = await this.createMatterAggregator(this.matterbridgeContext, 'Matterbridge');
      this.log.debug('Adding matterbridge aggregator to commissioning server');
      this.commissioningServer.addDevice(this.matterAggregator);
      this.log.debug('Adding matterbridge commissioning server to matter server');
      await this.matterServer.addCommissioningServer(this.commissioningServer, { uniqueStorageKey: 'Matterbridge' });

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
        // Check if the plugin has a new version
        this.getPluginLatestVersion(plugin); // No await do it asyncronously
        if (!plugin.enabled) {
          this.log.info(`Plugin ${plg}${plugin.name}${nf} not enabled`);
          continue;
        }
        plugin.error = false;
        plugin.locked = false;
        plugin.loaded = false;
        plugin.started = false;
        plugin.configured = false;
        plugin.connected = undefined;
        plugin.registeredDevices = undefined;
        plugin.addedDevices = undefined;
        plugin.qrPairingCode = undefined;
        plugin.manualPairingCode = undefined;
        this.plugins.load(plugin, true, 'Matterbridge is starting'); // No await do it asyncronously
      }
      await this.startBridge();
      return;
    }

    if (hasParameter('childbridge') || (!hasParameter('bridge') && (await this.nodeContext?.get<string>('bridgeMode', '')) === 'childbridge')) {
      this.bridgeMode = 'childbridge';
      MatterbridgeDevice.bridgeMode = 'childbridge';

      if (!this.storageManager) throw new Error('No storage manager initialized');

      this.log.debug('Starting matterbridge in mode', this.bridgeMode);
      this.matterServer = this.createMatterServer(this.storageManager);

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
        // Check if the plugin has a new version
        this.getPluginLatestVersion(plugin); // No await do it asyncronously
        if (!plugin.enabled) {
          this.log.info(`Plugin ${plg}${plugin.name}${nf} not enabled`);
          continue;
        }
        plugin.error = false;
        plugin.locked = false;
        plugin.loaded = false;
        plugin.started = false;
        plugin.configured = false;
        plugin.connected = false;
        plugin.registeredDevices = undefined;
        plugin.addedDevices = undefined;
        plugin.qrPairingCode = undefined;
        plugin.manualPairingCode = undefined;
        this.plugins.load(plugin, true, 'Matterbridge is starting'); // No await do it asyncronously
      }
      await this.startChildbridge();
      return;
    }
  }

  /**
   * Registers the signal handlers for SIGINT and SIGTERM.
   * When either of these signals are received, the cleanup method is called with an appropriate message.
   */
  private registerSignalHandlers() {
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
   * Deregisters the SIGINT and SIGTERM signal handlers.
   */
  private deregisterSignalHandlers() {
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
    this.systemInformation.ipv4Address = '';
    this.systemInformation.ipv6Address = '';
    for (const [interfaceName, interfaceDetails] of Object.entries(networkInterfaces)) {
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
      if (this.systemInformation.ipv4Address !== '' /* && this.systemInformation.ipv6Address !== ''*/) {
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

    // Home directory
    this.homeDirectory = getParameter('homedir') ?? os.homedir();
    this.matterbridgeInformation.homeDirectory = this.homeDirectory;
    this.log.debug(`Home Directory: ${this.homeDirectory}`);

    // Package root directory
    const currentFileDirectory = path.dirname(fileURLToPath(import.meta.url));
    this.rootDirectory = path.resolve(currentFileDirectory, '../');
    this.matterbridgeInformation.rootDirectory = this.rootDirectory;
    this.log.debug(`Root Directory: ${this.rootDirectory}`);

    // Global node_modules directory
    if (this.nodeContext) this.globalModulesDirectory = await this.nodeContext.get<string>('globalModulesDirectory', '');
    // First run of Matterbridge so the node storage is empty
    if (this.globalModulesDirectory === '') {
      try {
        this.globalModulesDirectory = await this.getGlobalNodeModules();
        this.matterbridgeInformation.globalModulesDirectory = this.globalModulesDirectory;
        this.log.debug(`Global node_modules Directory: ${this.globalModulesDirectory}`);
        await this.nodeContext?.set<string>('globalModulesDirectory', this.globalModulesDirectory);
      } catch (error) {
        this.log.error(`Error getting global node_modules directory: ${error}`);
      }
    } else {
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
    }

    // Create the data directory .matterbridge in the home directory
    this.matterbridgeDirectory = path.join(this.homeDirectory, '.matterbridge');
    this.matterbridgeInformation.matterbridgeDirectory = this.matterbridgeDirectory;
    try {
      await fs.access(this.matterbridgeDirectory);
    } catch (err) {
      if (err instanceof Error) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'ENOENT') {
          try {
            await fs.mkdir(this.matterbridgeDirectory, { recursive: true });
            this.log.info(`Created Matterbridge Directory: ${this.matterbridgeDirectory}`);
          } catch (err) {
            this.log.error(`Error creating directory: ${err}`);
          }
        } else {
          this.log.error(`Error accessing directory: ${err}`);
        }
      }
    }
    this.log.debug(`Matterbridge Directory: ${this.matterbridgeDirectory}`);

    // Create the plugin directory Matterbridge in the home directory
    this.matterbridgePluginDirectory = path.join(this.homeDirectory, 'Matterbridge');
    this.matterbridgeInformation.matterbridgePluginDirectory = this.matterbridgePluginDirectory;
    try {
      await fs.access(this.matterbridgePluginDirectory);
    } catch (err) {
      if (err instanceof Error) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'ENOENT') {
          try {
            await fs.mkdir(this.matterbridgePluginDirectory, { recursive: true });
            this.log.info(`Created Matterbridge Plugin Directory: ${this.matterbridgePluginDirectory}`);
          } catch (err) {
            this.log.error(`Error creating directory: ${err}`);
          }
        } else {
          this.log.error(`Error accessing directory: ${err}`);
        }
      }
    }
    this.log.debug(`Matterbridge Plugin Directory: ${this.matterbridgePluginDirectory}`);

    // Matterbridge version
    const packageJson = JSON.parse(await fs.readFile(path.join(this.rootDirectory, 'package.json'), 'utf-8'));
    this.matterbridgeVersion = packageJson.version;
    this.matterbridgeInformation.matterbridgeVersion = this.matterbridgeVersion;
    this.log.debug(`Matterbridge Version: ${this.matterbridgeVersion}`);

    // Matterbridge latest version
    if (this.nodeContext) this.matterbridgeLatestVersion = await this.nodeContext.get<string>('matterbridgeLatestVersion', '');
    this.log.debug(`Matterbridge Latest Version: ${this.matterbridgeLatestVersion}`);
    this.getMatterbridgeLatestVersion();

    // Current working directory
    const currentDir = process.cwd();
    this.log.debug(`Current Working Directory: ${currentDir}`);

    // Command line arguments (excluding 'node' and the script name)
    const cmdArgs = process.argv.slice(2).join(' ');
    this.log.debug(`Command Line Arguments: ${cmdArgs}`);
  }

  /**
   * Retrieves the latest version of a package from the npm registry.
   * @param packageName - The name of the package.
   * @returns A Promise that resolves to the latest version of the package.
   */
  private async getLatestVersion(packageName: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.execRunningCount++;
      exec(`npm view ${packageName} version`, (error: ExecException | null, stdout: string) => {
        this.execRunningCount--;
        if (error) {
          reject(error);
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }

  /**
   * Retrieves the path to the global Node.js modules directory.
   * @returns A promise that resolves to the path of the global Node.js modules directory.
   */
  private async getGlobalNodeModules(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.execRunningCount++;
      exec('npm root -g', (error: ExecException | null, stdout: string) => {
        this.execRunningCount--;
        if (error) {
          reject(error);
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }

  /**
   * Retrieves the latest version of Matterbridge and performs necessary actions based on the version comparison.
   * @private
   * @returns {Promise<void>} A promise that resolves when the latest version is retrieved and actions are performed.
   */
  private async getMatterbridgeLatestVersion(): Promise<void> {
    this.getLatestVersion('matterbridge')
      .then(async (matterbridgeLatestVersion) => {
        this.matterbridgeLatestVersion = matterbridgeLatestVersion;
        this.matterbridgeInformation.matterbridgeLatestVersion = this.matterbridgeLatestVersion;
        this.log.debug(`Matterbridge Latest Version: ${this.matterbridgeLatestVersion}`);
        await this.nodeContext?.set<string>('matterbridgeLatestVersion', this.matterbridgeLatestVersion);
        if (this.matterbridgeVersion !== this.matterbridgeLatestVersion) {
          this.log.notice(`Matterbridge is out of date. Current version: ${this.matterbridgeVersion}. Latest version: ${this.matterbridgeLatestVersion}.`);
        } else {
          this.log.debug(`Matterbridge is up to date. Current version: ${this.matterbridgeVersion}. Latest version: ${this.matterbridgeLatestVersion}.`);
        }
      })
      .catch((error: Error) => {
        this.log.error(`Error getting Matterbridge latest version: ${error.message}`);
        // error.stack && this.log.debug(error.stack);
      });
  }

  /**
   * Retrieves the latest version of a plugin and updates the plugin's latestVersion property.
   * If the plugin's version is different from the latest version, logs a warning message.
   * If the plugin's version is the same as the latest version, logs an info message.
   * If there is an error retrieving the latest version, logs an error message.
   *
   * @private
   * @param {RegisteredPlugin} plugin - The plugin for which to retrieve the latest version.
   * @returns {Promise<void>} A promise that resolves when the latest version is retrieved and actions are performed.
   */
  private async getPluginLatestVersion(plugin: RegisteredPlugin): Promise<void> {
    this.getLatestVersion(plugin.name)
      .then(async (latestVersion) => {
        plugin.latestVersion = latestVersion;
        if (plugin.version !== latestVersion) this.log.notice(`The plugin ${plg}${plugin.name}${nt} is out of date. Current version: ${plugin.version}. Latest version: ${latestVersion}.`);
        else this.log.debug(`The plugin ${plg}${plugin.name}${db} is up to date. Current version: ${plugin.version}. Latest version: ${latestVersion}.`);
      })
      .catch((error: Error) => {
        this.log.error(`Error getting ${plg}${plugin.name}${er} latest version: ${error.message}`);
        // error.stack && this.log.debug(error.stack);
      });
  }

  /**
   * Creates a MatterLogger function to show the matter.js log messages in AnsiLogger (for the frontend).
   *
   * @returns {Function} The MatterLogger function.
   */
  private createMatterLogger() {
    const matterLogger = new AnsiLogger({ logName: 'Matter', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });

    return (_level: Level, formattedLog: string) => {
      const logger = formattedLog.slice(44, 44 + 20).trim();
      const message = formattedLog.slice(65);
      matterLogger.logName = logger;
      switch (_level) {
        case Level.DEBUG:
          matterLogger.log(LogLevel.DEBUG, message);
          break;
        case Level.INFO:
          matterLogger.log(LogLevel.INFO, message);
          break;
        case Level.NOTICE:
          matterLogger.log(LogLevel.NOTICE, message);
          break;
        case Level.WARN:
          matterLogger.log(LogLevel.WARN, message);
          break;
        case Level.ERROR:
          matterLogger.log(LogLevel.ERROR, message);
          break;
        case Level.FATAL:
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
  private async createMatterFileLogger(filePath: string, unlink = false) {
    // 2024-08-21 08:55:19.488 DEBUG InteractionMessenger Sending DataReport chunk with 28 attributes and 0 events: 1004 bytes
    let fileSize = 0;
    if (unlink) {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        this.log.debug(`Error unlinking the log file ${CYAN}${filePath}${db}: ${error instanceof Error ? error.message : error}`);
      }
    }

    return async (_level: Level, formattedLog: string) => {
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

      switch (_level) {
        case Level.DEBUG:
          await fs.appendFile(filePath, `[${timestamp}] [${logger}] [debug] ${finalMessage}`);
          break;
        case Level.INFO:
          await fs.appendFile(filePath, `[${timestamp}] [${logger}] [info] ${finalMessage}`);
          break;
        case Level.NOTICE:
          await fs.appendFile(filePath, `[${timestamp}] [${logger}] [notice] ${finalMessage}`);
          break;
        case Level.WARN:
          await fs.appendFile(filePath, `[${timestamp}] [${logger}] [warn] ${finalMessage}`);
          break;
        case Level.ERROR:
          await fs.appendFile(filePath, `[${timestamp}] [${logger}] [error] ${finalMessage}`);
          break;
        case Level.FATAL:
          await fs.appendFile(filePath, `[${timestamp}] [${logger}] [fatal] ${finalMessage}`);
          break;
        default:
          await fs.appendFile(filePath, `[${timestamp}] [${logger}] ${finalMessage}`);
          break;
      }
    };
  }

  /**
   * Update matterbridge and cleanup.
   */
  private async updateProcess() {
    await this.cleanup('updating...', false);
  }

  /**
   * Restarts the process by spawning a new process and exiting the current process.
   */
  private async restartProcess() {
    await this.cleanup('restarting...', true);
  }

  /**
   * Shut down the process by exiting the current process.
   */
  private async shutdownProcess() {
    await this.cleanup('shutting down...', false);
  }

  /**
   * Shut down the process and reset.
   */
  private async unregisterAndShutdownProcess() {
    this.log.info('Unregistering all devices and shutting down...');
    for (const plugin of this.plugins /* .filter((plugin) => plugin.enabled && !plugin.error))*/) {
      await this.removeAllBridgedDevices(plugin.name);
    }
    await this.cleanup('unregistered all devices and shutting down...', false);
  }

  /**
   * Shut down the process and reset.
   */
  private async shutdownProcessAndReset() {
    await this.cleanup('shutting down with reset...', false);
  }

  /**
   * Shut down the process and factory reset.
   */
  private async shutdownProcessAndFactoryReset() {
    await this.cleanup('shutting down with factory reset...', false);
  }

  /**
   * Cleans up the Matterbridge instance.
   * @param message - The cleanup message.
   * @param restart - Indicates whether to restart the instance after cleanup. Default is `false`.
   * @returns A promise that resolves when the cleanup is completed.
   */
  private async cleanup(message: string, restart = false) {
    if (this.initialized && !this.hasCleanupStarted) {
      this.hasCleanupStarted = true;
      this.log.info(message);

      // Deregisters the SIGINT and SIGTERM signal handlers
      this.deregisterSignalHandlers();

      // Clear the start matter interval
      if (this.startMatterInterval) {
        clearInterval(this.startMatterInterval);
        this.startMatterInterval = undefined;
        this.log.debug('Start matter interval cleared');
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

      // Calling the shutdown method of each plugin and clear the reachability timeout
      for (const plugin of this.plugins) {
        if (!plugin.enabled || plugin.error) continue;
        await this.plugins.shutdown(plugin, 'Matterbridge is closing: ' + message, false);
        if (plugin.reachabilityTimeout) {
          clearTimeout(plugin.reachabilityTimeout);
          plugin.reachabilityTimeout = undefined;
          this.log.debug(`Plugin ${plg}${plugin.name}${db} reachability timeout cleared`);
        }
      }

      // Close the http server
      if (this.httpServer) {
        this.httpServer.close();
        this.httpServer.removeAllListeners();
        this.httpServer = undefined;
        this.log.debug('Frontend http server closed successfully');
      }
      // Close the https server
      if (this.httpsServer) {
        this.httpsServer.close();
        this.httpsServer.removeAllListeners();
        this.httpsServer = undefined;
        this.log.debug('Frontend https server closed successfully');
      }
      // Remove listeners from the express app
      if (this.expressApp) {
        this.expressApp.removeAllListeners();
        this.expressApp = undefined;
        this.log.debug('Frontend app closed successfully');
      }
      // Close the WebSocket server
      if (this.webSocketServer) {
        // Close all active connections
        this.webSocketServer.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.close();
          }
        });
        this.webSocketServer.close((error) => {
          if (error) {
            this.log.error(`Error closing WebSocket server: ${error}`);
          } else {
            this.log.debug('WebSocket server closed successfully');
          }
        });
        this.webSocketServer = undefined;
      }

      // this.cleanupTimeout1 = setTimeout(async () => {
      // Closing matter
      await this.stopMatterServer();

      // Closing matter storage
      await this.stopMatterStorage();

      // Remove the matterfilelogger
      try {
        Logger.removeLogger('matterfilelogger');
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        // this.log.debug(`Error removing the matterfilelogger for file ${CYAN}${path.join(this.matterbridgeDirectory, this.matterLoggerFile)}${er}: ${error instanceof Error ? error.message : error}`);
      }

      // Serialize registeredDevices
      if (this.nodeStorage && this.nodeContext) {
        this.log.info('Saving registered devices...');
        const serializedRegisteredDevices: SerializedMatterbridgeDevice[] = [];
        this.registeredDevices.forEach((registeredDevice) => {
          const serializedMatterbridgeDevice = registeredDevice.device.serialize(registeredDevice.plugin);
          // this.log.info(`- ${serializedMatterbridgeDevice.deviceName}${rs}\n`, serializedMatterbridgeDevice);
          if (serializedMatterbridgeDevice) serializedRegisteredDevices.push(serializedMatterbridgeDevice);
        });
        await this.nodeContext.set<SerializedMatterbridgeDevice[]>('devices', serializedRegisteredDevices);
        this.log.info(`Saved registered devices (${serializedRegisteredDevices?.length})`);
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
        this.log.error('Error saving registered devices: nodeContext not found!');
      }
      this.plugins.clear();
      this.registeredDevices = [];

      // this.log.info('Waiting for matter to deliver last messages...');
      // this.cleanupTimeout2 = setTimeout(async () => {
      if (restart) {
        if (message === 'updating...') {
          this.log.info('Cleanup completed. Updating...');
          Matterbridge.instance = undefined;
          this.emit('update');
        } else if (message === 'restarting...') {
          this.log.info('Cleanup completed. Restarting...');
          Matterbridge.instance = undefined;
          this.emit('restart');
        }
      } else {
        if (message === 'shutting down with reset...') {
          // Delete matter storage file
          this.log.info('Resetting Matterbridge commissioning information...');
          await fs.unlink(path.join(this.matterbridgeDirectory, this.matterStorageName));
          this.log.info('Reset done! Remove all paired devices from the controllers.');
        }
        if (message === 'shutting down with factory reset...') {
          // Delete matter storage file
          this.log.info('Resetting Matterbridge commissioning information...');
          await fs.unlink(path.join(this.matterbridgeDirectory, this.matterStorageName));
          // Delete node storage directory with its subdirectories
          this.log.info('Resetting Matterbridge storage...');
          await fs.rm(path.join(this.matterbridgeDirectory, this.nodeStorageName), { recursive: true });
          this.log.info('Factory reset done! Remove all paired devices from the controllers.');
        }
        this.log.notice('Cleanup completed. Shutting down...');
        Matterbridge.instance = undefined;
        this.emit('shutdown');
      }
      this.hasCleanupStarted = false;
      this.initialized = false;
      // }, 2 * 1000);
      // }, 3 * 1000);
    }
  }

  /**
   * Adds a bridged device to the Matterbridge.
   * @param pluginName - The name of the plugin.
   * @param device - The bridged device to add.
   * @returns {Promise<void>} - A promise that resolves when the device is added.
   */
  async addBridgedDevice(pluginName: string, device: MatterbridgeDevice): Promise<void> {
    this.log.debug(`Adding bridged device ${dev}${device.deviceName}${db} (${dev}${device.name}${db}) for plugin ${plg}${pluginName}${db}`);

    // Check if the plugin is registered
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      this.log.error(`Error adding bridged device ${dev}${device.deviceName}${er} (${dev}${device.name}${er}) plugin ${plg}${pluginName}${er} not found`);
      return;
    }

    // Register and add the device to matterbridge aggregator in bridge mode
    if (this.bridgeMode === 'bridge') {
      if (!this.matterAggregator) {
        this.log.error(`Adding bridged device ${dev}${device.deviceName}${er} (${dev}${device.name}${er}) for plugin ${plg}${pluginName}${er} error: matterAggregator not found`);
        return;
      }
      this.matterAggregator.addBridgedDevice(device);
    }

    // The first time create the commissioning server and the aggregator for DynamicPlatform
    // Register and add the device in childbridge mode
    if (this.bridgeMode === 'childbridge') {
      if (plugin.type === 'AccessoryPlatform') {
        // Check if the plugin is locked with the commissioning server
        if (!plugin.locked) {
          plugin.locked = true;
          plugin.storageContext = await this.importCommissioningServerContext(plugin.name, device);
          this.log.debug(`Creating commissioning server for ${plg}${plugin.name}${db}`);
          plugin.commissioningServer = await this.createCommisioningServer(plugin.storageContext, plugin.name);
          this.log.debug(`Adding device ${dev}${device.name}${db} to commissioning server for plugin ${plg}${plugin.name}${db}`);
          plugin.commissioningServer.addDevice(device);
          plugin.device = device;
          this.log.debug(`Adding commissioning server to matter server for plugin ${plg}${plugin.name}${db}`);
          await this.matterServer?.addCommissioningServer(plugin.commissioningServer, { uniqueStorageKey: plugin.name });
        }
      }

      if (plugin.type === 'DynamicPlatform') {
        // Check if the plugin is locked with the commissioning server and the aggregator
        if (!plugin.locked) {
          plugin.locked = true;
          this.log.debug(`Creating commissioning server context for ${plg}${plugin.name}${db}`);
          plugin.storageContext = await this.createCommissioningServerContext(plugin.name, 'Matterbridge', DeviceTypes.AGGREGATOR.code, 0xfff1, 'Matterbridge', 0x8000, plugin.description);
          this.log.debug(`Creating commissioning server for ${plg}${plugin.name}${db}`);
          plugin.commissioningServer = await this.createCommisioningServer(plugin.storageContext, plugin.name);
          this.log.debug(`Creating aggregator for plugin ${plg}${plugin.name}${db}`);
          plugin.aggregator = await this.createMatterAggregator(plugin.storageContext, plugin.name); // Generate serialNumber and uniqueId
          this.log.debug(`Adding matter aggregator to commissioning server for plugin ${plg}${plugin.name}${db}`);
          plugin.commissioningServer.addDevice(plugin.aggregator);
          this.log.debug(`Adding commissioning server to matter server for plugin ${plg}${plugin.name}${db}`);
          await this.matterServer?.addCommissioningServer(plugin.commissioningServer, { uniqueStorageKey: plugin.name });
        }
        plugin.aggregator?.addBridgedDevice(device);
      }
    }
    this.registeredDevices.push({ plugin: pluginName, device });
    if (plugin.registeredDevices !== undefined) plugin.registeredDevices++;
    if (plugin.addedDevices !== undefined) plugin.addedDevices++;
    // Add the device to the DeviceManager
    this.devices.set(device);
    this.log.info(`Added and registered bridged device (${plugin.registeredDevices}/${plugin.addedDevices}) ${dev}${device.deviceName}${nf} (${dev}${device.name}${nf}) for plugin ${plg}${pluginName}${nf}`);
  }

  /**
   * Removes a bridged device from the Matterbridge.
   * @param pluginName - The name of the plugin.
   * @param device - The device to be removed.
   * @returns A Promise that resolves when the device is successfully removed.
   */
  async removeBridgedDevice(pluginName: string, device: MatterbridgeDevice): Promise<void> {
    this.log.debug(`Removing bridged device ${dev}${device.deviceName}${db} (${dev}${device.name}${db}) for plugin ${plg}${pluginName}${db}`);

    // Check if the plugin is registered
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      this.log.error(`Error removing bridged device ${dev}${device.deviceName}${er} (${dev}${device.name}${er}) for plugin ${plg}${pluginName}${er}: plugin not found`);
      return;
    }

    // Remove the device from matterbridge aggregator in bridge mode
    if (this.bridgeMode === 'bridge') {
      if (!this.matterAggregator) {
        this.log.error(`Error removing bridged device ${dev}${device.deviceName}${er} (${dev}${device.name}${er}) for plugin ${plg}${pluginName}${er}: matterAggregator not found`);
        return;
      }
      if (device.number !== undefined) {
        device.setBridgedDeviceReachability(false);
        device.getClusterServerById(BridgedDeviceBasicInformation.Cluster.id)?.triggerReachableChangedEvent({ reachableNewValue: false });
      }
      // device.getClusterServerById(BridgedDeviceBasicInformation.Cluster.id)?.triggerShutDownEvent({});
      // device.getClusterServerById(BridgedDeviceBasicInformation.Cluster.id)?.triggerLeaveEvent({});
      this.matterAggregator?.removeBridgedDevice(device);
      this.registeredDevices.forEach((registeredDevice, index) => {
        if (registeredDevice.device === device) {
          this.registeredDevices.splice(index, 1);
          return;
        }
      });
      this.log.info(`Removed bridged device(${plugin.registeredDevices}/${plugin.addedDevices}) ${dev}${device.deviceName}${nf} (${dev}${device.name}${nf}) for plugin ${plg}${pluginName}${nf}`);
      if (plugin.registeredDevices !== undefined) plugin.registeredDevices--;
      if (plugin.addedDevices !== undefined) plugin.addedDevices--;
    }

    // Remove the device in childbridge mode
    if (this.bridgeMode === 'childbridge') {
      if (plugin.type === 'AccessoryPlatform') {
        if (!plugin.commissioningServer) {
          this.log.error(`Error removing bridged device ${dev}${device.deviceName}${er} (${dev}${device.name}${er}) for plugin ${plg}${pluginName}${er}: commissioning server not found`);
          return;
        }
        this.registeredDevices.forEach((registeredDevice, index) => {
          if (registeredDevice.device === device) {
            this.registeredDevices.splice(index, 1);
            return;
          }
        });
      } else if (plugin.type === 'DynamicPlatform') {
        if (!plugin.aggregator) {
          this.log.error(`Error removing bridged device ${dev}${device.deviceName}${er} (${dev}${device.name}${er}) for plugin ${plg}${pluginName}${er}: aggregator not found`);
          return;
        }
        this.registeredDevices.forEach((registeredDevice, index) => {
          if (registeredDevice.device === device) {
            this.registeredDevices.splice(index, 1);
            return;
          }
        });
        if (device.number !== undefined) {
          device.setBridgedDeviceReachability(false);
          device.getClusterServerById(BridgedDeviceBasicInformation.Cluster.id)?.triggerReachableChangedEvent({ reachableNewValue: false });
        }
        plugin.aggregator.removeBridgedDevice(device);
      }
      this.log.info(`Removed bridged device(${plugin.registeredDevices}/${plugin.addedDevices}) ${dev}${device.deviceName}${nf} (${dev}${device.name}${nf}) for plugin ${plg}${pluginName}${nf}`);
      if (plugin.registeredDevices !== undefined) plugin.registeredDevices--;
      if (plugin.addedDevices !== undefined) plugin.addedDevices--;

      // Remove the commissioning server
      if (plugin.registeredDevices === 0 && plugin.addedDevices === 0 && plugin.commissioningServer) {
        this.matterServer?.removeCommissioningServer(plugin.commissioningServer);
        plugin.commissioningServer = undefined;
        this.log.info(`Removed commissioning server for plugin ${plg}${pluginName}${nf}`);
      }
    }
    // Remove the device from the DeviceManager
    this.devices.remove(device);
  }

  /**
   * Removes all bridged devices associated with a specific plugin.
   *
   * @param pluginName - The name of the plugin.
   * @returns A promise that resolves when all devices have been removed.
   */
  async removeAllBridgedDevices(pluginName: string): Promise<void> {
    this.log.debug(`Removing all bridged devices for plugin ${plg}${pluginName}${db}`);
    const devicesToRemove: RegisteredDevice[] = [];
    for (const registeredDevice of this.registeredDevices) {
      if (registeredDevice.plugin === pluginName) {
        devicesToRemove.push(registeredDevice);
      }
    }
    for (const registeredDevice of devicesToRemove) {
      this.removeBridgedDevice(pluginName, registeredDevice.device);
    }
  }

  private async startTest(): Promise<void> {
    // Start the Matterbridge
  }

  /**
   * Starts the Matterbridge in bridge mode.
   * @private
   * @returns {Promise<void>} A promise that resolves when the Matterbridge is started.
   */
  private async startBridge(): Promise<void> {
    // Plugins are loaded and started by loadPlugin on startup and plugin.loaded and plugin.started are set to true
    // Plugins are configured by a timer when matter server is started and plugin.configured is set to true

    this.log.debug('Starting startMatterInterval in bridge mode');
    let failCount = 0;
    this.startMatterInterval = setInterval(async () => {
      for (const plugin of this.plugins) {
        // new code to not start the bridge if one plugin is in error cause the controllers will delete the devices loosing all the configuration
        if (!plugin.enabled) continue;
        if (plugin.error) {
          clearInterval(this.startMatterInterval);
          this.startMatterInterval = undefined;
          this.log.debug('Cleared startMatterInterval interval for Matterbridge for plugin in error state');
          this.log.error(`The plugin ${plg}${plugin.name}${er} is in error state.`);
          this.log.error('The bridge will not start until the problem is solved to prevent the controllers from deleting all registered devices.');
          this.log.error('If you want to start the bridge disable the plugin in error state and restart.');
          return;
        }

        if (!plugin.loaded || !plugin.started) {
          this.log.debug(`Waiting (failSafeCount=${failCount}/60) in startMatterInterval interval for plugin ${plg}${plugin.name}${db} loaded: ${plugin.loaded} started: ${plugin.started}...`);
          failCount++;
          if (failCount > 60) {
            this.log.error(`Error waiting for plugin ${plg}${plugin.name}${er} to load and start. Plugin is in error state.`);
            plugin.error = true;
          }
          return;
        }
      }
      clearInterval(this.startMatterInterval);
      this.startMatterInterval = undefined;
      this.log.debug('Cleared startMatterInterval interval for Matterbridge');

      await this.startMatterServer();
      this.log.notice('Matter server started');

      // Configure the plugins
      this.configureTimeout = setTimeout(async () => {
        for (const plugin of this.plugins) {
          if (!plugin.enabled || !plugin.loaded || !plugin.started || plugin.error) continue;
          try {
            await this.plugins.configure(plugin); // TODO No await do it in parallel
          } catch (error) {
            plugin.error = true;
            this.log.error(`Error configuring plugin ${plg}${plugin.name}${er}`, error);
          }
        }
      }, 30 * 1000);

      // Show the QR code for commissioning or log the already commissioned message
      await this.showCommissioningQRCode(this.commissioningServer, this.matterbridgeContext, this.nodeContext, 'Matterbridge');

      // Setting reachability to true
      this.reachabilityTimeout = setTimeout(() => {
        this.log.info(`Setting reachability to true for ${plg}Matterbridge${db}`);
        if (this.commissioningServer) this.setCommissioningServerReachability(this.commissioningServer, true);
        if (this.matterAggregator) this.setAggregatorReachability(this.matterAggregator, true);
      }, 60 * 1000);
    }, 1000);
  }

  /**
   * Starts the Matterbridge in childbridge mode.
   * @private
   * @returns {Promise<void>} A promise that resolves when the Matterbridge is started.
   */
  private async startChildbridge(): Promise<void> {
    // Plugins are loaded and started by loadPlugin on startup and plugin.loaded and plugin.started are set to true
    // addDevice and addBridgedDeevice create the commissionig servers and add the devices to the the commissioning server or to the aggregator
    // Plugins are configured by a timer when matter server is started and plugin.configured is set to true

    this.log.debug('Starting start matter interval in childbridge mode...');
    let failCount = 0;
    this.startMatterInterval = setInterval(async () => {
      let allStarted = true;
      for (const plugin of this.plugins) {
        // new code to not start the bridge if one plugin is in error cause the controllers will delete the devices loosing all the configuration
        if (!plugin.enabled) continue;
        if (plugin.error) {
          clearInterval(this.startMatterInterval);
          this.startMatterInterval = undefined;
          this.log.debug('Cleared startMatterInterval interval for Matterbridge for plugin in error state');
          this.log.error(`The plugin ${plg}${plugin.name}${er} is in error state.`);
          this.log.error('The bridge will not start until the problem is solved to prevent the controllers from deleting all registered devices.');
          this.log.error('If you want to start the bridge disable the plugin in error state and restart.');
          return;
        }

        this.log.debug(`Checking plugin ${plg}${plugin.name}${db} to start matter in childbridge mode...`);
        if (!plugin.loaded || !plugin.started) {
          allStarted = false;
          this.log.debug(`Waiting (failSafeCount=${failCount}/60) for plugin ${plg}${plugin.name}${db} to load (${plugin.loaded}) and start (${plugin.started}) ...`);
          failCount++;
          if (failCount > 60) {
            this.log.error(`Error waiting for plugin ${plg}${plugin.name}${er} to load and start. Plugin is in error mode.`);
            plugin.error = true;
          }
        }
      }
      if (!allStarted) return;
      clearInterval(this.startMatterInterval);
      this.startMatterInterval = undefined;
      this.log.debug('Cleared startMatterInterval interval in childbridge mode');

      await this.startMatterServer();
      this.log.notice('Matter server started');

      // Configure the plugins
      this.configureTimeout = setTimeout(async () => {
        for (const plugin of this.plugins) {
          if (!plugin.enabled || !plugin.loaded || !plugin.started || plugin.error) continue;
          try {
            await this.plugins.configure(plugin); // TODO No await do it in parallel
          } catch (error) {
            plugin.error = true;
            this.log.error(`Error configuring plugin ${plg}${plugin.name}${er}`, error);
          }
        }
      }, 30 * 1000);

      for (const plugin of this.plugins) {
        if (!plugin.enabled || plugin.error) continue;
        if (!plugin.addedDevices || plugin.addedDevices === 0) {
          this.log.error(`Plugin ${plg}${plugin.name}${er} didn't add any devices to Matterbridge. Verify the plugin configuration.`);
          continue;
        }
        if (!plugin.commissioningServer) {
          this.log.error(`Commissioning server not found for plugin ${plg}${plugin.name}${er}`);
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
        await this.showCommissioningQRCode(plugin.commissioningServer, plugin.storageContext, plugin.nodeContext, plugin.name);

        // Setting reachability to true
        plugin.reachabilityTimeout = setTimeout(() => {
          this.log.info(`Setting reachability to true for ${plg}${plugin.name}${db}`);
          if (plugin.commissioningServer) this.setCommissioningServerReachability(plugin.commissioningServer, true);
          if (plugin.type === 'AccessoryPlatform' && plugin.device) this.setDeviceReachability(plugin.device, true);
          if (plugin.type === 'DynamicPlatform' && plugin.aggregator) this.setAggregatorReachability(plugin.aggregator, true);
        }, 60 * 1000);
      }
    }, 1000);
  }

  /**
   * Starts the Matterbridge controller.
   * @private
   * @returns {Promise<void>} A promise that resolves when the Matterbridge is started.
   */
  private async startController(): Promise<void> {
    if (!this.storageManager) {
      this.log.error('No storage manager initialized');
      await this.cleanup('No storage manager initialized');
      return;
    }
    this.log.info('Creating context: mattercontrollerContext');
    this.mattercontrollerContext = this.storageManager.createContext('mattercontrollerContext');
    if (!this.mattercontrollerContext) {
      this.log.error('No storage context mattercontrollerContext initialized');
      await this.cleanup('No storage context mattercontrollerContext initialized');
      return;
    }

    this.log.debug('Starting matterbridge in mode', this.bridgeMode);
    this.matterServer = this.createMatterServer(this.storageManager);
    this.log.info('Creating matter commissioning controller');
    this.commissioningController = new CommissioningController({
      autoConnect: false,
    });
    this.log.info('Adding matter commissioning controller to matter server');
    await this.matterServer.addCommissioningController(this.commissioningController);

    this.log.info('Starting matter server');
    await this.matterServer.start();
    this.log.info('Matter server started');

    if (hasParameter('pairingcode')) {
      this.log.info('Pairing device with pairingcode:', getParameter('pairingcode'));
      const pairingCode = getParameter('pairingcode');
      const ip = this.mattercontrollerContext.has('ip') ? this.mattercontrollerContext.get<string>('ip') : undefined;
      const port = this.mattercontrollerContext.has('port') ? this.mattercontrollerContext.get<number>('port') : undefined;

      let longDiscriminator, setupPin, shortDiscriminator;
      if (pairingCode !== undefined) {
        const pairingCodeCodec = ManualPairingCodeCodec.decode(pairingCode);
        shortDiscriminator = pairingCodeCodec.shortDiscriminator;
        longDiscriminator = undefined;
        setupPin = pairingCodeCodec.passcode;
        this.log.info(`Data extracted from pairing code: ${Logger.toJSON(pairingCodeCodec)}`);
      } else {
        longDiscriminator = await this.mattercontrollerContext.get('longDiscriminator', 3840);
        if (longDiscriminator > 4095) throw new Error('Discriminator value must be less than 4096');
        setupPin = this.mattercontrollerContext.get('pin', 20202021);
      }
      if ((shortDiscriminator === undefined && longDiscriminator === undefined) || setupPin === undefined) {
        throw new Error('Please specify the longDiscriminator of the device to commission with -longDiscriminator or provide a valid passcode with -passcode');
      }

      const commissioningOptions: CommissioningOptions = {
        regulatoryLocation: GeneralCommissioning.RegulatoryLocationType.IndoorOutdoor,
        regulatoryCountryCode: 'XX',
      };
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
  }

  /** ***********************************************************************************************************************************/
  /**                                                     Matter.js methods                                                             */
  /** ***********************************************************************************************************************************/

  /**
   * Starts the matter storage process based on the specified storage type and name.
   * @param {string} storageType - The type of storage to start (e.g., 'disk', 'json').
   * @param {string} storageName - The name of the storage file.
   * @returns {Promise<void>} - A promise that resolves when the storage process is started.
   */
  private async startMatterStorage(storageType: string, storageName: string): Promise<void> {
    this.log.debug(`Starting ${storageType} storage ${CYAN}${storageName}${db}`);
    if (storageType === 'disk') {
      const storageDisk = new StorageBackendDisk(storageName);
      this.storageManager = new StorageManager(storageDisk);
    } else if (storageType === 'json') {
      if (!storageName.endsWith('.json')) storageName += '.json';
      const storageJson = new StorageBackendJsonFile(storageName);
      this.storageManager = new StorageManager(storageJson);
    } else {
      this.log.error(`Unsupported storage type ${storageType}`);
      await this.cleanup('Unsupported storage type');
      return;
    }
    try {
      await this.storageManager.initialize();
      this.log.debug('Storage initialized');
      if (storageType === 'json') {
        await this.backupJsonMatterStorage(storageName, storageName.replace('.json', '') + '.backup.json');
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      this.log.error(`Storage initialize() error! The file .matterbridge/${storageName} may be corrupted.`);
      this.log.error(`Please delete it and rename ${storageName.replace('.json', '.backup.json')} to ${storageName} and try to restart Matterbridge.`);
      await this.cleanup('Storage initialize() error!');
    }
  }

  /**
   * Makes a backup copy of the specified matter JSON storage file.
   *
   * @param storageName - The name of the JSON storage file to be backed up.
   * @param backupName - The name of the backup file to be created.
   */
  private async backupJsonMatterStorage(storageName: string, backupName: string) {
    try {
      this.log.debug(`Making backup copy of ${storageName}`);
      await fs.copyFile(storageName, backupName);
      this.log.debug(`Successfully backed up ${storageName} to ${backupName}`);
    } catch (err) {
      if (err instanceof Error && 'code' in err) {
        if (err.code === 'ENOENT') {
          this.log.info(`No existing file to back up for ${storageName}. This is expected on the first run.`);
        } else {
          this.log.error(`Error making backup copy of ${storageName}: ${err.message}`);
        }
      } else {
        this.log.error(`An unexpected error occurred during the backup of ${storageName}: ${String(err)}`);
      }
    }
  }

  /**
   * Stops the matter storage.
   * @returns {Promise<void>} A promise that resolves when the storage is stopped.
   */
  private async stopMatterStorage(): Promise<void> {
    this.log.debug('Stopping storage');
    await this.storageManager?.close();
    this.log.debug('Storage closed');
    this.storageManager = undefined;
    this.matterbridgeContext = undefined;
    this.mattercontrollerContext = undefined;
  }

  /**
   * Creates a Matter server using the provided storage manager and the provided mdnsInterface.
   * @param storageManager The storage manager to be used by the Matter server.
   *
   */
  private createMatterServer(storageManager: StorageManager): MatterServer {
    this.log.debug('Creating matter server');

    // Validate mdnsInterface
    if (this.mdnsInterface) {
      const networkInterfaces = os.networkInterfaces();
      const availableInterfaces = Object.keys(networkInterfaces);
      if (!availableInterfaces.includes(this.mdnsInterface)) {
        this.log.error(`Invalid mdnsInterface: ${this.mdnsInterface}. Available interfaces are: ${availableInterfaces.join(', ')}. Using all available interfaces.`);
        this.mdnsInterface = undefined;
      } else {
        this.log.info(`Using mdnsInterface '${this.mdnsInterface}' for the Matter server MdnsBroadcaster.`);
      }
    }
    const matterServer = new MatterServer(storageManager, { mdnsInterface: this.mdnsInterface });
    this.log.debug(`Created matter server with mdnsInterface: ${this.mdnsInterface ?? 'all available interfaces'}`);
    return matterServer;
  }

  /**
   * Starts the Matter server.
   * If the Matter server is not initialized, it logs an error and performs cleanup.
   */
  private async startMatterServer() {
    if (!this.matterServer) {
      this.log.error('No matter server initialized');
      await this.cleanup('No matter server initialized');
      return;
    }
    this.log.debug('Starting matter server...');
    await this.matterServer.start();
    this.log.debug('Started matter server');
    // this.commissioningServer?.getRootEndpoint() && logEndpoint(this.commissioningServer?.getRootEndpoint());
  }

  /**
   * Stops the Matter server, commissioningServer and commissioningController.
   */
  private async stopMatterServer() {
    this.log.debug('Stopping matter commissioningServer');
    await this.commissioningServer?.close();
    this.log.debug('Stopping matter commissioningController');
    await this.commissioningController?.close();
    this.log.debug('Stopping matter server');
    await this.matterServer?.close();
    this.log.debug('Matter server closed');
    this.commissioningController = undefined;
    this.commissioningServer = undefined;
    this.matterAggregator = undefined;
    this.matterServer = undefined;
  }

  /**
   * Creates a Matter Aggregator.
   * @param {StorageContext} context - The storage context.
   * @returns {Aggregator} - The created Matter Aggregator.
   */
  private async createMatterAggregator(context: StorageContext, pluginName: string): Promise<Aggregator> {
    const random = 'AG' + CryptoNode.getRandomData(8).toHex();
    await context.set('aggregatorSerialNumber', await context.get('aggregatorSerialNumber', random));
    await context.set('aggregatorUniqueId', await context.get('aggregatorUniqueId', random));

    this.log.debug(`Creating matter aggregator for plugin ${plg}${pluginName}${db} with uniqueId ${await context.get<string>('aggregatorUniqueId')} serialNumber ${await context.get<string>('aggregatorSerialNumber')}`);
    this.log.debug(`Creating matter aggregator for plugin ${plg}${pluginName}${db} with softwareVersion ${await context.get<number>('softwareVersion', 1)} softwareVersionString ${await context.get<string>('softwareVersionString', '1.0.0')}`);
    this.log.debug(`Creating matter aggregator for plugin ${plg}${pluginName}${db} with hardwareVersion ${await context.get<number>('hardwareVersion', 1)} hardwareVersionString ${await context.get<string>('hardwareVersionString', '1.0.0')}`);

    const matterAggregator = new Aggregator();
    matterAggregator.addClusterServer(
      ClusterServer(
        BasicInformationCluster,
        {
          dataModelRevision: 1,
          location: 'FR',
          vendorId: VendorId(0xfff1),
          vendorName: 'Matterbridge',
          productId: 0x8000,
          productName: 'Matterbridge aggregator',
          productLabel: 'Matterbridge aggregator',
          nodeLabel: 'Matterbridge aggregator',
          serialNumber: await context.get<string>('aggregatorSerialNumber'),
          uniqueId: await context.get<string>('aggregatorUniqueId'),
          softwareVersion: await context.get<number>('softwareVersion', 1),
          softwareVersionString: await context.get<string>('softwareVersionString', '1.0.0'),
          hardwareVersion: await context.get<number>('hardwareVersion', 1),
          hardwareVersionString: await context.get<string>('hardwareVersionString', '1.0.0'),
          reachable: true,
          capabilityMinima: { caseSessionsPerFabric: 3, subscriptionsPerFabric: 3 },
          specificationVersion: Specification.SPECIFICATION_VERSION,
          maxPathsPerInvoke: 1,
        },
        {},
        {
          startUp: true,
          shutDown: true,
          leave: true,
          reachableChanged: true,
        },
      ),
    );
    return matterAggregator;
  }

  /**
   * Creates a matter commissioning server.
   *
   * @param {StorageContext} context - The storage context.
   * @param {string} pluginName - The name of the commissioning server.
   * @returns {CommissioningServer} The created commissioning server.
   */
  private async createCommisioningServer(context: StorageContext, pluginName: string): Promise<CommissioningServer> {
    this.log.debug(`Creating matter commissioning server for plugin ${plg}${pluginName}${db}`);
    const deviceName = await context.get<string>('deviceName');
    const deviceType = await context.get<DeviceTypeId>('deviceType');

    const vendorId = await context.get<number>('vendorId');
    const vendorName = await context.get<string>('vendorName'); // Home app = Manufacturer

    const productId = await context.get<number>('productId');
    const productName = await context.get<string>('productName'); // Home app = Model

    const serialNumber = await context.get<string>('serialNumber');
    const uniqueId = await context.get<string>('uniqueId');

    const softwareVersion = await context.get<number>('softwareVersion', 1);
    const softwareVersionString = await context.get<string>('softwareVersionString', '1.0.0'); // Home app = Firmware Revision

    const hardwareVersion = await context.get<number>('hardwareVersion', 1);
    const hardwareVersionString = await context.get<string>('hardwareVersionString', '1.0.0');

    this.log.debug(`Creating matter commissioning server for plugin ${plg}${pluginName}${db} with deviceName '${deviceName}' deviceType ${deviceType}(0x${deviceType.toString(16).padStart(4, '0')})`);
    this.log.debug(`Creating matter commissioning server for plugin ${plg}${pluginName}${db} with uniqueId ${uniqueId} serialNumber ${serialNumber}`);
    this.log.debug(`Creating matter commissioning server for plugin ${plg}${pluginName}${db} with softwareVersion ${softwareVersion} softwareVersionString ${softwareVersionString}`);
    this.log.debug(`Creating matter commissioning server for plugin ${plg}${pluginName}${db} with hardwareVersion ${hardwareVersion} hardwareVersionString ${hardwareVersionString}`);
    this.log.debug(`Creating matter commissioning server for plugin ${plg}${pluginName}${db} with nodeLabel '${productName}' port ${this.port} passcode ${this.passcode} discriminator ${this.discriminator}`);

    // Validate ipv4address
    if (this.ipv4address) {
      const networkInterfaces = os.networkInterfaces();
      const availableAddresses = Object.values(networkInterfaces)
        .flat()
        .filter((iface): iface is os.NetworkInterfaceInfo => iface !== undefined && iface.family === 'IPv4' && !iface.internal)
        .map((iface) => iface.address);
      if (!availableAddresses.includes(this.ipv4address)) {
        this.log.error(`Invalid ipv4address: ${this.ipv4address}. Available addresses are: ${availableAddresses.join(', ')}. Using all available addresses.`);
        this.mdnsInterface = undefined;
      } else {
        this.log.info(`Using ipv4address '${this.ipv4address}' for the Matter commissioning server.`);
      }
    }

    // Validate ipv6address
    if (this.ipv6address) {
      const networkInterfaces = os.networkInterfaces();
      const availableAddresses = Object.values(networkInterfaces)
        .flat()
        .filter((iface): iface is os.NetworkInterfaceInfo => iface !== undefined && iface.family === 'IPv6' && !iface.internal)
        .map((iface) => iface.address);
      if (!availableAddresses.includes(this.ipv6address)) {
        this.log.error(`Invalid ipv6address: ${this.ipv6address}. Available addresses are: ${availableAddresses.join(', ')}. Using all available addresses.`);
        this.mdnsInterface = undefined;
      } else {
        this.log.info(`Using ipv6address '${this.ipv6address}' for the Matter commissioning server.`);
      }
    }

    const commissioningServer = new CommissioningServer({
      port: this.port++,
      listeningAddressIpv4: this.ipv4address,
      listeningAddressIpv6: this.ipv6address,
      passcode: this.passcode,
      discriminator: this.discriminator,
      deviceName,
      deviceType,
      basicInformation: {
        vendorId: VendorId(vendorId),
        vendorName,
        productId,
        productName,
        nodeLabel: productName,
        productLabel: productName,
        softwareVersion,
        softwareVersionString, // Home app = Firmware Revision
        hardwareVersion,
        hardwareVersionString,
        uniqueId,
        serialNumber,
        reachable: true,
      },
      activeSessionsChangedCallback: (fabricIndex) => {
        const sessionInformations: SessionInformation[] = commissioningServer.getActiveSessionInformation(fabricIndex);
        let connected = false;
        sessionInformations.forEach((session) => {
          this.log.info(
            `Active session changed on fabric ${zb}${fabricIndex}${nf} id ${zb}${session.fabric?.fabricId}${nf} vendor ${zb}${session.fabric?.rootVendorId}${nf} ${this.getVendorIdName(session.fabric?.rootVendorId)} ${session.fabric?.label} for ${plg}${pluginName}${nf}`,
            debugStringify(session),
          );
          if (session.isPeerActive === true && session.secure === true && session.numberOfActiveSubscriptions >= 1) {
            this.log.notice(`Controller ${zb}${session.fabric?.rootVendorId}${nt} ${this.getVendorIdName(session.fabric?.rootVendorId)} ${session.fabric?.label} connected to ${plg}${pluginName}${nt} on session ${session.name}`);
            connected = true;
          }
        });
        if (connected) {
          if (this.bridgeMode === 'bridge') {
            this.matterbridgePaired = true;
            this.matterbridgeConnected = true;
            this.matterbridgeSessionInformations = this.sanitizeSessionInformation(sessionInformations);
          }
          if (this.bridgeMode === 'childbridge') {
            const plugin = this.plugins.get(pluginName);
            if (plugin) {
              plugin.paired = true;
              plugin.connected = true;
              plugin.sessionInformations = this.sanitizeSessionInformation(sessionInformations);
            }
          }
        } else {
          if (this.bridgeMode === 'bridge') {
            this.matterbridgeSessionInformations = [];
          }
          if (this.bridgeMode === 'childbridge') {
            const plugin = this.plugins.get(pluginName);
            if (plugin) {
              plugin.sessionInformations = [];
            }
          }
        }
      },
      commissioningChangedCallback: async (fabricIndex) => {
        const fabricInfo = commissioningServer.getCommissionedFabricInformation(fabricIndex);
        this.log.debug(`Commissioning changed on fabric ${zb}${fabricIndex}${db} for ${plg}${pluginName}${db}`, debugStringify(fabricInfo));
        if (commissioningServer.getCommissionedFabricInformation().length === 0) {
          this.log.warn(`Commissioning removed from fabric ${zb}${fabricIndex}${wr} for ${plg}${pluginName}${wr}. Resetting the commissioning server ...`);
          await commissioningServer.factoryReset();
          if (pluginName === 'Matterbridge') {
            await this.matterbridgeContext?.clearAll();
            this.matterbridgeFabricInformations = [];
            this.matterbridgeSessionInformations = [];
            this.matterbridgePaired = false;
            this.matterbridgeConnected = false;
          } else {
            for (const plugin of this.plugins) {
              if (plugin.name === pluginName) {
                await plugin.platform?.onShutdown('Commissioning removed by the controller');
                plugin.fabricInformations = [];
                plugin.sessionInformations = [];
                plugin.paired = false;
                plugin.connected = false;
                await plugin.storageContext?.clearAll();
              }
            }
          }
          this.log.warn(`Restart to activate the pairing for ${plg}${pluginName}${wr}.`);
        } else {
          const fabricInfo = commissioningServer.getCommissionedFabricInformation();
          if (pluginName === 'Matterbridge') {
            this.matterbridgeFabricInformations = this.sanitizeFabricInformations(fabricInfo);
            this.matterbridgePaired = true;
          } else {
            const plugin = this.plugins.get(pluginName);
            if (plugin) {
              plugin.fabricInformations = this.sanitizeFabricInformations(fabricInfo);
              plugin.paired = true;
            }
          }
        }
      },
    });
    if (this.passcode !== undefined) this.passcode++;
    if (this.discriminator !== undefined) this.discriminator++;

    commissioningServer.addCommandHandler('testEventTrigger', async ({ request: { enableKey, eventTrigger } }) => this.log.info(`testEventTrigger called on GeneralDiagnostic cluster: ${enableKey} ${eventTrigger}`));
    return commissioningServer;
  }

  /**
   * Creates a commissioning server storage context.
   *
   * @param pluginName - The name of the plugin.
   * @param deviceName - The name of the device.
   * @param deviceType - The type of the device.
   * @param vendorId - The vendor ID.
   * @param vendorName - The vendor name.
   * @param productId - The product ID.
   * @param productName - The product name.
   * @param serialNumber - The serial number of the device (optional).
   * @param uniqueId - The unique ID of the device (optional).
   * @param softwareVersion - The software version of the device (optional).
   * @param softwareVersionString - The software version string of the device (optional).
   * @param hardwareVersion - The hardware version of the device (optional).
   * @param hardwareVersionString - The hardware version string of the device (optional).
   * @returns The storage context for the commissioning server.
   */
  private async createCommissioningServerContext(pluginName: string, deviceName: string, deviceType: DeviceTypeId, vendorId: number, vendorName: string, productId: number, productName: string) {
    if (!this.storageManager) throw new Error('No storage manager initialized');
    this.log.debug(`Creating commissioning server storage context for ${plg}${pluginName}${db}`);
    const random = 'CS' + CryptoNode.getRandomData(8).toHex();
    const storageContext = this.storageManager.createContext(pluginName);
    await storageContext.set('deviceName', deviceName);
    await storageContext.set('deviceType', deviceType);
    await storageContext.set('vendorId', vendorId);
    await storageContext.set('vendorName', vendorName.slice(0, 32));
    await storageContext.set('productId', productId);
    await storageContext.set('productName', productName.slice(0, 32));
    await storageContext.set('nodeLabel', productName.slice(0, 32));
    await storageContext.set('productLabel', productName.slice(0, 32));
    await storageContext.set('serialNumber', await storageContext.get('serialNumber', random));
    await storageContext.set('uniqueId', await storageContext.get('uniqueId', random));
    await storageContext.set('softwareVersion', this.matterbridgeVersion && this.matterbridgeVersion.includes('.') ? parseInt(this.matterbridgeVersion.split('.')[0], 10) : 1);
    await storageContext.set('softwareVersionString', this.matterbridgeVersion ?? '1.0.0');
    await storageContext.set('hardwareVersion', this.systemInformation.osRelease && this.systemInformation.osRelease.includes('.') ? parseInt(this.systemInformation.osRelease.split('.')[0], 10) : 1);
    await storageContext.set('hardwareVersionString', this.systemInformation.osRelease ?? '1.0.0');

    this.log.debug(`Created commissioning server storage context for ${plg}${pluginName}${db}`);
    this.log.debug(`- deviceName: ${await storageContext.get('deviceName')} deviceType: ${await storageContext.get('deviceType')}(0x${(await storageContext.get('deviceType'))?.toString(16).padStart(4, '0')})`);
    this.log.debug(`- serialNumber: ${await storageContext.get('serialNumber')} uniqueId: ${await storageContext.get('uniqueId')}`);
    this.log.debug(`- softwareVersion: ${await storageContext.get('softwareVersion')} softwareVersionString: ${await storageContext.get('softwareVersionString')}`);
    this.log.debug(`- hardwareVersion: ${await storageContext.get('hardwareVersion')} hardwareVersionString: ${await storageContext.get('hardwareVersionString')}`);
    return storageContext;
  }

  /**
   * Imports the commissioning server context for a specific plugin and device.
   * @param pluginName - The name of the plugin.
   * @param device - The MatterbridgeDevice object representing the device.
   * @returns The commissioning server context.
   * @throws Error if the BasicInformationCluster is not found.
   */
  private async importCommissioningServerContext(pluginName: string, device: MatterbridgeDevice) {
    this.log.debug(`Importing matter commissioning server storage context from device for ${plg}${pluginName}${db}`);
    const basic = device.getClusterServer(BasicInformationCluster);
    if (!basic) {
      this.log.error('importCommissioningServerContext error: cannot find the BasicInformationCluster');
      process.exit(1);
    }
    if (!this.storageManager) {
      this.log.error('importCommissioningServerContext error: no storage manager initialized');
      process.exit(1);
    }

    this.log.debug(`Importing commissioning server storage context for ${plg}${pluginName}${db}`);
    const storageContext = this.storageManager.createContext(pluginName);
    await storageContext.set('deviceName', basic.getNodeLabelAttribute());
    await storageContext.set('deviceType', DeviceTypeId(device.deviceType));
    await storageContext.set('vendorId', basic.getVendorIdAttribute());
    await storageContext.set('vendorName', basic.getVendorNameAttribute());
    await storageContext.set('productId', basic.getProductIdAttribute());
    await storageContext.set('productName', basic.getProductNameAttribute());
    await storageContext.set('nodeLabel', basic.getNodeLabelAttribute());
    await storageContext.set('productLabel', basic.getNodeLabelAttribute());
    await storageContext.set('serialNumber', basic.attributes.serialNumber?.getLocal());
    await storageContext.set('uniqueId', basic.attributes.uniqueId?.getLocal());
    await storageContext.set('softwareVersion', basic.getSoftwareVersionAttribute());
    await storageContext.set('softwareVersionString', basic.getSoftwareVersionStringAttribute());
    await storageContext.set('hardwareVersion', basic.getHardwareVersionAttribute());
    await storageContext.set('hardwareVersionString', basic.getHardwareVersionStringAttribute());

    this.log.debug(`Imported commissioning server storage context for ${plg}${pluginName}${db}`);
    this.log.debug(`- deviceName: ${await storageContext.get('deviceName')} deviceType: ${await storageContext.get('deviceType')}(0x${(await storageContext.get('deviceType'))?.toString(16).padStart(4, '0')})`);
    this.log.debug(`- serialNumber: ${await storageContext.get('serialNumber')} uniqueId: ${await storageContext.get('uniqueId')}`);
    this.log.debug(`- softwareVersion: ${await storageContext.get('softwareVersion')} softwareVersionString: ${await storageContext.get('softwareVersionString')}`);
    this.log.debug(`- hardwareVersion: ${await storageContext.get('hardwareVersion')} hardwareVersionString: ${await storageContext.get('hardwareVersionString')}`);
    return storageContext;
  }

  /**
   * Shows the commissioning server QR code for a given plugin.
   * @param {CommissioningServer} commissioningServer - The commissioning server instance.
   * @param {StorageContext} storageContext - The storage context instance.
   * @param {NodeStorage} nodeContext - The node storage instance.
   * @param {string} pluginName - The name of the plugin of Matterbridge in bridge mode.
   * @returns {Promise<void>} - A promise that resolves when the QR code is shown.
   */
  private async showCommissioningQRCode(commissioningServer: CommissioningServer | undefined, storageContext: StorageContext | undefined, nodeContext: NodeStorage | undefined, pluginName: string) {
    if (!commissioningServer || !storageContext || !nodeContext || !pluginName) {
      this.log.error(`showCommissioningQRCode error: commissioningServer: ${!commissioningServer} storageContext: ${!storageContext} nodeContext: ${!nodeContext} pluginName: ${pluginName}`);
      await this.cleanup('No storage initialized in showCommissioningQRCode');
      return;
    }
    if (!commissioningServer.isCommissioned()) {
      const { qrPairingCode, manualPairingCode } = commissioningServer.getPairingCode();
      const QrCode = new QrCodeSchema();
      this.log.info(`*The commissioning server on port ${commissioningServer.getPort()} for ${plg}${pluginName}${nf} is not commissioned. Pair it scanning the QR code:\n\n`);
      // eslint-disable-next-line no-console
      if (this.log.logLevel === LogLevel.DEBUG || this.log.logLevel === LogLevel.INFO) console.log(`${QrCode.encode(qrPairingCode)}\n`);
      this.log.info(`${plg}${pluginName}${nf} \n\nqrPairingCode: ${qrPairingCode} \n\nManual pairing code: ${manualPairingCode}\n`);
      if (pluginName === 'Matterbridge') {
        this.matterbridgeQrPairingCode = qrPairingCode;
        this.matterbridgeManualPairingCode = manualPairingCode;
        this.matterbridgeFabricInformations = [];
        this.matterbridgeSessionInformations = [];
        this.matterbridgePaired = false;
        this.matterbridgeConnected = false;
      }
      if (pluginName !== 'Matterbridge') {
        const plugin = this.plugins.get(pluginName);
        if (plugin) {
          plugin.qrPairingCode = qrPairingCode;
          plugin.manualPairingCode = manualPairingCode;
          plugin.fabricInformations = [];
          plugin.sessionInformations = [];
          plugin.paired = false;
          plugin.connected = false;
        }
      }
    } else {
      this.log.info(`*The commissioning server on port ${commissioningServer.getPort()} for ${plg}${pluginName}${nf} is already commissioned. Waiting for controllers to connect ...`);
      const fabricInfo = commissioningServer.getCommissionedFabricInformation();
      if (fabricInfo.length > 0) this.log.info('Commissioned fabric information:');
      fabricInfo?.forEach((info) => {
        this.log.info(`- fabric index ${zb}${info.fabricIndex}${nf} id ${zb}${info.fabricId}${nf} vendor ${zb}${info.rootVendorId}${nf} ${this.getVendorIdName(info.rootVendorId)} ${info.label}`);
      });
      if (pluginName === 'Matterbridge') {
        this.matterbridgeFabricInformations = this.sanitizeFabricInformations(fabricInfo);
        this.matterbridgeSessionInformations = [];
        this.matterbridgePaired = true;
      }
      if (pluginName !== 'Matterbridge') {
        const plugin = this.plugins.get(pluginName);
        if (plugin) {
          plugin.fabricInformations = this.sanitizeFabricInformations(fabricInfo);
          plugin.sessionInformations = [];
          plugin.paired = true;
        }
      }
    }
  }

  /**
   * Sanitizes the fabric information by converting bigint properties to string cause res.json doesn't know bigint.
   *
   * @param fabricInfo - The array of exposed fabric information objects.
   * @returns An array of sanitized exposed fabric information objects.
   */
  private sanitizeFabricInformations(fabricInfo: ExposedFabricInformation[]) {
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
   * Sanitizes the session information by converting bigint properties to string.
   *
   * @param sessionInfo - The array of session information objects.
   * @returns An array of sanitized session information objects.
   */
  private sanitizeSessionInformation(sessionInfo: SessionInformation[]) {
    return sessionInfo
      .filter((info) => info.isPeerActive)
      .map((info) => {
        return {
          name: info.name,
          nodeId: info.nodeId.toString(),
          peerNodeId: info.peerNodeId.toString(),
          fabric: info.fabric
            ? {
                fabricIndex: info.fabric.fabricIndex,
                fabricId: info.fabric.fabricId.toString(),
                nodeId: info.fabric.nodeId.toString(),
                rootNodeId: info.fabric.rootNodeId.toString(),
                rootVendorId: info.fabric.rootVendorId,
                rootVendorName: this.getVendorIdName(info.fabric.rootVendorId),
                label: info.fabric.label,
              }
            : undefined,
          isPeerActive: info.isPeerActive,
          secure: info.secure,
          lastInteractionTimestamp: info.lastInteractionTimestamp?.toString(),
          lastActiveTimestamp: info.lastActiveTimestamp?.toString(),
          numberOfActiveSubscriptions: info.numberOfActiveSubscriptions,
        } as SanitizedSessionInformation;
      });
  }

  /**
   * Sets the reachability of a commissioning server and trigger.
   *
   * @param {CommissioningServer} commissioningServer - The commissioning server to set the reachability for.
   * @param {boolean} reachable - The new reachability status.
   */
  private setCommissioningServerReachability(commissioningServer: CommissioningServer, reachable: boolean) {
    const basicInformationCluster = commissioningServer?.getRootClusterServer(BasicInformationCluster);
    if (basicInformationCluster && basicInformationCluster.attributes.reachable !== undefined) basicInformationCluster.setReachableAttribute(reachable);
    if (basicInformationCluster && basicInformationCluster.triggerReachableChangedEvent) basicInformationCluster.triggerReachableChangedEvent({ reachableNewValue: reachable });
  }

  /**
   * Sets the reachability of the specified matter aggregator and its bridged devices and trigger.
   * @param {Aggregator} matterAggregator - The matter aggregator to set the reachability for.
   * @param {boolean} reachable - A boolean indicating the reachability status to set.
   */
  private setAggregatorReachability(matterAggregator: Aggregator, reachable: boolean) {
    const basicInformationCluster = matterAggregator.getClusterServer(BasicInformationCluster);
    if (basicInformationCluster && basicInformationCluster.attributes.reachable !== undefined) basicInformationCluster.setReachableAttribute(reachable);
    if (basicInformationCluster && basicInformationCluster.triggerReachableChangedEvent) basicInformationCluster.triggerReachableChangedEvent({ reachableNewValue: reachable });
    matterAggregator.getBridgedDevices().forEach((device) => {
      this.log.debug(`Setting reachability to true for bridged device: ${dev}${device.name}${nf}`);
      device.getClusterServer(BridgedDeviceBasicInformationCluster)?.setReachableAttribute(reachable);
      device.getClusterServer(BridgedDeviceBasicInformationCluster)?.triggerReachableChangedEvent({ reachableNewValue: reachable });
    });
  }

  /**
   * Sets the reachability of a device and trigger.
   *
   * @param {MatterbridgeDevice} device - The device to set the reachability for.
   * @param {boolean} reachable - The new reachability status of the device.
   */
  private setDeviceReachability(device: MatterbridgeDevice, reachable: boolean) {
    const basicInformationCluster = device.getClusterServer(BasicInformationCluster);
    if (basicInformationCluster && basicInformationCluster.attributes.reachable !== undefined) basicInformationCluster.setReachableAttribute(reachable);
    if (basicInformationCluster && basicInformationCluster.triggerReachableChangedEvent) basicInformationCluster.triggerReachableChangedEvent({ reachableNewValue: reachable });
  }

  private getVendorIdName = (vendorId: number | undefined) => {
    if (!vendorId) return '';
    let vendorName = '';
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
      case 4742:
        vendorName = '(eWeLink)';
        break;
      case 65521:
        vendorName = '(PythonMatterServer)';
        break;
      default:
        vendorName = '(unknown)';
        break;
    }
    return vendorName;
  };

  /**
   * Retrieves the base registered plugins sanitized for res.json().
   * @returns {BaseRegisteredPlugin[]} A promise that resolves to an array of BaseRegisteredPlugin objects.
   */
  private async getBaseRegisteredPlugins(): Promise<BaseRegisteredPlugin[]> {
    const baseRegisteredPlugins: BaseRegisteredPlugin[] = [];
    for (const plugin of this.plugins) {
      baseRegisteredPlugins.push({
        path: plugin.path,
        type: plugin.type,
        name: plugin.name,
        version: plugin.version,
        description: plugin.description,
        author: plugin.author,
        latestVersion: plugin.latestVersion,
        locked: plugin.locked,
        error: plugin.error,
        enabled: plugin.enabled,
        loaded: plugin.loaded,
        started: plugin.started,
        configured: plugin.configured,
        paired: plugin.paired,
        connected: plugin.connected,
        fabricInformations: plugin.fabricInformations,
        sessionInformations: plugin.sessionInformations,
        registeredDevices: plugin.registeredDevices,
        addedDevices: plugin.addedDevices,
        qrPairingCode: plugin.qrPairingCode,
        manualPairingCode: plugin.manualPairingCode,
        configJson: plugin.configJson,
        schemaJson: plugin.schemaJson,
      });
    }
    return baseRegisteredPlugins;
  }

  /**
   * Spawns a child process with the given command and arguments.
   * @param {string} command - The command to execute.
   * @param {string[]} args - The arguments to pass to the command (default: []).
   * @returns {Promise<void>} A promise that resolves when the child process exits successfully, or rejects if there is an error.
   */
  private async spawnCommand(command: string, args: string[] = []): Promise<void> {
    /*
    npm > npm.cmd on windows
    cmd.exe ['dir'] on windows
    await this.spawnCommand('npm', ['install', '-g', 'matterbridge']);
    process.on('unhandledRejection', (reason, promise) => {
      this.log.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    spawn - [14:27:21.125] [Matterbridge:spawn]: changed 38 packages in 4s
    spawn - [14:27:21.125] [Matterbridge:spawn]: 10 packages are looking for funding run `npm fund` for details
    debug - [14:27:21.131] [Matterbridge]: Child process exited with code 0 and signal null
    debug - [14:27:21.131] [Matterbridge]: Child process stdio streams have closed with code 0
    */
    const cmdLine = command + ' ' + args.join(' ');
    if (process.platform === 'win32' && command === 'npm') {
      // Must be spawn('cmd.exe', ['/c', 'npm -g install <package>']);
      const argstring = 'npm ' + args.join(' ');
      args.splice(0, args.length, '/c', argstring);
      command = 'cmd.exe';
    }
    // Decide when using sudo on linux
    // When you need sudo: Spawn stderr: npm error Error: EACCES: permission denied
    // When you don't need sudo: Failed to start child process "npm install -g matterbridge-eve-door": spawn sudo ENOENT
    if (hasParameter('sudo') || (process.platform === 'linux' && command === 'npm' && !hasParameter('docker') && !hasParameter('nosudo'))) {
      args.unshift(command);
      command = 'sudo';
    }
    this.log.debug(`Spawn command ${command} with ${debugStringify(args)}`);
    return new Promise((resolve, reject) => {
      const childProcess = spawn(command, args, {
        stdio: ['inherit', 'pipe', 'pipe'],
      });

      childProcess.on('error', (err) => {
        this.log.error(`Failed to start child process "${cmdLine}": ${err.message}`);
        reject(err);
      });

      childProcess.on('close', (code, signal) => {
        this.wssSendMessage('spawn', this.log.now(), 'Matterbridge:spawn', `child process closed with code ${code} and signal ${signal}`);
        if (code === 0) {
          if (cmdLine.startsWith('npm install -g')) this.log.notice(`Package ${cmdLine.replace('npm install -g ', '').replace('--verbose', '')} installed correctly`);
          this.log.debug(`Child process "${cmdLine}" closed with code ${code} and signal ${signal}`);
          resolve();
        } else {
          this.log.error(`Child process "${cmdLine}" closed with code ${code} and signal ${signal}`);
          reject(new Error(`Child process "${cmdLine}" closed with code ${code} and signal ${signal}`));
        }
      });

      childProcess.on('exit', (code, signal) => {
        this.wssSendMessage('spawn', this.log.now(), 'Matterbridge:spawn', `child process exited with code ${code} and signal ${signal}`);
        if (code === 0) {
          this.log.debug(`Child process "${cmdLine}" exited with code ${code} and signal ${signal}`);
          resolve();
        } else {
          this.log.error(`Child process "${cmdLine}" exited with code ${code} and signal ${signal}`);
          reject(new Error(`Child process "${cmdLine}" exited with code ${code} and signal ${signal}`));
        }
      });

      childProcess.on('disconnect', () => {
        this.log.debug(`Child process "${cmdLine}" has been disconnected from the parent`);
        resolve();
      });

      if (childProcess.stdout) {
        childProcess.stdout.on('data', (data: Buffer) => {
          const message = data.toString().trim();
          this.log.debug(`Spawn output (stdout): ${message}`);
          this.wssSendMessage('spawn', this.log.now(), 'Matterbridge:spawn', message);
        });
      }

      if (childProcess.stderr) {
        childProcess.stderr.on('data', (data: Buffer) => {
          const message = data.toString().trim();
          this.log.debug(`Spawn verbose (stderr): ${message}`);
          this.wssSendMessage('spawn', this.log.now(), 'Matterbridge:spawn', message);
        });
      }
    });
  }

  /**
   * Sends a WebSocket message to all connected clients.
   *
   * @param {string} level - The logger level of the message: debug info notice warn error fatal...
   * @param {string} time - The time string of the message
   * @param {string} name - The logger name of the message
   * @param {string} message - The content of the message.
   */
  private wssSendMessage(level: string, time: string, name: string, message: string) {
    if (!level || !time || !name || !message) return;
    // Remove ANSI escape codes from the message
    // eslint-disable-next-line no-control-regex
    message = message.replace(/\x1B\[[0-9;]*[m|s|u|K]/g, '');
    // Remove leading asterisks from the message
    message = message.replace(/^\*+/, '');
    // Replace all occurrences of \t and \n
    message = message.replace(/[\t\n]/g, '');
    // Remove non-printable characters
    // eslint-disable-next-line no-control-regex
    message = message.replace(/[\x00-\x1F\x7F]/g, '');
    // Replace all occurrences of \" with "
    message = message.replace(/\\"/g, '"');

    // Define the maximum allowed length for continuous characters without a space
    const maxContinuousLength = 100;
    const keepStartLength = 20;
    const keepEndLength = 20;
    // Split the message into words
    message = message
      .split(' ')
      .map((word) => {
        // If the word length exceeds the max continuous length, insert spaces and truncate
        if (word.length > maxContinuousLength) {
          return word.slice(0, keepStartLength) + ' ... ' + word.slice(-keepEndLength);
        }
        return word;
      })
      .join(' ');

    // Send the message to all connected clients
    this.webSocketServer?.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ level, time, name, message }));
      }
    });
  }

  /**
   * Initializes the frontend of Matterbridge.
   *
   * @param port The port number to run the frontend server on. Default is 8283.
   */
  async initializeFrontend(port = 8283): Promise<void> {
    let initializeError = false;
    this.log.debug(`Initializing the frontend ${hasParameter('ssl') ? 'https' : 'http'} server on port ${YELLOW}${port}${db}`);

    // Create the express app that serves the frontend
    this.expressApp = express();

    // Log all requests to the server for debugging
    /*
    if (hasParameter('homedir')) {
      this.expressApp.use((req, res, next) => {
        this.log.debug(`Received request on expressApp: ${req.method} ${req.url}`);
        next();
      });
    }
    */

    // Serve static files from '/static' endpoint
    this.expressApp.use(express.static(path.join(this.rootDirectory, 'frontend/build')));

    if (!hasParameter('ssl')) {
      // Create an HTTP server and attach the express app
      this.httpServer = createServer(this.expressApp);

      // Listen on the specified port
      if (hasParameter('ingress')) {
        this.httpServer.listen(port, '0.0.0.0', () => {
          this.log.info(`The frontend http server is listening on ${UNDERLINE}http://0.0.0.0:${port}${UNDERLINEOFF}${rs}`);
        });
      } else {
        this.httpServer.listen(port, () => {
          if (this.systemInformation.ipv4Address !== '') this.log.info(`The frontend http server is listening on ${UNDERLINE}http://${this.systemInformation.ipv4Address}:${port}${UNDERLINEOFF}${rs}`);
          if (this.systemInformation.ipv6Address !== '') this.log.info(`The frontend http server is listening on ${UNDERLINE}http://[${this.systemInformation.ipv6Address}]:${port}${UNDERLINEOFF}${rs}`);
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.httpServer.on('error', (error: any) => {
        this.log.error(`Frontend http server error listening on ${port}`);
        switch (error.code) {
          case 'EACCES':
            this.log.error(`Port ${port} requires elevated privileges`);
            break;
          case 'EADDRINUSE':
            this.log.error(`Port ${port} is already in use`);
            break;
        }
        initializeError = true;
        return;
      });
    } else {
      // Load the SSL certificate, the private key and optionally the CA certificate
      let cert: string | undefined;
      try {
        cert = await fs.readFile(path.join(this.matterbridgeDirectory, 'certs/cert.pem'), 'utf8');
        this.log.info(`Loaded certificate file ${path.join(this.matterbridgeDirectory, 'certs/cert.pem')}`);
      } catch (error) {
        this.log.error(`Error reading certificate file ${path.join(this.matterbridgeDirectory, 'certs/cert.pem')}: ${error}`);
        return;
      }
      let key: string | undefined;
      try {
        key = await fs.readFile(path.join(this.matterbridgeDirectory, 'certs/key.pem'), 'utf8');
        this.log.info(`Loaded key file ${path.join(this.matterbridgeDirectory, 'certs/key.pem')}`);
      } catch (error) {
        this.log.error(`Error reading key file ${path.join(this.matterbridgeDirectory, 'certs/key.pem')}: ${error}`);
        return;
      }
      let ca: string | undefined;
      try {
        ca = await fs.readFile(path.join(this.matterbridgeDirectory, 'certs/ca.pem'), 'utf8');
        this.log.info(`Loaded CA certificate file ${path.join(this.matterbridgeDirectory, 'certs/ca.pem')}`);
      } catch (error) {
        this.log.info(`CA certificate file ${path.join(this.matterbridgeDirectory, 'certs/ca.pem')} not loaded: ${error}`);
      }
      const serverOptions: https.ServerOptions = { cert, key, ca };

      // Create an HTTPS server with the SSL certificate and private key (ca is optional) and attach the express app
      this.httpsServer = https.createServer(serverOptions, this.expressApp);

      // Listen on the specified port
      if (hasParameter('ingress')) {
        this.httpsServer.listen(port, '0.0.0.0', () => {
          this.log.info(`The frontend https server is listening on ${UNDERLINE}https://0.0.0.0:${port}${UNDERLINEOFF}${rs}`);
        });
      } else {
        this.httpsServer.listen(port, () => {
          if (this.systemInformation.ipv4Address !== '') this.log.info(`The frontend https server is listening on ${UNDERLINE}https://${this.systemInformation.ipv4Address}:${port}${UNDERLINEOFF}${rs}`);
          if (this.systemInformation.ipv6Address !== '') this.log.info(`The frontend https server is listening on ${UNDERLINE}https://[${this.systemInformation.ipv6Address}]:${port}${UNDERLINEOFF}${rs}`);
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.httpsServer.on('error', (error: any) => {
        this.log.error(`Frontend https server error listening on ${port}`);
        switch (error.code) {
          case 'EACCES':
            this.log.error(`Port ${port} requires elevated privileges`);
            break;
          case 'EADDRINUSE':
            this.log.error(`Port ${port} is already in use`);
            break;
        }
        initializeError = true;
        return;
      });
    }

    if (initializeError) return;

    // Createe a WebSocket server and attach it to the http server
    const wssPort = port;
    const wssHost = hasParameter('ssl') ? `wss://${this.systemInformation.ipv4Address}:${wssPort}` : `ws://${this.systemInformation.ipv4Address}:${wssPort}`;
    this.webSocketServer = new WebSocketServer(hasParameter('ssl') ? { server: this.httpsServer } : { server: this.httpServer });

    this.webSocketServer.on('connection', (ws: WebSocket, request: http.IncomingMessage) => {
      const clientIp = request.socket.remoteAddress;
      AnsiLogger.setGlobalCallback(this.wssSendMessage.bind(this), LogLevel.DEBUG);
      this.log.info(`WebSocketServer client "${clientIp}" connected to Matterbridge`);

      ws.on('message', (message) => {
        this.log.debug(`WebSocket client message: ${message}`);
      });

      ws.on('close', () => {
        this.log.info('WebSocket client disconnected');
        if (this.webSocketServer?.clients.size === 0) {
          AnsiLogger.setGlobalCallback(undefined);
          this.log.debug('All WebSocket clients disconnected. WebSocketServer logger global callback removed');
        }
      });

      ws.on('error', (error: Error) => {
        this.log.error(`WebSocket client error: ${error}`);
      });
    });

    this.webSocketServer.on('close', () => {
      this.log.debug(`WebSocketServer closed`);
    });

    this.webSocketServer.on('listening', () => {
      this.log.info(`The WebSocketServer is listening on ${UNDERLINE}${wssHost}${UNDERLINEOFF}${rs}`);
    });

    this.webSocketServer.on('error', (ws: WebSocket, error: Error) => {
      this.log.error(`WebSocketServer error: ${error}`);
    });

    // Endpoint to validate login code
    this.expressApp.post('/api/login', express.json(), async (req, res) => {
      const { password } = req.body;
      this.log.debug('The frontend sent /api/login', password);
      if (!this.nodeContext) {
        this.log.error('/api/login nodeContext not found');
        res.json({ valid: false });
        return;
      }
      try {
        const storedPassword = await this.nodeContext.get('password', '');
        if (storedPassword === '' || password === storedPassword) {
          this.log.debug('/api/login password valid');
          res.json({ valid: true });
        } else {
          this.log.warn('/api/login error wrong password');
          res.json({ valid: false });
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        this.log.error('/api/login error getting password');
        res.json({ valid: false });
      }
    });

    // Endpoint to provide settings
    this.expressApp.get('/api/settings', express.json(), async (req, res) => {
      this.log.debug('The frontend sent /api/settings');
      this.matterbridgeInformation.bridgeMode = this.bridgeMode;
      this.matterbridgeInformation.restartMode = this.restartMode;
      this.matterbridgeInformation.loggerLevel = this.log.logLevel;
      this.matterbridgeInformation.matterLoggerLevel = Logger.defaultLogLevel;
      this.matterbridgeInformation.mattermdnsinterface = (await this.nodeContext?.get<string>('mattermdnsinterface', '')) || '';
      this.matterbridgeInformation.matteripv4address = (await this.nodeContext?.get<string>('matteripv4address', '')) || '';
      this.matterbridgeInformation.matteripv6address = (await this.nodeContext?.get<string>('matteripv6address', '')) || '';
      this.matterbridgeInformation.matterbridgePaired = this.matterbridgePaired;
      this.matterbridgeInformation.matterbridgeConnected = this.matterbridgeConnected;
      this.matterbridgeInformation.matterbridgeQrPairingCode = this.matterbridgeQrPairingCode;
      this.matterbridgeInformation.matterbridgeManualPairingCode = this.matterbridgeManualPairingCode;
      this.matterbridgeInformation.matterbridgeFabricInformations = this.matterbridgeFabricInformations;
      // this.matterbridgeInformation.matterbridgeSessionInformations = this.matterbridgeSessionInformations;
      this.matterbridgeInformation.matterbridgeSessionInformations = Array.from(this.matterbridgeSessionInformations.values());
      // console.log('this.matterbridgeSessionInformations:', this.matterbridgeSessionInformations);
      if (this.profile) this.matterbridgeInformation.profile = this.profile;
      // const response = { wssHost, ssl: hasParameter('ssl'), qrPairingCode, manualPairingCode, systemInformation: this.systemInformation, matterbridgeInformation: this.matterbridgeInformation };
      const response = { wssHost, ssl: hasParameter('ssl'), systemInformation: this.systemInformation, matterbridgeInformation: this.matterbridgeInformation };
      // this.log.debug('Response:', debugStringify(response));
      res.json(response);
    });

    // Endpoint to provide plugins
    this.expressApp.get('/api/plugins', async (req, res) => {
      this.log.debug('The frontend sent /api/plugins');
      const response = await this.getBaseRegisteredPlugins();
      // this.log.debug('Response:', debugStringify(response));
      res.json(response);
    });

    // Endpoint to provide devices
    this.expressApp.get('/api/devices', (req, res) => {
      this.log.debug('The frontend sent /api/devices');
      const data: { pluginName: string; type: string; endpoint: EndpointNumber | undefined; name: string; serial: string; uniqueId: string; cluster: string }[] = [];
      this.registeredDevices.forEach((registeredDevice) => {
        let name = registeredDevice.device.getClusterServer(BasicInformationCluster)?.attributes.nodeLabel?.getLocal();
        if (!name) name = registeredDevice.device.getClusterServer(BridgedDeviceBasicInformationCluster)?.attributes.nodeLabel?.getLocal() ?? 'Unknown';
        let serial = registeredDevice.device.getClusterServer(BasicInformationCluster)?.attributes.serialNumber?.getLocal();
        if (!serial) serial = registeredDevice.device.getClusterServer(BridgedDeviceBasicInformationCluster)?.attributes.serialNumber?.getLocal() ?? 'Unknown';
        let uniqueId = registeredDevice.device.getClusterServer(BasicInformationCluster)?.attributes.uniqueId?.getLocal();
        if (!uniqueId) uniqueId = registeredDevice.device.getClusterServer(BridgedDeviceBasicInformationCluster)?.attributes.uniqueId?.getLocal() ?? 'Unknown';
        const cluster = this.getClusterTextFromDevice(registeredDevice.device);
        data.push({
          pluginName: registeredDevice.plugin,
          type: registeredDevice.device.name + ' (0x' + registeredDevice.device.deviceType.toString(16).padStart(4, '0') + ')',
          endpoint: registeredDevice.device.number,
          name,
          serial,
          uniqueId,
          cluster: cluster,
        });
      });
      // this.log.debug('Response:', debugStringify(data));
      res.json(data);
    });

    // Endpoint to provide the cluster servers of the devices
    this.expressApp.get('/api/devices_clusters/:selectedPluginName/:selectedDeviceEndpoint', (req, res) => {
      const selectedPluginName = req.params.selectedPluginName;
      const selectedDeviceEndpoint: number = parseInt(req.params.selectedDeviceEndpoint, 10);
      this.log.debug(`The frontend sent /api/devices_clusters plugin:${selectedPluginName} endpoint:${selectedDeviceEndpoint}`);
      if (selectedPluginName === 'none') {
        res.json([]);
        return;
      }
      const data: { endpoint: string; clusterName: string; clusterId: string; attributeName: string; attributeId: string; attributeValue: string }[] = [];
      this.registeredDevices.forEach((registeredDevice) => {
        if (registeredDevice.plugin === selectedPluginName && registeredDevice.device.number === selectedDeviceEndpoint) {
          const clusterServers = registeredDevice.device.getAllClusterServers();
          clusterServers.forEach((clusterServer) => {
            Object.entries(clusterServer.attributes).forEach(([key, value]) => {
              if (clusterServer.name === 'EveHistory') return;
              // this.log.debug(`***--clusterServer: ${clusterServer.name}(${clusterServer.id}) attribute:${key}(${value.id}) ${value.isFixed} ${value.isWritable} ${value.isWritable}`);
              let attributeValue;
              try {
                if (typeof value.getLocal() === 'object') attributeValue = stringify(value.getLocal());
                else attributeValue = value.getLocal().toString();
              } catch (error) {
                attributeValue = 'Unavailable';
                this.log.debug(`GetLocal value ${error} in clusterServer: ${clusterServer.name}(${clusterServer.id}) attribute: ${key}(${value.id})`);
                // console.log(error);
              }
              data.push({
                endpoint: registeredDevice.device.number ? registeredDevice.device.number.toString() : '...',
                clusterName: clusterServer.name,
                clusterId: '0x' + clusterServer.id.toString(16).padStart(2, '0'),
                attributeName: key,
                attributeId: '0x' + value.id.toString(16).padStart(2, '0'),
                attributeValue,
              });
            });
          });
          registeredDevice.device.getChildEndpoints().forEach((childEndpoint) => {
            const name = registeredDevice.device.getChildEndpointName(childEndpoint);
            const clusterServers = childEndpoint.getAllClusterServers();
            clusterServers.forEach((clusterServer) => {
              Object.entries(clusterServer.attributes).forEach(([key, value]) => {
                if (clusterServer.name === 'EveHistory') return;
                // this.log.debug(`***--clusterServer: ${clusterServer.name}(${clusterServer.id}) attribute:${key}(${value.id}) ${value.isFixed} ${value.isWritable} ${value.isWritable}`);
                let attributeValue;
                try {
                  if (typeof value.getLocal() === 'object') attributeValue = stringify(value.getLocal());
                  else attributeValue = value.getLocal().toString();
                } catch (error) {
                  attributeValue = 'Unavailable';
                  this.log.debug(`GetLocal error ${error} in clusterServer: ${clusterServer.name}(${clusterServer.id}) attribute: ${key}(${value.id})`);
                  // console.log(error);
                }
                data.push({
                  endpoint: (childEndpoint.number ? childEndpoint.number.toString() : '...') + (name ? ' (' + name + ')' : ''),
                  clusterName: clusterServer.name,
                  clusterId: '0x' + clusterServer.id.toString(16).padStart(2, '0'),
                  attributeName: key,
                  attributeId: '0x' + value.id.toString(16).padStart(2, '0'),
                  attributeValue,
                });
              });
            });
          });
        }
      });
      res.json(data);
    });

    // Endpoint to send the log
    this.expressApp.get('/api/view-log', async (req, res) => {
      this.log.debug('The frontend sent /api/log');
      try {
        const data = await fs.readFile(path.join(this.matterbridgeDirectory, this.matterbrideLoggerFile), 'utf8');
        res.type('text/plain');
        res.send(data);
      } catch (error) {
        this.log.error(`Error reading log file ${this.matterbrideLoggerFile}: ${error instanceof Error ? error.message : error}`);
        res.status(500).send('Error reading log file');
      }
    });

    // Endpoint to download the matterbridge log
    this.expressApp.get('/api/download-mblog', async (req, res) => {
      this.log.debug('The frontend sent /api/download-mblog');
      try {
        await fs.access(path.join(this.matterbridgeDirectory, this.matterbrideLoggerFile), fs.constants.F_OK);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        fs.appendFile(path.join(this.matterbridgeDirectory, this.matterbrideLoggerFile), 'Enable the log on file in the settings to enable the file logger');
      }
      res.download(path.join(this.matterbridgeDirectory, this.matterbrideLoggerFile), 'matterbridge.log', (error) => {
        if (error) {
          this.log.error(`Error downloading log file ${this.matterbrideLoggerFile}: ${error instanceof Error ? error.message : error}`);
          res.status(500).send('Error downloading the matterbridge log file');
        }
      });
    });

    // Endpoint to download the matter log
    this.expressApp.get('/api/download-mjlog', async (req, res) => {
      this.log.debug('The frontend sent /api/download-mjlog');
      try {
        await fs.access(path.join(this.matterbridgeDirectory, this.matterLoggerFile), fs.constants.F_OK);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        fs.appendFile(path.join(this.matterbridgeDirectory, this.matterLoggerFile), 'Enable the log on file in the settings to enable the file logger');
      }
      res.download(path.join(this.matterbridgeDirectory, this.matterLoggerFile), 'matter.log', (error) => {
        if (error) {
          this.log.error(`Error downloading log file ${this.matterLoggerFile}: ${error instanceof Error ? error.message : error}`);
          res.status(500).send('Error downloading the matter log file');
        }
      });
    });

    // Endpoint to download the matter storage file
    this.expressApp.get('/api/download-mjstorage', (req, res) => {
      this.log.debug('The frontend sent /api/download-mjstorage');
      res.download(path.join(this.matterbridgeDirectory, this.matterStorageName), 'matterbridge.json', (error) => {
        if (error) {
          this.log.error(`Error downloading log file ${this.matterStorageName}: ${error instanceof Error ? error.message : error}`);
          res.status(500).send('Error downloading the matter storage file');
        }
      });
    });

    // Endpoint to download the matterbridge storage directory
    this.expressApp.get('/api/download-mbstorage', async (req, res) => {
      this.log.debug('The frontend sent /api/download-mbstorage');
      await createZip(path.join(os.tmpdir(), `matterbridge.${this.nodeStorageName}.zip`), path.join(this.matterbridgeDirectory, this.nodeStorageName));
      res.download(path.join(os.tmpdir(), `matterbridge.${this.nodeStorageName}.zip`), `matterbridge.${this.nodeStorageName}.zip`, (error) => {
        if (error) {
          this.log.error(`Error downloading file ${`matterbridge.${this.nodeStorageName}.zip`}: ${error instanceof Error ? error.message : error}`);
          res.status(500).send('Error downloading the matterbridge storage file');
        }
      });
    });

    // Endpoint to download the matterbridge plugin directory
    this.expressApp.get('/api/download-pluginstorage', async (req, res) => {
      this.log.debug('The frontend sent /api/download-pluginstorage');
      await createZip(path.join(os.tmpdir(), `matterbridge.pluginstorage.zip`), this.matterbridgePluginDirectory);
      res.download(path.join(os.tmpdir(), `matterbridge.pluginstorage.zip`), `matterbridge.pluginstorage.zip`, (error) => {
        if (error) {
          this.log.error(`Error downloading file matterbridge.pluginstorage.zip: ${error instanceof Error ? error.message : error}`);
          res.status(500).send('Error downloading the matterbridge plugin storage file');
        }
      });
    });

    // Endpoint to download the matterbridge plugin config files
    this.expressApp.get('/api/download-pluginconfig', async (req, res) => {
      this.log.debug('The frontend sent /api/download-pluginconfig');
      await createZip(path.join(os.tmpdir(), `matterbridge.pluginconfig.zip`), path.relative(process.cwd(), path.join(this.matterbridgeDirectory, '*.config.json')));
      // await createZip(path.join(os.tmpdir(), `matterbridge.pluginconfig.zip`), path.relative(process.cwd(), path.join(this.matterbridgeDirectory, 'certs', '*.*')), path.relative(process.cwd(), path.join(this.matterbridgeDirectory, '*.config.json')));
      res.download(path.join(os.tmpdir(), `matterbridge.pluginconfig.zip`), `matterbridge.pluginconfig.zip`, (error) => {
        if (error) {
          this.log.error(`Error downloading file matterbridge.pluginstorage.zip: ${error instanceof Error ? error.message : error}`);
          res.status(500).send('Error downloading the matterbridge plugin storage file');
        }
      });
    });

    // Endpoint to download the matterbridge plugin config files
    this.expressApp.get('/api/download-backup', async (req, res) => {
      this.log.debug('The frontend sent /api/download-backup');
      res.download(path.join(os.tmpdir(), `matterbridge.backup.zip`), `matterbridge.backup.zip`, (error) => {
        if (error) {
          this.log.error(`Error downloading file matterbridge.backup.zip: ${error instanceof Error ? error.message : error}`);
          res.status(500).send(`Error downloading file matterbridge.backup.zip: ${error instanceof Error ? error.message : error}`);
        }
      });
    });

    // Endpoint to receive commands
    this.expressApp.post('/api/command/:command/:param', express.json(), async (req, res) => {
      const command = req.params.command;
      let param = req.params.param;
      this.log.debug(`The frontend sent /api/command/${command}/${param}`);

      if (!command) {
        res.status(400).json({ error: 'No command provided' });
        return;
      }

      this.log.debug(`Received frontend command: ${command}:${param}`);

      // Handle the command setpassword from Settings
      if (command === 'setpassword') {
        const password = param.slice(1, -1); // Remove the first and last characters
        this.log.debug('setpassword', param, password);
        await this.nodeContext?.set('password', password);
        res.json({ message: 'Command received' });
        return;
      }

      // Handle the command setbridgemode from Settings
      if (command === 'setbridgemode') {
        this.log.debug(`setbridgemode: ${param}`);
        this.matterbridgeInformation.restartRequired = true;
        await this.nodeContext?.set('bridgeMode', param);
        res.json({ message: 'Command received' });
        return;
      }

      // Handle the command backup from Settings
      if (command === 'backup') {
        this.log.notice(`Prepairing the backup...`);
        await createZip(path.join(os.tmpdir(), `matterbridge.backup.zip`), path.join(this.matterbridgeDirectory), path.join(this.matterbridgePluginDirectory));
        this.log.notice(`Backup ready to be downloaded.`);
        res.json({ message: 'Command received' });
        return;
      }

      // Handle the command setmbloglevel from Settings
      if (command === 'setmbloglevel') {
        this.log.debug('Matterbridge log level:', param);
        if (param === 'Debug') {
          this.log.logLevel = LogLevel.DEBUG;
        } else if (param === 'Info') {
          this.log.logLevel = LogLevel.INFO;
        } else if (param === 'Notice') {
          this.log.logLevel = LogLevel.NOTICE;
        } else if (param === 'Warn') {
          this.log.logLevel = LogLevel.WARN;
        } else if (param === 'Error') {
          this.log.logLevel = LogLevel.ERROR;
        } else if (param === 'Fatal') {
          this.log.logLevel = LogLevel.FATAL;
        }
        await this.nodeContext?.set('matterbridgeLogLevel', this.log.logLevel);
        MatterbridgeDevice.logLevel = this.log.logLevel;
        this.plugins.logLevel = this.log.logLevel;
        for (const plugin of this.plugins) {
          if (!plugin.platform || !plugin.platform.config) continue;
          plugin.platform.log.logLevel = (plugin.platform.config.debug as boolean) ? LogLevel.DEBUG : this.log.logLevel;
          await plugin.platform.onChangeLoggerLevel((plugin.platform.config.debug as boolean) ? LogLevel.DEBUG : this.log.logLevel);
        }
        res.json({ message: 'Command received' });
        return;
      }

      // Handle the command setmbloglevel from Settings
      if (command === 'setmjloglevel') {
        this.log.debug('Matter.js log level:', param);
        if (param === 'Debug') {
          Logger.defaultLogLevel = Level.DEBUG;
        } else if (param === 'Info') {
          Logger.defaultLogLevel = Level.INFO;
        } else if (param === 'Notice') {
          Logger.defaultLogLevel = Level.NOTICE;
        } else if (param === 'Warn') {
          Logger.defaultLogLevel = Level.WARN;
        } else if (param === 'Error') {
          Logger.defaultLogLevel = Level.ERROR;
        } else if (param === 'Fatal') {
          Logger.defaultLogLevel = Level.FATAL;
        }
        await this.nodeContext?.set('matterLogLevel', Logger.defaultLogLevel);
        res.json({ message: 'Command received' });
        return;
      }

      // Handle the command setmdnsinterface from Settings
      if (command === 'setmdnsinterface') {
        param = param.slice(1, -1); // Remove the first and last characters *mdns*
        this.matterbridgeInformation.mattermdnsinterface = param;
        this.log.debug('Matter.js mdns interface:', param === '' ? 'All interfaces' : param);
        await this.nodeContext?.set('mattermdnsinterface', param);
        res.json({ message: 'Command received' });
        return;
      }

      // Handle the command setipv4address from Settings
      if (command === 'setipv4address') {
        param = param.slice(1, -1); // Remove the first and last characters *ip*
        this.matterbridgeInformation.matteripv4address = param;
        this.log.debug('Matter.js ipv4 address:', param === '' ? 'All ipv4 addresses' : param);
        await this.nodeContext?.set('matteripv4address', param);
        res.json({ message: 'Command received' });
        return;
      }

      // Handle the command setipv6address from Settings
      if (command === 'setipv6address') {
        param = param.slice(1, -1); // Remove the first and last characters *ip*
        this.matterbridgeInformation.matteripv6address = param;
        this.log.debug('Matter.js ipv6 address:', param === '' ? 'All ipv6 addresses' : param);
        await this.nodeContext?.set('matteripv6address', param);
        res.json({ message: 'Command received' });
        return;
      }

      // Handle the command setmbloglevel from Settings
      if (command === 'setmblogfile') {
        this.log.debug('Matterbridge file log:', param);
        this.matterbridgeInformation.fileLogger = param === 'true';
        await this.nodeContext?.set('matterbridgeFileLog', param === 'true');
        // Create the file logger for matterbridge
        if (param === 'true') AnsiLogger.setGlobalLogfile(path.join(this.matterbridgeDirectory, this.matterbrideLoggerFile), LogLevel.DEBUG, true);
        else AnsiLogger.setGlobalLogfile(undefined);
        res.json({ message: 'Command received' });
        return;
      }

      // Handle the command setmbloglevel from Settings
      if (command === 'setmjlogfile') {
        this.log.debug('Matter file log:', param);
        this.matterbridgeInformation.matterFileLogger = param === 'true';
        await this.nodeContext?.set('matterFileLog', param === 'true');
        if (param === 'true') {
          try {
            Logger.addLogger('matterfilelogger', await this.createMatterFileLogger(path.join(this.matterbridgeDirectory, this.matterLoggerFile), true), {
              defaultLogLevel: Level.DEBUG,
              logFormat: Format.PLAIN,
            });
          } catch (error) {
            this.log.debug(`Error adding the matterfilelogger for file ${CYAN}${path.join(this.matterbridgeDirectory, this.matterLoggerFile)}${er}: ${error instanceof Error ? error.message : error}`);
          }
        } else {
          try {
            Logger.removeLogger('matterfilelogger');
          } catch (error) {
            this.log.debug(`Error removing the matterfilelogger for file ${CYAN}${path.join(this.matterbridgeDirectory, this.matterLoggerFile)}${er}: ${error instanceof Error ? error.message : error}`);
          }
        }

        res.json({ message: 'Command received' });
        return;
      }

      // Handle the command unregister from Settings
      if (command === 'unregister') {
        await this.unregisterAndShutdownProcess();
        res.json({ message: 'Command received' });
        return;
      }
      // Handle the command reset from Settings
      if (command === 'reset') {
        await this.shutdownProcessAndReset();
        res.json({ message: 'Command received' });
        return;
      }
      // Handle the command factoryreset from Settings
      if (command === 'factoryreset') {
        await this.shutdownProcessAndFactoryReset();
        res.json({ message: 'Command received' });
        return;
      }
      // Handle the command shutdown from Header
      if (command === 'shutdown') {
        await this.shutdownProcess();
        res.json({ message: 'Command received' });
        return;
      }
      // Handle the command restart from Header
      if (command === 'restart') {
        await this.restartProcess();
        res.json({ message: 'Command received' });
        return;
      }
      // Handle the command update from Header
      if (command === 'update') {
        this.log.info('Updating matterbridge...');
        try {
          await this.spawnCommand('npm', ['install', '-g', 'matterbridge', '--verbose']);
          this.log.info('Matterbridge has been updated. Full restart required.');
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
          this.log.error('Error updating matterbridge');
        }
        await this.updateProcess();
        this.matterbridgeInformation.restartRequired = true;
        res.json({ message: 'Command received' });
        return;
      }
      // Handle the command saveconfig from Home
      if (command === 'saveconfig') {
        param = param.replace(/\*/g, '\\');
        this.log.info(`Saving config for plugin ${plg}${param}${nf}...`);
        // console.log('Req.body:', JSON.stringify(req.body, null, 2));

        if (!this.plugins.has(param)) {
          this.log.warn(`Plugin ${plg}${param}${wr} not found in matterbridge`);
        } else {
          const plugin = this.plugins.get(param);
          if (!plugin) return;
          this.plugins.saveConfigFromJson(plugin, req.body);
        }
        this.matterbridgeInformation.restartRequired = true;
        res.json({ message: 'Command received' });
        return;
      }

      // Handle the command installplugin from Home
      if (command === 'installplugin') {
        param = param.replace(/\*/g, '\\');
        this.log.info(`Installing plugin ${plg}${param}${nf}...`);
        try {
          await this.spawnCommand('npm', ['install', '-g', param, '--verbose']);
          this.log.info(`Plugin ${plg}${param}${nf} installed. Full restart required.`);
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
          this.log.error(`Error installing plugin ${plg}${param}${er}`);
        }
        this.matterbridgeInformation.restartRequired = true;
        // Also add the plugin to matterbridge so no return!
        // res.json({ message: 'Command received' });
        // return;
      }
      // Handle the command addplugin from Home
      if (command === 'addplugin' || command === 'installplugin') {
        param = param.replace(/\*/g, '\\');
        const plugin = await this.plugins.add(param);
        if (plugin) {
          this.plugins.load(plugin, true, 'The plugin has been added', true); // No await do it in the background
        }
        res.json({ message: 'Command received' });
        return;
      }
      // Handle the command removeplugin from Home
      if (command === 'removeplugin') {
        if (!this.plugins.has(param)) {
          this.log.warn(`Plugin ${plg}${param}${wr} not found in matterbridge`);
        } else {
          const plugin = this.plugins.get(param) as RegisteredPlugin;
          await this.plugins.shutdown(plugin, 'The plugin has been removed.', true);
          await this.plugins.remove(param);
        }
        res.json({ message: 'Command received' });
        return;
      }
      // Handle the command enableplugin from Home
      if (command === 'enableplugin') {
        if (!this.plugins.has(param)) {
          this.log.warn(`Plugin ${plg}${param}${wr} not found in matterbridge`);
        } else {
          const plugin = this.plugins.get(param);
          if (plugin && !plugin.enabled) {
            plugin.locked = undefined;
            plugin.error = undefined;
            plugin.loaded = undefined;
            plugin.started = undefined;
            plugin.configured = undefined;
            plugin.connected = undefined;
            plugin.platform = undefined;
            plugin.registeredDevices = undefined;
            plugin.addedDevices = undefined;
            await this.plugins.enable(param);
            this.plugins.load(plugin, true, 'The plugin has been enabled', true); // No await do it in the background
          }
        }
        res.json({ message: 'Command received' });
        return;
      }
      // Handle the command disableplugin from Home
      if (command === 'disableplugin') {
        if (!this.plugins.has(param)) {
          this.log.warn(`Plugin ${plg}${param}${wr} not found in matterbridge`);
        } else {
          const plugin = this.plugins.get(param);
          if (plugin && plugin.enabled) {
            await this.plugins.shutdown(plugin, 'The plugin has been disabled.', true);
            await this.plugins.disable(param);
          }
        }
        res.json({ message: 'Command received' });
        return;
      }
    });

    // Fallback for routing (must be the last route)
    this.expressApp.get('*', (req, res) => {
      this.log.debug('The frontend sent:', req.url);
      this.log.debug('Response send file:', path.join(this.rootDirectory, 'frontend/build/index.html'));
      res.sendFile(path.join(this.rootDirectory, 'frontend/build/index.html'));
    });

    this.log.debug(`Frontend initialized on port ${YELLOW}${port}${db} static ${UNDERLINE}${path.join(this.rootDirectory, 'frontend/build')}${UNDERLINEOFF}${rs}`);
  }

  /**
   * Retrieves the cluster text description from a given device.
   * @param {MatterbridgeDevice} device - The MatterbridgeDevice object.
   * @returns {string} The attributes description of the cluster servers in the device.
   */
  private getClusterTextFromDevice(device: MatterbridgeDevice): string {
    const stringifyFixedLabel = (endpoint: Endpoint) => {
      const labelList = endpoint.getClusterServer(FixedLabelCluster)?.getLabelListAttribute();
      if (!labelList) return;
      const composed = labelList.find((entry) => entry.label === 'composed');
      if (composed) return 'Composed: ' + composed.value;
      else return ''; // 'FixedLabel: ' + labelList.map((entry) => entry.label + ': ' + entry.value).join(' ');
    };

    let attributes = '';
    // this.log.debug(`getClusterTextFromDevice: ${device.name}`);
    const clusterServers = device.getAllClusterServers();
    clusterServers.forEach((clusterServer) => {
      try {
        // this.log.debug(`***--clusterServer: ${clusterServer.id} (${clusterServer.name})`);
        if (clusterServer.name === 'OnOff') attributes += `OnOff: ${clusterServer.getOnOffAttribute()} `;
        if (clusterServer.name === 'Switch') attributes += `Position: ${clusterServer.getCurrentPositionAttribute()} `;
        if (clusterServer.name === 'WindowCovering') attributes += `Cover position: ${clusterServer.attributes.currentPositionLiftPercent100ths.getLocal() / 100}% `;
        if (clusterServer.name === 'DoorLock') attributes += `State: ${clusterServer.attributes.lockState.getLocal() === 1 ? 'Locked' : 'Not locked'} `;
        if (clusterServer.name === 'Thermostat') attributes += `Temperature: ${clusterServer.attributes.localTemperature.getLocal() / 100}°C `;
        if (clusterServer.name === 'LevelControl') attributes += `Level: ${clusterServer.getCurrentLevelAttribute()}% `;
        if (clusterServer.name === 'ColorControl' && clusterServer.isAttributeSupportedByName('currentX')) attributes += `X: ${Math.round(clusterServer.getCurrentXAttribute())} Y: ${Math.round(clusterServer.getCurrentYAttribute())} `;
        if (clusterServer.name === 'ColorControl' && clusterServer.isAttributeSupportedByName('currentHue'))
          attributes += `Hue: ${Math.round(clusterServer.getCurrentHueAttribute())} Saturation: ${Math.round(clusterServer.getCurrentSaturationAttribute())}% `;
        if (clusterServer.name === 'ColorControl' && clusterServer.isAttributeSupportedByName('colorTemperatureMireds')) attributes += `ColorTemp: ${Math.round(clusterServer.getColorTemperatureMiredsAttribute())} `;
        if (clusterServer.name === 'BooleanState') attributes += `Contact: ${clusterServer.getStateValueAttribute()} `;

        if (clusterServer.name === 'BooleanStateConfiguration' && clusterServer.isAttributeSupportedByName('alarmsActive')) attributes += `Active alarms: ${stringify(clusterServer.getAlarmsActiveAttribute())} `;

        if (clusterServer.name === 'SmokeCoAlarm' && clusterServer.isAttributeSupportedByName('smokeState')) attributes += `Smoke: ${clusterServer.getSmokeStateAttribute()} `;
        if (clusterServer.name === 'SmokeCoAlarm' && clusterServer.isAttributeSupportedByName('coState')) attributes += `Co: ${clusterServer.getCoStateAttribute()} `;

        if (clusterServer.name === 'FanControl') attributes += `Mode: ${clusterServer.getFanModeAttribute()} Speed: ${clusterServer.getPercentCurrentAttribute()} `;
        if (clusterServer.name === 'FanControl' && clusterServer.isAttributeSupportedByName('speedCurrent')) attributes += `MultiSpeed: ${clusterServer.getSpeedCurrentAttribute()} `;

        if (clusterServer.name === 'OccupancySensing') attributes += `Occupancy: ${clusterServer.getOccupancyAttribute().occupied} `;
        if (clusterServer.name === 'IlluminanceMeasurement') attributes += `Illuminance: ${clusterServer.getMeasuredValueAttribute()} `;
        if (clusterServer.name === 'AirQuality') attributes += `Air quality: ${clusterServer.getAirQualityAttribute()} `;
        if (clusterServer.name === 'TvocMeasurement') attributes += `Voc: ${clusterServer.getMeasuredValueAttribute()} `;
        if (clusterServer.name === 'TemperatureMeasurement') attributes += `Temperature: ${clusterServer.getMeasuredValueAttribute() / 100}°C `;
        if (clusterServer.name === 'RelativeHumidityMeasurement') attributes += `Humidity: ${clusterServer.getMeasuredValueAttribute() / 100}% `;
        if (clusterServer.name === 'PressureMeasurement') attributes += `Pressure: ${clusterServer.getMeasuredValueAttribute()} `;
        if (clusterServer.name === 'FlowMeasurement') attributes += `Flow: ${clusterServer.getMeasuredValueAttribute()} `;
        if (clusterServer.name === 'FixedLabel') attributes += `${stringifyFixedLabel(device)} `;
      } catch (error) {
        this.log.error(`getClusterTextFromDevice with ${clusterServer.name} error: ${error}`);
      }
    });
    return attributes;
  }

  /**
   * Initializes the Matterbridge instance as extension for zigbee2mqtt.
   * @deprecated This method is deprecated and will be removed in a future version.
   *
   * @returns A Promise that resolves when the initialization is complete.
   */
  public async startExtension(dataPath: string, extensionVersion: string, port = 5540): Promise<boolean> {
    // Set the bridge mode
    this.bridgeMode = 'bridge';

    // Set the first port to use
    this.port = port;

    // Set Matterbridge logger
    this.log = new AnsiLogger({ logName: 'Matterbridge', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.INFO });
    this.log.debug('Matterbridge extension is starting...');

    // Initialize NodeStorage
    this.matterbridgeDirectory = dataPath;
    this.log.debug('Creating node storage manager dir: ' + path.join(this.matterbridgeDirectory, 'node_storage'));
    this.nodeStorage = new NodeStorageManager({ dir: path.join(this.matterbridgeDirectory, 'node_storage'), logging: false });
    this.log.debug('Creating node storage context for matterbridge: matterbridge');
    this.nodeContext = await this.nodeStorage.createStorage('matterbridge');

    const plugin: RegisteredPlugin = {
      path: '',
      type: 'DynamicPlatform',
      name: 'MatterbridgeExtension',
      version: '1.0.0',
      description: 'Matterbridge extension',
      author: 'https://github.com/Luligu',
      enabled: false,
      registeredDevices: 0,
      addedDevices: 0,
    };
    this.plugins.set(plugin);
    this.plugins.saveToStorage();

    // Log system info and create .matterbridge directory
    await this.logNodeAndSystemInfo();
    this.matterbridgeDirectory = dataPath;

    // Set matter.js logger level and format
    Logger.defaultLogLevel = Level.INFO;
    Logger.format = Format.ANSI;

    // Start the storage and create matterbridgeContext
    await this.startMatterStorage('json', path.join(this.matterbridgeDirectory, this.matterStorageName));
    if (!this.storageManager) return false;
    this.matterbridgeContext = await this.createCommissioningServerContext('Matterbridge', 'Matterbridge zigbee2MQTT', DeviceTypes.AGGREGATOR.code, 0xfff1, 'Matterbridge', 0x8000, 'zigbee2MQTT Matter extension');
    if (!this.matterbridgeContext) return false;
    await this.matterbridgeContext.set('softwareVersion', 1);
    await this.matterbridgeContext.set('softwareVersionString', this.matterbridgeVersion);
    await this.matterbridgeContext.set('hardwareVersion', 1);
    await this.matterbridgeContext.set('hardwareVersionString', extensionVersion); // Update with the extension version
    this.matterServer = this.createMatterServer(this.storageManager);
    this.log.debug(`Creating commissioning server for ${plg}Matterbridge${db}`);
    this.commissioningServer = await this.createCommisioningServer(this.matterbridgeContext, 'Matterbridge');
    this.log.debug(`Creating matter aggregator for ${plg}Matterbridge${db}`);
    this.matterAggregator = await this.createMatterAggregator(this.matterbridgeContext, 'Matterbridge');
    this.log.debug('Adding matterbridge aggregator to commissioning server');
    this.commissioningServer.addDevice(this.matterAggregator);
    this.log.debug('Adding matterbridge commissioning server to matter server');
    await this.matterServer.addCommissioningServer(this.commissioningServer, { uniqueStorageKey: 'Matterbridge' });
    await this.startMatterServer();
    this.log.info('Matter server started');
    await this.showCommissioningQRCode(this.commissioningServer, this.matterbridgeContext, this.nodeContext, 'Matterbridge');
    // Set reachability to true and trigger event after 60 seconds
    setTimeout(() => {
      this.log.info(`Setting reachability to true for ${plg}Matterbridge${db}`);
      if (this.commissioningServer) this.setCommissioningServerReachability(this.commissioningServer, true);
      if (this.matterAggregator) this.setAggregatorReachability(this.matterAggregator, true);
    }, 60 * 1000);
    return this.commissioningServer.isCommissioned();
  }

  /**
   * Close the Matterbridge instance as extension for zigbee2mqtt.
   * @deprecated This method is deprecated and will be removed in a future version.
   *
   * @returns A Promise that resolves when the initialization is complete.
   */
  public async stopExtension() {
    // Closing matter
    await this.stopMatterServer();

    // Clearing the session manager
    // this.matterbridgeContext?.createContext('SessionManager').clear();

    // Closing storage
    await this.stopMatterStorage();

    this.log.info('Matter server stopped');
  }

  /**
   * Checks if the extension is commissioned.
   * @deprecated This method is deprecated and will be removed in a future version.
   *
   * @returns {boolean} Returns true if the extension is commissioned, false otherwise.
   */
  public isExtensionCommissioned(): boolean {
    if (!this.commissioningServer) return false;
    return this.commissioningServer.isCommissioned();
  }
}
