/**
 * This file contains the class MatterbridgeDevice.
 *
 * @file matterbridgeDevice.ts
 * @author Luca Liguori
 * @date 2023-12-29
 * @version 1.0.15
 *
 * Copyright 2023, 2024 Luca Liguori.
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

import {
  BasicInformationCluster,
  BooleanState,
  BooleanStateCluster,
  BridgedDeviceBasicInformationCluster,
  ClusterServer,
  ClusterServerHandlers,
  ColorControl,
  ColorControlCluster,
  DoorLock,
  DoorLockCluster,
  ElectricalMeasurement,
  ElectricalMeasurementCluster,
  FlowMeasurement,
  FlowMeasurementCluster,
  Groups,
  Identify,
  IdentifyCluster,
  IlluminanceMeasurement,
  IlluminanceMeasurementCluster,
  LevelControl,
  LevelControlCluster,
  OccupancySensing,
  OccupancySensingCluster,
  OnOff,
  OnOffCluster,
  PowerSource,
  PowerSourceCluster,
  PowerSourceConfigurationCluster,
  PressureMeasurement,
  PressureMeasurementCluster,
  RelativeHumidityMeasurement,
  RelativeHumidityMeasurementCluster,
  Scenes,
  Switch,
  SwitchCluster,
  TemperatureMeasurement,
  TemperatureMeasurementCluster,
  Thermostat,
  ThermostatCluster,
  ThreadNetworkDiagnostics,
  ThreadNetworkDiagnosticsCluster,
  TimeSync,
  TimeSyncCluster,
  WindowCovering,
  WindowCoveringCluster,
  createDefaultGroupsClusterServer,
  createDefaultScenesClusterServer,
  getClusterNameById,
} from '@project-chip/matter-node.js/cluster';
import { ClusterId, EndpointNumber, VendorId } from '@project-chip/matter-node.js/datatype';
import { Device, DeviceClasses, DeviceTypeDefinition, Endpoint, EndpointOptions } from '@project-chip/matter-node.js/device';
import { AtLeastOne, extendPublicHandlerMethods } from '@project-chip/matter-node.js/util';

import { MatterHistory, Sensitivity, WeatherTrend, TemperatureDisplayUnits } from 'matter-history';
import { EveHistory, EveHistoryCluster } from 'matter-history';

import { AirQuality, AirQualityCluster } from './AirQualityCluster.js';
import { AnsiLogger, TimestampFormat } from 'node-ansi-logger';
import { createHash } from 'crypto';
import { TvocMeasurement, TvocMeasurementCluster } from './TvocCluster.js';

type MakeMandatory<T> = Exclude<T, undefined>;

type MatterbridgeDeviceCommands = {
  identify: MakeMandatory<ClusterServerHandlers<typeof Identify.Complete>['identify']>;

  on: MakeMandatory<ClusterServerHandlers<typeof OnOff.Complete>['on']>;
  off: MakeMandatory<ClusterServerHandlers<typeof OnOff.Complete>['off']>;
  toggle: MakeMandatory<ClusterServerHandlers<typeof OnOff.Complete>['toggle']>;
  offWithEffect: MakeMandatory<ClusterServerHandlers<typeof OnOff.Complete>['offWithEffect']>;

  moveToLevel: MakeMandatory<ClusterServerHandlers<typeof LevelControl.Complete>['moveToLevel']>;
  moveToLevelWithOnOff: MakeMandatory<ClusterServerHandlers<typeof LevelControl.Complete>['moveToLevelWithOnOff']>;

  moveToHue: MakeMandatory<ClusterServerHandlers<typeof ColorControl.Complete>['moveToHue']>;
  moveHue: MakeMandatory<ClusterServerHandlers<typeof ColorControl.Complete>['moveHue']>;
  stepHue: MakeMandatory<ClusterServerHandlers<typeof ColorControl.Complete>['stepHue']>;
  moveToSaturation: MakeMandatory<ClusterServerHandlers<typeof ColorControl.Complete>['moveToSaturation']>;
  moveSaturation: MakeMandatory<ClusterServerHandlers<typeof ColorControl.Complete>['moveSaturation']>;
  stepSaturation: MakeMandatory<ClusterServerHandlers<typeof ColorControl.Complete>['stepSaturation']>;
  moveToHueAndSaturation: MakeMandatory<ClusterServerHandlers<typeof ColorControl.Complete>['moveToHueAndSaturation']>;
  moveToColorTemperature: MakeMandatory<ClusterServerHandlers<typeof ColorControl.Complete>['moveToColorTemperature']>;

  upOrOpen: MakeMandatory<ClusterServerHandlers<typeof WindowCovering.Complete>['upOrOpen']>;
  downOrClose: MakeMandatory<ClusterServerHandlers<typeof WindowCovering.Complete>['downOrClose']>;
  stopMotion: MakeMandatory<ClusterServerHandlers<typeof WindowCovering.Complete>['stopMotion']>;
  goToLiftPercentage: MakeMandatory<ClusterServerHandlers<typeof WindowCovering.Complete>['goToLiftPercentage']>;

  lockDoor: MakeMandatory<ClusterServerHandlers<typeof DoorLock.Complete>['lockDoor']>;
  unlockDoor: MakeMandatory<ClusterServerHandlers<typeof DoorLock.Complete>['unlockDoor']>;

  setpointRaiseLower: MakeMandatory<ClusterServerHandlers<typeof Thermostat.Complete>['setpointRaiseLower']>;
};

// Custom device types
export const onOffSwitch = DeviceTypeDefinition({
  name: 'MA-onoffswitch',
  code: 0x0103,
  deviceClass: DeviceClasses.Simple,
  revision: 2,
  requiredServerClusters: [Identify.Cluster.id, Groups.Cluster.id, Scenes.Cluster.id, OnOff.Cluster.id],
  optionalServerClusters: [LevelControl.Cluster.id],
});

export const dimmableSwitch = DeviceTypeDefinition({
  name: 'MA-dimmableswitch',
  code: 0x0104,
  deviceClass: DeviceClasses.Simple,
  revision: 2,
  requiredServerClusters: [Identify.Cluster.id, Groups.Cluster.id, Scenes.Cluster.id, OnOff.Cluster.id, LevelControl.Cluster.id],
  optionalServerClusters: [],
});

export const colorTemperatureSwitch = DeviceTypeDefinition({
  name: 'MA-colortemperatureswitch',
  code: 0x0105,
  deviceClass: DeviceClasses.Simple,
  revision: 2,
  requiredServerClusters: [Identify.Cluster.id, Groups.Cluster.id, Scenes.Cluster.id, OnOff.Cluster.id, LevelControl.Cluster.id, ColorControl.Cluster.id],
  optionalServerClusters: [],
});

export const airQualitySensor = DeviceTypeDefinition({
  name: 'MA-airqualitysensor',
  code: 0x002c,
  deviceClass: DeviceClasses.Simple,
  revision: 1,
  requiredServerClusters: [Identify.Cluster.id, AirQuality.Cluster.id],
  optionalServerClusters: [TemperatureMeasurement.Cluster.id, RelativeHumidityMeasurement.Cluster.id, TvocMeasurement.Cluster.id],
});

export interface SerializedMatterbridgeDevice {
  pluginName: string;
  deviceName: string;
  serialNumber: string;
  uniqueId: string;
  deviceType: AtLeastOne<DeviceTypeDefinition>;
  endpoint: EndpointNumber | undefined;
  endpointName: string;
  clusterServersId: ClusterId[];
}

export class MatterbridgeDevice extends extendPublicHandlerMethods<typeof Device, MatterbridgeDeviceCommands>(Device) {
  public static bridgeMode = '';
  log: AnsiLogger;
  serialNumber: string | undefined = undefined;
  deviceName: string | undefined = undefined;
  uniqueId: string | undefined = undefined;

  /**
   * Represents a Matterbridge device.
   * @constructor
   * @param {DeviceTypeDefinition} definition - The definition of the device.
   * @param {EndpointOptions} [options={}] - The options for the device.
   */
  constructor(definition: DeviceTypeDefinition, options: EndpointOptions = {}) {
    super(definition, options);
    this.log = new AnsiLogger({ logName: 'MatterbridgeDevice', logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: true });
  }

  /**
   * Loads an instance of the MatterbridgeDevice class.
   *
   * @param {DeviceTypeDefinition} definition - The DeviceTypeDefinition of the device.
   * @returns MatterbridgeDevice instance.
   */
  static async loadInstance(definition: DeviceTypeDefinition) {
    return new MatterbridgeDevice(definition);
  }

  /**
   * Adds a device type to the list of device types.
   * If the device type is not already present in the list, it will be added.
   *
   * @param {DeviceTypeDefinition} deviceType - The device type to add.
   */
  addDeviceType(deviceType: DeviceTypeDefinition) {
    const deviceTypes = this.getDeviceTypes();
    if (!deviceTypes.includes(deviceType)) {
      deviceTypes.push(deviceType);
      this.setDeviceTypes(deviceTypes);
    }
  }

  public addChildDeviceTypeWithClusterServer(deviceTypes: AtLeastOne<DeviceTypeDefinition>, includeServerList: ClusterId[]) {
    this.log.debug('addChildDeviceTypeWithClusterServer:');
    const child = new Endpoint(deviceTypes);
    deviceTypes.forEach((deviceType) => {
      this.log.debug(`- with deviceType: ${deviceType.code}-${deviceType.name}`);
      deviceType.requiredServerClusters.forEach((clusterId) => {
        if (!includeServerList.includes(clusterId)) includeServerList.push(clusterId);
      });
    });
    includeServerList.forEach((clusterId) => {
      this.log.debug(`- with cluster: ${clusterId}-${getClusterNameById(clusterId)}`);
    });

    if (includeServerList.includes(Identify.Cluster.id)) {
      child.addClusterServer(this.getDefaultIdentifyClusterServer());
    }
    if (includeServerList.includes(Groups.Cluster.id)) {
      child.addClusterServer(this.getDefaultGroupsClusterServer());
    }
    if (includeServerList.includes(Scenes.Cluster.id)) {
      child.addClusterServer(this.getDefaultScenesClusterServer());
    }
    if (includeServerList.includes(OnOff.Cluster.id)) {
      child.addClusterServer(this.getDefaultOnOffClusterServer());
    }
    if (includeServerList.includes(TemperatureMeasurement.Cluster.id)) {
      child.addClusterServer(this.getDefaultTemperatureMeasurementClusterServer());
    }
    if (includeServerList.includes(RelativeHumidityMeasurement.Cluster.id)) {
      child.addClusterServer(this.getDefaultRelativeHumidityMeasurementClusterServer());
    }
    if (includeServerList.includes(PressureMeasurement.Cluster.id)) {
      child.addClusterServer(this.getDefaultPressureMeasurementClusterServer());
    }
    if (includeServerList.includes(FlowMeasurement.Cluster.id)) {
      child.addClusterServer(this.getDefaultFlowMeasurementClusterServer());
    }
    if (includeServerList.includes(BooleanState.Cluster.id)) {
      child.addClusterServer(this.getDefaultBooleanStateClusterServer());
    }
    if (includeServerList.includes(OccupancySensing.Cluster.id)) {
      child.addClusterServer(this.getDefaultOccupancySensingClusterServer());
    }
    if (includeServerList.includes(IlluminanceMeasurement.Cluster.id)) {
      child.addClusterServer(this.getDefaultIlluminanceMeasurementClusterServer());
    }
    if (includeServerList.includes(EveHistory.Cluster.id) && !this.hasClusterServer(EveHistory.Complete)) {
      child.addClusterServer(this.getDefaultStaticEveHistoryClusterServer());
    }
    if (includeServerList.includes(ElectricalMeasurement.Cluster.id) && !this.hasClusterServer(ElectricalMeasurement.Complete)) {
      child.addClusterServer(this.getDefaultElectricalMeasurementClusterServer());
    }
    this.addChildEndpoint(child);
    return child;
  }

  /**
   * Serializes the Matterbridge device into a serialized object.
   *
   * @param pluginName - The name of the plugin.
   * @returns The serialized Matterbridge device object.
   */
  serialize(pluginName: string) {
    const serialized: SerializedMatterbridgeDevice = {
      pluginName,
      serialNumber: this.serialNumber!,
      deviceName: this.deviceName!,
      uniqueId: this.uniqueId!,
      deviceType: this.getDeviceTypes(),
      endpoint: this.number,
      endpointName: this.name,
      clusterServersId: [],
    };
    this.getAllClusterServers().forEach((clusterServer) => {
      serialized.clusterServersId.push(clusterServer.id);
    });
    return serialized;
  }

  /**
   * Returns a default static EveHistoryClusterServer object with the specified voltage, current, power, and consumption values.
   * This shows up in HA as a static sensor!
   * @param voltage - The voltage value (default: 0).
   * @param current - The current value (default: 0).
   * @param power - The power value (default: 0).
   * @param consumption - The consumption value (default: 0).
   * @returns The default static EveHistoryClusterServer object.
   */
  getDefaultStaticEveHistoryClusterServer(voltage = 0, current = 0, power = 0, consumption = 0) {
    return ClusterServer(
      EveHistoryCluster.with(EveHistory.Feature.EveEnergy),
      {
        // Dynamic attributes
        ConfigDataGet: Uint8Array.fromHex(''),
        ConfigDataSet: Uint8Array.fromHex(''),
        HistoryStatus: Uint8Array.fromHex(''),
        HistoryEntries: Uint8Array.fromHex(''),
        HistoryRequest: Uint8Array.fromHex(''),
        HistorySetTime: Uint8Array.fromHex(''),
        LastEvent: 0,
        ResetTotal: 0,
        // Normal attributes
        Voltage: voltage,
        Current: current,
        Consumption: power,
        TotalConsumption: consumption,
        EnergyUnknown: 1,
        ChildLock: false,
        RLoc: 46080,
      },
      {},
      {},
    );
  }

  /**
   * Creates a room Eve History Cluster Server.
   *
   * @param history - The MatterHistory object.
   * @param log - The AnsiLogger object.
   */
  createRoomEveHistoryClusterServer(history: MatterHistory, log: AnsiLogger) {
    history.setMatterHystoryType('room', this.serialNumber);
    this.addClusterServer(
      ClusterServer(
        EveHistoryCluster.with(EveHistory.Feature.EveRoom),
        {
          // Dynamic attributes
          ConfigDataGet: Uint8Array.fromHex(''),
          ConfigDataSet: Uint8Array.fromHex(''),
          HistoryStatus: Uint8Array.fromHex(''),
          HistoryEntries: Uint8Array.fromHex(''),
          HistoryRequest: Uint8Array.fromHex(''),
          HistorySetTime: Uint8Array.fromHex(''),
          // Normal attributes
          TemperatureDisplayUnits: TemperatureDisplayUnits.CELSIUS,
          RLoc: 46080,
        },
        {
          ConfigDataGetAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`ConfigDataGetAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return history.OnGetConfigData(isFabricFiltered);
          },

          ConfigDataSetAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`ConfigDataSetAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return Uint8Array.fromHex('');
          },
          ConfigDataSetAttributeSetter: (value: Uint8Array, { attributes, endpoint, session }) => {
            log.debug(`ConfigDataSetAttributeSetter [${value.toHex()}] ${attributes.ConfigDataSet} endpoint: ${endpoint?.name} session: ${session?.name}`);
            return history.OnSetConfigData(value);
          },

          HistoryStatusAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`HistoryStatusAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return history.OnGetHistoryStatus(isFabricFiltered);
          },

          HistoryEntriesAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`HistoryEntriesAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return history.OnGetHistoryEntries();
          },

          HistorySetTimeAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`HistorySetTimeAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return Uint8Array.fromHex('');
          },
          HistorySetTimeAttributeSetter: (value: Uint8Array, { attributes, endpoint, session }) => {
            log.debug(`HistorySetTimeAttributeSetter ${value.toHex()} ${attributes.HistorySetTime} endpoint: ${endpoint?.name} session: ${session?.name}`);
            return history.OnSetHistorySetTime(value);
          },

          HistoryRequestAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`HistoryRequestAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return Uint8Array.fromHex('');
          },
          HistoryRequestAttributeSetter: (value: Uint8Array, { attributes, endpoint, session }) => {
            log.debug(`HistoryRequestAttributeSetter ${value.toHex()} ${attributes.HistoryRequest} endpoint: ${endpoint?.name} session: ${session?.name}`);
            return history.OnSetHistoryRequest(value);
          },
        },
        {},
      ),
    );
  }

  /**
   * Creates a Weather Eve History Cluster Server.
   *
   * @param history - The MatterHistory instance.
   * @param log - The AnsiLogger instance.
   */
  createWeatherEveHistoryClusterServer(history: MatterHistory, log: AnsiLogger) {
    history.setMatterHystoryType('weather', this.serialNumber);
    this.addClusterServer(
      ClusterServer(
        EveHistoryCluster.with(EveHistory.Feature.EveWeather),
        {
          // Dynamic attributes
          ConfigDataGet: Uint8Array.fromHex(''),
          ConfigDataSet: Uint8Array.fromHex(''),
          HistoryStatus: Uint8Array.fromHex(''),
          HistoryEntries: Uint8Array.fromHex(''),
          HistoryRequest: Uint8Array.fromHex(''),
          HistorySetTime: Uint8Array.fromHex(''),
          // Normal attributes
          Elevation: 0,
          AirPressure: 1000,
          WeatherTrend: WeatherTrend.SUN,
          TemperatureDisplayUnits: TemperatureDisplayUnits.CELSIUS,
          RLoc: 46080,
        },
        {
          ConfigDataGetAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`ConfigDataGetAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return history.OnGetConfigData(isFabricFiltered);
          },

          ConfigDataSetAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`ConfigDataSetAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return Uint8Array.fromHex('');
          },
          ConfigDataSetAttributeSetter: (value: Uint8Array, { attributes, endpoint, session }) => {
            log.debug(`ConfigDataSetAttributeSetter [${value.toHex()}] ${attributes.ConfigDataSet} endpoint: ${endpoint?.name} session: ${session?.name}`);
            return history.OnSetConfigData(value);
          },

          HistoryStatusAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`HistoryStatusAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return history.OnGetHistoryStatus(isFabricFiltered);
          },

          HistoryEntriesAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`HistoryEntriesAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return history.OnGetHistoryEntries();
          },

          HistorySetTimeAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`HistorySetTimeAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return Uint8Array.fromHex('');
          },
          HistorySetTimeAttributeSetter: (value: Uint8Array, { attributes, endpoint, session }) => {
            log.debug(`HistorySetTimeAttributeSetter ${value.toHex()} ${attributes.HistorySetTime} endpoint: ${endpoint?.name} session: ${session?.name}`);
            return history.OnSetHistorySetTime(value);
          },

          HistoryRequestAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`HistoryRequestAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return Uint8Array.fromHex('');
          },
          HistoryRequestAttributeSetter: (value: Uint8Array, { attributes, endpoint, session }) => {
            log.debug(`HistoryRequestAttributeSetter ${value.toHex()} ${attributes.HistoryRequest} endpoint: ${endpoint?.name} session: ${session?.name}`);
            return history.OnSetHistoryRequest(value);
          },
        },
        {},
      ),
    );
  }

  /**
   * Creates an Energy Eve History Cluster Server.
   *
   * @param history - The MatterHistory object.
   * @param log - The AnsiLogger object.
   */
  createEnergyEveHistoryClusterServer(history: MatterHistory, log: AnsiLogger) {
    history.setMatterHystoryType('energy');
    this.addClusterServer(
      ClusterServer(
        EveHistoryCluster.with(EveHistory.Feature.EveEnergy),
        {
          // Dynamic attributes
          ConfigDataGet: Uint8Array.fromHex(''),
          ConfigDataSet: Uint8Array.fromHex(''),
          HistoryStatus: Uint8Array.fromHex(''),
          HistoryEntries: Uint8Array.fromHex(''),
          HistoryRequest: Uint8Array.fromHex(''),
          HistorySetTime: Uint8Array.fromHex(''),
          LastEvent: 0,
          ResetTotal: 0,
          // Normal attributes
          Voltage: 0,
          Current: 0,
          Consumption: 0,
          TotalConsumption: 0,
          EnergyUnknown: 1,
          ChildLock: false,
          RLoc: 46080,
        },
        {
          ConfigDataGetAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`ConfigDataGetAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return history.OnGetConfigData(isFabricFiltered);
          },

          ConfigDataSetAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`ConfigDataSetAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return Uint8Array.fromHex('');
          },
          ConfigDataSetAttributeSetter: (value: Uint8Array, { attributes, endpoint, session }) => {
            log.debug(`ConfigDataSetAttributeSetter [${value.toHex()}] ${attributes.ConfigDataSet} endpoint: ${endpoint?.name} session: ${session?.name}`);
            return history.OnSetConfigData(value);
          },

          HistoryStatusAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`HistoryStatusAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return history.OnGetHistoryStatus(isFabricFiltered);
          },

          HistoryEntriesAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`HistoryEntriesAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return history.OnGetHistoryEntries();
          },

          HistorySetTimeAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`HistorySetTimeAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return Uint8Array.fromHex('');
          },
          HistorySetTimeAttributeSetter: (value: Uint8Array, { attributes, endpoint, session }) => {
            log.debug(`HistorySetTimeAttributeSetter ${value.toHex()} ${attributes.HistorySetTime} endpoint: ${endpoint?.name} session: ${session?.name}`);
            return history.OnSetHistorySetTime(value);
          },

          HistoryRequestAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`HistoryRequestAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return Uint8Array.fromHex('');
          },
          HistoryRequestAttributeSetter: (value: Uint8Array, { attributes, endpoint, session }) => {
            log.debug(`HistoryRequestAttributeSetter ${value.toHex()} ${attributes.HistoryRequest} endpoint: ${endpoint?.name} session: ${session?.name}`);
            return history.OnSetHistoryRequest(value);
          },

          LastEventAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`LastEventAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return history.OnGetLastEvent();
          },

          ResetTotalAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`LastResetTotalAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return history.OnGetLastReset();
          },
          ResetTotalAttributeSetter: (value: number, { attributes, endpoint, session }) => {
            log.debug(`LastResetTotalAttributeSetter ${value} ${attributes.ResetTotal} endpoint: ${endpoint?.name} session: ${session?.name}`);
            return history.OnSetLastReset(value);
          },
        },
        {},
      ),
    );
  }

  /**
   * Creates a Motion Eve History Cluster Server.
   *
   * @param history - The MatterHistory object.
   * @param log - The AnsiLogger object.
   */
  createMotionEveHistoryClusterServer(history: MatterHistory, log: AnsiLogger) {
    history.setMatterHystoryType('motion');
    this.addClusterServer(
      ClusterServer(
        EveHistoryCluster.with(EveHistory.Feature.EveMotion),
        {
          // Dynamic attributes
          ConfigDataGet: Uint8Array.fromHex(''),
          ConfigDataSet: Uint8Array.fromHex(''),
          HistoryStatus: Uint8Array.fromHex(''),
          HistoryEntries: Uint8Array.fromHex(''),
          HistoryRequest: Uint8Array.fromHex(''),
          HistorySetTime: Uint8Array.fromHex(''),
          LastEvent: 0,
          // Normal attributes
          MotionSensitivity: Sensitivity.HIGH,
          RLoc: 46080,
        },
        {
          ConfigDataGetAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`ConfigDataGetAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return history.OnGetConfigData(isFabricFiltered);
          },

          ConfigDataSetAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`ConfigDataSetAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return Uint8Array.fromHex('');
          },
          ConfigDataSetAttributeSetter: (value: Uint8Array, { attributes, endpoint, session }) => {
            log.debug(`ConfigDataSetAttributeSetter [${value.toHex()}] ${attributes.ConfigDataSet} endpoint: ${endpoint?.name} session: ${session?.name}`);
            return history.OnSetConfigData(value);
          },

          HistoryStatusAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`HistoryStatusAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return history.OnGetHistoryStatus(isFabricFiltered);
          },

          HistoryEntriesAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`HistoryEntriesAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return history.OnGetHistoryEntries();
          },

          HistorySetTimeAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`HistorySetTimeAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return Uint8Array.fromHex('');
          },
          HistorySetTimeAttributeSetter: (value: Uint8Array, { attributes, endpoint, session }) => {
            log.debug(`HistorySetTimeAttributeSetter ${value.toHex()} ${attributes.HistorySetTime} endpoint: ${endpoint?.name} session: ${session?.name}`);
            return history.OnSetHistorySetTime(value);
          },

          HistoryRequestAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`HistoryRequestAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return Uint8Array.fromHex('');
          },
          HistoryRequestAttributeSetter: (value: Uint8Array, { attributes, endpoint, session }) => {
            log.debug(`HistoryRequestAttributeSetter ${value.toHex()} ${attributes.HistoryRequest} endpoint: ${endpoint?.name} session: ${session?.name}`);
            return history.OnSetHistoryRequest(value);
          },

          LastEventAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`LastEventAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return history.OnGetLastEvent();
          },
        },
        {},
      ),
    );
  }

  /**
   * Creates a door EveHistoryCluster server.
   *
   * @param history - The MatterHistory instance.
   * @param log - The AnsiLogger instance.
   */
  createDoorEveHistoryClusterServer(history: MatterHistory, log: AnsiLogger) {
    history.setMatterHystoryType('door');
    this.addClusterServer(
      ClusterServer(
        EveHistoryCluster.with(EveHistory.Feature.EveDoor),
        {
          // Dynamic attributes
          ConfigDataGet: Uint8Array.fromHex(''),
          ConfigDataSet: Uint8Array.fromHex(''),
          HistoryStatus: Uint8Array.fromHex(''),
          HistoryEntries: Uint8Array.fromHex(''),
          HistoryRequest: Uint8Array.fromHex(''),
          HistorySetTime: Uint8Array.fromHex(''),
          TimesOpened: 0,
          LastEvent: 0,
          ResetTotal: 0,
          // Normal attributes
          RLoc: 46080,
        },
        {
          ConfigDataGetAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`ConfigDataGetAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return history.OnGetConfigData(isFabricFiltered);
          },

          ConfigDataSetAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`ConfigDataSetAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return Uint8Array.fromHex('');
          },
          ConfigDataSetAttributeSetter: (value: Uint8Array, { attributes, endpoint, session }) => {
            log.debug(`ConfigDataSetAttributeSetter [${value.toHex()}] ${attributes.ConfigDataSet} endpoint: ${endpoint?.name} session: ${session?.name}`);
            return history.OnSetConfigData(value);
          },

          HistoryStatusAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`HistoryStatusAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return history.OnGetHistoryStatus(isFabricFiltered);
          },

          HistoryEntriesAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`HistoryEntriesAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return history.OnGetHistoryEntries();
          },

          HistorySetTimeAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`HistorySetTimeAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return Uint8Array.fromHex('');
          },
          HistorySetTimeAttributeSetter: (value: Uint8Array, { attributes, endpoint, session }) => {
            log.debug(`HistorySetTimeAttributeSetter ${value.toHex()} ${attributes.HistorySetTime} endpoint: ${endpoint?.name} session: ${session?.name}`);
            return history.OnSetHistorySetTime(value);
          },

          HistoryRequestAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`HistoryRequestAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return Uint8Array.fromHex('');
          },
          HistoryRequestAttributeSetter: (value: Uint8Array, { attributes, endpoint, session }) => {
            log.debug(`HistoryRequestAttributeSetter ${value.toHex()} ${attributes.HistoryRequest} endpoint: ${endpoint?.name} session: ${session?.name}`);
            return history.OnSetHistoryRequest(value);
          },

          LastEventAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`LastEventAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return history.OnGetLastEvent();
          },

          TimesOpenedAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`TimesOpenedAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return history.OnGetimesOpened();
          },

          ResetTotalAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`LastResetTotalAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return history.OnGetLastReset();
          },
          ResetTotalAttributeSetter: (value: number, { attributes, endpoint, session }) => {
            log.debug(`LastResetTotalAttributeSetter ${value} ${attributes.ResetTotal} endpoint: ${endpoint?.name} session: ${session?.name}`);
            return history.OnSetLastReset(value);
          },
        },
        {},
      ),
    );
  }

  /**
   * Get a default IdentifyCluster server.
   */
  getDefaultIdentifyClusterServer() {
    return ClusterServer(
      IdentifyCluster,
      {
        identifyTime: 0,
        identifyType: Identify.IdentifyType.None,
      },
      {
        identify: async (data) => {
          // eslint-disable-next-line no-console
          console.log('Identify');
          await this.commandHandler.executeHandler('identify', data);
        },
      },
    );
  }

  /**
   * Creates a default IdentifyCluster server.
   */
  createDefaultIdentifyClusterServer() {
    this.addClusterServer(this.getDefaultIdentifyClusterServer());
  }

  /**
   * Get a default IdentifyCluster server.
   */
  getDefaultGroupsClusterServer() {
    return createDefaultGroupsClusterServer();
  }

  /**
   * Creates a default groups cluster server and adds it to the device.
   */
  createDefaultGroupsClusterServer() {
    this.addClusterServer(this.getDefaultGroupsClusterServer());
  }

  /**
   * Get a default scenes cluster server and adds it to the current instance.
   */
  getDefaultScenesClusterServer() {
    return createDefaultScenesClusterServer();
  }

  /**
   * Creates a default scenes cluster server and adds it to the current instance.
   */
  createDefaultScenesClusterServer() {
    this.addClusterServer(this.getDefaultScenesClusterServer());
  }

  /**
   * Creates a unique identifier based on the provided parameters.
   * @param param1 - The first parameter.
   * @param param2 - The second parameter.
   * @param param3 - The third parameter.
   * @param param4 - The fourth parameter.
   * @returns A unique identifier generated using the MD5 hash algorithm.
   */
  private createUniqueId(param1: string, param2: string, param3: string, param4: string) {
    const hash = createHash('md5');
    hash.update(param1 + param2 + param3 + param4);
    return hash.digest('hex');
  }

  /**
   * Get a default Basic Information Cluster Server.
   *
   * @param deviceName - The name of the device.
   * @param serialNumber - The serial number of the device.
   * @param vendorId - The vendor ID of the device.
   * @param vendorName - The vendor name of the device.
   * @param productId - The product ID of the device.
   * @param productName - The product name of the device.
   * @param softwareVersion - The software version of the device. Default is 1.
   * @param softwareVersionString - The software version string of the device. Default is 'v.1.0.0'.
   * @param hardwareVersion - The hardware version of the device. Default is 1.
   * @param hardwareVersionString - The hardware version string of the device. Default is 'v.1.0.0'.
   */
  getDefaultBasicInformationClusterServer(
    deviceName: string,
    serialNumber: string,
    vendorId: number,
    vendorName: string,
    productId: number,
    productName: string,
    softwareVersion = 1,
    softwareVersionString = '1.0.0',
    hardwareVersion = 1,
    hardwareVersionString = '1.0.0',
  ) {
    return ClusterServer(
      BasicInformationCluster,
      {
        dataModelRevision: 1,
        location: 'XX',
        vendorId: VendorId(vendorId),
        vendorName: vendorName,
        productId: productId,
        productName: productName,
        productLabel: deviceName,
        nodeLabel: deviceName,
        serialNumber,
        uniqueId: this.createUniqueId(deviceName, serialNumber, vendorName, productName),
        softwareVersion,
        softwareVersionString,
        hardwareVersion,
        hardwareVersionString,
        reachable: true,
        capabilityMinima: { caseSessionsPerFabric: 3, subscriptionsPerFabric: 3 },
      },
      {},
      {
        startUp: true,
        shutDown: true,
        leave: true,
        reachableChanged: true,
      },
    );
  }
  /**
   * Creates a default Basic Information Cluster Server.
   *
   * @param deviceName - The name of the device.
   * @param serialNumber - The serial number of the device.
   * @param vendorId - The vendor ID of the device.
   * @param vendorName - The vendor name of the device.
   * @param productId - The product ID of the device.
   * @param productName - The product name of the device.
   * @param softwareVersion - The software version of the device. Default is 1.
   * @param softwareVersionString - The software version string of the device. Default is 'v.1.0.0'.
   * @param hardwareVersion - The hardware version of the device. Default is 1.
   * @param hardwareVersionString - The hardware version string of the device. Default is 'v.1.0.0'.
   */
  createDefaultBasicInformationClusterServer(
    deviceName: string,
    serialNumber: string,
    vendorId: number,
    vendorName: string,
    productId: number,
    productName: string,
    softwareVersion = 1,
    softwareVersionString = '1.0.0',
    hardwareVersion = 1,
    hardwareVersionString = '1.0.0',
  ) {
    this.deviceName = deviceName;
    this.serialNumber = serialNumber;
    this.uniqueId = this.createUniqueId(deviceName, serialNumber, vendorName, productName);
    if (MatterbridgeDevice.bridgeMode === 'bridge') {
      this.createDefaultBridgedDeviceBasicInformationClusterServer(deviceName, serialNumber, vendorId, vendorName, productName, softwareVersion, softwareVersionString, hardwareVersion, hardwareVersionString);
      return;
    }
    this.addClusterServer(this.getDefaultBasicInformationClusterServer(deviceName, serialNumber, vendorId, vendorName, productId, productName, softwareVersion, softwareVersionString, hardwareVersion, hardwareVersionString));
  }

  /**
   * Get a default BridgedDeviceBasicInformationClusterServer.
   *
   * @param deviceName - The name of the device.
   * @param serialNumber - The serial number of the device.
   * @param vendorId - The vendor ID of the device.
   * @param vendorName - The name of the vendor.
   * @param productName - The name of the product.
   * @param softwareVersion - The software version of the device. Default is 1.
   * @param softwareVersionString - The software version string of the device. Default is 'v.1.0.0'.
   * @param hardwareVersion - The hardware version of the device. Default is 1.
   * @param hardwareVersionString - The hardware version string of the device. Default is 'v.1.0.0'.
   */
  getDefaultBridgedDeviceBasicInformationClusterServer(
    deviceName: string,
    serialNumber: string,
    vendorId: number,
    vendorName: string,
    productName: string,
    softwareVersion = 1,
    softwareVersionString = '1.0.0',
    hardwareVersion = 1,
    hardwareVersionString = '1.0.0',
  ) {
    return ClusterServer(
      BridgedDeviceBasicInformationCluster,
      {
        vendorId: vendorId !== undefined ? VendorId(vendorId) : undefined, // 4874
        vendorName: vendorName,
        productName: productName,
        productLabel: deviceName,
        nodeLabel: deviceName,
        serialNumber,
        uniqueId: this.createUniqueId(deviceName, serialNumber, vendorName, productName),
        softwareVersion,
        softwareVersionString,
        hardwareVersion,
        hardwareVersionString,
        reachable: true,
      },
      {},
      {
        reachableChanged: true,
      },
    );
  }

  /**
   * Creates a default BridgedDeviceBasicInformationClusterServer.
   *
   * @param deviceName - The name of the device.
   * @param serialNumber - The serial number of the device.
   * @param vendorId - The vendor ID of the device.
   * @param vendorName - The name of the vendor.
   * @param productName - The name of the product.
   * @param softwareVersion - The software version of the device. Default is 1.
   * @param softwareVersionString - The software version string of the device. Default is 'v.1.0.0'.
   * @param hardwareVersion - The hardware version of the device. Default is 1.
   * @param hardwareVersionString - The hardware version string of the device. Default is 'v.1.0.0'.
   */
  createDefaultBridgedDeviceBasicInformationClusterServer(
    deviceName: string,
    serialNumber: string,
    vendorId: number,
    vendorName: string,
    productName: string,
    softwareVersion = 1,
    softwareVersionString = '1.0.0',
    hardwareVersion = 1,
    hardwareVersionString = '1.0.0',
  ) {
    this.deviceName = deviceName;
    this.serialNumber = serialNumber;
    this.uniqueId = this.createUniqueId(deviceName, serialNumber, vendorName, productName);
    this.addClusterServer(this.getDefaultBridgedDeviceBasicInformationClusterServer(deviceName, serialNumber, vendorId, vendorName, productName, softwareVersion, softwareVersionString, hardwareVersion, hardwareVersionString));
  }

  /**
   * Get a default Electrical Measurement Cluster Server.
   *
   * @param voltage - The RMS voltage value.
   * @param current - The RMS current value.
   * @param power - The active power value.
   * @param consumption - The total active power consumption value.
   */
  getDefaultElectricalMeasurementClusterServer(voltage = 0, current = 0, power = 0, consumption = 0) {
    return ClusterServer(
      ElectricalMeasurementCluster,
      {
        rmsVoltage: voltage,
        rmsCurrent: current,
        activePower: power,
        totalActivePower: consumption,
      },
      {},
      {},
    );
  }

  /**
   * Creates a default Electrical Measurement Cluster Server.
   *
   * @param voltage - The RMS voltage value.
   * @param current - The RMS current value.
   * @param power - The active power value.
   * @param consumption - The total active power consumption value.
   */
  createDefaultElectricalMeasurementClusterServer(voltage = 0, current = 0, power = 0, consumption = 0) {
    this.addClusterServer(this.getDefaultElectricalMeasurementClusterServer(voltage, current, power, consumption));
  }

  /**
   * Creates a default Thread Network Diagnostics Cluster server.
   *
   * @remarks
   * This method adds a cluster server used only to give the networkName to Eve app.
   *
   * @returns void
   */
  createDefaultDummyThreadNetworkDiagnosticsClusterServer() {
    this.addClusterServer(
      ClusterServer(
        ThreadNetworkDiagnosticsCluster.with(ThreadNetworkDiagnostics.Feature.PacketCounts, ThreadNetworkDiagnostics.Feature.ErrorCounts),
        {
          channel: 1,
          routingRole: ThreadNetworkDiagnostics.RoutingRole.Router,
          networkName: 'MyMatterThread',
          panId: 0,
          extendedPanId: 0,
          meshLocalPrefix: null,
          neighborTable: [],
          routeTable: [],
          partitionId: null,
          weighting: null,
          dataVersion: null,
          stableDataVersion: null,
          leaderRouterId: null,
          securityPolicy: null,
          channelPage0Mask: null,
          operationalDatasetComponents: null,
          overrunCount: 0,
          activeNetworkFaults: [],
        },
        {
          resetCounts: async (data) => {
            // eslint-disable-next-line no-console
            console.log('resetCounts');
            await this.commandHandler.executeHandler('resetCounts', data);
          },
        },
        {},
      ),
    );
  }

  /**
   * Get a default OnOff cluster server.
   *
   * @param onOff - The initial state of the OnOff cluster (default: false).
   */
  getDefaultOnOffClusterServer(onOff = false) {
    return ClusterServer(
      OnOffCluster,
      {
        onOff,
      },
      {
        on: async (data) => {
          // eslint-disable-next-line no-console
          console.log('on onOff:', data.attributes.onOff.getLocal());
          await this.commandHandler.executeHandler('on', data);
        },
        off: async (data) => {
          // eslint-disable-next-line no-console
          console.log('off onOff:', data.attributes.onOff.getLocal());
          await this.commandHandler.executeHandler('off', data);
        },
        toggle: async (data) => {
          // eslint-disable-next-line no-console
          console.log('toggle onOff:', data.attributes.onOff.getLocal());
          await this.commandHandler.executeHandler('toggle', data);
        },
      },
      {},
    );
  }

  /**
   * Creates a default OnOff cluster server.
   *
   * @param onOff - The initial state of the OnOff cluster (default: false).
   */
  createDefaultOnOffClusterServer(onOff = false) {
    this.addClusterServer(this.getDefaultOnOffClusterServer(onOff));
  }

  /**
   * Get a default level control cluster server.
   *
   * @param currentLevel - The current level (default: 0).
   */
  getDefaultLevelControlClusterServer(currentLevel = 0) {
    return ClusterServer(
      LevelControlCluster.with(LevelControl.Feature.OnOff),
      {
        currentLevel,
        onLevel: 0,
        options: {
          executeIfOff: false,
          coupleColorTempToLevel: false,
        },
      },
      {
        moveToLevel: async ({ request, attributes }) => {
          // eslint-disable-next-line no-console
          console.log('moveToLevel request:', request, 'attributes.currentLevel:', attributes.currentLevel.getLocal());
          //attributes.currentLevel.setLocal(request.level);
          await this.commandHandler.executeHandler('moveToLevel', { request: request, attributes: attributes });
        },
        move: async () => {
          // eslint-disable-next-line no-console
          console.error('Not implemented');
        },
        step: async () => {
          // eslint-disable-next-line no-console
          console.error('Not implemented');
        },
        stop: async () => {
          // eslint-disable-next-line no-console
          console.error('Not implemented');
        },
        moveToLevelWithOnOff: async ({ request, attributes }) => {
          // eslint-disable-next-line no-console
          console.log('moveToLevelWithOnOff request:', request, 'attributes.currentLevel:', attributes.currentLevel.getLocal());
          //attributes.currentLevel.setLocal(request.level);
          await this.commandHandler.executeHandler('moveToLevelWithOnOff', { request: request, attributes: attributes });
        },
        moveWithOnOff: async () => {
          // eslint-disable-next-line no-console
          console.error('Not implemented');
        },
        stepWithOnOff: async () => {
          // eslint-disable-next-line no-console
          console.error('Not implemented');
        },
        stopWithOnOff: async () => {
          // eslint-disable-next-line no-console
          console.error('Not implemented');
        },
      },
    );
  }
  /**
   * Creates a default level control cluster server.
   *
   * @param currentLevel - The current level (default: 0).
   */
  createDefaultLevelControlClusterServer(currentLevel = 0) {
    this.addClusterServer(this.getDefaultLevelControlClusterServer(currentLevel));
  }

  /**
   * Get a default color control cluster server.
   *
   * @param currentHue - The current hue value.
   * @param currentSaturation - The current saturation value.
   * @param colorTemperatureMireds - The color temperature in mireds.
   * @param colorTempPhysicalMinMireds - The physical minimum color temperature in mireds.
   * @param colorTempPhysicalMaxMireds - The physical maximum color temperature in mireds.
   */
  getDefaultColorControlClusterServer(currentHue = 0, currentSaturation = 0, colorTemperatureMireds = 500, colorTempPhysicalMinMireds = 147, colorTempPhysicalMaxMireds = 500) {
    return ClusterServer(
      ColorControlCluster.with(ColorControl.Feature.HueSaturation, ColorControl.Feature.ColorTemperature),
      {
        colorMode: ColorControl.ColorMode.CurrentHueAndCurrentSaturation,
        options: {
          executeIfOff: false,
        },
        numberOfPrimaries: null,
        enhancedColorMode: ColorControl.EnhancedColorMode.CurrentHueAndCurrentSaturation,
        colorCapabilities: { xy: false, hs: true, cl: false, ehue: false, ct: true },
        currentHue,
        currentSaturation,
        colorTemperatureMireds,
        colorTempPhysicalMinMireds,
        colorTempPhysicalMaxMireds,
      },
      {
        moveToHue: async ({ request: request, attributes: attributes }) => {
          // eslint-disable-next-line no-console
          console.log('Command moveToHue request:', request, 'attributes.currentHue:', attributes.currentHue.getLocal());
          //attributes.currentHue.setLocal(request.hue);
          this.commandHandler.executeHandler('moveToHue', { request: request, attributes: attributes });
        },
        moveHue: async () => {
          // eslint-disable-next-line no-console
          console.error('Not implemented');
        },
        stepHue: async () => {
          // eslint-disable-next-line no-console
          console.error('Not implemented');
        },
        moveToSaturation: async ({ request: request, attributes: attributes }) => {
          // eslint-disable-next-line no-console
          console.log('Command moveToSaturation request:', request, 'attributes.currentSaturation:', attributes.currentSaturation.getLocal());
          //attributes.currentSaturation.setLocal(request.saturation);
          this.commandHandler.executeHandler('moveToSaturation', { request: request, attributes: attributes });
        },
        moveSaturation: async () => {
          // eslint-disable-next-line no-console
          console.error('Not implemented');
        },
        stepSaturation: async () => {
          // eslint-disable-next-line no-console
          console.error('Not implemented');
        },
        moveToHueAndSaturation: async ({ request: request, attributes: attributes }) => {
          // eslint-disable-next-line no-console
          console.log('Command moveToHueAndSaturation request:', request, 'attributes.currentHue:', attributes.currentHue.getLocal(), 'attributes.currentSaturation:', attributes.currentSaturation.getLocal());
          //attributes.currentHue.setLocal(request.hue);
          //attributes.currentSaturation.setLocal(request.saturation);
          this.commandHandler.executeHandler('moveToHueAndSaturation', { request: request, attributes: attributes });
        },
        stopMoveStep: async () => {
          // eslint-disable-next-line no-console
          console.error('Not implemented');
        },
        moveToColorTemperature: async ({ request: request, attributes: attributes }) => {
          // eslint-disable-next-line no-console
          console.log('Command moveToColorTemperature request:', request, 'attributes.colorTemperatureMireds:', attributes.colorTemperatureMireds.getLocal());
          //attributes.colorTemperatureMireds.setLocal(request.colorTemperatureMireds);
          this.commandHandler.executeHandler('moveToColorTemperature', { request: request, attributes: attributes });
        },
        moveColorTemperature: async () => {
          // eslint-disable-next-line no-console
          console.error('Not implemented');
        },
        stepColorTemperature: async () => {
          // eslint-disable-next-line no-console
          console.error('Not implemented');
        },
      },
      {},
    );
  }
  /**
   * Creates a default color control cluster server.
   *
   * @param currentHue - The current hue value.
   * @param currentSaturation - The current saturation value.
   * @param colorTemperatureMireds - The color temperature in mireds.
   * @param colorTempPhysicalMinMireds - The physical minimum color temperature in mireds.
   * @param colorTempPhysicalMaxMireds - The physical maximum color temperature in mireds.
   */
  createDefaultColorControlClusterServer(currentHue = 0, currentSaturation = 0, colorTemperatureMireds = 500, colorTempPhysicalMinMireds = 147, colorTempPhysicalMaxMireds = 500) {
    this.addClusterServer(this.getDefaultColorControlClusterServer(currentHue, currentSaturation, colorTemperatureMireds, colorTempPhysicalMinMireds, colorTempPhysicalMaxMireds));
  }

  /**
   * Get a default window covering cluster server.
   *
   * @param positionPercent100ths - The position percentage in 100ths (0-10000). Defaults to 0.
   */
  getDefaultWindowCoveringClusterServer(positionPercent100ths?: number) {
    return ClusterServer(
      WindowCoveringCluster.with(WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift, WindowCovering.Feature.AbsolutePosition),
      {
        type: WindowCovering.WindowCoveringType.Rollershade,
        configStatus: {
          operational: true,
          onlineReserved: true,
          liftMovementReversed: false,
          liftPositionAware: true,
          tiltPositionAware: false,
          liftEncoderControlled: false,
          tiltEncoderControlled: false,
        },
        operationalStatus: { global: WindowCovering.MovementStatus.Stopped, lift: WindowCovering.MovementStatus.Stopped, tilt: WindowCovering.MovementStatus.Stopped },
        endProductType: WindowCovering.EndProductType.RollerShade,
        mode: { motorDirectionReversed: false, calibrationMode: false, maintenanceMode: false, ledFeedback: false },
        targetPositionLiftPercent100ths: positionPercent100ths ?? 0, // 0 Fully open 10000 fully closed
        currentPositionLiftPercent100ths: positionPercent100ths ?? 0, // 0 Fully open 10000 fully closed
        installedClosedLimitLift: 10000,
        installedOpenLimitLift: 0,
      },
      {
        upOrOpen: async (data) => {
          // eslint-disable-next-line no-console
          console.log('upOrOpen');
          await this.commandHandler.executeHandler('upOrOpen', data);
        },
        downOrClose: async (data) => {
          // eslint-disable-next-line no-console
          console.log('downOrClose');
          await this.commandHandler.executeHandler('downOrClose', data);
        },
        stopMotion: async (data) => {
          // eslint-disable-next-line no-console
          console.log('stopMotion');
          await this.commandHandler.executeHandler('stopMotion', data);
        },
        goToLiftPercentage: async (data) => {
          // eslint-disable-next-line no-console
          console.log(
            `goToLiftPercentage: ${data.request.liftPercent100thsValue} current: ${data.attributes.currentPositionLiftPercent100ths?.getLocal()} ` +
              `target: ${data.attributes.targetPositionLiftPercent100ths?.getLocal()} status: ${data.attributes.operationalStatus.getLocal().lift}`,
          );
          await this.commandHandler.executeHandler('goToLiftPercentage', data);
        },
      },
      {},
    );
  }
  /**
   * Creates a default window covering cluster server.
   *
   * @param positionPercent100ths - The position percentage in 100ths (0-10000). Defaults to 0.
   */
  createDefaultWindowCoveringClusterServer(positionPercent100ths?: number) {
    this.addClusterServer(this.getDefaultWindowCoveringClusterServer(positionPercent100ths));
  }

  /**
   * Sets the window covering target position as the current position and stops the movement.
   */
  setWindowCoveringTargetAsCurrentAndStopped() {
    const windowCoveringCluster = this.getClusterServer(WindowCoveringCluster.with(WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift, WindowCovering.Feature.AbsolutePosition));
    if (windowCoveringCluster) {
      const position = windowCoveringCluster.getCurrentPositionLiftPercent100thsAttribute();
      if (position !== null) {
        windowCoveringCluster.setTargetPositionLiftPercent100thsAttribute(position);
        windowCoveringCluster.setOperationalStatusAttribute({
          global: WindowCovering.MovementStatus.Stopped,
          lift: WindowCovering.MovementStatus.Stopped,
          tilt: 0,
        });
      }
      // eslint-disable-next-line no-console
      console.log(`Set WindowCovering initial currentPositionLiftPercent100ths and targetPositionLiftPercent100ths to ${position} and operationalStatus to Stopped.`);
    }
  }

  /**
   * Sets the current and target status of a window covering.
   * @param current - The current position of the window covering.
   * @param target - The target position of the window covering.
   * @param status - The movement status of the window covering.
   */
  setWindowCoveringCurrentTargetStatus(current: number, target: number, status: WindowCovering.MovementStatus) {
    const windowCoveringCluster = this.getClusterServer(WindowCoveringCluster.with(WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift, WindowCovering.Feature.AbsolutePosition));
    if (windowCoveringCluster) {
      windowCoveringCluster.setCurrentPositionLiftPercent100thsAttribute(current);
      windowCoveringCluster.setTargetPositionLiftPercent100thsAttribute(target);
      windowCoveringCluster.setOperationalStatusAttribute({
        global: status,
        lift: status,
        tilt: 0,
      });
    }
    // eslint-disable-next-line no-console
    console.log(`Set WindowCovering currentPositionLiftPercent100ths: ${current}, targetPositionLiftPercent100ths: ${target} and operationalStatus: ${status}.`);
  }

  /**
   * Sets the status of the window covering.
   * @param {WindowCovering.MovementStatus} status - The movement status to set.
   */
  setWindowCoveringStatus(status: WindowCovering.MovementStatus) {
    const windowCovering = this.getClusterServer(WindowCoveringCluster.with(WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift, WindowCovering.Feature.AbsolutePosition));
    if (!windowCovering) return;
    windowCovering.setOperationalStatusAttribute({ global: status, lift: status, tilt: 0 });
    // eslint-disable-next-line no-console
    console.log(`Set WindowCovering operationalStatus: ${status}`);
  }

  /**
   * Retrieves the status of the window covering.
   * @returns The global operational status of the window covering.
   */
  getWindowCoveringStatus() {
    const windowCovering = this.getClusterServer(WindowCoveringCluster.with(WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift, WindowCovering.Feature.AbsolutePosition));
    if (!windowCovering) return undefined;
    const status = windowCovering.getOperationalStatusAttribute();
    // eslint-disable-next-line no-console
    console.log(`Get WindowCovering operationalStatus: ${status.global}`);
    return status.global;
  }

  /**
   * Sets the target and current position of the window covering.
   *
   * @param position - The position to set, specified as a number.
   */
  setWindowCoveringTargetAndCurrentPosition(position: number) {
    const windowCovering = this.getClusterServer(WindowCoveringCluster.with(WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift));
    if (!windowCovering) return;
    windowCovering.setCurrentPositionLiftPercent100thsAttribute(position);
    windowCovering.setTargetPositionLiftPercent100thsAttribute(position);
    // eslint-disable-next-line no-console
    console.log(`Set WindowCovering currentPositionLiftPercent100ths: ${position} and targetPositionLiftPercent100ths: ${position}.`);
  }

  /**
   * Get a default door lock cluster server.
   *
   * @remarks
   * This method adds a cluster server for a door lock cluster with default settings.
   *
   */
  getDefaultDoorLockClusterServer(lockState = DoorLock.LockState.Locked, lockType = DoorLock.LockType.Deadbolt) {
    return ClusterServer(
      DoorLockCluster,
      {
        operatingMode: DoorLock.OperatingMode.Normal,
        lockState,
        lockType,
        actuatorEnabled: false,
        supportedOperatingModes: { normal: true, vacation: false, privacy: false, noRemoteLockUnlock: false, passage: false },
      },
      {
        lockDoor: async (data) => {
          // eslint-disable-next-line no-console
          console.log('lockDoor', data.request);
          await this.commandHandler.executeHandler('lockDoor', data);
        },
        unlockDoor: async (data) => {
          // eslint-disable-next-line no-console
          console.log('unlockDoor', data.request);
          await this.commandHandler.executeHandler('unlockDoor', data);
        },
      },
      {
        doorLockAlarm: true,
        lockOperation: true,
        lockOperationError: true,
      },
    );
  }
  /**
   * Creates a default door lock cluster server.
   *
   * @remarks
   * This method adds a cluster server for a door lock cluster with default settings.
   *
   */
  createDefaultDoorLockClusterServer(lockState = DoorLock.LockState.Locked, lockType = DoorLock.LockType.Deadbolt) {
    this.addClusterServer(this.getDefaultDoorLockClusterServer(lockState, lockType));
  }

  /**
   * Get a default switch cluster server.
   *
   * @remarks
   * This method adds a cluster server with default switch features and configurations.
   */
  getDefaultSwitchClusterServer() {
    return ClusterServer(
      SwitchCluster.with(Switch.Feature.MomentarySwitch, Switch.Feature.MomentarySwitchRelease, Switch.Feature.MomentarySwitchLongPress, Switch.Feature.MomentarySwitchMultiPress),
      {
        numberOfPositions: 2,
        currentPosition: 0,
        multiPressMax: 2,
      },
      {},
      {
        initialPress: true,
        longPress: true,
        shortRelease: true,
        longRelease: true,
        multiPressOngoing: true,
        multiPressComplete: true,
      },
    );
  }
  /**
   * Creates a default switch cluster server.
   *
   * @remarks
   * This method adds a cluster server with default switch features and configurations.
   */
  createDefaultSwitchClusterServer() {
    this.addClusterServer(this.getDefaultSwitchClusterServer());
    this.addFixedLabel('orientation', 'Switch');
    this.addFixedLabel('label', 'Switch');
  }

  /**
   * Get a default occupancy sensing cluster server.
   *
   * @param occupied - A boolean indicating whether the occupancy is occupied or not. Default is false.
   */
  getDefaultOccupancySensingClusterServer(occupied = false) {
    return ClusterServer(
      OccupancySensingCluster,
      {
        occupancy: { occupied },
        occupancySensorType: OccupancySensing.OccupancySensorType.Pir,
        occupancySensorTypeBitmap: { pir: true, ultrasonic: false, physicalContact: false },
        pirOccupiedToUnoccupiedDelay: 30,
      },
      {},
    );
  }
  /**
   * Creates a default occupancy sensing cluster server.
   *
   * @param occupied - A boolean indicating whether the occupancy is occupied or not. Default is false.
   */
  createDefaultOccupancySensingClusterServer(occupied = false) {
    this.addClusterServer(this.getDefaultOccupancySensingClusterServer(occupied));
  }

  /**
   * Get a default Illuminance Measurement Cluster Server.
   *
   * @param measuredValue - The measured value of illuminance.
   */
  getDefaultIlluminanceMeasurementClusterServer(measuredValue: number = 0) {
    return ClusterServer(
      IlluminanceMeasurementCluster,
      {
        measuredValue,
        minMeasuredValue: null,
        maxMeasuredValue: null,
        tolerance: 0,
      },
      {},
      {},
    );
  }
  /**
   * Creates a default Illuminance Measurement Cluster Server.
   *
   * @param measuredValue - The measured value of illuminance.
   */
  createDefaultIlluminanceMeasurementClusterServer(measuredValue: number = 0) {
    this.addClusterServer(this.getDefaultIlluminanceMeasurementClusterServer(measuredValue));
  }

  /**
   * Get a default flow measurement cluster server.
   *
   * @param measuredValue - The measured value of the temperature.
   */
  getDefaultFlowMeasurementClusterServer(measuredValue: number = 0) {
    return ClusterServer(
      FlowMeasurementCluster,
      {
        measuredValue,
        minMeasuredValue: null,
        maxMeasuredValue: null,
        tolerance: 0,
      },
      {},
      {},
    );
  }

  /**
   * Creates a default flow measurement cluster server.
   *
   * @param measuredValue - The measured value of the temperature.
   */
  createDefaultFlowMeasurementClusterServer(measuredValue: number = 0) {
    this.addClusterServer(this.getDefaultFlowMeasurementClusterServer(measuredValue));
  }

  /**
   * Get a default temperature measurement cluster server.
   *
   * @param measuredValue - The measured value of the temperature.
   */
  getDefaultTemperatureMeasurementClusterServer(measuredValue: number = 0) {
    return ClusterServer(
      TemperatureMeasurementCluster,
      {
        measuredValue,
        minMeasuredValue: null,
        maxMeasuredValue: null,
        tolerance: 0,
      },
      {},
      {},
    );
  }

  /**
   * Creates a default temperature measurement cluster server.
   *
   * @param measuredValue - The measured value of the temperature.
   */
  createDefaultTemperatureMeasurementClusterServer(measuredValue: number = 0) {
    this.addClusterServer(this.getDefaultTemperatureMeasurementClusterServer(measuredValue));
  }

  /**
   * Get a default RelativeHumidityMeasurementCluster server.
   *
   * @param measuredValue - The measured value of the relative humidity.
   */
  getDefaultRelativeHumidityMeasurementClusterServer(measuredValue: number = 0) {
    return ClusterServer(
      RelativeHumidityMeasurementCluster,
      {
        measuredValue,
        minMeasuredValue: null,
        maxMeasuredValue: null,
        tolerance: 0,
      },
      {},
      {},
    );
  }
  /**
   * Creates a default RelativeHumidityMeasurementCluster server.
   *
   * @param measuredValue - The measured value of the relative humidity.
   */
  createDefaultRelativeHumidityMeasurementClusterServer(measuredValue: number = 0) {
    this.addClusterServer(this.getDefaultRelativeHumidityMeasurementClusterServer(measuredValue));
  }

  /**
   * Get a default Pressure Measurement Cluster Server.
   *
   * @param measuredValue - The measured value for the pressure.
   */
  getDefaultPressureMeasurementClusterServer(measuredValue: number = 1000) {
    return ClusterServer(
      PressureMeasurementCluster,
      {
        measuredValue,
        minMeasuredValue: null,
        maxMeasuredValue: null,
        tolerance: 0,
      },
      {},
      {},
    );
  }
  /**
   * Creates a default Pressure Measurement Cluster Server.
   *
   * @param measuredValue - The measured value for the pressure.
   */
  createDefaultPressureMeasurementClusterServer(measuredValue: number = 1000) {
    this.addClusterServer(this.getDefaultPressureMeasurementClusterServer(measuredValue));
  }

  /**
   * Get a default boolean state cluster server.
   *
   * @param contact - Optional boolean value indicating the contact state. Defaults to `true` if not provided.
   */
  getDefaultBooleanStateClusterServer(contact?: boolean) {
    return ClusterServer(
      BooleanStateCluster,
      {
        stateValue: contact ?? true, // true=contact false=no_contact
      },
      {},
      {
        stateChange: true,
      },
    );
  }

  /**
   * Creates a default boolean state cluster server.
   *
   * @param contact - Optional boolean value indicating the contact state. Defaults to `true` if not provided.
   */
  createDefaultBooleanStateClusterServer(contact?: boolean) {
    this.addClusterServer(this.getDefaultBooleanStateClusterServer(contact));
  }

  /**
   * Creates a default power source replaceable battery cluster server.
   *
   * @param batPercentRemaining - The remaining battery percentage (default: 100).
   * @param batChargeLevel - The battery charge level (default: PowerSource.BatChargeLevel.Ok).
   * @param batVoltage - The battery voltage (default: 1500).
   * @param batReplacementDescription - The battery replacement description (default: 'Battery type').
   * @param batQuantity - The battery quantity (default: 1).
   */
  createDefaultPowerSourceReplaceableBatteryClusterServer(
    batPercentRemaining: number = 100,
    batChargeLevel: PowerSource.BatChargeLevel = PowerSource.BatChargeLevel.Ok,
    batVoltage: number = 1500,
    batReplacementDescription: string = 'Battery type',
    batQuantity: number = 1,
  ) {
    this.addClusterServer(
      ClusterServer(
        PowerSourceCluster.with(PowerSource.Feature.Battery, PowerSource.Feature.Replaceable),
        {
          status: PowerSource.PowerSourceStatus.Active,
          order: 0,
          description: 'Primary battery',
          batVoltage,
          batPercentRemaining: Math.min(Math.max(batPercentRemaining * 2, 0), 200),
          batChargeLevel,
          batReplacementNeeded: false,
          batReplaceability: PowerSource.BatReplaceability.UserReplaceable,
          activeBatFaults: undefined,
          batReplacementDescription,
          batQuantity,
        },
        {},
        {},
      ),
    );
  }

  /**
   * Creates a default power source rechargeable battery cluster server.
   *
   * @param batPercentRemaining - The remaining battery percentage (default: 100).
   * @param batChargeLevel - The battery charge level (default: PowerSource.BatChargeLevel.Ok).
   * @param batVoltage - The battery voltage (default: 1500).
   */
  createDefaultPowerSourceRechargeableBatteryClusterServer(batPercentRemaining: number = 100, batChargeLevel: PowerSource.BatChargeLevel = PowerSource.BatChargeLevel.Ok, batVoltage: number = 1500) {
    this.addClusterServer(
      ClusterServer(
        PowerSourceCluster.with(PowerSource.Feature.Battery, PowerSource.Feature.Rechargeable),
        {
          status: PowerSource.PowerSourceStatus.Active,
          order: 0,
          description: 'Primary battery',
          batVoltage,
          batPercentRemaining: Math.min(Math.max(batPercentRemaining * 2, 0), 200),
          batTimeRemaining: 1,
          batChargeLevel,
          batReplacementNeeded: false,
          batReplaceability: PowerSource.BatReplaceability.Unspecified,
          activeBatFaults: undefined,
          batChargeState: PowerSource.BatChargeState.IsNotCharging,
          batFunctionalWhileCharging: true,
        },
        {},
        {},
      ),
    );
  }

  /**
   * Creates a default power source wired cluster server.
   *
   * @param wiredCurrentType - The type of wired current (default: PowerSource.WiredCurrentType.Ac)
   */
  createDefaultPowerSourceWiredClusterServer(wiredCurrentType: PowerSource.WiredCurrentType = PowerSource.WiredCurrentType.Ac) {
    this.addClusterServer(
      ClusterServer(
        PowerSourceCluster.with(PowerSource.Feature.Wired),
        {
          wiredCurrentType,
          description: wiredCurrentType === PowerSource.WiredCurrentType.Ac ? 'AC Power' : 'DC Power',
          status: PowerSource.PowerSourceStatus.Active,
          order: 0,
        },
        {},
        {},
      ),
    );
  }

  /**
   * Creates a default power source configuration cluster server.
   *
   * @remarks
   * The endpoint at this time is only known for Accessory Platforms.
   * Don't use it in Dynamic Platforms.
   *
   *
   * @param endpointNumber - The endpoint number where to find the PowerSourceCluster.
   */
  createDefaultPowerSourceConfigurationClusterServer(endpointNumber?: number) {
    this.addClusterServer(
      ClusterServer(
        PowerSourceConfigurationCluster,
        {
          sources: endpointNumber ? [EndpointNumber(endpointNumber)] : [],
        },
        {},
        {},
      ),
    );
  }

  /**
   * Get a default air quality cluster server.
   *
   * @param airQuality The air quality type. Defaults to `AirQuality.AirQualityType.Unknown`.
   */
  getDefaultAirQualityClusterServer(airQuality = AirQuality.AirQualityType.Unknown) {
    return ClusterServer(
      AirQualityCluster.with(AirQuality.Feature.FairAirQuality, AirQuality.Feature.ModerateAirQuality, AirQuality.Feature.VeryPoorAirQuality),
      {
        airQuality,
      },
      {},
      {},
    );
  }
  /**
   * Creates a default air quality cluster server.
   *
   * @param airQuality The air quality type. Defaults to `AirQuality.AirQualityType.Unknown`.
   */
  createDefaultAirQualityClusterServer(airQuality = AirQuality.AirQualityType.Unknown) {
    this.addClusterServer(this.getDefaultAirQualityClusterServer(airQuality));
  }

  /**
   * Get a default TVOC measurement cluster server.
   *
   * @param measuredValue - The measured value for TVOC.
   */
  getDefaultTvocMeasurementClusterServer(measuredValue: number = 0) {
    return ClusterServer(
      TvocMeasurementCluster.with(TvocMeasurement.Feature.NumericMeasurement),
      {
        measuredValue,
        minMeasuredValue: null,
        maxMeasuredValue: null,
      },
      {},
      {},
    );
  }
  /**
   * Creates a default TVOC measurement cluster server.
   *
   * @param measuredValue - The measured value for TVOC.
   */
  createDefaultTvocMeasurementClusterServer(measuredValue: number = 0) {
    this.addClusterServer(this.getDefaultTvocMeasurementClusterServer(measuredValue));
  }

  /**
   * Get a default thermostat cluster server with the specified parameters.
   *
   * @param localTemperature - The local temperature value in degrees Celsius. Defaults to 23.
   * @param occupiedHeatingSetpoint - The occupied heating setpoint value in degrees Celsius. Defaults to 21.
   * @param occupiedCoolingSetpoint - The occupied cooling setpoint value in degrees Celsius. Defaults to 25.
   * @param minSetpointDeadBand - The minimum setpoint dead band value.
   */
  getDefaultThermostatClusterServer(localTemperature: number = 23, occupiedHeatingSetpoint: number = 21, occupiedCoolingSetpoint: number = 25, minSetpointDeadBand: number = 1) {
    return ClusterServer(
      ThermostatCluster.with(Thermostat.Feature.Heating, Thermostat.Feature.Cooling, Thermostat.Feature.AutoMode),
      {
        localTemperature: localTemperature * 100,
        occupiedHeatingSetpoint: occupiedHeatingSetpoint * 100,
        occupiedCoolingSetpoint: occupiedCoolingSetpoint * 100,
        minHeatSetpointLimit: 0,
        maxHeatSetpointLimit: 5000,
        absMinHeatSetpointLimit: 0,
        absMaxHeatSetpointLimit: 5000,
        minCoolSetpointLimit: 0,
        maxCoolSetpointLimit: 5000,
        absMinCoolSetpointLimit: 0,
        absMaxCoolSetpointLimit: 5000,
        minSetpointDeadBand,
        systemMode: Thermostat.SystemMode.Off,
        controlSequenceOfOperation: Thermostat.ControlSequenceOfOperation.CoolingAndHeating,
        thermostatRunningMode: Thermostat.ThermostatRunningMode.Off,
      },
      {
        setpointRaiseLower: async ({ request, attributes }) => {
          // eslint-disable-next-line no-console
          console.log('setpointRaiseLower', request);
          await this.commandHandler.executeHandler('setpointRaiseLower', { request, attributes });
        },
      },
      {},
    );
  }

  /**
   * Creates and adds a default thermostat cluster server to the device.
   *
   * @param localTemperature - The local temperature value.
   * @param occupiedHeatingSetpoint - The occupied heating setpoint value.
   * @param occupiedCoolingSetpoint - The occupied cooling setpoint value.
   * @param minSetpointDeadBand - The minimum setpoint dead band value.
   */
  createDefaultThermostatClusterServer(localTemperature: number = 23, occupiedHeatingSetpoint: number = 21, occupiedCoolingSetpoint: number = 25, minSetpointDeadBand: number = 1) {
    this.addClusterServer(this.getDefaultThermostatClusterServer(localTemperature, occupiedHeatingSetpoint, occupiedCoolingSetpoint, minSetpointDeadBand));
  }

  /**
   * Get a default time sync cluster server. Only needed to create a thermostat.
   */
  getDefaultTimeSyncClusterServer() {
    return ClusterServer(
      TimeSyncCluster.with(TimeSync.Feature.TimeZone),
      {
        utcTime: null,
        granularity: TimeSync.Granularity.NoTimeGranularity,
        timeZone: [{ offset: 0, validAt: 0 }],
        trustedTimeNodeId: null,
        dstOffset: [],
        localTime: null,
        timeZoneDatabase: true,
      },
      {
        setUtcTime: async ({ request, attributes }) => {
          // eslint-disable-next-line no-console
          console.log('setUtcTime', request);
          await this.commandHandler.executeHandler('setUtcTime', { request, attributes });
        },
      },
      {
        dstTableEmpty: true,
        dstStatus: true,
        timeZoneStatus: true,
      },
    );
  }
  /**
   * Creates a default time sync cluster server. Only needed to create a thermostat.
   */
  createDefaultTimeSyncClusterServer() {
    this.addClusterServer(this.getDefaultTimeSyncClusterServer());
  }
}
