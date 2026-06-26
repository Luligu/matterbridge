// src\behaviors\doorLockServer.test.ts

const NAME = 'DoorLockServer';
const MATTER_PORT = 11600;
const MATTER_CREATE_ONLY = true;

import { DoorLock } from '@matter/types/clusters/door-lock';
import { wait } from '@matterbridge/utils/wait';
import { setupTest } from '@matterbridge/vitest-utils';
import {
  addDevice,
  aggregator,
  createServerNode,
  createTestEnvironment,
  destroyTestEnvironment,
  flushServerNode,
  startServerNode,
  stopServerNode,
} from '@matterbridge/vitest-utils/matter';
import { LogLevel } from 'node-ansi-logger';

import { MatterbridgeDoorLockServer } from '../../src/behaviors/doorLockServer.js';
import { doorLock } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Client clusters and behaviors', () => {
  let lock: MatterbridgeEndpoint;
  let userPinDoorLock: MatterbridgeEndpoint;

  function supportedDoorLockServer(): typeof MatterbridgeDoorLockServer {
    return userPinDoorLock.behaviors.supported.doorLock as typeof MatterbridgeDoorLockServer;
  }

  beforeAll(async () => {
    // Set log level to debug for better visibility during tests
    MatterbridgeEndpoint.logLevel = LogLevel.DEBUG;

    // Setup the Matter test environment
    await createTestEnvironment();

    // Create the server node and aggregator
    await createServerNode(MATTER_PORT);

    // Start the server node if not in create-only mode
    if (!MATTER_CREATE_ONLY) await startServerNode();
  });

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {});

  afterAll(async () => {
    // Stop or flush the server node depending on the create-only mode
    if (MATTER_CREATE_ONLY) await flushServerNode();
    else await stopServerNode();

    // Destroy the Matter test environment
    await destroyTestEnvironment();
    // Restore all mocks
    vi.restoreAllMocks();
  });

  test('Create doorLockDevice', async () => {
    lock = new MatterbridgeEndpoint(doorLock, { id: 'doorLockDevice' });
    expect(lock).toBeDefined();
    lock.createDefaultDoorLockClusterServer();
    lock.addRequiredClusterServers();
    expect(await addDevice(aggregator, lock)).toBeDefined();
    expect(lock.behaviors.has(MatterbridgeDoorLockServer.with())).toBe(true);
    expect(lock.getAttribute(DoorLock, 'lockState')).toBe(DoorLock.LockState.Locked);
  });

  test('Lock and unlock', async () => {
    await lock.invokeBehaviorCommand(DoorLock, 'unlockDoor', {});
    expect(lock.getAttribute(DoorLock, 'lockState')).toBe(DoorLock.LockState.Unlocked);
    await lock.invokeBehaviorCommand(DoorLock, 'lockDoor', {});
    expect(lock.getAttribute(DoorLock, 'lockState')).toBe(DoorLock.LockState.Locked);
  });

  test('Lock, unlock and lockWithTimeout with actuator disabled', async () => {
    await lock.setAttribute(DoorLock, 'actuatorEnabled', false);
    await lock.invokeBehaviorCommand(DoorLock, 'lockDoor', {});
    expect(lock.getAttribute(DoorLock, 'lockState')).toBe(DoorLock.LockState.Locked);
    await lock.invokeBehaviorCommand(DoorLock, 'unlockDoor', {});
    expect(lock.getAttribute(DoorLock, 'lockState')).toBe(DoorLock.LockState.Locked);
    await lock.invokeBehaviorCommand(DoorLock, 'unlockWithTimeout', { timeout: 1 });
    expect(lock.getAttribute(DoorLock, 'lockState')).toBe(DoorLock.LockState.Locked);
    await lock.setAttribute(DoorLock, 'actuatorEnabled', true);
  });

  test('Auto relock', async () => {
    await lock.setAttribute(DoorLock, 'autoRelockTime', 1); // Set autoRelockTime to 1 second
    await lock.invokeBehaviorCommand(DoorLock, 'unlockDoor', {});
    expect(lock.getAttribute(DoorLock, 'lockState')).toBe(DoorLock.LockState.Unlocked);
    await wait(1000); // Wait for autoRelockTime to trigger
    expect(lock.getAttribute(DoorLock, 'lockState')).toBe(DoorLock.LockState.Locked);
    await lock.setAttribute(DoorLock, 'autoRelockTime', 0); // Set autoRelockTime to 0 (disabled)
  });

  test('Unlock with timeout', async () => {
    await lock.invokeBehaviorCommand(DoorLock, 'unlockWithTimeout', { timeout: 1 });
    expect(lock.getAttribute(DoorLock, 'lockState')).toBe(DoorLock.LockState.Unlocked);
    await wait(1000); // Wait for unlockWithTimeout to trigger
    expect(lock.getAttribute(DoorLock, 'lockState')).toBe(DoorLock.LockState.Locked);
  });

  test('Unlock commands without timeout scheduling', async () => {
    await lock.setAttribute(DoorLock, 'autoRelockTime', 0);

    await lock.invokeBehaviorCommand(DoorLock, 'unlockDoor', {});
    expect(lock.getAttribute(DoorLock, 'lockState')).toBe(DoorLock.LockState.Unlocked);
    await wait(1100);
    expect(lock.getAttribute(DoorLock, 'lockState')).toBe(DoorLock.LockState.Unlocked);

    await lock.invokeBehaviorCommand(DoorLock, 'unlockWithTimeout', { timeout: 1 });
    expect(lock.getAttribute(DoorLock, 'lockState')).toBe(DoorLock.LockState.Unlocked);
    await wait(1100);
    expect(lock.getAttribute(DoorLock, 'lockState')).toBe(DoorLock.LockState.Locked);

    await lock.invokeBehaviorCommand(DoorLock, 'lockDoor', {});
    expect(lock.getAttribute(DoorLock, 'lockState')).toBe(DoorLock.LockState.Locked);
  });

  test('Create userPinDoorLock device', async () => {
    userPinDoorLock = new MatterbridgeEndpoint(doorLock, { id: 'userPinDoorLock' });
    expect(userPinDoorLock).toBeDefined();
    userPinDoorLock.createUserPinDoorLockClusterServer();
    userPinDoorLock.addRequiredClusterServers();
    expect(await addDevice(aggregator, userPinDoorLock)).toBeDefined();
    expect(userPinDoorLock.behaviors.has(userPinDoorLock.behaviors.supported.doorLock)).toBe(true);
    expect(userPinDoorLock.getAttribute(DoorLock, 'requirePinForRemoteOperation')).toBe(undefined);
    expect(userPinDoorLock.getAttribute(DoorLock, 'numberOfTotalUsersSupported')).toBe(10);
  });

  test('User PIN set and modify user', async () => {
    const lockUserChange = vi.fn();
    (userPinDoorLock.events as any).doorLock.lockUserChange.on(lockUserChange);

    await userPinDoorLock.invokeBehaviorCommand(DoorLock, 'setUser', {
      operationType: DoorLock.DataOperationType.Add,
      userIndex: 1,
      userName: 'Guest',
      userUniqueId: 1234,
      userStatus: DoorLock.UserStatus.OccupiedEnabled,
      userType: DoorLock.UserType.UnrestrictedUser,
      credentialRule: DoorLock.CredentialRule.Single,
    });
    const createdUser = await userPinDoorLock.act(async (agent) => agent.get(supportedDoorLockServer()).getUser({ userIndex: 1 }));

    await userPinDoorLock.invokeBehaviorCommand(DoorLock, 'setUser', {
      operationType: DoorLock.DataOperationType.Modify,
      userIndex: 1,
      userName: 'Guest Updated',
      userUniqueId: 4321,
      userStatus: DoorLock.UserStatus.OccupiedEnabled,
      userType: DoorLock.UserType.ScheduleRestrictedUser,
      credentialRule: DoorLock.CredentialRule.Single,
    });
    const modifiedUser = await userPinDoorLock.act(async (agent) => agent.get(supportedDoorLockServer()).getUser({ userIndex: 1 }));

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
      sourceNode: null,
    });
    expect(lockUserChange.mock.calls[1]?.[0]).toMatchObject({
      lockDataType: DoorLock.LockDataType.UserIndex,
      dataOperationType: DoorLock.DataOperationType.Modify,
      userIndex: 1,
      dataIndex: null,
    });
  });

  test('User PIN set, modify and clear credential', async () => {
    const lockUserChange = vi.fn();
    const initialPin = Buffer.from('1234');
    const updatedPin = Buffer.from('5678');
    (userPinDoorLock.events as any).doorLock.lockUserChange.on(lockUserChange);

    await userPinDoorLock.invokeBehaviorCommand(DoorLock, 'setCredential', {
      operationType: DoorLock.DataOperationType.Add,
      credential: { credentialType: DoorLock.CredentialType.Pin, credentialIndex: 1 },
      credentialData: initialPin,
      userIndex: 1,
      userStatus: DoorLock.UserStatus.OccupiedEnabled,
      userType: DoorLock.UserType.UnrestrictedUser,
    });
    const createdCredential = await userPinDoorLock.act(async (agent) =>
      agent.get(supportedDoorLockServer()).getCredentialStatus({ credential: { credentialType: DoorLock.CredentialType.Pin, credentialIndex: 1 } }),
    );

    await userPinDoorLock.invokeBehaviorCommand(DoorLock, 'setCredential', {
      operationType: DoorLock.DataOperationType.Modify,
      credential: { credentialType: DoorLock.CredentialType.Pin, credentialIndex: 1 },
      credentialData: updatedPin,
      userIndex: 1,
      userStatus: null,
      userType: null,
    });
    await userPinDoorLock.invokeBehaviorCommand(DoorLock, 'clearCredential', { credential: null });
    const clearedCredential = await userPinDoorLock.act(async (agent) =>
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
      sourceNode: null,
      dataIndex: 1,
    });
    expect(lockUserChange.mock.calls[1]?.[0]).toMatchObject({
      lockDataType: DoorLock.LockDataType.Pin,
      dataOperationType: DoorLock.DataOperationType.Modify,
      userIndex: 1,
      fabricIndex: expect.any(Number),
      sourceNode: null,
      dataIndex: 1,
    });
    expect(lockUserChange.mock.calls[2]?.[0]).toMatchObject({
      lockDataType: DoorLock.LockDataType.Pin,
      dataOperationType: DoorLock.DataOperationType.Clear,
      userIndex: null,
      fabricIndex: expect.any(Number),
      sourceNode: null,
      dataIndex: 0xfffe,
    });
  });

  test('User PIN clear user', async () => {
    const lockUserChange = vi.fn();
    (userPinDoorLock.events as any).doorLock.lockUserChange.on(lockUserChange);

    await userPinDoorLock.invokeBehaviorCommand(DoorLock, 'clearUser', { userIndex: 1 });
    const clearedUser = await userPinDoorLock.act(async (agent) => agent.get(supportedDoorLockServer()).getUser({ userIndex: 1 }));

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
      sourceNode: null,
      dataIndex: null,
    });
  });

  test('DoorLock getter delegation and validation', async () => {
    await expect(userPinDoorLock.act(async (agent) => agent.get(supportedDoorLockServer()).getUser({ userIndex: 0 }))).rejects.toThrow('Invalid user index');

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

    userPinDoorLock.addCommandHandler('DoorLock.getUser', () => handlerResponse);

    expect(await userPinDoorLock.act(async (agent) => agent.get(supportedDoorLockServer()).getUser({ userIndex: 7 }))).toEqual(handlerResponse);

    await expect(userPinDoorLock.invokeBehaviorCommand(DoorLock, 'clearUser', { userIndex: 0 })).rejects.toThrow('Invalid user index');

    const credentialStatus = await userPinDoorLock.act(async (agent) =>
      agent.get(supportedDoorLockServer()).getCredentialStatus({ credential: { credentialType: DoorLock.CredentialType.Pin, credentialIndex: 1 } }),
    );
    expect(credentialStatus).toMatchObject({ credentialExists: false, userIndex: null });
  });

  test('DoorLock covers null/default user fields and clear all users', async () => {
    const branchDoorLock = new MatterbridgeEndpoint(doorLock, { id: 'branchDoorLockUsers' });
    branchDoorLock.createUserPinDoorLockClusterServer();
    branchDoorLock.addRequiredClusterServers();
    expect(await addDevice(aggregator, branchDoorLock)).toBeDefined();

    const branchDoorLockServer = branchDoorLock.behaviors.supported.doorLock as typeof MatterbridgeDoorLockServer;

    await branchDoorLock.invokeBehaviorCommand(DoorLock, 'setUser', {
      operationType: DoorLock.DataOperationType.Add,
      userIndex: 2,
      userName: null,
      userUniqueId: null,
      userStatus: null,
      userType: null,
      credentialRule: null,
    });

    expect(await branchDoorLock.act(async (agent) => agent.get(branchDoorLockServer).getUser({ userIndex: 2 }))).toMatchObject({
      userIndex: 2,
      userName: '',
      userUniqueId: null,
      userStatus: DoorLock.UserStatus.OccupiedEnabled,
      userType: DoorLock.UserType.UnrestrictedUser,
      credentialRule: DoorLock.CredentialRule.Single,
    });

    await branchDoorLock.invokeBehaviorCommand(DoorLock, 'clearUser', { userIndex: 0xfffe });

    expect(await branchDoorLock.act(async (agent) => agent.get(branchDoorLockServer).getUser({ userIndex: 2 }))).toMatchObject({
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
    const branchDoorLock = new MatterbridgeEndpoint(doorLock, { id: 'branchDoorLockCredentials' });
    branchDoorLock.createUserPinDoorLockClusterServer();
    branchDoorLock.addRequiredClusterServers();
    expect(await addDevice(aggregator, branchDoorLock)).toBeDefined();

    const branchDoorLockServer = branchDoorLock.behaviors.supported.doorLock as typeof MatterbridgeDoorLockServer;

    await branchDoorLock.invokeBehaviorCommand(DoorLock, 'setCredential', {
      operationType: DoorLock.DataOperationType.Add,
      credential: { credentialType: DoorLock.CredentialType.Pin, credentialIndex: 9 },
      credentialData: Buffer.alloc(0),
      userIndex: null,
      userStatus: null,
      userType: null,
    });

    expect(
      await branchDoorLock.act(async (agent) =>
        agent.get(branchDoorLockServer).getCredentialStatus({ credential: { credentialType: DoorLock.CredentialType.Pin, credentialIndex: 9 } }),
      ),
    ).toMatchObject({
      credentialExists: false,
      userIndex: null,
    });

    await branchDoorLock.invokeBehaviorCommand(DoorLock, 'setUser', {
      operationType: DoorLock.DataOperationType.Add,
      userIndex: 3,
      userName: 'Specific Credential User',
      userUniqueId: 300,
      userStatus: DoorLock.UserStatus.OccupiedEnabled,
      userType: DoorLock.UserType.UnrestrictedUser,
      credentialRule: DoorLock.CredentialRule.Single,
    });

    await branchDoorLock.invokeBehaviorCommand(DoorLock, 'setCredential', {
      operationType: DoorLock.DataOperationType.Add,
      credential: { credentialType: DoorLock.CredentialType.Pin, credentialIndex: 2 },
      credentialData: Buffer.from('2468'),
      userIndex: 3,
      userStatus: DoorLock.UserStatus.OccupiedEnabled,
      userType: DoorLock.UserType.UnrestrictedUser,
    });

    expect(
      await branchDoorLock.act(async (agent) =>
        agent.get(branchDoorLockServer).getCredentialStatus({ credential: { credentialType: DoorLock.CredentialType.Pin, credentialIndex: 2 } }),
      ),
    ).toMatchObject({
      credentialExists: true,
      userIndex: 3,
    });

    await branchDoorLock.invokeBehaviorCommand(DoorLock, 'clearCredential', {
      credential: { credentialType: DoorLock.CredentialType.Pin, credentialIndex: 2 },
    });

    expect(
      await branchDoorLock.act(async (agent) =>
        agent.get(branchDoorLockServer).getCredentialStatus({ credential: { credentialType: DoorLock.CredentialType.Pin, credentialIndex: 2 } }),
      ),
    ).toMatchObject({
      credentialExists: false,
      userIndex: null,
    });
  });
});
