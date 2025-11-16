// src\matterbridgeDeviceTypes.test.ts

const NAME = 'MatterbridgeDevicetypes';
const HOMEDIR = path.join('jest', NAME);

import path from 'node:path';

import { jest } from '@jest/globals';
// @matter endpoints
import * as endpoints from '@matter/node/endpoints';
import * as devices from '@matter/node/devices';

import {
  // Utility device types
  rootNode,
  powerSource,
  OTARequestor,
  OTAProvider,
  bridgedNode,
  electricalSensor,
  deviceEnergyManagement,
  // Lighting device types
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
  // Switches and Controls
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
  // Generic Device Types
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

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge device types', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Restore all mocks
    jest.restoreAllMocks();
  });

  const expectWithLog = (label: string, actual: unknown, expected: unknown) => {
    if (actual !== expected) {
      // Provide a helpful diff on failure to ease Matter spec migration
      // eslint-disable-next-line no-console
      console.error(`Discrepancy in ${label}: actual=${String(actual)} expected=${String(expected)}`);
    }
    expect(actual).toBe(expected);
  };

  type DevEntry = {
    name: string;
    device: { revision: number; code: number };
    def: { deviceRevision: number; deviceType: number };
  };

  const entries: DevEntry[] = [
    // Utility device types (endpoints) - revision only
    { name: 'rootNode', device: rootNode, def: endpoints.RootEndpointDefinition },
    { name: 'powerSource', device: powerSource, def: endpoints.PowerSourceEndpointDefinition },
    { name: 'OTARequestor', device: OTARequestor, def: endpoints.OtaRequestorEndpointDefinition },
    { name: 'OTAProvider', device: OTAProvider, def: endpoints.OtaProviderEndpointDefinition },
    { name: 'bridgedNode', device: bridgedNode, def: endpoints.BridgedNodeEndpointDefinition },
    { name: 'electricalSensor', device: electricalSensor, def: endpoints.ElectricalSensorEndpointDefinition },
    { name: 'deviceEnergyManagement', device: deviceEnergyManagement, def: endpoints.DeviceEnergyManagementEndpointDefinition },

    // Lighting
    { name: 'onOffLight', device: onOffLight, def: devices.OnOffLightDeviceDefinition },
    { name: 'dimmableLight', device: dimmableLight, def: devices.DimmableLightDeviceDefinition },
    { name: 'colorTemperatureLight', device: colorTemperatureLight, def: devices.ColorTemperatureLightDeviceDefinition },
    { name: 'extendedColorLight', device: extendedColorLight, def: devices.ExtendedColorLightDeviceDefinition },

    // Smart plugs / actuators
    { name: 'onOffOutlet', device: onOffOutlet, def: devices.OnOffPlugInUnitDeviceDefinition },
    { name: 'dimmableOutlet', device: dimmableOutlet, def: devices.DimmablePlugInUnitDeviceDefinition },
    { name: 'onOffMountedSwitch', device: onOffMountedSwitch, def: devices.MountedOnOffControlDeviceDefinition },
    { name: 'dimmableMountedSwitch', device: dimmableMountedSwitch, def: devices.MountedDimmableLoadControlDeviceDefinition },
    { name: 'pumpDevice', device: pumpDevice, def: devices.PumpDeviceDefinition },
    { name: 'waterValve', device: waterValve, def: devices.WaterValveDeviceDefinition },

    // Switches and Controls
    { name: 'onOffSwitch', device: onOffSwitch, def: devices.OnOffLightSwitchDeviceDefinition },
    { name: 'dimmableSwitch', device: dimmableSwitch, def: devices.DimmerSwitchDeviceDefinition },
    { name: 'colorTemperatureSwitch', device: colorTemperatureSwitch, def: devices.ColorDimmerSwitchDeviceDefinition },
    { name: 'genericSwitch', device: genericSwitch, def: devices.GenericSwitchDeviceDefinition },

    // Sensors
    { name: 'contactSensor', device: contactSensor, def: devices.ContactSensorDeviceDefinition },
    { name: 'lightSensor', device: lightSensor, def: devices.LightSensorDeviceDefinition },
    { name: 'occupancySensor', device: occupancySensor, def: devices.OccupancySensorDeviceDefinition },
    { name: 'temperatureSensor', device: temperatureSensor, def: devices.TemperatureSensorDeviceDefinition },
    { name: 'pressureSensor', device: pressureSensor, def: devices.PressureSensorDeviceDefinition },
    { name: 'flowSensor', device: flowSensor, def: devices.FlowSensorDeviceDefinition },
    { name: 'humiditySensor', device: humiditySensor, def: devices.HumiditySensorDeviceDefinition },
    { name: 'smokeCoAlarm', device: smokeCoAlarm, def: devices.SmokeCoAlarmDeviceDefinition },
    { name: 'airQualitySensor', device: airQualitySensor, def: devices.AirQualitySensorDeviceDefinition },
    { name: 'waterFreezeDetector', device: waterFreezeDetector, def: devices.WaterFreezeDetectorDeviceDefinition },
    { name: 'waterLeakDetector', device: waterLeakDetector, def: devices.WaterLeakDetectorDeviceDefinition },
    { name: 'rainSensor', device: rainSensor, def: devices.RainSensorDeviceDefinition },

    // Closures
    { name: 'doorLockDevice', device: doorLockDevice, def: devices.DoorLockDeviceDefinition },
    { name: 'coverDevice', device: coverDevice, def: devices.WindowCoveringDeviceDefinition },

    // HVAC
    { name: 'thermostatDevice', device: thermostatDevice, def: devices.ThermostatDeviceDefinition },
    { name: 'fanDevice', device: fanDevice, def: devices.FanDeviceDefinition },
    { name: 'airPurifier', device: airPurifier, def: devices.AirPurifierDeviceDefinition },

    // Media
    { name: 'basicVideoPlayer', device: basicVideoPlayer, def: devices.BasicVideoPlayerDeviceDefinition },
    { name: 'castingVideoPlayer', device: castingVideoPlayer, def: devices.CastingVideoPlayerDeviceDefinition },
    { name: 'speakerDevice', device: speakerDevice, def: devices.SpeakerDeviceDefinition },

    // Generic Device Types
    { name: 'modeSelect', device: modeSelect, def: devices.ModeSelectDeviceDefinition },
    { name: 'aggregator', device: aggregator, def: endpoints.AggregatorEndpointDefinition },
    { name: 'bridge', device: bridge, def: endpoints.AggregatorEndpointDefinition },

    // Appliances & complex devices
    { name: 'roboticVacuumCleaner', device: roboticVacuumCleaner, def: devices.RoboticVacuumCleanerDeviceDefinition },
    { name: 'laundryWasher', device: laundryWasher, def: devices.LaundryWasherDeviceDefinition },
    { name: 'refrigerator', device: refrigerator, def: devices.RefrigeratorDeviceDefinition },
    { name: 'airConditioner', device: airConditioner, def: devices.RoomAirConditionerDeviceDefinition },
    { name: 'temperatureControlledCabinetCooler', device: temperatureControlledCabinetCooler, def: devices.TemperatureControlledCabinetDeviceDefinition },
    { name: 'temperatureControlledCabinetHeater', device: temperatureControlledCabinetHeater, def: devices.TemperatureControlledCabinetDeviceDefinition },
    { name: 'dishwasher', device: dishwasher, def: devices.DishwasherDeviceDefinition },
    { name: 'laundryDryer', device: laundryDryer, def: devices.LaundryDryerDeviceDefinition },
    { name: 'cookSurface', device: cookSurface, def: devices.CookSurfaceDeviceDefinition },
    { name: 'cooktop', device: cooktop, def: devices.CooktopDeviceDefinition },
    { name: 'oven', device: oven, def: devices.OvenDeviceDefinition },
    { name: 'extractorHood', device: extractorHood, def: devices.ExtractorHoodDeviceDefinition },
    { name: 'microwaveOven', device: microwaveOven, def: devices.MicrowaveOvenDeviceDefinition },

    // Energy & environment
    { name: 'evse', device: evse, def: devices.EnergyEvseDeviceDefinition },
    { name: 'waterHeater', device: waterHeater, def: devices.WaterHeaterDeviceDefinition },
    { name: 'solarPower', device: solarPower, def: devices.SolarPowerDeviceDefinition },
    { name: 'batteryStorage', device: batteryStorage, def: devices.BatteryStorageDeviceDefinition },
    { name: 'heatPump', device: heatPump, def: devices.HeatPumpDeviceDefinition },
  ];

  for (const { name, device, def } of entries) {
    test(`${name} code 0x${device.code.toString(16)} revision ${device.revision} >>> ${def.deviceRevision}`, () => {
      expect.hasAssertions();
      expectWithLog(`${name}.revision`, device.revision, def.deviceRevision);
      expectWithLog(`${name}.code`, device.code, def.deviceType);
    });
  }
});
