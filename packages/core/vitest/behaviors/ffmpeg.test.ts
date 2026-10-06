/**
 * @file packages/core/vitest/behaviors/ffmpeg.test.ts
 * @description This file contains the tests for the ffmpeg binary resolution helpers.
 * @author Luca Liguori
 */

const NAME = 'Ffmpeg';

import { spawn as realSpawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { setupTest } from '@matterbridge/test-utils/vitest';

// Setup the test environment
await setupTest(NAME, false);

vi.mock('node:child_process', async () => {
  const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process');
  return { ...actual, spawn: vi.fn() };
});

const spawnMock = vi.mocked(realSpawn);

/**
 * Builds a fake ChildProcess-like EventEmitter that asynchronously emits either `exit` (with the given code) or
 * `error`, mimicking the shape `isRunnable`/`runFfmpeg` react to.
 *
 * @param {number | Error} outcome - The exit code to emit, or an `Error` to emit as an `error` event.
 * @returns {EventEmitter} The fake child process.
 */
function fakeChild(outcome: number | Error): EventEmitter {
  const child = new EventEmitter();
  queueMicrotask(() => {
    if (outcome instanceof Error) child.emit('error', outcome);
    else child.emit('exit', outcome);
  });
  return child;
}

describe('ffmpeg resolution at module load', () => {
  const originalPath = process.env.PATH;
  const originalLocalAppData = process.env.LOCALAPPDATA;
  const originalProgramFiles = process.env.ProgramFiles;
  const originalProgramFilesX86 = process.env['ProgramFiles(x86)'];
  const originalPlatform = process.platform;

  beforeEach(() => {
    spawnMock.mockReset();
  });

  afterEach(() => {
    process.env.PATH = originalPath;
    if (originalLocalAppData === undefined) delete process.env.LOCALAPPDATA;
    else process.env.LOCALAPPDATA = originalLocalAppData;
    process.env.ProgramFiles = originalProgramFiles;
    process.env['ProgramFiles(x86)'] = originalProgramFilesX86;
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('should resolve ffmpeg and let runFfmpeg spawn it when the bare command runs successfully', async () => {
    spawnMock.mockImplementation(() => fakeChild(0) as ReturnType<typeof realSpawn>);

    vi.resetModules();
    const { hasFfmpeg, runFfmpeg } = await import('../../src/behaviors/ffmpeg.js');

    expect(hasFfmpeg()).toBe(true);
    spawnMock.mockClear();
    runFfmpeg(['-version']);
    expect(spawnMock).toHaveBeenCalledWith('ffmpeg', ['-version']);
  });

  it('should not resolve ffmpeg when no candidate runs successfully, and runFfmpeg should throw', async () => {
    process.env.PATH = '';
    delete process.env.LOCALAPPDATA;
    process.env.ProgramFiles = '';
    process.env['ProgramFiles(x86)'] = '';
    spawnMock.mockImplementation(() => fakeChild(new Error('spawn ENOENT')) as ReturnType<typeof realSpawn>);

    vi.resetModules();
    const { hasFfmpeg, runFfmpeg } = await import('../../src/behaviors/ffmpeg.js');

    expect(hasFfmpeg()).toBe(false);
    expect(() => runFfmpeg(['-version'])).toThrow('Cannot run ffmpeg: not found on this host');
  });

  it('should fall back to the -version switch when --version fails, matching real ffmpeg', async () => {
    process.env.PATH = '';
    delete process.env.LOCALAPPDATA;
    process.env.ProgramFiles = '';
    process.env['ProgramFiles(x86)'] = '';
    Object.defineProperty(process, 'platform', { value: 'linux' });
    spawnMock.mockImplementation(
      (_command, args) => fakeChild((args as string[]).includes('-version') ? 0 : new Error('unknown option --version')) as ReturnType<typeof realSpawn>,
    );

    vi.resetModules();
    const { hasFfmpeg } = await import('../../src/behaviors/ffmpeg.js');

    expect(hasFfmpeg()).toBe(true);
  });

  it('should reject a candidate whose process exits with a non-zero code and keep trying the next one', async () => {
    process.env.PATH = '';
    delete process.env.LOCALAPPDATA;
    process.env.ProgramFiles = '';
    process.env['ProgramFiles(x86)'] = '';
    Object.defineProperty(process, 'platform', { value: 'linux' });
    spawnMock.mockImplementation(() => fakeChild(1) as ReturnType<typeof realSpawn>);

    vi.resetModules();
    const { hasFfmpeg } = await import('../../src/behaviors/ffmpeg.js');

    expect(hasFfmpeg()).toBe(false);
  });

  it('should include the winget Gyan.FFmpeg package bin path on Windows', async () => {
    const localAppData = await mkdtemp(path.join(tmpdir(), 'matterbridge-ffmpeg-'));
    const wingetPackage = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages', 'Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe', 'ffmpeg-8.1.2-full_build');
    const expectedBin = path.join(wingetPackage, 'bin', 'ffmpeg.exe');
    await mkdir(path.join(wingetPackage, 'bin'), { recursive: true });
    // access(X_OK) only gates forward-slash candidates (real Windows path.join uses backslashes and skips it), but
    // CI runners on Linux/macOS join paths with '/' even with process.platform spoofed to 'win32', so the file must
    // actually exist there too.
    await writeFile(expectedBin, '', { mode: 0o755 });
    Object.defineProperty(process, 'platform', { value: 'win32' });
    process.env.LOCALAPPDATA = localAppData;
    process.env.PATH = '';
    process.env.ProgramFiles = '';
    process.env['ProgramFiles(x86)'] = '';
    spawnMock.mockImplementation((command) => fakeChild(command === expectedBin ? 0 : new Error('spawn ENOENT')) as ReturnType<typeof realSpawn>);

    try {
      vi.resetModules();
      const { hasFfmpeg } = await import('../../src/behaviors/ffmpeg.js');

      expect(hasFfmpeg()).toBe(true);
      expect(spawnMock).toHaveBeenCalledWith(expectedBin, expect.any(Array), expect.anything());
    } finally {
      await rm(localAppData, { force: true, recursive: true });
    }
  });

  it('should ignore unrelated winget package entries and Gyan packages without ffmpeg version directories on Windows', async () => {
    const localAppData = await mkdtemp(path.join(tmpdir(), 'matterbridge-ffmpeg-'));
    const wingetPackages = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
    await mkdir(path.join(wingetPackages, 'Other.Package_Microsoft.Winget.Source_8wekyb3d8bbwe'), { recursive: true });
    await mkdir(path.join(wingetPackages, 'Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe', 'metadata'), { recursive: true });
    Object.defineProperty(process, 'platform', { value: 'win32' });
    process.env.LOCALAPPDATA = localAppData;
    process.env.PATH = '';
    process.env.ProgramFiles = '';
    process.env['ProgramFiles(x86)'] = '';
    spawnMock.mockImplementation(() => fakeChild(new Error('spawn ENOENT')) as ReturnType<typeof realSpawn>);

    try {
      vi.resetModules();
      const { hasFfmpeg } = await import('../../src/behaviors/ffmpeg.js');

      expect(hasFfmpeg()).toBe(false);
    } finally {
      await rm(localAppData, { force: true, recursive: true });
    }
  });

  it('should fall back to the Program Files install locations on Windows when winget is not present', async () => {
    const programFiles = await mkdtemp(path.join(tmpdir(), 'matterbridge-ffmpeg-'));
    const expectedBin = path.join(programFiles, 'ffmpeg', 'bin', 'ffmpeg.exe');
    await mkdir(path.dirname(expectedBin), { recursive: true });
    await writeFile(expectedBin, '', { mode: 0o755 });
    Object.defineProperty(process, 'platform', { value: 'win32' });
    delete process.env.LOCALAPPDATA;
    process.env.PATH = '';
    process.env.ProgramFiles = programFiles;
    process.env['ProgramFiles(x86)'] = '';
    spawnMock.mockImplementation((command) => fakeChild(command === expectedBin ? 0 : new Error('spawn ENOENT')) as ReturnType<typeof realSpawn>);

    try {
      vi.resetModules();
      const { hasFfmpeg } = await import('../../src/behaviors/ffmpeg.js');

      expect(hasFfmpeg()).toBe(true);
    } finally {
      await rm(programFiles, { force: true, recursive: true });
    }
  });
});

describe('redactSource', () => {
  it.each([
    ['rtsp://admin:password@camera.local/stream', 'rtsp://***@camera.local/stream'],
    ['RTSP://admin@camera.local/stream', 'RTSP://***@camera.local/stream'],
    ['rtsp://camera.local/stream', 'rtsp://camera.local/stream'],
    ['/dev/video0', '/dev/video0'],
    ['Surface Camera Front', 'Surface Camera Front'],
  ])('should redact URL user information in %s', async (source, expected) => {
    const { redactSource } = await import('../../src/behaviors/ffmpeg.js');

    expect(redactSource(source)).toBe(expected);
  });
});

describe('webcam discovery', () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    spawnMock.mockReset();
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  /**
   * Builds a fake ChildProcess-like EventEmitter that emits the given text on the given stream and then `close`.
   *
   * @param {string} text - The text to emit.
   * @param {'stdout' | 'stderr'} [stream] - The stream to emit the text on.
   * @returns {EventEmitter} The fake child process.
   */
  function fakeListing(text: string, stream: 'stdout' | 'stderr' = 'stderr'): EventEmitter {
    const child = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    setTimeout(() => {
      child[stream].emit('data', Buffer.from(text));
      child.emit('close', 1);
    }, 0);
    return child;
  }

  it('should parse the avfoundation webcams and skip the screens and the audio devices', async () => {
    const { parseAvfoundationWebcams } = await import('../../src/behaviors/ffmpeg.js');
    const output = [
      '[AVFoundation indev @ 0x1] AVFoundation video devices:',
      '[AVFoundation indev @ 0x1] [0] FaceTime HD Camera',
      '[AVFoundation indev @ 0x1] [1] Capture screen 0',
      '[AVFoundation indev @ 0x1] AVFoundation audio devices:',
      '[AVFoundation indev @ 0x1] [0] MacBook Pro Microphone',
    ].join('\n');

    expect(parseAvfoundationWebcams(output)).toEqual(['FaceTime HD Camera']);
  });

  it('should parse the dshow webcams with the device type tags', async () => {
    const { parseDshowWebcams } = await import('../../src/behaviors/ffmpeg.js');
    const output = ['[dshow @ 0x1] "Integrated Camera" (video)', '[dshow @ 0x1]   Alternative name "@device_pnp_x"', '[dshow @ 0x1] "Microphone Array" (audio)'].join('\n');

    expect(parseDshowWebcams(output)).toEqual(['Integrated Camera']);
  });

  it('should parse the dshow webcams with the legacy section headers', async () => {
    const { parseDshowWebcams } = await import('../../src/behaviors/ffmpeg.js');
    const output = ['[dshow @ 0x1] DirectShow video devices', '[dshow @ 0x1]  "USB Camera"', '[dshow @ 0x1] DirectShow audio devices', '[dshow @ 0x1]  "Mic"'].join('\n');

    expect(parseDshowWebcams(output)).toEqual(['USB Camera']);
  });

  it('should list the webcams with the avfoundation ffmpeg command on macOS', async () => {
    spawnMock.mockImplementation(() => fakeChild(0) as ReturnType<typeof realSpawn>);
    vi.resetModules();
    const { listWebcams } = await import('../../src/behaviors/ffmpeg.js');
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    spawnMock.mockReset();
    spawnMock.mockImplementation(
      () => fakeListing('[AVFoundation indev @ 0x1] AVFoundation video devices:\n[AVFoundation indev @ 0x1] [0] FaceTime HD Camera\n') as ReturnType<typeof realSpawn>,
    );

    expect(await listWebcams()).toEqual(['FaceTime HD Camera']);
    expect(spawnMock).toHaveBeenCalledWith('ffmpeg', ['-hide_banner', '-f', 'avfoundation', '-list_devices', 'true', '-i', '']);
  });

  it('should list the webcams with the dshow ffmpeg command on Windows', async () => {
    spawnMock.mockImplementation(() => fakeChild(0) as ReturnType<typeof realSpawn>);
    vi.resetModules();
    const { listWebcams } = await import('../../src/behaviors/ffmpeg.js');
    Object.defineProperty(process, 'platform', { value: 'win32' });
    spawnMock.mockReset();
    spawnMock.mockImplementation(() => fakeListing('[dshow @ 0x1] "Integrated Camera" (video)\n') as ReturnType<typeof realSpawn>);

    expect(await listWebcams()).toEqual(['Integrated Camera']);
    expect(spawnMock).toHaveBeenCalledWith('ffmpeg', ['-hide_banner', '-list_devices', 'true', '-f', 'dshow', '-i', 'dummy']);
  });

  it('should reject when ffmpeg cannot be spawned', async () => {
    spawnMock.mockImplementation(() => fakeChild(0) as ReturnType<typeof realSpawn>);
    vi.resetModules();
    const { listWebcams } = await import('../../src/behaviors/ffmpeg.js');
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    spawnMock.mockReset();
    spawnMock.mockImplementation(() => fakeChild(new Error('spawn ENOENT')) as ReturnType<typeof realSpawn>);

    await expect(listWebcams()).rejects.toThrow('spawn ENOENT');
  });

  it('should parse the v4l2 webcams and keep only the lowest numbered node of each camera', async () => {
    const { parseV4l2Webcams } = await import('../../src/behaviors/ffmpeg.js');
    const output = [
      'Auto-detected sources for video4linux2,v4l2:',
      '  /dev/video3 [Luca iPhone Camera: Luca] (none)',
      '  /dev/video2 [Luca iPhone Camera: Luca] (none)',
      '  /dev/video1 [MacBook Pro Camera: MacBook Pro] (none)',
      '  /dev/video0 [MacBook Pro Camera: MacBook Pro] (none)',
      '  /dev/video10 [Other Camera: usb-1] (none)',
      '  /dev/video11 [Other Camera: usb-1] (none)',
    ].join('\n');

    expect(parseV4l2Webcams(output)).toEqual(['/dev/video0', '/dev/video2', '/dev/video10']);
  });

  it('should list the webcams with the v4l2 ffmpeg command on Linux', async () => {
    spawnMock.mockImplementation(() => fakeChild(0) as ReturnType<typeof realSpawn>);
    vi.resetModules();
    const { listWebcams } = await import('../../src/behaviors/ffmpeg.js');
    Object.defineProperty(process, 'platform', { value: 'linux' });
    spawnMock.mockReset();
    spawnMock.mockImplementation(
      () =>
        fakeListing('Auto-detected sources for video4linux2,v4l2:\n  /dev/video1 [Cam: bus] (none)\n  /dev/video0 [Cam: bus] (none)\n', 'stdout') as ReturnType<typeof realSpawn>,
    );

    expect(await listWebcams()).toEqual(['/dev/video0']);
    expect(spawnMock).toHaveBeenCalledWith('ffmpeg', ['-hide_banner', '-sources', 'v4l2']);
  });
});

describe('playWebcam', () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    spawnMock.mockReset();
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it.each([
    ['darwin', 'Cam', undefined, ['-hide_banner', '-window_title', 'Cam', '-f', 'avfoundation', '-framerate', '30', '-i', 'Cam']],
    ['darwin', 'Cam', 'Mic', ['-hide_banner', '-window_title', 'Cam', '-f', 'avfoundation', '-framerate', '30', '-i', 'Cam:Mic']],
    ['win32', 'Cam', undefined, ['-hide_banner', '-window_title', 'Cam', '-f', 'dshow', '-i', 'video=Cam']],
    ['win32', 'Cam', 'Mic', ['-hide_banner', '-window_title', 'Cam', '-f', 'dshow', '-i', 'video=Cam:audio=Mic']],
    ['linux', '/dev/video0', 'Mic', ['-hide_banner', '-window_title', '/dev/video0', '-f', 'v4l2', '-i', '/dev/video0']],
  ])('should build the ffplay arguments on %s for %s and %s', async (platform, video, audio, expected) => {
    const { getPlayWebcamArgs } = await import('../../src/behaviors/ffmpeg.js');
    Object.defineProperty(process, 'platform', { value: platform });

    expect(getPlayWebcamArgs(video, audio)).toEqual(expected);
  });

  it('should spawn ffplay when ffmpeg is resolved from the PATH', async () => {
    spawnMock.mockImplementation(() => fakeChild(0) as ReturnType<typeof realSpawn>);
    vi.resetModules();
    const { playWebcam } = await import('../../src/behaviors/ffmpeg.js');
    Object.defineProperty(process, 'platform', { value: 'linux' });
    spawnMock.mockClear();

    playWebcam('/dev/video0');
    expect(spawnMock).toHaveBeenCalledWith('ffplay', ['-hide_banner', '-window_title', '/dev/video0', '-f', 'v4l2', '-i', '/dev/video0']);
  });

  it('should spawn ffplay next to an absolute ffmpeg path', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'matterbridge-ffmpeg-'));
    const ffmpegPath = path.join(dir, 'ffmpeg', 'bin', 'ffmpeg.exe');
    await mkdir(path.dirname(ffmpegPath), { recursive: true });
    await writeFile(ffmpegPath, '', { mode: 0o755 });
    const originalPath = process.env.PATH;
    const originalLocalAppData = process.env.LOCALAPPDATA;
    const originalProgramFiles = process.env.ProgramFiles;
    process.env.PATH = '';
    delete process.env.LOCALAPPDATA;
    process.env.ProgramFiles = dir;
    Object.defineProperty(process, 'platform', { value: 'win32' });
    spawnMock.mockImplementation((command) => fakeChild(command === 'ffmpeg' ? new Error('spawn ENOENT') : 0) as ReturnType<typeof realSpawn>);

    try {
      vi.resetModules();
      const { playWebcam } = await import('../../src/behaviors/ffmpeg.js');
      spawnMock.mockClear();

      playWebcam('Cam', 'Mic');
      expect(spawnMock).toHaveBeenCalledWith(path.join(path.dirname(ffmpegPath), 'ffplay.exe'), expect.arrayContaining(['dshow', 'video=Cam:audio=Mic']));
    } finally {
      process.env.PATH = originalPath;
      process.env.ProgramFiles = originalProgramFiles;
      if (originalLocalAppData !== undefined) process.env.LOCALAPPDATA = originalLocalAppData;
      await rm(dir, { force: true, recursive: true });
    }
  });

  it('should throw when ffmpeg is not found', async () => {
    const originalPath = process.env.PATH;
    process.env.PATH = '';
    spawnMock.mockImplementation(() => fakeChild(new Error('spawn ENOENT')) as ReturnType<typeof realSpawn>);

    try {
      vi.resetModules();
      const { playWebcam } = await import('../../src/behaviors/ffmpeg.js');

      expect(() => playWebcam('Cam')).toThrow('Cannot play the webcam: ffmpeg not found on this host');
    } finally {
      process.env.PATH = originalPath;
    }
  });
});

