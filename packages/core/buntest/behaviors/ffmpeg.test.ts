/**
 * @file packages/core/buntest/behaviors/ffmpeg.test.ts
 * @description This file contains the bun tests for ffmpeg.
 * @author Luca Liguori
 */

const NAME = 'Ffmpeg';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, test, vi } from 'bun:test';
import type { ChildProcess, SpawnSyncReturns } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { loggerDebugSpy, setupTest } from '@matterbridge/test-utils/buntest/setup';

import { waitFor } from '../bunUtils.js';

await setupTest(NAME, false);

type FfmpegModule = typeof import('../../src/behaviors/ffmpeg.js');
const spawnMock = vi.fn<(command: string, args?: readonly string[], options?: object) => ChildProcess>();
const spawnSyncMock = vi.fn<(command: string, args?: readonly string[], options?: object) => SpawnSyncReturns<Buffer>>();

/**
 * Builds a fake child process that emits `exit` with the code, or `error`, on the next microtask.
 *
 * @param {number | Error} outcome - The exit code, or the error to emit.
 * @returns {ChildProcess} The fake child process.
 */
function fakeChild(outcome: number | Error): ChildProcess {
  const child = new EventEmitter();
  queueMicrotask(() => (outcome instanceof Error ? child.emit('error', outcome) : child.emit('exit', outcome)));
  return child as ChildProcess;
}

/**
 * Builds a fake spawnSync result.
 *
 * @param {number | Error} outcome - The exit status, or the spawn error.
 * @returns {SpawnSyncReturns<Buffer>} The fake result.
 */
function fakeSync(outcome: number | Error): SpawnSyncReturns<Buffer> {
  return (outcome instanceof Error ? { status: null, error: outcome } : { status: outcome }) as SpawnSyncReturns<Buffer>;
}

/**
 * Builds a fake child process that prints the listing on a stream, then closes.
 *
 * @param {string} text - The listing.
 * @param {'stdout' | 'stderr'} [stream] - The stream to print on (default stderr, as ffmpeg does).
 * @returns {ChildProcess} The fake child process.
 */
function fakeListing(text: string, stream: 'stdout' | 'stderr' = 'stderr'): ChildProcess {
  const child = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter() });
  setTimeout(() => {
    child[stream].emit('data', Buffer.from(text));
    child.emit('close', 1);
  }, 0);
  return child as unknown as ChildProcess;
}

let generation = 0;
/**
 * Imports a fresh instance of the ffmpeg module, which resolves ffmpeg once at load. Bun has no vi.resetModules():
 * a unique query string makes it load the module again.
 *
 * @param {string} [platform] - The platform to report after the load.
 * @returns {Promise<FfmpegModule>} The fresh module.
 */
async function fresh(platform?: string): Promise<FfmpegModule> {
  const specifier = `../../src/behaviors/ffmpeg.js?fresh=${++generation}`;
  const module = (await import(specifier)) as FfmpegModule;
  if (platform) Object.defineProperty(process, 'platform', { value: platform });
  return module;
}

/**
 * Runs the callback in a temporary directory, removed afterwards.
 *
 * @param {(dir: string) => Promise<void>} callback - The code to run.
 * @returns {Promise<void>} Resolves once the directory is removed.
 */
async function inTempDir(callback: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(path.join(tmpdir(), 'matterbridge-ffmpeg-'));
  try {
    await callback(dir);
  } finally {
    await rm(dir, { force: true, recursive: true });
  }
}

/**
 * Creates an empty executable file, with its parent directories.
 *
 * @param {string} file - The file to create.
 * @returns {Promise<void>} Resolves once created.
 */
async function touchExecutable(file: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, '', { mode: 0o755 });
}

const originalEnv = { PATH: process.env.PATH, LOCALAPPDATA: process.env.LOCALAPPDATA, ProgramFiles: process.env.ProgramFiles, ProgramFilesX86: process.env['ProgramFiles(x86)'] };
const originalPlatform = process.platform;
const originalGetuid = process.getuid;

/**
 * Empties every ffmpeg search location of the host.
 *
 * @returns {void}
 */
function clearSearchPath(): void {
  process.env.PATH = '';
  delete process.env.LOCALAPPDATA;
  process.env.ProgramFiles = '';
  process.env['ProgramFiles(x86)'] = '';
}

beforeAll(async () => {
  const actual = await import('node:child_process');
  await mock.module('node:child_process', () => ({ ...actual, spawn: spawnMock, spawnSync: spawnSyncMock }));
});

beforeEach(() => {
  spawnMock.mockReset();
  spawnSyncMock.mockReset();
  spawnSyncMock.mockImplementation(() => fakeSync(0));
});

