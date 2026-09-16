/**
 * @file packages/core/vitest/behaviors/matterbridgeServer.test.ts
 * @description This file contains the tests for the MatterbridgeServer behavior.
 * @author Luca Liguori
 */

const NAME = 'MatterbridgeServer';

import type { Environment } from '@matter/general';
import { GeneralDiagnosticsBehavior } from '@matter/node/behaviors/general-diagnostics';
import { GeneralDiagnostics } from '@matter/types/clusters/general-diagnostics';
import { setupTest } from '@matterbridge/vitest-utils';
import type { AnsiLogger } from 'node-ansi-logger';

import { isSoftwareUpdateBoot, MatterbridgeServer } from '../../src/behaviors/matterbridgeServer.js';
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

  describe('isSoftwareUpdateBoot', () => {
    /**
     * Builds a stub Environment whose ServerNode reports the given boot reason, or no GeneralDiagnostics at all.
     *
     * @param {GeneralDiagnostics.BootReason} [bootReason] - The boot reason to report, or undefined for a node without GeneralDiagnostics.
     *
     * @returns {Environment} The stub environment.
     */
    const envWith = (bootReason?: GeneralDiagnostics.BootReason): Environment =>
      ({
        get: () => ({
          behaviors: { has: (type: unknown) => bootReason !== undefined && type === GeneralDiagnosticsBehavior },
          stateOf: () => ({ bootReason }),
        }),
      }) as unknown as Environment;

    it('returns true when the node booted from a completed software update', () => {
      expect(isSoftwareUpdateBoot(envWith(GeneralDiagnostics.BootReason.SoftwareUpdateCompleted))).toBe(true);
    });

    it('returns false for any other boot reason', () => {
      expect(isSoftwareUpdateBoot(envWith(GeneralDiagnostics.BootReason.PowerOnReboot))).toBe(false);
    });

    it('returns false when the root node has no GeneralDiagnostics behavior', () => {
      expect(isSoftwareUpdateBoot(envWith())).toBe(false);
    });
  });
});
