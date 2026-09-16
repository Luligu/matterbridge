/**
 * @file vitest/behaviors/cameraAvSettingsUserLevelManagementServer.test.ts
 * @description This file contains the tests for the MatterbridgeCameraAvSettingsUserLevelManagementServer behavior.
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
 */

const NAME = 'CameraAvSettingsUserLevelManagementServerBehavior';
const MATTER_PORT = 6011;
const MATTER_CREATE_ONLY = true;

import { CameraAvSettingsUserLevelManagement } from '@matter/types/clusters/camera-av-settings-user-level-management';
import { loggerErrorSpy, loggerFatalSpy, loggerInfoSpy, loggerWarnSpy, setupTest } from '@matterbridge/vitest-utils';
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

import {
  createDefaultCameraAvSettingsUserLevelManagementClusterServer,
  MatterbridgeCameraAvSettingsUserLevelManagementServer,
} from '../../src/behaviors/cameraAvSettingsUserLevelManagementServer.js';
import { Camera } from '../../src/devices/camera.js';

await setupTest(NAME);

describe('MatterbridgeCameraAvSettingsUserLevelManagementServer', () => {
  let device: Camera;

  beforeAll(async () => {
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

  afterEach(() => {
    // No errors logged during tests
    expect(loggerWarnSpy).not.toHaveBeenCalled();
    expect(loggerErrorSpy).not.toHaveBeenCalled();
    expect(loggerFatalSpy).not.toHaveBeenCalled();
  });

  afterAll(async () => {
    // Stop or flush the server node depending on the create-only mode
    if (MATTER_CREATE_ONLY) await flushServerNode();
    else await stopServerNode();
    // Destroy the Matter test environment
    await destroyTestEnvironment();
    // Restore all mocks
    vi.restoreAllMocks();
  });

  it('should create and register a PTZ camera using the Camera AV Settings User Level Management behavior', async () => {
    device = new Camera('Ptz Camera Behavior', 'PTZ-CAMERA-BEHAVIOR', { ptz: true });
    expect(
      device.behaviors.has(
        MatterbridgeCameraAvSettingsUserLevelManagementServer.with(
          CameraAvSettingsUserLevelManagement.Feature.MechanicalPan,
          CameraAvSettingsUserLevelManagement.Feature.MechanicalTilt,
          CameraAvSettingsUserLevelManagement.Feature.MechanicalZoom,
          CameraAvSettingsUserLevelManagement.Feature.MechanicalPresets,
        ),
      ),
    ).toBeTruthy();
    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'mptzPosition')).toEqual({ pan: 0, tilt: 0, zoom: 1 });
    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'movementState')).toBe(CameraAvSettingsUserLevelManagement.PhysicalMovement.Idle);
    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'maxPresets')).toBe(5);
    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'mptzPresets')).toEqual([]);
  });

  it('should reject an absolute position request with pan, tilt and zoom all omitted', async () => {
    await expect(device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'mptzSetPosition', {})).rejects.toThrow(
      'mptzSetPosition requires at least one of pan, tilt or zoom to be present',
    );
  });

  it('should reject setting an absolute pan position outside of the supported range', async () => {
    const listener = vi.fn();
    device.subscribeCommand(CameraAvSettingsUserLevelManagement, 'mptzSetPosition', listener);
    await expect(device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'mptzSetPosition', { pan: 200 })).rejects.toThrow(
      'pan 200 is outside of the supported range [-170, 170]',
    );
    expect(listener).not.toHaveBeenCalled();
  });

  it('should reject setting an absolute tilt position outside of the supported range', async () => {
    await expect(device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'mptzSetPosition', { tilt: 100 })).rejects.toThrow(
      'tilt 100 is outside of the supported range [-20, 90]',
    );
  });

  it('should reject setting an absolute zoom position outside of the supported range', async () => {
    await expect(device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'mptzSetPosition', { zoom: 11 })).rejects.toThrow(
      'zoom 11 is outside of the supported range [1, 10]',
    );
  });

  it('should set an absolute pan, tilt and zoom position', async () => {
    const listener = vi.fn();
    device.subscribeCommand(CameraAvSettingsUserLevelManagement, 'mptzSetPosition', listener);
    await expect(device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'mptzSetPosition', { pan: 45, tilt: 10, zoom: 5 })).resolves.toBeUndefined();

    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'mptzPosition')).toEqual({ pan: 45, tilt: 10, zoom: 5 });
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('set mechanical PTZ position to pan 45°, tilt 10°, zoom 5'));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'mptzSetPosition',
        cluster: CameraAvSettingsUserLevelManagement.name[0].toLowerCase() + CameraAvSettingsUserLevelManagement.name.slice(1),
        endpoint: device,
        context: expect.anything(),
      }),
    );
  });

  it('should leave fields not present in the request unchanged', async () => {
    await expect(device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'mptzSetPosition', { zoom: 2 })).resolves.toBeUndefined();

    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'mptzPosition')).toEqual({ pan: 45, tilt: 10, zoom: 2 });
  });

  it('should move by a relative pan, tilt and zoom delta', async () => {
    const listener = vi.fn();
    device.subscribeCommand(CameraAvSettingsUserLevelManagement, 'mptzRelativeMove', listener);
    await expect(device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'mptzRelativeMove', { panDelta: -5, tiltDelta: 5, zoomDelta: 3 })).resolves.toBeUndefined();

    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'mptzPosition')).toEqual({ pan: 40, tilt: 15, zoom: 5 });
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('moved mechanical PTZ position by pan -5°, tilt 5°, zoom 3 to pan 40°, tilt 15°, zoom 5'));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'mptzRelativeMove',
        cluster: CameraAvSettingsUserLevelManagement.name[0].toLowerCase() + CameraAvSettingsUserLevelManagement.name.slice(1),
        endpoint: device,
        context: expect.anything(),
      }),
    );
  });

  it('should clamp a relative move at the pan, tilt and zoom limits', async () => {
    await expect(
      device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'mptzRelativeMove', { panDelta: 1000, tiltDelta: 1000, zoomDelta: -1000 }),
    ).resolves.toBeUndefined();

    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'mptzPosition')).toEqual({ pan: 170, tilt: 90, zoom: 1 });
  });

  it('should move by a relative pan delta only, leaving tilt and zoom unchanged', async () => {
    await expect(device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'mptzRelativeMove', { panDelta: -10 })).resolves.toBeUndefined();

    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'mptzPosition')).toEqual({ pan: 160, tilt: 90, zoom: 1 });
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('moved mechanical PTZ position by pan -10°, tilt 0°, zoom 0 to pan 160°, tilt 90°, zoom 1'));
  });

  it('should move by a relative tilt delta only, leaving pan and zoom unchanged', async () => {
    await expect(device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'mptzRelativeMove', { tiltDelta: -10 })).resolves.toBeUndefined();

    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'mptzPosition')).toEqual({ pan: 160, tilt: 80, zoom: 1 });
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('moved mechanical PTZ position by pan 0°, tilt -10°, zoom 0 to pan 160°, tilt 80°, zoom 1'));
  });

  it('should reject a relative move request with panDelta, tiltDelta and zoomDelta all omitted', async () => {
    await expect(device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'mptzRelativeMove', {})).rejects.toThrow(
      'mptzRelativeMove requires at least one of panDelta, tiltDelta or zoomDelta to be present',
    );

    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'mptzPosition')).toEqual({ pan: 160, tilt: 80, zoom: 1 });
  });

  it('should preserve tilt and zoom when only pan is present in an absolute position request', async () => {
    await expect(device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'mptzSetPosition', { pan: -170 })).resolves.toBeUndefined();

    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'mptzPosition')).toEqual({ pan: -170, tilt: 80, zoom: 1 });
  });

  it('should save a preset generating the preset id when the request omits it', async () => {
    const listener = vi.fn();
    device.subscribeCommand(CameraAvSettingsUserLevelManagement, 'mptzSavePreset', listener);
    await expect(device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'mptzSavePreset', { name: 'Front door' })).resolves.toBeUndefined();

    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'mptzPresets')).toEqual([{ presetId: 1, name: 'Front door', settings: { pan: -170, tilt: 80, zoom: 1 } }]);
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('saved preset 1 "Front door" with the current mechanical PTZ position'));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'mptzSavePreset',
        cluster: CameraAvSettingsUserLevelManagement.name[0].toLowerCase() + CameraAvSettingsUserLevelManagement.name.slice(1),
        endpoint: device,
        context: expect.anything(),
      }),
    );
  });

  it('should keep generated preset ids monotonic across saves', async () => {
    await expect(device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'mptzSavePreset', { name: 'Driveway' })).resolves.toBeUndefined();

    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'mptzPresets')).toContainEqual({ presetId: 2, name: 'Driveway', settings: { pan: -170, tilt: 80, zoom: 1 } });
  });

  it('should save a preset using the preset id provided in the request', async () => {
    await expect(device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'mptzSavePreset', { presetId: 4, name: 'Garden' })).resolves.toBeUndefined();

    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'mptzPresets')).toContainEqual({ presetId: 4, name: 'Garden', settings: { pan: -170, tilt: 80, zoom: 1 } });
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('saved preset 4 "Garden" with the current mechanical PTZ position'));
  });

  it('should update an existing preset with the current position when the preset id already exists', async () => {
    await expect(device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'mptzSetPosition', { pan: 10, tilt: 20, zoom: 3 })).resolves.toBeUndefined();
    await expect(device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'mptzSavePreset', { presetId: 1, name: 'Front gate' })).resolves.toBeUndefined();

    const presets = device.getAttribute(CameraAvSettingsUserLevelManagement, 'mptzPresets');
    expect(presets).toHaveLength(3);
    expect(presets).toContainEqual({ presetId: 1, name: 'Front gate', settings: { pan: 10, tilt: 20, zoom: 3 } });
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('updated preset 1 "Front gate" with the current mechanical PTZ position'));
  });

  it('should reject saving a preset with a name longer than 32 characters', async () => {
    await expect(device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'mptzSavePreset', { name: 'a'.repeat(33) })).rejects.toThrow(
      'exceeds the maximum length of 32 characters',
    );
  });

  it('should reject saving a preset with a preset id outside of the supported range', async () => {
    await expect(device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'mptzSavePreset', { presetId: 6, name: 'Too high' })).rejects.toThrow(
      'presetId 6 is outside of the supported range [1, 5]',
    );
  });

  it('should move to a saved preset', async () => {
    const listener = vi.fn();
    device.subscribeCommand(CameraAvSettingsUserLevelManagement, 'mptzMoveToPreset', listener);
    await expect(device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'mptzMoveToPreset', { presetId: 2 })).resolves.toBeUndefined();

    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'mptzPosition')).toEqual({ pan: -170, tilt: 80, zoom: 1 });
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('moved mechanical PTZ position to preset 2 "Driveway": pan -170°, tilt 80°, zoom 1'));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'mptzMoveToPreset',
        cluster: CameraAvSettingsUserLevelManagement.name[0].toLowerCase() + CameraAvSettingsUserLevelManagement.name.slice(1),
        endpoint: device,
        context: expect.anything(),
      }),
    );
  });

  it('should reject moving to a preset that does not exist', async () => {
    await expect(device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'mptzMoveToPreset', { presetId: 3 })).rejects.toThrow(
      'presetId 3 is not present in mptzPresets',
    );
  });

  it('should reject moving to a preset id outside of the supported range', async () => {
    await expect(device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'mptzMoveToPreset', { presetId: 6 })).rejects.toThrow(
      'presetId 6 is outside of the supported range [1, 5]',
    );
  });

  it('should reject removing a preset id outside of the supported range', async () => {
    await expect(device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'mptzRemovePreset', { presetId: 6 })).rejects.toThrow(
      'presetId 6 is outside of the supported range [1, 5]',
    );
  });

  it('should reject removing a preset that does not exist', async () => {
    await expect(device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'mptzRemovePreset', { presetId: 3 })).rejects.toThrow(
      'presetId 3 is not present in mptzPresets',
    );
  });

  it('should skip preset ids already in use when generating a new one', async () => {
    // Presets 1, 2 and 4 are in use and the last generated id is 2, so the next two generated ids are 3 and then 5,
    // the latter reached by skipping the already-used 4.
    await expect(device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'mptzSavePreset', { name: 'Patio' })).resolves.toBeUndefined();
    await expect(device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'mptzSavePreset', { name: 'Garage' })).resolves.toBeUndefined();

    const presets = device.getAttribute(CameraAvSettingsUserLevelManagement, 'mptzPresets') ?? [];
    expect(presets).toHaveLength(5);
    expect(presets.map((preset) => preset.presetId).toSorted((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
    expect(presets).toContainEqual({ presetId: 3, name: 'Patio', settings: { pan: -170, tilt: 80, zoom: 1 } });
    expect(presets).toContainEqual({ presetId: 5, name: 'Garage', settings: { pan: -170, tilt: 80, zoom: 1 } });
  });

  it('should reject saving a generated preset when the preset list is full', async () => {
    await expect(device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'mptzSavePreset', { name: 'Overflow' })).rejects.toThrow(
      'mptzPresets already holds the maximum of 5 presets',
    );
  });

  it('should reject saving a new preset id when the preset list is full', async () => {
    // Preset 3 was removed from the list below, so this asserts the full-list check for an explicit, unused id.
    await expect(device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'mptzRemovePreset', { presetId: 3 })).resolves.toBeUndefined();
    await expect(device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'mptzSavePreset', { presetId: 3, name: 'Refilled' })).resolves.toBeUndefined();
    await expect(device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'mptzSavePreset', { presetId: 6, name: 'Rejected' })).rejects.toThrow(
      'presetId 6 is outside of the supported range [1, 5]',
    );
  });

  it('should remove a saved preset', async () => {
    const listener = vi.fn();
    device.subscribeCommand(CameraAvSettingsUserLevelManagement, 'mptzRemovePreset', listener);
    await expect(device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'mptzRemovePreset', { presetId: 5 })).resolves.toBeUndefined();

    const presets = device.getAttribute(CameraAvSettingsUserLevelManagement, 'mptzPresets') ?? [];
    expect(presets).toHaveLength(4);
    expect(presets.map((preset) => preset.presetId).toSorted((a, b) => a - b)).toEqual([1, 2, 3, 4]);
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('removed preset 5'));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'mptzRemovePreset',
        cluster: CameraAvSettingsUserLevelManagement.name[0].toLowerCase() + CameraAvSettingsUserLevelManagement.name.slice(1),
        endpoint: device,
        context: expect.anything(),
      }),
    );
  });

  it('should add createDefaultCameraAvSettingsUserLevelManagementClusterServer to an endpoint', () => {
    const device = new Camera('Camera Ptz Helper', 'CAMERA-PTZ-HELPER', { ptz: true });
    // The constructor already creates the CameraAvSettingsUserLevelManagement cluster server; calling the helper again should return the same endpoint.
    expect(
      createDefaultCameraAvSettingsUserLevelManagementClusterServer(device, {
        panMin: -170,
        panMax: 170,
        tiltMin: -20,
        tiltMax: 90,
        zoomMax: 10,
        mptzPosition: { pan: 0, tilt: 0, zoom: 1 },
        maxPresets: 5,
      }),
    ).toBe(device);
  });
});