describe('installFfmpeg', () => {
  const originalPlatform = process.platform;
  const originalGetuid = process.getuid;

  /**
   * Loads a fresh ffmpeg module and sets the platform and the user id for the installation.
   *
   * @param {string} platform - The platform to simulate.
   * @param {number} uid - The user id to simulate.
   * @returns {Promise<typeof import('../../src/behaviors/ffmpeg.js')>} The fresh module.
   */
  async function load(platform: string, uid: number): Promise<typeof import('../../src/behaviors/ffmpeg.js')> {
    vi.resetModules();
    const module = await import('../../src/behaviors/ffmpeg.js');
    Object.defineProperty(process, 'platform', { value: platform });
    process.getuid = (): number => uid;
    spawnMock.mockClear();
    return module;
  }

  beforeEach(() => {
    spawnMock.mockReset();
    // ffmpeg is not found at load: every spawn fails.
    spawnMock.mockImplementation(() => fakeChild(new Error('spawn ENOENT')) as ReturnType<typeof realSpawn>);
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    process.getuid = originalGetuid;
  });

  it('should not install on a platform other than linux', async () => {
    const { installFfmpeg } = await load('darwin', 0);

    expect(await installFfmpeg()).toBe(false);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('should not install without root privileges', async () => {
    const { installFfmpeg } = await load('linux', 1000);

    expect(await installFfmpeg()).toBe(false);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('should not install when no package manager is found', async () => {
    const { installFfmpeg } = await load('linux', 0);

    expect(await installFfmpeg()).toBe(false);
    expect(spawnMock).not.toHaveBeenCalledWith('apk', ['add', '--no-cache', 'ffmpeg'], expect.anything());
  });

  it('should install ffmpeg with apk and resolve it again', async () => {
    const { installFfmpeg, hasFfmpeg } = await load('linux', 0);
    expect(hasFfmpeg()).toBe(false);
    let installed = false;
    spawnMock.mockImplementation((command, args) => {
      if (command === 'apk' && (args as string[])[0] === 'add') installed = true;
      const ok = command === 'apk' || (command === 'ffmpeg' && installed);
      return fakeChild(ok ? 0 : new Error('spawn ENOENT')) as ReturnType<typeof realSpawn>;
    });

    expect(await installFfmpeg()).toBe(true);
    expect(hasFfmpeg()).toBe(true);
    expect(spawnMock).toHaveBeenCalledWith('apk', ['add', '--no-cache', 'ffmpeg'], expect.anything());
  });

  it('should install ffmpeg with apt-get and resolve it again', async () => {
    const { installFfmpeg, hasFfmpeg } = await load('linux', 0);
    let installed = false;
    spawnMock.mockImplementation((command, args) => {
      if (command === 'env' && (args as string[]).includes('install')) installed = true;
      const ok = command === 'apt-get' || command === 'env' || (command === 'ffmpeg' && installed);
      return fakeChild(ok ? 0 : new Error('spawn ENOENT')) as ReturnType<typeof realSpawn>;
    });

    expect(await installFfmpeg()).toBe(true);
    expect(hasFfmpeg()).toBe(true);
    expect(spawnMock).toHaveBeenCalledWith('apt-get', ['update'], expect.anything());
    expect(spawnMock).toHaveBeenCalledWith('env', ['DEBIAN_FRONTEND=noninteractive', 'apt-get', 'install', '-y', '--no-install-recommends', 'ffmpeg'], expect.anything());
  });

  it('should return false when the installation fails', async () => {
    const { installFfmpeg, hasFfmpeg } = await load('linux', 0);
    spawnMock.mockImplementation(
      (command, args) => fakeChild(command === 'apk' && (args as string[])[0] === 'add' ? 1 : command === 'apk' ? 0 : new Error('spawn ENOENT')) as ReturnType<typeof realSpawn>,
    );

    expect(await installFfmpeg()).toBe(false);
    expect(hasFfmpeg()).toBe(false);
  });

  it('should return false when ffmpeg is installed but cannot be resolved', async () => {
    const { installFfmpeg, hasFfmpeg } = await load('linux', 0);
    spawnMock.mockImplementation((command) => fakeChild(command === 'apk' ? 0 : new Error('spawn ENOENT')) as ReturnType<typeof realSpawn>);

    expect(await installFfmpeg()).toBe(false);
    expect(hasFfmpeg()).toBe(false);
  });
});
