/* eslint-disable @typescript-eslint/no-unused-vars */
import { MatterbridgeDevice } from './matterbridgeDevice.js';
import { NodeStorageManager, NodeStorage, NodeStorageKey, NodeStorageName } from 'node-persist-manager';
import {
  AnsiLogger,
  BLUE,
  BRIGHT,
  DIM,
  GREEN,
  RESET,
  REVERSE,
  REVERSEOFF,
  TimestampFormat,
  UNDERLINE,
  UNDERLINEOFF,
  YELLOW,
  db,
  debugStringify,
  nf,
  pl,
  rs,
  stringify,
} from 'node-ansi-logger';
import { fileURLToPath, pathToFileURL } from 'url';
import { promises as fs } from 'fs';
import EventEmitter from 'events';
import express from 'express';
import os from 'os';
import path from 'path';

import { CommissioningController, CommissioningServer, MatterServer } from '@project-chip/matter-node.js';
import { DeviceTypeId, EndpointNumber, VendorId } from '@project-chip/matter-node.js/datatype';
import { Aggregator, Device, DeviceTypes } from '@project-chip/matter-node.js/device';
import { Format, Level, Logger } from '@project-chip/matter-node.js/log';
import { QrCodeSchema } from '@project-chip/matter-node.js/schema';
import { StorageBackendDisk, StorageBackendJsonFile, StorageContext, StorageManager } from '@project-chip/matter-node.js/storage';
import { requireMinNodeVersion, getParameter, getIntParameter, hasParameter } from '@project-chip/matter-node.js/util';
import { logEndpoint } from '@project-chip/matter-node.js/device';
import { CryptoNode } from '@project-chip/matter-node.js/crypto';
import { BasicInformationCluster, BridgedDeviceBasicInformationCluster } from '@project-chip/matter-node.js/cluster';

// Define an interface for storing the plugins
interface RegisteredPlugin {
  path: string;
  type: string;
  name: string;
  version: string;
  description: string;
  author: string;
  storageContext?: StorageContext;
  commissioningServer?: CommissioningServer;
  aggregator?: Aggregator;
  loaded?: boolean;
  started?: boolean;
}

// Define an interface for storing the devices
interface RegisteredDevice {
  plugin: string;
  device: MatterbridgeDevice;
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

// Define an interface for the event map
export interface MatterbridgeEvents {
  shutdown: (reason: string) => void;
  startAccessoryPlatform: (reason: string) => void;
  startDynamicPlatform: (reason: string) => void;
  registerDeviceAccessoryPlatform: (device: MatterbridgeDevice) => void;
  registerDeviceDynamicPlatform: (device: MatterbridgeDevice) => void;
}

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
  public rootDirectory!: string;
  public bridgeMode: 'bridge' | 'childbridge' | 'controller' | '' = '';

  private log: AnsiLogger;
  private hasCleanupStarted = false;
  private registeredPlugins: RegisteredPlugin[] = [];
  private registeredDevices: RegisteredDevice[] = [];
  private storage: NodeStorageManager | undefined = undefined;
  private context: NodeStorage | undefined = undefined;
  private app!: express.Express;

  private storageManager!: StorageManager;
  private matterbridgeContext!: StorageContext;
  private mattercontrollerContext!: StorageContext;

  private matterServer!: MatterServer;
  private matterAggregator!: Aggregator;
  private commissioningServer!: CommissioningServer;
  private commissioningController!: CommissioningController;

  constructor() {
    super();

    // set Matterbridge logger
    this.log = new AnsiLogger({ logName: 'Matterbridge', logTimestampFormat: TimestampFormat.TIME_MILLIS });
    this.log.info('Matterbridge is running...');

    // log system info
    this.logNodeAndSystemInfo();

    // check node version and throw error
    requireMinNodeVersion(18);

    // register SIGINT SIGTERM signal handlers
    this.registerSignalHandlers();

    // set matter.js logger level and format
    Logger.defaultLogLevel = Level.DEBUG;
    Logger.format = Format.ANSI;

    this.initialize();
  }

