// src\matterbridgeBehaviorsServer.test.ts

const NAME = 'MatterbridgeBehaviorsServer';
const MATTER_PORT = 11500;
const HOMEDIR = path.join('.cache', 'jest', NAME);
const MATTER_CREATE_ONLY = true;

import path from 'node:path';

import { jest } from '@jest/globals';
import { DeviceEnergyManagementServer } from '@matter/node/behaviors/device-energy-management';
import { ActivatedCarbonFilterMonitoring } from '@matter/types/clusters/activated-carbon-filter-monitoring';
import { BooleanStateConfiguration } from '@matter/types/clusters/boolean-state-configuration';
import { ColorControl } from '@matter/types/clusters/color-control';
import { DeviceEnergyManagement } from '@matter/types/clusters/device-energy-management';
import { DeviceEnergyManagementMode } from '@matter/types/clusters/device-energy-management-mode';
import { DoorLock } from '@matter/types/clusters/door-lock';
import { FanControl } from '@matter/types/clusters/fan-control';
import { HepaFilterMonitoring } from '@matter/types/clusters/hepa-filter-monitoring';
import { Identify } from '@matter/types/clusters/identify';
import { LevelControl } from '@matter/types/clusters/level-control';
import { ModeSelect } from '@matter/types/clusters/mode-select';
import { OnOff } from '@matter/types/clusters/on-off';
import { OperationalState } from '@matter/types/clusters/operational-state';
import { PowerSource } from '@matter/types/clusters/power-source';
import { ServiceArea } from '@matter/types/clusters/service-area';
import { SmokeCoAlarm } from '@matter/types/clusters/smoke-co-alarm';
import { Thermostat } from '@matter/types/clusters/thermostat';
import { ValveConfigurationAndControl } from '@matter/types/clusters/valve-configuration-and-control';
import { WindowCovering } from '@matter/types/clusters/window-covering';
import { LogLevel } from 'node-ansi-logger';

import { RoboticVacuumCleaner } from './devices/roboticVacuumCleaner.js';
import {
  addDevice,
  aggregator,
  createMatterbridgeEnvironment,
  destroyMatterbridgeEnvironment,
  getEnhancedMoveToHueAndSaturationRequest,
  getEnhancedMoveToHueRequest,
  getMoveToColorRequest,
  getMoveToColorTemperatureRequest,
  getMoveToHueAndSaturationRequest,
  getMoveToHueRequest,
  getMoveToLevelRequest,
  getMoveToSaturationRequest,
  loggerLogSpy,
  setupTest,
  startMatterbridgeEnvironment,
  stopMatterbridgeEnvironment,
} from './jestutils/jestHelpers.js';
import { Matterbridge } from './matterbridge.js';
import { MatterbridgePresetThermostatServer, MatterbridgeSwitchServer, MatterbridgeThermostatServer } from './matterbridgeBehaviorsServer.js';
import {
  airPurifier,
  bridge,
  contactSensor,
  coverDevice,
  deviceEnergyManagement,
  doorLockDevice,
  extendedColorLight,
  fanDevice,
  laundryWasher,
  lightSensor,
  modeSelect,
  occupancySensor,
  onOffLight,
  powerSource,
  smokeCoAlarm,
  temperatureSensor,
  thermostatDevice,
  waterValve,
} from './matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { type CommandHandlers } from './matterbridgeEndpointCommandHandler.js';

jest.spyOn(Matterbridge.prototype as any, 'backupMatterStorage').mockImplementation(async () => {
  return Promise.resolve();
});

// Setup the test environment
await setupTest(NAME, false);

