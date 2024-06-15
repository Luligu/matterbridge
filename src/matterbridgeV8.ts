/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * This file contains the class NewMatterbridge. Test of new matter.js api
 *
 * @file matterbridgeNewApi.ts
 * @author Luca Liguori
 * @date 2024-06-01
 * @version 1.0.0
 *
 * Copyright 2024 Luca Liguori.
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

/**
 * Import needed modules from @project-chip/matter-node.js
 */
// Include this first to auto-register Crypto, Network and Time Node.js implementations
import '@project-chip/matter-node.js';
import { CryptoNode } from '@project-chip/matter-node.js/crypto';
import { DeviceTypeId, FabricIndex, VendorId } from '@project-chip/matter-node.js/datatype';
import { Format, Level, Logger, createFileLogger } from '@project-chip/matter-node.js/log';
import { Storage, StorageContext, StorageManager } from '@project-chip/matter-node.js/storage';
import { Environment, StorageService } from '@project-chip/matter.js/environment';
import { ServerNode } from '@project-chip/matter.js/node';
import { DeviceTypeDefinition, DeviceTypes, logEndpoint } from '@project-chip/matter-node.js/device';
import { QrCode } from '@project-chip/matter-node.js/schema';
import { FabricAction } from '@project-chip/matter-node.js/fabric';
import { Endpoint, EndpointServer } from '@project-chip/matter.js/endpoint';
import { EndpointType } from '@project-chip/matter.js/endpoint/type';

import { AggregatorEndpoint } from '@project-chip/matter.js/endpoints/AggregatorEndpoint';
import { BridgedNodeEndpoint } from '@project-chip/matter.js/endpoints/BridgedNodeEndpoint';

// Behaviour servers
import { IdentifyServer } from '@project-chip/matter.js/behavior/definitions/identify';
import { OnOffServer } from '@project-chip/matter.js/behavior/definitions/on-off';
import { GroupsServer } from '@project-chip/matter.js/behavior/definitions/groups';
import { ScenesServer } from '@project-chip/matter.js/behavior/definitions/scenes';
import { BridgedDeviceBasicInformationServer } from '@project-chip/matter.js/behavior/definitions/bridged-device-basic-information';
import { TemperatureMeasurementServer } from '@project-chip/matter.js/behavior/definitions/temperature-measurement';
import { RelativeHumidityMeasurementServer } from '@project-chip/matter.js/behavior/definitions/relative-humidity-measurement';
import { SwitchServer } from '@project-chip/matter.js/behavior/definitions/switch';

import { ActionContext } from '@project-chip/matter.js/behavior/context';

// Device definitions
import { ColorDimmerSwitchDevice } from '@project-chip/matter.js/devices/ColorDimmerSwitchDevice';
import { OnOffLightDevice } from '@project-chip/matter.js/devices/OnOffLightDevice';
import { GenericSwitchDevice } from '@project-chip/matter.js/devices/GenericSwitchDevice';

import { MutableEndpoint } from '@project-chip/matter.js/endpoint/type';
import { SupportedBehaviors } from '@project-chip/matter.js/endpoint/properties';

import { AnsiLogger, BRIGHT, RESET, TimestampFormat, UNDERLINE, UNDERLINEOFF, YELLOW, db, debugStringify, stringify, er, nf, rs, wr, RED, GREEN, zb, CYAN } from 'node-ansi-logger';
import { NodeStorageManager, NodeStorage } from 'node-persist-manager';

import EventEmitter from 'events';
import path from 'path';
import { promises as fs } from 'fs';
import { MatterbridgeDeviceV8 } from './matterbridgeDeviceV8.js';
import { Actions, BasicInformationCluster, Identify, SwitchCluster } from '@project-chip/matter-node.js/cluster';
import { dimmableSwitch } from './matterbridgeDevice.js';
import { PlatformConfig, RegisteredPlugin } from './matterbridge.js';
import { MatterbridgePlatform } from './matterbridge.js';
import { pathToFileURL } from 'url';
import { shelly_config, somfytahoma_config, zigbee2mqtt_config } from './defaultConfigSchema.js';

