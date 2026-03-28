/**
 * This file contains the MatterbridgePinDoorLockServer class of Matterbridge.
 *
 * @file pinDoorLockServer.ts
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
import { getEnumDescription } from '@matterbridge/utils';

import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';
import { MatterbridgeServer } from './matterbridgeServer.js';

/**
 * DoorLock server with PinCredential and CredentialOverTheAirAccess features that forwards lock, user, and credential commands to the Matterbridge command handler.
 * This is not supported by Apple Home. Home requires User and Pin.
 * Work in progress. Waiting https://github.com/matter-js/matter.js/issues/3468.
 */
export class MatterbridgePinDoorLockServer extends DoorLockServer.with(DoorLock.Feature.PinCredential, DoorLock.Feature.CredentialOverTheAirAccess).enable({
  events: { doorLockAlarm: true, lockOperation: true, lockOperationError: true },
  commands: { lockDoor: true, unlockDoor: true, unlockWithTimeout: true, setUserStatus: true, getUserStatus: true, setUserType: true, getUserType: true },
}) {
  /**
   * Handles the LockDoor command.
   * It will set lockState to Locked.
   *
   * @param {DoorLock.LockDoorRequest} request - Lock-door request payload.
   */
  override async lockDoor(request: DoorLock.LockDoorRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Locking door with pincode ${request.pinCode ? '0x' + Buffer.from(request.pinCode).toString('hex') : 'N/A'} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
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
    device.log.info(
      `Unlocking door with pincode ${request.pinCode ? '0x' + Buffer.from(request.pinCode).toString('hex') : 'N/A'} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
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
    device.log.info(
      `Unlocking door with pincode ${request.pinCode ? '0x' + Buffer.from(request.pinCode).toString('hex') : 'N/A'} timeout ${request.timeout} seconds (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
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

  /**
   * Handles the SetPinCode command (feature PinCredential not User).
   *
   * @param {DoorLock.SetPinCodeRequest} request - Set-pin-code request payload.
   */
  override async setPinCode(request: DoorLock.SetPinCodeRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Setting pin code ${request.pin ? '0x' + Buffer.from(request.pin).toString('hex') : 'N/A'} for user ${request.userId} type ${getEnumDescription(DoorLock.UserType, request.userType)} status ${getEnumDescription(DoorLock.UserStatus, request.userStatus)} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('DoorLock.setPinCode', {
      command: 'setPinCode',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeDoorLockServer: setPinCode called for user ${request.userId}`);
  }

  /**
   *  Handles the GetPinCode command (feature PinCredential not User).
   *
   * @param {DoorLock.GetPinCodeRequest} request - Get-pin-code request payload.
   * @returns {Promise<DoorLock.GetPinCodeResponse>} - Get-pin-code response payload.
   */
  override async getPinCode(request: DoorLock.GetPinCodeRequest): Promise<DoorLock.GetPinCodeResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Getting pin code for user ${request.userId} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('DoorLock.getPinCode', {
      command: 'getPinCode',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    return {
      userId: request.userId,
      userStatus: DoorLock.UserStatus.Available,
      userType: DoorLock.UserType.UnrestrictedUser,
      pinCode: Buffer.from('1234'),
    };
  }

  /**
   * Handles the ClearPinCode command (feature PinCredential not User).
   *
   * @param {DoorLock.ClearPinCodeRequest} request - Clear-pin-code request payload.
   */
  override async clearPinCode(request: DoorLock.ClearPinCodeRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Clearing pin code for ${request.pinSlotIndex === 0xfffe ? 'all slots' : 'slot ' + request.pinSlotIndex} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('DoorLock.clearPinCode', {
      command: 'clearPinCode',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeDoorLockServer: clearPinCode called for ${request.pinSlotIndex === 0xfffe ? 'all PIN slots' : 'PIN slot ' + request.pinSlotIndex}`);
  }

  /**
   * Handles the ClearAllPinCodes command (feature PinCredential not User).
   */
  override async clearAllPinCodes(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Clearing all pin codes (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('DoorLock.clearAllPinCodes', {
      command: 'clearAllPinCodes',
      request: {},
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug('MatterbridgeDoorLockServer: clearAllPinCodes called');
  }

  /**
   * Handles the SetUserStatus command (feature PinCredential not User).
   * The implementation of user management is left to the device, here we just forward the command and log it.
   *
   * @param {DoorLock.SetUserStatusRequest} request - SetUserStatus request payload.
   * @returns {Promise<void>} - Promise that resolves when the command is executed.
   */
  async setUserStatus(request: DoorLock.SetUserStatusRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Setting user status for user ${request.userId} to ${getEnumDescription(DoorLock.UserStatus, request.userStatus)} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('DoorLock.setUserStatus', {
      command: 'setUserStatus',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeDoorLockServer: setUserStatus called for user ${request.userId}`);
  }

  /**
   * Handles the GetUserStatus command (feature PinCredential not User).
   * The implementation of user management is left to the device, here we just forward the command and log it.
   *
   * @param {DoorLock.SetUserStatusRequest} request - GetUserStatus request payload.
   * @returns {Promise<DoorLock.GetUserStatusResponse>} - GetUserStatus response payload with dummy data for testing purposes.
   */
  async getUserStatus(request: DoorLock.GetUserStatusRequest): Promise<DoorLock.GetUserStatusResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Getting user status for user ${request.userId} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('DoorLock.getUserStatus', {
      command: 'getUserStatus',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeDoorLockServer: getUserStatus called for user ${request.userId}`);
    return {
      userId: request.userId,
      userStatus: DoorLock.UserStatus.Available,
    };
  }

  /**
   * Handles the SetUserType command (feature PinCredential not User).
   * The implementation of user management is left to the device, here we just forward the command and log it.
   *
   * @param {DoorLock.SetUserTypeRequest} request - SetUserType request payload.
   * @returns {Promise<void>} - Promise that resolves when the command is executed.
   */
  async setUserType(request: DoorLock.SetUserTypeRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Setting user type for user ${request.userId} to ${getEnumDescription(DoorLock.UserType, request.userType)} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('DoorLock.setUserType', {
      command: 'setUserType',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeDoorLockServer: setUserType called for user ${request.userId}`);
  }

  /**
   * Handles the GetUserType command (feature PinCredential not User).
   * The implementation of user management is left to the device, here we just forward the command and log it.
   *
   * @param {DoorLock.GetUserTypeRequest} request - GetUserType request payload.
   * @returns {Promise<DoorLock.GetUserTypeResponse>} - GetUserType response payload with dummy data for testing purposes.
   */
  async getUserType(request: DoorLock.GetUserTypeRequest): Promise<DoorLock.GetUserTypeResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Getting user type for user ${request.userId} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('DoorLock.getUserType', {
      command: 'getUserType',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeDoorLockServer: getUserType called for user ${request.userId}`);
    return {
      userId: request.userId,
      userType: DoorLock.UserType.UnrestrictedUser,
    };
  }
}
