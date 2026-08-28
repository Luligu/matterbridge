/**
 * @file packages/core/src/behaviors/operationalStateServer.ts
 * @description This file contains the MatterbridgeOperationalStateServer class of Matterbridge.
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
/* oxlint-disable typescript/no-namespace */

import type { MaybePromise } from '@matter/general';
import { OperationalStateServer } from '@matter/node/behaviors/operational-state';
import { OperationalState } from '@matter/types/clusters/operational-state';

import type { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';
import { MatterbridgeServer } from './matterbridgeServer.js';

const MatterbridgeOperationalStateServerBase = OperationalStateServer.enable({ events: { operationCompletion: true } });

/**
 * OperationalState server that maps operational commands to Matterbridge command handler calls.
 */
export class MatterbridgeOperationalStateServer extends MatterbridgeOperationalStateServerBase {
  declare protected internal: MatterbridgeOperationalStateServer.Internal;

  /**
   * Initializes operational state defaults.
   */
  override initialize(): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.debug(`MatterbridgeOperationalStateServer: initialized, setting operational state to Stopped (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // OperationalState and OperationalError have no "N" (nonvolatile) quality in the spec, so they are not persisted and are reset to their defaults on every restart.
    this.state.operationalState = OperationalState.OperationalStateEnum.Stopped;
    this.state.operationalError = { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Fully operational' };
    super.initialize();
  }

  /**
   * Handles the Pause command.
   *
   * Effect on receipt (Matter 1.6 Application Cluster spec § 1.14.6.1 Pause Command):
   * "On receipt of this command, the device SHALL pause its operation if it is possible based on the current
   * function of the server. For example, if it is at a point where it is safe to do so and/or permitted, but
   * can be restarted from the point at which pause occurred. If this command is received when already in the
   * Paused state the device SHALL respond with an OperationalCommandResponse command with an ErrorStateID of
   * NoError but take no further action. A device that receives this command in any state which is not
   * Pause-compatible SHALL respond with an OperationalCommandResponse command with an ErrorStateID of
   * CommandInvalidInState and SHALL take no further action. [...] A device that is unable to honor the Pause
   * command for whatever reason SHALL respond with an OperationalCommandResponse command with an ErrorStateID
   * of CommandInvalidInState but take no further action. Otherwise, on success: the OperationalState attribute
   * SHALL be set to Paused. The device SHALL respond with an OperationalCommandResponse command with an
   * ErrorStateID of NoError." Table 3, Pause Compatibility: Stopped = N, Running = Y, Paused = Y, Error = N.
   *
   * @returns {MaybePromise<OperationalState.OperationalCommandResponse>} The operational command response.
   */
  override async pause(): Promise<OperationalState.OperationalCommandResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeOperationalStateServer: pause (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // The command is always forwarded to the plugin handler first; the conformance checks below only govern
    // the resulting attribute update and command response, not whether the plugin is notified.
    await device.commandHandler.executeHandler('OperationalState.pause', {
      command: 'pause',
      request: {},
      cluster: OperationalStateServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof OperationalState)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });

    // Matter 1.6.0 § 1.14.6.1: Respond with ErrorStateID NoError and take no further action if Pause is received while already Paused.
    if (this.state.operationalState === OperationalState.OperationalStateEnum.Paused) {
      device.log.debug(
        `MatterbridgeOperationalStateServer: pause received while already Paused, taking no further action (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
      return {
        commandResponseState: { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Already paused' },
      };
    }

    // Matter 1.6.0 § 1.14.6.1: Reject Pause with ErrorStateID CommandInvalidInState when the current state is not Pause-compatible (Table 3: only Running and Paused are compatible).
    if (this.state.operationalState !== OperationalState.OperationalStateEnum.Running) {
      device.log.debug(
        `MatterbridgeOperationalStateServer: pause received in state ${this.state.operationalState} which is not Pause-compatible (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
      return {
        commandResponseState: { errorStateId: OperationalState.ErrorState.CommandInvalidInState, errorStateDetails: 'Not Pause-compatible in the current operational state' },
      };
    }

    device.log.debug(`MatterbridgeOperationalStateServer: pause called setting operational state to Paused (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 1.14.6.4 and § 1.14.7.2.3: Record the pre-pause state for Resume and start timing the paused segment for OperationCompletion's PausedTime.
    this.internal.operationalStateBeforePause = this.state.operationalState;
    this.internal.pausedSinceMs = Date.now();
    // Matter 1.6.0 § 1.14.6.1: On success, set OperationalState to Paused.
    this.state.operationalState = OperationalState.OperationalStateEnum.Paused;
    // Matter 1.6.0 § 1.14.5.6: OperationalError shall report NoError when no error condition exists.
    this.state.operationalError = { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Fully operational' };
    return {
      commandResponseState: { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Fully operational' },
    };
  }

  /**
   * Handles the Stop command.
   *
   * Effect on receipt (Matter 1.6 Application Cluster spec § 1.14.6.2 Stop Command):
   * "On receipt of this command, the device SHALL stop its operation if it is at a position where it is safe
   * to do so and/or permitted. Restart of the device following the receipt of the Stop command SHALL require
   * attended operation unless remote start is allowed by the device type and any jurisdiction governing remote
   * operation of the device. If this command is received when already in the Stopped state the device SHALL
   * respond with an OperationalCommandResponse command with an ErrorStateID of NoError but take no further
   * action. A device that is unable to honor the Stop command for whatever reason SHALL respond with an
   * OperationalCommandResponse command with an ErrorStateID of CommandInvalidInState but take no further
   * action. Otherwise, on success: the OperationalState attribute SHALL be set to Stopped. The device SHALL
   * respond with an OperationalCommandResponse command with an ErrorStateID of NoError."
   *
   * Effect on receipt (Matter 1.6 Application Cluster spec § 1.14.7.2 OperationCompletion Event): "This event
   * SHOULD be generated when the overall operation ends, successfully or otherwise. [...] TotalOperationalTime
   * [is] the total operational time, in seconds, from when the operation was started via an initial Start
   * command [...] until the operation completed. This includes any time spent while paused. [...] PausedTime
   * [is] the total time spent in the paused state, in seconds." Stop is this class's only "operation ends"
   * trigger, so it emits OperationCompletion whenever it actually ends an in-progress operation (Running or
   * Paused), never on the already-Stopped no-op above.
   *
   * @returns {MaybePromise<OperationalState.OperationalCommandResponse>} The operational command response.
   */
  override async stop(): Promise<OperationalState.OperationalCommandResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeOperationalStateServer: stop (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // The command is always forwarded to the plugin handler first; the conformance check below only governs
    // the resulting attribute update and command response, not whether the plugin is notified.
    await device.commandHandler.executeHandler('OperationalState.stop', {
      command: 'stop',
      request: {},
      cluster: OperationalStateServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof OperationalState)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });

    // Matter 1.6.0 § 1.14.6.2: Respond with ErrorStateID NoError and take no further action if Stop is received while already Stopped.
    if (this.state.operationalState === OperationalState.OperationalStateEnum.Stopped) {
      device.log.debug(
        `MatterbridgeOperationalStateServer: stop received while already Stopped, taking no further action (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
      return {
        commandResponseState: { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Already stopped' },
      };
    }

    device.log.debug(`MatterbridgeOperationalStateServer: stop called setting operational state to Stopped (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // If Stop arrives while Paused, close out the in-progress paused segment before computing PausedTime.
    if (this.internal.pausedSinceMs !== undefined) {
      this.internal.pausedAccumulatedMs += Date.now() - this.internal.pausedSinceMs;
      this.internal.pausedSinceMs = undefined;
    }
    const totalOperationalTime = this.internal.operationStartedAt === undefined ? null : Math.round((Date.now() - this.internal.operationStartedAt) / 1000);
    const pausedTime = this.internal.operationStartedAt === undefined ? null : Math.round(this.internal.pausedAccumulatedMs / 1000);
    this.internal.operationStartedAt = undefined;
    this.internal.pausedAccumulatedMs = 0;
    this.events.operationCompletion.emit({ completionErrorCode: OperationalState.ErrorState.NoError, totalOperationalTime, pausedTime }, this.context);
    // Matter 1.6.0 § 1.14.6.2: On success, set OperationalState to Stopped.
    this.state.operationalState = OperationalState.OperationalStateEnum.Stopped;
    // Matter 1.6.0 § 1.14.5.6: OperationalError shall report NoError when no error condition exists.
    this.state.operationalError = { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Fully operational' };
    return {
      commandResponseState: { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Fully operational' },
    };
  }

  /**
   * Handles the Start command.
   *
   * Effect on receipt (Matter 1.6 Application Cluster spec § 1.14.6.3 Start Command):
   * "On receipt of this command, the device SHALL start its operation if it is safe to do so and the device is
   * in an operational state from which it can be started. There may be either regulatory or manufacturer-imposed
   * safety and security requirements that first necessitate some specific action at the device before a Start
   * command can be honored. In such instances, a device SHALL respond with a status code of CommandInvalidInState
   * if a Start command is received prior to the required on-device action. If this command is received when
   * already in the Running state the device SHALL respond with an OperationalCommandResponse command with an
   * ErrorStateID of NoError but take no further action. A device that is unable to honor the Start command for
   * whatever reason SHALL respond with an OperationalCommandResponse command with an ErrorStateID of
   * UnableToStartOrResume but take no further action. Otherwise, on success: the OperationalState attribute
   * SHALL be set to Running. The device SHALL respond with an OperationalCommandResponse command with an
   * ErrorStateID of NoError."
   *
   * @returns {MaybePromise<OperationalState.OperationalCommandResponse>} The operational command response.
   */
  override async start(): Promise<OperationalState.OperationalCommandResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeOperationalStateServer: start (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // The command is always forwarded to the plugin handler first; the conformance check below only governs
    // the resulting attribute update and command response, not whether the plugin is notified.
    await device.commandHandler.executeHandler('OperationalState.start', {
      command: 'start',
      request: {},
      cluster: OperationalStateServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof OperationalState)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });

    // Matter 1.6.0 § 1.14.6.3: Respond with ErrorStateID NoError and take no further action if Start is received while already Running.
    if (this.state.operationalState === OperationalState.OperationalStateEnum.Running) {
      device.log.debug(
        `MatterbridgeOperationalStateServer: start received while already Running, taking no further action (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
      return {
        commandResponseState: { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Already running' },
      };
    }

    // Matter 1.6.0 § 1.14.6.3: Reject Start with ErrorStateID UnableToStartOrResume while in the Error state, since the error must be cleared (e.g. via Stop) before Start can be honored again.
    if (this.state.operationalState === OperationalState.OperationalStateEnum.Error) {
      device.log.debug(
        `MatterbridgeOperationalStateServer: start received while in the Error state, unable to honor (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
      return {
        commandResponseState: { errorStateId: OperationalState.ErrorState.UnableToStartOrResume, errorStateDetails: 'Unable to start while in the Error state' },
      };
    }

    device.log.debug(`MatterbridgeOperationalStateServer: start called setting operational state to Running (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 1.14.7.2.2: Begin timing a fresh operation cycle for TotalOperationalTime; starting directly from Paused closes out that paused segment without resetting the cycle's start time.
    if (this.state.operationalState === OperationalState.OperationalStateEnum.Paused && this.internal.pausedSinceMs !== undefined) {
      this.internal.pausedAccumulatedMs += Date.now() - this.internal.pausedSinceMs;
      this.internal.pausedSinceMs = undefined;
    } else {
      this.internal.operationStartedAt = Date.now();
      this.internal.pausedAccumulatedMs = 0;
    }
    // Matter 1.6.0 § 1.14.6.3: On success, set OperationalState to Running.
    this.state.operationalState = OperationalState.OperationalStateEnum.Running;
    // Matter 1.6.0 § 1.14.5.6: OperationalError shall report NoError when no error condition exists.
    this.state.operationalError = { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Fully operational' };
    return {
      commandResponseState: { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Fully operational' },
    };
  }

  /**
   * Handles the Resume command.
   *
   * Effect on receipt (Matter 1.6 Application Cluster spec § 1.14.6.4 Resume Command):
   * "On receipt of this command, the device SHALL resume its operation from the point it was at when it
   * received the Pause command, or from the point when it was paused by means outside of this cluster (for
   * example by manual button press). If this command is received when already in the Running state the device
   * SHALL respond with an OperationalCommandResponse command with an ErrorStateID of NoError but take no
   * further action. A device that receives this command in any state which is not Resume-compatible SHALL
   * respond with an OperationalCommandResponse command with an ErrorStateID of CommandInvalidInState and SHALL
   * take no further action. [...] A device that is unable to honor the Resume command for any other reason
   * SHALL respond with an OperationalCommandResponse command with an ErrorStateID of UnableToStartOrResume but
   * take no further action. Otherwise, on success: the OperationalState attribute SHALL be set to the most
   * recent non-Error operational state prior to entering the Paused state. The device SHALL respond with an
   * OperationalCommandResponse command with an ErrorStateID of NoError." Table 4, Resume Compatibility:
   * Stopped = N, Running = Y, Paused = Y, Error = N.
   *
   * @returns {MaybePromise<OperationalState.OperationalCommandResponse>} The operational command response.
   */
  override async resume(): Promise<OperationalState.OperationalCommandResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeOperationalStateServer: resume (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // The command is always forwarded to the plugin handler first; the conformance checks below only govern
    // the resulting attribute update and command response, not whether the plugin is notified.
    await device.commandHandler.executeHandler('OperationalState.resume', {
      command: 'resume',
      request: {},
      cluster: OperationalStateServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof OperationalState)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });

    // Matter 1.6.0 § 1.14.6.4: Respond with ErrorStateID NoError and take no further action if Resume is received while already Running.
    if (this.state.operationalState === OperationalState.OperationalStateEnum.Running) {
      device.log.debug(
        `MatterbridgeOperationalStateServer: resume received while already Running, taking no further action (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
      return {
        commandResponseState: { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Already running' },
      };
    }

    // Matter 1.6.0 § 1.14.6.4: Reject Resume with ErrorStateID CommandInvalidInState when the current state is not Resume-compatible (Table 4: only Running and Paused are compatible).
    if (this.state.operationalState !== OperationalState.OperationalStateEnum.Paused) {
      device.log.debug(
        `MatterbridgeOperationalStateServer: resume received in state ${this.state.operationalState} which is not Resume-compatible (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
      return {
        commandResponseState: { errorStateId: OperationalState.ErrorState.CommandInvalidInState, errorStateDetails: 'Not Resume-compatible in the current operational state' },
      };
    }

    device.log.debug(`MatterbridgeOperationalStateServer: resume called setting operational state to Running (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Close out the paused segment started in pause(), accumulating it toward OperationCompletion's
    // PausedTime field (§ 1.14.7.2.3).
    if (this.internal.pausedSinceMs !== undefined) {
      this.internal.pausedAccumulatedMs += Date.now() - this.internal.pausedSinceMs;
      this.internal.pausedSinceMs = undefined;
    }
    // Matter 1.6.0 § 1.14.6.4: On success, restore OperationalState to the most recent non-Error state prior to entering Paused.
    this.state.operationalState = this.internal.operationalStateBeforePause;
    // Matter 1.6.0 § 1.14.5.6: OperationalError shall report NoError when no error condition exists.
    this.state.operationalError = { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Fully operational' };
    return {
      commandResponseState: { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Fully operational' },
    };
  }
}

/* v8 ignore start */
export namespace MatterbridgeOperationalStateServer {
  /**
   * Internal state for MatterbridgeOperationalStateServer. Kept here (rather than as plain class fields) so it
   * persists correctly across separate command invocations on the same endpoint, the same way `this.state` does.
   */
  export class Internal extends MatterbridgeOperationalStateServerBase.Internal {
    /**
     * The most recent non-Error operational state prior to entering the Paused state, used to restore the
     * correct state on Resume as required by § 1.14.6.4 Resume Command: "the OperationalState attribute SHALL
     * be set to the most recent non-Error operational state prior to entering the Paused state."
     */
    operationalStateBeforePause: OperationalState.OperationalStateEnum = OperationalState.OperationalStateEnum.Running;

    /**
     * Wall-clock time (`Date.now()`) at which the current operation cycle was started via Start, used to
     * compute OperationCompletion's TotalOperationalTime field. `undefined` when no operation is in progress.
     */
    operationStartedAt: number | undefined;

    /**
     * Total time, in milliseconds, spent in the Paused state during the current operation cycle, accumulated
     * across every Pause/Resume pair, used to compute OperationCompletion's PausedTime field.
     */
    pausedAccumulatedMs = 0;

    /**
     * Wall-clock time (`Date.now()`) at which the device most recently entered the Paused state, or
     * `undefined` when not currently paused.
     */
    pausedSinceMs: number | undefined;
  }
}
/* v8 ignore stop */