  private async initialize() {
    // Initialize NodeStorage
    this.storage = new NodeStorageManager();
    this.context = await this.storage.createStorage('matterbridge');
    this.registeredPlugins = await this.context?.get<RegisteredPlugin[]>('plugins', []);

    // Initialize frontend
    this.initializeFrontend();

    // Parse command line
    await this.parseCommandLine();
  }

  private async parseCommandLine() {
    if (hasParameter('help')) {
      this.log.info(`\nmatterbridge -help -bridge -add <plugin path> -remove <plugin path>
      - help:                 show the help
      - bridge:               start the bridge
      - list:                 list the registered plugin
      - add <plugin path>:    register the plugin
      - remove <plugin path>: remove the plugin\n`);
      process.exit(0);
    }

    if (hasParameter('list')) {
      this.log.info('Registered plugins:');
      this.registeredPlugins.forEach((plugin) => {
        this.log.info(`- ${BLUE}${plugin.name}${nf} '${BLUE}${BRIGHT}${plugin.description}${RESET}${nf}' type: ${GREEN}${plugin.type}${nf}`);
      });
      process.exit(0);
    }
    if (getParameter('add')) {
      this.log.debug(`Registering plugin ${getParameter('add')}`);
      await this.loadPlugin(getParameter('add')!, 'add');
      process.exit(0);
    }
    if (getParameter('remove')) {
      this.log.debug(`Unregistering plugin ${getParameter('remove')}`);
      await this.loadPlugin(getParameter('remove')!, 'remove');
      process.exit(0);
    }

    await this.startStorage('json', '.matterbridge.json');

    if (hasParameter('childbridge')) {
      this.bridgeMode = 'childbridge';
      this.registeredPlugins.forEach(async (plugin) => {
        this.log.info(`Loading plugin ${BLUE}${plugin.name}${nf} type ${GREEN}${plugin.type}${nf}`);
        await this.loadPlugin(plugin.path, 'load');
      });
      await this.startMatterBridge();
    }

    if (hasParameter('bridge')) {
      this.bridgeMode = 'bridge';
      this.registeredPlugins.forEach(async (plugin) => {
        this.log.info(`Loading plugin ${BLUE}${plugin.name}${nf} type ${GREEN}${plugin.type}${nf}`);
        await this.loadPlugin(plugin.path, 'load');
      });
      await this.startMatterBridge();
    }
  }

  // Typed method for emitting events
  override emit<Event extends keyof MatterbridgeEvents>(event: Event, ...args: Parameters<MatterbridgeEvents[Event]>): boolean {
    return super.emit(event, ...args);
  }

  // Typed method for listening to events
  override on<Event extends keyof MatterbridgeEvents>(event: Event, listener: MatterbridgeEvents[Event]): this {
    super.on(event, listener);
    return this;
  }

