/**
 * @file packages/core/src/behaviors/doorLockServer.ts
 * @description This file contains the MatterbridgeDoorLockServer class of Matterbridge.
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

import { DoorLockServer } from '@matter/node/behaviors/door-lock';
import { DoorLock } from '@matter/types/clusters/door-lock';
import { getEnumDescription } from '@matterbridge/utils/enum';

import type { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';
import { MatterbridgeServer } from './matterbridgeServer.js';

/**
 * DoorLock server that forwards lock, user, credential, and schedule commands to the Matterbridge command handler.
 *
 * DoorLock.Feature.CredentialOverTheAirAccess has been removed cause some controllers cannot send the pinCode in the request, even if the DoorLock cluster is configured to require it for remote operations.
 */
export class MatterbridgeDoorLockServer extends DoorLockServer.with(
  DoorLock.Feature.User,
  DoorLock.Feature.PinCredential,
  // DoorLock.Feature.CredentialOverTheAirAccess,
  DoorLock.Feature.WeekDayAccessSchedules,
  DoorLock.Feature.YearDayAccessSchedules,
  DoorLock.Feature.HolidaySchedules,
).enable({
  events: { doorLockAlarm: true, lockOperation: true, lockOperationError: true },
  commands: { lockDoor: true, unlockDoor: true, unlockWithTimeout: true },
}) {
  /**
   * Initializes state and logs the initialization of the server.
   */
  override initialize(): void {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeDoorLockServer: initializing server (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 5.2.9.25: Validate that SupportedOperatingModes advertises every required operating-mode bit.
    super.initialize();
  }

  /**
   * Handles the LockDoor command.
   * It will set lockState to Locked.
   *
   * @param {DoorLock.LockDoorRequest} request - Lock-door request payload.
   */
  override async lockDoor(request: DoorLock.LockDoorRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeDoorLockServer: locking door (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('DoorLock.lockDoor', {
      command: 'lockDoor',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    // Matter 1.6.0 § 5.2.9.3 and § 5.2.10.1: Do not process a remote LockDoor command while the actuator is disabled.
    if (!this.state.actuatorEnabled) {
      device.log.warn(`MatterbridgeDoorLockServer: actuator disabled, cannot lock door (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
      return;
    }
    device.log.debug(`MatterbridgeDoorLockServer: lockDoor called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 5.2.10.1: Validate any supplied PIN and set LockState to Locked when LockDoor succeeds.
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
    device.log.info(`MatterbridgeDoorLockServer: unlocking door (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('DoorLock.unlockDoor', {
      command: 'unlockDoor',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    // Matter 1.6.0 § 5.2.9.3 and § 5.2.10.2: Do not process a remote UnlockDoor command while the actuator is disabled.
    if (!this.state.actuatorEnabled) {
      device.log.warn(`MatterbridgeDoorLockServer: actuator disabled, cannot unlock door (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
      return;
    }
    device.log.debug(
      `MatterbridgeDoorLockServer: unlockDoor called ${this.state.autoRelockTime ? 'with ' + this.state.autoRelockTime + ' seconds' : 'without'} autoRelockTime (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    // Matter 1.6.0 § 5.2.10.2: Validate any supplied PIN, set LockState to Unlocked, and apply AutoRelockTime when UnlockDoor succeeds.
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
    device.log.info(`MatterbridgeDoorLockServer: unlocking door with timeout ${request.timeout} seconds (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('DoorLock.unlockWithTimeout', {
      command: 'unlockWithTimeout',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    // Matter 1.6.0 § 5.2.9.3 and § 5.2.10.3: Do not process a remote UnlockWithTimeout command while the actuator is disabled.
    if (!this.state.actuatorEnabled) {
      device.log.warn(`MatterbridgeDoorLockServer: actuator disabled, cannot unlock door with timeout (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
      return;
    }
    device.log.debug(`MatterbridgeDoorLockServer: unlockWithTimeout called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 5.2.10.3: Validate any supplied PIN, set LockState to Unlocked, and relock after the requested timeout.
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
      `MatterbridgeDoorLockServer: setting user operationType ${getEnumDescription(DoorLock.DataOperationType, request.operationType)} userIndex ${request.userIndex} userName ${request.userName ?? 'null'} userUniqueId ${request.userUniqueId ?? 'null'} userStatus ${getEnumDescription(DoorLock.UserStatus, request.userStatus, { fallback: 'null' })} userType ${getEnumDescription(DoorLock.UserType, request.userType, { fallback: 'null' })} credentialRule ${getEnumDescription(DoorLock.CredentialRule, request.credentialRule, { fallback: 'null' })} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('DoorLock.setUser', {
      command: 'setUser',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeDoorLockServer: setUser called for userIndex ${request.userIndex} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 5.2.10.16: Validate SetUser fields and add or modify the specified user record with the required status semantics.
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
    device.log.info(`MatterbridgeDoorLockServer: getting userIndex ${request.userIndex} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    const response = await device.commandHandler.executeHandler('DoorLock.getUser', {
      command: 'getUser',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    if (response !== undefined) {
      return response;
    }
    device.log.debug(`MatterbridgeDoorLockServer: getUser called for userIndex ${request.userIndex} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 5.2.10.17 and § 5.2.10.18: Validate UserIndex and return the matching user record or the required not-found response.
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
      `MatterbridgeDoorLockServer: clearing userIndex ${request.userIndex} ${request.userIndex === 0xfffe ? '(all users)' : ''} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('DoorLock.clearUser', {
      command: 'clearUser',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeDoorLockServer: clearUser called for userIndex ${request.userIndex} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 5.2.10.19: Validate UserIndex and clear the specified user or all users when UserIndex is 0xFFFE.
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
      `MatterbridgeDoorLockServer: setting credential operationType ${getEnumDescription(DoorLock.DataOperationType, request.operationType)} credentialType ${getEnumDescription(DoorLock.CredentialType, request.credential.credentialType)} credentialIndex ${request.credential.credentialIndex} credentialData ${Buffer.from(request.credentialData).toString('hex') ? '0x' + Buffer.from(request.credentialData).toString('hex') : '0x'} userIndex ${request.userIndex ?? 'null'} userStatus ${getEnumDescription(DoorLock.UserStatus, request.userStatus, { fallback: 'null' })} userType ${getEnumDescription(DoorLock.UserType, request.userType, { fallback: 'null' })} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('DoorLock.setCredential', {
      command: 'setCredential',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeDoorLockServer: setCredential called for userIndex ${request.userIndex} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);

    // Matter 1.6.0 § 5.2.10.21.1: Return DUPLICATE if CredentialData duplicates another credential of the same CredentialType.
    if (this.auth.isDuplicateCredential(request.credential.credentialType, request.credentialData, request.credential.credentialIndex)) {
      throw new DoorLock.DuplicateError(
        `MatterbridgeDoorLockServer: credential data duplicates another credential of the same type (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
    }
    // Matter 1.6.0 § 5.2.10.21.1: Return OCCUPIED if an Add operation targets an occupied CredentialIndex.
    if (request.operationType === DoorLock.DataOperationType.Add && this.auth.findCredential(request.credential.credentialType, request.credential.credentialIndex)) {
      throw new DoorLock.OccupiedError(
        `MatterbridgeDoorLockServer: add operation targets an occupied credential index (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
    }

    // Matter 1.6.0 § 5.2.10.20 and § 5.2.10.21: Validate SetCredential fields and add or modify the credential with the required response status.
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
      `MatterbridgeDoorLockServer: getting credential status for credentialType ${getEnumDescription(DoorLock.CredentialType, request.credential.credentialType)} credentialIndex ${request.credential.credentialIndex} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('DoorLock.getCredentialStatus', {
      command: 'getCredentialStatus',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeDoorLockServer: getCredentialStatus called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 5.2.10.22 and § 5.2.10.23: Validate the credential index and return its association status and next occupied index.
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
      `MatterbridgeDoorLockServer: clearing credentialType ${request.credential ? getEnumDescription(DoorLock.CredentialType, request.credential.credentialType) : 'null'} credentialIndex ${request.credential ? request.credential.credentialIndex : 'null'} ${request.credential === null ? '(all credentials)' : ''} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('DoorLock.clearCredential', {
      command: 'clearCredential',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeDoorLockServer: clearCredential called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 5.2.10.24: Validate the credential selector and clear the specified credential or requested credential set.
    await super.clearCredential(request);
  }

  /**
   * Handles the SetWeekDaySchedule command.
   *
   * @param {DoorLock.SetWeekDayScheduleRequest} request - Week day schedule to set.
   */
  override async setWeekDaySchedule(request: DoorLock.SetWeekDayScheduleRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeDoorLockServer: setting week day schedule index ${request.weekDayIndex} for userIndex ${request.userIndex} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('DoorLock.setWeekDaySchedule', {
      command: 'setWeekDaySchedule',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeDoorLockServer: setWeekDaySchedule called for userIndex ${request.userIndex} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 5.2.10.4: Validate and store the specified week day schedule for the user.
    await super.setWeekDaySchedule(request);
  }

  /**
   * Handles the GetWeekDaySchedule command.
   *
   * @param {DoorLock.GetWeekDayScheduleRequest} request - Week day schedule index and user index to retrieve.
   * @returns {Promise<DoorLock.GetWeekDayScheduleResponse>} The requested week day schedule response.
   */
  override async getWeekDaySchedule(request: DoorLock.GetWeekDayScheduleRequest): Promise<DoorLock.GetWeekDayScheduleResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeDoorLockServer: getting week day schedule index ${request.weekDayIndex} for userIndex ${request.userIndex} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    const response = await device.commandHandler.executeHandler('DoorLock.getWeekDaySchedule', {
      command: 'getWeekDaySchedule',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    if (response !== undefined) return response;
    device.log.debug(`MatterbridgeDoorLockServer: getWeekDaySchedule called for userIndex ${request.userIndex} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 5.2.10.5 and § 5.2.10.6: Validate the indexes and return the matching week day schedule or required status.
    return await super.getWeekDaySchedule(request);
  }

  /**
   * Handles the ClearWeekDaySchedule command.
   *
   * @param {DoorLock.ClearWeekDayScheduleRequest} request - Week day schedule index and user index to clear.
   */
  override async clearWeekDaySchedule(request: DoorLock.ClearWeekDayScheduleRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeDoorLockServer: clearing week day schedule index ${request.weekDayIndex} for userIndex ${request.userIndex} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('DoorLock.clearWeekDaySchedule', {
      command: 'clearWeekDaySchedule',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeDoorLockServer: clearWeekDaySchedule called for userIndex ${request.userIndex} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 5.2.10.7: Validate the indexes and clear the specified or all week day schedules for the user.
    await super.clearWeekDaySchedule(request);
  }

  /**
   * Handles the SetYearDaySchedule command.
   *
   * @param {DoorLock.SetYearDayScheduleRequest} request - Year day schedule to set.
   */
  override async setYearDaySchedule(request: DoorLock.SetYearDayScheduleRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeDoorLockServer: setting year day schedule index ${request.yearDayIndex} for userIndex ${request.userIndex} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('DoorLock.setYearDaySchedule', {
      command: 'setYearDaySchedule',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeDoorLockServer: setYearDaySchedule called for userIndex ${request.userIndex} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 5.2.10.8: Validate and store the specified year day schedule for the user.
    await super.setYearDaySchedule(request);
  }

  /**
   * Handles the GetYearDaySchedule command.
   *
   * @param {DoorLock.GetYearDayScheduleRequest} request - Year day schedule index and user index to retrieve.
   * @returns {Promise<DoorLock.GetYearDayScheduleResponse>} The requested year day schedule response.
   */
  override async getYearDaySchedule(request: DoorLock.GetYearDayScheduleRequest): Promise<DoorLock.GetYearDayScheduleResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeDoorLockServer: getting year day schedule index ${request.yearDayIndex} for userIndex ${request.userIndex} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    const response = await device.commandHandler.executeHandler('DoorLock.getYearDaySchedule', {
      command: 'getYearDaySchedule',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    if (response !== undefined) return response;
    device.log.debug(`MatterbridgeDoorLockServer: getYearDaySchedule called for userIndex ${request.userIndex} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 5.2.10.9 and § 5.2.10.10: Validate the indexes and return the matching year day schedule or required status.
    return await super.getYearDaySchedule(request);
  }

  /**
   * Handles the ClearYearDaySchedule command.
   *
   * @param {DoorLock.ClearYearDayScheduleRequest} request - Year day schedule index and user index to clear.
   */
  override async clearYearDaySchedule(request: DoorLock.ClearYearDayScheduleRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeDoorLockServer: clearing year day schedule index ${request.yearDayIndex} for userIndex ${request.userIndex} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('DoorLock.clearYearDaySchedule', {
      command: 'clearYearDaySchedule',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeDoorLockServer: clearYearDaySchedule called for userIndex ${request.userIndex} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 5.2.10.11: Validate the indexes and clear the specified or all year day schedules for the user.
    await super.clearYearDaySchedule(request);
  }

  /**
   * Handles the SetHolidaySchedule command.
   *
   * @param {DoorLock.SetHolidayScheduleRequest} request - Holiday schedule to set.
   */
  override async setHolidaySchedule(request: DoorLock.SetHolidayScheduleRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeDoorLockServer: setting holiday schedule index ${request.holidayIndex} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('DoorLock.setHolidaySchedule', {
      command: 'setHolidaySchedule',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(
      `MatterbridgeDoorLockServer: setHolidaySchedule called for holidayIndex ${request.holidayIndex} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    // Matter 1.6.0 § 5.2.10.12: Validate and store the specified holiday schedule and operating mode.
    await super.setHolidaySchedule(request);
  }

  /**
   * Handles the GetHolidaySchedule command.
   *
   * @param {DoorLock.GetHolidayScheduleRequest} request - Holiday schedule index to retrieve.
   * @returns {Promise<DoorLock.GetHolidayScheduleResponse>} The requested holiday schedule response.
   */
  override async getHolidaySchedule(request: DoorLock.GetHolidayScheduleRequest): Promise<DoorLock.GetHolidayScheduleResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeDoorLockServer: getting holiday schedule index ${request.holidayIndex} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    const response = await device.commandHandler.executeHandler('DoorLock.getHolidaySchedule', {
      command: 'getHolidaySchedule',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    if (response !== undefined) return response;
    device.log.debug(
      `MatterbridgeDoorLockServer: getHolidaySchedule called for holidayIndex ${request.holidayIndex} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    // Matter 1.6.0 § 5.2.10.13 and § 5.2.10.14: Validate HolidayIndex and return the matching holiday schedule or required status.
    return await super.getHolidaySchedule(request);
  }

  /**
   * Handles the ClearHolidaySchedule command.
   *
   * @param {DoorLock.ClearHolidayScheduleRequest} request - Holiday schedule index to clear.
   */
  override async clearHolidaySchedule(request: DoorLock.ClearHolidayScheduleRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeDoorLockServer: clearing holiday schedule index ${request.holidayIndex} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('DoorLock.clearHolidaySchedule', {
      command: 'clearHolidaySchedule',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(
      `MatterbridgeDoorLockServer: clearHolidaySchedule called for holidayIndex ${request.holidayIndex} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    // Matter 1.6.0 § 5.2.10.15: Validate HolidayIndex and clear the specified holiday schedule or all schedules for 0xFE.
    await super.clearHolidaySchedule(request);
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