afterEach(() => {
  process.env.PATH = originalEnv.PATH;
  process.env.ProgramFiles = originalEnv.ProgramFiles;
  process.env['ProgramFiles(x86)'] = originalEnv.ProgramFilesX86;
  if (originalEnv.LOCALAPPDATA === undefined) delete process.env.LOCALAPPDATA;
  else process.env.LOCALAPPDATA = originalEnv.LOCALAPPDATA;
  Object.defineProperty(process, 'platform', { value: originalPlatform });
  process.getuid = originalGetuid;
});

afterAll(() => {
  mock.restore();
});

describe('ffmpeg resolution', () => {
  test('a working bare command resolves, and runFfmpeg spawns it and logs how it ended', async () => {
    const { hasFfmpeg, runFfmpeg } = await fresh();
    expect(hasFfmpeg()).toBe(true);
    spawnMock.mockImplementation(() => fakeChild(0));
    runFfmpeg(['-version']);
    expect(spawnMock).toHaveBeenCalledWith('ffmpeg', ['-version']);
    await waitFor(() => loggerDebugSpy.mock.calls.some(([message]) => message.includes('exited with code 0')));

    const child = Object.assign(new EventEmitter(), { pid: 4321 });
    spawnMock.mockImplementation(() => child as unknown as ChildProcess);
    runFfmpeg(['-version']);
    child.emit('exit', null, 'SIGTERM');
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining('ffmpeg process 4321 exited with signal SIGTERM'));
  });

  test.each([
    ['every probe fails to spawn', (): SpawnSyncReturns<Buffer> => fakeSync(new Error('spawn ENOENT'))],
    ['every probe exits non-zero', (): SpawnSyncReturns<Buffer> => fakeSync(1)],
    ['every probe is killed by a signal', (): SpawnSyncReturns<Buffer> => ({ status: null, signal: 'SIGKILL' }) as unknown as SpawnSyncReturns<Buffer>],
    [
      'spawnSync throws',
      (): SpawnSyncReturns<Buffer> => {
        throw new Error('EACCES');
      },
    ],
  ])('nothing resolves when %s, and runFfmpeg throws', async (_label, probe) => {
    clearSearchPath();
    spawnSyncMock.mockImplementation(probe);
    const { hasFfmpeg, runFfmpeg } = await fresh('linux');
    expect(hasFfmpeg()).toBe(false);
    expect(() => runFfmpeg(['-version'])).toThrow('Cannot run ffmpeg: not found on this host');
  });

  test('a probe falls back to -version when --version fails, as real ffmpeg requires', async () => {
    clearSearchPath();
    Object.defineProperty(process, 'platform', { value: 'linux' });
    spawnSyncMock.mockImplementation((_command, args) => fakeSync(args?.includes('-version') ? 0 : new Error('unknown option --version')));
    expect((await fresh()).hasFfmpeg()).toBe(true);
  });

  test('the --debug CLI parameter loads the module with DEBUG logging', async () => {
    process.argv.push('--debug');
    try {
      expect((await fresh()).hasFfmpeg).toBeDefined();
    } finally {
      process.argv.pop();
    }
  });

  test('on macOS the Homebrew ffmpeg, outside the PATH of a launchd service, is probed', async () => {
    process.env.PATH = '';
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    spawnSyncMock.mockImplementation(() => fakeSync(new Error('spawn ENOENT')));
    expect((await fresh()).hasFfmpeg()).toBe(false);
    // Depending on the host the file is missing or present and rejected.
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringMatching(/^Candidate \/opt\/homebrew\/bin\/ffmpeg (is not accessible|did not run successfully)$/));
  });

  test('on Windows the winget Gyan.FFmpeg bin and the Program Files installs are probed', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    clearSearchPath();
    // The winget package bin directory.
    await inTempDir(async (localAppData) => {
      const expectedBin = path.join(
        localAppData,
        'Microsoft',
        'WinGet',
        'Packages',
        'Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe',
        'ffmpeg-8.1.2-full_build',
        'bin',
        'ffmpeg.exe',
      );
      await touchExecutable(expectedBin);
      process.env.LOCALAPPDATA = localAppData;
      spawnSyncMock.mockImplementation((command) => fakeSync(command === expectedBin ? 0 : new Error('spawn ENOENT')));
      expect((await fresh()).hasFfmpeg()).toBe(true);
      expect(spawnSyncMock).toHaveBeenCalledWith(expectedBin, expect.any(Array), expect.anything());
    });
    // Unrelated packages and a Gyan package without a version directory are ignored.
    await inTempDir(async (localAppData) => {
      const packages = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
      await mkdir(path.join(packages, 'Other.Package_Microsoft.Winget.Source_8wekyb3d8bbwe'), { recursive: true });
      await mkdir(path.join(packages, 'Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe', 'metadata'), { recursive: true });
      process.env.LOCALAPPDATA = localAppData;
      spawnSyncMock.mockImplementation(() => fakeSync(new Error('spawn ENOENT')));
      expect((await fresh()).hasFfmpeg()).toBe(false);
    });
    // Without winget, the Program Files install.
    delete process.env.LOCALAPPDATA;
    await inTempDir(async (programFiles) => {
      const expectedBin = path.join(programFiles, 'ffmpeg', 'bin', 'ffmpeg.exe');
      await touchExecutable(expectedBin);
      process.env.ProgramFiles = programFiles;
      spawnSyncMock.mockImplementation((command) => fakeSync(command === expectedBin ? 0 : new Error('spawn ENOENT')));
      expect((await fresh()).hasFfmpeg()).toBe(true);
    });
  });
});

