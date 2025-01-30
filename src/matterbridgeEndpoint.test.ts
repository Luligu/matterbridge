/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { jest } from '@jest/globals';
import { AnsiLogger, db, er, hk, LogLevel, or } from 'node-ansi-logger';

import { Matterbridge } from './matterbridge.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import {
  airQualitySensor,
  bridgedNode,
  colorTemperatureLight,
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
  onOffOutlet,
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

// @matter
import { Lifecycle, EndpointNumber } from '@matter/main';
import {
  AirQuality,
  BasicInformation,
  BooleanState,
  BooleanStateConfiguration,
  BridgedDeviceBasicInformation,
  ColorControl,
  Descriptor,
  DoorLock,
  ElectricalEnergyMeasurement,
  ElectricalPowerMeasurement,
  FanControl,
  FixedLabel,
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
  ScenesManagement,
  SmokeCoAlarm,
  Switch,
  TemperatureMeasurement,
  Thermostat,
  UserLabel,
  ValveConfigurationAndControl,
  WindowCovering,
} from '@matter/main/clusters';
import {
  AirQualityServer,
  CarbonDioxideConcentrationMeasurementServer,
  CarbonMonoxideConcentrationMeasurementServer,
  ColorControlBehavior,
  ColorControlServer,
  DescriptorBehavior,
  DescriptorServer,
  EnergyPreferenceServer,
  FormaldehydeConcentrationMeasurementServer,
  GroupsBehavior,
  GroupsServer,
  IdentifyBehavior,
  IdentifyServer,
  LevelControlBehavior,
  NitrogenDioxideConcentrationMeasurementServer,
  OccupancySensingServer,
  OnOffBehavior,
  OnOffServer,
  OzoneConcentrationMeasurementServer,
  Pm10ConcentrationMeasurementServer,
  Pm1ConcentrationMeasurementServer,
  Pm25ConcentrationMeasurementServer,
  RadonConcentrationMeasurementServer,
  TemperatureMeasurementServer,
  ThermostatBehavior,
  ThermostatServer,
  ThermostatUserInterfaceConfigurationServer,
  TimeSynchronizationServer,
  TotalVolatileOrganicCompoundsConcentrationMeasurementServer,
} from '@matter/main/behaviors';
import { getAttributeId, getClusterId, updateAttribute } from './matterbridgeEndpointHelpers.js';

