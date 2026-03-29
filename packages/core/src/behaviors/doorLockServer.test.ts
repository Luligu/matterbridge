// src\behaviors\doorLockServer.test.ts

const NAME = 'DoorLockServer';
const MATTER_PORT = 11600;
const HOMEDIR = path.join('.cache', 'jest', NAME);
const MATTER_CREATE_ONLY = true;

import path from 'node:path';

import { jest } from '@jest/globals';
import { DoorLock } from '@matter/types/clusters/door-lock';
import { wait } from '@matterbridge/utils/wait';

import {
  addDevice,
  aggregator,
  createMatterbridgeEnvironment,
  destroyMatterbridgeEnvironment,
  setupTest,
  startMatterbridgeEnvironment,
  stopMatterbridgeEnvironment,
} from '../jestutils/jestHelpers.js';
import { doorLockDevice } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { internalFor } from '../matterbridgeEndpointHelpers.js';
import { MatterbridgeDoorLockServer } from './doorLockServer.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Client clusters and behaviors', () => {
  let device: MatterbridgeEndpoint;

  beforeAll(async () => {
    // Create Matterbridge environment
    await createMatterbridgeEnvironment(NAME, MATTER_CREATE_ONLY);
    await startMatterbridgeEnvironment(MATTER_PORT, MATTER_CREATE_ONLY);
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
    device = new MatterbridgeEndpoint(doorLockDevice, { id: 'doorLockDevice' });
    expect(device).toBeDefined();
    device.behaviors.require(
      MatterbridgeDoorLockServer.enable({
        events: { doorLockAlarm: true, lockOperation: true, lockOperationError: true },
        commands: { lockDoor: true, unlockDoor: true, unlockWithTimeout: true },
      }),
      {
        // Base attributes
        lockState: DoorLock.LockState.Locked,
        lockType: DoorLock.LockType.DeadBolt,
        /** This attribute SHALL indicate if the lock is currently able to (Enabled) or not able to (Disabled) process remote Lock, Unlock, or Unlock with Timeout commands. */
        actuatorEnabled: true,
        /** This attribute SHALL indicate the current operating mode of the lock as defined in OperatingModeEnum */
        operatingMode: DoorLock.OperatingMode.Normal,
        /**
         * This attribute SHALL contain a bitmap with all operating bits of the OperatingMode attribute supported
         * by the lock. All operating modes NOT supported by a lock SHALL be set to one. The value of
         * the OperatingMode enumeration defines the related bit to be set.
         * OperatingModesBitmap.Normal and OperatingModesBitmap.noRemoteLockUnlock are mandatory and SHALL always be supported.
         * Default value 0xFFF6 (1111 1111 1111 0110) means:
         * - normal: false (bit 0)
         * - vacation: true (bit 1)
         * - privacy: true (bit 2)
         * - noRemoteLockUnlock: false (bit 3)
         * - passage: true (bit 4)
         * Special case of inverted bitmap: add also alwaysSet = 2047 (0000 0111 1111 1111) to have all bits set except the unsupported ones.
         * Specs: "Any bit that is not yet defined in OperatingModesBitmap SHALL be set to 1."
         */
        supportedOperatingModes: { normal: false, vacation: true, privacy: true, noRemoteLockUnlock: false, passage: true, alwaysSet: 2047 },
        autoRelockTime: 0, // 0=disabled
      },
    );
    device.addRequiredClusterServers();
    expect(await addDevice(aggregator, device)).toBeDefined();
    expect(device.behaviors.has(MatterbridgeDoorLockServer)).toBe(true);
    expect(device.getAttribute(DoorLock.Complete, 'lockState')).toBe(DoorLock.LockState.Locked);
  });

  test('Lock and unlock', async () => {
    await device.invokeBehaviorCommand(DoorLock.Complete, 'unlockDoor', {});
    expect(device.getAttribute(DoorLock.Complete, 'lockState')).toBe(DoorLock.LockState.Unlocked);
    await device.invokeBehaviorCommand(DoorLock.Complete, 'lockDoor', {});
    expect(device.getAttribute(DoorLock.Complete, 'lockState')).toBe(DoorLock.LockState.Locked);
  });

  test('Lock, unlock and lockWithTimeout with actuator disabled', async () => {
    await device.setAttribute(DoorLock.Complete, 'actuatorEnabled', false);
    await device.invokeBehaviorCommand(DoorLock.Complete, 'lockDoor', {});
    expect(device.getAttribute(DoorLock.Complete, 'lockState')).toBe(DoorLock.LockState.Locked);
    await device.invokeBehaviorCommand(DoorLock.Complete, 'unlockDoor', {});
    expect(device.getAttribute(DoorLock.Complete, 'lockState')).toBe(DoorLock.LockState.Locked);
    await device.invokeBehaviorCommand(DoorLock.Complete, 'unlockWithTimeout', { timeout: 1 });
    expect(device.getAttribute(DoorLock.Complete, 'lockState')).toBe(DoorLock.LockState.Locked);
    await device.setAttribute(DoorLock.Complete, 'actuatorEnabled', true);
  });

  test('Auto relock', async () => {
    const internal = await internalFor<MatterbridgeDoorLockServer.Internal>(device, MatterbridgeDoorLockServer);
    expect(internal).toBeDefined();
    if (!internal) throw new Error('MatterbridgeDoorLockServer internal state not found');
    internal.enableTimeout = true;
    await device.setAttribute(DoorLock.Complete, 'autoRelockTime', 1); // Set autoRelockTime to 1 second
    await device.invokeBehaviorCommand(DoorLock.Complete, 'unlockDoor', {});
    expect(device.getAttribute(DoorLock.Complete, 'lockState')).toBe(DoorLock.LockState.Unlocked);
    await wait(1000); // Wait for autoRelockTime to trigger
    expect(device.getAttribute(DoorLock.Complete, 'lockState')).toBe(DoorLock.LockState.Locked);
    await device.setAttribute(DoorLock.Complete, 'autoRelockTime', 0); // Set autoRelockTime to 0 (disabled)
  });

  test('Unlock with timeout', async () => {
    await device.invokeBehaviorCommand(DoorLock.Complete, 'unlockWithTimeout', { timeout: 1 });
    expect(device.getAttribute(DoorLock.Complete, 'lockState')).toBe(DoorLock.LockState.Unlocked);
    await wait(1000); // Wait for unlockWithTimeout to trigger
    expect(device.getAttribute(DoorLock.Complete, 'lockState')).toBe(DoorLock.LockState.Locked);
  });
});