const plg = '\u001B[38;5;33m';
const dev = '\u001B[38;5;79m';
const typ = '\u001B[38;5;207m';

const log = Logger.get('Matterbridge');

/**
 * Represents the Matterbridge application.
 */
export class MatterbridgeV8 extends EventEmitter {
  private environment = Environment.default;

  public matterbridgeVersion = '';
  public osVersion = '';
  public matterbridgeDirectory = '';
  public matterbridgePluginDirectory = '';
  public globalModulesDirectory = '';
  public matterbridgeLogFile = '';
  private registeredPlugins: RegisteredPlugin[] = [];

  // Node storage
  private nodeStorage: NodeStorageManager | undefined;
  private nodeContext: NodeStorage | undefined;

  // Matter storage
  public matterStorageService?: StorageService;
  public matterStorageManager?: StorageManager;
  public matterStorageContext?: StorageContext;

  public matterServerNode?: ServerNode<ServerNode.RootEndpoint>;
  public matterAggregator?: Endpoint<AggregatorEndpoint>;

  public matterLogger?: Logger;

  private constructor() {
    super();
  }

  static async create() {
    const matterbridge = new MatterbridgeV8();
    await matterbridge.initialize();
    return matterbridge;
  }

  async initialize() {
    // Set up the temporary Matterbridge environment
    this.matterbridgeVersion = '2.0.0';
    this.osVersion = '10.0.22631';
    this.matterbridgeDirectory = 'C:\\Users\\lligu\\.matterbridge';
    this.matterbridgePluginDirectory = 'C:\\Users\\lligu\\Matterbridge';
    this.globalModulesDirectory = 'C:\\Users\\lligu\\AppData\\Roaming\\npm\\node_modules';
    this.matterbridgeLogFile = 'matterbridge.log';

    this.matterLogger = Logger.get('Matterbridge');
    await this.deleteMatterLogfile(this.matterbridgeLogFile);
    await this.setupMatterFileLogger(this.matterbridgeLogFile);
    this.matterLogger?.notice(`Starting Matterbridge v${this.matterbridgeVersion} on Node.js ${process.version} (${process.platform} ${process.arch})`);

    this.setupMatterVars(Level.DEBUG, Format.ANSI);

    await this.setupMatterStorage();

    await this.setupNodeStorage();

    // Get the plugins from node storage
    if (!this.nodeStorage) throw new Error('No node storage initialized');
    if (!this.nodeContext) throw new Error('No node storage context initialized');
    this.registeredPlugins = await this.nodeContext.get<RegisteredPlugin[]>('plugins', []);
    for (const plugin of this.registeredPlugins) {
      plugin.nodeContext = await this.nodeStorage.createStorage(plugin.name);
      await plugin.nodeContext.set<string>('name', plugin.name);
      await plugin.nodeContext.set<string>('type', plugin.type);
      await plugin.nodeContext.set<string>('path', plugin.path);
      await plugin.nodeContext.set<string>('version', plugin.version);
      await plugin.nodeContext.set<string>('description', plugin.description);
      await plugin.nodeContext.set<string>('author', plugin.author);
      this.matterLogger?.notice(`Created node storage context for plugin ${plugin.name}`);
    }
  }

  private setupMatterVars(level: Level, format: Format.Type) {
    this.environment.vars.set('log.level', level);
    this.environment.vars.set('log.format', format);
    this.environment.vars.set('path.root', path.join(this.matterbridgeDirectory, 'matterstorage'));
    this.environment.vars.set('runtime.signals', false);
    this.environment.vars.set('runtime.exitcode', false);
  }

  private async setupMatterStorage() {
    this.matterStorageService = this.environment.get(StorageService);
    this.matterLogger?.notice(`Storage service created: ${this.matterStorageService.location}`);

    this.matterStorageManager = await this.matterStorageService.open('Matterbridge');
    this.matterLogger?.notice('Storage manager "Matterbridge" created');

    this.matterStorageContext = this.matterStorageManager.createContext('persist');
    this.matterLogger?.notice('Storage context "Matterbridge.persist" created');
  }

