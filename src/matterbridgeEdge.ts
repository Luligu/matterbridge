/* eslint-disable no-console */
/**
 * This file contains the class MatterbridgeEdge that extends the Matterbridge class.
 *
 * @file matterbridgeEdge.ts
 * @author Luca Liguori
 * @date 2024-10-01
 * @version 1.0.0
 *
 * Copyright 2024, 2025, 2026 Luca Liguori.
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

/* eslint-disable @typescript-eslint/no-unused-vars */

// Node.js modules
import path from 'path';
import os from 'os';
import { randomBytes } from 'crypto';

// NodeStorage and AnsiLogger modules
import { rs, GREEN } from 'node-ansi-logger';
import { NodeStorage } from 'node-persist-manager';

// Matterbridge
import { Matterbridge } from './matterbridge.js';
import { MatterbridgeDevice } from './matterbridgeDevice.js';
import { copyDirectory, getParameter, hasParameter } from './utils/utils.js';

// @matter
import { DeviceTypeId, LogLevel as MatterLogLevel, LogFormat as MatterLogFormat, VendorId, FabricIndex, Endpoint } from '@matter/main';
import { ServerNode, Endpoint as EndpointNode, Environment, StorageService, StorageContext, StorageManager } from '@matter/main';
import { BasicInformationCluster } from '@matter/main/clusters';
import { FabricAction } from '@matter/main/protocol';
import { OnOffLightDevice } from '@matter/main/devices';
import { AggregatorEndpoint } from '@matter/main/endpoints';
import { BridgedDeviceBasicInformationServer } from '@matter/main/behaviors';

// @project-chip
import { CommissioningServer, MatterServer, NodeOptions } from '@project-chip/matter.js';
import { Aggregator, Device, DeviceTypes } from '@project-chip/matter.js/device';

const verbose = hasParameter('verbose');

/**
 * Represents the MatterbridgeEdge application.
 */
export class MatterbridgeEdge extends Matterbridge {
  static override instance: MatterbridgeEdge | undefined;

  // Matter environment
  private environment = Environment.default;

  // Matter storage
  public matterStorageService?: StorageService;

  // Mapping of CommissioningServer to ServerNode
  private csToMatterNode = new Map<string, { commissioningServer: CommissioningServer; serverNode: ServerNode }>();

  // Mapping of Aggregator to AggregatorEndpoint
  private agToMatterNode = new Map<string, { aggregator: Aggregator; aggregatorNode: EndpointNode<AggregatorEndpoint> }>();

  private constructor() {
    super();
  }

  static override async loadInstance(initialize = false) {
    if (!MatterbridgeEdge.instance) {
      if (hasParameter('debug')) console.log(GREEN + 'Creating a new instance of MatterbridgeEdge.', initialize ? 'Initializing...' : 'Not initializing...', rs);
      MatterbridgeEdge.instance = new MatterbridgeEdge();
      if (initialize) await MatterbridgeEdge.instance.initialize();
    }
    return MatterbridgeEdge.instance;
  }

  public override async initialize() {
    if (hasParameter('debug')) console.log('Initializing MatterbridgeEdge...');

    // Set the matterbridge directory
    this.homeDirectory = getParameter('homedir') ?? os.homedir();
    this.matterbridgeDirectory = path.join(this.homeDirectory, '.matterbridge');
    this.matterStorageName = 'matterstorage' + (getParameter('profile') ? '.' + getParameter('profile') : '');

    // Setup matter environment
    this.environment.vars.set('log.level', MatterLogLevel.INFO);
    this.environment.vars.set('log.format', MatterLogFormat.ANSI);
    this.environment.vars.set('path.root', path.join(this.matterbridgeDirectory, this.matterStorageName));
    this.environment.vars.set('runtime.signals', false);
    this.environment.vars.set('runtime.exitcode', false);

    // Initialize the base Matterbridge class
    await super.initialize();

    // Setup Matter commissioning server
    this.port = 5540;
    this.passcode = 20242025;
    this.discriminator = 3840;
  }

