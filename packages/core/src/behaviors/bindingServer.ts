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

import { type Endpoint } from '@matter/main/node';
import { BindingBehavior, type BindingResolution, BindingServer } from '@matter/node/behaviors/binding';
import { DescriptorServer } from '@matter/node/behaviors/descriptor';
import { type ClusterId } from '@matter/types';
import { type Binding } from '@matter/types/clusters/binding';
import { debugStringify, nt } from 'node-ansi-logger';

import { MatterbridgeServer } from './matterbridgeServer.js';

/**
 * Binding client behavior that mirrors bindings into the Descriptor clientList and populates
 * endpoint.type.clientClusters so that matter.js BindingManager can validate and resolve bindings.
 */
export class MatterbridgeBindingServer extends BindingServer {
  declare protected internal: MatterbridgeBindingServer.Internal;
  declare state: MatterbridgeBindingServer.State;

  /**
   * Initializes binding handling and reacts to binding changes.
   */
  override async initialize(): Promise<void> {
    super.initialize();

    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Initializing MatterbridgeBindingServer (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber}) with clientList: ${this.state.clientList.join(', ')}`);

    // Ensure that the Descriptor clientList includes all clusters from the binding clientList (deferred after construction)
    const clientList = this.state.clientList;
    this.endpoint.construction.onSuccess(async () => {
      const currentClientList = this.endpoint.stateOf(DescriptorServer).clientList;
      const toAddClientList = clientList.filter((id) => !currentClientList.includes(id));
      // istanbul ignore else
      if (toAddClientList.length > 0) {
        device.log.info(`Adding client clusters to endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber}: ${toAddClientList.join(', ')}`);
        await this.endpoint.setStateOf(DescriptorServer, { clientList: [...currentClientList, ...toAddClientList] });
      }
      const targets = this.endpoint.stateOf(BindingServer).binding;
      for (const target of targets) {
        device.log.info(`Active binding for endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber}: target ${debugStringify(target)}`);
      }
    });

    // React to binding changes and update internal bound state
    this.reactTo(this.events.binding$Changed, (value) => {
      this.internal.bound = value.length > 0;
      device.log.notice(
        `MatterbridgeBindingServer (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber}) binding changed: ${debugStringify(value)}${nt}, bound: ${this.internal.bound}`,
      );
    });

    // React to established bindings, update internal bound state and subscribe to remote node
    this.reactTo(this.events.established, async (resolution: BindingResolution) => {
      device.log.notice(
        `MatterbridgeBindingServer (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber}) binding established: kind ${resolution.kind} entry ${debugStringify(resolution.entry)}${nt}`,
      );
      this.internal.boundEndpoints.set(resolution.entry, resolution.endpoint);
      if (resolution.kind !== 'client') return;
      await resolution.node.set({ network: { autoSubscribe: true } });
    });

    // React to removed bindings and update internal bound state
    this.reactTo(this.events.removed, async (resolution: BindingResolution) => {
      device.log.notice(
        `MatterbridgeBindingServer (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber}) binding removed: kind ${resolution.kind} entry ${debugStringify(resolution.entry)}${nt}`,
      );
      this.internal.boundEndpoints.delete(resolution.entry);
    });
  }

  override async [Symbol.asyncDispose]() {
    this.internal.boundEndpoints.clear();
    await super[Symbol.asyncDispose]();
  }

  /**
   * Returns the bound endpoint for the given cluster id, or undefined if not found.
   *
   * @param {ClusterId} clusterId - The cluster id to look up in the bound endpoints.
   * @returns {Endpoint | undefined} The bound endpoint, or undefined if not found.
   */
  getEndpoint(clusterId: ClusterId): Endpoint | undefined {
    for (const [target, endpoint] of this.internal.boundEndpoints) {
      if (target.cluster === clusterId) return endpoint;
    }
    return undefined;
  }
}

// istanbul ignore next but why is this not covered?
export namespace MatterbridgeBindingServer {
  /**
   * Internal state for binding behavior.
   */
  export class Internal {
    /** Whether this endpoint is currently bound to any remote endpoints. */
    bound: boolean = false;
    /** Map of bound endpoints by their target. */
    boundEndpoints: Map<Binding.Target, Endpoint> = new Map();
  }
  /**
   * Persistent state for binding behavior.
   */
  export class State extends BindingBehavior.State {
    clientList: ClusterId[] = [];
  }
}
