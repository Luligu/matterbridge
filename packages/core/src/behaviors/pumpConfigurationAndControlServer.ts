/**
 * @file packages/core/src/behaviors/pumpConfigurationAndControlServer.ts
 * @description This file contains the MatterbridgePumpConfigurationAndControlServer class of Matterbridge.
 * @author Luca Liguori
 * @created 2026-08-24
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

/* oxlint-disable typescript/no-namespace */

import type { MaybePromise } from '@matter/general';
import { LevelControlServer } from '@matter/node/behaviors/level-control';
import { OnOffServer } from '@matter/node/behaviors/on-off';
import { PumpConfigurationAndControlServer } from '@matter/node/behaviors/pump-configuration-and-control';
import { Status, StatusResponseError } from '@matter/types';
import { PumpConfigurationAndControl } from '@matter/types/clusters/pump-configuration-and-control';

import { MatterbridgeServer } from './matterbridgeServer.js';

/**
 * PumpConfigurationAndControl server that synchronizes pump state from OnOff and LevelControl clusters.
 */
export class MatterbridgePumpConfigurationAndControlServer extends PumpConfigurationAndControlServer.with(PumpConfigurationAndControl.Feature.ConstantSpeed) {
  declare protected internal: MatterbridgePumpConfigurationAndControlServer.Internal;

  /**
   * Registers OnOff and LevelControl state handlers used by Pump devices, and fills in reasonable
   * medium capacity pump defaults for any physical limit attribute left `null` by the caller.
   *
   * @returns {MaybePromise} The result of the base class initialization.
   */
  override initialize(): MaybePromise {
    this.state.minConstSpeed ??= 600; // 600 RPM
    this.state.maxConstSpeed ??= 3000; // 3000 RPM
    this.state.maxPressure ??= 6000; // 600 kPa (value x10)
    this.state.maxSpeed ??= 3000; // 3000 RPM
    this.state.maxFlow ??= 100; // 10 m3/h (value x10)
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgePumpConfigurationAndControlServer: initialized with minConstSpeed=${this.state.minConstSpeed}, maxConstSpeed=${this.state.maxConstSpeed}, maxPressure=${this.state.maxPressure}, maxSpeed=${this.state.maxSpeed}, maxFlow=${this.state.maxFlow} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );

    if (this.endpoint.behaviors.has(OnOffServer.id)) {
      // oxlint-disable-next-line typescript/unbound-method
      this.reactTo(this.agent.get(OnOffServer).events.onOff$Changed, this.#handleOnOffChanged);
    }
    if (this.endpoint.behaviors.has(LevelControlServer.id)) {
      const levelControlState = this.agent.get(LevelControlServer).state;
      this.internal.lastLevel = levelControlState.currentLevel ?? levelControlState.maxLevel;
      // oxlint-disable-next-line typescript/unbound-method
      this.reactTo(this.agent.get(LevelControlServer).events.currentLevel$Changed, this.#handleCurrentLevelChanged);
    }

    // oxlint-disable-next-line typescript/unbound-method
    this.reactTo(this.events.operationMode$Changing, this.#handleOperationModeChanging);
    // oxlint-disable-next-line typescript/unbound-method
    this.reactTo(this.events.operationMode$Changed, this.#handleOperationModeChanged);
  }

  /**
   * Maps a LevelControl CurrentLevel onto a pump setpoint percentage, per the Matter Device Library Pump
   * device type clarifications (§5.5.5.2): Level 0 stops the pump; Level 1-200 is a setpoint of Level/2
   * percent (0.5-100.0%); Level 201-255 is a setpoint of 100.0%.
   *
   * @param {number} currentLevel - The LevelControl CurrentLevel to map.
   * @returns {number} The resulting setpoint, in percent (0-100).
   */
  #percentFromLevel(currentLevel: number): number {
    // Matter 1.6.0 § 5.5.5.2: Level 0 stops the pump, so the setpoint is 0%.
    if (currentLevel <= 0) return 0;
    // Matter 1.6.0 § 5.5.5.2: Level 1-200 maps to a setpoint of Level/2 percent, while Level 201-255 maps to 100.0%.
    return currentLevel <= 200 ? currentLevel / 2 : 100;
  }

  /**
   * Converts a setpoint percentage into the Pump ConstantSpeed Speed attribute value, applying the
   * percentage to `maxConstSpeed`.
   *
   * @param {number} percent - The setpoint, in percent (0-100).
   * @returns {number} The resulting Speed attribute value.
   */
  #speedFromPercent(percent: number): number {
    const maxConstSpeed = this.state.maxConstSpeed ?? this.state.maxSpeed ?? 0;
    return Math.round((percent / 100) * maxConstSpeed);
  }

  /**
   * Converts a setpoint percentage into the Capacity attribute value (§4.2.7.17): "the actual capacity of
   * the pump as a percentage of the effective maximum setpoint value", in units of 0.005%.
   *
   * @param {number} percent - The setpoint, in percent (0-100).
   * @returns {number} The resulting Capacity attribute value.
   */
  #capacityFromPercent(percent: number): number {
    return Math.round(percent * 200);
  }

