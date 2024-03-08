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

/* eslint-disable max-len */
/* eslint-disable no-console */
import {
  BasicInformationCluster,
  BooleanStateCluster,
  BridgedDeviceBasicInformationCluster,
  ClusterServer,
  ClusterServerHandlers,
  ColorControl,
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
import { EndpointNumber, VendorId } from '@project-chip/matter-node.js/datatype';
import { Device, DeviceClasses, DeviceTypeDefinition, EndpointOptions } from '@project-chip/matter-node.js/device';
import { extendPublicHandlerMethods } from '@project-chip/matter-node.js/util';

import { MatterHistory, Sensitivity, EveHistoryCluster } from 'matter-history';

import { AirQuality, AirQualityCluster } from './AirQualityCluster.js';
import { AnsiLogger } from 'node-ansi-logger';
import { createHash } from 'crypto';

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
  optionalServerClusters: [TemperatureMeasurement.Cluster.id, RelativeHumidityMeasurement.Cluster.id],
});

export class MatterbridgeDevice extends extendPublicHandlerMethods<typeof Device, MatterbridgeDeviceCommands>(Device) {
  constructor(definition: DeviceTypeDefinition, options: EndpointOptions = {}) {
    super(definition, options);
  }

  addDeviceType(deviceType: DeviceTypeDefinition) {
    const deviceTypes = this.getDeviceTypes();
    deviceTypes.push(deviceType);
    this.setDeviceTypes(deviceTypes);
  }

  /*
  removeClusterServer<A extends Attributes, E extends Events>(cluster: ClusterServerObj<A, E>) {
    const currentCluster = this.clusterServers.get(cluster.id);
    if (currentCluster !== undefined) {
        asClusterServerInternal(currentCluster)._destroy();
    }
  }
  */

