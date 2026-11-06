/**
 * @file packages/core/buntest/behaviors/snapshot.test.ts
 * @description This file contains the bun tests for snapshot.
 * @author Luca Liguori
 */

const NAME = 'Snapshot';

import { afterAll, beforeAll, beforeEach, describe, expect, mock, test, vi } from 'bun:test';
import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

import { setupTest } from '@matterbridge/test-utils/buntest/setup';

import { advanceTimersByTimeAsync } from '../bunUtils.js';

await setupTest(NAME, false);

const hasFfmpeg = vi.fn(() => true);
const runFfmpeg = vi.fn<(args: string[]) => ChildProcess>();

/**
 * Creates a fake ffmpeg process. With `data` it emits those JPEG bytes on stdout and exits 0 on the next microtask;
 * without it, it stays open, so the test drives its events.
 *
 * @param {Buffer} [data] - The bytes emitted on stdout before a successful exit.
 * @returns {ChildProcess & { kill: ReturnType<typeof vi.fn> }} A minimal fake child process.
 */
function fakeFfmpeg(data?: Buffer): ChildProcess & { kill: ReturnType<typeof vi.fn> } {
  const process = new EventEmitter() as ChildProcess & { kill: ReturnType<typeof vi.fn> };
  process.stdout = new EventEmitter() as ChildProcess['stdout'];
  process.stderr = new EventEmitter() as ChildProcess['stderr'];
  process.kill = vi.fn(() => true);
  if (data) {
    queueMicrotask(() => {
      process.stdout?.emit('data', data);
      process.emit('close', 0);
    });
  }
  return process;
}

/**
 * Runs the callback with process.platform replaced.
 *
 * @param {string} platform - The platform to report.
 * @param {() => Promise<void>} callback - The code to run.
 * @returns {Promise<void>} Resolves when the callback completes and the platform is restored.
 */
async function onPlatform(platform: string, callback: () => Promise<void>): Promise<void> {
  const originalPlatform = process.platform;
  Object.defineProperty(process, 'platform', { value: platform });
  try {
    await callback();
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  }
}

