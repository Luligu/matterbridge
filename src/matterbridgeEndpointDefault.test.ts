/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { jest } from '@jest/globals';
import { AnsiLogger, LogLevel, TimestampFormat } from 'node-ansi-logger';

import { Matterbridge } from './matterbridge.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpointDefault.js';
import {
  contactSensor,
  coverDevice,
  doorLockDevice,
  fanDevice,
  genericSwitch,
  lightSensor,
  modeSelect,
  occupancySensor,
  onOffLight,
  onOffOutlet,
  powerSource,
  rainSensor,
  smokeCoAlarm,
  thermostatDevice,
  waterFreezeDetector,
  waterLeakDetector,
  waterValve,
} from './matterbridgeDeviceTypes.js';

// @matter
import { DeviceTypeId, VendorId, ServerNode, Endpoint, EndpointServer, StorageContext, Lifecycle } from '@matter/main';
import { LogFormat as Format, LogLevel as Level } from '@matter/main';
import {
  BasicInformation,
  BasicInformationCluster,
  BooleanState,
  BooleanStateConfiguration,
  BridgedDeviceBasicInformation,
  BridgedDeviceBasicInformationCluster,
  ColorControl,
  Descriptor,
  DescriptorCluster,
  DoorLock,
  FanControl,
  FixedLabel,
  Groups,
  GroupsCluster,
  Identify,
  IdentifyCluster,
  LevelControl,
  ModeSelect,
  OccupancySensing,
  OnOff,
  OnOffCluster,
  PowerSource,
  ScenesManagement,
  ScenesManagementCluster,
  SmokeCoAlarm,
  Switch,
  Thermostat,
  UserLabel,
  ValveConfigurationAndControl,
  WindowCovering,
} from '@matter/main/clusters';
import { AggregatorEndpoint } from '@matter/main/endpoints';
import { MdnsService, logEndpoint } from '@matter/main/protocol';
import {
  ColorControlBehavior,
  DescriptorBehavior,
  DescriptorServer,
  GroupsBehavior,
  GroupsServer,
  IdentifyBehavior,
  IdentifyServer,
  IlluminanceMeasurementServer,
  OccupancySensingServer,
  OnOffBehavior,
  OnOffServer,
  ScenesManagementBehavior,
  ScenesManagementServer,
} from '@matter/main/behaviors';
import { OnOffPlugInUnitDevice } from '@matter/main/devices';