  /*
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // attributeInitialValues?: { [key: ClusterId]: AttributeInitialValues<any> },
  
  createDefaultEveHistoryClusterServer(matterType: string) {
    this.matterType = matterType;
    let attributesInitialValues: AttributeInitialValues<typeof EveHistoryCluster.attributes>;
    if (this.matterType === 'energy') {
      this.configData = Buffer.from(
        '0001500b0200000302fb19040c525631354d314d30363931389c0100ff04010200b4f90101600164d00400000000450505000000004609050000000e000042064906050c081080014411051c0005033c00000075df36428199de404711052a21fc2196226823780000003c00000048060500000000004a06050000000000',
        'hex',
      );
      attributesInitialValues = {
        ConfigDataGet: Uint8Array.fromHex(''),
        ConfigDataSet: Uint8Array.fromHex(''),
        HistoryStatus: Uint8Array.fromHex(''),
        HistoryEntries: Uint8Array.fromHex(''),
        HistoryRequest: Uint8Array.fromHex(''),
        HistorySetTime: Uint8Array.fromHex(''),
        LastEvent: 0,
        Voltage: 220,
        Current: 1,
        Consumption: 2,
        TotalConsumption: 3,
        EnergyUnknown: 1,
        ResetTotal: 0,
        ChildLock: false,
        RLoc: 46080,
      };
    } else if (this.matterType === 'motion') {
      this.configData = Buffer.from('0001590b0200000302fa19040c5a5633384c314131313937349c0100ff040102012cf901017001017102090072040000ffff', 'hex');
      attributesInitialValues = {
        ConfigDataGet: Uint8Array.fromHex(''),
        ConfigDataSet: Uint8Array.fromHex(''),
        HistoryStatus: Uint8Array.fromHex(''),
        HistoryEntries: Uint8Array.fromHex(''),
        HistoryRequest: Uint8Array.fromHex(''),
        HistorySetTime: Uint8Array.fromHex(''),
        LastEvent: 0,
        MotionSensitivity: Sensitivity.HIGH,
        RLoc: 46080,
      };
    } else if (this.matterType === 'door') {
      this.configData = Buffer.from('00014d0b0200000302fa19040c515632324d314d30313139329c0100ff04010207c4f90101', 'hex');
      attributesInitialValues = {
        ConfigDataGet: Uint8Array.fromHex(''),
        ConfigDataSet: Uint8Array.fromHex(''),
        HistoryStatus: Uint8Array.fromHex(''),
        HistoryEntries: Uint8Array.fromHex(''),
        HistoryRequest: Uint8Array.fromHex(''),
        HistorySetTime: Uint8Array.fromHex(''),
        TimesOpened: this.getTimesOpened(),
        LastEvent: 0,
        ResetTotal: 0,
        RLoc: 46080,
      };
    } else if (this.matterType === 'weather') {
      this.configData = Buffer.from('0001010b0200000302fa19040c515632324d314d30313139329c0100ff04010207c4f901014b04ffffffff', 'hex'); //From door but 01
      attributesInitialValues = {
        ConfigDataGet: Uint8Array.fromHex(''),
        ConfigDataSet: Uint8Array.fromHex(''),
        HistoryStatus: Uint8Array.fromHex(''),
        HistoryEntries: Uint8Array.fromHex(''),
        HistoryRequest: Uint8Array.fromHex(''),
        HistorySetTime: Uint8Array.fromHex(''),
        RLoc: 46080,
        Elevation: 150, // on Weather
        LastPressure: 999, // on Weather in the summary
        WeatherTrend: WeatherTrend.SUN,
        TemperatureDisplayUnits: TemperatureDisplayUnits.CELSIUS,
      };
    } else if (this.matterType === 'room') {
      this.configData = Buffer.from('0001020b0200000302fa19040c515632324d314d30313139329c0100ff04010207c4f90101', 'hex'); //From door but 02
      attributesInitialValues = {
        ConfigDataGet: Uint8Array.fromHex(''),
        ConfigDataSet: Uint8Array.fromHex(''),
        HistoryStatus: Uint8Array.fromHex(''),
        HistoryEntries: Uint8Array.fromHex(''),
        HistoryRequest: Uint8Array.fromHex(''),
        HistorySetTime: Uint8Array.fromHex(''),
        RLoc: 46080,
      };
    } else {
      this.log.error('MatterHistory error: matterType not found!');
      this.configData = Buffer.from('00014d0b0200000302fa19040c515632324d314d30313139329c0100ff04010207c4f90101', 'hex');
      attributesInitialValues = {
        ConfigDataGet: Uint8Array.fromHex(''),
        ConfigDataSet: Uint8Array.fromHex(''),
        HistoryStatus: Uint8Array.fromHex(''),
        HistoryEntries: Uint8Array.fromHex(''),
        HistoryRequest: Uint8Array.fromHex(''),
        HistorySetTime: Uint8Array.fromHex(''),
        TimesOpened: this.getTimesOpened(),
        LastEvent: 0,
        ResetTotal: 0,
        RLoc: 46080,
      };
    }
    const eveHistoryCluster = ClusterServer(
      EveHistoryCluster,
      attributesInitialValues!,
      {
        LogHistory: () => {
          this.log.debug('LogHistory command');
        },

        LastEventAttributeGetter: ({ session, isFabricFiltered }) => {
          this.log.debug(`LastEventAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
          return this.OnGetLastEvent();
        },

        TimesOpenedAttributeGetter: ({ session, isFabricFiltered }) => {
          this.log.debug(`TimesOpenedAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
          return this.OnGetimesOpened();
        },

        ResetTotalAttributeGetter: ({ session, isFabricFiltered }) => {
          this.log.debug(`LastResetTotalAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
          return this.OnGetLastReset();
        },
        ResetTotalAttributeSetter: (value: number, { attributes, endpoint, session }) => {
          this.log.debug(`LastResetTotalAttributeSetter ${value} ${attributes} endpoint: ${endpoint?.name} session: ${session?.name}`);
          return this.OnSetLastReset(value);
        },

        LastPressureAttributeGetter: ({ session, isFabricFiltered }) => {
          this.log.debug(`LastPressureAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
          return this.lastPressure;
        },

        ConfigDataGetAttributeGetter: ({ session, isFabricFiltered }) => {
          this.log.debug(`ConfigDataGetAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
          return this.OnGetConfigData(isFabricFiltered);
        },

        ConfigDataSetAttributeGetter: ({ session, isFabricFiltered }) => {
          this.log.debug(`ConfigDataSetAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
          return Uint8Array.fromHex('');
        },
        ConfigDataSetAttributeSetter: (value: Uint8Array, { attributes, endpoint, session }) => {
          this.log.debug(`ConfigDataSetAttributeSetter [${value.toHex()}] ${attributes} endpoint: ${endpoint?.name} session: ${session?.name}`);
          return this.OnSetConfigData(value);
        },

        HistoryStatusAttributeGetter: ({ session, isFabricFiltered }) => {
          this.log.debug(`HistoryStatusAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
          return this.OnGetHistoryStatus(isFabricFiltered);
        },

        HistoryEntriesAttributeGetter: ({ session, isFabricFiltered }) => {
          this.log.debug(`HistoryEntriesAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
          return this.OnGetHistoryEntries();
        },

        HistorySetTimeAttributeGetter: ({ session, isFabricFiltered }) => {
          this.log.debug(`HistorySetTimeAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
          return Uint8Array.fromHex('');
        },
        HistorySetTimeAttributeSetter: (value: Uint8Array, { attributes, endpoint, session }) => {
          this.log.debug(`HistorySetTimeAttributeSetter ${value.toHex()} ${attributes} endpoint: ${endpoint?.name} session: ${session?.name}`);
          return this.OnSetHistorySetTime(value);
        },

        HistoryRequestAttributeGetter: ({ session, isFabricFiltered }) => {
          this.log.debug(`HistoryRequestAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
          return Uint8Array.fromHex('');
        },
        HistoryRequestAttributeSetter: (value: Uint8Array, { attributes, endpoint, session }) => {
          this.log.debug(`HistoryRequestAttributeSetter ${value.toHex()} ${attributes} endpoint: ${endpoint?.name} session: ${session?.name}`);
          return this.OnSetHistoryRequest(value);
        },

        MotionSensitivityAttributeGetter: ({ session, isFabricFiltered }) => {
          this.log.debug(`MotionSensitivityAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
          return this.motionSensitivity;
        },
        MotionSensitivityAttributeSetter: (value: number, { attributes, endpoint, session }) => {
          this.log.warn(`MotionSensitivityAttributeSetter ${value} (0=High 4=Medium 7=Low) ${attributes} endpoint: ${endpoint?.name} session: ${session?.name}`);
          this.motionSensitivity = value;
          return true;
        },
      },
      {},
    );
    return eveHistoryCluster;
  }
  */
  createEnergyEveHistoryClusterServer(history: MatterHistory, log: AnsiLogger) {
    history.setMatterHystoryType('energy');
    this.addClusterServer(
      ClusterServer(
        EveHistoryCluster,
        {
          ConfigDataGet: Uint8Array.fromHex(''),
          ConfigDataSet: Uint8Array.fromHex(''),
          HistoryStatus: Uint8Array.fromHex(''),
          HistoryEntries: Uint8Array.fromHex(''),
          HistoryRequest: Uint8Array.fromHex(''),
          HistorySetTime: Uint8Array.fromHex(''),
          LastEvent: 0,
          Voltage: 0,
          Current: 0,
          Consumption: 0,
          TotalConsumption: 0,
          EnergyUnknown: 1,
          ResetTotal: 0,
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

  createMotionEveHistoryClusterServer(history: MatterHistory, log: AnsiLogger) {
    history.setMatterHystoryType('motion');
    this.addClusterServer(
      ClusterServer(
        EveHistoryCluster,
        {
          ConfigDataGet: Uint8Array.fromHex(''),
          ConfigDataSet: Uint8Array.fromHex(''),
          HistoryStatus: Uint8Array.fromHex(''),
          HistoryEntries: Uint8Array.fromHex(''),
          HistoryRequest: Uint8Array.fromHex(''),
          HistorySetTime: Uint8Array.fromHex(''),
          LastEvent: 0,
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

  createDoorEveHistoryClusterServer(history: MatterHistory, log: AnsiLogger) {
    history.setMatterHystoryType('door');
    this.addClusterServer(
      ClusterServer(
        EveHistoryCluster,
        {
          ConfigDataGet: Uint8Array.fromHex(''),
          ConfigDataSet: Uint8Array.fromHex(''),
          HistoryStatus: Uint8Array.fromHex(''),
          HistoryEntries: Uint8Array.fromHex(''),
          HistoryRequest: Uint8Array.fromHex(''),
          HistorySetTime: Uint8Array.fromHex(''),
          TimesOpened: 0,
          LastEvent: 0,
          ResetTotal: 0,
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
            console.log('*Identify');
            await this.commandHandler.executeHandler('identify', data);
          },
        },
      ),
    );
  }

  createDefaultGroupsClusterServer() {
    this.addClusterServer(createDefaultGroupsClusterServer());
  }

  createDefaultScenesClusterServer() {
    this.addClusterServer(createDefaultScenesClusterServer());
  }

  private createUniqueId(param1: string, param2: string, param3: string, param4: string) {
    const hash = createHash('md5');
    hash.update(param1 + param2 + param3 + param4);
    return hash.digest('hex');
  }

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
            console.log('resetCounts');
            await this.commandHandler.executeHandler('resetCounts', data);
          },
        },
        {},
      ),
    );
  }

  createDefaultOnOffClusterServer(onOff = false) {
    this.addClusterServer(
      ClusterServer(
        OnOffCluster,
        {
          onOff,
        },
        {
          on: async (data) => {
            console.log('*on');
            await this.commandHandler.executeHandler('on', data);
          },
          off: async (data) => {
            console.log('*off');
            await this.commandHandler.executeHandler('off', data);
          },
          toggle: async (data) => {
            console.log('*toggle');
            await this.commandHandler.executeHandler('toggle', data);
          },
        },
        {},
      ),
    );
  }

  createDefaultWindowCoveringClusterServer(positionPercent100ths?: number) {
    this.addClusterServer(
      ClusterServer(
        WindowCoveringCluster.with(WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift),
        {
          type: WindowCovering.WindowCoveringType.Shutter,
          configStatus: {
            operational: true,
            onlineReserved: false,
            liftMovementReversed: false,
            liftPositionAware: true,
            tiltPositionAware: false,
            liftEncoderControlled: false,
            tiltEncoderControlled: false,
          },
          operationalStatus: { global: WindowCovering.MovementStatus.Stopped, lift: WindowCovering.MovementStatus.Stopped, tilt: WindowCovering.MovementStatus.Stopped },
          endProductType: WindowCovering.EndProductType.SlidingShutter,
          mode: { motorDirectionReversed: false, calibrationMode: false, maintenanceMode: false, ledFeedback: false },
          targetPositionLiftPercent100ths: positionPercent100ths ?? 0, // 0 Fully open 10000 fully closed
          currentPositionLiftPercent100ths: positionPercent100ths ?? 0, // 0 Fully open 10000 fully closed
        },
        {
          upOrOpen: async (data) => {
            console.log('*upOrOpen');
            await this.commandHandler.executeHandler('upOrOpen', data);
          },
          downOrClose: async (data) => {
            console.log('*downOrClose');
            await this.commandHandler.executeHandler('downOrClose', data);
          },
          stopMotion: async (data) => {
            console.log('*stopMotion');
            await this.commandHandler.executeHandler('stopMotion', data);
          },
          goToLiftPercentage: async (data) => {
            console.log(
              `*goToLiftPercentage: ${data.request.liftPercent100thsValue} current: ${data.attributes.currentPositionLiftPercent100ths?.getLocal()} ` +
                `target: ${data.attributes.targetPositionLiftPercent100ths?.getLocal()}`,
            );
            await this.commandHandler.executeHandler('goToLiftPercentage', data);
          },
        },
        {},
      ),
    );
  }

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

  createDefaultPressureMeasurementClusterServer(measuredValue: number = 0) {
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

  createDefaultPowerSourceReplaceableBatteryClusterServer(batPercentRemaining: number = 100, batChargeLevel: PowerSource.BatChargeLevel = PowerSource.BatChargeLevel.Ok, batVoltage: number = 1500) {
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
          batReplacementDescription: 'AA battery',
          batQuantity: 1,
        },
        {},
        {},
      ),
    );
  }

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

  createDefaultAirQualityClusterServer() {
    this.addClusterServer(
      ClusterServer(
        AirQualityCluster.with(AirQuality.Feature.FairAirQuality, AirQuality.Feature.ModerateAirQuality, AirQuality.Feature.VeryPoorAirQuality),
        {
          airQuality: AirQuality.AirQualityType.Good,
        },
        {},
        {},
      ),
    );
  }
}
