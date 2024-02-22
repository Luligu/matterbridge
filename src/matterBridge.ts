/* eslint-disable @typescript-eslint/no-unused-vars */
import { NodeStorageManager, NodeStorage, NodeStorageKey, NodeStorageName } from 'node-persist-manager';
import { AnsiLogger, TimestampFormat, dn, gn, db, wr, zb, stringify } from 'node-ansi-logger';
import { fileURLToPath, pathToFileURL } from 'url';
import { promises as fs } from 'fs';
import EventEmitter from 'events';
import os from 'os';
import path from 'path';

import { CommissioningController, CommissioningServer, MatterServer, NodeCommissioningOptions } from '@project-chip/matter-node.js';
import { EndpointNumber, NodeId, VendorId } from '@project-chip/matter-node.js/datatype';
import { Aggregator, DeviceTypes, NodeStateInformation, PairedNode } from '@project-chip/matter-node.js/device';
import { Format, Level, Logger } from '@project-chip/matter-node.js/log';
import { ManualPairingCodeCodec, QrCodeSchema } from '@project-chip/matter-node.js/schema';
import { StorageBackendDisk, StorageBackendJsonFile, StorageContext, StorageManager } from '@project-chip/matter-node.js/storage';
import { requireMinNodeVersion, getParameter, getIntParameter, hasParameter } from '@project-chip/matter-node.js/util';
import { logEndpoint } from '@project-chip/matter-node.js/device';
import { CryptoNode } from '@project-chip/matter-node.js/crypto';
import { CommissioningOptions } from '@project-chip/matter.js/protocol';
import { AllClustersMap, BasicInformationCluster, GeneralCommissioning, PowerSourceCluster, PowerSourceConfigurationCluster, ThreadNetworkDiagnosticsCluster, 
  getClusterNameById } from '@project-chip/matter-node.js/cluster';
import { Ble } from '@project-chip/matter-node.js/ble';
import { BleNode, BleScanner } from '@project-chip/matter-node-ble.js/ble';

// Define an interface for storing the plugins
interface MatterbridgePlugins {
  path: string,
  name: string,
  version: string,
  description: string,
  author: string,
}

// Define an interface for the event map
export interface MatterbridgeEvents {
  shutdown: (reason: string) => void;
  start: (reason: string) => void;
}

export class Matterbridge extends EventEmitter {
  private log: AnsiLogger;  
  private hasCleanupStarted = false;
  private plugins: MatterbridgePlugins[] = [];
  private storage: NodeStorageManager | undefined = undefined;
  private context: NodeStorage | undefined = undefined; 

  private storageManager!: StorageManager;
  private matterbridgeContext!: StorageContext;
  private mattercontrollerContext!: StorageContext;

  private matterServer!: MatterServer;
  private matterAggregator!: Aggregator;
  private commissioningServer!: CommissioningServer;
  private commissioningController!: CommissioningController;
    
  constructor() {
    super();
    // set Matterbridge
    this.log = new AnsiLogger({ logName: 'Matterbridge', logTimestampFormat: TimestampFormat.TIME_MILLIS });

    this.log.info('Matterbridge is running...');

    this.logNodeAndSystemInfo();

    // check node version and throw error
    requireMinNodeVersion(18);

    this.registerSignalHandlers();

    // set matter.js logger 
    Logger.defaultLogLevel = Level.DEBUG;
    Logger.format = Format.ANSI;
    
    this.initialize();
  }

  private async initialize() {

    // Initialize NodeStorage
    this.storage = new NodeStorageManager();
    this.context = await this.storage.createStorage('matterbridge');
    this.plugins = await this.context?.get<MatterbridgePlugins[]>('plugins', []);

    // Parse command line
    await this.parseCommandLine();
  }

  private async parseCommandLine() {

    if (hasParameter('help')) {
      this.log.info(`\n
matterbridge -help -bridge -add <plugin path> -remove <plugin path>
      - help:                 show the help
      - bridge:               start the bridge
      - add <plugin path>:    register the plugin
      - remove <plugin path>: remove the plugin\n`);
      process.exit(0);
    }

    if (hasParameter('add') && getParameter('add')) { 
      this.log.debug(`Registering plugin ${getParameter('add')}`);
      this.loadPlugin(getParameter('add')!);
    }

    if (hasParameter('bridge')) {
      await this.startStorage('json', '.matterbridge.json');
      await this.startMatterBridge();
      this.plugins.forEach(plugin => {
        this.loadPlugin(plugin.path);
      });
      setTimeout(() => {
        this.emit('start', 'Matterbridge is loading');
      }, 1000);
    }
  }

