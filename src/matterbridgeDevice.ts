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
  BooleanStateCluster,
  BridgedDeviceBasicInformationCluster,
  ClusterServer,
  ClusterServerHandlers,
  ColorControl,
  ElectricalMeasurementCluster,
  Groups,
  Identify,
  IdentifyCluster,
  IlluminanceMeasurementCluster,
  LevelControl,
  OccupancySensing,
  OccupancySensingCluster,
  OnOff,
  OnOffCluster,
  PowerSource,
  PowerSourceCluster,
  PowerSourceConfigurationCluster,
  PressureMeasurementCluster,
  RelativeHumidityMeasurement,
  RelativeHumidityMeasurementCluster,
  Scenes,
  TemperatureMeasurement,
  TemperatureMeasurementCluster,
  ThreadNetworkDiagnostics,
  ThreadNetworkDiagnosticsCluster,
  WindowCovering,
  WindowCoveringCluster,
  createDefaultGroupsClusterServer,
  createDefaultScenesClusterServer,
} from '@project-chip/matter-node.js/cluster';
import { ClusterId, EndpointNumber, VendorId } from '@project-chip/matter-node.js/datatype';
import { Device, DeviceClasses, DeviceTypeDefinition, EndpointOptions } from '@project-chip/matter-node.js/device';
import { AtLeastOne, extendPublicHandlerMethods } from '@project-chip/matter-node.js/util';

import { MatterHistory, Sensitivity, EveHistoryCluster, WeatherTrend, TemperatureDisplayUnits } from 'matter-history';

import { AirQuality, AirQualityCluster } from './AirQualityCluster.js';
import { AnsiLogger } from 'node-ansi-logger';
import { createHash } from 'crypto';
import { TvocMeasurement, TvocMeasurementCluster } from './TvocCluster.js';

type MakeMandatory<T> = Exclude<T, undefined>;

type MatterbridgeDeviceCommands = {
  identify: MakeMandatory<ClusterServerHandlers<typeof Identify.Cluster>['identify']>;

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
  serialNumber: string;
  deviceName: string;
  uniqueId: string;
  deviceType: AtLeastOne<DeviceTypeDefinition>;
  endpointName: string;
  clusterServersId: ClusterId[];
}

export class MatterbridgeDevice extends extendPublicHandlerMethods<typeof Device, MatterbridgeDeviceCommands>(Device) {
  public static bridgeMode = '';
  serialNumber: string | undefined = undefined;
  deviceName: string | undefined = undefined;
  uniqueId: string | undefined = undefined;

  constructor(definition: DeviceTypeDefinition, options: EndpointOptions = {}) {
    super(definition, options);
  }

  addDeviceType(deviceType: DeviceTypeDefinition) {
    const deviceTypes = this.getDeviceTypes();
    deviceTypes.push(deviceType);
    this.setDeviceTypes(deviceTypes);
  }

