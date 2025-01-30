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
      // expect(device.hasClusterServer(TimeSynchronizationServer)).toBe(true);

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

    // eslint-disable-next-line jest/no-commented-out-tests
    /*
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
    */

    test('createDefaultIdentifyClusterServer', async () => {
      const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight8', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      expect(device).toBeDefined();
      device.createDefaultIdentifyClusterServer();
      expect(device.hasAttributeServer(Identify.Cluster, 'identifyTime')).toBe(true);
      expect(device.hasAttributeServer(Identify.Cluster, 'identifyType')).toBe(true);

      device.addRequiredClusterServers();
      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
    });

    test('createDefaultBasicInformationClusterServer in bridge mode', async () => {
      MatterbridgeEndpoint.bridgeMode = 'bridge';
      const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight9', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      expect(device).toBeDefined();
      device.createDefaultBasicInformationClusterServer('OnOffLight', '1234', 0xfff1, 'Matterbridge', 0x8000, 'Light');
      expect(MatterbridgeEndpoint.bridgeMode).toBe('bridge');
      expect(device.hasClusterServer(BasicInformation.Cluster)).toBe(false);
      expect(device.hasClusterServer(BridgedDeviceBasicInformation.Cluster)).toBe(true);

      device.addRequiredClusterServers();
      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
    });

    test('createDefaultBasicInformationClusterServer in childbridge mode', async () => {
      MatterbridgeEndpoint.bridgeMode = 'childbridge';
      const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight10', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      expect(device).toBeDefined();
      device.createDefaultBasicInformationClusterServer('OnOffLight', '1234', 0xfff1, 'Matterbridge', 0x8000, 'Light');
      expect(MatterbridgeEndpoint.bridgeMode).toBe('childbridge');
      expect(device.hasClusterServer(BasicInformation.Cluster)).toBe(false);
      expect(device.hasClusterServer(BridgedDeviceBasicInformation.Cluster)).toBe(false);
      MatterbridgeEndpoint.bridgeMode = 'bridge';

      device.addRequiredClusterServers();
      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
    });

    test('createDefaultBridgedDeviceBasicInformationClusterServer', async () => {
      const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight11', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      expect(device).toBeDefined();
      device.createDefaultBridgedDeviceBasicInformationClusterServer('OnOffLight', '1234', 0xfff1, 'Matterbridge', 'Light');
      expect(device.hasClusterServer(BasicInformation.Cluster)).toBe(false);
      expect(device.hasClusterServer(BridgedDeviceBasicInformation.Cluster)).toBe(true);

      device.addRequiredClusterServers();
      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
    });

    test('createDefaultGroupsClusterServer', async () => {
      const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight12', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      expect(device).toBeDefined();
      device.createDefaultGroupsClusterServer();
      expect(device.hasClusterServer(Groups.Cluster)).toBe(true);

      device.addRequiredClusterServers();
      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
    });

    test('createDefaultScenesClusterServer', async () => {
      const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight13', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      expect(device).toBeDefined();
      device.createDefaultScenesClusterServer();
      expect(device.hasClusterServer(ScenesManagement.Cluster)).toBe(true);

      device.addRequiredClusterServers();
      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
    });

    test('createDefaultOnOffClusterServer', async () => {
      const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight14', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      expect(device).toBeDefined();
      device.createDefaultOnOffClusterServer();
      expect(device.hasAttributeServer(OnOff.Cluster, 'onOff')).toBe(true);
      expect(device.hasAttributeServer(OnOff.Cluster, 'startUpOnOff')).toBe(true);

      device.addRequiredClusterServers();
      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
    });

    test('createOnOffClusterServer', async () => {
      const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight15', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      expect(device).toBeDefined();
      device.createOnOffClusterServer();
      expect(device.hasAttributeServer(OnOff.Cluster, 'onOff')).toBe(true);
      expect(device.hasAttributeServer(OnOff.Cluster, 'startUpOnOff')).toBe(false);

      device.addRequiredClusterServers();
      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
    });

    test('createDeadFrontOnOffClusterServer', async () => {
      const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight16', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      expect(device).toBeDefined();
      device.createDeadFrontOnOffClusterServer();
      expect(device.hasAttributeServer(OnOff.Cluster, 'onOff')).toBe(true);
      expect(device.hasAttributeServer(OnOff.Cluster, 'startUpOnOff')).toBe(false);

      device.addRequiredClusterServers();
      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
    });

    test('createDefaultLevelControlClusterServer', async () => {
      const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight17', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      expect(device).toBeDefined();
      device.createDefaultLevelControlClusterServer();
      expect(device.hasAttributeServer(LevelControl.Cluster, 'currentLevel')).toBe(true);
      expect(device.hasAttributeServer(LevelControl.Cluster, 'startUpCurrentLevel')).toBe(true);

      device.addRequiredClusterServers();
      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
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
      expect(device.hasAttributeServer(ColorControl.Cluster, 'currentX')).toBe(true);
      expect(device.hasAttributeServer(ColorControl.Cluster, 'currentY')).toBe(true);
      expect(device.hasAttributeServer(ColorControl.Cluster, 'currentHue')).toBe(true);
      expect(device.hasAttributeServer(ColorControl.Cluster, 'currentSaturation')).toBe(true);
      expect(device.hasAttributeServer(ColorControl.Cluster, 'colorTemperatureMireds')).toBe(true);
      expect(device.hasAttributeServer(ColorControl.Cluster, 'startUpColorTemperatureMireds')).toBe(true);
      expect(device.behaviors.optionsFor(ColorControlBehavior)).toHaveProperty('currentX');
      expect((device.behaviors.optionsFor(ColorControlBehavior) as Record<string, boolean | number | bigint | string | object | null>).currentX).toBe(400);

      const options = device.getClusterServerOptions(ColorControl.Cluster);
      if (options) options.currentX = 500;

      await updateAttribute(device, 'ColorControl', 'colorTemperatureMireds', 310);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`updateAttribute ${hk}colorControl.colorTemperatureMireds${er} error: Endpoint`));

      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('\x1B[39mMatterbridge.Matterbridge.DefaultLight \x1B[0mready'));

      loggerLogSpy.mockClear();
      await device.configureColorControlMode(ColorControl.ColorMode.ColorTemperatureMireds);
      await device.setAttribute(ColorControl.Cluster.id, 'colorTemperatureMireds', 360, device.log);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`${db}Set endpoint ${or}${device.id}${db}:${or}${device.number}${db} attribute ${hk}ColorControl${db}.${hk}colorTemperatureMireds${db}`));
      expect(device.getAttribute(ColorControl.Cluster.id, 'colorTemperatureMireds')).toBe(360);

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
      await device.configureColorControlMode(ColorControl.ColorMode.CurrentXAndCurrentY);

      expect(device.hasAttributeServer(ColorControl.Cluster, 'colorMode')).toBe(true);
      expect(device.hasAttributeServer(ColorControl.Cluster, 'currentX')).toBe(true);
      expect(device.hasAttributeServer(ColorControl.Cluster, 'currentY')).toBe(true);
      expect(device.hasAttributeServer(ColorControl.Cluster, 'currentHue')).toBe(true);
      expect(device.hasAttributeServer(ColorControl.Cluster, 'currentSaturation')).toBe(true);
      expect(device.hasAttributeServer(ColorControl.Cluster, 'colorTemperatureMireds')).toBe(true);
      expect(device.hasAttributeServer(ColorControl.Cluster, 'startUpColorTemperatureMireds')).toBe(true);
      expect(device.getAttribute(ColorControl.Cluster.id, 'currentX')).toBe(500);
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

      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('\x1B[39mMatterbridge.Matterbridge.XYLight \x1B[0mready'));
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

      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('\x1B[39mMatterbridge.Matterbridge.HSLight \x1B[0mready'));
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

      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('\x1B[39mMatterbridge.Matterbridge.CTLight \x1B[0mready'));
    });

    test('createDefaultWindowCoveringClusterServer', async () => {
      const device = new MatterbridgeEndpoint(coverDevice, { uniqueStorageKey: 'Screen' });
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

      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('\x1B[39mMatterbridge.Matterbridge.Screen \x1B[0mready'));

      await device.setWindowCoveringTargetAsCurrentAndStopped();
      expect(device.getAttribute(WindowCovering.Cluster.id, 'targetPositionLiftPercent100ths')).toBe(device.getAttribute(WindowCovering.Cluster.id, 'currentPositionLiftPercent100ths'));
      expect(device.getWindowCoveringStatus()).toBe(WindowCovering.MovementStatus.Stopped);
      await device.setWindowCoveringCurrentTargetStatus(50, 50, WindowCovering.MovementStatus.Closing);
      expect(device.getWindowCoveringStatus()).toBe(WindowCovering.MovementStatus.Closing);
      await device.setWindowCoveringStatus(WindowCovering.MovementStatus.Opening);
      expect(device.getWindowCoveringStatus()).toBe(WindowCovering.MovementStatus.Opening);
      await device.setWindowCoveringTargetAndCurrentPosition(50);
      expect(device.getAttribute(WindowCovering.Cluster.id, 'targetPositionLiftPercent100ths')).toBe(50);
      expect(device.getAttribute(WindowCovering.Cluster.id, 'currentPositionLiftPercent100ths')).toBe(50);
    });

    test('createDefaultThermostatClusterServer', async () => {
      const device = new MatterbridgeEndpoint(thermostatDevice, { uniqueStorageKey: 'ThermoAuto' });
      expect(device).toBeDefined();
      device.createDefaultIdentifyClusterServer();
      device.createDefaultThermostatClusterServer();
      expect(device.hasAttributeServer(Thermostat.Cluster.id, 'localTemperature')).toBe(true);
      expect(device.hasAttributeServer(Thermostat.Cluster.id, 'systemMode')).toBe(true);
      expect(device.hasAttributeServer(Thermostat.Cluster.id, 'occupiedHeatingSetpoint')).toBe(true);
      expect(device.hasAttributeServer(Thermostat.Cluster.id, 'occupiedCoolingSetpoint')).toBe(true);

      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('\x1B[39mMatterbridge.Matterbridge.ThermoAuto \x1B[0mready'));
      expect(device.getAttribute(Thermostat.Cluster.id, 'systemMode')).toBe(Thermostat.SystemMode.Auto);
    });

    test('createDefaultHeatingThermostatClusterServer', async () => {
      const device = new MatterbridgeEndpoint(thermostatDevice, { uniqueStorageKey: 'ThermoHeat' });
      expect(device).toBeDefined();
      device.createDefaultIdentifyClusterServer();
      device.createDefaultHeatingThermostatClusterServer();
      expect(device.hasAttributeServer(Thermostat.Cluster.id, 'localTemperature')).toBe(true);
      expect(device.hasAttributeServer(Thermostat.Cluster.id, 'systemMode')).toBe(true);
      expect(device.hasAttributeServer(Thermostat.Cluster.id, 'occupiedHeatingSetpoint')).toBe(true);
      expect(device.hasAttributeServer(Thermostat.Cluster.id, 'occupiedCoolingSetpoint')).toBe(false);

      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('\x1B[39mMatterbridge.Matterbridge.ThermoHeat \x1B[0mready'));
      expect(device.getAttribute(Thermostat.Cluster.id, 'systemMode')).toBe(Thermostat.SystemMode.Heat);
    });

    test('createDefaultCoolingThermostatClusterServer', async () => {
      const device = new MatterbridgeEndpoint(thermostatDevice, { uniqueStorageKey: 'ThermoCool' });
      expect(device).toBeDefined();
      device.createDefaultIdentifyClusterServer();
      device.createDefaultCoolingThermostatClusterServer();
      expect(device.hasAttributeServer(Thermostat.Cluster.id, 'localTemperature')).toBe(true);
      expect(device.hasAttributeServer(Thermostat.Cluster.id, 'systemMode')).toBe(true);
      expect(device.hasAttributeServer(Thermostat.Cluster.id, 'occupiedHeatingSetpoint')).toBe(false);
      expect(device.hasAttributeServer(Thermostat.Cluster.id, 'occupiedCoolingSetpoint')).toBe(true);

      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('\x1B[39mMatterbridge.Matterbridge.ThermoCool \x1B[0mready'));
      expect(device.getAttribute(Thermostat.Cluster.id, 'systemMode')).toBe(Thermostat.SystemMode.Cool);
    });

    test('createDefaultFanControlClusterServer', async () => {
      const device = new MatterbridgeEndpoint(fanDevice, { uniqueStorageKey: 'Fan' });
      expect(device).toBeDefined();
      device.createDefaultIdentifyClusterServer();
      device.createDefaultGroupsClusterServer();
      device.createDefaultFanControlClusterServer();
      expect(device.hasAttributeServer(FanControl.Cluster, 'fanMode')).toBe(true);
      expect(device.hasAttributeServer(FanControl.Cluster, 'percentSetting')).toBe(true);
      expect(device.hasAttributeServer(FanControl.Cluster, 'speedSetting')).toBe(true);

      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('\x1B[39mMatterbridge.Matterbridge.Fan \x1B[0mready'));
      expect(device.getAttribute(FanControl.Cluster.id, 'fanMode')).toBe(FanControl.FanMode.Off);
    });

    test('createDefaultDoorLockClusterServer', async () => {
      const device = new MatterbridgeEndpoint(doorLockDevice, { uniqueStorageKey: 'Lock' });
      expect(device).toBeDefined();
      device.createDefaultIdentifyClusterServer();
      device.createDefaultDoorLockClusterServer();
      expect(device.hasAttributeServer(DoorLock.Cluster, 'operatingMode')).toBe(true);
      expect(device.hasAttributeServer(DoorLock.Cluster, 'lockState')).toBe(true);
      expect(device.hasAttributeServer(DoorLock.Cluster, 'lockType')).toBe(true);

      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('\x1B[39mMatterbridge.Matterbridge.Lock \x1B[0mready'));
      expect(device.getAttribute(DoorLock.Cluster.id, 'lockState')).toBe(DoorLock.LockState.Locked);
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

      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('\x1B[39mMatterbridge.Matterbridge.ModeSelect \x1B[0mready'));
      expect(device.getAttribute(ModeSelect.Cluster.id, 'currentMode')).toBe(0);
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

      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('\x1B[39mMatterbridge.Matterbridge.Valve \x1B[0mready'));
      expect(device.getAttribute(ValveConfigurationAndControl.Cluster.id, 'currentState')).toBe(ValveConfigurationAndControl.ValveState.Closed);
      expect(device.getAttribute(ValveConfigurationAndControl.Cluster.id, 'currentLevel')).toBe(0);
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

      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('\x1B[39mMatterbridge.Matterbridge.Pump \x1B[0mready'));
      expect(device.getAttribute(PumpConfigurationAndControl.Cluster.id, 'operationMode')).toBe(PumpConfigurationAndControl.OperationMode.Normal);
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

      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('\x1B[39mMatterbridge.Matterbridge.SmokeAlarm \x1B[0mready'));
      expect(device.getAttribute(SmokeCoAlarm.Cluster.id, 'smokeState')).toBe(SmokeCoAlarm.AlarmState.Normal);
      expect(device.getAttribute(SmokeCoAlarm.Cluster.id, 'coState')).toBe(SmokeCoAlarm.AlarmState.Normal);
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

      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('\x1B[39mMatterbridge.Matterbridge.SwitchMomentary \x1B[0mready'));

      await device.triggerSwitchEvent('Press', device.log);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('triggerSwitchEvent Press error: Switch cluster with LatchingSwitch not found'));

      expect((device.getAttribute(Switch.Cluster.id, 'featureMap') as Record<string, boolean>).momentarySwitch).toBe(true);
      expect((device.getAttribute(Switch.Cluster.id, 'featureMap') as Record<string, boolean>).latchingSwitch).toBe(false);

      loggerLogSpy.mockClear();
      await device.triggerSwitchEvent('Single', device.log);
      await device.triggerSwitchEvent('Double', device.log);
      await device.triggerSwitchEvent('Long', device.log);
      expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Endpoint number not assigned on endpoint'));
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

      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('\x1B[39mMatterbridge.Matterbridge.SwitchLatching \x1B[0mready'));

      await device.triggerSwitchEvent('Single', device.log);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('triggerSwitchEvent Single error: Switch cluster with MomentarySwitch not found'));

      expect((device.getAttribute(Switch.Cluster.id, 'featureMap') as Record<string, boolean>).momentarySwitch).toBe(false);
      expect((device.getAttribute(Switch.Cluster.id, 'featureMap') as Record<string, boolean>).latchingSwitch).toBe(true);

      loggerLogSpy.mockClear();
      await device.triggerSwitchEvent('Press', device.log);
      await device.triggerSwitchEvent('Release', device.log);
      expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Endpoint number not assigned on endpoint'));
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

      await device.triggerEvent(BooleanState.Cluster.id, 'stateChange', { stateValue: true });
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`triggerEvent ${hk}booleanState.stateChange${er} error`));

      await device.setAttribute(BooleanState.Cluster.id, 'stateValue', true);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`setAttribute ${hk}booleanState.stateValue${er} error: Endpoint`));

      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('\x1B[39mMatterbridge.Matterbridge.ContactSensor \x1B[0mready'));

      expect(device.getAttribute(BooleanState.Cluster.id, 'stateValue')).toBe(false);

      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`${db}Subscribed endpoint`));
      await device.setAttribute(BooleanState.Cluster.id, 'stateValue', true);
      expect(called).toBe(true);

      await device.setAttribute(BooleanStateConfiguration.Cluster.id, 'stateValue', true, device.log);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`setAttribute ${hk}stateValue${er} error`));

      await device.setAttribute(BooleanState.Cluster.id, 'state', true, device.log);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`setAttribute error: Attribute ${hk}state${er} not found`));

      device.getAttribute(BooleanStateConfiguration.Cluster.id, 'state', device.log);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`getAttribute ${hk}state${er} error: cluster not found on endpoint`));

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
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`subscribeAttribute error: Attribute ${hk}state$Changed${er} not found`));

      await device.triggerEvent(BooleanState.Cluster.id, 'stateChange', { stateValue: true }, device.log);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`${db}Trigger event`));

      await device.triggerEvent(BooleanStateConfiguration.Cluster.id, 'stateChange', { stateValue: true });
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`triggerEvent ${hk}stateChange${er} error`));
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

      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('\x1B[39mMatterbridge.Matterbridge.WaterFreezeDetector \x1B[0mready'));

      expect(device.getAttribute(BooleanState.Cluster.id, 'stateValue')).toBe(true);
      expect(device.getAttribute(BooleanStateConfiguration.Cluster.id, 'currentSensitivityLevel')).toBe(0);
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

      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('\x1B[39mMatterbridge.Matterbridge.WaterLeakDetector \x1B[0mready'));

      expect(device.getAttribute(BooleanState.Cluster.id, 'stateValue')).toBe(true);
      expect(device.getAttribute(BooleanStateConfiguration.Cluster.id, 'currentSensitivityLevel')).toBe(0);
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

      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('\x1B[39mMatterbridge.Matterbridge.RainSensor \x1B[0mready'));

      expect(device.getAttribute(BooleanState.Cluster.id, 'stateValue')).toBe(true);
      expect(device.getAttribute(BooleanStateConfiguration.Cluster.id, 'currentSensitivityLevel')).toBe(0);
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

      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('\x1B[39mMatterbridge.Matterbridge.ElectricalSensor \x1B[0mready'));

      expect(device.getAttribute(ElectricalEnergyMeasurement.Cluster.id, 'cumulativeEnergyImported')).toBe(null);
      expect(device.getAttribute(ElectricalPowerMeasurement.Cluster.id, 'voltage')).toBe(null);
    });

    test('createDefaultTemperatureMeasurementClusterServer', async () => {
      const device = new MatterbridgeEndpoint(temperatureSensor, { uniqueStorageKey: 'TemperatureSensor' });
      expect(device).toBeDefined();
      device.createDefaultIdentifyClusterServer();
      device.createDefaultTemperatureMeasurementClusterServer(21 * 100);
      expect(device.hasClusterServer(TemperatureMeasurement.Cluster.id)).toBe(true);
      expect(device.hasAttributeServer(TemperatureMeasurement.Cluster.id, 'measuredValue')).toBe(true);

      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('\x1B[39mMatterbridge.Matterbridge.TemperatureSensor \x1B[0mready'));

      expect(device.getAttribute(TemperatureMeasurement.Cluster.id, 'measuredValue')).toBe(2100);
    });

    test('createDefaultRelativeHumidityMeasurementClusterServer', async () => {
      const device = new MatterbridgeEndpoint(humiditySensor, { uniqueStorageKey: 'HumiditySensor' });
      expect(device).toBeDefined();
      device.createDefaultIdentifyClusterServer();
      device.createDefaultRelativeHumidityMeasurementClusterServer(50 * 100);
      expect(device.hasClusterServer(RelativeHumidityMeasurement.Cluster.id)).toBe(true);
      expect(device.hasAttributeServer(RelativeHumidityMeasurement.Cluster.id, 'measuredValue')).toBe(true);

      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('\x1B[39mMatterbridge.Matterbridge.HumiditySensor \x1B[0mready'));

      expect(device.getAttribute(RelativeHumidityMeasurement.Cluster.id, 'measuredValue')).toBe(5000);
    });

    test('createDefaultPressureMeasurementClusterServer', async () => {
      const device = new MatterbridgeEndpoint(pressureSensor, { uniqueStorageKey: 'PressureSensor' });
      expect(device).toBeDefined();
      device.createDefaultIdentifyClusterServer();
      device.createDefaultPressureMeasurementClusterServer(980);
      expect(device.hasClusterServer(PressureMeasurement.Cluster.id)).toBe(true);
      expect(device.hasAttributeServer(PressureMeasurement.Cluster.id, 'measuredValue')).toBe(true);

      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('\x1B[39mMatterbridge.Matterbridge.PressureSensor \x1B[0mready'));

      expect(device.getAttribute(PressureMeasurement.Cluster.id, 'measuredValue')).toBe(980);
    });

    test('createDefaultIlluminanceMeasurementClusterServer', async () => {
      const device = new MatterbridgeEndpoint(lightSensor, { uniqueStorageKey: 'LightSensor' });
      expect(device).toBeDefined();
      device.createDefaultIdentifyClusterServer();
      device.createDefaultIlluminanceMeasurementClusterServer(1000);
      expect(device.hasClusterServer(IlluminanceMeasurement.Cluster.id)).toBe(true);
      expect(device.hasAttributeServer(IlluminanceMeasurement.Cluster.id, 'measuredValue')).toBe(true);

      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('\x1B[39mMatterbridge.Matterbridge.LightSensor \x1B[0mready'));

      expect(device.getAttribute(IlluminanceMeasurement.Cluster.id, 'measuredValue')).toBe(1000);
    });

    test('createDefaultFlowMeasurementClusterServer', async () => {
      const device = new MatterbridgeEndpoint(flowSensor, { uniqueStorageKey: 'FlowSensor' });
      expect(device).toBeDefined();
      device.createDefaultIdentifyClusterServer();
      device.createDefaultFlowMeasurementClusterServer(20 * 10);
      expect(device.hasClusterServer(FlowMeasurement.Cluster.id)).toBe(true);
      expect(device.hasAttributeServer(FlowMeasurement.Cluster.id, 'measuredValue')).toBe(true);

      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('\x1B[39mMatterbridge.Matterbridge.FlowSensor \x1B[0mready'));

      expect(device.getAttribute(FlowMeasurement.Cluster.id, 'measuredValue')).toBe(200);
    });

    test('createDefaultOccupancySensingClusterServer', async () => {
      const device = new MatterbridgeEndpoint(occupancySensor, { uniqueStorageKey: 'OccupancySensor' });
      expect(device).toBeDefined();
      device.createDefaultIdentifyClusterServer();
      device.createDefaultOccupancySensingClusterServer(true);
      expect(device.hasClusterServer(OccupancySensingServer)).toBe(true);
      expect(device.hasAttributeServer(OccupancySensingServer, 'occupancy')).toBe(true);

      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('\x1B[39mMatterbridge.Matterbridge.OccupancySensor \x1B[0mready'));

      expect(device.getAttribute(OccupancySensing.Cluster.id, 'occupancy')).toEqual({ occupied: true });
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

      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('\x1B[39mMatterbridge.Matterbridge.AirQualitySensor \x1B[0mready'));

      expect(device.getAttribute(AirQuality.Cluster.id, 'airQuality')).toBe(AirQuality.AirQualityEnum.Unknown);
    });
  });
});
