/**
 * @file packages/core/buntest/behaviors/doorLockServer.test.ts
 * @description This file contains the bun tests for doorLockServer.
 * @author Luca Liguori
 */

const NAME = 'DoorLockServer';
const MATTER_PORT = 11600;

import { afterEach, describe, expect, spyOn, test, vi } from 'bun:test';

import { DoorLock } from '@matter/types/clusters/door-lock';
import { Status } from '@matter/types/globals';
import { addBridgedDevice, aggregator } from '@matterbridge/test-utils/buntest/matter';
import { setupTest } from '@matterbridge/test-utils/buntest/setup';

import { MatterbridgeDoorLockServer } from '../../src/behaviors/doorLockServer.js';
import { doorLock } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';
import { internalFor } from '../../src/matterbridgeEndpointHelpers.js';
import { advanceTimersByTimeAsync, expectCommand, useServerNode } from '../bunUtils.js';

await setupTest(NAME, false);

const { CredentialType, DataOperationType, LockDataType, LockState, UserStatus, UserType } = DoorLock;
type Server = typeof MatterbridgeDoorLockServer;

/**
 * Creates and adds a door lock.
 *
 * @param {string} id - The endpoint id.
 * @param {(endpoint: MatterbridgeEndpoint) => void} configure - Creates the DoorLock cluster server.
 * @returns {Promise<{ lock: MatterbridgeEndpoint; server: Server }>} The lock and the DoorLock server class it runs.
 */
async function addLock(id: string, configure: (endpoint: MatterbridgeEndpoint) => void): Promise<{ lock: MatterbridgeEndpoint; server: Server }> {
  const lock = new MatterbridgeEndpoint(doorLock, { id });
  configure(lock);
  lock.addRequiredClusterServers();
  expect(await addBridgedDevice(aggregator, lock, 0, 0, 0, 0)).toBeTruthy();
  return { lock, server: lock.behaviors.supported.doorLock as Server };
}

/**
 * Adds a user with the given index.
 *
 * @param {MatterbridgeEndpoint} lock - The lock.
 * @param {number} userIndex - The user index.
 * @param {Partial<DoorLock.SetUserRequest>} [fields] - The fields that differ from an enabled unrestricted user.
 * @returns {Promise<void>} Resolves once added.
 */
async function addUser(lock: MatterbridgeEndpoint, userIndex: number, fields: Partial<DoorLock.SetUserRequest> = {}): Promise<void> {
  await lock.invokeBehaviorCommand(DoorLock, 'setUser', {
    operationType: DataOperationType.Add,
    userIndex,
    userName: 'Guest',
    userUniqueId: userIndex,
    userStatus: UserStatus.OccupiedEnabled,
    userType: UserType.UnrestrictedUser,
    credentialRule: DoorLock.CredentialRule.Single,
    ...fields,
  });
}

/**
 * Invokes SetCredential through the real invoke path and returns its response, which invokeBehaviorCommand() discards.
 * The spy sits on the endpoint's own server subclass, so the protected Matterbridge prototype stays untouched.
 *
 * @param {MatterbridgeEndpoint} lock - The lock.
 * @param {Server} server - The DoorLock server class of the lock.
 * @param {DoorLock.SetCredentialRequest} request - The request.
 * @returns {Promise<DoorLock.SetCredentialResponse>} The response.
 */
async function setCredential(lock: MatterbridgeEndpoint, server: Server, request: DoorLock.SetCredentialRequest): Promise<DoorLock.SetCredentialResponse> {
  const spy = spyOn(server.prototype, 'setCredential');
  try {
    await lock.invokeBehaviorCommand(DoorLock, 'setCredential', request);
    return (await spy.mock.results.at(-1)?.value) as DoorLock.SetCredentialResponse;
  } finally {
    spy.mockRestore();
  }
}