  override async startMatterStorage(storageType: string, storageName: string): Promise<void> {
    // Setup Matter storage
    this.log.info(`Starting matter node storage...`);

    this.matterStorageService = this.environment.get(StorageService);
    this.log.info(`Matter node storage service created: ${this.matterStorageService.location}`);

    this.storageManager = await this.matterStorageService.open('Matterbridge');
    this.log.info('Matter node storage manager "Matterbridge" created');

    this.matterbridgeContext = await this.createServerNodeContext('Matterbridge', 'Matterbridge', DeviceTypes.AGGREGATOR.code, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge aggregator');

    this.log.info('Matter node storage started');

    // Backup matter storage since it is created/opened correctly
    await this.backupMatterStorage(path.join(this.matterbridgeDirectory, this.matterStorageName), path.join(this.matterbridgeDirectory, this.matterStorageName + '.backup'));
  }

  override async backupMatterStorage(storageName: string, backupName: string) {
    this.log.info('Creating matter node storage backup...');
    await copyDirectory(storageName, backupName);
    this.log.info('Created matter node storage backup');
  }

  override async stopMatterStorage(): Promise<void> {
    this.log.info('Closing matter node storage...');
    this.storageManager?.close();
    this.matterStorageService = undefined;
    this.storageManager = undefined;
    this.matterbridgeContext = undefined;
    this.log.info('Matter node storage closed');
  }

  override createMatterServer(storageManager: StorageManager): MatterServer {
    if (hasParameter('debug')) this.log.warn('createMatterServer() => mock matterServer');
    const matterServer = {
      addCommissioningServer: (commissioningServer: CommissioningServer, nodeOptions?: NodeOptions) => {
        if (hasParameter('debug')) this.log.warn('MatterServer.addCommissioningServer() => do nothing');
      },
    } as unknown as MatterServer;
    return matterServer;
  }

  override async startMatterServer() {
    if (hasParameter('debug')) this.log.warn('createMatterServer() => do nothing');
  }

  override async stopMatterServer() {
    this.log.info(`Stopping matter server nodes in ${this.bridgeMode} mode...`);
    if (this.bridgeMode === 'bridge') {
      const serverNode = this.csToMatterNode.get('Matterbridge')?.serverNode;
      if (serverNode) {
        await this.stopServerNode(serverNode);
        this.log.info(`Stopped matter server node Matterbridge`);
      }
    }
    if (this.bridgeMode === 'childbridge') {
      this.plugins.forEach(async (plugin) => {
        const serverNode = this.csToMatterNode.get(plugin.name)?.serverNode;
        if (serverNode) {
          await this.stopServerNode(serverNode);
          this.log.info(`Stopped matter server node ${plugin.name}`);
        }
      });
    }
    this.log.info('Stopped matter server nodes');
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
  async createServerNodeContext(pluginName: string, deviceName: string, deviceType: DeviceTypeId, vendorId: number, vendorName: string, productId: number, productName: string, serialNumber?: string): Promise<StorageContext> {
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
    await storageContext.set('softwareVersion', this.matterbridgeVersion !== '' && this.matterbridgeVersion.includes('.') ? parseInt(this.matterbridgeVersion.split('.')[0], 10) : 1);
    await storageContext.set('softwareVersionString', this.matterbridgeVersion !== '' ? this.matterbridgeVersion : '1.0.0');
    await storageContext.set('hardwareVersion', this.systemInformation.osRelease !== '' && this.systemInformation.osRelease.includes('.') ? parseInt(this.systemInformation.osRelease.split('.')[0], 10) : 1);
    await storageContext.set('hardwareVersionString', this.systemInformation.osRelease !== '' ? this.systemInformation.osRelease : '1.0.0');

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

  async createServerNode(storageContext: StorageContext, port = 5540, passcode = 20242025, discriminator = 3850) {
    this.log.info(`Creating server node for ${await storageContext.get<string>('storeId')}...`);
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
      id: await storageContext.get<string>('storeId'),

      // Provide Network relevant configuration like the port
      // Optional when operating only one device on a host, Default port is 5540
      network: {
        listeningAddressIpv4: this.ipv4address,
        listeningAddressIpv6: this.ipv6address,
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
    serverNode.lifecycle.commissioned.on(() => this.log.notice('Server was initially commissioned successfully!'));

    /** This event is triggered when all fabrics are removed from the device, usually it also does a factory reset then. */
    serverNode.lifecycle.decommissioned.on(() => this.log.notice('Server was fully decommissioned successfully!'));

    /** This event is triggered when the device went online. This means that it is discoverable in the network. */
    serverNode.lifecycle.online.on(() => this.log.notice('Server is online'));

    /** This event is triggered when the device went offline. it is not longer discoverable or connectable in the network. */
    serverNode.lifecycle.offline.on(() => this.log.notice('Server is offline'));

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
      this.log.notice(`Commissioned fabric index ${fabricIndex} ${action}`, serverNode.state.commissioning.fabrics[fabricIndex]);
    });

    /**
     * This event is triggered when an operative new session was opened by a Controller.
     * It is not triggered for the initial commissioning process, just afterwards for real connections.
     */
    serverNode.events.sessions.opened.on((session) => this.log.notice('Session opened', session));

    /**
     * This event is triggered when an operative session is closed by a Controller or because the Device goes offline.
     */
    serverNode.events.sessions.closed.on((session) => this.log.notice('Session closed', session));

    /** This event is triggered when a subscription gets added or removed on an operative session. */
    serverNode.events.sessions.subscriptionsChanged.on((session) => {
      this.log.notice('Session subscriptions changed', session);
      this.log.notice('Status of all sessions', serverNode.state.sessions.sessions);
    });

    this.log.info(`Created server node for ${await storageContext.get<string>('storeId')}`);
    return serverNode;
  }

  async showServerNodeQR(matterServerNode: ServerNode, storageContext: StorageContext) {
    if (!matterServerNode || !storageContext) return;
    const node = await storageContext.get<string>('storeId');
    if (!matterServerNode.lifecycle.isCommissioned) {
      this.log.notice(`${node} is not commissioned. Pair to commission ...`);
      const { qrPairingCode, manualPairingCode } = matterServerNode.state.commissioning.pairingCodes;
      // console.log(QrCode.get(qrPairingCode));
      this.log.notice(`QR Code URL: https://project-chip.github.io/connectedhomeip/qrcode.html?data=${qrPairingCode}`);
      this.log.notice(`Manual pairing code: ${manualPairingCode}`);
    } else {
      this.log.notice(`${node} is already commissioned. Waiting for controllers to connect ...`);
      this.log.notice('Fabrics:', matterServerNode.state.commissioning.fabrics);
      for (const key in matterServerNode.state.commissioning.fabrics) {
        const fabric = matterServerNode.state.commissioning.fabrics[FabricIndex(Number(key))];
        this.log.notice(`- index ${fabric.fabricIndex} id ${fabric.fabricId} nodeId ${fabric.nodeId} rootVendor ${fabric.rootVendorId} rootNodeId ${fabric.rootNodeId}`);
      }
    }
  }

  async startServerNode(matterServerNode: ServerNode) {
    if (!matterServerNode) return;
    this.log.notice(`Starting ${matterServerNode.id} server node`);
    await matterServerNode.start();
  }

  async stopServerNode(matterServerNode: ServerNode) {
    if (!matterServerNode) return;
    this.log.notice(`Stopping ${matterServerNode.id} server node`);
    await matterServerNode.close();
  }

  async createAggregatorNode(storageContext: StorageContext) {
    this.log.notice(`Creating ${await storageContext.get<string>('storeId')} aggregator `);
    const aggregator = new EndpointNode(AggregatorEndpoint, { id: `${await storageContext.get<string>('storeId')} aggregator` });
    return aggregator;
  }

  override async createCommissioningServerContext(pluginName: string, deviceName: string, deviceType: DeviceTypeId, vendorId: number, vendorName: string, productId: number, productName: string): Promise<StorageContext> {
    if (hasParameter('debug')) this.log.warn(`createCommissioningServerContext: ${pluginName} => createServerNodeContext`);
    const storageContext = this.createServerNodeContext(pluginName, deviceName, deviceType, vendorId, vendorName, productId, productName);
    return storageContext;
  }

  override async importCommissioningServerContext(pluginName: string, device: MatterbridgeDevice): Promise<StorageContext> {
    if (hasParameter('debug')) this.log.warn(`importCommissioningServerContext: ${pluginName} => createServerNodeContext`);
    const basic = device.getClusterServer(BasicInformationCluster);
    if (!basic) throw new Error('BasicInformationCluster not found');
    const storageContext = this.createServerNodeContext(
      pluginName,
      basic.getNodeLabelAttribute(),
      DeviceTypeId(device.deviceType),
      basic.getVendorIdAttribute(),
      basic.getVendorNameAttribute(),
      basic.getProductIdAttribute(),
      basic.getProductNameAttribute(),
      basic.attributes.serialNumber?.getLocal(),
    );
    return storageContext;
  }

  override async createCommisioningServer(context: StorageContext, pluginName: string): Promise<CommissioningServer> {
    if (hasParameter('debug')) this.log.warn(`createCommisioningServer: ${pluginName} => createServerNode`);
    const port = this.port;
    const serverNode = await this.createServerNode(context, this.port++, this.passcode ? this.passcode++ : 20242025, this.discriminator ? this.discriminator++ : 3840);
    const commissioningServer = {
      getPort: () => port,
      addDevice: async (device: Device | Aggregator) => {
        if (hasParameter('debug')) this.log.warn('CommissioningServer.addDevice()', device.name);
        if (device instanceof Device) {
          if (hasParameter('debug')) this.log.warn('CommissioningServer.addDevice() => Device');
        } else if (device.name === 'MA-aggregator') {
          if (hasParameter('debug')) this.log.warn('CommissioningServer.addDevice() => Aggregator');
          const serverNode = this.csToMatterNode.get(pluginName)?.serverNode;
          const aggregatorNode = this.agToMatterNode.get(pluginName)?.aggregatorNode;
          if (!serverNode || !aggregatorNode) return;
          await serverNode.add(aggregatorNode);
          if (!this.add) {
            this.add = true;
            await this.testLight1();
          }
        }
      },
    } as unknown as CommissioningServer;
    this.csToMatterNode.set(pluginName, { commissioningServer, serverNode });
    return commissioningServer;
  }

  add = false;

  override async createMatterAggregator(context: StorageContext, pluginName: string): Promise<Aggregator> {
    if (hasParameter('debug')) this.log.warn(`createMatterAggregator: ${pluginName} => createAggregatorNode`);
    const aggregatorNode = await this.createAggregatorNode(context);
    const aggregator = {
      name: 'MA-aggregator',
      addBridgedDevice: (device: Device) => {
        if (hasParameter('debug')) this.log.warn('Aggregator.addBridgedDevice() => not inplemented');
      },
      removeBridgedDevice: (device: Device) => {
        if (hasParameter('debug')) this.log.warn('Aggregator.removeBridgedDevice() => not inplemented');
      },
    } as unknown as Aggregator;
    this.agToMatterNode.set(pluginName, { aggregator, aggregatorNode });
    return aggregator;
  }

  override async showCommissioningQRCode(commissioningServer: CommissioningServer | undefined, storageContext: StorageContext | undefined, nodeContext: NodeStorage | undefined, pluginName: string) {
    if (hasParameter('debug')) this.log.warn(`showCommissioningQRCode: ${pluginName} => startServerNode`);
    const serverNode = this.csToMatterNode.get(pluginName)?.serverNode;
    if (!commissioningServer || !storageContext || !serverNode) return;
    await this.startServerNode(serverNode);
  }

  override setCommissioningServerReachability(commissioningServer: CommissioningServer, reachable: boolean) {
    if (hasParameter('debug')) this.log.warn(`setCommissioningServerReachability() => do nothing`);
  }

  override setAggregatorReachability(matterAggregator: Aggregator, reachable: boolean) {
    if (hasParameter('debug')) this.log.warn(`setAggregatorReachability() => do nothing`);
  }

  override setDeviceReachability(device: MatterbridgeDevice, reachable: boolean) {
    if (hasParameter('debug')) this.log.warn(`setDeviceReachability() => do nothing`);
  }

  override async startController() {
    if (hasParameter('debug')) this.log.warn(`setDeviceReachability() => not inplemented`);
  }

  async testLight1() {
    if (!this.matterbridgeContext) return;
    const aggregatorNode = this.agToMatterNode.get('Matterbridge')?.aggregatorNode;
    this.log.notice(`Creating lightEndpoint1`);
    const lightEndpoint1 = new Endpoint(OnOffLightDevice.with(BridgedDeviceBasicInformationServer), {
      id: 'OnOffLight',
      bridgedDeviceBasicInformation: {
        vendorId: VendorId(await this.matterbridgeContext.get<number>('vendorId')),
        vendorName: await this.matterbridgeContext.get<string>('vendorName'),

        productName: 'Light',
        productLabel: 'Light',
        nodeLabel: 'Light',

        serialNumber: 'SN 0x123456789',
        uniqueId: '0x123456789',
        reachable: true,
      },
    });
    this.log.notice(`Adding lightEndpoint1 to ${await this.matterbridgeContext.get<string>('storeId')} aggregator`);
    await aggregatorNode?.add(lightEndpoint1);

    lightEndpoint1.events.identify.startIdentifying.on(() => this.log.notice('Light.identify logic, ideally blink a light every 0.5s ...'));
    setInterval(async () => {
      // console.log('lightendpoint1', lightEndpoint1);

      // console.log('lightendpoint1 behaviors', (lightEndpoint1.behaviors.supported['onOff'] as any).cluster);
      // lightEndpoint1.act(async (agent) => {
      // console.log('lightendpoint1 state', agent['onOff'].state);
      // });
      const state = lightEndpoint1.state['onOff']['onOff'];
      this.log.notice('Setting state from:', state);
      lightEndpoint1.set({ ['onOff']: { ['onOff']: !state } });
      this.log.notice('to:', !state);
    }, 10000);
  }
}

/*
// node dist/matterbridgeEdge.js MatterbridgeEdge -debug -ssl -frontend 443
if (process.argv.includes('MatterbridgeEdge')) {
  const matterbridge = await MatterbridgeEdge.loadInstance(true);

  process.on('SIGINT', async function () {
    // eslint-disable-next-line no-console
    console.log('Caught interrupt signal');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (matterbridge) await (matterbridge as any).cleanup('shutting down...', false);
    // if (matterbridge && matterbridge.matterServerNode && matterbridge.matterServerNodeContext) await matterbridge.stopServerNode(matterbridge.matterServerNode, matterbridge.matterServerNodeContext);
    const exit = setTimeout(() => {
      // eslint-disable-next-line no-console
      console.log('Exiting after caught interrupt signal');
      process.exit();
    }, 10000);
    exit.unref();
  });
}
*/

/*
async startBridgeNode(): Promise<void> {
this.log.notice(`Creating lightEndpoint1`);
const lightEndpoint1 = new Endpoint(OnOffLightDevice.with(BridgedDeviceBasicInformationServer), {
  id: 'OnOffLight',
  bridgedDeviceBasicInformation: {
    vendorId: VendorId(await storageContext.get<number>('vendorId')),
    vendorName: await storageContext.get<string>('vendorName'),

    productName: 'Light',
    productLabel: 'Light',
    nodeLabel: 'Light',

    serialNumber: 'SN 0x123456789',
    uniqueId: '0x123456789',
    reachable: true,
  },
});
this.log.notice(`Adding lightEndpoint1 to ${await storageContext.get<string>('storeId')} aggregator`);
await this.matterAggregatorNode.add(lightEndpoint1);
// logEndpoint(EndpointServer.forEndpoint(lightEndpoint1));

this.log.notice(`Creating switchEnpoint2`);
const switchEnpoint2 = new Endpoint(GenericSwitchDevice.with(BridgedDeviceBasicInformationServer, SwitchServer.with('MomentarySwitch', 'MomentarySwitchLongPress', 'MomentarySwitchMultiPress', 'MomentarySwitchRelease')), {
  id: 'GenericSwitch',
  bridgedDeviceBasicInformation: {
    vendorId: VendorId(await storageContext.get<number>('vendorId')),
    vendorName: await storageContext.get<string>('vendorName'),

    productName: 'GenericSwitch',
    productLabel: 'GenericSwitch',
    nodeLabel: 'GenericSwitch',

    serialNumber: 'SN 0x123456739',
    uniqueId: '0x123456739',
    reachable: true,
  },
  switch: {
    numberOfPositions: 2,
    currentPosition: 0,
    multiPressMax: 2,
  },
});
this.log.notice(`Adding switchEnpoint2 to ${await storageContext.get<string>('storeId')} aggregator`);
await this.matterAggregatorNode.add(switchEnpoint2);
// logEndpoint(EndpointServer.forEndpoint(switchEnpoint2));

// switchEnpoint2.events.identify.startIdentifying.on(() => this.log.notice('GenericSwitch.identify logic, ideally blink a light every 0.5s ...'));
// switchEnpoint2.events.switch.currentPosition$Changed.on(() => this.log.notice('GenericSwitch.currentPosition changed ...'));
// switchEnpoint2.act((agent) => agent.switch.events.initialPress.emit({ newPosition: 1 }, agent.context));
// switchEnpoint2.events.switch.emit('initialPress', { newPosition: 1 }, switchEnpoint2.events.switch.context);
*/

/*
log.notice(`Creating matterbridge device ClimateSensor`);
const matterbridgeDevice3 = new MatterbridgeDeviceV8(DeviceTypes.TEMPERATURE_SENSOR, { uniqueStorageKey: 'ClimateSensor' });
matterbridgeDevice3.addDeviceTypeWithClusterServer([DeviceTypes.TEMPERATURE_SENSOR], [TemperatureMeasurement.Cluster.id]);
matterbridgeDevice3.addDeviceTypeWithClusterServer([DeviceTypes.HUMIDITY_SENSOR], [RelativeHumidityMeasurement.Cluster.id]);
matterbridgeDevice3.addDeviceTypeWithClusterServer([DeviceTypes.PRESSURE_SENSOR], [PressureMeasurement.Cluster.id]);
matterbridgeDevice3.behaviors.require(IdentifyServer, {
  identifyTime: 5,
});
matterbridgeDevice3.behaviors.require(TemperatureMeasurementServer, {
  measuredValue: 25.0,
  minMeasuredValue: null,
  maxMeasuredValue: null,
});
*/

/*
log.notice(`Adding BridgedDeviceBasicInformationServer to ClimateSensor`);
matterbridgeDevice3.behaviors.require(BridgedDeviceBasicInformationServer, {
  vendorId: VendorId(await storageContext.get<number>('vendorId')),
  vendorName: await storageContext.get<string>('vendorName'),

  productName: 'ClimateSensor',
  productLabel: 'ClimateSensor',
  nodeLabel: 'ClimateSensor',

  serialNumber: '0x145433356739',
  uniqueId: '0x1254446739',
  reachable: true,
});

log.notice(`Adding DescriptorServer to ClimateSensor`);
matterbridgeDevice3.behaviors.require(DescriptorServer, {
  deviceTypeList: [
    { deviceType: 0x0302, revision: 2 },
    { deviceType: 0x0307, revision: 2 },
    { deviceType: 0x0305, revision: 2 },
  ],
});

this.log.notice(`Adding ClimateSensor to ${await storageContext.get<string>('storeId')} aggregator`);
await this.matterAggregator.add(matterbridgeDevice3);
logEndpoint(EndpointServer.forEndpoint(matterbridgeDevice3));
*/

/*
await lightEndpoint1.set({
  onOff: {
    onOff: true,
  },
});
await switchEnpoint2.set({
  switch: {
    currentPosition: 1,
  },
});
switchEnpoint2.act((agent) => agent.switch.events.initialPress.emit({ newPosition: 1 }, agent.context));
*/

/*
await matterbridgeDevice3.set({
  temperatureMeasurement: {
    measuredValue: 20 * 100,
  },
  relativeHumidityMeasurement: {
    measuredValue: 50 * 100,
  },
});
*/

// logEndpoint(EndpointServer.forEndpoint(this.matterServerNode));

/*
logEndpoint(EndpointServer.forEndpoint(this.matterServerNode));
logEndpoint(EndpointServer.forEndpoint(matterbridgeDevice3));
console.log('matterbridgeDevice3\n', matterbridgeDevice3);
console.log('matterbridgeDevice3.events\n', matterbridgeDevice3.events);
console.log('matterbridgeDevice3.events.identify\n', matterbridgeDevice3.eventsOf(IdentifyServer));
console.log('matterbridgeDevice3.state\n', matterbridgeDevice3.state);
console.log('matterbridgeDevice3.state.temperatureMeasurement\n', matterbridgeDevice3.stateOf(TemperatureMeasurementServer));
// matterbridgeDevice3.eventsOf(IdentifyServer);
// matterbridgeDevice3.events.identify.startIdentifying.on(() => log.notice('Run identify logic, ideally blink a light every 0.5s ...'));
}
*/