describe('redactSource and the webcam listing parsers', () => {
  test.each([
    ['rtsp://admin:password@camera.local/stream', 'rtsp://***@camera.local/stream'],
    ['RTSP://admin@camera.local/stream', 'RTSP://***@camera.local/stream'],
    ['rtsp://camera.local/stream', 'rtsp://camera.local/stream'],
    ['/dev/video0', '/dev/video0'],
    ['Surface Camera Front', 'Surface Camera Front'],
  ])('redactSource(%s)', async (source, expected) => {
    const { redactSource } = await import('../../src/behaviors/ffmpeg.js');
    expect(redactSource(source)).toBe(expected);
  });

  test('avfoundation, dshow and v4l2 listings yield only the webcams', async () => {
    const { parseAvfoundationWebcams, parseDshowWebcams, parseV4l2Webcams } = await import('../../src/behaviors/ffmpeg.js');
    expect(
      parseAvfoundationWebcams(
        [
          '[AVFoundation indev @ 0x1] AVFoundation video devices:',
          '[AVFoundation indev @ 0x1] [0] FaceTime HD Camera',
          '[AVFoundation indev @ 0x1] [1] Capture screen 0',
          '[AVFoundation indev @ 0x1] AVFoundation audio devices:',
          '[AVFoundation indev @ 0x1] [0] MacBook Pro Microphone',
        ].join('\n'),
      ),
    ).toEqual(['FaceTime HD Camera']);
    // dshow with the device type tags, then with the legacy section headers.
    expect(
      parseDshowWebcams(['[dshow @ 0x1] "Integrated Camera" (video)', '[dshow @ 0x1]   Alternative name "@device_pnp_x"', '[dshow @ 0x1] "Microphone Array" (audio)'].join('\n')),
    ).toEqual(['Integrated Camera']);
    expect(
      parseDshowWebcams(['[dshow @ 0x1] DirectShow video devices', '[dshow @ 0x1]  "USB Camera"', '[dshow @ 0x1] DirectShow audio devices', '[dshow @ 0x1]  "Mic"'].join('\n')),
    ).toEqual(['USB Camera']);
    // v4l2 keeps the lowest numbered node of each camera.
    expect(
      parseV4l2Webcams(
        [
          'Auto-detected sources for video4linux2,v4l2:',
          '  /dev/video3 [Luca iPhone Camera: Luca] (none)',
          '  /dev/video2 [Luca iPhone Camera: Luca] (none)',
          '  /dev/video1 [MacBook Pro Camera: MacBook Pro] (none)',
          '  /dev/video0 [MacBook Pro Camera: MacBook Pro] (none)',
          '  /dev/video10 [Other Camera: usb-1] (none)',
          '  /dev/video11 [Other Camera: usb-1] (none)',
        ].join('\n'),
      ),
    ).toEqual(['/dev/video0', '/dev/video2', '/dev/video10']);
  });
});

