// src\matterbridgeAccessoryPlatform.test.ts

const NAME = 'MatterbridgeAccessoryPlatform';

import { jest } from '@jest/globals';

import { createMatterbridgeEnvironment, destroyMatterbridgeEnvironment, log, matterbridge, setupTest } from './jestutils/jestHelpers.js';
import { isMatterbridgeAccessoryPlatform, MatterbridgeAccessoryPlatform } from './matterbridgeAccessoryPlatform.js';

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
    const brand = Object.getOwnPropertySymbols(platform).find((symbol) => symbol.description === 'MatterbridgeAccessoryPlatform.brand');

    expect(platform.type).toBe('AccessoryPlatform');
    expect(platform.config.type).toBe('AccessoryPlatform');
    expect(isMatterbridgeAccessoryPlatform(platform)).toBe(true);
    expect(isMatterbridgeAccessoryPlatform(undefined)).toBe(false);
    expect(isMatterbridgeAccessoryPlatform(null)).toBe(false);
    expect(isMatterbridgeAccessoryPlatform('string')).toBe(false);

    const instanceWithoutBrand = Object.create(MatterbridgeAccessoryPlatform.prototype) as MatterbridgeAccessoryPlatform;
    Object.assign(instanceWithoutBrand, { name: 'missing-brand', type: 'AccessoryPlatform', version: '1.0.0', config: {} });
    expect(isMatterbridgeAccessoryPlatform(instanceWithoutBrand)).toBe(false);

    expect(brand).toBeDefined();
    if (!brand) throw new Error('MatterbridgeAccessoryPlatform brand symbol not found');

    const brandedWithoutInstance = {
      name: 'fake',
      type: 'AccessoryPlatform',
      version: '1.0.0',
      config: {},
      [brand]: true,
    };
    expect(isMatterbridgeAccessoryPlatform(brandedWithoutInstance)).toBe(false);

    const invalidShapePlatform = new MatterbridgeAccessoryPlatform(matterbridge, log, {
      name: 'invalid',
      type: 'type',
      version: '1.0.0',
      debug: false,
      unregisterOnShutdown: false,
    });
    // Force the type guard down its final shape-check branch.
    Object.assign(invalidShapePlatform as unknown as { name: unknown }, { name: 123 });
    expect(isMatterbridgeAccessoryPlatform(invalidShapePlatform)).toBe(false);

    await invalidShapePlatform.onShutdown();
    await platform.onShutdown();
  });
});
