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
import { rs, GREEN, debugStringify, er, zb, nf } from 'node-ansi-logger';
import { NodeStorage } from 'node-persist-manager';

// Matterbridge
import { Matterbridge } from './matterbridge.js';
import { MatterbridgeDevice } from './matterbridgeDevice.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { bridge, bridgedNode, electricalSensor, genericSwitch, onOffLight, onOffOutlet, powerSource } from './matterbridgeDeviceTypes.js';
import { dev, plg, SanitizedSessionInformation } from './matterbridgeTypes.js';
import { copyDirectory, getParameter, hasParameter, waiter } from './utils/utils.js';

// @matter
import { DeviceTypeId, LogLevel as MatterLogLevel, LogFormat as MatterLogFormat, VendorId, FabricIndex, Lifecycle, SessionsBehavior, NumberTag, EndpointServer } from '@matter/main';
import { ServerNode, Endpoint as EndpointNode, Environment, StorageService, StorageContext, StorageManager } from '@matter/main';
import { BasicInformationCluster, ColorControl, ColorControlCluster, OnOffCluster, LevelControl, Identify, Descriptor, SwitchCluster } from '@matter/main/clusters';
import { ExposedFabricInformation, FabricAction, MdnsService } from '@matter/main/protocol';
import { ColorTemperatureLightDevice, GenericSwitchDevice, OnOffLightDevice } from '@matter/main/devices';
import { AggregatorEndpoint } from '@matter/main/endpoints';
import { BridgedDeviceBasicInformationServer, ColorControlServer, IdentifyServer, LevelControlServer, OnOffServer, GroupsServer, SwitchServer, DescriptorServer } from '@matter/main/behaviors';

// @project-chip
import { CommissioningServer, MatterServer, NodeOptions } from '@project-chip/matter.js';
import { Aggregator, Device, DeviceTypes, logEndpoint } from '@project-chip/matter.js/device';
import { MatterbridgeColorControlServer, MatterbridgeIdentifyServer, MatterbridgeLevelControlServer, MatterbridgeOnOffServer } from './matterbridgeBehaviors.js';

/**
 * Represents the MatterbridgeEdge application.
 */
export class MatterbridgeEdge extends Matterbridge {
  static override instance: MatterbridgeEdge | undefined;

  // Matter environment
  public environment = Environment.default;

  // Matter storage
  public matterStorageService?: StorageService;

  // Mapping of CommissioningServer to ServerNode
  private csToServerNode = new Map<string, { commissioningServer: CommissioningServer; serverNode: ServerNode }>();

  // Mapping of Aggregator to AggregatorEndpoint
  private agToAggregatorEndpoint = new Map<string, { aggregator: Aggregator; aggregatorNode: EndpointNode<AggregatorEndpoint> }>();

  // Mapping of sessions
  private activeSessions = new Map<string, SanitizedSessionInformation>();

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

    // Setup Matter mdnsInterface
    if (this.mdnsInterface) this.environment.vars.set('mdns.networkInterface', this.mdnsInterface);

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

