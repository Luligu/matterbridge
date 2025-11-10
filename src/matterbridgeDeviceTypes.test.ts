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
setupTest(NAME, false);

describe('Matterbridge device types', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('check utility device types revision changes', async () => {
    expect(rootNode.revision).toBe(endpoints.RootEndpointDefinition.deviceRevision);
    expect(powerSource.revision).toBe(endpoints.PowerSourceEndpointDefinition.deviceRevision);
    expect(OTARequestor.revision).toBe(endpoints.OtaRequestorEndpointDefinition.deviceRevision);
    expect(OTAProvider.revision).toBe(endpoints.OtaProviderEndpointDefinition.deviceRevision);
    expect(bridgedNode.revision).toBe(endpoints.BridgedNodeEndpointDefinition.deviceRevision);
    expect(electricalSensor.revision).toBe(endpoints.ElectricalSensorEndpointDefinition.deviceRevision);
    expect(deviceEnergyManagement.revision).toBe(endpoints.DeviceEnergyManagementEndpointDefinition.deviceRevision);
  });

  test('check application device types revision changes', async () => {
    // Lighting
    expect(onOffLight.revision).toBe(devices.OnOffLightDeviceDefinition.deviceRevision);
    expect(onOffLight.code).toBe(devices.OnOffLightDeviceDefinition.deviceType);
    expect(dimmableLight.revision).toBe(devices.DimmableLightDeviceDefinition.deviceRevision);
    expect(dimmableLight.code).toBe(devices.DimmableLightDeviceDefinition.deviceType);
    expect(colorTemperatureLight.revision).toBe(devices.ColorTemperatureLightDeviceDefinition.deviceRevision);
    expect(colorTemperatureLight.code).toBe(devices.ColorTemperatureLightDeviceDefinition.deviceType);
    expect(extendedColorLight.revision).toBe(devices.ExtendedColorLightDeviceDefinition.deviceRevision);
    expect(extendedColorLight.code).toBe(devices.ExtendedColorLightDeviceDefinition.deviceType);

    // Smart plugs / outlets / mounted controls
    expect(onOffOutlet.revision).toBe(devices.OnOffPlugInUnitDeviceDefinition.deviceRevision);
    expect(onOffOutlet.code).toBe(devices.OnOffPlugInUnitDeviceDefinition.deviceType);
    expect(dimmableOutlet.revision).toBe(devices.DimmablePlugInUnitDeviceDefinition.deviceRevision);
    expect(dimmableOutlet.code).toBe(devices.DimmablePlugInUnitDeviceDefinition.deviceType);
    expect(onOffMountedSwitch.revision).toBe(devices.MountedOnOffControlDeviceDefinition.deviceRevision);
    expect(onOffMountedSwitch.code).toBe(devices.MountedOnOffControlDeviceDefinition.deviceType);
    expect(dimmableMountedSwitch.revision).toBe(devices.MountedDimmableLoadControlDeviceDefinition.deviceRevision);
    expect(dimmableMountedSwitch.code).toBe(devices.MountedDimmableLoadControlDeviceDefinition.deviceType);
    expect(pumpDevice.revision).toBe(devices.PumpDeviceDefinition.deviceRevision);
    expect(pumpDevice.code).toBe(devices.PumpDeviceDefinition.deviceType);
    expect(waterValve.revision).toBe(devices.WaterValveDeviceDefinition.deviceRevision);
    expect(waterValve.code).toBe(devices.WaterValveDeviceDefinition.deviceType);

    // Switches and controls
    expect(onOffSwitch.revision).toBe(devices.OnOffLightSwitchDeviceDefinition.deviceRevision);
    expect(onOffSwitch.code).toBe(devices.OnOffLightSwitchDeviceDefinition.deviceType);
    expect(dimmableSwitch.revision).toBe(devices.DimmerSwitchDeviceDefinition.deviceRevision);
    expect(dimmableSwitch.code).toBe(devices.DimmerSwitchDeviceDefinition.deviceType);
    expect(colorTemperatureSwitch.revision).toBe(devices.ColorDimmerSwitchDeviceDefinition.deviceRevision);
    expect(colorTemperatureSwitch.code).toBe(devices.ColorDimmerSwitchDeviceDefinition.deviceType);
    expect(genericSwitch.revision).toBe(devices.GenericSwitchDeviceDefinition.deviceRevision);
    expect(genericSwitch.code).toBe(devices.GenericSwitchDeviceDefinition.deviceType);

    // Sensors
    expect(contactSensor.revision).toBe(devices.ContactSensorDeviceDefinition.deviceRevision);
    expect(contactSensor.code).toBe(devices.ContactSensorDeviceDefinition.deviceType);
    expect(lightSensor.revision).toBe(devices.LightSensorDeviceDefinition.deviceRevision);
    expect(lightSensor.code).toBe(devices.LightSensorDeviceDefinition.deviceType);
    expect(occupancySensor.revision).toBe(devices.OccupancySensorDeviceDefinition.deviceRevision);
    expect(occupancySensor.code).toBe(devices.OccupancySensorDeviceDefinition.deviceType);
    expect(temperatureSensor.revision).toBe(devices.TemperatureSensorDeviceDefinition.deviceRevision);
    expect(temperatureSensor.code).toBe(devices.TemperatureSensorDeviceDefinition.deviceType);
    expect(pressureSensor.revision).toBe(devices.PressureSensorDeviceDefinition.deviceRevision);
    expect(pressureSensor.code).toBe(devices.PressureSensorDeviceDefinition.deviceType);
    expect(flowSensor.revision).toBe(devices.FlowSensorDeviceDefinition.deviceRevision);
    expect(flowSensor.code).toBe(devices.FlowSensorDeviceDefinition.deviceType);
    expect(humiditySensor.revision).toBe(devices.HumiditySensorDeviceDefinition.deviceRevision);
    expect(humiditySensor.code).toBe(devices.HumiditySensorDeviceDefinition.deviceType);
    expect(smokeCoAlarm.revision).toBe(devices.SmokeCoAlarmDeviceDefinition.deviceRevision);
    expect(smokeCoAlarm.code).toBe(devices.SmokeCoAlarmDeviceDefinition.deviceType);
    expect(airQualitySensor.revision).toBe(devices.AirQualitySensorDeviceDefinition.deviceRevision);
    expect(airQualitySensor.code).toBe(devices.AirQualitySensorDeviceDefinition.deviceType);
    expect(waterFreezeDetector.revision).toBe(devices.WaterFreezeDetectorDeviceDefinition.deviceRevision);
    expect(waterFreezeDetector.code).toBe(devices.WaterFreezeDetectorDeviceDefinition.deviceType);
    expect(waterLeakDetector.revision).toBe(devices.WaterLeakDetectorDeviceDefinition.deviceRevision);
    expect(waterLeakDetector.code).toBe(devices.WaterLeakDetectorDeviceDefinition.deviceType);
    expect(rainSensor.revision).toBe(devices.RainSensorDeviceDefinition.deviceRevision);
    expect(rainSensor.code).toBe(devices.RainSensorDeviceDefinition.deviceType);

    // Closures
    expect(doorLockDevice.revision).toBe(devices.DoorLockDeviceDefinition.deviceRevision);
    expect(doorLockDevice.code).toBe(devices.DoorLockDeviceDefinition.deviceType);
    expect(coverDevice.revision).toBe(devices.WindowCoveringDeviceDefinition.deviceRevision);
    expect(coverDevice.code).toBe(devices.WindowCoveringDeviceDefinition.deviceType);

    // HVAC
    expect(thermostatDevice.revision).toBe(devices.ThermostatDeviceDefinition.deviceRevision);
    expect(thermostatDevice.code).toBe(devices.ThermostatDeviceDefinition.deviceType);
    expect(fanDevice.revision).toBe(devices.FanDeviceDefinition.deviceRevision);
    expect(fanDevice.code).toBe(devices.FanDeviceDefinition.deviceType);
    expect(airPurifier.revision).toBe(devices.AirPurifierDeviceDefinition.deviceRevision);
    expect(airPurifier.code).toBe(devices.AirPurifierDeviceDefinition.deviceType);

    // Media / entertainment
    expect(basicVideoPlayer.revision).toBe(devices.BasicVideoPlayerDeviceDefinition.deviceRevision);
    expect(basicVideoPlayer.code).toBe(devices.BasicVideoPlayerDeviceDefinition.deviceType);
    expect(castingVideoPlayer.revision).toBe(devices.CastingVideoPlayerDeviceDefinition.deviceRevision);
    expect(castingVideoPlayer.code).toBe(devices.CastingVideoPlayerDeviceDefinition.deviceType);
    expect(speakerDevice.revision).toBe(devices.SpeakerDeviceDefinition.deviceRevision);
    expect(speakerDevice.code).toBe(devices.SpeakerDeviceDefinition.deviceType);

    // Generic Device Types
    expect(modeSelect.revision).toBe(devices.ModeSelectDeviceDefinition.deviceRevision);
    expect(modeSelect.code).toBe(devices.ModeSelectDeviceDefinition.deviceType);
    expect(aggregator.revision).toBe(endpoints.AggregatorEndpointDefinition.deviceRevision);
    expect(aggregator.code).toBe(endpoints.AggregatorEndpointDefinition.deviceType);
    expect(bridge.revision).toBe(endpoints.AggregatorEndpointDefinition.deviceRevision);
    expect(bridge.code).toBe(endpoints.AggregatorEndpointDefinition.deviceType);
    expect(bridge).toBe(aggregator);

    // Appliances & complex devices
    expect(roboticVacuumCleaner.revision).toBe(devices.RoboticVacuumCleanerDeviceDefinition.deviceRevision);
    expect(roboticVacuumCleaner.code).toBe(devices.RoboticVacuumCleanerDeviceDefinition.deviceType);
    expect(laundryWasher.revision).toBe(devices.LaundryWasherDeviceDefinition.deviceRevision);
    expect(laundryWasher.code).toBe(devices.LaundryWasherDeviceDefinition.deviceType);
    expect(refrigerator.revision).toBe(devices.RefrigeratorDeviceDefinition.deviceRevision);
    expect(refrigerator.code).toBe(devices.RefrigeratorDeviceDefinition.deviceType);
    expect(airConditioner.revision).toBe(devices.RoomAirConditionerDeviceDefinition.deviceRevision);
    expect(airConditioner.code).toBe(devices.RoomAirConditionerDeviceDefinition.deviceType);
    expect(temperatureControlledCabinetCooler.revision).toBe(devices.TemperatureControlledCabinetDeviceDefinition.deviceRevision);
    expect(temperatureControlledCabinetCooler.code).toBe(devices.TemperatureControlledCabinetDeviceDefinition.deviceType);
    expect(temperatureControlledCabinetHeater.revision).toBe(devices.TemperatureControlledCabinetDeviceDefinition.deviceRevision);
    expect(temperatureControlledCabinetHeater.code).toBe(devices.TemperatureControlledCabinetDeviceDefinition.deviceType);
    expect(dishwasher.revision).toBe(devices.DishwasherDeviceDefinition.deviceRevision);
    expect(dishwasher.code).toBe(devices.DishwasherDeviceDefinition.deviceType);
    expect(laundryDryer.revision).toBe(devices.LaundryDryerDeviceDefinition.deviceRevision);
    expect(laundryDryer.code).toBe(devices.LaundryDryerDeviceDefinition.deviceType);
    expect(cookSurface.revision).toBe(devices.CookSurfaceDeviceDefinition.deviceRevision);
    expect(cookSurface.code).toBe(devices.CookSurfaceDeviceDefinition.deviceType);
    expect(cooktop.revision).toBe(devices.CooktopDeviceDefinition.deviceRevision);
    expect(cooktop.code).toBe(devices.CooktopDeviceDefinition.deviceType);
    expect(oven.revision).toBe(devices.OvenDeviceDefinition.deviceRevision);
    expect(oven.code).toBe(devices.OvenDeviceDefinition.deviceType);
    expect(extractorHood.revision).toBe(devices.ExtractorHoodDeviceDefinition.deviceRevision);
    expect(extractorHood.code).toBe(devices.ExtractorHoodDeviceDefinition.deviceType);
    expect(microwaveOven.revision).toBe(devices.MicrowaveOvenDeviceDefinition.deviceRevision);
    expect(microwaveOven.code).toBe(devices.MicrowaveOvenDeviceDefinition.deviceType);

    // Energy & environment
    expect(evse.revision).toBe(devices.EnergyEvseDeviceDefinition.deviceRevision);
    expect(evse.code).toBe(devices.EnergyEvseDeviceDefinition.deviceType);
    expect(waterHeater.revision).toBe(devices.WaterHeaterDeviceDefinition.deviceRevision);
    expect(waterHeater.code).toBe(devices.WaterHeaterDeviceDefinition.deviceType);
    expect(solarPower.revision).toBe(devices.SolarPowerDeviceDefinition.deviceRevision);
    expect(solarPower.code).toBe(devices.SolarPowerDeviceDefinition.deviceType);
    expect(batteryStorage.revision).toBe(devices.BatteryStorageDeviceDefinition.deviceRevision);
    expect(batteryStorage.code).toBe(devices.BatteryStorageDeviceDefinition.deviceType);
    expect(heatPump.revision).toBe(devices.HeatPumpDeviceDefinition.deviceRevision);
    expect(heatPump.code).toBe(devices.HeatPumpDeviceDefinition.deviceType);
  });
});
