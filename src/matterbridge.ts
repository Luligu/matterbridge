/**
 * This file contains the class Matterbridge.
 *
 * @file matterbridge.ts
 * @author Luca Liguori
 * @date 2023-12-29
 * @version 1.2.0
 *
 * Copyright 2023, 2024 Luca Liguori.
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

import { MatterbridgeDevice, SerializedMatterbridgeDevice } from './matterbridgeDevice.js';

import { NodeStorageManager, NodeStorage } from 'node-persist-manager';
import { AnsiLogger, BRIGHT, RESET, TimestampFormat, UNDERLINE, UNDERLINEOFF, YELLOW, db, debugStringify, stringify, er, nf, rs, wr, RED, GREEN } from 'node-ansi-logger';
import { fileURLToPath, pathToFileURL } from 'url';
import { promises as fs } from 'fs';
import { ExecException, exec, spawn } from 'child_process';
import { Server } from 'http';
import EventEmitter from 'events';
import express from 'express';
import os from 'os';
import path from 'path';

import { CommissioningController, CommissioningServer, MatterServer, NodeCommissioningOptions } from '@project-chip/matter-node.js';
import {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  BasicInformation,
  BasicInformationCluster,
  BooleanStateCluster,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  BridgedDeviceBasicInformation,
  BridgedDeviceBasicInformationCluster,
  ClusterServer,
  GeneralCommissioning,
  PowerSourceCluster,
  ThreadNetworkDiagnosticsCluster,
  getClusterNameById,
} from '@project-chip/matter-node.js/cluster';
import { DeviceTypeId, EndpointNumber, VendorId } from '@project-chip/matter-node.js/datatype';
import { Aggregator, Device, DeviceTypes, NodeStateInformation } from '@project-chip/matter-node.js/device';
import { Format, Level, Logger } from '@project-chip/matter-node.js/log';
import { ManualPairingCodeCodec, QrCodeSchema } from '@project-chip/matter-node.js/schema';
import { StorageBackendDisk, StorageBackendJsonFile, StorageContext, StorageManager } from '@project-chip/matter-node.js/storage';
import { requireMinNodeVersion, getParameter, getIntParameter, hasParameter } from '@project-chip/matter-node.js/util';
import { CryptoNode } from '@project-chip/matter-node.js/crypto';
import { CommissioningOptions } from '@project-chip/matter-node.js/protocol';

// Define an interface of common elements from MatterbridgeDynamicPlatform and MatterbridgeAccessoryPlatform
interface MatterbridgePlatform {
  onStart(reason?: string): Promise<void>;
  onConfigure(): Promise<void>;
  onShutdown(reason?: string): Promise<void>;
  matterbridge: Matterbridge;
  log: AnsiLogger;
  config: PlatformConfig;
  name: string;
  type: string;
}

// PlatformConfig types
export type PlatformConfigValue = string | number | boolean | bigint | object | undefined | null;

export type PlatformConfig = {
  [key: string]: PlatformConfigValue; // This allows any string as a key, and the value can be ConfigValue.
};

// Define an interface for storing the plugins
interface RegisteredPlugin extends BaseRegisteredPlugin {
  nodeContext?: NodeStorage;
  storageContext?: StorageContext;
  commissioningServer?: CommissioningServer;
  aggregator?: Aggregator;
  platform?: MatterbridgePlatform;
}

// Simplified interface for saving the plugins in node storage
interface BaseRegisteredPlugin {
  path: string;
  type: string;
  name: string;
  version: string;
  description: string;
  author: string;
  error?: boolean;
  enabled?: boolean;
  loaded?: boolean;
  started?: boolean;
  configured?: boolean;
  paired?: boolean;
  connected?: boolean;
  registeredDevices?: number;
  addedDevices?: number;
  qrPairingCode?: string;
  manualPairingCode?: string;
}

// Define an interface for storing the devices
interface RegisteredDevice {
  plugin: string;
  device: MatterbridgeDevice;
  added?: boolean;
}

// Define an interface for storing the system information
interface SystemInformation {
  ipv4Address: string;
  ipv6Address: string;
  nodeVersion: string;
  hostname: string;
  osType: string;
  osRelease: string;
  osPlatform: string;
  osArch: string;
  totalMemory: string;
  freeMemory: string;
  systemUptime: string;
}

const plg = '\u001B[38;5;33m';
const dev = '\u001B[38;5;79m';
const typ = '\u001B[38;5;207m';

/**
 * Represents the Matterbridge application.
 */
export class Matterbridge extends EventEmitter {
  public systemInformation: SystemInformation = {
    ipv4Address: '',
    ipv6Address: '',
    nodeVersion: '',
    hostname: '',
    osType: '',
    osRelease: '',
    osPlatform: '',
    osArch: '',
    totalMemory: '',
    freeMemory: '',
    systemUptime: '',
  };

  public matterbridgeInformation = {
    homeDirectory: '',
    rootDirectory: '',
    matterbridgeDirectory: '',
    matterbridgePluginDirectory: '',
    globalModulesDirectory: '',
    matterbridgeVersion: '',
    matterbridgeLatestVersion: '',
    bridgeMode: '',
    debugEnabled: false,
  };

  public homeDirectory: string = '';
  public rootDirectory: string = '';
  public matterbridgeDirectory: string = '';
  public matterbridgePluginDirectory: string = '';
  public globalModulesDirectory: string = '';
  public matterbridgeVersion: string = '';
  public matterbridgeLatestVersion: string = '';

  public bridgeMode: 'bridge' | 'childbridge' | 'controller' | '' = '';
  public debugEnabled = false;

  private port = 5540;
  private log!: AnsiLogger;
  private hasCleanupStarted = false;
  private registeredPlugins: RegisteredPlugin[] = [];
  private registeredDevices: RegisteredDevice[] = [];
  private nodeStorage: NodeStorageManager | undefined;
  private nodeContext: NodeStorage | undefined;
  private expressApp: express.Express | undefined;
  private expressServer: Server | undefined;

  private storageManager: StorageManager | undefined;
  private matterbridgeContext: StorageContext | undefined;
  private mattercontrollerContext: StorageContext | undefined;

  private matterServer: MatterServer | undefined;
  private matterAggregator: Aggregator | undefined;
  private commissioningServer: CommissioningServer | undefined;
  private commissioningController: CommissioningController | undefined;

  private static instance: Matterbridge | undefined;

