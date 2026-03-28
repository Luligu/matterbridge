/**
 * This file contains the MatterbridgePowerSourceServer class of Matterbridge.
 *
 * @file powerSourceServer.ts
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

import { PowerSourceServer } from '@matter/node/behaviors/power-source';
import { EndpointNumber } from '@matter/types/datatype';

import { MatterbridgeServer } from './matterbridgeServer.js';

/**
 * PowerSource server that keeps the Matterbridge endpoint list in sync.
 */
export class MatterbridgePowerSourceServer extends PowerSourceServer {
  /**
   * Initializes state and updates endpointList when construction completes.
   */
  override async initialize() {
    await super.initialize();

    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Initializing MatterbridgePowerSourceServer (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    this.state.endpointList = [this.endpoint.number];
    this.endpoint.construction.onSuccess(async () => {
      device.log.debug(`MatterbridgePowerSourceServer: endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber} construction completed`);
      const endpointList: EndpointNumber[] = [this.endpoint.number];
      for (const endpoint of this.endpoint.parts) {
        if (endpoint.lifecycle.isReady) {
          endpointList.push(endpoint.number);
        }
      }
      await this.endpoint.setStateOf(PowerSourceServer, { endpointList });
      device.log.debug(
        `MatterbridgePowerSourceServer: endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber} construction completed with endpointList: ${endpointList.join(', ')}`,
      );
    });
  }
}