  /**
   * Computes the current setpoint (as a Speed value and its equivalent percentage) for OperationMode
   * (§4.2.6.2): Minimum and Maximum fix it to MinConstSpeed/MaxConstSpeed regardless of LevelControl;
   * Normal (§4.2.6.2.1) derives it from `normalLevel`, "e.g., by means of the Level Control cluster".
   *
   * @param {number} normalLevel - The LevelControl CurrentLevel to use while in Normal OperationMode.
   * @returns {{ speed: number; percent: number }} The Speed value and its equivalent setpoint percentage.
   */
  #currentSetpoint(normalLevel: number): { speed: number; percent: number } {
    const maxConstSpeed = this.state.maxConstSpeed ?? this.state.maxSpeed ?? 0;
    // Matter 1.6.0 § 4.2.6.2: OperationMode Minimum runs the pump at the minimum possible speed, independent of the LevelControl setpoint.
    if (this.state.operationMode === PumpConfigurationAndControl.OperationMode.Minimum) {
      const speed = this.state.minConstSpeed ?? 0;
      return { speed, percent: maxConstSpeed > 0 ? (speed / maxConstSpeed) * 100 : 0 };
    }
    // Matter 1.6.0 § 4.2.6.2: OperationMode Maximum runs the pump at its maximum possible speed, independent of the LevelControl setpoint.
    if (this.state.operationMode === PumpConfigurationAndControl.OperationMode.Maximum) {
      return { speed: maxConstSpeed, percent: 100 };
    }
    // Matter 1.6.0 § 4.2.6.2.1: In OperationMode Normal the setpoint is an internal variable controlled between 0% and 100%, e.g. by the Level Control cluster.
    const percent = this.#percentFromLevel(normalLevel);
    return { speed: this.#speedFromPercent(percent), percent };
  }

