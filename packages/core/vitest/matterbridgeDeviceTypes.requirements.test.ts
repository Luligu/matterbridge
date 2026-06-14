// vitest\matterbridgeDeviceTypes.requirements.test.ts

/* eslint-disable simple-import-sort/imports */

const NAME = 'MatterbridgeDevicetypesRequirements';

import * as devices from '@matter/node/devices';
import * as endpoints from '@matter/node/endpoints';

import { setupTest } from '@matterbridge/vitest-utils';
import {
  // Utility
  rootNode,
  powerSource,
  otaRequestor,
  otaProvider,
  bridgedNode,
  electricalSensor,
  deviceEnergyManagement,
  // Lighting
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
  // Switches & controls
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
  // Generic device types
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
} from '../src/matterbridgeDeviceTypes.js';

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
  { name: 'otaRequestor', mb: otaRequestor, md: endpoints.OtaRequestorEndpointDefinition },
  { name: 'otaProvider', mb: otaProvider, md: endpoints.OtaProviderEndpointDefinition },
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
  { name: 'onOffPlugInUnit', mb: onOffPlugInUnit, md: devices.OnOffPlugInUnitDeviceDefinition },
  { name: 'dimmablePlugInUnit', mb: dimmablePlugInUnit, md: devices.DimmablePlugInUnitDeviceDefinition },
  { name: 'mountedOnOffControl', mb: mountedOnOffControl, md: devices.MountedOnOffControlDeviceDefinition },
  { name: 'mountedDimmableLoadControl', mb: mountedDimmableLoadControl, md: devices.MountedDimmableLoadControlDeviceDefinition },
  { name: 'pump', mb: pump, md: devices.PumpDeviceDefinition },
  { name: 'waterValve', mb: waterValve, md: devices.WaterValveDeviceDefinition },

  // Switches & controls
  { name: 'onOffLightSwitch', mb: onOffLightSwitch, md: devices.OnOffLightSwitchDeviceDefinition },
  { name: 'dimmerSwitch', mb: dimmerSwitch, md: devices.DimmerSwitchDeviceDefinition },
  { name: 'colorDimmerSwitch', mb: colorDimmerSwitch, md: devices.ColorDimmerSwitchDeviceDefinition },
  { name: 'controlBridge', mb: controlBridge, md: devices.ControlBridgeDeviceDefinition },
  { name: 'pumpController', mb: pumpController, md: devices.PumpControllerDeviceDefinition },
  { name: 'genericSwitch', mb: genericSwitch, md: devices.GenericSwitchDeviceDefinition },

  // Sensors
  { name: 'contactSensor', mb: contactSensor, md: devices.ContactSensorDeviceDefinition },
  { name: 'lightSensor', mb: lightSensor, md: devices.LightSensorDeviceDefinition },
  { name: 'occupancySensor', mb: occupancySensor, md: devices.OccupancySensorDeviceDefinition },
  { name: 'temperatureSensor', mb: temperatureSensor, md: devices.TemperatureSensorDeviceDefinition },
  { name: 'pressureSensor', mb: pressureSensor, md: devices.PressureSensorDeviceDefinition },
  { name: 'flowSensor', mb: flowSensor, md: devices.FlowSensorDeviceDefinition },
  { name: 'humiditySensor', mb: humiditySensor, md: devices.HumiditySensorDeviceDefinition },
  { name: 'onOffSensor', mb: onOffSensor, md: devices.OnOffSensorDeviceDefinition },
  { name: 'smokeCoAlarm', mb: smokeCoAlarm, md: devices.SmokeCoAlarmDeviceDefinition },
  { name: 'airQualitySensor', mb: airQualitySensor, md: devices.AirQualitySensorDeviceDefinition },
  { name: 'waterFreezeDetector', mb: waterFreezeDetector, md: devices.WaterFreezeDetectorDeviceDefinition },
  { name: 'waterLeakDetector', mb: waterLeakDetector, md: devices.WaterLeakDetectorDeviceDefinition },
  { name: 'rainSensor', mb: rainSensor, md: devices.RainSensorDeviceDefinition },

  // Closures
  { name: 'doorLock', mb: doorLock, md: devices.DoorLockDeviceDefinition },
  { name: 'doorLockController', mb: doorLockController, md: devices.DoorLockControllerDeviceDefinition },
  { name: 'windowCovering', mb: windowCovering, md: devices.WindowCoveringDeviceDefinition },
  { name: 'windowCoveringController', mb: windowCoveringController, md: devices.WindowCoveringControllerDeviceDefinition },

  // HVAC
  { name: 'thermostat', mb: thermostat, md: devices.ThermostatDeviceDefinition },
  { name: 'thermostatController', mb: thermostatController, md: devices.ThermostatControllerDeviceDefinition },
  { name: 'fan', mb: fan, md: devices.FanDeviceDefinition },
  { name: 'airPurifier', mb: airPurifier, md: devices.AirPurifierDeviceDefinition },

  // Media
  { name: 'basicVideoPlayer', mb: basicVideoPlayer, md: devices.BasicVideoPlayerDeviceDefinition },
  { name: 'castingVideoPlayer', mb: castingVideoPlayer, md: devices.CastingVideoPlayerDeviceDefinition },
  { name: 'speaker', mb: speaker, md: devices.SpeakerDeviceDefinition },
  { name: 'contentApp', mb: contentApp, md: devices.ContentAppDeviceDefinition },
  { name: 'castingVideoClient', mb: castingVideoClient, md: devices.CastingVideoClientDeviceDefinition },
  { name: 'videoRemoteControl', mb: videoRemoteControl, md: devices.VideoRemoteControlDeviceDefinition },

  // Generic device types
  { name: 'modeSelect', mb: modeSelect, md: devices.ModeSelectDeviceDefinition },

  // Appliances & complex devices
  { name: 'roboticVacuumCleaner', mb: roboticVacuumCleaner, md: devices.RoboticVacuumCleanerDeviceDefinition },
  { name: 'laundryWasher', mb: laundryWasher, md: devices.LaundryWasherDeviceDefinition },
  { name: 'refrigerator', mb: refrigerator, md: devices.RefrigeratorDeviceDefinition },
  { name: 'roomAirConditioner', mb: roomAirConditioner, md: devices.RoomAirConditionerDeviceDefinition },
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

  // Matter 1.5.1 Device types
  { name: 'closure', mb: closure, md: devices.ClosureDeviceDefinition },
  { name: 'closurePanel', mb: closurePanel, md: devices.ClosurePanelDeviceDefinition },
  { name: 'closureController', mb: closureController, md: devices.ClosureControllerDeviceDefinition },
  { name: 'irrigationSystem', mb: irrigationSystem, md: devices.IrrigationSystemDeviceDefinition },
  { name: 'soilSensor', mb: soilSensor, md: devices.SoilSensorDeviceDefinition },
  { name: 'meterReferencePoint', mb: meterReferencePoint, md: devices.MeterReferencePointDeviceDefinition },
  { name: 'electricalEnergyTariff', mb: electricalEnergyTariff, md: devices.ElectricalEnergyTariffDeviceDefinition },
  { name: 'electricalMeter', mb: electricalMeter, md: devices.ElectricalMeterDeviceDefinition },
  { name: 'electricalUtilityMeter', mb: electricalUtilityMeter, md: devices.ElectricalUtilityMeterDeviceDefinition },
  { name: 'camera', mb: camera, md: devices.CameraDeviceDefinition },
  { name: 'floodlightCamera', mb: floodlightCamera, md: devices.FloodlightCameraDeviceDefinition },
  { name: 'videoDoorbell', mb: videoDoorbell, md: devices.VideoDoorbellDeviceDefinition },
  { name: 'intercom', mb: intercom, md: devices.IntercomDeviceDefinition },
  { name: 'audioDoorbell', mb: audioDoorbell, md: devices.AudioDoorbellDeviceDefinition },
  { name: 'snapshotCamera', mb: snapshotCamera, md: devices.SnapshotCameraDeviceDefinition },
  { name: 'chime', mb: chime, md: devices.ChimeDeviceDefinition },
  { name: 'cameraController', mb: cameraController, md: devices.CameraControllerDeviceDefinition },
  { name: 'doorbell', mb: doorbell, md: devices.DoorbellDeviceDefinition },
];

