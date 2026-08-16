/**
 * @file packages/core/src/behaviors/occupancySensingServer.ts
 * @description This file contains the MatterbridgeOccupancySensingServer class of Matterbridge.
 * @author Luca Liguori
 * @created 2026-08-16
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

import type { MaybePromise } from '@matter/general';
import type { ActionContext } from '@matter/node';
import { OccupancySensingServer } from '@matter/node/behaviors/occupancy-sensing';
import { OccupancySensing } from '@matter/types/clusters/occupancy-sensing';

/**
 * OccupancySensing server with backward-compatible HoldTime synchronization.
 *
 * @remarks Matter 1.6 replaced the legacy PIR occupied-to-unoccupied delay attribute with HoldTime. For backward
 * compatibility, writes to HoldTime and PIROccupiedToUnoccupiedDelay are mirrored so clients using either revision see
 * the same hold duration.
 */
export class MatterbridgeOccupancySensingServer extends OccupancySensingServer.with(OccupancySensing.Feature.PassiveInfrared) {
  #syncingHoldTime = false;

  override initialize(): MaybePromise {
    const result = super.initialize();
    if (this.events.holdTime$Changing) this.reactTo(this.events.holdTime$Changing, this.#syncPirOccupiedToUnoccupiedDelay);
    if (this.events.pirOccupiedToUnoccupiedDelay$Changing) this.reactTo(this.events.pirOccupiedToUnoccupiedDelay$Changing, this.#syncHoldTime);
    return result;
  }

  #syncPirOccupiedToUnoccupiedDelay = (holdTime: number | undefined, _oldHoldTime: number | undefined, context: ActionContext): void => {
    const state = this.endpoint.agentFor(context).get(MatterbridgeOccupancySensingServer).state;
    if (this.#syncingHoldTime || holdTime === undefined || state.pirOccupiedToUnoccupiedDelay === holdTime) return;
    this.#syncingHoldTime = true;
    state.pirOccupiedToUnoccupiedDelay = holdTime;
    this.#syncingHoldTime = false;
  };

  #syncHoldTime = (pirOccupiedToUnoccupiedDelay: number | undefined, _oldPirOccupiedToUnoccupiedDelay: number | undefined, context: ActionContext): void => {
    const state = this.endpoint.agentFor(context).get(MatterbridgeOccupancySensingServer).state;
    if (this.#syncingHoldTime || pirOccupiedToUnoccupiedDelay === undefined || state.holdTime === pirOccupiedToUnoccupiedDelay) return;
    this.#syncingHoldTime = true;
    state.holdTime = pirOccupiedToUnoccupiedDelay;
    this.#syncingHoldTime = false;
  };
}