  // Typed method for emitting events
  override emit<Event extends keyof MatterbridgeEvents>(
    event: Event,
    ...args: Parameters<MatterbridgeEvents[Event]>
  ): boolean {
    return super.emit(event, ...args);
  }

  // Typed method for listening to events
  override on<Event extends keyof MatterbridgeEvents>(
    event: Event,
    listener: MatterbridgeEvents[Event]
  ): this {
    super.on(event, listener);
    return this;
  }

  private async loadPlugin(packageJsonPath: string) {
    if (!packageJsonPath.endsWith('package.json')) packageJsonPath = path.join(packageJsonPath, 'package.json');
    try {
      // Load the package.json of the plugin
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      // Resolve the main module path relative to package.json
      const pluginPath = path.resolve(path.dirname(packageJsonPath), packageJson.main);
      // Convert the file path to a URL
      const pluginUrl = pathToFileURL(pluginPath);
      // Dynamically import the plugin
      const plugin = await import(pluginUrl.href );
      // Call the default export function of the plugin, passing this MatterBridge instance
      if (plugin.default) { 
        plugin.default(this, new AnsiLogger({ logName: packageJson.description, logTimestampFormat: TimestampFormat.TIME_MILLIS }));
        this.log.info(`Plugin loaded from ${pluginPath}`);
        if (!this.plugins.find(plugin => plugin.name === packageJson.name)) {
          this.plugins.push({ path: packageJsonPath, name: packageJson.name, version: packageJson.version, description: packageJson.description, author: packageJson.author });
          this.context?.set<MatterbridgePlugins[]>('plugins', this.plugins);
        }
      } else {
        this.log.warn(`Plugin at ${pluginPath} does not provide a default export`);
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
      this.emit('shutdown', 'Matterbridge is closing');

      // Closing matter
      await this.stopMatter();
      // Closing storage
      await this.stopStorage();

      this.log.debug('Cleanup completed.');
      process.exit(0);
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
    }
    catch (error) {
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
    this.log.debug('Creating matterbridgeContext: matterbridge');
    this.matterbridgeContext = this.storageManager.createContext('matterbridge');
    this.matterbridgeContext.set('vendorId', 0xfff1);
    this.matterbridgeContext.set('productId', 0x8000);
    this.matterbridgeContext.set('uniqueId', this.matterbridgeContext.get('uniqueId', CryptoNode.getRandomData(8).toHex()));
    this.matterbridgeContext.set('passcode', 20232024);
    this.matterbridgeContext.set('discriminator', 3940);
    this.matterbridgeContext.set('port', 5500);
  
    await this.createMatterServer(this.storageManager);
  
    const deviceName = 'matterbridge aggregator';
    const deviceType = DeviceTypes.AGGREGATOR.code;
    const productName = 'node-matter bridge'; // Home app = Model
    const vendorName = 'matterbridge'; // Home app = Manufacturer
  
    const vendorId = this.matterbridgeContext.get('vendorId') as number;
    const productId = this.matterbridgeContext.get('productId') as number;
    const uniqueId = this.matterbridgeContext.get('uniqueId') as string;
    const passcode = this.matterbridgeContext.get('passcode') as number;
    const discriminator = this.matterbridgeContext.get('discriminator') as number;
    const port = this.matterbridgeContext.get('port') as number;
  
    this.log.debug(`Creating matter commissioning server with port ${port} passcode ${passcode} discriminator ${discriminator} deviceName ${deviceName} deviceType ${deviceType}`);
    this.commissioningServer = new CommissioningServer({
      port,
      passcode,
      discriminator,
      deviceName,
      deviceType,
      basicInformation: {
        vendorId: VendorId(vendorId),
        vendorName,
        productId,
        productName,
        nodeLabel: productName,
        productLabel: productName,
        softwareVersion: 0,
        softwareVersionString: '0.0.13', // Home app = Firmware Revision
        uniqueId,
        serialNumber: `matterbridge-${uniqueId}`,
      },
      activeSessionsChangedCallback: fabricIndex => {
        const info = this.commissioningServer.getActiveSessionInformation(fabricIndex);
        this.log.info(`Active sessions changed on Fabric ${fabricIndex}`, stringify(info, true));
        if (info && info[0]?.isPeerActive === true && info[0]?.secure === true && info[0]?.numberOfActiveSubscriptions >= 1) {
          this.log.info('activeSessionsChangedCallback ready to start...');
          Logger.defaultLogLevel = Level.INFO;
          //platform.startZigbee();
        }
      },
      commissioningChangedCallback: fabricIndex => {
        const info = this.commissioningServer.getCommissionedFabricInformation(fabricIndex);
        this.log.info(`Commissioning changed on Fabric ${fabricIndex}`, stringify(info, true));
      },
    });
    this.commissioningServer.addCommandHandler('testEventTrigger', async ({ request: { enableKey, eventTrigger } }) =>
      this.log.info(`testEventTrigger called on GeneralDiagnostic cluster: ${enableKey} ${eventTrigger}`),
    );
  
    this.createMatterAggregator();
  
    this.commissioningServer.addDevice(this.matterAggregator);
    this.matterServer.addCommissioningServer(this.commissioningServer);
    await this.matterServer.start();
    this.log.debug('Started matter server');
  
    if (!this.commissioningServer.isCommissioned()) {
      this.log.info('The bridge is not commissioned. Pair the bridge and restart the process to run matterbridge.');
      const pairingData = this.commissioningServer.getPairingCode();
      const { qrPairingCode, manualPairingCode } = pairingData;
      this.matterbridgeContext.set('qrPairingCode', qrPairingCode);
      this.matterbridgeContext.set('manualPairingCode', manualPairingCode);
  
      const QrCode = new QrCodeSchema();
      this.log.debug('Pairing code\n', '\n' + QrCode.encode(qrPairingCode));
      this.log.debug(`QR Code URL: https://project-chip.github.io/connectedhomeip/qrcode.html?data=${qrPairingCode}`);
      this.log.debug(`Manual pairing code: ${manualPairingCode}`);
    } else {
      this.log.info('The bridge is already commissioned. Waiting for controllers to connect ...');
  
      setTimeout(() => {
        Logger.defaultLogLevel = Level.DEBUG;
        const childs = this.matterAggregator.getBridgedDevices();
        this.log.debug(`Aggregator has ${childs.length} childs:`)
        for (const child of childs) {
          this.log.debug(`--child: ID: ${child.id} name: ${child.name} `);
        }
        //logEndpoint(commissioningServer.getRootEndpoint());
        //logEndpoint(matterAggregator);
        //platform.unregisterAll();
      }, 120 * 1000);
  
    }
  }
  
  private async createMatterServer(storageManager: StorageManager) {
    this.log.info('Creating matter server');
    this.matterServer = new MatterServer(storageManager, { mdnsAnnounceInterface: undefined });
  }
  
  private async createMatterAggregator() {
    this.log.info('Creating matter aggregator'); 
    this.matterAggregator = new Aggregator();
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

    // Node information
    const version = process.versions.node;
    const versionMajor = parseInt(version.split('.')[0]);
    const versionMinor = parseInt(version.split('.')[1]);
    const versionPatch = parseInt(version.split('.')[2]);

    // Host system information
    const osType = os.type(); // "Windows_NT", "Darwin", etc.
    const osRelease = os.release(); // Kernel version
    const osPlatform = os.platform(); // "win32", "linux", "darwin", etc. 
    const osArch = os.arch(); // "x64", "arm", etc.
    const totalMemory = os.totalmem() / 1024 / 1024 / 1024; // Convert to GB
    const freeMemory = os.freemem() / 1024 / 1024 / 1024; // Convert to GB
    const systemUptime = os.uptime() / 60 / 60; // Convert to hours

    // Log the system information
    this.log.debug(`Host System Information:
                              - Node.js: ${versionMajor}.${versionMinor}.${versionPatch}
                              - OS Type: ${osType}
                              - OS Release: ${osRelease}
                              - Platform: ${osPlatform}
                              - Architecture: ${osArch}
                              - Total Memory: ${totalMemory.toFixed(2)} GB
                              - Free Memory: ${freeMemory.toFixed(2)} GB
                              - System Uptime: ${systemUptime.toFixed(2)} hours`);

    // Command line arguments (excluding 'node' and the script name)
    const cmdArgs = process.argv.slice(2).join(' ');
    this.log.debug(`Command Line Arguments: ${cmdArgs}`); 

    // Current working directory
    const currentDir = process.cwd();
    this.log.debug(`Current Working Directory: ${currentDir}`);

    // Package root directory
    const currentFileDirectory = path.dirname(fileURLToPath(import.meta.url));
    const packageRootDirectory = path.resolve(currentFileDirectory, '../');
    this.log.debug(`Package Root Directory: ${packageRootDirectory}`);
  }
}