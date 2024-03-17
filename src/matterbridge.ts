/**
 * This file contains the class Matterbridge.
 *
 * @file matterbridge.ts
 * @author Luca Liguori
 * @date 2023-12-29
 * @version 1.1.1
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
import { AnsiLogger, BRIGHT, RESET, TimestampFormat, UNDERLINE, UNDERLINEOFF, YELLOW, db, debugStringify, stringify, er, nf, rs, wr } from 'node-ansi-logger';
import { fileURLToPath, pathToFileURL } from 'url';
import { promises as fs } from 'fs';
import { ExecException, exec, spawn } from 'child_process';
import { Server } from 'http';
import express from 'express';
import os from 'os';
import path from 'path';

import { CommissioningController, CommissioningServer, MatterServer } from '@project-chip/matter-node.js';
import { BasicInformationCluster, BridgedDeviceBasicInformationCluster, ClusterServer } from '@project-chip/matter-node.js/cluster';
import { DeviceTypeId, EndpointNumber, VendorId } from '@project-chip/matter-node.js/datatype';
import { Aggregator, Device, DeviceTypes } from '@project-chip/matter-node.js/device';
import { Format, Level, Logger } from '@project-chip/matter-node.js/log';
import { QrCodeSchema } from '@project-chip/matter-node.js/schema';
import { StorageBackendDisk, StorageBackendJsonFile, StorageContext, StorageManager } from '@project-chip/matter-node.js/storage';
import { requireMinNodeVersion, getParameter, getIntParameter, hasParameter } from '@project-chip/matter-node.js/util';
import { CryptoNode } from '@project-chip/matter-node.js/crypto';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { logEndpoint } from '@project-chip/matter-node.js/device';
import EventEmitter from 'events';

/*

*/

// Define an interface of common elements from MatterbridgeDynamicPlatform and MatterbridgeAccessoryPlatform
interface MatterbridgePlatform {
  onStart(reason?: string): Promise<this>;
  onConfigure(): Promise<this>;
  onShutdown(reason?: string): Promise<this>;
  matterbridge: Matterbridge;
  log: AnsiLogger;
  name: string;
  type: string;
}

// Define an interface for storing the plugins
interface RegisteredPlugin extends BaseRegisteredPlugin {
  nodeContext?: NodeStorage;
  storageContext?: StorageContext;
  commissioningServer?: CommissioningServer;
  aggregator?: Aggregator;
  platform?: MatterbridgePlatform;
}

interface BaseRegisteredPlugin {
  path: string;
  type: string;
  name: string;
  version: string;
  description: string;
  author: string;
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
  public homeDirectory: string = '';
  public rootDirectory: string = '';
  public matterbridgeDirectory: string = '';
  public matterbridgePluginDirectory: string = '';
  public matterbridgeVersion: string = '';
  public matterbridgeLatestVersion: string = '';
  public globalModulesDir: string = '';

