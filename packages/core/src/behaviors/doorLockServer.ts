/**
 * This file contains the MatterbridgeDoorLockServer class of Matterbridge.
 *
 * @file doorLockServer.ts
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

import { DoorLockServer } from '@matter/node/behaviors/door-lock';
import { DoorLock } from '@matter/types/clusters/door-lock';

import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';
import { MatterbridgeServer } from './matterbridgeServer.js';

/**
 * DoorLock server that forwards lock, user, and credential commands to the Matterbridge command handler.
 */
export class MatterbridgeDoorLockServer extends DoorLockServer.enable({
  events: { doorLockAlarm: true, lockOperation: true, lockOperationError: true },
  commands: { lockDoor: true, unlockDoor: true, unlockWithTimeout: true },
}) {
  declare protected internal: MatterbridgeDoorLockServer.Internal;

  /**
   * Initializes state and logs the initialization of the server.
   */
  override async initialize() {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Initializing MatterbridgeDoorLockServer (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await super.initialize(); // Does a check of supportedOperatingModes
  }

  /**
   * Handles the LockDoor command.
   * It will set lockState to Locked.
   *
   * @param {DoorLock.LockDoorRequest} request - Lock-door request payload.
   */
  override async lockDoor(request: DoorLock.LockDoorRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    if (!this.state.actuatorEnabled) {
      device.log.warn(`Actuator disabled, cannot lock door (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
      return;
    }
    device.log.info(`Locking door (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('DoorLock.lockDoor', {
      command: 'lockDoor',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeDoorLockServer: lockDoor called`);
    await super.lockDoor(request); // Set lockState to Locked
  }

  /**
   * Handles the UnlockDoor command.
   * It will set lockState to Unlocked.
   *
   * @param {DoorLock.UnlockDoorRequest} request - Unlock-door request payload.
   */
  override async unlockDoor(request: DoorLock.UnlockDoorRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    if (!this.state.actuatorEnabled) {
      device.log.warn(`Actuator disabled, cannot unlock door (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
      return;
    }
    device.log.info(`Unlocking door (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('DoorLock.unlockDoor', {
      command: 'unlockDoor',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeDoorLockServer: unlockDoor called`);
    await super.unlockDoor(request); // Set lockState to Unlocked
    // Implements autoRelockTime
    if (!this.internal.enableTimeout) return; // If enableTimeout is false, do not set a timeout to relock the door, leaving it to the device implementation
    if (this.state.autoRelockTime) {
      clearTimeout(this.internal.unlockTimeout);
      this.internal.unlockTimeout = setTimeout(async () => {
        this.internal.unlockTimeout = undefined;
        const device = this.endpoint.stateOf(MatterbridgeServer);
        const state = this.endpoint.stateOf(MatterbridgeDoorLockServer);
        device.log.info(`Auto-relocking door after ${state.autoRelockTime} seconds (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
        await this.endpoint.act((agent) => agent.get(MatterbridgeDoorLockServer).lockDoor({ pinCode: request.pinCode }));
      }, this.state.autoRelockTime * 1000).unref(); // unref to not keep the process alive if it's the only timeout left
    }
  }

  /**
   * Handles the UnlockWithTimeout command.
   * It will set lockState to Unlocked.
   * The implementation of relocking after the timeout expires is left to the device.
   *
   * @param {DoorLock.UnlockWithTimeoutRequest} request - Unlock-door request payload.
   */
  override async unlockWithTimeout(request: DoorLock.UnlockWithTimeoutRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    if (!this.state.actuatorEnabled) {
      device.log.warn(`Actuator disabled, cannot unlock door with timeout (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
      return;
    }
    device.log.info(`Unlocking door with timeout ${request.timeout} seconds (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('DoorLock.unlockWithTimeout', {
      command: 'unlockWithTimeout',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeDoorLockServer: unlockWithTimeout called`);
    // await super.unlockWithTimeout(request); // unlockWithTimeout is not implemented in DoorLockServer
    this.state.lockState = DoorLock.LockState.Unlocked;
    if (!this.internal.enableTimeout) return; // If enableTimeout is false, do not set a timeout to relock the door, leaving it to the device implementation
    // istanbul ignore else branch
    if (request.timeout) {
      clearTimeout(this.internal.unlockTimeout);
      this.internal.unlockTimeout = setTimeout(async () => {
        this.internal.unlockTimeout = undefined;
        const device = this.endpoint.stateOf(MatterbridgeServer);
        device.log.info(`Locking door after ${request.timeout} seconds (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
        await this.endpoint.act((agent) => agent.get(MatterbridgeDoorLockServer).lockDoor({ pinCode: request.pinCode }));
      }, request.timeout * 1000).unref(); // unref to not keep the process alive if it's the only timeout left
    }
  }
}

/* istanbul ignore next -- TypeScript namespace merging emits an unreachable binary-expression branch */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace MatterbridgeDoorLockServer {
  /**
   * Internal state of the MatterbridgeDoorLockServer.
   */
  export class Internal {
    enableTimeout: boolean = true;
    unlockTimeout: NodeJS.Timeout | undefined;
  }
}
