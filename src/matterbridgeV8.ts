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
import { StorageContext, StorageManager } from '@project-chip/matter-node.js/storage';
import { Environment, StorageService } from '@project-chip/matter.js/environment';
import { ServerNode } from '@project-chip/matter.js/node';
import { OnOffLightDevice } from '@project-chip/matter.js/devices/OnOffLightDevice';
import { Endpoint, EndpointServer } from '@project-chip/matter.js/endpoint';
import { DeviceTypes, logEndpoint } from '@project-chip/matter-node.js/device';
import { QrCode } from '@project-chip/matter-node.js/schema';
import { FabricAction } from '@project-chip/matter-node.js/fabric';
import { AggregatorEndpoint } from '@project-chip/matter.js/endpoints/AggregatorEndpoint';
import { BridgedNodeEndpoint } from '@project-chip/matter.js/endpoints/BridgedNodeEndpoint';
import { BridgedDeviceBasicInformationServer } from '@project-chip/matter.js/behavior/definitions/bridged-device-basic-information';
import { OnOffServer } from '@project-chip/matter.js/behavior/definitions/on-off';
import { ColorDimmerSwitchDevice } from '@project-chip/matter.js/devices/ColorDimmerSwitchDevice';

import { AnsiLogger, BRIGHT, RESET, TimestampFormat, UNDERLINE, UNDERLINEOFF, YELLOW, db, debugStringify, stringify, er, nf, rs, wr, RED, GREEN, zb, CYAN } from 'node-ansi-logger';

import EventEmitter from 'events';
import path from 'path';
import { promises as fs } from 'fs';
import { MatterbridgeDeviceV8 } from './matterbridgeDeviceV8.js';
import { BasicInformationCluster } from '@project-chip/matter-node.js/cluster';

/**
 * Represents the Matterbridge application.
 */
export class MatterbridgeV8 extends EventEmitter {
  private environment = Environment.default;

  public matterbridgeVersion = '2.0.0';
  public osVersion = '10.0.22631';
  public matterbridgeDirectory = '';
  public matterbridgePluginDirectory = '';
  public globalModulesDirectory = '';

  public matterStorageService?: StorageService;
  public matterStorageManager?: StorageManager;
  public matterStorageContext?: StorageContext;

  public matterServerNode?: ServerNode<ServerNode.RootEndpoint>;

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
    this.matterLogger = Logger.get('Matterbridge');

    this.matterbridgeDirectory = 'C:\\Users\\lligu\\.matterbridge';
    this.matterbridgePluginDirectory = 'C:\\Users\\lligu\\Matterbridge';

    await this.deleteMatterLogfile('matterbridge.log');

    this.setupMatterVars(Level.DEBUG, Format.ANSI);

    await this.setupMatterStorage();

    await this.setupMatterFileLogger('matterbridge.log');
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
    this.matterLogger?.notice('Storage manager created');

