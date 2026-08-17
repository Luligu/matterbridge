/**
 * @file packages/core/src/behaviors/deviceEnergyManagementServer.ts
 * @description This file contains the MatterbridgeDeviceEnergyManagementServer class of Matterbridge.
 * @author Luca Liguori
 * @created 2026-03-28
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

/* oxlint-disable typescript/no-namespace */
/* oxlint-disable typescript/no-unsafe-type-assertion */
/* oxlint-disable no-bitwise */

import { Seconds, Time, type Timer } from '@matter/general';
import { DeviceEnergyManagementServer } from '@matter/node/behaviors/device-energy-management';
import { Status, StatusResponseError } from '@matter/types';
import { DeviceEnergyManagement } from '@matter/types/clusters/device-energy-management';

import type { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { MatterbridgeServer } from './matterbridgeServer.js';

/** The PowerAdjustmentCapability attribute's PowerAdjustStruct entry shape (Matter 1.6 Application Cluster Spec § 9.2.7.1). */
type PowerAdjustEntry = { minPower: number; maxPower: number; minDuration: number; maxDuration: number };

/**
 * DeviceEnergyManagement server forwarding energy management commands to the Matterbridge command handler.
 *
 * matter.js provides no default implementation of the PowerAdjustment feature's commands and events (unlike e.g.
 * OnOff, where the base server class already implements spec-compliant state transitions and this class only
 * forwards to the command handler before delegating to `super`), so this class implements PowerAdjustRequest and
 * CancelPowerAdjustRequest itself: validating against PowerAdjustmentCapability and OptOutState, driving ESAState
 * and PowerAdjustmentCapability.Cause, emitting PowerAdjustStart/PowerAdjustEnd, and reacting to OptOutState changes
 * that must cancel an active session (Matter 1.6 Application Cluster Spec § 9.2.9.1, § 9.2.9.2, § 9.2.8.8).
 */
export class MatterbridgeDeviceEnergyManagementServer extends DeviceEnergyManagementServer.with(
  DeviceEnergyManagement.Feature.PowerForecastReporting,
  DeviceEnergyManagement.Feature.PowerAdjustment,
) {
  // Session bookkeeping lives on `this.internal` (backed once per endpoint behavior), not plain private class
  // fields — matter.js's Reactors system rebinds `this` to a fresh behavior instance for each reaction (see
  // thermostatServer.ts's own note on this), so a private field set during a command call would read back as
  // undefined from #handleOptOutStateChanged/#completePowerAdjustmentOnTimeout, which run as separate reactions.
  declare protected internal: MatterbridgeDeviceEnergyManagementServer.Internal;

  override async initialize(): Promise<void> {
    await super.initialize();
    // oxlint-disable-next-line typescript/unbound-method
    this.internal.powerAdjustCompletionCallback = this.callback(this.#completePowerAdjustmentOnTimeout, { lock: true });
    // § 9.2.8.8 OptOutState "Effect on Receipt": if the user opts out of the cause that a PowerAdjustActive session
    // is currently running under, the ESA shall behave as if it had received a CancelPowerAdjustRequest command.
    // oxlint-disable-next-line typescript/unbound-method
    this.reactTo(this.events.optOutState$Changed, this.#handleOptOutStateChanged);
  }

  /**
   * Forwards the PowerAdjustRequest to the Matterbridge command handler first (the established Matterbridge
   * contract — see e.g. onOffServer.ts — is to notify the plugin before any validation), then validates and
   * applies it (Matter 1.6 Application Cluster Spec § 9.2.9.1).
   *
   * @param {DeviceEnergyManagement.PowerAdjustRequest} request - Power-adjust request payload.
   */
  override async powerAdjustRequest(request: DeviceEnergyManagement.PowerAdjustRequest): Promise<void> {
    const { power, duration, cause } = request;
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Adjusting power to ${power} duration ${duration} cause ${cause} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('DeviceEnergyManagement.powerAdjustRequest', {
      command: 'powerAdjustRequest',
      request,
      cluster: DeviceEnergyManagementServer.id,
      attributes: this.state,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeDeviceEnergyManagementServer powerAdjustRequest called with power ${power} duration ${duration} cause ${cause}`);

    const entries = (this.state.powerAdjustmentCapability?.powerAdjustCapability ?? []) as PowerAdjustEntry[];
    if (entries.length === 0) {
      throw new StatusResponseError('No power adjustment capability available', Status.ConstraintError);
    }
    const minPower = Math.min(...entries.map((entry) => entry.minPower));
    const maxPower = Math.max(...entries.map((entry) => entry.maxPower));
    const minDuration = Math.min(...entries.map((entry) => entry.minDuration));
    const maxDuration = Math.max(...entries.map((entry) => entry.maxDuration));
    // § 9.2.9.1.1 / § 9.2.9.1.2: Power/Duration shall be between the PowerAdjustStruct's Min/Max fields.
    if (power < minPower || power > maxPower || duration < minDuration || duration > maxDuration) {
      throw new StatusResponseError('Power or duration out of range', Status.ConstraintError);
    }
    // § 9.2.8.8: reject commands whose AdjustmentCauseEnum matches a cause the user has opted out of.
    const optOutBit =
      cause === DeviceEnergyManagement.AdjustmentCause.LocalOptimization ? DeviceEnergyManagement.OptOutState.LocalOptOut : DeviceEnergyManagement.OptOutState.GridOptOut;
    if ((this.state.optOutState & optOutBit) !== 0) {
      throw new StatusResponseError('User has opted out of this adjustment cause', Status.ConstraintError);
    }

    const wasActive = this.state.esaState === DeviceEnergyManagement.EsaState.PowerAdjustActive;
    const adjustReason =
      cause === DeviceEnergyManagement.AdjustmentCause.LocalOptimization
        ? DeviceEnergyManagement.PowerAdjustReason.LocalOptimizationAdjustment
        : DeviceEnergyManagement.PowerAdjustReason.GridOptimizationAdjustment;

    this.internal.powerAdjustCompletionTimer?.stop();
    this.internal.powerAdjustPowerMw = Number(power);
    this.state.esaState = DeviceEnergyManagement.EsaState.PowerAdjustActive;
    this.state.powerAdjustmentCapability = { powerAdjustCapability: entries, cause: adjustReason };
    if (!wasActive) {
      // Only the transition out of Online starts a new session and emits PowerAdjustStart — a cause-only update
      // while already active (e.g. switching from LocalOptimization to GridOptimization) must not restart it, so a
      // later PowerAdjustEnd still reports the duration elapsed since the original activation.
      this.internal.powerAdjustActivationTimeMs = Time.nowMs;
      this.events.powerAdjustStart.emit(undefined, this.context);
    }
    // v8 ignore else -- powerAdjustCompletionCallback is unconditionally set in initialize(), before any command can run.
    if (this.internal.powerAdjustCompletionCallback) {
      this.internal.powerAdjustCompletionTimer = Time.getTimer(
        'DeviceEnergyManagement power adjust completion',
        Seconds(duration),
        this.internal.powerAdjustCompletionCallback,
      ).start();
    }
  }

  /**
   * Forwards CancelPowerAdjustRequest to the Matterbridge command handler first (same contract as
   * powerAdjustRequest), then cancels the in-progress power adjustment (Matter 1.6 Application Cluster Spec
   * § 9.2.9.2).
   */
  override async cancelPowerAdjustRequest(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Cancelling power adjustment (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('DeviceEnergyManagement.cancelPowerAdjustRequest', {
      command: 'cancelPowerAdjustRequest',
      request: {},
      cluster: DeviceEnergyManagementServer.id,
      attributes: this.state,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeDeviceEnergyManagementServer cancelPowerAdjustRequest called`);

    if (this.state.esaState !== DeviceEnergyManagement.EsaState.PowerAdjustActive) {
      throw new StatusResponseError('No power adjustment is currently active', Status.InvalidInState);
    }
    this.#endPowerAdjustment(DeviceEnergyManagement.Cause.Cancelled);
  }

  #handleOptOutStateChanged(optOutState: DeviceEnergyManagement.OptOutState): void {
    if (this.state.esaState !== DeviceEnergyManagement.EsaState.PowerAdjustActive) return;
    const activeCause = this.state.powerAdjustmentCapability?.cause;
    const optedOutOfActiveCause =
      (activeCause === DeviceEnergyManagement.PowerAdjustReason.LocalOptimizationAdjustment && (optOutState & DeviceEnergyManagement.OptOutState.LocalOptOut) !== 0) ||
      (activeCause === DeviceEnergyManagement.PowerAdjustReason.GridOptimizationAdjustment && (optOutState & DeviceEnergyManagement.OptOutState.GridOptOut) !== 0);
    if (!optedOutOfActiveCause) return;
    this.#endPowerAdjustment(DeviceEnergyManagement.Cause.UserOptOut);
  }

  #completePowerAdjustmentOnTimeout(): void {
    this.internal.powerAdjustCompletionTimer = undefined;
    this.#endPowerAdjustment(DeviceEnergyManagement.Cause.NormalCompletion);
  }

  /**
   * Ends the active power adjustment session (natural completion, cancellation, or opt-out) and fires PowerAdjustEnd.
   *
   * @param {DeviceEnergyManagement.Cause} cause - The reason the session ended.
   */
  #endPowerAdjustment(cause: DeviceEnergyManagement.Cause): void {
    this.internal.powerAdjustCompletionTimer?.stop();
    this.internal.powerAdjustCompletionTimer = undefined;
    // powerAdjustActivationTimeMs/powerAdjustPowerMw are always set together with ESAState=PowerAdjustActive by
    // powerAdjustRequest(), and #endPowerAdjustment() is only reachable while that state holds (cancel/opt-out
    // both check it, and the completion timer only exists after activation) — the fallbacks below are defensive.
    /* v8 ignore next */
    const activationTimeMs = this.internal.powerAdjustActivationTimeMs ?? Time.nowMs;
    const elapsedSeconds = Math.max(1, Math.round((Time.nowMs - activationTimeMs) / 1000));
    /* v8 ignore next */
    const powerMw = Math.abs(this.internal.powerAdjustPowerMw ?? 0);
    // § 9.2.10.2.3: approximate energy used during the session, derived from power(mW) * duration(h).
    const energyUse = Math.max(1, Math.round((powerMw * elapsedSeconds) / 3600));
    this.internal.powerAdjustActivationTimeMs = undefined;
    this.internal.powerAdjustPowerMw = undefined;
    const entries = (this.state.powerAdjustmentCapability?.powerAdjustCapability ?? []) as PowerAdjustEntry[];
    this.state.esaState = DeviceEnergyManagement.EsaState.Online;
    this.state.powerAdjustmentCapability = { powerAdjustCapability: entries, cause: DeviceEnergyManagement.PowerAdjustReason.NoAdjustment };
    this.events.powerAdjustEnd.emit({ cause, duration: elapsedSeconds, energyUse }, this.context);
  }
}

/* v8 ignore start */
export namespace MatterbridgeDeviceEnergyManagementServer {
  /**
   * Internal state for MatterbridgeDeviceEnergyManagementServer.
   */
  export class Internal {
    powerAdjustActivationTimeMs: number | undefined;
    powerAdjustPowerMw: number | undefined;
    powerAdjustCompletionTimer: Timer | undefined;
    powerAdjustCompletionCallback: (() => void) | undefined;
  }
}
/* v8 ignore stop */
