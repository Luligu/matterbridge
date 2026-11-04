/**
 * @file packages/core/buntest/behaviors/matterbridgeServer.test.ts
 * @description This file contains the bun tests for matterbridgeServer.
 * @author Luca Liguori
 */

const NAME = 'MatterbridgeServer';

import { describe, expect, test } from 'bun:test';

import type { Environment } from '@matter/general';
import { GeneralDiagnosticsBehavior } from '@matter/node/behaviors/general-diagnostics';
import { GeneralDiagnostics } from '@matter/types/clusters/general-diagnostics';
import { setupTest } from '@matterbridge/test-utils/buntest/setup';
import type { AnsiLogger } from 'node-ansi-logger';

import { isSoftwareUpdateBoot, MatterbridgeServer } from '../../src/behaviors/matterbridgeServer.js';
import type { CommandHandler } from '../../src/matterbridgeEndpointCommandHandler.js';

await setupTest(NAME, false);

/**
 * Builds a stub Environment whose ServerNode reports the given boot reason, or no GeneralDiagnostics at all.
 *
 * @param {GeneralDiagnostics.BootReason} [bootReason] - The boot reason to report, or undefined for a node without GeneralDiagnostics.
 * @returns {Environment} The stub environment.
 */
const envWith = (bootReason?: GeneralDiagnostics.BootReason): Environment =>
  ({
    get: () => ({
      behaviors: { has: (type: unknown) => bootReason !== undefined && type === GeneralDiagnosticsBehavior },
      stateOf: () => ({ bootReason }),
    }),
  }) as unknown as Environment;

describe('MatterbridgeServer', () => {
  test('State holds the logger and the command handler', () => {
    const state = new MatterbridgeServer.State();
    state.log = {} as AnsiLogger;
    state.commandHandler = {} as CommandHandler;
    expect(state).toBeInstanceOf(MatterbridgeServer.State);
    expect(state.log).toBeDefined();
    expect(state.commandHandler).toBeDefined();
  });

  test.each([
    ['a completed software update', GeneralDiagnostics.BootReason.SoftwareUpdateCompleted, true],
    ['any other boot reason', GeneralDiagnostics.BootReason.PowerOnReboot, false],
    ['a root node without GeneralDiagnostics', undefined, false],
  ] as const)('isSoftwareUpdateBoot for %s', (_label, bootReason, expected) => {
    expect(isSoftwareUpdateBoot(envWith(bootReason))).toBe(expected);
  });
});
