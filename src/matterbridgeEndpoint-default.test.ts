/* eslint-disable @typescript-eslint/no-explicit-any */

/* eslint-disable @typescript-eslint/no-unused-vars */
import { jest } from '@jest/globals';
import { AnsiLogger, db, er, hk, LogLevel, or } from 'node-ansi-logger';

import { Matterbridge } from './matterbridge.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import {
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

// @matter
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
} from '@matter/main/clusters';
import {
  AirQualityServer,
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
import { updateAttribute } from './matterbridgeEndpointHelpers.js';

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

  /*
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
  */

  beforeAll(async () => {
    // Create a MatterbridgeEdge instance
    process.argv = ['node', 'matterbridge.js', '-mdnsInterface', 'Wi-Fi', '-frontend', '0', '-profile', 'JestDefault', '-bridge', '-logger', 'info', '-matterlogger', 'info'];
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
    await matterbridge.destroyInstance();

    // Restore all mocks
    jest.restoreAllMocks();
  }, 30000);

  describe('MatterbridgeEndpoint-default', () => {
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

    test('createDefaultIdentifyClusterServer', async () => {
      const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight8', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      expect(device).toBeDefined();
      device.createDefaultIdentifyClusterServer();
      expect(device.hasAttributeServer(Identify.Cluster, 'identifyTime')).toBe(true);
      expect(device.hasAttributeServer(Identify.Cluster, 'identifyType')).toBe(true);

      await add(device);
    });

    test('createDefaultBasicInformationClusterServer in bridge mode', async () => {
      MatterbridgeEndpoint.bridgeMode = 'bridge';
      const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight9', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      expect(device).toBeDefined();
      device.createDefaultBasicInformationClusterServer('OnOffLight', '1234', 0xfff1, 'Matterbridge', 0x8000, 'Light');
      expect(MatterbridgeEndpoint.bridgeMode).toBe('bridge');
      expect(device.hasClusterServer(BasicInformation.Cluster)).toBe(false);
      expect(device.hasClusterServer(BridgedDeviceBasicInformation.Cluster)).toBe(true);

      await add(device);
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

    // eslint-disable-next-line jest/no-commented-out-tests
    /*
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
    */

    test('createDefaultOnOffClusterServer', async () => {
      const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight14', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      expect(device).toBeDefined();
      device.createDefaultOnOffClusterServer();
      expect(device.hasAttributeServer(OnOff.Cluster, 'onOff')).toBe(true);
      expect(device.hasAttributeServer(OnOff.Cluster, 'startUpOnOff')).toBe(true);

      await add(device);
    });

    test('createOnOffClusterServer', async () => {
      const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight15', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      expect(device).toBeDefined();
      device.createOnOffClusterServer();
      expect(device.hasAttributeServer(OnOff.Cluster, 'onOff')).toBe(true);
      expect(device.hasAttributeServer(OnOff.Cluster, 'startUpOnOff')).toBe(false);

      await add(device);
    });

    test('createDeadFrontOnOffClusterServer', async () => {
      const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight16', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      expect(device).toBeDefined();
      device.createDeadFrontOnOffClusterServer();
      expect(device.hasAttributeServer(OnOff.Cluster, 'onOff')).toBe(true);
      expect(device.hasAttributeServer(OnOff.Cluster, 'startUpOnOff')).toBe(false);

      await add(device);
    });

    test('createDefaultLevelControlClusterServer', async () => {
      const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight17', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      expect(device).toBeDefined();
      device.createDefaultLevelControlClusterServer();
      expect(device.hasAttributeServer(LevelControl.Cluster, 'currentLevel')).toBe(true);
      expect(device.hasAttributeServer(LevelControl.Cluster, 'startUpCurrentLevel')).toBe(true);

      await add(device);
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

      await add(device);

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

      await add(device);
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

      await add(device);

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

      await add(device);
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

      await add(device);
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

      await add(device);
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

      await add(device);
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

      await add(device);
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

      await add(device);
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

      await add(device);
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

      await add(device);
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

      await add(device);
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

      await add(device);

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

      await add(device);

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

      await add(device);

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
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`subscribeAttribute error: Attribute ${hk}state${er} not found`));

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

      await add(device);

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

      await add(device);

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

      await add(device);

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

      await add(device);

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

      await add(device);

      expect(device.getAttribute(TemperatureMeasurement.Cluster.id, 'measuredValue')).toBe(2100);
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
    });

    // eslint-disable-next-line jest/expect-expect
    test('pause before cleanup', async () => {
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Pause for 5 seconds to allow matter.js promises to settle
    }, 60000);
  });
});