describe('MatterbridgeEndpoint class', () => {
  let matterbridge: Matterbridge;

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
   * Waits for the `isOnline` property to become `true`.
   * @param {number} timeout - The maximum time to wait in milliseconds.
   * @returns {Promise<void>} A promise that resolves when `isOnline` becomes `true` or rejects if the timeout is reached.
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

  beforeAll(async () => {
    // Create a MatterbridgeEdge instance
    process.argv = ['node', 'matterbridge.js', '-mdnsInterface', 'WiFi', '-profile', 'Jest', '-bridge', '-logger', 'debug', '-matterlogger', 'debug'];
    matterbridge = await Matterbridge.loadInstance(true);
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
    await matterbridge.destroyInstance();
    await waitForOffline();

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
    });

    test('serialize and deserialize', async () => {
      MatterbridgeEndpoint.bridgeMode = 'bridge';
      const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight' });
      expect(device).toBeDefined();
      device.createDefaultIdentifyClusterServer().createDefaultBridgedDeviceBasicInformationClusterServer('OnOffLight', '1234', 0xfff1, 'Matterbridge', 'Light').createDefaultGroupsClusterServer().createDefaultOnOffClusterServer();
      const serializedDevice = device.serialize();
      if (serializedDevice) MatterbridgeEndpoint.deserialize(serializedDevice);
    });

    test('hasClusterServer', async () => {
      const deviceType = onOffLight;
      const device = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: 'OnOffLight', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      expect(device).toBeDefined();
      device.createDefaultIdentifyClusterServer();
      device.createDefaultGroupsClusterServer();
      device.createDefaultOnOffClusterServer();
      expect(device.hasClusterServer(Descriptor.Cluster)).toBe(true);
      expect(device.hasClusterServer(Descriptor.Cluster.id)).toBe(true);
      expect(device.hasClusterServer('Descriptor')).toBe(true);
      expect(device.hasClusterServer(Identify.Cluster)).toBe(true);
      expect(device.hasClusterServer(Identify.Cluster.id)).toBe(true);
      expect(device.hasClusterServer('Identify')).toBe(true);
      expect(device.hasClusterServer(Groups.Cluster)).toBe(true);
      expect(device.hasClusterServer(Groups.Cluster.id)).toBe(true);
      expect(device.hasClusterServer('Groups')).toBe(true);
      expect(device.hasClusterServer(ScenesManagement.Cluster)).toBe(false);
      expect(device.hasClusterServer(ScenesManagement.Cluster.id)).toBe(false);
      expect(device.hasClusterServer('ScenesManagement')).toBe(false);
      expect(device.hasClusterServer(OnOff.Cluster)).toBe(true);
      expect(device.hasClusterServer(OnOff.Cluster.with(OnOff.Feature.Lighting))).toBe(true);
      expect(device.hasClusterServer(OnOff.Cluster.with(OnOff.Feature.OffOnly))).toBe(true);
      expect(device.hasClusterServer(OnOff.Cluster.with(OnOff.Feature.DeadFrontBehavior))).toBe(true);
      expect(device.hasClusterServer(OnOff.Cluster.id)).toBe(true);
      expect(device.hasClusterServer('OnOff')).toBe(true);
      expect(device.hasClusterServer('onOff')).toBe(true);
      expect(device.hasClusterServer(Thermostat.Cluster.with(Thermostat.Feature.AutoMode, Thermostat.Feature.Heating, Thermostat.Feature.Cooling))).toBe(false);
      expect(device.hasClusterServer(Thermostat.Cluster.id)).toBe(false);
      expect(device.hasClusterServer('Thermostat')).toBe(false);
      expect(device.hasClusterServer('thermostat')).toBe(false);
    });

    test('hasAttributeServer', async () => {
      const deviceType = onOffLight;
      const device = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: 'OnOffLight', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      expect(device).toBeDefined();
      device.createDefaultIdentifyClusterServer();
      device.createDefaultGroupsClusterServer();
      device.createDefaultOnOffClusterServer();
      console.log('optionsFor(DescriptorBehavior)', device.behaviors.optionsFor(DescriptorBehavior));
      console.log('defaultsFor(DescriptorBehavior)', device.behaviors.defaultsFor(DescriptorBehavior));
      console.log('optionsFor(IdentifyBehavior)', device.behaviors.optionsFor(IdentifyBehavior));
      console.log('defaultsFor(IdentifyBehavior)', device.behaviors.defaultsFor(IdentifyBehavior));
      console.log('optionsFor(OnOffBehavior)', device.behaviors.optionsFor(OnOffBehavior));
      console.log('defaultsFor(OnOffBehavior)', device.behaviors.defaultsFor(OnOffBehavior));
      expect(device.hasAttributeServer(Descriptor.Cluster, 'deviceTypeList')).toBe(true);
      expect(device.hasAttributeServer(Descriptor.Cluster.id, 'tagList')).toBe(true);
      expect(device.hasAttributeServer('Descriptor', 'features')).toBe(false);
      expect(device.hasAttributeServer(Descriptor.Cluster.id, 'identifyTime')).toBe(false);

      expect(device.hasAttributeServer(Identify.Cluster, 'identifyTime')).toBe(true);
      expect(device.hasAttributeServer(Identify.Cluster.id, 'identifyTime')).toBe(true);
      expect(device.hasAttributeServer('Identify', 'identifyTime')).toBe(true);
      expect(device.hasAttributeServer('Identify', 'identifyType')).toBe(true);
      expect(device.hasAttributeServer('Identify', 'none')).toBe(false);
      expect(device.hasAttributeServer('Identify', 'deviceTypeList')).toBe(false);
    });

    test('addFixedLabel', async () => {
      const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      expect(device).toBeDefined();
      device.addFixedLabel('Composed', 'Light');
      expect(device.hasAttributeServer(FixedLabel.Cluster, 'labelList')).toBe(true);
      expect(device.hasAttributeServer(UserLabel.Cluster, 'labelList')).toBe(false);
      const options = device.getClusterServerOptions(FixedLabel.Cluster);
      expect(options).toBeDefined();
      expect(options).toEqual({ 'labelList': [{ 'label': 'Composed', 'value': 'Light' }] });
    });

    test('addUserLabel', async () => {
      const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      expect(device).toBeDefined();
      device.addUserLabel('Composed', 'Light');
      expect(device.hasAttributeServer(FixedLabel.Cluster, 'labelList')).toBe(false);
      expect(device.hasAttributeServer(UserLabel.Cluster, 'labelList')).toBe(true);
      const options = device.getClusterServerOptions(UserLabel.Cluster);
      expect(options).toBeDefined();
      expect(options).toEqual({ 'labelList': [{ 'label': 'Composed', 'value': 'Light' }] });
    });

    test('createDefaultIdentifyClusterServer', async () => {
      const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      expect(device).toBeDefined();
      device.createDefaultIdentifyClusterServer();
      expect(device.hasAttributeServer(Identify.Cluster, 'identifyTime')).toBe(true);
      expect(device.hasAttributeServer(Identify.Cluster, 'identifyType')).toBe(true);
    });

    test('createDefaultBasicInformationClusterServer in bridge mode', async () => {
      MatterbridgeEndpoint.bridgeMode = 'bridge';
      const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      expect(device).toBeDefined();
      device.createDefaultBasicInformationClusterServer('OnOffLight', '1234', 0xfff1, 'Matterbridge', 0x8000, 'Light');
      expect(MatterbridgeEndpoint.bridgeMode).toBe('bridge');
      expect(device.hasClusterServer(BasicInformation.Cluster)).toBe(false);
      expect(device.hasClusterServer(BridgedDeviceBasicInformation.Cluster)).toBe(true);
    });

    test('createDefaultBasicInformationClusterServer in childbridge mode', async () => {
      MatterbridgeEndpoint.bridgeMode = 'childbridge';
      const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      expect(device).toBeDefined();
      device.createDefaultBasicInformationClusterServer('OnOffLight', '1234', 0xfff1, 'Matterbridge', 0x8000, 'Light');
      expect(MatterbridgeEndpoint.bridgeMode).toBe('childbridge');
      expect(device.hasClusterServer(BasicInformation.Cluster)).toBe(false);
      expect(device.hasClusterServer(BridgedDeviceBasicInformation.Cluster)).toBe(false);
      MatterbridgeEndpoint.bridgeMode = 'bridge';
    });

    test('createDefaultBridgedDeviceBasicInformationClusterServer', async () => {
      const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      expect(device).toBeDefined();
      device.createDefaultBridgedDeviceBasicInformationClusterServer('OnOffLight', '1234', 0xfff1, 'Matterbridge', 'Light');
      expect(device.hasClusterServer(BasicInformation.Cluster)).toBe(false);
      expect(device.hasClusterServer(BridgedDeviceBasicInformation.Cluster)).toBe(true);
    });

    test('createDefaultGroupsClusterServer', async () => {
      const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      expect(device).toBeDefined();
      device.createDefaultGroupsClusterServer();
      expect(device.hasClusterServer(Groups.Cluster)).toBe(true);
    });

    test('createDefaultScenesClusterServer', async () => {
      const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      expect(device).toBeDefined();
      device.createDefaultScenesClusterServer();
      expect(device.hasClusterServer(ScenesManagement.Cluster)).toBe(true);
    });

    test('createDefaultOnOffClusterServer', async () => {
      const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      expect(device).toBeDefined();
      device.createDefaultOnOffClusterServer();
      expect(device.hasAttributeServer(OnOff.Cluster, 'onOff')).toBe(true);
      expect(device.hasAttributeServer(OnOff.Cluster, 'startUpOnOff')).toBe(true);
    });
    test('createOnOffClusterServer', async () => {
      const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      expect(device).toBeDefined();
      device.createOnOffClusterServer();
      expect(device.hasAttributeServer(OnOff.Cluster, 'onOff')).toBe(true);
      expect(device.hasAttributeServer(OnOff.Cluster, 'startUpOnOff')).toBe(false);
    });

    test('createDeadFrontOnOffClusterServer', async () => {
      const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      expect(device).toBeDefined();
      device.createDeadFrontOnOffClusterServer();
      expect(device.hasAttributeServer(OnOff.Cluster, 'onOff')).toBe(true);
      expect(device.hasAttributeServer(OnOff.Cluster, 'startUpOnOff')).toBe(false);
    });

    test('createDefaultLevelControlClusterServer', async () => {
      const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      expect(device).toBeDefined();
      device.createDefaultLevelControlClusterServer();
      expect(device.hasAttributeServer(LevelControl.Cluster, 'currentLevel')).toBe(true);
      expect(device.hasAttributeServer(LevelControl.Cluster, 'startUpCurrentLevel')).toBe(true);
    });

    test('createDefaultColorControlClusterServer', async () => {
      const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
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

      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
      await device.configureColorControlMode(ColorControl.ColorMode.ColorTemperatureMireds);
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
      const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      expect(device).toBeDefined();
      device.createXyColorControlClusterServer();
      expect(device.hasAttributeServer(ColorControl.Cluster, 'colorMode')).toBe(true);
      expect(device.hasAttributeServer(ColorControl.Cluster, 'currentX')).toBe(true);
      expect(device.hasAttributeServer(ColorControl.Cluster, 'currentY')).toBe(true);
      expect(device.hasAttributeServer(ColorControl.Cluster, 'currentHue')).toBe(false);
      expect(device.hasAttributeServer(ColorControl.Cluster, 'currentSaturation')).toBe(false);
      expect(device.hasAttributeServer(ColorControl.Cluster, 'colorTemperatureMireds')).toBe(true);
      expect(device.hasAttributeServer(ColorControl.Cluster, 'startUpColorTemperatureMireds')).toBe(true);
    });

    test('createHsColorControlClusterServer', async () => {
      const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      expect(device).toBeDefined();
      device.createHsColorControlClusterServer();
      expect(device.hasAttributeServer(ColorControl.Cluster, 'colorMode')).toBe(true);
      expect(device.hasAttributeServer(ColorControl.Cluster, 'currentX')).toBe(false);
      expect(device.hasAttributeServer(ColorControl.Cluster, 'currentY')).toBe(false);
      expect(device.hasAttributeServer(ColorControl.Cluster, 'currentHue')).toBe(true);
      expect(device.hasAttributeServer(ColorControl.Cluster, 'currentSaturation')).toBe(true);
      expect(device.hasAttributeServer(ColorControl.Cluster, 'colorTemperatureMireds')).toBe(true);
      expect(device.hasAttributeServer(ColorControl.Cluster, 'startUpColorTemperatureMireds')).toBe(true);
    });

    test('createCtColorControlClusterServer', async () => {
      const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      expect(device).toBeDefined();
      device.createCtColorControlClusterServer();
      expect(device.hasAttributeServer(ColorControl.Cluster, 'colorMode')).toBe(true);
      expect(device.hasAttributeServer(ColorControl.Cluster, 'currentX')).toBe(false);
      expect(device.hasAttributeServer(ColorControl.Cluster, 'currentY')).toBe(false);
      expect(device.hasAttributeServer(ColorControl.Cluster, 'currentHue')).toBe(false);
      expect(device.hasAttributeServer(ColorControl.Cluster, 'currentSaturation')).toBe(false);
      expect(device.hasAttributeServer(ColorControl.Cluster, 'colorTemperatureMireds')).toBe(true);
      expect(device.hasAttributeServer(ColorControl.Cluster, 'startUpColorTemperatureMireds')).toBe(true);
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
    });

    test('createDefaultModeSelectClusterServer', async () => {
      const device = new MatterbridgeEndpoint(modeSelect, { uniqueStorageKey: 'Mode' });
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
    });

    test('createDefaultSmokeCOAlarmClusterServer', async () => {
      const device = new MatterbridgeEndpoint(smokeCoAlarm, { uniqueStorageKey: 'Smoke' });
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

      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);

      expect((device.getAttribute(Switch.Cluster.id, 'featureMap') as Record<string, boolean>).momentarySwitch).toBe(true);
      expect((device.getAttribute(Switch.Cluster.id, 'featureMap') as Record<string, boolean>).latchingSwitch).toBe(false);

      await device.triggerSwitchEvent('Single', device.log);
      await device.triggerSwitchEvent('Double', device.log);
      await device.triggerSwitchEvent('Long', device.log);
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

      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);

      expect((device.getAttribute(Switch.Cluster.id, 'featureMap') as Record<string, boolean>).momentarySwitch).toBe(false);
      expect((device.getAttribute(Switch.Cluster.id, 'featureMap') as Record<string, boolean>).latchingSwitch).toBe(true);

      await device.triggerSwitchEvent('Press', device.log);
      await device.triggerSwitchEvent('Release', device.log);
    });

    test('createDefaultBooleanStateClusterServer', async () => {
      const device = new MatterbridgeEndpoint(contactSensor, { uniqueStorageKey: 'Contact' });
      expect(device).toBeDefined();
      device.createDefaultIdentifyClusterServer();
      device.createDefaultBooleanStateClusterServer();
      expect(device.hasAttributeServer(BooleanState.Cluster.id, 'stateValue')).toBe(true);
      expect(device.hasAttributeServer('BooleanState', 'StateValue')).toBe(true);

      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
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
    });
  });
});