describe('MatterbridgeEndpoint class', () => {
  let matterbridge: Matterbridge;
  let device: MatterbridgeEndpoint;

  /**
   * Waits for the `isOnline` property to become `true`.
   * @param {number} timeout - The maximum time to wait in milliseconds.
   * @returns {Promise<void>} A promise that resolves when `isOnline` becomes `true` or rejects if the timeout is reached.
   */
  async function waitForOnline(timeout = 10000): Promise<void> {
    const start = Date.now();

    return new Promise((resolve, reject) => {
      const checkOnline = () => {
        if (matterbridge.serverNode?.lifecycle.isOnline) {
          resolve();
        } else if (Date.now() - start >= timeout) {
          reject(new Error('Timeout waiting for matterbridge.serverNode.lifecycle.isOnline to become true'));
        } else {
          setTimeout(checkOnline, 100); // Check every 100ms
        }
      };

      checkOnline();
    });
  }

  /**
   * Waits for the Matterbridge cleanup to finish.
   * @param {number} timeout - The maximum time to wait in milliseconds.
   * @returns {Promise<void>} A promise that resolves when cleanup finishes or rejects if the timeout is reached.
   */
  async function waitForOffline(timeout = 10000): Promise<void> {
    const start = Date.now();

    return new Promise((resolve, reject) => {
      const checkOnline = () => {
        if ((matterbridge as any).initialized === false) {
          resolve();
        } else if (Date.now() - start >= timeout) {
          reject(new Error('Timeout waiting for matterbridge.serverNode.lifecycle.isOnline to become false'));
        } else {
          setTimeout(checkOnline, 100); // Check every 100ms
        }
      };

      checkOnline();
    });
  }

  /*
  // Spy on and mock AnsiLogger.log
  const loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {
    //
  });
  // Spy on and mock console.log
  const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {
    //
  });
  // Spy on and mock console.log
  const consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation((...args: any[]) => {
    //
  });
  // Spy on and mock console.log
  const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation((...args: any[]) => {
    //
  });
  // Spy on and mock console.log
  const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation((...args: any[]) => {
    //
  });
  // Spy on and mock console.log
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args: any[]) => {
    //
  });
  */

  // Spy on AnsiLogger.log
  const loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log');
  // Spy on console.log
  const consoleLogSpy = jest.spyOn(console, 'log');
  // Spy on console.debug
  const consoleDebugSpy = jest.spyOn(console, 'debug');
  // Spy on console.info
  const consoleInfoSpy = jest.spyOn(console, 'info');
  // Spy on console.warn
  const consoleWarnSpy = jest.spyOn(console, 'warn');
  // Spy on console.error
  const consoleErrorSpy = jest.spyOn(console, 'error');

  beforeAll(async () => {
    // Create a MatterbridgeEdge instance
    process.argv = ['node', 'matterbridge.js', '-mdnsInterface', 'Wi-Fi', '-profile', 'Jest', '-bridge', '-logger', 'info', '-matterlogger', 'info'];
    matterbridge = await Matterbridge.loadInstance(true);
    await matterbridge.matterStorageManager?.createContext('events')?.clearAll();
    await matterbridge.matterStorageManager?.createContext('fabrics')?.clearAll();
    await matterbridge.matterStorageManager?.createContext('root')?.clearAll();
    await matterbridge.matterStorageManager?.createContext('sessions')?.clearAll();
    await matterbridge.matterbridgeContext?.clearAll();

    await waitForOnline();
  });

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    //
  });

  afterAll(async () => {
    // Close the Matterbridge instance
    // await matterbridge.destroyInstance();
    // await waitForOffline();
    await (matterbridge as any).cleanup('destroying instance...', false);

    // Restore all mocks
    jest.restoreAllMocks();
  }, 30000);

  describe('MatterbridgeDefault', () => {
    test('constructor', async () => {
      const deviceType = onOffLight;
      const device = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: 'OnOffLight1' });
      expect(device).toBeDefined();
      expect(device.id).toBe('OnOffLight1');
      expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
      expect(device.type.deviceType).toBe(deviceType.code);
      expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
      expect(device.type.deviceRevision).toBe(deviceType.revision);
      expect(device.hasAttributeServer('Descriptor', 'DeviceTypeList')).toBe(true);
      expect(device.hasAttributeServer('descriptor', 'tagList')).toBe(false);
      expect(device.behaviors.optionsFor(DescriptorBehavior)).toEqual({ deviceTypeList: [{ deviceType: 256, revision: 3 }] });

      device.addRequiredClusterServers();
      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
    });

    test('constructor with tagList', async () => {
      const deviceType = onOffLight;
      const device = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: 'OnOffLight2', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light2' }] });
      expect(device).toBeDefined();
      expect(device.id).toBe('OnOffLight2');
      expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
      expect(device.type.deviceType).toBe(deviceType.code);
      expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
      expect(device.type.deviceRevision).toBe(deviceType.revision);
      expect(device.hasAttributeServer('Descriptor', 'deviceTypeList')).toBe(true);
      expect(device.hasAttributeServer('descriptor', 'TagList')).toBe(true);
      expect(device.behaviors.optionsFor(DescriptorBehavior)).toEqual({ tagList: [{ mfgCode: null, namespaceId: 7, tag: 1, label: 'Light2' }], deviceTypeList: [{ deviceType: 256, revision: 3 }] });

      device.addRequiredClusterServers();
      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
    });

    test('loadInstance', async () => {
      const deviceType = onOffLight;
      const device = await MatterbridgeEndpoint.loadInstance(deviceType, { uniqueStorageKey: 'OnOffLight3' });
      expect(device).toBeDefined();
      expect(device.id).toBe('OnOffLight3');
      expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
      expect(device.type.deviceType).toBe(deviceType.code);
      expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
      expect(device.type.deviceRevision).toBe(deviceType.revision);
      expect(device.hasAttributeServer('Descriptor', 'DeviceTypeList')).toBe(true);
      expect(device.hasAttributeServer('descriptor', 'tagList')).toBe(false);
      expect(device.behaviors.optionsFor(DescriptorBehavior)).toEqual({ deviceTypeList: [{ deviceType: 256, revision: 3 }] });

      expect(device.getDeviceTypes()).toEqual([deviceType]);

      device.addRequiredClusterServers();
      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
    });

    test('serialize and deserialize', async () => {
      MatterbridgeEndpoint.bridgeMode = 'bridge';
      const device = new MatterbridgeEndpoint([onOffLight, bridgedNode, powerSource], { uniqueStorageKey: 'OnOffLight4', endpointId: EndpointNumber(100) });
      expect(device).toBeDefined();
      device
        .createDefaultIdentifyClusterServer()
        .createDefaultBridgedDeviceBasicInformationClusterServer('OnOffLight', '1234', 0xfff1, 'Matterbridge', 'Light')
        .createDefaultGroupsClusterServer()
        .createDefaultOnOffClusterServer()
        .createDefaultPowerSourceWiredClusterServer();
      const serializedDevice = MatterbridgeEndpoint.serialize(device);
      let deserializedDevice: MatterbridgeEndpoint | undefined;
      if (serializedDevice) {
        // deserializedDevice = MatterbridgeEndpoint.deserialize(serializedDevice);
      }
      // expect(deserializedDevice).toBeDefined();

      device.addRequiredClusterServers();
      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
    });

    test('hasClusterServer', async () => {
      const deviceType = onOffLight;
      const device = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: 'OnOffLight5', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      expect(device).toBeDefined();
      device.createDefaultIdentifyClusterServer();
      device.createDefaultGroupsClusterServer();
      device.createDefaultOnOffClusterServer();
      expect(device.hasClusterServer(DescriptorBehavior)).toBe(true);
      expect(device.hasClusterServer(DescriptorServer)).toBe(true);
      expect(device.hasClusterServer(Descriptor.Cluster)).toBe(true);
      expect(device.hasClusterServer(Descriptor.Cluster.id)).toBe(true);
      expect(device.hasClusterServer('Descriptor')).toBe(true);
      expect(device.hasClusterServer('descriptor')).toBe(true);
      expect(getClusterId(device, 'Descriptor')).toBe(0x1d);

      expect(device.hasClusterServer(IdentifyBehavior)).toBe(true);
      expect(device.hasClusterServer(IdentifyServer)).toBe(true);
      expect(device.hasClusterServer(Identify.Cluster)).toBe(true);
      expect(device.hasClusterServer(Identify.Cluster.id)).toBe(true);
      expect(device.hasClusterServer('Identify')).toBe(true);
      expect(device.hasClusterServer('identify')).toBe(true);
      expect(getClusterId(device, 'identify')).toBe(0x03);

      expect(device.hasClusterServer(GroupsBehavior)).toBe(true);
      expect(device.hasClusterServer(GroupsServer)).toBe(true);
      expect(device.hasClusterServer(Groups.Cluster)).toBe(true);
      expect(device.hasClusterServer(Groups.Cluster.id)).toBe(true);
      expect(device.hasClusterServer('Groups')).toBe(true);
      expect(device.hasClusterServer('groups')).toBe(true);
      expect(getClusterId(device, 'identify')).toBe(0x03);

      expect(device.hasClusterServer(IdentifyBehavior)).toBe(true);
      expect(device.hasClusterServer(IdentifyServer)).toBe(true);
      expect(device.hasClusterServer(ScenesManagement.Cluster)).toBe(false);
      expect(device.hasClusterServer(ScenesManagement.Cluster.id)).toBe(false);
      expect(device.hasClusterServer('ScenesManagement')).toBe(false);
      expect(device.hasClusterServer('scenesManagement')).toBe(false);

      expect(device.hasClusterServer(OnOffBehavior)).toBe(true);
      expect(device.hasClusterServer(OnOffServer)).toBe(true);
      expect(device.hasClusterServer(OnOff.Cluster)).toBe(true);
      expect(device.hasClusterServer(OnOff.Cluster.with(OnOff.Feature.Lighting))).toBe(true);
      expect(device.hasClusterServer(OnOff.Cluster.with(OnOff.Feature.OffOnly))).toBe(true);
      expect(device.hasClusterServer(OnOff.Cluster.with(OnOff.Feature.DeadFrontBehavior))).toBe(true);
      expect(device.hasClusterServer(OnOff.Cluster.id)).toBe(true);
      expect(device.hasClusterServer('OnOff')).toBe(true);
      expect(device.hasClusterServer('onOff')).toBe(true);
      expect(getClusterId(device, 'onOff')).toBe(0x06);
      expect(getAttributeId(device, 'onOff', 'onOff')).toBe(0x00);
      expect(getAttributeId(device, 'onOff', 'startUpOnOff')).toBe(0x4003);

      expect(device.hasClusterServer(ThermostatBehavior)).toBe(false);
      expect(device.hasClusterServer(ThermostatServer)).toBe(false);
      expect(device.hasClusterServer(Thermostat.Cluster.with(Thermostat.Feature.AutoMode, Thermostat.Feature.Heating, Thermostat.Feature.Cooling))).toBe(false);
      expect(device.hasClusterServer(Thermostat.Cluster.id)).toBe(false);
      expect(device.hasClusterServer('Thermostat')).toBe(false);
      expect(device.hasClusterServer('thermostat')).toBe(false);

      device.addRequiredClusterServers();
      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
    });

    test('hasAttributeServer', async () => {
      const deviceType = onOffLight;
      const device = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: 'OnOffLight6', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      expect(device).toBeDefined();
      device.createDefaultIdentifyClusterServer();
      device.createDefaultGroupsClusterServer();
      device.createDefaultOnOffClusterServer();
      expect(device.hasAttributeServer(DescriptorBehavior, 'deviceTypeList')).toBe(true);
      expect(device.hasAttributeServer(DescriptorServer, 'deviceTypeList')).toBe(true);
      expect(device.hasAttributeServer(Descriptor.Cluster, 'deviceTypeList')).toBe(true);
      expect(device.hasAttributeServer(Descriptor.Cluster.id, 'tagList')).toBe(true);
      expect(device.hasAttributeServer('Descriptor', 'features')).toBe(false);
      expect(device.hasAttributeServer(Descriptor.Cluster.id, 'identifyTime')).toBe(false);

      expect(device.hasAttributeServer(IdentifyBehavior, 'identifyTime')).toBe(true);
      expect(device.hasAttributeServer(IdentifyServer, 'identifyTime')).toBe(true);
      expect(device.hasAttributeServer(Identify.Cluster, 'identifyTime')).toBe(true);
      expect(device.hasAttributeServer(Identify.Cluster.id, 'identifyTime')).toBe(true);
      expect(device.hasAttributeServer('Identify', 'identifyTime')).toBe(true);
      expect(device.hasAttributeServer('Identify', 'identifyType')).toBe(true);
      expect(device.hasAttributeServer('identify', 'identifyTime')).toBe(true);
      expect(device.hasAttributeServer('identify', 'identifyType')).toBe(true);
      expect(device.hasAttributeServer('Identify', 'none')).toBe(false);

      expect(device.hasAttributeServer(OnOffBehavior, 'onOff')).toBe(true);
      expect(device.hasAttributeServer(OnOffServer, 'onOff')).toBe(true);
      expect(device.hasAttributeServer(OnOff.Cluster, 'onOff')).toBe(true);
      expect(device.hasAttributeServer(OnOff.Cluster.id, 'onOff')).toBe(true);
      expect(device.hasAttributeServer('OnOff', 'onOff')).toBe(true);
      expect(device.hasAttributeServer('onOff', 'onOff')).toBe(true);
      expect(device.hasAttributeServer('onOff', 'none')).toBe(false);

      device.addRequiredClusterServers();
      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
    });

    test('getClusterServerOptions', async () => {
      const device = new MatterbridgeEndpoint(colorTemperatureLight, { uniqueStorageKey: 'ColorLight1', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'ColorLight' }] });
      expect(device).toBeDefined();
      device.createDefaultIdentifyClusterServer();
      device.createDefaultGroupsClusterServer();
      device.createDefaultOnOffClusterServer();
      device.createDefaultLevelControlClusterServer();
      device.createDefaultColorControlClusterServer();
      expect(device.hasAttributeServer(DescriptorBehavior, 'deviceTypeList')).toBe(true);
      expect(device.hasAttributeServer(IdentifyBehavior, 'identifyTime')).toBe(true);
      expect(device.hasAttributeServer(OnOffBehavior, 'onOff')).toBe(true);
      expect(device.hasAttributeServer(LevelControlBehavior, 'currentLevel')).toBe(true);
      expect(device.hasAttributeServer(ColorControlBehavior, 'colorMode')).toBe(true);
      const options = device.getClusterServerOptions(ColorControlBehavior);
      expect(options).toBeDefined();
      // console.log('getClusterServerOptions(ColorControlBehavior)', options);
      expect(options).toEqual({
        colorMode: 0,
        enhancedColorMode: 0,
        colorCapabilities: {
          xy: true,
          hueSaturation: true,
          colorLoop: false,
          enhancedHue: false,
          colorTemperature: true,
        },
        options: { executeIfOff: false },
        numberOfPrimaries: null,
        currentX: 0,
        currentY: 0,
        currentHue: 0,
        currentSaturation: 0,
        colorTemperatureMireds: 500,
        colorTempPhysicalMinMireds: 147,
        colorTempPhysicalMaxMireds: 500,
        coupleColorTempToLevelMinMireds: 147,
        remainingTime: 0,
        startUpColorTemperatureMireds: null,
      });

      device.addRequiredClusterServers();
      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
    });

    test('getClusterServerOptions CT', async () => {
      const device = new MatterbridgeEndpoint(colorTemperatureLight, { uniqueStorageKey: 'ColorLight2', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'ColorLight' }] });
      expect(device).toBeDefined();
      device.createDefaultIdentifyClusterServer();
      device.createDefaultGroupsClusterServer();
      device.createDefaultOnOffClusterServer();
      device.createDefaultLevelControlClusterServer();
      device.createCtColorControlClusterServer();
      expect(device.hasAttributeServer(DescriptorBehavior, 'deviceTypeList')).toBe(true);
      expect(device.hasAttributeServer(IdentifyBehavior, 'identifyTime')).toBe(true);
      expect(device.hasAttributeServer(OnOffBehavior, 'onOff')).toBe(true);
      expect(device.hasAttributeServer(LevelControlBehavior, 'currentLevel')).toBe(true);
      expect(device.hasAttributeServer(ColorControlBehavior, 'colorMode')).toBe(true);
      const options = device.getClusterServerOptions(ColorControlBehavior);
      expect(options).toBeDefined();
      // console.log('getClusterServerOptions(ColorControlBehavior) CT', options);
      expect(options).toEqual({
        colorMode: 2,
        enhancedColorMode: 2,
        colorCapabilities: {
          xy: false,
          hueSaturation: false,
          colorLoop: false,
          enhancedHue: false,
          colorTemperature: true,
        },
        options: { executeIfOff: false },
        numberOfPrimaries: null,
        colorTemperatureMireds: 500,
        colorTempPhysicalMinMireds: 147,
        colorTempPhysicalMaxMireds: 500,
        coupleColorTempToLevelMinMireds: 147,
        remainingTime: 0,
        startUpColorTemperatureMireds: null,
      });

      device.addRequiredClusterServers();
      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
    });

    test('addClusterServers', async () => {
      const device = new MatterbridgeEndpoint(onOffLight);
      expect(device).toBeDefined();
      expect(device.maybeId).toBe(undefined);
      expect(device.maybeNumber).toBe(undefined);
      device.addClusterServers([Identify.Cluster.id, Groups.Cluster.id, OnOff.Cluster.id]);
      expect(device.hasClusterServer(DescriptorServer)).toBe(true);
      expect(device.hasClusterServer(IdentifyServer)).toBe(true);
      expect(device.hasClusterServer(GroupsServer)).toBe(true);
      expect(device.hasClusterServer(ScenesManagement.Cluster)).toBe(false);
      expect(device.hasClusterServer(OnOffServer)).toBe(true);
      expect(device.getAllClusterServers()).toHaveLength(5);
      expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'identify', 'groups', 'onOff']);

      device.addRequiredClusterServers();
      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
    });

    test('addFixedLabel', async () => {
      const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'FixedLabel', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      expect(device).toBeDefined();
      device.addRequiredClusterServers();
      await device.addFixedLabel('Composed', 'Light');
      expect(device.hasAttributeServer(FixedLabel.Cluster, 'labelList')).toBe(true);
      expect(device.hasAttributeServer(UserLabel.Cluster, 'labelList')).toBe(false);
      const options = device.getClusterServerOptions(FixedLabel.Cluster);
      expect(options).toBeDefined();
      expect(options).toEqual({ 'labelList': [{ 'label': 'Composed', 'value': 'Light' }] });

      expect(device.getAttribute(FixedLabel.Cluster, 'labelList', device.log)).toBeUndefined();
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`getAttribute ${hk}fixedLabel.labelList${er} error: Endpoint`));

      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);

      await device.addFixedLabel('Composed2', 'Light');
      const labelList = device.getAttribute(FixedLabel.Cluster, 'labelList', device.log);
      expect(labelList).toEqual([
        { 'label': 'Composed', 'value': 'Light' },
        { 'label': 'Composed2', 'value': 'Light' },
      ]);
    });

    test('addUserLabel', async () => {
      const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'UserLabel', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      expect(device).toBeDefined();
      device.addRequiredClusterServers();
      await device.addUserLabel('Composed', 'Light');
      expect(device.hasAttributeServer(FixedLabel.Cluster, 'labelList')).toBe(false);
      expect(device.hasAttributeServer(UserLabel.Cluster, 'labelList')).toBe(true);
      const options = device.getClusterServerOptions(UserLabel.Cluster);
      expect(options).toBeDefined();
      expect(options).toEqual({ 'labelList': [{ 'label': 'Composed', 'value': 'Light' }] });

      expect(device.getAttribute(UserLabel.Cluster, 'labelList', device.log)).toBeUndefined();
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`getAttribute ${hk}userLabel.labelList${er} error: Endpoint`));

      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);

      await device.addUserLabel('Composed2', 'Light');
      const labelList = device.getAttribute(UserLabel.Cluster, 'labelList', device.log);
      expect(labelList).toEqual([
        { 'label': 'Composed', 'value': 'Light' },
        { 'label': 'Composed2', 'value': 'Light' },
      ]);
    });

    test('addCommandHandler', async () => {
      const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight7' });
      expect(device).toBeDefined();
      device.createDefaultOnOffClusterServer();
      expect(device.hasAttributeServer(OnOffBehavior, 'onOff')).toBe(true);
      expect(device.hasAttributeServer(LevelControlBehavior, 'currentLevel')).toBe(false);

      let called = false;

      device.addCommandHandler('on', async () => {
        called = true;
        console.log('OnOff.Cluster.on');
      });
      await device.executeCommandHandler('on');
      expect(called).toBe(true);

      called = false;
      device.addCommandHandler('off', async () => {
        called = true;
        console.log('OnOff.Cluster.off');
      });
      await device.executeCommandHandler('off');
      expect(called).toBe(true);

      called = false;
      device.addCommandHandler('toggle', async () => {
        called = true;
        console.log('OnOff.Cluster.toggle');
      });
      await device.executeCommandHandler('toggle');
      expect(called).toBe(true);

      device.addRequiredClusterServers();
      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
    });

    test('addRequiredClusterServers', async () => {
      const device = new MatterbridgeEndpoint(thermostatDevice, { uniqueStorageKey: 'Thermostat1' });
      expect(device).toBeDefined();
      device.addRequiredClusterServers();
      expect(device.hasClusterServer(DescriptorServer)).toBe(true);
      expect(device.hasClusterServer(IdentifyServer)).toBe(true);
      expect(device.hasClusterServer(GroupsServer)).toBe(false);
      expect(device.hasClusterServer(ScenesManagement.Cluster)).toBe(false);
      expect(device.hasClusterServer(ThermostatServer)).toBe(true);
      expect(device.hasClusterServer(ThermostatUserInterfaceConfigurationServer)).toBe(false);
      expect(device.hasClusterServer(EnergyPreferenceServer)).toBe(false);
      expect(device.hasClusterServer(TimeSynchronizationServer)).toBe(false);

      device.addRequiredClusterServers();
      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
    });

    test('addOptionalClusterServers', async () => {
      const device = new MatterbridgeEndpoint(thermostatDevice, { uniqueStorageKey: 'Thermostat2' });
      expect(device).toBeDefined();
      device.addRequiredClusterServers();
      device.addOptionalClusterServers();
      expect(device.hasClusterServer(DescriptorServer)).toBe(true);
      expect(device.hasClusterServer(IdentifyServer)).toBe(true);
      expect(device.hasClusterServer(GroupsServer)).toBe(true);
      expect(device.hasClusterServer(ScenesManagement.Cluster)).toBe(false);
      expect(device.hasClusterServer(ThermostatServer)).toBe(true);
      // expect(device.hasClusterServer(ThermostatUserInterfaceConfigurationServer)).toBe(true);
      // expect(device.hasClusterServer(EnergyPreferenceServer)).toBe(true);
      // expect(device.hasClusterServer(TimeSynchronizationServer)).toBe(true); /

      device.addRequiredClusterServers();
      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
    });

    test('forEachAttribute Thermostat', async () => {
      const device = new MatterbridgeEndpoint(thermostatDevice, { uniqueStorageKey: 'EachThermostat' });
      expect(device).toBeDefined();
      device.addRequiredClusterServers();
      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
      let count = 0;
      device.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
        count++;
      });
      expect(count).toBe(74);
    });

    test('forEachAttribute AirQuality', async () => {
      const device = new MatterbridgeEndpoint(airQualitySensor, { uniqueStorageKey: 'EachAirQuality' });
      expect(device).toBeDefined();
      device.addRequiredClusterServers();
      device.addOptionalClusterServers();
      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
      let count = 0;
      device.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
        count++;
      });
      expect(count).toBe(216);

      loggerLogSpy.mockClear();
      expect(await device.setAttribute(TemperatureMeasurementServer, 'measuredValue', 2500, device.log)).toBeTruthy();
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`${db}Set endpoint ${or}${device.id}${db}:${or}${device.number}${db} attribute ${hk}TemperatureMeasurement${db}.${hk}measuredValue${db}`));

      loggerLogSpy.mockClear();
      expect(await device.setAttribute(TemperatureMeasurement.Cluster, 'measuredValue', 2600, device.log)).toBeTruthy();
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`${db}Set endpoint ${or}${device.id}${db}:${or}${device.number}${db} attribute ${hk}TemperatureMeasurement${db}.${hk}measuredValue${db}`));

      loggerLogSpy.mockClear();
      expect(await device.setAttribute(TemperatureMeasurement.Cluster.id, 'measuredValue', 2700, device.log)).toBeTruthy();
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`${db}Set endpoint ${or}${device.id}${db}:${or}${device.number}${db} attribute ${hk}TemperatureMeasurement${db}.${hk}measuredValue${db}`));

      loggerLogSpy.mockClear();
      expect(await device.setAttribute('TemperatureMeasurement', 'measuredValue', 2800, device.log)).toBeTruthy();
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`${db}Set endpoint ${or}${device.id}${db}:${or}${device.number}${db} attribute ${hk}TemperatureMeasurement${db}.${hk}measuredValue${db}`));
    });

    test('create a OnOffOutletWithSensors device', async () => {
      device = new MatterbridgeEndpoint(onOffOutlet, { uniqueStorageKey: 'OnOffOutlet With Sensors' });
      expect(device).toBeDefined();
      device.addRequiredClusterServers();
    });

    test('add contact child to OnOffOutletWithSensors', async () => {
      const childEndpoint = device.addChildDeviceType('contactChild-1', contactSensor, { endpointId: EndpointNumber(35) });
      expect(childEndpoint).toBeDefined();
      childEndpoint.createDefaultIdentifyClusterServer();
      childEndpoint.createDefaultBooleanStateClusterServer(false);
      expect(device.getChildEndpointByName('contactChild-1')).toBeDefined();
      expect(device.getChildEndpoints().length).toBe(1);
    });

    test('add motion child to OnOffOutletWithSensors', async () => {
      const childEndpoint = device.addChildDeviceTypeWithClusterServer('occupancyChild-2', occupancySensor, [OccupancySensing.Cluster.id]);
      expect(childEndpoint).toBeDefined();
      childEndpoint.createDefaultOccupancySensingClusterServer(false);
      expect(device.getChildEndpointByName('occupancyChild-2')).toBeDefined();
      expect(device.getChildEndpoints().length).toBe(2);

      device.addChildDeviceTypeWithClusterServer('occupancyChild-2', occupancySensor, [OccupancySensing.Cluster.id]);
      expect(device.getChildEndpoints().length).toBe(2);
    });

    test('add illuminance child to OnOffOutletWithSensors', async () => {
      const deviceType = lightSensor;
      const childEndpoint = device.addChildDeviceTypeWithClusterServer('illuminanceChild-3', [lightSensor], [IlluminanceMeasurement.Cluster.id], { tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      expect(childEndpoint).toBeDefined();
      childEndpoint.createDefaultIlluminanceMeasurementClusterServer(200);
      expect(device.getChildEndpointByName('illuminanceChild-3')).toBeDefined();
      expect(device.getChildEndpoints().length).toBe(3);
    });

    test('add temperature child to OnOffOutletWithSensors', async () => {
      const childEndpoint = device.addChildDeviceTypeWithClusterServer('temperatureChild-4', temperatureSensor, [TemperatureMeasurement.Cluster.id]);
      expect(childEndpoint).toBeDefined();
      childEndpoint.createDefaultTemperatureMeasurementClusterServer(2500);
      expect(device.getChildEndpointByName('temperatureChild-4')).toBeDefined();
      expect(device.getChildEndpoints().length).toBe(4);
    });

    test('add humidity child to OnOffOutletWithSensors', async () => {
      const childEndpoint = device.addChildDeviceTypeWithClusterServer('humidityChild-5', [humiditySensor], [RelativeHumidityMeasurement.Cluster.id]);
      expect(childEndpoint).toBeDefined();
      childEndpoint.createDefaultRelativeHumidityMeasurementClusterServer(8000);
      expect(device.getChildEndpointByName('humidityChild-5')).toBeDefined();
      expect(device.getChildEndpoints().length).toBe(5);
    });

    test('add pressure child to OnOffOutletWithSensors', async () => {
      const childEndpoint = device.addChildDeviceTypeWithClusterServer('pressureChild-6', pressureSensor, [PressureMeasurement.Cluster.id]);
      expect(childEndpoint).toBeDefined();
      childEndpoint.createDefaultPressureMeasurementClusterServer(900);
      expect(device.getChildEndpointByName('pressureChild-6')).toBeDefined();
      expect(device.getChildEndpoints().length).toBe(6);
    });

    test('add flow child to OnOffOutletWithSensors', async () => {
      const childEndpoint = device.addChildDeviceTypeWithClusterServer('flowChild-7', [flowSensor], [FlowMeasurement.Cluster.id]);
      expect(childEndpoint).toBeDefined();
      childEndpoint.createDefaultFlowMeasurementClusterServer(900);
      expect(device.getChildEndpointByName('flowChild-7')).toBeDefined();
      expect(device.getChildEndpoints().length).toBe(7);
    });

    test('add multiple device types children to OnOffOutletWithSensors', async () => {
      const childEndpoint = device.addChildDeviceType('multiChild-8', [temperatureSensor, humiditySensor, pressureSensor]);
      expect(childEndpoint).toBeDefined();
      childEndpoint.addRequiredClusterServers();
      expect(device.getChildEndpointByName('multiChild-8')).toBeDefined();
      expect(device.getChildEndpoints().length).toBe(8);
    });

    test('add multiple device types children with required to OnOffOutletWithSensors', async () => {
      const childEndpoint = device.addChildDeviceTypeWithClusterServer('multiChild-9', [temperatureSensor, humiditySensor, pressureSensor]);
      expect(childEndpoint).toBeDefined();
      expect(device.getChildEndpointByName('multiChild-9')).toBeDefined();
      expect(device.getChildEndpoints().length).toBe(9);
    });

    test('add OnOffOutletWithSensors device to serverNode', async () => {
      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('\x1B[39mMatterbridge.Matterbridge.OnOffOutletWithSensors \x1B[0mready'));
    });

    test('getChildEndpoint of OnOffOutletWithSensors by number', async () => {
      expect(device.getChildEndpoint(EndpointNumber(35))).toBeDefined();
    });

    test('addChildDeviceType to OnOffOutletWithSensors with lifecycle installed', async () => {
      const childEndpoint = device.addChildDeviceType('contactChild-2', contactSensor, { endpointId: EndpointNumber(36) });
      childEndpoint.addRequiredClusterServers();
      await Promise.all([childEndpoint.lifecycle.ready, childEndpoint.construction.ready]); // We need to wait for the lifecycle to be ready since we cannot await the construction
      expect(device.getChildEndpointByName('contactChild-2')).toBeDefined();
      expect(device.getChildEndpoint(EndpointNumber(36))).toBeDefined();
    });

    test('addChildDeviceType to OnOffOutletWithSensors with lifecycle installed and taglist', async () => {
      const childEndpoint = device.addChildDeviceType('contactChild-2bis', contactSensor, { endpointId: EndpointNumber(46), tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      childEndpoint.addRequiredClusterServers();
      await Promise.all([childEndpoint.lifecycle.ready, childEndpoint.construction.ready]); // We need to wait for the lifecycle to be ready since we cannot await the construction
      expect(device.getChildEndpointByName('contactChild-2bis')).toBeDefined();
      expect(device.getChildEndpoint(EndpointNumber(46))).toBeDefined();
    });

    test('addChildDeviceType to OnOffOutletWithSensors with lifecycle installed and taglist and already added', async () => {
      const childEndpoint = device.addChildDeviceType('contactChild-2bis', contactSensor);
      expect(childEndpoint.number).toBe(46);
    });

    test('addChildDeviceTypeWithClusterServer to OnOffOutletWithSensors with lifecycle installed', async () => {
      const childEndpoint = device.addChildDeviceTypeWithClusterServer('contactChild-3', contactSensor, [BooleanState.Cluster.id], { endpointId: EndpointNumber(37) });
      await Promise.all([childEndpoint.lifecycle.ready, childEndpoint.construction.ready]); // We need to wait for the lifecycle to be ready since we cannot await the construction
      expect(device.getChildEndpointByName('contactChild-3')).toBeDefined();
      expect(device.getChildEndpoint(EndpointNumber(37))).toBeDefined();
    });

    test('addChildDeviceTypeWithClusterServer to OnOffOutletWithSensors with lifecycle installed and taglist', async () => {
      const childEndpoint = device.addChildDeviceTypeWithClusterServer('contactChild-3bis', contactSensor, [BooleanState.Cluster.id], { endpointId: EndpointNumber(47), tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      await Promise.all([childEndpoint.lifecycle.ready, childEndpoint.construction.ready]); // We need to wait for the lifecycle to be ready since we cannot await the construction
      expect(device.getChildEndpointByName('contactChild-3bis')).toBeDefined();
      expect(device.getChildEndpoint(EndpointNumber(47))).toBeDefined();
    });

    test('addChildDeviceTypeWithClusterServer to OnOffOutletWithSensors with lifecycle installed and taglist and already added', async () => {
      const childEndpoint = device.addChildDeviceTypeWithClusterServer('contactChild-3bis', contactSensor);
      expect(childEndpoint.number).toBe(47);
    });

    test('addChildDeviceTypeWithClusterServer to OnOffOutletWithSensors with lifecycle installed and taglist and already added 2', async () => {
      const childEndpoint = device.addChildDeviceTypeWithClusterServer('contactChild-3bis', contactSensor);
      expect(childEndpoint.number).toBe(47);
    });

    test('verify OnOffOutletWithSensors child endpoints', async () => {
      const getChildDescriptorAttribute = (name: string, attribute: string) => {
        const childEndpoint = device.getChildEndpointByName(name);
        expect(childEndpoint).toBeDefined();
        if (!childEndpoint) return;
        return childEndpoint.getAttribute(Descriptor.Cluster.id, attribute, device.log);
      };
      expect(getChildDescriptorAttribute('contactChild-1', 'deviceTypeList')).toEqual([{ deviceType: contactSensor.code, revision: contactSensor.revision }]);
      expect(getChildDescriptorAttribute('occupancyChild-2', 'deviceTypeList')).toEqual([{ deviceType: occupancySensor.code, revision: occupancySensor.revision }]);
      expect(getChildDescriptorAttribute('illuminanceChild-3', 'deviceTypeList')).toEqual([{ deviceType: lightSensor.code, revision: lightSensor.revision }]);
      expect(getChildDescriptorAttribute('temperatureChild-4', 'deviceTypeList')).toEqual([{ deviceType: temperatureSensor.code, revision: temperatureSensor.revision }]);
      expect(getChildDescriptorAttribute('humidityChild-5', 'deviceTypeList')).toEqual([{ deviceType: humiditySensor.code, revision: humiditySensor.revision }]);
      expect(getChildDescriptorAttribute('pressureChild-6', 'deviceTypeList')).toEqual([{ deviceType: pressureSensor.code, revision: pressureSensor.revision }]);
      expect(getChildDescriptorAttribute('flowChild-7', 'deviceTypeList')).toEqual([{ deviceType: flowSensor.code, revision: flowSensor.revision }]);
      expect(getChildDescriptorAttribute('multiChild-8', 'deviceTypeList')).toEqual([
        { deviceType: temperatureSensor.code, revision: temperatureSensor.revision },
        { deviceType: humiditySensor.code, revision: humiditySensor.revision },
        { deviceType: pressureSensor.code, revision: pressureSensor.revision },
      ]);
      expect(getChildDescriptorAttribute('multiChild-9', 'deviceTypeList')).toEqual([
        { deviceType: temperatureSensor.code, revision: temperatureSensor.revision },
        { deviceType: humiditySensor.code, revision: humiditySensor.revision },
        { deviceType: pressureSensor.code, revision: pressureSensor.revision },
      ]);
    });
  });
});
