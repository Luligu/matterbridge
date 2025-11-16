// src/matterbridgeDeviceTypes.requirements.test.ts

const NAME = 'MatterbridgeDevicetypesRequirements';
const HOMEDIR = path.join('jest', NAME);

import path from 'node:path';

import { jest } from '@jest/globals';
import * as devices from '@matter/node/devices';
import * as endpoints from '@matter/node/endpoints';

import {
  // Utility
  rootNode,
  powerSource,
  OTARequestor,
  OTAProvider,
  bridgedNode,
  electricalSensor,
  deviceEnergyManagement,
  // Lighting
  onOffLight,
  dimmableLight,
  colorTemperatureLight,
  extendedColorLight,
  // Smart plugs / actuators
  onOffOutlet,
  dimmableOutlet,
  onOffMountedSwitch,
  dimmableMountedSwitch,
  pumpDevice,
  waterValve,
  // Switches & controls
  onOffSwitch,
  dimmableSwitch,
  colorTemperatureSwitch,
  genericSwitch,
  // Sensors
  contactSensor,
  lightSensor,
  occupancySensor,
  temperatureSensor,
  pressureSensor,
  flowSensor,
  humiditySensor,
  smokeCoAlarm,
  airQualitySensor,
  waterFreezeDetector,
  waterLeakDetector,
  rainSensor,
  // Closures
  doorLockDevice,
  coverDevice,
  // HVAC
  thermostatDevice,
  fanDevice,
  airPurifier,
  // Media
  basicVideoPlayer,
  castingVideoPlayer,
  speakerDevice,
  // Generic device types
  modeSelect,
  aggregator,
  bridge,
  // Appliances & complex devices
  roboticVacuumCleaner,
  laundryWasher,
  refrigerator,
  airConditioner,
  temperatureControlledCabinetCooler,
  temperatureControlledCabinetHeater,
  dishwasher,
  laundryDryer,
  cookSurface,
  cooktop,
  oven,
  extractorHood,
  microwaveOven,
  // Energy & environment
  evse,
  waterHeater,
  solarPower,
  batteryStorage,
  heatPump,
} from './matterbridgeDeviceTypes.js';
import { setupTest } from './jestutils/jestHelpers.js';

await setupTest(NAME, false);

function extractClusterIds(behaviorRecord: Record<string, any>): number[] {
  return Object.values(behaviorRecord)
    .map((b) => b?.cluster?.id)
    .filter((id): id is number => typeof id === 'number');
}

function asSet(arr: number[]): Set<number> {
  return new Set(arr);
}