describe('captureSnapshot', () => {
  let captureSnapshot: typeof import('../../src/behaviors/snapshot.js').captureSnapshot;
  let TEST_SNAPSHOT_SOURCE: string;

  beforeAll(async () => {
    await mock.module('../../src/behaviors/ffmpeg.js', () => ({
      hasFfmpeg,
      redactSource: (source: string): string => source.replace(/^([a-z][a-z\d+.-]*:\/\/)[^/]*@/i, '$1***@'),
      runFfmpeg,
    }));
    ({ captureSnapshot, TEST_SNAPSHOT_SOURCE } = await import('../../src/behaviors/snapshot.js'));
  });

  beforeEach(() => {
    hasFfmpeg.mockReturnValue(true);
    runFfmpeg.mockReset();
  });

  afterAll(() => {
    mock.restore();
    vi.useRealTimers();
  });

  test.each([
    [{ src: '', width: 640, height: 480 }, 'Snapshot source must not be empty'],
    [{ src: '   ', width: 640, height: 480 }, 'Snapshot source must not be empty'],
    [{ src: 'camera', width: 0, height: 480 }, 'Snapshot width must be a positive integer'],
    [{ src: 'camera', width: Number.NaN, height: 480 }, 'Snapshot width must be a positive integer'],
    [{ src: 'camera', width: 640.5, height: 480 }, 'Snapshot width must be a positive integer'],
    [{ src: 'camera', width: 640, height: -1 }, 'Snapshot height must be a positive integer'],
    [{ src: 'camera', width: 640, height: Number.POSITIVE_INFINITY }, 'Snapshot height must be a positive integer'],
    [{ src: 'camera', width: 640, height: 480.5 }, 'Snapshot height must be a positive integer'],
    [{ src: 'camera', width: 640, height: 480, maxBytes: 0 }, 'Snapshot maxBytes must be a positive integer'],
    [{ src: 'camera', width: 640, height: 480, maxBytes: Number.NaN }, 'Snapshot maxBytes must be a positive integer'],
    [{ src: 'camera', width: 640, height: 480, maxBytes: 100.5 }, 'Snapshot maxBytes must be a positive integer'],
  ])('rejects invalid request %# before starting ffmpeg', (request, expectedError) => {
    expect(captureSnapshot(request)).rejects.toThrow(expectedError);
    expect(runFfmpeg).not.toHaveBeenCalled();
  });

  test('rejects before starting ffmpeg when it is unavailable or the platform has no webcam support', async () => {
    hasFfmpeg.mockReturnValue(false);
    expect(captureSnapshot({ src: 'camera', width: 640, height: 480 })).rejects.toThrow('Cannot capture snapshot: missing dependency ffmpeg');
    hasFfmpeg.mockReturnValue(true);
    await onPlatform('freebsd', async () => {
      expect(captureSnapshot({ src: '/dev/video0', width: 640, height: 480 })).rejects.toThrow('Webcam capture via ffmpeg is not supported on platform "freebsd"');
    });
    expect(runFfmpeg).not.toHaveBeenCalled();
  });

  test('downgrades quality, then resolution, until the JPEG fits maxBytes', async () => {
    // Every attempt too big: 12 attempts, then a rejection naming the last size and quality.
    runFfmpeg.mockImplementation(() => fakeFfmpeg(Buffer.alloc(101)));
    expect(captureSnapshot({ src: 'camera', width: 1280, height: 720, maxBytes: 100 })).rejects.toThrow('exceeds 100B at minimum quality/resolution (101B at quality 31)');
    expect(runFfmpeg).toHaveBeenCalledTimes(12);

    // The 7th attempt fits: the fallback pass never increases the requested width.
    runFfmpeg.mockReset();
    runFfmpeg.mockImplementation(() => fakeFfmpeg(Buffer.alloc(101)));
    for (let i = 0; i < 6; i++) runFfmpeg.mockImplementationOnce(() => fakeFfmpeg(Buffer.alloc(101)));
    runFfmpeg.mockImplementationOnce(() => fakeFfmpeg(Buffer.alloc(100)));
    expect(await captureSnapshot({ src: 'camera', width: 320, height: 240, maxBytes: 100 })).toMatchObject({ width: 320, downgraded: true });
    expect(runFfmpeg).toHaveBeenLastCalledWith(expect.arrayContaining(['scale=320:-1']));

    // The test pattern falls back to the default lavfi size.
    runFfmpeg.mockReset();
    runFfmpeg.mockImplementation(() => fakeFfmpeg(Buffer.alloc(101)));
    for (let i = 0; i < 6; i++) runFfmpeg.mockImplementationOnce(() => fakeFfmpeg(Buffer.alloc(101)));
    runFfmpeg.mockImplementationOnce(() => fakeFfmpeg(Buffer.alloc(100)));
    expect(await captureSnapshot({ src: TEST_SNAPSHOT_SOURCE, width: 1920, height: 1080, maxBytes: 100 })).toMatchObject({ width: 640, height: -1, downgraded: true });
    expect(runFfmpeg).toHaveBeenCalledTimes(7);
    expect(runFfmpeg).toHaveBeenLastCalledWith(expect.arrayContaining(['-f', 'lavfi', '-i', 'testsrc', 'scale=640:-1']));
  });

  test('generates the test pattern at the requested size without webcam warm-up', async () => {
    runFfmpeg.mockImplementation(() => fakeFfmpeg(Buffer.alloc(100)));
    expect(await captureSnapshot({ src: TEST_SNAPSHOT_SOURCE, width: 1280, height: 720 })).toMatchObject({ width: 1280, height: 720, quality: 6, downgraded: false });
    const args = runFfmpeg.mock.calls[0]?.[0] ?? [];
    const inputIndex = args.indexOf('-f');
    expect(args.slice(inputIndex, inputIndex + 4)).toEqual(['-f', 'lavfi', '-i', 'testsrc=size=1280x720']);
    expect(args).not.toContain('-ss');
    expect(args).toContain('scale=1280:720');
  });

  test.each([
    ['linux', '/dev/video0'],
    ['darwin', '0'],
    ['win32', 'Surface Camera Front'],
  ])('places the webcam warm-up seek after the input on %s', async (platform, source) => {
    runFfmpeg.mockImplementation(() => fakeFfmpeg(Buffer.alloc(100)));
    await onPlatform(platform, async () => {
      await captureSnapshot({ src: source, width: 640, height: 480 });
    });
    const args = runFfmpeg.mock.calls[0]?.[0] ?? [];
    expect(args.indexOf('-ss')).toBeGreaterThan(args.indexOf('-i'));
  });

  test('rejects on no data, on a failed exit with its stderr, and on a process error', async () => {
    runFfmpeg.mockImplementation(() => fakeFfmpeg(Buffer.alloc(0)));
    expect(captureSnapshot({ src: 'camera', width: 1280, height: 720 })).rejects.toThrow('produced no data');
    expect(runFfmpeg).toHaveBeenCalledTimes(1);

    const failed = fakeFfmpeg();
    runFfmpeg.mockReturnValue(failed);
    queueMicrotask(() => {
      failed.stderr?.emit('data', Buffer.from('camera unavailable'));
      failed.emit('close', 1);
    });
    expect(captureSnapshot({ src: 'camera', width: 640, height: 480 })).rejects.toThrow('ffmpeg exited 1: camera unavailable');
  });

  describe('timeout handling (fake timers)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    /**
     * Starts a capture on a fake process that never answers.
     *
     * @returns {{ process: ReturnType<typeof fakeFfmpeg>; rejection: Promise<unknown> }} The process and the settled capture error.
     */
    const startHangingCapture = (): { process: ReturnType<typeof fakeFfmpeg>; rejection: Promise<unknown> } => {
      const process = fakeFfmpeg();
      runFfmpeg.mockReturnValue(process);
      const rejection = captureSnapshot({ src: 'rtsp://camera/snapshot', width: 1280, height: 720 }).catch((error: unknown) => error);
      return { process, rejection };
    };
    const timedOut = expect.objectContaining({ message: expect.stringContaining('timed out after 10000ms') });

    test('terminates with SIGTERM after 10 s, then SIGKILL after the 1 s grace period', async () => {
      const { process, rejection } = startHangingCapture();
      await advanceTimersByTimeAsync(10_000);
      expect(await rejection).toEqual(timedOut);
      expect(process.kill).toHaveBeenCalledWith('SIGTERM');
      expect(process.kill).not.toHaveBeenCalledWith('SIGKILL');
      await advanceTimersByTimeAsync(1_000);
      expect(process.kill).toHaveBeenCalledWith('SIGKILL');
      vi.useRealTimers();
    });

    test.each(['close', 'error'] as const)('a %s during the grace period cancels the SIGKILL', async (event) => {
      const { process, rejection } = startHangingCapture();
      await advanceTimersByTimeAsync(10_000);
      if (event === 'close') process.emit('close', null);
      else process.emit('error', new Error('termination completed'));
      await advanceTimersByTimeAsync(1_000);
      expect(await rejection).toEqual(timedOut);
      expect(process.kill).toHaveBeenCalledWith('SIGTERM');
      expect(process.kill).not.toHaveBeenCalledWith('SIGKILL');
      vi.useRealTimers();
    });

    test('a process error before the timeout rejects and clears the timeout', async () => {
      const { process, rejection } = startHangingCapture();
      process.emit('error', new Error('spawn failed'));
      await advanceTimersByTimeAsync(11_000);
      expect(await rejection).toEqual(expect.objectContaining({ message: 'spawn failed' }));
      expect(process.kill).not.toHaveBeenCalled();
      vi.useRealTimers();
    });
  });
});
