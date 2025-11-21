// src\matterbridgeDynamicPlatform.test.ts

const NAME = 'MatterbridgeDynamicPlatform';
const HOMEDIR = path.join('jest', NAME);

process.argv = ['node', 'matterbridge.test.js', '-novirtual', '-frontend', '0', '-homedir', HOMEDIR];

import path from 'node:path';

import { jest } from '@jest/globals';
import { AnsiLogger } from 'node-ansi-logger';

import { Matterbridge } from './matterbridge.js';
import { MatterbridgeDynamicPlatform } from './matterbridgeDynamicPlatform.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { setupTest } from './jestutils/jestHelpers.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge dynamic platform', () => {
  const matterbridge = {
    homeDirectory: HOMEDIR,
    matterbridgeDirectory: path.join(HOMEDIR, '.matterbridge'),
    matterbridgePluginDirectory: path.join(HOMEDIR, 'Matterbridge'),
    systemInformation: { ipv4Address: undefined, ipv6Address: undefined, osRelease: 'xx.xx.xx.xx.xx.xx', nodeVersion: '22.1.10' },
    matterbridgeVersion: '3.0.0',
    log: {
      fatal: jest.fn((message: string, ...parameters: any[]) => {}),
      error: jest.fn((message: string, ...parameters: any[]) => {}),
      warn: jest.fn((message: string, ...parameters: any[]) => {}),
      notice: jest.fn((message: string, ...parameters: any[]) => {}),
      info: jest.fn((message: string, ...parameters: any[]) => {}),
      debug: jest.fn((message: string, ...parameters: any[]) => {}),
    } as unknown as AnsiLogger,
    addBridgedEndpoint: jest.fn(async (pluginName: string, device: MatterbridgeEndpoint) => {}),
    removeBridgedEndpoint: jest.fn(async (pluginName: string, device: MatterbridgeEndpoint) => {}),
    removeAllBridgedEndpoints: jest.fn(async (pluginName: string) => {}),
  } as unknown as Matterbridge;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('create a MatterbridgeDynamicPlatform', async () => {
    const platform = new MatterbridgeDynamicPlatform(matterbridge, matterbridge.log, { name: 'test', type: 'type', version: '1.0.0', debug: false, unregisterOnShutdown: false });
    expect(platform.type).toBe('DynamicPlatform');
    await platform.onShutdown();
  });
});