const pinRequest = (
  credentialIndex: number,
  data: Buffer,
  userIndex: number | null,
  operationType = DataOperationType.Add,
  credentialType = CredentialType.Pin,
): DoorLock.SetCredentialRequest => ({
  operationType,
  credential: { credentialType, credentialIndex },
  credentialData: data,
  userIndex,
  userStatus: null,
  userType: null,
});
const statusOf = async (
  lock: MatterbridgeEndpoint,
  server: Server,
  credentialType: DoorLock.CredentialType,
  credentialIndex: number,
): Promise<DoorLock.GetCredentialStatusResponse> => lock.act(async (agent) => agent.get(server).getCredentialStatus({ credential: { credentialType, credentialIndex } }));
const userOf = async (lock: MatterbridgeEndpoint, server: Server, userIndex: number): Promise<DoorLock.GetUserResponse> =>
  lock.act(async (agent) => agent.get(server).getUser({ userIndex }));
const clearedUser = { userName: null, userUniqueId: null, userStatus: null, userType: null, credentialRule: null, credentials: null, nextUserIndex: null };

/**
 * Subscribes to the LockUserChange event of a lock.
 *
 * @param {MatterbridgeEndpoint} lock - The lock.
 * @returns {ReturnType<typeof vi.fn>} The listener, recording the event payloads.
 */
const onLockUserChange = (lock: MatterbridgeEndpoint): ReturnType<typeof vi.fn> => {
  const listener = vi.fn();
  (lock.eventsOf('doorLock') as unknown as { lockUserChange: { on: (callback: (event: unknown) => void) => void } }).lockUserChange.on(listener);
  return listener;
};

