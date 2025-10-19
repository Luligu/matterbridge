// src\matterbridgeEndpoint-default.test.ts

const MATTER_PORT = 6016;
const NAME = 'EndpointDefault';
const HOMEDIR = path.join('jest', NAME);

process.argv = ['node', 'matterbridge.js', '-mdnsInterface', 'Wi-Fi', '-frontend', '0', '-port', MATTER_PORT.toString(), '-homedir', HOMEDIR, '-bridge', '-logger', 'debug', '-matterlogger', 'debug'];

import path from 'node:path';

import { jest } from '@jest/globals';
import { Lifecycle } from '@matter/main';
import {
  AirQuality,
  BasicInformation,
  BooleanState,
  BooleanStateConfiguration,
  BridgedDeviceBasicInformation,
  ColorControl,
  DoorLock,
  ElectricalEnergyMeasurement,
  ElectricalPowerMeasurement,
  FanControl,
  FlowMeasurement,
  Groups,
  Identify,
  IlluminanceMeasurement,
  LevelControl,
  ModeSelect,
  OccupancySensing,
  OnOff,
  PowerSource,
  PowerTopology,
  PumpConfigurationAndControl,
  PressureMeasurement,
  RelativeHumidityMeasurement,
  SmokeCoAlarm,
  Switch,
  TemperatureMeasurement,
  Thermostat,
  ValveConfigurationAndControl,
  WindowCovering,
  ThermostatUserInterfaceConfiguration,
  HepaFilterMonitoring,
  ActivatedCarbonFilterMonitoring,
  ResourceMonitoring,
  ScenesManagement,
  UserLabel,
  FixedLabel,
  DeviceEnergyManagement,
  DeviceEnergyManagementMode,
} from '@matter/main/clusters';
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
  Pm10ConcentrationMeasurementServer,
  Pm1ConcentrationMeasurementServer,
  Pm25ConcentrationMeasurementServer,
  RadonConcentrationMeasurementServer,
  TotalVolatileOrganicCompoundsConcentrationMeasurementServer,
} from '@matter/node/behaviors';
import { BLUE, db, er, hk, LogLevel, or } from 'node-ansi-logger';

import { Matterbridge } from './matterbridge.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import {
  airPurifier,
  airQualitySensor,
  contactSensor,
  coverDevice,
  doorLockDevice,
  electricalSensor,
  fanDevice,
  flowSensor,
  genericSwitch,
  humiditySensor,
  lightSensor,
  modeSelect,
  occupancySensor,
  onOffLight,
  powerSource,
  pressureSensor,
  pumpDevice,
  rainSensor,
  smokeCoAlarm,
  temperatureSensor,
  thermostatDevice,
  waterFreezeDetector,
  waterLeakDetector,
  waterValve,
} from './matterbridgeDeviceTypes.js';
import { capitalizeFirstLetter, featuresFor, getBehaviourTypeFromClusterClientId, getBehaviourTypeFromClusterServerId, getBehaviourTypesFromClusterClientIds, lowercaseFirstLetter, updateAttribute } from './matterbridgeEndpointHelpers.js';
import { addDevice, assertAllEndpointNumbersPersisted, createTestEnvironment, flushAllEndpointNumberPersistence, loggerLogSpy, setDebug, setupTest } from './utils/jestHelpers.js';

// Setup the test environment
setupTest(NAME, false);

// Setup the matter and test environment
createTestEnvironment(HOMEDIR);

