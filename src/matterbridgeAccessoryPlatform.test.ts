// src\matterbridgeAccessoryPlatform.test.ts

const NAME = 'MatterbridgeAccessoryPlatform';

import { jest } from '@jest/globals';

import { isMatterbridgeAccessoryPlatform, MatterbridgeAccessoryPlatform } from './matterbridgeAccessoryPlatform.js';
import { createMatterbridgeEnvironment, destroyMatterbridgeEnvironment, log, matterbridge, setupTest } from './jestutils/jestHelpers.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge accessory platform', () => {
  beforeAll(async () => {
    // Create Matterbridge environment
    await createMatterbridgeEnvironment(NAME);
  });

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Destroy Matterbridge environment
    await destroyMatterbridgeEnvironment();
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('create a MatterbridgeAccessoryPlatform', async () => {
    const platform = new MatterbridgeAccessoryPlatform(matterbridge, log, { name: 'test', type: 'type', version: '1.0.0', debug: false, unregisterOnShutdown: false });
    expect(platform.type).toBe('AccessoryPlatform');
    expect(platform.config.type).toBe('AccessoryPlatform');
    expect(isMatterbridgeAccessoryPlatform(platform)).toBe(true);
    await platform.onShutdown();
  });
});