describe('MatterbridgeDoorLockServer', () => {
  useServerNode(MATTER_PORT);

  afterEach(() => {
    vi.useRealTimers();
  });

  test('lock, unlock, actuator disabled, auto relock and unlock with timeout', async () => {
    const { lock } = await addLock('doorLockDevice', (endpoint) => endpoint.createDefaultDoorLockClusterServer());
    expect(lock.behaviors.has(MatterbridgeDoorLockServer.with())).toBe(true);
    const state = (): unknown => lock.getAttribute(DoorLock, 'lockState');
    const invoke = async (command: 'lockDoor' | 'unlockDoor' | 'unlockWithTimeout', request: object = {}): Promise<unknown> =>
      lock.invokeBehaviorCommand(DoorLock, command, request as never);
    const emitted: string[] = [];
    for (const command of ['lockDoor', 'unlockDoor', 'unlockWithTimeout'] as const) lock.subscribeCommand(DoorLock, command, () => emitted.push(command));
    expect(state()).toBe(LockState.Locked);

    await invoke('unlockDoor');
    expect(state()).toBe(LockState.Unlocked);
    await invoke('lockDoor');
    expect(state()).toBe(LockState.Locked);
    // With the actuator disabled every command is ignored and not announced.
    await lock.setAttribute(DoorLock, 'actuatorEnabled', false);
    for (const command of ['lockDoor', 'unlockDoor', 'unlockWithTimeout'] as const) {
      await invoke(command, command === 'unlockWithTimeout' ? { timeout: 1 } : {});
      expect(state()).toBe(LockState.Locked);
    }
    await lock.setAttribute(DoorLock, 'actuatorEnabled', true);
    expect(emitted).toEqual(['unlockDoor', 'lockDoor']);

    // AutoRelockTime relocks after an unlock, UnlockWithTimeout after its timeout; with AutoRelockTime 0 an unlock stays.
    vi.useFakeTimers();
    await lock.setAttribute(DoorLock, 'autoRelockTime', 1);
    await invoke('unlockDoor');
    expect(state()).toBe(LockState.Unlocked);
    await advanceTimersByTimeAsync(1000);
    expect(state()).toBe(LockState.Locked);
    await lock.setAttribute(DoorLock, 'autoRelockTime', 0);
    await invoke('unlockWithTimeout', { timeout: 1 });
    expect(state()).toBe(LockState.Unlocked);
    await advanceTimersByTimeAsync(1000);
    expect(state()).toBe(LockState.Locked);
    await invoke('unlockDoor');
    await advanceTimersByTimeAsync(1100, 10);
    expect(state()).toBe(LockState.Unlocked);
    await invoke('unlockWithTimeout', { timeout: 1 });
    await advanceTimersByTimeAsync(1100, 10);
    expect(state()).toBe(LockState.Locked);
  });

  test('schedule commands are forwarded, and a plugin handler that answers takes over the getters', async () => {
    const { lock, server } = await addLock('scheduleDoorLock', (endpoint) =>
      endpoint.createUserPinDoorLockClusterServer(LockState.Locked, DoorLock.LockType.DeadBolt, 0, 4, 10, 2, 2, 2),
    );
    const emitted: string[] = [];
    lock.subscribeCommand(DoorLock, 'setWeekDaySchedule', () => emitted.push('setWeekDaySchedule'));
    lock.subscribeCommand(DoorLock, 'clearWeekDaySchedule', () => emitted.push('clearWeekDaySchedule'));
    await addUser(lock, 1, { userName: 'Scheduled User', userUniqueId: 100, userType: UserType.ScheduleRestrictedUser });
    const weekDay = { weekDayIndex: 1, userIndex: 1, daysMask: new DoorLock.DaysMask({ monday: true }), startHour: 8, startMinute: 30, endHour: 17, endMinute: 30 };
    const yearDay = { yearDayIndex: 1, userIndex: 1, localStartTime: 1_000, localEndTime: 2_000 };
    const holiday = { holidayIndex: 1, localStartTime: 3_000, localEndTime: 4_000, operatingMode: DoorLock.OperatingMode.Vacation };
    const getAll = async (): Promise<unknown[]> => [
      await lock.act(async (agent) => agent.get(server).getWeekDaySchedule({ weekDayIndex: 1, userIndex: 1 })),
      await lock.act(async (agent) => agent.get(server).getYearDaySchedule({ yearDayIndex: 1, userIndex: 1 })),
      await lock.act(async (agent) => agent.get(server).getHolidaySchedule({ holidayIndex: 1 })),
    ];
    const setAll = async (): Promise<void> => {
      await lock.invokeBehaviorCommand(DoorLock, 'setWeekDaySchedule', weekDay);
      await lock.invokeBehaviorCommand(DoorLock, 'setYearDaySchedule', yearDay);
      await lock.invokeBehaviorCommand(DoorLock, 'setHolidaySchedule', holiday);
    };
    await setAll();
    expect(await getAll()).toMatchObject([
      { status: Status.Success, startHour: 8, endHour: 17 },
      { status: Status.Success, localStartTime: 1_000, localEndTime: 2_000 },
      { status: Status.Success, operatingMode: DoorLock.OperatingMode.Vacation },
    ]);

    const handlers = {
      setWeekDay: vi.fn(),
      getWeekDay: vi.fn(() => ({ weekDayIndex: 1, userIndex: 1, status: Status.NotFound })),
      clearWeekDay: vi.fn(),
      setYearDay: vi.fn(),
      getYearDay: vi.fn(() => ({ yearDayIndex: 1, userIndex: 1, status: Status.NotFound })),
      clearYearDay: vi.fn(),
      setHoliday: vi.fn(),
      getHoliday: vi.fn(() => ({ holidayIndex: 1, status: Status.NotFound })),
      clearHoliday: vi.fn(),
    };
    for (const kind of ['WeekDay', 'YearDay', 'Holiday'] as const) {
      lock.addCommandHandler(`DoorLock.set${kind}Schedule`, handlers[`set${kind}`]);
      lock.addCommandHandler(`DoorLock.get${kind}Schedule`, handlers[`get${kind}`]);
      lock.addCommandHandler(`DoorLock.clear${kind}Schedule`, handlers[`clear${kind}`]);
    }
    await setAll();
    expect(await getAll()).toMatchObject([{ status: Status.NotFound }, { status: Status.NotFound }, { status: Status.NotFound }]);
    await lock.invokeBehaviorCommand(DoorLock, 'clearWeekDaySchedule', { weekDayIndex: 1, userIndex: 1 });
    await lock.invokeBehaviorCommand(DoorLock, 'clearYearDaySchedule', { yearDayIndex: 1, userIndex: 1 });
    await lock.invokeBehaviorCommand(DoorLock, 'clearHolidaySchedule', { holidayIndex: 1 });
    for (const handler of Object.values(handlers)) expect(handler).toHaveBeenCalledTimes(1);
    expect(emitted).toEqual(expect.arrayContaining(['setWeekDaySchedule', 'clearWeekDaySchedule']));
  });

  // The three schedule kinds follow the same rules: [kind, factory, index field, user-scoped, valid request, invalid time ranges, replacement].
  test.each([
    [
      'WeekDay',
      (endpoint: MatterbridgeEndpoint): MatterbridgeEndpoint => endpoint.createUserPinDoorLockClusterServer(LockState.Locked, DoorLock.LockType.DeadBolt, 0, 4, 10, 2),
      'weekDayIndex',
      true,
      {
        daysMask: new DoorLock.DaysMask({ sunday: false, monday: true, tuesday: false, wednesday: false, thursday: false, friday: false, saturday: false }),
        startHour: 8,
        startMinute: 30,
        endHour: 17,
        endMinute: 30,
      },
      [{ endHour: 7 }, { endHour: 8, endMinute: 30 }, { endHour: 8, endMinute: 29 }],
      { endHour: 8, endMinute: 31 },
    ],
    [
      'YearDay',
      (endpoint: MatterbridgeEndpoint): MatterbridgeEndpoint => endpoint.createUserPinDoorLockClusterServer(LockState.Locked, DoorLock.LockType.DeadBolt, 0, 4, 10, undefined, 2),
      'yearDayIndex',
      true,
      { localStartTime: 1_000, localEndTime: 2_000 },
      [{ localEndTime: 999 }, { localEndTime: 1_000 }],
      { localEndTime: 3_000 },
    ],
    [
      'Holiday',
      (endpoint: MatterbridgeEndpoint): MatterbridgeEndpoint =>
        endpoint.createDefaultDoorLockClusterServer(LockState.Locked, DoorLock.LockType.DeadBolt, 0, undefined, undefined, 2),
      'holidayIndex',
      false,
      { localStartTime: 1_000, localEndTime: 2_000, operatingMode: DoorLock.OperatingMode.NoRemoteLockUnlock },
      [{ localEndTime: 999 }, { localEndTime: 1_000 }],
      { localEndTime: 3_000 },
    ],
  ] as const)('%s schedules are validated, stored, replaced and cleared', async (kind, configure, indexField, userScoped, fields, invalidTimes, replacementFields) => {
    const { lock, server } = await addLock(`${kind}ScheduleCompliance`, configure);
    if (userScoped) for (const userIndex of [1, 2]) await addUser(lock, userIndex, { userType: UserType.ScheduleRestrictedUser });
    const index: Record<string, number> = userScoped ? { [indexField]: 1, userIndex: 1 } : { [indexField]: 1 };
    const request = { ...index, ...fields };
    const set = async (value: object): Promise<unknown> => lock.invokeBehaviorCommand(DoorLock, `set${kind}Schedule` as 'setWeekDaySchedule', value as never);
    const clear = async (value: object): Promise<unknown> => lock.invokeBehaviorCommand(DoorLock, `clear${kind}Schedule` as 'clearWeekDaySchedule', value as never);
    const get = async (query: object = index): Promise<Record<string, unknown>> =>
      lock.act(async (agent) => {
        const instance = agent.get(server) as unknown as Record<string, (query: object) => Promise<Record<string, unknown>>>;
        const response = { ...(await instance[`get${kind}Schedule`](query)) };
        if (response.daysMask) response.daysMask = new DoorLock.DaysMask(response.daysMask);
        return response;
      });
    const found = (value: object): Record<string, unknown> => ({ ...value, status: Status.Success });
    const notFound = (query: object = index): Record<string, unknown> => ({ ...query, status: Status.NotFound });

    expect(await get()).toEqual(notFound());
    if (userScoped) expect(await get({ ...index, userIndex: 3 })).toEqual(notFound({ ...index, userIndex: 3 }));
    await set(request);
    expect(await get()).toEqual(found(request));
    // Out-of-range schedule and user indexes, and empty or reversed time ranges, are INVALID_COMMAND.
    const invalidIndexes = [{ [indexField]: 0 }, { [indexField]: 3 }, ...(userScoped ? [{ userIndex: 0 }, { userIndex: 11 }] : [])];
    for (const invalid of invalidIndexes) {
      const query = { ...index, ...invalid };
      expect(await get(query)).toEqual({ ...query, status: Status.InvalidCommand });
      expect(set({ ...request, ...invalid })).rejects.toMatchObject({ code: Status.InvalidCommand });
      expect(clear(query)).rejects.toMatchObject({ code: Status.InvalidCommand });
    }
    for (const invalidTime of invalidTimes) expect(set({ ...request, ...invalidTime })).rejects.toMatchObject({ code: Status.InvalidCommand });
    expect(await get()).toEqual(found(request));
    // A set on a used index replaces it.
    await set({ ...request, ...replacementFields });
    expect(await get()).toEqual(found({ ...request, ...replacementFields }));
    // A clear removes only its own entry; 0xFE clears every entry of the user (or every holiday).
    await set({ ...request, [indexField]: 2 });
    if (userScoped) await set({ ...request, userIndex: 2 });
    await clear(index);
    expect(await get()).toEqual(notFound());
    expect(await get({ ...index, [indexField]: 2 })).toEqual(found({ ...request, [indexField]: 2 }));
    await set(request);
    await clear({ ...index, [indexField]: 0xfe });
    for (const position of [1, 2]) expect(await get({ ...index, [indexField]: position })).toEqual(notFound({ ...index, [indexField]: position }));
    if (userScoped) expect(await get({ ...index, userIndex: 2 })).toEqual(found({ ...request, userIndex: 2 }));
  });

  test('PIN users and credentials: add, modify, duplicates, getters and clear, with LockUserChange events', async () => {
    const { lock, server } = await addLock('userPinDoorLock', (endpoint) => endpoint.createUserPinDoorLockClusterServer());
    expect(lock.getAttribute(DoorLock, 'requirePinForRemoteOperation')).toBeUndefined();
    expect(lock.getAttribute(DoorLock, 'numberOfTotalUsersSupported')).toBe(10);
    const changes = onLockUserChange(lock);

    // A user is added, then modified.
    await addUser(lock, 1, { userUniqueId: 1234 });
    expect(await userOf(lock, server, 1)).toMatchObject({ userIndex: 1, userName: 'Guest', userUniqueId: 1234, userType: UserType.UnrestrictedUser, credentials: [] });
    await lock.invokeBehaviorCommand(DoorLock, 'setUser', {
      operationType: DataOperationType.Modify,
      userIndex: 1,
      userName: 'Guest Updated',
      userUniqueId: 4321,
      userStatus: UserStatus.OccupiedEnabled,
      userType: UserType.NonAccessUser,
      credentialRule: DoorLock.CredentialRule.Single,
    });
    expect(await userOf(lock, server, 1)).toMatchObject({ userName: 'Guest Updated', userUniqueId: 4321, userType: UserType.NonAccessUser });
    expect(changes.mock.calls.map(([event]) => event)).toMatchObject([
      {
        lockDataType: LockDataType.UserIndex,
        dataOperationType: DataOperationType.Add,
        userIndex: 1,
        dataIndex: 1,
        operationSource: DoorLock.OperationSource.Remote,
        fabricIndex: expect.any(Number),
        sourceNode: null,
      },
      { lockDataType: LockDataType.UserIndex, dataOperationType: DataOperationType.Modify, userIndex: 1, dataIndex: 1 },
    ]);

    // A PIN is added, modified, then every credential is cleared.
    changes.mockClear();
    expect(await setCredential(lock, server, pinRequest(1, Buffer.from('1234'), 1))).toMatchObject({ status: Status.Success });
    expect(await statusOf(lock, server, CredentialType.Pin, 1)).toMatchObject({ credentialExists: true, userIndex: 1, nextCredentialIndex: null });
    expect(await setCredential(lock, server, pinRequest(1, Buffer.from('5678'), 1, DataOperationType.Modify))).toMatchObject({ status: Status.Success });
    await lock.invokeBehaviorCommand(DoorLock, 'clearCredential', { credential: null });
    expect(await statusOf(lock, server, CredentialType.Pin, 1)).toMatchObject({ credentialExists: false, userIndex: null, nextCredentialIndex: null });
    expect(changes).toHaveBeenCalledTimes(7);
    expect(changes.mock.calls.slice(0, 3).map(([event]) => event)).toMatchObject([
      { lockDataType: LockDataType.Pin, dataOperationType: DataOperationType.Add, userIndex: 1, dataIndex: 1, fabricIndex: expect.any(Number), sourceNode: null },
      { lockDataType: LockDataType.Pin, dataOperationType: DataOperationType.Modify, userIndex: 1, dataIndex: 1 },
      { lockDataType: LockDataType.Pin, dataOperationType: DataOperationType.Clear, userIndex: 0xfffe, dataIndex: 0xfffe },
    ]);

    // The same PIN on another index is Duplicate, another PIN on a used index is Occupied.
    const request = pinRequest(1, Buffer.from('1234'), 1);
    await lock.invokeBehaviorCommand(DoorLock, 'setCredential', request);
    expect(lock.act(async (agent) => agent.get(server).setCredential(pinRequest(2, Buffer.from('1234'), 1)))).rejects.toMatchObject({
      code: Status.Failure,
      clusterCode: DoorLock.StatusCode.Duplicate,
    });
    expect(lock.act(async (agent) => agent.get(server).setCredential(pinRequest(1, Buffer.from('5678'), 1)))).rejects.toMatchObject({
      code: Status.Failure,
      clusterCode: DoorLock.StatusCode.Occupied,
    });
    await lock.invokeBehaviorCommand(DoorLock, 'clearCredential', { credential: null });

    // Clearing the user resets it and emits a Clear event.
    changes.mockClear();
    await lock.invokeBehaviorCommand(DoorLock, 'clearUser', { userIndex: 1 });
    expect(await userOf(lock, server, 1)).toMatchObject({ userIndex: 1, ...clearedUser });
    expect(changes.mock.calls.map(([event]) => event)).toMatchObject([
      { lockDataType: LockDataType.UserIndex, dataOperationType: DataOperationType.Clear, userIndex: 1, dataIndex: 1, fabricIndex: expect.any(Number) },
    ]);

    // Getters validate their index, and a plugin handler that answers GetUser takes over.
    const emitted: unknown[] = [];
    for (const command of ['getUser', 'clearUser', 'getCredentialStatus'] as const) lock.subscribeCommand(DoorLock, command, (data) => emitted.push(data.request));
    expect(userOf(lock, server, 0)).rejects.toThrow('Invalid user index');
    const handlerResponse: DoorLock.GetUserResponse = {
      userIndex: 7,
      userName: 'Handler User',
      userUniqueId: 700,
      userStatus: UserStatus.OccupiedEnabled,
      userType: UserType.UnrestrictedUser,
      credentialRule: DoorLock.CredentialRule.Single,
      credentials: null,
      creatorFabricIndex: null,
      lastModifiedFabricIndex: null,
      nextUserIndex: null,
    };
    lock.addCommandHandler('DoorLock.getUser', () => handlerResponse);
    expect(await userOf(lock, server, 7)).toEqual(handlerResponse);
    expect(lock.invokeBehaviorCommand(DoorLock, 'clearUser', { userIndex: 0 })).rejects.toThrow('Invalid user index');
    expect(await statusOf(lock, server, CredentialType.Pin, 1)).toMatchObject({ credentialExists: false, userIndex: null });
    expect(emitted).toEqual([{ userIndex: 7 }, { credential: { credentialType: CredentialType.Pin, credentialIndex: 1 } }]);
  });

  test('null user fields get the defaults, 0xFFFE clears every user, and an empty PIN is INVALID_COMMAND', async () => {
    const { lock, server } = await addLock('branchDoorLock', (endpoint) => endpoint.createUserPinDoorLockClusterServer());
    await lock.invokeBehaviorCommand(DoorLock, 'setUser', {
      operationType: DataOperationType.Add,
      userIndex: 2,
      userName: null,
      userUniqueId: null,
      userStatus: null,
      userType: null,
      credentialRule: null,
    });
    expect(await userOf(lock, server, 2)).toMatchObject({
      userIndex: 2,
      userName: '',
      userUniqueId: null,
      userStatus: UserStatus.OccupiedEnabled,
      userType: UserType.UnrestrictedUser,
      credentialRule: DoorLock.CredentialRule.Single,
    });
    await lock.invokeBehaviorCommand(DoorLock, 'clearUser', { userIndex: 0xfffe });
    expect(await userOf(lock, server, 2)).toMatchObject({ userIndex: 2, ...clearedUser });

    expect(await setCredential(lock, server, pinRequest(9, Buffer.alloc(0), null))).toMatchObject({ status: Status.InvalidCommand });
    expect(await statusOf(lock, server, CredentialType.Pin, 9)).toMatchObject({ credentialExists: false, userIndex: null });
    // A specific credential is cleared on its own.
    await addUser(lock, 3, { userName: 'Specific Credential User', userUniqueId: 300 });
    expect(await setCredential(lock, server, pinRequest(2, Buffer.from('2468'), 3))).toMatchObject({ status: Status.Success });
    expect(await statusOf(lock, server, CredentialType.Pin, 2)).toMatchObject({ credentialExists: true, userIndex: 3 });
    await lock.invokeBehaviorCommand(DoorLock, 'clearCredential', { credential: { credentialType: CredentialType.Pin, credentialIndex: 2 } });
    expect(await statusOf(lock, server, CredentialType.Pin, 2)).toMatchObject({ credentialExists: false, userIndex: null });
  });

  test('RFID credentials are stored and cleared within the configured count and length limits', async () => {
    // Default limits: 5 RFID users, codes of 8 to 20 bytes.
    const defaults = await addLock('rfidDoorLock', (endpoint) =>
      endpoint.createUserPinDoorLockClusterServer(LockState.Locked, DoorLock.LockType.DeadBolt, 0, 4, 10, undefined, undefined, undefined, undefined, 5),
    );
    const limitsOf = (lock: MatterbridgeEndpoint): unknown[] => [
      lock.getAttribute(DoorLock, 'numberOfRfidUsersSupported'),
      lock.getAttribute(DoorLock, 'minRfidCodeLength'),
      lock.getAttribute(DoorLock, 'maxRfidCodeLength'),
    ];
    expect(limitsOf(defaults.lock)).toEqual([5, 8, 20]);
    await addUser(defaults.lock, 1, { userName: 'RFID User', userUniqueId: 100 });
    const rfid = (credentialIndex: number, data: Buffer): DoorLock.SetCredentialRequest => pinRequest(credentialIndex, data, 1, DataOperationType.Add, CredentialType.Rfid);
    // A 14-byte ASCII-hex 7-byte ISO 14443A UID.
    await defaults.lock.invokeBehaviorCommand(DoorLock, 'setCredential', rfid(1, Buffer.from('04A224B21C6E80', 'ascii')));
    expect(await statusOf(defaults.lock, defaults.server, CredentialType.Rfid, 1)).toMatchObject({ credentialExists: true, userIndex: 1 });
    await defaults.lock.invokeBehaviorCommand(DoorLock, 'clearCredential', { credential: { credentialType: CredentialType.Rfid, credentialIndex: 1 } });
    expect(await statusOf(defaults.lock, defaults.server, CredentialType.Rfid, 1)).toMatchObject({ credentialExists: false, userIndex: null });

    // Configured limits: 2 RFID users, codes of 4 to 7 bytes.
    const { lock, server } = await addLock('rfidCredentialLimits', (endpoint) =>
      endpoint.createUserPinDoorLockClusterServer(LockState.Locked, DoorLock.LockType.DeadBolt, 0, 4, 10, undefined, undefined, undefined, undefined, 2, 4, 7),
    );
    expect(lock.getAttribute(DoorLock.id, 'featureMap')).toMatchObject({ rfidCredential: true });
    expect(limitsOf(lock)).toEqual([2, 4, 7]);
    await addUser(lock, 1, { userName: 'RFID Guest' });
    for (const length of [3, 8]) expect(await setCredential(lock, server, rfid(1, Buffer.alloc(length, 1)))).toMatchObject({ status: Status.InvalidCommand });
    expect(await setCredential(lock, server, rfid(3, Buffer.from([1, 2, 3, 4])))).toMatchObject({ status: Status.InvalidCommand });
    expect(await statusOf(lock, server, CredentialType.Rfid, 1)).toMatchObject({ credentialExists: false, userIndex: null });
    for (const [credentialIndex, length] of [
      [1, 4],
      [2, 7],
    ]) {
      expect(await setCredential(lock, server, rfid(credentialIndex, Buffer.alloc(length, credentialIndex)))).toMatchObject({ status: Status.Success });
      expect(await statusOf(lock, server, CredentialType.Rfid, credentialIndex)).toMatchObject({ credentialExists: true, userIndex: 1 });
    }
  });

  test('lockDoor, unlockDoor and unlockWithTimeout are forwarded to the plugin first', async () => {
    const lock = new MatterbridgeEndpoint(doorLock, { id: 'doorLock' });
    lock.addRequiredClusterServers();
    expect(await addBridgedDevice(aggregator, lock, 0, 0, 0, 0)).toBeTruthy();
    const internal = (await internalFor(lock, MatterbridgeDoorLockServer)) as { enableTimeout?: boolean } | undefined;
    expect(internal).toBeDefined();
    if (internal?.enableTimeout !== undefined) internal.enableTimeout = false;
    const commands = lock.behaviors.elementsOf(MatterbridgeDoorLockServer.with()).commands;
    for (const command of ['lockDoor', 'unlockDoor', 'unlockWithTimeout']) expect(commands.has(command)).toBe(true);
    for (const [command, request, after] of [
      ['DoorLock.unlockDoor', {}, LockState.Unlocked],
      ['DoorLock.lockDoor', {}, LockState.Locked],
      ['DoorLock.unlockWithTimeout', { timeout: 5 }, LockState.Unlocked],
    ] as const) {
      await expectCommand(lock, DoorLock, command, request, (data) => expect(data.cluster).toBe('doorLock'));
      expect(lock.getCluster(DoorLock)?.lockState).toBe(after);
    }
  });
});
