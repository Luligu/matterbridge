// src\behaviors\doorLockServer.test.ts

const NAME = 'DoorLockServer';
const MATTER_PORT = 11600;
const MATTER_CREATE_ONLY = true;

import { jest } from '@jest/globals';
import { AggregatorEndpoint } from '@matter/main/endpoints/aggregator';
import { Endpoint, ServerNode } from '@matter/main/node';
import { DoorLock } from '@matter/types/clusters/door-lock';
import { StatusResponse } from '@matter/types/common';
import { wait } from '@matterbridge/utils/wait';
import { LogLevel } from 'node-ansi-logger';

import { createMatterbridgeEnvironment, destroyMatterbridgeEnvironment, startMatterbridgeEnvironment, stopMatterbridgeEnvironment } from '../jestutils/jestMatterbridgeTest.js';
import { addDevice } from '../jestutils/jestMatterTest.js';
import { setupTest } from '../jestutils/jestSetupTest.js';
import { doorLockDevice } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { MatterbridgeDoorLockServer } from './doorLockServer.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Client clusters and behaviors', () => {
  let server: ServerNode<ServerNode.RootEndpoint>;
  let aggregator: Endpoint<AggregatorEndpoint>;
  let doorLock: MatterbridgeEndpoint;
  let userPinDoorLock: MatterbridgeEndpoint;

  function supportedDoorLockServer() {
    return userPinDoorLock.behaviors.supported.doorLock as typeof MatterbridgeDoorLockServer;
  }

  beforeAll(async () => {
    // Set log level to debug for better visibility during tests
    MatterbridgeEndpoint.logLevel = LogLevel.DEBUG;
    // Create Matterbridge environment
    await createMatterbridgeEnvironment();
    [server, aggregator] = await startMatterbridgeEnvironment(MATTER_PORT, MATTER_CREATE_ONLY);
  });

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {});

  afterAll(async () => {
    // Destroy Matterbridge environment
    await stopMatterbridgeEnvironment(MATTER_CREATE_ONLY);
    await destroyMatterbridgeEnvironment();
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('Create doorLockDevice', async () => {
    doorLock = new MatterbridgeEndpoint(doorLockDevice, { id: 'doorLockDevice' });
    expect(doorLock).toBeDefined();
    doorLock.createDefaultDoorLockClusterServer();
    doorLock.addRequiredClusterServers();
    expect(await addDevice(aggregator, doorLock)).toBeDefined();
    expect(doorLock.behaviors.has(MatterbridgeDoorLockServer.with())).toBe(true);
    expect(doorLock.getAttribute(DoorLock.Complete, 'lockState')).toBe(DoorLock.LockState.Locked);
  });

  test('Lock and unlock', async () => {
    await doorLock.invokeBehaviorCommand(DoorLock.Complete, 'unlockDoor', {});
    expect(doorLock.getAttribute(DoorLock.Complete, 'lockState')).toBe(DoorLock.LockState.Unlocked);
    await doorLock.invokeBehaviorCommand(DoorLock.Complete, 'lockDoor', {});
    expect(doorLock.getAttribute(DoorLock.Complete, 'lockState')).toBe(DoorLock.LockState.Locked);
  });

  test('Lock, unlock and lockWithTimeout with actuator disabled', async () => {
    await doorLock.setAttribute(DoorLock.Complete, 'actuatorEnabled', false);
    await doorLock.invokeBehaviorCommand(DoorLock.Complete, 'lockDoor', {});
    expect(doorLock.getAttribute(DoorLock.Complete, 'lockState')).toBe(DoorLock.LockState.Locked);
    await doorLock.invokeBehaviorCommand(DoorLock.Complete, 'unlockDoor', {});
    expect(doorLock.getAttribute(DoorLock.Complete, 'lockState')).toBe(DoorLock.LockState.Locked);
    await doorLock.invokeBehaviorCommand(DoorLock.Complete, 'unlockWithTimeout', { timeout: 1 });
    expect(doorLock.getAttribute(DoorLock.Complete, 'lockState')).toBe(DoorLock.LockState.Locked);
    await doorLock.setAttribute(DoorLock.Complete, 'actuatorEnabled', true);
  });

  test('Auto relock', async () => {
    await doorLock.setAttribute(DoorLock.Complete, 'autoRelockTime', 1); // Set autoRelockTime to 1 second
    await doorLock.invokeBehaviorCommand(DoorLock.Complete, 'unlockDoor', {});
    expect(doorLock.getAttribute(DoorLock.Complete, 'lockState')).toBe(DoorLock.LockState.Unlocked);
    await wait(1000); // Wait for autoRelockTime to trigger
    expect(doorLock.getAttribute(DoorLock.Complete, 'lockState')).toBe(DoorLock.LockState.Locked);
    await doorLock.setAttribute(DoorLock.Complete, 'autoRelockTime', 0); // Set autoRelockTime to 0 (disabled)
  });

  test('Unlock with timeout', async () => {
    await doorLock.invokeBehaviorCommand(DoorLock.Complete, 'unlockWithTimeout', { timeout: 1 });
    expect(doorLock.getAttribute(DoorLock.Complete, 'lockState')).toBe(DoorLock.LockState.Unlocked);
    await wait(1000); // Wait for unlockWithTimeout to trigger
    expect(doorLock.getAttribute(DoorLock.Complete, 'lockState')).toBe(DoorLock.LockState.Locked);
  });

  test('Unlock commands without timeout scheduling', async () => {
    await doorLock.setAttribute(DoorLock.Complete, 'autoRelockTime', 0);

    await doorLock.invokeBehaviorCommand(DoorLock.Complete, 'unlockDoor', {});
    expect(doorLock.getAttribute(DoorLock.Complete, 'lockState')).toBe(DoorLock.LockState.Unlocked);
    await wait(1100);
    expect(doorLock.getAttribute(DoorLock.Complete, 'lockState')).toBe(DoorLock.LockState.Unlocked);

    await doorLock.invokeBehaviorCommand(DoorLock.Complete, 'unlockWithTimeout', { timeout: 1 });
    expect(doorLock.getAttribute(DoorLock.Complete, 'lockState')).toBe(DoorLock.LockState.Unlocked);
    await wait(1100);
    expect(doorLock.getAttribute(DoorLock.Complete, 'lockState')).toBe(DoorLock.LockState.Locked);

    await doorLock.invokeBehaviorCommand(DoorLock.Complete, 'lockDoor', {});
    expect(doorLock.getAttribute(DoorLock.Complete, 'lockState')).toBe(DoorLock.LockState.Locked);
  });

  test('Create userPinDoorLock device', async () => {
    userPinDoorLock = new MatterbridgeEndpoint(doorLockDevice, { id: 'userPinDoorLock' });
    expect(userPinDoorLock).toBeDefined();
    userPinDoorLock.createUserPinDoorLockClusterServer();
    userPinDoorLock.addRequiredClusterServers();
    expect(await addDevice(aggregator, userPinDoorLock)).toBeDefined();
    expect(userPinDoorLock.behaviors.has(userPinDoorLock.behaviors.supported.doorLock)).toBe(true);
    expect(userPinDoorLock.getAttribute(DoorLock.Complete, 'requirePinForRemoteOperation')).toBe(undefined);
    expect(userPinDoorLock.getAttribute(DoorLock.Complete, 'numberOfTotalUsersSupported')).toBe(10);
  });

  test('User PIN set and modify user', async () => {
    const lockUserChange = jest.fn();
    (userPinDoorLock.events as any).doorLock.lockUserChange.on(lockUserChange);

    await userPinDoorLock.invokeBehaviorCommand(DoorLock.Complete, 'setUser', {
      operationType: DoorLock.DataOperationType.Add,
      userIndex: 1,
      userName: 'Guest',
      userUniqueId: 1234,
      userStatus: DoorLock.UserStatus.OccupiedEnabled,
      userType: DoorLock.UserType.UnrestrictedUser,
      credentialRule: DoorLock.CredentialRule.Single,
    });
    const createdUser = await userPinDoorLock.act((agent) => agent.get(supportedDoorLockServer()).getUser({ userIndex: 1 }));

    await userPinDoorLock.invokeBehaviorCommand(DoorLock.Complete, 'setUser', {
      operationType: DoorLock.DataOperationType.Modify,
      userIndex: 1,
      userName: 'Guest Updated',
      userUniqueId: 4321,
      userStatus: DoorLock.UserStatus.OccupiedEnabled,
      userType: DoorLock.UserType.ScheduleRestrictedUser,
      credentialRule: DoorLock.CredentialRule.Single,
    });
    const modifiedUser = await userPinDoorLock.act((agent) => agent.get(supportedDoorLockServer()).getUser({ userIndex: 1 }));

    expect(createdUser).toMatchObject({
      userIndex: 1,
      userName: 'Guest',
      userUniqueId: 1234,
      userStatus: DoorLock.UserStatus.OccupiedEnabled,
      userType: DoorLock.UserType.UnrestrictedUser,
      credentialRule: DoorLock.CredentialRule.Single,
      credentials: [],
    });
    expect(modifiedUser).toMatchObject({
      userIndex: 1,
      userName: 'Guest Updated',
      userUniqueId: 4321,
      userStatus: DoorLock.UserStatus.OccupiedEnabled,
      userType: DoorLock.UserType.ScheduleRestrictedUser,
      credentialRule: DoorLock.CredentialRule.Single,
    });
    expect(lockUserChange).toHaveBeenCalledTimes(2);
    expect(lockUserChange.mock.calls[0]?.[0]).toMatchObject({
      lockDataType: DoorLock.LockDataType.UserIndex,
      dataOperationType: DoorLock.DataOperationType.Add,
      userIndex: 1,
      dataIndex: null,
      operationSource: DoorLock.OperationSource.Remote,
      fabricIndex: expect.any(Number),
      sourceNode: 1n,
    });
    expect(lockUserChange.mock.calls[1]?.[0]).toMatchObject({
      lockDataType: DoorLock.LockDataType.UserIndex,
      dataOperationType: DoorLock.DataOperationType.Modify,
      userIndex: 1,
      dataIndex: null,
    });
  });

  test('User PIN set, modify and clear credential', async () => {
    const lockUserChange = jest.fn();
    const initialPin = Buffer.from('1234');
    const updatedPin = Buffer.from('5678');
    (userPinDoorLock.events as any).doorLock.lockUserChange.on(lockUserChange);

    await userPinDoorLock.invokeBehaviorCommand(DoorLock.Complete, 'setCredential', {
      operationType: DoorLock.DataOperationType.Add,
      credential: { credentialType: DoorLock.CredentialType.Pin, credentialIndex: 1 },
      credentialData: initialPin,
      userIndex: 1,
      userStatus: DoorLock.UserStatus.OccupiedEnabled,
      userType: DoorLock.UserType.UnrestrictedUser,
    });
    const createdCredential = await userPinDoorLock.act((agent) =>
      agent.get(supportedDoorLockServer()).getCredentialStatus({ credential: { credentialType: DoorLock.CredentialType.Pin, credentialIndex: 1 } }),
    );

    await userPinDoorLock.invokeBehaviorCommand(DoorLock.Complete, 'setCredential', {
      operationType: DoorLock.DataOperationType.Modify,
      credential: { credentialType: DoorLock.CredentialType.Pin, credentialIndex: 1 },
      credentialData: updatedPin,
      userIndex: 1,
      userStatus: null,
      userType: null,
    });
    await userPinDoorLock.invokeBehaviorCommand(DoorLock.Complete, 'clearCredential', { credential: null });
    const clearedCredential = await userPinDoorLock.act((agent) =>
      agent.get(supportedDoorLockServer()).getCredentialStatus({ credential: { credentialType: DoorLock.CredentialType.Pin, credentialIndex: 1 } }),
    );

    expect(createdCredential).toMatchObject({
      credentialExists: true,
      userIndex: 1,
      nextCredentialIndex: null,
    });
    expect(clearedCredential).toMatchObject({
      credentialExists: false,
      userIndex: null,
      nextCredentialIndex: null,
    });
    expect(lockUserChange).toHaveBeenCalledTimes(7);
    expect(lockUserChange.mock.calls[0]?.[0]).toMatchObject({
      lockDataType: DoorLock.LockDataType.Pin,
      dataOperationType: DoorLock.DataOperationType.Add,
      userIndex: 1,
      fabricIndex: expect.any(Number),
      sourceNode: 1n,
      dataIndex: 1,
    });
    expect(lockUserChange.mock.calls[1]?.[0]).toMatchObject({
      lockDataType: DoorLock.LockDataType.Pin,
      dataOperationType: DoorLock.DataOperationType.Modify,
      userIndex: 1,
      fabricIndex: expect.any(Number),
      sourceNode: 1n,
      dataIndex: 1,
    });
    expect(lockUserChange.mock.calls[2]?.[0]).toMatchObject({
      lockDataType: DoorLock.LockDataType.Pin,
      dataOperationType: DoorLock.DataOperationType.Clear,
      userIndex: null,
      fabricIndex: expect.any(Number),
      sourceNode: 1n,
      dataIndex: 0xfffe,
    });
  });

  test('User PIN clear user', async () => {
    const lockUserChange = jest.fn();
    (userPinDoorLock.events as any).doorLock.lockUserChange.on(lockUserChange);

    await userPinDoorLock.invokeBehaviorCommand(DoorLock.Complete, 'clearUser', { userIndex: 1 });
    const clearedUser = await userPinDoorLock.act((agent) => agent.get(supportedDoorLockServer()).getUser({ userIndex: 1 }));

    expect(clearedUser).toMatchObject({
      userIndex: 1,
      userName: null,
      userUniqueId: null,
      userStatus: null,
      userType: null,
      credentialRule: null,
      credentials: null,
      nextUserIndex: null,
    });
    expect(lockUserChange).toHaveBeenCalledTimes(1);
    expect(lockUserChange.mock.calls[0]?.[0]).toMatchObject({
      lockDataType: DoorLock.LockDataType.UserIndex,
      dataOperationType: DoorLock.DataOperationType.Clear,
      userIndex: 1,
      fabricIndex: expect.any(Number),
      sourceNode: 1n,
      dataIndex: null,
    });
  });

  test('DoorLock getter delegation and validation', async () => {
    await expect(userPinDoorLock.act((agent) => agent.get(supportedDoorLockServer()).getUser({ userIndex: 0 }))).rejects.toThrow('Invalid user index');

    const handlerResponse: DoorLock.GetUserResponse = {
      userIndex: 7,
      userName: 'Handler User',
      userUniqueId: 700,
      userStatus: DoorLock.UserStatus.OccupiedEnabled,
      userType: DoorLock.UserType.UnrestrictedUser,
      credentialRule: DoorLock.CredentialRule.Single,
      credentials: null,
      creatorFabricIndex: null,
      lastModifiedFabricIndex: null,
      nextUserIndex: null,
    };

    userPinDoorLock.addCommandHandler('DoorLock.getUser', async () => handlerResponse);

    expect(await userPinDoorLock.act((agent) => agent.get(supportedDoorLockServer()).getUser({ userIndex: 7 }))).toEqual(handlerResponse);

    await expect(userPinDoorLock.invokeBehaviorCommand(DoorLock.Complete, 'clearUser', { userIndex: 0 })).rejects.toThrow('Invalid user index');

    const credentialStatus = await userPinDoorLock.act((agent) =>
      agent.get(supportedDoorLockServer()).getCredentialStatus({ credential: { credentialType: DoorLock.CredentialType.Pin, credentialIndex: 1 } }),
    );
    expect(credentialStatus).toMatchObject({ credentialExists: false, userIndex: null });
  });

  test('DoorLock covers null/default user fields and clear all users', async () => {
    const branchDoorLock = new MatterbridgeEndpoint(doorLockDevice, { id: 'branchDoorLockUsers' });
    branchDoorLock.createUserPinDoorLockClusterServer();
    branchDoorLock.addRequiredClusterServers();
    expect(await addDevice(aggregator, branchDoorLock)).toBeDefined();

    const branchDoorLockServer = branchDoorLock.behaviors.supported.doorLock as typeof MatterbridgeDoorLockServer;

    await branchDoorLock.invokeBehaviorCommand(DoorLock.Complete, 'setUser', {
      operationType: DoorLock.DataOperationType.Add,
      userIndex: 2,
      userName: null,
      userUniqueId: null,
      userStatus: null,
      userType: null,
      credentialRule: null,
    });

    expect(await branchDoorLock.act((agent) => agent.get(branchDoorLockServer).getUser({ userIndex: 2 }))).toMatchObject({
      userIndex: 2,
      userName: '',
      userUniqueId: null,
      userStatus: DoorLock.UserStatus.OccupiedEnabled,
      userType: DoorLock.UserType.UnrestrictedUser,
      credentialRule: DoorLock.CredentialRule.Single,
    });

    await branchDoorLock.invokeBehaviorCommand(DoorLock.Complete, 'clearUser', { userIndex: 0xfffe });

    expect(await branchDoorLock.act((agent) => agent.get(branchDoorLockServer).getUser({ userIndex: 2 }))).toMatchObject({
      userIndex: 2,
      userName: null,
      userUniqueId: null,
      userStatus: null,
      userType: null,
      credentialRule: null,
      credentials: null,
      nextUserIndex: null,
    });
  });

  test('DoorLock covers empty credential logging and specific credential clear', async () => {
    const branchDoorLock = new MatterbridgeEndpoint(doorLockDevice, { id: 'branchDoorLockCredentials' });
    branchDoorLock.createUserPinDoorLockClusterServer();
    branchDoorLock.addRequiredClusterServers();
    expect(await addDevice(aggregator, branchDoorLock)).toBeDefined();

    const branchDoorLockServer = branchDoorLock.behaviors.supported.doorLock as typeof MatterbridgeDoorLockServer;

    await branchDoorLock.invokeBehaviorCommand(DoorLock.Complete, 'setCredential', {
      operationType: DoorLock.DataOperationType.Add,
      credential: { credentialType: DoorLock.CredentialType.Pin, credentialIndex: 9 },
      credentialData: Buffer.alloc(0),
      userIndex: null,
      userStatus: null,
      userType: null,
    });

    expect(
      await branchDoorLock.act((agent) => agent.get(branchDoorLockServer).getCredentialStatus({ credential: { credentialType: DoorLock.CredentialType.Pin, credentialIndex: 9 } })),
    ).toMatchObject({
      credentialExists: false,
      userIndex: null,
    });

    await branchDoorLock.invokeBehaviorCommand(DoorLock.Complete, 'setUser', {
      operationType: DoorLock.DataOperationType.Add,
      userIndex: 3,
      userName: 'Specific Credential User',
      userUniqueId: 300,
      userStatus: DoorLock.UserStatus.OccupiedEnabled,
      userType: DoorLock.UserType.UnrestrictedUser,
      credentialRule: DoorLock.CredentialRule.Single,
    });

    await branchDoorLock.invokeBehaviorCommand(DoorLock.Complete, 'setCredential', {
      operationType: DoorLock.DataOperationType.Add,
      credential: { credentialType: DoorLock.CredentialType.Pin, credentialIndex: 2 },
      credentialData: Buffer.from('2468'),
      userIndex: 3,
      userStatus: DoorLock.UserStatus.OccupiedEnabled,
      userType: DoorLock.UserType.UnrestrictedUser,
    });

    expect(
      await branchDoorLock.act((agent) => agent.get(branchDoorLockServer).getCredentialStatus({ credential: { credentialType: DoorLock.CredentialType.Pin, credentialIndex: 2 } })),
    ).toMatchObject({
      credentialExists: true,
      userIndex: 3,
    });

    await branchDoorLock.invokeBehaviorCommand(DoorLock.Complete, 'clearCredential', {
      credential: { credentialType: DoorLock.CredentialType.Pin, credentialIndex: 2 },
    });

    expect(
      await branchDoorLock.act((agent) => agent.get(branchDoorLockServer).getCredentialStatus({ credential: { credentialType: DoorLock.CredentialType.Pin, credentialIndex: 2 } })),
    ).toMatchObject({
      credentialExists: false,
      userIndex: null,
    });
  });
});
