// src\behaviors\doorLockServer.test.ts

const NAME = 'DoorLockServer';
const MATTER_PORT = 11600;
const MATTER_CREATE_ONLY = true;

import { jest } from '@jest/globals';
import { AggregatorEndpoint } from '@matter/main/endpoints/aggregator';
import { Endpoint, ServerNode } from '@matter/main/node';
import { DoorLock } from '@matter/types/clusters/door-lock';
import { StatusResponse } from '@matter/types/common';
import { FabricIndex, NodeId } from '@matter/types/datatype';
import { wait } from '@matterbridge/utils/wait';
import { LogLevel } from 'node-ansi-logger';

import { createMatterbridgeEnvironment, destroyMatterbridgeEnvironment, startMatterbridgeEnvironment, stopMatterbridgeEnvironment } from '../jestutils/jestMatterbridgeTest.js';
import { addDevice } from '../jestutils/jestMatterTest.js';
import { setupTest } from '../jestutils/jestSetupTest.js';
import { doorLockDevice } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { internalFor } from '../matterbridgeEndpointHelpers.js';
import { MatterbridgeDoorLockServer } from './doorLockServer.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Client clusters and behaviors', () => {
  let server: ServerNode<ServerNode.RootEndpoint>;
  let aggregator: Endpoint<AggregatorEndpoint>;
  let doorLock: MatterbridgeEndpoint;
  let userPinDoorLock: MatterbridgeEndpoint;

  beforeAll(async () => {
    // Set log level to debug for better visibility during tests
    MatterbridgeEndpoint.logLevel = LogLevel.DEBUG;
    // Create Matterbridge environment
    await createMatterbridgeEnvironment(NAME, MATTER_CREATE_ONLY);
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
    await destroyMatterbridgeEnvironment(10, 10, !MATTER_CREATE_ONLY);
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
    const internal = await internalFor(doorLock, MatterbridgeDoorLockServer);
    expect(internal).toBeDefined();
    if (!internal) throw new Error('MatterbridgeDoorLockServer internal state not found');
    internal.enableTimeout = true;
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
    const internal = await internalFor(doorLock, MatterbridgeDoorLockServer);
    expect(internal).toBeDefined();
    if (!internal) throw new Error('MatterbridgeDoorLockServer internal state not found');

    internal.enableTimeout = false;
    await doorLock.setAttribute(DoorLock.Complete, 'autoRelockTime', 0);

    await doorLock.invokeBehaviorCommand(DoorLock.Complete, 'unlockDoor', {});
    expect(doorLock.getAttribute(DoorLock.Complete, 'lockState')).toBe(DoorLock.LockState.Unlocked);
    await wait(1100);
    expect(doorLock.getAttribute(DoorLock.Complete, 'lockState')).toBe(DoorLock.LockState.Unlocked);

    await doorLock.invokeBehaviorCommand(DoorLock.Complete, 'unlockWithTimeout', { timeout: 1 });
    expect(doorLock.getAttribute(DoorLock.Complete, 'lockState')).toBe(DoorLock.LockState.Unlocked);
    await wait(1100);
    expect(doorLock.getAttribute(DoorLock.Complete, 'lockState')).toBe(DoorLock.LockState.Unlocked);

    await doorLock.invokeBehaviorCommand(DoorLock.Complete, 'lockDoor', {});
    expect(doorLock.getAttribute(DoorLock.Complete, 'lockState')).toBe(DoorLock.LockState.Locked);
    internal.enableTimeout = true;
  });

  test('Create userPinDoorLock device', async () => {
    userPinDoorLock = new MatterbridgeEndpoint(doorLockDevice, { id: 'userPinDoorLock' });
    expect(userPinDoorLock).toBeDefined();
    userPinDoorLock.createUserPinDoorLockClusterServer();
    userPinDoorLock.addRequiredClusterServers();
    expect(await addDevice(aggregator, userPinDoorLock)).toBeDefined();
    expect(userPinDoorLock.behaviors.has(MatterbridgeDoorLockServer)).toBe(true);
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
    const createdUser = await userPinDoorLock.act((agent) => agent.get(MatterbridgeDoorLockServer).getUser({ userIndex: 1 }));

    await userPinDoorLock.invokeBehaviorCommand(DoorLock.Complete, 'setUser', {
      operationType: DoorLock.DataOperationType.Modify,
      userIndex: 1,
      userName: 'Guest Updated',
      userUniqueId: 4321,
      userStatus: DoorLock.UserStatus.OccupiedEnabled,
      userType: DoorLock.UserType.ScheduleRestrictedUser,
      credentialRule: DoorLock.CredentialRule.Single,
    });
    const modifiedUser = await userPinDoorLock.act((agent) => agent.get(MatterbridgeDoorLockServer).getUser({ userIndex: 1 }));
    const internal = await internalFor(userPinDoorLock, MatterbridgeDoorLockServer);

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
    expect(internal?.users).toHaveLength(1);
    expect(internal?.users[0]).toMatchObject({
      userIndex: 1,
      userName: 'Guest Updated',
      userUniqueId: 4321,
      userType: DoorLock.UserType.ScheduleRestrictedUser,
    });
    expect(lockUserChange).toHaveBeenCalledTimes(2);
    expect(lockUserChange.mock.calls[0]?.[0]).toMatchObject({
      lockDataType: DoorLock.LockDataType.UserIndex,
      dataOperationType: DoorLock.DataOperationType.Add,
      userIndex: 1,
      dataIndex: 1,
      operationSource: DoorLock.OperationSource.Unspecified,
      fabricIndex: null,
      sourceNode: null,
    });
    expect(lockUserChange.mock.calls[1]?.[0]).toMatchObject({
      lockDataType: DoorLock.LockDataType.UserIndex,
      dataOperationType: DoorLock.DataOperationType.Modify,
      userIndex: 1,
      dataIndex: 1,
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
      agent.get(MatterbridgeDoorLockServer).getCredentialStatus({ credential: { credentialType: DoorLock.CredentialType.Pin, credentialIndex: 1 } }),
    );

    await userPinDoorLock.invokeBehaviorCommand(DoorLock.Complete, 'setCredential', {
      operationType: DoorLock.DataOperationType.Modify,
      credential: { credentialType: DoorLock.CredentialType.Pin, credentialIndex: 1 },
      credentialData: updatedPin,
      userIndex: 1,
      userStatus: null,
      userType: null,
    });
    const internal = await internalFor(userPinDoorLock, MatterbridgeDoorLockServer);

    await userPinDoorLock.invokeBehaviorCommand(DoorLock.Complete, 'clearCredential', { credential: null });
    const clearedCredential = await userPinDoorLock.act((agent) =>
      agent.get(MatterbridgeDoorLockServer).getCredentialStatus({ credential: { credentialType: DoorLock.CredentialType.Pin, credentialIndex: 1 } }),
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
    expect(internal?.users[0]?.credentials).toEqual([]);
    expect(lockUserChange).toHaveBeenCalledTimes(3);
    expect(lockUserChange.mock.calls[0]?.[0]).toMatchObject({
      lockDataType: DoorLock.LockDataType.Pin,
      dataOperationType: DoorLock.DataOperationType.Add,
      userIndex: 1,
      dataIndex: 1,
    });
    expect(lockUserChange.mock.calls[1]?.[0]).toMatchObject({
      lockDataType: DoorLock.LockDataType.Pin,
      dataOperationType: DoorLock.DataOperationType.Modify,
      userIndex: 1,
      dataIndex: 1,
    });
    expect(lockUserChange.mock.calls[2]?.[0]).toMatchObject({
      lockDataType: DoorLock.LockDataType.Pin,
      dataOperationType: DoorLock.DataOperationType.Clear,
      userIndex: null,
      dataIndex: 0xfffe,
    });
  });

  test('User PIN clear user', async () => {
    const lockUserChange = jest.fn();
    (userPinDoorLock.events as any).doorLock.lockUserChange.on(lockUserChange);

    await userPinDoorLock.invokeBehaviorCommand(DoorLock.Complete, 'clearUser', { userIndex: 1 });
    const clearedUser = await userPinDoorLock.act((agent) => agent.get(MatterbridgeDoorLockServer).getUser({ userIndex: 1 }));
    const internal = await internalFor(userPinDoorLock, MatterbridgeDoorLockServer);

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
    expect(internal?.users).toEqual([]);
    expect(lockUserChange).toHaveBeenCalledTimes(1);
    expect(lockUserChange.mock.calls[0]?.[0]).toMatchObject({
      lockDataType: DoorLock.LockDataType.UserIndex,
      dataOperationType: DoorLock.DataOperationType.Clear,
      userIndex: 1,
      dataIndex: 1,
    });
  });

  test('DoorLock null and default command branches', async () => {
    const info = jest.fn();
    const debug = jest.fn();
    const executeHandler = jest.fn<() => Promise<undefined>>().mockResolvedValue(undefined);
    const emit = jest.fn();
    const endpoint = {
      maybeId: 'doorLockNullBranchMock',
      maybeNumber: 112,
      stateOf: () => ({
        log: { info, debug },
        commandHandler: { executeHandler },
      }),
    };
    const internal = new MatterbridgeDoorLockServer.Internal();
    internal.users = [
      {
        userIndex: 3,
        userName: 'Persisted User',
        userUniqueId: 3003,
        userStatus: DoorLock.UserStatus.OccupiedEnabled,
        userType: DoorLock.UserType.UnrestrictedUser,
        credentialRule: DoorLock.CredentialRule.Single,
        credentials: null,
        creatorFabricIndex: FabricIndex(7),
        lastModifiedFabricIndex: FabricIndex(7),
      },
      {
        userIndex: 4,
        userName: 'Available User',
        userUniqueId: 3004,
        userStatus: DoorLock.UserStatus.Available,
        userType: DoorLock.UserType.UnrestrictedUser,
        credentialRule: DoorLock.CredentialRule.Single,
        credentials: null,
        creatorFabricIndex: FabricIndex(7),
        lastModifiedFabricIndex: FabricIndex(7),
      },
    ];
    const behavior = {
      endpoint,
      state: { numberOfTotalUsersSupported: 10 },
      internal,
      context: {
        fabric: FabricIndex(7),
        subject: {},
        session: {},
      },
      events: { lockUserChange: { emit } },
    } as unknown as MatterbridgeDoorLockServer;
    Object.setPrototypeOf(behavior, MatterbridgeDoorLockServer.prototype);

    await MatterbridgeDoorLockServer.prototype.setUser.call(behavior, {
      operationType: DoorLock.DataOperationType.Add,
      userIndex: 5,
      userName: null,
      userUniqueId: null,
      userStatus: null,
      userType: null,
      credentialRule: null,
    } as DoorLock.SetUserRequest);
    await MatterbridgeDoorLockServer.prototype.setUser.call(behavior, {
      operationType: DoorLock.DataOperationType.Modify,
      userIndex: 3,
      userName: null,
      userUniqueId: null,
      userStatus: null,
      userType: null,
      credentialRule: null,
    } as DoorLock.SetUserRequest);
    await MatterbridgeDoorLockServer.prototype.setUser.call(behavior, {
      operationType: DoorLock.DataOperationType.Modify,
      userIndex: 99,
      userName: null,
      userUniqueId: null,
      userStatus: null,
      userType: null,
      credentialRule: null,
    } as DoorLock.SetUserRequest);

    const defaultedUser = await MatterbridgeDoorLockServer.prototype.getUser.call(behavior, { userIndex: 5 } as DoorLock.GetUserRequest);
    const unchangedUser = await MatterbridgeDoorLockServer.prototype.getUser.call(behavior, { userIndex: 3 } as DoorLock.GetUserRequest);

    const setCredentialResponse = await MatterbridgeDoorLockServer.prototype.setCredential.call(behavior, {
      operationType: DoorLock.DataOperationType.Add,
      credential: { credentialType: DoorLock.CredentialType.ProgrammingPin, credentialIndex: 0 },
      credentialData: new Uint8Array(),
      userIndex: 3,
      userStatus: null,
      userType: null,
    } as DoorLock.SetCredentialRequest);
    await MatterbridgeDoorLockServer.prototype.setCredential.call(behavior, {
      operationType: DoorLock.DataOperationType.Clear,
      credential: { credentialType: DoorLock.CredentialType.Pin, credentialIndex: 11 },
      credentialData: new Uint8Array(),
      userIndex: null,
      userStatus: null,
      userType: null,
    } as DoorLock.SetCredentialRequest);
    await MatterbridgeDoorLockServer.prototype.clearCredential.call(behavior, {
      credential: { credentialType: DoorLock.CredentialType.Face, credentialIndex: 9 },
    } as DoorLock.ClearCredentialRequest);

    expect(defaultedUser).toMatchObject({
      userIndex: 5,
      userName: '',
      userUniqueId: 0xffffffff,
      userStatus: DoorLock.UserStatus.OccupiedEnabled,
      userType: DoorLock.UserType.UnrestrictedUser,
      credentialRule: DoorLock.CredentialRule.Single,
      credentials: [],
      nextUserIndex: null,
    });
    expect(unchangedUser).toMatchObject({
      userIndex: 3,
      userName: 'Persisted User',
      userUniqueId: 3003,
      userStatus: DoorLock.UserStatus.OccupiedEnabled,
      userType: DoorLock.UserType.UnrestrictedUser,
      credentialRule: DoorLock.CredentialRule.Single,
      credentials: null,
      nextUserIndex: null,
    });
    expect(setCredentialResponse).toMatchObject({ status: 0, userIndex: 3 });
    expect(internal.users.find((user) => user.userIndex === 3)?.credentials).toMatchObject([
      {
        credentialType: DoorLock.CredentialType.ProgrammingPin,
        credentialIndex: 0,
        credentialData: new Uint8Array(),
      },
    ]);
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        lockDataType: DoorLock.LockDataType.ProgrammingCode,
        dataOperationType: DoorLock.DataOperationType.Add,
        userIndex: 3,
        dataIndex: null,
        fabricIndex: FabricIndex(7),
        sourceNode: null,
      }),
      behavior.context,
    );
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        lockDataType: DoorLock.LockDataType.Face,
        dataOperationType: DoorLock.DataOperationType.Clear,
        userIndex: null,
        dataIndex: 9,
        fabricIndex: FabricIndex(7),
        sourceNode: null,
      }),
      behavior.context,
    );
    expect(debug).toHaveBeenCalledWith(
      'MatterbridgeDoorLockServer: setCredential did not update internal state for credentialIndex 11 (user null not found or operation not handled)',
    );
  });

  test('DoorLock edge branches and helper coverage', async () => {
    const info = jest.fn();
    const debug = jest.fn();
    const executeHandler = jest
      .fn<() => Promise<DoorLock.GetUserResponse | undefined>>()
      .mockResolvedValueOnce({
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
      })
      .mockResolvedValue(undefined);
    const emit = jest.fn();
    const endpoint = {
      maybeId: 'doorLockCoverageMock',
      maybeNumber: 111,
      stateOf: () => ({
        log: { info, debug },
        commandHandler: { executeHandler },
      }),
    };
    const internal = new MatterbridgeDoorLockServer.Internal();
    internal.users = [
      {
        userIndex: 1,
        userName: 'Coverage User',
        userUniqueId: 1001,
        userStatus: DoorLock.UserStatus.OccupiedEnabled,
        userType: DoorLock.UserType.UnrestrictedUser,
        credentialRule: DoorLock.CredentialRule.Single,
        credentials: [
          {
            credentialType: DoorLock.CredentialType.Pin,
            credentialIndex: 1,
            credentialData: Buffer.from('1111'),
            creatorFabricIndex: FabricIndex(2),
            lastModifiedFabricIndex: FabricIndex(2),
          },
          {
            credentialType: DoorLock.CredentialType.Rfid,
            credentialIndex: 3,
            credentialData: Buffer.from('rfid'),
            creatorFabricIndex: FabricIndex(2),
            lastModifiedFabricIndex: FabricIndex(2),
          },
        ],
        creatorFabricIndex: FabricIndex(2),
        lastModifiedFabricIndex: FabricIndex(2),
      },
      {
        userIndex: 2,
        userName: 'Next User',
        userUniqueId: 1002,
        userStatus: DoorLock.UserStatus.OccupiedEnabled,
        userType: DoorLock.UserType.UnrestrictedUser,
        credentialRule: DoorLock.CredentialRule.Single,
        credentials: [
          {
            credentialType: DoorLock.CredentialType.ProgrammingPin,
            credentialIndex: 0,
            credentialData: Buffer.from('prog'),
            creatorFabricIndex: FabricIndex(2),
            lastModifiedFabricIndex: FabricIndex(2),
          },
        ],
        creatorFabricIndex: FabricIndex(2),
        lastModifiedFabricIndex: FabricIndex(2),
      },
    ];
    const behavior = {
      endpoint,
      state: { numberOfTotalUsersSupported: 10 },
      internal,
      context: {
        fabric: FabricIndex(2),
        subject: {},
        session: { peerNodeId: NodeId(44) },
      },
      events: { lockUserChange: { emit } },
    } as unknown as MatterbridgeDoorLockServer;
    Object.setPrototypeOf(behavior, MatterbridgeDoorLockServer.prototype);

    const delegatedUser = await MatterbridgeDoorLockServer.prototype.getUser.call(behavior, { userIndex: 7 } as DoorLock.GetUserRequest);
    const existingUser = await MatterbridgeDoorLockServer.prototype.getUser.call(behavior, { userIndex: 1 } as DoorLock.GetUserRequest);
    const credentialGapStatus = await MatterbridgeDoorLockServer.prototype.getCredentialStatus.call(behavior, {
      credential: { credentialType: DoorLock.CredentialType.Rfid, credentialIndex: 2 },
    } as DoorLock.GetCredentialStatusRequest);

    await expect(MatterbridgeDoorLockServer.prototype.getUser.call(behavior, { userIndex: 0 } as DoorLock.GetUserRequest)).rejects.toBeInstanceOf(
      StatusResponse.InvalidCommandError,
    );
    await expect(MatterbridgeDoorLockServer.prototype.clearUser.call(behavior, { userIndex: 0 } as DoorLock.ClearUserRequest)).rejects.toBeInstanceOf(
      StatusResponse.InvalidCommandError,
    );

    await MatterbridgeDoorLockServer.prototype.setCredential.call(behavior, {
      operationType: DoorLock.DataOperationType.Add,
      credential: { credentialType: DoorLock.CredentialType.Pin, credentialIndex: 9 },
      credentialData: Buffer.from('9999'),
      userIndex: 9,
      userStatus: DoorLock.UserStatus.OccupiedEnabled,
      userType: DoorLock.UserType.UnrestrictedUser,
    } as DoorLock.SetCredentialRequest);
    await MatterbridgeDoorLockServer.prototype.clearCredential.call(behavior, {
      credential: { credentialType: DoorLock.CredentialType.Pin, credentialIndex: 1 },
    } as DoorLock.ClearCredentialRequest);
    await MatterbridgeDoorLockServer.prototype.clearCredential.call(behavior, {
      credential: { credentialType: DoorLock.CredentialType.Rfid, credentialIndex: 0xfffe },
    } as DoorLock.ClearCredentialRequest);

    const filteredUsersInternal = new MatterbridgeDoorLockServer.Internal();
    filteredUsersInternal.users = structuredClone(internal.users);
    const filteredUsersEmit = jest.fn();
    const filteredUsersBehavior = {
      ...behavior,
      internal: filteredUsersInternal,
      events: { lockUserChange: { emit: filteredUsersEmit } },
    } as unknown as MatterbridgeDoorLockServer;
    Object.setPrototypeOf(filteredUsersBehavior, MatterbridgeDoorLockServer.prototype);

    await MatterbridgeDoorLockServer.prototype.clearUser.call(filteredUsersBehavior, { userIndex: 1 } as DoorLock.ClearUserRequest);

    const helperInternal = new MatterbridgeDoorLockServer.Internal();
    helperInternal.users = [
      {
        userIndex: 1,
        userName: 'No Credentials',
        userUniqueId: 1003,
        userStatus: DoorLock.UserStatus.OccupiedEnabled,
        userType: DoorLock.UserType.UnrestrictedUser,
        credentialRule: DoorLock.CredentialRule.Single,
        credentials: null,
        creatorFabricIndex: FabricIndex(3),
        lastModifiedFabricIndex: FabricIndex(3),
      },
      {
        userIndex: 2,
        userName: 'Credential Holder',
        userUniqueId: 1004,
        userStatus: DoorLock.UserStatus.OccupiedEnabled,
        userType: DoorLock.UserType.UnrestrictedUser,
        credentialRule: DoorLock.CredentialRule.Single,
        credentials: [
          {
            credentialType: DoorLock.CredentialType.Pin,
            credentialIndex: 4,
            credentialData: Buffer.from('4444'),
            creatorFabricIndex: FabricIndex(3),
            lastModifiedFabricIndex: FabricIndex(3),
          },
          {
            credentialType: DoorLock.CredentialType.Rfid,
            credentialIndex: 6,
            credentialData: Buffer.from('rfid-6'),
            creatorFabricIndex: FabricIndex(3),
            lastModifiedFabricIndex: FabricIndex(3),
          },
        ],
        creatorFabricIndex: FabricIndex(3),
        lastModifiedFabricIndex: FabricIndex(3),
      },
      {
        userIndex: 3,
        userName: 'Later Pin',
        userUniqueId: 1005,
        userStatus: DoorLock.UserStatus.Available,
        userType: DoorLock.UserType.UnrestrictedUser,
        credentialRule: DoorLock.CredentialRule.Single,
        credentials: [
          {
            credentialType: DoorLock.CredentialType.Pin,
            credentialIndex: 7,
            credentialData: Buffer.from('7777'),
            creatorFabricIndex: FabricIndex(3),
            lastModifiedFabricIndex: FabricIndex(3),
          },
        ],
        creatorFabricIndex: FabricIndex(3),
        lastModifiedFabricIndex: FabricIndex(3),
      },
    ];

    const storedCredentialTypes = (MatterbridgeDoorLockServer.prototype as any).getStoredCredentialTypes.call({ internal: helperInternal });
    const foundLaterCredential = (MatterbridgeDoorLockServer.prototype as any).findStoredCredential.call(
      { internal: helperInternal },
      { credentialType: DoorLock.CredentialType.Pin, credentialIndex: 4 },
    );

    expect(internal.users[0]?.credentials).toEqual([]);
    expect(internal.users[1]?.credentials).toEqual([
      expect.objectContaining({
        credentialType: DoorLock.CredentialType.ProgrammingPin,
        credentialIndex: 0,
      }),
    ]);

    await MatterbridgeDoorLockServer.prototype.clearUser.call(behavior, { userIndex: 0xfffe } as DoorLock.ClearUserRequest);

    expect(delegatedUser).toMatchObject({ userIndex: 7, userName: 'Handler User' });
    expect(existingUser).toMatchObject({
      userIndex: 1,
      credentials: [
        { credentialType: DoorLock.CredentialType.Pin, credentialIndex: 1 },
        { credentialType: DoorLock.CredentialType.Rfid, credentialIndex: 3 },
      ],
      nextUserIndex: 2,
    });
    expect(credentialGapStatus).toMatchObject({
      credentialExists: false,
      userIndex: null,
      nextCredentialIndex: 3,
    });
    expect(debug).toHaveBeenCalledWith('MatterbridgeDoorLockServer: setCredential did not update internal state for credentialIndex 9 (user 9 not found or operation not handled)');
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        lockDataType: DoorLock.LockDataType.Pin,
        dataOperationType: DoorLock.DataOperationType.Clear,
        userIndex: 1,
        fabricIndex: FabricIndex(2),
        sourceNode: NodeId(44),
        dataIndex: 1,
      }),
      behavior.context,
    );
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        lockDataType: DoorLock.LockDataType.Rfid,
        dataOperationType: DoorLock.DataOperationType.Clear,
        userIndex: null,
        fabricIndex: FabricIndex(2),
        sourceNode: NodeId(44),
        dataIndex: 0xfffe,
      }),
      behavior.context,
    );
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        lockDataType: DoorLock.LockDataType.UserIndex,
        dataOperationType: DoorLock.DataOperationType.Clear,
        userIndex: 0xfffe,
        fabricIndex: FabricIndex(2),
        sourceNode: NodeId(44),
        dataIndex: 0xfffe,
      }),
      behavior.context,
    );
    expect(filteredUsersInternal.users).toMatchObject([{ userIndex: 2 }]);
    expect(filteredUsersEmit).toHaveBeenCalledWith(
      expect.objectContaining({
        lockDataType: DoorLock.LockDataType.UserIndex,
        dataOperationType: DoorLock.DataOperationType.Clear,
        userIndex: 1,
        dataIndex: 1,
      }),
      behavior.context,
    );
    expect(internal.users).toEqual([]);

    expect((MatterbridgeDoorLockServer.prototype as any).getAccessingFabricIndex.call({ context: { fabric: FabricIndex(9) } })).toBe(FabricIndex(9));
    expect((MatterbridgeDoorLockServer.prototype as any).getAccessingFabricIndex.call({ context: { fabric: FabricIndex.NO_FABRIC } })).toBeNull();
    expect(
      (MatterbridgeDoorLockServer.prototype as any).getAccessingFabricIndex.call({
        context: {
          get fabric() {
            throw new Error('fabric access failed');
          },
        },
      }),
    ).toBeNull();
    expect((MatterbridgeDoorLockServer.prototype as any).getAccessingNodeId.call({ context: { subject: {}, session: { peerNodeId: NodeId(44) } } })).toBe(NodeId(44));
    expect((MatterbridgeDoorLockServer.prototype as any).getAccessingNodeId.call({ context: { subject: {}, session: {} } })).toBeNull();
    expect((MatterbridgeDoorLockServer.prototype as any).getOperationSource.call(behavior)).toBe(DoorLock.OperationSource.Remote);
    expect((MatterbridgeDoorLockServer.prototype as any).getLockDataTypeForCredentialType.call(behavior, DoorLock.CredentialType.ProgrammingPin)).toBe(
      DoorLock.LockDataType.ProgrammingCode,
    );
    expect((MatterbridgeDoorLockServer.prototype as any).getLockDataTypeForCredentialType.call(behavior, DoorLock.CredentialType.Rfid)).toBe(DoorLock.LockDataType.Rfid);
    expect((MatterbridgeDoorLockServer.prototype as any).getLockDataTypeForCredentialType.call(behavior, DoorLock.CredentialType.Fingerprint)).toBe(
      DoorLock.LockDataType.Fingerprint,
    );
    expect((MatterbridgeDoorLockServer.prototype as any).getLockDataTypeForCredentialType.call(behavior, DoorLock.CredentialType.FingerVein)).toBe(
      DoorLock.LockDataType.FingerVein,
    );
    expect((MatterbridgeDoorLockServer.prototype as any).getLockDataTypeForCredentialType.call(behavior, DoorLock.CredentialType.Face)).toBe(DoorLock.LockDataType.Face);
    expect((MatterbridgeDoorLockServer.prototype as any).getLockDataTypeForCredentialType.call(behavior, DoorLock.CredentialType.AliroCredentialIssuerKey)).toBe(
      DoorLock.LockDataType.AliroCredentialIssuerKey,
    );
    expect((MatterbridgeDoorLockServer.prototype as any).getLockDataTypeForCredentialType.call(behavior, DoorLock.CredentialType.AliroEvictableEndpointKey)).toBe(
      DoorLock.LockDataType.AliroEvictableEndpointKey,
    );
    expect((MatterbridgeDoorLockServer.prototype as any).getLockDataTypeForCredentialType.call(behavior, DoorLock.CredentialType.AliroNonEvictableEndpointKey)).toBe(
      DoorLock.LockDataType.AliroNonEvictableEndpointKey,
    );
    expect((MatterbridgeDoorLockServer.prototype as any).getLockDataTypeForCredentialType.call(behavior, 99)).toBe(DoorLock.LockDataType.Unspecified);
    expect(
      (MatterbridgeDoorLockServer.prototype as any).getCredentialDataIndex.call(behavior, {
        credentialType: DoorLock.CredentialType.ProgrammingPin,
        credentialIndex: 0,
      }),
    ).toBeNull();
    expect(
      (MatterbridgeDoorLockServer.prototype as any).getCredentialDataIndex.call(behavior, {
        credentialType: DoorLock.CredentialType.Pin,
        credentialIndex: 5,
      }),
    ).toBe(5);
    expect(storedCredentialTypes).toEqual(expect.arrayContaining([DoorLock.CredentialType.Pin, DoorLock.CredentialType.Rfid]));
    expect(storedCredentialTypes).toHaveLength(2);
    expect((MatterbridgeDoorLockServer.prototype as any).getStoredCredentialTypes.call({ internal })).toEqual([]);
    expect(foundLaterCredential).toMatchObject({
      user: expect.objectContaining({ userIndex: 2 }),
      storedCredential: expect.objectContaining({ credentialType: DoorLock.CredentialType.Pin, credentialIndex: 4 }),
    });
    expect(
      (MatterbridgeDoorLockServer.prototype as any).findStoredCredential.call(
        {
          internal: {
            users: [
              {
                credentials: [{ credentialType: DoorLock.CredentialType.Pin, credentialIndex: 1, credentialData: Buffer.from('1111') }],
              },
            ],
          },
        },
        { credentialType: DoorLock.CredentialType.Face, credentialIndex: 1 },
      ),
    ).toBeNull();
    expect(
      (MatterbridgeDoorLockServer.prototype as any).getNextOccupiedCredentialIndex.call(
        {
          internal: {
            users: [
              { credentials: null },
              { credentials: [{ credentialType: DoorLock.CredentialType.Pin, credentialIndex: 1 }] },
              { credentials: [{ credentialType: DoorLock.CredentialType.Pin, credentialIndex: 4 }] },
            ],
          },
        },
        { credentialType: DoorLock.CredentialType.Pin, credentialIndex: 2 },
      ),
    ).toBe(4);
    expect(
      (MatterbridgeDoorLockServer.prototype as any).getNextOccupiedCredentialIndex.call(
        {
          internal: {
            users: helperInternal.users,
          },
        },
        { credentialType: DoorLock.CredentialType.Pin, credentialIndex: 7 },
      ),
    ).toBeNull();
  });
});
