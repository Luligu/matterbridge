/**
 * @file vitest/behaviors/cameraAvSettingsUserLevelManagementServer.test.ts
 * @description This file contains the tests for the MatterbridgeCameraAvSettingsUserLevelManagementServer behavior.
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
 */

const NAME = 'CameraAvSettingsUserLevelManagementServerBehavior';
const MATTER_PORT = 6011;
const MATTER_CREATE_ONLY = true;

import { StreamUsage } from '@matter/types';
import { CameraAvSettingsUserLevelManagement } from '@matter/types/clusters/camera-av-settings-user-level-management';
import { CameraAvStreamManagement } from '@matter/types/clusters/camera-av-stream-management';
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
  let twoStreamDevice: Camera;

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
          CameraAvSettingsUserLevelManagement.Feature.DigitalPtz,
        ),
      ),
    ).toBeTruthy();
    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'mptzPosition')).toEqual({ pan: 0, tilt: 0, zoom: 1 });
    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'movementState')).toBe(CameraAvSettingsUserLevelManagement.PhysicalMovement.Idle);
    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'maxPresets')).toBe(5);
    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'mptzPresets')).toEqual([]);
    // Matter 1.6.0 § 11.3.6.4: the entry is seeded by initialize() for the video stream that MatterbridgeCameraAvStreamManagementServer self-allocates, with the global Viewport.
    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'dptzStreams')).toEqual([{ videoStreamId: 0, viewport: { x1: 0, y1: 0, x2: 1920, y2: 1080 } }]);
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

  it('should reject setting the viewport of a video stream that is not in dptzStreams', async () => {
    await expect(
      device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'dptzSetViewport', { videoStreamId: 5, viewport: { x1: 0, y1: 0, x2: 1920, y2: 1080 } }),
    ).rejects.toThrow('video stream 5 is not present in dptzStreams');
  });

  it('should reject a viewport smaller than the minimum viewport resolution', async () => {
    await expect(
      device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'dptzSetViewport', { videoStreamId: 0, viewport: { x1: 1, y1: 10, x2: 1, y2: 10 } }),
    ).rejects.toThrow('viewport 0x0 is smaller than the minimum viewport resolution 640x360');
  });

  it('should reject a viewport that does not fit the sensor', async () => {
    // 1936x1089 keeps the 16:9 aspect ratio of the sensor, so this can only be rejected by the sensor size check.
    await expect(
      device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'dptzSetViewport', { videoStreamId: 0, viewport: { x1: 0, y1: 0, x2: 1936, y2: 1089 } }),
    ).rejects.toThrow('viewport 1936x1089 at (0, 0) does not fit the sensor 1920x1080');
  });

  it('should reject a viewport that does not match the aspect ratio of the stream', async () => {
    await expect(
      device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'dptzSetViewport', { videoStreamId: 0, viewport: { x1: 0, y1: 540, x2: 1920, y2: 1080 } }),
    ).rejects.toThrow('viewport 1920x540 does not match the aspect ratio of video stream 0 (1920x1080)');
  });

  it('should set the viewport of an allocated video stream', async () => {
    const listener = vi.fn();
    device.subscribeCommand(CameraAvSettingsUserLevelManagement, 'dptzSetViewport', listener);
    const viewport = { x1: 640, y1: 360, x2: 1280, y2: 720 };
    await expect(device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'dptzSetViewport', { videoStreamId: 0, viewport })).resolves.toBeUndefined();

    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'dptzStreams')).toEqual([{ videoStreamId: 0, viewport }]);
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('set the viewport of video stream 0 to (640, 360)-(1280, 720)'));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'dptzSetViewport',
        cluster: CameraAvSettingsUserLevelManagement.name[0].toLowerCase() + CameraAvSettingsUserLevelManagement.name.slice(1),
        endpoint: device,
        context: expect.anything(),
      }),
    );
  });

  it('should reject moving the viewport of a video stream that is not in dptzStreams', async () => {
    await expect(device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'dptzRelativeMove', { videoStreamId: 5, zoomDelta: 50 })).rejects.toThrow(
      'video stream 5 is not present in dptzStreams',
    );
  });

  it('should move the viewport by deltaX and deltaY', async () => {
    const listener = vi.fn();
    device.subscribeCommand(CameraAvSettingsUserLevelManagement, 'dptzRelativeMove', listener);
    await expect(device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'dptzRelativeMove', { videoStreamId: 0, deltaX: 100, deltaY: 50 })).resolves.toBeUndefined();

    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'dptzStreams')).toEqual([{ videoStreamId: 0, viewport: { x1: 740, y1: 410, x2: 1380, y2: 770 } }]);
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('moved the viewport of video stream 0 by deltaX 100, deltaY 50, zoomDelta 0 to (740, 410)-(1380, 770)'));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'dptzRelativeMove',
        cluster: CameraAvSettingsUserLevelManagement.name[0].toLowerCase() + CameraAvSettingsUserLevelManagement.name.slice(1),
        endpoint: device,
        context: expect.anything(),
      }),
    );
  });

  it('should keep a relative move inside the sensor Cartesian plane', async () => {
    // Matter 1.6.0 § 11.3.7.7.5: the upper left corner moves to the nearest point that keeps the viewport on the sensor.
    await expect(
      device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'dptzRelativeMove', { videoStreamId: 0, deltaX: -5000, deltaY: -5000 }),
    ).resolves.toBeUndefined();

    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'dptzStreams')).toEqual([{ videoStreamId: 0, viewport: { x1: 0, y1: 0, x2: 640, y2: 360 } }]);
  });

  it('should clamp a shrinking zoom to the minimum viewport resolution', async () => {
    // Matter 1.6.0 § 11.3.7.7.4: a positive ZoomDelta makes the viewport smaller; the result bottoms out at MinViewportResolution.
    // The 640x360 rectangle scales to 0x0 anchored at the centre of the old one, (320, 180), and is grown back to the minimum from there.
    await expect(device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'dptzRelativeMove', { videoStreamId: 0, zoomDelta: 100 })).resolves.toBeUndefined();

    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'dptzStreams')).toEqual([{ videoStreamId: 0, viewport: { x1: 320, y1: 180, x2: 960, y2: 540 } }]);
  });

  it('should clamp an enlarging zoom to the sensor size', async () => {
    // Matter 1.6.0 § 11.3.7.7.4: a negative ZoomDelta makes the viewport larger; the result tops out at the sensor size.
    await expect(device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'dptzRelativeMove', { videoStreamId: 0, zoomDelta: -100 })).resolves.toBeUndefined();

    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'dptzStreams')).toEqual([{ videoStreamId: 0, viewport: { x1: 0, y1: 0, x2: 1280, y2: 720 } }]);
  });

  it('should clip a zoom whose rounding widened the aspect ratio', async () => {
    // Rounding width and height independently can leave the rectangle slightly off the stream aspect ratio; § 11.3.7.7.5
    // then clips it back, here by reducing the height.
    await expect(
      device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'dptzSetViewport', { videoStreamId: 0, viewport: { x1: 0, y1: 0, x2: 1920, y2: 1080 } }),
    ).resolves.toBeUndefined();
    await expect(device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'dptzRelativeMove', { videoStreamId: 0, zoomDelta: -97 })).resolves.toBeUndefined();

    const [entry] = device.getAttribute(CameraAvSettingsUserLevelManagement, 'dptzStreams') ?? [];
    expect(entry.viewport).toEqual({ x1: 0, y1: 0, x2: 1920, y2: 1080 });
  });

  it('should clip a zoom whose rounding narrowed the aspect ratio', async () => {
    // The mirror of the previous case: the clipped height would exceed the rounded height, so the width is reduced instead.
    await expect(device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'dptzRelativeMove', { videoStreamId: 0, zoomDelta: -98 })).resolves.toBeUndefined();

    const [entry] = device.getAttribute(CameraAvSettingsUserLevelManagement, 'dptzStreams') ?? [];
    expect(entry.viewport).toEqual({ x1: 0, y1: 0, x2: 1920, y2: 1080 });
  });

  it('should re-base every dptzStreams entry when the global viewport changes', async () => {
    // Matter 1.6.0 § 11.2.7.25: when Viewport is changed, all Viewport values in DPTZStreams SHALL be updated to it.
    await expect(
      device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'dptzSetViewport', { videoStreamId: 0, viewport: { x1: 640, y1: 360, x2: 1280, y2: 720 } }),
    ).resolves.toBeUndefined();
    await device.setAttribute(CameraAvStreamManagement, 'viewport', { x1: 0, y1: 0, x2: 1280, y2: 720 });

    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'dptzStreams')).toEqual([{ videoStreamId: 0, viewport: { x1: 0, y1: 0, x2: 1280, y2: 720 } }]);
  });

  it('should drop the dptzStreams entry of a deallocated video stream', async () => {
    await device.setAttribute(CameraAvStreamManagement, 'allocatedVideoStreams', []);

    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'dptzStreams')).toEqual([]);
  });

  it('should leave dptzStreams untouched when the global viewport changes with no allocated stream', async () => {
    await device.setAttribute(CameraAvStreamManagement, 'viewport', { x1: 0, y1: 0, x2: 1920, y2: 1080 });

    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'dptzStreams')).toEqual([]);
  });

  it('should add a dptzStreams entry seeded with the global viewport for a newly allocated video stream', async () => {
    await expect(
      device.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamAllocate', {
        streamUsage: StreamUsage.LiveView,
        videoCodec: CameraAvStreamManagement.VideoCodec.H264,
        minFrameRate: 15,
        maxFrameRate: 30,
        minResolution: { width: 640, height: 360 },
        maxResolution: { width: 1920, height: 1080 },
        minBitRate: 500_000,
        maxBitRate: 2_000_000,
        keyFrameInterval: 2000,
      }),
    ).resolves.toBeUndefined();

    const streams = device.getAttribute(CameraAvSettingsUserLevelManagement, 'dptzStreams') ?? [];
    expect(streams).toHaveLength(1);
    expect(streams[0].viewport).toEqual({ x1: 0, y1: 0, x2: 1920, y2: 1080 });
  });

  it('should leave dptzStreams untouched when the allocated video streams are unchanged', async () => {
    const streams = device.getAttribute(CameraAvSettingsUserLevelManagement, 'dptzStreams') ?? [];
    const videoStreamId = streams[0].videoStreamId;
    await device.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'dptzSetViewport', { videoStreamId, viewport: { x1: 640, y1: 360, x2: 1280, y2: 720 } });
    const allocated = device.getAttribute(CameraAvStreamManagement, 'allocatedVideoStreams') ?? [];
    await device.setAttribute(CameraAvStreamManagement, 'allocatedVideoStreams', allocated);

    // The viewport set above survives, which it would not if the entry had been rebuilt from the global viewport.
    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'dptzStreams')).toEqual([{ videoStreamId, viewport: { x1: 640, y1: 360, x2: 1280, y2: 720 } }]);
  });

  it('should keep the entry of a surviving stream when another stream is allocated', async () => {
    // A second concurrent encoder, so that two video streams can be allocated at the same time on this endpoint.
    twoStreamDevice = new Camera('Ptz Camera Two Streams', 'PTZ-CAMERA-TWO-STREAMS', { ptz: true, maxConcurrentEncoders: 2 });
    expect(await addDevice(aggregator, twoStreamDevice)).toBeTruthy();
    const [selfAllocated] = twoStreamDevice.getAttribute(CameraAvSettingsUserLevelManagement, 'dptzStreams') ?? [];
    await expect(
      twoStreamDevice.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'dptzSetViewport', {
        videoStreamId: selfAllocated.videoStreamId,
        viewport: { x1: 640, y1: 360, x2: 1280, y2: 720 },
      }),
    ).resolves.toBeUndefined();

    await expect(
      twoStreamDevice.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamAllocate', {
        streamUsage: StreamUsage.Recording,
        videoCodec: CameraAvStreamManagement.VideoCodec.H264,
        minFrameRate: 15,
        maxFrameRate: 30,
        minResolution: { width: 1280, height: 720 },
        maxResolution: { width: 1920, height: 1080 },
        minBitRate: 1_000_000,
        maxBitRate: 2_000_000,
        keyFrameInterval: 2000,
      }),
    ).resolves.toBeUndefined();

    const streams = twoStreamDevice.getAttribute(CameraAvSettingsUserLevelManagement, 'dptzStreams') ?? [];
    expect(streams).toHaveLength(2);
    // The surviving entry keeps the viewport it was given, while the new one is seeded from the global viewport.
    expect(streams[0]).toEqual({ videoStreamId: selfAllocated.videoStreamId, viewport: { x1: 640, y1: 360, x2: 1280, y2: 720 } });
    expect(streams[1].viewport).toEqual({ x1: 0, y1: 0, x2: 1920, y2: 1080 });
  });

  it('should set the viewport of one stream without touching the others', async () => {
    const [first, second] = twoStreamDevice.getAttribute(CameraAvSettingsUserLevelManagement, 'dptzStreams') ?? [];
    await expect(
      twoStreamDevice.invokeBehaviorCommand(CameraAvSettingsUserLevelManagement, 'dptzSetViewport', {
        videoStreamId: second.videoStreamId,
        viewport: { x1: 0, y1: 0, x2: 1280, y2: 720 },
      }),
    ).resolves.toBeUndefined();

    expect(twoStreamDevice.getAttribute(CameraAvSettingsUserLevelManagement, 'dptzStreams')).toEqual([
      { videoStreamId: first.videoStreamId, viewport: { x1: 640, y1: 360, x2: 1280, y2: 720 } },
      { videoStreamId: second.videoStreamId, viewport: { x1: 0, y1: 0, x2: 1280, y2: 720 } },
    ]);
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
