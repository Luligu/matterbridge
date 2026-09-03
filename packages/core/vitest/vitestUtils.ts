/**
 * @file packages/core/vitest/vitestUtils.ts
 * @description This file contains shared Vitest helpers for the Matterbridge core tests.
 * @author Luca Liguori
 * @created 2026-06-14
 * @version 1.0.0
 * @license Apache-2.0
 *
 * Copyright 2026, 2027, 2028 Luca Liguori.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*
 * These helpers depend on the core Matterbridge class, so they cannot live in @matterbridge/vitest-utils
 * (which must not depend on core). Keep them here and import them from the core vitest tests instead of
 * inlining them in every file, so they only need to change in one place.
 */

import { type Environment, RuntimeService } from '@matter/general';
import { MdnsService } from '@matter/protocol';
import { flushAsync } from '@matterbridge/vitest-utils';

import type { Matterbridge } from '../src/matterbridge.js';
import type { MatterbridgeEndpoint } from '../src/matterbridgeEndpoint.js';
import type { CommandHandlers } from '../src/matterbridgeEndpointCommandHandler.js';

/**
 * Destroy the Matterbridge instance.
 *
 * @param {Matterbridge} matterbridge The matterbridge instance.
 * @param {number} cleanupPause The pause passed to cleanup.
 * @param {number} destroyPause The pause to flush after cleanup.
 * @returns {Promise<void>} A promise that resolves when the instance is destroyed.
 */
export async function destroyInstance(matterbridge: Matterbridge, cleanupPause: number = 10, destroyPause: number = 10): Promise<void> {
  // Cleanup the Matterbridge instance
  // @ts-expect-error - accessing private member for testing
  await matterbridge.cleanup('destroying instance...', false, cleanupPause);

  // Pause before destroying the instance
  if (destroyPause > 0) await flushAsync(undefined, undefined, destroyPause);
}

/**
 * Close the mDNS instance in the matterbridge environment.
 *
 * @param {Matterbridge} matterbridge The matterbridge instance.
 * @returns {Promise<void>} A promise that resolves when the mDNS instance is closed.
 */
export async function closeMdnsInstance(matterbridge: Matterbridge): Promise<void> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const environment = (matterbridge as unknown as { environment: Environment }).environment;
  const mdns = environment.maybeGet(MdnsService);
  if (!mdns) return;
  await mdns.close();
  environment.delete(MdnsService, mdns);
}

/**
 * Close the runtime instance in the matterbridge environment.
 *
 * @param {Matterbridge} matterbridge The matterbridge instance.
 * @returns {Promise<void>} A promise that resolves when the runtime instance is closed.
 */
export async function closeRuntimeInstance(matterbridge: Matterbridge): Promise<void> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const environment = (matterbridge as unknown as { environment: Environment }).environment;
  const runtime = environment.maybeGet(RuntimeService);
  await runtime?.close();
}

/**
 * Invoke a behavior command and assert that the endpoint forwards it to the registered Matterbridge command handler.
 *
 * The handler is registered before the command is invoked and the returned promise settles only once the handler ran,
 * so the assertions in `check` observe the attribute values as the handler saw them.
 *
 * Only the first handler registered for a given command name is executed, so a command must be invoked at most once
 * per endpoint through this helper.
 *
 * @param {MatterbridgeEndpoint} endpoint The endpoint owning the cluster.
 * @param {any} cluster The cluster to invoke the command on.
 * @param {CommandHandlers} command The command name to invoke.
 * @param {object} [expectedRequest] The expected request payload, or undefined for a command without payload.
 * @param {(data: any) => void} [check] Additional assertions on the data passed to the command handler.
 * @returns {Promise<void>} A promise that resolves when the command has been invoked and the handler ran.
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
  let invoke: Promise<void>;

  await new Promise((resolve, reject) => {
    endpoint.addCommandHandler(command, (data) => {
      try {
        expect(data.endpoint).toBe(endpoint);
        if (expectedRequest === undefined) expect(data.request).toEqual({});
        else expect(data.request).toEqual(expectedRequest);
        check?.(data);
        resolve(true);
      } catch (error) {
        reject(error);
      }
    });
    invoke = expectedRequest === undefined ? endpoint.invokeBehaviorCommand(cluster, command) : endpoint.invokeBehaviorCommand(cluster, command, expectedRequest);
  });

  // @ts-expect-error Typescript doesn't know that the command handler will be executed before this line
  await invoke;
}