  private async loadPlugin(packageJsonPath: string, mode = 'load') {
    if (!packageJsonPath.endsWith('package.json')) packageJsonPath = path.join(packageJsonPath, 'package.json');
    this.log.debug(`Loading plugin ${BLUE}${packageJsonPath}${RESET}`);
    try {
      // Load the package.json of the plugin
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      // Resolve the main module path relative to package.json
      const pluginPath = path.resolve(path.dirname(packageJsonPath), packageJson.main);
      // Convert the file path to a URL
      const pluginUrl = pathToFileURL(pluginPath);
      // Dynamically import the plugin
      this.log.debug(`Importing plugin ${BLUE}${pluginUrl.href}${RESET}`);
      const plugin = await import(pluginUrl.href);
      // Call the default export function of the plugin, passing this MatterBridge instance
      if (plugin.default) {
        const platform = plugin.default(this, new AnsiLogger({ logName: packageJson.description, logTimestampFormat: TimestampFormat.TIME_MILLIS }));
        platform.name = packageJson.name;
        if (mode === 'load') {
          this.log.info(`Plugin ${BLUE}${packageJsonPath}${RESET} type ${GREEN}${platform.type}${RESET} loaded (entrypoint ${UNDERLINE}${pluginPath}${UNDERLINEOFF})`);
          // Update plugin info
          const plugin = this.registeredPlugins.find((plugin) => plugin.name === packageJson.name);
          if (plugin) {
            plugin.name = packageJson.name;
            plugin.description = packageJson.description;
            plugin.version = packageJson.version;
            plugin.author = packageJson.author;
            plugin.type = platform.type;
            plugin.loaded = true;
          } else {
            this.log.error(`Plugin ${packageJson.name} not found`);
          }
          // Register handlers
          if (platform.type === 'AccessoryPlatform') {
            platform.on('registerDeviceAccessoryPlatform', (device: MatterbridgeDevice) => {
              this.log.debug(`Received ${REVERSE}registerDeviceAccessoryPlatform${REVERSEOFF} for device ${device.name}`);
            });
          } else if (platform.type === 'DynamicPlatform') {
            platform.on('registerDeviceDynamicPlatform', (device: MatterbridgeDevice) => {
              this.log.debug(`Received ${REVERSE}registerDeviceDynamicPlatform${REVERSEOFF} for device ${device.name}`);
            });
          } else {
            this.log.error(`loadPlugin error platform.type ${REVERSE}${platform.type}${REVERSEOFF} for plugin ${packageJson.name}`);
          }
        } else if (mode === 'add') {
          if (!this.registeredPlugins.find((plugin) => plugin.name === packageJson.name)) {
            this.registeredPlugins.push({
              path: packageJsonPath,
              type: platform.type,
              name: packageJson.name,
              version: packageJson.version,
              description: packageJson.description,
              author: packageJson.author,
            });
            await this.context?.set<RegisteredPlugin[]>('plugins', this.registeredPlugins);
            this.log.info(`Plugin ${packageJsonPath} type ${platform.type} added to matterbridge`);
          } else {
            this.log.warn(`Plugin ${packageJsonPath} already added to matterbridge`);
          }
        } else if (mode === 'remove') {
          if (this.registeredPlugins.find((plugin) => plugin.name === packageJson.name)) {
            this.registeredPlugins.splice(this.registeredPlugins.findIndex((plugin) => plugin.name === packageJson.name));
            await this.context?.set<RegisteredPlugin[]>('plugins', this.registeredPlugins);
            this.log.info(`Plugin ${packageJsonPath} removed from matterbridge`);
          } else {
            this.log.warn(`Plugin ${packageJsonPath} not registerd in matterbridge`);
          }
        }
      } else {
        this.log.error(`Plugin at ${pluginPath} does not provide a default export`);
      }
    } catch (err) {
      this.log.error(`Failed to load plugin from ${packageJsonPath}: ${err}`);
    }
  }

  private registerSignalHandlers() {
    process.on('SIGINT', async () => {
      await this.cleanup('SIGINT received, cleaning up...');
    });

    process.on('SIGTERM', async () => {
      await this.cleanup('SIGTERM received, cleaning up...');
    });
  }

  private async cleanup(message: string) {
    if (!this.hasCleanupStarted) {
      this.hasCleanupStarted = true;
      this.log.debug(message);

      // Emitting the shutdown event with a reason
      this.emit('shutdown', 'Matterbridge is closing: ' + message);

      // Set reachability to false
      this.log.debug(`*Changing reachability for ${this.registeredDevices.length} devices:`);
      this.registeredDevices.forEach((device) => {
        this.log.debug(`*--child device: ${device.device.name}`);
        if (this.bridgeMode === 'bridge') device.device.setBridgedDeviceReachability(false);
      });

      setTimeout(
        async () => {
          // Closing matter
          await this.stopMatter();

          // Closing storage
          await this.stopStorage();

          this.log.debug('Cleanup completed.');
          process.exit(0);
        },
        this.bridgeMode === 'bridge' ? 2000 : 0,
      );
    }
  }

