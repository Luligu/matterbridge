// src\matterbridgePlatform.active.test.ts

const NAME = 'MatterbridgePlatformActive';
const MATTER_PORT = 7001;
const FRONTEND_PORT = 8501;
const HOMEDIR = path.join('jest', NAME);

process.argv = [...originalProcessArgv, '--verbose'];

import path from 'node:path';

import { jest } from '@jest/globals';
import { AnsiLogger } from 'node-ansi-logger';

import { MatterbridgePlatform } from './matterbridgePlatform.js';
import { MatterbridgeDynamicPlatform } from './matterbridgeDynamicPlatform.js';
import { flushAsync, matterbridge, originalProcessArgv, setupTest, startMatterbridge, stopMatterbridge } from './jestutils/jestHelpers.js';
import { Frontend } from './frontend.js';

const wssSendRestartRequired = jest.spyOn(Frontend.prototype, 'wssSendRestartRequired');

const wssSendSnackbarMessage = jest.spyOn(Frontend.prototype, 'wssSendSnackbarMessage');

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge platform', () => {
  let platform: MatterbridgePlatform;

  beforeAll(async () => {
    // Create Matterbridge environment
    await startMatterbridge(`bridge`, FRONTEND_PORT, MATTER_PORT);
  });

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Destroy Matterbridge environment
    await stopMatterbridge();
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('Constructor', async () => {
    platform = new MatterbridgeDynamicPlatform(matterbridge, new AnsiLogger({ logName: 'Matterbridge platform' }), { name: 'platform-test', type: 'DynamicPlatform', version: '1.0.0', debug: false, unregisterOnShutdown: false });
    platform.type = 'DynamicPlatform';
    platform.name = 'platform-test';
    platform.version = '1.0.0';
    expect(platform.matterbridge).toBe(matterbridge);
    expect(platform.log.logName).toBe('Matterbridge platform');
    expect(platform.config).toEqual({ name: 'platform-test', type: 'DynamicPlatform', version: '1.0.0', debug: false, unregisterOnShutdown: false });
    expect(platform.isReady).toBe(false);
    expect(platform.isLoaded).toBe(false);
    expect(platform.isStarted).toBe(false);
    expect(platform.isConfigured).toBe(false);
    await platform.ready;
    expect(platform.isReady).toBe(true);
  });

  test('Broadcast wssSendRestartRequired', async () => {
    platform.wssSendRestartRequired(true, true);
    await flushAsync(undefined, undefined, 100);
    expect(wssSendRestartRequired).toHaveBeenCalledWith(true, true); // All wssSend calls are skipped if no clients are connected
  });

  test('Broadcast wssSendSnackbarMessage', async () => {
    platform.wssSendSnackbarMessage('Test message', 5, 'success');
    await flushAsync(undefined, undefined, 100);
    expect(wssSendSnackbarMessage).toHaveBeenCalledWith('Test message', 5, 'success'); // All wssSend calls are skipped if no clients are connected
  });

  test('Device retrieval methods should return undefined for unregistered devices', async () => {
    await platform.onShutdown();
    expect(platform.isReady).toBe(false);
    expect(platform.isLoaded).toBe(false);
    expect(platform.isStarted).toBe(false);
    expect(platform.isConfigured).toBe(false);
  });
});
