/**
 * @file packages/core/src/behaviors/fanControlServer.ts
 * @description This file contains the MatterbridgeFanControlServer class of Matterbridge.
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

/* oxlint-disable typescript/no-unsafe-type-assertion */
/* oxlint-disable typescript/unbound-method */

import type { MaybePromise } from '@matter/general';
import { FanControlServer } from '@matter/node/behaviors/fan-control';
import { Status, StatusResponseError } from '@matter/types';
import { FanControl } from '@matter/types/clusters/fan-control';
import { getEnumDescription } from '@matterbridge/utils/enum';

import type { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';
import { MatterbridgeServer } from './matterbridgeServer.js';

/** The FanMode values supported by each FanModeSequence (Matter 1.6 Application Cluster Spec § 4.4.5.6). */
const supportedFanModesBySequence: Record<FanControl.FanModeSequence, ReadonlySet<FanControl.FanMode>> = {
  [FanControl.FanModeSequence.OffLowMedHigh]: new Set([FanControl.FanMode.Off, FanControl.FanMode.Low, FanControl.FanMode.Medium, FanControl.FanMode.High]),
  [FanControl.FanModeSequence.OffLowHigh]: new Set([FanControl.FanMode.Off, FanControl.FanMode.Low, FanControl.FanMode.High]),
  [FanControl.FanModeSequence.OffLowMedHighAuto]: new Set([
    FanControl.FanMode.Off,
    FanControl.FanMode.Low,
    FanControl.FanMode.Medium,
    FanControl.FanMode.High,
    FanControl.FanMode.Auto,
  ]),
  [FanControl.FanModeSequence.OffLowHighAuto]: new Set([FanControl.FanMode.Off, FanControl.FanMode.Low, FanControl.FanMode.High, FanControl.FanMode.Auto]),
  [FanControl.FanModeSequence.OffHighAuto]: new Set([FanControl.FanMode.Off, FanControl.FanMode.High, FanControl.FanMode.Auto]),
  [FanControl.FanModeSequence.OffHigh]: new Set([FanControl.FanMode.Off, FanControl.FanMode.High]),
};

/** The Low/Medium/High FanMode values, in ascending order, that share the 1-100 PercentSetting domain (Off keeps 0 for itself, Auto keeps null). */
const steppedFanModes = [FanControl.FanMode.Low, FanControl.FanMode.Medium, FanControl.FanMode.High] as const;

/** A contiguous, inclusive [start, end] slice of the 1-100 PercentSetting domain mapped to one FanMode value. */
interface PercentRange {
  fanMode: FanControl.FanMode;
  start: number;
  end: number;
}

/**
 * Computes the PercentSetting ranges for the FanMode values a FanModeSequence supports (Matter 1.6 Application
 * Cluster Spec § 4.4.6.3.1 Percent Rules).
 *
 * @param {FanControl.FanModeSequence} sequence - The FanModeSequence currently in effect.
 * @returns {PercentRange[]} The ranges, one per supported Low/Medium/High value, in ascending order.
 *
 * @remarks
 * Off (value 0) and Auto (value null) are always ranges of one by themselves and are handled separately by the
 * callers of this function; this only computes how the remaining 1-100 domain is divided among the supported
 * Low/Medium/High values. The spec leaves the exact split up to the manufacturer as long as the ranges are
 * non-overlapping, contiguous, ascending, and cover every value from 1 to 100 — this divides the domain into equal
 * shares, one per supported value, using the same `floor(100 * i / n)` boundary the spec's own worked example
 * follows (a 3-way split of 1-100 into 1-33 / 34-66 / 67-100).
 */
function computePercentRanges(sequence: FanControl.FanModeSequence): PercentRange[] {
  // Step 1: keep only the Low/Medium/High values this FanModeSequence actually supports, in ascending order.
  const supported = supportedFanModesBySequence[sequence];
  const modes = steppedFanModes.filter((fanMode) => supported.has(fanMode));

  // Step 2: walk the supported values and carve out one contiguous slice of 1-100 per value. Each slice ends at
  // floor(100 * position / count), so the ranges are non-overlapping, ascending, and the last one always ends at
  // exactly 100.
  const ranges: PercentRange[] = [];
  let start = 1;
  modes.forEach((fanMode, index) => {
    const end = Math.floor((100 * (index + 1)) / modes.length);
    ranges.push({ fanMode, start, end });
    start = end + 1;
  });
  return ranges;
}

/**
 * Maps a non-zero PercentSetting/PercentCurrent value to the FanMode value whose range contains it (Matter 1.6
 * Application Cluster Spec § 4.4.6.3.1 Percent Rules).
 *
 * @param {number} percent - A value from 1 to 100 (0 always maps to Off and is handled by the caller).
 * @param {FanControl.FanModeSequence} sequence - The FanModeSequence currently in effect.
 * @returns {FanControl.FanMode} The FanMode value whose range contains `percent`.
 */
function percentToFanMode(percent: number, sequence: FanControl.FanModeSequence): FanControl.FanMode {
  const ranges = computePercentRanges(sequence);
  const range = ranges.find((candidate) => percent >= candidate.start && percent <= candidate.end);
  // The ranges returned by computePercentRanges() always cover 1-100 completely, so a caller passing a value in
  // that domain (guaranteed by the "percent" attribute type) always finds a match.
  /* v8 ignore next */
  return range?.fanMode ?? FanControl.FanMode.High;
}

/**
 * FanControl server (auto + step) that forwards step commands to the Matterbridge command handler and enforces the
 * FanMode and PercentSetting attribute rules of Matter 1.6 Application Cluster Spec § 4.4.6.1 and § 4.4.6.3.
 *
 * @remarks
 * matter.js's base FanControlServer only defaults FanMode to Off on startup; it does not validate writes against
 * FanModeSequence, apply the Off/Auto/On/Smart value rules, or keep FanMode and PercentSetting in sync, so this
 * class implements all of that itself:
 * - § 4.4.6.1 (chapeau): a FanMode value not supported by the current FanModeSequence is rejected with CONSTRAINT_ERROR.
 * - § 4.4.6.1.1 Off Value: sets PercentSetting/PercentCurrent (and SpeedSetting/SpeedCurrent if present) to 0.
 * - § 4.4.6.1.2 Auto Value: sets PercentSetting (and SpeedSetting if present) to null.
 * - § 4.4.6.1.3 On Value: a write of On is remapped to High.
 * - § 4.4.6.1.4 Smart Value: a write of Smart is remapped to Auto if the Auto feature is supported, otherwise High.
 * - § 4.4.6.1 / § 4.4.6.3.1: writing FanMode to Low/Medium/High sets PercentSetting to a value within the range
 *   mapped to that FanMode, unless the current PercentSetting already falls in that range.
 * - § 4.4.6.3 (chapeau): a write of null to PercentSetting leaves the attribute unchanged.
 * - § 4.4.6.3.1 Percent Rules: writing PercentSetting sets FanMode to the value of the range it falls into, and
 *   SpeedSetting (if present) via the SpeedMax formula.
 *
 * INVALID_IN_STATE (the server refusing a value because of device-specific conditions) is left to the plugin, since
 * it depends on knowledge this generic server does not have.
 */
export class MatterbridgeFanControlServer extends FanControlServer.with(FanControl.Feature.Auto, FanControl.Feature.Step) {
  /**
   * Registers the FanMode and PercentSetting pre-commit handlers that enforce the attribute rules.
   *
   * @returns {MaybePromise} The result of the base class initialization.
   */
  override initialize(): MaybePromise {
    const result = super.initialize();
    this.reactTo(this.events.fanMode$Changing, this.#handleFanModeChanging);
    this.reactTo(this.events.percentSetting$Changing, this.#handlePercentSettingChanging);
    return result;
  }

  /**
   * Enforces the FanMode attribute write rules (Matter 1.6 Application Cluster Spec § 4.4.6.1).
   *
   * @param {FanControl.FanMode} fanMode - The FanMode value being written.
   */
  #handleFanModeChanging(fanMode: FanControl.FanMode): void {
    // § 4.4.6.1.3 On Value / § 4.4.6.1.4 Smart Value: substitute the requested value. The substituted value is
    // written back to state.fanMode, which re-triggers this handler on the next pre-commit cycle to validate and
    // apply it, so nothing else needs to happen here.
    // oxlint-disable-next-line typescript/no-deprecated
    if (fanMode === FanControl.FanMode.On) {
      this.state.fanMode = FanControl.FanMode.High;
      return;
    }
    // oxlint-disable-next-line typescript/no-deprecated
    if (fanMode === FanControl.FanMode.Smart) {
      this.state.fanMode = this.features.auto ? FanControl.FanMode.Auto : FanControl.FanMode.High;
      return;
    }

    // If an attempt is made to set this attribute to a value not supported by the server as indicated in the
    // FanModeSequence attribute, the server SHALL respond with CONSTRAINT_ERROR.
    if (!supportedFanModesBySequence[this.state.fanModeSequence].has(fanMode)) {
      throw new StatusResponseError(
        `FanMode ${getEnumDescription(FanControl.FanMode, fanMode)} is not supported by FanModeSequence ${getEnumDescription(FanControl.FanModeSequence, this.state.fanModeSequence)}`,
        Status.ConstraintError,
      );
    }

    if (fanMode === FanControl.FanMode.Off) {
      // § 4.4.6.1.1 Off Value
      this.state.percentSetting = 0;
      this.state.percentCurrent = 0;
      if (this.features.multiSpeed) {
        const state = this.state as unknown as { speedSetting: number | null; speedCurrent: number };
        state.speedSetting = 0;
        state.speedCurrent = 0;
      }
    } else if (fanMode === FanControl.FanMode.Auto) {
      // § 4.4.6.1.2 Auto Value
      this.state.percentSetting = null;
      if (this.features.multiSpeed) {
        (this.state as unknown as { speedSetting: number | null }).speedSetting = null;
      }
    } else {
      // § 4.4.6.1 (chapeau) / § 4.4.6.3.1 Percent Rules: a successful FanMode write to Low/Medium/High must leave
      // PercentSetting at a value within the range that maps to it.
      const { percentSetting } = this.state;
      // percentToFanMode() only maps values 1-100 (0 is Off's own range, handled by the branch above), so 0 must be
      // excluded here too or it would be mistaken for "already in range" of whatever Low/Medium/High is checked.
      const alreadyInRange = percentSetting !== null && percentSetting !== 0 && percentToFanMode(percentSetting, this.state.fanModeSequence) === fanMode;
      // Step: only re-derive PercentSetting when the current value does not already fall in the target range —
      // this is what keeps a PercentSetting-driven FanMode change (handled by #handlePercentSettingChanging) from
      // having the value it just wrote snapped to an arbitrary point in the same range.
      if (!alreadyInRange) {
        const range = computePercentRanges(this.state.fanModeSequence).find((candidate) => candidate.fanMode === fanMode);
        // The CONSTRAINT_ERROR check above already guarantees `fanMode` is one of the values computePercentRanges()
        // returns a range for, so `range` is always defined here.
        /* v8 ignore next */
        if (range) this.state.percentSetting = Math.round((range.start + range.end) / 2);
      }
    }
  }

  /**
   * Enforces the PercentSetting attribute write rules (Matter 1.6 Application Cluster Spec § 4.4.6.3).
   *
   * @param {number | null} percentSetting - The PercentSetting value being written.
   * @param {number | null} oldPercentSetting - The PercentSetting value before this write.
   */
  #handlePercentSettingChanging(percentSetting: number | null, oldPercentSetting: number | null): void {
    // Step 1 (§ 4.4.6.3 chapeau): "If a client writes null to this attribute, the attribute value SHALL NOT
    // change." Writing the old value back is a no-op once this commits, so the write is effectively rejected.
    // Exception: this is also how #handleFanModeChanging nulls PercentSetting as the mandated side effect of a
    // FanMode=Auto transition (§ 4.4.6.1.2 Auto Value); by the time that cascades here FanMode has already settled
    // to Auto, so that case must be let through rather than reverted.
    if (percentSetting === null) {
      if (this.state.fanMode === FanControl.FanMode.Auto) return;
      this.state.percentSetting = oldPercentSetting;
      return;
    }

    // Step 2 (§ 4.4.6.3.1 Percent Rules): find which FanMode range this PercentSetting value falls into — 0 is
    // always its own range mapping to Off; any other value falls into one of the Low/Medium/High ranges.
    const fanMode = percentSetting === 0 ? FanControl.FanMode.Off : percentToFanMode(percentSetting, this.state.fanModeSequence);

    // Step 3: "the server SHALL set the FanMode attribute to the value of the corresponding range." Only assign
    // when it actually differs, so an already-consistent FanMode is left untouched (and #handleFanModeChanging is
    // not triggered needlessly).
    if (fanMode !== this.state.fanMode) this.state.fanMode = fanMode;

    // Step 4 (§ 4.4.6.3.1): "the value of the SpeedSetting ... attribute[] SHALL be calculated from the
    // PercentSetting ... attribute[] ... speed = ceil( SpeedMax * (percent * 0.01) )".
    if (this.features.multiSpeed) {
      const state = this.state as unknown as { speedSetting: number | null; speedMax: number };
      state.speedSetting = Math.ceil(state.speedMax * (percentSetting * 0.01));
    }
  }

  /**
   * Forwards Step requests to the Matterbridge command handler and updates percentCurrent.
   *
   * @param {FanControl.StepRequest} request - Step request payload.
   */
  override async step(request: FanControl.StepRequest): Promise<void> {
    const lookupStepDirection = ['Increase', 'Decrease'];
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Stepping fan with direction ${lookupStepDirection[request.direction]} wrap: ${request.wrap} lowestOff: ${request.lowestOff} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('FanControl.step', {
      command: 'step',
      request,
      cluster: FanControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof FanControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });

    device.log.debug(`MatterbridgeFanControlServer: step called with direction: ${lookupStepDirection[request.direction]} wrap: ${request.wrap} lowestOff: ${request.lowestOff}`);
    device.log.debug(`- current percentCurrent: ${this.state.percentCurrent}`);

    if (request.direction === FanControl.StepDirection.Increase) {
      if (request.wrap && this.state.percentCurrent === 100) {
        this.state.percentCurrent = request.lowestOff ? 0 : 10;
      } else this.state.percentCurrent = Math.min(this.state.percentCurrent + 10, 100);
    } else if (request.direction === FanControl.StepDirection.Decrease) {
      if (request.wrap && this.state.percentCurrent === (request.lowestOff ? 0 : 10)) {
        this.state.percentCurrent = 100;
      } else this.state.percentCurrent = Math.max(this.state.percentCurrent - 10, request.lowestOff ? 0 : 10);
    }
    device.log.debug('Set percentCurrent to:', this.state.percentCurrent);

    // step is not implemented in matter.js
    // await super.step(request);
  }
}
