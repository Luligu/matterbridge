/**
 * This file contains the MatterbridgeServer class of Matterbridge.
 *
 * @file matterbridgeServer.ts
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

/* eslint-disable @typescript-eslint/no-namespace */

import { Behavior } from '@matter/node';
import { AnsiLogger } from 'node-ansi-logger';

import { CommandHandler } from '../matterbridgeEndpointCommandHandler.js';

/**
 * Base behavior providing a logger and command dispatch for Matterbridge endpoints.
 */
export class MatterbridgeServer extends Behavior {
  static override readonly id = 'matterbridge';
  declare state: MatterbridgeServer.State;

  /**
   * Logs initialization and delegates to the base behavior.
   */
  override initialize() {
    this.state.log.debug(`MatterbridgeServer initialized (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    super.initialize();
  }
}

// istanbul ignore next cause this is just a namespace for shared state types
export namespace MatterbridgeServer {
  /**
   * State shared by Matterbridge servers.
   */
  export class State {
    log!: AnsiLogger;
    commandHandler!: CommandHandler;
  }
}