describe('Server clusters and behaviors', () => {
  let light: MatterbridgeEndpoint;
  let enhancedLight: MatterbridgeEndpoint;
  let coverLift: MatterbridgeEndpoint;
  let coverLiftTilt: MatterbridgeEndpoint;
  let lock: MatterbridgeEndpoint;
  let fan: MatterbridgeEndpoint;
  let thermostat: MatterbridgeEndpoint;
  let thermostatPreset: MatterbridgeEndpoint;
  let valve: MatterbridgeEndpoint;
  let smoke: MatterbridgeEndpoint;
  let contact: MatterbridgeEndpoint;
  let mode: MatterbridgeEndpoint;
  let purifier: MatterbridgeEndpoint;
  let energyManagement: MatterbridgeEndpoint;
  let washer: MatterbridgeEndpoint;
  let rvc: RoboticVacuumCleaner;

  const thermostatPresetTypes: Thermostat.PresetType[] = [
    { presetScenario: Thermostat.PresetScenario.Occupied, numberOfPresets: 2, presetTypeFeatures: { automatic: false, supportsNames: true } },
    { presetScenario: Thermostat.PresetScenario.Unoccupied, numberOfPresets: 2, presetTypeFeatures: { automatic: false, supportsNames: true } },
  ];
  const thermostatPresets: Thermostat.Preset[] = [
    { presetHandle: Uint8Array.from([0]), presetScenario: Thermostat.PresetScenario.Occupied, name: 'Occupied', coolingSetpoint: 2500, heatingSetpoint: 2100, builtIn: null },
    { presetHandle: Uint8Array.from([1]), presetScenario: Thermostat.PresetScenario.Unoccupied, name: 'Unoccupied', coolingSetpoint: 2700, heatingSetpoint: 1900, builtIn: null },
  ];

  function createPresetThermostatEndpoint(id: string) {
    const endpoint = new MatterbridgeEndpoint(thermostatDevice, { id });
    endpoint.createDefaultPresetsThermostatClusterServer(
      23,
      21,
      25,
      2,
      0,
      48,
      2,
      50,
      undefined,
      undefined,
      undefined,
      undefined,
      Uint8Array.from([0]), // activePresetHandle: Uint8Array | null
      thermostatPresets, // presetsList: Thermostat.Preset[]
      thermostatPresetTypes, // presetTypesList: Thermostat.PresetType[]
    );
    endpoint.addRequiredClusterServers();
    return endpoint;
  }

  async function expectCommand(
    endpoint: MatterbridgeEndpoint,
    cluster: any,
    command: CommandHandlers,
    expectedRequest?: Record<string, boolean | number | bigint | string | object | null>,
    check?: (data: any) => void,
  ) {
    let invoke: Promise<void>;

    await new Promise((resolve, reject) => {
      endpoint.addCommandHandler(command, async (data) => {
        try {
          expect(data.endpoint).toBe(endpoint);
          if (expectedRequest === undefined) expect(data.request).toEqual({});
          else expect(data.request).toEqual(expectedRequest);
          check?.(data);
          resolve(true);
        } catch (error) {
          reject(error);
        }
      });
      invoke = expectedRequest === undefined ? endpoint.invokeBehaviorCommand(cluster, command) : endpoint.invokeBehaviorCommand(cluster, command, expectedRequest);
    });

    // @ts-expect-error Typescript doesn't know that the command handler will be executed before this line
    await invoke;
  }

  beforeAll(async () => {
    // Create Matterbridge environment
    await createMatterbridgeEnvironment(NAME, MATTER_CREATE_ONLY);
    await startMatterbridgeEnvironment(MATTER_PORT, MATTER_CREATE_ONLY);
  });

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {});

  afterAll(async () => {
    // Destroy Matterbridge environment
    await stopMatterbridgeEnvironment(MATTER_CREATE_ONLY);
    await destroyMatterbridgeEnvironment(undefined, undefined, !MATTER_CREATE_ONLY);
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('Device type: extendedLight', async () => {
    light = new MatterbridgeEndpoint([extendedColorLight, bridge, powerSource], { id: 'extendedColorLight' });
    light.createDefaultBridgedDeviceBasicInformationClusterServer('Extended Color Light', 'SN12345678');
    light.createDefaultPowerSourceWiredClusterServer();
    light.addRequiredClusterServers();
    expect(light).toBeDefined();

    light.addChildDeviceType('illuminance', lightSensor).addRequiredClusterServers();
    light.addChildDeviceType('motion', occupancySensor).addRequiredClusterServers();

    expect(await addDevice(aggregator, light)).toBeTruthy();
  });

  test('PowerSource server', async () => {
    const poweredDevice = new MatterbridgeEndpoint([extendedColorLight, bridge, powerSource], { id: 'powerSourceTest' });
    const constructionCallbacks: Array<() => unknown> = [];
    const onSuccess = poweredDevice.construction.onSuccess.bind(poweredDevice.construction);

    jest.spyOn(poweredDevice.construction, 'onSuccess').mockImplementation((callback) => {
      constructionCallbacks.push(callback);
      return onSuccess(callback);
    });

    poweredDevice.createDefaultBridgedDeviceBasicInformationClusterServer('PowerSource Test', 'SNPS123456');
    poweredDevice.createDefaultPowerSourceWiredClusterServer();
    poweredDevice.addRequiredClusterServers();

    poweredDevice.addChildDeviceType('temperature', temperatureSensor).addRequiredClusterServers();
    poweredDevice.addChildDeviceType('light', lightSensor).addRequiredClusterServers();
    const notReadyChild = poweredDevice.addChildDeviceType('pending', occupancySensor).addRequiredClusterServers();

    expect(await addDevice(aggregator, poweredDevice)).toBeTruthy();
    jest.spyOn(notReadyChild.lifecycle, 'isReady', 'get').mockReturnValue(false);
    await Promise.resolve(constructionCallbacks.at(-1)?.());
    expect(poweredDevice.getAttribute(PowerSource.Cluster.id, 'endpointList')).toEqual([
      poweredDevice.number,
      ...poweredDevice.parts.filter((endpoint) => endpoint.lifecycle.isReady).map((endpoint) => endpoint.number),
    ]);
  });

  test('Switch server', async () => {
    expect(() => MatterbridgeSwitchServer.prototype.initialize.call({} as MatterbridgeSwitchServer)).not.toThrow();
  });

  test('Device type: enhancedLight', async () => {
    enhancedLight = new MatterbridgeEndpoint([onOffLight, bridge, powerSource], { id: 'enhancedLight' });
    enhancedLight.createDefaultBridgedDeviceBasicInformationClusterServer('Enhanced Light', 'SN87654321');
    enhancedLight.createDefaultPowerSourceWiredClusterServer();
    enhancedLight.createDefaultOnOffClusterServer(true);
    enhancedLight.createEnhancedColorControlClusterServer();
    enhancedLight.addRequiredClusterServers();
    expect(enhancedLight).toBeDefined();
    expect(await addDevice(aggregator, enhancedLight)).toBeTruthy();
  });

  test('Device type: coverLift', async () => {
    coverLift = new MatterbridgeEndpoint(coverDevice, { id: 'coverLift' });
    coverLift.addRequiredClusterServers();
    expect(coverLift).toBeDefined();
    expect(await addDevice(aggregator, coverLift)).toBeTruthy();
  });

  test('Device type: coverLiftTilt', async () => {
    coverLiftTilt = new MatterbridgeEndpoint(coverDevice, { id: 'coverLiftTilt' });
    coverLiftTilt.createDefaultLiftTiltWindowCoveringClusterServer();
    coverLiftTilt.addRequiredClusterServers();
    expect(coverLiftTilt).toBeDefined();
    expect(await addDevice(aggregator, coverLiftTilt)).toBeTruthy();
  });

  test('Device type: doorLock', async () => {
    lock = new MatterbridgeEndpoint(doorLockDevice, { id: 'doorLock' });
    lock.addRequiredClusterServers();
    expect(lock).toBeDefined();
    expect(await addDevice(aggregator, lock)).toBeTruthy();
  });

  test('Device type: fan', async () => {
    fan = new MatterbridgeEndpoint(fanDevice, { id: 'fan' });
    fan.createDefaultActivatedCarbonFilterMonitoringClusterServer();
    fan.createDefaultHepaFilterMonitoringClusterServer();
    fan.addRequiredClusterServers();
    expect(fan).toBeDefined();
    expect(await addDevice(aggregator, fan)).toBeTruthy();
  });

  test('Device type: thermostat', async () => {
    thermostat = new MatterbridgeEndpoint(thermostatDevice, { id: 'thermostat' });
    thermostat.addRequiredClusterServers();
    expect(thermostat).toBeDefined();
    expect(await addDevice(aggregator, thermostat)).toBeTruthy();
  });

  test('Device type: thermostatPreset', async () => {
    thermostatPreset = createPresetThermostatEndpoint('thermostatPreset');
    expect(thermostatPreset).toBeDefined();
    expect(await addDevice(aggregator, thermostatPreset)).toBeTruthy();
  });

  test('Device type: valve', async () => {
    valve = new MatterbridgeEndpoint(waterValve, { id: 'valve' });
    valve.createDefaultValveConfigurationAndControlClusterServer();
    valve.addRequiredClusterServers();
    expect(valve).toBeDefined();
    expect(await addDevice(aggregator, valve)).toBeTruthy();
  });

  test('Device type: smokeSensor', async () => {
    smoke = new MatterbridgeEndpoint(smokeCoAlarm, { id: 'smokeSensor' });
    smoke.createDefaultSmokeCOAlarmClusterServer();
    smoke.addRequiredClusterServers();
    expect(smoke).toBeDefined();
    expect(await addDevice(aggregator, smoke)).toBeTruthy();
  });

  test('Device type: contactSensor', async () => {
    contact = new MatterbridgeEndpoint(contactSensor, { id: 'contactSensor' });
    contact.createDefaultBooleanStateConfigurationClusterServer();
    contact.addRequiredClusterServers();
    expect(contact).toBeDefined();
    expect(await addDevice(aggregator, contact)).toBeTruthy();
  });

  test('Device type: modeSelect', async () => {
    mode = new MatterbridgeEndpoint(modeSelect, { id: 'modeSelect' });
    mode.createDefaultModeSelectClusterServer('Night mode', [
      { label: 'Led ON', mode: 0, semanticTags: [] },
      { label: 'Led OFF', mode: 1, semanticTags: [] },
    ]);
    mode.addRequiredClusterServers();
    expect(mode).toBeDefined();
    expect(await addDevice(aggregator, mode)).toBeTruthy();
  });

  test('Device type: airPurifier', async () => {
    purifier = new MatterbridgeEndpoint(airPurifier, { id: 'airPurifier' });
    purifier.createDefaultHepaFilterMonitoringClusterServer(40);
    purifier.createDefaultActivatedCarbonFilterMonitoringClusterServer(30);
    purifier.addRequiredClusterServers();
    expect(purifier).toBeDefined();
    expect(await addDevice(aggregator, purifier)).toBeTruthy();
  });

  test('Device type: deviceEnergyManagement', async () => {
    energyManagement = new MatterbridgeEndpoint(deviceEnergyManagement, { id: 'deviceEnergyManagement' });
    energyManagement.createDefaultDeviceEnergyManagementClusterServer(DeviceEnergyManagement.EsaType.Other, false, DeviceEnergyManagement.EsaState.Online, -3000, 2000);
    energyManagement.createDefaultDeviceEnergyManagementModeClusterServer();
    energyManagement.addRequiredClusterServers();
    expect(energyManagement).toBeDefined();
    expect(await addDevice(aggregator, energyManagement)).toBeTruthy();
  });

  test('Device type: laundryWasher', async () => {
    washer = new MatterbridgeEndpoint(laundryWasher, { id: 'laundryWasher' });
    washer.createDefaultOperationalStateClusterServer();
    washer.addRequiredClusterServers();
    expect(washer).toBeDefined();
    expect(await addDevice(aggregator, washer)).toBeTruthy();
  });

  test('Device type: roboticVacuumCleaner', async () => {
    rvc = new RoboticVacuumCleaner('RVC Test Device', 'RVC123456');
    expect(rvc).toBeDefined();
    expect(await addDevice(aggregator, rvc)).toBeTruthy();
  });

  test('Identify server', async () => {
    await expectCommand(light, Identify.Cluster, 'identify', { identifyTime: 1 }, (data) => {
      expect(data.cluster).toBe(Identify.Cluster.name.toLowerCase());
      expect(data.attributes.identifyTime).toBe(0);
      expect(data.attributes.identifyType).toBe(Identify.IdentifyType.None);
    });
    await light.invokeBehaviorCommand(Identify.Cluster, 'identify', { identifyTime: 0 }); // Turn off identify mode

    await expectCommand(light, Identify.Cluster, 'triggerEffect', { effectIdentifier: Identify.EffectIdentifier.Blink, effectVariant: Identify.EffectVariant.Default }, (data) => {
      expect(data.cluster).toBe(Identify.Cluster.name.toLowerCase());
      expect(data.attributes.identifyTime).toBe(0);
      expect(data.attributes.identifyType).toBe(Identify.IdentifyType.None);
    });
  });

  test('OnOff server', async () => {
    await expectCommand(light, OnOff.Cluster, 'on', undefined, (data) => {
      expect(data.cluster).toBe('onOff');
      expect(data.attributes.onOff).toBe(false);
    });

    await expectCommand(light, OnOff.Cluster, 'off', undefined, (data) => {
      expect(data.cluster).toBe('onOff');
      expect(data.attributes.onOff).toBe(true);
    });

    await expectCommand(light, OnOff.Cluster, 'toggle', undefined, (data) => {
      expect(data.cluster).toBe('onOff');
      expect(data.attributes.onOff).toBe(false);
    });
  });

  test('LevelControl server', async () => {
    const moveToLevelRequest = getMoveToLevelRequest(100, 5, false);
    await expectCommand(light, LevelControl.Cluster, 'moveToLevel', moveToLevelRequest, (data) => {
      expect(data.cluster).toBe('levelControl');
      expect(data.attributes.currentLevel).toBe(254);
    });

    const moveToLevelWithOnOffRequest = getMoveToLevelRequest(150, 3, false);
    await expectCommand(light, LevelControl.Cluster, 'moveToLevelWithOnOff', moveToLevelWithOnOffRequest, (data) => {
      expect(data.cluster).toBe('levelControl');
      expect(data.attributes.currentLevel).toBe(100);
    });
  });

  test('ColorControl server', async () => {
    const moveToHueRequest = getMoveToHueRequest(180, 0, false);
    await expectCommand(light, ColorControl.Cluster, 'moveToHue', moveToHueRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });

    const moveToSaturationRequest = getMoveToSaturationRequest(100, 0, false);
    await expectCommand(light, ColorControl.Cluster, 'moveToSaturation', moveToSaturationRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });

    const moveToHueAndSaturationRequest = getMoveToHueAndSaturationRequest(180, 100, 0, false);
    await expectCommand(light, ColorControl.Cluster, 'moveToHueAndSaturation', moveToHueAndSaturationRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });

    const moveToColorRequest = getMoveToColorRequest(30000, 30000, 0, false);
    await expectCommand(light, ColorControl.Cluster, 'moveToColor', moveToColorRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });

    const moveToColorTemperatureRequest = getMoveToColorTemperatureRequest(250, 0, false);
    await expectCommand(light, ColorControl.Cluster, 'moveToColorTemperature', moveToColorTemperatureRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });
  });

  test('EnhancedColorControl server', async () => {
    const expectEnhancedColorAttributes = (expected: {
      colorMode: number;
      enhancedColorMode: number;
      currentHue: number;
      enhancedCurrentHue: number;
      currentSaturation: number;
      currentX: number;
      currentY: number;
      colorTemperatureMireds: number;
    }) => {
      expect(enhancedLight.getAttribute(ColorControl.Cluster.id, 'colorMode')).toBe(expected.colorMode);
      expect(enhancedLight.getAttribute(ColorControl.Cluster.id, 'enhancedColorMode')).toBe(expected.enhancedColorMode);
      expect(enhancedLight.getAttribute(ColorControl.Cluster.id, 'currentHue')).toBe(expected.currentHue);
      expect(enhancedLight.getAttribute(ColorControl.Cluster.id, 'enhancedCurrentHue')).toBe(expected.enhancedCurrentHue);
      expect(enhancedLight.getAttribute(ColorControl.Cluster.id, 'currentSaturation')).toBe(expected.currentSaturation);
      expect(enhancedLight.getAttribute(ColorControl.Cluster.id, 'currentX')).toBe(expected.currentX);
      expect(enhancedLight.getAttribute(ColorControl.Cluster.id, 'currentY')).toBe(expected.currentY);
      expect(enhancedLight.getAttribute(ColorControl.Cluster.id, 'colorTemperatureMireds')).toBe(expected.colorTemperatureMireds);
    };

    const moveToHueRequest = getMoveToHueRequest(180, 0, false);
    await expectCommand(enhancedLight, ColorControl.Cluster, 'moveToHue', moveToHueRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });
    expectEnhancedColorAttributes({
      colorMode: ColorControl.ColorMode.CurrentHueAndCurrentSaturation,
      enhancedColorMode: ColorControl.EnhancedColorMode.EnhancedCurrentHueAndCurrentSaturation,
      currentHue: 180,
      enhancedCurrentHue: 0,
      currentSaturation: 0,
      currentX: 0,
      currentY: 0,
      colorTemperatureMireds: 500,
    });

    const enhancedMoveToHueRequest = getEnhancedMoveToHueRequest(32000, 0, false);
    await expectCommand(enhancedLight, ColorControl.Cluster, 'enhancedMoveToHue', enhancedMoveToHueRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
      expect(data.attributes.enhancedCurrentHue).toBe(0);
    });
    expectEnhancedColorAttributes({
      colorMode: ColorControl.ColorMode.CurrentHueAndCurrentSaturation,
      enhancedColorMode: ColorControl.EnhancedColorMode.EnhancedCurrentHueAndCurrentSaturation,
      currentHue: 180,
      enhancedCurrentHue: 32000,
      currentSaturation: 0,
      currentX: 0,
      currentY: 0,
      colorTemperatureMireds: 500,
    });

    const moveToSaturationRequest = getMoveToSaturationRequest(100, 0, false);
    await expectCommand(enhancedLight, ColorControl.Cluster, 'moveToSaturation', moveToSaturationRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });
    expectEnhancedColorAttributes({
      colorMode: ColorControl.ColorMode.CurrentHueAndCurrentSaturation,
      enhancedColorMode: ColorControl.EnhancedColorMode.EnhancedCurrentHueAndCurrentSaturation,
      currentHue: 180,
      enhancedCurrentHue: 32000,
      currentSaturation: 100,
      currentX: 0,
      currentY: 0,
      colorTemperatureMireds: 500,
    });

    const moveToHueAndSaturationRequest = getMoveToHueAndSaturationRequest(180, 100, 0, false);
    await expectCommand(enhancedLight, ColorControl.Cluster, 'moveToHueAndSaturation', moveToHueAndSaturationRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });
    expectEnhancedColorAttributes({
      colorMode: ColorControl.ColorMode.CurrentHueAndCurrentSaturation,
      enhancedColorMode: ColorControl.EnhancedColorMode.EnhancedCurrentHueAndCurrentSaturation,
      currentHue: 180,
      enhancedCurrentHue: 32000,
      currentSaturation: 100,
      currentX: 0,
      currentY: 0,
      colorTemperatureMireds: 500,
    });

    const enhancedMoveToHueAndSaturationRequest = getEnhancedMoveToHueAndSaturationRequest(32000, 100, 0, false);
    await expectCommand(enhancedLight, ColorControl.Cluster, 'enhancedMoveToHueAndSaturation', enhancedMoveToHueAndSaturationRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
      expect(data.attributes.enhancedCurrentHue).toBe(32000);
    });
    expectEnhancedColorAttributes({
      colorMode: ColorControl.ColorMode.CurrentHueAndCurrentSaturation,
      enhancedColorMode: ColorControl.EnhancedColorMode.EnhancedCurrentHueAndCurrentSaturation,
      currentHue: 180,
      enhancedCurrentHue: 32000,
      currentSaturation: 100,
      currentX: 0,
      currentY: 0,
      colorTemperatureMireds: 500,
    });

    const moveToColorRequest = getMoveToColorRequest(30000, 30000, 0, false);
    await expectCommand(enhancedLight, ColorControl.Cluster, 'moveToColor', moveToColorRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });
    expectEnhancedColorAttributes({
      colorMode: ColorControl.ColorMode.CurrentXAndCurrentY,
      enhancedColorMode: ColorControl.EnhancedColorMode.CurrentXAndCurrentY,
      currentHue: 180,
      enhancedCurrentHue: 32000,
      currentSaturation: 100,
      currentX: 30000,
      currentY: 30000,
      colorTemperatureMireds: 500,
    });

    const moveToColorTemperatureRequest = getMoveToColorTemperatureRequest(250, 0, false);
    await expectCommand(enhancedLight, ColorControl.Cluster, 'moveToColorTemperature', moveToColorTemperatureRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });
    expectEnhancedColorAttributes({
      colorMode: ColorControl.ColorMode.ColorTemperatureMireds,
      enhancedColorMode: ColorControl.EnhancedColorMode.ColorTemperatureMireds,
      currentHue: 180,
      enhancedCurrentHue: 32000,
      currentSaturation: 100,
      currentX: 30000,
      currentY: 30000,
      colorTemperatureMireds: 250,
    });
  });

  test('LiftWindowCovering server', async () => {
    const expectLiftCoverAttributes = (expected: {
      operationalStatus: { global: number; lift: number; tilt: number };
      currentPositionLiftPercent100ths: number;
      targetPositionLiftPercent100ths: number;
    }) => {
      expect(coverLift.getAttribute(WindowCovering.Cluster.id, 'operationalStatus')).toEqual(expected.operationalStatus);
      expect(coverLift.getAttribute(WindowCovering.Cluster.id, 'currentPositionLiftPercent100ths')).toBe(expected.currentPositionLiftPercent100ths);
      expect(coverLift.getAttribute(WindowCovering.Cluster.id, 'targetPositionLiftPercent100ths')).toBe(expected.targetPositionLiftPercent100ths);
    };

    await expectCommand(coverLift, WindowCovering.Cluster, 'upOrOpen', undefined, (data) => {
      expect(data.cluster).toBe('windowCovering');
    });
    expectLiftCoverAttributes({
      operationalStatus: { global: WindowCovering.MovementStatus.Opening, lift: WindowCovering.MovementStatus.Opening, tilt: WindowCovering.MovementStatus.Stopped },
      currentPositionLiftPercent100ths: 0,
      targetPositionLiftPercent100ths: 0,
    });

    await expectCommand(coverLift, WindowCovering.Cluster, 'downOrClose', undefined, (data) => {
      expect(data.cluster).toBe('windowCovering');
    });
    expectLiftCoverAttributes({
      operationalStatus: { global: WindowCovering.MovementStatus.Closing, lift: WindowCovering.MovementStatus.Closing, tilt: WindowCovering.MovementStatus.Stopped },
      currentPositionLiftPercent100ths: 0,
      targetPositionLiftPercent100ths: 10000,
    });

    await expectCommand(coverLift, WindowCovering.Cluster, 'stopMotion', undefined, (data) => {
      expect(data.cluster).toBe('windowCovering');
    });
    expectLiftCoverAttributes({
      operationalStatus: { global: WindowCovering.MovementStatus.Stopped, lift: WindowCovering.MovementStatus.Stopped, tilt: WindowCovering.MovementStatus.Stopped },
      currentPositionLiftPercent100ths: 0,
      targetPositionLiftPercent100ths: 0,
    });

    await expectCommand(coverLift, WindowCovering.Cluster, 'goToLiftPercentage', { liftPercent100thsValue: 5000 }, (data) => {
      expect(data.cluster).toBe('windowCovering');
    });
    expectLiftCoverAttributes({
      operationalStatus: { global: WindowCovering.MovementStatus.Closing, lift: WindowCovering.MovementStatus.Closing, tilt: WindowCovering.MovementStatus.Stopped },
      currentPositionLiftPercent100ths: 0,
      targetPositionLiftPercent100ths: 5000,
    });
  });

  test('LiftTiltWindowCovering server', async () => {
    const expectLiftTiltCoverAttributes = (expected: {
      operationalStatus: { global: number; lift: number; tilt: number };
      currentPositionLiftPercent100ths: number;
      targetPositionLiftPercent100ths: number;
      currentPositionTiltPercent100ths: number;
      targetPositionTiltPercent100ths: number;
    }) => {
      expect(coverLiftTilt.getAttribute(WindowCovering.Cluster.id, 'operationalStatus')).toEqual(expected.operationalStatus);
      expect(coverLiftTilt.getAttribute(WindowCovering.Cluster.id, 'currentPositionLiftPercent100ths')).toBe(expected.currentPositionLiftPercent100ths);
      expect(coverLiftTilt.getAttribute(WindowCovering.Cluster.id, 'targetPositionLiftPercent100ths')).toBe(expected.targetPositionLiftPercent100ths);
      expect(coverLiftTilt.getAttribute(WindowCovering.Cluster.id, 'currentPositionTiltPercent100ths')).toBe(expected.currentPositionTiltPercent100ths);
      expect(coverLiftTilt.getAttribute(WindowCovering.Cluster.id, 'targetPositionTiltPercent100ths')).toBe(expected.targetPositionTiltPercent100ths);
    };

    await expectCommand(coverLiftTilt, WindowCovering.Cluster, 'upOrOpen', undefined, (data) => {
      expect(data.cluster).toBe('windowCovering');
    });
    expectLiftTiltCoverAttributes({
      operationalStatus: { global: WindowCovering.MovementStatus.Opening, lift: WindowCovering.MovementStatus.Opening, tilt: WindowCovering.MovementStatus.Opening },
      currentPositionLiftPercent100ths: 0,
      targetPositionLiftPercent100ths: 0,
      currentPositionTiltPercent100ths: 0,
      targetPositionTiltPercent100ths: 0,
    });

    await expectCommand(coverLiftTilt, WindowCovering.Cluster, 'downOrClose', undefined, (data) => {
      expect(data.cluster).toBe('windowCovering');
    });
    expectLiftTiltCoverAttributes({
      operationalStatus: { global: WindowCovering.MovementStatus.Closing, lift: WindowCovering.MovementStatus.Closing, tilt: WindowCovering.MovementStatus.Closing },
      currentPositionLiftPercent100ths: 0,
      targetPositionLiftPercent100ths: 10000,
      currentPositionTiltPercent100ths: 0,
      targetPositionTiltPercent100ths: 10000,
    });

    await expectCommand(coverLiftTilt, WindowCovering.Cluster, 'stopMotion', undefined, (data) => {
      expect(data.cluster).toBe('windowCovering');
    });
    expectLiftTiltCoverAttributes({
      operationalStatus: { global: WindowCovering.MovementStatus.Stopped, lift: WindowCovering.MovementStatus.Stopped, tilt: WindowCovering.MovementStatus.Stopped },
      currentPositionLiftPercent100ths: 0,
      targetPositionLiftPercent100ths: 0,
      currentPositionTiltPercent100ths: 0,
      targetPositionTiltPercent100ths: 0,
    });

    await expectCommand(coverLiftTilt, WindowCovering.Cluster, 'goToLiftPercentage', { liftPercent100thsValue: 5000 }, (data) => {
      expect(data.cluster).toBe('windowCovering');
    });
    expectLiftTiltCoverAttributes({
      operationalStatus: { global: WindowCovering.MovementStatus.Closing, lift: WindowCovering.MovementStatus.Closing, tilt: WindowCovering.MovementStatus.Stopped },
      currentPositionLiftPercent100ths: 0,
      targetPositionLiftPercent100ths: 5000,
      currentPositionTiltPercent100ths: 0,
      targetPositionTiltPercent100ths: 0,
    });

    await expectCommand(coverLiftTilt, WindowCovering.Cluster, 'goToTiltPercentage', { tiltPercent100thsValue: 5000 }, (data) => {
      expect(data.cluster).toBe('windowCovering');
    });
    expectLiftTiltCoverAttributes({
      operationalStatus: { global: WindowCovering.MovementStatus.Closing, lift: WindowCovering.MovementStatus.Closing, tilt: WindowCovering.MovementStatus.Closing },
      currentPositionLiftPercent100ths: 0,
      targetPositionLiftPercent100ths: 5000,
      currentPositionTiltPercent100ths: 0,
      targetPositionTiltPercent100ths: 5000,
    });
  });

  test('DoorLock server', async () => {
    expect(lock.getCluster(DoorLock.Cluster)?.lockState).toBe(DoorLock.LockState.Locked);

    await expectCommand(lock, DoorLock.Cluster, 'unlockDoor', undefined, (data) => {
      expect(data.cluster).toBe('doorLock');
    });
    expect(lock.getCluster(DoorLock.Cluster)?.lockState).toBe(DoorLock.LockState.Unlocked);

    await expectCommand(lock, DoorLock.Cluster, 'lockDoor', undefined, (data) => {
      expect(data.cluster).toBe('doorLock');
    });
    expect(lock.getCluster(DoorLock.Cluster)?.lockState).toBe(DoorLock.LockState.Locked);
  });

  test('FanControl server', async () => {
    const stepCalls: Array<{ cluster: string; endpoint: MatterbridgeEndpoint; request: Record<string, unknown> }> = [];
    fan.addCommandHandler('step', async (data) => {
      stepCalls.push({ cluster: data.cluster, endpoint: data.endpoint, request: data.request });
    });

    expect(fan.getAttribute(FanControl.Cluster.id, 'percentCurrent')).toBe(0);

    await fan.invokeBehaviorCommand('fanControl', 'step', { direction: FanControl.StepDirection.Increase, wrap: false, lowestOff: false });
    expect(stepCalls[0]).toEqual({ cluster: 'fanControl', endpoint: fan, request: { direction: FanControl.StepDirection.Increase, wrap: false, lowestOff: false } });
    expect(fan.getAttribute(FanControl.Cluster.id, 'percentCurrent')).toBe(10);

    await fan.setAttribute(FanControl.Cluster.id, 'percentCurrent', 100);
    await fan.invokeBehaviorCommand('fanControl', 'step', { direction: FanControl.StepDirection.Increase, wrap: true, lowestOff: false });
    expect(stepCalls[1]).toEqual({ cluster: 'fanControl', endpoint: fan, request: { direction: FanControl.StepDirection.Increase, wrap: true, lowestOff: false } });
    expect(fan.getAttribute(FanControl.Cluster.id, 'percentCurrent')).toBe(10);

    await fan.setAttribute(FanControl.Cluster.id, 'percentCurrent', 100);
    await fan.invokeBehaviorCommand('fanControl', 'step', { direction: FanControl.StepDirection.Increase, wrap: true, lowestOff: true });
    expect(stepCalls[2]).toEqual({ cluster: 'fanControl', endpoint: fan, request: { direction: FanControl.StepDirection.Increase, wrap: true, lowestOff: true } });
    expect(fan.getAttribute(FanControl.Cluster.id, 'percentCurrent')).toBe(0);

    await fan.setAttribute(FanControl.Cluster.id, 'percentCurrent', 20);

    await fan.invokeBehaviorCommand('fanControl', 'step', { direction: FanControl.StepDirection.Decrease, wrap: false, lowestOff: false });
    expect(stepCalls[3]).toEqual({ cluster: 'fanControl', endpoint: fan, request: { direction: FanControl.StepDirection.Decrease, wrap: false, lowestOff: false } });
    expect(fan.getAttribute(FanControl.Cluster.id, 'percentCurrent')).toBe(10);

    await fan.invokeBehaviorCommand('fanControl', 'step', { direction: FanControl.StepDirection.Decrease, wrap: true, lowestOff: false });
    expect(stepCalls[4]).toEqual({ cluster: 'fanControl', endpoint: fan, request: { direction: FanControl.StepDirection.Decrease, wrap: true, lowestOff: false } });
    expect(fan.getAttribute(FanControl.Cluster.id, 'percentCurrent')).toBe(100);

    await fan.setAttribute(FanControl.Cluster.id, 'percentCurrent', 0);

    await fan.invokeBehaviorCommand('fanControl', 'step', { direction: FanControl.StepDirection.Decrease, wrap: true, lowestOff: true });
    expect(stepCalls[5]).toEqual({ cluster: 'fanControl', endpoint: fan, request: { direction: FanControl.StepDirection.Decrease, wrap: true, lowestOff: true } });
    expect(fan.getAttribute(FanControl.Cluster.id, 'percentCurrent')).toBe(100);

    await fan.setAttribute(FanControl.Cluster.id, 'percentCurrent', 20);

    await fan.invokeBehaviorCommand('fanControl', 'step', { direction: FanControl.StepDirection.Decrease, wrap: false, lowestOff: true });
    expect(stepCalls[6]).toEqual({ cluster: 'fanControl', endpoint: fan, request: { direction: FanControl.StepDirection.Decrease, wrap: false, lowestOff: true } });
    expect(fan.getAttribute(FanControl.Cluster.id, 'percentCurrent')).toBe(10);

    await fan.setAttribute(FanControl.Cluster.id, 'percentCurrent', 30);

    await fan.invokeBehaviorCommand('fanControl', 'step', { direction: 99 as FanControl.StepDirection, wrap: false, lowestOff: false });
    expect(stepCalls[7]).toEqual({ cluster: 'fanControl', endpoint: fan, request: { direction: 99, wrap: false, lowestOff: false } });
    expect(fan.getAttribute(FanControl.Cluster.id, 'percentCurrent')).toBe(30);
  });

  test('Thermostat server', async () => {
    const setBothRequest = { mode: Thermostat.SetpointRaiseLowerMode.Both, amount: 5 };
    const setHeatRequest = { mode: Thermostat.SetpointRaiseLowerMode.Heat, amount: 5 };
    const setCoolRequest = { mode: Thermostat.SetpointRaiseLowerMode.Cool, amount: 5 };
    const initialThermostatCluster = thermostat.getCluster(MatterbridgeThermostatServer);

    expect(initialThermostatCluster).toMatchObject({ occupiedHeatingSetpoint: 2100, occupiedCoolingSetpoint: 2500 });
    expect((thermostat.stateOf(MatterbridgeThermostatServer) as any).acceptedCommandList).toEqual([0]);
    expect((thermostat.stateOf(MatterbridgeThermostatServer) as any).generatedCommandList).toEqual([]);

    await expectCommand(thermostat, Thermostat.Cluster, 'setpointRaiseLower', setBothRequest, (data) => {
      expect(data.cluster).toBe('thermostat');
    });

    let updatedThermostatCluster = thermostat.getCluster(MatterbridgeThermostatServer);

    expect(updatedThermostatCluster).toMatchObject({ occupiedHeatingSetpoint: 2150, occupiedCoolingSetpoint: 2550 });

    await thermostat.invokeBehaviorCommand('Thermostat', 'setpointRaiseLower', setHeatRequest);
    updatedThermostatCluster = thermostat.getCluster(MatterbridgeThermostatServer);

    expect(updatedThermostatCluster).toMatchObject({ occupiedHeatingSetpoint: 2200, occupiedCoolingSetpoint: 2550 });

    await thermostat.invokeBehaviorCommand('Thermostat', 'setpointRaiseLower', setCoolRequest);

    updatedThermostatCluster = thermostat.getCluster(MatterbridgeThermostatServer);

    expect(updatedThermostatCluster).toMatchObject({ occupiedHeatingSetpoint: 2200, occupiedCoolingSetpoint: 2600 });
  });

  // eslint-disable-next-line jest/no-commented-out-tests
  /*
  test('Thermostat server ignores undefined occupied setpoints', async () => {
    const executeHandler = jest.fn();
    const info = jest.fn();
    const debug = jest.fn();
    const thermostatState = { occupiedHeatingSetpoint: undefined, occupiedCoolingSetpoint: undefined };
    const endpoint = {
      maybeId: 'thermostatUndefinedSetpoints',
      maybeNumber: 1,
      stateOf: () => ({ log: { info, debug }, commandHandler: { executeHandler } }),
    };
    const thermostatServer = { state: thermostatState, endpoint } as unknown as MatterbridgeThermostatServer;

    await MatterbridgeThermostatServer.prototype.setpointRaiseLower.call(thermostatServer, { mode: Thermostat.SetpointRaiseLowerMode.Both, amount: 5 });

    expect(executeHandler).toHaveBeenCalledWith('Thermostat.setpointRaiseLower', {
      request: { mode: Thermostat.SetpointRaiseLowerMode.Both, amount: 5 },
      cluster: 'thermostat',
      attributes: thermostatState,
      endpoint,
    });
    expect(info).toHaveBeenCalled();
    expect(debug).toHaveBeenCalledWith('MatterbridgeThermostatServer: setpointRaiseLower called with mode: Both amount: 0.5');
    expect(thermostatState.occupiedHeatingSetpoint).toBeUndefined();
    expect(thermostatState.occupiedCoolingSetpoint).toBeUndefined();
  });
  */

  test('PresetThermostat server', async () => {
    thermostatPreset = createPresetThermostatEndpoint('thermostatPresetBehavior');
    expect(await addDevice(aggregator, thermostatPreset)).toBeTruthy();

    const formatPresetHandleForLog = (presetHandle: Uint8Array | null) => (presetHandle ? `0x${Buffer.from(presetHandle).toString('hex')}` : 'null');
    const setHeatRequest = { mode: Thermostat.SetpointRaiseLowerMode.Heat, amount: 5 };
    const setCoolRequest = { mode: Thermostat.SetpointRaiseLowerMode.Cool, amount: 5 };
    const firstPresetRequest = { presetHandle: Uint8Array.from([0]) };
    const secondPresetRequest = { presetHandle: Uint8Array.from([1]) };
    const clearPresetRequest = { presetHandle: null };
    const invalidPresetRequest = { presetHandle: Uint8Array.from([9]) };
    const presetThermostatBehavior = MatterbridgePresetThermostatServer.with(
      Thermostat.Feature.Heating,
      Thermostat.Feature.Cooling,
      Thermostat.Feature.AutoMode,
      Thermostat.Feature.Presets,
    );
    const presetCalls: Array<{ cluster: string; endpoint: MatterbridgeEndpoint; request: Record<string, unknown> }> = [];

    thermostatPreset.addCommandHandler('setActivePresetRequest', async (data) => {
      presetCalls.push({ cluster: data.cluster, endpoint: data.endpoint, request: data.request });
    });

    const expectPresetThermostatAttributes = (activePresetHandle: Uint8Array | null, occupiedHeatingSetpoint: number = 2100, occupiedCoolingSetpoint: number = 2500) => {
      const presetThermostatCluster = thermostatPreset.getCluster(presetThermostatBehavior);

      expect(presetThermostatCluster).toMatchObject({
        localTemperature: 2300,
        systemMode: Thermostat.SystemMode.Auto,
        occupiedHeatingSetpoint,
        occupiedCoolingSetpoint,
        numberOfPresets: 10,
      });
      expect(presetThermostatCluster?.activePresetHandle === null ? null : JSON.stringify(Object.values(presetThermostatCluster?.activePresetHandle ?? {}))).toBe(
        activePresetHandle === null ? null : JSON.stringify(Array.from(activePresetHandle)),
      );
      expect(presetThermostatCluster?.presets).toHaveLength(2);
      expect(presetThermostatCluster?.presets?.[0]).toMatchObject({
        presetScenario: Thermostat.PresetScenario.Occupied,
        name: 'Occupied',
        coolingSetpoint: 2500,
        heatingSetpoint: 2100,
        builtIn: true,
      });
      expect(JSON.stringify(Object.values(presetThermostatCluster?.presets?.[0]?.presetHandle ?? {}))).toBe(JSON.stringify([0]));
      expect(presetThermostatCluster?.presets?.[1]).toMatchObject({
        presetScenario: Thermostat.PresetScenario.Unoccupied,
        name: 'Unoccupied',
        coolingSetpoint: 2700,
        heatingSetpoint: 1900,
        builtIn: true,
      });
      expect(JSON.stringify(Object.values(presetThermostatCluster?.presets?.[1]?.presetHandle ?? {}))).toBe(JSON.stringify([1]));
      expect(presetThermostatCluster?.presetTypes).toHaveLength(2);
      expect(presetThermostatCluster?.presetTypes?.[0]).toMatchObject({
        presetScenario: Thermostat.PresetScenario.Occupied,
        numberOfPresets: 2,
        presetTypeFeatures: { automatic: false, supportsNames: true },
      });
      expect(presetThermostatCluster?.presetTypes?.[1]).toMatchObject({
        presetScenario: Thermostat.PresetScenario.Unoccupied,
        numberOfPresets: 2,
        presetTypeFeatures: { automatic: false, supportsNames: true },
      });
    };

    expectPresetThermostatAttributes(Uint8Array.from([0]));

    await expectCommand(thermostatPreset, Thermostat.Cluster, 'setpointRaiseLower', setHeatRequest, (data) => {
      expect(data.cluster).toBe('thermostat');
    });

    expectPresetThermostatAttributes(null, 2150, 2500);

    await thermostatPreset.invokeBehaviorCommand('Thermostat', 'setpointRaiseLower', setCoolRequest);

    expectPresetThermostatAttributes(null, 2150, 2550);

    await thermostatPreset.invokeBehaviorCommand('Thermostat', 'setActivePresetRequest', firstPresetRequest);

    expect(presetCalls[0]).toEqual({ cluster: 'thermostat', endpoint: thermostatPreset, request: firstPresetRequest });
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `Setting preset to ${formatPresetHandleForLog(firstPresetRequest.presetHandle)} (endpoint ${thermostatPreset.id}.${thermostatPreset.number})`,
    );
    expectPresetThermostatAttributes(null, 2100, 2500);

    await thermostatPreset.invokeBehaviorCommand('Thermostat', 'setActivePresetRequest', secondPresetRequest);
    expect(presetCalls[1]).toEqual({ cluster: 'thermostat', endpoint: thermostatPreset, request: secondPresetRequest });
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `Setting preset to ${formatPresetHandleForLog(secondPresetRequest.presetHandle)} (endpoint ${thermostatPreset.id}.${thermostatPreset.number})`,
    );
    expectPresetThermostatAttributes(null, 1900, 2700);

    await thermostatPreset.invokeBehaviorCommand('Thermostat', 'setActivePresetRequest', clearPresetRequest);
    expect(presetCalls[2]).toEqual({ cluster: 'thermostat', endpoint: thermostatPreset, request: clearPresetRequest });
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `Setting preset to ${formatPresetHandleForLog(clearPresetRequest.presetHandle)} (endpoint ${thermostatPreset.id}.${thermostatPreset.number})`,
    );
    expectPresetThermostatAttributes(null, 1900, 2700);

    await expect(thermostatPreset.invokeBehaviorCommand('Thermostat', 'setActivePresetRequest', invalidPresetRequest)).rejects.toThrow('Requested PresetHandle not found');
    expect(presetCalls[3]).toEqual({ cluster: 'thermostat', endpoint: thermostatPreset, request: invalidPresetRequest });
    expect(presetCalls).toHaveLength(4);
    expectPresetThermostatAttributes(null, 1900, 2700);
  });

  test('ValveConfigurationAndControl server', async () => {
    const expectValveAttributes = (expected: {
      currentState: number;
      targetState: number;
      currentLevel: number;
      targetLevel: number;
      openDuration: number | null;
      remainingDuration: number | null;
    }) => {
      expect(valve.getAttribute(ValveConfigurationAndControl.Cluster.id, 'currentState')).toBe(expected.currentState);
      expect(valve.getAttribute(ValveConfigurationAndControl.Cluster.id, 'targetState')).toBe(expected.targetState);
      expect(valve.getAttribute(ValveConfigurationAndControl.Cluster.id, 'currentLevel')).toBe(expected.currentLevel);
      expect(valve.getAttribute(ValveConfigurationAndControl.Cluster.id, 'targetLevel')).toBe(expected.targetLevel);
      expect(valve.getAttribute(ValveConfigurationAndControl.Cluster.id, 'openDuration')).toBe(expected.openDuration);
      expect(valve.getAttribute(ValveConfigurationAndControl.Cluster.id, 'remainingDuration')).toBe(expected.remainingDuration);
    };

    expectValveAttributes({
      currentState: ValveConfigurationAndControl.ValveState.Closed,
      targetState: ValveConfigurationAndControl.ValveState.Closed,
      currentLevel: 0,
      targetLevel: 0,
      openDuration: null,
      remainingDuration: null,
    });

    const openRequest = { targetLevel: 50, openDuration: 60 };
    await expectCommand(valve, ValveConfigurationAndControl.Cluster, 'open', openRequest, (data) => {
      expect(data.cluster).toBe('valveConfigurationAndControl');
    });
    expectValveAttributes({
      currentState: ValveConfigurationAndControl.ValveState.Open,
      targetState: ValveConfigurationAndControl.ValveState.Open,
      currentLevel: 50,
      targetLevel: 50,
      openDuration: 60,
      remainingDuration: null,
    });

    await valve.setAttribute(ValveConfigurationAndControl.Cluster.id, 'defaultOpenDuration', null);
    await valve.invokeBehaviorCommand(ValveConfigurationAndControl.Cluster, 'open', {});
    expectValveAttributes({
      currentState: ValveConfigurationAndControl.ValveState.Open,
      targetState: ValveConfigurationAndControl.ValveState.Open,
      currentLevel: 100,
      targetLevel: 100,
      openDuration: null,
      remainingDuration: null,
    });

    await expectCommand(valve, ValveConfigurationAndControl.Cluster, 'close', undefined, (data) => {
      expect(data.cluster).toBe('valveConfigurationAndControl');
    });
    expectValveAttributes({
      currentState: ValveConfigurationAndControl.ValveState.Closed,
      targetState: ValveConfigurationAndControl.ValveState.Closed,
      currentLevel: 0,
      targetLevel: 0,
      openDuration: null,
      remainingDuration: null,
    });
  });

  test('SmokeCoAlarm server', async () => {
    expect(smoke.getAttribute(SmokeCoAlarm.Cluster.id, 'smokeState')).toBe(SmokeCoAlarm.AlarmState.Normal);
    expect(smoke.getAttribute(SmokeCoAlarm.Cluster.id, 'coState')).toBe(SmokeCoAlarm.AlarmState.Normal);

    await expectCommand(smoke, SmokeCoAlarm.Cluster, 'selfTestRequest', undefined, (data) => {
      expect(data.cluster).toBe('smokeCoAlarm');
    });

    expect(smoke.getAttribute(SmokeCoAlarm.Cluster.id, 'smokeState')).toBe(SmokeCoAlarm.AlarmState.Normal);
    expect(smoke.getAttribute(SmokeCoAlarm.Cluster.id, 'coState')).toBe(SmokeCoAlarm.AlarmState.Normal);
  });

  test('BooleanStateConfiguration server', async () => {
    const enableDisableAlarmRequest = { alarmsToEnableDisable: { audible: true, visual: true } };

    expect(contact.getAttribute(BooleanStateConfiguration.Cluster.id, 'alarmsActive')).toEqual({ visual: false, audible: false });
    expect(contact.getAttribute(BooleanStateConfiguration.Cluster.id, 'alarmsEnabled')).toEqual({ visual: true, audible: true });
    expect(contact.getAttribute(BooleanStateConfiguration.Cluster.id, 'alarmsSupported')).toEqual({ visual: true, audible: true });

    await expectCommand(contact, BooleanStateConfiguration.Cluster, 'enableDisableAlarm', enableDisableAlarmRequest, (data) => {
      expect(data.cluster).toBe('booleanStateConfiguration');
    });

    expect(contact.getAttribute(BooleanStateConfiguration.Cluster.id, 'alarmsActive')).toEqual({ visual: false, audible: false });
    expect(contact.getAttribute(BooleanStateConfiguration.Cluster.id, 'alarmsEnabled')).toEqual({ visual: true, audible: true });
    expect(contact.getAttribute(BooleanStateConfiguration.Cluster.id, 'alarmsSupported')).toEqual({ visual: true, audible: true });
  });

  test('ModeSelect server', async () => {
    expect(mode.getAttribute(ModeSelect.Cluster.id, 'currentMode')).toBe(0);

    await expectCommand(mode, ModeSelect.Cluster, 'changeToMode', { newMode: 1 }, (data) => {
      expect(data.cluster).toBe('modeSelect');
    });

    expect(mode.getAttribute(ModeSelect.Cluster.id, 'currentMode')).toBe(1);
  });

  test('HepaFilterMonitoring server', async () => {
    expect(purifier.getAttribute(HepaFilterMonitoring.Cluster.id, 'condition')).toBe(40);
    expect(purifier.getAttribute(HepaFilterMonitoring.Cluster.id, 'lastChangedTime')).toBeNull();

    await purifier.invokeBehaviorCommand(HepaFilterMonitoring.Cluster, 'resetCondition');

    expect(purifier.getAttribute(HepaFilterMonitoring.Cluster.id, 'condition')).toBe(100);
    expect(typeof purifier.getAttribute(HepaFilterMonitoring.Cluster.id, 'lastChangedTime')).toBe('number');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'MatterbridgeHepaFilterMonitoringServer: resetCondition called');
  });

  test('ActivatedCarbonFilterMonitoring server', async () => {
    expect(purifier.getAttribute(ActivatedCarbonFilterMonitoring.Cluster.id, 'condition')).toBe(30);
    expect(purifier.getAttribute(ActivatedCarbonFilterMonitoring.Cluster.id, 'lastChangedTime')).toBeNull();

    await purifier.invokeBehaviorCommand(ActivatedCarbonFilterMonitoring.Cluster, 'resetCondition');

    expect(purifier.getAttribute(ActivatedCarbonFilterMonitoring.Cluster.id, 'condition')).toBe(100);
    expect(typeof purifier.getAttribute(ActivatedCarbonFilterMonitoring.Cluster.id, 'lastChangedTime')).toBe('number');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'MatterbridgeActivatedCarbonFilterMonitoringServer: resetCondition called');
  });

  test('DeviceEnergyManagement server', async () => {
    const powerAdjustRequest = { power: 500, duration: 60, cause: 'Test' };
    const cancelCalls: Array<{ cluster: string; endpoint: MatterbridgeEndpoint; request: unknown }> = [];

    energyManagement.addCommandHandler('cancelPowerAdjustRequest', async (data) => {
      cancelCalls.push({ cluster: data.cluster, endpoint: data.endpoint, request: data.request });
    });

    expect(energyManagement.getAttribute(DeviceEnergyManagement.Cluster.id, 'esaType')).toBe(DeviceEnergyManagement.EsaType.Other);
    expect(energyManagement.getAttribute(DeviceEnergyManagement.Cluster.id, 'esaState')).toBe(DeviceEnergyManagement.EsaState.Online);
    expect(energyManagement.getAttribute(DeviceEnergyManagement.Cluster.id, 'absMinPower')).toBe(-3000);
    expect(energyManagement.getAttribute(DeviceEnergyManagement.Cluster.id, 'absMaxPower')).toBe(2000);
    expect(energyManagement.getAttribute(DeviceEnergyManagement.Cluster.id, 'optOutState')).toBe(DeviceEnergyManagement.OptOutState.NoOptOut);

    await expectCommand(energyManagement, DeviceEnergyManagement.Cluster, 'powerAdjustRequest', powerAdjustRequest, (data) => {
      expect(data.cluster).toBe('deviceEnergyManagement');
    });
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.DEBUG,
      `MatterbridgeDeviceEnergyManagementServer powerAdjustRequest called with power ${powerAdjustRequest.power} duration ${powerAdjustRequest.duration} cause ${powerAdjustRequest.cause}`,
    );

    await energyManagement.invokeBehaviorCommand('deviceEnergyManagement', 'cancelPowerAdjustRequest');
    expect(cancelCalls[0]).toEqual({ cluster: 'deviceEnergyManagement', endpoint: energyManagement, request: {} });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'MatterbridgeDeviceEnergyManagementServer cancelPowerAdjustRequest called');
    expect(energyManagement.getAttribute(DeviceEnergyManagement.Cluster.id, 'optOutState')).toBe(DeviceEnergyManagement.OptOutState.NoOptOut);
  });

  test('DeviceEnergyManagementMode server', async () => {
    const modeCalls: Array<{ cluster: string; endpoint: MatterbridgeEndpoint; request: Record<string, unknown> }> = [];
    energyManagement.addCommandHandler('changeToMode', async (data) => {
      modeCalls.push({ cluster: data.cluster, endpoint: data.endpoint, request: data.request });
    });

    expect(energyManagement.getAttribute(DeviceEnergyManagementMode.Cluster.id, 'currentMode')).toBe(1);
    expect(energyManagement.getAttribute(DeviceEnergyManagementMode.Cluster.id, 'supportedModes')).toHaveLength(5);

    await energyManagement.invokeBehaviorCommand(DeviceEnergyManagementMode.Cluster, 'changeToMode', { newMode: 0 });
    expect(modeCalls[0]).toEqual({ cluster: 'deviceEnergyManagementMode', endpoint: energyManagement, request: { newMode: 0 } });
    expect(energyManagement.getAttribute(DeviceEnergyManagementMode.Cluster.id, 'currentMode')).toBe(1);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, 'MatterbridgeDeviceEnergyManagementModeServer changeToMode called with unsupported newMode: 0');

    await energyManagement.invokeBehaviorCommand(DeviceEnergyManagementMode.Cluster, 'changeToMode', { newMode: 1 });
    expect(modeCalls[1]).toEqual({ cluster: 'deviceEnergyManagementMode', endpoint: energyManagement, request: { newMode: 1 } });
    expect(energyManagement.getAttribute(DeviceEnergyManagementMode.Cluster.id, 'currentMode')).toBe(1);
    expect(energyManagement.getAttribute(DeviceEnergyManagement.Cluster.id, 'optOutState')).toBe(DeviceEnergyManagement.OptOutState.OptOut);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.DEBUG,
      'MatterbridgeDeviceEnergyManagementModeServer changeToMode called with newMode 1 => No Energy Management (Forecast reporting only)',
    );

    await energyManagement.invokeBehaviorCommand(DeviceEnergyManagementMode.Cluster, 'changeToMode', { newMode: 5 });
    expect(modeCalls[2]).toEqual({ cluster: 'deviceEnergyManagementMode', endpoint: energyManagement, request: { newMode: 5 } });
    expect(energyManagement.getAttribute(DeviceEnergyManagementMode.Cluster.id, 'currentMode')).toBe(5);
    expect(energyManagement.getAttribute(DeviceEnergyManagement.Cluster.id, 'optOutState')).toBe(DeviceEnergyManagement.OptOutState.NoOptOut);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'MatterbridgeDeviceEnergyManagementModeServer changeToMode called with newMode 5 => Full Energy Management');

    const originalHas = energyManagement.behaviors.has.bind(energyManagement.behaviors);
    const hasSpy = jest.spyOn(energyManagement.behaviors, 'has');
    hasSpy.mockImplementation((behavior: any) => {
      if (behavior === (DeviceEnergyManagementServer as any)) return false;
      return originalHas(behavior);
    });

    await energyManagement.setAttribute(DeviceEnergyManagement.Cluster.id, 'optOutState', DeviceEnergyManagement.OptOutState.NoOptOut);
    await energyManagement.invokeBehaviorCommand(DeviceEnergyManagementMode.Cluster, 'changeToMode', { newMode: 1 });
    expect(energyManagement.getAttribute(DeviceEnergyManagement.Cluster.id, 'optOutState')).toBe(DeviceEnergyManagement.OptOutState.NoOptOut);

    await energyManagement.invokeBehaviorCommand(DeviceEnergyManagementMode.Cluster, 'changeToMode', { newMode: 5 });
    expect(energyManagement.getAttribute(DeviceEnergyManagement.Cluster.id, 'optOutState')).toBe(DeviceEnergyManagement.OptOutState.NoOptOut);

    hasSpy.mockRestore();
  });

  test('OperationalState server', async () => {
    const expectOperationalStateAttributes = (expectedState: number) => {
      expect(washer.getAttribute(OperationalState.Cluster.id, 'operationalState')).toBe(expectedState);
      expect(washer.getAttribute(OperationalState.Cluster.id, 'operationalError')).toEqual({
        errorStateId: OperationalState.ErrorState.NoError,
        errorStateDetails: 'Fully operational',
      });
    };

    expectOperationalStateAttributes(OperationalState.OperationalStateEnum.Stopped);

    await expectCommand(washer, OperationalState.Cluster, 'start', undefined, (data) => {
      expect(data.cluster).toBe('operationalState');
    });
    expectOperationalStateAttributes(OperationalState.OperationalStateEnum.Running);

    await expectCommand(washer, OperationalState.Cluster, 'pause', undefined, (data) => {
      expect(data.cluster).toBe('operationalState');
    });
    expectOperationalStateAttributes(OperationalState.OperationalStateEnum.Paused);

    await expectCommand(washer, OperationalState.Cluster, 'resume', undefined, (data) => {
      expect(data.cluster).toBe('operationalState');
    });
    expectOperationalStateAttributes(OperationalState.OperationalStateEnum.Running);

    await expectCommand(washer, OperationalState.Cluster, 'stop', undefined, (data) => {
      expect(data.cluster).toBe('operationalState');
    });
    expectOperationalStateAttributes(OperationalState.OperationalStateEnum.Stopped);
  });

  test('ServiceArea server', async () => {
    expect(rvc.getAttribute(ServiceArea.Cluster.id, 'selectedAreas')).toEqual([]);
    expect(rvc.getAttribute(ServiceArea.Cluster.id, 'currentArea')).toBe(1);
    expect(rvc.getAttribute(ServiceArea.Cluster.id, 'supportedAreas')).toHaveLength(4);

    await expectCommand(rvc, ServiceArea.Cluster, 'selectAreas', { newAreas: [1, 2] }, (data) => {
      expect(data.cluster).toBe('serviceArea');
    });
    expect(rvc.getAttribute(ServiceArea.Cluster.id, 'selectedAreas')).toEqual([1, 2]);

    await rvc.invokeBehaviorCommand(ServiceArea.Cluster, 'selectAreas', { newAreas: [0, 5] });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, 'MatterbridgeServiceAreaServer selectAreas called with unsupported area: 0');
    expect(rvc.getAttribute(ServiceArea.Cluster.id, 'selectedAreas')).toEqual([1, 2]);
  });
});
