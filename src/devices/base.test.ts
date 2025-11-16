// src\base.test.ts

const MATTER_PORT = 8000;
const NAME = 'BaseTest';
const HOMEDIR = path.join('jest', NAME);

import path from 'node:path';

import { jest } from '@jest/globals';

// Matterbridge
import { aggregator, createTestEnvironment, server, setupTest, startServerNode, stopServerNode } from '../jestutils/jestHelpers.js';

// Setup the test environment
setupTest(NAME, false);

// Setup the Matter test environment
createTestEnvironment(NAME);

describe('Matterbridge ' + NAME, () => {
  beforeAll(async () => {});

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {});

  afterAll(async () => {
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('create and start the server node', async () => {
    await startServerNode(NAME, MATTER_PORT);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('close the server node', async () => {
    expect(server).toBeDefined();
    await stopServerNode(server);
  });
});
