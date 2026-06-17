// vitest\matterbridgeDynamicPlatform.test.ts

const NAME = 'MatterbridgeDynamicPlatform';
const MATTER_PORT = 7300;
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

import type { Matterbridge } from '../src/matterbridge.js';
import { isMatterbridgeDynamicPlatform, MatterbridgeDynamicPlatform } from '../src/matterbridgeDynamicPlatform.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge dynamic platform', () => {
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

  beforeEach( () => {
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

  test('create a MatterbridgeDynamicPlatform', async () => {
    const platform = new MatterbridgeDynamicPlatform(matterbridge, log, { name: 'test', type: 'type', version: '1.0.0', debug: false, unregisterOnShutdown: false });
    const brand = Object.getOwnPropertySymbols(platform).find((symbol) => symbol.description === 'MatterbridgeDynamicPlatform.brand');

    expect(platform.type).toBe('DynamicPlatform');
    expect(platform.config.type).toBe('DynamicPlatform');
    expect(isMatterbridgeDynamicPlatform(platform)).toBe(true);
    // oxlint-disable-next-line unicorn/no-useless-undefined
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