  async addDevice(pluginName: string, device: MatterbridgeDevice) {
    if (this.bridgeMode === 'bridge') {
      const basic = device.getClusterServerById(BasicInformationCluster.id);
      if (!basic) {
        this.log.error('addDevice error: cannot find the BasicInformationCluster');
        return;
      }
      device.createDefaultBridgedDeviceBasicInformationClusterServer(
        basic.getNodeLabelAttribute(),
        basic.getUniqueIdAttribute(),
        basic.getVendorIdAttribute(),
        basic.getVendorNameAttribute(),
        basic.getProductNameAttribute(),
      );
      this.matterAggregator.addBridgedDevice(device);
      this.registeredDevices.push({ plugin: pluginName, device });
      this.log.debug(`addDevice called from plugin ${pluginName}`);
    }
    if (this.bridgeMode === 'childbridge') {
      const plugin = this.registeredPlugins.find((plugin) => plugin.name === pluginName);
      if (plugin) {
        plugin.started = true;
        this.registeredDevices.push({ plugin: pluginName, device });
        this.log.debug(`addDevice called from plugin ${pluginName}`);
      } else {
        this.log.error(`addDevice error: plugin ${pluginName} not found`);
      }
    }
  }

  async addBridgedDevice(pluginName: string, device: MatterbridgeDevice) {
    if (this.bridgeMode === 'bridge') {
      this.matterAggregator.addBridgedDevice(device);
      this.registeredDevices.push({ plugin: pluginName, device });
      this.log.debug(`addBridgedDevice called from plugin ${pluginName}`);
    }
    if (this.bridgeMode === 'childbridge') {
      const plugin = this.registeredPlugins.find((plugin) => plugin.name === pluginName);
      if (plugin) {
        plugin.started = true;
        this.registeredDevices.push({ plugin: pluginName, device });
        this.log.debug(`addBridgedDevice called from plugin ${pluginName}`);
      } else {
        this.log.error(`addBridgedDevice error: plugin ${pluginName} not found`);
      }
    }
  }

  private async startStorage(storageType: string, storageName: string) {
    if (!storageName.endsWith('.json')) {
      storageName += '.json';
    }
    this.log.debug(`Starting storage ${storageType} ${storageName}`);
    if (storageType === 'disk') {
      const storageDisk = new StorageBackendDisk(storageName);
      this.storageManager = new StorageManager(storageDisk);
    }
    if (storageType === 'json') {
      const storageJson = new StorageBackendJsonFile(storageName);
      this.storageManager = new StorageManager(storageJson);
    }
    try {
      await this.storageManager.initialize();
      this.log.debug('Storage initialized');
      if (storageType === 'json') {
        this.backupJsonStorage(storageName, storageName.replace('.json', '') + '.backup.json');
      }
    } catch (error) {
      this.log.error('Storage initialize() error!');
      process.exit(1);
    }
  }

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

  private async stopStorage() {
    this.log.debug('Stopping storage');
    await this.storageManager?.close();
    this.log.debug('Storage closed');
  }