    this.matterStorageContext = this.matterStorageManager.createContext('persist');
    this.matterLogger?.notice('Storage context created');
  }

  private async deleteMatterLogfile(filename: string) {
    try {
      await fs.unlink(path.join(this.matterbridgeDirectory, filename));
    } catch (err) {
      console.error(`Error deleting old log file: ${err}`);
    }
  }
  private async setupMatterFileLogger(filename: string) {
    Logger.addLogger('filelogger', await createFileLogger(path.join(this.matterbridgeDirectory, filename)), {
      defaultLogLevel: Level.DEBUG,
    });
    this.matterLogger?.notice('File logger created: ' + path.join(this.matterbridgeDirectory, filename));
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
  private async createServerNodeContext(pluginName: string, deviceName: string, deviceType: DeviceTypeId, vendorId: number, vendorName: string, productId: number, productName: string) {
    if (!this.matterLogger) return;
    const log = this.matterLogger;
    if (!this.matterStorageService || !this.matterStorageManager) {
      log.error('No storage manager initialized');
      return;
    }
    log.debug(`Creating commissioning server storage context for ${pluginName}...`);
    const storageContext = this.matterStorageManager.createContext('persist');
    const random = 'AG' + CryptoNode.getRandomData(8).toHex();
    await storageContext.set('storeId', pluginName);
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
    await storageContext.set('hardwareVersion', this.osVersion && this.osVersion.includes('.') ? parseInt(this.osVersion.split('.')[0], 10) : 1);
    await storageContext.set('hardwareVersionString', this.osVersion ?? '1.0.0');

    log.debug(`Created commissioning server storage context for ${pluginName}:`);
    log.debug(`- deviceName: ${await storageContext.get('deviceName')} deviceType: ${await storageContext.get('deviceType')}(0x${(await storageContext.get('deviceType'))?.toString(16).padStart(4, '0')})`);
    log.debug(`- serialNumber: ${await storageContext.get('serialNumber')} uniqueId: ${await storageContext.get('uniqueId')}`);
    log.debug(`- softwareVersion: ${await storageContext.get('softwareVersion')} softwareVersionString: ${await storageContext.get('softwareVersionString')}`);
    log.debug(`- hardwareVersion: ${await storageContext.get('hardwareVersion')} hardwareVersionString: ${await storageContext.get('hardwareVersionString')}`);
    log.notice(`Created commissioning server storage context for ${pluginName}`);
    return storageContext;
  }

  async startServerNode(port = 5080, passcode = 20202021, discriminator = 3840) {
    if (!this.matterLogger) return;
    const log = this.matterLogger;
    log.notice('Starting Matterbridge');
    this.matterStorageContext = await this.createServerNodeContext('Matterbridge', 'Matterbridge', AggregatorEndpoint.deviceType, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Aggregator');
    if (!this.matterStorageContext) {
      log.error('Error creating storage context for Matterbridge');
      return;
    }

    /**
     * Create a Matter ServerNode, which contains the Root Endpoint and all relevant data and configuration
     */
    this.matterServerNode = await ServerNode.create({
      // Required: Give the Node a unique ID which is used to store the state of this node
      id: await this.matterStorageContext.get<string>('storeId'),

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
        name: await this.matterStorageContext.get<string>('deviceName'),
        deviceType: DeviceTypeId(await this.matterStorageContext.get<number>('deviceType')),
      },

      // Provide defaults for the BasicInformation cluster on the Root endpoint
      // Optional: If Omitted some development defaults are used
      basicInformation: {
        vendorId: VendorId(await this.matterStorageContext.get<number>('vendorId')),
        vendorName: await this.matterStorageContext.get<string>('vendorName'),

        productId: await this.matterStorageContext.get<number>('productId'),
        productName: await this.matterStorageContext.get<string>('productName'),
        productLabel: await this.matterStorageContext.get<string>('productName'),
        nodeLabel: await this.matterStorageContext.get<string>('productName'),

        serialNumber: await this.matterStorageContext.get<string>('serialNumber'),
        uniqueId: await this.matterStorageContext.get<string>('uniqueId'),

        softwareVersion: await this.matterStorageContext.get<number>('softwareVersion'),
        softwareVersionString: await this.matterStorageContext.get<string>('softwareVersionString'),
        hardwareVersion: await this.matterStorageContext.get<number>('hardwareVersion'),
        hardwareVersionString: await this.matterStorageContext.get<string>('hardwareVersionString'),
      },
    });

    /**
     * Matter Nodes are a composition of endpoints. Create and add a single endpoint to the node. This example uses the
     * OnOffLightDevice or OnOffPlugInUnitDevice depending on the value of the type parameter. It also assigns this Part a
     * unique ID to store the endpoint number for it in the storage to restore the device on restart.
     * In this case we directly use the default command implementation from matter.js. Check out the DeviceNodeFull example
     * to see how to customize the command handlers.
     */
    const lightEndpoint = new Endpoint(OnOffLightDevice.with(BridgedDeviceBasicInformationServer), {
      id: 'OnOffLight',
      bridgedDeviceBasicInformation: {
        vendorId: VendorId(await this.matterStorageContext.get<number>('vendorId')),
        vendorName: await this.matterStorageContext.get<string>('vendorName'),

        productName: 'Light',
        productLabel: 'Light',
        nodeLabel: 'Light',

        serialNumber: '0x123456789',
        uniqueId: '0x123456789',
        reachable: true,
      },
    });
    console.log('lightEndpoint', lightEndpoint);

    /**
     * Register state change handlers and events of the node for identify and onoff states to react to the commands.
     * If the code in these change handlers fail then the change is also rolled back and not executed and an error is
     * reported back to the controller.
     */
    lightEndpoint.events.identify.startIdentifying.on(() => log.notice('Run identify logic, ideally blink a light every 0.5s ...'));

    lightEndpoint.events.identify.stopIdentifying.on(() => log.notice('Stop identify logic ...'));

    lightEndpoint.events.onOff.onOff$Changed.on((value) => log.notice(`OnOff is now ${value ? 'ON' : 'OFF'}`));

    const switchEndpoint = new Endpoint(ColorDimmerSwitchDevice.with(BridgedDeviceBasicInformationServer, OnOffServer), {
      id: 'OnOffSwitch',
      bridgedDeviceBasicInformation: {
        vendorId: VendorId(await this.matterStorageContext.get<number>('vendorId')),
        vendorName: await this.matterStorageContext.get<string>('vendorName'),

        productName: 'Switch',
        productLabel: 'Switch',
        nodeLabel: 'Switch',

        serialNumber: '0x123456789S',
        uniqueId: '0x123456789S',
        reachable: true,
      },
    });

    console.log('switchEndpoint', switchEndpoint);

    // await this.matterServerNode.add(endpoint);
    // const mbV8 = new MatterbridgeDeviceV8(DeviceTypes.OnOffLight);
    // const endpoint = mbV8.getBridgedNodeEndpointV8();

    const aggregator = new Endpoint(AggregatorEndpoint, { id: 'aggregator' });

    await this.matterServerNode.add(aggregator);

    await aggregator.add(lightEndpoint);
    await aggregator.add(switchEndpoint);

    /**
     * Log the endpoint structure for debugging reasons and to allow to verify anything is correct
     */
    logEndpoint(EndpointServer.forEndpoint(this.matterServerNode));

    /**
     * This event is triggered when the device is initially commissioned successfully.
     * This means: It is added to the first fabric.
     */
    this.matterServerNode.lifecycle.commissioned.on(() => log.notice('Server was initially commissioned successfully!'));

    /** This event is triggered when all fabrics are removed from the device, usually it also does a factory reset then. */
    this.matterServerNode.lifecycle.decommissioned.on(() => log.notice('Server was fully decommissioned successfully!'));

    /** This event is triggered when the device went online. This means that it is discoverable in the network. */
    this.matterServerNode.lifecycle.online.on(() => log.notice('Server is online'));

    /** This event is triggered when the device went offline. it is not longer discoverable or connectable in the network. */
    this.matterServerNode.lifecycle.offline.on(() => log.notice('Server is offline'));

    /**
     * This event is triggered when a fabric is added, removed or updated on the device. Use this if more granular
     * information is needed.
     */
    this.matterServerNode.events.commissioning.fabricsChanged.on((fabricIndex, fabricAction) => {
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
    this.matterServerNode.events.sessions.opened.on((session) => log.notice('Session opened', session));

    /**
     * This event is triggered when an operative session is closed by a Controller or because the Device goes offline.
     */
    this.matterServerNode.events.sessions.closed.on((session) => log.notice('Session closed', session));

    /** This event is triggered when a subscription gets added or removed on an operative session. */
    this.matterServerNode.events.sessions.subscriptionsChanged.on((session) => {
      log.notice('Session subscriptions changed', session);
      log.notice('Status of all sessions', this.matterServerNode?.state.sessions.sessions);
    });

    await this.matterServerNode.bringOnline();
    console.log('lightEndpoint', lightEndpoint);
    console.log('switchEndpoint', switchEndpoint);
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
}

// node dist/matterbridgeV8.js MatterbridgeV8
if (process.argv.includes('MatterbridgeV8')) {
  const matterbridge = await MatterbridgeV8.create();
  await matterbridge.startServerNode(5070, 20242025, 3950);
  matterbridge.showServerNodeQR();

  process.on('SIGINT', async function () {
    console.log('Caught interrupt signal');
    await matterbridge.stopServerNode();
    process.exit();
  });
}
