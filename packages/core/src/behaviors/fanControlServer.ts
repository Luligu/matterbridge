/**
 * @file packages/core/src/behaviors/fanControlServer.ts
 * @description This file contains the MatterbridgeFanControlServer class of Matterbridge.
 * @author Luca Liguori
 * @created 2026-03-28
 * @version 2.0.0
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

import type { MaybePromise, Observable } from '@matter/general';
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
 * Resolves the PercentSetting value a FanMode change to `fanMode` settles on (Matter 1.6 Application Cluster
 * Spec § 4.4.6.1.1 Off Value / § 4.4.6.3.1 Percent Rules), given `currentPercentSetting` (the settled value
 * before the change). Off always resolves to 0; Low/Medium/High keep the current value when it already falls in
 * the target range (so a PercentSetting-driven FanMode change isn't snapped to an arbitrary point in its own
 * range), otherwise resolve to the midpoint of that range.
 *
 * @param {FanControl.FanMode} fanMode - The FanMode value being resolved to (must not be Auto/On/Smart — those
 * are handled by their own §4.4.6.1 rules before this is reached).
 * @param {number | null} currentPercentSetting - The PercentSetting value before the change.
 * @param {FanControl.FanModeSequence} sequence - The FanModeSequence currently in effect.
 * @returns {number} The PercentSetting value `fanMode` resolves to.
 */
function resolvePercentSettingForFanMode(fanMode: FanControl.FanMode, currentPercentSetting: number | null, sequence: FanControl.FanModeSequence): number {
  if (fanMode === FanControl.FanMode.Off) return 0;
  // percentToFanMode() only maps values 1-100 (0 is Off's own range), so 0 must be excluded here too or it would
  // be mistaken for "already in range" of whatever Low/Medium/High is checked.
  const alreadyInRange = currentPercentSetting !== null && currentPercentSetting !== 0 && percentToFanMode(currentPercentSetting, sequence) === fanMode;
  if (alreadyInRange) return currentPercentSetting;
  const range = computePercentRanges(sequence).find((candidate) => candidate.fanMode === fanMode);
  // The caller guarantees `fanMode` is one of the values computePercentRanges() returns a range for.
  /* v8 ignore next */
  return range ? Math.round((range.start + range.end) / 2) : (currentPercentSetting ?? 0);
}

/**
 * Resolves the PercentSetting value a Step command's FanMode transition lands on (Matter 1.6 Application
 * Cluster Spec § 4.4.7.1.5), given the direction just stepped. Unlike a direct FanMode attribute write (any
 * value within the target range is spec-legal there, so resolvePercentSettingForFanMode() picks the range's
 * midpoint), the Step command's "lowest/highest step value" wording implies a minimal, discrete increment past
 * the range boundary — landing in the middle of the newly-entered range would overshoot it. When the current
 * PercentSetting already falls within the target range (e.g. clamping at the current end because Wrap is
 * false), it is left unchanged, same as resolvePercentSettingForFanMode().
 *
 * @param {FanControl.FanMode} fanMode - The FanMode value being stepped to (must not be Auto — Step never steps
 * to Auto; see #step()'s own doc comment).
 * @param {FanControl.StepDirection} direction - The direction just stepped.
 * @param {number | null} currentPercentSetting - The PercentSetting value before the step.
 * @param {FanControl.FanModeSequence} sequence - The FanModeSequence currently in effect.
 * @returns {number} The PercentSetting value this step lands on.
 */
function resolveStepPercentSettingForFanMode(
  fanMode: FanControl.FanMode,
  direction: FanControl.StepDirection,
  currentPercentSetting: number | null,
  sequence: FanControl.FanModeSequence,
): number {
  if (fanMode === FanControl.FanMode.Off) return 0;
  const alreadyInRange = currentPercentSetting !== null && currentPercentSetting !== 0 && percentToFanMode(currentPercentSetting, sequence) === fanMode;
  if (alreadyInRange) return currentPercentSetting;
  const range = computePercentRanges(sequence).find((candidate) => candidate.fanMode === fanMode);
  // The caller guarantees `fanMode` is one of the values computePercentRanges() returns a range for.
  /* v8 ignore next */
  if (!range) return currentPercentSetting ?? 0;
  return direction === FanControl.StepDirection.Increase ? range.start : range.end;
}

