import { jest } from '@jest/globals';

import { Matterbridge } from '../matterbridge.js';
import { matterbridge, setupTest, startMatterbridge, stopMatterbridge } from './jestHelpers.js';

process.argv.push('--debug');

describe('Matterbridge initialized test environment', () => {
  beforeAll(async () => {});

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  test('should start the active Matterbridge instance in bridge mode', async () => {
    await setupTest('JestHelpersMatterbridgeInitializedBridge', false);
    await startMatterbridge('bridge', 9501, 9601);
    expect(matterbridge).toBeDefined();
  });

  test('should stop the active Matterbridge instance in bridge mode', async () => {
    await stopMatterbridge();
    // @ts-expect-error - accessing private member for testing
    expect(Matterbridge.instance).toBeUndefined();
  });

  test('should start the active Matterbridge instance in childbridge mode', async () => {
    await setupTest('JestHelpersMatterbridgeInitializedChildbridge', false);
    await startMatterbridge('childbridge', 9502, 9602);
    expect(matterbridge).toBeDefined();
  });

  test('should stop the active Matterbridge instance in childbridge mode', async () => {
    await stopMatterbridge();
    // @ts-expect-error - accessing private member for testing
    expect(Matterbridge.instance).toBeUndefined();
  });
});
