/**
 * This file contains the MatterbridgeBindingServer class of Matterbridge.
 *
 * @file bindingServer.ts
 * @author Luca Liguori
 * @created 2026-02-25
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

import { BindingBehavior } from '@matter/node/behaviors/binding';
import { DescriptorServer } from '@matter/node/behaviors/descriptor';
import { ClusterId } from '@matter/types';

import { MatterbridgeServer } from './matterbridgeServer.js';

/**
 * Binding client behavior that mirrors bindings into the Descriptor clientList.
 */
export class MatterbridgeBindingServer extends BindingBehavior {
  declare protected internal: MatterbridgeBindingServer.Internal;
  declare state: MatterbridgeBindingServer.State;

  /**
   * Initializes binding handling and reacts to binding changes.
   */
  override async initialize(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Initializing MatterbridgeBindingServer (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber}) with clientList: ${this.state.clientList.join(', ')}`);
    (await this.agent.load(DescriptorServer)).state.clientList.push(...this.state.clientList);
    this.reactTo(this.events.binding$Changed, (value) => {
      this.internal.bound = value.length > 0;
      device.log.notice(`MatterbridgeBindingServer (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber}) binding changed: ${value}, bound: ${this.internal.bound}`);
    });
    await super.initialize();
  }
}

// istanbul ignore next but why is this not covered?
export namespace MatterbridgeBindingServer {
  /**
   * Internal state for binding behavior.
   */
  export class Internal {
    bound: boolean = false;
  }
  /**
   * Persistent state for binding behavior.
   */
  export class State extends BindingBehavior.State {
    clientList: ClusterId[] = [];
  }
}
