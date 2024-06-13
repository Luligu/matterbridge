/* eslint-disable @typescript-eslint/no-unused-vars */
// New API imports
import { Endpoint, EndpointServer } from '@project-chip/matter.js/endpoint';
import { OnOffLightDevice } from '@project-chip/matter.js/devices/OnOffLightDevice';
import { AggregatorEndpoint } from '@project-chip/matter.js/endpoints/AggregatorEndpoint';
import { BridgedNodeEndpoint } from '@project-chip/matter.js/endpoints/BridgedNodeEndpoint';
import { MutableEndpoint } from '@project-chip/matter.js/endpoint/type';
import { SupportedBehaviors } from '@project-chip/matter.js/endpoint/properties';
import { IdentifyServer, IdentifyBehavior } from '@project-chip/matter.js/behavior/definitions/identify';
import { GroupsServer, GroupsBehavior } from '@project-chip/matter.js/behavior/definitions/groups';
import { ScenesServer, ScenesBehavior } from '@project-chip/matter.js/behavior/definitions/scenes';
import { OnOffServer, OnOffBehavior } from '@project-chip/matter.js/behavior/definitions/on-off';
import { BridgedDeviceBasicInformationServer, BridgedDeviceBasicInformationBehavior } from '@project-chip/matter.js/behavior/definitions/bridged-device-basic-information';

// Old API imports
import { DeviceTypeDefinition, DeviceTypes, EndpointOptions } from '@project-chip/matter-node.js/device';

// Matterbridge imports
import { AnsiLogger, TimestampFormat, db, hk, zb } from 'node-ansi-logger';
import { AtLeastOne } from '@project-chip/matter-node.js/util';
import { ClusterId } from '@project-chip/matter-node.js/datatype';
import { getClusterNameById } from '@project-chip/matter-node.js/cluster';

export class MatterbridgeDeviceV8 extends Endpoint {
  public static bridgeMode = '';
  log: AnsiLogger;
  serialNumber: string | undefined = undefined;
  deviceName: string | undefined = undefined;
  uniqueId: string | undefined = undefined;

  deviceTypes: DeviceTypeDefinition[];

  /**
   * Represents a Matterbridge device.
   * @constructor
   * @param {DeviceTypeDefinition} definition - The definition of the device.
   * @param {EndpointOptions} [options={}] - The options for the device.
   */
  constructor(definition: DeviceTypeDefinition, options: EndpointOptions = {}) {
    const definitionV8 = MutableEndpoint({
      name: definition.name,
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
      behaviors: SupportedBehaviors(IdentifyServer, GroupsServer, ScenesServer, OnOffBehavior, BridgedDeviceBasicInformationServer),
    });
    super(definitionV8);
    this.log = new AnsiLogger({ logName: 'MatterbridgeDevice', logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: true });
    this.deviceTypes = [definition];
  }

  /**
   * Loads an instance of the MatterbridgeDevice class.
   *
   * @param {DeviceTypeDefinition} definition - The DeviceTypeDefinition of the device.
   * @returns MatterbridgeDevice instance.
   */
  static async loadInstance(definition: DeviceTypeDefinition, options: EndpointOptions) {
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

  getBridgedNodeEndpointV8() {
    // New API
    const endpoint = new Endpoint(BridgedNodeEndpoint, { id: 'MatterbridgeDevice' });
    const child = new Endpoint(OnOffLightDevice, { id: 'onoff' });
    endpoint.add(child);
    return endpoint;
  }
}
