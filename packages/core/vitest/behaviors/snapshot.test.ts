/**
 * @file vitest/behaviors/snapshot.test.ts
 * @description This file contains tests for the ffmpeg-based snapshot capture pipeline.
 * @author Luca Liguori
 */

const NAME = 'Snapshot';

import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

import { setupTest } from '@matterbridge/vitest-utils';

import { hasFfmpeg, runFfmpeg } from '../../src/behaviors/ffmpeg.js';
import { captureSnapshot } from '../../src/behaviors/snapshot.js';

await setupTest(NAME);

vi.mock('../../src/behaviors/ffmpeg.js', () => ({
  hasFfmpeg: vi.fn(() => true),
  redactSource: vi.fn((source: string) => source.replace(/^([a-z][a-z\d+.-]*:\/\/)[^/]*@/i, '$1***@')),
  runFfmpeg: vi.fn(),
}));

/**
 * Creates a fake successful ffmpeg process that emits the supplied JPEG bytes.
 *
 * @param {Buffer} data - The bytes emitted on stdout.
 * @returns {ChildProcess} A minimal fake child process.
 */
function createFfmpegProcess(data: Buffer): ChildProcess {
  const process = new EventEmitter() as ChildProcess;
  process.stdout = new EventEmitter() as ChildProcess['stdout'];
  process.stderr = new EventEmitter() as ChildProcess['stderr'];
  queueMicrotask(() => {
    process.stdout?.emit('data', data);
    process.emit('close', 0);
  });
  return process;
}

