// src\matterbridgeDynamicPlatform.test.ts

const NAME = 'MatterbridgeDynamicPlatform';

import { jest } from '@jest/globals';

import { createMatterbridgeEnvironment, destroyMatterbridgeEnvironment, matterbridge } from './jestutils/jestMatterbridgeTest.js';
import { log, setupTest } from './jestutils/jestSetupTest.js';
import { isMatterbridgeDynamicPlatform, MatterbridgeDynamicPlatform } from './matterbridgeDynamicPlatform.js';

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
    const brand = Object.getOwnPropertySymbols(platform).find((symbol) => symbol.description === 'MatterbridgeDynamicPlatform.brand');

    expect(platform.type).toBe('DynamicPlatform');
    expect(platform.config.type).toBe('DynamicPlatform');
    expect(isMatterbridgeDynamicPlatform(platform)).toBe(true);
    expect(isMatterbridgeDynamicPlatform(undefined)).toBe(false);
    expect(isMatterbridgeDynamicPlatform(null)).toBe(false);
    expect(isMatterbridgeDynamicPlatform('string')).toBe(false);

    const instanceWithoutBrand = Object.create(MatterbridgeDynamicPlatform.prototype) as MatterbridgeDynamicPlatform;
    Object.assign(instanceWithoutBrand, { name: 'missing-brand', type: 'DynamicPlatform', version: '1.0.0', config: {} });
    expect(isMatterbridgeDynamicPlatform(instanceWithoutBrand)).toBe(false);

    expect(brand).toBeDefined();
    if (!brand) throw new Error('MatterbridgeDynamicPlatform brand symbol not found');

    const brandedWithoutInstance = {
      name: 'fake',
      type: 'DynamicPlatform',
      version: '1.0.0',
      config: {},
      [brand]: true,
    };
    expect(isMatterbridgeDynamicPlatform(brandedWithoutInstance)).toBe(false);

    const invalidShapePlatform = new MatterbridgeDynamicPlatform(matterbridge, log, {
      name: 'invalid',
      type: 'type',
      version: '1.0.0',
      debug: false,
      unregisterOnShutdown: false,
    });
    Object.assign(invalidShapePlatform as unknown as { name: unknown }, { name: 123 });
    expect(isMatterbridgeDynamicPlatform(invalidShapePlatform)).toBe(false);

    await invalidShapePlatform.onShutdown();
    await platform.onShutdown();
  });
});