  /**
   * Applies the current OperationMode-appropriate setpoint (see #currentSetpoint()) to the Pump's Speed
   * and Capacity attributes. Both are Read-only (access "R V", no Write) per the Matter spec —
   * asLocalActor() authorizes this internal, spec-mandated update.
   *
   * @param {number} normalLevel - The LevelControl CurrentLevel to use while in Normal OperationMode.
   * @returns {{ speed: number; capacity: number }} The Speed and Capacity values that were applied.
   */
  #applySetpoint(normalLevel: number): { speed: number; capacity: number } {
    const { speed, percent } = this.#currentSetpoint(normalLevel);
    const capacity = this.#capacityFromPercent(percent);
    this.agent.asLocalActor(() => {
      // Matter 1.6.0 § 4.2.7.18: Speed indicates the actual speed of the pump in RPM and is updated dynamically as the speed changes.
      this.state.speed = speed;
      // Matter 1.6.0 § 4.2.7.17: Capacity indicates the actual capacity as a percentage of the effective maximum setpoint, in units of 0.005%.
      this.state.capacity = capacity;
    });
    return { speed, capacity };
  }

  /**
   * Stops the pump: sets Speed and Capacity to 0. Both are Read-only (access "R V", no Write) per the
   * Matter spec — asLocalActor() authorizes this internal, spec-mandated update.
   *
   * @returns {{ speed: number; capacity: number }} The Speed and Capacity values that were applied (always `{ speed: 0, capacity: 0 }`).
   */
  #stopPump(): { speed: number; capacity: number } {
    this.agent.asLocalActor(() => {
      // Matter 1.6.0 § 4.2.7.18 (with § 5.5.5.2, Level 0 stops the pump): Speed indicates the actual pump speed, which is 0 RPM while stopped.
      this.state.speed = 0;
      // Matter 1.6.0 § 4.2.7.17 (with § 5.5.5.2, Level 0 stops the pump): Capacity indicates the actual capacity, which is 0% while stopped.
      this.state.capacity = 0;
    });
    return { speed: 0, capacity: 0 };
  }

  /**
   * Rejects an OperationMode write while LocalOverride is set (§4.2.6.1.3): "Any request changing
   * OperationMode SHALL generate a FAILURE error status until LocalOverride is cleared on the physical
   * device."
   */
  #handleOperationModeChanging(): void {
    // Matter 1.6.0 § 4.2.6.1.3: While PumpStatus.LocalOverride is set, any request changing OperationMode SHALL generate a FAILURE error status.
    if (this.state.pumpStatus?.localOverride) {
      throw new StatusResponseError(
        `MatterbridgePumpConfigurationAndControlServer: operationMode cannot be changed while PumpStatus.LocalOverride is set (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.Failure,
      );
    }
  }

  /**
   * Reacts to OperationMode changes by mirroring the new value onto EffectiveOperationMode (§4.2.7.15):
   * "The value of the EffectiveOperationMode attribute is the same as the OperationMode attribute", unless
   * PumpStatus.LocalOverride is set — but #handleOperationModeChanging already rejects OperationMode writes
   * in that case, so this handler only ever runs while LocalOverride is clear. Also re-applies the setpoint
   * (§4.2.6.2): switching to/from Minimum or Maximum immediately forces Speed/Capacity to
   * MinConstSpeed/MaxConstSpeed, independent of LevelControl; switching back to Normal restores the
   * LevelControl-derived setpoint (§4.2.6.2.1).
   *
   * @param {PumpConfigurationAndControl.OperationMode} operationMode - The new OperationMode value.
   * @param {PumpConfigurationAndControl.OperationMode} oldOperationMode - The previous OperationMode value.
   */
  #handleOperationModeChanged(operationMode: PumpConfigurationAndControl.OperationMode, oldOperationMode: PumpConfigurationAndControl.OperationMode): void {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgePumpConfigurationAndControlServer: operationMode changed to ${operationMode} from ${oldOperationMode} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );

    // EffectiveOperationMode is Read-only (access "R V", no Write) per the Matter spec — asLocalActor()
    // authorizes this internal, spec-mandated update.
    this.agent.asLocalActor(() => {
      // Matter 1.6.0 § 4.2.7.15: EffectiveOperationMode has the same value as OperationMode unless the pump runs with local settings or PumpStatus.LocalOverride is set.
      this.state.effectiveOperationMode = operationMode;
    });
    // Matter 1.6.0 § 4.2.6.2: Re-apply the setpoint so Minimum and Maximum immediately force the minimum and maximum possible speed, and Normal restores the LevelControl-derived setpoint.
    const { speed, capacity } = this.#applySetpoint(this.internal.lastLevel ?? 254);
    device.log.info(
      `MatterbridgePumpConfigurationAndControlServer: pump speed changed to ${speed}, capacity changed to ${capacity} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
  }

  /**
   * Reacts to OnOff changes by stopping the pump, or powering it on to the setpoint for the last known
   * LevelControl CurrentLevel (which LevelControl itself restores to its pre-Off value on power-on, and
   * which reaches us via #handleCurrentLevelChanged), falling back to MaxLevel/254 (100%) if none is known
   * yet — i.e. "the maximum level allowed for the pump" per the On command clarification.
   *
   * @param {boolean} onOff - The new OnOff state.
   * @param {boolean} oldOnOff - The previous OnOff state.
   */
  #handleOnOffChanged(onOff: boolean, oldOnOff: boolean): void {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgePumpConfigurationAndControlServer: onOff changed to ${onOff} from ${oldOnOff} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);

    // Matter 1.6.0 § 5.5.5.1: On powers the pump on and moves it to the level stored by a previous Off, or to the maximum level allowed for the pump when none is stored; Off powers it off.
    const { speed, capacity } = onOff ? this.#applySetpoint(this.internal.lastLevel ?? 254) : this.#stopPump();
    device.log.info(
      `MatterbridgePumpConfigurationAndControlServer: pump speed changed to ${speed}, capacity changed to ${capacity} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
  }

  /**
   * Reacts to LevelControl CurrentLevel changes using the Pump device type level-to-setpoint mapping.
   *
   * @param {number | null} currentLevel - The new CurrentLevel value.
   * @param {number | null} oldCurrentLevel - The previous CurrentLevel value.
   */
  #handleCurrentLevelChanged(currentLevel: number | null, oldCurrentLevel: number | null): void {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgePumpConfigurationAndControlServer: currentLevel changed to ${currentLevel} from ${oldCurrentLevel} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );

    this.internal.lastLevel = currentLevel ?? this.internal.lastLevel;
    // Matter 1.6.0 § 5.5.5.2: The Level Control cluster controls the pump setpoint, with the setpoint given as a percentage derived from CurrentLevel.
    const { speed, capacity } = this.#applySetpoint(currentLevel ?? 0);
    device.log.info(
      `MatterbridgePumpConfigurationAndControlServer: pump speed changed to ${speed}, capacity changed to ${capacity} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
  }
}

/* v8 ignore start */
export namespace MatterbridgePumpConfigurationAndControlServer {
  /**
   * Internal state for MatterbridgePumpConfigurationAndControlServer.
   */
  export class Internal {
    /** Last known LevelControl CurrentLevel, used to restore the pump's speed on OnOff.on. */
    lastLevel?: number;
  }
}
/* v8 ignore stop */
