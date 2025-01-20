/* eslint-disable @typescript-eslint/no-unused-vars */

// Matterbridge
import { DeviceTypeDefinition, MatterbridgeEndpointOptions } from './matterbridgeDeviceTypes.js';

// @matter
import { AtLeastOne, Endpoint, EndpointNumber, EndpointType, MutableEndpoint, SupportedBehaviors } from '@matter/main';
import { DeviceClassification } from '@matter/main/model';

// @matter clusters
import { Descriptor } from '@matter/main/clusters/descriptor';
import { Identify } from '@matter/main/clusters/identify';
import { OnOff } from '@matter/main/clusters/on-off';
import { LevelControl } from '@matter/main/clusters/level-control';

// @matter behaviors
import { DescriptorServer } from '@matter/node/behaviors/descriptor';
import { IdentifyServer } from '@matter/node/behaviors/identify';
import { GroupsServer } from '@matter/node/behaviors/groups';
import { ScenesManagementServer } from '@matter/node/behaviors/scenes-management';
import { OnOffServer } from '@matter/main/behaviors/on-off';
import { LevelControlServer } from '@matter/main/behaviors/level-control';

class MatterbridgeEndpoint extends Endpoint {
  constructor(definition: DeviceTypeDefinition | AtLeastOne<DeviceTypeDefinition>, options: MatterbridgeEndpointOptions = {}, debug = false) {
    let deviceTypeList: { deviceType: number; revision: number }[] = [];

    // Get the first DeviceTypeDefinition
    let firstDefinition: DeviceTypeDefinition;
    if (Array.isArray(definition)) {
      firstDefinition = definition[0];
      deviceTypeList = Array.from(definition.values()).map((dt) => ({
        deviceType: dt.code,
        revision: dt.revision,
      }));
    } else {
      firstDefinition = definition;
      deviceTypeList = [{ deviceType: firstDefinition.code, revision: firstDefinition.revision }];
    }

    // Convert the first DeviceTypeDefinition to an EndpointType.Options
    const deviceTypeDefinitionV8: EndpointType.Options = {
      name: firstDefinition.name.replace('-', '_'),
      deviceType: firstDefinition.code,
      deviceRevision: firstDefinition.revision,
      deviceClass: firstDefinition.deviceClass.toLowerCase() as unknown as DeviceClassification,
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
      behaviors: options.tagList ? SupportedBehaviors(DescriptorServer.with(Descriptor.Feature.TagList)) : {},
    };
    const endpointV8 = MutableEndpoint(deviceTypeDefinitionV8);

    // Convert the options to an Endpoint.Options
    const optionsV8 = {
      id: options.uniqueStorageKey?.replace(/[ .]/g, ''),
      number: options.endpointId,
      descriptor: options.tagList ? { tagList: options.tagList, deviceTypeList } : { deviceTypeList },
    } as { id?: string; number?: EndpointNumber; descriptor?: Record<string, object> };
    super(endpointV8, optionsV8);
  }

  /**
   * Creates a default identify cluster server with the specified identify time and type.
   *
   * @param {number} [identifyTime=0] - The time to identify the server. Defaults to 0.
   * @param {Identify.IdentifyType} [identifyType=Identify.IdentifyType.None] - The type of identification. Defaults to Identify.IdentifyType.None.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultIdentifyClusterServer(identifyTime = 0, identifyType = Identify.IdentifyType.None) {
    this.behaviors.require(IdentifyServer, {
      identifyTime,
      identifyType,
    });
    return this;
  }

  /**
   * Creates a default groups cluster server.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultGroupsClusterServer() {
    this.behaviors.require(GroupsServer);
    return this;
  }

  /**
   * Creates a default scenes management cluster server.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultScenesClusterServer() {
    this.behaviors.require(ScenesManagementServer);
    return this;
  }

  /**
   * Creates a default OnOff cluster server for light devices.
   *
   * @param {boolean} [onOff=false] - The initial state of the OnOff cluster.
   * @param {boolean} [globalSceneControl=false] - The global scene control state.
   * @param {number} [onTime=0] - The on time value.
   * @param {number} [offWaitTime=0] - The off wait time value.
   * @param {OnOff.StartUpOnOff | null} [startUpOnOff=null] - The start-up OnOff state. Null means previous state.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultOnOffClusterServer(onOff = false, globalSceneControl = false, onTime = 0, offWaitTime = 0, startUpOnOff: OnOff.StartUpOnOff | null = null) {
    this.behaviors.require(OnOffServer.with(OnOff.Feature.Lighting), {
      onOff,
      globalSceneControl,
      onTime,
      offWaitTime,
      startUpOnOff,
    });
    return this;
  }

  /**
   * Creates an OnOff cluster server without features.
   *
   * @param {boolean} [onOff=false] - The initial state of the OnOff cluster.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createOnOffClusterServer(onOff = false) {
    this.behaviors.require(OnOffServer, {
      onOff,
    });
    return this;
  }

  /**
   * Creates a DeadFront OnOff cluster server.
   *
   * @param {boolean} [onOff=false] - The initial state of the OnOff cluster.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDeadFrontOnOffClusterServer(onOff = false) {
    this.behaviors.require(OnOffServer.with(OnOff.Feature.DeadFrontBehavior), {
      onOff,
    });
    return this;
  }

  /**
   * Creates a default level control cluster server for light devices.
   *
   * @param {number} [currentLevel=254] - The current level (default: 254).
   * @param {number} [minLevel=1] - The minimum level (default: 1).
   * @param {number} [maxLevel=254] - The maximum level (default: 254).
   * @param {number | null} [onLevel=null] - The on level (default: null).
   * @param {number | null} [startUpCurrentLevel=null] - The startUp on level (default: null).
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultLevelControlClusterServer(currentLevel = 254, minLevel = 1, maxLevel = 254, onLevel: number | null = null, startUpCurrentLevel: number | null = null) {
    this.behaviors.require(LevelControlServer.with(LevelControl.Feature.OnOff, LevelControl.Feature.Lighting), {
      currentLevel,
      minLevel,
      maxLevel,
      onLevel,
      remainingTime: 0,
      startUpCurrentLevel,
      options: {
        executeIfOff: false,
        coupleColorTempToLevel: false,
      },
    });
    return this;
  }
}