describe('listWebcams and playWebcam', () => {
  test.each([
    [
      'darwin',
      ['-hide_banner', '-f', 'avfoundation', '-list_devices', 'true', '-i', ''],
      '[AVFoundation indev @ 0x1] AVFoundation video devices:\n[AVFoundation indev @ 0x1] [0] FaceTime HD Camera\n',
      'stderr',
      ['FaceTime HD Camera'],
    ],
    ['win32', ['-hide_banner', '-list_devices', 'true', '-f', 'dshow', '-i', 'dummy'], '[dshow @ 0x1] "Integrated Camera" (video)\n', 'stderr', ['Integrated Camera']],
    [
      'linux',
      ['-hide_banner', '-sources', 'v4l2'],
      'Auto-detected sources for video4linux2,v4l2:\n  /dev/video1 [Cam: bus] (none)\n  /dev/video0 [Cam: bus] (none)\n',
      'stdout',
      ['/dev/video0'],
    ],
  ] as const)('listWebcams on %s runs the matching ffmpeg command', async (platform, args, listing, stream, expected) => {
    const { listWebcams } = await fresh(platform);
    spawnMock.mockImplementation(() => fakeListing(listing, stream));
    expect(await listWebcams()).toEqual([...expected]);
    expect(spawnMock).toHaveBeenCalledWith('ffmpeg', [...args]);
    // An ffmpeg that cannot be spawned rejects.
    spawnMock.mockImplementation(() => fakeChild(new Error('spawn ENOENT')));
    expect(listWebcams()).rejects.toThrow('spawn ENOENT');
  });

  test.each([
    ['darwin', 'Cam', undefined, ['-hide_banner', '-window_title', 'Cam', '-f', 'avfoundation', '-framerate', '30', '-i', 'Cam']],
    ['darwin', 'Cam', 'Mic', ['-hide_banner', '-window_title', 'Cam', '-f', 'avfoundation', '-framerate', '30', '-i', 'Cam:Mic']],
    ['win32', 'Cam', undefined, ['-hide_banner', '-window_title', 'Cam', '-f', 'dshow', '-i', 'video=Cam']],
    ['win32', 'Cam', 'Mic', ['-hide_banner', '-window_title', 'Cam', '-f', 'dshow', '-i', 'video=Cam:audio=Mic']],
    ['linux', '/dev/video0', 'Mic', ['-hide_banner', '-window_title', '/dev/video0', '-f', 'v4l2', '-i', '/dev/video0']],
  ])('getPlayWebcamArgs on %s for %s and %s', async (platform, video, audio, expected) => {
    const { getPlayWebcamArgs } = await import('../../src/behaviors/ffmpeg.js');
    Object.defineProperty(process, 'platform', { value: platform });
    expect(getPlayWebcamArgs(video, audio)).toEqual(expected);
  });

  test('playWebcam spawns ffplay from the PATH, or next to an absolute ffmpeg, and throws without ffmpeg', async () => {
    const { playWebcam } = await fresh('linux');
    spawnMock.mockImplementation(() => fakeChild(0));
    playWebcam('/dev/video0');
    expect(spawnMock).toHaveBeenCalledWith('ffplay', ['-hide_banner', '-window_title', '/dev/video0', '-f', 'v4l2', '-i', '/dev/video0']);

    await inTempDir(async (dir) => {
      const ffmpegPath = path.join(dir, 'ffmpeg', 'bin', 'ffmpeg.exe');
      await touchExecutable(ffmpegPath);
      clearSearchPath();
      process.env.ProgramFiles = dir;
      Object.defineProperty(process, 'platform', { value: 'win32' });
      // Only the fake install runs, so a real ffmpeg of the host is never picked.
      spawnSyncMock.mockImplementation((command) => fakeSync(command === ffmpegPath ? 0 : new Error('spawn ENOENT')));
      const module = await fresh();
      spawnMock.mockClear();
      module.playWebcam('Cam', 'Mic');
      expect(spawnMock).toHaveBeenCalledWith(path.join(path.dirname(ffmpegPath), 'ffplay.exe'), expect.arrayContaining(['dshow', 'video=Cam:audio=Mic']));
    });

    process.env.PATH = '';
    spawnSyncMock.mockImplementation(() => fakeSync(new Error('spawn ENOENT')));
    const missing = await fresh();
    expect(() => missing.playWebcam('Cam')).toThrow('Cannot play the webcam: ffmpeg not found on this host');
  });
});

