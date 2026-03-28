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
  /**
   * Handles the LockDoor command.
   * It will set lockState to Locked.
   *
   * @param {DoorLock.LockDoorRequest} request - Lock-door request payload.
   */
  override async lockDoor(request: DoorLock.LockDoorRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
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
    await super.lockDoor(request);
  }

  /**
   * Handles the UnlockDoor command.
   * It will set lockState to Unlocked.
   *
   * @param {DoorLock.UnlockDoorRequest} request - Unlock-door request payload.
   */
  override async unlockDoor(request: DoorLock.UnlockDoorRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
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
    await super.unlockDoor(request);
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
    this.state.lockState = DoorLock.LockState.Unlocked;
    // unlockWithTimeout is not implemented in the base DoorLockServer
    // await super.unlockWithTimeout(request);
  }
}