  serialize(pluginName: string) {
    const serialized: SerializedMatterbridgeDevice = {
      pluginName,
      serialNumber: this.serialNumber!,
      deviceName: this.deviceName!,
      uniqueId: this.uniqueId!,
      deviceType: this.getDeviceTypes(),
      endpointName: this.name,
      clusterServersId: [],
    };
    this.getAllClusterServers().forEach((clusterServer) => {
      serialized.clusterServersId.push(clusterServer.id);
    });
    return serialized;
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
        EveHistoryCluster,
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
        EveHistoryCluster,
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
          LastPressure: 1000,
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
        EveHistoryCluster,
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
        EveHistoryCluster,
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
        EveHistoryCluster,
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
   * Creates a default IdentifyCluster server.
   */
  createDefaultIdentifyClusterServer() {
    this.addClusterServer(
      ClusterServer(
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
      ),
    );
  }

  /**
   * Creates a default groups cluster server and adds it to the device.
   */
  createDefaultGroupsClusterServer() {
    this.addClusterServer(createDefaultGroupsClusterServer());
  }

  /**
   * Creates a default scenes cluster server and adds it to the current instance.
   */
  createDefaultScenesClusterServer() {
    this.addClusterServer(createDefaultScenesClusterServer());
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
    softwareVersionString = 'v.1.0.0',
    hardwareVersion = 1,
    hardwareVersionString = 'v.1.0.0',
  ) {
    this.deviceName = deviceName;
    this.serialNumber = serialNumber;
    this.uniqueId = this.createUniqueId(deviceName, serialNumber, vendorName, productName);
    if (MatterbridgeDevice.bridgeMode === 'bridge') {
      this.createDefaultBridgedDeviceBasicInformationClusterServer(
        deviceName,
        serialNumber,
        vendorId,
        vendorName,
        productName,
        softwareVersion,
        softwareVersionString,
        hardwareVersion,
        hardwareVersionString,
      );
      return;
    }
    this.addClusterServer(
      ClusterServer(
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
      ),
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
    softwareVersionString = 'v.1.0.0',
    hardwareVersion = 1,
    hardwareVersionString = 'v.1.0.0',
  ) {
    this.deviceName = deviceName;
    this.serialNumber = serialNumber;
    this.uniqueId = this.createUniqueId(deviceName, serialNumber, vendorName, productName);
    this.addClusterServer(
      ClusterServer(
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
      ),
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
    this.addClusterServer(
      ClusterServer(
        ElectricalMeasurementCluster,
        {
          rmsVoltage: voltage,
          rmsCurrent: current,
          activePower: power,
          totalActivePower: consumption,
        },
        {},
        {},
      ),
    );
  }

  /**
   * Creates a default Thread Network Diagnostics Cluster server.
   *
   * @remarks
   * This method adds a cluster server used only to give the networkName to Eve app.
   *
   * @returns void
   */
  createDefaultThreadNetworkDiagnosticsClusterServer() {
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
   * Creates a default OnOff cluster server.
   *
   * @param onOff - The initial state of the OnOff cluster (default: false).
   */
  createDefaultOnOffClusterServer(onOff = false) {
    this.addClusterServer(
      ClusterServer(
        OnOffCluster,
        {
          onOff,
        },
        {
          on: async (data) => {
            // eslint-disable-next-line no-console
            console.log('on');
            await this.commandHandler.executeHandler('on', data);
          },
          off: async (data) => {
            // eslint-disable-next-line no-console
            console.log('off');
            await this.commandHandler.executeHandler('off', data);
          },
          toggle: async (data) => {
            // eslint-disable-next-line no-console
            console.log('toggle');
            await this.commandHandler.executeHandler('toggle', data);
          },
        },
        {},
      ),
    );
  }

  /**
   * Creates a default window covering cluster server.
   *
   * @param positionPercent100ths - The position percentage in 100ths (0-10000). Defaults to 0.
   */
  createDefaultWindowCoveringClusterServer(positionPercent100ths?: number) {
    this.addClusterServer(
      ClusterServer(
        WindowCoveringCluster.with(WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift),
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
                `target: ${data.attributes.targetPositionLiftPercent100ths?.getLocal()}`,
            );
            await this.commandHandler.executeHandler('goToLiftPercentage', data);
          },
        },
        {},
      ),
    );
  }

  /**
   * Creates a default occupancy sensing cluster server.
   *
   * @param occupied - A boolean indicating whether the occupancy is occupied or not. Default is false.
   */
  createDefaultOccupancySensingClusterServer(occupied = false) {
    this.addClusterServer(
      ClusterServer(
        OccupancySensingCluster,
        {
          occupancy: { occupied },
          occupancySensorType: OccupancySensing.OccupancySensorType.Pir,
          occupancySensorTypeBitmap: { pir: true, ultrasonic: false, physicalContact: false },
          pirOccupiedToUnoccupiedDelay: 30,
        },
        {},
      ),
    );
  }

  /**
   * Creates a default Illuminance Measurement Cluster Server.
   *
   * @param measuredValue - The measured value of illuminance.
   */
  createDefaultIlluminanceMeasurementClusterServer(measuredValue: number = 0) {
    this.addClusterServer(
      ClusterServer(
        IlluminanceMeasurementCluster,
        {
          measuredValue,
          minMeasuredValue: null,
          maxMeasuredValue: null,
          tolerance: 0,
        },
        {},
        {},
      ),
    );
  }

  /**
   * Creates a default temperature measurement cluster server.
   *
   * @param measuredValue - The measured value of the temperature.
   */
  createDefaultTemperatureMeasurementClusterServer(measuredValue: number = 0) {
    this.addClusterServer(
      ClusterServer(
        TemperatureMeasurementCluster,
        {
          measuredValue,
          minMeasuredValue: null,
          maxMeasuredValue: null,
          tolerance: 0,
        },
        {},
        {},
      ),
    );
  }

  /**
   * Creates a default RelativeHumidityMeasurementCluster server.
   *
   * @param measuredValue - The measured value of the relative humidity.
   */
  createDefaultRelativeHumidityMeasurementClusterServer(measuredValue: number = 0) {
    this.addClusterServer(
      ClusterServer(
        RelativeHumidityMeasurementCluster,
        {
          measuredValue,
          minMeasuredValue: null,
          maxMeasuredValue: null,
          tolerance: 0,
        },
        {},
        {},
      ),
    );
  }

  /**
   * Creates a default Pressure Measurement Cluster Server.
   *
   * @param measuredValue - The measured value for the pressure.
   */
  createDefaultPressureMeasurementClusterServer(measuredValue: number = 1000) {
    this.addClusterServer(
      ClusterServer(
        PressureMeasurementCluster,
        {
          measuredValue,
          minMeasuredValue: null,
          maxMeasuredValue: null,
          tolerance: 0,
        },
        {},
        {},
      ),
    );
  }

  /**
   * Creates a default boolean state cluster server.
   *
   * @param contact - Optional boolean value indicating the contact state. Defaults to `true` if not provided.
   */
  createDefaultBooleanStateClusterServer(contact?: boolean) {
    this.addClusterServer(
      ClusterServer(
        BooleanStateCluster,
        {
          stateValue: contact ?? true, // true=contact false=no_contact
        },
        {},
        {
          stateChange: true,
        },
      ),
    );
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
  createDefaultPowerSourceRechargableBatteryClusterServer(batPercentRemaining: number = 100, batChargeLevel: PowerSource.BatChargeLevel = PowerSource.BatChargeLevel.Ok, batVoltage: number = 1500) {
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
  createDefaultPowerSourceConfigurationClusterServer(endpointNumber: number) {
    this.addClusterServer(
      ClusterServer(
        PowerSourceConfigurationCluster,
        {
          sources: [EndpointNumber(endpointNumber)],
        },
        {},
        {},
      ),
    );
  }

  /**
   * Creates a default air quality cluster server.
   *
   * @param airQuality The air quality type. Defaults to `AirQuality.AirQualityType.Unknown`.
   */
  createDefaultAirQualityClusterServer(airQuality = AirQuality.AirQualityType.Unknown) {
    this.addClusterServer(
      ClusterServer(
        AirQualityCluster.with(AirQuality.Feature.FairAirQuality, AirQuality.Feature.ModerateAirQuality, AirQuality.Feature.VeryPoorAirQuality),
        {
          airQuality,
        },
        {},
        {},
      ),
    );
  }

  /**
   * Creates a default TVOC measurement cluster server.
   *
   * @param measuredValue - The measured value for TVOC.
   */
  createDefaultTvocMeasurementClusterServer(measuredValue: number = 0) {
    this.addClusterServer(
      ClusterServer(
        TvocMeasurementCluster.with(TvocMeasurement.Feature.NumericMeasurement),
        {
          measuredValue,
          minMeasuredValue: null,
          maxMeasuredValue: null,
        },
        {},
        {},
      ),
    );
  }
}
