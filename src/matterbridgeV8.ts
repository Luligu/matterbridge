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

import { IdentifyServer } from '@project-chip/matter.js/behavior/definitions/identify';
import { OnOffServer } from '@project-chip/matter.js/behavior/definitions/on-off';
import { GroupsServer } from '@project-chip/matter.js/behavior/definitions/groups';
import { ScenesServer } from '@project-chip/matter.js/behavior/definitions/scenes';
import { BridgedDeviceBasicInformationServer } from '@project-chip/matter.js/behavior/definitions/bridged-device-basic-information';

import { ColorDimmerSwitchDevice } from '@project-chip/matter.js/devices/ColorDimmerSwitchDevice';
import { OnOffLightDevice, OnOffLightRequirements } from '@project-chip/matter.js/devices/OnOffLightDevice';

import { MutableEndpoint } from '@project-chip/matter.js/endpoint/type';
import { SupportedBehaviors } from '@project-chip/matter.js/endpoint/properties';

import { AnsiLogger, BRIGHT, RESET, TimestampFormat, UNDERLINE, UNDERLINEOFF, YELLOW, db, debugStringify, stringify, er, nf, rs, wr, RED, GREEN, zb, CYAN } from 'node-ansi-logger';

import EventEmitter from 'events';
import path from 'path';
import { promises as fs } from 'fs';
import { MatterbridgeDeviceV8 } from './matterbridgeDeviceV8.js';
import { BasicInformationCluster } from '@project-chip/matter-node.js/cluster';
import { dimmableSwitch } from './matterbridgeDevice.js';

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
     * Matter Nodes are a composition of endpoints. Create and add a single endpoint to the node. This example uses the
     * OnOffLightDevice or OnOffPlugInUnitDevice depending on the value of the type parameter. It also assigns this Part a
     * unique ID to store the endpoint number for it in the storage to restore the device on restart.
     * In this case we directly use the default command implementation from matter.js. Check out the DeviceNodeFull example
     * to see how to customize the command handlers.
     */

    /*
    const lightEndpoint = new Endpoint(OnOffLightDevice.with(BridgedDeviceBasicInformationServer), {
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
    */

    /**
     * Register state change handlers and events of the node for identify and onoff states to react to the commands.
     * If the code in these change handlers fail then the change is also rolled back and not executed and an error is
     * reported back to the controller.
     */
    /*
    lightEndpoint.events.identify.startIdentifying.on(() => log.notice('Run identify logic, ideally blink a light every 0.5s ...'));

    lightEndpoint.events.identify.stopIdentifying.on(() => log.notice('Stop identify logic ...'));

    lightEndpoint.events.onOff.onOff$Changed.on((value) => log.notice(`OnOff is now ${value ? 'ON' : 'OFF'}`));

    const OnOffSwitchDeviceDefinition = MutableEndpoint({
      name: 'OnOffSwitch',
      deviceType: 0x103,
      deviceRevision: 2,
      requirements: {
        server: {
          mandatory: {},
          optional: {},
        },
        client: {
          mandatory: {},
          optional: {},
        },
      },
      behaviors: SupportedBehaviors(IdentifyServer, GroupsServer, ScenesServer, OnOffServer, BridgedDeviceBasicInformationServer),
    });
    console.log('OnOffSwitchDeviceDefinition\n', OnOffSwitchDeviceDefinition);

    const switchEndpoint = new Endpoint(OnOffSwitchDeviceDefinition, {
      id: 'OnOffSwitch',
      onOff: {
        onOff: false,
      },
      bridgedDeviceBasicInformation: {
        vendorId: VendorId(await storageContext.get<number>('vendorId')),
        vendorName: await storageContext.get<string>('vendorName'),

        productName: 'Switch',
        productLabel: 'Switch',
        nodeLabel: 'Switch',

        serialNumber: '0x123456789S',
        uniqueId: '0x123456789S',
        reachable: true,
      },
    });

    // await this.matterServerNode.add(endpoint);
    // const mbV8 = new MatterbridgeDeviceV8(DeviceTypes.OnOffLight);
    // const endpoint = mbV8.getBridgedNodeEndpointV8();

    const aggregator = new Endpoint(AggregatorEndpoint, { id: 'aggregator' });

    await this.matterServerNode.add(aggregator);

    await aggregator.add(lightEndpoint);
    await aggregator.add(switchEndpoint);
*/

    /**
     * Log the endpoint structure for debugging reasons and to allow to verify anything is correct
     */
    // logEndpoint(EndpointServer.forEndpoint(this.matterServerNode));

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

    /*
    console.log('lightEndpoint\n', lightEndpoint);
    console.log('switchEndpoint\n', switchEndpoint);
    */
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
    const switchEnpoint2definition = MutableEndpoint({
      name: 'OnOffSwitch',
      deviceType: 0x103,
      deviceRevision: 2,
      requirements: {
        server: {
          mandatory: {},
          optional: {},
        },
        client: {
          mandatory: {},
          optional: {},
        },
      },
      behaviors: SupportedBehaviors(IdentifyServer, GroupsServer, ScenesServer, OnOffServer, BridgedDeviceBasicInformationServer),
    });
    const switchEnpoint2 = new Endpoint(switchEnpoint2definition, {
      id: 'OnOffSwitch',
      bridgedDeviceBasicInformation: {
        vendorId: VendorId(await storageContext.get<number>('vendorId')),
        vendorName: await storageContext.get<string>('vendorName'),

        productName: 'Switch',
        productLabel: 'Switch',
        nodeLabel: 'Switch',

        serialNumber: '0x123456739',
        uniqueId: '0x123456739',
        reachable: true,
      },
    });
    this.matterAggregator.add(switchEnpoint2);

    /*
    log.notice(`Adding dimmableSwitchEnpoint3 to ${await storageContext.get<string>('storeId')} aggregator`);
    const dimmableSwitchEnpoint3 = getEntpointV8(dimmableSwitch, {
      id: 'OnOffDimmerSwitch',
      bridgedDeviceBasicInformation: {
        vendorId: VendorId(await storageContext.get<number>('vendorId')),
        vendorName: await storageContext.get<string>('vendorName'),

        productName: 'dimmerSwitch',
        productLabel: 'dimmerSwitch',
        nodeLabel: 'dimmerSwitch',

        serialNumber: '0x123436739',
        uniqueId: '0x123436739',
        reachable: true,
      },
    });
    this.matterAggregator.add(dimmableSwitchEnpoint3);
    */

    log.notice(`Adding matterbridge device to ${await storageContext.get<string>('storeId')} aggregator`);
    const matterbridgeDevice = new MatterbridgeDeviceV8(DeviceTypes.TEMPERATURE_SENSOR, { uniqueStorageKey: 'TemperatureSensor' });
    this.matterAggregator.add(matterbridgeDevice);
    // console.log('matterbridgeDevice\n', matterbridgeDevice);

    log.notice(`Starting ${await storageContext.get<string>('storeId')} server node`);
    await this.matterServerNode.bringOnline();

    logEndpoint(EndpointServer.forEndpoint(this.matterServerNode));

    this.showServerNodeQR();
  }

  async startChildbridge() {
    //
  }

  async startController() {
    //
  }
}

export function getEntpointV8(definition: DeviceTypeDefinition, options?: Endpoint.Options) {
  const definitionV8 = MutableEndpoint({
    name: definition.name.replace('-', '_'),
    deviceType: definition.code,
    deviceRevision: definition.revision,
    requirements: {
      server: {
        mandatory: {},
        optional: {},
      },
      client: {
        mandatory: {},
        optional: {},
      },
    },
    behaviors: SupportedBehaviors(IdentifyServer, GroupsServer, ScenesServer, OnOffServer, BridgedDeviceBasicInformationServer),
  });
  return new Endpoint(definitionV8, options);
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