  private constructor() {
    super();
    // We load asyncronously
  }

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
      console.log(wr + 'Matterbridge instance does not exists!', initialize ? 'Initializing...' : 'Not initializing...', rs);
      Matterbridge.instance = new Matterbridge();
      if (initialize) await Matterbridge.instance.initialize();
    }
    return Matterbridge.instance;
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
    // Display the help
    if (hasParameter('help')) {
      // eslint-disable-next-line no-console
      console.log(`\nUsage: matterbridge [options]\n
      Options:
      - help:                  show the help
      - bridge:                start Matterbridge in bridge mode
      - childbridge:           start Matterbridge in childbridge mode
      - frontend [port]:       start the frontend on the given port (default 3000)
      - debug:                 enable debug mode (default false)
      - reset:                 remove the commissioning for Matterbridge (bridge mode). Shutdown Matterbridge before using it!
      - factoryreset:          remove all commissioning information and reset all internal storages. Shutdown Matterbridge before using it!
      - list:                  list the registered plugins
      - add [plugin path]:     register the plugin from the given absolute or relative path
      - add [plugin name]:     register the globally installed plugin with the given name
      - remove [plugin path]:  remove the plugin from the given absolute or relative path
      - remove [plugin name]:  remove the globally installed plugin with the given name
      - enable [plugin path]:  enable the plugin from the given absolute or relative path
      - enable [plugin name]:  enable the globally installed plugin with the given name
      - disable [plugin path]: disable the plugin from the given absolute or relative path
      - disable [plugin name]: disable the globally installed plugin with the given name
      - reset [plugin path]:   remove the commissioning for the plugin from the given absolute or relative path (childbridge mode). Shutdown Matterbridge before using it!
      - reset [plugin name]:   remove the commissioning for the globally installed plugin (childbridge mode). Shutdown Matterbridge before using it!\n`);
      process.exit(0);
    }

    // Set the first port to use
    this.port = getIntParameter('port') ?? 5540;

    // Set Matterbridge logger
    if (hasParameter('debug')) this.debugEnabled = true;
    this.log = new AnsiLogger({ logName: 'Matterbridge', logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: this.debugEnabled });
    this.log.debug('Matterbridge is starting...');

    // Initialize NodeStorage
    this.homeDirectory = os.homedir();
    this.matterbridgeDirectory = path.join(this.homeDirectory, '.matterbridge');
    this.log.debug('Creating node storage manager');
    this.nodeStorage = new NodeStorageManager({ dir: path.join(this.matterbridgeDirectory, 'storage'), logging: false });
    this.log.debug('Creating node storage context for matterbridge');
    this.nodeContext = await this.nodeStorage.createStorage('matterbridge');

    // Get the plugins from node storage
    this.registeredPlugins = await this.nodeContext.get<RegisteredPlugin[]>('plugins', []);
    for (const plugin of this.registeredPlugins) {
      this.log.debug(`Creating node storage context for plugin ${plugin.name}`);
      plugin.nodeContext = await this.nodeStorage.createStorage(plugin.name);
      await plugin.nodeContext.set<string>('name', plugin.name);
      await plugin.nodeContext.set<string>('type', plugin.type);
      await plugin.nodeContext.set<string>('path', plugin.path);
      await plugin.nodeContext.set<string>('version', plugin.version);
      await plugin.nodeContext.set<string>('description', plugin.description);
      await plugin.nodeContext.set<string>('author', plugin.author);
    }
    if (hasParameter('logstorage')) {
      await this.nodeContext.logStorage();
      for (const plugin of this.registeredPlugins) {
        await plugin.nodeContext?.logStorage();
      }
    }

    // Log system info and create .matterbridge directory
    await this.logNodeAndSystemInfo();
    this.log.info(
      // eslint-disable-next-line max-len
      `Matterbridge version ${this.matterbridgeVersion} mode ${hasParameter('bridge') ? 'bridge' : ''}${hasParameter('childbridge') ? 'childbridge' : ''}${hasParameter('controller') ? 'controller' : ''} running on ${this.systemInformation.osType} ${this.systemInformation.osRelease} ${this.systemInformation.osPlatform} ${this.systemInformation.osArch}`,
    );

    // Check node version and throw error
    requireMinNodeVersion(18);

    // Register SIGINT SIGTERM signal handlers
    this.registerSignalHandlers();

    // Set matter.js logger level and format
    Logger.defaultLogLevel = this.debugEnabled ? Level.DEBUG : Level.INFO;
    Logger.format = Format.ANSI;

    // Parse command line
    this.parseCommandLine();
  }

  /**
   * Spawns a child process with the given command and arguments.
   * @param command - The command to execute.
   * @param args - The arguments to pass to the command (default: []).
   * @returns A promise that resolves when the child process exits successfully, or rejects if there is an error.
   */
  private async spawnCommand(command: string, args: string[] = []): Promise<void> {
    /*
    npm > npm.cmd on windows
    */
    if (process.platform === 'win32' && command === 'npm') {
      command = command + '.cmd';
    }
    if (process.platform === 'linux' && command === 'npm' && !hasParameter('docker')) {
      args.unshift(command);
      command = 'sudo';
    }
    return new Promise((resolve, reject) => {
      const childProcess = spawn(command, args, {
        stdio: ['inherit', 'pipe', 'pipe'],
      });

      childProcess.on('error', (err) => {
        this.log.error(`Failed to start child process: ${err.message}`);
        reject(err); // Reject the promise on error
      });

      childProcess.on('close', (code) => {
        if (code === 0) {
          this.log.info(`Child process stdio streams have closed with code ${code}`);
          resolve();
        } else {
          this.log.error(`Child process stdio streams have closed with code ${code}`);
          reject(new Error(`Process exited with code ${code}`));
        }
      });

      // The 'exit' event might be redundant here since 'close' is also being handled
      childProcess.on('exit', (code, signal) => {
        this.log.info(`Child process exited with code ${code} and signal ${signal}`);
      });

      childProcess.on('disconnect', () => {
        this.log.info('Child process has been disconnected from the parent');
      });

      if (childProcess.stdout) {
        childProcess.stdout.on('data', (data) => {
          // Convert the Buffer data to a string.
          const message = data.toString();
          this.log.info(message);
          // TODO: Send this message to the frontend.
        });
      }

      if (childProcess.stderr) {
        childProcess.stderr.on('data', (data) => {
          // Convert the Buffer data to a string.
          const message = data.toString();
          this.log.error(message);
          // TODO: Handle the error message.
        });
      }
    });
  }

  /**
   * Parses the command line arguments and performs the corresponding actions.
   * @private
   * @returns {Promise<void>} A promise that resolves when the command line arguments have been processed.
   */
  private async parseCommandLine(): Promise<void> {
    if (hasParameter('list')) {
      this.log.info('│ Registered plugins');
      this.registeredPlugins.forEach((plugin, index) => {
        if (index !== this.registeredPlugins.length - 1) {
          this.log.info(`├─┬─ plugin ${plg}${plugin.name}${nf}: "${plg}${BRIGHT}${plugin.description}${RESET}${nf}" type: ${typ}${plugin.type}${nf} ${plugin.enabled ? GREEN : RED}enabled ${plugin.paired ? GREEN : RED}paired${nf}`);
          this.log.info(`│ └─ entry ${UNDERLINE}${db}${plugin.path}${UNDERLINEOFF}${db}`);
        } else {
          this.log.info(`└─┬─ plugin ${plg}${plugin.name}${nf}: "${plg}${BRIGHT}${plugin.description}${RESET}${nf}" type: ${typ}${plugin.type}${nf} ${plugin.enabled ? GREEN : RED}enabled ${plugin.paired ? GREEN : RED}paired${nf}`);
          this.log.info(`  └─ entry ${UNDERLINE}${db}${plugin.path}${UNDERLINEOFF}${db}`);
        }
      });
      const serializedRegisteredDevices = await this.nodeContext?.get<SerializedMatterbridgeDevice[]>('devices', []);
      this.log.info('│ Registered devices');
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
      process.exit(0);
    }
    if (getParameter('add')) {
      this.log.debug(`Registering plugin ${getParameter('add')}`);
      await this.executeCommandLine(getParameter('add')!, 'add');
      this.emit('shutdown');
      process.exit(0);
    }
    if (getParameter('remove')) {
      this.log.debug(`Unregistering plugin ${getParameter('remove')}`);
      await this.executeCommandLine(getParameter('remove')!, 'remove');
      this.emit('shutdown');
      process.exit(0);
    }
    if (getParameter('enable')) {
      this.log.debug(`Enable plugin ${getParameter('enable')}`);
      await this.executeCommandLine(getParameter('enable')!, 'enable');
      this.emit('shutdown');
      process.exit(0);
    }
    if (getParameter('disable')) {
      this.log.debug(`Disable plugin ${getParameter('disable')}`);
      await this.executeCommandLine(getParameter('disable')!, 'disable');
      this.emit('shutdown');
      process.exit(0);
    }

    if (hasParameter('factoryreset')) {
      // Delete matter storage file
      await fs.unlink(path.join(this.matterbridgeDirectory, 'matterbridge.json'));
      // Delete node storage directory with its subdirectories
      await fs.rmdir(path.join(this.matterbridgeDirectory, 'storage'), { recursive: true });
      this.log.info('Factory reset done! Remove all paired devices from the controllers.');
      this.emit('shutdown');
      process.exit(0);
    }

    // Start the storage and create matterbridgeContext (we need it now for frontend and later for matterbridge)
    await this.startStorage('json', path.join(this.matterbridgeDirectory, 'matterbridge.json'));
    this.matterbridgeContext = await this.createCommissioningServerContext('Matterbridge', 'Matterbridge', DeviceTypes.AGGREGATOR.code, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge aggregator');

    if (hasParameter('reset') && getParameter('reset') === undefined) {
      this.log.info('Resetting Matterbridge commissioning information...');
      await this.matterbridgeContext?.clearAll();
      await this.stopStorage();
      this.log.info('Reset done! Remove the device from the controller.');
      this.emit('shutdown');
      process.exit(0);
    }

    if (getParameter('reset') && getParameter('reset') !== undefined) {
      this.log.debug(`Reset plugin ${getParameter('reset')}`);
      await this.executeCommandLine(getParameter('reset')!, 'reset');
      await this.stopStorage();
      this.emit('shutdown');
      process.exit(0);
    }

    // Initialize frontend
    await this.initializeFrontend(getIntParameter('frontend'));

    if (hasParameter('test')) {
      this.bridgeMode = 'childbridge';
      MatterbridgeDevice.bridgeMode = 'childbridge';
      await this.testStartMatterBridge(); // No await do it asyncronously
      return;
    }

    if (hasParameter('controller')) {
      this.bridgeMode = 'controller';
      await this.startMattercontroller();
      return;
    }

    if (hasParameter('bridge')) {
      this.bridgeMode = 'bridge';
      MatterbridgeDevice.bridgeMode = 'bridge';
      for (const plugin of this.registeredPlugins) {
        if (!plugin.enabled) {
          this.log.info(`Plugin ${plg}${plugin.name}${nf} not enabled`);
          continue;
        }
        plugin.loaded = false;
        plugin.started = false;
        plugin.configured = false;
        plugin.connected = undefined;
        plugin.qrPairingCode = undefined;
        plugin.manualPairingCode = undefined;
        this.loadPlugin(plugin); // No await do it asyncronously
      }
      await this.startMatterbridge();
      return;
    }

    if (hasParameter('childbridge')) {
      this.bridgeMode = 'childbridge';
      MatterbridgeDevice.bridgeMode = 'childbridge';
      for (const plugin of this.registeredPlugins) {
        if (!plugin.enabled) {
          this.log.info(`Plugin ${plg}${plugin.name}${nf} not enabled`);
          continue;
        }
        plugin.loaded = false;
        plugin.started = false;
        plugin.configured = false;
        plugin.connected = false;
        plugin.qrPairingCode = (await plugin.nodeContext?.get<string>('qrPairingCode', undefined)) ?? undefined;
        plugin.manualPairingCode = (await plugin.nodeContext?.get<string>('manualPairingCode', undefined)) ?? undefined;
        this.loadPlugin(plugin, true, 'Matterbridge is starting'); // No await do it asyncronously
      }
      await this.startMatterbridge();
      return;
    }
  }

  /**
   * Resolves the name of a plugin by loading and parsing its package.json file.
   * @param pluginPath - The path to the plugin or the path to the plugin's package.json file.
   * @returns The path to the resolved package.json file, or null if the package.json file is not found or does not contain a name.
   */
  private async resolvePluginName(pluginPath: string): Promise<string | null> {
    if (!pluginPath.endsWith('package.json')) pluginPath = path.join(pluginPath, 'package.json');

    // Resolve the package.json of the plugin
    let packageJsonPath = path.resolve(pluginPath);
    this.log.debug(`Loading plugin from ${plg}${packageJsonPath}${db}`);

    // Check if the package.json file exists
    let packageJsonExists = false;
    try {
      await fs.access(packageJsonPath);
      packageJsonExists = true;
    } catch {
      packageJsonExists = false;
    }
    if (!packageJsonExists) {
      this.log.debug(`Package.json not found at ${packageJsonPath}`);
      this.log.debug(`Trying at ${this.globalModulesDirectory}`);
      packageJsonPath = path.join(this.globalModulesDirectory, pluginPath);
      //this.log.debug(`Got ${packageJsonPath}`);
    }
    try {
      // Load the package.json of the plugin
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      if (!packageJson.name) {
        this.log.debug(`Package.json name not found at ${packageJsonPath}`);
        return null;
      }
      this.log.debug(`Package.json name: ${plg}${packageJson.name}${db} description: "${nf}${packageJson.description}${db}" found at "${nf}${packageJsonPath}${db}"`);
      return packageJsonPath;
    } catch (err) {
      this.log.debug(`Failed to load plugin from ${plg}${packageJsonPath}${er}: ${err}`);
      return null;
    }
  }

  /**
   * Loads a plugin from the specified package.json file path.
   * @param packageJsonPath - The path to the package.json file of the plugin.
   * @param mode - The mode of operation. Possible values are 'add', 'remove', 'enable', 'disable'.
   * @returns A Promise that resolves when the plugin is loaded successfully, or rejects with an error if loading fails.
   */
  private async executeCommandLine(packageJsonPath: string, mode: string) {
    packageJsonPath = (await this.resolvePluginName(packageJsonPath)) ?? packageJsonPath;
    this.log.debug(`Loading plugin from ${plg}${packageJsonPath}${db}`);
    try {
      // Load the package.json of the plugin
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      if (mode === 'add') {
        if (!this.registeredPlugins.find((plugin) => plugin.name === packageJson.name)) {
          const plugin = { path: packageJsonPath, type: '', name: packageJson.name, version: packageJson.version, description: packageJson.description, author: packageJson.author, enabled: true };
          if (await this.loadPlugin(plugin)) {
            this.registeredPlugins.push(plugin);
            await this.nodeContext?.set<RegisteredPlugin[]>('plugins', this.getBaseRegisteredPlugins());
            this.log.info(`Plugin ${plg}${packageJsonPath}${nf} type ${plugin.type} added to matterbridge`);
          } else {
            this.log.error(`Plugin ${plg}${packageJsonPath}${wr} not added to matterbridge error`);
          }
        } else {
          this.log.warn(`Plugin ${plg}${packageJsonPath}${wr} already added to matterbridge`);
        }
      } else if (mode === 'remove') {
        if (this.registeredPlugins.find((registeredPlugin) => registeredPlugin.name === packageJson.name)) {
          this.registeredPlugins.splice(
            this.registeredPlugins.findIndex((registeredPlugin) => registeredPlugin.name === packageJson.name),
            1,
          );
          await this.nodeContext?.set<RegisteredPlugin[]>('plugins', this.getBaseRegisteredPlugins());
          this.log.info(`Plugin ${plg}${packageJsonPath}${nf} removed from matterbridge`);
        } else {
          this.log.warn(`Plugin ${plg}${packageJsonPath}${wr} not registerd in matterbridge`);
        }
      } else if (mode === 'enable') {
        const plugin = this.registeredPlugins.find((registeredPlugin) => registeredPlugin.name === packageJson.name);
        if (plugin) {
          plugin.enabled = true;
          plugin.loaded = undefined;
          plugin.started = undefined;
          plugin.configured = undefined;
          plugin.connected = undefined;
          await this.nodeContext?.set<RegisteredPlugin[]>('plugins', this.getBaseRegisteredPlugins());
          this.log.info(`Plugin ${plg}${packageJsonPath}${nf} enabled`);
        } else {
          this.log.warn(`Plugin ${plg}${packageJsonPath}${wr} not registerd in matterbridge`);
        }
      } else if (mode === 'disable') {
        const plugin = this.registeredPlugins.find((registeredPlugin) => registeredPlugin.name === packageJson.name);
        if (plugin) {
          plugin.enabled = false;
          plugin.loaded = undefined;
          plugin.started = undefined;
          plugin.configured = undefined;
          plugin.connected = undefined;
          await this.nodeContext?.set<RegisteredPlugin[]>('plugins', this.getBaseRegisteredPlugins());
          this.log.info(`Plugin ${plg}${packageJsonPath}${nf} disabled`);
        } else {
          this.log.warn(`Plugin ${plg}${packageJsonPath}${wr} not registerd in matterbridge`);
        }
      } else if (mode === 'reset') {
        const plugin = this.registeredPlugins.find((registeredPlugin) => registeredPlugin.name === packageJson.name);
        if (plugin) {
          plugin.loaded = undefined;
          plugin.started = undefined;
          plugin.configured = undefined;
          plugin.connected = undefined;
          plugin.paired = undefined;
          plugin.connected = undefined;
          if (!this.storageManager) this.log.error(`Plugin ${plg}${plugin.name}${er} storageManager not found`);
          const context = this.storageManager?.createContext(plugin.name);
          if (!context) this.log.error(`Plugin ${plg}${plugin.name}${er} context not found`);
          await context?.clearAll();
          await this.nodeContext?.set<RegisteredPlugin[]>('plugins', this.getBaseRegisteredPlugins());
          this.log.info(`Reset commissionig for plugin ${plg}${plugin.name}${nf} done! Remove the device from the controller.`);
        } else {
          this.log.warn(`Plugin ${plg}${packageJsonPath}${wr} not registerd in matterbridge`);
        }
      }
    } catch (err) {
      this.log.error(`Failed to load plugin from ${plg}${packageJsonPath}${er}: ${err}`);
    }
  }

  /**
   * Registers the signal handlers for SIGINT and SIGTERM.
   * When either of these signals are received, the cleanup method is called with an appropriate message.
   */
  private async registerSignalHandlers() {
    process.once('SIGINT', async () => {
      await this.cleanup('SIGINT received, cleaning up...');
    });

    process.once('SIGTERM', async () => {
      await this.cleanup('SIGTERM received, cleaning up...');
    });
  }

  /**
   * Update matterbridge.
   */
  private async updateProcess() {
    await this.cleanup('updating...', false);
    this.hasCleanupStarted = false;
  }

  /**
   * Restarts the process by spawning a new process and exiting the current process.
   */
  private async restartProcess() {
    await this.cleanup('restarting...', true);
    this.hasCleanupStarted = false;
  }

  /**
   * Shut down the process by exiting the current process.
   */
  private async shutdownProcess() {
    await this.cleanup('shutting down...', false);
    this.hasCleanupStarted = false;
  }

  /**
   * Cleans up the Matterbridge instance.
   * @param message - The cleanup message.
   * @param restart - Indicates whether to restart the instance after cleanup. Default is `false`.
   * @returns A promise that resolves when the cleanup is completed.
   */
  private async cleanup(message: string, restart = false) {
    if (!this.hasCleanupStarted) {
      this.hasCleanupStarted = true;
      this.log.info(message);

      process.removeAllListeners('SIGINT');
      process.removeAllListeners('SIGTERM');

      // Calling the shutdown functions with a reason
      for (const plugin of this.registeredPlugins) {
        if (!plugin.enabled) continue;
        this.log.info(`*Shutting down plugin ${plg}${plugin.name}${nf}`);
        if (plugin.platform) {
          await plugin.platform.onShutdown('Matterbridge is closing: ' + message);
          await this.savePluginConfig(plugin);
        } else {
          this.log.warn(`Plugin ${plg}${plugin.name}${wr} platform not found`);
        }
      }

      // Set reachability to false
      /*
      this.log.debug(`*Changing reachability to false for ${this.registeredDevices.length} devices (${this.bridgeMode} mode):`);
      this.registeredDevices.forEach((registeredDevice) => {
        const plugin = this.registeredPlugins.find((plugin) => plugin.name === registeredDevice.plugin);
        if (!plugin) {
          this.log.error(`Plugin ${plg}${registeredDevice.plugin}${er} not found`);
          return;
        }
        if (this.bridgeMode === 'bridge' && registeredDevice.device.number) {
          this.log.debug(`*-- device: ${dev}${registeredDevice.device.name}${db} plugin ${plg}${registeredDevice.plugin}${db} type ${plugin.type}${db}`);
          registeredDevice.device.setBridgedDeviceReachability(false);
          registeredDevice.device.getClusterServerById(BridgedDeviceBasicInformation.Cluster.id)?.triggerReachableChangedEvent({ reachableNewValue: false });
        }
        if (this.bridgeMode === 'childbridge') {
          if (plugin.type === 'DynamicPlatform' && registeredDevice.device.number) {
            this.log.debug(`*-- device: ${dev}${registeredDevice.device.name}${db} plugin ${plg}${registeredDevice.plugin}${db} type ${plugin.type}${db}`);
            registeredDevice.device.setBridgedDeviceReachability(false);
            registeredDevice.device.getClusterServerById(BridgedDeviceBasicInformation.Cluster.id)?.triggerReachableChangedEvent({ reachableNewValue: false });
          }
        }
      });
      if (this.bridgeMode === 'bridge') {
        this.log.debug('*Changing reachability to false for Matterbridge');
        this.matterAggregator?.getClusterServerById(BasicInformation.Cluster.id)?.setReachableAttribute(false);
        this.matterAggregator?.getClusterServerById(BasicInformation.Cluster.id)?.triggerReachableChangedEvent({ reachableNewValue: false });
        this.commissioningServer?.setReachability(false);
      }
      if (this.bridgeMode === 'childbridge') {
        for (const plugin of this.registeredPlugins) {
          if (!plugin.enabled || plugin.error) continue;
          this.log.debug(`*Changing reachability to false for plugin ${plg}${plugin.name}${db} type ${plugin.type}`);
          plugin.aggregator?.getClusterServerById(BasicInformation.Cluster.id)?.setReachableAttribute(false);
          plugin.aggregator?.getClusterServerById(BasicInformation.Cluster.id)?.triggerReachableChangedEvent({ reachableNewValue: false });
          plugin.commissioningServer?.setReachability(false);
        }
      }
      */

      // Close the express server
      if (this.expressServer) {
        this.expressServer.close();
        this.expressServer = undefined;
      }
      // Remove listeners
      if (this.expressApp) {
        this.expressApp.removeAllListeners();
        this.expressApp = undefined;
      }
      /*const cleanupTimeout1 =*/ setTimeout(async () => {
        // Closing matter
        await this.stopMatter();

        // Closing storage
        await this.stopStorage();

        // Serialize registeredDevices
        if (this.nodeStorage && this.nodeContext) {
          this.log.info('Saving registered devices...');
          const serializedRegisteredDevices: SerializedMatterbridgeDevice[] = [];
          this.registeredDevices.forEach((registeredDevice) => {
            const serializedMatterbridgeDevice = registeredDevice.device.serialize(registeredDevice.plugin);
            //this.log.info(`- ${serializedMatterbridgeDevice.deviceName}${rs}\n`, serializedMatterbridgeDevice);
            serializedRegisteredDevices.push(serializedMatterbridgeDevice);
          });
          await this.nodeContext.set<SerializedMatterbridgeDevice[]>('devices', serializedRegisteredDevices);
          this.log.info('Saved registered devices');
          // Clear nodeContext and nodeStorage (they just need 1000ms to write the data to disk)
          this.log.debug('Closing node storage context...');
          this.nodeContext.close();
          this.nodeContext = undefined;
          this.log.debug('Closing node storage manager...');
          this.nodeStorage.close();
          this.nodeStorage = undefined;
        } else {
          this.log.error('Error saving registered devices: nodeContext not found!');
        }
        this.registeredPlugins = [];
        this.registeredDevices = [];

        this.log.info('Waiting for matter to deliver last messages...');
        /*const cleanupTimeout2 =*/ setTimeout(async () => {
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
            this.log.info('Cleanup completed. Shutting down...');
            Matterbridge.instance = undefined;
            this.emit('shutdown');
          }
        }, 1 * 1000);
        //cleanupTimeout2.unref();
      }, 3 * 1000);
      //cleanupTimeout1.unref();
    }
  }

  /**
   * Sets the reachable attribute of a device.
   *
   * @param device - The device for which to set the reachable attribute.
   * @param reachable - The value to set for the reachable attribute.
   */
  private setReachableAttribute(device: Device, reachable: boolean) {
    const basicInformationCluster = device.getClusterServer(BasicInformationCluster);
    if (!basicInformationCluster) {
      this.log.error('setReachableAttribute BasicInformationCluster needs to be set!');
      return;
    }
    basicInformationCluster.setReachableAttribute(reachable);
  }

  /**
   * Adds a device to the Matterbridge.
   * @param pluginName - The name of the plugin.
   * @param device - The device to be added.
   * @returns A Promise that resolves when the device is added successfully.
   */
  async addDevice(pluginName: string, device: MatterbridgeDevice): Promise<void> {
    if (this.bridgeMode === 'bridge' && !this.matterAggregator) {
      this.log.error(`Adding device ${dev}${device.deviceName}${er} (${dev}${device.name}${er}) for plugin ${plg}${pluginName}${er} error: matterAggregator not found`);
      return;
    }
    this.log.debug(`Adding device ${dev}${device.deviceName}${db} (${dev}${device.name}${db}) for plugin ${plg}${pluginName}${db}`);

    // Check if the plugin is registered
    const plugin = this.registeredPlugins.find((plugin) => plugin.name === pluginName);
    if (!plugin) {
      this.log.error(`Error adding device ${dev}${device.deviceName}${er} (${dev}${device.name}${er}) plugin ${plg}${pluginName}${er} not found`);
      return;
    }

    // Register and add the device to matterbridge aggregator in bridge mode
    if (this.bridgeMode === 'bridge') {
      this.matterAggregator?.addBridgedDevice(device);
      this.registeredDevices.push({ plugin: pluginName, device, added: true });
      if (plugin.registeredDevices !== undefined) plugin.registeredDevices++;
      if (plugin.addedDevices !== undefined) plugin.addedDevices++;
      this.log.info(`Added and registered device (${plugin.registeredDevices}/${plugin.addedDevices}) ${dev}${device.deviceName}${nf} (${dev}${device.name}${nf}) for plugin ${plg}${pluginName}${nf}`);
    }

    // Only register the device in childbridge mode
    if (this.bridgeMode === 'childbridge') {
      this.registeredDevices.push({ plugin: pluginName, device, added: false });
      if (plugin.registeredDevices !== undefined) plugin.registeredDevices++;
      this.log.info(`Registered device (${plugin.registeredDevices}) ${dev}${device.deviceName}${nf} (${dev}${device.name}${nf}) for plugin ${plg}${pluginName}${nf}`);
    }
  }

  /**
   * Adds a bridged device to the Matterbridge.
   * @param pluginName - The name of the plugin.
   * @param device - The bridged device to add.
   * @returns {Promise<void>} - A promise that resolves when the storage process is started.
   */
  async addBridgedDevice(pluginName: string, device: MatterbridgeDevice): Promise<void> {
    if (this.bridgeMode === 'bridge' && !this.matterAggregator) {
      this.log.error(`Adding bridged device ${dev}${device.deviceName}${er} (${dev}${device.name}${er}) for plugin ${plg}${pluginName}${er} error: matterAggregator not found`);
      return;
    }
    this.log.debug(`Adding bridged device ${dev}${device.deviceName}${db} (${dev}${device.name}${db}) for plugin ${plg}${pluginName}${db}`);

    // Check if the plugin is registered
    const plugin = this.registeredPlugins.find((plugin) => plugin.name === pluginName);
    if (!plugin) {
      this.log.error(`Error adding bridged device ${dev}${device.deviceName}${er} (${dev}${device.name}${er}) plugin ${plg}${pluginName}${er} not found`);
      return;
    }

    // Register and add the device to matterbridge aggregator in bridge mode
    if (this.bridgeMode === 'bridge') {
      this.matterAggregator?.addBridgedDevice(device);
      this.registeredDevices.push({ plugin: pluginName, device, added: true });
      if (plugin.registeredDevices !== undefined) plugin.registeredDevices++;
      if (plugin.addedDevices !== undefined) plugin.addedDevices++;
      this.log.info(`Added and registered bridged device (${plugin.registeredDevices}/${plugin.addedDevices}) ${dev}${device.deviceName}${nf} (${dev}${device.name}${nf}) for plugin ${plg}${pluginName}${nf}`);
    }

    // Only register the device in childbridge mode
    if (this.bridgeMode === 'childbridge') {
      this.registeredDevices.push({ plugin: pluginName, device, added: false });
      if (plugin.registeredDevices !== undefined) plugin.registeredDevices++;
      this.log.info(`Registered bridged device (${plugin.registeredDevices}) ${dev}${device.deviceName}${nf} (${dev}${device.name}${nf}) for plugin ${plg}${pluginName}${nf}`);
    }
  }

  /**
   * Removes a bridged device from the Matterbridge.
   * @param pluginName - The name of the plugin.
   * @param device - The device to be removed.
   * @returns A Promise that resolves when the device is successfully removed.
   */
  async removeBridgedDevice(pluginName: string, device: MatterbridgeDevice): Promise<void> {
    if (this.bridgeMode === 'bridge' && !this.matterAggregator) {
      this.log.error(`Removing bridged device ${dev}${device.deviceName}${er} (${dev}${device.name}${er}) for plugin ${plg}${pluginName}${er} error: matterAggregator not found`);
      return;
    }
    this.log.debug(`Removing bridged device ${dev}${device.deviceName}${db} (${dev}${device.name}${db}) for plugin ${plg}${pluginName}${db}`);

    // Check if the plugin is registered
    const plugin = this.findPlugin(pluginName);
    if (!plugin) {
      this.log.error(`Error removing bridged device ${dev}${device.deviceName}${er} (${dev}${device.name}${er}) plugin ${plg}${pluginName}${er} not found`);
      return;
    }
    if (this.bridgeMode === 'childbridge' && !plugin.aggregator) {
      this.log.error(`Error removing bridged device ${dev}${device.deviceName}${er} (${dev}${device.name}${er}) plugin ${plg}${pluginName}${er} aggregator not found`);
      return;
    }
    if (this.bridgeMode === 'childbridge' && !plugin.connected) {
      this.log.warn(`Removing bridged device ${dev}${device.deviceName}${wr} (${dev}${device.name}${wr}) plugin ${plg}${pluginName}${wr} not connected`);
      return;
    }

    // Remove the device from matterbridge aggregator in bridge mode
    if (this.bridgeMode === 'bridge') {
      device.setBridgedDeviceReachability(false);
      device.getClusterServerById(BridgedDeviceBasicInformation.Cluster.id)?.triggerReachableChangedEvent({ reachableNewValue: false });
      this.matterAggregator!.removeBridgedDevice(device);
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
        this.log.info(`Removing bridged device ${dev}${device.deviceName}${nf} (${dev}${device.name}${nf}) for plugin ${plg}${pluginName}${nf}: AccessoryPlatform not supported in childbridge mode`);
      } else if (plugin.type === 'DynamicPlatform') {
        this.registeredDevices.forEach((registeredDevice, index) => {
          if (registeredDevice.device === device) {
            this.registeredDevices.splice(index, 1);
            return;
          }
        });
        device.setBridgedDeviceReachability(false);
        device.getClusterServerById(BridgedDeviceBasicInformation.Cluster.id)?.triggerReachableChangedEvent({ reachableNewValue: false });
        plugin.aggregator!.removeBridgedDevice(device);
      }
      this.log.info(`Removed bridged device(${plugin.registeredDevices}/${plugin.addedDevices}) ${dev}${device.deviceName}${nf} (${dev}${device.name}${nf}) for plugin ${plg}${pluginName}${nf}`);
      if (plugin.registeredDevices !== undefined) plugin.registeredDevices--;
      if (plugin.addedDevices !== undefined) plugin.addedDevices--;
    }
  }

  /**
   * Removes all bridged devices associated with a specific plugin.
   *
   * @param pluginName - The name of the plugin.
   * @returns A promise that resolves when all devices have been removed.
   */
  async removeAllBridgedDevices(pluginName: string): Promise<void> {
    const plugin = this.findPlugin(pluginName);
    if (this.bridgeMode === 'childbridge' && plugin?.type === 'AccessoryPlatform') {
      this.log.info(`Removing devices for plugin ${plg}${pluginName}${nf}: AccessoryPlatform not supported in childbridge mode`);
      return;
    }
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

  /**
   * Starts the storage process based on the specified storage type and name.
   * @param {string} storageType - The type of storage to start (e.g., 'disk', 'json').
   * @param {string} storageName - The name of the storage file.
   * @returns {Promise<void>} - A promise that resolves when the storage process is started.
   */
  private async startStorage(storageType: string, storageName: string): Promise<void> {
    this.log.debug(`Starting storage ${storageType} ${storageName}`);
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
        await this.backupJsonStorage(storageName, storageName.replace('.json', '') + '.backup.json');
      }
    } catch (error) {
      this.log.error('Storage initialize() error!');
      await this.cleanup('Storage initialize() error!');
    }
  }

  /**
   * Makes a backup copy of the specified JSON storage file.
   *
   * @param storageName - The name of the JSON storage file to be backed up.
   * @param backupName - The name of the backup file to be created.
   */
  private async backupJsonStorage(storageName: string, backupName: string) {
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
   * Stops the storage.
   * @returns {Promise<void>} A promise that resolves when the storage is stopped.
   */
  private async stopStorage(): Promise<void> {
    this.log.debug('Stopping storage');
    await this.storageManager?.close();
    this.log.debug('Storage closed');
    this.storageManager = undefined;
    this.matterbridgeContext = undefined;
    this.mattercontrollerContext = undefined;
  }

  private async testStartMatterBridge(): Promise<void> {
    // Plugins are loaded by loadPlugin on startup and plugin.loaded is set to true
    // Plugins are started and configured by callback when Matterbridge is commissioned
    if (!this.storageManager) {
      this.log.error('No storage manager initialized');
      await this.cleanup('No storage manager initialized');
      return;
    }
    this.log.debug('Starting matterbridge in mode', this.bridgeMode);
    this.createMatterServer(this.storageManager);
    if (!this.matterServer) {
      this.log.error('No matter server initialized');
      await this.cleanup('No matter server initialized');
      return;
    }

    this.log.debug('***Starting startMatterbridge interval for Matterbridge');
    let failCount = 0;
    const startInterval = setInterval(async () => {
      for (const plugin of this.registeredPlugins) {
        if (!plugin.enabled) continue;
        if (!plugin.loaded) {
          this.log.info(`***Waiting (failSafeCount=${failCount}/30) in startMatterbridge interval for plugin ${plg}${plugin.name}${db} loaded: ${plugin.loaded}...`);
          failCount++;
          if (failCount > 30) {
            this.log.error(`***Failed to load plugin ${plg}${plugin.name}${er}`);
            plugin.error = true;
          } else {
            return;
          }
        }
      }
      clearInterval(startInterval);
      this.log.debug('***Cleared startMatterbridge interval for Matterbridge');

      this.log.debug(`Creating commissioning server context for ${plg}Matterbridge${db}`);
      this.matterbridgeContext = await this.createCommissioningServerContext('Matterbridge', 'Matterbridge', DeviceTypes.AGGREGATOR.code, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Aggregator');
      if (!this.matterbridgeContext) {
        this.log.error(`Error creating storage context for ${plg}Matterbridge${er}`);
        return;
      }
      if (!this.nodeContext) {
        this.log.error(`Node storage context undefined for ${plg}Matterbridge${er}`);
        return;
      }
      await this.matterbridgeContext.set('softwareVersion', 1);
      await this.matterbridgeContext.set('softwareVersionString', this.matterbridgeVersion);
      this.log.debug(`Creating commissioning server for ${plg}Matterbridge${db}`);
      this.commissioningServer = await this.createCommisioningServer(this.matterbridgeContext, 'Matterbridge');

      this.log.debug(`Creating matter aggregator for ${plg}Matterbridge${db}`);
      this.matterAggregator = await this.createMatterAggregator(this.matterbridgeContext);
      this.log.debug('Adding matterbridge aggregator to commissioning server');
      this.commissioningServer.addDevice(this.matterAggregator);

      const device = new MatterbridgeDevice(DeviceTypes.CONTACT_SENSOR);
      device.createDefaultIdentifyClusterServer();
      //device.createDefaultBasicInformationClusterServer('Boolean test', '0x89930475', 0x8000, 'Matterbridge', 77, 'Boolean');
      device.createDefaultBridgedDeviceBasicInformationClusterServer('Boolean test', '0x89930475', 0x8000, 'Matterbridge', 'Boolean');
      device.createDefaultBooleanStateClusterServer(true);
      device.createDefaultPowerSourceReplaceableBatteryClusterServer(75);
      device.createDefaultPowerSourceConfigurationClusterServer(1);
      //this.commissioningServer.addDevice(device);
      //this.matterAggregator.addBridgedDevice(device);

      this.log.debug('Adding matterbridge commissioning server to matter server');
      await this.matterServer?.addCommissioningServer(this.commissioningServer, { uniqueStorageKey: 'Matterbridge' });
      this.log.debug(`Setting reachability to true for ${plg}Matterbridge${db}`);
      this.commissioningServer.setReachability(true);
      this.log.debug('Starting matter server...');
      await this.startMatterServer();
      this.log.info('Matter server started');
      await this.showCommissioningQRCode(this.commissioningServer, this.matterbridgeContext, this.nodeContext, 'Matterbridge');

      //2024-03-31 21:54:12.065 DEBUG  InteractionServer    Received subscribe request from udp://fe80::14b6:bb16:5d3a:1293%9:51251 on session secure/48170 (keepSubscriptions=true, isFabricFiltered=false)
      //2024-03-31 21:54:12.066 DEBUG  InteractionServer    Subscribe to attributes:*/*/*, events:!*/*/*
      /*
      2024-03-31 21:52:22.669 DEBUG  SubscriptionHandler  Sending subscription update message for ID 2529153003 with 1 attributes and 1 events
      2024-03-31 21:52:22.669 DEBUG  MessageExchange      New exchange protocol: 1 id: 30278 session: secure/24489 peerSessionId: 2131 active threshold ms: 4000 active interval ms: 300 idle interval ms: 300 retries: 5
      2024-03-31 21:52:22.669 DEBUG  SubscriptionHandler  Sending subscription changes for ID 2529153003: MA-contactsensor(0x3b)/BooleanState(0x45)/stateValue(0x0)=true (1805472651)
      2024-03-31 21:52:22.670 DEBUG  InteractionMessenger Sending DataReport chunk with 1 attributes and 1 events: 85 bytes
      */

      setTimeout(() => {
        this.matterAggregator?.addBridgedDevice(device);
        this.log.info('Added device to aggregator');
      }, 30 * 1000);

      setInterval(() => {
        const cluster = device.getClusterServer(BooleanStateCluster);
        if (!cluster) return;
        const contact = cluster.getStateValueAttribute();
        cluster.setStateValueAttribute(!contact);
        if (cluster.isEventSupportedByName('stateChange')) cluster.triggerStateChangeEvent!({ stateValue: !contact });
        this.log.info('Set attribute and event for BooleanStateCluster to', !contact);
      }, 60 * 1000);
    }, 1000);
  }

  /**
   * Loads the configuration for a plugin.
   * If the configuration file exists, it reads the file and returns the parsed JSON data.
   * If the configuration file does not exist, it creates a new file with default configuration and returns it.
   * If any error occurs during file access or creation, it logs an error and rejects the promise with the error.
   *
   * @param plugin - The plugin for which to load the configuration.
   * @returns A promise that resolves to the loaded or created configuration.
   */
  private async loadPluginConfig(plugin: RegisteredPlugin): Promise<PlatformConfig> {
    const configFile = path.join(this.matterbridgeDirectory, `${plugin.name}.config.json`);
    try {
      await fs.access(configFile);
      const data = await fs.readFile(configFile, 'utf8');
      const config = JSON.parse(data) as PlatformConfig;
      this.log.debug(`Config file found: ${configFile}.\nConfig:${rs}\n`, config);
      /* The first time a plugin is added to the system, the config file is created with the plugin name and type "".*/
      config.name = plugin.name;
      config.type = plugin.type;
      return config;
    } catch (err) {
      if (err instanceof Error) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'ENOENT') {
          try {
            await this.writeFile(configFile, JSON.stringify({ name: plugin.name, type: plugin.type }, null, 2));
            this.log.debug(`Created config file: ${configFile}.\nConfig:${rs}\n`, { name: plugin.name, type: plugin.type });
            return { name: plugin.name, type: plugin.type };
          } catch (err) {
            this.log.error(`Error creating config file ${configFile}: ${err}`);
            return Promise.reject(err);
          }
        } else {
          this.log.error(`Error accessing config file ${configFile}: ${err}`);
          return Promise.reject(err);
        }
      }
      return Promise.reject(err);
    }
  }

  /**
   * Saves the configuration of a registered plugin.
   * @param {RegisteredPlugin} plugin - The plugin whose configuration needs to be saved.
   * @returns {Promise<void>} - A promise that resolves when the configuration is successfully saved.
   * @throws {Error} - If the plugin's configuration is not found or if there is an error while saving the configuration.
   */
  private async savePluginConfig(plugin: RegisteredPlugin): Promise<void> {
    if (!plugin.platform?.config) {
      this.log.error(`Error saving plugin ${plg}${plugin.name}${er} config: config not found`);
      return Promise.reject(new Error(`Error saving plugin ${plg}${plugin.name}${er} config: config not found`));
    }
    const configFile = path.join(this.matterbridgeDirectory, `${plugin.name}.config.json`);
    try {
      await this.writeFile(configFile, JSON.stringify(plugin.platform.config, null, 2));
      this.log.debug(`Saved config file: ${configFile}.\nConfig:${rs}\n`, plugin.platform.config);
    } catch (err) {
      this.log.error(`Error saving plugin ${plg}${plugin.name}${er} config: ${err}`);
      return Promise.reject(err);
    }
  }

  /**
   * Writes data to a file.
   *
   * @param {string} filePath - The path of the file to write to.
   * @param {string} data - The data to write to the file.
   * @returns {Promise<void>} - A promise that resolves when the data is successfully written to the file.
   */
  private async writeFile(filePath: string, data: string) {
    // Write the data to a file
    await fs
      .writeFile(`${filePath}`, data, 'utf8')
      .then(() => {
        this.log.debug(`Successfully wrote to ${filePath}`);
      })
      .catch((error) => {
        this.log.error(`Error writing to ${filePath}:`, error);
      });
  }

  /**
   * Starts a plugin.
   *
   * @param {RegisteredPlugin} plugin - The plugin to start.
   * @param {string} [message] - Optional message to pass to the plugin's onStart method.
   * @param {boolean} [configure=false] - Indicates whether to configure the plugin after starting.
   * @returns {Promise<void>} A promise that resolves when the plugin is started successfully, or rejects with an error if starting the plugin fails.
   */
  private async startPlugin(plugin: RegisteredPlugin, message?: string, configure = false): Promise<void> {
    if (!plugin.loaded || !plugin.platform) {
      this.log.error(`Plugin ${plg}${plugin.name}${er} not loaded or no platform`);
      return Promise.reject(new Error(`Plugin ${plg}${plugin.name}${er} not loaded or no platform`));
    }
    if (plugin.started) {
      this.log.warn(`Plugin ${plg}${plugin.name}${wr} already started`);
      return Promise.resolve();
    }
    this.log.info(`Starting plugin ${plg}${plugin.name}${db} type ${typ}${plugin.type}${db}`);
    try {
      plugin.platform
        .onStart(message)
        .then(() => {
          plugin.started = true;
          this.log.info(`Started plugin ${plg}${plugin.name}${db} type ${typ}${plugin.type}${db}`);
          if (configure) this.configurePlugin(plugin); // No await do it asyncronously
          return Promise.resolve();
        })
        .catch((err) => {
          this.log.error(`Failed to start plugin ${plg}${plugin.name}${er}: ${err}`);
          return Promise.reject(new Error(`Failed to start plugin ${plg}${plugin.name}${er}: ${err}`));
        });
    } catch (err) {
      this.log.error(`Failed to start plugin ${plg}${plugin.name}${er}: ${err}`);
      return Promise.reject(new Error(`Failed to start plugin ${plg}${plugin.name}${er}: ${err}`));
    }
  }

  /**
   * Configures a plugin.
   *
   * @param {RegisteredPlugin} plugin - The plugin to configure.
   * @returns {Promise<void>} A promise that resolves when the plugin is configured successfully, or rejects with an error if configuration fails.
   */
  private async configurePlugin(plugin: RegisteredPlugin): Promise<void> {
    if (!plugin.loaded || !plugin.started || !plugin.platform) {
      this.log.error(`Plugin ${plg}${plugin.name}${er} not loaded (${plugin.loaded}) or not started (${plugin.started}) or not platform (${plugin.platform?.name})`);
      return Promise.reject(new Error(`Plugin ${plg}${plugin.name}${er} not loaded or not started or not platform`));
    }
    if (plugin.configured) {
      this.log.error(`Plugin ${plg}${plugin.name}${er} already configured`);
      return Promise.resolve();
    }
    this.log.info(`Configuring plugin ${plg}${plugin.name}${db} type ${typ}${plugin.type}${db}`);
    try {
      plugin.platform
        .onConfigure()
        .then(() => {
          plugin.configured = true;
          this.log.info(`Configured plugin ${plg}${plugin.name}${db} type ${typ}${plugin.type}${db}`);
          return Promise.resolve();
        })
        .catch((err) => {
          this.log.error(`Failed to configure plugin ${plg}${plugin.name}${er}: ${err}`);
          return Promise.reject(new Error(`Failed to configure plugin ${plg}${plugin.name}${er}: ${err}`));
        });
    } catch (err) {
      this.log.error(`Failed to configure plugin ${plg}${plugin.name}${er}: ${err}`);
      return Promise.reject(new Error(`Failed to configure plugin ${plg}${plugin.name}${er}: ${err}`));
    }
  }

  /**
   * Loads a plugin and returns the corresponding MatterbridgePlatform instance.
   * @param plugin - The plugin to load.
   * @param start - Optional flag indicating whether to start the plugin after loading. Default is false.
   * @param message - Optional message to pass to the plugin when starting.
   * @returns A Promise that resolves to the loaded MatterbridgePlatform instance.
   * @throws An error if the plugin is not enabled, already loaded, or fails to load.
   */
  private async loadPlugin(plugin: RegisteredPlugin, start = false, message = ''): Promise<MatterbridgePlatform | undefined> {
    if (!plugin.enabled) {
      this.log.error(`Plugin ${plg}${plugin.name}${er} not enabled`);
      return Promise.reject(new Error(`Plugin ${plg}${plugin.name}${er} not enabled`));
    }
    if (plugin.platform) {
      this.log.error(`Plugin ${plg}${plugin.name}${er} already loaded`);
      return Promise.resolve(plugin.platform);
    }
    this.log.info(`Loading plugin ${plg}${plugin.name}${db} type ${typ}${plugin.type}${db}`);
    try {
      // Load the package.json of the plugin
      const packageJson = JSON.parse(await fs.readFile(plugin.path, 'utf8'));
      // Resolve the main module path relative to package.json
      const pluginEntry = path.resolve(path.dirname(plugin.path), packageJson.main);
      // Dynamically import the plugin
      const pluginUrl = pathToFileURL(pluginEntry);
      this.log.debug(`Importing plugin ${plg}${plugin.name}${db} from ${pluginUrl.href}`);
      const pluginInstance = await import(pluginUrl.href);
      this.log.debug(`Imported plugin ${plg}${plugin.name}${db} from ${pluginUrl.href}`);

      // Call the default export function of the plugin, passing this MatterBridge instance
      if (pluginInstance.default) {
        const config: PlatformConfig = await this.loadPluginConfig(plugin);
        const platform = pluginInstance.default(this, new AnsiLogger({ logName: plugin.description, logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: this.debugEnabled }), config) as MatterbridgePlatform;
        platform.name = packageJson.name;
        platform.config = config;
        plugin.name = packageJson.name;
        plugin.description = packageJson.description;
        plugin.version = packageJson.version;
        plugin.author = packageJson.author;
        plugin.type = platform.type;
        plugin.platform = platform;
        plugin.loaded = true;
        plugin.registeredDevices = 0;
        plugin.addedDevices = 0;
        await this.nodeContext?.set<RegisteredPlugin[]>('plugins', this.getBaseRegisteredPlugins());
        this.log.info(`Loaded plugin ${plg}${plugin.name}${db} type ${typ}${platform.type}${db} (entrypoint ${UNDERLINE}${pluginEntry}${UNDERLINEOFF})`);
        if (start) this.startPlugin(plugin, message); // No await do it asyncronously
        return Promise.resolve(platform);
      } else {
        this.log.error(`Plugin ${plg}${plugin.name}${er} does not provide a default export`);
        return;
        //return Promise.reject(new Error(`Plugin ${plg}${plugin.name}${er} does not provide a default export`));
      }
    } catch (err) {
      this.log.error(`Failed to load plugin ${plg}${plugin.name}${er}: ${err}`);
      return;
      //return Promise.reject(new Error(`Failed to load plugin ${plg}${plugin.name}${er}: ${err}`));
    }
  }

  /**
   * Starts the Matterbridge controller.
   * @private
   * @returns {Promise<void>} A promise that resolves when the Matterbridge is started.
   */
  private async startMattercontroller(): Promise<void> {
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
    this.createMatterServer(this.storageManager);
    if (!this.matterServer) {
      this.log.error('No matter server initialized');
      await this.cleanup('No matter server initialized');
      return;
    }

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
      this.log.info(`Commissioning successfully done with nodeId: ${nodeId.nodeId}`);
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
      //const discover = await this.commissioningController.discoverCommissionableDevices({ productId: 0x8000, deviceType: 0xfff1 });
      //console.log(discover);
    }

    if (!this.commissioningController.isCommissioned()) {
      this.log.info('***Commissioning controller is not commissioned: use matterbridge -controller -pairingcode [pairingcode] to commission a device');
      return;
    }

    const nodeIds = this.commissioningController.getCommissionedNodes();
    this.log.info(`***Commissioning controller is commissioned ${this.commissioningController.isCommissioned()} and has ${nodeIds.length} nodes commisioned: `);
    for (const nodeId of nodeIds) {
      this.log.info(`***Connecting to commissioned node: ${nodeId}`);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const node = await this.commissioningController.connectNode(nodeId, {
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

      //node.logStructure();

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
      this.log.warn(`Cluster: ${cluster.name} attributes:`);
      attributes.forEach((attribute) => {
        this.log.info(
          // eslint-disable-next-line max-len
          `- endpoint ${attribute.path.endpointId} cluster ${getClusterNameById(attribute.path.clusterId)} (${attribute.path.clusterId}) attribute ${attribute.path.attributeName} (${attribute.path.attributeId}): ${typeof attribute.value === 'object' ? stringify(attribute.value) : attribute.value}`,
        );
      });
      // Log PowerSourceCluster
      cluster = PowerSourceCluster;
      attributes = await interactionClient.getMultipleAttributes({
        attributes: [{ clusterId: cluster.id }],
      });
      this.log.warn(`Cluster: ${cluster.name} attributes:`);
      attributes.forEach((attribute) => {
        this.log.info(
          // eslint-disable-next-line max-len
          `- endpoint ${attribute.path.endpointId} cluster ${getClusterNameById(attribute.path.clusterId)} (${attribute.path.clusterId}) attribute ${attribute.path.attributeName} (${attribute.path.attributeId}): ${typeof attribute.value === 'object' ? stringify(attribute.value) : attribute.value}`,
        );
      });
      // Log ThreadNetworkDiagnostics
      cluster = ThreadNetworkDiagnosticsCluster;
      attributes = await interactionClient.getMultipleAttributes({
        attributes: [{ clusterId: cluster.id }],
      });
      this.log.warn(`Cluster: ${cluster.name} attributes:`);
      attributes.forEach((attribute) => {
        this.log.info(
          // eslint-disable-next-line max-len
          `- endpoint ${attribute.path.endpointId} cluster ${getClusterNameById(attribute.path.clusterId)} (${attribute.path.clusterId}) attribute ${attribute.path.attributeName} (${attribute.path.attributeId}): ${typeof attribute.value === 'object' ? stringify(attribute.value) : attribute.value}`,
        );
      });
    }
  }

  /**
   * Starts the Matterbridge based on the bridge mode.
   * If the bridge mode is 'bridge', it creates a commissioning server, matter aggregator,
   * and starts the matter server.
   * If the bridge mode is 'childbridge', it starts the plugins, creates commissioning servers,
   * and starts the matter server when all plugins are loaded and started.
   * @private
   * @returns {Promise<void>} A promise that resolves when the Matterbridge is started.
   */
  private async startMatterbridge(): Promise<void> {
    if (!this.storageManager) {
      this.log.error('No storage manager initialized');
      await this.cleanup('No storage manager initialized');
      return;
    }
    this.log.debug('Starting matterbridge in mode', this.bridgeMode);
    this.createMatterServer(this.storageManager);
    if (!this.matterServer) {
      this.log.error('No matter server initialized');
      await this.cleanup('No matter server initialized');
      return;
    }

    if (this.bridgeMode === 'bridge') {
      // Plugins are loaded by loadPlugin on startup and plugin.loaded is set to true
      // Plugins are started and configured by callback when Matterbridge is commissioned
      this.log.debug('***Starting startMatterbridge interval for Matterbridge');
      let failCount = 0;
      const startInterval = setInterval(async () => {
        for (const plugin of this.registeredPlugins) {
          if (!plugin.enabled) continue;
          if (!plugin.loaded) {
            this.log.info(`***Waiting (failSafeCount=${failCount}/30) in startMatterbridge interval for plugin ${plg}${plugin.name}${db} loaded: ${plugin.loaded}...`);
            failCount++;
            if (failCount > 30) {
              this.log.error(`***Failed to load plugin ${plg}${plugin.name}${er}`);
              plugin.error = true;
            } else {
              return;
            }
          }
        }
        clearInterval(startInterval);
        this.log.debug('***Cleared startMatterbridge interval for Matterbridge');

        this.log.debug(`Creating commissioning server context for ${plg}Matterbridge${db}`);
        this.matterbridgeContext = await this.createCommissioningServerContext('Matterbridge', 'Matterbridge', DeviceTypes.AGGREGATOR.code, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Aggregator');
        if (!this.matterbridgeContext) {
          this.log.error(`Error creating storage context for ${plg}Matterbridge${er}`);
          return;
        }
        if (!this.nodeContext) {
          this.log.error(`Node storage context undefined for ${plg}Matterbridge${er}`);
          return;
        }
        await this.matterbridgeContext.set('softwareVersion', 1);
        await this.matterbridgeContext.set('softwareVersionString', this.matterbridgeVersion);
        this.log.debug(`Creating commissioning server for ${plg}Matterbridge${db}`);
        this.commissioningServer = await this.createCommisioningServer(this.matterbridgeContext, 'Matterbridge');
        this.log.debug(`Creating matter aggregator for ${plg}Matterbridge${db}`);
        this.matterAggregator = await this.createMatterAggregator(this.matterbridgeContext);
        this.log.debug('Adding matterbridge aggregator to commissioning server');
        this.commissioningServer.addDevice(this.matterAggregator);
        this.log.debug('Adding matterbridge commissioning server to matter server');
        await this.matterServer?.addCommissioningServer(this.commissioningServer, { uniqueStorageKey: 'Matterbridge' });
        this.log.debug(`Setting reachability to true for ${plg}Matterbridge${db}`);
        this.commissioningServer.setReachability(true);
        this.log.debug('Starting matter server...');
        await this.startMatterServer();
        this.log.info('Matter server started');
        await this.showCommissioningQRCode(this.commissioningServer, this.matterbridgeContext, this.nodeContext, 'Matterbridge');
        //if (hasParameter('advertise')) await this.commissioningServer.advertise();
        /*
        setInterval(() => {
          this.matterAggregator?.getBridgedDevices().forEach((device) => {
            this.log.info(`Bridged device: ${dev}${device.name}${nf}`);
            device.getClusterServer(BridgedDeviceBasicInformationCluster)?.setReachableAttribute(true);
            device.getClusterServer(BridgedDeviceBasicInformationCluster)?.triggerReachableChangedEvent({ reachableNewValue: true });
          });
        }, 30 * 1000);
        */
      }, 1000);
    }

    if (this.bridgeMode === 'childbridge') {
      // Plugins are loaded and started by loadPlugin on startup
      // addDevice and addBridgedDeevice just register the devices that are added here to the plugin commissioning server for Accessory Platform
      // or to the plugin aggregator for Dynamic Platform after the commissioning is done
      // Plugins are configured by callback when the plugin is commissioned
      this.registeredPlugins.forEach((plugin) => {
        if (!plugin.enabled) return;

        // Start the interval to check if the plugins is started
        this.log.debug(`*Starting startMatterbridge interval for plugin ${plg}${plugin.name}${db} loaded: ${plugin.loaded} started: ${plugin.started}...`);
        let failCount = 0;
        const startInterval = setInterval(async () => {
          if (!plugin.loaded || !plugin.started /* || !plugin.configured*/) {
            this.log.info(`***Waiting (failSafeCount=${failCount}/30) in startMatterbridge interval for plugin ${plg}${plugin.name}${db} loaded: ${plugin.loaded} started: ${plugin.started}...`);
            failCount++;
            if (failCount > 30) {
              this.log.error(`***Failed to load plugin ${plg}${plugin.name}${er}`);
              plugin.error = true;
              clearInterval(startInterval);
            }
            return;
          }

          if (plugin.type === 'AccessoryPlatform') {
            for (const registeredDevice of this.registeredDevices) {
              if (registeredDevice.plugin !== plugin.name) continue;
              if (!plugin.storageContext) plugin.storageContext = await this.importCommissioningServerContext(plugin.name, registeredDevice.device);
              await plugin.storageContext.set('softwareVersion', 1);
              await plugin.storageContext.set('softwareVersionString', this.matterbridgeVersion);
              if (!plugin.commissioningServer) plugin.commissioningServer = await this.createCommisioningServer(plugin.storageContext, plugin.name);
              this.log.debug(`Adding device ${dev}${registeredDevice.device.name}${db} to commissioning server for plugin ${plg}${plugin.name}${db}`);
              plugin.commissioningServer.addDevice(registeredDevice.device);
            }
            this.log.debug(`Adding commissioning server to matter server for plugin ${plg}${plugin.name}${db}`);
            await this.matterServer?.addCommissioningServer(plugin.commissioningServer!, { uniqueStorageKey: plugin.name });
          }

          if (plugin.type === 'DynamicPlatform') {
            // eslint-disable-next-line max-len
            plugin.storageContext = await this.createCommissioningServerContext(plugin.name, 'Matterbridge', DeviceTypes.AGGREGATOR.code, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Dynamic Platform');
            await plugin.storageContext.set('softwareVersion', 1);
            await plugin.storageContext.set('softwareVersionString', this.matterbridgeVersion);
            plugin.commissioningServer = await this.createCommisioningServer(plugin.storageContext, plugin.name);
            this.log.debug(`Creating aggregator for plugin ${plg}${plugin.name}${db}`);
            plugin.aggregator = await this.createMatterAggregator(plugin.storageContext); // Generate serialNumber and uniqueId
            this.log.debug(`Adding matter aggregator to commissioning server for plugin ${plg}${plugin.name}${db}`);
            plugin.commissioningServer.addDevice(plugin.aggregator);
            this.log.debug(`Adding commissioning server to matter server for plugin ${plg}${plugin.name}${db}`);
            await this.matterServer?.addCommissioningServer(plugin.commissioningServer, { uniqueStorageKey: plugin.name });
          }

          clearInterval(startInterval);
          this.log.debug(`*Cleared startMatterbridge interval for plugin ${plg}${plugin.name}${db} loaded: ${plugin.loaded} started: ${plugin.started}...`);
        }, 1000);
      });

      // Start the interval to check if all plugins are loaded and started and so start the matter server
      // TODO set a counter or a timeout
      this.log.debug('*Starting start matter interval...');
      const startMatterInterval = setInterval(async () => {
        let allStarted = true;
        this.registeredPlugins.forEach((plugin) => {
          if (!plugin.enabled) return;
          if (plugin.error) return;
          if (plugin.enabled && (!plugin.loaded || !plugin.started)) allStarted = false;
          if (!allStarted) this.log.info(`***Waiting in start matter server interval for plugin ${plg}${plugin.name}${db} to load (${plugin.loaded}) and start (${plugin.started}) ...`);
        });
        if (!allStarted) return;
        clearInterval(startMatterInterval);
        this.log.info('Starting matter server...');

        // Setting reachability to true
        this.registeredPlugins.forEach((plugin) => {
          if (!plugin.enabled) return;
          this.log.debug(`Setting reachability to true for ${plg}${plugin.name}${db}`);
          plugin.commissioningServer?.setReachability(true);
          this.registeredDevices.forEach((registeredDevice) => {
            if (registeredDevice.plugin === plugin.name) {
              if (plugin.type === 'AccessoryPlatform') this.setReachableAttribute(registeredDevice.device, true);
              if (plugin.type === 'DynamicPlatform') registeredDevice.device.setBridgedDeviceReachability(true);
            }
          });
        });
        await this.startMatterServer();
        this.log.info('Matter server started');
        for (const plugin of this.registeredPlugins) {
          if (!plugin.enabled) continue;
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
        }
        Logger.defaultLogLevel = this.debugEnabled ? Level.DEBUG : Level.INFO;
        //clearInterval(startMatterInterval);
      }, 1000);
    }
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
    this.log.debug('Starting matter server');
    await this.matterServer.start();
    this.log.debug('Started matter server');
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
      throw new Error('importCommissioningServerContext error: cannot find the BasicInformationCluster');
    }
    //const random = 'CS' + CryptoNode.getRandomData(8).toHex();
    return await this.createCommissioningServerContext(
      pluginName,
      basic.getNodeLabelAttribute(),
      DeviceTypeId(device.deviceType),
      basic.getVendorIdAttribute(),
      basic.getVendorNameAttribute(),
      basic.getProductIdAttribute(),
      basic.getProductNameAttribute(),
      basic.attributes.serialNumber?.getLocal(),
      basic.attributes.uniqueId?.getLocal(),
      basic.getSoftwareVersionAttribute(),
      basic.getSoftwareVersionStringAttribute(),
      basic.getHardwareVersionAttribute(),
      basic.getHardwareVersionStringAttribute(),
    );
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
  private async createCommissioningServerContext(
    pluginName: string,
    deviceName: string,
    deviceType: DeviceTypeId,
    vendorId: number,
    vendorName: string,
    productId: number,
    productName: string,
    serialNumber?: string,
    uniqueId?: string,
    softwareVersion?: number,
    softwareVersionString?: string,
    hardwareVersion?: number,
    hardwareVersionString?: string,
  ) {
    if (!this.storageManager) {
      this.log.error('No storage manager initialized');
      process.exit(1);
    }
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
    await storageContext.set('softwareVersion', softwareVersion ?? 1);
    await storageContext.set('softwareVersionString', softwareVersionString ?? '1.0.0');
    await storageContext.set('hardwareVersion', hardwareVersion ?? 1);
    await storageContext.set('hardwareVersionString', hardwareVersionString ?? '1.0.0');
    this.log.debug(`Created commissioning server storage context for ${plg}${pluginName}${db}`);
    this.log.debug(`- softwareVersion: ${await storageContext.get('softwareVersion')} softwareVersionString: ${await storageContext.get('softwareVersionString')}`);
    this.log.debug(`- hardwareVersion: ${await storageContext.get('hardwareVersion')} hardwareVersionString: ${await storageContext.get('hardwareVersionString')}`);
    return storageContext;
  }

  /**
   * Shows the commissioning QR code for a given plugin.
   * @param {CommissioningServer} commissioningServer - The commissioning server instance.
   * @param {StorageContext} storageContext - The storage context instance.
   * @param {NodeStorage} nodeContext - The node storage instance.
   * @param {string} pluginName - The name of the plugin.
   * @returns {Promise<void>} - A promise that resolves when the QR code is shown.
   */
  private async showCommissioningQRCode(commissioningServer: CommissioningServer, storageContext: StorageContext, nodeContext: NodeStorage, pluginName: string) {
    if (!commissioningServer || !storageContext || !pluginName) return;
    if (!commissioningServer.isCommissioned()) {
      this.log.info(`***The commissioning server on port ${commissioningServer.getPort()} for ${plg}${pluginName}${nf} is not commissioned. Pair it scanning the QR code ...`);
      const { qrPairingCode, manualPairingCode } = commissioningServer.getPairingCode();
      storageContext.set('qrPairingCode', qrPairingCode);
      storageContext.set('manualPairingCode', manualPairingCode);
      await nodeContext.set<string>('qrPairingCode', qrPairingCode);
      await nodeContext.set<string>('manualPairingCode', manualPairingCode);
      const QrCode = new QrCodeSchema();
      this.log.info(`Pairing code:\n\n${QrCode.encode(qrPairingCode)}\n${plg}${pluginName}${nf}\n\nqrPairingCode: ${qrPairingCode}\n\nManual pairing code: ${manualPairingCode}\n`);
      if (pluginName !== 'Matterbridge') {
        const plugin = this.findPlugin(pluginName);
        if (plugin) {
          plugin.qrPairingCode = qrPairingCode;
          plugin.manualPairingCode = manualPairingCode;
          plugin.paired = false;
        }
      }
      await this.nodeContext?.set<RegisteredPlugin[]>('plugins', this.getBaseRegisteredPlugins());
    } else {
      this.log.info(`***The commissioning server on port ${commissioningServer.getPort()} for ${plg}${pluginName}${nf} is already commissioned . Waiting for controllers to connect ...`);
      if (pluginName !== 'Matterbridge') {
        const plugin = this.findPlugin(pluginName);
        if (plugin) {
          plugin.paired = true;
        }
      }
      await this.nodeContext?.set<RegisteredPlugin[]>('plugins', this.getBaseRegisteredPlugins());
    }
  }

  /**
   * Finds a plugin by its name.
   *
   * @param pluginName - The name of the plugin to find.
   * @returns The found plugin, or undefined if not found.
   */
  private findPlugin(pluginName: string) {
    const plugin = this.registeredPlugins.find((registeredPlugin) => registeredPlugin.name === pluginName);
    if (!plugin) {
      this.log.error(`Plugin ${plg}${pluginName}${er} not found`);
      return;
    }
    return plugin;
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

    const softwareVersion = await context.get('softwareVersion', 1);
    const softwareVersionString = await context.get('softwareVersionString', '1.0.0'); // Home app = Firmware Revision

    const hardwareVersion = await context.get('hardwareVersion', 1);
    const hardwareVersionString = await context.get('hardwareVersionString', '1.0.0');

    this.log.debug(`Creating matter commissioning server for plugin ${plg}${pluginName}${db} with deviceName ${deviceName} deviceType ${deviceType}(0x${deviceType.toString(16).padStart(4, '0')})`);
    this.log.debug(`Creating matter commissioning server for plugin ${plg}${pluginName}${db} with uniqueId ${uniqueId} serialNumber ${serialNumber}`);
    this.log.debug(`Creating matter commissioning server for plugin ${plg}${pluginName}${db} with softwareVersion ${softwareVersion} softwareVersionString ${softwareVersionString}`);
    this.log.debug(`Creating matter commissioning server for plugin ${plg}${pluginName}${db} with hardwareVersion ${hardwareVersion} hardwareVersionString ${hardwareVersionString}`);
    const commissioningServer = new CommissioningServer({
      port: this.port++,
      passcode: undefined,
      discriminator: undefined,
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
        const info = commissioningServer.getActiveSessionInformation(fabricIndex);
        let connected = false;
        info.forEach((session) => {
          this.log.debug(`***Active session changed on fabric ${fabricIndex} ${session.fabric?.rootVendorId}/${session.fabric?.label} for ${plg}${pluginName}${nf}`, debugStringify(session));
          if (session.isPeerActive === true && session.secure === true && session.numberOfActiveSubscriptions >= 1) {
            this.log.info(`***Controller ${session.fabric?.rootVendorId}/${session.fabric?.label} connected to ${plg}${pluginName}${nf}`);
            connected = true;
          }
        });
        if (connected) {
          if (this.bridgeMode === 'childbridge') {
            const plugin = this.findPlugin(pluginName);
            if (plugin) {
              plugin.paired = true;
              plugin.connected = true;
            }
          }

          setTimeout(() => {
            if (this.bridgeMode === 'bridge') {
              //Logger.defaultLogLevel = Level.INFO;
              for (const plugin of this.registeredPlugins) {
                if (!plugin.enabled) continue;
                this.startPlugin(plugin, 'Matterbridge is commissioned and controllers are connected', true); // No await do it asyncronously with also configurePlugin
              }
              Logger.defaultLogLevel = this.debugEnabled ? Level.DEBUG : Level.INFO;
            }
            if (this.bridgeMode === 'childbridge') {
              //Logger.defaultLogLevel = Level.INFO;
              const plugin = this.findPlugin(pluginName);
              if (plugin && plugin.type === 'DynamicPlatform' && plugin.configured !== true) {
                for (const registeredDevice of this.registeredDevices) {
                  if (registeredDevice.plugin === pluginName) {
                    this.log.info(`Adding bridged device ${dev}${registeredDevice.device.name}-${registeredDevice.device.deviceName}${nf} to aggregator for plugin ${plg}${plugin.name}${db}`);
                    if (!plugin.aggregator) {
                      this.log.error(`****Aggregator not found for plugin ${plg}${plugin.name}${er}`);
                      continue;
                    }
                    plugin.aggregator.addBridgedDevice(registeredDevice.device);
                    if (plugin.addedDevices !== undefined) plugin.addedDevices++;
                    this.log.info(
                      // eslint-disable-next-line max-len
                      `Added bridged device(${plugin.registeredDevices}/${plugin.addedDevices}) ${dev}${registeredDevice.device.name}-${registeredDevice.device.deviceName}${nf} for plugin ${plg}${plugin.name}${nf}`,
                    );
                    registeredDevice.added = true;
                  }
                }
              }
              for (const plugin of this.registeredPlugins) {
                if (plugin.name === pluginName && plugin.platform && plugin.configured !== true) {
                  this.configurePlugin(plugin); // No await do it asyncronously
                }
              }
              Logger.defaultLogLevel = this.debugEnabled ? Level.DEBUG : Level.INFO;
            }
            //logEndpoint(commissioningServer.getRootEndpoint());
          }, 2000);
        }
      },
      commissioningChangedCallback: async (fabricIndex) => {
        const info = commissioningServer.getCommissionedFabricInformation(fabricIndex);
        this.log.debug(`***Commissioning changed on fabric ${fabricIndex} for ${plg}${pluginName}${nf}`, debugStringify(info));
        if (info.length === 0) {
          this.log.warn(`***Commissioning removed from fabric ${fabricIndex} for ${plg}${pluginName}${nf}. Resetting the commissioning server ...`);
          await commissioningServer.factoryReset();
          if (pluginName === 'Matterbridge') {
            await this.matterbridgeContext?.clearAll();
          } else {
            for (const plugin of this.registeredPlugins) {
              if (plugin.name === pluginName) {
                await plugin.platform?.onShutdown('Commissioning removed by the controller');
                plugin.paired = false;
                plugin.connected = false;
                await plugin.storageContext?.clearAll();
              }
            }
          }
        }
      },
    });
    commissioningServer.addCommandHandler('testEventTrigger', async ({ request: { enableKey, eventTrigger } }) => this.log.info(`testEventTrigger called on GeneralDiagnostic cluster: ${enableKey} ${eventTrigger}`));
    return commissioningServer;
  }

  /**
   * Creates a Matter server using the provided storage manager.
   * @param storageManager The storage manager to be used by the Matter server.
   *
   */
  private createMatterServer(storageManager: StorageManager) {
    this.log.debug('Creating matter server');
    this.matterServer = new MatterServer(storageManager, { mdnsAnnounceInterface: undefined });
    this.log.debug('Created matter server');
  }

  /**
   * Creates a Matter Aggregator.
   * @param {StorageContext} context - The storage context.
   * @returns {Aggregator} - The created Matter Aggregator.
   */
  private async createMatterAggregator(context: StorageContext): Promise<Aggregator> {
    const random = 'AG' + CryptoNode.getRandomData(8).toHex();
    await context.set('aggregatorSerialNumber', await context.get('aggregatorSerialNumber', random));
    await context.set('aggregatorUniqueId', await context.get('aggregatorUniqueId', random));

    const matterAggregator = new Aggregator();
    matterAggregator.addClusterServer(
      ClusterServer(
        BasicInformationCluster,
        {
          dataModelRevision: 1,
          location: 'XX',
          vendorId: VendorId(0xfff1),
          vendorName: 'Matterbridge',
          productId: 0x8000,
          productName: 'Matterbridge aggregator',
          productLabel: 'Matterbridge aggregator',
          nodeLabel: 'Matterbridge aggregator',
          serialNumber: await context.get<string>('aggregatorSerialNumber'),
          uniqueId: await context.get<string>('aggregatorUniqueId'),
          softwareVersion: 1,
          softwareVersionString: 'v.1.0',
          hardwareVersion: 1,
          hardwareVersionString: 'v.1.0',
          reachable: true,
          capabilityMinima: { caseSessionsPerFabric: 3, subscriptionsPerFabric: 3 },
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
   * Stops the Matter server and associated controllers.
   */
  private async stopMatter() {
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
   * Retrieves the latest version of a package from the npm registry.
   * @param packageName - The name of the package.
   * @returns A Promise that resolves to the latest version of the package.
   */
  private async getLatestVersion(packageName: string): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(`npm view ${packageName} version`, (error: ExecException | null, stdout: string) => {
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
      exec('npm root -g', (error: ExecException | null, stdout: string) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }

  /**
   * Logs the node and system information.
   */
  private async logNodeAndSystemInfo() {
    // IP address information
    const networkInterfaces = os.networkInterfaces();
    this.systemInformation.ipv4Address = 'Not found';
    this.systemInformation.ipv6Address = 'Not found';
    for (const interfaceDetails of Object.values(networkInterfaces)) {
      if (!interfaceDetails) {
        break;
      }
      for (const detail of interfaceDetails) {
        if (detail.family === 'IPv4' && !detail.internal && this.systemInformation.ipv4Address === 'Not found') {
          this.systemInformation.ipv4Address = detail.address;
        } else if (detail.family === 'IPv6' && !detail.internal && this.systemInformation.ipv6Address === 'Not found') {
          this.systemInformation.ipv6Address = detail.address;
        }
      }
      // Break if both addresses are found to improve efficiency
      if (this.systemInformation.ipv4Address !== 'Not found' && this.systemInformation.ipv6Address !== 'Not found') {
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
    this.homeDirectory = os.homedir();
    this.matterbridgeInformation.homeDirectory = this.homeDirectory;
    this.log.debug(`Home Directory: ${this.homeDirectory}`);

    // Package root directory
    const currentFileDirectory = path.dirname(fileURLToPath(import.meta.url));
    this.rootDirectory = path.resolve(currentFileDirectory, '../');
    this.matterbridgeInformation.rootDirectory = this.rootDirectory;
    this.log.debug(`Root Directory: ${this.rootDirectory}`);

    // Global node_modules directory
    /*
    this.globalModulesDirectory = await this.getGlobalNodeModules();
    this.matterbridgeInformation.globalModulesDirectory = this.globalModulesDirectory;
    this.log.debug(`Global node_modules Directory: ${this.globalModulesDirectory}`);
    */
    if (this.nodeContext) this.globalModulesDirectory = await this.nodeContext.get<string>('globalModulesDirectory', '');
    this.log.debug(`Global node_modules Directory: ${this.globalModulesDirectory}`);
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

    // Create the data directory .matterbridge in the home directory
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
    /*
    this.matterbridgeLatestVersion = await this.getLatestVersion('matterbridge');
    this.matterbridgeInformation.matterbridgeLatestVersion = this.matterbridgeLatestVersion;
    this.log.debug(`Matterbridge Latest Version: ${this.matterbridgeLatestVersion}`);
    */
    if (this.nodeContext) this.matterbridgeLatestVersion = await this.nodeContext.get<string>('matterbridgeLatestVersion', '');
    this.log.debug(`Matterbridge Latest Version: ${this.matterbridgeLatestVersion}`);
    this.getLatestVersion('matterbridge')
      .then(async (matterbridgeLatestVersion) => {
        this.matterbridgeLatestVersion = matterbridgeLatestVersion;
        this.matterbridgeInformation.matterbridgeLatestVersion = this.matterbridgeLatestVersion;
        this.log.debug(`Matterbridge Latest Version: ${this.matterbridgeLatestVersion}`);
        await this.nodeContext?.set<string>('matterbridgeLatestVersion', this.matterbridgeLatestVersion);
        if (this.matterbridgeVersion !== this.matterbridgeLatestVersion) {
          this.log.warn(`Matterbridge is out of date. Current version: ${this.matterbridgeVersion}, Latest version: ${this.matterbridgeLatestVersion}`);
        }
      })
      .catch((error) => {
        this.log.error(`Error getting Matterbridge latest version: ${error}`);
      });

    // Current working directory
    const currentDir = process.cwd();
    this.log.debug(`Current Working Directory: ${currentDir}`);

    // Command line arguments (excluding 'node' and the script name)
    const cmdArgs = process.argv.slice(2).join(' ');
    this.log.debug(`Command Line Arguments: ${cmdArgs}`);
  }

  /**
   * Retrieves an array of base registered plugins.
   *
   * @returns {BaseRegisteredPlugin[]} An array of base registered plugins.
   */
  private getBaseRegisteredPlugins() {
    const baseRegisteredPlugins: BaseRegisteredPlugin[] = this.registeredPlugins.map((plugin) => ({
      path: plugin.path,
      type: plugin.type,
      name: plugin.name,
      version: plugin.version,
      description: plugin.description,
      author: plugin.author,
      enabled: plugin.enabled,
      loaded: plugin.loaded,
      started: plugin.started,
      configured: plugin.configured,
      paired: plugin.paired,
      connected: plugin.connected,
      registeredDevices: plugin.registeredDevices,
      qrPairingCode: plugin.qrPairingCode,
      manualPairingCode: plugin.manualPairingCode,
    }));
    return baseRegisteredPlugins;
  }

  /**
   * Retrieves an array of base registered devices from the registered plugins.
   * @returns {BaseRegisteredPlugin[]} An array of base registered devices.
   */
  private getBaseRegisteredDevices() {
    const baseRegisteredPlugins: BaseRegisteredPlugin[] = this.registeredPlugins.map((plugin) => ({
      path: plugin.path,
      type: plugin.type,
      name: plugin.name,
      version: plugin.version,
      description: plugin.description,
      author: plugin.author,
      enabled: plugin.enabled,
      loaded: plugin.loaded,
      started: plugin.started,
      paired: plugin.paired,
      connected: plugin.connected,
      registeredDevices: plugin.registeredDevices,
    }));
    return baseRegisteredPlugins;
  }

  /**
   * Initializes the frontend of Matterbridge.
   *
   * @param port The port number to run the frontend server on. Default is 3000.
   */
  async initializeFrontend(port: number = 8283): Promise<void> {
    this.log.debug(`Initializing the frontend on port ${YELLOW}${port}${db} static ${UNDERLINE}${path.join(this.rootDirectory, 'frontend/build')}${UNDERLINEOFF}${rs}`);
    this.expressApp = express();

    // Serve React build directory
    this.expressApp.use(express.static(path.join(this.rootDirectory, 'frontend/build')));

    // Endpoint to provide login code
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
        if (storedPassword === '' || password === storedPassword) res.json({ valid: true });
        else res.json({ valid: false });
      } catch (error) {
        res.json({ valid: false });
      }
    });

    // Endpoint to provide manual pairing code
    this.expressApp.get('/api/pairing-code', (req, res) => {
      this.log.debug('The frontend sent /api/pairing-code');
      if (!this.matterbridgeContext) {
        this.log.error('/api/pairing-code matterbridgeContext not found');
        res.json([]);
        return;
      }
      try {
        const qrData = { qrPairingCode: this.matterbridgeContext.get('qrPairingCode'), manualPairingCode: this.matterbridgeContext.get('manualPairingCode') };
        res.json(qrData);
      } catch (error) {
        if (this.bridgeMode === 'bridge') this.log.error('qrPairingCode for /api/qr-code not found');
        res.json({});
      }
    });

    // Endpoint to provide QR pairing code
    this.expressApp.get('/api/qr-code', (req, res) => {
      this.log.debug('The frontend sent /api/qr-code');
      if (!this.matterbridgeContext) {
        this.log.error('/api/qr-code matterbridgeContext not found');
        res.json([]);
        return;
      }
      try {
        const qrData = { qrPairingCode: this.matterbridgeContext.get('qrPairingCode'), manualPairingCode: this.matterbridgeContext.get('manualPairingCode') };
        res.json(qrData);
      } catch (error) {
        if (this.bridgeMode === 'bridge') this.log.error('qrPairingCode for /api/qr-code not found');
        res.json({});
      }
    });

    // Endpoint to provide system information
    this.expressApp.get('/api/system-info', (req, res) => {
      this.log.debug('The frontend sent /api/system-info');
      res.json(this.systemInformation);
    });

    // Endpoint to provide matterbridge information
    this.expressApp.get('/api/matterbridge-info', (req, res) => {
      this.log.debug('The frontend sent /api/matterbridge-info');
      this.matterbridgeInformation.bridgeMode = this.bridgeMode;
      this.matterbridgeInformation.debugEnabled = this.debugEnabled;
      res.json(this.matterbridgeInformation);
    });

    // Endpoint to provide plugins
    this.expressApp.get('/api/plugins', (req, res) => {
      this.log.debug('The frontend sent /api/plugins');
      res.json(this.getBaseRegisteredPlugins());
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
      const data: { clusterName: string; clusterId: string; attributeName: string; attributeId: string; attributeValue: string }[] = [];
      this.registeredDevices.forEach((registeredDevice) => {
        if (registeredDevice.plugin === selectedPluginName && registeredDevice.device.number === selectedDeviceEndpoint) {
          const clusterServers = registeredDevice.device.getAllClusterServers();
          clusterServers.forEach((clusterServer) => {
            Object.entries(clusterServer.attributes).forEach(([key, value]) => {
              if (clusterServer.name === 'EveHistory') return;
              //this.log.debug(`***--clusterServer: ${clusterServer.name}(${clusterServer.id}) attribute:${key}(${value.id}) ${value.isFixed} ${value.isWritable} ${value.isWritable}`);
              let attributeValue;
              try {
                if (typeof value.getLocal() === 'object') attributeValue = stringify(value.getLocal());
                else attributeValue = value.getLocal().toString();
              } catch (error) {
                attributeValue = 'Unavailable';
                this.log.debug(`****${error} in clusterServer: ${clusterServer.name}(${clusterServer.id}) attribute: ${key}(${value.id})`);
                //console.log(error);
              }
              data.push({
                clusterName: clusterServer.name,
                clusterId: '0x' + clusterServer.id.toString(16).padStart(2, '0'),
                attributeName: key,
                attributeId: '0x' + value.id.toString(16).padStart(2, '0'),
                attributeValue,
              });
            });
          });
        }
      });
      res.json(data);
    });

    // Endpoint to receive commands
    this.expressApp.post('/api/command/:command/:param', async (req, res) => {
      const command = req.params.command;
      let param = req.params.param;
      this.log.debug(`The frontend sent /api/command/${command}/${param}`);

      if (!command) {
        res.status(400).json({ error: 'No command provided' });
        return;
      }

      this.log.info(`Received frontend command: ${command}:${param}`);

      // Handle the command setpassword from Settings
      if (command === 'setpassword') {
        const password = param.slice(1, -1); // Remove the first and last characters
        this.log.info('setpassword', param, password);
        await this.nodeContext?.set('password', password);
      }

      // Handle the command debugLevel from Settings
      if (command === 'setloglevel') {
        if (param === 'Debug') {
          this.log.setLogDebug(true);
          this.debugEnabled = true;
          Logger.defaultLogLevel = Level.DEBUG;
        } else if (param === 'Info') {
          this.log.setLogDebug(false);
          this.debugEnabled = false;
          Logger.defaultLogLevel = Level.INFO;
        } else if (param === 'Warn') {
          this.log.setLogDebug(false);
          this.debugEnabled = false;
          Logger.defaultLogLevel = Level.WARN;
        }
        this.registeredPlugins.forEach((plugin) => {
          plugin.platform?.log.setLogDebug(this.debugEnabled);
        });
      }

      // Handle the command shutdown from Header
      if (command === 'shutdown') {
        this.shutdownProcess();
      }
      // Handle the command restart from Header
      if (command === 'restart') {
        this.restartProcess();
      }
      // Handle the command update from Header
      if (command === 'update') {
        this.log.warn(`***Updating matterbridge ${plg}${param}${db}`);
        try {
          await this.spawnCommand('npm', ['install', '-g', 'matterbridge']);
          this.log.info('Matterbridge has been updated. Full restart required.');
        } catch (error) {
          this.log.error('Error updating matterbridge');
          res.json({ message: 'Command received' });
          return;
        }
        this.updateProcess();
      }
      // Handle the command installplugin from Home
      if (command === 'installplugin') {
        param = param.replace(/\*/g, '\\');
        this.log.warn(`***Installing plugin ${plg}${param}${db}`);
        try {
          await this.spawnCommand('npm', ['install', '-g', param]);
          this.log.info(`Plugin ${plg}${param}${nf} installed. Restart required.`);
        } catch (error) {
          this.log.error(`Error installing plugin ${plg}${param}${er}`);
          res.json({ message: 'Command received' });
          return;
        }
      }
      // Handle the command addplugin from Home
      if (command === 'addplugin') {
        param = param.replace(/\*/g, '\\');
        if (this.registeredPlugins.find((plugin) => plugin.name === param)) {
          this.log.warn(`Plugin ${plg}${param}${wr} already added to matterbridge`);
          res.json({ message: 'Command received' });
          return;
        }
        const packageJsonPath = await this.resolvePluginName(param);
        if (!packageJsonPath) {
          this.log.error(`Error resolving plugin ${plg}${param}${er}`);
          res.json({ message: 'Command received' });
          return;
        }
        this.log.debug(`Loading plugin from ${plg}${packageJsonPath}${db}`);
        try {
          // Load the package.json of the plugin
          const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
          const plugin = { path: packageJsonPath, type: '', name: packageJson.name, version: packageJson.version, description: packageJson.description, author: packageJson.author, enabled: true };
          if (await this.loadPlugin(plugin)) {
            this.registeredPlugins.push(plugin);
            await this.nodeContext?.set<RegisteredPlugin[]>('plugins', this.getBaseRegisteredPlugins());
            this.log.info(`Plugin ${plg}${packageJsonPath}${nf} type ${plugin.type} added to matterbridge. Restart required.`);
          } else {
            this.log.error(`Error adding plugin ${plg}${packageJsonPath}${er}`);
          }
        } catch (error) {
          this.log.error(`Error adding plugin ${plg}${packageJsonPath}${er}`);
          res.json({ message: 'Command received' });
          return;
        }
      }
      // Handle the command removeplugin from Home
      if (command === 'removeplugin') {
        const index = this.registeredPlugins.findIndex((registeredPlugin) => registeredPlugin.name === param);
        if (index !== -1) {
          if (this.registeredPlugins[index].platform) {
            await this.registeredPlugins[index].platform?.onShutdown('The plugin has been removed.');
            await this.savePluginConfig(this.registeredPlugins[index]);
          }
          this.registeredPlugins.splice(index, 1);
          await this.nodeContext?.set<RegisteredPlugin[]>('plugins', this.getBaseRegisteredPlugins());
          this.log.info(`Plugin ${plg}${param}${nf} removed from matterbridge`);
        } else {
          this.log.warn(`Plugin ${plg}${param}${wr} not registered in matterbridge`);
        }
      }
      // Handle the command enableplugin from Home
      if (command === 'enableplugin') {
        const plugins = await this.nodeContext?.get<RegisteredPlugin[]>('plugins');
        if (!plugins) return;
        const plugin = plugins.find((plugin) => plugin.name === param);
        if (plugin) {
          plugin.enabled = true;
          plugin.loaded = undefined;
          plugin.started = undefined;
          plugin.configured = undefined;
          plugin.connected = undefined;
          await this.nodeContext?.set<RegisteredPlugin[]>('plugins', plugins);
          this.log.info(`Enabled plugin ${plg}${param}${nf}`);
        }
        if (this.bridgeMode === 'bridge') {
          const pluginToEnable = this.findPlugin(param);
          if (pluginToEnable) {
            pluginToEnable.enabled = true;
            pluginToEnable.platform = await this.loadPlugin(pluginToEnable);
            if (pluginToEnable.platform) {
              await this.startPlugin(pluginToEnable, 'The plugin has been enabled', true);
              pluginToEnable.enabled = false;
            } else {
              pluginToEnable.enabled = false;
              pluginToEnable.error = true;
              this.log.error(`Error enabling plugin ${plg}${param}${er}`);
            }
          }
        }
      }
      // Handle the command disableplugin from Home
      if (command === 'disableplugin') {
        const pluginToDisable = this.findPlugin(param);
        if (pluginToDisable) {
          if (pluginToDisable.platform) {
            await pluginToDisable.platform.onShutdown('The plugin has been removed.');
            await this.savePluginConfig(pluginToDisable);
          }
          pluginToDisable.enabled = false;
          pluginToDisable.loaded = undefined;
          pluginToDisable.started = undefined;
          pluginToDisable.configured = undefined;
          pluginToDisable.connected = undefined;
          pluginToDisable.platform = undefined;

          const plugins = await this.nodeContext?.get<RegisteredPlugin[]>('plugins');
          if (!plugins) return;
          const plugin = plugins.find((plugin) => plugin.name === param);
          if (plugin) {
            plugin.enabled = false;
            plugin.loaded = undefined;
            plugin.started = undefined;
            plugin.configured = undefined;
            plugin.connected = undefined;
            await this.nodeContext?.set<RegisteredPlugin[]>('plugins', plugins);
            this.log.info(`Disabled plugin ${plg}${param}${nf}`);
          }
        }
      }

      res.json({ message: 'Command received' });
    });

    // Fallback for routing
    this.expressApp.get('*', (req, res) => {
      this.log.debug('The frontend sent *', req.url);
      res.sendFile(path.join(this.rootDirectory, 'frontend/build/index.html'));
    });

    this.expressServer = this.expressApp.listen(port, () => {
      this.log.info(`The frontend is running on ${UNDERLINE}http://localhost:${port}${UNDERLINEOFF}${rs}`);
    });

    this.log.debug(`Frontend initialized on port ${YELLOW}${port}${db} static ${UNDERLINE}${path.join(this.rootDirectory, 'frontend/build')}${UNDERLINEOFF}${rs}`);
  }

  /**
   * Retrieves the cluster text from a given device.
   * @param device - The MatterbridgeDevice object.
   * @returns The attributes of the cluster servers in the device.
   */
  private getClusterTextFromDevice(device: MatterbridgeDevice) {
    let attributes = '';
    //this.log.debug(`getClusterTextFromDevice: ${device.name}`);
    const clusterServers = device.getAllClusterServers();
    clusterServers.forEach((clusterServer) => {
      //this.log.debug(`***--clusterServer: ${clusterServer.id} (${clusterServer.name})`);
      if (clusterServer.name === 'OnOff') attributes += `OnOff: ${clusterServer.getOnOffAttribute()} `;
      if (clusterServer.name === 'Switch') attributes += `Position: ${clusterServer.getCurrentPositionAttribute()} `;
      if (clusterServer.name === 'WindowCovering') attributes += `Cover position: ${clusterServer.attributes.currentPositionLiftPercent100ths.getLocal() / 100}% `;
      if (clusterServer.name === 'DoorLock') attributes += `State: ${clusterServer.attributes.lockState.getLocal() === 1 ? 'Locked' : 'Not locked'} `;
      if (clusterServer.name === 'Thermostat') attributes += `Temperature: ${clusterServer.attributes.localTemperature.getLocal() / 100}°C `;
      if (clusterServer.name === 'LevelControl') attributes += `Level: ${clusterServer.getCurrentLevelAttribute()}% `;
      if (clusterServer.name === 'ColorControl') attributes += `Hue: ${Math.round(clusterServer.getCurrentHueAttribute())} Saturation: ${Math.round(clusterServer.getCurrentSaturationAttribute())}% `;
      if (clusterServer.name === 'BooleanState') attributes += `Contact: ${clusterServer.getStateValueAttribute()} `;
      if (clusterServer.name === 'OccupancySensing') attributes += `Occupancy: ${clusterServer.getOccupancyAttribute().occupied} `;
      if (clusterServer.name === 'IlluminanceMeasurement') attributes += `Illuminance: ${clusterServer.getMeasuredValueAttribute()} `;
      if (clusterServer.name === 'AirQuality') attributes += `Air quality: ${clusterServer.getAirQualityAttribute()} `;
      if (clusterServer.name === 'TvocMeasurement') attributes += `Voc: ${clusterServer.getMeasuredValueAttribute()} `;
      if (clusterServer.name === 'TemperatureMeasurement') attributes += `Temperature: ${clusterServer.getMeasuredValueAttribute() / 100}°C `;
      if (clusterServer.name === 'RelativeHumidityMeasurement') attributes += `Humidity: ${clusterServer.getMeasuredValueAttribute() / 100}% `;
      if (clusterServer.name === 'PressureMeasurement') attributes += `Pressure: ${clusterServer.getMeasuredValueAttribute()} `;
    });
    return attributes;
  }
}
/*
TO IMPLEMENT

import { spawn } from 'child_process';

function restartProcess() {
  // Spawn a new process
  const newProcess = spawn(process.argv[0], process.argv.slice(1), {
    detached: true,
    stdio: 'inherit',
  });

  // Unreference the new process so that the current process can exit
  newProcess.unref();

  // Exit the current process
  process.exit();
}

import * as WebSocket from 'ws';
const globalModulesDir = require('global-modules');

const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', ws => {
  ws.on('message', message => {
    console.log(`Received message => ${message}`)
  });

  // Send a message to the frontend
  ws.send('Hello from backend!');
});

const ws = new WebSocket('ws://localhost:8080');

ws.onmessage = (event) => {
  console.log(`Received message => ${event.data}`);
};

*/
/*
// In Matterbridge
global.matterbridgeInstance = Matterbridge.loadInstance();

// In plugins
const matterbridge = global.matterbridgeInstance;
*/
/*
npx create-react-app matterbridge-frontend
cd matterbridge-frontend
npm install react-router-dom 

Success! Created frontend at C:\Users\lligu\OneDrive\GitHub\matterbridge\frontend
Inside that directory, you can run several commands:

  npm start
    Starts the development server.

  npm run build
    Bundles the app into static files for production.

  npm test
    Starts the test runner.

  npm run eject
    Removes this tool and copies build dependencies, configuration files
    and scripts into the app directory. If you do this, you can’t go back!

We suggest that you begin by typing:

  cd frontend
  npm start

Happy hacking!
PS C:\Users\lligu\OneDrive\GitHub\matterbridge> cd frontend
PS C:\Users\lligu\OneDrive\GitHub\matterbridge\frontend> npm run build

> frontend@0.1.0 build
> react-scripts build

Creating an optimized production build...
One of your dependencies, babel-preset-react-app, is importing the
"@babel/plugin-proposal-private-property-in-object" package without
declaring it in its dependencies. This is currently working because
"@babel/plugin-proposal-private-property-in-object" is already in your
node_modules folder for unrelated reasons, but it may break at any time.

babel-preset-react-app is part of the create-react-app project, which
is not maintianed anymore. It is thus unlikely that this bug will
ever be fixed. Add "@babel/plugin-proposal-private-property-in-object" to
your devDependencies to work around this error. This will make this message
go away.

Compiled successfully.

File sizes after gzip:

  46.65 kB  build\static\js\main.9b7ec296.js
  1.77 kB   build\static\js\453.8ab44547.chunk.js
  513 B     build\static\css\main.f855e6bc.css

The project was built assuming it is hosted at /.
You can control this with the homepage field in your package.json.

The build folder is ready to be deployed.
You may serve it with a static server:

  npm install -g serve
  serve -s build

Find out more about deployment here:

  https://cra.link/deployment

PS C:\Users\lligu\OneDrive\GitHub\matterbridge\frontend> 
*/
