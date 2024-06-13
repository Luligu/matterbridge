/* eslint-disable @typescript-eslint/no-unused-vars */
// New API imports
import { Endpoint, EndpointServer } from '@project-chip/matter.js/endpoint';
import { OnOffLightDevice } from '@project-chip/matter.js/devices/OnOffLightDevice';
import { AggregatorEndpoint } from '@project-chip/matter.js/endpoints/AggregatorEndpoint';
import { BridgedNodeEndpoint } from '@project-chip/matter.js/endpoints/BridgedNodeEndpoint';
import { MutableEndpoint } from '@project-chip/matter.js/endpoint/type';
import { Behavior } from '@project-chip/matter.js/behavior';
import { SupportedBehaviors } from '@project-chip/matter.js/endpoint/properties';
import { IdentifyServer, IdentifyBehavior } from '@project-chip/matter.js/behavior/definitions/identify';
import { GroupsServer, GroupsBehavior } from '@project-chip/matter.js/behavior/definitions/groups';
import { ScenesServer, ScenesBehavior } from '@project-chip/matter.js/behavior/definitions/scenes';
import { OnOffServer, OnOffBehavior } from '@project-chip/matter.js/behavior/definitions/on-off';
import { TemperatureMeasurementServer } from '@project-chip/matter.js/behavior/definitions/temperature-measurement';
import { BridgedDeviceBasicInformationServer, BridgedDeviceBasicInformationBehavior } from '@project-chip/matter.js/behavior/definitions/bridged-device-basic-information';

// Old API imports
import { DeviceTypeDefinition, DeviceTypes, EndpointOptions } from '@project-chip/matter-node.js/device';
import { BridgedDeviceBasicInformation, Groups, Identify, OnOff, Scenes, TemperatureMeasurement, getClusterNameById } from '@project-chip/matter-node.js/cluster';
import { AtLeastOne } from '@project-chip/matter-node.js/util';
import { ClusterId } from '@project-chip/matter-node.js/datatype';

// Matterbridge imports
import { AnsiLogger, TimestampFormat, db, hk, zb } from 'node-ansi-logger';

export class MatterbridgeDeviceV8 extends Endpoint {
  public static bridgeMode = '';
  log: AnsiLogger;
  serialNumber: string | undefined = undefined;
  deviceName: string | undefined = undefined;
  uniqueId: string | undefined = undefined;

  // TODO: Map to new API
  deviceTypes: DeviceTypeDefinition[] = [];

  /**
   * Represents a Matterbridge device.
   * @constructor
   * @param {DeviceTypeDefinition} definition - The definition of the device.
   * @param {EndpointOptions} [options={}] - The options for the device.
   */
  constructor(definition: DeviceTypeDefinition, options: EndpointOptions = {}) {
    // Map ClusterId to Behavior.Type
    const behaviorTypes: Behavior.Type[] = [];
    definition.requiredServerClusters.forEach((clusterId) => {
      if (clusterId === Identify.Cluster.id) behaviorTypes.push(IdentifyServer);
      if (clusterId === Groups.Cluster.id) behaviorTypes.push(GroupsServer);
      if (clusterId === Scenes.Cluster.id) behaviorTypes.push(ScenesServer);
      if (clusterId === OnOff.Cluster.id) behaviorTypes.push(OnOffServer);
      if (clusterId === BridgedDeviceBasicInformation.Cluster.id) behaviorTypes.push(BridgedDeviceBasicInformationServer);
      if (clusterId === TemperatureMeasurement.Cluster.id) behaviorTypes.push(TemperatureMeasurementServer);
    });

    // Convert the DeviceTypeDefinition to a MutableEndpoint definition with the required behaviors
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
      behaviors: SupportedBehaviors(...behaviorTypes),
    });
    const optionsV8 = {
      id: options.uniqueStorageKey,
      bridgedDeviceBasicInformation: {
        vendorId: 0xfff1,
        vendorName: 'Metterbridge',

        productName: 'Light',
        productLabel: 'Light',
        nodeLabel: 'Light',

        serialNumber: '0x1234567869',
        uniqueId: '0x1234567869',
        reachable: true,
      },
    };
    super(definitionV8, optionsV8);
    this.log = new AnsiLogger({ logName: 'MatterbridgeDevice', logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: true });
    this.deviceTypes.push(definition);
  }

  /**
   * Loads an instance of the MatterbridgeDevice class.
   *
   * @param {DeviceTypeDefinition} definition - The DeviceTypeDefinition of the device.
   * @returns MatterbridgeDevice instance.
   */
  static async loadInstance(definition: DeviceTypeDefinition, options: EndpointOptions = {}) {
    return new MatterbridgeDeviceV8(definition, options);
  }

  /**
   * Adds a device type to the list of device types.
   * If the device type is not already present in the list, it will be added.
   *
   * @param {DeviceTypeDefinition} deviceType - The device type to add.
   */
  addDeviceType(deviceType: DeviceTypeDefinition) {
    if (!this.deviceTypes.includes(deviceType)) {
      this.log.debug(`addDeviceType: ${zb}${deviceType.code}${db}-${zb}${deviceType.name}${db}`);
      this.deviceTypes.push(deviceType);
    }
  }

  /**
   * Adds one or more device types with the required cluster servers and the specified cluster servers.
   *
   * @param {AtLeastOne<DeviceTypeDefinition>} deviceTypes - The device types to add.
   * @param {ClusterId[]} includeServerList - The list of cluster IDs to include.
   */
  addDeviceTypeWithClusterServer(deviceTypes: AtLeastOne<DeviceTypeDefinition>, includeServerList: ClusterId[]) {
    this.log.debug('addDeviceTypeWithClusterServer:');
    deviceTypes.forEach((deviceType) => {
      this.addDeviceType(deviceType);
      this.log.debug(`- with deviceType: ${zb}${deviceType.code}${db}-${zb}${deviceType.name}${db}`);
      deviceType.requiredServerClusters.forEach((clusterId) => {
        if (!includeServerList.includes(clusterId)) includeServerList.push(clusterId);
      });
    });
    includeServerList.forEach((clusterId) => {
      this.log.debug(`- with cluster: ${hk}${clusterId}${db}-${hk}${getClusterNameById(clusterId)}${db}`);
    });
    // this.addClusterServerFromList(this, includeServerList);
  }
}
