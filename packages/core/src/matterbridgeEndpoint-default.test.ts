// src\matterbridgeEndpoint-default.test.ts

const NAME = 'EndpointDefault';
const MATTER_PORT = 11200;
const MATTER_CREATE_ONLY = true;
const HOMEDIR = path.join('.cache', 'jest', NAME);

process.argv = [
  'node',
  'matterbridge.js',
  '-mdnsInterface',
  'Wi-Fi',
  '-frontend',
  '0',
  '-port',
  MATTER_PORT.toString(),
  '-homedir',
  HOMEDIR,
  '-bridge',
  '-logger',
  'debug',
  '-matterlogger',
  'debug',
];

import path from 'node:path';

import { jest } from '@jest/globals';
import { type Endpoint, type ServerNode } from '@matter/node';
import {
  AirQualityServer,
  BooleanStateServer,
  CarbonDioxideConcentrationMeasurementServer,
  CarbonMonoxideConcentrationMeasurementServer,
  ColorControlBehavior,
  ColorControlServer,
  DescriptorBehavior,
  FormaldehydeConcentrationMeasurementServer,
  NitrogenDioxideConcentrationMeasurementServer,
  OccupancySensingServer,
  OzoneConcentrationMeasurementServer,
  Pm1ConcentrationMeasurementServer,
  Pm10ConcentrationMeasurementServer,
  Pm25ConcentrationMeasurementServer,
  RadonConcentrationMeasurementServer,
  SoilMeasurementServer,
  TotalVolatileOrganicCompoundsConcentrationMeasurementServer,
} from '@matter/node/behaviors';
import { FanControlServer } from '@matter/node/behaviors/fan-control';
import { type AggregatorEndpoint } from '@matter/node/endpoints/aggregator';
import {
  ActivatedCarbonFilterMonitoring,
  AirQuality,
  BasicInformation,
  BooleanState,
  BooleanStateConfiguration,
  BridgedDeviceBasicInformation,
  ColorControl,
  DeviceEnergyManagement,
  DeviceEnergyManagementMode,
  DoorLock,
  ElectricalEnergyMeasurement,
  ElectricalGridConditions,
  ElectricalPowerMeasurement,
  FanControl,
  FixedLabel,
  FlowMeasurement,
  Groups,
  HepaFilterMonitoring,
  Identify,
  IlluminanceMeasurement,
  LevelControl,
  ModeSelect,
  OccupancySensing,
  OnOff,
  OtaSoftwareUpdateProvider,
  OtaSoftwareUpdateRequestor,
  PowerSource,
  PowerTopology,
  PressureMeasurement,
  PumpConfigurationAndControl,
  RelativeHumidityMeasurement,
  ResourceMonitoring,
  ScenesManagement,
  SmokeCoAlarm,
  SoilMeasurement,
  Switch,
  TemperatureMeasurement,
  Thermostat,
  ThermostatUserInterfaceConfiguration,
  UserLabel,
  ValveConfigurationAndControl,
  WindowCovering,
} from '@matter/types/clusters';
import { BLUE, db, er, hk, LogLevel, or } from 'node-ansi-logger';

