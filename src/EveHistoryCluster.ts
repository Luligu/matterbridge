/**
 * This file contains the cluster EveHistory.
 *
 * @file EveHistoryCluster.ts
 * @author Luca Liguori
 * @date 2023-12-26
 * @version 1.0.10
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

/* eslint-disable @typescript-eslint/no-namespace */
import { ClusterRegistry, MutableCluster, OptionalAttribute, WritableAttribute } from '@project-chip/matter-node.js/cluster';
import { Attribute, OptionalWritableAttribute } from '@project-chip/matter-node.js/cluster';
import { BitFlag } from '@project-chip/matter-node.js/schema';
import { TlvUInt32, TlvBoolean, TlvFloat, TlvByteString } from '@project-chip/matter-node.js/tlv';
import { Identity } from '@project-chip/matter-node.js/util';

export namespace EveHistory {
  export const enum WeatherTrend {
    // on Weather 1-9=Sun 3-4-11=CloudSun 5-6-7=Rain 12-13-14-15=RainWind 0-2-8-10=Empty
    BLANK = 0,
    SUN = 1,
    CLOUDS_SUN = 3,
    RAIN = 5,
    RAIN_WIND = 12,
  }

  export const enum Sensitivity {
    HIGH = 0,
    MEDIUM = 4,
    LOW = 7,
  }

  export const enum TemperatureDisplayUnits {
    CELSIUS = 0,
    FAHRENHEIT = 1,
  }

  export const EveDoorComponent = MutableCluster.Component({
    attributes: {
      ConfigDataGet: Attribute(0x130a0000, TlvByteString),
      ConfigDataSet: WritableAttribute(0x130a0001, TlvByteString),
      HistoryStatus: Attribute(0x130a0002, TlvByteString),
      HistoryEntries: Attribute(0x130a0003, TlvByteString),
      HistoryRequest: WritableAttribute(0x130a0004, TlvByteString),
      HistorySetTime: WritableAttribute(0x130a0005, TlvByteString),
      LastEvent: OptionalAttribute(0x130a0007, TlvUInt32),
      TimesOpened: OptionalAttribute(0x130a0006, TlvUInt32), // on Door
      ResetTotal: OptionalWritableAttribute(0x130a000e, TlvUInt32), // on Energy and Door
      RLoc: Attribute(0x130a0012, TlvUInt32), // on Eve app in the thread windows
    },
  });

  export const EveMotionComponent = MutableCluster.Component({
    attributes: {
      ConfigDataGet: Attribute(0x130a0000, TlvByteString),
      ConfigDataSet: WritableAttribute(0x130a0001, TlvByteString),
      HistoryStatus: Attribute(0x130a0002, TlvByteString),
      HistoryEntries: Attribute(0x130a0003, TlvByteString),
      HistoryRequest: WritableAttribute(0x130a0004, TlvByteString),
      HistorySetTime: WritableAttribute(0x130a0005, TlvByteString),
      LastEvent: OptionalAttribute(0x130a0007, TlvUInt32),
      MotionSensitivity: OptionalWritableAttribute(0x130a000d, TlvUInt32), // on Motion 0=High 4=Medium 7=Low
      RLoc: Attribute(0x130a0012, TlvUInt32), // on Eve app in the thread windows
    },
  });

  export const EveEnergyComponent = MutableCluster.Component({
    attributes: {
      ConfigDataGet: Attribute(0x130a0000, TlvByteString),
      ConfigDataSet: WritableAttribute(0x130a0001, TlvByteString),
      HistoryStatus: Attribute(0x130a0002, TlvByteString),
      HistoryEntries: Attribute(0x130a0003, TlvByteString),
      HistoryRequest: WritableAttribute(0x130a0004, TlvByteString),
      HistorySetTime: WritableAttribute(0x130a0005, TlvByteString),
      LastEvent: OptionalAttribute(0x130a0007, TlvUInt32),
      ResetTotal: OptionalWritableAttribute(0x130a000e, TlvUInt32), // on Energy and Door
      Voltage: OptionalAttribute(0x130a0008, TlvFloat),
      Current: OptionalAttribute(0x130a0009, TlvFloat),
      Consumption: OptionalAttribute(0x130a000a, TlvFloat),
      TotalConsumption: OptionalAttribute(0x130a000b, TlvFloat),
      EnergyUnknown: OptionalAttribute(0x130a000c, TlvUInt32), // on Energy always 0
      ChildLock: OptionalWritableAttribute(0x130a0011, TlvBoolean), // on Energy
      RLoc: Attribute(0x130a0012, TlvUInt32), // on Eve app in the thread windows
    },
  });

