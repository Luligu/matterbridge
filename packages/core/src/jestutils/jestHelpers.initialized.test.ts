const NAME = 'JestHelpersMatterbridgeInitialized';
const MATTER_PORT = 9600;
const FRONTEND_PORT = 9501;

import { jest } from '@jest/globals';

import { Matterbridge } from '../matterbridge.js';
import { matterbridge, startMatterbridge, stopMatterbridge } from './jestMatterbridgeTest.js';
import { setupTest } from './jestSetupTest.js';

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
    await setupTest(NAME + 'Bridge', false);
    await startMatterbridge('bridge', FRONTEND_PORT, MATTER_PORT);
    expect(matterbridge).toBeDefined();
  });

  test('should stop the active Matterbridge instance in bridge mode', async () => {
    await stopMatterbridge();
    // @ts-expect-error - accessing private member for testing
    expect(Matterbridge.instance).toBeUndefined();
  });

  test('should start the active Matterbridge instance in childbridge mode', async () => {
    await setupTest(NAME + 'Childbridge', false);
    await startMatterbridge('childbridge', FRONTEND_PORT + 50, MATTER_PORT + 50);
    expect(matterbridge).toBeDefined();
  });

  test('should stop the active Matterbridge instance in childbridge mode', async () => {
    await stopMatterbridge();
    // @ts-expect-error - accessing private member for testing
    expect(Matterbridge.instance).toBeUndefined();
  });
});