describe('captureSnapshot', () => {
  beforeEach(() => {
    vi.mocked(hasFfmpeg).mockReturnValue(true);
    vi.mocked(runFfmpeg).mockReset();
  });

  it.each([
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
  ])('should reject invalid capture request %# before starting ffmpeg', async (request, expectedError) => {
    await expect(captureSnapshot(request)).rejects.toThrow(expectedError);

    expect(runFfmpeg).not.toHaveBeenCalled();
  });

  it('should reject when every captured JPEG exceeds maxBytes', async () => {
    vi.mocked(runFfmpeg).mockImplementation(() => createFfmpegProcess(Buffer.alloc(101)));

    await expect(captureSnapshot({ src: 'camera', width: 1280, height: 720, maxBytes: 100 })).rejects.toThrow('exceeds 100B at minimum quality/resolution (101B at quality 31)');

    expect(runFfmpeg).toHaveBeenCalledTimes(12);
  });

  it('should terminate ffmpeg and reject when capture times out', async () => {
    vi.useFakeTimers();
    const process = new EventEmitter() as ChildProcess;
    process.stdout = new EventEmitter() as ChildProcess['stdout'];
    process.stderr = new EventEmitter() as ChildProcess['stderr'];
    process.kill = vi.fn(() => true);
    vi.mocked(runFfmpeg).mockReturnValue(process);

    try {
      const capture = captureSnapshot({ src: 'rtsp://camera/snapshot', width: 1280, height: 720 });
      const rejection = capture.catch((error: unknown) => error);
      await vi.advanceTimersByTimeAsync(10_000);

      await expect(rejection).resolves.toEqual(expect.objectContaining({ message: expect.stringContaining('timed out after 10000ms') }));
      expect(process.kill).toHaveBeenCalledWith('SIGTERM');
      expect(process.kill).not.toHaveBeenCalledWith('SIGKILL');

      await vi.advanceTimersByTimeAsync(1_000);

      expect(process.kill).toHaveBeenCalledWith('SIGKILL');
    } finally {
      vi.useRealTimers();
    }
  });

  it('should cancel forced termination when ffmpeg closes during the timeout grace period', async () => {
    vi.useFakeTimers();
    const process = new EventEmitter() as ChildProcess;
    process.stdout = new EventEmitter() as ChildProcess['stdout'];
    process.stderr = new EventEmitter() as ChildProcess['stderr'];
    process.kill = vi.fn(() => true);
    vi.mocked(runFfmpeg).mockReturnValue(process);

    try {
      const capture = captureSnapshot({ src: 'rtsp://camera/snapshot', width: 1280, height: 720 });
      const rejection = capture.catch((error: unknown) => error);
      await vi.advanceTimersByTimeAsync(10_000);
      process.emit('close', null);
      await vi.advanceTimersByTimeAsync(1_000);

      await expect(rejection).resolves.toEqual(expect.objectContaining({ message: expect.stringContaining('timed out after 10000ms') }));
      expect(process.kill).toHaveBeenCalledWith('SIGTERM');
      expect(process.kill).not.toHaveBeenCalledWith('SIGKILL');
    } finally {
      vi.useRealTimers();
    }
  });

  it('should not increase the requested width during the fallback pass', async () => {
    vi.mocked(runFfmpeg)
      .mockImplementationOnce(() => createFfmpegProcess(Buffer.alloc(101)))
      .mockImplementationOnce(() => createFfmpegProcess(Buffer.alloc(101)))
      .mockImplementationOnce(() => createFfmpegProcess(Buffer.alloc(101)))
      .mockImplementationOnce(() => createFfmpegProcess(Buffer.alloc(101)))
      .mockImplementationOnce(() => createFfmpegProcess(Buffer.alloc(101)))
      .mockImplementationOnce(() => createFfmpegProcess(Buffer.alloc(101)))
      .mockImplementationOnce(() => createFfmpegProcess(Buffer.alloc(100)));

    const result = await captureSnapshot({ src: 'camera', width: 320, height: 240, maxBytes: 100 });

    expect(result.width).toBe(320);
    expect(result.downgraded).toBe(true);
    expect(runFfmpeg).toHaveBeenLastCalledWith(expect.arrayContaining(['scale=320:-1']));
  });

  it('should reject when ffmpeg exits successfully without producing JPEG data', async () => {
    vi.mocked(runFfmpeg).mockImplementation(() => createFfmpegProcess(Buffer.alloc(0)));

    await expect(captureSnapshot({ src: 'camera', width: 1280, height: 720 })).rejects.toThrow('produced no data');

    expect(runFfmpeg).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['linux', '/dev/video0'],
    ['darwin', '0'],
    ['win32', 'Surface Camera Front'],
  ])('should place webcam warm-up seeking after the input declaration on %s', async (platform, source) => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: platform });
    vi.mocked(runFfmpeg).mockImplementation(() => createFfmpegProcess(Buffer.alloc(100)));

    try {
      await captureSnapshot({ src: source, width: 640, height: 480 });

      const args = vi.mocked(runFfmpeg).mock.calls[0]?.[0];
      if (!args) throw new Error('ffmpeg was not called');
      expect(args.indexOf('-ss')).toBeGreaterThan(args.indexOf('-i'));
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    }
  });

  it('should reject webcam capture on an unsupported platform', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'freebsd' });

    try {
      await expect(captureSnapshot({ src: '/dev/video0', width: 640, height: 480 })).rejects.toThrow('Webcam capture via ffmpeg is not supported on platform "freebsd"');
      expect(runFfmpeg).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    }
  });

  it('should reject when ffmpeg is unavailable', async () => {
    vi.mocked(hasFfmpeg).mockReturnValue(false);

    await expect(captureSnapshot({ src: 'camera', width: 640, height: 480 })).rejects.toThrow('Cannot capture snapshot: missing dependency ffmpeg');

    expect(runFfmpeg).not.toHaveBeenCalled();
  });

  it('should include ffmpeg stderr when the process exits unsuccessfully', async () => {
    const process = new EventEmitter() as ChildProcess;
    process.stdout = new EventEmitter() as ChildProcess['stdout'];
    process.stderr = new EventEmitter() as ChildProcess['stderr'];
    vi.mocked(runFfmpeg).mockReturnValue(process);
    queueMicrotask(() => {
      process.stderr?.emit('data', Buffer.from('camera unavailable'));
      process.emit('close', 1);
    });

    await expect(captureSnapshot({ src: 'camera', width: 640, height: 480 })).rejects.toThrow('ffmpeg exited 1: camera unavailable');
  });

  it('should reject and clear timeout cleanup when the ffmpeg process emits an error', async () => {
    vi.useFakeTimers();
    const process = new EventEmitter() as ChildProcess;
    process.stdout = new EventEmitter() as ChildProcess['stdout'];
    process.stderr = new EventEmitter() as ChildProcess['stderr'];
    process.kill = vi.fn(() => true);
    vi.mocked(runFfmpeg).mockReturnValue(process);

    try {
      const capture = captureSnapshot({ src: 'camera', width: 640, height: 480 });
      const rejection = capture.catch((error: unknown) => error);
      process.emit('error', new Error('spawn failed'));
      await vi.advanceTimersByTimeAsync(11_000);

      await expect(rejection).resolves.toEqual(expect.objectContaining({ message: 'spawn failed' }));
      expect(process.kill).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('should clear forced termination when ffmpeg emits an error during the grace period', async () => {
    vi.useFakeTimers();
    const process = new EventEmitter() as ChildProcess;
    process.stdout = new EventEmitter() as ChildProcess['stdout'];
    process.stderr = new EventEmitter() as ChildProcess['stderr'];
    process.kill = vi.fn(() => true);
    vi.mocked(runFfmpeg).mockReturnValue(process);

    try {
      const capture = captureSnapshot({ src: 'camera', width: 640, height: 480 });
      const rejection = capture.catch((error: unknown) => error);
      await vi.advanceTimersByTimeAsync(10_000);
      process.emit('error', new Error('termination completed'));
      await vi.advanceTimersByTimeAsync(1_000);

      await expect(rejection).resolves.toEqual(expect.objectContaining({ message: expect.stringContaining('timed out after 10000ms') }));
      expect(process.kill).toHaveBeenCalledWith('SIGTERM');
      expect(process.kill).not.toHaveBeenCalledWith('SIGKILL');
    } finally {
      vi.useRealTimers();
    }
  });
});
