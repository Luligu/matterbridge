/**
 * @file packages/core/buntest/bunUtils.ts
 * @description Shared helpers for the core bun test suites.
 * @author Luca Liguori
 *
 * The helpers that need core types live here rather than in @matterbridge/test-utils, which must not depend on core.
 */

import { afterAll, beforeAll, beforeEach, expect, vi } from 'bun:test';

import type { DeviceTypeId } from '@matter/types/datatype';
import { flushAsync } from '@matterbridge/test-utils';
import { createServerNode, createTestEnvironment, destroyTestEnvironment, flushServerNode } from '@matterbridge/test-utils/buntest/matter';

import type { MatterbridgeEndpoint } from '../src/matterbridgeEndpoint.js';
import type { CommandHandlers } from '../src/matterbridgeEndpointCommandHandler.js';

/**
 * Registers the hooks of a create-only behavior suite: one test environment and one server node with its aggregator,
 * created before the first test and closed after the last one, with every flush pause set to 0. The server node is
 * never started, so the suite needs no network beyond the mDNS sockets matter.js opens on creation.
 *
 * Call it at the top of the suite's `describe` block, then use `server` and `aggregator` from
 * `@matterbridge/test-utils/buntest/matter`.
 *
 * @param {number} port The Matter port of the server node, unique among the suites.
 * @param {DeviceTypeId} [deviceType] The device type announced by the server node (default: aggregator).
 * @returns {void}
 */
export function useServerNode(port: number, deviceType?: DeviceTypeId): void {
  beforeAll(async () => {
    await createTestEnvironment();
    await createServerNode(port, deviceType, 0, 0, 0);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await flushServerNode(0, 0, 0, 0);
    await destroyTestEnvironment();
    vi.restoreAllMocks();
  });
}

/**
 * Invokes a command on an endpoint and verifies that the plugin command handler receives it with the expected request.
 * The handler is removed once the command completes: only the first handler registered for a command runs, so a
 * leftover one would shadow the handler of the next call.
 *
 * @param {MatterbridgeEndpoint} endpoint The endpoint that receives the command.
 * @param {unknown} cluster The behavior or cluster that implements the command.
 * @param {CommandHandlers} command The name of the command.
 * @param {object} [expectedRequest] The request to send, which the handler must receive unchanged (default: no request, `{}` expected).
 * @param {(data: any) => void} [check] Additional checks on the handler data.
 * @returns {Promise<void>} Resolves once the handler has run and the command has completed.
 */
export async function expectCommand(
  endpoint: MatterbridgeEndpoint,
  // oxlint-disable-next-line typescript/no-explicit-any, typescript/explicit-module-boundary-types
  cluster: any,
  command: CommandHandlers,
  expectedRequest?: object,
  // oxlint-disable-next-line typescript/no-explicit-any
  check?: (data: any) => void,
): Promise<void> {
  let received: { endpoint: MatterbridgeEndpoint; request: unknown } | undefined;
  // oxlint-disable-next-line typescript/no-explicit-any
  const handler = (data: any): void => {
    received = data;
    check?.(data);
  };
  endpoint.addCommandHandler(command, handler);
  try {
    if (expectedRequest === undefined) await endpoint.invokeBehaviorCommand(cluster, command);
    else await endpoint.invokeBehaviorCommand(cluster, command, expectedRequest);
  } finally {
    endpoint.removeCommandHandler(command, handler);
  }
  expect(received).toBeDefined();
  expect(received?.endpoint).toBe(endpoint);
  expect(received?.request).toEqual(expectedRequest ?? {});
}

/** A command received by the plugin command handler, as recorded by {@link recordCommand}. */
export interface RecordedCommand {
  cluster: string;
  endpoint: MatterbridgeEndpoint;
  request: unknown;
}

/**
 * Registers one plugin command handler that records every call, for a test that invokes the same command several
 * times, including calls the server then rejects. Register it once per endpoint and command: only the first handler
 * registered for a command runs.
 *
 * @param {MatterbridgeEndpoint} endpoint The endpoint that receives the command.
 * @param {CommandHandlers} command The name of the command.
 * @returns {RecordedCommand[]} The live list of the recorded calls, in order.
 */
export function recordCommand(endpoint: MatterbridgeEndpoint, command: CommandHandlers): RecordedCommand[] {
  const calls: RecordedCommand[] = [];
  endpoint.addCommandHandler(command, (data) => {
    calls.push({ cluster: data.cluster, endpoint: data.endpoint, request: data.request });
  });
  return calls;
}

/**
 * Bun has no `vi.waitFor`: yields to the event loop until the condition holds, failing the test after `timeout` ms.
 *
 * @param {() => boolean} condition The condition to wait for.
 * @param {number} [timeout] The maximum time to wait in milliseconds (default 2000).
 * @returns {Promise<void>} Resolves as soon as the condition holds.
 */
export async function waitFor(condition: () => boolean, timeout: number = 2000): Promise<void> {
  const deadline = Date.now() + timeout;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error(`waitFor: condition not met within ${timeout}ms`);
    await flushAsync(1, 1, 5);
  }
}

/**
 * Bun has no `vi.advanceTimersByTimeAsync`: advances the fake clock `step` ms at a time and drains the microtask
 * queue between steps, so promise chains started by a timer callback settle (and may schedule further timers) before
 * the next step fires. The same approach as the device suites, proven on the matter.js timers.
 *
 * @param {number} ms The time in milliseconds to advance the fake clock.
 * @param {number} [step] The size of each step in milliseconds (default 1).
 * @param {number} [microTurns] The number of microtask turns drained after each step (default 10).
 * @returns {Promise<void>} Resolves once the clock has advanced and the microtasks have been drained.
 */
export async function advanceTimersByTimeAsync(ms: number, step: number = 1, microTurns: number = 10): Promise<void> {
  for (let elapsed = 0; elapsed <= ms; elapsed += step) {
    vi.advanceTimersByTime(elapsed === 0 ? 0 : step);
    for (let turn = 0; turn < microTurns; turn++) await Promise.resolve();
  }
}