describe('Matterbridge ' + NAME, () => {
  let matterbridge: Matterbridge;
  let device: MatterbridgeEndpoint;

  beforeAll(async () => {
    // Create a MatterbridgeEdge instance
    matterbridge = await Matterbridge.loadInstance(true);

    await new Promise<void>((resolve) => {
      matterbridge.once('online', (name) => {
        if (name === 'Matterbridge') resolve();
      });
    });
  }, 30000);

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {});

  afterAll(async () => {
    // Restore all mocks
    jest.restoreAllMocks();
  });

  async function add(device: MatterbridgeEndpoint): Promise<void> {
    expect(device).toBeDefined();
    device.addRequiredClusterServers();
    expect(matterbridge.serverNode).toBeDefined();
    expect(matterbridge.serverNode?.lifecycle.isReady).toBeTruthy();
    expect(matterbridge.serverNode?.construction.status).toBe(Lifecycle.Status.Active);
    expect(matterbridge.aggregatorNode).toBeDefined();
    expect(matterbridge.aggregatorNode?.lifecycle.isReady).toBeTruthy();
    expect(matterbridge.aggregatorNode?.construction.status).toBe(Lifecycle.Status.Active);
    expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
    expect(device.lifecycle.isReady).toBeTruthy();
    expect(device.construction.status).toBe(Lifecycle.Status.Active);
    if (device.uniqueStorageKey === undefined) return;
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`\x1B[39mMatterbridge.Matterbridge.${device.uniqueStorageKey.replaceAll(' ', '')} \x1B[0mready`));
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
    expect(getBehaviourTypeFromClusterServerId(PowerSource.Cluster.id)?.id).toBe('powerSource');
    expect(getBehaviourTypeFromClusterServerId(UserLabel.Cluster.id)?.id).toBe('userLabel');
    expect(getBehaviourTypeFromClusterServerId(FixedLabel.Cluster.id)?.id).toBe('fixedLabel');
    expect(getBehaviourTypeFromClusterServerId(BasicInformation.Cluster.id)?.id).toBe('basicInformation');
    expect(getBehaviourTypeFromClusterServerId(BridgedDeviceBasicInformation.Cluster.id)?.id).toBe('bridgedDeviceBasicInformation');
    expect(getBehaviourTypeFromClusterServerId(DeviceEnergyManagement.Cluster.id)?.id).toBe('deviceEnergyManagement');
    expect(getBehaviourTypeFromClusterServerId(DeviceEnergyManagementMode.Cluster.id)?.id).toBe('deviceEnergyManagementMode');
  });

  test('getBehaviourTypesFromClusterClientIds', async () => {
    expect(getBehaviourTypesFromClusterClientIds([Identify.Cluster.id])).toEqual([]);
  });
  test('getBehaviourTypeFromClusterClientId', async () => {
    expect(getBehaviourTypeFromClusterClientId(Identify.Cluster.id)).toBeUndefined();
  });

  test('createDefaultIdentifyClusterServer', async () => {
    const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight8', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    expect(device.hasAttributeServer(Identify.Cluster, 'identifyTime')).toBe(true);
    expect(device.hasAttributeServer(Identify.Cluster, 'identifyType')).toBe(true);

    await add(device);
  });

  test('createDefaultBasicInformationClusterServer', async () => {
    const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight9', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
    expect(device).toBeDefined();
    device.createDefaultBasicInformationClusterServer('OnOffLight', '1234', 0xfff1, 'Matterbridge', 0x8000, 'Light');
    expect(device.hasClusterServer(BasicInformation.Cluster)).toBe(false);
    expect(device.hasClusterServer(BridgedDeviceBasicInformation.Cluster)).toBe(false);

    await add(device);
  });

  test('createDefaultBridgedDeviceBasicInformationClusterServer', async () => {
    const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight11', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
    expect(device).toBeDefined();
    device.createDefaultBridgedDeviceBasicInformationClusterServer('OnOffLight', '1234', 0xfff1, 'Matterbridge', 'Light');
    expect(device.hasClusterServer(BasicInformation.Cluster)).toBe(false);
    expect(device.hasClusterServer(BridgedDeviceBasicInformation.Cluster)).toBe(true);

    await add(device);
  });

  test('createDefaultGroupsClusterServer', async () => {
    const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight12', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
    expect(device).toBeDefined();
    device.createDefaultGroupsClusterServer();
    expect(device.hasClusterServer(Groups.Cluster)).toBe(true);

    await add(device);
  });

  test('createDefaultScenesClusterServer', async () => {
    const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight13', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
    expect(device).toBeDefined();
    device.createDefaultScenesClusterServer();
    expect(device.hasClusterServer(ScenesManagement.Cluster)).toBe(true);

    await add(device);

    /*
    device.addRequiredClusterServers();
    expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
    expect(device.lifecycle.isReady).toBeTruthy();
    expect(device.construction.status).toBe(Lifecycle.Status.Active);
    */
  });

  test('createDefaultOnOffClusterServer', async () => {
    const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight14', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
    expect(device).toBeDefined();
    device.createDefaultOnOffClusterServer();
    expect(device.hasAttributeServer(OnOff.Cluster, 'onOff')).toBe(true);
    expect(device.hasAttributeServer(OnOff.Cluster, 'startUpOnOff')).toBe(true);

    await add(device);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createOnOffClusterServer', async () => {
    const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight15', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
    expect(device).toBeDefined();
    device.createOnOffClusterServer();
    expect(device.hasAttributeServer(OnOff.Cluster, 'onOff')).toBe(true);
    expect(device.hasAttributeServer(OnOff.Cluster, 'startUpOnOff')).toBe(false);

    await add(device);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDeadFrontOnOffClusterServer', async () => {
    const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight16', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
    expect(device).toBeDefined();
    device.createDeadFrontOnOffClusterServer();
    expect(device.hasAttributeServer(OnOff.Cluster, 'onOff')).toBe(true);
    expect(device.hasAttributeServer(OnOff.Cluster, 'startUpOnOff')).toBe(false);

    await add(device);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultLevelControlClusterServer', async () => {
    const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight17', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
    expect(device).toBeDefined();
    device.createDefaultLevelControlClusterServer();
    expect(device.hasAttributeServer(LevelControl.Cluster, 'currentLevel')).toBe(true);
    expect(device.hasAttributeServer(LevelControl.Cluster, 'startUpCurrentLevel')).toBe(true);

    await add(device);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultColorControlClusterServer', async () => {
    const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'DefaultLight', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultGroupsClusterServer();
    device.createDefaultOnOffClusterServer();
    device.createDefaultLevelControlClusterServer();
    device.createDefaultColorControlClusterServer(400);
    expect(device.hasAttributeServer(ColorControl.Cluster, 'colorMode')).toBe(true);
    expect(device.hasAttributeServer(ColorControl.Cluster, 'enhancedColorMode')).toBe(true);
    expect(device.hasAttributeServer(ColorControl.Cluster, 'currentX')).toBe(true);
    expect(device.hasAttributeServer(ColorControl.Cluster, 'currentY')).toBe(true);
    expect(device.hasAttributeServer(ColorControl.Cluster, 'currentHue')).toBe(true);
    expect(device.hasAttributeServer(ColorControl.Cluster, 'enhancedCurrentHue')).toBe(false);
    expect(device.hasAttributeServer(ColorControl.Cluster, 'currentSaturation')).toBe(true);
    expect(device.hasAttributeServer(ColorControl.Cluster, 'colorTemperatureMireds')).toBe(true);
    expect(device.hasAttributeServer(ColorControl.Cluster, 'startUpColorTemperatureMireds')).toBe(true);
    expect(device.behaviors.optionsFor(ColorControlBehavior)).toHaveProperty('currentX');
    expect((device.behaviors.optionsFor(ColorControlBehavior) as Record<string, boolean | number | bigint | string | object | null>).currentX).toBe(400);

    const options = device.getClusterServerOptions(ColorControl.Cluster);
    if (options) options.currentX = 500;

    await updateAttribute(device, 'ColorControl', 'colorTemperatureMireds', 310);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`updateAttribute ${hk}colorControl.colorTemperatureMireds${er} error: Endpoint`));

    await add(device);
    (matterbridge as any).frontend.getClusterTextFromDevice(device);

    loggerLogSpy.mockClear();
    await device.configureColorControlMode(ColorControl.ColorMode.ColorTemperatureMireds);
    await device.setAttribute(ColorControl.Cluster.id, 'colorTemperatureMireds', 360, device.log);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`${db}Set endpoint ${or}${device.id}${db}:${or}${device.number}${db} attribute ${hk}ColorControl${db}.${hk}colorTemperatureMireds${db}`));
    expect(device.getAttribute(ColorControl.Cluster.id, 'colorTemperatureMireds')).toBe(360);
    (matterbridge as any).frontend.getClusterTextFromDevice(device);

    loggerLogSpy.mockClear();
    await updateAttribute(device, ColorControlServer, 'colorTemperatureMireds', 350, device.log);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`${db}Update endpoint ${or}${device.id}${db}:${or}${device.number}${db} attribute ${hk}ColorControl${db}.${hk}colorTemperatureMireds${db}`));
    expect(device.getAttribute(ColorControl.Cluster.id, 'colorTemperatureMireds')).toBe(350);

    loggerLogSpy.mockClear();
    await updateAttribute(device, ColorControlServer, 'colorTemperatureMireds', 350, device.log);
    expect(loggerLogSpy).not.toHaveBeenCalled();
    expect(device.getAttribute(ColorControl.Cluster.id, 'colorTemperatureMireds')).toBe(350);

    await updateAttribute(device, ColorControl.Cluster, 'colorTemperatureMireds', 340);
    expect(device.getAttribute(ColorControl.Cluster.id, 'colorTemperatureMireds')).toBe(340);
    await updateAttribute(device, ColorControl.Cluster.id, 'colorTemperatureMireds', 330);
    expect(device.getAttribute(ColorControl.Cluster.id, 'colorTemperatureMireds')).toBe(330);
    await updateAttribute(device, 'ColorControl', 'colorTemperatureMireds', 320);
    expect(device.getAttribute(ColorControl.Cluster.id, 'colorTemperatureMireds')).toBe(320);
    await updateAttribute(device, 'colorControl', 'colorTemperatureMireds', 310);
    expect(device.getAttribute(ColorControl.Cluster.id, 'colorTemperatureMireds')).toBe(310);
    await updateAttribute(device, 'color', 'colorTemperatureMireds', 310);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`updateAttribute ${hk}colorTemperatureMireds${er} error: cluster not found`));
    await updateAttribute(device, 'colorControl', 'colorTemperature', 310);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`updateAttribute error: Attribute ${hk}colorTemperature${er} not found on cluster`));

    const colorCapabilities = device.getAttribute(ColorControl.Cluster.id, 'colorCapabilities') as { hueSaturation: boolean; enhancedHue: boolean; colorLoop: boolean; xy: boolean; colorTemperature: boolean };
    expect(await device.updateAttribute('colorControl', 'colorCapabilities', colorCapabilities)).toBe(false);
    colorCapabilities.colorTemperature = false;
    expect(await device.updateAttribute('colorControl', 'colorCapabilities', colorCapabilities)).toBe(true);

    await device.configureColorControlMode(ColorControl.ColorMode.CurrentHueAndCurrentSaturation);
    (matterbridge as any).frontend.getClusterTextFromDevice(device);

    await device.configureColorControlMode(ColorControl.ColorMode.CurrentXAndCurrentY);
    (matterbridge as any).frontend.getClusterTextFromDevice(device);

    expect(device.hasAttributeServer(ColorControl.Cluster, 'colorMode')).toBe(true);
    expect(device.hasAttributeServer(ColorControl.Cluster, 'currentX')).toBe(true);
    expect(device.hasAttributeServer(ColorControl.Cluster, 'currentY')).toBe(true);
    expect(device.hasAttributeServer(ColorControl.Cluster, 'currentHue')).toBe(true);
    expect(device.hasAttributeServer(ColorControl.Cluster, 'currentSaturation')).toBe(true);
    expect(device.hasAttributeServer(ColorControl.Cluster, 'colorTemperatureMireds')).toBe(true);
    expect(device.hasAttributeServer(ColorControl.Cluster, 'startUpColorTemperatureMireds')).toBe(true);
    expect(device.getAttribute(ColorControl.Cluster.id, 'currentX')).toBe(500);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createEnhancedColorControlClusterServer', async () => {
    const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'EnhancedLight' });
    expect(device).toBeDefined();
    device.createEnhancedColorControlClusterServer();
    device.addRequiredClusterServers();
    expect(device.hasAttributeServer(ColorControl.Cluster, 'colorMode')).toBe(true);
    expect(device.hasAttributeServer(ColorControl.Cluster, 'enhancedColorMode')).toBe(true);
    expect(device.hasAttributeServer(ColorControl.Cluster, 'currentX')).toBe(true);
    expect(device.hasAttributeServer(ColorControl.Cluster, 'currentY')).toBe(true);
    expect(device.hasAttributeServer(ColorControl.Cluster, 'currentHue')).toBe(true);
    expect(device.hasAttributeServer(ColorControl.Cluster, 'enhancedCurrentHue')).toBe(true);
    expect(device.hasAttributeServer(ColorControl.Cluster, 'currentSaturation')).toBe(true);
    expect(device.hasAttributeServer(ColorControl.Cluster, 'colorTemperatureMireds')).toBe(true);
    expect(device.hasAttributeServer(ColorControl.Cluster, 'startUpColorTemperatureMireds')).toBe(true);

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
    const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'XYLight' });
    expect(device).toBeDefined();
    device.createXyColorControlClusterServer();
    device.addRequiredClusterServers();
    expect(device.hasAttributeServer(ColorControl.Cluster, 'colorMode')).toBe(true);
    expect(device.hasAttributeServer(ColorControl.Cluster, 'currentX')).toBe(true);
    expect(device.hasAttributeServer(ColorControl.Cluster, 'currentY')).toBe(true);
    expect(device.hasAttributeServer(ColorControl.Cluster, 'currentHue')).toBe(false);
    expect(device.hasAttributeServer(ColorControl.Cluster, 'currentSaturation')).toBe(false);
    expect(device.hasAttributeServer(ColorControl.Cluster, 'colorTemperatureMireds')).toBe(true);
    expect(device.hasAttributeServer(ColorControl.Cluster, 'startUpColorTemperatureMireds')).toBe(true);

    await add(device);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createHsColorControlClusterServer', async () => {
    const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'HSLight' });
    expect(device).toBeDefined();
    device.createHsColorControlClusterServer();
    device.addRequiredClusterServers();
    expect(device.hasAttributeServer(ColorControl.Cluster, 'colorMode')).toBe(true);
    expect(device.hasAttributeServer(ColorControl.Cluster, 'currentX')).toBe(false);
    expect(device.hasAttributeServer(ColorControl.Cluster, 'currentY')).toBe(false);
    expect(device.hasAttributeServer(ColorControl.Cluster, 'currentHue')).toBe(true);
    expect(device.hasAttributeServer(ColorControl.Cluster, 'currentSaturation')).toBe(true);
    expect(device.hasAttributeServer(ColorControl.Cluster, 'colorTemperatureMireds')).toBe(true);
    expect(device.hasAttributeServer(ColorControl.Cluster, 'startUpColorTemperatureMireds')).toBe(true);

    await add(device);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createCtColorControlClusterServer', async () => {
    const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'CTLight' });
    expect(device).toBeDefined();
    device.createCtColorControlClusterServer();
    device.addRequiredClusterServers(); //
    expect(device.hasAttributeServer(ColorControl.Cluster, 'colorMode')).toBe(true);
    expect(device.hasAttributeServer(ColorControl.Cluster, 'currentX')).toBe(false);
    expect(device.hasAttributeServer(ColorControl.Cluster, 'currentY')).toBe(false);
    expect(device.hasAttributeServer(ColorControl.Cluster, 'currentHue')).toBe(false);
    expect(device.hasAttributeServer(ColorControl.Cluster, 'currentSaturation')).toBe(false);
    expect(device.hasAttributeServer(ColorControl.Cluster, 'colorTemperatureMireds')).toBe(true);
    expect(device.hasAttributeServer(ColorControl.Cluster, 'startUpColorTemperatureMireds')).toBe(true);

    await add(device);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultWindowCoveringClusterServer', async () => {
    const device = new MatterbridgeEndpoint(coverDevice, { uniqueStorageKey: 'LiftScreen' });
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
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Set WindowCovering currentPositionLiftPercent100ths and targetPositionLiftPercent100ths to 0 and operationalStatus to Stopped.`));
    expect(device.getAttribute(WindowCovering.Cluster.id, 'targetPositionLiftPercent100ths')).toBe(device.getAttribute(WindowCovering.Cluster.id, 'currentPositionLiftPercent100ths'));
    expect(device.getWindowCoveringStatus()).toBe(WindowCovering.MovementStatus.Stopped);
    await device.setWindowCoveringCurrentTargetStatus(50, 50, WindowCovering.MovementStatus.Closing);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Set WindowCovering currentPositionLiftPercent100ths: 50, targetPositionLiftPercent100ths: 50 and operationalStatus: 2.`));
    expect(device.getWindowCoveringStatus()).toBe(WindowCovering.MovementStatus.Closing);
    await device.setWindowCoveringStatus(WindowCovering.MovementStatus.Opening);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Set WindowCovering operationalStatus: 1`));
    expect(device.getWindowCoveringStatus()).toBe(WindowCovering.MovementStatus.Opening);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Get WindowCovering operationalStatus: 1`));
    await device.setWindowCoveringTargetAndCurrentPosition(50);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Set WindowCovering currentPositionLiftPercent100ths: 50 and targetPositionLiftPercent100ths: 50.`));
    expect(device.getAttribute(WindowCovering.Cluster.id, 'targetPositionLiftPercent100ths')).toBe(50);
    expect(device.getAttribute(WindowCovering.Cluster.id, 'currentPositionLiftPercent100ths')).toBe(50);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultLiftTiltWindowCoveringClusterServer', async () => {
    const device = new MatterbridgeEndpoint(coverDevice, { uniqueStorageKey: 'TiltScreen' });
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
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Set WindowCovering currentPositionTiltPercent100ths and targetPositionTiltPercent100ths to 0 and operationalStatus to Stopped.`));
    expect(device.getAttribute(WindowCovering.Cluster.id, 'targetPositionTiltPercent100ths')).toBe(device.getAttribute(WindowCovering.Cluster.id, 'currentPositionTiltPercent100ths'));
    expect(device.getWindowCoveringStatus()).toBe(WindowCovering.MovementStatus.Stopped);
    await device.setWindowCoveringCurrentTargetStatus(50, 50, WindowCovering.MovementStatus.Closing);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Set WindowCovering currentPositionLiftPercent100ths: 50, targetPositionLiftPercent100ths: 50 and operationalStatus: 2.`));
    expect(device.getWindowCoveringStatus()).toBe(WindowCovering.MovementStatus.Closing);
    await device.setWindowCoveringStatus(WindowCovering.MovementStatus.Opening);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Set WindowCovering operationalStatus: 1`));
    expect(device.getWindowCoveringStatus()).toBe(WindowCovering.MovementStatus.Opening);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Get WindowCovering operationalStatus: 1`));
    await device.setWindowCoveringTargetAndCurrentPosition(50, 50);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Set WindowCovering currentPositionLiftPercent100ths: 50 and targetPositionLiftPercent100ths: 50.`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Set WindowCovering currentPositionTiltPercent100ths: 50 and targetPositionTiltPercent100ths: 50.`));
    expect(device.getAttribute(WindowCovering.Cluster.id, 'targetPositionLiftPercent100ths')).toBe(50);
    expect(device.getAttribute(WindowCovering.Cluster.id, 'currentPositionLiftPercent100ths')).toBe(50);
    expect(device.getAttribute(WindowCovering.Cluster.id, 'targetPositionTiltPercent100ths')).toBe(50);
    expect(device.getAttribute(WindowCovering.Cluster.id, 'currentPositionTiltPercent100ths')).toBe(50);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultThermostatClusterServer', async () => {
    const device = new MatterbridgeEndpoint(thermostatDevice, { uniqueStorageKey: 'ThermoAuto' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultThermostatClusterServer();
    device.createDefaultThermostatUserInterfaceConfigurationClusterServer();
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'localTemperature')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'outdoorTemperature')).toBe(false);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'systemMode')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'occupiedHeatingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'occupiedCoolingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'unoccupiedHeatingSetpoint')).toBe(false);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'unoccupiedCoolingSetpoint')).toBe(false);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'occupancy')).toBe(false);
    expect(device.hasAttributeServer(ThermostatUserInterfaceConfiguration.Cluster.id, 'temperatureDisplayMode')).toBe(true);
    expect(featuresFor(device, 'Thermostat')).toEqual({
      'autoMode': true,
      'cooling': true,
      'heating': true,
      'localTemperatureNotExposed': false,
      'matterScheduleConfiguration': false,
      'occupancy': false,
      'presets': false,
      'scheduleConfiguration': false,
      'setback': false,
    });

    if (matterbridge.aggregatorNode) await addDevice(matterbridge.aggregatorNode, device);
    expect(device.getAttribute(Thermostat.Cluster.id, 'systemMode')).toBe(Thermostat.SystemMode.Auto);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultThermostatClusterServer mutable with occupancy and outdoorTemperature', async () => {
    const device = new MatterbridgeEndpoint(thermostatDevice, { uniqueStorageKey: 'ThermoAutoMutableOccupancyOutdoor' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultThermostatClusterServer(22, 20, 24, 1, 0, 50, 0, 50, 18, 26, true, 20);
    device.createDefaultThermostatUserInterfaceConfigurationClusterServer();
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'localTemperature')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'outdoorTemperature')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'systemMode')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'occupiedHeatingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'occupiedCoolingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'unoccupiedHeatingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'unoccupiedCoolingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'occupancy')).toBe(true);
    expect(device.hasAttributeServer(ThermostatUserInterfaceConfiguration.Cluster.id, 'temperatureDisplayMode')).toBe(true);
    expect(featuresFor(device, 'Thermostat')).toEqual({
      'autoMode': true,
      'cooling': true,
      'heating': true,
      'localTemperatureNotExposed': false,
      'matterScheduleConfiguration': false,
      'occupancy': true,
      'presets': false,
      'scheduleConfiguration': false,
      'setback': false,
    });

    if (matterbridge.aggregatorNode) await addDevice(matterbridge.aggregatorNode, device);
    expect(device.getAttribute(Thermostat.Cluster.id, 'systemMode')).toBe(Thermostat.SystemMode.Auto);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultThermostatClusterServer mutable with occupancy', async () => {
    const device = new MatterbridgeEndpoint(thermostatDevice, { uniqueStorageKey: 'ThermoAutoMutableOccupancy' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultThermostatClusterServer(22, 20, 24, 1, 0, 50, 0, 50, 18, 26, true);
    device.createDefaultThermostatUserInterfaceConfigurationClusterServer();
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'localTemperature')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'outdoorTemperature')).toBe(false);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'systemMode')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'occupiedHeatingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'occupiedCoolingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'unoccupiedHeatingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'unoccupiedCoolingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'occupancy')).toBe(true);
    expect(device.hasAttributeServer(ThermostatUserInterfaceConfiguration.Cluster.id, 'temperatureDisplayMode')).toBe(true);
    expect(featuresFor(device, 'Thermostat')).toEqual({
      'autoMode': true,
      'cooling': true,
      'heating': true,
      'localTemperatureNotExposed': false,
      'matterScheduleConfiguration': false,
      'occupancy': true,
      'presets': false,
      'scheduleConfiguration': false,
      'setback': false,
    });

    if (matterbridge.aggregatorNode) await addDevice(matterbridge.aggregatorNode, device);
    expect(device.getAttribute(Thermostat.Cluster.id, 'systemMode')).toBe(Thermostat.SystemMode.Auto);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultThermostatClusterServer mutable with outdoorTemperature', async () => {
    const device = new MatterbridgeEndpoint(thermostatDevice, { uniqueStorageKey: 'ThermoAutoMutableOutdoor' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultThermostatClusterServer(22, 20, 24, 1, 0, 50, 0, 50, undefined, undefined, undefined, 20);
    device.createDefaultThermostatUserInterfaceConfigurationClusterServer();
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'localTemperature')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'outdoorTemperature')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'systemMode')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'occupiedHeatingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'occupiedCoolingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'unoccupiedHeatingSetpoint')).toBe(false);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'unoccupiedCoolingSetpoint')).toBe(false);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'occupancy')).toBe(false);
    expect(device.hasAttributeServer(ThermostatUserInterfaceConfiguration.Cluster.id, 'temperatureDisplayMode')).toBe(true);
    expect(featuresFor(device, 'Thermostat')).toEqual({
      'autoMode': true,
      'cooling': true,
      'heating': true,
      'localTemperatureNotExposed': false,
      'matterScheduleConfiguration': false,
      'occupancy': false,
      'presets': false,
      'scheduleConfiguration': false,
      'setback': false,
    });

    if (matterbridge.aggregatorNode) await addDevice(matterbridge.aggregatorNode, device);
    expect(device.getAttribute(Thermostat.Cluster.id, 'systemMode')).toBe(Thermostat.SystemMode.Auto);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultHeatingThermostatClusterServer', async () => {
    const device = new MatterbridgeEndpoint(thermostatDevice, { uniqueStorageKey: 'ThermoHeat' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultHeatingThermostatClusterServer();
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'localTemperature')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'outdoorTemperature')).toBe(false);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'systemMode')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'occupiedHeatingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'occupiedCoolingSetpoint')).toBe(false);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'unoccupiedHeatingSetpoint')).toBe(false);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'unoccupiedCoolingSetpoint')).toBe(false);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'occupancy')).toBe(false);
    expect(featuresFor(device, 'Thermostat')).toEqual({
      'autoMode': false,
      'cooling': false,
      'heating': true,
      'localTemperatureNotExposed': false,
      'matterScheduleConfiguration': false,
      'occupancy': false,
      'presets': false,
      'scheduleConfiguration': false,
      'setback': false,
    });

    if (matterbridge.aggregatorNode) await addDevice(matterbridge.aggregatorNode, device);
    expect(device.getAttribute(Thermostat.Cluster.id, 'systemMode')).toBe(Thermostat.SystemMode.Heat);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultHeatingThermostatClusterServer mutable with occupancy and outdoorTemperature', async () => {
    const device = new MatterbridgeEndpoint(thermostatDevice, { uniqueStorageKey: 'ThermoHeatMutableOccupancyOutdoor' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultHeatingThermostatClusterServer(undefined, undefined, 0, 50, undefined, false, null);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'localTemperature')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'outdoorTemperature')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'systemMode')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'occupiedHeatingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'occupiedCoolingSetpoint')).toBe(false);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'unoccupiedHeatingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'unoccupiedCoolingSetpoint')).toBe(false);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'occupancy')).toBe(true);
    expect(featuresFor(device, 'Thermostat')).toEqual({
      'autoMode': false,
      'cooling': false,
      'heating': true,
      'localTemperatureNotExposed': false,
      'matterScheduleConfiguration': false,
      'occupancy': true,
      'presets': false,
      'scheduleConfiguration': false,
      'setback': false,
    });

    if (matterbridge.aggregatorNode) await addDevice(matterbridge.aggregatorNode, device);
    expect(device.getAttribute(Thermostat.Cluster.id, 'systemMode')).toBe(Thermostat.SystemMode.Heat);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultCoolingThermostatClusterServer', async () => {
    const device = new MatterbridgeEndpoint(thermostatDevice, { uniqueStorageKey: 'ThermoCool' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultCoolingThermostatClusterServer();
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'localTemperature')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'outdoorTemperature')).toBe(false);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'systemMode')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'occupiedHeatingSetpoint')).toBe(false);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'occupiedCoolingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'unoccupiedHeatingSetpoint')).toBe(false);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'unoccupiedCoolingSetpoint')).toBe(false);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'occupancy')).toBe(false);
    expect(featuresFor(device, 'Thermostat')).toEqual({
      'autoMode': false,
      'cooling': true,
      'heating': false,
      'localTemperatureNotExposed': false,
      'matterScheduleConfiguration': false,
      'occupancy': false,
      'presets': false,
      'scheduleConfiguration': false,
      'setback': false,
    });

    if (matterbridge.aggregatorNode) await addDevice(matterbridge.aggregatorNode, device);
    expect(device.getAttribute(Thermostat.Cluster.id, 'systemMode')).toBe(Thermostat.SystemMode.Cool);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultCoolingThermostatClusterServer mutable with occupancy and outdoorTemperature', async () => {
    const device = new MatterbridgeEndpoint(thermostatDevice, { uniqueStorageKey: 'ThermoCoolMutableOccupancyOutdoor' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultCoolingThermostatClusterServer(undefined, undefined, 0, 50, undefined, false, null);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'localTemperature')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'outdoorTemperature')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'systemMode')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'occupiedHeatingSetpoint')).toBe(false);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'occupiedCoolingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'unoccupiedHeatingSetpoint')).toBe(false);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'unoccupiedCoolingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'occupancy')).toBe(true);
    expect(featuresFor(device, 'Thermostat')).toEqual({
      'autoMode': false,
      'cooling': true,
      'heating': false,
      'localTemperatureNotExposed': false,
      'matterScheduleConfiguration': false,
      'occupancy': true,
      'presets': false,
      'scheduleConfiguration': false,
      'setback': false,
    });

    if (matterbridge.aggregatorNode) await addDevice(matterbridge.aggregatorNode, device);
    expect(device.getAttribute(Thermostat.Cluster.id, 'systemMode')).toBe(Thermostat.SystemMode.Cool);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultFanControlClusterServer', async () => {
    const device = new MatterbridgeEndpoint(fanDevice, { uniqueStorageKey: 'Fan' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultGroupsClusterServer();
    device.createDefaultFanControlClusterServer();
    expect(device.hasAttributeServer(FanControl.Cluster, 'fanMode')).toBe(true);
    expect(device.hasAttributeServer(FanControl.Cluster, 'percentSetting')).toBe(true);
    expect(device.hasAttributeServer(FanControl.Cluster, 'speedSetting')).toBe(false);

    await add(device);
    expect((device.getAttribute(FanControl.Cluster.id, 'featureMap') as Record<string, boolean>).auto).toBe(true);
    expect((device.getAttribute(FanControl.Cluster.id, 'featureMap') as Record<string, boolean>).step).toBe(true);
    expect((device.getAttribute(FanControl.Cluster.id, 'featureMap') as Record<string, boolean>).multiSpeed).toBe(false);
    expect(device.getAttribute(FanControl.Cluster.id, 'fanMode')).toBe(FanControl.FanMode.Off);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createBaseFanControlClusterServer', async () => {
    const device = new MatterbridgeEndpoint(fanDevice, { uniqueStorageKey: 'Fan2' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultGroupsClusterServer();
    device.createBaseFanControlClusterServer();
    expect(device.hasAttributeServer(FanControl.Cluster, 'fanMode')).toBe(true);
    expect(device.hasAttributeServer(FanControl.Cluster, 'percentSetting')).toBe(true);
    expect(device.hasAttributeServer(FanControl.Cluster, 'speedSetting')).toBe(false);
    expect(device.hasAttributeServer(FanControl.Cluster, 'percentCurrent')).toBe(true);
    expect(device.hasAttributeServer(FanControl.Cluster, 'speedCurrent')).toBe(false);
    expect(featuresFor(device, 'FanControl')).toEqual({});

    await add(device);
    expect((device.getAttribute(FanControl.Cluster.id, 'featureMap') as Record<string, boolean>).auto).toBe(false);
    expect((device.getAttribute(FanControl.Cluster.id, 'featureMap') as Record<string, boolean>).step).toBe(false);
    expect((device.getAttribute(FanControl.Cluster.id, 'featureMap') as Record<string, boolean>).multiSpeed).toBe(false);
    expect(device.getAttribute(FanControl.Cluster.id, 'fanMode')).toBe(FanControl.FanMode.Off);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createMultiSpeedFanControlClusterServer', async () => {
    const device = new MatterbridgeEndpoint(fanDevice, { uniqueStorageKey: 'Fan3' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultGroupsClusterServer();
    device.createMultiSpeedFanControlClusterServer();
    expect(device.hasAttributeServer(FanControl.Cluster, 'fanMode')).toBe(true);
    expect(device.hasAttributeServer(FanControl.Cluster, 'percentSetting')).toBe(true);
    expect(device.hasAttributeServer(FanControl.Cluster, 'speedSetting')).toBe(true);
    expect(device.hasAttributeServer(FanControl.Cluster, 'percentCurrent')).toBe(true);
    expect(device.hasAttributeServer(FanControl.Cluster, 'speedCurrent')).toBe(true);
    expect(featuresFor(device, 'FanControl')).toEqual({ 'airflowDirection': false, 'auto': true, 'multiSpeed': true, 'rocking': false, 'step': true, 'wind': false });

    await add(device);
    expect((device.getAttribute(FanControl.Cluster.id, 'featureMap') as Record<string, boolean>).auto).toBe(true);
    expect((device.getAttribute(FanControl.Cluster.id, 'featureMap') as Record<string, boolean>).step).toBe(true);
    expect((device.getAttribute(FanControl.Cluster.id, 'featureMap') as Record<string, boolean>).multiSpeed).toBe(true);
    expect(device.getAttribute(FanControl.Cluster.id, 'fanMode')).toBe(FanControl.FanMode.Off);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createCompleteFanControlClusterServer', async () => {
    const device = new MatterbridgeEndpoint(fanDevice, { uniqueStorageKey: 'Fan4' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultGroupsClusterServer();
    device.createCompleteFanControlClusterServer();
    expect(device.hasAttributeServer(FanControl.Cluster, 'fanMode')).toBe(true);
    expect(device.hasAttributeServer(FanControl.Cluster, 'percentSetting')).toBe(true);
    expect(device.hasAttributeServer(FanControl.Cluster, 'speedSetting')).toBe(true);
    expect(device.hasAttributeServer(FanControl.Cluster, 'rockSupport')).toBe(true);
    expect(device.hasAttributeServer(FanControl.Cluster, 'windSupport')).toBe(true);
    expect(device.hasAttributeServer(FanControl.Cluster, 'airflowDirection')).toBe(true);
    expect(featuresFor(device, 'FanControl')).toEqual({ 'airflowDirection': true, 'auto': true, 'multiSpeed': true, 'rocking': true, 'step': true, 'wind': true });

    await add(device);
    expect((device.getAttribute(FanControl.Cluster.id, 'featureMap') as Record<string, boolean>).auto).toBe(true);
    expect((device.getAttribute(FanControl.Cluster.id, 'featureMap') as Record<string, boolean>).step).toBe(true);
    expect((device.getAttribute(FanControl.Cluster.id, 'featureMap') as Record<string, boolean>).multiSpeed).toBe(true);
    expect((device.getAttribute(FanControl.Cluster.id, 'featureMap') as Record<string, boolean>).rocking).toBe(true);
    expect((device.getAttribute(FanControl.Cluster.id, 'featureMap') as Record<string, boolean>).wind).toBe(true);
    expect((device.getAttribute(FanControl.Cluster.id, 'featureMap') as Record<string, boolean>).airflowDirection).toBe(true);
    expect(device.getAttribute(FanControl.Cluster.id, 'fanMode')).toBe(FanControl.FanMode.Off);
    (matterbridge as any).frontend.getClusterTextFromDevice(device);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createOnOffFanControlClusterServer', async () => {
    const device = new MatterbridgeEndpoint(fanDevice, { uniqueStorageKey: 'Fan5' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultGroupsClusterServer();
    device.createOnOffFanControlClusterServer();
    expect(device.hasAttributeServer(FanControl.Cluster, 'fanMode')).toBe(true);
    expect(device.hasAttributeServer(FanControl.Cluster, 'percentSetting')).toBe(true);
    expect(device.hasAttributeServer(FanControl.Cluster, 'speedSetting')).toBe(false);
    expect(device.hasAttributeServer(FanControl.Cluster, 'rockSupport')).toBe(false);
    expect(device.hasAttributeServer(FanControl.Cluster, 'windSupport')).toBe(false);
    expect(device.hasAttributeServer(FanControl.Cluster, 'airflowDirection')).toBe(false);
    expect(featuresFor(device, 'FanControl')).toEqual({});

    await add(device);
    expect((device.getAttribute(FanControl.Cluster.id, 'featureMap') as Record<string, boolean>).auto).toBe(false);
    expect((device.getAttribute(FanControl.Cluster.id, 'featureMap') as Record<string, boolean>).step).toBe(false);
    expect((device.getAttribute(FanControl.Cluster.id, 'featureMap') as Record<string, boolean>).multiSpeed).toBe(false);
    expect((device.getAttribute(FanControl.Cluster.id, 'featureMap') as Record<string, boolean>).rocking).toBe(false);
    expect((device.getAttribute(FanControl.Cluster.id, 'featureMap') as Record<string, boolean>).wind).toBe(false);
    expect((device.getAttribute(FanControl.Cluster.id, 'featureMap') as Record<string, boolean>).airflowDirection).toBe(false);
    expect(device.getAttribute(FanControl.Cluster.id, 'fanMode')).toBe(FanControl.FanMode.Off);
    (matterbridge as any).frontend.getClusterTextFromDevice(device);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultHepaFilterMonitoringClusterServer', async () => {
    const device = new MatterbridgeEndpoint(airPurifier, { uniqueStorageKey: 'AirPurifier' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createBaseFanControlClusterServer();
    device.createDefaultHepaFilterMonitoringClusterServer();
    device.createDefaultActivatedCarbonFilterMonitoringClusterServer();
    expect(device.hasAttributeServer(FanControl.Cluster, 'fanMode')).toBe(true);
    expect(device.hasAttributeServer(HepaFilterMonitoring.Cluster, 'changeIndication')).toBe(true);
    expect(device.hasAttributeServer(ActivatedCarbonFilterMonitoring.Cluster, 'changeIndication')).toBe(true);

    await add(device);
    expect(device.getAttribute(FanControl.Cluster.id, 'fanMode')).toBe(FanControl.FanMode.Off);
    expect(device.getAttribute(HepaFilterMonitoring.Cluster.id, 'changeIndication')).toBe(ResourceMonitoring.ChangeIndication.Ok);
    expect(device.getAttribute(ActivatedCarbonFilterMonitoring.Cluster.id, 'changeIndication')).toBe(ResourceMonitoring.ChangeIndication.Ok);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultDoorLockClusterServer', async () => {
    const device = new MatterbridgeEndpoint(doorLockDevice, { uniqueStorageKey: 'Lock' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultDoorLockClusterServer();
    expect(device.hasAttributeServer(DoorLock.Cluster, 'operatingMode')).toBe(true);
    expect(device.hasAttributeServer(DoorLock.Cluster, 'lockState')).toBe(true);
    expect(device.hasAttributeServer(DoorLock.Cluster, 'lockType')).toBe(true);

    await add(device);
    expect(device.getAttribute(DoorLock.Cluster.id, 'lockState')).toBe(DoorLock.LockState.Locked);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultModeSelectClusterServer', async () => {
    const device = new MatterbridgeEndpoint(modeSelect, { uniqueStorageKey: 'ModeSelect' });
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
    expect(device.hasAttributeServer(ModeSelect.Cluster, 'description')).toBe(true);
    expect(device.hasAttributeServer(ModeSelect.Cluster, 'supportedModes')).toBe(true);
    expect(device.hasAttributeServer(ModeSelect.Cluster, 'currentMode')).toBe(true);

    await add(device);
    expect(device.getAttribute(ModeSelect.Cluster.id, 'currentMode')).toBe(0);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultValveConfigurationAndControlClusterServer', async () => {
    const device = new MatterbridgeEndpoint(waterValve, { uniqueStorageKey: 'Valve' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultValveConfigurationAndControlClusterServer();
    expect(device.hasAttributeServer(ValveConfigurationAndControl.Cluster, 'currentState')).toBe(true);
    expect(device.hasAttributeServer(ValveConfigurationAndControl.Cluster, 'targetState')).toBe(true);
    expect(device.hasAttributeServer(ValveConfigurationAndControl.Cluster, 'currentLevel')).toBe(true);
    expect(device.hasAttributeServer(ValveConfigurationAndControl.Cluster, 'targetLevel')).toBe(true);

    await add(device);
    expect(device.getAttribute(ValveConfigurationAndControl.Cluster.id, 'currentState')).toBe(ValveConfigurationAndControl.ValveState.Closed);
    expect(device.getAttribute(ValveConfigurationAndControl.Cluster.id, 'currentLevel')).toBe(0);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultPumpConfigurationAndControlClusterServer', async () => {
    const device = new MatterbridgeEndpoint(pumpDevice, { uniqueStorageKey: 'Pump' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createOnOffClusterServer();
    device.createDefaultPumpConfigurationAndControlClusterServer();
    expect(device.hasAttributeServer(PumpConfigurationAndControl.Cluster.id, 'operationMode')).toBe(true);
    expect(device.hasAttributeServer(PumpConfigurationAndControl.Cluster.id, 'effectiveControlMode')).toBe(true);
    expect(device.hasAttributeServer(PumpConfigurationAndControl.Cluster.id, 'effectiveOperationMode')).toBe(true);

    await add(device);
    expect(device.getAttribute(PumpConfigurationAndControl.Cluster.id, 'operationMode')).toBe(PumpConfigurationAndControl.OperationMode.Normal);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultSmokeCOAlarmClusterServer', async () => {
    const device = new MatterbridgeEndpoint(smokeCoAlarm, { uniqueStorageKey: 'SmokeAlarm' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultSmokeCOAlarmClusterServer();
    expect(device.hasAttributeServer(SmokeCoAlarm.Cluster.id, 'smokeState')).toBe(true);
    expect(device.hasAttributeServer(SmokeCoAlarm.Cluster.id, 'coState')).toBe(true);
    expect(device.hasAttributeServer(SmokeCoAlarm.Cluster.id, 'batteryAlert')).toBe(true);
    expect(device.hasAttributeServer(SmokeCoAlarm.Cluster.id, 'endOfServiceAlert')).toBe(true);

    await add(device);
    expect(device.getAttribute(SmokeCoAlarm.Cluster.id, 'smokeState')).toBe(SmokeCoAlarm.AlarmState.Normal);
    expect(device.getAttribute(SmokeCoAlarm.Cluster.id, 'coState')).toBe(SmokeCoAlarm.AlarmState.Normal);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultSmokeCOAlarmClusterServer smoke only', async () => {
    const device = new MatterbridgeEndpoint(smokeCoAlarm, { uniqueStorageKey: 'SmokeAlarmSmokeOnly' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createSmokeOnlySmokeCOAlarmClusterServer();
    expect(device.hasAttributeServer(SmokeCoAlarm.Cluster.id, 'smokeState')).toBe(true);
    expect(device.hasAttributeServer(SmokeCoAlarm.Cluster.id, 'coState')).toBe(false);
    expect(device.hasAttributeServer(SmokeCoAlarm.Cluster.id, 'batteryAlert')).toBe(true);
    expect(device.hasAttributeServer(SmokeCoAlarm.Cluster.id, 'endOfServiceAlert')).toBe(true);

    await add(device);
    expect(device.getAttribute(SmokeCoAlarm.Cluster.id, 'smokeState')).toBe(SmokeCoAlarm.AlarmState.Normal);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultSmokeCOAlarmClusterServer co only', async () => {
    const device = new MatterbridgeEndpoint(smokeCoAlarm, { uniqueStorageKey: 'SmokeAlarmCoOnly' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createCoOnlySmokeCOAlarmClusterServer();
    expect(device.hasAttributeServer(SmokeCoAlarm.Cluster.id, 'smokeState')).toBe(false);
    expect(device.hasAttributeServer(SmokeCoAlarm.Cluster.id, 'coState')).toBe(true);
    expect(device.hasAttributeServer(SmokeCoAlarm.Cluster.id, 'batteryAlert')).toBe(true);
    expect(device.hasAttributeServer(SmokeCoAlarm.Cluster.id, 'endOfServiceAlert')).toBe(true);

    await add(device);
    expect(device.getAttribute(SmokeCoAlarm.Cluster.id, 'coState')).toBe(SmokeCoAlarm.AlarmState.Normal);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultSwitchClusterServer', async () => {
    const device = new MatterbridgeEndpoint(genericSwitch, { uniqueStorageKey: 'SwitchMomentary' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultSwitchClusterServer();
    expect(device.hasAttributeServer(Switch.Cluster.id, 'numberOfPositions')).toBe(true);
    expect(device.hasAttributeServer(Switch.Cluster.id, 'currentPosition')).toBe(true);
    expect(device.hasAttributeServer(Switch.Cluster.id, 'multiPressMax')).toBe(true);

    await device.triggerSwitchEvent('Single', device.log);
    await device.triggerSwitchEvent('Double', device.log);
    await device.triggerSwitchEvent('Long', device.log);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Endpoint number not assigned on endpoint'));

    await add(device);
    (matterbridge as any).frontend.getClusterTextFromDevice(device);

    await device.triggerSwitchEvent('Press', device.log);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('triggerSwitchEvent Press error: Switch cluster with LatchingSwitch not found'));

    expect((device.getAttribute(Switch.Cluster.id, 'featureMap') as Record<string, boolean>).momentarySwitch).toBe(true);
    expect((device.getAttribute(Switch.Cluster.id, 'featureMap') as Record<string, boolean>).momentarySwitchRelease).toBe(true);
    expect((device.getAttribute(Switch.Cluster.id, 'featureMap') as Record<string, boolean>).momentarySwitchLongPress).toBe(true);
    expect((device.getAttribute(Switch.Cluster.id, 'featureMap') as Record<string, boolean>).momentarySwitchMultiPress).toBe(true);
    expect((device.getAttribute(Switch.Cluster.id, 'featureMap') as Record<string, boolean>).latchingSwitch).toBe(false);

    loggerLogSpy.mockClear();
    await device.triggerSwitchEvent('Single', device.log);
    await device.triggerSwitchEvent('Double', device.log);
    await device.triggerSwitchEvent('Long', device.log);
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Endpoint number not assigned on endpoint'));
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultMomentarySwitchClusterServer', async () => {
    const device = new MatterbridgeEndpoint(genericSwitch, { uniqueStorageKey: 'SwitchMomentarySingle' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultMomentarySwitchClusterServer();
    expect(device.hasAttributeServer(Switch.Cluster.id, 'numberOfPositions')).toBe(true);
    expect(device.hasAttributeServer(Switch.Cluster.id, 'currentPosition')).toBe(true);
    expect(device.hasAttributeServer(Switch.Cluster.id, 'multiPressMax')).toBe(false);

    await device.triggerSwitchEvent('Single', device.log);
    await device.triggerSwitchEvent('Double', device.log);
    await device.triggerSwitchEvent('Long', device.log);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Endpoint number not assigned on endpoint'));

    await add(device);
    expect((matterbridge as any).frontend.getClusterTextFromDevice(device)).toBe('Position: 0');

    expect((device.getAttribute(Switch.Cluster.id, 'featureMap') as Record<string, boolean>).momentarySwitch).toBe(true);
    expect((device.getAttribute(Switch.Cluster.id, 'featureMap') as Record<string, boolean>).momentarySwitchRelease).toBe(false);
    expect((device.getAttribute(Switch.Cluster.id, 'featureMap') as Record<string, boolean>).momentarySwitchLongPress).toBe(false);
    expect((device.getAttribute(Switch.Cluster.id, 'featureMap') as Record<string, boolean>).momentarySwitchMultiPress).toBe(false);
    expect((device.getAttribute(Switch.Cluster.id, 'featureMap') as Record<string, boolean>).latchingSwitch).toBe(false);

    loggerLogSpy.mockClear();
    await device.triggerSwitchEvent('Single', device.log);
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Endpoint number not assigned on endpoint'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`${db}Trigger endpoint ${or}${device.id}:${device.number}${db} event ${hk}Switch.SinglePress${db}`));
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultLatchingSwitchClusterServer', async () => {
    const device = new MatterbridgeEndpoint(genericSwitch, { uniqueStorageKey: 'SwitchLatching' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultLatchingSwitchClusterServer();
    expect(device.hasAttributeServer(Switch.Cluster.id, 'numberOfPositions')).toBe(true);
    expect(device.hasAttributeServer(Switch.Cluster.id, 'currentPosition')).toBe(true);
    expect(device.hasAttributeServer(Switch.Cluster.id, 'multiPressMax')).toBe(false);

    await device.triggerSwitchEvent('Press', device.log);
    await device.triggerSwitchEvent('Release', device.log);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Endpoint number not assigned on endpoint'));

    await add(device);

    await device.triggerSwitchEvent('Single', device.log);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('triggerSwitchEvent Single error: Switch cluster with MomentarySwitch not found'));

    expect((device.getAttribute(Switch.Cluster.id, 'featureMap') as Record<string, boolean>).momentarySwitch).toBe(false);
    expect((device.getAttribute(Switch.Cluster.id, 'featureMap') as Record<string, boolean>).latchingSwitch).toBe(true);

    loggerLogSpy.mockClear();
    await device.triggerSwitchEvent('Press', device.log);
    await device.triggerSwitchEvent('Release', device.log);
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Endpoint number not assigned on endpoint'));
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultBooleanStateClusterServer', async () => {
    const device = new MatterbridgeEndpoint(contactSensor, { uniqueStorageKey: 'ContactSensor' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultBooleanStateClusterServer(false);
    expect(device.hasAttributeServer(BooleanState.Cluster.id, 'stateValue')).toBe(true);
    expect(device.hasAttributeServer('BooleanState', 'StateValue')).toBe(true);

    let called = false;
    device.subscribeAttribute(
      BooleanState.Cluster.id,
      'stateValue',
      (value) => {
        called = true;
      },
      device.log,
    );

    jest.clearAllMocks();
    await device.triggerEvent(BooleanStateConfiguration.Cluster.id, 'stateChange', { stateValue: true });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`triggerEvent ${hk}stateChange${er} error: cluster not found on endpoint ${or}ContactSensor${er}:${or}undefined${er}`));

    jest.clearAllMocks();
    await device.triggerEvent(BooleanState.Cluster.id, 'stateChange', { stateValue: true });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`triggerEvent ${hk}booleanState.stateChange${er} error: Endpoint ${or}ContactSensor${er}:${or}undefined${er} is in the ${BLUE}inactive${er} state`));

    jest.clearAllMocks();
    await device.setAttribute(BooleanState.Cluster.id, 'stateValue', true);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`setAttribute ${hk}booleanState.stateValue${er} error: Endpoint`));

    await add(device);

    expect(device.getAttribute(BooleanState.Cluster.id, 'stateValue')).toBe(false);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`${db}Subscribed endpoint`));
    await device.setAttribute(BooleanState.Cluster.id, 'stateValue', true);
    expect(called).toBe(true);

    jest.clearAllMocks();
    await device.setAttribute(BooleanStateConfiguration.Cluster.id, 'stateValue', true, device.log);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`setAttribute ${hk}stateValue${er} error`));

    jest.clearAllMocks();
    await device.setAttribute(BooleanState.Cluster.id, 'state', true, device.log);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`setAttribute error: Attribute ${hk}state${er} not found`));

    jest.clearAllMocks();
    device.getAttribute(BooleanStateConfiguration.Cluster.id, 'state', device.log);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`getAttribute ${hk}state${er} error: cluster not found on endpoint`));

    jest.clearAllMocks();
    device.getAttribute(BooleanState.Cluster.id, 'state', device.log);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`getAttribute error: Attribute ${hk}state${er} not found`));

    device.subscribeAttribute(
      BooleanStateConfiguration.Cluster.id,
      'stateValue',
      (value) => {
        //
      },
      device.log,
    );
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`subscribeAttribute ${hk}stateValue${er} error`));

    device.subscribeAttribute(
      BooleanState.Cluster.id,
      'state',
      (value) => {
        //
      },
      device.log,
    );
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`subscribeAttribute error: Attribute ${hk}state${er} not found`));

    jest.clearAllMocks();
    await device.triggerEvent(BooleanState.Cluster, 'stateChange', { stateValue: true }, device.log);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`${db}Trigger event ${hk}BooleanState${db}.${hk}stateChange${db} with`));

    jest.clearAllMocks();
    await device.triggerEvent(BooleanState.Cluster.id, 'stateChange', { stateValue: true }, device.log);
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
    await device.triggerEvent(BooleanStateConfiguration.Cluster.id, 'stateChange', { stateValue: true });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`triggerEvent ${hk}stateChange${er} error: cluster not found on endpoint`));

    jest.clearAllMocks();
    await device.triggerEvent(BooleanState.Cluster.id, 'state', { stateValue: true });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`triggerEvent ${hk}state${er} error: cluster booleanState not found on endpoint`));
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultBooleanStateConfigurationClusterServer for waterFreezeDetector', async () => {
    const device = new MatterbridgeEndpoint([waterFreezeDetector, powerSource], { uniqueStorageKey: 'WaterFreezeDetector' });
    expect(device).toBeDefined();
    expect(device.behaviors.optionsFor(DescriptorBehavior)).toEqual({
      deviceTypeList: [
        { deviceType: waterFreezeDetector.code, revision: waterFreezeDetector.revision },
        { deviceType: powerSource.code, revision: powerSource.revision },
      ],
    });
    device.createDefaultPowerSourceWiredClusterServer();
    expect(device.hasClusterServer(PowerSource.Cluster.id)).toBe(true);
    device.createDefaultIdentifyClusterServer();
    device.createDefaultBooleanStateClusterServer();
    device.createDefaultBooleanStateConfigurationClusterServer();
    expect(device.hasAttributeServer(BooleanState.Cluster.id, 'stateValue')).toBe(true);
    expect(device.hasAttributeServer(BooleanStateConfiguration.Cluster.id, 'currentSensitivityLevel')).toBe(true);

    await add(device);

    expect(device.getAttribute(BooleanState.Cluster.id, 'stateValue')).toBe(true);
    expect(device.getAttribute(BooleanStateConfiguration.Cluster.id, 'currentSensitivityLevel')).toBe(0);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultBooleanStateConfigurationClusterServer for waterLeakDetector', async () => {
    const device = new MatterbridgeEndpoint([waterLeakDetector, powerSource], { uniqueStorageKey: 'WaterLeakDetector' });
    expect(device).toBeDefined();
    expect(device.behaviors.optionsFor(DescriptorBehavior)).toEqual({
      deviceTypeList: [
        { deviceType: waterLeakDetector.code, revision: waterLeakDetector.revision },
        { deviceType: powerSource.code, revision: powerSource.revision },
      ],
    });
    device.createDefaultPowerSourceReplaceableBatteryClusterServer();
    expect(device.hasClusterServer(PowerSource.Cluster.id)).toBe(true);
    device.createDefaultIdentifyClusterServer();
    device.createDefaultBooleanStateClusterServer();
    device.createDefaultBooleanStateConfigurationClusterServer();
    expect(device.hasAttributeServer(BooleanState.Cluster.id, 'stateValue')).toBe(true);
    expect(device.hasAttributeServer(BooleanStateConfiguration.Cluster.id, 'currentSensitivityLevel')).toBe(true);

    await add(device);

    expect(device.getAttribute(BooleanState.Cluster.id, 'stateValue')).toBe(true);
    expect(device.getAttribute(BooleanStateConfiguration.Cluster.id, 'currentSensitivityLevel')).toBe(0);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultBooleanStateConfigurationClusterServer for rainSensor', async () => {
    const device = new MatterbridgeEndpoint([rainSensor, powerSource], { uniqueStorageKey: 'RainSensor' });
    expect(device).toBeDefined();
    expect(device.behaviors.optionsFor(DescriptorBehavior)).toEqual({
      deviceTypeList: [
        { deviceType: rainSensor.code, revision: rainSensor.revision },
        { deviceType: powerSource.code, revision: powerSource.revision },
      ],
    });
    device.createDefaultPowerSourceRechargeableBatteryClusterServer();
    expect(device.hasClusterServer(PowerSource.Cluster.id)).toBe(true);
    device.createDefaultIdentifyClusterServer();
    device.createDefaultBooleanStateClusterServer();
    device.createDefaultBooleanStateConfigurationClusterServer();
    expect(device.hasAttributeServer(BooleanState.Cluster.id, 'stateValue')).toBe(true);
    expect(device.hasAttributeServer(BooleanStateConfiguration.Cluster.id, 'currentSensitivityLevel')).toBe(true);

    await add(device);

    expect(device.getAttribute(BooleanState.Cluster.id, 'stateValue')).toBe(true);
    expect(device.getAttribute(BooleanStateConfiguration.Cluster.id, 'currentSensitivityLevel')).toBe(0);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('power source wired', async () => {
    const device = new MatterbridgeEndpoint([powerSource], { id: 'PowerSourceWired' });
    expect(device).toBeDefined();
    device.createDefaultPowerSourceWiredClusterServer();
    expect(device.hasClusterServer(PowerSource.Cluster.id)).toBe(true);

    await add(device);

    expect(device.getAttribute(PowerSource.Cluster.id, 'description')).toBe('AC Power');
    expect(device.getAttribute(PowerSource.Cluster.id, 'status')).toBe(PowerSource.PowerSourceStatus.Active);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('power source replaceable', async () => {
    const device = new MatterbridgeEndpoint([powerSource], { id: 'PowerSourceReplaceable' });
    expect(device).toBeDefined();
    device.createDefaultPowerSourceReplaceableBatteryClusterServer();
    expect(device.hasClusterServer(PowerSource.Cluster.id)).toBe(true);

    await add(device);

    expect(device.getAttribute(PowerSource.Cluster.id, 'batChargeLevel')).toBe(PowerSource.BatChargeLevel.Ok);
    expect(device.getAttribute(PowerSource.Cluster.id, 'batReplaceability')).toBe(PowerSource.BatReplaceability.UserReplaceable);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('power source rechargeable', async () => {
    const device = new MatterbridgeEndpoint([powerSource], { id: 'PowerSourceRechargeable' });
    expect(device).toBeDefined();
    device.createDefaultPowerSourceRechargeableBatteryClusterServer();
    expect(device.hasClusterServer(PowerSource.Cluster.id)).toBe(true);

    await add(device);

    expect(device.getAttribute(PowerSource.Cluster.id, 'batChargeLevel')).toBe(PowerSource.BatChargeLevel.Ok);
    expect(device.getAttribute(PowerSource.Cluster.id, 'batChargeState')).toBe(PowerSource.BatChargeState.IsNotCharging);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('energy measurements for electricalSensor', async () => {
    const device = new MatterbridgeEndpoint([electricalSensor], { uniqueStorageKey: 'ElectricalSensor' });
    expect(device).toBeDefined();
    device.createDefaultPowerTopologyClusterServer();
    device.createDefaultElectricalEnergyMeasurementClusterServer();
    device.createDefaultElectricalPowerMeasurementClusterServer();
    expect(device.hasClusterServer(PowerTopology.Cluster.id)).toBe(true);
    expect(device.hasAttributeServer(ElectricalEnergyMeasurement.Cluster.id, 'cumulativeEnergyReset')).toBe(true);
    expect(device.hasAttributeServer(ElectricalEnergyMeasurement.Cluster.id, 'cumulativeEnergyImported')).toBe(true);
    expect(device.hasAttributeServer(ElectricalEnergyMeasurement.Cluster.id, 'cumulativeEnergyExported')).toBe(true);
    expect(device.hasAttributeServer(ElectricalPowerMeasurement.Cluster.id, 'voltage')).toBe(true);
    expect(device.hasAttributeServer(ElectricalPowerMeasurement.Cluster.id, 'activeCurrent')).toBe(true);
    expect(device.hasAttributeServer(ElectricalPowerMeasurement.Cluster.id, 'activePower')).toBe(true);
    expect(device.hasAttributeServer(ElectricalPowerMeasurement.Cluster.id, 'frequency')).toBe(true);

    await add(device);

    expect(device.getAttribute(ElectricalEnergyMeasurement.Cluster.id, 'cumulativeEnergyImported')).toBe(null);
    expect(device.getAttribute(ElectricalPowerMeasurement.Cluster.id, 'voltage')).toBe(null);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('energy measurements for electricalSensor apparent', async () => {
    const device = new MatterbridgeEndpoint([electricalSensor], { uniqueStorageKey: 'ApparentElectricalSensor' });
    expect(device).toBeDefined();
    device.createDefaultPowerTopologyClusterServer();
    device.createDefaultElectricalEnergyMeasurementClusterServer();
    device.createApparentElectricalPowerMeasurementClusterServer();
    expect(device.hasClusterServer(PowerTopology.Cluster.id)).toBe(true);
    expect(device.hasAttributeServer(ElectricalEnergyMeasurement.Cluster.id, 'cumulativeEnergyReset')).toBe(true);
    expect(device.hasAttributeServer(ElectricalEnergyMeasurement.Cluster.id, 'cumulativeEnergyImported')).toBe(true);
    expect(device.hasAttributeServer(ElectricalEnergyMeasurement.Cluster.id, 'cumulativeEnergyExported')).toBe(true);
    expect(device.hasAttributeServer(ElectricalPowerMeasurement.Cluster.id, 'voltage')).toBe(true);
    expect(device.hasAttributeServer(ElectricalPowerMeasurement.Cluster.id, 'apparentCurrent')).toBe(true);
    expect(device.hasAttributeServer(ElectricalPowerMeasurement.Cluster.id, 'apparentPower')).toBe(true);
    expect(device.hasAttributeServer(ElectricalPowerMeasurement.Cluster.id, 'frequency')).toBe(true);

    await add(device);

    expect(device.getAttribute(ElectricalEnergyMeasurement.Cluster.id, 'cumulativeEnergyImported')).toBe(null);
    expect(device.getAttribute(ElectricalPowerMeasurement.Cluster.id, 'voltage')).toBe(null);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultTemperatureMeasurementClusterServer', async () => {
    const device = new MatterbridgeEndpoint(temperatureSensor, { uniqueStorageKey: 'TemperatureSensor' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultTemperatureMeasurementClusterServer(21 * 100);
    expect(device.hasClusterServer(TemperatureMeasurement.Cluster.id)).toBe(true);
    expect(device.hasAttributeServer(TemperatureMeasurement.Cluster.id, 'measuredValue')).toBe(true);

    await add(device);

    expect(device.getAttribute(TemperatureMeasurement.Cluster.id, 'measuredValue')).toBe(2100);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultRelativeHumidityMeasurementClusterServer', async () => {
    const device = new MatterbridgeEndpoint(humiditySensor, { uniqueStorageKey: 'HumiditySensor' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultRelativeHumidityMeasurementClusterServer(50 * 100);
    expect(device.hasClusterServer(RelativeHumidityMeasurement.Cluster.id)).toBe(true);
    expect(device.hasAttributeServer(RelativeHumidityMeasurement.Cluster.id, 'measuredValue')).toBe(true);

    await add(device);

    expect(device.getAttribute(RelativeHumidityMeasurement.Cluster.id, 'measuredValue')).toBe(5000);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultPressureMeasurementClusterServer', async () => {
    const device = new MatterbridgeEndpoint(pressureSensor, { uniqueStorageKey: 'PressureSensor' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultPressureMeasurementClusterServer(980);
    expect(device.hasClusterServer(PressureMeasurement.Cluster.id)).toBe(true);
    expect(device.hasAttributeServer(PressureMeasurement.Cluster.id, 'measuredValue')).toBe(true);

    await add(device);

    expect(device.getAttribute(PressureMeasurement.Cluster.id, 'measuredValue')).toBe(980);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultIlluminanceMeasurementClusterServer', async () => {
    const device = new MatterbridgeEndpoint(lightSensor, { uniqueStorageKey: 'LightSensor' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultIlluminanceMeasurementClusterServer(1000);
    expect(device.hasClusterServer(IlluminanceMeasurement.Cluster.id)).toBe(true);
    expect(device.hasAttributeServer(IlluminanceMeasurement.Cluster.id, 'measuredValue')).toBe(true);

    await add(device);

    expect(device.getAttribute(IlluminanceMeasurement.Cluster.id, 'measuredValue')).toBe(1000);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultFlowMeasurementClusterServer', async () => {
    const device = new MatterbridgeEndpoint(flowSensor, { uniqueStorageKey: 'FlowSensor' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultFlowMeasurementClusterServer(20 * 10);
    expect(device.hasClusterServer(FlowMeasurement.Cluster.id)).toBe(true);
    expect(device.hasAttributeServer(FlowMeasurement.Cluster.id, 'measuredValue')).toBe(true);

    await add(device);

    expect(device.getAttribute(FlowMeasurement.Cluster.id, 'measuredValue')).toBe(200);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultOccupancySensingClusterServer', async () => {
    const device = new MatterbridgeEndpoint(occupancySensor, { uniqueStorageKey: 'OccupancySensor' });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultOccupancySensingClusterServer(true);
    expect(device.hasClusterServer(OccupancySensingServer)).toBe(true);
    expect(device.hasAttributeServer(OccupancySensingServer, 'occupancy')).toBe(true);

    await add(device);

    expect(device.getAttribute(OccupancySensing.Cluster.id, 'occupancy')).toEqual({ occupied: true });
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('createDefaultAirQualityClusterServer', async () => {
    const device = new MatterbridgeEndpoint(airQualitySensor, { uniqueStorageKey: 'AirQualitySensor' });
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

    expect(device.getAttribute(AirQuality.Cluster.id, 'airQuality')).toBe(AirQuality.AirQualityEnum.Unknown);
    (matterbridge.frontend as any).getClusterTextFromDevice(device);
  });

  test('ensure all endpoint number persistence is flushed before closing', async () => {
    expect(matterbridge.serverNode).toBeDefined();
    expect(matterbridge.serverNode?.lifecycle.isReady).toBeTruthy();
    expect(matterbridge.serverNode?.lifecycle.isOnline).toBeTruthy();
    if (matterbridge.serverNode) {
      // Ensure all endpoint number persistence is flushed before closing
      await flushAllEndpointNumberPersistence(matterbridge.serverNode);
      await assertAllEndpointNumbersPersisted(matterbridge.serverNode);
    }
  });

  test('destroy instance', async () => {
    expect(matterbridge).toBeDefined();
    // Close the Matterbridge instance
    await matterbridge.destroyInstance(10, 250);
  });
});
