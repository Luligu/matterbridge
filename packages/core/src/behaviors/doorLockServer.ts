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
import { hasRemoteActor } from '@matter/protocol';
import { DoorLock } from '@matter/types/clusters/door-lock';
import { StatusResponse } from '@matter/types/common';
import { FabricIndex, NodeId } from '@matter/types/datatype';
import { Status } from '@matter/types/globals';
import { getEnumDescription } from '@matterbridge/utils/enum';
import { debugStringify } from 'node-ansi-logger';

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
    /* Removed cause some controllers cannot send the pinCode in the request, even if the DoorLock cluster is configured to require it for remote operations.
    if (this.features.pinCredential && this.features.credentialOverTheAirAccess && this.state.requirePinForRemoteOperation && !this.validatePinCode(request.pinCode)) {
      device.log.warn(`PIN code required but not provided or invalid, cannot lock door (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
      this.state.wrongCodeEntryLimit++;
      throw new StatusResponse.FailureError('PIN code required but not provided or invalid');
    }
    */
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
    /* Removed cause some controllers cannot send the pinCode in the request, even if the DoorLock cluster is configured to require it for remote operations.
    if (this.features.pinCredential && this.features.credentialOverTheAirAccess && this.state.requirePinForRemoteOperation && !this.validatePinCode(request.pinCode)) {
      device.log.warn(`PIN code required but not provided or invalid, cannot unlock door (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
      this.state.wrongCodeEntryLimit++;
      throw new StatusResponse.FailureError('PIN code required but not provided or invalid');
    }
    */
    device.log.info(`Unlocking door (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('DoorLock.unlockDoor', {
      command: 'unlockDoor',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(
      `MatterbridgeDoorLockServer: unlockDoor called ${this.state.autoRelockTime ? 'with ' + this.state.autoRelockTime + ' seconds' : 'without'} autoRelockTime ${this.internal.enableTimeout ? 'with' : 'without'} enableTimeout`,
    );
    await super.unlockDoor(request); // Set lockState to Unlocked
    if (!this.internal.enableTimeout) return; // If enableTimeout is false, do not set a timeout to relock the door, leaving it to the device implementation
    // Implements autoRelockTime
    // istanbul ignore else branch
    if (this.state.autoRelockTime) {
      clearTimeout(this.internal.unlockTimeout);
      this.internal.unlockTimeout = setTimeout(async () => {
        this.internal.unlockTimeout = undefined;
        const device = this.endpoint.stateOf(MatterbridgeServer);
        const state = this.endpoint.stateOf(MatterbridgeDoorLockServer.with());
        device.log.info(`Auto-relocking door after ${state.autoRelockTime} seconds (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
        await this.endpoint.act((agent) => agent.get(MatterbridgeDoorLockServer.with()).lockDoor({ pinCode: request.pinCode }));
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
    /* Removed cause some controllers cannot send the pinCode in the request, even if the DoorLock cluster is configured to require it for remote operations.
    if (this.features.pinCredential && this.features.credentialOverTheAirAccess && this.state.requirePinForRemoteOperation && !this.validatePinCode(request.pinCode)) {
      device.log.warn(`PIN code required but not provided or invalid, cannot unlock door with timeout (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
      this.state.wrongCodeEntryLimit++;
      throw new StatusResponse.FailureError('PIN code required but not provided or invalid');
    }
    */
    device.log.info(`Unlocking door with timeout ${request.timeout} seconds (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('DoorLock.unlockWithTimeout', {
      command: 'unlockWithTimeout',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeDoorLockServer: unlockWithTimeout called ${this.internal.enableTimeout ? 'with' : 'without'} enableTimeout`);
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
        await this.endpoint.act((agent) => agent.get(MatterbridgeDoorLockServer.with()).lockDoor({ pinCode: request.pinCode }));
      }, request.timeout * 1000).unref(); // unref to not keep the process alive if it's the only timeout left
    }
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
    const accessingFabricIndex = this.getAccessingFabricIndex();
    device.log.info(
      `Setting user operationType ${getEnumDescription(DoorLock.DataOperationType, request.operationType)} userIndex ${request.userIndex} userName ${request.userName ?? 'null'} userUniqueId ${request.userUniqueId ?? 'null'} userStatus ${getEnumDescription(DoorLock.UserStatus, request.userStatus, { fallback: 'null' })} userType ${getEnumDescription(DoorLock.UserType, request.userType, { fallback: 'null' })} credentialRule ${getEnumDescription(DoorLock.CredentialRule, request.credentialRule, { fallback: 'null' })} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    device.log.debug(`MatterbridgeDoorLockServer: setUser accessingFabricIndex ${accessingFabricIndex ?? 'null'}`);
    await device.commandHandler.executeHandler('DoorLock.setUser', {
      command: 'setUser',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    const user = this.internal.users.find((storedUser) => storedUser.userIndex === request.userIndex);
    device.log.debug(`MatterbridgeDoorLockServer: setUser called for userIndex ${request.userIndex} (${user ? 'existing user ' + debugStringify(user) : 'new user'})`);
    if (!user && request.operationType === DoorLock.DataOperationType.Add) {
      this.internal.users.push({
        userIndex: request.userIndex,
        userName: request.userName ?? '',
        userUniqueId: request.userUniqueId ?? 0xffffffff,
        userStatus: request.userStatus ?? DoorLock.UserStatus.OccupiedEnabled,
        userType: request.userType ?? DoorLock.UserType.UnrestrictedUser,
        credentialRule: request.credentialRule ?? DoorLock.CredentialRule.Single,
        credentials: [],
        creatorFabricIndex: accessingFabricIndex,
        lastModifiedFabricIndex: accessingFabricIndex,
      });
      this.events.lockUserChange.emit(
        {
          lockDataType: DoorLock.LockDataType.UserIndex,
          dataOperationType: DoorLock.DataOperationType.Add,
          operationSource: this.getOperationSource(),
          userIndex: request.userIndex,
          fabricIndex: accessingFabricIndex,
          sourceNode: this.getAccessingNodeId(),
          dataIndex: request.userIndex,
        },
        this.context,
      );
      device.log.debug(
        `MatterbridgeDoorLockServer: added userIndex ${request.userIndex} (total users: ${this.internal.users.length}) to internal state: ${debugStringify(this.internal.users.find((storedUser) => storedUser.userIndex === request.userIndex))}`,
      );
    } else if (user && request.operationType === DoorLock.DataOperationType.Modify) {
      user.userName = request.userName ?? user.userName;
      user.userUniqueId = request.userUniqueId ?? user.userUniqueId;
      user.userStatus = request.userStatus ?? user.userStatus;
      user.userType = request.userType ?? user.userType;
      user.credentialRule = request.credentialRule ?? user.credentialRule;
      user.lastModifiedFabricIndex = accessingFabricIndex;
      this.events.lockUserChange.emit(
        {
          lockDataType: DoorLock.LockDataType.UserIndex,
          dataOperationType: DoorLock.DataOperationType.Modify,
          operationSource: this.getOperationSource(),
          userIndex: request.userIndex,
          fabricIndex: accessingFabricIndex,
          sourceNode: this.getAccessingNodeId(),
          dataIndex: request.userIndex,
        },
        this.context,
      );
      device.log.debug(
        `MatterbridgeDoorLockServer: modified userIndex ${request.userIndex} (total users: ${this.internal.users.length}) in internal state: ${debugStringify(user)}`,
      );
    }
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
    if (!this.validateUserIndex(request.userIndex)) throw new StatusResponse.InvalidCommandError('Invalid userIndex in GetUser request');
    const user = this.internal.users.find((storedUser) => storedUser.userIndex === request.userIndex);
    if (!user) {
      return {
        userIndex: request.userIndex,
        userName: null,
        userUniqueId: null,
        userStatus: null,
        userType: null,
        credentialRule: null,
        credentials: null,
        creatorFabricIndex: null,
        lastModifiedFabricIndex: null,
        nextUserIndex: null,
      };
    }
    return {
      ...user,
      credentials: user.credentials?.map(({ credentialType, credentialIndex }) => ({ credentialType, credentialIndex })) ?? null,
      nextUserIndex: this.getNextUserIndex(request.userIndex),
    };
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
    const accessingFabricIndex = this.getAccessingFabricIndex();
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
    if (request.userIndex != 0xfffe && !this.validateUserIndex(request.userIndex)) throw new StatusResponse.InvalidCommandError('Invalid userIndex in ClearUser request');
    if (request.userIndex === 0xfffe) {
      this.internal.users = [];
    } else {
      this.internal.users = this.internal.users.filter((storedUser) => storedUser.userIndex !== request.userIndex);
    }
    this.events.lockUserChange.emit(
      {
        lockDataType: DoorLock.LockDataType.UserIndex,
        dataOperationType: DoorLock.DataOperationType.Clear,
        operationSource: this.getOperationSource(),
        userIndex: request.userIndex,
        fabricIndex: accessingFabricIndex,
        sourceNode: this.getAccessingNodeId(),
        dataIndex: request.userIndex,
      },
      this.context,
    );
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
    const accessingFabricIndex = this.getAccessingFabricIndex();
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
    const user = this.internal.users.find((storedUser) => storedUser.userIndex === request.userIndex);
    const existingCredential = this.findStoredCredential(request.credential);
    device.log.debug(
      `MatterbridgeDoorLockServer: setCredential pre-update lookup for credentialIndex ${request.credential.credentialIndex} (${existingCredential ? 'existing credential found' : 'no existing credential'})`,
    );
    if (user && (request.operationType === DoorLock.DataOperationType.Add || request.operationType === DoorLock.DataOperationType.Modify)) {
      const credential = user.credentials?.find(
        (storedCredential) => storedCredential.credentialType === request.credential.credentialType && storedCredential.credentialIndex === request.credential.credentialIndex,
      );
      if (credential) {
        credential.credentialData = request.credentialData;
        credential.creatorFabricIndex = credential.creatorFabricIndex ?? accessingFabricIndex;
        credential.lastModifiedFabricIndex = accessingFabricIndex;
        device.log.debug(
          `MatterbridgeDoorLockServer: modified credentialIndex ${request.credential.credentialIndex} for userIndex ${request.userIndex} in internal state: ${debugStringify(user)}`,
        );
      } else {
        user.credentials = user.credentials ?? [];
        user.credentials.push({
          credentialType: request.credential.credentialType,
          credentialIndex: request.credential.credentialIndex,
          credentialData: request.credentialData,
          creatorFabricIndex: accessingFabricIndex,
          lastModifiedFabricIndex: accessingFabricIndex,
        });
        device.log.debug(
          `MatterbridgeDoorLockServer: added credentialIndex ${request.credential.credentialIndex} for userIndex ${request.userIndex} to internal state: ${debugStringify(user)}`,
        );
      }
      this.events.lockUserChange.emit(
        {
          lockDataType: this.getLockDataTypeForCredentialType(request.credential.credentialType),
          dataOperationType: request.operationType,
          operationSource: this.getOperationSource(),
          userIndex: request.userIndex,
          fabricIndex: accessingFabricIndex,
          sourceNode: this.getAccessingNodeId(),
          dataIndex: this.getCredentialDataIndex(request.credential),
        },
        this.context,
      );
    } else {
      device.log.debug(
        `MatterbridgeDoorLockServer: setCredential did not update internal state for credentialIndex ${request.credential.credentialIndex} (user ${request.userIndex ?? 'null'} not found or operation not handled)`,
      );
    }
    return {
      status: Status.Success,
      userIndex: request.userIndex,
    };
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
    const credentialRecord = this.findStoredCredential(request.credential);
    const nextCredentialIndex = this.getNextOccupiedCredentialIndex(request.credential);
    const response = {
      credentialExists: credentialRecord !== null,
      userIndex: credentialRecord?.user.userIndex ?? null,
      creatorFabricIndex: credentialRecord?.storedCredential.creatorFabricIndex ?? null,
      lastModifiedFabricIndex: credentialRecord?.storedCredential.lastModifiedFabricIndex ?? null,
      nextCredentialIndex,
    };
    device.log.debug(`MatterbridgeDoorLockServer: getCredentialStatus result ${debugStringify(response)}`);
    return response;
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
    const accessingFabricIndex = this.getAccessingFabricIndex();
    const clearedCredentialUserIndex =
      request.credential !== null && request.credential.credentialIndex !== 0xfffe ? (this.findStoredCredential(request.credential)?.user.userIndex ?? null) : null;
    const credentialTypesToClear = request.credential !== null ? [request.credential.credentialType] : this.getStoredCredentialTypes();
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
    for (const user of this.internal.users) {
      user.credentials =
        user.credentials?.filter((storedCredential) => {
          if (request.credential === null) {
            return false;
          }
          if (storedCredential.credentialType !== request.credential.credentialType) {
            return true;
          }
          if (request.credential.credentialIndex === 0xfffe) {
            return false;
          }
          return storedCredential.credentialIndex !== request.credential.credentialIndex;
        }) ?? user.credentials;
    }
    for (const credentialType of credentialTypesToClear) {
      this.events.lockUserChange.emit(
        {
          lockDataType: this.getLockDataTypeForCredentialType(credentialType),
          dataOperationType: DoorLock.DataOperationType.Clear,
          operationSource: this.getOperationSource(),
          userIndex: request.credential === null || request.credential.credentialIndex === 0xfffe ? null : clearedCredentialUserIndex,
          fabricIndex: accessingFabricIndex,
          sourceNode: this.getAccessingNodeId(),
          dataIndex: request.credential === null ? 0xfffe : this.getCredentialDataIndex(request.credential),
        },
        this.context,
      );
    }
  }

  private validateUserIndex(userIndex: number): boolean {
    if (userIndex < 1 || userIndex > this.state.numberOfTotalUsersSupported) {
      return false;
    }
    return true;
  }

  private getNextUserIndex(userIndex: number): number | null {
    const nextUser = this.internal.users.find((storedUser) => storedUser.userIndex === userIndex + 1);
    if (nextUser && nextUser.userStatus !== DoorLock.UserStatus.Available) {
      return nextUser.userIndex;
    }
    return null;
  }

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

  private getOperationSource(): DoorLock.OperationSource {
    return this.getAccessingNodeId() !== null ? DoorLock.OperationSource.Remote : DoorLock.OperationSource.Unspecified;
  }

  private getLockDataTypeForCredentialType(credentialType: DoorLock.CredentialType): DoorLock.LockDataType {
    switch (credentialType) {
      case DoorLock.CredentialType.ProgrammingPin:
        return DoorLock.LockDataType.ProgrammingCode;
      case DoorLock.CredentialType.Pin:
        return DoorLock.LockDataType.Pin;
      case DoorLock.CredentialType.Rfid:
        return DoorLock.LockDataType.Rfid;
      case DoorLock.CredentialType.Fingerprint:
        return DoorLock.LockDataType.Fingerprint;
      case DoorLock.CredentialType.FingerVein:
        return DoorLock.LockDataType.FingerVein;
      case DoorLock.CredentialType.Face:
        return DoorLock.LockDataType.Face;
      case DoorLock.CredentialType.AliroCredentialIssuerKey:
        return DoorLock.LockDataType.AliroCredentialIssuerKey;
      case DoorLock.CredentialType.AliroEvictableEndpointKey:
        return DoorLock.LockDataType.AliroEvictableEndpointKey;
      case DoorLock.CredentialType.AliroNonEvictableEndpointKey:
        return DoorLock.LockDataType.AliroNonEvictableEndpointKey;
      default:
        return DoorLock.LockDataType.Unspecified;
    }
  }

  private getCredentialDataIndex(credential: DoorLock.Credential): number | null {
    if (credential.credentialType === DoorLock.CredentialType.ProgrammingPin) {
      return null;
    }
    return credential.credentialIndex;
  }

  private getStoredCredentialTypes(): DoorLock.CredentialType[] {
    const credentialTypes = new Set<DoorLock.CredentialType>();

    for (const user of this.internal.users) {
      for (const credential of user.credentials ?? []) {
        credentialTypes.add(credential.credentialType);
      }
    }

    return [...credentialTypes];
  }

  private findStoredCredential(credential: DoorLock.Credential) {
    for (const user of this.internal.users) {
      for (const storedCredential of user.credentials ?? []) {
        if (storedCredential.credentialType === credential.credentialType && storedCredential.credentialIndex === credential.credentialIndex) {
          return { user, storedCredential };
        }
      }
    }
    return null;
  }

  /* Removed cause some controllers cannot send the pinCode in the request, even if the DoorLock cluster is configured to require it for remote operations.
  private validatePinCode(pinCode: Uint8Array | undefined): boolean {
    if (pinCode === undefined || pinCode.length < this.state.minPinCodeLength || pinCode.length > this.state.maxPinCodeLength) {
      return false;
    }
    for (const user of this.internal.users) {
      for (const storedCredential of user.credentials ?? []) {
        if (storedCredential.credentialType === DoorLock.CredentialType.Pin && Buffer.from(storedCredential.credentialData).equals(Buffer.from(pinCode))) {
          return true;
        }
      }
    }
    return false;
  }
  */

  private getNextOccupiedCredentialIndex(credential: DoorLock.Credential): number | null {
    for (const user of this.internal.users) {
      for (const storedCredential of user.credentials ?? []) {
        if (storedCredential.credentialType !== credential.credentialType || storedCredential.credentialIndex <= credential.credentialIndex) {
          continue;
        }
        return storedCredential.credentialIndex;
      }
    }
    return null;
  }
}

/* istanbul ignore next -- TypeScript namespace merging emits an unreachable binary-expression branch */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace MatterbridgeDoorLockServer {
  /** Represents a credential stored in the DoorLock server's internal state */
  export type StoredCredential = DoorLock.Credential & {
    creatorFabricIndex: FabricIndex | null;
    lastModifiedFabricIndex: FabricIndex | null;
    credentialData: Uint8Array;
  };

  /** Represents a user stored in the DoorLock server's internal state */
  export type StoredUser = {
    /** 1 to numberOfTotalUsersSupported */
    userIndex: number;
    userName: string | null;
    userUniqueId: number | null;
    /** we store only != DoorLock.UserStatus.Available */
    userStatus: DoorLock.UserStatus | null;
    userType: DoorLock.UserType | null;
    credentialRule: DoorLock.CredentialRule | null;
    credentials: StoredCredential[] | null;
    creatorFabricIndex: FabricIndex | null;
    lastModifiedFabricIndex: FabricIndex | null;
  };

  /** Internal state of the MatterbridgeDoorLockServer */
  export class Internal {
    enableTimeout: boolean = true;
    unlockTimeout: NodeJS.Timeout | undefined;
    users: StoredUser[] = [];
  }
}