const failures: string[] = [];

describe('Matterbridge device cluster mappings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

      // Server required clusters
      const serverRequiredOk = setEquals(mbServerRequired, mandatoryServerSet);
      if (!serverRequiredOk) {
        const failure = `${name}: required mismatch -> mb=[${[...mbServerRequired].join(',')}] md=[${[...mandatoryServerSet].join(',')}]`;
        failures.push(failure);
        // console.warn('Required validation failure:', failure); // eslint-disable-line no-console
      }

      // Server optional clusters
      const serverOptionalOk = setEquals(mbServerOptional, optionalServerSet);
      if (!serverOptionalOk) {
        const failure = `${name}: optional mismatch -> mb=[${[...mbServerOptional].join(',')}] md=[${[...optionalServerSet].join(',')}]`;
        failures.push(failure);
        // console.warn('Optional validation failure:', failure); // eslint-disable-line no-console
      }

      // Ensure no overlap between server required and optional in Matterbridge definition
      let serverOverlapOk = true;
      for (const id of mbServerRequired) {
        if (mbServerOptional.has(id)) {
          serverOverlapOk = false;
          const failure = `${name}: cluster ${id} listed in both required and optional`;
          failures.push(failure);
          // console.warn('Overlap validation failure:', failure); // eslint-disable-line no-console
        }
      }

      const mandatoryClientSet = asSet(extractClusterIds(md.requirements?.client?.mandatory ?? {}));
      const optionalClientSet = asSet(extractClusterIds(md.requirements?.client?.optional ?? {}));
      const mbClientRequired = asSet(mb.requiredClientClusters ?? []);
      const mbClientOptional = asSet(mb.optionalClientClusters ?? []);

      // Client required clusters
      const clientRequiredOk = setEquals(mbClientRequired, mandatoryClientSet);
      if (!clientRequiredOk) {
        const failure = `${name}: client required mismatch -> mb=[${[...mbClientRequired].join(',')}] md=[${[...mandatoryClientSet].join(',')}]`;
        failures.push(failure);
        // console.warn('Client required validation failure:', failure); // eslint-disable-line no-console
      }

      // Client optional clusters
      const clientOptionalOk = setEquals(mbClientOptional, optionalClientSet);
      if (!clientOptionalOk) {
        const failure = `${name}: client optional mismatch -> mb=[${[...mbClientOptional].join(',')}] md=[${[...optionalClientSet].join(',')}]`;
        failures.push(failure);
        // console.warn('Client optional validation failure:', failure); // eslint-disable-line no-console
      }

      // Ensure no overlap between client required and optional in Matterbridge definition
      let clientOverlapOk = true;
      for (const id of mbClientRequired) {
        if (mbClientOptional.has(id)) {
          clientOverlapOk = false;
          const failure = `${name}: client cluster ${id} listed in both required and optional`;
          failures.push(failure);
          // console.warn('Client overlap validation failure:', failure); // eslint-disable-line no-console
        }
      }

      expect(serverRequiredOk).toBeDefined();
      expect(serverOptionalOk).toBeDefined();
      expect(serverOverlapOk).toBeDefined();
      expect(clientRequiredOk).toBeDefined();
      expect(clientOptionalOk).toBeDefined();
      expect(clientOverlapOk).toBeDefined();
    });
  }

  test('summary of all cluster validation failures', () => {
    if (failures.length) {
      console.warn('Cluster validation failures:', failures); // eslint-disable-line no-console
    }
    expect(failures).toEqual([
      // Failures are listed in device-definition order; for each device: server checks then client checks
      'rootNode: required mismatch -> mb=[] md=[31,40,48,51,60,62,63]', // omitted to avoid imports
      'rootNode: optional mismatch -> mb=[] md=[43,44,45,46,49,50,52,53,54,55,56,70,2049,2050]', // omitted to avoid imports
      'rootNode: client optional mismatch -> mb=[] md=[56]', // omitted to avoid imports
      'bridgedNode: optional mismatch -> mb=[47,1872,60] md=[46,47,60,1872]', // omitted PowerSourceConfiguration cause is deprecated in matter specs but present in matter.js
      'temperatureControlledCabinetCooler: required mismatch -> mb=[86,82] md=[86]', // Double device type to account for heater/cooler and just one in matter.js
      'temperatureControlledCabinetCooler: optional mismatch -> mb=[1026] md=[1026,82,73,72]', // Double device type to account for heater/cooler and just one in matter.js
      'temperatureControlledCabinetHeater: required mismatch -> mb=[86,73,72] md=[86]', // Double device type to account for heater/cooler and just one in matter.js
      'temperatureControlledCabinetHeater: optional mismatch -> mb=[1026] md=[1026,82,73,72]', // Double device type to account for heater/cooler and just one in matter.js
    ]);
  });
});