    this.matterbridgeContext = await this.createServerNodeContext('Matterbridge', 'Matterbridge', bridge.code, this.aggregatorVendorId, 'Matterbridge', this.aggregatorProductId, 'Matterbridge aggregator');

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
      const serverNode = this.csToServerNode.get('Matterbridge')?.serverNode;
      if (serverNode) {
        await this.stopServerNode(serverNode);
        this.log.info(`Stopped matter server node Matterbridge`);
      }
    }
    if (this.bridgeMode === 'childbridge') {
      this.plugins.forEach(async (plugin) => {
        const serverNode = this.csToServerNode.get(plugin.name)?.serverNode;
        if (serverNode) {
          await this.stopServerNode(serverNode);
          this.log.info(`Stopped matter server node ${plugin.name}`);
        }
      });
    }
    this.log.info('Stopped matter server nodes');

    await this.environment.get(MdnsService)[Symbol.asyncDispose]();
    this.log.info('Stopped MdnsService');
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
    const storeId = await storageContext.get<string>('storeId');
    this.log.info(`Creating server node for ${storeId}...`);
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

    const sanitizeFabrics = (fabrics: Record<FabricIndex, ExposedFabricInformation>) => {
      // New type of fabric information: Record<FabricIndex, ExposedFabricInformation>
      const sanitizedFabrics = this.sanitizeFabricInformations(Array.from(Object.values(serverNode.state.commissioning.fabrics)));
      this.log.info(`Fabrics: ${debugStringify(sanitizedFabrics)}`);
      if (this.bridgeMode === 'bridge') {
        this.matterbridgeFabricInformations = sanitizedFabrics;
        this.matterbridgeSessionInformations = [];
        this.matterbridgePaired = true;
      }
    };

    /**
     * This event is triggered when the device is initially commissioned successfully.
     * This means: It is added to the first fabric.
     */
    serverNode.lifecycle.commissioned.on(() => this.log.notice(`Server node for ${storeId} was initially commissioned successfully!`));

    /** This event is triggered when all fabrics are removed from the device, usually it also does a factory reset then. */
    serverNode.lifecycle.decommissioned.on(() => this.log.notice(`Server node for ${storeId} was fully decommissioned successfully!`));

    /** This event is triggered when the device went online. This means that it is discoverable in the network. */
    serverNode.lifecycle.online.on(() => {
      this.log.notice(`Server node for ${storeId} is online`);
      if (!serverNode.lifecycle.isCommissioned) {
        this.log.notice(`Server node for ${storeId} is not commissioned. Pair to commission ...`);
        const { qrPairingCode, manualPairingCode } = serverNode.state.commissioning.pairingCodes;
        if (this.bridgeMode === 'bridge') {
          this.matterbridgeQrPairingCode = qrPairingCode;
          this.matterbridgeManualPairingCode = manualPairingCode;
          this.matterbridgeFabricInformations = [];
          this.matterbridgeSessionInformations = [];
          this.matterbridgePaired = false;
          this.matterbridgeConnected = false;
          this.log.notice(`QR Code URL: https://project-chip.github.io/connectedhomeip/qrcode.html?data=${qrPairingCode}`);
          this.log.notice(`Manual pairing code: ${manualPairingCode}`);
        }
      } else {
        this.log.notice(`Server node for ${storeId} is already commissioned. Waiting for controllers to connect ...`);
        sanitizeFabrics(serverNode.state.commissioning.fabrics);
      }
    });

    /** This event is triggered when the device went offline. it is not longer discoverable or connectable in the network. */
    serverNode.lifecycle.offline.on(() => {
      this.log.notice(`Server node for ${storeId} is offline`);
      if (this.bridgeMode === 'bridge') {
        this.matterbridgeQrPairingCode = undefined;
        this.matterbridgeManualPairingCode = undefined;
        this.matterbridgeFabricInformations = [];
        this.matterbridgeSessionInformations = [];
        this.matterbridgePaired = false;
        this.matterbridgeConnected = false;
      }
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
    };

    /**
     * This event is triggered when an operative new session was opened by a Controller.
     * It is not triggered for the initial commissioning process, just afterwards for real connections.
     */
    serverNode.events.sessions.opened.on((session) => {
      this.log.notice(`Session opened on server node for ${storeId}: ${debugStringify(session)}`);
      sanitizeSessions(Object.values(serverNode.state.sessions.sessions));
    });

    /**
     * This event is triggered when an operative session is closed by a Controller or because the Device goes offline.
     */
    serverNode.events.sessions.closed.on((session) => {
      this.log.notice(`Session closed on server node for ${storeId}: ${debugStringify(session)}`);
      sanitizeSessions(Object.values(serverNode.state.sessions.sessions));
    });

    /** This event is triggered when a subscription gets added or removed on an operative session. */
    serverNode.events.sessions.subscriptionsChanged.on((session) => {
      this.log.notice(`Session subscriptions changed on server node for ${storeId}: ${debugStringify(session)}`);
      sanitizeSessions(Object.values(serverNode.state.sessions.sessions));
    });

    this.log.info(`Created server node for ${storeId}`);
    return serverNode;
  }

  async startServerNode(matterServerNode: ServerNode) {
    if (!matterServerNode) return;
    this.log.notice(`Starting ${matterServerNode.id} server node`);
    await matterServerNode.start();
  }

  async stopServerNode(matterServerNode: ServerNode) {
    if (!matterServerNode) return;
    this.log.notice(`Closing ${matterServerNode.id} server node`);
    await matterServerNode.close();
  }

  async createAggregatorNode(storageContext: StorageContext) {
    this.log.notice(`Creating ${await storageContext.get<string>('storeId')} aggregator `);
    const aggregator = new EndpointNode(AggregatorEndpoint, { id: `${await storageContext.get<string>('storeId')}` });
    return aggregator;
  }

  override async addBridgedEndpoint(pluginName: string, device: MatterbridgeEndpoint): Promise<void> {
    // Check if the plugin is registered
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      this.log.error(`Error adding bridged device ${dev}${device.deviceName}${er} (${zb}${device.id}${er}) plugin ${plg}${pluginName}${er} not found`);
      return;
    }

    // Register and add the device to the matterbridge aggregator node
    if (this.bridgeMode === 'bridge') {
      this.log.info(`Adding ${pluginName}:${device.deviceName} to Matterbridge aggregator node`);
      const aggregatorNode = this.agToAggregatorEndpoint.get('Matterbridge')?.aggregatorNode;
      await aggregatorNode?.add(device);
    } else if (this.bridgeMode === 'childbridge') {
      if (plugin.type === 'DynamicPlatform') {
        this.log.info(`Adding ${pluginName}:${device.deviceName} to ${pluginName} aggregator node`);
        const aggregatorNode = this.agToAggregatorEndpoint.get(pluginName)?.aggregatorNode;
        await aggregatorNode?.add(device);
      }
    }
    // TODO: Implement plugins and devices
    if (plugin.registeredDevices !== undefined) plugin.registeredDevices++;
    if (plugin.addedDevices !== undefined) plugin.addedDevices++;
    // Add the device to the DeviceManager
    this.devices.set(device as unknown as MatterbridgeDevice);
    this.log.info(`Added and registered bridged device (${plugin.registeredDevices}/${plugin.addedDevices}) ${dev}${device.deviceName}${nf} (${dev}${device.id}${nf}) for plugin ${plg}${pluginName}${nf}`);
  }

  override async removeBridgedEndpoint(pluginName: string, device: MatterbridgeEndpoint): Promise<void> {
    // TODO: Implement removeBridgedEndpoint
  }

  override async removeAllBridgedEndpoints(pluginName: string): Promise<void> {
    // TODO: Implement removeAllBridgedEndpoints
  }

  override async createCommissioningServerContext(pluginName: string, deviceName: string, deviceType: DeviceTypeId, vendorId: number, vendorName: string, productId: number, productName: string): Promise<StorageContext> {
    if (hasParameter('debug')) this.log.warn(`createCommissioningServerContext() for ${pluginName} => createServerNodeContext()`);
    const storageContext = this.createServerNodeContext(pluginName, deviceName, deviceType, vendorId, vendorName, productId, productName);
    return storageContext;
  }

  override async importCommissioningServerContext(pluginName: string, device: MatterbridgeDevice): Promise<StorageContext> {
    if (hasParameter('debug')) this.log.warn(`importCommissioningServerContext() for ${pluginName} => createServerNodeContext()`);
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

  test = false;

  override async createCommisioningServer(context: StorageContext, pluginName: string): Promise<CommissioningServer> {
    if (hasParameter('debug')) this.log.warn(`createCommisioningServer() for ${pluginName} => createServerNode()`);
    const port = this.port;
    const serverNode = await this.createServerNode(context, this.port++, this.passcode ? this.passcode++ : 20242025, this.discriminator ? this.discriminator++ : 3840);
    const commissioningServer = {
      getPort: () => port,
      addDevice: async (device: Device | Aggregator) => {
        // if (hasParameter('debug')) this.log.warn('CommissioningServer.addDevice()', device.name);
        if (device instanceof Device) {
          if (hasParameter('debug')) this.log.warn('CommissioningServer.addDevice() => Device');
        } else if (device.name === 'MA-aggregator') {
          if (hasParameter('debug')) this.log.warn('CommissioningServer.addDevice() => Aggregator');
          const serverNode = this.csToServerNode.get(pluginName)?.serverNode;
          const aggregatorNode = this.agToAggregatorEndpoint.get(pluginName)?.aggregatorNode;
          if (!serverNode || !aggregatorNode) return;
          await serverNode.add(aggregatorNode);
          if (!this.test) {
            this.test = true;
            // await this.testEndpoints();
          }
        }
      },
    } as unknown as CommissioningServer;
    this.csToServerNode.set(pluginName, { commissioningServer, serverNode });
    return commissioningServer;
  }

  override async createMatterAggregator(context: StorageContext, pluginName: string): Promise<Aggregator> {
    if (hasParameter('debug')) this.log.warn(`createMatterAggregator() for ${pluginName} => createAggregatorNode()`);
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
    this.agToAggregatorEndpoint.set(pluginName, { aggregator, aggregatorNode });
    return aggregator;
  }

  override async showCommissioningQRCode(commissioningServer: CommissioningServer | undefined, storageContext: StorageContext | undefined, nodeContext: NodeStorage | undefined, pluginName: string) {
    if (hasParameter('debug')) this.log.warn(`showCommissioningQRCode() for ${pluginName} => startServerNode()`);
    const serverNode = this.csToServerNode.get(pluginName)?.serverNode;
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
    if (hasParameter('debug')) this.log.warn(`startController() => do nothing`);
  }

  async testEndpoints() {
    const max = 10;
    if (!this.matterbridgeContext) return;
    const aggregatorNode = this.agToAggregatorEndpoint.get('Matterbridge')?.aggregatorNode;
    if (!aggregatorNode) return;

    /*
    this.log.notice(`Creating OnOffLight1`);
    const lightEndpoint = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight1' }, true);
    lightEndpoint.addDeviceType(bridgedNode);
    lightEndpoint.createDefaultBridgedDeviceBasicInformationClusterServer('OnOffLight 1', '123456789', 0xfff1, 'Matterbridge', 'Light');
    lightEndpoint.addDeviceType(powerSource);
    lightEndpoint.createDefaultPowerSourceWiredClusterServer();
    lightEndpoint.addDeviceType(electricalSensor);
    lightEndpoint.addClusterServer(lightEndpoint.getDefaultElectricalEnergyMeasurementClusterServer());
    lightEndpoint.addClusterServer(lightEndpoint.getDefaultElectricalPowerMeasurementClusterServer());
    lightEndpoint.addRequiredClusterServers(lightEndpoint);
    this.log.notice(`Adding OnOffLight1 to ${await this.matterbridgeContext.get<string>('storeId')} aggregator`);
    await aggregatorNode.add(lightEndpoint);
    logEndpoint(EndpointServer.forEndpoint(lightEndpoint));

    this.log.notice(`Creating Outlet1`);
    const outletEndpoint = new MatterbridgeEndpoint(onOffOutlet, { uniqueStorageKey: 'OnOffOutlet1' }, true);
    outletEndpoint.addDeviceType(bridgedNode);
    outletEndpoint.createDefaultBridgedDeviceBasicInformationClusterServer('OnOffOutlet 1', '123456789', 0xfff1, 'Matterbridge', 'Outlet');
    outletEndpoint.addDeviceType(powerSource);
    outletEndpoint.createDefaultPowerSourceReplaceableBatteryClusterServer();
    outletEndpoint.addDeviceType(electricalSensor);
    outletEndpoint.addClusterServer(outletEndpoint.getDefaultElectricalEnergyMeasurementClusterServer());
    outletEndpoint.addClusterServer(outletEndpoint.getDefaultElectricalPowerMeasurementClusterServer());
    outletEndpoint.addRequiredClusterServers(outletEndpoint);
    const input0 = outletEndpoint.addChildDeviceTypeWithClusterServer('Input:0', [genericSwitch], undefined, undefined, true);
    const input1 = outletEndpoint.addChildDeviceTypeWithClusterServer('Input:1', [genericSwitch], undefined, undefined, true);
    this.log.notice(`Adding OnOffOutlet1 to ${await this.matterbridgeContext.get<string>('storeId')} aggregator`);
    await aggregatorNode.add(outletEndpoint);
    logEndpoint(EndpointServer.forEndpoint(outletEndpoint));
    */

    this.log.notice(`Creating switchEnpoint1`);
    const switchEnpoint1 = new EndpointNode(GenericSwitchDevice.with(BridgedDeviceBasicInformationServer, SwitchServer.with('MomentarySwitch', 'MomentarySwitchLongPress', 'MomentarySwitchMultiPress', 'MomentarySwitchRelease')), {
      id: 'GenericSwitch',
      bridgedDeviceBasicInformation: {
        vendorId: VendorId(await this.matterbridgeContext.get<number>('vendorId')),
        vendorName: await this.matterbridgeContext.get<string>('vendorName'),

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
    this.log.notice(`Adding switchEnpoint1 to ${await this.matterbridgeContext.get<string>('storeId')} aggregator`);
    await aggregatorNode.add(switchEnpoint1);
    logEndpoint(EndpointServer.forEndpoint(switchEnpoint1), { logNotSupportedClusterAttributes: true, logNotSupportedClusterEvents: true, logNotSupportedClusterCommands: true });
    // if (switchEnpoint2.behaviors.has(SwitchServer)) this.log.notice(`SwitchServer found`);
    // switchEnpoint2.act((agent) => agent['switch'].events['initialPress'].emit({ newPosition: 1 }, agent.context));

    /*
    const device = new MatterbridgeEndpoint(genericSwitch, { uniqueStorageKey: 'GenericSwitch 2' }, true);
    device.createDefaultSwitchClusterServer();
    device.addRequiredClusterServers(device);
    await aggregatorNode.add(device);
    logEndpoint(EndpointServer.forEndpoint(device));
    await device.triggerSwitchEvent('Single', this.log);
    await device.triggerSwitchEvent('Double', this.log);
    await device.triggerSwitchEvent('Long', this.log);

    const device1 = new MatterbridgeEndpoint(genericSwitch, { uniqueStorageKey: 'GenericSwitch 3' }, true);
    device1.createDefaultLatchingSwitchClusterServer();
    device1.addRequiredClusterServers(device1);
    await aggregatorNode.add(device1);
    logEndpoint(EndpointServer.forEndpoint(device1));
    await device1.triggerSwitchEvent('Press', this.log);
    await device1.triggerSwitchEvent('Release', this.log);

    this.log.notice(`Creating TestLight`);
    const matterbridgeDevice = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'Test .Light:2' }, true);
    matterbridgeDevice.behaviors.require(MatterbridgeIdentifyServer, {
      identifyTime: 0,
      identifyType: Identify.IdentifyType.None,
    });
    matterbridgeDevice.behaviors.require(GroupsServer);
    matterbridgeDevice.behaviors.require(MatterbridgeOnOffServer, {
      onOff: false,
    });
    matterbridgeDevice.behaviors.require(MatterbridgeLevelControlServer, {
      currentLevel: 0,
      options: { executeIfOff: false },
    });
    matterbridgeDevice.behaviors.require(MatterbridgeColorControlServer.with(ColorControl.Feature.HueSaturation, ColorControl.Feature.Xy, ColorControl.Feature.ColorTemperature), {
      colorCapabilities: { xy: true, hueSaturation: true, colorLoop: false, enhancedHue: false, colorTemperature: true },
      colorMode: ColorControl.ColorMode.ColorTemperatureMireds,
      enhancedColorMode: ColorControl.EnhancedColorMode.ColorTemperatureMireds,
      options: { executeIfOff: false },
      numberOfPrimaries: null,
      currentX: 24939,
      currentY: 24701,
      currentHue: 0,
      currentSaturation: 0,
      colorTemperatureMireds: 450,
      colorTempPhysicalMinMireds: 150,
      colorTempPhysicalMaxMireds: 450,
      coupleColorTempToLevelMinMireds: 150,
      startUpColorTemperatureMireds: null,
    });
    matterbridgeDevice.behaviors.require(BridgedDeviceBasicInformationServer, {
      vendorId: VendorId(await this.matterbridgeContext.get<number>('vendorId')),
      vendorName: await this.matterbridgeContext.get<string>('vendorName'),
      productName: 'TestLight2',
      productLabel: 'TestLight2',
      nodeLabel: 'TestLight2',
      serialNumber: 'SN 0x123456789',
      uniqueId: '0x123456789',
      reachable: true,
    });

    // await matterbridgeDevice.setTagList(null, 0x07, 1, 'endpoint 2');
    // await matterbridgeDevice.configureColorControlCluster(false, false, true, ColorControl.ColorMode.ColorTemperatureMireds);

    this.log.notice(`Adding TestLight`);
    await aggregatorNode?.add(matterbridgeDevice);

    this.log.notice(`Creating switchEnpoint1`);
    const switchEnpoint2 = new EndpointNode(
      GenericSwitchDevice.with(DescriptorServer.with(Descriptor.Feature.TagList), BridgedDeviceBasicInformationServer, SwitchServer.with('MomentarySwitch', 'MomentarySwitchLongPress', 'MomentarySwitchMultiPress', 'MomentarySwitchRelease')),
      {
        id: 'GenericSwitch1',
        descriptor: {
          tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Switch1' }],
        },
        bridgedDeviceBasicInformation: {
          vendorId: VendorId(await this.matterbridgeContext.get<number>('vendorId')),
          vendorName: await this.matterbridgeContext.get<string>('vendorName'),

          productName: 'GenericSwitch',
          productLabel: 'GenericSwitch',
          nodeLabel: 'GenericSwitch',

          serialNumber: 'SN 0x1234567397',
          uniqueId: '0x1234567397',
          reachable: true,
        },
        switch: {
          numberOfPositions: 2,
          currentPosition: 0,
          multiPressMax: 2,
        },
      },
    );
    this.log.notice(`Creating switchEnpoint2`);
    await aggregatorNode?.add(switchEnpoint2);
    */

    /*
    const lightEndpoint1 = new EndpointNode(ColorTemperatureLightDevice.with(BridgedDeviceBasicInformationServer), {
      // }, MatterbridgeIdentifyServer, MatterbridgeOnOffServer, MatterbridgeLevelControlServer, MatterbridgeColorControlServer), {
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
      levelControl: {
        currentLevel: 0,
        options: { executeIfOff: false, coupleColorTempToLevel: false },
      },
      colorControl: {
        colorTemperatureMireds: 450,
        colorMode: ColorControl.ColorMode.ColorTemperatureMireds,
        colorTempPhysicalMinMireds: 150,
        colorTempPhysicalMaxMireds: 450,
        coupleColorTempToLevelMinMireds: 150,
        startUpColorTemperatureMireds: 450,
      },
    });
    lightEndpoint1.behaviors.require(ColorControlServer.with('ColorTemperature'), {
      colorTemperatureMireds: 450,
      colorMode: ColorControl.ColorMode.ColorTemperatureMireds,
      colorTempPhysicalMinMireds: 150,
      colorTempPhysicalMaxMireds: 450,
      coupleColorTempToLevelMinMireds: 150,
      startUpColorTemperatureMireds: 450,
    });
    await aggregatorNode?.add(lightEndpoint1);

    /*
    lightEndpoint1.behaviors.require(MatterbridgeIdentifyServer);
    lightEndpoint1.behaviors.require(MatterbridgeOnOffServer);
    lightEndpoint1.behaviors.require(MatterbridgeLevelControlServer);
    lightEndpoint1.behaviors.require(MatterbridgeColorControlServer, {
      colorTemperatureMireds: 250,
      colorMode: ColorControl.ColorMode.ColorTemperatureMireds,
      colorTempPhysicalMinMireds: 150,
      colorTempPhysicalMaxMireds: 450,
      coupleColorTempToLevelMinMireds: 150,
      startUpColorTemperatureMireds: 450,
    });
    await aggregatorNode?.add(lightEndpoint1);

    this.log.notice(`Creating switchEnpoint2`);
    const switchEnpoint2 = new EndpointNode(GenericSwitchDevice.with(BridgedDeviceBasicInformationServer, SwitchServer.with('MomentarySwitch', 'MomentarySwitchLongPress', 'MomentarySwitchMultiPress', 'MomentarySwitchRelease')), {
      id: 'GenericSwitch',
      bridgedDeviceBasicInformation: {
        vendorId: VendorId(await this.matterbridgeContext.get<number>('vendorId')),
        vendorName: await this.matterbridgeContext.get<string>('vendorName'),

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
    await aggregatorNode?.add(switchEnpoint2);
    */
    /*
    for (let i = 1; i <= max; i++) {
      this.log.notice(`Creating lightEndpoint${i}`);
      const lightEndpoint = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight' + i });
      lightEndpoint.addClusterServer(lightEndpoint.getDefaultBridgedDeviceBasicInformationClusterServer('OnOffLight' + i, '123456789', 0xfff1, 'Matterbridge', 'Light'));
      this.log.notice(`Adding lightEndpoint${i} to ${await this.matterbridgeContext.get<string>('storeId')} aggregator`);
      await aggregatorNode?.add(lightEndpoint);
      setInterval(async () => {
        const state = lightEndpoint.getAttribute(OnOffCluster.id, 'onOff');
        lightEndpoint.setAttribute(OnOffCluster.id, 'onOff', !state);
        this.log.notice(`Setting state for lightEndpoint${i} from:`, state, 'to:', !state);
      }, 10000);
    }
    for (let i = 1; i <= max; i++) {
      this.log.notice(`Creating outletEndpoint${i}`);
      const lightEndpoint = new MatterbridgeEndpoint(onOffOutlet, { uniqueStorageKey: 'OnOffOutlet' + i });
      lightEndpoint.addClusterServer(lightEndpoint.getDefaultBridgedDeviceBasicInformationClusterServer('OnOffOutlet' + i, '123456789', 0xfff1, 'Matterbridge', 'Outlet'));
      this.log.notice(`Adding outletEndpoint${i} to ${await this.matterbridgeContext.get<string>('storeId')} aggregator`);
      await aggregatorNode?.add(lightEndpoint);
      setInterval(async () => {
        const state = lightEndpoint.getAttribute(OnOffCluster.id, 'onOff');
        lightEndpoint.setAttribute(OnOffCluster.id, 'onOff', !state);
        this.log.notice(`Setting state for outletEndpoint${i} from:`, state, 'to:', !state);
      }, 10000);
    }
    */
  }
}

/*
    /*
    matterbridgeDevice.behaviors.require(MatterbridgeColorControlServer.with(ColorControl.Feature.HueSaturation, ColorControl.Feature.Xy, ColorControl.Feature.ColorTemperature), {
      colorCapabilities: { xy: true, hueSaturation: true, colorLoop: false, enhancedHue: false, colorTemperature: true },
      colorMode: ColorControl.ColorMode.ColorTemperatureMireds,
      enhancedColorMode: ColorControl.EnhancedColorMode.ColorTemperatureMireds,
      options: { executeIfOff: false },
      numberOfPrimaries: null,
      currentX: 24939,
      currentY: 24701,
      currentHue: 0,
      currentSaturation: 0,
      colorTemperatureMireds: 450,
      colorTempPhysicalMinMireds: 150,
      colorTempPhysicalMaxMireds: 450,
      coupleColorTempToLevelMinMireds: 150,
      startUpColorTemperatureMireds: null,
    });
    matterbridgeDevice.behaviors.require(MatterbridgeColorControlServer.with(ColorControl.Feature.ColorTemperature), {
      colorCapabilities: { xy: false, hueSaturation: false, colorLoop: false, enhancedHue: false, colorTemperature: true },
      colorMode: ColorControl.ColorMode.ColorTemperatureMireds,
      enhancedColorMode: ColorControl.EnhancedColorMode.ColorTemperatureMireds,
      options: { executeIfOff: false },
      numberOfPrimaries: null,
      colorTemperatureMireds: 450,
      colorTempPhysicalMinMireds: 150,
      colorTempPhysicalMaxMireds: 450,
      coupleColorTempToLevelMinMireds: 150,
      startUpColorTemperatureMireds: null,
    });
    */
/*
    matterbridgeDevice.behaviors.require(MatterbridgeColorControlServer.with(ColorControl.Feature.HueSaturation, ColorControl.Feature.Xy), {
      colorCapabilities: { xy: true, hueSaturation: true, colorLoop: false, enhancedHue: false, colorTemperature: false },
      colorMode: ColorControl.ColorMode.CurrentHueAndCurrentSaturation,
      enhancedColorMode: ColorControl.EnhancedColorMode.CurrentHueAndCurrentSaturation,
      options: { executeIfOff: false },
      numberOfPrimaries: null,
      currentX: 24939,
      currentY: 24701,
      currentHue: 0,
      currentSaturation: 0,
    });
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
