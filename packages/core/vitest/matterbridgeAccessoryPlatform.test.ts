// vitest\matterbridgeAccessoryPlatform.test.ts

const NAME = 'MatterbridgeAccessoryPlatform';
const MATTER_PORT = 7200;
const MATTER_CREATE_ONLY = true;

import type { PlatformMatterbridge } from '@matterbridge/types';
import { log, setDebug, setupTest } from '@matterbridge/vitest-utils';
import {
  createServerNode,
  createTestEnvironment,
  destroyTestEnvironment,
  flushServerNode,
  getMatterbridge,
  startServerNode,
  stopServerNode,
} from '@matterbridge/vitest-utils/matter';

import { isMatterbridgeAccessoryPlatform, MatterbridgeAccessoryPlatform } from '../src/matterbridgeAccessoryPlatform.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge accessory platform', () => {
  let matterbridge: PlatformMatterbridge;

  beforeAll(async () => {
    // Setup the Matter test environment
    await createTestEnvironment();

    // Create the server node and aggregator
    await createServerNode(MATTER_PORT);

    // Start the server node if not in create-only mode
    if (!MATTER_CREATE_ONLY) await startServerNode();

    matterbridge = { ...getMatterbridge(), log: log } as PlatformMatterbridge;
  }, 30000);

  beforeEach(async () => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clear debug mode after each test
    await setDebug(false);
  });

  afterAll(async () => {
    // Stop or flush the server node depending on the create-only mode
    if (MATTER_CREATE_ONLY) await flushServerNode();
    else await stopServerNode();

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