  private async startMatterBridge() {
    this.log.debug('Starting matterbridge in mode', this.bridgeMode);

    await this.createMatterServer(this.storageManager);

    this.log.debug('Creating matterbridge context: matterbridge');
    this.matterbridgeContext = this.storageManager.createContext('matterbridge');
    this.matterbridgeContext.set('port', 5500);
    this.matterbridgeContext.set('passcode', 20232024);
    this.matterbridgeContext.set('discriminator', 3940);
    this.matterbridgeContext.set('deviceName', 'matterbridge aggregator');
    this.matterbridgeContext.set('deviceType', DeviceTypes.AGGREGATOR.code);
    this.matterbridgeContext.set('vendorId', 0xfff1);
    this.matterbridgeContext.set('vendorName', 'matterbridge');
    this.matterbridgeContext.set('productId', 0x8000);
    this.matterbridgeContext.set('productName', 'node-matterbridge');
    this.matterbridgeContext.set('uniqueId', this.matterbridgeContext.get('uniqueId', CryptoNode.getRandomData(8).toHex()));

    this.log.debug('Creating matterbridge commissioning server');
    this.commissioningServer = await this.createMatterCommisioningServer(this.matterbridgeContext, 'Matterbridge');

    if (this.bridgeMode === 'bridge') {
      this.log.debug('Creating matter aggregator for matterbridge');
      this.matterAggregator = await this.createMatterAggregator();
      this.log.debug('Adding matter aggregator to commissioning server');
      this.commissioningServer.addDevice(this.matterAggregator);
      this.matterServer.addCommissioningServer(this.commissioningServer);
      this.log.debug('Starting matter server');
      await this.matterServer.start();
      this.log.debug('Started matter server');
      this.showCommissioningQRCode(this.commissioningServer, this.matterbridgeContext, 'Matterbridge');
    }

    if (this.bridgeMode === 'childbridge') {
      this.log.debug('Creating matter aggregator for matterbridge');
      this.matterAggregator = await this.createMatterAggregator();
      this.log.debug('Adding matter aggregator to commissioning server');
      this.commissioningServer.addDevice(this.matterAggregator);
      this.matterServer.addCommissioningServer(this.commissioningServer);

      this.registeredPlugins.forEach(async (plugin) => {
        // Start the interval to check if all plugins are loaded
        const loadedInterval = setInterval(async () => {
          this.log.debug(`Waiting for plugin ${BLUE}${plugin.name}${db} to load (${plugin.loaded}) and send device (${plugin.started})...`);
          if (!plugin.loaded) return;
          this.log.debug(`Sending start platform for plugin ${BLUE}${plugin.name}${db}`);
          this.emit('startAccessoryPlatform', 'Matterbridge is commissioned and controllers are connected');
          this.emit('startDynamicPlatform', 'Matterbridge is commissioned and controllers are connected');
          clearInterval(loadedInterval);
        }, 1000);

        // Start the interval to check if all plugins are started
        const startedInterval = setInterval(async () => {
          this.log.debug(`**Waiting for plugin ${BLUE}${plugin.name}${db} to load (${plugin.loaded}) and send device (${plugin.started})...`);
          if (!plugin.started) return;
          this.log.debug(`**Creating storage context for plugin ${BLUE}${plugin.name}${db}`);
          plugin.storageContext = this.storageManager.createContext(plugin.name);
          //plugin.storageContext.set('port', undefined);
          //plugin.storageContext.set('passcode', undefined);
          //plugin.storageContext.set('discriminator', undefined);
          plugin.storageContext.set('deviceName', 'matterbridge aggregator');
          plugin.storageContext.set('deviceType', DeviceTypes.AGGREGATOR.code);
          plugin.storageContext.set('vendorId', 0xfff1);
          plugin.storageContext.set('vendorName', 'matterbridge');
          plugin.storageContext.set('productId', 0x8000);
          plugin.storageContext.set('productName', plugin.name.slice(0, 32));
          plugin.storageContext.set('uniqueId', plugin.storageContext.get('uniqueId', CryptoNode.getRandomData(8).toHex()));
          this.log.debug(`**Creating commissioning server for plugin ${BLUE}${plugin.name}${db}`);
          plugin.commissioningServer = await this.createMatterCommisioningServer(plugin.storageContext, plugin.name);
          if (plugin.type === 'AccessoryPlatform') {
            this.registeredDevices.forEach((registeredDevice) => {
              if (registeredDevice.plugin === plugin.name) {
                plugin.commissioningServer?.addDevice(registeredDevice.device);
                this.matterServer.addCommissioningServer(plugin.commissioningServer!);
                return;
              }
            });
          }
          if (plugin.type === 'DynamicPlatform') {
            this.log.debug(`**Creating aggregator for plugin ${BLUE}${plugin.name}${db}`);
            plugin.aggregator = await this.createMatterAggregator();
            this.log.debug(`**Adding matter aggregator to commissioning server for plugin ${BLUE}${plugin.name}${db}`);
            plugin.commissioningServer?.addDevice(plugin.aggregator);
            this.registeredDevices.forEach((registeredDevice) => {
              if (registeredDevice.plugin === plugin.name) plugin.aggregator?.addBridgedDevice(registeredDevice.device);
            });
            this.matterServer.addCommissioningServer(plugin.commissioningServer);
          }
          clearInterval(startedInterval);
        }, 1000);
      });

      // Start the interval to check if all plugins are loaded and started and so start the matter server
      const startMatterInterval = setInterval(async () => {
        let allStarted = true;
        this.registeredPlugins.forEach(async (plugin) => {
          this.log.debug(`***Waiting in startMatter interval for plugin ${BLUE}${plugin.name}${db} to load (${plugin.loaded}) and send device (${plugin.started})...`);
          if (!plugin.loaded || !plugin.started) allStarted = false;
        });
        if (!allStarted) return;
        this.log.debug('***Starting matter server from startMatter interval');
        await this.matterServer.start();
        this.log.debug('***Started matter server from startMatter interval');
        this.showCommissioningQRCode(this.commissioningServer, this.matterbridgeContext, 'Matterbridge');
        this.registeredPlugins.forEach(async (plugin) => {
          this.showCommissioningQRCode(plugin.commissioningServer, plugin.storageContext, plugin.name);
        });
        clearInterval(startMatterInterval);
      }, 1000);
      return;
    }
  }

