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
import { getEnumDescription } from '@matterbridge/utils/enum';

import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';
import { MatterbridgeServer } from './matterbridgeServer.js';

/**
 * DoorLock server that forwards lock, user, and credential commands to the Matterbridge command handler.
 */
export class MatterbridgeDoorLockServer extends DoorLockServer.with(
  DoorLock.Feature.User,
  DoorLock.Feature.PinCredential /* , DoorLock.Feature.CredentialOverTheAirAccess*/,
).enable({
  events: { doorLockAlarm: true, lockOperation: true, lockOperationError: true },
  commands: { lockDoor: true, unlockDoor: true, unlockWithTimeout: true },
}) {
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
    device.log.debug(`MatterbridgeDoorLockServer: unlockDoor called ${this.state.autoRelockTime ? 'with ' + this.state.autoRelockTime + ' seconds' : 'without'} autoRelockTime`);
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
    await super.unlockWithTimeout(request);
  }

  /**
   * Handles the SetUser command.
   * It will add a new user to the internal state if operationType is Add and the user does not already exist.
   * For other operation types, it will update the existing user or do nothing if the user does not exist.
   *
   * @param {DoorLock.SetUserRequest} request - SetUser request payload.
   */
  override async setUser(request: DoorLock.SetUserRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Setting user operationType ${getEnumDescription(DoorLock.DataOperationType, request.operationType)} userIndex ${request.userIndex} userName ${request.userName ?? 'null'} userUniqueId ${request.userUniqueId ?? 'null'} userStatus ${getEnumDescription(DoorLock.UserStatus, request.userStatus, { fallback: 'null' })} userType ${getEnumDescription(DoorLock.UserType, request.userType, { fallback: 'null' })} credentialRule ${getEnumDescription(DoorLock.CredentialRule, request.credentialRule, { fallback: 'null' })} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('DoorLock.setUser', {
      command: 'setUser',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeDoorLockServer: setUser called for userIndex ${request.userIndex}`);
    await super.setUser(request);
  }

  /**
   * Handles the GetUser command.
   *
   * @param {DoorLock.GetUserRequest} request - GetUser request payload { userIndex: number }.
   * @returns {Promise<DoorLock.GetUserResponse>} - The user information for the requested userIndex, or default values if the user does not exist.
   */
  override async getUser(request: DoorLock.GetUserRequest): Promise<DoorLock.GetUserResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Getting userIndex ${request.userIndex} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    const response = await device.commandHandler.executeHandler('DoorLock.getUser', {
      command: 'getUser',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    if (response !== undefined) {
      return response;
    }
    device.log.debug(`MatterbridgeDoorLockServer: getUser called for userIndex ${request.userIndex}`);
    return await super.getUser(request);
  }

  /**
   * Handles the ClearUser command.
   * If userIndex is 0xFFFE, all users will be cleared.
   * Otherwise, only the user with the specified userIndex will be cleared.
   *
   * @param {DoorLock.ClearUserRequest} request - ClearUser request payload { userIndex: number }.
   */
  override async clearUser(request: DoorLock.ClearUserRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Clearing userIndex ${request.userIndex} ${request.userIndex === 0xfffe ? '(all users)' : ''} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('DoorLock.clearUser', {
      command: 'clearUser',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeDoorLockServer: clearUser called for userIndex ${request.userIndex}`);
    await super.clearUser(request);
  }

  /**
   * Handles the SetCredential command.
   * If operationType is Add or Modify and the user exists, it will add or update the credential in the internal state.
   * For other operation types, it will not modify the internal state, but it will still execute the command handler to allow the device implementation to handle the command if needed (e.g. for ClearCredential).
   *
   * @param {DoorLock.SetCredentialRequest} request - SetCredential request payload { operationType: DoorLock.DataOperationType, credential: { credentialType: DoorLock.CredentialType, credentialIndex: number }, credentialData: Uint8Array, userIndex: number | null, userStatus: DoorLock.UserStatus | null, userType: DoorLock.UserType | null }.
   * @returns {Promise<DoorLock.SetCredentialResponse>} - SetCredential response payload.
   */
  override async setCredential(request: DoorLock.SetCredentialRequest): Promise<DoorLock.SetCredentialResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Setting credential operationType ${getEnumDescription(DoorLock.DataOperationType, request.operationType)} credentialType ${getEnumDescription(DoorLock.CredentialType, request.credential.credentialType)} credentialIndex ${request.credential.credentialIndex} credentialData ${Buffer.from(request.credentialData).toString('hex') ? '0x' + Buffer.from(request.credentialData).toString('hex') : '0x'} userIndex ${request.userIndex ?? 'null'} userStatus ${getEnumDescription(DoorLock.UserStatus, request.userStatus, { fallback: 'null' })} userType ${getEnumDescription(DoorLock.UserType, request.userType, { fallback: 'null' })} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('DoorLock.setCredential', {
      command: 'setCredential',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeDoorLockServer: setCredential called for userIndex ${request.userIndex}`);
    return await super.setCredential(request);
  }

  /**
   * Handles the GetCredentialStatus command.
   *
   * @param {DoorLock.GetCredentialStatusRequest} request - GetCredentialStatus request payload { credential: { credentialType: DoorLock.CredentialType, credentialIndex: number } }.
   * @returns {Promise<DoorLock.GetCredentialStatusResponse>} - The credential status information for the requested credential, or default values if the credential does not exist.
   */
  override async getCredentialStatus(request: DoorLock.GetCredentialStatusRequest): Promise<DoorLock.GetCredentialStatusResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Getting credential status for credentialType ${getEnumDescription(DoorLock.CredentialType, request.credential.credentialType)} credentialIndex ${request.credential.credentialIndex} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('DoorLock.getCredentialStatus', {
      command: 'getCredentialStatus',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeDoorLockServer: getCredentialStatus called`);
    return await super.getCredentialStatus(request);
  }

  /**
   * Handles the ClearCredential command.
   * If credential.credentialIndex is 0xFFFE, all credentials of the specified credentialType will be cleared.
   * If credential is null, all credentials will be cleared.
   * Otherwise, only the credential with the specified credentialType and credentialIndex will be cleared.
   *
   * @param {DoorLock.ClearCredentialRequest} request - ClearCredential request payload { credential: { credentialType: DoorLock.CredentialType, credentialIndex: number } | null }.
   */
  override async clearCredential(request: DoorLock.ClearCredentialRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Clearing credentialType ${request.credential ? getEnumDescription(DoorLock.CredentialType, request.credential.credentialType) : 'null'} credentialIndex ${request.credential ? request.credential.credentialIndex : 'null'} ${request.credential === null ? '(all credentials)' : ''} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('DoorLock.clearCredential', {
      command: 'clearCredential',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug('MatterbridgeDoorLockServer: clearCredential called');
    await super.clearCredential(request);
  }

  /*
  private getAccessingFabricIndex(): FabricIndex | null {
    let fabricIndex: FabricIndex | undefined;

    try {
      fabricIndex = this.context.fabric;
    } catch {
      return null;
    }

    if (fabricIndex === undefined || fabricIndex === FabricIndex.NO_FABRIC) {
      return null;
    }
    return fabricIndex;
  }

  private getAccessingNodeId(): NodeId | null {
    if (!hasRemoteActor(this.context)) {
      return null;
    }
    return this.context.session.peerNodeId ?? null;
  }
  */
}
