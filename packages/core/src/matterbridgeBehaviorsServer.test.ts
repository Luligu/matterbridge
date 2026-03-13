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
import { bridge, extendedColorLight, powerSource } from './matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import type { MatterbridgeEndpointCommands } from './matterbridgeEndpointTypes.js';

jest.spyOn(Matterbridge.prototype as any, 'backupMatterStorage').mockImplementation(async () => {
  return Promise.resolve();
});

// Setup the test environment
await setupTest(NAME, true);

describe('Server clusters and behaviors', () => {
  let light: MatterbridgeEndpoint;

  async function expectCommand(cluster: any, command: keyof MatterbridgeEndpointCommands, expectedRequest?: Record<string, unknown>, check?: (data: any) => void) {
    let invoke: Promise<void>;

    await new Promise((resolve, reject) => {
      light.addCommandHandler(command, async (data) => {
        try {
          expect(data.endpoint).toBe(light);
          if (expectedRequest === undefined) expect(data.request).toEqual({});
          else expect(data.request).toEqual(expectedRequest);
          check?.(data);
          resolve(true);
        } catch (error) {
          reject(error);
        }
      });
      invoke = expectedRequest === undefined ? light.invokeBehaviorCommand(cluster, command) : light.invokeBehaviorCommand(cluster, command, expectedRequest);
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
    expect(await addDevice(aggregator, light)).toBeTruthy();
    await light.construction.ready;
  });

  test('Identify server', async () => {
    await expectCommand(Identify.Cluster, 'identify', { identifyTime: 1 }, (data) => {
      expect(data.cluster).toBe(Identify.Cluster.name.toLowerCase());
      expect(data.attributes.identifyTime).toBe(0);
      expect(data.attributes.identifyType).toBe(Identify.IdentifyType.None);
    });
    await light.invokeBehaviorCommand(Identify.Cluster, 'identify', { identifyTime: 0 }); // Turn off identify mode

    await expectCommand(Identify.Cluster, 'triggerEffect', { effectIdentifier: Identify.EffectIdentifier.Blink, effectVariant: Identify.EffectVariant.Default }, (data) => {
      expect(data.cluster).toBe(Identify.Cluster.name.toLowerCase());
      expect(data.attributes.identifyTime).toBe(0);
      expect(data.attributes.identifyType).toBe(Identify.IdentifyType.None);
    });
  });

  test('OnOff server', async () => {
    await expectCommand(OnOff.Cluster, 'on', undefined, (data) => {
      expect(data.cluster).toBe('onOff');
      expect(data.attributes.onOff).toBe(false);
    });

    await expectCommand(OnOff.Cluster, 'off', undefined, (data) => {
      expect(data.cluster).toBe('onOff');
      expect(data.attributes.onOff).toBe(true);
    });

    await expectCommand(OnOff.Cluster, 'toggle', undefined, (data) => {
      expect(data.cluster).toBe('onOff');
      expect(data.attributes.onOff).toBe(false);
    });
  });

  test('LevelControl server', async () => {
    const moveToLevelRequest = getMoveToLevelRequest(100, 5, false);
    await expectCommand(LevelControl.Cluster, 'moveToLevel', moveToLevelRequest, (data) => {
      expect(data.cluster).toBe('levelControl');
      expect(data.attributes.currentLevel).toBe(254);
    });

    const moveToLevelWithOnOffRequest = getMoveToLevelRequest(150, 3, false);
    await expectCommand(LevelControl.Cluster, 'moveToLevelWithOnOff', moveToLevelWithOnOffRequest, (data) => {
      expect(data.cluster).toBe('levelControl');
      expect(data.attributes.currentLevel).toBe(100);
    });
  });

  test('ColorControl server', async () => {
    const moveToHueRequest = getMoveToHueRequest(180, 0, false);
    await expectCommand(ColorControl.Cluster, 'moveToHue', moveToHueRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });

    const moveToSaturationRequest = getMoveToSaturationRequest(100, 0, false);
    await expectCommand(ColorControl.Cluster, 'moveToSaturation', moveToSaturationRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });

    const moveToHueAndSaturationRequest = getMoveToHueAndSaturationRequest(180, 100, 0, false);
    await expectCommand(ColorControl.Cluster, 'moveToHueAndSaturation', moveToHueAndSaturationRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });

    const moveToColorRequest = getMoveToColorRequest(30000, 30000, 0, false);
    await expectCommand(ColorControl.Cluster, 'moveToColor', moveToColorRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });

    const moveToColorTemperatureRequest = getMoveToColorTemperatureRequest(250, 0, false);
    await expectCommand(ColorControl.Cluster, 'moveToColorTemperature', moveToColorTemperatureRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });
  });
});