  export const EveWeatherComponent = MutableCluster.Component({
    attributes: {
      ConfigDataGet: Attribute(0x130a0000, TlvByteString),
      ConfigDataSet: WritableAttribute(0x130a0001, TlvByteString),
      HistoryStatus: Attribute(0x130a0002, TlvByteString),
      HistoryEntries: Attribute(0x130a0003, TlvByteString),
      HistoryRequest: WritableAttribute(0x130a0004, TlvByteString),
      HistorySetTime: WritableAttribute(0x130a0005, TlvByteString),
      RLoc: Attribute(0x130a0012, TlvUInt32), // on Eve app in the thread windows
      Elevation: OptionalWritableAttribute(0x130a0013, TlvFloat), // on Weather
      AirPressure: OptionalAttribute(0x130a0014, TlvUInt32), // on Weather on the summary
      WeatherTrend: OptionalAttribute(0x130a0015, TlvUInt32), // on Weather
      TemperatureDisplayUnits: OptionalWritableAttribute(0x130a0016, TlvUInt32), // on Weather 0=CELSIUS 1=FAHRENHEIT
    },
  });

  export const EveRoomComponent = MutableCluster.Component({
    attributes: {
      ConfigDataGet: Attribute(0x130a0000, TlvByteString),
      ConfigDataSet: WritableAttribute(0x130a0001, TlvByteString),
      HistoryStatus: Attribute(0x130a0002, TlvByteString),
      HistoryEntries: Attribute(0x130a0003, TlvByteString),
      HistoryRequest: WritableAttribute(0x130a0004, TlvByteString),
      HistorySetTime: WritableAttribute(0x130a0005, TlvByteString),
      RLoc: Attribute(0x130a0012, TlvUInt32), // on Eve app in the thread windows
      TemperatureDisplayUnits: OptionalWritableAttribute(0x130a0016, TlvUInt32), // on Weather 0=CELSIUS 1=FAHRENHEIT
    },
  });

  export enum Feature {
    EveDoor = 'EveDoor',
    EveMotion = 'EveMotion',
    EveEnergy = 'EveEnergy',
    EveWeather = 'EveWeather',
    EveRoom = 'EveRoom',
  }

  export const Base = MutableCluster.Component({
    id: 0x130afc01,
    name: 'EveHistory',
    revision: 1,

    features: {
      eveDoor: BitFlag(0),
      eveMotion: BitFlag(1),
      eveEnergy: BitFlag(2),
      eveWeather: BitFlag(3),
      eveRoom: BitFlag(4),
    },

    attributes: {
      ConfigDataGet: Attribute(0x130a0000, TlvByteString),
      ConfigDataSet: WritableAttribute(0x130a0001, TlvByteString),
      HistoryStatus: Attribute(0x130a0002, TlvByteString),
      HistoryEntries: Attribute(0x130a0003, TlvByteString),
      HistoryRequest: WritableAttribute(0x130a0004, TlvByteString),
      HistorySetTime: WritableAttribute(0x130a0005, TlvByteString),
      TimesOpened: OptionalAttribute(0x130a0006, TlvUInt32), // on Door
      LastEvent: OptionalAttribute(0x130a0007, TlvUInt32), // Not used on Energy
      Voltage: OptionalAttribute(0x130a0008, TlvFloat),
      Current: OptionalAttribute(0x130a0009, TlvFloat),
      Consumption: OptionalAttribute(0x130a000a, TlvFloat),
      TotalConsumption: OptionalAttribute(0x130a000b, TlvFloat),
      EnergyUnknown: OptionalAttribute(0x130a000c, TlvUInt32), // on Energy always 0
      MotionSensitivity: OptionalWritableAttribute(0x130a000d, TlvUInt32), // on Motion 0=High 4=Medium 7=Low
      ResetTotal: OptionalWritableAttribute(0x130a000e, TlvUInt32), // on Energy and Door
      ChildLock: OptionalWritableAttribute(0x130a0011, TlvBoolean), // on Energy
      RLoc: Attribute(0x130a0012, TlvUInt32), // on Eve app in the thread windows
      Elevation: OptionalWritableAttribute(0x130a0013, TlvFloat), // on Weather
      AirPressure: OptionalAttribute(0x130a0014, TlvUInt32), // on Weather on the summary
      WeatherTrend: OptionalAttribute(0x130a0015, TlvUInt32), // on Weather
      TemperatureDisplayUnits: OptionalWritableAttribute(0x130a0016, TlvUInt32), // on Weather 0=CELSIUS 1=FAHRENHEIT
    },

    extensions: MutableCluster.Extensions(
      { flags: { eveDoor: true }, component: EveDoorComponent },
      { flags: { eveMotion: true }, component: EveMotionComponent },
      { flags: { eveEnergy: true }, component: EveEnergyComponent },
      { flags: { eveWeather: true }, component: EveWeatherComponent },
      { flags: { eveRoom: true }, component: EveRoomComponent },
    ),
  });

  export const ClusterInstance = MutableCluster.ExtensibleOnly(Base);

  export interface Cluster extends Identity<typeof ClusterInstance> {}

  export const Cluster: Cluster = ClusterInstance;

  export const CompleteInstance = MutableCluster({
    id: Base.id,
    name: Base.name,
    revision: Base.revision,
    features: Base.features,

    attributes: {
      ...Base.attributes,
    },
  });

  export interface Complete extends Identity<typeof CompleteInstance> {}

  export const Complete: Complete = CompleteInstance;
}

export type EveHistoryCluster = typeof EveHistory.Cluster;
export const EveHistoryCluster = EveHistory.Cluster;
ClusterRegistry.register(EveHistory.Complete);