import { flushAsync } from './jestutils/flushAsync.js';
import {
  createMatterbridgeEnvironment,
  destroyMatterbridgeEnvironment,
  matterbridge,
  startMatterbridgeEnvironment,
  stopMatterbridgeEnvironment,
} from './jestutils/jestMatterbridgeTest.js';
import { addDevice } from './jestutils/jestMatterTest.js';
import { loggerLogSpy, setDebug, setupTest } from './jestutils/jestSetupTest.js';
import {
  airPurifier,
  airQualitySensor,
  contactSensor,
  doorLock,
  electricalSensor,
  fan,
  flowSensor,
  genericSwitch,
  humiditySensor,
  lightSensor,
  modeSelect,
  occupancySensor,
  onOffLight,
  powerSource,
  pressureSensor,
  pump,
  rainSensor,
  smokeCoAlarm,
  soilSensor,
  temperatureSensor,
  thermostat,
  waterFreezeDetector,
  waterLeakDetector,
  waterValve,
  windowCovering,
} from './matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import {
  capitalizeFirstLetter,
  featuresFor,
  getBehaviourTypeFromClusterClientId,
  getBehaviourTypeFromClusterServerId,
  getBehaviourTypesFromClusterClientIds,
  lowercaseFirstLetter,
  updateAttribute,
} from './matterbridgeEndpointHelpers.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  let server: ServerNode;
  let aggregator: Endpoint<AggregatorEndpoint>;

  beforeAll(async () => {
    // Create Matterbridge environment
    await createMatterbridgeEnvironment();
    [server, aggregator] = await startMatterbridgeEnvironment(MATTER_PORT, MATTER_CREATE_ONLY);
  }, 30000);

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {});

  afterAll(async () => {
    // Destroy Matterbridge environment
    await stopMatterbridgeEnvironment(MATTER_CREATE_ONLY);
    await destroyMatterbridgeEnvironment();
    // Restore all mocks
    jest.restoreAllMocks();
  }, 30000);

  async function add(device: MatterbridgeEndpoint): Promise<void> {
    expect(device).toBeDefined();
    device.addRequiredClusterServers();
    expect(await addDevice(aggregator, device)).toBe(true);
  }

  test('capitalizeFirstLetter', async () => {
    const result = capitalizeFirstLetter('hello');
    expect(result).toBe('Hello');
    expect(capitalizeFirstLetter(null as any)).toBe(null);
  });

  test('lowercaseFirstLetter', async () => {
    const result = lowercaseFirstLetter('Hello');
    expect(result).toBe('hello');
    expect(lowercaseFirstLetter(null as any)).toBe(null);
  });

  test('getBehaviourTypeFromClusterServerId', async () => {
    expect(getBehaviourTypeFromClusterServerId(PowerSource.id)?.id).toBe('powerSource');
    expect(getBehaviourTypeFromClusterServerId(UserLabel.id)?.id).toBe('userLabel');
    expect(getBehaviourTypeFromClusterServerId(FixedLabel.id)?.id).toBe('fixedLabel');
    expect(getBehaviourTypeFromClusterServerId(BasicInformation.id)?.id).toBe('basicInformation');
    expect(getBehaviourTypeFromClusterServerId(BridgedDeviceBasicInformation.id)?.id).toBe('bridgedDeviceBasicInformation');
    expect(getBehaviourTypeFromClusterServerId(DeviceEnergyManagement.id)?.id).toBe('deviceEnergyManagement');
    expect(getBehaviourTypeFromClusterServerId(DeviceEnergyManagementMode.id)?.id).toBe('deviceEnergyManagementMode');
  });

  test('getBehaviourTypesFromClusterClientIds', async () => {
    const clusterIds = [
      Identify.id,
      Groups.id,
      OnOff.id,
      LevelControl.id,
      ColorControl.id,
      OccupancySensing.id,
      ScenesManagement.id,
      DoorLock.id,
      ElectricalGridConditions.id,
      FanControl.id,
      FlowMeasurement.id,
      IlluminanceMeasurement.id,
      OtaSoftwareUpdateProvider.id,
      OtaSoftwareUpdateRequestor.id,
      PressureMeasurement.id,
      PumpConfigurationAndControl.id,
      RelativeHumidityMeasurement.id,
      TemperatureMeasurement.id,
      Thermostat.id,
      WindowCovering.id,
    ];
    const result = getBehaviourTypesFromClusterClientIds(clusterIds);
    expect(result).toHaveLength(20);
    expect(result.map((b) => (b as any).cluster?.id)).toEqual(clusterIds);
    expect(getBehaviourTypesFromClusterClientIds([0xffff as any])).toEqual([]);
  });

  test('getBehaviourTypeFromClusterClientId', async () => {
    expect((getBehaviourTypeFromClusterClientId(Identify.id) as any)?.cluster?.id).toBe(Identify.id);
    expect((getBehaviourTypeFromClusterClientId(Groups.id) as any)?.cluster?.id).toBe(Groups.id);
    expect((getBehaviourTypeFromClusterClientId(OnOff.id) as any)?.cluster?.id).toBe(OnOff.id);
    expect((getBehaviourTypeFromClusterClientId(LevelControl.id) as any)?.cluster?.id).toBe(LevelControl.id);
    expect((getBehaviourTypeFromClusterClientId(ColorControl.id) as any)?.cluster?.id).toBe(ColorControl.id);
    expect((getBehaviourTypeFromClusterClientId(OccupancySensing.id) as any)?.cluster?.id).toBe(OccupancySensing.id);
    expect((getBehaviourTypeFromClusterClientId(ScenesManagement.id) as any)?.cluster?.id).toBe(ScenesManagement.id);
    expect((getBehaviourTypeFromClusterClientId(DoorLock.id) as any)?.cluster?.id).toBe(DoorLock.id);
    expect((getBehaviourTypeFromClusterClientId(ElectricalGridConditions.id) as any)?.cluster?.id).toBe(ElectricalGridConditions.id);
    expect((getBehaviourTypeFromClusterClientId(FanControl.id) as any)?.cluster?.id).toBe(FanControl.id);
    expect((getBehaviourTypeFromClusterClientId(FlowMeasurement.id) as any)?.cluster?.id).toBe(FlowMeasurement.id);
    expect((getBehaviourTypeFromClusterClientId(IlluminanceMeasurement.id) as any)?.cluster?.id).toBe(IlluminanceMeasurement.id);
    expect((getBehaviourTypeFromClusterClientId(OtaSoftwareUpdateProvider.id) as any)?.cluster?.id).toBe(OtaSoftwareUpdateProvider.id);
    expect((getBehaviourTypeFromClusterClientId(OtaSoftwareUpdateRequestor.id) as any)?.cluster?.id).toBe(OtaSoftwareUpdateRequestor.id);
    expect((getBehaviourTypeFromClusterClientId(PressureMeasurement.id) as any)?.cluster?.id).toBe(PressureMeasurement.id);
    expect((getBehaviourTypeFromClusterClientId(PumpConfigurationAndControl.id) as any)?.cluster?.id).toBe(PumpConfigurationAndControl.id);
    expect((getBehaviourTypeFromClusterClientId(RelativeHumidityMeasurement.id) as any)?.cluster?.id).toBe(RelativeHumidityMeasurement.id);
    expect((getBehaviourTypeFromClusterClientId(TemperatureMeasurement.id) as any)?.cluster?.id).toBe(TemperatureMeasurement.id);
    expect((getBehaviourTypeFromClusterClientId(Thermostat.id) as any)?.cluster?.id).toBe(Thermostat.id);
    expect((getBehaviourTypeFromClusterClientId(WindowCovering.id) as any)?.cluster?.id).toBe(WindowCovering.id);
    expect(getBehaviourTypeFromClusterClientId(0xffff as any)).toBeUndefined();
  });

  test('createDefaultIdentifyServer', async () => {
    const device = new MatterbridgeEndpoint(onOffLight, { id: 'OnOffLight8', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    expect(device.hasAttributeServer(Identify, 'identifyTime')).toBe(true);
    expect(device.hasAttributeServer(Identify, 'identifyType')).toBe(true);

    await add(device);
  });

  test('createDefaultBasicInformationClusterServer', async () => {
    const device = new MatterbridgeEndpoint(onOffLight, { id: 'OnOffLight9', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
    expect(device).toBeDefined();
    device.createDefaultBasicInformationClusterServer('OnOffLight', '1234', 0xfff1, 'Matterbridge', 0x8000, 'Light');
    expect(device.hasClusterServer(BasicInformation)).toBe(false);
    expect(device.hasClusterServer(BridgedDeviceBasicInformation)).toBe(false);

    await add(device);
  });

  test('createDefaultBridgedDeviceBasicInformationClusterServer', async () => {
    const device = new MatterbridgeEndpoint(onOffLight, { id: 'OnOffLight11', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
    expect(device).toBeDefined();
    device.createDefaultBridgedDeviceBasicInformationClusterServer('OnOffLight', '1234', 0xfff1, 'Matterbridge', 'Light');
    expect(device.hasClusterServer(BasicInformation)).toBe(false);
    expect(device.hasClusterServer(BridgedDeviceBasicInformation)).toBe(true);

    await add(device);
  });

  test('createDefaultGroupsServer', async () => {
    const device = new MatterbridgeEndpoint(onOffLight, { id: 'OnOffLight12', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
    expect(device).toBeDefined();
    device.createDefaultGroupsClusterServer();
    expect(device.hasClusterServer(Groups)).toBe(true);

    await add(device);
  });

  test('createDefaultScenesClusterServer', async () => {
    const device = new MatterbridgeEndpoint(onOffLight, { id: 'OnOffLight13', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
    expect(device).toBeDefined();
    device.createDefaultScenesManagementClusterServer();
    expect(device.hasClusterServer(ScenesManagement)).toBe(true);

    await add(device);

    /*
    device.addRequiredClusterServers();
    expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
    expect(device.lifecycle.isReady).toBeTruthy();
    expect(device.construction.status).toBe(Lifecycle.Status.Active);
    */
  });

  test('createDefaultOnOffClusterServer', async () => {
    const device = new MatterbridgeEndpoint(onOffLight, { id: 'OnOffLight14', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
    expect(device).toBeDefined();
    device.createDefaultOnOffClusterServer();
    expect(device.hasAttributeServer(OnOff, 'onOff')).toBe(true);
    expect(device.hasAttributeServer(OnOff, 'startUpOnOff')).toBe(true);

    await add(device);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createOnOffClusterServer', async () => {
    const device = new MatterbridgeEndpoint(onOffLight, { id: 'OnOffLight15', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
    expect(device).toBeDefined();
    device.createOnOffClusterServer();
    expect(device.hasAttributeServer(OnOff, 'onOff')).toBe(true);
    expect(device.hasAttributeServer(OnOff, 'startUpOnOff')).toBe(false);

    await add(device);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDeadFrontOnOffClusterServer', async () => {
    const device = new MatterbridgeEndpoint(onOffLight, { id: 'OnOffLight16', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
    expect(device).toBeDefined();
    device.createDeadFrontOnOffClusterServer();
    expect(device.hasAttributeServer(OnOff, 'onOff')).toBe(true);
    expect(device.hasAttributeServer(OnOff, 'startUpOnOff')).toBe(false);

    await add(device);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultLevelControlServer', async () => {
    const device = new MatterbridgeEndpoint(onOffLight, { id: 'OnOffLight17', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
    expect(device).toBeDefined();
    device.createDefaultLevelControlClusterServer();
    expect(device.hasAttributeServer(LevelControl, 'currentLevel')).toBe(true);
    expect(device.hasAttributeServer(LevelControl, 'startUpCurrentLevel')).toBe(true);

    await add(device);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultColorControlClusterServer', async () => {
    const device = new MatterbridgeEndpoint(onOffLight, { id: 'DefaultLight', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultGroupsClusterServer();
    device.createDefaultOnOffClusterServer();
    device.createDefaultLevelControlClusterServer();
    device.createDefaultColorControlClusterServer(400);
    expect(device.hasAttributeServer(ColorControl, 'colorMode')).toBe(true);
    expect(device.hasAttributeServer(ColorControl, 'enhancedColorMode')).toBe(true);
    expect(device.hasAttributeServer(ColorControl, 'currentX')).toBe(true);
    expect(device.hasAttributeServer(ColorControl, 'currentY')).toBe(true);
    expect(device.hasAttributeServer(ColorControl, 'currentHue')).toBe(true);
    expect(device.hasAttributeServer(ColorControl, 'enhancedCurrentHue')).toBe(false);
    expect(device.hasAttributeServer(ColorControl, 'currentSaturation')).toBe(true);
    expect(device.hasAttributeServer(ColorControl, 'colorTemperatureMireds')).toBe(true);
    expect(device.hasAttributeServer(ColorControl, 'startUpColorTemperatureMireds')).toBe(true);
    expect(device.behaviors.optionsFor(ColorControlBehavior)).toHaveProperty('currentX');
    expect((device.behaviors.optionsFor(ColorControlBehavior) as Record<string, boolean | number | bigint | string | object | null>).currentX).toBe(400);

    const options = device.getClusterServerOptions(ColorControl);
    if (options) options.currentX = 500;

    await updateAttribute(device, 'ColorControl', 'colorTemperatureMireds', 310);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`updateAttribute ${hk}colorControl.colorTemperatureMireds${er} error: Endpoint`));

    await add(device);
    (matterbridge as any).frontend.getClusterTextFromDevice(device);

    loggerLogSpy.mockClear();
    await device.configureColorControlMode(ColorControl.ColorMode.ColorTemperatureMireds);
    await device.setAttribute(ColorControl.id, 'colorTemperatureMireds', 360, device.log);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      expect.stringContaining(`${db}Set endpoint ${or}${device.id}${db}:${or}${device.number}${db} attribute ${hk}ColorControl${db}.${hk}colorTemperatureMireds${db}`),
    );
    expect(device.getAttribute(ColorControl.id, 'colorTemperatureMireds')).toBe(360);
    (matterbridge as any).frontend.getClusterTextFromDevice(device);

    loggerLogSpy.mockClear();
    await updateAttribute(device, ColorControlServer, 'colorTemperatureMireds', 350, device.log);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      expect.stringContaining(`${db}Update endpoint ${or}${device.id}${db}:${or}${device.number}${db} attribute ${hk}ColorControl${db}.${hk}colorTemperatureMireds${db}`),
    );
    expect(device.getAttribute(ColorControl.id, 'colorTemperatureMireds')).toBe(350);

    loggerLogSpy.mockClear();
    await updateAttribute(device, ColorControlServer, 'colorTemperatureMireds', 350, device.log);
    expect(loggerLogSpy).not.toHaveBeenCalled();
    expect(device.getAttribute(ColorControl.id, 'colorTemperatureMireds')).toBe(350);

    await updateAttribute(device, ColorControl, 'colorTemperatureMireds', 340);
    expect(device.getAttribute(ColorControl.id, 'colorTemperatureMireds')).toBe(340);
    await updateAttribute(device, ColorControl.id, 'colorTemperatureMireds', 330);
    expect(device.getAttribute(ColorControl.id, 'colorTemperatureMireds')).toBe(330);
    await updateAttribute(device, 'ColorControl', 'colorTemperatureMireds', 320);
    expect(device.getAttribute(ColorControl.id, 'colorTemperatureMireds')).toBe(320);
    await updateAttribute(device, 'colorControl', 'colorTemperatureMireds', 310);
    expect(device.getAttribute(ColorControl.id, 'colorTemperatureMireds')).toBe(310);
    await updateAttribute(device, 'color', 'colorTemperatureMireds', 310);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`updateAttribute ${hk}colorTemperatureMireds${er} error: cluster not found`));
    await updateAttribute(device, 'colorControl', 'colorTemperature', 310);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`updateAttribute error: Attribute ${hk}colorTemperature${er} not found on cluster`));

    const colorCapabilities = device.getAttribute(ColorControl.id, 'colorCapabilities') as {
      hueSaturation: boolean;
      enhancedHue: boolean;
      colorLoop: boolean;
      xy: boolean;
      colorTemperature: boolean;
    };
    expect(await device.updateAttribute('colorControl', 'colorCapabilities', colorCapabilities)).toBe(false);
    colorCapabilities.colorTemperature = false;
    expect(await device.updateAttribute('colorControl', 'colorCapabilities', colorCapabilities)).toBe(true);

    await device.configureColorControlMode(ColorControl.ColorMode.CurrentHueAndCurrentSaturation);
    (matterbridge as any).frontend.getClusterTextFromDevice(device);

    await device.configureColorControlMode(ColorControl.ColorMode.CurrentXAndCurrentY);
    (matterbridge as any).frontend.getClusterTextFromDevice(device);

    expect(device.hasAttributeServer(ColorControl, 'colorMode')).toBe(true);
    expect(device.hasAttributeServer(ColorControl, 'currentX')).toBe(true);
    expect(device.hasAttributeServer(ColorControl, 'currentY')).toBe(true);
    expect(device.hasAttributeServer(ColorControl, 'currentHue')).toBe(true);
    expect(device.hasAttributeServer(ColorControl, 'currentSaturation')).toBe(true);
    expect(device.hasAttributeServer(ColorControl, 'colorTemperatureMireds')).toBe(true);
    expect(device.hasAttributeServer(ColorControl, 'startUpColorTemperatureMireds')).toBe(true);
    expect(device.getAttribute(ColorControl.id, 'currentX')).toBe(500);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createEnhancedColorControlClusterServer', async () => {
    const device = new MatterbridgeEndpoint(onOffLight, { id: 'EnhancedLight' });
    expect(device).toBeDefined();
    device.createEnhancedColorControlClusterServer();
    device.addRequiredClusterServers();
    expect(device.hasAttributeServer(ColorControl, 'colorMode')).toBe(true);
    expect(device.hasAttributeServer(ColorControl, 'enhancedColorMode')).toBe(true);
    expect(device.hasAttributeServer(ColorControl, 'currentX')).toBe(true);
    expect(device.hasAttributeServer(ColorControl, 'currentY')).toBe(true);
    expect(device.hasAttributeServer(ColorControl, 'currentHue')).toBe(true);
    expect(device.hasAttributeServer(ColorControl, 'enhancedCurrentHue')).toBe(true);
    expect(device.hasAttributeServer(ColorControl, 'currentSaturation')).toBe(true);
    expect(device.hasAttributeServer(ColorControl, 'colorTemperatureMireds')).toBe(true);
    expect(device.hasAttributeServer(ColorControl, 'startUpColorTemperatureMireds')).toBe(true);

    await add(device);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);

    await device.configureEnhancedColorControlMode(ColorControl.EnhancedColorMode.EnhancedCurrentHueAndCurrentSaturation);
    (matterbridge as any).frontend.getClusterTextFromDevice(device);

    await device.configureEnhancedColorControlMode(ColorControl.EnhancedColorMode.CurrentHueAndCurrentSaturation);
    (matterbridge as any).frontend.getClusterTextFromDevice(device);

    await device.configureEnhancedColorControlMode(ColorControl.EnhancedColorMode.CurrentXAndCurrentY);
    (matterbridge as any).frontend.getClusterTextFromDevice(device);

    await device.configureEnhancedColorControlMode(ColorControl.EnhancedColorMode.ColorTemperatureMireds);
    (matterbridge as any).frontend.getClusterTextFromDevice(device);
  });

  test('createXyColorControlClusterServer', async () => {
    const device = new MatterbridgeEndpoint(onOffLight, { id: 'XYLight' });
    expect(device).toBeDefined();
    device.createXyColorControlClusterServer();
    device.addRequiredClusterServers();
    expect(device.hasAttributeServer(ColorControl, 'colorMode')).toBe(true);
    expect(device.hasAttributeServer(ColorControl, 'currentX')).toBe(true);
    expect(device.hasAttributeServer(ColorControl, 'currentY')).toBe(true);
    expect(device.hasAttributeServer(ColorControl, 'currentHue')).toBe(false);
    expect(device.hasAttributeServer(ColorControl, 'currentSaturation')).toBe(false);
    expect(device.hasAttributeServer(ColorControl, 'colorTemperatureMireds')).toBe(true);
    expect(device.hasAttributeServer(ColorControl, 'startUpColorTemperatureMireds')).toBe(true);

    await add(device);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createHsColorControlClusterServer', async () => {
    const device = new MatterbridgeEndpoint(onOffLight, { id: 'HSLight' });
    expect(device).toBeDefined();
    device.createHsColorControlClusterServer();
    device.addRequiredClusterServers();
    expect(device.hasAttributeServer(ColorControl, 'colorMode')).toBe(true);
    expect(device.hasAttributeServer(ColorControl, 'currentX')).toBe(false);
    expect(device.hasAttributeServer(ColorControl, 'currentY')).toBe(false);
    expect(device.hasAttributeServer(ColorControl, 'currentHue')).toBe(true);
    expect(device.hasAttributeServer(ColorControl, 'currentSaturation')).toBe(true);
    expect(device.hasAttributeServer(ColorControl, 'colorTemperatureMireds')).toBe(true);
    expect(device.hasAttributeServer(ColorControl, 'startUpColorTemperatureMireds')).toBe(true);

    await add(device);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createCtColorControlClusterServer', async () => {
    const device = new MatterbridgeEndpoint(onOffLight, { id: 'CTLight' });
    expect(device).toBeDefined();
    device.createCtColorControlClusterServer();
    device.addRequiredClusterServers(); //
    expect(device.hasAttributeServer(ColorControl, 'colorMode')).toBe(true);
    expect(device.hasAttributeServer(ColorControl, 'currentX')).toBe(false);
    expect(device.hasAttributeServer(ColorControl, 'currentY')).toBe(false);
    expect(device.hasAttributeServer(ColorControl, 'currentHue')).toBe(false);
    expect(device.hasAttributeServer(ColorControl, 'currentSaturation')).toBe(false);
    expect(device.hasAttributeServer(ColorControl, 'colorTemperatureMireds')).toBe(true);
    expect(device.hasAttributeServer(ColorControl, 'startUpColorTemperatureMireds')).toBe(true);

    await add(device);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultWindowCoveringClusterServer', async () => {
    const device = new MatterbridgeEndpoint(windowCovering, { id: 'LiftScreen' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultWindowCoveringClusterServer();
    expect(device.hasAttributeServer('WindowCovering', 'type')).toBe(true);
    expect(device.hasAttributeServer('WindowCovering', 'operationalStatus')).toBe(true);
    expect(device.hasAttributeServer('WindowCovering', 'mode')).toBe(true);
    expect(device.hasAttributeServer('WindowCovering', 'targetPositionLiftPercent100ths')).toBe(true);
    expect(device.hasAttributeServer('WindowCovering', 'currentPositionLiftPercent100ths')).toBe(true);
    expect(device.hasAttributeServer('WindowCovering', 'targetPositionTiltPercent100ths')).toBe(false);
    expect(device.hasAttributeServer('WindowCovering', 'currentPositionTiltPercent100ths')).toBe(false);

    await add(device);

    await device.setWindowCoveringTargetAsCurrentAndStopped();
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.DEBUG,
      expect.stringContaining(`Set WindowCovering currentPositionLiftPercent100ths and targetPositionLiftPercent100ths to 0 and operationalStatus to Stopped.`),
    );
    expect(device.getAttribute(WindowCovering.id, 'targetPositionLiftPercent100ths')).toBe(device.getAttribute(WindowCovering.id, 'currentPositionLiftPercent100ths'));
    expect(device.getWindowCoveringStatus()).toBe(WindowCovering.MovementStatus.Stopped);
    await device.setWindowCoveringCurrentTargetStatus(50, 50, WindowCovering.MovementStatus.Closing);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.DEBUG,
      expect.stringContaining(`Set WindowCovering currentPositionLiftPercent100ths: 50, targetPositionLiftPercent100ths: 50 and operationalStatus: 2.`),
    );
    expect(device.getWindowCoveringStatus()).toBe(WindowCovering.MovementStatus.Closing);
    await device.setWindowCoveringStatus(WindowCovering.MovementStatus.Opening);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Set WindowCovering operationalStatus: 1`));
    expect(device.getWindowCoveringStatus()).toBe(WindowCovering.MovementStatus.Opening);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Get WindowCovering operationalStatus: 1`));
    await device.setWindowCoveringTargetAndCurrentPosition(50);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.DEBUG,
      expect.stringContaining(`Set WindowCovering currentPositionLiftPercent100ths: 50 and targetPositionLiftPercent100ths: 50.`),
    );
    expect(device.getAttribute(WindowCovering.id, 'targetPositionLiftPercent100ths')).toBe(50);
    expect(device.getAttribute(WindowCovering.id, 'currentPositionLiftPercent100ths')).toBe(50);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultLiftTiltWindowCoveringClusterServer', async () => {
    const device = new MatterbridgeEndpoint(windowCovering, { id: 'TiltScreen' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultLiftTiltWindowCoveringClusterServer();
    expect(device.hasAttributeServer('WindowCovering', 'type')).toBe(true);
    expect(device.hasAttributeServer('WindowCovering', 'operationalStatus')).toBe(true);
    expect(device.hasAttributeServer('WindowCovering', 'mode')).toBe(true);
    expect(device.hasAttributeServer('WindowCovering', 'targetPositionLiftPercent100ths')).toBe(true);
    expect(device.hasAttributeServer('WindowCovering', 'currentPositionLiftPercent100ths')).toBe(true);
    expect(device.hasAttributeServer('WindowCovering', 'targetPositionTiltPercent100ths')).toBe(true);
    expect(device.hasAttributeServer('WindowCovering', 'currentPositionTiltPercent100ths')).toBe(true);

    await add(device);

    await device.setWindowCoveringTargetAsCurrentAndStopped();
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.DEBUG,
      expect.stringContaining(`Set WindowCovering currentPositionTiltPercent100ths and targetPositionTiltPercent100ths to 0 and operationalStatus to Stopped.`),
    );
    expect(device.getAttribute(WindowCovering.id, 'targetPositionTiltPercent100ths')).toBe(device.getAttribute(WindowCovering.id, 'currentPositionTiltPercent100ths'));
    expect(device.getWindowCoveringStatus()).toBe(WindowCovering.MovementStatus.Stopped);
    await device.setWindowCoveringCurrentTargetStatus(50, 50, WindowCovering.MovementStatus.Closing);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.DEBUG,
      expect.stringContaining(`Set WindowCovering currentPositionLiftPercent100ths: 50, targetPositionLiftPercent100ths: 50 and operationalStatus: 2.`),
    );
    expect(device.getWindowCoveringStatus()).toBe(WindowCovering.MovementStatus.Closing);
    await device.setWindowCoveringStatus(WindowCovering.MovementStatus.Opening);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Set WindowCovering operationalStatus: 1`));
    expect(device.getWindowCoveringStatus()).toBe(WindowCovering.MovementStatus.Opening);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Get WindowCovering operationalStatus: 1`));
    await device.setWindowCoveringTargetAndCurrentPosition(50, 50);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.DEBUG,
      expect.stringContaining(`Set WindowCovering currentPositionLiftPercent100ths: 50 and targetPositionLiftPercent100ths: 50.`),
    );
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.DEBUG,
      expect.stringContaining(`Set WindowCovering currentPositionTiltPercent100ths: 50 and targetPositionTiltPercent100ths: 50.`),
    );
    expect(device.getAttribute(WindowCovering.id, 'targetPositionLiftPercent100ths')).toBe(50);
    expect(device.getAttribute(WindowCovering.id, 'currentPositionLiftPercent100ths')).toBe(50);
    expect(device.getAttribute(WindowCovering.id, 'targetPositionTiltPercent100ths')).toBe(50);
    expect(device.getAttribute(WindowCovering.id, 'currentPositionTiltPercent100ths')).toBe(50);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultThermostatClusterServer', async () => {
    const device = new MatterbridgeEndpoint(thermostat, { id: 'ThermoAuto' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultThermostatClusterServer();
    device.createDefaultThermostatUserInterfaceConfigurationClusterServer();
    expect(device.hasAttributeServer(Thermostat.id, 'localTemperature')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'outdoorTemperature')).toBe(false);
    expect(device.hasAttributeServer(Thermostat.id, 'systemMode')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'occupiedHeatingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'occupiedCoolingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'unoccupiedHeatingSetpoint')).toBe(false);
    expect(device.hasAttributeServer(Thermostat.id, 'unoccupiedCoolingSetpoint')).toBe(false);
    expect(device.hasAttributeServer(Thermostat.id, 'occupancy')).toBe(false);
    expect(device.hasAttributeServer(ThermostatUserInterfaceConfiguration.id, 'temperatureDisplayMode')).toBe(true);
    expect(featuresFor(device, 'Thermostat')).toEqual({
      autoMode: true,
      cooling: true,
      heating: true,
      localTemperatureNotExposed: false,
      matterScheduleConfiguration: false,
      occupancy: false,
      presets: false,
      setback: false,
    });

    if (matterbridge.aggregatorNode) await addDevice(matterbridge.aggregatorNode, device);
    expect(device.getAttribute(Thermostat.id, 'systemMode')).toBe(Thermostat.SystemMode.Auto);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('Thermostat occupiedCoolingSetpoint below MinCoolSetpointLimit should error', async () => {
    const device = new MatterbridgeEndpoint(thermostat, { id: 'ThermoAutoConstraint' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultThermostatClusterServer();
    await add(device);

    // Default minCoolSetpointLimit is 0°C => 0 in Matter format (°C * 100)
    await expect(device.setAttribute(Thermostat.id, 'occupiedCoolingSetpoint', -100)).rejects.toThrow(/Constraint/i);
  });

  test('createDefaultThermostatClusterServer mutable with occupancy and outdoorTemperature', async () => {
    const device = new MatterbridgeEndpoint(thermostat, { id: 'ThermoAutoMutableOccupancyOutdoor' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultThermostatClusterServer(22, 20, 24, 1, 0, 49, 1, 50, 18, 26, true, 20);
    device.createDefaultThermostatUserInterfaceConfigurationClusterServer();
    expect(device.hasAttributeServer(Thermostat.id, 'localTemperature')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'outdoorTemperature')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'systemMode')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'occupiedHeatingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'occupiedCoolingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'unoccupiedHeatingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'unoccupiedCoolingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'occupancy')).toBe(true);
    expect(device.hasAttributeServer(ThermostatUserInterfaceConfiguration.id, 'temperatureDisplayMode')).toBe(true);
    expect(featuresFor(device, 'Thermostat')).toEqual({
      autoMode: true,
      cooling: true,
      heating: true,
      localTemperatureNotExposed: false,
      matterScheduleConfiguration: false,
      occupancy: true,
      presets: false,
      setback: false,
    });

    if (matterbridge.aggregatorNode) await addDevice(matterbridge.aggregatorNode, device);
    expect(device.getAttribute(Thermostat.id, 'systemMode')).toBe(Thermostat.SystemMode.Auto);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultThermostatClusterServer mutable with occupancy', async () => {
    const device = new MatterbridgeEndpoint(thermostat, { id: 'ThermoAutoMutableOccupancy' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultThermostatClusterServer(22, 20, 24, 1, 0, 49, 1, 50, 18, 26, true);
    device.createDefaultThermostatUserInterfaceConfigurationClusterServer();
    expect(device.hasAttributeServer(Thermostat.id, 'localTemperature')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'outdoorTemperature')).toBe(false);
    expect(device.hasAttributeServer(Thermostat.id, 'systemMode')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'occupiedHeatingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'occupiedCoolingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'unoccupiedHeatingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'unoccupiedCoolingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'occupancy')).toBe(true);
    expect(device.hasAttributeServer(ThermostatUserInterfaceConfiguration.id, 'temperatureDisplayMode')).toBe(true);
    expect(featuresFor(device, 'Thermostat')).toEqual({
      autoMode: true,
      cooling: true,
      heating: true,
      localTemperatureNotExposed: false,
      matterScheduleConfiguration: false,
      occupancy: true,
      presets: false,
      setback: false,
    });

    if (matterbridge.aggregatorNode) await addDevice(matterbridge.aggregatorNode, device);
    expect(device.getAttribute(Thermostat.id, 'systemMode')).toBe(Thermostat.SystemMode.Auto);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultThermostatClusterServer mutable with outdoorTemperature', async () => {
    const device = new MatterbridgeEndpoint(thermostat, { id: 'ThermoAutoMutableOutdoor' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultThermostatClusterServer(22, 20, 24, 1, 0, 49, 1, 50, undefined, undefined, undefined, 20);
    device.createDefaultThermostatUserInterfaceConfigurationClusterServer();
    expect(device.hasAttributeServer(Thermostat.id, 'localTemperature')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'outdoorTemperature')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'systemMode')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'occupiedHeatingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'occupiedCoolingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'unoccupiedHeatingSetpoint')).toBe(false);
    expect(device.hasAttributeServer(Thermostat.id, 'unoccupiedCoolingSetpoint')).toBe(false);
    expect(device.hasAttributeServer(Thermostat.id, 'occupancy')).toBe(false);
    expect(device.hasAttributeServer(ThermostatUserInterfaceConfiguration.id, 'temperatureDisplayMode')).toBe(true);
    expect(featuresFor(device, 'Thermostat')).toEqual({
      autoMode: true,
      cooling: true,
      heating: true,
      localTemperatureNotExposed: false,
      matterScheduleConfiguration: false,
      occupancy: false,
      presets: false,
      setback: false,
    });

    if (matterbridge.aggregatorNode) await addDevice(matterbridge.aggregatorNode, device);
    expect(device.getAttribute(Thermostat.id, 'systemMode')).toBe(Thermostat.SystemMode.Auto);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultHeatingThermostatClusterServer', async () => {
    const device = new MatterbridgeEndpoint(thermostat, { id: 'ThermoHeat' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultHeatingThermostatClusterServer();
    expect(device.hasAttributeServer(Thermostat.id, 'localTemperature')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'outdoorTemperature')).toBe(false);
    expect(device.hasAttributeServer(Thermostat.id, 'systemMode')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'occupiedHeatingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'occupiedCoolingSetpoint')).toBe(false);
    expect(device.hasAttributeServer(Thermostat.id, 'unoccupiedHeatingSetpoint')).toBe(false);
    expect(device.hasAttributeServer(Thermostat.id, 'unoccupiedCoolingSetpoint')).toBe(false);
    expect(device.hasAttributeServer(Thermostat.id, 'occupancy')).toBe(false);
    expect(featuresFor(device, 'Thermostat')).toEqual({
      autoMode: false,
      cooling: false,
      heating: true,
      localTemperatureNotExposed: false,
      matterScheduleConfiguration: false,
      occupancy: false,
      presets: false,
      setback: false,
    });

    if (matterbridge.aggregatorNode) await addDevice(matterbridge.aggregatorNode, device);
    expect(device.getAttribute(Thermostat.id, 'systemMode')).toBe(Thermostat.SystemMode.Heat);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultHeatingThermostatClusterServer mutable with occupancy and outdoorTemperature', async () => {
    const device = new MatterbridgeEndpoint(thermostat, { id: 'ThermoHeatMutableOccupancyOutdoor' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultHeatingThermostatClusterServer(undefined, undefined, 0, 50, undefined, false, null);
    expect(device.hasAttributeServer(Thermostat.id, 'localTemperature')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'outdoorTemperature')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'systemMode')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'occupiedHeatingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'occupiedCoolingSetpoint')).toBe(false);
    expect(device.hasAttributeServer(Thermostat.id, 'unoccupiedHeatingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'unoccupiedCoolingSetpoint')).toBe(false);
    expect(device.hasAttributeServer(Thermostat.id, 'occupancy')).toBe(true);
    expect(featuresFor(device, 'Thermostat')).toEqual({
      autoMode: false,
      cooling: false,
      heating: true,
      localTemperatureNotExposed: false,
      matterScheduleConfiguration: false,
      occupancy: true,
      presets: false,
      setback: false,
    });

    if (matterbridge.aggregatorNode) await addDevice(matterbridge.aggregatorNode, device);
    expect(device.getAttribute(Thermostat.id, 'systemMode')).toBe(Thermostat.SystemMode.Heat);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultCoolingThermostatClusterServer', async () => {
    const device = new MatterbridgeEndpoint(thermostat, { id: 'ThermoCool' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultCoolingThermostatClusterServer();
    expect(device.hasAttributeServer(Thermostat.id, 'localTemperature')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'outdoorTemperature')).toBe(false);
    expect(device.hasAttributeServer(Thermostat.id, 'systemMode')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'occupiedHeatingSetpoint')).toBe(false);
    expect(device.hasAttributeServer(Thermostat.id, 'occupiedCoolingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'unoccupiedHeatingSetpoint')).toBe(false);
    expect(device.hasAttributeServer(Thermostat.id, 'unoccupiedCoolingSetpoint')).toBe(false);
    expect(device.hasAttributeServer(Thermostat.id, 'occupancy')).toBe(false);
    expect(featuresFor(device, 'Thermostat')).toEqual({
      autoMode: false,
      cooling: true,
      heating: false,
      localTemperatureNotExposed: false,
      matterScheduleConfiguration: false,
      occupancy: false,
      presets: false,
      setback: false,
    });

    if (matterbridge.aggregatorNode) await addDevice(matterbridge.aggregatorNode, device);
    expect(device.getAttribute(Thermostat.id, 'systemMode')).toBe(Thermostat.SystemMode.Cool);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultCoolingThermostatClusterServer mutable with occupancy and outdoorTemperature', async () => {
    const device = new MatterbridgeEndpoint(thermostat, { id: 'ThermoCoolMutableOccupancyOutdoor' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultCoolingThermostatClusterServer(undefined, undefined, 0, 50, undefined, false, null);
    expect(device.hasAttributeServer(Thermostat.id, 'localTemperature')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'outdoorTemperature')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'systemMode')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'occupiedHeatingSetpoint')).toBe(false);
    expect(device.hasAttributeServer(Thermostat.id, 'occupiedCoolingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'unoccupiedHeatingSetpoint')).toBe(false);
    expect(device.hasAttributeServer(Thermostat.id, 'unoccupiedCoolingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'occupancy')).toBe(true);
    expect(featuresFor(device, 'Thermostat')).toEqual({
      autoMode: false,
      cooling: true,
      heating: false,
      localTemperatureNotExposed: false,
      matterScheduleConfiguration: false,
      occupancy: true,
      presets: false,
      setback: false,
    });

    if (matterbridge.aggregatorNode) await addDevice(matterbridge.aggregatorNode, device);
    expect(device.getAttribute(Thermostat.id, 'systemMode')).toBe(Thermostat.SystemMode.Cool);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultPresetsThermostatClusterServer defaults', async () => {
    // await setDebug(true);
    const device = new MatterbridgeEndpoint(thermostat, { id: 'ThermoPresetsDefault' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultPresetsThermostatClusterServer();
    device.createDefaultThermostatUserInterfaceConfigurationClusterServer();
    expect(device.hasAttributeServer(Thermostat.id, 'localTemperature')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'outdoorTemperature')).toBe(false);
    expect(device.hasAttributeServer(Thermostat.id, 'systemMode')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'occupiedHeatingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'occupiedCoolingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'unoccupiedHeatingSetpoint')).toBe(false);
    expect(device.hasAttributeServer(Thermostat.id, 'unoccupiedCoolingSetpoint')).toBe(false);
    expect(device.hasAttributeServer(Thermostat.id, 'occupancy')).toBe(false);
    expect(device.hasAttributeServer(Thermostat.id, 'numberOfPresets')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'activePresetHandle')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'presets')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'presetTypes')).toBe(true);
    expect(featuresFor(device, 'Thermostat')).toEqual({
      autoMode: true,
      cooling: true,
      heating: true,
      localTemperatureNotExposed: false,
      matterScheduleConfiguration: false,
      occupancy: false,
      presets: true,
      setback: false,
    });

    if (matterbridge.aggregatorNode) await addDevice(matterbridge.aggregatorNode, device);
    await flushAsync();
    expect(device.getAttribute(Thermostat.id, 'systemMode')).toBe(Thermostat.SystemMode.Auto);
    expect(device.getAttribute(Thermostat.id, 'numberOfPresets')).toBe(10);
    const retrievedPresets = device.getAttribute(Thermostat.id, 'presets');
    expect(retrievedPresets).toHaveLength(0);
    const retrievedPresetTypes = device.getAttribute(Thermostat.id, 'presetTypes');
    expect(retrievedPresetTypes).toHaveLength(2);
    expect(device.getCluster(Thermostat)).toMatchObject({
      absMinHeatSetpointLimit: 0,
      absMaxHeatSetpointLimit: 5000,
      absMinCoolSetpointLimit: 0,
      absMaxCoolSetpointLimit: 5000,
      occupiedCoolingSetpoint: 2500,
      occupiedHeatingSetpoint: 2100,
      minHeatSetpointLimit: 0,
      maxHeatSetpointLimit: 5000,
      minCoolSetpointLimit: 0,
      maxCoolSetpointLimit: 5000,
      minSetpointDeadBand: 0,
      numberOfPresets: 10,
      activePresetHandle: null,
      presets: [],
      presetTypes: [
        { presetScenario: Thermostat.PresetScenario.Occupied, numberOfPresets: 2, presetTypeFeatures: { automatic: false, supportsNames: true } },
        { presetScenario: Thermostat.PresetScenario.Unoccupied, numberOfPresets: 2, presetTypeFeatures: { automatic: false, supportsNames: true } },
      ],
    });
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultPresetsThermostatClusterServer', async () => {
    // await setDebug(false);
    const presetTypes: Thermostat.PresetType[] = [
      { presetScenario: Thermostat.PresetScenario.Occupied, numberOfPresets: 2, presetTypeFeatures: { automatic: false, supportsNames: true } },
      { presetScenario: Thermostat.PresetScenario.Unoccupied, numberOfPresets: 2, presetTypeFeatures: { automatic: false, supportsNames: true } },
    ];
    const presetsList: Thermostat.Preset[] = [
      { presetHandle: Buffer.from([0]), presetScenario: Thermostat.PresetScenario.Occupied, name: 'Occupied', coolingSetpoint: 2500, heatingSetpoint: 2100, builtIn: null },
      { presetHandle: Buffer.from([1]), presetScenario: Thermostat.PresetScenario.Unoccupied, name: 'Unoccupied', coolingSetpoint: 2700, heatingSetpoint: 1900, builtIn: null },
    ];
    const device = new MatterbridgeEndpoint(thermostat, { id: 'ThermoPresets' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultPresetsThermostatClusterServer(23, 21, 25, 2, 0, 48, 2, 50, undefined, undefined, undefined, undefined, Buffer.from([0]), presetsList, presetTypes);
    device.createDefaultThermostatUserInterfaceConfigurationClusterServer();
    expect(device.hasAttributeServer(Thermostat.id, 'localTemperature')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'outdoorTemperature')).toBe(false);
    expect(device.hasAttributeServer(Thermostat.id, 'systemMode')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'occupiedHeatingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'occupiedCoolingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'unoccupiedHeatingSetpoint')).toBe(false);
    expect(device.hasAttributeServer(Thermostat.id, 'unoccupiedCoolingSetpoint')).toBe(false);
    expect(device.hasAttributeServer(Thermostat.id, 'occupancy')).toBe(false);
    expect(device.hasAttributeServer(Thermostat.id, 'numberOfPresets')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'activePresetHandle')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'presets')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'presetTypes')).toBe(true);
    expect(featuresFor(device, 'Thermostat')).toEqual({
      autoMode: true,
      cooling: true,
      heating: true,
      localTemperatureNotExposed: false,
      matterScheduleConfiguration: false,
      occupancy: false,
      presets: true,
      setback: false,
    });

    if (matterbridge.aggregatorNode) await addDevice(matterbridge.aggregatorNode, device);
    expect(device.getAttribute(Thermostat.id, 'systemMode')).toBe(Thermostat.SystemMode.Auto);
    expect(device.getAttribute(Thermostat.id, 'numberOfPresets')).toBe(10);
    const retrievedPresets = device.getAttribute(Thermostat.id, 'presets');
    expect(retrievedPresets).toHaveLength(2);
    expect(JSON.stringify(Object.values(retrievedPresets[0].presetHandle))).toBe(JSON.stringify([0]));
    expect(retrievedPresets[0].presetScenario).toBe(Thermostat.PresetScenario.Occupied);
    expect(retrievedPresets[0].name).toBe('Occupied');
    expect(retrievedPresets[0].coolingSetpoint).toBe(2500);
    expect(retrievedPresets[0].heatingSetpoint).toBe(2100);
    expect(JSON.stringify(Object.values(retrievedPresets[1].presetHandle))).toBe(JSON.stringify([1]));
    expect(retrievedPresets[1].presetScenario).toBe(Thermostat.PresetScenario.Unoccupied);
    expect(retrievedPresets[1].name).toBe('Unoccupied');
    expect(retrievedPresets[1].coolingSetpoint).toBe(2700);
    expect(retrievedPresets[1].heatingSetpoint).toBe(1900);
    const retrievedPresetTypes = device.getAttribute(Thermostat.id, 'presetTypes');
    expect(retrievedPresetTypes).toHaveLength(2);
    expect(retrievedPresetTypes[0].presetScenario).toBe(Thermostat.PresetScenario.Occupied);
    expect(retrievedPresetTypes[0].numberOfPresets).toBe(2);
    expect(retrievedPresetTypes[1].presetScenario).toBe(Thermostat.PresetScenario.Unoccupied);
    expect(retrievedPresetTypes[1].numberOfPresets).toBe(2);
    expect(device.getCluster(Thermostat)).toMatchObject({
      absMinHeatSetpointLimit: 0,
      absMaxHeatSetpointLimit: 4800,
      absMinCoolSetpointLimit: 200,
      absMaxCoolSetpointLimit: 5000,
      occupiedCoolingSetpoint: 2500,
      occupiedHeatingSetpoint: 2100,
      minHeatSetpointLimit: 0,
      maxHeatSetpointLimit: 4800,
      minCoolSetpointLimit: 200,
      maxCoolSetpointLimit: 5000,
      minSetpointDeadBand: 20,
      presetTypes: [
        {
          presetScenario: Thermostat.PresetScenario.Occupied,
          numberOfPresets: 2,
          presetTypeFeatures: { automatic: false, supportsNames: true },
        },
        {
          presetScenario: Thermostat.PresetScenario.Unoccupied,
          numberOfPresets: 2,
          presetTypeFeatures: { automatic: false, supportsNames: true },
        },
      ],
      numberOfPresets: 10,
      activePresetHandle: Buffer.from([0]),
      presets: [
        {
          presetHandle: Buffer.from([0]),
          presetScenario: Thermostat.PresetScenario.Occupied,
          name: 'Occupied',
          coolingSetpoint: 2500,
          heatingSetpoint: 2100,
          builtIn: true,
        },
        {
          presetHandle: Buffer.from([1]),
          presetScenario: Thermostat.PresetScenario.Unoccupied,
          name: 'Unoccupied',
          coolingSetpoint: 2700,
          heatingSetpoint: 1900,
          builtIn: true,
        },
      ],
    });
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultPresetsThermostatClusterServer with occupancy', async () => {
    const presetTypes: Thermostat.PresetType[] = [
      { presetScenario: Thermostat.PresetScenario.Occupied, numberOfPresets: 2, presetTypeFeatures: { automatic: false, supportsNames: true } },
      { presetScenario: Thermostat.PresetScenario.Unoccupied, numberOfPresets: 2, presetTypeFeatures: { automatic: false, supportsNames: true } },
    ];
    const presetsList: Thermostat.Preset[] = [
      { presetHandle: Buffer.from([0]), presetScenario: Thermostat.PresetScenario.Occupied, name: 'Occupied', coolingSetpoint: 2500, heatingSetpoint: 2100, builtIn: null },
      { presetHandle: Buffer.from([1]), presetScenario: Thermostat.PresetScenario.Unoccupied, name: 'Unoccupied', coolingSetpoint: 2700, heatingSetpoint: 1900, builtIn: null },
    ];
    const device = new MatterbridgeEndpoint(thermostat, { id: 'ThermoPresetsOccupancy' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultPresetsThermostatClusterServer(22, 20, 24, 2, 0, 48, 2, 50, 18, 26, true, undefined, Buffer.from([0]), presetsList, presetTypes);
    device.createDefaultThermostatUserInterfaceConfigurationClusterServer();
    expect(device.hasAttributeServer(Thermostat.id, 'localTemperature')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'occupiedHeatingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'occupiedCoolingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'unoccupiedHeatingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'unoccupiedCoolingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'occupancy')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'numberOfPresets')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'presets')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'presetTypes')).toBe(true);
    expect(featuresFor(device, 'Thermostat')).toEqual({
      autoMode: true,
      cooling: true,
      heating: true,
      localTemperatureNotExposed: false,
      matterScheduleConfiguration: false,
      occupancy: true,
      presets: true,
      setback: false,
    });

    if (matterbridge.aggregatorNode) await addDevice(matterbridge.aggregatorNode, device);
    expect(device.getAttribute(Thermostat.id, 'systemMode')).toBe(Thermostat.SystemMode.Auto);
    expect(device.getAttribute(Thermostat.id, 'numberOfPresets')).toBe(10);
    expect(device.getCluster(Thermostat)).toMatchObject({
      absMinHeatSetpointLimit: 0,
      absMaxHeatSetpointLimit: 4800,
      absMinCoolSetpointLimit: 200,
      absMaxCoolSetpointLimit: 5000,
      occupiedCoolingSetpoint: 2400,
      occupiedHeatingSetpoint: 2000,
      unoccupiedHeatingSetpoint: 1800,
      unoccupiedCoolingSetpoint: 2600,
      occupancy: { occupied: true },
      externallyMeasuredOccupancy: true,
      minHeatSetpointLimit: 0,
      maxHeatSetpointLimit: 4800,
      minCoolSetpointLimit: 200,
      maxCoolSetpointLimit: 5000,
      minSetpointDeadBand: 20,
      numberOfPresets: 10,
      activePresetHandle: Buffer.from([0]),
      presets: [
        {
          presetHandle: Buffer.from([0]),
          presetScenario: Thermostat.PresetScenario.Occupied,
          name: 'Occupied',
          coolingSetpoint: 2500,
          heatingSetpoint: 2100,
          builtIn: true,
        },
        {
          presetHandle: Buffer.from([1]),
          presetScenario: Thermostat.PresetScenario.Unoccupied,
          name: 'Unoccupied',
          coolingSetpoint: 2700,
          heatingSetpoint: 1900,
          builtIn: true,
        },
      ],
      presetTypes: [
        {
          presetScenario: Thermostat.PresetScenario.Occupied,
          numberOfPresets: 2,
          presetTypeFeatures: { automatic: false, supportsNames: true },
        },
        {
          presetScenario: Thermostat.PresetScenario.Unoccupied,
          numberOfPresets: 2,
          presetTypeFeatures: { automatic: false, supportsNames: true },
        },
      ],
    });
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultPresetsThermostatClusterServer with multiple preset scenarios', async () => {
    const presetsList: Thermostat.Preset[] = [
      {
        presetHandle: new Uint8Array([0]),
        presetScenario: Thermostat.PresetScenario.Occupied,
        name: 'Home',
        coolingSetpoint: 2300,
        heatingSetpoint: 2200,
        builtIn: true,
      },
      {
        presetHandle: new Uint8Array([1]),
        presetScenario: Thermostat.PresetScenario.Unoccupied,
        name: 'Away',
        coolingSetpoint: 2600,
        heatingSetpoint: 1800,
        builtIn: true,
      },
      {
        presetHandle: new Uint8Array([2]),
        presetScenario: Thermostat.PresetScenario.Sleep,
        name: 'Sleep',
        coolingSetpoint: 2100,
        heatingSetpoint: 1800,
        builtIn: true,
      },
      {
        presetHandle: new Uint8Array([3]),
        presetScenario: Thermostat.PresetScenario.Wake,
        name: 'Wake',
        coolingSetpoint: 2400,
        heatingSetpoint: 1900,
        builtIn: true,
      },
      {
        presetHandle: new Uint8Array([4]),
        presetScenario: Thermostat.PresetScenario.Vacation,
        name: 'Vacation',
        coolingSetpoint: 2700,
        heatingSetpoint: 1600,
        builtIn: true,
      },
      {
        presetHandle: new Uint8Array([5]),
        presetScenario: Thermostat.PresetScenario.GoingToSleep,
        name: 'GoingToSleep',
        coolingSetpoint: 2200,
        heatingSetpoint: 1850,
        builtIn: true,
      },
    ];

    const presetTypeDefinitions: Thermostat.PresetType[] = [
      {
        presetScenario: Thermostat.PresetScenario.Occupied,
        numberOfPresets: presetsList.filter((preset) => preset.presetScenario === Thermostat.PresetScenario.Occupied).length,
        presetTypeFeatures: { automatic: false, supportsNames: true },
      },
      {
        presetScenario: Thermostat.PresetScenario.Unoccupied,
        numberOfPresets: presetsList.filter((preset) => preset.presetScenario === Thermostat.PresetScenario.Unoccupied).length,
        presetTypeFeatures: { automatic: false, supportsNames: true },
      },
      {
        presetScenario: Thermostat.PresetScenario.Sleep,
        numberOfPresets: presetsList.filter((preset) => preset.presetScenario === Thermostat.PresetScenario.Sleep).length,
        presetTypeFeatures: { automatic: false, supportsNames: true },
      },
      {
        presetScenario: Thermostat.PresetScenario.Wake,
        numberOfPresets: presetsList.filter((preset) => preset.presetScenario === Thermostat.PresetScenario.Wake).length,
        presetTypeFeatures: { automatic: false, supportsNames: true },
      },
      {
        presetScenario: Thermostat.PresetScenario.Vacation,
        numberOfPresets: presetsList.filter((preset) => preset.presetScenario === Thermostat.PresetScenario.Vacation).length,
        presetTypeFeatures: { automatic: false, supportsNames: true },
      },
      {
        presetScenario: Thermostat.PresetScenario.GoingToSleep,
        numberOfPresets: presetsList.filter((preset) => preset.presetScenario === Thermostat.PresetScenario.GoingToSleep).length,
        presetTypeFeatures: { automatic: false, supportsNames: true },
      },
    ];

    const device = new MatterbridgeEndpoint(thermostat, { id: 'ThermoPresetsMultiScenario' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultPresetsThermostatClusterServer(20, 18, 22, 1, 0, 35, 15, 50, 10, 30, false, 20.5, undefined, presetsList, presetTypeDefinitions);
    device.createDefaultThermostatUserInterfaceConfigurationClusterServer();
    expect(device.hasAttributeServer(Thermostat.id, 'outdoorTemperature')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'occupancy')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'numberOfPresets')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'activePresetHandle')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'presets')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.id, 'presetTypes')).toBe(true);
    expect(featuresFor(device, 'Thermostat')).toEqual({
      autoMode: true,
      cooling: true,
      heating: true,
      localTemperatureNotExposed: false,
      matterScheduleConfiguration: false,
      occupancy: true,
      presets: true,
      setback: false,
    });

    if (matterbridge.aggregatorNode) await addDevice(matterbridge.aggregatorNode, device);
    expect(device.getAttribute(Thermostat.id, 'systemMode')).toBe(Thermostat.SystemMode.Auto);
    expect(device.getAttribute(Thermostat.id, 'outdoorTemperature')).toBe(2050);
    expect(device.getAttribute(Thermostat.id, 'numberOfPresets')).toBe(10);
    expect(device.getAttribute(Thermostat.id, 'activePresetHandle')).toBeNull();
    expect(device.getAttribute(Thermostat.id, 'presets')).toHaveLength(6);
    expect(device.getAttribute(Thermostat.id, 'presetTypes')).toHaveLength(6);
    expect(device.getCluster(Thermostat)).toMatchObject({
      absMinHeatSetpointLimit: 0,
      absMaxHeatSetpointLimit: 3500,
      absMinCoolSetpointLimit: 1500,
      absMaxCoolSetpointLimit: 5000,
      occupiedCoolingSetpoint: 2200,
      occupiedHeatingSetpoint: 1800,
      unoccupiedHeatingSetpoint: 1000,
      unoccupiedCoolingSetpoint: 3000,
      occupancy: { occupied: false },
      externallyMeasuredOccupancy: true,
      outdoorTemperature: 2050,
      minHeatSetpointLimit: 0,
      maxHeatSetpointLimit: 3500,
      minCoolSetpointLimit: 1500,
      maxCoolSetpointLimit: 5000,
      minSetpointDeadBand: 10,
      numberOfPresets: 10,
      activePresetHandle: null,
      presets: [
        {
          presetHandle: Buffer.from([0]),
          presetScenario: Thermostat.PresetScenario.Occupied,
          name: 'Home',
          coolingSetpoint: 2300,
          heatingSetpoint: 2200,
          builtIn: true,
        },
        {
          presetHandle: Buffer.from([1]),
          presetScenario: Thermostat.PresetScenario.Unoccupied,
          name: 'Away',
          coolingSetpoint: 2600,
          heatingSetpoint: 1800,
          builtIn: true,
        },
        {
          presetHandle: Buffer.from([2]),
          presetScenario: Thermostat.PresetScenario.Sleep,
          name: 'Sleep',
          coolingSetpoint: 2100,
          heatingSetpoint: 1800,
          builtIn: true,
        },
        {
          presetHandle: Buffer.from([3]),
          presetScenario: Thermostat.PresetScenario.Wake,
          name: 'Wake',
          coolingSetpoint: 2400,
          heatingSetpoint: 1900,
          builtIn: true,
        },
        {
          presetHandle: Buffer.from([4]),
          presetScenario: Thermostat.PresetScenario.Vacation,
          name: 'Vacation',
          coolingSetpoint: 2700,
          heatingSetpoint: 1600,
          builtIn: true,
        },
        {
          presetHandle: Buffer.from([5]),
          presetScenario: Thermostat.PresetScenario.GoingToSleep,
          name: 'GoingToSleep',
          coolingSetpoint: 2200,
          heatingSetpoint: 1850,
          builtIn: true,
        },
      ],
      presetTypes: [
        {
          presetScenario: Thermostat.PresetScenario.Occupied,
          numberOfPresets: 1,
          presetTypeFeatures: { automatic: false, supportsNames: true },
        },
        {
          presetScenario: Thermostat.PresetScenario.Unoccupied,
          numberOfPresets: 1,
          presetTypeFeatures: { automatic: false, supportsNames: true },
        },
        {
          presetScenario: Thermostat.PresetScenario.Sleep,
          numberOfPresets: 1,
          presetTypeFeatures: { automatic: false, supportsNames: true },
        },
        {
          presetScenario: Thermostat.PresetScenario.Wake,
          numberOfPresets: 1,
          presetTypeFeatures: { automatic: false, supportsNames: true },
        },
        {
          presetScenario: Thermostat.PresetScenario.Vacation,
          numberOfPresets: 1,
          presetTypeFeatures: { automatic: false, supportsNames: true },
        },
        {
          presetScenario: Thermostat.PresetScenario.GoingToSleep,
          numberOfPresets: 1,
          presetTypeFeatures: { automatic: false, supportsNames: true },
        },
      ],
    });

    await device.setAttribute(Thermostat.id, 'minHeatSetpointLimit', 1300);
    expect(device.getAttribute(Thermostat.id, 'minHeatSetpointLimit')).toBe(1300);

    await device.setAttribute(Thermostat.id, 'maxHeatSetpointLimit', 3400);
    expect(device.getAttribute(Thermostat.id, 'maxHeatSetpointLimit')).toBe(3400);

    await device.setAttribute(Thermostat.id, 'minCoolSetpointLimit', 1800);
    expect(device.getAttribute(Thermostat.id, 'minCoolSetpointLimit')).toBe(1800);

    await device.setAttribute(Thermostat.id, 'maxCoolSetpointLimit', 3600);
    expect(device.getAttribute(Thermostat.id, 'maxCoolSetpointLimit')).toBe(3600);

    const expectHeatLimitsUnchanged = () => {
      expect(device.getAttribute(Thermostat.id, 'minHeatSetpointLimit')).toBe(1300);
      expect(device.getAttribute(Thermostat.id, 'maxHeatSetpointLimit')).toBe(3400);
    };

    const expectStableThermostatLimits = () => {
      expect(device.getCluster(Thermostat)).toMatchObject({
        minHeatSetpointLimit: 1300,
        maxHeatSetpointLimit: 3400,
        minCoolSetpointLimit: 1800,
        maxCoolSetpointLimit: 3600,
      });
    };

    // These writes intentionally violate Matter auto-mode limit coupling:
    // minHeat must stay <= minCool - deadBand, minCool must stay >= minHeat + deadBand,
    // and maxHeat must stay <= absMaxHeat while also respecting the cool-side deadBand rule.
    await expect(device.setAttribute(Thermostat.id, 'minHeatSetpointLimit', 1800)).rejects.toThrow(/minHeatSetpointLimit/i);
    expectHeatLimitsUnchanged();
    expectStableThermostatLimits();

    await expect(device.setAttribute(Thermostat.id, 'minCoolSetpointLimit', 1200)).rejects.toThrow(/minCoolSetpointLimit/i);
    expect(device.getAttribute(Thermostat.id, 'minCoolSetpointLimit')).toBe(1800);
    expectHeatLimitsUnchanged();
    expectStableThermostatLimits();

    await expect(device.setAttribute(Thermostat.id, 'maxHeatSetpointLimit', 3600)).rejects.toThrow(/maxHeatSetpointLimit/i);
    expectHeatLimitsUnchanged();
    expectStableThermostatLimits();

    // Failed setpoint validation must not roll the configured user limits back to Matter defaults.
    await expect(device.setAttribute(Thermostat.id, 'occupiedHeatingSetpoint', 1200)).rejects.toThrow(/occupiedHeatingSetpoint|Constraint/i);
    expectHeatLimitsUnchanged();
    expectStableThermostatLimits();

    await expect(device.setAttribute(Thermostat.id, 'occupiedCoolingSetpoint', 3700)).rejects.toThrow(/occupiedCoolingSetpoint|Constraint/i);
    expectHeatLimitsUnchanged();
    expectStableThermostatLimits();

    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultFanControlClusterServer', async () => {
    const device = new MatterbridgeEndpoint(fan, { id: 'Fan' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultGroupsClusterServer();
    device.createDefaultFanControlClusterServer();
    expect(device.hasAttributeServer(FanControl, 'fanMode')).toBe(true);
    expect(device.hasAttributeServer(FanControl, 'percentSetting')).toBe(true);
    expect(device.hasAttributeServer(FanControl, 'speedSetting')).toBe(false);

    await add(device);
    expect((device.getAttribute(FanControl.id, 'featureMap') as Record<string, boolean>).auto).toBe(true);
    expect((device.getAttribute(FanControl.id, 'featureMap') as Record<string, boolean>).step).toBe(true);
    expect((device.getAttribute(FanControl.id, 'featureMap') as Record<string, boolean>).multiSpeed).toBe(false);
    expect(device.getAttribute(FanControl.id, 'fanMode')).toBe(FanControl.FanMode.Off);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createBaseFanControlClusterServer', async () => {
    const device = new MatterbridgeEndpoint(fan, { id: 'Fan2' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultGroupsClusterServer();
    device.createBaseFanControlClusterServer();
    expect(device.hasAttributeServer(FanControl, 'fanMode')).toBe(true);
    expect(device.hasAttributeServer(FanControl, 'percentSetting')).toBe(true);
    expect(device.hasAttributeServer(FanControl, 'speedSetting')).toBe(false);
    expect(device.hasAttributeServer(FanControl, 'percentCurrent')).toBe(true);
    expect(device.hasAttributeServer(FanControl, 'speedCurrent')).toBe(false);
    expect(featuresFor(device, FanControlServer)).toEqual({ airflowDirection: false, auto: false, multiSpeed: false, rocking: false, step: false, wind: false });
    expect(featuresFor(device, FanControl)).toEqual({ airflowDirection: false, auto: false, multiSpeed: false, rocking: false, step: false, wind: false });
    expect(featuresFor(device, FanControl.id)).toEqual({ airflowDirection: false, auto: false, multiSpeed: false, rocking: false, step: false, wind: false });
    expect(featuresFor(device, 'FanControl')).toEqual({ airflowDirection: false, auto: false, multiSpeed: false, rocking: false, step: false, wind: false });

    await add(device);
    expect((device.getAttribute(FanControl.id, 'featureMap') as Record<string, boolean>).auto).toBe(false);
    expect((device.getAttribute(FanControl.id, 'featureMap') as Record<string, boolean>).step).toBe(false);
    expect((device.getAttribute(FanControl.id, 'featureMap') as Record<string, boolean>).multiSpeed).toBe(false);
    expect(device.getAttribute(FanControl.id, 'fanMode')).toBe(FanControl.FanMode.Off);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createMultiSpeedFanControlClusterServer', async () => {
    const device = new MatterbridgeEndpoint(fan, { id: 'Fan3' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultGroupsClusterServer();
    device.createMultiSpeedFanControlClusterServer();
    expect(device.hasAttributeServer(FanControl, 'fanMode')).toBe(true);
    expect(device.hasAttributeServer(FanControl, 'percentSetting')).toBe(true);
    expect(device.hasAttributeServer(FanControl, 'speedSetting')).toBe(true);
    expect(device.hasAttributeServer(FanControl, 'percentCurrent')).toBe(true);
    expect(device.hasAttributeServer(FanControl, 'speedCurrent')).toBe(true);
    expect(featuresFor(device, FanControlServer)).toEqual({ airflowDirection: false, auto: true, multiSpeed: true, rocking: false, step: true, wind: false });
    expect(featuresFor(device, FanControl)).toEqual({ airflowDirection: false, auto: true, multiSpeed: true, rocking: false, step: true, wind: false });
    expect(featuresFor(device, FanControl.id)).toEqual({ airflowDirection: false, auto: true, multiSpeed: true, rocking: false, step: true, wind: false });
    expect(featuresFor(device, 'FanControl')).toEqual({ airflowDirection: false, auto: true, multiSpeed: true, rocking: false, step: true, wind: false });

    await add(device);
    expect((device.getAttribute(FanControl.id, 'featureMap') as Record<string, boolean>).auto).toBe(true);
    expect((device.getAttribute(FanControl.id, 'featureMap') as Record<string, boolean>).step).toBe(true);
    expect((device.getAttribute(FanControl.id, 'featureMap') as Record<string, boolean>).multiSpeed).toBe(true);
    expect(device.getAttribute(FanControl.id, 'fanMode')).toBe(FanControl.FanMode.Off);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createCompleteFanControlClusterServer', async () => {
    const device = new MatterbridgeEndpoint(fan, { id: 'Fan4' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultGroupsClusterServer();
    device.createCompleteFanControlClusterServer();
    expect(device.hasAttributeServer(FanControl, 'fanMode')).toBe(true);
    expect(device.hasAttributeServer(FanControl, 'percentSetting')).toBe(true);
    expect(device.hasAttributeServer(FanControl, 'speedSetting')).toBe(true);
    expect(device.hasAttributeServer(FanControl, 'rockSupport')).toBe(true);
    expect(device.hasAttributeServer(FanControl, 'windSupport')).toBe(true);
    expect(device.hasAttributeServer(FanControl, 'airflowDirection')).toBe(true);
    expect(featuresFor(device, FanControlServer)).toEqual({ airflowDirection: true, auto: true, multiSpeed: true, rocking: true, step: true, wind: true });
    expect(featuresFor(device, FanControl)).toEqual({ airflowDirection: true, auto: true, multiSpeed: true, rocking: true, step: true, wind: true });
    expect(featuresFor(device, FanControl.id)).toEqual({ airflowDirection: true, auto: true, multiSpeed: true, rocking: true, step: true, wind: true });
    expect(featuresFor(device, 'FanControl')).toEqual({ airflowDirection: true, auto: true, multiSpeed: true, rocking: true, step: true, wind: true });

    await add(device);
    expect((device.getAttribute(FanControl.id, 'featureMap') as Record<string, boolean>).auto).toBe(true);
    expect((device.getAttribute(FanControl.id, 'featureMap') as Record<string, boolean>).step).toBe(true);
    expect((device.getAttribute(FanControl.id, 'featureMap') as Record<string, boolean>).multiSpeed).toBe(true);
    expect((device.getAttribute(FanControl.id, 'featureMap') as Record<string, boolean>).rocking).toBe(true);
    expect((device.getAttribute(FanControl.id, 'featureMap') as Record<string, boolean>).wind).toBe(true);
    expect((device.getAttribute(FanControl.id, 'featureMap') as Record<string, boolean>).airflowDirection).toBe(true);
    expect(device.getAttribute(FanControl.id, 'fanMode')).toBe(FanControl.FanMode.Off);
    (matterbridge as any).frontend.getClusterTextFromDevice(device);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createOnOffFanControlClusterServer', async () => {
    const device = new MatterbridgeEndpoint(fan, { id: 'Fan5' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultGroupsClusterServer();
    device.createOnOffFanControlClusterServer();
    expect(device.hasAttributeServer(FanControl, 'fanMode')).toBe(true);
    expect(device.hasAttributeServer(FanControl, 'percentSetting')).toBe(true);
    expect(device.hasAttributeServer(FanControl, 'speedSetting')).toBe(false);
    expect(device.hasAttributeServer(FanControl, 'rockSupport')).toBe(false);
    expect(device.hasAttributeServer(FanControl, 'windSupport')).toBe(false);
    expect(device.hasAttributeServer(FanControl, 'airflowDirection')).toBe(false);
    expect(featuresFor(device, FanControlServer)).toEqual({ airflowDirection: false, auto: false, multiSpeed: false, rocking: false, step: false, wind: false });
    expect(featuresFor(device, FanControl)).toEqual({ airflowDirection: false, auto: false, multiSpeed: false, rocking: false, step: false, wind: false });
    expect(featuresFor(device, FanControl.id)).toEqual({ airflowDirection: false, auto: false, multiSpeed: false, rocking: false, step: false, wind: false });
    expect(featuresFor(device, 'FanControl')).toEqual({ airflowDirection: false, auto: false, multiSpeed: false, rocking: false, step: false, wind: false });

    await add(device);
    expect((device.getAttribute(FanControl.id, 'featureMap') as Record<string, boolean>).auto).toBe(false);
    expect((device.getAttribute(FanControl.id, 'featureMap') as Record<string, boolean>).step).toBe(false);
    expect((device.getAttribute(FanControl.id, 'featureMap') as Record<string, boolean>).multiSpeed).toBe(false);
    expect((device.getAttribute(FanControl.id, 'featureMap') as Record<string, boolean>).rocking).toBe(false);
    expect((device.getAttribute(FanControl.id, 'featureMap') as Record<string, boolean>).wind).toBe(false);
    expect((device.getAttribute(FanControl.id, 'featureMap') as Record<string, boolean>).airflowDirection).toBe(false);
    expect(device.getAttribute(FanControl.id, 'fanMode')).toBe(FanControl.FanMode.Off);
    (matterbridge as any).frontend.getClusterTextFromDevice(device);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultHepaFilterMonitoringClusterServer', async () => {
    const device = new MatterbridgeEndpoint(airPurifier, { id: 'AirPurifier' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createBaseFanControlClusterServer();
    device.createDefaultHepaFilterMonitoringClusterServer();
    device.createDefaultActivatedCarbonFilterMonitoringClusterServer();
    expect(device.hasAttributeServer(FanControl, 'fanMode')).toBe(true);
    expect(device.hasAttributeServer(HepaFilterMonitoring, 'changeIndication')).toBe(true);
    expect(device.hasAttributeServer(ActivatedCarbonFilterMonitoring, 'changeIndication')).toBe(true);

    await add(device);
    expect(device.getAttribute(FanControl.id, 'fanMode')).toBe(FanControl.FanMode.Off);
    expect(device.getAttribute(HepaFilterMonitoring.id, 'changeIndication')).toBe(ResourceMonitoring.ChangeIndication.Ok);
    expect(device.getAttribute(ActivatedCarbonFilterMonitoring.id, 'changeIndication')).toBe(ResourceMonitoring.ChangeIndication.Ok);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultDoorLockClusterServer', async () => {
    const device = new MatterbridgeEndpoint(doorLock, { id: 'Lock' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultDoorLockClusterServer();
    expect(device.hasAttributeServer(DoorLock, 'operatingMode')).toBe(true);
    expect(device.hasAttributeServer(DoorLock, 'lockState')).toBe(true);
    expect(device.hasAttributeServer(DoorLock, 'lockType')).toBe(true);
    expect(device.hasAttributeServer(DoorLock, 'actuatorEnabled')).toBe(true);

    await add(device);
    expect(device.getAttribute(DoorLock.id, 'lockState')).toBe(DoorLock.LockState.Locked);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultModeSelectClusterServer', async () => {
    const device = new MatterbridgeEndpoint(modeSelect, { id: 'ModeSelect' });
    expect(device).toBeDefined();
    device.createDefaultModeSelectClusterServer(
      'Night mode',
      [
        { label: 'Led ON', mode: 0, semanticTags: [] },
        { label: 'Led OFF', mode: 1, semanticTags: [] },
      ],
      0,
      0,
    );
    expect(device.hasAttributeServer(ModeSelect, 'description')).toBe(true);
    expect(device.hasAttributeServer(ModeSelect, 'supportedModes')).toBe(true);
    expect(device.hasAttributeServer(ModeSelect, 'currentMode')).toBe(true);

    await add(device);
    expect(device.getAttribute(ModeSelect.id, 'currentMode')).toBe(0);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultValveConfigurationAndControlClusterServer', async () => {
    const device = new MatterbridgeEndpoint(waterValve, { id: 'Valve' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultValveConfigurationAndControlClusterServer();
    expect(device.hasAttributeServer(ValveConfigurationAndControl, 'currentState')).toBe(true);
    expect(device.hasAttributeServer(ValveConfigurationAndControl, 'targetState')).toBe(true);
    expect(device.hasAttributeServer(ValveConfigurationAndControl, 'currentLevel')).toBe(true);
    expect(device.hasAttributeServer(ValveConfigurationAndControl, 'targetLevel')).toBe(true);

    await add(device);
    expect(device.getAttribute(ValveConfigurationAndControl.id, 'currentState')).toBe(ValveConfigurationAndControl.ValveState.Closed);
    expect(device.getAttribute(ValveConfigurationAndControl.id, 'currentLevel')).toBe(0);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultPumpConfigurationAndControlClusterServer', async () => {
    const device = new MatterbridgeEndpoint(pump, { id: 'Pump' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createOnOffClusterServer();
    device.createDefaultPumpConfigurationAndControlClusterServer();
    expect(device.hasAttributeServer(PumpConfigurationAndControl.id, 'operationMode')).toBe(true);
    expect(device.hasAttributeServer(PumpConfigurationAndControl.id, 'effectiveControlMode')).toBe(true);
    expect(device.hasAttributeServer(PumpConfigurationAndControl.id, 'effectiveOperationMode')).toBe(true);

    await add(device);
    expect(device.getAttribute(PumpConfigurationAndControl.id, 'operationMode')).toBe(PumpConfigurationAndControl.OperationMode.Normal);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultSmokeCOAlarmClusterServer', async () => {
    const device = new MatterbridgeEndpoint(smokeCoAlarm, { id: 'SmokeAlarm' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultSmokeCOAlarmClusterServer();
    expect(device.hasAttributeServer(SmokeCoAlarm.id, 'smokeState')).toBe(true);
    expect(device.hasAttributeServer(SmokeCoAlarm.id, 'coState')).toBe(true);
    expect(device.hasAttributeServer(SmokeCoAlarm.id, 'batteryAlert')).toBe(true);
    expect(device.hasAttributeServer(SmokeCoAlarm.id, 'endOfServiceAlert')).toBe(true);

    await add(device);
    expect(device.getAttribute(SmokeCoAlarm.id, 'smokeState')).toBe(SmokeCoAlarm.AlarmState.Normal);
    expect(device.getAttribute(SmokeCoAlarm.id, 'coState')).toBe(SmokeCoAlarm.AlarmState.Normal);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultSmokeCOAlarmClusterServer smoke only', async () => {
    const device = new MatterbridgeEndpoint(smokeCoAlarm, { id: 'SmokeAlarmSmokeOnly' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createSmokeOnlySmokeCOAlarmClusterServer();
    expect(device.hasAttributeServer(SmokeCoAlarm.id, 'smokeState')).toBe(true);
    expect(device.hasAttributeServer(SmokeCoAlarm.id, 'coState')).toBe(false);
    expect(device.hasAttributeServer(SmokeCoAlarm.id, 'batteryAlert')).toBe(true);
    expect(device.hasAttributeServer(SmokeCoAlarm.id, 'endOfServiceAlert')).toBe(true);

    await add(device);
    expect(device.getAttribute(SmokeCoAlarm.id, 'smokeState')).toBe(SmokeCoAlarm.AlarmState.Normal);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultSmokeCOAlarmClusterServer co only', async () => {
    const device = new MatterbridgeEndpoint(smokeCoAlarm, { id: 'SmokeAlarmCoOnly' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createCoOnlySmokeCOAlarmClusterServer();
    expect(device.hasAttributeServer(SmokeCoAlarm.id, 'smokeState')).toBe(false);
    expect(device.hasAttributeServer(SmokeCoAlarm.id, 'coState')).toBe(true);
    expect(device.hasAttributeServer(SmokeCoAlarm.id, 'batteryAlert')).toBe(true);
    expect(device.hasAttributeServer(SmokeCoAlarm.id, 'endOfServiceAlert')).toBe(true);

    await add(device);
    expect(device.getAttribute(SmokeCoAlarm.id, 'coState')).toBe(SmokeCoAlarm.AlarmState.Normal);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultSwitchClusterServer', async () => {
    const device = new MatterbridgeEndpoint(genericSwitch, { id: 'SwitchMomentary' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultSwitchClusterServer();
    expect(device.hasAttributeServer(Switch.id, 'numberOfPositions')).toBe(true);
    expect(device.hasAttributeServer(Switch.id, 'currentPosition')).toBe(true);
    expect(device.hasAttributeServer(Switch.id, 'multiPressMax')).toBe(true);

    await device.triggerSwitchEvent('Single', device.log);
    await device.triggerSwitchEvent('Double', device.log);
    await device.triggerSwitchEvent('Long', device.log);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Endpoint number not assigned on endpoint'));

    await add(device);
    (matterbridge as any).frontend.getClusterTextFromDevice(device);

    await device.triggerSwitchEvent('Press', device.log);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('triggerSwitchEvent Press error: Switch cluster with LatchingSwitch not found'));

    expect((device.getAttribute(Switch.id, 'featureMap') as Record<string, boolean>).momentarySwitch).toBe(true);
    expect((device.getAttribute(Switch.id, 'featureMap') as Record<string, boolean>).momentarySwitchRelease).toBe(true);
    expect((device.getAttribute(Switch.id, 'featureMap') as Record<string, boolean>).momentarySwitchLongPress).toBe(true);
    expect((device.getAttribute(Switch.id, 'featureMap') as Record<string, boolean>).momentarySwitchMultiPress).toBe(true);
    expect((device.getAttribute(Switch.id, 'featureMap') as Record<string, boolean>).latchingSwitch).toBe(false);

    loggerLogSpy.mockClear();
    await device.triggerSwitchEvent('Single', device.log);
    await device.triggerSwitchEvent('Double', device.log);
    await device.triggerSwitchEvent('Long', device.log);
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Endpoint number not assigned on endpoint'));
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultMomentarySwitchClusterServer', async () => {
    const device = new MatterbridgeEndpoint(genericSwitch, { id: 'SwitchMomentarySingle' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultMomentarySwitchClusterServer();
    expect(device.hasAttributeServer(Switch.id, 'numberOfPositions')).toBe(true);
    expect(device.hasAttributeServer(Switch.id, 'currentPosition')).toBe(true);
    expect(device.hasAttributeServer(Switch.id, 'multiPressMax')).toBe(false);

    await device.triggerSwitchEvent('Single', device.log);
    await device.triggerSwitchEvent('Double', device.log);
    await device.triggerSwitchEvent('Long', device.log);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Endpoint number not assigned on endpoint'));

    await add(device);
    expect((matterbridge as any).frontend.getClusterTextFromDevice(device)).toBe('Position: 0');

    expect((device.getAttribute(Switch.id, 'featureMap') as Record<string, boolean>).momentarySwitch).toBe(true);
    expect((device.getAttribute(Switch.id, 'featureMap') as Record<string, boolean>).momentarySwitchRelease).toBe(false);
    expect((device.getAttribute(Switch.id, 'featureMap') as Record<string, boolean>).momentarySwitchLongPress).toBe(false);
    expect((device.getAttribute(Switch.id, 'featureMap') as Record<string, boolean>).momentarySwitchMultiPress).toBe(false);
    expect((device.getAttribute(Switch.id, 'featureMap') as Record<string, boolean>).latchingSwitch).toBe(false);

    loggerLogSpy.mockClear();
    await device.triggerSwitchEvent('Single', device.log);
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Endpoint number not assigned on endpoint'));
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      expect.stringContaining(`${db}Trigger endpoint ${or}${device.id}:${device.number}${db} event ${hk}Switch.SinglePress${db}`),
    );
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultLatchingSwitchClusterServer', async () => {
    const device = new MatterbridgeEndpoint(genericSwitch, { id: 'SwitchLatching' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultLatchingSwitchClusterServer();
    expect(device.hasAttributeServer(Switch.id, 'numberOfPositions')).toBe(true);
    expect(device.hasAttributeServer(Switch.id, 'currentPosition')).toBe(true);
    expect(device.hasAttributeServer(Switch.id, 'multiPressMax')).toBe(false);

    await device.triggerSwitchEvent('Press', device.log);
    await device.triggerSwitchEvent('Release', device.log);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Endpoint number not assigned on endpoint'));

    await add(device);

    await device.triggerSwitchEvent('Single', device.log);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('triggerSwitchEvent Single error: Switch cluster with MomentarySwitch not found'));

    expect((device.getAttribute(Switch.id, 'featureMap') as Record<string, boolean>).momentarySwitch).toBe(false);
    expect((device.getAttribute(Switch.id, 'featureMap') as Record<string, boolean>).latchingSwitch).toBe(true);

    loggerLogSpy.mockClear();
    await device.triggerSwitchEvent('Press', device.log);
    await device.triggerSwitchEvent('Release', device.log);
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Endpoint number not assigned on endpoint'));
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultBooleanStateServer', async () => {
    const device = new MatterbridgeEndpoint(contactSensor, { id: 'ContactSensor' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultBooleanStateClusterServer(false);
    expect(device.hasAttributeServer(BooleanState.id, 'stateValue')).toBe(true);
    expect(device.hasAttributeServer('BooleanState', 'StateValue')).toBe(true);

    let called = false;
    device.subscribeAttribute(
      BooleanState.id,
      'stateValue',
      (value) => {
        called = true;
      },
      device.log,
    );
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`${db}Subscribed endpoint`));

    jest.clearAllMocks();
    await device.triggerEvent(BooleanStateConfiguration.id, 'stateChange', { stateValue: true });
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.ERROR,
      expect.stringContaining(`triggerEvent ${hk}stateChange${er} error: cluster not found on endpoint ${or}ContactSensor${er}:${or}undefined${er}`),
    );

    jest.clearAllMocks();
    await device.triggerEvent(BooleanState.id, 'stateChange', { stateValue: true });
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.ERROR,
      expect.stringContaining(`triggerEvent ${hk}booleanState.stateChange${er} error: Endpoint ${or}ContactSensor${er}:${or}undefined${er} is in the ${BLUE}inactive${er} state`),
    );

    jest.clearAllMocks();
    await device.setAttribute(BooleanState.id, 'stateValue', true);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`setAttribute ${hk}booleanState.stateValue${er} error: Endpoint`));

    await add(device);

    expect(device.getAttribute(BooleanState.id, 'stateValue')).toBe(false);
    await device.setAttribute(BooleanState.id, 'stateValue', true);
    expect(called).toBe(true);

    jest.clearAllMocks();
    await device.setAttribute(BooleanStateConfiguration.id, 'stateValue', true, device.log);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`setAttribute ${hk}stateValue${er} error`));

    jest.clearAllMocks();
    await device.setAttribute(BooleanState.id, 'state', true, device.log);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`setAttribute error: Attribute ${hk}state${er} not found`));

    jest.clearAllMocks();
    device.getAttribute(BooleanStateConfiguration.id, 'state', device.log);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`getAttribute ${hk}state${er} error: cluster not found on endpoint`));

    jest.clearAllMocks();
    device.getAttribute(BooleanState.id, 'state', device.log);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`getAttribute error: Attribute ${hk}state${er} not found`));

    device.subscribeAttribute(
      BooleanStateConfiguration.id,
      'stateValue',
      (value) => {
        //
      },
      device.log,
    );
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`subscribeAttribute ${hk}stateValue${er} error`));

    device.subscribeAttribute(
      BooleanState.id,
      'state',
      (value) => {
        //
      },
      device.log,
    );
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`subscribeAttribute error: Attribute ${hk}state${er} not found`));

    jest.clearAllMocks();
    await device.triggerEvent(BooleanState, 'stateChange', { stateValue: true }, device.log);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`${db}Trigger event ${hk}BooleanState${db}.${hk}stateChange${db} with`));

    jest.clearAllMocks();
    await device.triggerEvent(BooleanState.id, 'stateChange', { stateValue: true }, device.log);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`${db}Trigger event ${hk}BooleanState${db}.${hk}stateChange${db} with`));

    jest.clearAllMocks();
    await device.triggerEvent(BooleanStateServer, 'stateChange', { stateValue: true }, device.log);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`${db}Trigger event ${hk}BooleanState${db}.${hk}stateChange${db} with`));

    jest.clearAllMocks();
    await device.triggerEvent('BooleanState', 'stateChange', { stateValue: true }, device.log);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`${db}Trigger event ${hk}BooleanState${db}.${hk}stateChange${db} with`));

    jest.clearAllMocks();
    await device.triggerEvent('booleanState', 'stateChange', { stateValue: true }, device.log);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`${db}Trigger event ${hk}BooleanState${db}.${hk}stateChange${db} with`));

    jest.clearAllMocks();
    await device.triggerEvent(BooleanStateConfiguration.id, 'stateChange', { stateValue: true });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`triggerEvent ${hk}stateChange${er} error: cluster not found on endpoint`));

    jest.clearAllMocks();
    await device.triggerEvent(BooleanState.id, 'state', { stateValue: true });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`triggerEvent ${hk}state${er} error: cluster booleanState not found on endpoint`));
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultBooleanStateConfigurationClusterServer for waterFreezeDetector', async () => {
    const device = new MatterbridgeEndpoint([waterFreezeDetector, powerSource], { id: 'WaterFreezeDetector' });
    expect(device).toBeDefined();
    expect(device.behaviors.optionsFor(DescriptorBehavior)).toEqual({
      deviceTypeList: [
        { deviceType: waterFreezeDetector.code, revision: waterFreezeDetector.revision },
        { deviceType: powerSource.code, revision: powerSource.revision },
      ],
    });
    device.createDefaultPowerSourceWiredClusterServer();
    expect(device.hasClusterServer(PowerSource.id)).toBe(true);
    device.createDefaultIdentifyClusterServer();
    device.createDefaultBooleanStateClusterServer();
    device.createDefaultBooleanStateConfigurationClusterServer();
    expect(device.hasAttributeServer(BooleanState.id, 'stateValue')).toBe(true);
    expect(device.hasAttributeServer(BooleanStateConfiguration.id, 'currentSensitivityLevel')).toBe(true);

    await add(device);

    expect(device.getAttribute(BooleanState.id, 'stateValue')).toBe(true);
    expect(device.getAttribute(BooleanStateConfiguration.id, 'currentSensitivityLevel')).toBe(0);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultBooleanStateConfigurationClusterServer for waterLeakDetector', async () => {
    const device = new MatterbridgeEndpoint([waterLeakDetector, powerSource], { id: 'WaterLeakDetector' });
    expect(device).toBeDefined();
    expect(device.behaviors.optionsFor(DescriptorBehavior)).toEqual({
      deviceTypeList: [
        { deviceType: waterLeakDetector.code, revision: waterLeakDetector.revision },
        { deviceType: powerSource.code, revision: powerSource.revision },
      ],
    });
    device.createDefaultPowerSourceReplaceableBatteryClusterServer();
    expect(device.hasClusterServer(PowerSource.id)).toBe(true);
    device.createDefaultIdentifyClusterServer();
    device.createDefaultBooleanStateClusterServer();
    device.createDefaultBooleanStateConfigurationClusterServer();
    expect(device.hasAttributeServer(BooleanState.id, 'stateValue')).toBe(true);
    expect(device.hasAttributeServer(BooleanStateConfiguration.id, 'currentSensitivityLevel')).toBe(true);

    await add(device);

    expect(device.getAttribute(BooleanState.id, 'stateValue')).toBe(true);
    expect(device.getAttribute(BooleanStateConfiguration.id, 'currentSensitivityLevel')).toBe(0);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultBooleanStateConfigurationClusterServer for rainSensor', async () => {
    const device = new MatterbridgeEndpoint([rainSensor, powerSource], { id: 'RainSensor' });
    expect(device).toBeDefined();
    expect(device.behaviors.optionsFor(DescriptorBehavior)).toEqual({
      deviceTypeList: [
        { deviceType: rainSensor.code, revision: rainSensor.revision },
        { deviceType: powerSource.code, revision: powerSource.revision },
      ],
    });
    device.createDefaultPowerSourceRechargeableBatteryClusterServer();
    expect(device.hasClusterServer(PowerSource.id)).toBe(true);
    device.createDefaultIdentifyClusterServer();
    device.createDefaultBooleanStateClusterServer();
    device.createDefaultBooleanStateConfigurationClusterServer();
    expect(device.hasAttributeServer(BooleanState.id, 'stateValue')).toBe(true);
    expect(device.hasAttributeServer(BooleanStateConfiguration.id, 'currentSensitivityLevel')).toBe(true);

    await add(device);

    expect(device.getAttribute(BooleanState.id, 'stateValue')).toBe(true);
    expect(device.getAttribute(BooleanStateConfiguration.id, 'currentSensitivityLevel')).toBe(0);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultDeviceEnergyManagementClusterServer', async () => {
    const device = new MatterbridgeEndpoint([powerSource], { id: 'DeviceEnergyManagement' });
    expect(device).toBeDefined();
    device.createDefaultPowerSourceWiredClusterServer();
    device.createDefaultDeviceEnergyManagementClusterServer();
    expect(device.hasClusterServer(PowerSource.id)).toBe(true);

    await add(device);

    expect(device.getAttribute(PowerSource.id, 'description')).toBe('AC Power');
    expect(device.getAttribute(PowerSource.id, 'status')).toBe(PowerSource.PowerSourceStatus.Active);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('power source wired', async () => {
    const device = new MatterbridgeEndpoint([powerSource], { id: 'PowerSourceWired' });
    expect(device).toBeDefined();
    device.createDefaultPowerSourceWiredClusterServer();
    expect(device.hasClusterServer(PowerSource.id)).toBe(true);

    await add(device);

    expect(device.getAttribute(PowerSource.id, 'description')).toBe('AC Power');
    expect(device.getAttribute(PowerSource.id, 'status')).toBe(PowerSource.PowerSourceStatus.Active);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('power source battery', async () => {
    const device = new MatterbridgeEndpoint([powerSource], { id: 'PowerSourceBattery' });
    expect(device).toBeDefined();
    device.createDefaultPowerSourceBatteryClusterServer();
    expect(device.hasClusterServer(PowerSource.id)).toBe(true);

    // Test endpointList with child device
    const temp = device.addChildDeviceType('temperature', temperatureSensor);
    temp.createDefaultTemperatureMeasurementClusterServer(2200);

    await add(device);

    expect(device.getAttribute(PowerSource.id, 'description')).toBe('Primary battery');
    expect(device.getAttribute(PowerSource.id, 'status')).toBe(PowerSource.PowerSourceStatus.Active);
    expect(device.getAttribute(PowerSource.id, 'batVoltage')).toBe(null);
    expect(device.getAttribute(PowerSource.id, 'batPercentRemaining')).toBe(null);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);

    await flushAsync();
  });

  test('power source replaceable', async () => {
    const device = new MatterbridgeEndpoint([powerSource], { id: 'PowerSourceReplaceable' });
    expect(device).toBeDefined();
    device.createDefaultPowerSourceReplaceableBatteryClusterServer();
    expect(device.hasClusterServer(PowerSource.id)).toBe(true);

    await add(device);

    expect(device.getAttribute(PowerSource.id, 'batChargeLevel')).toBe(PowerSource.BatChargeLevel.Ok);
    expect(device.getAttribute(PowerSource.id, 'batReplaceability')).toBe(PowerSource.BatReplaceability.UserReplaceable);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('power source rechargeable', async () => {
    const device = new MatterbridgeEndpoint([powerSource], { id: 'PowerSourceRechargeable' });
    expect(device).toBeDefined();
    device.createDefaultPowerSourceRechargeableBatteryClusterServer();
    expect(device.hasClusterServer(PowerSource.id)).toBe(true);

    await add(device);

    expect(device.getAttribute(PowerSource.id, 'batChargeLevel')).toBe(PowerSource.BatChargeLevel.Ok);
    expect(device.getAttribute(PowerSource.id, 'batChargeState')).toBe(PowerSource.BatChargeState.IsNotCharging);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('energy measurements for electricalSensor', async () => {
    const device = new MatterbridgeEndpoint([electricalSensor], { id: 'ElectricalSensor' });
    expect(device).toBeDefined();
    device.createDefaultPowerTopologyClusterServer();
    device.createDefaultElectricalEnergyMeasurementClusterServer();
    device.createDefaultElectricalPowerMeasurementClusterServer();
    expect(device.hasClusterServer(PowerTopology.id)).toBe(true);
    expect(device.hasAttributeServer(ElectricalEnergyMeasurement.id, 'cumulativeEnergyReset')).toBe(true);
    expect(device.hasAttributeServer(ElectricalEnergyMeasurement.id, 'cumulativeEnergyImported')).toBe(true);
    expect(device.hasAttributeServer(ElectricalEnergyMeasurement.id, 'cumulativeEnergyExported')).toBe(true);
    expect(device.hasAttributeServer(ElectricalPowerMeasurement.id, 'voltage')).toBe(true);
    expect(device.hasAttributeServer(ElectricalPowerMeasurement.id, 'activeCurrent')).toBe(true);
    expect(device.hasAttributeServer(ElectricalPowerMeasurement.id, 'activePower')).toBe(true);
    expect(device.hasAttributeServer(ElectricalPowerMeasurement.id, 'frequency')).toBe(true);

    await add(device);

    expect(device.getAttribute(ElectricalEnergyMeasurement.id, 'cumulativeEnergyImported')).toBe(null);
    expect(device.getAttribute(ElectricalPowerMeasurement.id, 'voltage')).toBe(null);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('energy measurements for electricalSensor apparent', async () => {
    const device = new MatterbridgeEndpoint([electricalSensor], { id: 'ApparentElectricalSensor' });
    expect(device).toBeDefined();
    device.createDefaultPowerTopologyClusterServer();
    device.createDefaultElectricalEnergyMeasurementClusterServer();
    device.createApparentElectricalPowerMeasurementClusterServer();
    expect(device.hasClusterServer(PowerTopology.id)).toBe(true);
    expect(device.hasAttributeServer(ElectricalEnergyMeasurement.id, 'cumulativeEnergyReset')).toBe(true);
    expect(device.hasAttributeServer(ElectricalEnergyMeasurement.id, 'cumulativeEnergyImported')).toBe(true);
    expect(device.hasAttributeServer(ElectricalEnergyMeasurement.id, 'cumulativeEnergyExported')).toBe(true);
    expect(device.hasAttributeServer(ElectricalPowerMeasurement.id, 'voltage')).toBe(true);
    expect(device.hasAttributeServer(ElectricalPowerMeasurement.id, 'apparentCurrent')).toBe(true);
    expect(device.hasAttributeServer(ElectricalPowerMeasurement.id, 'apparentPower')).toBe(true);
    expect(device.hasAttributeServer(ElectricalPowerMeasurement.id, 'frequency')).toBe(true);

    await add(device);

    expect(device.getAttribute(ElectricalEnergyMeasurement.id, 'cumulativeEnergyImported')).toBe(null);
    expect(device.getAttribute(ElectricalPowerMeasurement.id, 'voltage')).toBe(null);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultTemperatureMeasurementClusterServer', async () => {
    const device = new MatterbridgeEndpoint(temperatureSensor, { id: 'TemperatureSensor' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultTemperatureMeasurementClusterServer(21 * 100);
    expect(device.hasClusterServer(TemperatureMeasurement.id)).toBe(true);
    expect(device.hasAttributeServer(TemperatureMeasurement.id, 'measuredValue')).toBe(true);

    await add(device);

    expect(device.getAttribute(TemperatureMeasurement.id, 'measuredValue')).toBe(2100);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultRelativeHumidityMeasurementClusterServer', async () => {
    const device = new MatterbridgeEndpoint(humiditySensor, { id: 'HumiditySensor' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultRelativeHumidityMeasurementClusterServer(50 * 100);
    expect(device.hasClusterServer(RelativeHumidityMeasurement.id)).toBe(true);
    expect(device.hasAttributeServer(RelativeHumidityMeasurement.id, 'measuredValue')).toBe(true);

    await add(device);

    expect(device.getAttribute(RelativeHumidityMeasurement.id, 'measuredValue')).toBe(5000);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultPressureMeasurementClusterServer', async () => {
    const device = new MatterbridgeEndpoint(pressureSensor, { id: 'PressureSensor' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultPressureMeasurementClusterServer(980);
    expect(device.hasClusterServer(PressureMeasurement.id)).toBe(true);
    expect(device.hasAttributeServer(PressureMeasurement.id, 'measuredValue')).toBe(true);

    await add(device);

    expect(device.getAttribute(PressureMeasurement.id, 'measuredValue')).toBe(980);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultIlluminanceMeasurementClusterServer', async () => {
    const device = new MatterbridgeEndpoint(lightSensor, { id: 'LightSensor' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultIlluminanceMeasurementClusterServer(1000);
    expect(device.hasClusterServer(IlluminanceMeasurement.id)).toBe(true);
    expect(device.hasAttributeServer(IlluminanceMeasurement.id, 'measuredValue')).toBe(true);

    await add(device);

    expect(device.getAttribute(IlluminanceMeasurement.id, 'measuredValue')).toBe(1000);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultFlowMeasurementClusterServer', async () => {
    const device = new MatterbridgeEndpoint(flowSensor, { id: 'FlowSensor' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultFlowMeasurementClusterServer(20 * 10);
    expect(device.hasClusterServer(FlowMeasurement.id)).toBe(true);
    expect(device.hasAttributeServer(FlowMeasurement.id, 'measuredValue')).toBe(true);

    await add(device);

    expect(device.getAttribute(FlowMeasurement.id, 'measuredValue')).toBe(200);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultOccupancySensingClusterServer', async () => {
    const device = new MatterbridgeEndpoint(occupancySensor, { id: 'OccupancySensor' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultOccupancySensingClusterServer(true);
    expect(device.hasClusterServer(OccupancySensingServer)).toBe(true);
    expect(device.hasAttributeServer(OccupancySensingServer, 'occupancy')).toBe(true);

    await add(device);

    expect(device.getAttribute(OccupancySensing.id, 'occupancy')).toEqual({ occupied: true });
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultSoilMeasurementClusterServer', async () => {
    const device = new MatterbridgeEndpoint(soilSensor, { id: 'SoilSensor' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultSoilMeasurementClusterServer(50);
    expect(device.hasClusterServer(SoilMeasurementServer)).toBe(true);
    expect(device.hasAttributeServer(SoilMeasurementServer, 'soilMoistureMeasuredValue')).toBe(true);

    await add(device);

    expect(device.getAttribute(SoilMeasurement, 'soilMoistureMeasuredValue')).toEqual(50);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultAirQualityClusterServer', async () => {
    const device = new MatterbridgeEndpoint(airQualitySensor, { id: 'AirQualitySensor' });
    expect(device).toBeDefined();
    device
      .createDefaultIdentifyClusterServer()
      .createDefaultAirQualityClusterServer()
      .createDefaultTvocMeasurementClusterServer()
      .createDefaultCarbonMonoxideConcentrationMeasurementClusterServer()
      .createDefaultCarbonDioxideConcentrationMeasurementClusterServer()
      .createDefaultFormaldehydeConcentrationMeasurementClusterServer()
      .createDefaultPm1ConcentrationMeasurementClusterServer()
      .createDefaultPm25ConcentrationMeasurementClusterServer()
      .createDefaultPm10ConcentrationMeasurementClusterServer()
      .createDefaultOzoneConcentrationMeasurementClusterServer()
      .createDefaultRadonConcentrationMeasurementClusterServer()
      .createDefaultNitrogenDioxideConcentrationMeasurementClusterServer();
    expect(device.hasClusterServer(AirQualityServer)).toBe(true);
    expect(device.hasClusterServer(TotalVolatileOrganicCompoundsConcentrationMeasurementServer)).toBe(true);
    expect(device.hasClusterServer(CarbonMonoxideConcentrationMeasurementServer)).toBe(true);
    expect(device.hasClusterServer(CarbonDioxideConcentrationMeasurementServer)).toBe(true);
    expect(device.hasClusterServer(FormaldehydeConcentrationMeasurementServer)).toBe(true);
    expect(device.hasClusterServer(Pm1ConcentrationMeasurementServer)).toBe(true);
    expect(device.hasClusterServer(Pm25ConcentrationMeasurementServer)).toBe(true);
    expect(device.hasClusterServer(Pm10ConcentrationMeasurementServer)).toBe(true);
    expect(device.hasClusterServer(OzoneConcentrationMeasurementServer)).toBe(true);
    expect(device.hasClusterServer(RadonConcentrationMeasurementServer)).toBe(true);
    expect(device.hasClusterServer(NitrogenDioxideConcentrationMeasurementServer)).toBe(true);
    expect(device.hasAttributeServer(AirQualityServer, 'airQuality')).toBe(true);

    await add(device);

    expect(device.getAttribute(AirQuality.id, 'airQuality')).toBe(AirQuality.AirQualityEnum.Unknown);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });
});
