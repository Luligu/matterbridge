// src\matterbridgeDynamicPlatform.test.ts

const NAME = 'MatterbridgeDynamicPlatform';

import { jest } from '@jest/globals';

import { MatterbridgeDynamicPlatform } from './matterbridgeDynamicPlatform.js';
import { createMatterbridgeEnvironment, destroyMatterbridgeEnvironment, log, matterbridge, setupTest } from './jestutils/jestHelpers.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge dynamic platform', () => {
  beforeAll(async () => {
    // Create Matterbridge environment
    await createMatterbridgeEnvironment(NAME);
  });

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Destroy Matterbridge environment
    await destroyMatterbridgeEnvironment();
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('create a MatterbridgeDynamicPlatform', async () => {
    const platform = new MatterbridgeDynamicPlatform(matterbridge, log, { name: 'test', type: 'type', version: '1.0.0', debug: false, unregisterOnShutdown: false });
    expect(platform.type).toBe('DynamicPlatform');
    expect(platform.config.type).toBe('DynamicPlatform');
    await platform.onShutdown();
  });
});
