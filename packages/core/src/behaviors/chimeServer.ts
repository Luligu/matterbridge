/**
 * @file packages/core/src/behaviors/chimeServer.ts
 * @description This file contains the MatterbridgeChimeServer class of Matterbridge.
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
 * @created 2026-07-13
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

import { ChimeServer } from '@matter/node/behaviors/chime';
import { Status, StatusResponseError } from '@matter/types';
import type { Chime } from '@matter/types/clusters/chime';

import { MatterbridgeServer } from './matterbridgeServer.js';

/**
 * ChimeServer base with the ChimeStartedPlaying event enabled.
 *
 * ChimeStartedPlaying has conformance `Rev >= v2`, which matter.js always resolves as conditional rather than
 * mandatory (it does not consult the runtime ClusterRevision value), so the event is not attached to `this.events`
 * unless explicitly enabled here.
 */
const ChimeServerBase = ChimeServer.enable({ events: { chimeStartedPlaying: true } });

/**
 * Chime server that forwards the PlayChimeSound command to the Matterbridge command handler and generates the ChimeStartedPlaying event.
 */
export class MatterbridgeChimeServer extends ChimeServerBase {
  override initialize(): void {
    // Must stay an unbound method reference: matter.js calls reactors via `reactor.call(transactionScopedThis, ...)`,
    // rebinding `this` to a fresh per-write transactional proxy. A bound arrow function ignores that rebind and
    // keeps referencing the stale construction-time `this`, causing "context has exited" errors on every write.
    // oxlint-disable-next-line typescript/unbound-method
    this.reactTo(this.events.selectedChime$Changing, this.#assertSelectedChime);
  }

  /**
   * Rejects writes to SelectedChime that are not present in installedChimeSounds.
   * Per Matter 1.6 Application Cluster spec §11.8.5.2, an attempt to write a value not contained
   * within InstalledChimeSounds SHALL be failed with a NOT_FOUND response.
   *
   * @param {number} chimeId - The chimeId value being written to SelectedChime.
   * @throws {StatusResponseError} With status NotFound if chimeId is not present in installedChimeSounds.
   */
  #assertSelectedChime(chimeId: number): void {
    if (!this.state.installedChimeSounds.some((chimeSound) => chimeSound.chimeId === chimeId)) {
      throw new StatusResponseError(
        `MatterbridgeChimeServer: chime sound ${chimeId} is not present in installedChimeSounds (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.NotFound,
      );
    }
  }

  /**
   * Handles the PlayChimeSound command.
   * Plays the chime sound passed in the request or, if none is passed, the currently selected chime, and generates the ChimeStartedPlaying event.
   * Per Matter 1.6 Application Cluster spec §11.8.6.1.2, if Enabled is false, the command SHALL succeed with no other side effects.
   *
   * @param {Chime.PlayChimeSoundRequest} request - PlayChimeSound request payload.
   * @throws {StatusResponseError} With status NotFound if the requested chimeId is not present in installedChimeSounds.
   */
  // oxlint-disable-next-line typescript/require-await
  override async playChimeSound(request: Chime.PlayChimeSoundRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    if (!this.state.enabled) {
      device.log.debug(`MatterbridgeChimeServer: playChimeSound called but chime is disabled (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
      return;
    }
    const chimeId = request.chimeId ?? this.state.selectedChime;
    if (!this.state.installedChimeSounds.some((chimeSound) => chimeSound.chimeId === chimeId)) {
      throw new StatusResponseError(
        `MatterbridgeChimeServer: chime sound ${chimeId} is not present in installedChimeSounds (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.NotFound,
      );
    }
    device.log.info(`MatterbridgeChimeServer: playing chime sound ${chimeId} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // TODO: Add Chime.playChimeSound in matterbridge
    /*
    await device.commandHandler.executeHandler('Chime.playChimeSound', {
      command: 'playChimeSound',
      request,
      cluster: ChimeServer.id,
      attributes: this.state,
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    */
    device.log.debug(`MatterbridgeChimeServer: playChimeSound called with chimeId ${chimeId} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    this.events.chimeStartedPlaying.emit({ chimeId }, this.context);
  }
}
