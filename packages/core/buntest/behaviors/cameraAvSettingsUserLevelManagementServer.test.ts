/**
 * @file packages/core/buntest/behaviors/cameraAvSettingsUserLevelManagementServer.test.ts
 * @description This file contains the bun tests for cameraAvSettingsUserLevelManagementServer.
 * @author Luca Liguori
 */

const NAME = 'CameraAvSettingsUserLevelManagementServerBehavior';
const MATTER_PORT = 6011;

import { afterEach, describe, expect, test, vi } from 'bun:test';

import { CameraAvSettingsUserLevelManagement } from '@matter/types/clusters/camera-av-settings-user-level-management';
import { CameraAvStreamManagement } from '@matter/types/clusters/camera-av-stream-management';
import { Status, StreamUsage } from '@matter/types/globals';
import { addBridgedDevice, aggregator } from '@matterbridge/test-utils/buntest/matter';
import { loggerErrorSpy, loggerFatalSpy, loggerInfoSpy, loggerWarnSpy, setupTest } from '@matterbridge/test-utils/buntest/setup';

import {
  createDefaultCameraAvSettingsUserLevelManagementClusterServer,
  MatterbridgeCameraAvSettingsUserLevelManagementServer,
} from '../../src/behaviors/cameraAvSettingsUserLevelManagementServer.js';
import { Camera } from '../../src/devices/camera.js';
import { advanceTimersByTimeAsync, useServerNode } from '../bunUtils.js';

await setupTest(NAME, false);

const PTZ = CameraAvSettingsUserLevelManagement;
const { Idle, Moving } = PTZ.PhysicalMovement;
type Viewport = { x1: number; y1: number; x2: number; y2: number };
type DptzStream = { videoStreamId: number; viewport: Viewport };
type Preset = { presetId: number; name: string; settings: object };
type Command = 'mptzSetPosition' | 'mptzRelativeMove' | 'mptzMoveToPreset' | 'mptzSavePreset' | 'mptzRemovePreset' | 'dptzSetViewport' | 'dptzRelativeMove';
const commands: Command[] = ['mptzSetPosition', 'mptzRelativeMove', 'mptzMoveToPreset', 'mptzSavePreset', 'mptzRemovePreset', 'dptzSetViewport', 'dptzRelativeMove'];
const videoStreamRequest = (
  streamUsage: StreamUsage,
  minResolution: { width: number; height: number },
  minBitRate: number,
): CameraAvStreamManagement.VideoStreamAllocateRequest => ({
  streamUsage,
  videoCodec: CameraAvStreamManagement.VideoCodec.H264,
  minFrameRate: 15,
  maxFrameRate: 30,
  minResolution,
  maxResolution: { width: 1920, height: 1080 },
  minBitRate,
  maxBitRate: 2_000_000,
  keyFrameInterval: 2000,
});

