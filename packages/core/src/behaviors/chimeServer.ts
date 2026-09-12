/**
 * @file packages/core/src/behaviors/chimeServer.ts
 * @description This file contains the MatterbridgeChimeServer class of Matterbridge.
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
 * @created 2026-07-13
 * @version 1.1.0
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
import { Chime } from '@matter/types/clusters/chime';

import type { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { MatterbridgeServer } from './matterbridgeServer.js';

/** Id of a chime sound in the InstalledChimeSounds list. */
export type ChimeId = number;

/**
 * ChimeServer base with the ChimeStartedPlaying event enabled.
 *
 * ChimeStartedPlaying has conformance `Rev >= v2`, which matter.js always resolves as conditional rather than
 * mandatory (it does not consult the runtime ClusterRevision value), so the event is not attached to `this.events`
 * unless explicitly enabled here.
 */
const ChimeServerBase = ChimeServer.enable({ events: { chimeStartedPlaying: true } });

/**
 * Chime server that notifies the PlayChimeSound command subscribers and generates the ChimeStartedPlaying event.
 */
export class MatterbridgeChimeServer extends ChimeServerBase {
  /** The endpoint that owns this behavior. Narrowed to MatterbridgeEndpoint: this server is only ever added to a Matterbridge endpoint. */
  declare readonly endpoint: MatterbridgeEndpoint;

  override initialize(): void {
    // Must stay an unbound method reference: matter.js calls reactors via `reactor.call(transactionScopedThis, ...)`,
    // rebinding `this` to a fresh per-write transactional proxy. A bound arrow function ignores that rebind and
    // keeps referencing the stale construction-time `this`, causing "context has exited" errors on every write.
    // oxlint-disable-next-line typescript/unbound-method
    this.reactTo(this.events.selectedChime$Changing, this.#assertSelectedChime);
  }

  /**
   * Rejects writes to SelectedChime that are not present in installedChimeSounds.
   *
   * @param {number} chimeId - The chimeId value being written to SelectedChime.
   * @throws {StatusResponseError} With status NotFound if chimeId is not present in installedChimeSounds.
   */
  #assertSelectedChime(chimeId: number): void {
    // Matter 1.6.0 § 11.8.5.2: Fail a write of SelectedChime with NOT_FOUND if the value is not contained within InstalledChimeSounds.
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
   * The PlayChimeSound command observable added by `subscribeCommand()` is emitted last, after the validation and the state update.
   *
   * @param {Chime.PlayChimeSoundRequest} request - PlayChimeSound request payload.
   * @throws {StatusResponseError} With status NotFound if the requested chimeId is not present in installedChimeSounds.
   */
  // oxlint-disable-next-line typescript/require-await
  override async playChimeSound(request: Chime.PlayChimeSoundRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    // Matter 1.6.0 § 11.8.6.1.2: Respond to PlayChimeSound with SUCCESS and no other side effects while Enabled is false.
    if (!this.state.enabled) {
      device.log.debug(`MatterbridgeChimeServer: playChimeSound called but chime is disabled (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
      return;
    }
    const chimeId = request.chimeId ?? this.state.selectedChime;
    // Matter 1.6.0 § 11.8.6.1.2: Respond to PlayChimeSound with NOT_FOUND if the passed in ChimeID has no entry in InstalledChimeSounds.
    if (!this.state.installedChimeSounds.some((chimeSound) => chimeSound.chimeId === chimeId)) {
      throw new StatusResponseError(
        `MatterbridgeChimeServer: chime sound ${chimeId} is not present in installedChimeSounds (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.NotFound,
      );
    }
    device.log.info(`MatterbridgeChimeServer: playing chime sound with chimeId ${chimeId} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 11.8.7.1: Generate the ChimeStartedPlaying event when the chime sound starts playing.
    this.events.chimeStartedPlaying.emit({ chimeId }, this.context);
    this.endpoint.emitCommand(Chime, 'playChimeSound', request, this.context);
  }
}

/**
 *  Creates a default Chime cluster server on the given endpoint.
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to create the Chime cluster server on.
 * @param {Chime.ChimeSound[]} installedChimeSounds - The list of installed chime sounds.
 * @param {ChimeId} selectedChime - The id of the currently selected chime sound.
 * @param {boolean} enabled - Whether the Chime cluster server is enabled.
 * @returns {MatterbridgeEndpoint} The endpoint with the Chime cluster server created.
 */
export function createDefaultChimeClusterServer(
  endpoint: MatterbridgeEndpoint,
  installedChimeSounds: Chime.ChimeSound[],
  selectedChime: ChimeId,
  enabled: boolean = true,
): MatterbridgeEndpoint {
  endpoint.behaviors.require(MatterbridgeChimeServer, {
    installedChimeSounds,
    selectedChime,
    enabled,
  });
  return endpoint;
}
