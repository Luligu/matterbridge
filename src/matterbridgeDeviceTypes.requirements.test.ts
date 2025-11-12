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

await setupTest(NAME, true);

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
function isSubset(sub: Set<number>, full: Set<number>): boolean {
  for (const v of sub) if (!full.has(v)) return false;
  return true;
}

// Some Matterbridge optional clusters intentionally omit optional spec clusters (e.g. ScenesManagement);
// treat optional clusters as subset validation for now.
const OPTIONAL_SUBSET_MODE = true;

// Mapping of Matterbridge device definitions to Matter.js device or endpoint definitions.
// Each entry lists the Matterbridge object and corresponding Matter.js definition object.
// For endpoints (utility types) use endpoints.*Definition.
const CASES: Array<{ name: string; mb: any; md: any; subsetOptional?: boolean }> = [
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
  { name: 'onOffSwitch', mb: onOffSwitch, md: devices.OnOffLightSwitchDeviceDefinition, subsetOptional: true },
  { name: 'dimmableSwitch', mb: dimmableSwitch, md: devices.DimmerSwitchDeviceDefinition, subsetOptional: true },
  { name: 'colorTemperatureSwitch', mb: colorTemperatureSwitch, md: devices.ColorDimmerSwitchDeviceDefinition, subsetOptional: true },
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
  { name: 'refrigerator', mb: refrigerator, md: devices.RefrigeratorDeviceDefinition, subsetOptional: true },
  { name: 'airConditioner', mb: airConditioner, md: devices.RoomAirConditionerDeviceDefinition },
  { name: 'temperatureControlledCabinetCooler', mb: temperatureControlledCabinetCooler, md: devices.TemperatureControlledCabinetDeviceDefinition, subsetOptional: true },
  { name: 'temperatureControlledCabinetHeater', mb: temperatureControlledCabinetHeater, md: devices.TemperatureControlledCabinetDeviceDefinition, subsetOptional: true },
  { name: 'dishwasher', mb: dishwasher, md: devices.DishwasherDeviceDefinition },
  { name: 'laundryDryer', mb: laundryDryer, md: devices.LaundryDryerDeviceDefinition },
  { name: 'cookSurface', mb: cookSurface, md: devices.CookSurfaceDeviceDefinition, subsetOptional: true },
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

// Utility endpoints rootNode/powerSource/etc may have internal mandatory clusters (Descriptor, Basic Information)
// not explicitly listed in Matterbridge device definitions. We treat Matterbridge required clusters as subset of mandatory
// for those endpoint types.
const ENDPOINT_SUBSET = new Set<string>(['rootNode', 'powerSource', 'OTARequestor', 'OTAProvider', 'bridgedNode', 'electricalSensor', 'deviceEnergyManagement', 'aggregator', 'bridge']);

describe('Matterbridge device cluster mappings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('validate required and optional server clusters against Matter.js behaviors', () => {
    const failures: string[] = [];

    for (const { name, mb, md, subsetOptional } of CASES) {
      // For controller/application devices (switches) mandatory server list may be intentionally minimal (only Identify)
      // but Matterbridge models server clusters actually used locally; treat Matterbridge required set as subset
      const mandatoryIds = extractClusterIds(md.requirements?.server?.mandatory ?? {});
      const optionalIds = extractClusterIds(md.requirements?.server?.optional ?? {});

      const mandatorySet = asSet(mandatoryIds);
      const optionalSet = asSet(optionalIds);
      const mbRequired = asSet(mb.requiredServerClusters);
      const mbOptional = asSet(mb.optionalServerClusters ?? []);

      // Required clusters: either exact match or subset for endpoint utility types
      // For switch-like controllers and composed devices with zero mandatory server clusters in Matter.js,
      // use subset logic to allow Matterbridge modelling of additional local clusters.
      const SUBSET_ONLY = ENDPOINT_SUBSET.has(name) || mandatorySet.size === 0 || name.endsWith('Switch') || name.includes('temperatureControlledCabinet');
      const requiredOk = SUBSET_ONLY ? isSubset(mbRequired, mandatorySet) : setEquals(mbRequired, mandatorySet);

      if (!requiredOk) {
        failures.push(`${name}: required mismatch -> mb=[${[...mbRequired].join(',')}] md=[${[...mandatorySet].join(',')}]`);
      }

      // Optional clusters: subset unless we choose equality mode
      const optModeSubset = OPTIONAL_SUBSET_MODE || subsetOptional;
      const optionalOk = optModeSubset ? isSubset(mbOptional, optionalSet) : setEquals(mbOptional, optionalSet);
      // const optionalOk = setEquals(mbOptional, optionalSet);
      if (!optionalOk) {
        failures.push(`${name}: optional mismatch -> mb=[${[...mbOptional].join(',')}] md=[${[...optionalSet].join(',')}]`);
      }

      // Ensure no overlap between required and optional in Matterbridge definition
      for (const id of mbRequired) {
        if (mbOptional.has(id)) failures.push(`${name}: cluster ${id} listed in both required and optional`);
      }
    }

    if (failures.length) {
      console.warn('Cluster validation failures:', failures); // eslint-disable-line no-console
    }
    expect(failures).toHaveLength(9);
    expect(failures).toEqual([
      'onOffSwitch: required mismatch -> mb=[3,6] md=[3]', // Client clusters as server clusters
      'onOffSwitch: optional mismatch -> mb=[4] md=[]', // Client clusters as server clusters
      'dimmableSwitch: required mismatch -> mb=[3,6,8] md=[3]', // Client clusters as server clusters
      'dimmableSwitch: optional mismatch -> mb=[4] md=[]', // Client clusters as server clusters
      'colorTemperatureSwitch: required mismatch -> mb=[3,6,8,768] md=[3]', // Client clusters as server clusters
      'colorTemperatureSwitch: optional mismatch -> mb=[4] md=[]', // Client clusters as server clusters
      'temperatureControlledCabinetCooler: required mismatch -> mb=[86,82] md=[86]', // Double device type to account for heater/cooler
      'temperatureControlledCabinetHeater: required mismatch -> mb=[86,73,72] md=[86]', // Double device type to account for heater/cooler
      'heatPump: optional mismatch -> mb=[3,513] md=[3]', // Client clusters as server clusters
    ]);
  });
});
