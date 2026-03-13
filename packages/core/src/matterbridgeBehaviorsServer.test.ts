// src\matterbridgeBehaviorsServer.test.ts

const NAME = 'MatterbridgeBehaviorsServer';
const MATTER_PORT = 11500;
const HOMEDIR = path.join('.cache', 'jest', NAME);
const MATTER_CREATE_ONLY = true;

import path from 'node:path';

import { jest } from '@jest/globals';
import { Identify } from '@matter/types/clusters/identify';

import {
  addDevice,
  aggregator,
  createMatterbridgeEnvironment,
  destroyMatterbridgeEnvironment,
  setupTest,
  startMatterbridgeEnvironment,
  stopMatterbridgeEnvironment,
} from './jestutils/jestHelpers.js';
import { Matterbridge } from './matterbridge.js';
import { extendedColorLight } from './matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';

jest.spyOn(Matterbridge.prototype as any, 'backupMatterStorage').mockImplementation(async () => {
  return Promise.resolve();
});

// Setup the test environment
await setupTest(NAME, true);

describe('Server clusters and behaviors', () => {
  let light: MatterbridgeEndpoint;

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
    light = new MatterbridgeEndpoint(extendedColorLight, { id: 'extendedColorLight' });
    light.addRequiredClusterServers();
    expect(light).toBeDefined();
    expect(await addDevice(aggregator, light)).toBeTruthy();
    await light.construction.ready;
  });

  test('Identify server', async () => {
    let invoke: Promise<void>;
    await new Promise((resolve, reject) => {
      light.addCommandHandler('identify', async (data) => {
        try {
          expect(data.request).toEqual({ identifyTime: 1 });
          expect(data.cluster).toBe(Identify.Cluster.name.toLowerCase());
          expect(data.attributes.identifyTime).toBe(0);
          expect(data.attributes.identifyType).toBe(Identify.IdentifyType.None);
          expect(data.endpoint).toBe(light);
          resolve(true);
        } catch (error) {
          reject(error);
        }
      });
      invoke = light.invokeBehaviorCommand(Identify.Cluster, 'identify', { identifyTime: 1 });
    });
    // @ts-expect-error Typescript doesn't know that the command handler will be executed before this line
    await invoke;
    await light.invokeBehaviorCommand(Identify.Cluster, 'identify', { identifyTime: 0 }); // Turn off identify mode

    await new Promise((resolve, reject) => {
      light.addCommandHandler('triggerEffect', async (data) => {
        try {
          expect(data.request).toEqual({ effectIdentifier: Identify.EffectIdentifier.Blink, effectVariant: Identify.EffectVariant.Default });
          expect(data.cluster).toBe(Identify.Cluster.name.toLowerCase());
          expect(data.attributes.identifyTime).toBe(0);
          expect(data.attributes.identifyType).toBe(Identify.IdentifyType.None);
          expect(data.endpoint).toBe(light);
          resolve(true);
        } catch (error) {
          reject(error);
        }
      });
      invoke = light.invokeBehaviorCommand(Identify.Cluster, 'triggerEffect', { effectIdentifier: Identify.EffectIdentifier.Blink, effectVariant: Identify.EffectVariant.Default });
    });
    // @ts-expect-error Typescript doesn't know that the command handler will be executed before this line
    await invoke;
  });
});
