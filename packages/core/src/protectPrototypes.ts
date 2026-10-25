/**
 * @file packages/core/src/protectPrototypes.ts
 * @description This file contains the helpers that freeze the prototypes of the core classes.
 * @author Luca Liguori
 * @created 2026-10-24
 * @version 1.0.0
 * @license Apache-2.0
 *
 * Copyright 2026 Luca Liguori.
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

// @matterbridge
import { logModuleLoaded } from '@matterbridge/utils/loader';

logModuleLoaded('ProtectPrototypes');

/**
 * Freezes the prototype of a class.
 * Once frozen, assigning or defining a method on the prototype, or on the prototype of a subclass when the name is inherited, throws a TypeError.
 * Subclasses declared with the class syntax still work, as do the static members of the class.
 *
 * @param {{ readonly prototype: object }} type - The class whose prototype is frozen.
 */
export function protectPrototype(type: { readonly prototype: object }): void {
  Object.freeze(type.prototype);
}

/**
 * Freezes the prototypes of the core classes: BroadcastServer, ThreadsManager, Matterbridge, MatterbridgeEndpoint, its
 * CommandHandler, the MatterbridgeServer behavior and the platform classes.
 * Called by the cli before loading the Matterbridge instance. The modules are imported dynamically, so this module does not depend on them.
 *
 * @returns {Promise<void>} A promise that resolves when the prototypes are frozen.
 */
export async function protectCorePrototypes(): Promise<void> {
  const { BroadcastServer } = await import('@matterbridge/thread/server');
  const { ThreadsManager } = await import('@matterbridge/thread/manager');
  const { MatterbridgeServer } = await import('./behaviors/matterbridgeServer.js');
  const { Matterbridge } = await import('./matterbridge.js');
  const { MatterbridgePlatform } = await import('./matterbridgePlatform.js');
  const { MatterbridgeAccessoryPlatform } = await import('./matterbridgeAccessoryPlatform.js');
  const { MatterbridgeDynamicPlatform } = await import('./matterbridgeDynamicPlatform.js');
  const { MatterbridgeEndpoint } = await import('./matterbridgeEndpoint.js');
  const { CommandHandler } = await import('./matterbridgeEndpointCommandHandler.js');
  for (const type of [
    BroadcastServer,
    ThreadsManager,
    Matterbridge,
    MatterbridgeEndpoint,
    CommandHandler,
    MatterbridgeServer,
    MatterbridgePlatform,
    MatterbridgeDynamicPlatform,
    MatterbridgeAccessoryPlatform,
  ])
    protectPrototype(type);
}
