/**
 * @file packages/core/vitest/behaviors/doorLockServer.test.ts
 * @description This file contains the tests for doorLockServer.
 * @author Luca Liguori
 */

// oxlint-disable vitest/no-commented-out-tests

const NAME = 'DoorLockServer';
const MATTER_PORT = 11600;
const MATTER_CREATE_ONLY = true;

import { Status } from '@matter/types';
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
import { internalFor } from '../../src/matterbridgeEndpointHelpers.js';
import { expectCommand } from '../vitestUtils.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Client clusters and behaviors', () => {
  let lock: MatterbridgeEndpoint;
  let userPinDoorLock: MatterbridgeEndpoint;
  let scheduleDoorLock: MatterbridgeEndpoint;

  function supportedDoorLockServer(): typeof MatterbridgeDoorLockServer {
    return userPinDoorLock.behaviors.supported.doorLock as typeof MatterbridgeDoorLockServer;
  }

  function supportedScheduleDoorLockServer(): typeof MatterbridgeDoorLockServer {
    return scheduleDoorLock.behaviors.supported.doorLock as typeof MatterbridgeDoorLockServer;
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

  test('DoorLock forwards week day, year day, and holiday schedule commands', async () => {
    scheduleDoorLock = new MatterbridgeEndpoint(doorLock, { id: 'scheduleDoorLock' });
    scheduleDoorLock.createUserPinDoorLockClusterServer(DoorLock.LockState.Locked, DoorLock.LockType.DeadBolt, 0, 4, 10, 2, 2, 2);
    scheduleDoorLock.addRequiredClusterServers();
    expect(await addDevice(aggregator, scheduleDoorLock)).toBeDefined();

    await scheduleDoorLock.invokeBehaviorCommand(DoorLock, 'setUser', {
      operationType: DoorLock.DataOperationType.Add,
      userIndex: 1,
      userName: 'Scheduled User',
      userUniqueId: 100,
      userStatus: DoorLock.UserStatus.OccupiedEnabled,
      userType: DoorLock.UserType.ScheduleRestrictedUser,
      credentialRule: DoorLock.CredentialRule.Single,
    });

    const weekDayRequest: DoorLock.SetWeekDayScheduleRequest = {
      weekDayIndex: 1,
      userIndex: 1,
      daysMask: new DoorLock.DaysMask({ monday: true }),
      startHour: 8,
      startMinute: 30,
      endHour: 17,
      endMinute: 30,
    };
    const yearDayRequest: DoorLock.SetYearDayScheduleRequest = {
      yearDayIndex: 1,
      userIndex: 1,
      localStartTime: 1_000,
      localEndTime: 2_000,
    };
    const holidayRequest: DoorLock.SetHolidayScheduleRequest = {
      holidayIndex: 1,
      localStartTime: 3_000,
      localEndTime: 4_000,
      operatingMode: DoorLock.OperatingMode.Vacation,
    };

    await scheduleDoorLock.invokeBehaviorCommand(DoorLock, 'setWeekDaySchedule', weekDayRequest);
    await scheduleDoorLock.invokeBehaviorCommand(DoorLock, 'setYearDaySchedule', yearDayRequest);
    await scheduleDoorLock.invokeBehaviorCommand(DoorLock, 'setHolidaySchedule', holidayRequest);

    const scheduleServer = supportedScheduleDoorLockServer();
    expect(await scheduleDoorLock.act(async (agent) => agent.get(scheduleServer).getWeekDaySchedule({ weekDayIndex: 1, userIndex: 1 }))).toMatchObject({
      status: Status.Success,
      startHour: 8,
      endHour: 17,
    });
    expect(await scheduleDoorLock.act(async (agent) => agent.get(scheduleServer).getYearDaySchedule({ yearDayIndex: 1, userIndex: 1 }))).toMatchObject({
      status: Status.Success,
      localStartTime: 1_000,
      localEndTime: 2_000,
    });
    expect(await scheduleDoorLock.act(async (agent) => agent.get(scheduleServer).getHolidaySchedule({ holidayIndex: 1 }))).toMatchObject({
      status: Status.Success,
      operatingMode: DoorLock.OperatingMode.Vacation,
    });

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
    scheduleDoorLock.addCommandHandler('DoorLock.setWeekDaySchedule', handlers.setWeekDay);
    scheduleDoorLock.addCommandHandler('DoorLock.getWeekDaySchedule', handlers.getWeekDay);
    scheduleDoorLock.addCommandHandler('DoorLock.clearWeekDaySchedule', handlers.clearWeekDay);
    scheduleDoorLock.addCommandHandler('DoorLock.setYearDaySchedule', handlers.setYearDay);
    scheduleDoorLock.addCommandHandler('DoorLock.getYearDaySchedule', handlers.getYearDay);
    scheduleDoorLock.addCommandHandler('DoorLock.clearYearDaySchedule', handlers.clearYearDay);
    scheduleDoorLock.addCommandHandler('DoorLock.setHolidaySchedule', handlers.setHoliday);
    scheduleDoorLock.addCommandHandler('DoorLock.getHolidaySchedule', handlers.getHoliday);
    scheduleDoorLock.addCommandHandler('DoorLock.clearHolidaySchedule', handlers.clearHoliday);

    await scheduleDoorLock.invokeBehaviorCommand(DoorLock, 'setWeekDaySchedule', weekDayRequest);
    await scheduleDoorLock.invokeBehaviorCommand(DoorLock, 'setYearDaySchedule', yearDayRequest);
    await scheduleDoorLock.invokeBehaviorCommand(DoorLock, 'setHolidaySchedule', holidayRequest);
    expect(await scheduleDoorLock.act(async (agent) => agent.get(scheduleServer).getWeekDaySchedule({ weekDayIndex: 1, userIndex: 1 }))).toMatchObject({
      status: Status.NotFound,
    });
    expect(await scheduleDoorLock.act(async (agent) => agent.get(scheduleServer).getYearDaySchedule({ yearDayIndex: 1, userIndex: 1 }))).toMatchObject({
      status: Status.NotFound,
    });
    expect(await scheduleDoorLock.act(async (agent) => agent.get(scheduleServer).getHolidaySchedule({ holidayIndex: 1 }))).toMatchObject({
      status: Status.NotFound,
    });
    await scheduleDoorLock.invokeBehaviorCommand(DoorLock, 'clearWeekDaySchedule', { weekDayIndex: 1, userIndex: 1 });
    await scheduleDoorLock.invokeBehaviorCommand(DoorLock, 'clearYearDaySchedule', { yearDayIndex: 1, userIndex: 1 });
    await scheduleDoorLock.invokeBehaviorCommand(DoorLock, 'clearHolidaySchedule', { holidayIndex: 1 });

    for (const handler of Object.values(handlers)) expect(handler).toHaveBeenCalledTimes(1);
  });

  test('should validate, store, replace and clear WeekDay schedules when the feature is enabled', async () => {
    // Matter 1.6.0 § 5.2.10.4–7: schedule constraints, response fields and clear-all semantics.
    const device = new MatterbridgeEndpoint(doorLock, { id: 'WeekDayScheduleCompliance' });
    device.createUserPinDoorLockClusterServer(DoorLock.LockState.Locked, DoorLock.LockType.DeadBolt, 0, 4, 10, 2);
    device.addRequiredClusterServers();
    expect(await addDevice(aggregator, device)).toBeDefined();
    const server = device.behaviors.supported.doorLock as typeof MatterbridgeDoorLockServer;

    for (const userIndex of [1, 2]) {
      await device.invokeBehaviorCommand(DoorLock, 'setUser', {
        operationType: DoorLock.DataOperationType.Add,
        userIndex,
        userName: 'Guest',
        userUniqueId: userIndex,
        userStatus: DoorLock.UserStatus.OccupiedEnabled,
        userType: DoorLock.UserType.ScheduleRestrictedUser,
        credentialRule: DoorLock.CredentialRule.Single,
      });
    }

    const index = { weekDayIndex: 1, userIndex: 1 };
    const request = {
      ...index,
      daysMask: new DoorLock.DaysMask({ sunday: false, monday: true, tuesday: false, wednesday: false, thursday: false, friday: false, saturday: false }),
      startHour: 8,
      startMinute: 30,
      endHour: 17,
      endMinute: 30,
    };
    const getSchedule = async (query = index): Promise<DoorLock.GetWeekDayScheduleResponse> =>
      device.act(async (agent) => {
        const response = await agent.get(server).getWeekDaySchedule(query);
        if (response.daysMask) response.daysMask = new DoorLock.DaysMask(response.daysMask);
        return response;
      });
    expect(await getSchedule()).toEqual({ ...index, status: Status.NotFound });
    expect(await getSchedule({ ...index, userIndex: 3 })).toEqual({ ...index, userIndex: 3, status: Status.NotFound });

    await device.invokeBehaviorCommand(DoorLock, 'setWeekDaySchedule', request);
    expect(await getSchedule()).toEqual({ ...request, status: Status.Success });

    for (const weekDayIndex of [0, 3]) {
      const invalidIndex = { ...index, weekDayIndex };
      expect(await getSchedule(invalidIndex)).toEqual({ ...invalidIndex, status: Status.InvalidCommand });
      await expect(device.invokeBehaviorCommand(DoorLock, 'setWeekDaySchedule', { ...request, weekDayIndex })).rejects.toMatchObject({ code: Status.InvalidCommand });
      await expect(device.invokeBehaviorCommand(DoorLock, 'clearWeekDaySchedule', invalidIndex)).rejects.toMatchObject({ code: Status.InvalidCommand });
    }

    for (const userIndex of [0, 11]) {
      const invalidIndex = { ...index, userIndex };
      expect(await getSchedule(invalidIndex)).toEqual({ ...invalidIndex, status: Status.InvalidCommand });
      await expect(device.invokeBehaviorCommand(DoorLock, 'setWeekDaySchedule', { ...request, userIndex })).rejects.toMatchObject({ code: Status.InvalidCommand });
      await expect(device.invokeBehaviorCommand(DoorLock, 'clearWeekDaySchedule', invalidIndex)).rejects.toMatchObject({ code: Status.InvalidCommand });
    }

    for (const invalidTime of [{ endHour: 7 }, { endHour: 8, endMinute: 30 }, { endHour: 8, endMinute: 29 }]) {
      await expect(device.invokeBehaviorCommand(DoorLock, 'setWeekDaySchedule', { ...request, ...invalidTime })).rejects.toMatchObject({ code: Status.InvalidCommand });
    }
    expect(await getSchedule()).toEqual({ ...request, status: Status.Success });

    const replacement = { ...request, endHour: 8, endMinute: 31 };
    await device.invokeBehaviorCommand(DoorLock, 'setWeekDaySchedule', replacement);
    expect(await getSchedule()).toEqual({ ...replacement, status: Status.Success });
    await device.invokeBehaviorCommand(DoorLock, 'setWeekDaySchedule', { ...request, weekDayIndex: 2 });
    await device.invokeBehaviorCommand(DoorLock, 'setWeekDaySchedule', { ...request, userIndex: 2 });

    await device.invokeBehaviorCommand(DoorLock, 'clearWeekDaySchedule', index);
    expect(await getSchedule()).toEqual({ ...index, status: Status.NotFound });
    expect(await getSchedule({ ...index, weekDayIndex: 2 })).toEqual({ ...request, weekDayIndex: 2, status: Status.Success });

    await device.invokeBehaviorCommand(DoorLock, 'setWeekDaySchedule', request);
    await device.invokeBehaviorCommand(DoorLock, 'clearWeekDaySchedule', { ...index, weekDayIndex: 0xfe });
    for (const weekDayIndex of [1, 2]) {
      expect(await getSchedule({ ...index, weekDayIndex })).toEqual({ ...index, weekDayIndex, status: Status.NotFound });
    }
    expect(await getSchedule({ ...index, userIndex: 2 })).toEqual({ ...request, userIndex: 2, status: Status.Success });
  });

  test('should validate, store, replace and clear YearDay schedules when the feature is enabled', async () => {
    // Matter 1.6.0 § 5.2.10.8–11: schedule constraints, response fields and clear-all semantics.
    const device = new MatterbridgeEndpoint(doorLock, { id: 'YearDayScheduleCompliance' });
    device.createUserPinDoorLockClusterServer(DoorLock.LockState.Locked, DoorLock.LockType.DeadBolt, 0, 4, 10, undefined, 2);
    device.addRequiredClusterServers();
    expect(await addDevice(aggregator, device)).toBeDefined();
    const server = device.behaviors.supported.doorLock as typeof MatterbridgeDoorLockServer;

    for (const userIndex of [1, 2]) {
      await device.invokeBehaviorCommand(DoorLock, 'setUser', {
        operationType: DoorLock.DataOperationType.Add,
        userIndex,
        userName: 'Guest',
        userUniqueId: userIndex,
        userStatus: DoorLock.UserStatus.OccupiedEnabled,
        userType: DoorLock.UserType.ScheduleRestrictedUser,
        credentialRule: DoorLock.CredentialRule.Single,
      });
    }

    const index = { yearDayIndex: 1, userIndex: 1 };
    const request = { ...index, localStartTime: 1_000, localEndTime: 2_000 };
    const getSchedule = async (query = index): Promise<DoorLock.GetYearDayScheduleResponse> => device.act(async (agent) => agent.get(server).getYearDaySchedule(query));
    expect(await getSchedule()).toEqual({ ...index, status: Status.NotFound });
    expect(await getSchedule({ ...index, userIndex: 3 })).toEqual({ ...index, userIndex: 3, status: Status.NotFound });

    await device.invokeBehaviorCommand(DoorLock, 'setYearDaySchedule', request);
    expect(await getSchedule()).toEqual({ ...request, status: Status.Success });

    for (const yearDayIndex of [0, 3]) {
      const invalidIndex = { ...index, yearDayIndex };
      expect(await getSchedule(invalidIndex)).toEqual({ ...invalidIndex, status: Status.InvalidCommand });
      await expect(device.invokeBehaviorCommand(DoorLock, 'setYearDaySchedule', { ...request, yearDayIndex })).rejects.toMatchObject({ code: Status.InvalidCommand });
      await expect(device.invokeBehaviorCommand(DoorLock, 'clearYearDaySchedule', invalidIndex)).rejects.toMatchObject({ code: Status.InvalidCommand });
    }

    for (const userIndex of [0, 11]) {
      const invalidIndex = { ...index, userIndex };
      expect(await getSchedule(invalidIndex)).toEqual({ ...invalidIndex, status: Status.InvalidCommand });
      await expect(device.invokeBehaviorCommand(DoorLock, 'setYearDaySchedule', { ...request, userIndex })).rejects.toMatchObject({ code: Status.InvalidCommand });
      await expect(device.invokeBehaviorCommand(DoorLock, 'clearYearDaySchedule', invalidIndex)).rejects.toMatchObject({ code: Status.InvalidCommand });
    }

    for (const invalidTime of [{ localEndTime: 999 }, { localEndTime: 1_000 }]) {
      await expect(device.invokeBehaviorCommand(DoorLock, 'setYearDaySchedule', { ...request, ...invalidTime })).rejects.toMatchObject({ code: Status.InvalidCommand });
    }
    expect(await getSchedule()).toEqual({ ...request, status: Status.Success });

    const replacement = { ...request, localEndTime: 3_000 };
    await device.invokeBehaviorCommand(DoorLock, 'setYearDaySchedule', replacement);
    expect(await getSchedule()).toEqual({ ...replacement, status: Status.Success });
    await device.invokeBehaviorCommand(DoorLock, 'setYearDaySchedule', { ...request, yearDayIndex: 2 });
    await device.invokeBehaviorCommand(DoorLock, 'setYearDaySchedule', { ...request, userIndex: 2 });

    await device.invokeBehaviorCommand(DoorLock, 'clearYearDaySchedule', index);
    expect(await getSchedule()).toEqual({ ...index, status: Status.NotFound });
    expect(await getSchedule({ ...index, yearDayIndex: 2 })).toEqual({ ...request, yearDayIndex: 2, status: Status.Success });

    await device.invokeBehaviorCommand(DoorLock, 'setYearDaySchedule', request);
    await device.invokeBehaviorCommand(DoorLock, 'clearYearDaySchedule', { ...index, yearDayIndex: 0xfe });
    for (const yearDayIndex of [1, 2]) {
      expect(await getSchedule({ ...index, yearDayIndex })).toEqual({ ...index, yearDayIndex, status: Status.NotFound });
    }
    expect(await getSchedule({ ...index, userIndex: 2 })).toEqual({ ...request, userIndex: 2, status: Status.Success });
  });

  test('should validate, store, replace and clear Holiday schedules when the feature is enabled', async () => {
    // Matter 1.6.0 § 5.2.10.12–15: schedule constraints, response fields and clear-all semantics.
    const device = new MatterbridgeEndpoint(doorLock, { id: 'HolidayScheduleCompliance' });
    device.createDefaultDoorLockClusterServer(DoorLock.LockState.Locked, DoorLock.LockType.DeadBolt, 0, undefined, undefined, 2);
    device.addRequiredClusterServers();
    expect(await addDevice(aggregator, device)).toBeDefined();
    const server = device.behaviors.supported.doorLock as typeof MatterbridgeDoorLockServer;

    const index = { holidayIndex: 1 };
    const request = { ...index, localStartTime: 1_000, localEndTime: 2_000, operatingMode: DoorLock.OperatingMode.NoRemoteLockUnlock };
    const getSchedule = async (query = index): Promise<DoorLock.GetHolidayScheduleResponse> => device.act(async (agent) => agent.get(server).getHolidaySchedule(query));
    expect(await getSchedule()).toEqual({ ...index, status: Status.NotFound });

    await device.invokeBehaviorCommand(DoorLock, 'setHolidaySchedule', request);
    expect(await getSchedule()).toEqual({ ...request, status: Status.Success });

    for (const holidayIndex of [0, 3]) {
      const invalidIndex = { ...index, holidayIndex };
      expect(await getSchedule(invalidIndex)).toEqual({ ...invalidIndex, status: Status.InvalidCommand });
      await expect(device.invokeBehaviorCommand(DoorLock, 'setHolidaySchedule', { ...request, holidayIndex })).rejects.toMatchObject({ code: Status.InvalidCommand });
      await expect(device.invokeBehaviorCommand(DoorLock, 'clearHolidaySchedule', invalidIndex)).rejects.toMatchObject({ code: Status.InvalidCommand });
    }

    for (const invalidTime of [{ localEndTime: 999 }, { localEndTime: 1_000 }]) {
      await expect(device.invokeBehaviorCommand(DoorLock, 'setHolidaySchedule', { ...request, ...invalidTime })).rejects.toMatchObject({ code: Status.InvalidCommand });
    }
    expect(await getSchedule()).toEqual({ ...request, status: Status.Success });

    const replacement = { ...request, localEndTime: 3_000 };
    await device.invokeBehaviorCommand(DoorLock, 'setHolidaySchedule', replacement);
    expect(await getSchedule()).toEqual({ ...replacement, status: Status.Success });
    await device.invokeBehaviorCommand(DoorLock, 'setHolidaySchedule', { ...request, holidayIndex: 2 });

    await device.invokeBehaviorCommand(DoorLock, 'clearHolidaySchedule', index);
    expect(await getSchedule()).toEqual({ ...index, status: Status.NotFound });
    expect(await getSchedule({ ...index, holidayIndex: 2 })).toEqual({ ...request, holidayIndex: 2, status: Status.Success });

    await device.invokeBehaviorCommand(DoorLock, 'setHolidaySchedule', request);
    await device.invokeBehaviorCommand(DoorLock, 'clearHolidaySchedule', { ...index, holidayIndex: 0xfe });
    for (const holidayIndex of [1, 2]) {
      expect(await getSchedule({ ...index, holidayIndex })).toEqual({ ...index, holidayIndex, status: Status.NotFound });
    }
  });

  // TODO: Re-enable once the installed matter.js includes the ExpiringUser timeout fix and verify it passes.
  // Currently fails because the user remains OccupiedEnabled after expiry: https://github.com/matter-js/matter.js/pull/4402
  /*
  test('should disable an expiring user when expiringUserTimeout elapses after first credential use', async () => {
    // Matter 1.6.0 § 5.2.6.18.8 and § 5.2.9.36: expiry starts at first use and disables the user.
    const device = new MatterbridgeEndpoint(doorLock, { id: 'expiringUserDoorLock' });
    device.createUserPinDoorLockClusterServer(DoorLock.LockState.Locked, DoorLock.LockType.DeadBolt, 0, 4, 10, undefined, undefined, undefined, 1);
    device.addRequiredClusterServers();
    expect(await addDevice(aggregator, device)).toBeDefined();
    expect(device.getAttribute(DoorLock, 'expiringUserTimeout')).toBe(1);
    const server = device.behaviors.supported.doorLock as typeof MatterbridgeDoorLockServer;
    const pinCode = Buffer.from('2468');
    await device.invokeBehaviorCommand(DoorLock, 'setUser', {
      operationType: DoorLock.DataOperationType.Add,
      userIndex: 1,
      userName: 'Guest',
      userUniqueId: 1,
      userStatus: DoorLock.UserStatus.OccupiedEnabled,
      userType: DoorLock.UserType.ExpiringUser,
      credentialRule: DoorLock.CredentialRule.Single,
    });
    await device.invokeBehaviorCommand(DoorLock, 'setCredential', {
      operationType: DoorLock.DataOperationType.Add,
      credential: { credentialType: DoorLock.CredentialType.Pin, credentialIndex: 1 },
      credentialData: pinCode,
      userIndex: 1,
      userStatus: DoorLock.UserStatus.OccupiedEnabled,
      userType: DoorLock.UserType.ExpiringUser,
    });
    const getUser = async (): Promise<DoorLock.GetUserResponse> => device.act(async (agent) => agent.get(server).getUser({ userIndex: 1 }));
    expect(await getUser()).toMatchObject({ userType: DoorLock.UserType.ExpiringUser, userStatus: DoorLock.UserStatus.OccupiedEnabled });

    vi.useFakeTimers();
    try {
      // Merely creating the credential must not start its one-minute lifetime.
      await vi.advanceTimersByTimeAsync(120_000);
      expect(await getUser()).toMatchObject({ userStatus: DoorLock.UserStatus.OccupiedEnabled });
      await device.invokeBehaviorCommand(DoorLock, 'unlockDoor', { pinCode });
      expect(device.getAttribute(DoorLock, 'lockState')).toBe(DoorLock.LockState.Unlocked);
      await device.invokeBehaviorCommand(DoorLock, 'lockDoor', {});

      await vi.advanceTimersByTimeAsync(59_000);
      expect(await getUser()).toMatchObject({ userStatus: DoorLock.UserStatus.OccupiedEnabled });
      // Reusing the credential must not restart the lifetime measured from its first use.
      await device.invokeBehaviorCommand(DoorLock, 'unlockDoor', { pinCode });
      expect(device.getAttribute(DoorLock, 'lockState')).toBe(DoorLock.LockState.Unlocked);
      await device.invokeBehaviorCommand(DoorLock, 'lockDoor', {});

      await vi.advanceTimersByTimeAsync(1_000);
      expect(await getUser()).toMatchObject({ userStatus: DoorLock.UserStatus.OccupiedDisabled });
      await expect(device.invokeBehaviorCommand(DoorLock, 'unlockDoor', { pinCode })).rejects.toMatchObject({ code: Status.Failure });
      expect(device.getAttribute(DoorLock, 'lockState')).toBe(DoorLock.LockState.Locked);
    } finally {
      vi.useRealTimers();
    }
  });

  */

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

  test('User RFID set and clear credential', async () => {
    const rfidDoorLock = new MatterbridgeEndpoint(doorLock, { id: 'rfidDoorLock' });
    rfidDoorLock.createUserPinDoorLockClusterServer(DoorLock.LockState.Locked, DoorLock.LockType.DeadBolt, 0, 4, 10, undefined, undefined, undefined, undefined, 5);
    rfidDoorLock.addRequiredClusterServers();
    expect(await addDevice(aggregator, rfidDoorLock)).toBeDefined();

    const rfidDoorLockServer = rfidDoorLock.behaviors.supported.doorLock as typeof MatterbridgeDoorLockServer;
    expect(rfidDoorLock.getAttribute(DoorLock, 'numberOfRfidUsersSupported')).toBe(5);
    expect(rfidDoorLock.getAttribute(DoorLock, 'minRfidCodeLength')).toBe(8);
    expect(rfidDoorLock.getAttribute(DoorLock, 'maxRfidCodeLength')).toBe(20);

    const rfidTag = Buffer.from('04A224B21C6E80', 'ascii'); // 14-byte ASCII-hex representation of a 7-byte ISO 14443A UID; within the default [8, 20] range.

    await rfidDoorLock.invokeBehaviorCommand(DoorLock, 'setUser', {
      operationType: DoorLock.DataOperationType.Add,
      userIndex: 1,
      userName: 'RFID User',
      userUniqueId: 100,
      userStatus: DoorLock.UserStatus.OccupiedEnabled,
      userType: DoorLock.UserType.UnrestrictedUser,
      credentialRule: DoorLock.CredentialRule.Single,
    });
    await rfidDoorLock.invokeBehaviorCommand(DoorLock, 'setCredential', {
      operationType: DoorLock.DataOperationType.Add,
      credential: { credentialType: DoorLock.CredentialType.Rfid, credentialIndex: 1 },
      credentialData: rfidTag,
      userIndex: 1,
      userStatus: null,
      userType: null,
    });
    const createdCredential = await rfidDoorLock.act(async (agent) =>
      agent.get(rfidDoorLockServer).getCredentialStatus({ credential: { credentialType: DoorLock.CredentialType.Rfid, credentialIndex: 1 } }),
    );
    expect(createdCredential).toMatchObject({ credentialExists: true, userIndex: 1 });

    await rfidDoorLock.invokeBehaviorCommand(DoorLock, 'clearCredential', { credential: { credentialType: DoorLock.CredentialType.Rfid, credentialIndex: 1 } });
    const clearedCredential = await rfidDoorLock.act(async (agent) =>
      agent.get(rfidDoorLockServer).getCredentialStatus({ credential: { credentialType: DoorLock.CredentialType.Rfid, credentialIndex: 1 } }),
    );
    expect(clearedCredential).toMatchObject({ credentialExists: false, userIndex: null });
  });

  test('should enforce configured RFID credential limits when RfidCredential is enabled', async () => {
    const device = new MatterbridgeEndpoint(doorLock, { id: 'rfidCredentialLimits' });
    device.createUserPinDoorLockClusterServer(DoorLock.LockState.Locked, DoorLock.LockType.DeadBolt, 0, 4, 10, undefined, undefined, undefined, undefined, 2, 4, 7);
    device.addRequiredClusterServers();
    expect(await addDevice(aggregator, device)).toBeDefined();
    expect(device.getAttribute(DoorLock.id, 'featureMap')).toMatchObject({ rfidCredential: true });
    expect(device.getAttribute(DoorLock, 'numberOfRfidUsersSupported')).toBe(2);
    expect(device.getAttribute(DoorLock, 'minRfidCodeLength')).toBe(4);
    expect(device.getAttribute(DoorLock, 'maxRfidCodeLength')).toBe(7);
    const server = device.behaviors.supported.doorLock as typeof MatterbridgeDoorLockServer;
    await device.invokeBehaviorCommand(DoorLock, 'setUser', {
      operationType: DoorLock.DataOperationType.Add,
      userIndex: 1,
      userName: 'RFID Guest',
      userUniqueId: 1,
      userStatus: DoorLock.UserStatus.OccupiedEnabled,
      userType: DoorLock.UserType.UnrestrictedUser,
      credentialRule: DoorLock.CredentialRule.Single,
    });
    const request = {
      operationType: DoorLock.DataOperationType.Add,
      credential: { credentialType: DoorLock.CredentialType.Rfid, credentialIndex: 1 },
      credentialData: Buffer.from([1, 2, 3, 4]),
      userIndex: 1,
      userStatus: null,
      userType: null,
    };
    const setCredentialSpy = vi.spyOn(server.prototype, 'setCredential');
    const setCredential = async (value: DoorLock.SetCredentialRequest): Promise<DoorLock.SetCredentialResponse> => {
      await device.invokeBehaviorCommand(DoorLock, 'setCredential', value);
      return await setCredentialSpy.mock.results[setCredentialSpy.mock.results.length - 1].value;
    };
    for (const length of [3, 8]) {
      expect(await setCredential({ ...request, credentialData: Buffer.alloc(length, 1) })).toMatchObject({
        status: Status.InvalidCommand,
      });
    }
    expect(await setCredential({ ...request, credential: { ...request.credential, credentialIndex: 3 } })).toMatchObject({
      status: Status.InvalidCommand,
    });
    expect(await device.act(async (agent) => agent.get(server).getCredentialStatus({ credential: request.credential }))).toMatchObject({
      credentialExists: false,
      userIndex: null,
    });

    // Both inclusive code-length limits must be accepted.
    for (const [credentialIndex, length] of [
      [1, 4],
      [2, 7],
    ]) {
      const credential = { credentialType: DoorLock.CredentialType.Rfid, credentialIndex };
      expect(await setCredential({ ...request, credential, credentialData: Buffer.alloc(length, credentialIndex) })).toMatchObject({
        status: Status.Success,
      });
      expect(await device.act(async (agent) => agent.get(server).getCredentialStatus({ credential }))).toMatchObject({ credentialExists: true, userIndex: 1 });
    }
    setCredentialSpy.mockRestore();
    await device.invokeBehaviorCommand(DoorLock, 'clearUser', { userIndex: 1 });
    for (const credentialIndex of [1, 2]) {
      expect(
        await device.act(async (agent) => agent.get(server).getCredentialStatus({ credential: { credentialType: DoorLock.CredentialType.Rfid, credentialIndex } })),
      ).toMatchObject({ credentialExists: false, userIndex: null });
    }
  });

  test('User PIN returns duplicate and occupied credential statuses', async () => {
    const credential = { credentialType: DoorLock.CredentialType.Pin, credentialIndex: 1 };
    const request = {
      operationType: DoorLock.DataOperationType.Add,
      credential,
      credentialData: Buffer.from('1234'),
      userIndex: 1,
      userStatus: null,
      userType: null,
    };

    await userPinDoorLock.invokeBehaviorCommand(DoorLock, 'setCredential', request);

    await expect(
      userPinDoorLock.act(async (agent) => agent.get(supportedDoorLockServer()).setCredential({ ...request, credential: { ...credential, credentialIndex: 2 } })),
    ).rejects.toMatchObject({ code: Status.Failure, clusterCode: DoorLock.StatusCode.Duplicate });
    await expect(
      userPinDoorLock.act(async (agent) => agent.get(supportedDoorLockServer()).setCredential({ ...request, credentialData: Buffer.from('5678') })),
    ).rejects.toMatchObject({ code: Status.Failure, clusterCode: DoorLock.StatusCode.Occupied });

    await userPinDoorLock.invokeBehaviorCommand(DoorLock, 'clearCredential', { credential: null });
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

  describe('Matterbridge command handler forwarding', () => {
    let lock: MatterbridgeEndpoint;

    test('Device type: doorLock', async () => {
      lock = new MatterbridgeEndpoint(doorLock, { id: 'doorLock' });
      lock.addRequiredClusterServers();
      expect(lock).toBeDefined();
      expect(await addDevice(aggregator, lock)).toBeTruthy();
      // Disable timeout for testing, to avoid flaky tests
      const internal = await internalFor(lock, MatterbridgeDoorLockServer);
      expect(internal).toBeDefined();
      if (!internal) throw new Error('MatterbridgeDoorLockServer internal state not found');
      if ((internal as any).enableTimeout !== undefined) (internal as any).enableTimeout = false;
    });

    test('DoorLock server', async () => {
      expect(lock.getCluster(DoorLock)?.lockState).toBe(DoorLock.LockState.Locked);
      expect(lock.behaviors.has(MatterbridgeDoorLockServer.with())).toBeTruthy();
      expect(lock.behaviors.elementsOf(MatterbridgeDoorLockServer.with()).commands.has('lockDoor')).toBeTruthy();
      expect(lock.behaviors.elementsOf(MatterbridgeDoorLockServer.with()).commands.has('unlockDoor')).toBeTruthy();
      expect(lock.behaviors.elementsOf(MatterbridgeDoorLockServer.with()).commands.has('unlockWithTimeout')).toBeTruthy();

      await expectCommand(lock, DoorLock, 'DoorLock.unlockDoor', {}, (data) => {
        expect(data.cluster).toBe('doorLock');
      });
      expect(lock.getCluster(DoorLock)?.lockState).toBe(DoorLock.LockState.Unlocked);

      await expectCommand(lock, DoorLock, 'DoorLock.lockDoor', {}, (data) => {
        expect(data.cluster).toBe('doorLock');
      });
      expect(lock.getCluster(DoorLock)?.lockState).toBe(DoorLock.LockState.Locked);

      await expectCommand(lock, DoorLock, 'DoorLock.unlockWithTimeout', { timeout: 5 }, (data) => {
        expect(data.cluster).toBe('doorLock');
      });
      expect(lock.getCluster(DoorLock)?.lockState).toBe(DoorLock.LockState.Unlocked);
    });
  });
});
