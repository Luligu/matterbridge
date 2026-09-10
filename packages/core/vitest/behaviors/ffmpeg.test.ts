/**
 * @file vitest/behaviors/ffmpeg.test.ts
 * @description This file contains the tests for the ffmpeg binary resolution helpers.
 * @author Luca Liguori
 */

const NAME = 'Ffmpeg';

import { spawn as realSpawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { setupTest } from '@matterbridge/vitest-utils';

await setupTest(NAME);

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
