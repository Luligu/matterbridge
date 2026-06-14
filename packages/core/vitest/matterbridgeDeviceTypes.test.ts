// vitest\matterbridgeDeviceTypes.test.ts

/* eslint-disable simple-import-sort/imports */

const NAME = 'MatterbridgeDevicetypes';

import * as devices from '@matter/node/devices';
// @matter endpoints
import * as endpoints from '@matter/node/endpoints';
import { OnOff } from '@matter/types/clusters/on-off';

import { setupTest } from '@matterbridge/vitest-utils';
import {
  DeviceTypeDefinition,
  getSupportedCluster,
  getSupportedDeviceType,
  supportedClusters,
  supportedDeviceTypes,
  // Utility device types
  rootNode,
  powerSource,
  otaRequestor,
  otaProvider,
  bridgedNode,
  electricalSensor,
  deviceEnergyManagement,
  // Lighting device types
  onOffLight,
  dimmableLight,
  colorTemperatureLight,
  extendedColorLight,
  // Smart plugs / actuators
  onOffPlugInUnit,
  dimmablePlugInUnit,
  mountedOnOffControl,
  mountedDimmableLoadControl,
  pump,
  waterValve,
  // Switches and Controls
  onOffLightSwitch,
  dimmerSwitch,
  colorDimmerSwitch,
  controlBridge,
  pumpController,
  genericSwitch,
  // Sensors
  contactSensor,
  lightSensor,
  occupancySensor,
  temperatureSensor,
  pressureSensor,
  flowSensor,
  humiditySensor,
  onOffSensor,
  smokeCoAlarm,
  airQualitySensor,
  waterFreezeDetector,
  waterLeakDetector,
  rainSensor,
  // Closures
  doorLock,
  doorLockController,
  windowCovering,
  windowCoveringController,
  // HVAC
  thermostat,
  thermostatController,
  fan,
  airPurifier,
  // Media
  basicVideoPlayer,
  castingVideoPlayer,
  speaker,
  contentApp,
  castingVideoClient,
  videoRemoteControl,
  // Generic Device Types
  modeSelect,
  aggregator,
  bridge,
  // Appliances & complex devices
  roboticVacuumCleaner,
  laundryWasher,
  refrigerator,
  roomAirConditioner,
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
  // Matter 1.5.1 device types
  closure,
  closurePanel,
  closureController,
  irrigationSystem,
  soilSensor,
  meterReferencePoint,
  electricalEnergyTariff,
  electricalMeter,
  electricalUtilityMeter,
  camera,
  floodlightCamera,
  videoDoorbell,
  intercom,
  audioDoorbell,
  snapshotCamera,
  chime,
  cameraController,
  doorbell,
  DeviceClasses,
  DeviceScopes,
} from '../src/matterbridgeDeviceTypes.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge device types', () => {
  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterAll(async () => {
    // Restore all mocks
    vi.restoreAllMocks();
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
    { name: 'otaRequestor', device: otaRequestor, def: endpoints.OtaRequestorEndpointDefinition },
    { name: 'otaProvider', device: otaProvider, def: endpoints.OtaProviderEndpointDefinition },
    { name: 'bridgedNode', device: bridgedNode, def: endpoints.BridgedNodeEndpointDefinition },
    { name: 'electricalSensor', device: electricalSensor, def: endpoints.ElectricalSensorEndpointDefinition },
    { name: 'deviceEnergyManagement', device: deviceEnergyManagement, def: endpoints.DeviceEnergyManagementEndpointDefinition },

    // Lighting
    { name: 'onOffLight', device: onOffLight, def: devices.OnOffLightDeviceDefinition },
    { name: 'dimmableLight', device: dimmableLight, def: devices.DimmableLightDeviceDefinition },
    { name: 'colorTemperatureLight', device: colorTemperatureLight, def: devices.ColorTemperatureLightDeviceDefinition },
    { name: 'extendedColorLight', device: extendedColorLight, def: devices.ExtendedColorLightDeviceDefinition },

    // Smart plugs / actuators
    { name: 'onOffPlugInUnit', device: onOffPlugInUnit, def: devices.OnOffPlugInUnitDeviceDefinition },
    { name: 'dimmablePlugInUnit', device: dimmablePlugInUnit, def: devices.DimmablePlugInUnitDeviceDefinition },
    { name: 'mountedOnOffControl', device: mountedOnOffControl, def: devices.MountedOnOffControlDeviceDefinition },
    { name: 'mountedDimmableLoadControl', device: mountedDimmableLoadControl, def: devices.MountedDimmableLoadControlDeviceDefinition },
    { name: 'pump', device: pump, def: devices.PumpDeviceDefinition },
    { name: 'waterValve', device: waterValve, def: devices.WaterValveDeviceDefinition },

    // Switches and Controls
    { name: 'onOffLightSwitch', device: onOffLightSwitch, def: devices.OnOffLightSwitchDeviceDefinition },
    { name: 'dimmerSwitch', device: dimmerSwitch, def: devices.DimmerSwitchDeviceDefinition },
    { name: 'colorDimmerSwitch', device: colorDimmerSwitch, def: devices.ColorDimmerSwitchDeviceDefinition },
    { name: 'controlBridge', device: controlBridge, def: devices.ControlBridgeDeviceDefinition },
    { name: 'pumpController', device: pumpController, def: devices.PumpControllerDeviceDefinition },
    { name: 'genericSwitch', device: genericSwitch, def: devices.GenericSwitchDeviceDefinition },

    // Sensors
    { name: 'contactSensor', device: contactSensor, def: devices.ContactSensorDeviceDefinition },
    { name: 'lightSensor', device: lightSensor, def: devices.LightSensorDeviceDefinition },
    { name: 'occupancySensor', device: occupancySensor, def: devices.OccupancySensorDeviceDefinition },
    { name: 'temperatureSensor', device: temperatureSensor, def: devices.TemperatureSensorDeviceDefinition },
    { name: 'pressureSensor', device: pressureSensor, def: devices.PressureSensorDeviceDefinition },
    { name: 'flowSensor', device: flowSensor, def: devices.FlowSensorDeviceDefinition },
    { name: 'humiditySensor', device: humiditySensor, def: devices.HumiditySensorDeviceDefinition },
    { name: 'onOffSensor', device: onOffSensor, def: devices.OnOffSensorDeviceDefinition },
    { name: 'smokeCoAlarm', device: smokeCoAlarm, def: devices.SmokeCoAlarmDeviceDefinition },
    { name: 'airQualitySensor', device: airQualitySensor, def: devices.AirQualitySensorDeviceDefinition },
    { name: 'waterFreezeDetector', device: waterFreezeDetector, def: devices.WaterFreezeDetectorDeviceDefinition },
    { name: 'waterLeakDetector', device: waterLeakDetector, def: devices.WaterLeakDetectorDeviceDefinition },
    { name: 'rainSensor', device: rainSensor, def: devices.RainSensorDeviceDefinition },

    // Closures
    { name: 'doorLock', device: doorLock, def: devices.DoorLockDeviceDefinition },
    { name: 'doorLockController', device: doorLockController, def: devices.DoorLockControllerDeviceDefinition },
    { name: 'windowCovering', device: windowCovering, def: devices.WindowCoveringDeviceDefinition },
    { name: 'windowCoveringController', device: windowCoveringController, def: devices.WindowCoveringControllerDeviceDefinition },

    // HVAC
    { name: 'thermostat', device: thermostat, def: devices.ThermostatDeviceDefinition },
    { name: 'thermostatController', device: thermostatController, def: devices.ThermostatControllerDeviceDefinition },
    { name: 'fan', device: fan, def: devices.FanDeviceDefinition },
    { name: 'airPurifier', device: airPurifier, def: devices.AirPurifierDeviceDefinition },

    // Media
    { name: 'basicVideoPlayer', device: basicVideoPlayer, def: devices.BasicVideoPlayerDeviceDefinition },
    { name: 'castingVideoPlayer', device: castingVideoPlayer, def: devices.CastingVideoPlayerDeviceDefinition },
    { name: 'speaker', device: speaker, def: devices.SpeakerDeviceDefinition },
    { name: 'contentApp', device: contentApp, def: devices.ContentAppDeviceDefinition },
    { name: 'castingVideoClient', device: castingVideoClient, def: devices.CastingVideoClientDeviceDefinition },
    { name: 'videoRemoteControl', device: videoRemoteControl, def: devices.VideoRemoteControlDeviceDefinition },

    // Generic Device Types
    { name: 'modeSelect', device: modeSelect, def: devices.ModeSelectDeviceDefinition },
    { name: 'aggregator', device: aggregator, def: endpoints.AggregatorEndpointDefinition },
    { name: 'bridge', device: bridge, def: endpoints.AggregatorEndpointDefinition },

    // Appliances & complex devices
    { name: 'roboticVacuumCleaner', device: roboticVacuumCleaner, def: devices.RoboticVacuumCleanerDeviceDefinition },
    { name: 'laundryWasher', device: laundryWasher, def: devices.LaundryWasherDeviceDefinition },
    { name: 'refrigerator', device: refrigerator, def: devices.RefrigeratorDeviceDefinition },
    { name: 'roomAirConditioner', device: roomAirConditioner, def: devices.RoomAirConditionerDeviceDefinition },
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

    // Matter 1.5.1 Device types
    { name: 'closure', device: closure, def: devices.ClosureDeviceDefinition },
    { name: 'closurePanel', device: closurePanel, def: devices.ClosurePanelDeviceDefinition },
    { name: 'closureController', device: closureController, def: devices.ClosureControllerDeviceDefinition },
    { name: 'irrigationSystem', device: irrigationSystem, def: devices.IrrigationSystemDeviceDefinition },
    { name: 'soilSensor', device: soilSensor, def: devices.SoilSensorDeviceDefinition },
    { name: 'meterReferencePoint', device: meterReferencePoint, def: devices.MeterReferencePointDeviceDefinition },
    { name: 'electricalEnergyTariff', device: electricalEnergyTariff, def: devices.ElectricalEnergyTariffDeviceDefinition },
    { name: 'electricalMeter', device: electricalMeter, def: devices.ElectricalMeterDeviceDefinition },
    { name: 'electricalUtilityMeter', device: electricalUtilityMeter, def: devices.ElectricalUtilityMeterDeviceDefinition },
    { name: 'camera', device: camera, def: devices.CameraDeviceDefinition },
    { name: 'floodlightCamera', device: floodlightCamera, def: devices.FloodlightCameraDeviceDefinition },
    { name: 'videoDoorbell', device: videoDoorbell, def: devices.VideoDoorbellDeviceDefinition },
    { name: 'intercom', device: intercom, def: devices.IntercomDeviceDefinition },
    { name: 'audioDoorbell', device: audioDoorbell, def: devices.AudioDoorbellDeviceDefinition },
    { name: 'snapshotCamera', device: snapshotCamera, def: devices.SnapshotCameraDeviceDefinition },
    { name: 'chime', device: chime, def: devices.ChimeDeviceDefinition },
    { name: 'cameraController', device: cameraController, def: devices.CameraControllerDeviceDefinition },
    { name: 'doorbell', device: doorbell, def: devices.DoorbellDeviceDefinition },
  ];

  for (const { name, device, def } of entries) {
    test(`${name} code 0x${device.code.toString(16)} revision ${device.revision} >>> ${def.deviceRevision}`, () => {
      expect.hasAssertions();
      expectWithLog(`${name}.revision`, device.revision, def.deviceRevision);
      expectWithLog(`${name}.code`, device.code, def.deviceType);
    });
  }

  test('DeviceTypeDefinition', () => {
    const dt = DeviceTypeDefinition({
      name: 'RootNode',
      code: 0x0016,
      deviceClass: DeviceClasses.Node,
      deviceScope: DeviceScopes.Node,
      revision: 3,
    });
    expect(dt.name).toBe('RootNode');
    expect(dt.code).toBe(0x0016);
    expect(dt.deviceClass).toBe(DeviceClasses.Node);
    expect(dt.deviceScope).toBe(DeviceScopes.Node);
    expect(dt.revision).toBe(3);
  });

  test('should get supported device types by string or number key', () => {
    expect.hasAssertions();
    expect(supportedDeviceTypes).toContain(rootNode);
    expect(getSupportedDeviceType(rootNode.code)).toBe(rootNode);
    expect(getSupportedDeviceType(rootNode.name)).toBe(rootNode);
    expect(getSupportedDeviceType(0xffff)).toBeUndefined();
    expect(getSupportedDeviceType('Unknown Device Type')).toBeUndefined();
  });

  test('should get supported clusters by string or number key', () => {
    expect.hasAssertions();
    expect(supportedClusters).toContain(OnOff);
    expect(getSupportedCluster(OnOff.id)).toBe(OnOff);
    expect(getSupportedCluster(OnOff.name)).toBe(OnOff);
    expect(getSupportedCluster(0xffff)).toBeUndefined();
    expect(getSupportedCluster('UnknownCluster')).toBeUndefined();
  });
});
