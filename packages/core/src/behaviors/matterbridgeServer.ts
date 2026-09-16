/**
 * @file packages/core/src/behaviors/matterbridgeServer.ts
 * @description This file contains the MatterbridgeServer class of Matterbridge.
 * @author Luca Liguori
 * @created 2026-03-28
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

/* oxlint-disable typescript/no-namespace */

import type { Environment } from '@matter/general';
import { Behavior, ServerNode } from '@matter/node';
import { GeneralDiagnosticsBehavior } from '@matter/node/behaviors/general-diagnostics';
import { GeneralDiagnostics } from '@matter/types/clusters/general-diagnostics';
import type { AnsiLogger } from 'node-ansi-logger';

import type { CommandHandler } from '../matterbridgeEndpointCommandHandler.js';

/**
 * Returns whether the node booted because a software update completed.
 *
 * The Matter 1.6 specification excludes OTA reboots from the StartUpOnOff / StartUpCurrentLevel /
 * StartUpColorTemperatureMireds behavior ("This behavior does not apply to reboots associated with OTA. After
 * an OTA restart, the ... attribute SHALL return to its value prior to the restart"), so the
 * MATTERBRIDGE_CHIP_TEST-only startup overrides in MatterbridgeOnOffServer, MatterbridgeLevelControlServer
 * and MatterbridgeColorControlServer must honour it. Mirrors matter.js's own private `#getBootReason()`.
 *
 * @param {Environment} env - The environment to resolve the root ServerNode from.
 *
 * @returns {boolean} True when the boot reason is SoftwareUpdateCompleted.
 */
export function isSoftwareUpdateBoot(env: Environment): boolean {
  const rootEndpoint = env.get(ServerNode);
  if (!rootEndpoint.behaviors.has(GeneralDiagnosticsBehavior)) return false;
  return rootEndpoint.stateOf(GeneralDiagnosticsBehavior).bootReason === GeneralDiagnostics.BootReason.SoftwareUpdateCompleted;
}

/**
 * Base behavior providing a logger and command dispatch for Matterbridge endpoints.
 */
export class MatterbridgeServer extends Behavior {
  static override readonly id = 'matterbridge';
  declare state: MatterbridgeServer.State;

  /**
   * Logs initialization and delegates to the base behavior.
   */
  override initialize(): void {
    this.state.log.debug(`MatterbridgeServer: initialized (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    super.initialize();
  }
}

/* v8 ignore start */
export namespace MatterbridgeServer {
  /**
   * State shared by Matterbridge servers.
   */
  export class State {
    log!: AnsiLogger;
    commandHandler!: CommandHandler;
  }
}
/* v8 ignore stop */