/**
 * Computes the SpeedSetting value a PercentSetting write maps to (Matter 1.6 Application Cluster Spec §
 * 4.4.6.3.1 / § 4.4.6.6.1: `speed = ceil( SpeedMax * (percent * 0.01) )`), written as `(speedMax * percent) /
 * 100` rather than `speedMax * (percent * 0.01)` — the latter is exact for some inputs but not others (e.g.
 * `70 * 0.01` is `0.7000000000000001` in IEEE 754 double precision, so `Math.ceil(10 * (70 * 0.01))` evaluates
 * to `8`, not the spec-intended `7`) since `0.01` has no exact binary floating-point representation; dividing by
 * 100 after multiplying two integers avoids introducing that imprecision in the first place.
 *
 * @param {number} speedMax - The SpeedMax attribute value.
 * @param {number} percent - A PercentSetting value from 0 to 100.
 * @returns {number} The corresponding SpeedSetting value.
 */
function speedSettingForPercent(speedMax: number, percent: number): number {
  return Math.ceil((speedMax * percent) / 100);
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
   * Registers the FanMode, PercentSetting, and (when the MultiSpeed feature is present) SpeedSetting pre-commit
   * handlers that enforce the attribute rules.
   *
   * @returns {MaybePromise} The result of the base class initialization.
   */
  override initialize(): MaybePromise {
    const result = super.initialize();
    this.reactTo(this.events.fanMode$Changing, this.#handleFanModeChanging);
    this.reactTo(this.events.percentSetting$Changing, this.#handlePercentSettingChanging);
    // The SpeedSetting attribute (and its $Changing event) only exists on a MatterbridgeFanControlServer.with(...)
    // subclass that includes the MultiSpeed feature, which this base class's own TS type does not — cast the
    // event lookup and use maybeReactTo() (a no-op when the observable is undefined) rather than reactTo(), so
    // this still works correctly for the common Auto+Step-only subclass this class itself declares.
    this.maybeReactTo((this.events as unknown as { speedSetting$Changing?: Observable<[number | null, number | null]> }).speedSetting$Changing, this.#handleSpeedSettingChanging);
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
      if (this.features.multiSpeed) {
        (this.state as unknown as { speedSetting: number | null }).speedSetting = 0;
      }
      // PercentCurrent/SpeedCurrent are read-only (no Write access), so a remote client's own FanMode write
      // transaction is not authorized to touch them directly — matter.js's AccessControl only exempts a local
      // actor or an in-flight command invocation (see AccessControl.ts's `hasLocalActor(session) ||
      // session.command` checks) from that read-only gate, and a plain attribute write is neither. asLocalActor()
      // temporarily strips the remote actor's fabric/subject from this reactor's write context so these two
      // internal, spec-mandated assignments are authorized like a local update instead of being rejected with
      // UNSUPPORTED_WRITE (136).
      this.agent.asLocalActor(() => {
        this.state.percentCurrent = 0;
        if (this.features.multiSpeed) {
          (this.state as unknown as { speedCurrent: number }).speedCurrent = 0;
        }
      });
    } else if (fanMode === FanControl.FanMode.Auto) {
      // § 4.4.6.1.2 Auto Value
      this.state.percentSetting = null;
      if (this.features.multiSpeed) {
        (this.state as unknown as { speedSetting: number | null }).speedSetting = null;
      }
    } else {
      // § 4.4.6.1 (chapeau) / § 4.4.6.3.1 Percent Rules: a successful FanMode write to Low/Medium/High must leave
      // PercentSetting at a value within the range that maps to it. Only assign when it actually differs, so an
      // already-in-range PercentSetting isn't snapped to an arbitrary point in its own range (also keeps a
      // PercentSetting-driven FanMode change, handled by #handlePercentSettingChanging, from re-triggering it).
      const resolved = resolvePercentSettingForFanMode(fanMode, this.state.percentSetting, this.state.fanModeSequence);
      if (resolved !== this.state.percentSetting) this.state.percentSetting = resolved;
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
      state.speedSetting = speedSettingForPercent(state.speedMax, percentSetting);
    }
  }

  /**
   * Enforces the SpeedSetting attribute write rules (Matter 1.6 Application Cluster Spec § 4.4.6.6.1 Speed
   * Rules) — the reciprocal of #handlePercentSettingChanging, for a client that writes SpeedSetting directly
   * instead of going through PercentSetting/FanMode. Only registered when the MultiSpeed feature is present (see
   * #initialize()).
   *
   * @param {number | null} speedSetting - The SpeedSetting value being written.
   * @param {number | null} oldSpeedSetting - The SpeedSetting value before this write.
   *
   * @remarks
   * § 4.4.6.6.1 mandates a FanMode-to-SpeedSetting range mapping symmetric to the one § 4.4.6.3.1 mandates for
   * PercentSetting, explicitly calling out one boundary case ("If a client successfully sets the SpeedSetting
   * attribute to 0, the server SHALL set the FanMode attribute to Off and the PercentSetting attribute to 0")
   * but otherwise leaving the exact mapping manufacturer-defined, same as PercentSetting's. This recovers the
   * equivalent PercentSetting value from SpeedSetting by inverting the forward formula
   * #handlePercentSettingChanging already applies (`speedSetting = ceil(speedMax * (percent * 0.01))`), then
   * reuses `percentToFanMode()` — the same range mapping PercentSetting uses — to find the corresponding
   * FanMode, so both attributes are always mapped through one single, consistent range table regardless of
   * which of the two a client writes.
   *
   * This event also fires for the SpeedSetting write #handlePercentSettingChanging's own Step 4 makes as a side
   * effect of a PercentSetting write — matter.js queues a `$Changing` reactor a nested state assignment triggers
   * rather than invoking it synchronously inside that assignment, so by the time this handler runs here,
   * PercentSetting already holds its final, committed value (verified directly against a running instance). This
   * is used, rather than a reentrancy flag, to detect and skip that cascade: if the current PercentSetting
   * already forward-maps (via the same formula above) to the incoming SpeedSetting value, this change is already
   * consistent with it and nothing further needs to happen — reverse-mapping it too would do redundant, and
   * sometimes lossy, work (SpeedSetting has only SpeedMax+1 distinct values against PercentSetting's 100, so the
   * reverse mapping does not always recover the exact PercentSetting value that produced it; e.g. with SpeedMax
   * 10, PercentSetting 1 forward-maps to SpeedSetting 1, but SpeedSetting 1 alone reverse-maps to PercentSetting
   * 10 — applying that reverse mapping to this cascade would silently overwrite the client's own PercentSetting
   * write moments after it committed). Only a SpeedSetting value inconsistent with the current PercentSetting —
   * i.e. one a client wrote directly — should drive FanMode/PercentSetting the other way.
   */
  #handleSpeedSettingChanging(speedSetting: number | null, oldSpeedSetting: number | null): void {
    const state = this.state as unknown as { speedSetting: number | null; speedMax: number };

    // § 4.4.6.6 chapeau shares the same "a write of null SHALL NOT change the attribute" wording as § 4.4.6.3
    // for PercentSetting; the same Auto-transition exception applies (see #handlePercentSettingChanging).
    if (speedSetting === null) {
      if (this.state.fanMode === FanControl.FanMode.Auto) return;
      state.speedSetting = oldSpeedSetting;
      return;
    }

    const { percentSetting } = this.state;
    if (percentSetting !== null && speedSettingForPercent(state.speedMax, percentSetting) === speedSetting) return;

    // Recover the equivalent PercentSetting value and, from it, the FanMode range it falls into.
    const percent = speedSetting === 0 ? 0 : Math.min(100, Math.round((speedSetting / state.speedMax) * 100));
    const fanMode = percent === 0 ? FanControl.FanMode.Off : percentToFanMode(percent, this.state.fanModeSequence);

    // Only assign when it actually differs, so an already-consistent FanMode is left untouched (and
    // #handleFanModeChanging is not triggered needlessly — it would otherwise re-derive PercentSetting/SpeedSetting
    // from the old PercentSetting instead of the value just computed below).
    if (fanMode !== this.state.fanMode) this.state.fanMode = fanMode;

    // Keep PercentSetting consistent with the SpeedSetting value just written, the same way
    // #handlePercentSettingChanging keeps SpeedSetting consistent with a PercentSetting write. Unconditional and
    // last, since #handleFanModeChanging's own Percent Rules handling (triggered by the FanMode assignment above,
    // when it runs) would otherwise snap PercentSetting to its range's midpoint instead of this precise value.
    if (percent !== this.state.percentSetting) this.state.percentSetting = percent;
  }

  /**
   * Forwards Step requests to the Matterbridge command handler, then applies the Matter 1.6 Application Cluster
   * Spec Sec 4.4.7.1.5 (Effect Upon Receipt) step rules to the FanMode/PercentSetting/SpeedSetting attributes.
   *
   * @param {FanControl.StepRequest} request - Step request payload.
   *
   * @remarks
   * Per Sec 4.4.7.1, the Step command "indirectly changes the speed-oriented attributes ... in steps rather than
   * using the speed-oriented attributes ... directly", and "how this command is interpreted by the server and
   * how it affects the values of the speed-oriented attributes is implementation specific". Matterbridge models
   * the step sequence as the ordered set of FanMode positions the current FanModeSequence supports (Off — only
   * when the LowestOff field is set — followed by whichever of Low/Medium/High that sequence allows, in that
   * ascending order; Auto is excluded, since it has no fixed percent/speed point to step to). This matches the
   * spec's own worked example almost exactly: "the server reacts to the command by setting the value of the
   * FanMode attribute ..., which in turn sets the PercentSetting and SpeedSetting (if present) attributes to
   * appropriate values, as defined by [the Percent Rules and Speed Rules]". FanMode is driven through
   * `this.state.fanMode` so #handleFanModeChanging's Off Value / Percent Rules handling (§ 4.4.6.1.1 /
   * § 4.4.6.3.1) still runs and stays the single place that logic lives; PercentSetting/SpeedSetting are,
   * however, computed here too via the shared `resolvePercentSettingForFanMode()` helper (rather than read back
   * from `this.state` after the `fanMode` assignment above), because matter.js only applies a `reactTo` write's
   * effect on `this.state` at end-of-transaction commit — a synchronous read immediately after the triggering
   * assignment, still inside this same command handler, observes the pre-transaction value, not the reactor's
   * pending one. Verified directly against a running container: reading `this.state.percentSetting` right after
   * `this.state.fanMode = target` returned the OLD value even though the write had already been accepted, while
   * a follow-up `chip-tool` read after the command finished returned the correct, reactor-derived one.
   *
   * The Direction/Wrap/LowestOff handling below (find the nearest step value past the current position in the
   * requested direction; otherwise wrap to the opposite end or clamp to the same end) mirrors Sec 4.4.7.1.5's
   * "SHALL change to the lowest/highest step value ... Else if Wrap is TRUE ... Else ... change to (or remain
   * at) the highest/lowest step value" wording for both directions.
   *
   * PercentCurrent (and SpeedCurrent, when the MultiSpeed feature is present) are not derived by any FanMode or
   * PercentSetting reactor, since a real device only reports them once its motor has physically caught up with
   * the new setting. This synthetic endpoint has no such feedback loop, so they are set to converge immediately
   * with the PercentSetting/SpeedSetting values computed here.
   */
  override async step(request: FanControl.StepRequest): Promise<void> {
    const lookupStepDirection = ['Increase', 'Decrease'];
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Stepping fan with direction ${lookupStepDirection[request.direction]} wrap: ${request.wrap} lowestOff: ${request.lowestOff} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    // Let the plugin's own command handler react first (e.g. physically move the fan) before Matterbridge applies
    // the spec-mandated attribute effects below.
    await device.commandHandler.executeHandler('FanControl.step', {
      command: 'step',
      request,
      cluster: FanControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof FanControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });

    // Field defaults per Matter 1.6 Application Cluster Spec Sec 4.4.7.1 (Wrap: false, LowestOff: true) — TLV
    // omits an optional field entirely rather than sending its default, so request.wrap/lowestOff can arrive
    // as undefined.
    const wrap = request.wrap ?? false;
    const lowestOff = request.lowestOff ?? true;

    // Snapshot the settled, pre-transaction state this step is based on, before any attribute assignment below
    // makes further this.state reads unreliable (see the class-level remarks above).
    const currentFanMode = this.state.fanMode;
    const currentPercentSetting = this.state.percentSetting;
    const fanModeSequence = this.state.fanModeSequence;

    // Build the ordered set of step values (ascending FanMode enum order, so Off < Low < Medium < High already
    // holds without an explicit sort).
    const supported = supportedFanModesBySequence[fanModeSequence];
    const stepFanModes: FanControl.FanMode[] = [...(lowestOff ? [FanControl.FanMode.Off] : []), ...steppedFanModes.filter((fanMode) => supported.has(fanMode))];

    let targetFanMode: FanControl.FanMode;
    if (request.direction === FanControl.StepDirection.Increase) {
      const higher = stepFanModes.filter((fanMode) => fanMode > currentFanMode);
      // v8 ignore next: High is always mandatoryConform (Matter 1.6 Application Cluster Spec Sec 4.4.5.1), so
      // stepFanModes always has at least one entry and Math.min/Math.max never see an empty array.
      targetFanMode = higher.length > 0 ? Math.min(...higher) : wrap ? Math.min(...stepFanModes) : Math.max(...stepFanModes);
    } else {
      const lower = stepFanModes.filter((fanMode) => fanMode < currentFanMode);
      targetFanMode = lower.length > 0 ? Math.max(...lower) : wrap ? Math.max(...stepFanModes) : Math.min(...stepFanModes);
    }

    // Driving FanMode reuses #handleFanModeChanging's existing Off Value handling (Sec 4.4.6.1.1) as the single
    // place that logic lives, but its own Percent Rules handling (Sec 4.4.6.3.1) picks an arbitrary point within
    // the target range — fine for a plain FanMode attribute write, but not precise enough for Step's own
    // boundary-landing requirement (Sec 4.4.7.1.5), so PercentSetting is explicitly overridden below with
    // resolveStepPercentSettingForFanMode()'s result instead (see the class-level remarks above for why the
    // cascade's own result isn't read back and reused directly).
    if (targetFanMode !== currentFanMode) this.state.fanMode = targetFanMode;

    // Resolve the precise PercentSetting value this step lands on and converge PercentSetting, PercentCurrent
    // (and SpeedSetting/SpeedCurrent, via the Speed Rules formula of Sec 4.4.6.6.1, when the MultiSpeed feature
    // is present) onto it — all four are among the attributes Sec 4.4.7.1.5 says a Step command can change.
    const resolvedPercentSetting = resolveStepPercentSettingForFanMode(targetFanMode, request.direction, currentPercentSetting, fanModeSequence);
    if (resolvedPercentSetting !== this.state.percentSetting) this.state.percentSetting = resolvedPercentSetting;
    this.state.percentCurrent = resolvedPercentSetting;
    if (this.features.multiSpeed) {
      const state = this.state as unknown as { speedMax: number; speedCurrent: number };
      state.speedCurrent = speedSettingForPercent(state.speedMax, resolvedPercentSetting);
    }

    device.log.debug(
      `MatterbridgeFanControlServer: step applied fanMode ${getEnumDescription(FanControl.FanMode, targetFanMode)}, percentCurrent ${this.state.percentCurrent}` +
        (this.features.multiSpeed ? `, speedCurrent ${(this.state as unknown as { speedCurrent: number }).speedCurrent}` : ''),
    );

    // step is not implemented in matter.js
    // await super.step(request);
  }
}