  private showCommissioningQRCode(commissioningServer?: CommissioningServer, storageContext?: StorageContext, name?: string) {
    if (!commissioningServer || !storageContext || !name) return;
    if (!commissioningServer.isCommissioned()) {
      this.log.info(`***The commissioning server for ${BLUE}${name}${nf} is not commissioned. Pair it and restart the process to run matterbridge.`);
      const { qrPairingCode, manualPairingCode } = commissioningServer.getPairingCode();
      storageContext.set('qrPairingCode', qrPairingCode);
      storageContext.set('manualPairingCode', manualPairingCode);
      const QrCode = new QrCodeSchema();
      this.log.debug(`Pairing code\n\n${QrCode.encode(qrPairingCode)}\nManual pairing code: ${manualPairingCode}\n`);
    } else {
      this.log.info(`***The commissioning server for ${BLUE}${name}${nf} is already commissioned. Waiting for controllers to connect ...`);
    }
  }

  private async createMatterCommisioningServer(context: StorageContext, name: string) {
    //const port = context.get('port') as number;
    //const passcode = context.get('passcode') as number;
    //const discriminator = context.get('discriminator') as number;
    const deviceName = context.get('deviceName') as string;
    const deviceType = context.get('deviceType') as DeviceTypeId;

    const vendorId = context.get('vendorId') as number;
    const vendorName = context.get('vendorName') as string; // Home app = Manufacturer

    const productId = context.get('productId') as number;
    const productName = context.get('productName') as string; // Home app = Model

    const uniqueId = context.get('uniqueId') as string;

    // eslint-disable-next-line max-len
    //this.log.debug(`Creating matter commissioning server with port ${port} passcode ${passcode} discriminator ${discriminator} deviceName ${deviceName} deviceType ${deviceType}`);
    this.log.debug(`Creating matter commissioning server with deviceName ${deviceName} deviceType ${deviceType}`);
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
        softwareVersion: 1,
        softwareVersionString: '1.0.0', // Home app = Firmware Revision
        hardwareVersion: 1,
        hardwareVersionString: '1.0.0',
        uniqueId,
        serialNumber: `matterbridge-${uniqueId}`,
        reachable: true,
      },
      activeSessionsChangedCallback: (fabricIndex) => {
        const info = commissioningServer.getActiveSessionInformation(fabricIndex);
        this.log.debug(`Active sessions changed on fabric ${fabricIndex}`, debugStringify(info));
        if (info && info[0]?.isPeerActive === true && info[0]?.secure === true && info[0]?.numberOfActiveSubscriptions >= 1) {
          this.log.info(`Controller connected to ${BLUE}${name}${nf} ready to start...`);
          Logger.defaultLogLevel = Level.INFO;
          setTimeout(() => {
            if (this.bridgeMode === 'bridge') {
              this.emit('startAccessoryPlatform', 'Matterbridge is commissioned and controllers are connected');
              this.emit('startDynamicPlatform', 'Matterbridge is commissioned and controllers are connected');
            }
          }, 2000);
        }
      },
      commissioningChangedCallback: (fabricIndex) => {
        const info = commissioningServer.getCommissionedFabricInformation(fabricIndex);
        this.log.debug(`Commissioning changed on fabric ${fabricIndex}`, debugStringify(info));
      },
    });
    commissioningServer.addCommandHandler('testEventTrigger', async ({ request: { enableKey, eventTrigger } }) =>
      this.log.info(`testEventTrigger called on GeneralDiagnostic cluster: ${enableKey} ${eventTrigger}`),
    );
    return commissioningServer;
  }

  private async createMatterServer(storageManager: StorageManager) {
    this.log.debug('Creating matter server');
    this.matterServer = new MatterServer(storageManager, { mdnsAnnounceInterface: undefined });
  }

  private async createMatterAggregator() {
    const matterAggregator = new Aggregator();
    return matterAggregator;
  }

  private async stopMatter() {
    this.log.debug('Stopping matter commissioningServer');
    await this.commissioningServer?.close();
    this.log.debug('Stopping matter commissioningController');
    await this.commissioningController?.close();
    this.log.debug('Stopping matter server');
    await this.matterServer?.close();
    this.log.debug('Matter server closed');
  }

  private logNodeAndSystemInfo() {
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

    // Command line arguments (excluding 'node' and the script name)
    const cmdArgs = process.argv.slice(2).join(' ');
    this.log.debug(`Command Line Arguments: ${cmdArgs}`);

    // Current working directory
    const currentDir = process.cwd();
    this.log.debug(`Current Working Directory: ${currentDir}`);

    // Package root directory
    const currentFileDirectory = path.dirname(fileURLToPath(import.meta.url));
    this.rootDirectory = path.resolve(currentFileDirectory, '../');
    this.log.debug(`Root Directory: ${this.rootDirectory}`);
  }

  /**
   * Initializes the frontend of Matterbridge.
   *
   * @param port The port number to run the frontend server on. Default is 3000.
   */
  async initializeFrontend(port: number = 3000) {
    //const __filename = fileURLToPath(import.meta.url);
    //const __dirname = path.dirname(__filename);

    this.log.debug(`Initializing the frontend on port ${YELLOW}${port}${db} static ${UNDERLINE}${path.join(this.rootDirectory, 'frontend/build')}${rs}`);
    this.app = express();

    // Serve React build directory
    this.app.use(express.static(path.join(this.rootDirectory, 'frontend/build')));

    // Endpoint to provide QR pairing code
    this.app.get('/api/qr-code', (req, res) => {
      this.log.debug('The frontend sent /api/qr-code');
      const qrData = { qrPairingCode: this.matterbridgeContext.get('qrPairingCode') };
      res.json(qrData);
    });

    // Endpoint to provide system information
    this.app.get('/api/system-info', (req, res) => {
      this.log.debug('The frontend sent /api/system-info');
      res.json(this.systemInformation);
    });

    // Endpoint to provide plugins
    this.app.get('/api/plugins', (req, res) => {
      this.log.debug('The frontend sent /api/plugins');
      const data: { name: string; description: string; version: string; author: string; type: string }[] = [];
      this.registeredPlugins.forEach((plugin) => {
        data.push({ name: plugin.name, description: plugin.description, version: plugin.version, author: plugin.author, type: plugin.type });
      });
      res.json(data);
    });

    // Endpoint to provide devices
    this.app.get('/api/devices', (req, res) => {
      this.log.debug('The frontend sent /api/devices');
      const data: { pluginName: string; type: string; endpoint: EndpointNumber | undefined; name: string; cluster: string }[] = [];
      this.registeredDevices.forEach((device) => {
        let name = device.device.getClusterServer(BasicInformationCluster)?.getNodeLabelAttribute();
        if (!name && device.device.getClusterServer(BridgedDeviceBasicInformationCluster)) {
          const bridgeInfo = device.device.getClusterServer(BridgedDeviceBasicInformationCluster);
          if (bridgeInfo && bridgeInfo.getNodeLabelAttribute) name = bridgeInfo.getNodeLabelAttribute();
        }
        data.push({ pluginName: device.plugin, type: device.device.name, endpoint: device.device.id, name: name ?? 'Unknown', cluster: 'Unknown' });
      });
      res.json(data);
    });

    // Fallback for routing
    this.app.get('*', (req, res) => {
      this.log.warn('The frontend sent *');
      res.sendFile(path.join(this.rootDirectory, 'frontend/build/index.html'));
    });

    this.app.listen(port, () => {
      this.log.debug(`The frontend is running on ${UNDERLINE}http://localhost:${port}${rs}`);
    });
  }
}

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