  private async setupNodeStorage() {
    this.nodeStorage = new NodeStorageManager({ dir: path.join(this.matterbridgeDirectory, 'storage'), logging: false });
    this.matterLogger?.notice(`Created node storage manager: ${path.join(this.matterbridgeDirectory, 'storage')}`);
    this.nodeContext = await this.nodeStorage.createStorage('matterbridge');
    this.matterLogger?.notice('Created node storage context "matterbridge"');
  }

  private async deleteMatterLogfile(filename: string) {
    try {
      await fs.unlink(path.join(this.matterbridgeDirectory, filename));
    } catch (err) {
      this.matterLogger?.error(`Error deleting old log file: ${err}`);
    }
  }

  private async setupMatterFileLogger(filename: string) {
    Logger.addLogger('filelogger', await createFileLogger(path.join(this.matterbridgeDirectory, filename)), {
      defaultLogLevel: Level.DEBUG,
    });
    this.matterLogger?.notice('File logger created: ' + path.join(this.matterbridgeDirectory, filename));
  }

  /**
   * Creates a server node storage context.
   *
   * @param pluginName - The name of the plugin.
   * @param deviceName - The name of the device.
   * @param deviceType - The deviceType of the device.
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
  async createServerNodeContext(pluginName: string, deviceName: string, deviceType: DeviceTypeId, vendorId: number, vendorName: string, productId: number, productName: string, serialNumber?: string): Promise<StorageContext<Storage>> {
    if (!this.matterLogger) throw new Error('No logger initialized');
    const log = this.matterLogger;
    if (!this.matterStorageService) throw new Error('No storage service initialized');

    log.notice(`Creating server node storage context "${pluginName}.persist" for ${pluginName}...`);
    const storageManager = await this.matterStorageService.open(pluginName);
    const storageContext = storageManager.createContext('persist');
    const random = 'SN' + CryptoNode.getRandomData(8).toHex();
    await storageContext.set('storeId', pluginName);
    await storageContext.set('deviceName', deviceName);
    await storageContext.set('deviceType', deviceType);
    await storageContext.set('vendorId', vendorId);
    await storageContext.set('vendorName', vendorName.slice(0, 32));
    await storageContext.set('productId', productId);
    await storageContext.set('productName', productName.slice(0, 32));
    await storageContext.set('nodeLabel', productName.slice(0, 32));
    await storageContext.set('productLabel', productName.slice(0, 32));
    await storageContext.set('serialNumber', await storageContext.get('serialNumber', serialNumber ? serialNumber.slice(0, 32) : random));
    await storageContext.set('uniqueId', await storageContext.get('uniqueId', random));
    await storageContext.set('softwareVersion', this.matterbridgeVersion && this.matterbridgeVersion.includes('.') ? parseInt(this.matterbridgeVersion.split('.')[0], 10) : 1);
    await storageContext.set('softwareVersionString', this.matterbridgeVersion ?? '1.0.0');
    await storageContext.set('hardwareVersion', this.osVersion && this.osVersion.includes('.') ? parseInt(this.osVersion.split('.')[0], 10) : 1);
    await storageContext.set('hardwareVersionString', this.osVersion ?? '1.0.0');

    log.debug(`Created server node storage context "${pluginName}.persist"  for ${pluginName}:`);
    log.debug(`- deviceName: ${await storageContext.get('deviceName')} deviceType: ${await storageContext.get('deviceType')}(0x${(await storageContext.get('deviceType'))?.toString(16).padStart(4, '0')})`);
    log.debug(`- serialNumber: ${await storageContext.get('serialNumber')} uniqueId: ${await storageContext.get('uniqueId')}`);
    log.debug(`- softwareVersion: ${await storageContext.get('softwareVersion')} softwareVersionString: ${await storageContext.get('softwareVersionString')}`);
    log.debug(`- hardwareVersion: ${await storageContext.get('hardwareVersion')} hardwareVersionString: ${await storageContext.get('hardwareVersionString')}`);
    return storageContext;
  }

  async createServerNode(storageContext: StorageContext<Storage>, port = 5540, passcode = 20242025, discriminator = 3850) {
    if (!this.matterLogger) throw new Error('No logger initialized');
    const log = this.matterLogger;

    log.notice(`Creating server node for ${await storageContext.get<string>('storeId')}`);

    /**
     * Create a Matter ServerNode, which contains the Root Endpoint and all relevant data and configuration
     */
    const serverNode = await ServerNode.create({
      // Required: Give the Node a unique ID which is used to store the state of this node
      id: await storageContext.get<string>('storeId'),

      // Provide Network relevant configuration like the port
      // Optional when operating only one device on a host, Default port is 5540
      network: {
        port,
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
      },
    });

