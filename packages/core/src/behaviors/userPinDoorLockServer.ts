/* eslint-disable jsdoc/require-jsdoc */
/**
 * This file contains the MatterbridgeUserPinDoorLockServer class of Matterbridge.
 *
 * @file userPinDoorLockServer.ts
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
import { StatusResponse } from '@matter/types/common';
import { FabricIndex } from '@matter/types/datatype';
import { Status } from '@matter/types/globals';
import { getEnumDescription } from '@matterbridge/utils';
import { debugStringify } from 'node-ansi-logger';

import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';
import { MatterbridgeServer } from './matterbridgeServer.js';

/**
 * DoorLock server with User and PinCredential features that forwards lock, user, and credential commands to the Matterbridge command handler.
 * This is supported by Apple Home.
 * Work in progress. Waiting https://github.com/matter-js/matter.js/issues/3468.
 */
export class MatterbridgeUserPinDoorLockServer extends DoorLockServer.with(
  DoorLock.Feature.User,
  DoorLock.Feature.PinCredential,
  DoorLock.Feature.CredentialOverTheAirAccess,
).enable({
  events: { doorLockAlarm: true, lockOperation: true, lockOperationError: true },
  commands: { lockDoor: true, unlockDoor: true, unlockWithTimeout: true },
}) {
  declare protected internal: MatterbridgeUserPinDoorLockServer.Internal;

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

  private getStoredCredentialStateDebug() {
    if (this.internal.users.length === 0) {
      return 'no users';
    }

    return this.internal.users
      .map((user) => {
        const credentials =
          user.credentials
            ?.map(
              (credential) =>
                `${getEnumDescription(DoorLock.CredentialType, credential.credentialType)}:${credential.credentialIndex}=0x${Buffer.from(credential.credentialData).toString('hex')}`,
            )
            .join(', ') ?? 'none';
        return `user ${user.userIndex} [${credentials}]`;
      })
      .join('; ');
  }

  private logStoredCredentialState(reason: string) {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.debug(`MatterbridgeDoorLockServer: ${reason}; stored credentials: ${this.getStoredCredentialStateDebug()}`);
  }

  private hasMatchingPinCredential(pinCode: Uint8Array) {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.debug(`MatterbridgeDoorLockServer: checking remote PIN 0x${Buffer.from(pinCode).toString('hex')} against ${this.internal.users.length} user(s)`);

    for (const user of this.internal.users) {
      for (const storedCredential of user.credentials ?? []) {
        if (storedCredential.credentialType !== DoorLock.CredentialType.Pin) {
          continue;
        }
        if (Buffer.from(storedCredential.credentialData).equals(Buffer.from(pinCode))) {
          device.log.debug(`MatterbridgeDoorLockServer: remote PIN matched userIndex ${user.userIndex} credentialIndex ${storedCredential.credentialIndex}`);
          return true;
        }
      }
    }

    device.log.debug(`MatterbridgeDoorLockServer: remote PIN 0x${Buffer.from(pinCode).toString('hex')} did not match any stored PIN credential`);
    return false;
  }

  private validateRemotePinCode(pinCode: Uint8Array | undefined) {
    const device = this.endpoint.stateOf(MatterbridgeServer);

    if (!this.state.requirePinForRemoteOperation) {
      device.log.debug('MatterbridgeDoorLockServer: skipping remote PIN validation because requirePinForRemoteOperation is false');
      return;
    }

    if (pinCode === undefined) {
      device.log.debug('MatterbridgeDoorLockServer: rejecting remote operation because the request did not include a PIN');
      this.logStoredCredentialState('remote PIN validation failed');
      throw new StatusResponse.FailureError('Missing or invalid PIN code for remote operation');
    }

    device.log.debug(`MatterbridgeDoorLockServer: validating remote PIN 0x${Buffer.from(pinCode).toString('hex')}`);

    if (!this.hasMatchingPinCredential(pinCode)) {
      this.logStoredCredentialState('remote PIN validation failed');
      throw new StatusResponse.FailureError('Missing or invalid PIN code for remote operation');
    }

    device.log.debug(`MatterbridgeDoorLockServer: accepted remote PIN 0x${Buffer.from(pinCode).toString('hex')}`);
  }

  private getNextOccupiedCredentialIndex(credential: DoorLock.Credential): number | null {
    let nextCredentialIndex: number | null = null;

    for (const user of this.internal.users) {
      for (const storedCredential of user.credentials ?? []) {
        if (storedCredential.credentialType !== credential.credentialType || storedCredential.credentialIndex <= credential.credentialIndex) {
          continue;
        }
        if (nextCredentialIndex === null || storedCredential.credentialIndex < nextCredentialIndex) {
          nextCredentialIndex = storedCredential.credentialIndex;
        }
      }
    }

    return nextCredentialIndex;
  }

  private upsertStoredCredential(userIndex: number | null, credential: DoorLock.Credential, credentialData: Uint8Array) {
    const device = this.endpoint.stateOf(MatterbridgeServer);

    if (userIndex === null) {
      device.log.debug(
        `MatterbridgeDoorLockServer: not storing credentialType ${getEnumDescription(DoorLock.CredentialType, credential.credentialType)} credentialIndex ${credential.credentialIndex} because userIndex is null`,
      );
      return;
    }

    const user = this.internal.users.find((storedUser) => storedUser.userIndex === userIndex);
    if (!user) {
      device.log.debug(
        `MatterbridgeDoorLockServer: not storing credentialType ${getEnumDescription(DoorLock.CredentialType, credential.credentialType)} credentialIndex ${credential.credentialIndex} because userIndex ${userIndex} was not found`,
      );
      return;
    }

    let removedCredentials = 0;
    for (const storedUser of this.internal.users) {
      const nextCredentials =
        storedUser.credentials?.filter(
          (storedCredential) => storedCredential.credentialType !== credential.credentialType || storedCredential.credentialIndex !== credential.credentialIndex,
        ) ?? null;
      removedCredentials += (storedUser.credentials?.length ?? 0) - (nextCredentials?.length ?? 0);
      storedUser.credentials = nextCredentials && nextCredentials.length > 0 ? nextCredentials : null;
    }

    if (!user.credentials) {
      user.credentials = [];
    }
    user.credentials.push({
      credentialType: credential.credentialType,
      credentialIndex: credential.credentialIndex,
      credentialData: Uint8Array.from(credentialData),
    });
    device.log.debug(
      `MatterbridgeDoorLockServer: stored credentialType ${getEnumDescription(DoorLock.CredentialType, credential.credentialType)} credentialIndex ${credential.credentialIndex} for userIndex ${userIndex} (removed ${removedCredentials} replaced credential(s))`,
    );
    this.logStoredCredentialState('credential stored');
  }

  private clearStoredCredential(credential: DoorLock.Credential | null) {
    const device = this.endpoint.stateOf(MatterbridgeServer);

    for (const user of this.internal.users) {
      if (credential === null) {
        user.credentials = null;
        continue;
      }

      const nextCredentials =
        user.credentials?.filter(
          (storedCredential) => storedCredential.credentialType !== credential.credentialType || storedCredential.credentialIndex !== credential.credentialIndex,
        ) ?? null;
      user.credentials = nextCredentials && nextCredentials.length > 0 ? nextCredentials : null;
    }

    device.log.debug(
      `MatterbridgeDoorLockServer: cleared ${credential ? `${getEnumDescription(DoorLock.CredentialType, credential.credentialType)} credentialIndex ${credential.credentialIndex}` : 'all credentials'} from internal state`,
    );
    this.logStoredCredentialState('credential cleared');
  }

  override async lockDoor(request: DoorLock.LockDoorRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Locking door with pincode ${request.pinCode ? '0x' + Buffer.from(request.pinCode).toString('hex') : 'N/A'} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    this.validateRemotePinCode(request.pinCode);
    device.log.debug(`MatterbridgeDoorLockServer: remote lockDoor PIN validation completed`);
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

  override async unlockDoor(request: DoorLock.UnlockDoorRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Unlocking door with pincode ${request.pinCode ? '0x' + Buffer.from(request.pinCode).toString('hex') : 'N/A'} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    this.validateRemotePinCode(request.pinCode);
    device.log.debug(`MatterbridgeDoorLockServer: remote unlockDoor PIN validation completed`);
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

  override async unlockWithTimeout(request: DoorLock.UnlockWithTimeoutRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Unlocking door with pincode ${request.pinCode ? '0x' + Buffer.from(request.pinCode).toString('hex') : 'N/A'} timeout ${request.timeout} seconds (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    this.validateRemotePinCode(request.pinCode);
    device.log.debug(`MatterbridgeDoorLockServer: remote unlockWithTimeout PIN validation completed`);
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
  }

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
        userName: request.userName,
        userUniqueId: request.userUniqueId,
        userStatus: request.userStatus,
        userType: request.userType,
        credentialRule: request.credentialRule,
        credentials: null,
        creatorFabricIndex: accessingFabricIndex,
        lastModifiedFabricIndex: accessingFabricIndex,
        nextUserIndex: null,
      });
      device.log.debug(
        `MatterbridgeDoorLockServer: added userIndex ${request.userIndex} (total users: ${this.internal.users.length}) to internal state: ${debugStringify(this.internal.users.find((storedUser) => storedUser.userIndex === request.userIndex))}`,
      );
      this.logStoredCredentialState('user added');
      return;
    }

    this.logStoredCredentialState(`setUser completed for userIndex ${request.userIndex} without adding a new internal user`);
  }

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
    const user = this.internal.users.find((storedUser) => storedUser.userIndex === request.userIndex);
    device.log.debug(
      `MatterbridgeDoorLockServer: getUser called for userIndex ${request.userIndex} (total users: ${this.internal.users.length}) (${user ? 'existing user: ' + debugStringify(user) : 'new user'})`,
    );
    this.logStoredCredentialState(`getUser returning state for userIndex ${request.userIndex}`);
    if (user) {
      return {
        ...user,
        credentials: user.credentials?.map(({ credentialType, credentialIndex }) => ({ credentialType, credentialIndex })) ?? null,
      };
    }

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
    this.logStoredCredentialState(`clearUser completed for userIndex ${request.userIndex}`);
  }

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
    device.log.debug(`MatterbridgeDoorLockServer: setCredential called for credentialIndex ${request.credential.credentialIndex}`);
    if (user && (request.operationType === DoorLock.DataOperationType.Add || request.operationType === DoorLock.DataOperationType.Modify)) {
      this.upsertStoredCredential(request.userIndex, request.credential, request.credentialData);
      user.lastModifiedFabricIndex = accessingFabricIndex;
      device.log.debug(`MatterbridgeDoorLockServer: setCredential updated lastModifiedFabricIndex for userIndex ${user.userIndex} to ${accessingFabricIndex ?? 'null'}`);
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
    const credentialRecord = this.findStoredCredential(request.credential);
    const nextCredentialIndex = this.getNextOccupiedCredentialIndex(request.credential);
    device.log.debug(`MatterbridgeDoorLockServer: getCredentialStatus called`);
    device.log.debug(
      `MatterbridgeDoorLockServer: getCredentialStatus result for credentialIndex ${request.credential.credentialIndex} (${credentialRecord ? `userIndex ${credentialRecord.user.userIndex} credentialData 0x${Buffer.from(credentialRecord.storedCredential.credentialData).toString('hex')}` : 'credential missing'}, nextCredentialIndex ${nextCredentialIndex ?? 'null'})`,
    );
    return {
      credentialExists: credentialRecord !== null,
      userIndex: credentialRecord?.user.userIndex ?? null,
      creatorFabricIndex: credentialRecord?.user.creatorFabricIndex ?? null,
      lastModifiedFabricIndex: credentialRecord?.user.lastModifiedFabricIndex ?? null,
      nextCredentialIndex,
      credentialData: credentialRecord?.storedCredential.credentialData ?? null,
    };
  }

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
    this.clearStoredCredential(request.credential);
    device.log.debug('MatterbridgeDoorLockServer: clearCredential called');
    this.logStoredCredentialState(
      `clearCredential completed for ${
        request.credential
          ? `${getEnumDescription(DoorLock.CredentialType, request.credential.credentialType)} credentialIndex ${request.credential.credentialIndex}`
          : 'all credentials'
      }`,
    );
  }
}

/* istanbul ignore next -- TypeScript namespace merging emits an unreachable binary-expression branch */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace MatterbridgeUserPinDoorLockServer {
  export type StoredCredential = DoorLock.Credential & {
    credentialData: Uint8Array;
  };

  export type StoredUser = {
    userIndex: number;
    userName: string | null;
    userUniqueId: number | null;
    userStatus: DoorLock.UserStatus | null;
    userType: DoorLock.UserType | null;
    credentialRule: DoorLock.CredentialRule | null;
    credentials: StoredCredential[] | null;
    creatorFabricIndex: FabricIndex | null;
    lastModifiedFabricIndex: FabricIndex | null;
    nextUserIndex: number | null;
  };

  export class Internal {
    users: StoredUser[] = [];
  }
}