describe('installFfmpeg', () => {
  /**
   * Loads a fresh module where ffmpeg is not found, as the given platform and user.
   *
   * @param {string} platform - The platform.
   * @param {number} uid - The user id.
   * @returns {Promise<FfmpegModule>} The fresh module.
   */
  async function load(platform: string, uid: number): Promise<FfmpegModule> {
    spawnSyncMock.mockImplementation(() => fakeSync(new Error('spawn ENOENT')));
    spawnMock.mockImplementation(() => fakeChild(new Error('spawn ENOENT')));
    const module = await fresh(platform);
    process.getuid = (): number => uid;
    spawnMock.mockClear();
    spawnSyncMock.mockClear();
    return module;
  }

  /**
   * Simulates a host where the given commands run, and where ffmpeg runs once the install command has been spawned.
   *
   * @param {string[]} available - The commands that run successfully.
   * @param {(command: string, args: readonly string[]) => boolean} isInstall - Recognises the spawn that installs ffmpeg.
   * @param {number} [installExit] - The exit code of the installing spawns (default 0).
   * @param {boolean} [resolvesAfter] - Whether ffmpeg runs after the install (default true).
   * @returns {void}
   */
  function host(available: string[], isInstall: (command: string, args: readonly string[]) => boolean, installExit = 0, resolvesAfter = true): void {
    let installed = false;
    spawnSyncMock.mockImplementation((command) => fakeSync(available.includes(command) || (command === 'ffmpeg' && installed && resolvesAfter) ? 0 : new Error('spawn ENOENT')));
    spawnMock.mockImplementation((command, args = []) => {
      if (isInstall(command, args)) installed = true;
      return fakeChild(available.includes(command) ? installExit : new Error('spawn ENOENT'));
    });
  }

  test('no install outside linux, or without root and passwordless sudo, or without a package manager', async () => {
    expect(await (await load('darwin', 0)).installFfmpeg()).toBe(false);
    expect(spawnSyncMock).not.toHaveBeenCalled();
    expect(await (await load('linux', 1000)).installFfmpeg()).toBe(false);
    expect(spawnSyncMock).toHaveBeenCalledWith('sudo', ['-n', 'true'], expect.anything());
    expect(spawnMock).not.toHaveBeenCalled();
    expect(await (await load('linux', 0)).installFfmpeg()).toBe(false);
    expect(spawnSyncMock).not.toHaveBeenCalledWith('apk', ['add', '--no-cache', 'ffmpeg'], expect.anything());
  });

  test('as root apk and apt-get install ffmpeg with the async spawn, and it resolves again', async () => {
    const apk = await load('linux', 0);
    expect(apk.hasFfmpeg()).toBe(false);
    host(['apk'], (command, args) => command === 'apk' && args[0] === 'add');
    expect(await apk.installFfmpeg()).toBe(true);
    expect(apk.hasFfmpeg()).toBe(true);
    expect(spawnMock).toHaveBeenCalledWith('apk', ['add', '--no-cache', 'ffmpeg'], expect.anything());
    // The package manager never runs through spawnSync.
    expect(spawnSyncMock).not.toHaveBeenCalledWith('apk', ['add', '--no-cache', 'ffmpeg'], expect.anything());

    const apt = await load('linux', 0);
    host(['apt-get', 'env'], (command, args) => command === 'env' && args.includes('install'));
    expect(await apt.installFfmpeg()).toBe(true);
    expect(apt.hasFfmpeg()).toBe(true);
    expect(spawnMock).toHaveBeenCalledWith('apt-get', ['update'], expect.anything());
    expect(spawnMock).toHaveBeenCalledWith('env', ['DEBIAN_FRONTEND=noninteractive', 'apt-get', 'install', '-y', '--no-install-recommends', 'ffmpeg'], expect.anything());
  });

  test('without root apk and apt-get install through passwordless sudo', async () => {
    const apk = await load('linux', 1000);
    host(['sudo', 'apk'], (command, args) => command === 'sudo' && args.includes('add'));
    expect(await apk.installFfmpeg()).toBe(true);
    expect(apk.hasFfmpeg()).toBe(true);
    expect(spawnMock).toHaveBeenCalledWith('sudo', ['-n', 'apk', 'add', '--no-cache', 'ffmpeg'], expect.anything());
    expect(spawnMock).not.toHaveBeenCalledWith('apk', expect.anything(), expect.anything());

    const apt = await load('linux', 1000);
    host(['sudo', 'apt-get'], (command, args) => command === 'sudo' && args.includes('install'));
    expect(await apt.installFfmpeg()).toBe(true);
    expect(apt.hasFfmpeg()).toBe(true);
    expect(spawnMock).toHaveBeenCalledWith('sudo', ['-n', 'apt-get', 'update'], expect.anything());
    expect(spawnMock).toHaveBeenCalledWith(
      'sudo',
      ['-n', 'env', 'DEBIAN_FRONTEND=noninteractive', 'apt-get', 'install', '-y', '--no-install-recommends', 'ffmpeg'],
      expect.anything(),
    );
  });

  test.each([
    ['the install fails', 1, false],
    ['ffmpeg is installed but still cannot be resolved', 0, false],
  ])('installFfmpeg returns false when %s', async (_label, installExit, resolvesAfter) => {
    const module = await load('linux', 0);
    host(['apk'], (command) => command === 'apk', installExit, resolvesAfter);
    expect(await module.installFfmpeg()).toBe(false);
    expect(module.hasFfmpeg()).toBe(false);
  });
});