    /**
     * This event is triggered when the device is initially commissioned successfully.
     * This means: It is added to the first fabric.
     */
    serverNode.lifecycle.commissioned.on(() => log.notice('Server was initially commissioned successfully!'));

    /** This event is triggered when all fabrics are removed from the device, usually it also does a factory reset then. */
    serverNode.lifecycle.decommissioned.on(() => log.notice('Server was fully decommissioned successfully!'));

    /** This event is triggered when the device went online. This means that it is discoverable in the network. */
    serverNode.lifecycle.online.on(() => log.notice('Server is online'));

    /** This event is triggered when the device went offline. it is not longer discoverable or connectable in the network. */
    serverNode.lifecycle.offline.on(() => log.notice('Server is offline'));

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
      log.notice(`Commissioned Fabrics changed event (${action}) for ${fabricIndex} triggered`);
      log.notice(this.matterServerNode?.state.commissioning.fabrics[fabricIndex]);
    });

    /**
     * This event is triggered when an operative new session was opened by a Controller.
     * It is not triggered for the initial commissioning process, just afterwards for real connections.
     */
    serverNode.events.sessions.opened.on((session) => log.notice('Session opened', session));

    /**
     * This event is triggered when an operative session is closed by a Controller or because the Device goes offline.
     */
    serverNode.events.sessions.closed.on((session) => log.notice('Session closed', session));

    /** This event is triggered when a subscription gets added or removed on an operative session. */
    serverNode.events.sessions.subscriptionsChanged.on((session) => {
      log.notice('Session subscriptions changed', session);
      log.notice('Status of all sessions', this.matterServerNode?.state.sessions.sessions);
    });

    return serverNode;
  }

  showServerNodeQR() {
    if (!this.matterServerNode || !this.matterLogger) return;
    const log = this.matterLogger;
    if (!this.matterServerNode.lifecycle.isCommissioned) {
      const { qrPairingCode, manualPairingCode } = this.matterServerNode.state.commissioning.pairingCodes;
      console.log(QrCode.get(qrPairingCode));
      log.notice(`QR Code URL: https://project-chip.github.io/connectedhomeip/qrcode.html?data=${qrPairingCode}`);
      log.notice(`Manual pairing code: ${manualPairingCode}`);
    } else {
      log.notice('Device is already commissioned. Waiting for controllers to connect ...');
      log.notice('Fabrics:', this.matterServerNode.state.commissioning.fabrics);
      for (const key in this.matterServerNode.state.commissioning.fabrics) {
        const fabric = this.matterServerNode.state.commissioning.fabrics[FabricIndex(Number(key))];
        log.notice(`- index ${fabric.fabricIndex} id ${fabric.fabricId} nodeId ${fabric.nodeId} rootVendor ${fabric.rootVendorId} rootNodeId ${fabric.rootNodeId}`);
      }
    }
  }

  async stopServerNode() {
    if (!this.matterServerNode) return;
    await this.matterServerNode.close();
  }

  async createAggregator(storageContext: StorageContext<Storage>) {
    if (!this.matterLogger) throw new Error('No logger initialized');
    const log = this.matterLogger;

    log.notice(`Creating ${await storageContext.get<string>('storeId')} aggregator `);

    const aggregator = new Endpoint(AggregatorEndpoint, { id: `${await storageContext.get<string>('storeId')} aggregator` });
    return aggregator;
  }

  async startBridge() {
    if (!this.matterLogger) throw new Error('No logger initialized');
    const log = this.matterLogger;

    const storageContext = await this.createServerNodeContext('Matterbridge', 'Matterbridge', AggregatorEndpoint.deviceType, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Aggregator');

    this.matterServerNode = await this.createServerNode(storageContext);

    this.matterAggregator = await this.createAggregator(storageContext);

    log.notice(`Adding ${await storageContext.get<string>('storeId')} aggregator to ${await storageContext.get<string>('storeId')} server node`);
    await this.matterServerNode.add(this.matterAggregator);

    for (const plugin of this.registeredPlugins) {
      if (!plugin.enabled) {
        log.info(`Plugin ${plg}${plugin.name}${nf} not enabled`);
        continue;
      }
      plugin.error = false;
      plugin.loaded = false;
      plugin.started = false;
      plugin.configured = false;
      plugin.connected = undefined;
      plugin.qrPairingCode = undefined;
      plugin.manualPairingCode = undefined;
      this.loadPlugin(plugin, true, 'Matterbridge is starting'); // No await do it asyncronously
    }

    log.notice(`Adding lightEndpoint1 to ${await storageContext.get<string>('storeId')} aggregator`);
    const lightEndpoint1 = new Endpoint(OnOffLightDevice.with(BridgedDeviceBasicInformationServer), {
      id: 'OnOffLight',
      bridgedDeviceBasicInformation: {
        vendorId: VendorId(await storageContext.get<number>('vendorId')),
        vendorName: await storageContext.get<string>('vendorName'),

        productName: 'Light',
        productLabel: 'Light',
        nodeLabel: 'Light',

        serialNumber: '0x123456789',
        uniqueId: '0x123456789',
        reachable: true,
      },
    });
    this.matterAggregator.add(lightEndpoint1);

    log.notice(`Adding switchEnpoint2 to ${await storageContext.get<string>('storeId')} aggregator`);
    const switchEnpoint2 = new Endpoint(GenericSwitchDevice.with(BridgedDeviceBasicInformationServer, SwitchServer.with('MomentarySwitch', 'MomentarySwitchLongPress', 'MomentarySwitchMultiPress', 'MomentarySwitchRelease')), {
      id: 'GenericSwitch',
      bridgedDeviceBasicInformation: {
        vendorId: VendorId(await storageContext.get<number>('vendorId')),
        vendorName: await storageContext.get<string>('vendorName'),

        productName: 'GenericSwitch',
        productLabel: 'GenericSwitch',
        nodeLabel: 'GenericSwitch',

        serialNumber: '0x123456739',
        uniqueId: '0x123456739',
        reachable: true,
      },
      switch: {
        numberOfPositions: 2,
        currentPosition: 0,
        multiPressMax: 2,
      },
    });
    this.matterAggregator.add(switchEnpoint2);
    switchEnpoint2.events.identify.startIdentifying.on(() => log.notice('Run identify logic, ideally blink a light every 0.5s ...'));
    switchEnpoint2.events.switch.currentPosition$Changed.on(() => log.notice('Run identify logic, ideally blink a light every 0.5s ...'));
    // switchEnpoint2.events.switch.emit('initialPress', { newPosition: 1 }, ActionContext.agentFor(switchEnpoint2) );

    log.notice(`Adding matterbridge device to ${await storageContext.get<string>('storeId')} aggregator`);
    const matterbridgeDevice3 = new MatterbridgeDeviceV8(DeviceTypes.TEMPERATURE_SENSOR, { uniqueStorageKey: 'TemperatureSensor' });
    this.matterAggregator.add(matterbridgeDevice3);

    log.notice(`Starting ${await storageContext.get<string>('storeId')} server node`);
    await this.matterServerNode.bringOnline();

    /*
    logEndpoint(EndpointServer.forEndpoint(this.matterServerNode));
    console.log('matterbridgeDevice3\n', matterbridgeDevice3);
    console.log('matterbridgeDevice3.events\n', matterbridgeDevice3.events);
    console.log('matterbridgeDevice3.events.identify\n', matterbridgeDevice3.eventsOf(IdentifyServer));
    console.log('matterbridgeDevice3.state\n', matterbridgeDevice3.state);
    console.log('matterbridgeDevice3.state.temperatureMeasurement\n', matterbridgeDevice3.stateOf(TemperatureMeasurementServer));
    // matterbridgeDevice3.eventsOf(IdentifyServer);
    // matterbridgeDevice3.events.identify.startIdentifying.on(() => log.notice('Run identify logic, ideally blink a light every 0.5s ...'));
    */

    this.showServerNodeQR();
  }

  async startChildbridge() {
    //
  }

  async startController() {
    //
  }

  /**
   * Adds a bridged device to the Matterbridge.
   * @param pluginName - The name of the plugin.
   * @param device - The bridged device to add.
   * @returns {Promise<void>} - A promise that resolves when the storage process is started.
   */
  async addBridgedDevice(pluginName: string, device: MatterbridgeDeviceV8): Promise<void> {
    log.info(`Adding bridged device ${dev}${device.deviceName}${nf} for plugin ${plg}${pluginName}${nf}`);
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
      return Promise.reject(new Error(`Plugin ${plg}${plugin.name}${er} not enabled`));
    }
    if (plugin.platform) {
      return Promise.resolve(plugin.platform);
    }
    log.info(`Loading plugin ${plg}${plugin.name}${nf} type ${typ}${plugin.type}${nf}`);
    try {
      // Load the package.json of the plugin
      const packageJson = JSON.parse(await fs.readFile(plugin.path, 'utf8'));
      // Resolve the main module path relative to package.json
      const pluginEntry = path.resolve(path.dirname(plugin.path), packageJson.main);
      // Dynamically import the plugin
      const pluginUrl = pathToFileURL(pluginEntry);
      log.debug(`Importing plugin ${plg}${plugin.name}${db} from ${pluginUrl.href}`);
      const pluginInstance = await import(pluginUrl.href);
      log.debug(`Imported plugin ${plg}${plugin.name}${db} from ${pluginUrl.href}`);

      // Call the default export function of the plugin, passing this MatterBridge instance, the log and the config
      if (pluginInstance.default) {
        const config: PlatformConfig = await this.loadPluginConfig(plugin);
        const log = new AnsiLogger({ logName: plugin.description, logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: true });
        const platform = pluginInstance.default(this, log, config) as MatterbridgePlatform;
        platform.name = packageJson.name;
        platform.config = config;
        platform.version = packageJson.version;
        plugin.name = packageJson.name;
        plugin.description = packageJson.description;
        plugin.version = packageJson.version;
        plugin.author = packageJson.author;
        plugin.type = platform.type;
        plugin.platform = platform;
        plugin.loaded = true;
        plugin.registeredDevices = 0;
        plugin.addedDevices = 0;
        // Save the updated plugin data in the node storage
        // await this.nodeContext?.set<RegisteredPlugin[]>('plugins', await this.getBaseRegisteredPlugins());

        // await this.getPluginLatestVersion(plugin);

        log.info(`Loaded plugin ${plg}${plugin.name}${nf} type ${typ}${platform.type} ${db}(entrypoint ${UNDERLINE}${pluginEntry}${UNDERLINEOFF})`);
        if (start) this.startPlugin(plugin, message); // No await do it asyncronously
        return Promise.resolve(platform);
      } else {
        plugin.error = true;
        return Promise.reject(new Error(`Plugin ${plg}${plugin.name}${er} does not provide a default export`));
      }
    } catch (err) {
      plugin.error = true;
      return Promise.reject(new Error(`Failed to load plugin ${plg}${plugin.name}${er}: ${err}`));
    }
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
      return Promise.reject(new Error(`Plugin ${plg}${plugin.name}${er} not loaded or no platform`));
    }
    if (plugin.started) {
      log.debug(`Plugin ${plg}${plugin.name}${db} already started`);
      return Promise.resolve();
    }
    log.info(`Starting plugin ${plg}${plugin.name}${db} type ${typ}${plugin.type}${db}`);
    try {
      plugin.platform
        .onStart(message)
        .then(() => {
          plugin.started = true;
          log.info(`Started plugin ${plg}${plugin.name}${db} type ${typ}${plugin.type}${db}`);
          if (configure) this.configurePlugin(plugin); // No await do it asyncronously
          return Promise.resolve();
        })
        .catch((err) => {
          plugin.error = true;
          return Promise.reject(new Error(`Failed to start plugin ${plg}${plugin.name}${er}: ${err}`));
        });
    } catch (err) {
      plugin.error = true;
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
      return Promise.reject(new Error(`Plugin ${plg}${plugin.name}${er} not loaded (${plugin.loaded}) or not started (${plugin.started}) or not platform (${plugin.platform?.name})`));
    }
    if (plugin.configured) {
      log.info(`Plugin ${plg}${plugin.name}${nf} already configured`);
      return Promise.resolve();
    }
    log.info(`Configuring plugin ${plg}${plugin.name}${db} type ${typ}${plugin.type}${db}`);
    try {
      plugin.platform
        .onConfigure()
        .then(() => {
          plugin.configured = true;
          log.info(`Configured plugin ${plg}${plugin.name}${db} type ${typ}${plugin.type}${db}`);
          // this.savePluginConfig(plugin);
          return Promise.resolve();
        })
        .catch((err) => {
          plugin.error = true;
          return Promise.reject(new Error(`Failed to configure plugin ${plg}${plugin.name}${er}: ${err}`));
        });
    } catch (err) {
      plugin.error = true;
      return Promise.reject(new Error(`Failed to configure plugin ${plg}${plugin.name}${er}: ${err}`));
    }
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
      // this.log.debug(`Config file found: ${configFile}.\nConfig:${rs}\n`, config);
      log.debug(`Config file found: ${configFile}.`);
      /* The first time a plugin is added to the system, the config file is created with the plugin name and type "".*/
      config.name = plugin.name;
      config.type = plugin.type;
      return config;
    } catch (err) {
      if (err instanceof Error) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'ENOENT') {
          let config: PlatformConfig;
          if (plugin.name === 'matterbridge-zigbee2mqtt') config = zigbee2mqtt_config;
          else if (plugin.name === 'matterbridge-somfy-tahoma') config = somfytahoma_config;
          else if (plugin.name === 'matterbridge-shelly') config = shelly_config;
          else config = { name: plugin.name, type: plugin.type, unregisterOnShutdown: false };
          try {
            await this.writeFile(configFile, JSON.stringify(config, null, 2));
            log.debug(`Created config file: ${configFile}.`);
            // this.log.debug(`Created config file: ${configFile}.\nConfig:${rs}\n`, config);
            return config;
          } catch (err) {
            log.error(`Error creating config file ${configFile}: ${err}`);
            return config;
          }
        } else {
          log.error(`Error accessing config file ${configFile}: ${err}`);
          return {};
        }
      }
      log.error(`Error loading config file ${configFile}: ${err}`);
      return {};
    }
  }

  /**
   * Writes data to a file.
   *
   * @param {string} filePath - The path of the file to write to.
   * @param {string} data - The data to write to the file.
   * @returns {Promise<void>} - A promise that resolves when the data is successfully written to the file.
   */
  private async writeFile(filePath: string, data: string): Promise<void> {
    // Write the data to a file
    await fs
      .writeFile(`${filePath}`, data, 'utf8')
      .then(() => {
        log.debug(`Successfully wrote to ${filePath}`);
      })
      .catch((error) => {
        log.error(`Error writing to ${filePath}:`, error);
      });
  }
}

// node dist/matterbridgeV8.js MatterbridgeV8
if (process.argv.includes('MatterbridgeV8')) {
  const matterbridge = await MatterbridgeV8.create();

  if (process.argv.includes('-bridge')) await matterbridge.startBridge();
  if (process.argv.includes('-childbridge')) await matterbridge.startChildbridge();
  if (process.argv.includes('-controller')) await matterbridge.startController();

  process.on('SIGINT', async function () {
    console.log('Caught interrupt signal');
    await matterbridge.stopServerNode();
    process.exit();
  });
}