describe('MatterbridgeCameraAvSettingsUserLevelManagementServer', () => {
  useServerNode(MATTER_PORT);
  let device: Camera;
  const emitted: Command[] = [];
  const invoke = async (command: Command, request: object): Promise<unknown> => device.invokeBehaviorCommand(PTZ, command, request as never);
  const position = (): unknown => device.getAttribute(PTZ, 'mptzPosition');
  const dptzStreams = (camera: Camera = device): DptzStream[] => [...(camera.getAttribute(PTZ, 'dptzStreams') ?? [])];

  /**
   * Runs a mechanical move: MovementState is Moving after the response and back to Idle once the move completes.
   *
   * @param {Command} command - The move command.
   * @param {object} request - The request.
   * @returns {Promise<void>} Resolves once the move completed.
   */
  const move = async (command: Command, request: object): Promise<void> => {
    vi.useFakeTimers();
    try {
      await invoke(command, request);
      expect(device.getAttribute(PTZ, 'movementState')).toBe(Moving);
      await advanceTimersByTimeAsync(1000, 10);
    } finally {
      vi.useRealTimers();
    }
    expect(device.getAttribute(PTZ, 'movementState')).toBe(Idle);
  };

  afterEach(() => {
    expect(loggerWarnSpy).not.toHaveBeenCalled();
    expect(loggerErrorSpy).not.toHaveBeenCalled();
    expect(loggerFatalSpy).not.toHaveBeenCalled();
  });

  test('a PTZ camera starts Idle at the home position with one DPTZ stream for its video stream', async () => {
    device = new Camera('Ptz Camera Behavior', 'PTZ-CAMERA-BEHAVIOR', { ptz: true });
    const { MechanicalPan, MechanicalTilt, MechanicalZoom, MechanicalPresets, DigitalPtz } = PTZ.Feature;
    expect(
      device.behaviors.has(MatterbridgeCameraAvSettingsUserLevelManagementServer.with(MechanicalPan, MechanicalTilt, MechanicalZoom, MechanicalPresets, DigitalPtz)),
    ).toBeTruthy();
    expect(await addBridgedDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(position()).toEqual({ pan: 0, tilt: 0, zoom: 1 });
    expect([device.getAttribute(PTZ, 'movementState'), device.getAttribute(PTZ, 'maxPresets'), device.getAttribute(PTZ, 'mptzPresets')]).toEqual([Idle, 5, []]);
    // Matter 1.6.1 § 11.3.6.4: seeded for the self-allocated video stream with the global Viewport.
    expect(dptzStreams()).toEqual([{ videoStreamId: 0, viewport: { x1: 0, y1: 0, x2: 1920, y2: 1080 } }]);
    for (const command of commands) device.subscribeCommand(PTZ, command, (data) => emitted.push(data.command as Command));
  });

  test.each([
    ['mptzSetPosition', {}, 'mptzSetPosition requires at least one of pan, tilt or zoom to be present'],
    ['mptzSetPosition', { pan: 200 }, 'pan 200 is outside of the supported range [-170, 170]'],
    ['mptzSetPosition', { tilt: 100 }, 'tilt 100 is outside of the supported range [-20, 90]'],
    ['mptzSetPosition', { zoom: 11 }, 'zoom 11 is outside of the supported range [1, 10]'],
    ['mptzRelativeMove', {}, 'mptzRelativeMove requires at least one of panDelta, tiltDelta or zoomDelta to be present'],
  ] as const)('%s %o is rejected and not announced', (command, request, message) => {
    expect(invoke(command, request)).rejects.toThrow(message);
    expect(position()).toEqual({ pan: 0, tilt: 0, zoom: 1 });
    expect(emitted).toEqual([]);
  });

  test('absolute and relative moves update MPTZPosition once complete, clamped to the limits', async () => {
    const steps: [Command, object, object, string][] = [
      ['mptzSetPosition', { pan: 45, tilt: 10, zoom: 5 }, { pan: 45, tilt: 10, zoom: 5 }, 'set mechanical PTZ position to pan 45°, tilt 10°, zoom 5'],
      // Fields not present in the request are left unchanged.
      ['mptzSetPosition', { zoom: 2 }, { pan: 45, tilt: 10, zoom: 2 }, 'set mechanical PTZ position'],
      [
        'mptzRelativeMove',
        { panDelta: -5, tiltDelta: 5, zoomDelta: 3 },
        { pan: 40, tilt: 15, zoom: 5 },
        'moved mechanical PTZ position by pan -5°, tilt 5°, zoom 3 to pan 40°, tilt 15°, zoom 5',
      ],
      ['mptzRelativeMove', { panDelta: 1000, tiltDelta: 1000, zoomDelta: -1000 }, { pan: 170, tilt: 90, zoom: 1 }, 'moved mechanical PTZ position'],
      ['mptzRelativeMove', { panDelta: -10 }, { pan: 160, tilt: 90, zoom: 1 }, 'moved mechanical PTZ position by pan -10°, tilt 0°, zoom 0 to pan 160°, tilt 90°, zoom 1'],
      ['mptzRelativeMove', { tiltDelta: -10 }, { pan: 160, tilt: 80, zoom: 1 }, 'moved mechanical PTZ position by pan 0°, tilt -10°, zoom 0 to pan 160°, tilt 80°, zoom 1'],
      ['mptzSetPosition', { pan: -170 }, { pan: -170, tilt: 80, zoom: 1 }, 'set mechanical PTZ position'],
    ];
    for (const [command, request, expected, log] of steps) {
      await move(command, request);
      expect(position()).toEqual(expected);
      expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining(log));
    }
    expect(emitted.splice(0)).toEqual(steps.map(([command]) => command));
  });

  test('presets are saved with generated or given ids, updated, moved to, validated and removed', async () => {
    const here = { pan: -170, tilt: 80, zoom: 1 };
    const presets = (): Preset[] => [...(device.getAttribute(PTZ, 'mptzPresets') ?? [])];
    const ids = (): number[] =>
      presets()
        .map((preset) => preset.presetId)
        .toSorted((a, b) => a - b);

    // Generated ids are monotonic, a given id is used as is.
    await invoke('mptzSavePreset', { name: 'Front door' });
    expect(presets()).toEqual([{ presetId: 1, name: 'Front door', settings: here }]);
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('saved preset 1 "Front door" with the current mechanical PTZ position'));
    await invoke('mptzSavePreset', { name: 'Driveway' });
    await invoke('mptzSavePreset', { presetId: 4, name: 'Garden' });
    expect(presets()).toEqual(
      expect.arrayContaining([
        { presetId: 2, name: 'Driveway', settings: here },
        { presetId: 4, name: 'Garden', settings: here },
      ]),
    );
    // An existing id is updated with the current position.
    await move('mptzSetPosition', { pan: 10, tilt: 20, zoom: 3 });
    await invoke('mptzSavePreset', { presetId: 1, name: 'Front gate' });
    expect(presets()).toHaveLength(3);
    expect(presets()).toContainEqual({ presetId: 1, name: 'Front gate', settings: { pan: 10, tilt: 20, zoom: 3 } });
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('updated preset 1 "Front gate" with the current mechanical PTZ position'));
    // Moving to a preset.
    await move('mptzMoveToPreset', { presetId: 2 });
    expect(position()).toEqual(here);
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('moved mechanical PTZ position to preset 2 "Driveway": pan -170°, tilt 80°, zoom 1'));

    // Validation.
    for (const [command, request, message] of [
      ['mptzSavePreset', { name: 'a'.repeat(33) }, 'exceeds the maximum length of 32 characters'],
      ['mptzSavePreset', { presetId: 6, name: 'Too high' }, 'presetId 6 is outside of the supported range [1, 5]'],
      ['mptzMoveToPreset', { presetId: 3 }, 'presetId 3 is not present in mptzPresets'],
      ['mptzMoveToPreset', { presetId: 6 }, 'presetId 6 is outside of the supported range [1, 5]'],
      ['mptzRemovePreset', { presetId: 6 }, 'presetId 6 is outside of the supported range [1, 5]'],
      ['mptzRemovePreset', { presetId: 3 }, 'presetId 3 is not present in mptzPresets'],
    ] as const) {
      expect(invoke(command, request)).rejects.toThrow(message);
    }

    // Generated ids skip the ones in use (3, then 5 past the used 4), and a full list rejects a new preset.
    await invoke('mptzSavePreset', { name: 'Patio' });
    await invoke('mptzSavePreset', { name: 'Garage' });
    expect(ids()).toEqual([1, 2, 3, 4, 5]);
    expect(presets()).toEqual(
      expect.arrayContaining([
        { presetId: 3, name: 'Patio', settings: here },
        { presetId: 5, name: 'Garage', settings: here },
      ]),
    );
    expect(invoke('mptzSavePreset', { name: 'Overflow' })).rejects.toThrow('mptzPresets already holds the maximum of 5 presets');
    await invoke('mptzRemovePreset', { presetId: 3 });
    await invoke('mptzSavePreset', { presetId: 3, name: 'Refilled' });
    await invoke('mptzRemovePreset', { presetId: 5 });
    expect(ids()).toEqual([1, 2, 3, 4]);
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('removed preset 5'));
    expect(emitted.splice(0)).toEqual([
      'mptzSavePreset',
      'mptzSavePreset',
      'mptzSavePreset',
      'mptzSetPosition',
      'mptzSavePreset',
      'mptzMoveToPreset',
      'mptzSavePreset',
      'mptzSavePreset',
      'mptzRemovePreset',
      'mptzSavePreset',
      'mptzRemovePreset',
    ]);
  });

  test('a move in progress keeps MPTZPosition and rejects further moves with BUSY (§ 11.3.7.1.4)', async () => {
    vi.useFakeTimers();
    try {
      await invoke('mptzSetPosition', { pan: 30 });
      expect(device.getAttribute(PTZ, 'movementState')).toBe(Moving);
      expect(position()).toEqual({ pan: -170, tilt: 80, zoom: 1 });
      for (const [command, request] of [
        ['mptzSetPosition', { pan: 40 }],
        ['mptzRelativeMove', { panDelta: 5 }],
        ['mptzMoveToPreset', { presetId: 2 }],
      ] as const) {
        expect(invoke(command, request)).rejects.toMatchObject({ code: Status.Busy });
      }
      await advanceTimersByTimeAsync(1000, 10);
    } finally {
      vi.useRealTimers();
    }
    expect(device.getAttribute(PTZ, 'movementState')).toBe(Idle);
    expect(position()).toEqual({ pan: 30, tilt: 80, zoom: 1 });
  });

  test('dptzSetViewport and dptzRelativeMove validate and update the stream viewport (§ 11.3.7.6, § 11.3.7.7)', async () => {
    const viewportOf = (x1: number, y1: number, x2: number, y2: number): object => [{ videoStreamId: 0, viewport: { x1, y1, x2, y2 } }];
    const rejections: [Command, object, number, string][] = [
      ['dptzSetViewport', { videoStreamId: 5, viewport: { x1: 0, y1: 0, x2: 1920, y2: 1080 } }, Status.NotFound, 'video stream 5 is not present in dptzStreams'],
      [
        'dptzSetViewport',
        { videoStreamId: 0, viewport: { x1: 1, y1: 10, x2: 1, y2: 10 } },
        Status.DynamicConstraintError,
        'viewport 0x0 is smaller than the minimum viewport resolution 640x360',
      ],
      [
        'dptzSetViewport',
        { videoStreamId: 0, viewport: { x1: 0, y1: 0, x2: 1936, y2: 1089 } },
        Status.DynamicConstraintError,
        'viewport 1936x1089 at (0, 0) does not fit the sensor 1920x1080',
      ],
      [
        'dptzSetViewport',
        { videoStreamId: 0, viewport: { x1: 0, y1: 540, x2: 1920, y2: 1080 } },
        Status.DynamicConstraintError,
        'viewport 1920x540 does not match the aspect ratio of video stream 0 (1920x1080)',
      ],
      ['dptzRelativeMove', { videoStreamId: 5, zoomDelta: 50 }, Status.NotFound, 'video stream 5 is not present in dptzStreams'],
    ];
    for (const [command, request, code, message] of rejections) {
      expect(invoke(command, request)).rejects.toMatchObject({ code, message: expect.stringContaining(message) });
    }

    // [command, request, viewport after, log]
    const steps: [Command, object, object, string | undefined][] = [
      [
        'dptzSetViewport',
        { videoStreamId: 0, viewport: { x1: 640, y1: 360, x2: 1280, y2: 720 } },
        viewportOf(640, 360, 1280, 720),
        'set the viewport of video stream 0 to (640, 360)-(1280, 720)',
      ],
      [
        'dptzRelativeMove',
        { videoStreamId: 0, deltaX: 100, deltaY: 50 },
        viewportOf(740, 410, 1380, 770),
        'moved the viewport of video stream 0 by deltaX 100, deltaY 50, zoomDelta 0 to (740, 410)-(1380, 770)',
      ],
      // The upper left corner moves to the nearest point that keeps the viewport on the sensor.
      ['dptzRelativeMove', { videoStreamId: 0, deltaX: -5000, deltaY: -5000 }, viewportOf(0, 0, 640, 360), undefined],
      // A positive ZoomDelta shrinks the viewport down to MinViewportResolution, a negative one grows it up to the sensor.
      ['dptzRelativeMove', { videoStreamId: 0, zoomDelta: 100 }, viewportOf(320, 180, 960, 540), undefined],
      ['dptzRelativeMove', { videoStreamId: 0, zoomDelta: -100 }, viewportOf(0, 0, 1280, 720), undefined],
      // Rounding that widens or narrows the aspect ratio is clipped back.
      ['dptzSetViewport', { videoStreamId: 0, viewport: { x1: 0, y1: 0, x2: 1920, y2: 1080 } }, viewportOf(0, 0, 1920, 1080), undefined],
      ['dptzRelativeMove', { videoStreamId: 0, zoomDelta: -97 }, viewportOf(0, 0, 1920, 1080), undefined],
      ['dptzRelativeMove', { videoStreamId: 0, zoomDelta: -98 }, viewportOf(0, 0, 1920, 1080), undefined],
    ];
    for (const [command, request, expected, log] of steps) {
      await invoke(command, request);
      expect(dptzStreams()).toEqual(expected as DptzStream[]);
      if (log) expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining(log));
    }
    expect(emitted.splice(0)).toEqual(steps.map(([command]) => command));
  });

  test('DPTZStreams follows the global Viewport and the allocated video streams (§ 11.2.7.25)', async () => {
    await invoke('dptzSetViewport', { videoStreamId: 0, viewport: { x1: 640, y1: 360, x2: 1280, y2: 720 } });
    // A Viewport change re-bases every entry.
    await device.setAttribute(CameraAvStreamManagement, 'viewport', { x1: 0, y1: 0, x2: 1280, y2: 720 });
    expect(dptzStreams()).toEqual([{ videoStreamId: 0, viewport: { x1: 0, y1: 0, x2: 1280, y2: 720 } }]);
    // A deallocated stream drops its entry, and a Viewport change with no stream does nothing.
    await device.setAttribute(CameraAvStreamManagement, 'allocatedVideoStreams', []);
    expect(dptzStreams()).toEqual([]);
    await device.setAttribute(CameraAvStreamManagement, 'viewport', { x1: 0, y1: 0, x2: 1920, y2: 1080 });
    expect(dptzStreams()).toEqual([]);
    // A newly allocated stream gets an entry seeded with the global Viewport.
    await device.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamAllocate', videoStreamRequest(StreamUsage.LiveView, { width: 640, height: 360 }, 500_000));
    const [entry] = dptzStreams();
    expect(dptzStreams()).toHaveLength(1);
    expect(entry.viewport).toEqual({ x1: 0, y1: 0, x2: 1920, y2: 1080 });
    // Rewriting the same allocated streams keeps the entry as it is.
    await invoke('dptzSetViewport', { videoStreamId: entry.videoStreamId, viewport: { x1: 640, y1: 360, x2: 1280, y2: 720 } });
    await device.setAttribute(CameraAvStreamManagement, 'allocatedVideoStreams', device.getAttribute(CameraAvStreamManagement, 'allocatedVideoStreams') ?? []);
    expect(dptzStreams()).toEqual([{ videoStreamId: entry.videoStreamId, viewport: { x1: 640, y1: 360, x2: 1280, y2: 720 } }]);
  });

  test('with two streams an allocation keeps the surviving entry and each viewport is set on its own', async () => {
    const camera = new Camera('Ptz Camera Two Streams', 'PTZ-CAMERA-TWO-STREAMS', { ptz: true, maxConcurrentEncoders: 2 });
    expect(await addBridgedDevice(aggregator, camera, 0, 0, 0, 0)).toBeTruthy();
    const [first] = dptzStreams(camera);
    const set = async (videoStreamId: number, viewport: Viewport): Promise<unknown> => camera.invokeBehaviorCommand(PTZ, 'dptzSetViewport', { videoStreamId, viewport });
    await set(first.videoStreamId, { x1: 640, y1: 360, x2: 1280, y2: 720 });
    await camera.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamAllocate', videoStreamRequest(StreamUsage.Recording, { width: 1280, height: 720 }, 1_000_000));
    const [kept, added] = dptzStreams(camera);
    expect(dptzStreams(camera)).toHaveLength(2);
    expect(kept).toEqual({ videoStreamId: first.videoStreamId, viewport: { x1: 640, y1: 360, x2: 1280, y2: 720 } });
    expect(added.viewport).toEqual({ x1: 0, y1: 0, x2: 1920, y2: 1080 });
    await set(added.videoStreamId, { x1: 0, y1: 0, x2: 1280, y2: 720 });
    expect(dptzStreams(camera)).toEqual([
      { videoStreamId: first.videoStreamId, viewport: { x1: 640, y1: 360, x2: 1280, y2: 720 } },
      { videoStreamId: added.videoStreamId, viewport: { x1: 0, y1: 0, x2: 1280, y2: 720 } },
    ]);
  });

  test('createDefaultCameraAvSettingsUserLevelManagementClusterServer returns the endpoint', () => {
    const camera = new Camera('Camera Ptz Helper', 'CAMERA-PTZ-HELPER', { ptz: true });
    expect(
      createDefaultCameraAvSettingsUserLevelManagementClusterServer(camera, {
        panMin: -170,
        panMax: 170,
        tiltMin: -20,
        tiltMax: 90,
        zoomMax: 10,
        mptzPosition: { pan: 0, tilt: 0, zoom: 1 },
        maxPresets: 5,
      }),
    ).toBe(camera);
  });
});