function setEquals(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

// Mapping of Matterbridge device definitions to Matter.js device or endpoint definitions.
// Each entry lists the Matterbridge object and corresponding Matter.js definition object.
const entries: Array<{ name: string; mb: any; md: any }> = [
  // Utility endpoint types (use endpoints definitions)
  { name: 'rootNode', mb: rootNode, md: endpoints.RootEndpointDefinition },
  { name: 'powerSource', mb: powerSource, md: endpoints.PowerSourceEndpointDefinition },
  { name: 'OTARequestor', mb: OTARequestor, md: endpoints.OtaRequestorEndpointDefinition },
  { name: 'OTAProvider', mb: OTAProvider, md: endpoints.OtaProviderEndpointDefinition },
  { name: 'bridgedNode', mb: bridgedNode, md: endpoints.BridgedNodeEndpointDefinition },
  { name: 'electricalSensor', mb: electricalSensor, md: endpoints.ElectricalSensorEndpointDefinition },
  { name: 'deviceEnergyManagement', mb: deviceEnergyManagement, md: endpoints.DeviceEnergyManagementEndpointDefinition },
  { name: 'aggregator', mb: aggregator, md: endpoints.AggregatorEndpointDefinition },
  { name: 'bridge', mb: bridge, md: endpoints.AggregatorEndpointDefinition },

  // Lighting
  { name: 'onOffLight', mb: onOffLight, md: devices.OnOffLightDeviceDefinition },
  { name: 'dimmableLight', mb: dimmableLight, md: devices.DimmableLightDeviceDefinition },
  { name: 'colorTemperatureLight', mb: colorTemperatureLight, md: devices.ColorTemperatureLightDeviceDefinition },
  { name: 'extendedColorLight', mb: extendedColorLight, md: devices.ExtendedColorLightDeviceDefinition },

  // Smart plugs / outlets / mounted controls
  { name: 'onOffOutlet', mb: onOffOutlet, md: devices.OnOffPlugInUnitDeviceDefinition },
  { name: 'dimmableOutlet', mb: dimmableOutlet, md: devices.DimmablePlugInUnitDeviceDefinition },
  { name: 'onOffMountedSwitch', mb: onOffMountedSwitch, md: devices.MountedOnOffControlDeviceDefinition },
  { name: 'dimmableMountedSwitch', mb: dimmableMountedSwitch, md: devices.MountedDimmableLoadControlDeviceDefinition },
  { name: 'pumpDevice', mb: pumpDevice, md: devices.PumpDeviceDefinition },
  { name: 'waterValve', mb: waterValve, md: devices.WaterValveDeviceDefinition },

  // Switches & controls
  { name: 'onOffSwitch', mb: onOffSwitch, md: devices.OnOffLightSwitchDeviceDefinition },
  { name: 'dimmableSwitch', mb: dimmableSwitch, md: devices.DimmerSwitchDeviceDefinition },
  { name: 'colorTemperatureSwitch', mb: colorTemperatureSwitch, md: devices.ColorDimmerSwitchDeviceDefinition },
  { name: 'genericSwitch', mb: genericSwitch, md: devices.GenericSwitchDeviceDefinition },

  // Sensors
  { name: 'contactSensor', mb: contactSensor, md: devices.ContactSensorDeviceDefinition },
  { name: 'lightSensor', mb: lightSensor, md: devices.LightSensorDeviceDefinition },
  { name: 'occupancySensor', mb: occupancySensor, md: devices.OccupancySensorDeviceDefinition },
  { name: 'temperatureSensor', mb: temperatureSensor, md: devices.TemperatureSensorDeviceDefinition },
  { name: 'pressureSensor', mb: pressureSensor, md: devices.PressureSensorDeviceDefinition },
  { name: 'flowSensor', mb: flowSensor, md: devices.FlowSensorDeviceDefinition },
  { name: 'humiditySensor', mb: humiditySensor, md: devices.HumiditySensorDeviceDefinition },
  { name: 'smokeCoAlarm', mb: smokeCoAlarm, md: devices.SmokeCoAlarmDeviceDefinition },
  { name: 'airQualitySensor', mb: airQualitySensor, md: devices.AirQualitySensorDeviceDefinition },
  { name: 'waterFreezeDetector', mb: waterFreezeDetector, md: devices.WaterFreezeDetectorDeviceDefinition },
  { name: 'waterLeakDetector', mb: waterLeakDetector, md: devices.WaterLeakDetectorDeviceDefinition },
  { name: 'rainSensor', mb: rainSensor, md: devices.RainSensorDeviceDefinition },

  // Closures
  { name: 'doorLockDevice', mb: doorLockDevice, md: devices.DoorLockDeviceDefinition },
  { name: 'coverDevice', mb: coverDevice, md: devices.WindowCoveringDeviceDefinition },

  // HVAC
  { name: 'thermostatDevice', mb: thermostatDevice, md: devices.ThermostatDeviceDefinition },
  { name: 'fanDevice', mb: fanDevice, md: devices.FanDeviceDefinition },
  { name: 'airPurifier', mb: airPurifier, md: devices.AirPurifierDeviceDefinition },

  // Media
  { name: 'basicVideoPlayer', mb: basicVideoPlayer, md: devices.BasicVideoPlayerDeviceDefinition },
  { name: 'castingVideoPlayer', mb: castingVideoPlayer, md: devices.CastingVideoPlayerDeviceDefinition },
  { name: 'speakerDevice', mb: speakerDevice, md: devices.SpeakerDeviceDefinition },

  // Generic device types
  { name: 'modeSelect', mb: modeSelect, md: devices.ModeSelectDeviceDefinition },

  // Appliances & complex devices
  { name: 'roboticVacuumCleaner', mb: roboticVacuumCleaner, md: devices.RoboticVacuumCleanerDeviceDefinition },
  { name: 'laundryWasher', mb: laundryWasher, md: devices.LaundryWasherDeviceDefinition },
  { name: 'refrigerator', mb: refrigerator, md: devices.RefrigeratorDeviceDefinition },
  { name: 'airConditioner', mb: airConditioner, md: devices.RoomAirConditionerDeviceDefinition },
  { name: 'temperatureControlledCabinetCooler', mb: temperatureControlledCabinetCooler, md: devices.TemperatureControlledCabinetDeviceDefinition },
  { name: 'temperatureControlledCabinetHeater', mb: temperatureControlledCabinetHeater, md: devices.TemperatureControlledCabinetDeviceDefinition },
  { name: 'dishwasher', mb: dishwasher, md: devices.DishwasherDeviceDefinition },
  { name: 'laundryDryer', mb: laundryDryer, md: devices.LaundryDryerDeviceDefinition },
  { name: 'cookSurface', mb: cookSurface, md: devices.CookSurfaceDeviceDefinition },
  { name: 'cooktop', mb: cooktop, md: devices.CooktopDeviceDefinition },
  { name: 'oven', mb: oven, md: devices.OvenDeviceDefinition },
  { name: 'extractorHood', mb: extractorHood, md: devices.ExtractorHoodDeviceDefinition },
  { name: 'microwaveOven', mb: microwaveOven, md: devices.MicrowaveOvenDeviceDefinition },

  // Energy & environment
  { name: 'evse', mb: evse, md: devices.EnergyEvseDeviceDefinition },
  { name: 'waterHeater', mb: waterHeater, md: devices.WaterHeaterDeviceDefinition },
  { name: 'solarPower', mb: solarPower, md: devices.SolarPowerDeviceDefinition },
  { name: 'batteryStorage', mb: batteryStorage, md: devices.BatteryStorageDeviceDefinition },
  { name: 'heatPump', mb: heatPump, md: devices.HeatPumpDeviceDefinition },
];

const failures: string[] = [];

describe('Matterbridge device cluster mappings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  for (const { name, mb, md } of entries) {
    test(`${name}`, () => {
      expect.hasAssertions();
      const mandatoryServerIds = extractClusterIds(md.requirements?.server?.mandatory ?? {});
      const optionalServerIds = extractClusterIds(md.requirements?.server?.optional ?? {});

      const mandatoryServerSet = asSet(mandatoryServerIds);
      const optionalServerSet = asSet(optionalServerIds);
      const mbServerRequired = asSet(mb.requiredServerClusters ?? []);
      const mbServerOptional = asSet(mb.optionalServerClusters ?? []);

      // Required clusters
      const serverRequiredOk = setEquals(mbServerRequired, mandatoryServerSet);
      if (!serverRequiredOk) {
        const failure = `${name}: required mismatch -> mb=[${[...mbServerRequired].join(',')}] md=[${[...mandatoryServerSet].join(',')}]`;
        failures.push(failure);
        // console.warn('Required validation failure:', failure); // eslint-disable-line no-console
      }

      // Optional clusters
      const serverOptionalOk = setEquals(mbServerOptional, optionalServerSet);
      if (!serverOptionalOk) {
        const failure = `${name}: optional mismatch -> mb=[${[...mbServerOptional].join(',')}] md=[${[...optionalServerSet].join(',')}]`;
        failures.push(failure);
        // console.warn('Optional validation failure:', failure); // eslint-disable-line no-console
      }

      // Ensure no overlap between required and optional in Matterbridge definition
      let serverOverlapOk = true;
      for (const id of mbServerRequired) {
        if (mbServerOptional.has(id)) {
          serverOverlapOk = false;
          const failure = `${name}: cluster ${id} listed in both required and optional`;
          failures.push(failure);
          // console.warn('Overlap validation failure:', failure); // eslint-disable-line no-console
        }
      }
      expect(serverRequiredOk).toBeDefined();
      expect(serverOptionalOk).toBeDefined();
      expect(serverOverlapOk).toBeDefined();
    });
  }

  test('summary of all cluster validation failures', () => {
    if (failures.length) {
      console.warn('Cluster validation failures:', failures); // eslint-disable-line no-console
    }
    expect(failures).toEqual([
      'rootNode: required mismatch -> mb=[] md=[40,31,63,48,60,62,51]', // omitted to avoid imports
      'rootNode: optional mismatch -> mb=[] md=[46,56,49,43,44,45,50,52,55,54,53,70]', // omitted to avoid imports
      'bridgedNode: optional mismatch -> mb=[47,1872,60] md=[46,47,1872,60]', // omitted PowerSourceConfiguration cause is deprecated in matter specs but present in matter.js
      'onOffLight: optional mismatch -> mb=[8] md=[98,8]', // ScenesManagement wrongly set in matter.js as optional
      'dimmableLight: optional mismatch -> mb=[] md=[98]', // ScenesManagement wrongly set in matter.js as optional
      'colorTemperatureLight: optional mismatch -> mb=[] md=[98]', // ScenesManagement wrongly set in matter.js as optional
      'extendedColorLight: optional mismatch -> mb=[] md=[98]', // ScenesManagement wrongly set in matter.js as optional
      'onOffOutlet: optional mismatch -> mb=[8] md=[98,8]', // ScenesManagement wrongly set in matter.js as optional
      'dimmableOutlet: optional mismatch -> mb=[] md=[98]', // ScenesManagement wrongly set in matter.js as optional
      'onOffMountedSwitch: optional mismatch -> mb=[8] md=[98,8]', // ScenesManagement wrongly set in matter.js as optional
      'dimmableMountedSwitch: optional mismatch -> mb=[] md=[98]', // ScenesManagement wrongly set in matter.js as optional
      'onOffSwitch: required mismatch -> mb=[3,6] md=[3]', // Client clusters as server clusters
      'onOffSwitch: optional mismatch -> mb=[4,98] md=[]', // Client clusters as server clusters
      'dimmableSwitch: required mismatch -> mb=[3,6,8] md=[3]', // Client clusters as server clusters
      'dimmableSwitch: optional mismatch -> mb=[4,98] md=[]', // Client clusters as server clusters
      'colorTemperatureSwitch: required mismatch -> mb=[3,6,8,768] md=[3]', // Client clusters as server clusters
      'colorTemperatureSwitch: optional mismatch -> mb=[4,98] md=[]', // Client clusters as server clusters
      'temperatureControlledCabinetCooler: required mismatch -> mb=[86,82] md=[86]', // Double device type to account for heater/cooler and just one in matter.js
      'temperatureControlledCabinetCooler: optional mismatch -> mb=[1026] md=[1026,82,73,72]', // Double device type to account for heater/cooler and just one in matter.js
      'temperatureControlledCabinetHeater: required mismatch -> mb=[86,73,72] md=[86]', // Double device type to account for heater/cooler and just one in matter.js
      'temperatureControlledCabinetHeater: optional mismatch -> mb=[1026] md=[1026,82,73,72]', // Double device type to account for heater/cooler and just one in matter.js
      'heatPump: optional mismatch -> mb=[3,513] md=[3]', // Client clusters as server clusters
    ]);
  });
});
