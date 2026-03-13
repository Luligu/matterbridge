// src\matterbridgeBehaviorsServer.test.ts

const NAME = 'MatterbridgeBehaviorsServer';
const MATTER_PORT = 11500;
const HOMEDIR = path.join('.cache', 'jest', NAME);
const MATTER_CREATE_ONLY = true;

import path from 'node:path';

import { jest } from '@jest/globals';
import { ColorControl } from '@matter/types/clusters/color-control';
import { Identify } from '@matter/types/clusters/identify';
import { LevelControl } from '@matter/types/clusters/level-control';
import { OnOff } from '@matter/types/clusters/on-off';

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
  setupTest,
  startMatterbridgeEnvironment,
  stopMatterbridgeEnvironment,
} from './jestutils/jestHelpers.js';
import { Matterbridge } from './matterbridge.js';
import { bridge, extendedColorLight, lightSensor, occupancySensor, onOffLight, powerSource, temperatureSensor } from './matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import type { MatterbridgeEndpointCommands } from './matterbridgeEndpointTypes.js';

jest.spyOn(Matterbridge.prototype as any, 'backupMatterStorage').mockImplementation(async () => {
  return Promise.resolve();
});

// Setup the test environment
await setupTest(NAME, true);

describe('Server clusters and behaviors', () => {
  let light: MatterbridgeEndpoint;
  let enhancedLight: MatterbridgeEndpoint;

  async function expectCommand(
    endpoint: MatterbridgeEndpoint,
    cluster: any,
    command: keyof MatterbridgeEndpointCommands,
    expectedRequest?: Record<string, unknown>,
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
});