  public bridgeMode: 'bridge' | 'childbridge' | 'controller' | '' = '';
  public debugEnabled = false;

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
   * @returns The loaded instance of the Matterbridge class.
   */
  static async loadInstance(initialize = false) {
    if (!Matterbridge.instance) {
      // eslint-disable-next-line no-console
      console.log('Matterbridge instance does not exists');
      Matterbridge.instance = new Matterbridge();
      if (initialize) await Matterbridge.instance.initialize();
    } else {
      // eslint-disable-next-line no-console
      console.log('Matterbridge instance already exists');
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
    /*
    const wtf = await import('wtfnode');
    wtf.dump();
    */

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
      - list:                  list the registered plugins
      - add [plugin path]:     register the plugin from the given absolute or relative path
      - add [plugin name]:     register the globally installed plugin with the given name
      - remove [plugin path]:  remove the plugin from the given absolute or relative path
      - remove [plugin name]:  remove the globally installed plugin with the given name
      - enable [plugin path]:  enable the plugin from the given absolute or relative path
      - enable [plugin name]:  enable the globally installed plugin with the given name
      - disable [plugin path]: disable the plugin from the given absolute or relative path
      - disable [plugin name]: disable the globally installed plugin with the given name\n`);
      process.exit(0);
    }

    // set Matterbridge logger
    if (hasParameter('debug')) this.debugEnabled = true;
    this.log = new AnsiLogger({ logName: 'Matterbridge', logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: this.debugEnabled });
    this.log.debug('Matterbridge is starting...');

    // log system info and create .matterbridge directory
    await this.logNodeAndSystemInfo();
    this.log.info(
      // eslint-disable-next-line max-len
      `Matterbridge version ${this.matterbridgeVersion} mode ${hasParameter('bridge') ? 'bridge' : ''}${hasParameter('childbridge') ? 'childbridge' : ''} running on ${this.systemInformation.osType} ${this.systemInformation.osRelease} ${this.systemInformation.osPlatform} ${this.systemInformation.osArch}`,
    );

    // check node version and throw error
    requireMinNodeVersion(18);

    // register SIGINT SIGTERM signal handlers
    this.registerSignalHandlers();

    // set matter.js logger level and format
    Logger.defaultLogLevel = this.debugEnabled ? Level.DEBUG : Level.INFO;
    Logger.format = Format.ANSI;

    // Initialize NodeStorage
    this.log.debug('Creating node storage manager');
    this.nodeStorage = new NodeStorageManager({ dir: path.join(this.matterbridgeDirectory, 'storage'), logging: false });
    this.log.debug('Creating node storage context for matterbridge');
    this.nodeContext = await this.nodeStorage.createStorage('matterbridge');
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
    return new Promise((resolve, reject) => {
      const childProcess = spawn(command, args, {
        stdio: 'inherit',
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
    });
  }

  /**
   * Parses the command line arguments and performs the corresponding actions.
   * @private
   * @returns {Promise<void>} A promise that resolves when the command line arguments have been processed.
   */
  private async parseCommandLine(): Promise<void> {
    if (hasParameter('list')) {
      this.log.info('Registered plugins:');
      this.registeredPlugins.forEach((plugin, index) => {
        if (index === this.registeredPlugins.length - 1) {
          this.log.info(`└─┬─ ${plg}${plugin.name}${nf}: "${plg}${BRIGHT}${plugin.description}${RESET}${nf}" type: ${typ}${plugin.type}${nf} ${YELLOW}${plugin.enabled ? 'enabled' : 'disabled'}${nf}`);
          this.log.info(`  └─ ${db}${plugin.path}${db}`);
        } else {
          this.log.info(`├─┬─ ${plg}${plugin.name}${nf}: "${plg}${BRIGHT}${plugin.description}${RESET}${nf}" type: ${typ}${plugin.type}${nf} ${YELLOW}${plugin.enabled ? 'enabled' : 'disabled'}${nf}`);
          this.log.info(`│ └─ ${db}${plugin.path}${db}`);
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

    // Start the storage (we need it now for frontend and later for matterbridge)
    await this.startStorage('json', path.join(this.matterbridgeDirectory, 'matterbridge.json'));
    this.log.debug(`Creating commissioning server context for ${plg}Matterbridge${db}`);
    this.matterbridgeContext = this.createCommissioningServerContext('Matterbridge', 'Matterbridge', DeviceTypes.AGGREGATOR.code, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge aggregator');

    // Initialize frontend
    await this.initializeFrontend(getIntParameter('frontend'));

    if (hasParameter('test')) {
      this.bridgeMode = 'childbridge';
      MatterbridgeDevice.bridgeMode = 'childbridge';
      await this.testStartMatterBridge(); // No await do it asyncronously
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
      await this.startMatterBridge();
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
      await this.startMatterBridge();
    }
  }

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
      this.log.debug(`Trying at ${this.globalModulesDir}`);
      packageJsonPath = path.join(this.globalModulesDir, pluginPath);
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
   * Restarts the process by spawning a new process and exiting the current process.
   */
  private async restartProcess() {
    //this.log.info('Restarting still not implemented');
    //return;

    await this.cleanup('restarting...', true);
    this.hasCleanupStarted = false;
  }

  /**
   * Performs cleanup operations before shutting down Matterbridge.
   * @param message - The reason for the cleanup.
   */
  private async cleanup(message: string, restart = false) {
    if (!this.hasCleanupStarted) {
      this.hasCleanupStarted = true;
      this.log.info(message);

      process.removeAllListeners('SIGINT');
      process.removeAllListeners('SIGTERM');

      // Callint the shutdown functions with a reason
      for (const plugin of this.registeredPlugins) {
        if (plugin.platform) await plugin.platform.onShutdown('Matterbridge is closing: ' + message);
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
        this.log.debug(`*-- device: ${dev}${registeredDevice.device.name}${db} plugin ${plg}${registeredDevice.plugin}${db} type ${GREEN}${plugin.type}${db}`);
        if (this.bridgeMode === 'bridge') registeredDevice.device.setBridgedDeviceReachability(false);
        if (this.bridgeMode === 'childbridge' && plugin.type === 'DynamicPlatform') plugin.aggregator?.removeBridgedDevice(registeredDevice.device);
        if (this.bridgeMode === 'childbridge') plugin.commissioningServer?.setReachability(false);
        if (this.bridgeMode === 'childbridge' && plugin.type === 'AccessoryPlatform') this.setReachableAttribute(registeredDevice.device, false);
        if (this.bridgeMode === 'childbridge' && plugin.type === 'DynamicPlatform') registeredDevice.device.setBridgedDeviceReachability(false);
      });
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
      const cleanupTimeout1 = setTimeout(async () => {
        // Closing matter
        await this.stopMatter();

        // Closing storage
        await this.stopStorage();

        // Serialize registeredDevices
        if (this.nodeContext) {
          this.log.info('Saving registered devices...');
          const serializedRegisteredDevices: SerializedMatterbridgeDevice[] = [];
          this.registeredDevices.forEach((registeredDevice) => {
            serializedRegisteredDevices.push(registeredDevice.device.serialize(registeredDevice.plugin));
          });
          //console.log('serializedRegisteredDevices:', serializedRegisteredDevices);
          await this.nodeContext.set<SerializedMatterbridgeDevice[]>('devices', serializedRegisteredDevices);
          this.log.info('Saved registered devices');
          // Clear nodeContext and nodeStorage (they just need 1000ms to write the data to disk)
          this.nodeContext = undefined;
          this.nodeStorage = undefined;
        } else {
          this.log.error('Error saving registered devices: nodeContext not found!');
        }
        this.registeredPlugins = [];
        this.registeredDevices = [];

        const cleanupTimeout2 = setTimeout(async () => {
          if (restart) {
            this.log.info('Cleanup completed. Restarting...');
            Matterbridge.instance = undefined;
            this.emit('restart');
          } else {
            this.log.info('Cleanup completed. Shutting down...');
            Matterbridge.instance = undefined;
            this.emit('shutdown');
          }
        }, 2 * 1000);
        cleanupTimeout2.unref();
      }, 3 * 1000);
      cleanupTimeout1.unref();
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
      this.log.error(`Adding device ${dev}${device.name}-${device.deviceName}${er} for plugin ${plg}${pluginName}${er} error: matterAggregator not found`);
      return;
    }
    this.log.debug(`Adding device ${dev}${device.name}-${device.deviceName}${db} for plugin ${plg}${pluginName}${db}`);

    // Check if the plugin is registered
    const plugin = this.registeredPlugins.find((plugin) => plugin.name === pluginName);
    if (!plugin) {
      this.log.error(`Error adding device ${dev}${device.name}-${device.deviceName}${er} plugin ${plg}${pluginName}${er} not found`);
      return;
    }

    // Register and add the device to matterbridge aggregator in bridge mode
    if (this.bridgeMode === 'bridge') {
      this.matterAggregator?.addBridgedDevice(device);
      this.registeredDevices.push({ plugin: pluginName, device, added: true });
      if (plugin.registeredDevices !== undefined) plugin.registeredDevices++;
      if (plugin.addedDevices !== undefined) plugin.addedDevices++;
      this.log.info(`Added and registered device(${plugin.registeredDevices}/${plugin.addedDevices}) ${dev}${device.name}-${device.deviceName}${nf} for plugin ${plg}${pluginName}${nf}`);
    }

    // Only register the device in childbridge mode
    if (this.bridgeMode === 'childbridge') {
      this.registeredDevices.push({ plugin: pluginName, device, added: false });
      if (plugin.registeredDevices !== undefined) plugin.registeredDevices++;
      this.log.info(`Registered device ${dev}${device.name}-${device.deviceName}${nf} for plugin ${plg}${pluginName}${nf}`);
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
      this.log.error(`Adding bridged device ${dev}${device.name}-${device.deviceName}${er} for plugin ${plg}${pluginName}${er} error: matterAggregator not found`);
      return;
    }
    this.log.debug(`Adding bridged device ${db}${device.name}-${device.deviceName}${nf} for plugin ${plg}${pluginName}${db}`);

    // Check if the plugin is registered
    const plugin = this.registeredPlugins.find((plugin) => plugin.name === pluginName);
    if (!plugin) {
      this.log.error(`Error adding bridged device ${dev}${device.name}-${device.deviceName}${er} plugin ${plg}${pluginName}${er} not found`);
      return;
    }

    // Register and add the device to matterbridge aggregator in bridge mode
    if (this.bridgeMode === 'bridge') {
      this.matterAggregator?.addBridgedDevice(device);
      this.registeredDevices.push({ plugin: pluginName, device, added: true });
      if (plugin.registeredDevices !== undefined) plugin.registeredDevices++;
      if (plugin.addedDevices !== undefined) plugin.addedDevices++;
      this.log.info(`Added and registered bridged device(${plugin.registeredDevices}/${plugin.addedDevices}) ${dev}${device.name}-${device.deviceName}${nf} for plugin ${plg}${pluginName}${nf}`);
    }

    // Only register the device in childbridge mode
    if (this.bridgeMode === 'childbridge') {
      this.registeredDevices.push({ plugin: pluginName, device, added: false });
      if (plugin.registeredDevices !== undefined) plugin.registeredDevices++;
      this.log.info(`Registered bridged device ${dev}${device.name}-${device.deviceName}${nf} for plugin ${plg}${pluginName}${nf}`);
    }
  }

  async removeBridgedDevice(pluginName: string, device: MatterbridgeDevice): Promise<void> {
    if (this.bridgeMode === 'bridge' && !this.matterAggregator) {
      this.log.error(`Removing bridged device ${dev}${device.name}-${device.deviceName}${er} for plugin ${plg}${pluginName}${er} error: matterAggregator not found`);
      return;
    }
    this.log.debug(`Removing bridged device ${db}${device.name}-${device.deviceName}${nf} for plugin ${plg}${pluginName}${db}`);

    // Check if the plugin is registered
    const plugin = this.findPlugin(pluginName);
    if (!plugin) {
      this.log.error(`Error removing bridged device ${dev}${device.name}-${device.deviceName}${er} plugin ${plg}${pluginName}${er} not found`);
      return;
    }
    if (this.bridgeMode === 'childbridge' && !plugin.aggregator) {
      this.log.error(`Error removing bridged device ${dev}${device.name}-${device.deviceName}${er} plugin ${plg}${pluginName}${er} aggregator not found`);
      return;
    }
    if (this.bridgeMode === 'childbridge' && !plugin.connected) {
      this.log.error(`Error removing bridged device ${dev}${device.name}-${device.deviceName}${er} plugin ${plg}${pluginName}${er} not connected`);
      return;
    }

    // Register and add the device to matterbridge aggregator in bridge mode
    if (this.bridgeMode === 'bridge') {
      this.matterAggregator!.removeBridgedDevice(device);
      this.registeredDevices.forEach((registeredDevice, index) => {
        if (registeredDevice.device === device) {
          this.registeredDevices.splice(index, 1);
          return;
        }
      });
      if (plugin.registeredDevices !== undefined) plugin.registeredDevices--;
      if (plugin.addedDevices !== undefined) plugin.addedDevices--;
      this.log.info(`Rmoved bridged device(${plugin.registeredDevices}/${plugin.addedDevices}) ${dev}${device.name}-${device.deviceName}${nf} for plugin ${plg}${pluginName}${nf}`);
    }

    // Only register the device in childbridge mode
    if (this.bridgeMode === 'childbridge') {
      if (plugin.type === 'AccessoryPlatform') {
        this.log.warn(`Removing bridged device ${dev}${device.name}-${device.deviceName}${wr} for plugin ${plg}${pluginName}${wr} error: AccessoryPlatform not supported in childbridge mode`);
      } else if (plugin.type === 'DynamicPlatform') {
        this.registeredDevices.forEach((registeredDevice, index) => {
          if (registeredDevice.device === device) {
            this.registeredDevices.splice(index, 1);
            return;
          }
        });
        plugin.aggregator!.removeBridgedDevice(device);
      }
      if (plugin.registeredDevices !== undefined) plugin.registeredDevices--;
      if (plugin.addedDevices !== undefined) plugin.addedDevices--;
      this.log.info(`Removed bridged device(${plugin.registeredDevices}/${plugin.addedDevices}) ${dev}${device.name}-${device.deviceName}${nf} for plugin ${plg}${pluginName}${nf}`);
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
      this.log.warn(`Removing devices for plugin ${plg}${pluginName}${wr} error: AccessoryPlatform not supported in childbridge mode`);
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
    /*
    this.log.error('****Start forEach registeredPlugin');
    this.registeredPlugins
      .filter((plugin) => plugin.enabled === true)
      .forEach(async (plugin) => {
        plugin.loaded = false;
        plugin.started = false;
        plugin.configured = false;
        plugin.connected = undefined;
        this.log.error(`****Starting registeredPlugin ${plugin.name}`);
        this.loadPlugin(plugin, true, 'Matterbridge is starting');
      });
    this.log.error('****Stop forEach registeredPlugin');
    */
    /*  
    for (const plugin of this.registeredPlugins) {
      if (!plugin.enabled) continue;
      // No await do it asyncronously
      this.loadPlugin(plugin)
        .then(() => {
          // No await do it asyncronously
          this.startPlugin(plugin)
            .then(() => {})
            .catch((err) => {
              this.log.error(`Failed to start plugin ${plg}${plugin.name}${er}: ${err}`);
            });
        })
        .catch((err) => {
          this.log.error(`Failed to load plugin ${plg}${plugin.name}${er}: ${err}`);
        });
    }
    for (const plugin of this.registeredPlugins) {
      if (!plugin.enabled) continue;
      // Start the interval to check if the plugin is loaded and started
      let times = 0;
      const interval = setInterval(() => {
        times++;
        this.log.info(`Waiting ${times} secs for plugin ${plg}${plugin.name}${db} to load (${plugin.loaded}) and start (${plugin.started}) and send devices ...`);
        if (!plugin.loaded || !plugin.started) return;
        this.log.info(`Plugin ${plg}${plugin.name}${db} sent ${plugin.registeredDevices} devices`);
        clearInterval(interval);
      }, 1000);
    }
    */
  }

  private async startPlugin(plugin: RegisteredPlugin, message?: string, configure = false): Promise<void> {
    if (!plugin.loaded || !plugin.platform) {
      this.log.error(`Plugin ${plg}${plugin.name}${er} not loaded or no platform`);
      return Promise.reject(new Error(`Plugin ${plg}${plugin.name}${er} not loaded or no platform`));
    }
    if (plugin.started) {
      this.log.error(`Plugin ${plg}${plugin.name}${er} already started`);
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

  private async configurePlugin(plugin: RegisteredPlugin): Promise<void> {
    if (!plugin.loaded || !plugin.started || !plugin.platform) {
      this.log.error(`Plugin ${plg}${plugin.name}${er} not loaded or not started or not platform`);
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

  private async loadPlugin(plugin: RegisteredPlugin, start = false, message = ''): Promise<MatterbridgePlatform> {
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
        const platform = pluginInstance.default(this, new AnsiLogger({ logName: plugin.description, logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: this.debugEnabled }));
        platform.name = packageJson.name;
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
        return Promise.reject(new Error(`Plugin ${plg}${plugin.name}${er} does not provide a default export`));
      }
    } catch (err) {
      this.log.error(`Failed to load plugin ${plg}${plugin.name}${er}: ${err}`);
      return Promise.reject(new Error(`Failed to load plugin ${plg}${plugin.name}${er}: ${err}`));
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
  private async startMatterBridge(): Promise<void> {
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
      this.log.debug(`Creating commissioning server context for ${plg}Matterbridge${db}`);
      this.matterbridgeContext = this.createCommissioningServerContext('Matterbridge', 'Matterbridge', DeviceTypes.AGGREGATOR.code, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge aggregator');
      if (!this.matterbridgeContext) {
        this.log.error(`Error creating storage context${er}`);
        return;
      }
      this.log.debug(`Creating commissioning server for ${plg}Matterbridge${db}`);
      this.commissioningServer = this.createCommisioningServer(this.matterbridgeContext, 'Matterbridge');
      this.log.debug(`Creating matter aggregator for ${plg}Matterbridge${db}`);
      this.matterAggregator = this.createMatterAggregator(this.matterbridgeContext);
      this.log.debug('Adding matterbridge aggregator to commissioning server');
      this.commissioningServer.addDevice(this.matterAggregator);
      this.log.debug('Adding matterbridge commissioning server to matter server');
      await this.matterServer.addCommissioningServer(this.commissioningServer, { uniqueStorageKey: 'Matterbridge' });
      this.log.debug('Starting matter server');
      await this.startMatterServer();
      this.showCommissioningQRCode(this.commissioningServer, this.matterbridgeContext, 'Matterbridge');
    }

    if (this.bridgeMode === 'childbridge') {
      // Plugins are loaded and started by loadPlugin on startup
      // addDevice and addBridgedDeevice just register the devices that are added here to the plugin commissioning server for Accessory Platform
      // or to the plugin aggregator for Dynamic Platform after the commissioning is done
      // Plugins are configured by callback when the plugin is commissioned
      this.registeredPlugins.forEach((plugin) => {
        if (!plugin.enabled) return;

        // Start the interval to check if the plugins is started
        // TODO set a counter or a timeout
        this.log.debug(`*Starting startMatterBridge interval for plugin ${plg}${plugin.name}${db} loaded: ${plugin.loaded} started: ${plugin.started}...`);
        const startInterval = setInterval(async () => {
          if (!this.matterServer) {
            this.log.error('No matter server initialized');
            await this.cleanup('No matter server initialized');
            return;
          }
          if (!plugin.loaded || !plugin.started) {
            this.log.info(`**Waiting in startMatterBridge interval for plugin ${plg}${plugin.name}${db} loaded: ${plugin.loaded} started: ${plugin.started}...`);
            return;
          }

          if (plugin.type === 'AccessoryPlatform') {
            this.registeredDevices
              .filter((registeredDevice) => registeredDevice.plugin === plugin.name)
              .forEach((registeredDevice) => {
                if (!plugin.storageContext) plugin.storageContext = this.importCommissioningServerContext(plugin.name, registeredDevice.device);
                if (!plugin.commissioningServer) plugin.commissioningServer = this.createCommisioningServer(plugin.storageContext, plugin.name);
                this.log.debug(`Adding device ${dev}${registeredDevice.device.name}${db} to commissioning server for plugin ${plg}${plugin.name}${db}`);
                plugin.commissioningServer.addDevice(registeredDevice.device);
              });
            this.log.debug(`Adding commissioning server to matter server for plugin ${plg}${plugin.name}${db}`);
            await this.matterServer.addCommissioningServer(plugin.commissioningServer!, { uniqueStorageKey: plugin.name });
          }

          if (plugin.type === 'DynamicPlatform') {
            plugin.storageContext = this.createCommissioningServerContext(
              plugin.name,
              'Matterbridge Dynamic Platform',
              DeviceTypes.AGGREGATOR.code,
              0xfff1,
              'Matterbridge',
              0x8000,
              'Dynamic Platform',
            );
            plugin.commissioningServer = this.createCommisioningServer(plugin.storageContext, plugin.name);
            this.log.debug(`Creating aggregator for plugin ${plg}${plugin.name}${db}`);
            plugin.aggregator = this.createMatterAggregator(plugin.storageContext); // Generate serialNumber and uniqueId
            this.log.debug(`Adding matter aggregator to commissioning server for plugin ${plg}${plugin.name}${db}`);
            plugin.commissioningServer.addDevice(plugin.aggregator);
            this.log.debug(`Adding commissioning server to matter server for plugin ${plg}${plugin.name}${db}`);
            await this.matterServer.addCommissioningServer(plugin.commissioningServer, { uniqueStorageKey: plugin.name });
          }

          clearInterval(startInterval);
        }, 1000);
      });

      // Start the interval to check if all plugins are loaded and started and so start the matter server
      // TODO set a counter or a timeout
      this.log.debug('*Starting start matter interval...');
      const startMatterInterval = setInterval(async () => {
        let allStarted = true;
        this.registeredPlugins.forEach((plugin) => {
          if (!plugin.enabled) return;
          if (plugin.enabled && (!plugin.loaded || !plugin.started)) allStarted = false;
          if (!allStarted) this.log.info(`**Waiting in start matter server interval for plugin ${plg}${plugin.name}${db} to load (${plugin.loaded}) and start (${plugin.started}) ...`);
        });
        if (!allStarted) return;
        this.log.info('Starting matter server');

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
        for (const plugin of this.registeredPlugins) {
          this.showCommissioningQRCode(plugin.commissioningServer, plugin.storageContext, plugin.name);
        }
        Logger.defaultLogLevel = this.debugEnabled ? Level.DEBUG : Level.INFO;
        clearInterval(startMatterInterval);
      }, 1000);
      return;
    }
  }

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
  private importCommissioningServerContext(pluginName: string, device: MatterbridgeDevice) {
    this.log.debug(`Importing matter commissioning server storage context from device for ${plg}${pluginName}${db}`);
    const basic = device.getClusterServer(BasicInformationCluster);
    if (!basic) {
      throw new Error('importCommissioningServerContext error: cannot find the BasicInformationCluster');
    }
    //const random = 'CS' + CryptoNode.getRandomData(8).toHex();
    return this.createCommissioningServerContext(
      pluginName,
      basic.getNodeLabelAttribute(),
      DeviceTypeId(device.deviceType),
      basic.getVendorIdAttribute(),
      basic.getVendorNameAttribute(),
      basic.getProductIdAttribute(),
      basic.getProductNameAttribute(),
      basic.attributes.serialNumber?.getLocal(),
      basic.attributes.uniqueId?.getLocal(),
      basic.attributes.softwareVersion?.getLocal(),
      basic.attributes.softwareVersionString?.getLocal(),
      basic.attributes.hardwareVersion?.getLocal(),
      basic.attributes.hardwareVersionString?.getLocal(),
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
  private createCommissioningServerContext(
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
    storageContext.set('deviceName', deviceName);
    storageContext.set('deviceType', deviceType);
    storageContext.set('vendorId', vendorId);
    storageContext.set('vendorName', vendorName.slice(0, 32));
    storageContext.set('productId', productId);
    storageContext.set('productName', productName.slice(0, 32));
    storageContext.set('nodeLabel', productName.slice(0, 32));
    storageContext.set('productLabel', productName.slice(0, 32));
    storageContext.set('serialNumber', storageContext.get('serialNumber', random));
    storageContext.set('uniqueId', storageContext.get('uniqueId', random));
    storageContext.set('softwareVersion', softwareVersion ?? 1);
    storageContext.set('softwareVersionString', softwareVersionString ?? '1.0.0');
    storageContext.set('hardwareVersion', hardwareVersion ?? 1);
    storageContext.set('hardwareVersionString', hardwareVersionString ?? '1.0.0');
    return storageContext;
  }

  /**
   * Shows the commissioning QR code for a given commissioning server, storage context, and name.
   * If any of the parameters are missing, the method returns early.
   * If the commissioning server is not commissioned, it logs the QR code and pairing code.
   * If the commissioning server is already commissioned, it waits for controllers to connect.
   * If the bridge mode is 'childbridge', it sets the 'paired' property of the plugin to true.
   *
   * @param commissioningServer - The commissioning server to show the QR code for.
   * @param storageContext - The storage context to store the pairing codes.
   * @param pluginName - The name of the commissioning server.
   */
  private async showCommissioningQRCode(commissioningServer?: CommissioningServer, storageContext?: StorageContext, pluginName?: string) {
    if (!commissioningServer || !storageContext || !pluginName) return;
    if (!commissioningServer.isCommissioned()) {
      this.log.info(`***The commissioning server for ${plg}${pluginName}${nf} is not commissioned. Pair it scanning the QR code ...`);
      const { qrPairingCode, manualPairingCode } = commissioningServer.getPairingCode();
      storageContext.set('qrPairingCode', qrPairingCode);
      storageContext.set('manualPairingCode', manualPairingCode);
      const QrCode = new QrCodeSchema();
      this.log.info(`Pairing code:\n\n${QrCode.encode(qrPairingCode)}\nManual pairing code: ${manualPairingCode}\n`);
      if (this.bridgeMode === 'bridge') {
        await this.nodeContext?.set<string>('qrPairingCode', qrPairingCode);
        await this.nodeContext?.set<string>('manualPairingCode', manualPairingCode);
      }
      if (this.bridgeMode === 'childbridge') {
        const plugin = this.findPlugin(pluginName);
        if (plugin) {
          await plugin.nodeContext?.set<string>('qrPairingCode', qrPairingCode);
          await plugin.nodeContext?.set<string>('manualPairingCode', manualPairingCode);
          await this.nodeContext?.set<RegisteredPlugin[]>('plugins', this.getBaseRegisteredPlugins());
          plugin.paired = false;
        }
      }
    } else {
      this.log.info(`***The commissioning server for ${plg}${pluginName}${nf} is already commissioned. Waiting for controllers to connect ...`);
      if (this.bridgeMode === 'bridge') {
        const qrPairingCode = storageContext.get('qrPairingCode', '');
        const manualPairingCode = storageContext.get('manualPairingCode', '');
        await this.nodeContext?.set<string>('qrPairingCode', qrPairingCode);
        await this.nodeContext?.set<string>('manualPairingCode', manualPairingCode);
      }
      if (this.bridgeMode === 'childbridge') {
        const plugin = this.findPlugin(pluginName);
        if (plugin && plugin.storageContext && plugin.nodeContext) {
          plugin.qrPairingCode = plugin.storageContext.get('qrPairingCode', '');
          plugin.manualPairingCode = plugin.storageContext.get('manualPairingCode', '');
          await plugin.nodeContext.set<string>('qrPairingCode', plugin.qrPairingCode);
          await plugin.nodeContext.set<string>('manualPairingCode', plugin.manualPairingCode);
          await this.nodeContext?.set<RegisteredPlugin[]>('plugins', this.getBaseRegisteredPlugins());
          plugin.paired = true;
        }
      }
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
   * @param {string} name - The name of the commissioning server.
   * @returns {CommissioningServer} The created commissioning server.
   */
  private createCommisioningServer(context: StorageContext, name: string): CommissioningServer {
    this.log.debug(`Creating matter commissioning server for plugin ${plg}${name}${db}`);
    const deviceName = context.get('deviceName') as string;
    const deviceType = context.get('deviceType') as DeviceTypeId;

    const vendorId = context.get('vendorId') as number;
    const vendorName = context.get('vendorName') as string; // Home app = Manufacturer

    const productId = context.get('productId') as number;
    const productName = context.get('productName') as string; // Home app = Model

    const serialNumber = context.get('serialNumber') as string;
    const uniqueId = context.get('uniqueId') as string;

    this.log.debug(
      // eslint-disable-next-line max-len
      `Creating matter commissioning server for plugin ${plg}${name}${db} with deviceName ${deviceName} deviceType ${deviceType}(0x${deviceType.toString(16).padStart(4, '0')}) uniqueId ${uniqueId} serialNumber ${serialNumber}`,
    );
    const commissioningServer = new CommissioningServer({
      port: undefined,
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
        softwareVersion: context.get('softwareVersion', 1),
        softwareVersionString: context.get('softwareVersionString', '1.0.0'), // Home app = Firmware Revision
        hardwareVersion: context.get('hardwareVersion', 1),
        hardwareVersionString: context.get('hardwareVersionString', '1.0.0'),
        uniqueId,
        serialNumber,
        reachable: true,
      },
      activeSessionsChangedCallback: (fabricIndex) => {
        const info = commissioningServer.getActiveSessionInformation(fabricIndex);
        let connected = false;
        info.forEach((session) => {
          this.log.debug(`***Active session changed on fabric ${fabricIndex} ${session.fabric?.rootVendorId}/${session.fabric?.label} for ${plg}${name}${nf}`, debugStringify(session));
          if (session.isPeerActive === true && session.secure === true && session.numberOfActiveSubscriptions >= 1) {
            this.log.info(`***Controller ${session.fabric?.rootVendorId}/${session.fabric?.label} connected to ${plg}${name}${nf}`);
            connected = true;
          }
        });
        if (connected) {
          if (this.bridgeMode === 'childbridge') {
            const plugin = this.findPlugin(name);
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
                //this.configurePlugin(plugin); // No await do it asyncronously
              }
              Logger.defaultLogLevel = this.debugEnabled ? Level.DEBUG : Level.INFO;
            }
            if (this.bridgeMode === 'childbridge') {
              //Logger.defaultLogLevel = Level.INFO;
              const plugin = this.findPlugin(name);
              if (plugin && plugin.type === 'DynamicPlatform' && plugin.configured !== true) {
                for (const registeredDevice of this.registeredDevices) {
                  if (registeredDevice.plugin === name) {
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
                if (plugin.name === name && plugin.platform && plugin.configured !== true) {
                  this.configurePlugin(plugin); // No await do it asyncronously
                }
              }
              Logger.defaultLogLevel = this.debugEnabled ? Level.DEBUG : Level.INFO;
            }
            //logEndpoint(commissioningServer.getRootEndpoint());
          }, 2000);
        }
      },
      commissioningChangedCallback: (fabricIndex) => {
        const info = commissioningServer.getCommissionedFabricInformation(fabricIndex);
        this.log.debug(`***Commissioning changed on fabric ${fabricIndex} for ${plg}${name}${nf}`, debugStringify(info));
        if (info.length === 0) {
          this.log.warn(`***Commissioning removed from fabric ${fabricIndex} for ${plg}${name}${nf}. Resetting the commissioning server ...`);
          commissioningServer.factoryReset(); // TODO delete from storage also "matterbridge-eve-weather.EndpointStructure"
        }
      },
    });
    commissioningServer.addCommandHandler('testEventTrigger', async ({ request: { enableKey, eventTrigger } }) =>
      this.log.info(`testEventTrigger called on GeneralDiagnostic cluster: ${enableKey} ${eventTrigger}`),
    );
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
  private createMatterAggregator(context: StorageContext): Aggregator {
    const random = 'AG' + CryptoNode.getRandomData(8).toHex();
    context.set('aggregatorSerialNumber', context.get('aggregatorSerialNumber', random));
    context.set('aggregatorUniqueId', context.get('aggregatorUniqueId', random));

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
          serialNumber: context.get<string>('aggregatorSerialNumber'),
          uniqueId: context.get<string>('aggregatorUniqueId'),
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
    this.log.debug(`Home Directory: ${this.homeDirectory}`);

    // Package root directory
    const currentFileDirectory = path.dirname(fileURLToPath(import.meta.url));
    this.rootDirectory = path.resolve(currentFileDirectory, '../');
    this.log.debug(`Root Directory: ${this.rootDirectory}`);

    // Global node_modules directory
    this.globalModulesDir = await this.getGlobalNodeModules();
    this.log.debug(`Global node_modules Directory: ${this.globalModulesDir}`);

    // Create the data directory .matterbridge in the home directory
    this.matterbridgeDirectory = path.join(this.homeDirectory, '.matterbridge');
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
    this.log.debug(`Matterbridge Version: ${this.matterbridgeVersion}`);

    this.matterbridgeLatestVersion = await this.getLatestVersion('matterbridge');
    this.log.debug(`Matterbridge Latest Version: ${this.matterbridgeLatestVersion}`);

    if (this.matterbridgeVersion !== this.matterbridgeLatestVersion) {
      this.log.warn(`Matterbridge is out of date. Current version: ${this.matterbridgeVersion}, Latest version: ${this.matterbridgeLatestVersion}`);
    }

    // Current working directory
    const currentDir = process.cwd();
    this.log.debug(`Current Working Directory: ${currentDir}`);

    // Command line arguments (excluding 'node' and the script name)
    const cmdArgs = process.argv.slice(2).join(' ');
    this.log.debug(`Command Line Arguments: ${cmdArgs}`);
  }

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
  async initializeFrontend(port: number = 3000): Promise<void> {
    this.log.debug(`Initializing the frontend on port ${YELLOW}${port}${db} static ${UNDERLINE}${path.join(this.rootDirectory, 'frontend/build')}${UNDERLINEOFF}${rs}`);
    this.expressApp = express();

    // Serve React build directory
    this.expressApp.use(express.static(path.join(this.rootDirectory, 'frontend/build')));

    // Endpoint to provide QR pairing code
    this.expressApp.get('/api/qr-code', (req, res) => {
      this.log.debug('The frontend sent /api/qr-code');
      if (!this.matterbridgeContext) {
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
          endpoint: registeredDevice.device.id,
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
        if (registeredDevice.plugin === selectedPluginName && registeredDevice.device.id === selectedDeviceEndpoint) {
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
      const param = req.params.param;
      this.log.debug(`The frontend sent /api/command/${command}/${param}`);

      if (!command) {
        res.status(400).json({ error: 'No command provided' });
        return;
      }

      this.log.info(`***Received command: ${command}:${param}`);

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

      // Handle the command debugLevel from Header
      if (command === 'restart') {
        this.restartProcess();
      }
      // Handle the command update from Header
      if (command === 'update') {
        this.log.warn(`The /api/command/${command} is not yet implemented`);
      }
      // Handle the command addplugin from Header
      if (command === 'addplugin') {
        this.log.warn(`The /api/command/${command}/${param} is not yet implemented`);
      }
      // Handle the command enableplugin from Home
      if (command === 'enableplugin') {
        const plugin = this.findPlugin(param);
        if (plugin) {
          plugin.enabled = true;
          plugin.loaded = undefined;
          plugin.started = undefined;
          plugin.configured = undefined;
          plugin.connected = undefined;
          await this.nodeContext?.set<RegisteredPlugin[]>('plugins', this.getBaseRegisteredPlugins());
          this.log.info(`Enabled plugin ${plg}${param}${nf}`);
        }
      }
      // Handle the command disableplugin from Home
      if (command === 'disableplugin') {
        const plugin = this.findPlugin(param);
        if (plugin) {
          plugin.enabled = false;
          plugin.loaded = undefined;
          plugin.started = undefined;
          plugin.configured = undefined;
          plugin.connected = undefined;
          await this.nodeContext?.set<RegisteredPlugin[]>('plugins', this.getBaseRegisteredPlugins());
          this.log.info(`Disabled plugin ${plg}${param}${nf}`);
        }
      }

      res.json({ message: 'Command received' });
    });

    // Fallback for routing
    this.expressApp.get('*', (req, res) => {
      this.log.warn('The frontend sent *', req.url);
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
      if (clusterServer.name === 'LevelControl') attributes += `Level: ${clusterServer.getCurrentLevelAttribute()}% `;
      if (clusterServer.name === 'ColorControl') attributes += `Hue: ${clusterServer.getCurrentHueAttribute()} Saturation: ${clusterServer.getCurrentSaturationAttribute()}% `;
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
