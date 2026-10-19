/**
 * @file packages/core/buntest/matterbridgeAccessoryPlatform.test.ts
 * @description This file contains the tests for the MatterbridgeAccessoryPlatform class.
 * @author Luca Liguori
 */

const NAME = 'MatterbridgeAccessoryPlatform';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'bun:test';

import { createTestEnvironment, destroyTestEnvironment, getMatterbridge } from '@matterbridge/test-utils/buntest/matter';
import { log, setDebug, setupTest } from '@matterbridge/test-utils/buntest/setup';
import type { PlatformMatterbridge } from '@matterbridge/types';

import { isMatterbridgeAccessoryPlatform, MatterbridgeAccessoryPlatform } from '../src/matterbridgeAccessoryPlatform.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge accessory platform', () => {
  let matterbridge: PlatformMatterbridge;

  beforeAll(async () => {
    // Setup the Matter test environment
    await createTestEnvironment();
    matterbridge = { ...getMatterbridge(), log } as PlatformMatterbridge;
  }, 30000);

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clear debug mode after each test
    await setDebug(false);
  });

  afterAll(async () => {
    // Destroy the Matter test environment
    await destroyTestEnvironment();

    // Restore all mocks
    vi.restoreAllMocks();
  }, 30000);

  test('create a MatterbridgeAccessoryPlatform', async () => {
    const platform = new MatterbridgeAccessoryPlatform(matterbridge, log, { name: 'test', type: 'type', version: '1.0.0', debug: false, unregisterOnShutdown: false });
    const brand = Object.getOwnPropertySymbols(platform).find((symbol) => symbol.description === 'MatterbridgeAccessoryPlatform.brand');

    expect(platform.type).toBe('AccessoryPlatform');
    expect(platform.config.type).toBe('AccessoryPlatform');
    expect(isMatterbridgeAccessoryPlatform(platform)).toBe(true);
    // oxlint-disable-next-line unicorn/no-useless-undefined
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
