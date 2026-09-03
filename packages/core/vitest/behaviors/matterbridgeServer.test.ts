/**
 * @file packages/core/vitest/behaviors/matterbridgeServer.test.ts
 * @description This file contains the tests for the MatterbridgeServer behavior.
 * @author Luca Liguori
 */

const NAME = 'MatterbridgeServer';

import { setupTest } from '@matterbridge/vitest-utils';
import type { AnsiLogger } from 'node-ansi-logger';

import { MatterbridgeServer } from '../../src/behaviors/matterbridgeServer.js';
import type { CommandHandler } from '../../src/matterbridgeEndpointCommandHandler.js';

// Setup the test environment
await setupTest(NAME, false);

describe('MatterbridgeServer', () => {
  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterAll(() => {
    // Restore all mocks
    vi.restoreAllMocks();
  });

  it('can be constructed', () => {
    const state = new MatterbridgeServer.State();
    expect(state).toBeInstanceOf(MatterbridgeServer.State);
    state.log = {} as AnsiLogger;
    state.commandHandler = {} as CommandHandler;

    expect(state.log).toBeDefined();
    expect(state.commandHandler).toBeDefined();
  });
});
