/**
 * @file packages/core/src/behaviors/ffmpeg.ts
 * @description This file contains the shared ffmpeg binary resolution and webcam discovery helpers.
 * @author Luca Liguori
 * @contributor Claude Fable 5
 * @created 2026-07-30
 * @version 1.0.0
 * @license Apache-2.0
 *
 * Copyright 2026, 2027, 2028 Luca Liguori.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { constants } from 'node:fs';
import { access, readdir } from 'node:fs/promises';
import path from 'node:path';

import { getErrorMessage } from '@matterbridge/utils';
import { AnsiLogger, LogLevel, MAGENTA, TimestampFormat } from 'node-ansi-logger';

/** Module logger for ffmpeg binary resolution and process spawning. */
const log = new AnsiLogger({ logName: 'Ffmpeg', logLevel: LogLevel.DEBUG, logNameColor: MAGENTA, logTimestampFormat: TimestampFormat.TIME_MILLIS });

/**
 * Spawns a command and waits for it to exit, discarding its stdio.
 *
 * @param {string} command - The command to run.
 * @param {string[]} args - The arguments to pass to the command.
 * @returns {Promise<void>} Resolves when the command exits with code 0; rejects otherwise.
 */
async function runProbe(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'ignore' });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      /* v8 ignore next -- `code` is only null when the child is killed by a signal rather than exiting normally,
       * which isn't practical to trigger deterministically in this harness; the fallback is cosmetic (error text). */
      reject(new Error(`${command} exited with code ${code ?? -1}`));
    });
  });
}

/**
 * Checks whether a command is runnable, trying `--version` and `-version` since tools differ (e.g. ffmpeg uses `-version`).
 *
 * @param {string} command - The command (or path) to probe.
 * @returns {Promise<boolean>} `true` if the command ran successfully with either version switch.
 */
async function isRunnable(command: string): Promise<boolean> {
  for (const versionArg of ['--version', '-version']) {
    try {
      await runProbe(command, [versionArg]);
      return true;
    } catch {
      // Try alternative version switches because tools differ (e.g. ffmpeg uses -version).
    }
  }
  return false;
}

/**
 * Builds a list of Windows-specific absolute paths to probe for ffmpeg, since it may not be on `PATH`.
 *
 * Checks winget/Gyan installs under `%LOCALAPPDATA%\Microsoft\WinGet\Packages`, plus common
 * `%ProgramFiles%`/`%ProgramFiles(x86)%` install locations. Returns an empty list on non-Windows platforms.
 *
 * @returns {Promise<string[]>} Candidate absolute paths, in the order they should be tried.
 */
async function getWindowsCommandCandidates(): Promise<string[]> {
  if (process.platform !== 'win32') return [];

  const candidates: string[] = [];

  if (process.env.LOCALAPPDATA) {
    const wingetPackages = path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Packages');
    try {
      const packageDirs = await readdir(wingetPackages, { withFileTypes: true });
      for (const packageDir of packageDirs) {
        if (!packageDir.isDirectory() || !packageDir.name.startsWith('Gyan.FFmpeg_')) continue;
        const packagePath = path.join(wingetPackages, packageDir.name);
        try {
          const versionDirs = await readdir(packagePath, { withFileTypes: true });
          for (const versionDir of versionDirs) {
            if (versionDir.isDirectory() && versionDir.name.startsWith('ffmpeg-')) candidates.push(path.join(packagePath, versionDir.name, 'bin', 'ffmpeg.exe'));
          }
        } catch {
          // Ignore incomplete winget package directories.
        }
      }
    } catch {
      // Ignore missing winget package storage; PATH probing still runs below.
    }
  }

  for (const programFiles of [process.env.ProgramFiles, process.env['ProgramFiles(x86)']]) {
    if (!programFiles) continue;
    candidates.push(path.join(programFiles, 'ffmpeg', 'bin', 'ffmpeg.exe'), path.join(programFiles, 'Gyan', 'FFmpeg', 'bin', 'ffmpeg.exe'));
  }
  return candidates;
}

/**
 * Resolves a runnable path for ffmpeg, trying `PATH`, common Unix install locations, and (on Windows) the
 * candidates from {@link getWindowsCommandCandidates}, in order.
 *
 * @returns {Promise<string | undefined>} The first candidate that runs successfully, or `undefined` if none do.
 */
async function resolveFfmpeg(): Promise<string | undefined> {
  const candidates = ['ffmpeg', '/usr/bin/ffmpeg', '/bin/ffmpeg', '/usr/local/bin/ffmpeg', ...(await getWindowsCommandCandidates())];
  log.debug(`Resolving ffmpeg: trying ${candidates.length} candidate(s)`);
  for (const candidate of candidates) {
    // Path-like candidates (vs the bare `ffmpeg` looked up on PATH) get a cheap existence pre-check before spawning.
    if (path.isAbsolute(candidate)) {
      try {
        await access(candidate, constants.X_OK);
      } catch {
        log.debug(`Candidate ${candidate} is not accessible`);
        continue;
      }
    }
    if (await isRunnable(candidate)) {
      log.debug(`Found ffmpeg in ${candidate}`);
      return candidate;
    }
    log.debug(`Candidate ${candidate} did not run successfully`);
  }
  log.debug('Could not resolve ffmpeg');
  return undefined;
}

/** The resolved ffmpeg binary, or `undefined` if ffmpeg could not be found on this host. Resolved at module load and again after {@link installFfmpeg}. */
let ffmpegCommand: string | undefined = await resolveFfmpeg();
if (ffmpegCommand) log.debug(`Using ffmpeg: ${ffmpegCommand}`);
else log.warn('ffmpeg could not be resolved on this host; ffmpeg-dependent features will not work');

/**
 * Whether ffmpeg was resolved on this host at module load or after {@link installFfmpeg}.
 *
 * @returns {boolean} `true` if ffmpeg is available.
 */
export function hasFfmpeg(): boolean {
  return ffmpegCommand !== undefined;
}

/**
 * Redacts URL user information from a media source before it is logged.
 *
 * @param {string} source - A media source URL or local device name/path.
 * @returns {string} The source with URL user information replaced by `***`, or the original string when none is present.
 */
export function redactSource(source: string): string {
  return source.replace(/^([a-z][a-z\d+.-]*:\/\/)[^/]*@/i, '$1***@');
}

/**
 * Spawns the resolved ffmpeg binary with the given arguments.
 *
 * @param {string[]} args - The arguments to pass to ffmpeg.
 * @returns {ChildProcess} The spawned ffmpeg child process.
 * @throws {Error} If ffmpeg could not be resolved on this host.
 */
export function runFfmpeg(args: string[]): ChildProcess {
  if (!ffmpegCommand) {
    throw new Error('Cannot run ffmpeg: not found on this host');
  }
  log.debug(`Spawning ffmpeg: ${ffmpegCommand} ${args.map(redactSource).join(' ')}`);
  return spawn(ffmpegCommand, args);
}

/**
 * Runs ffmpeg with the given arguments and collects its stdout and stderr, where the device lists are printed.
 * ffmpeg may exit with a non-zero code when listing devices, so the exit code is ignored.
 *
 * @param {string[]} args - The arguments to pass to ffmpeg.
 * @returns {Promise<string>} The collected output.
 * @throws {Error} If ffmpeg could not be resolved on this host or could not be spawned.
 */
async function ffmpegOutput(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = runFfmpeg(args);
    let output = '';
    child.stdout?.on('data', (data: Buffer) => (output += data.toString()));
    child.stderr?.on('data', (data: Buffer) => (output += data.toString()));
    child.on('error', reject);
    child.on('close', () => resolve(output));
  });
}

/**
 * Parses the video devices from the output of `ffmpeg -f avfoundation -list_devices true -i ""` (macOS).
 * Screen capture devices are skipped.
 *
 * @param {string} output - The ffmpeg output.
 * @returns {string[]} The names of the webcams.
 */
export function parseAvfoundationWebcams(output: string): string[] {
  const webcams: string[] = [];
  let video = false;
  for (const line of output.split(/\r?\n/)) {
    if (line.includes('AVFoundation video devices')) video = true;
    else if (line.includes('AVFoundation audio devices')) video = false;
    else if (video) {
      const name = /\]\s+\[\d+\]\s+(.+?)\s*$/.exec(line)?.[1];
      if (name && !name.startsWith('Capture screen')) webcams.push(name);
    }
  }
  return webcams;
}

/**
 * Parses the video devices from the output of `ffmpeg -f dshow -list_devices true -i dummy` (Windows).
 *
 * @param {string} output - The ffmpeg output.
 * @returns {string[]} The names of the webcams.
 */
export function parseDshowWebcams(output: string): string[] {
  const webcams: string[] = [];
  let video = false;
  for (const line of output.split(/\r?\n/)) {
    if (line.includes('DirectShow video devices')) video = true;
    else if (line.includes('DirectShow audio devices')) video = false;
    // Newer ffmpeg versions tag each device with its type, older ones use the section headers.
    const match = /"(.+?)"(?:\s+\((video|audio|none)(?:,\s*(?:video|audio|none))*\))?\s*$/.exec(line);
    if (match && (match[2] === 'video' || (match[2] === undefined && video))) webcams.push(match[1]);
  }
  return webcams;
}

/**
 * Parses the video devices from the output of `ffmpeg -sources v4l2` (Linux).
 * Each camera usually exposes a capture node and a metadata node with the same name: only the lowest numbered node of each camera is kept.
 *
 * @param {string} output - The ffmpeg output.
 * @returns {string[]} The device paths of the webcams, i.e. `/dev/video0`.
 */
export function parseV4l2Webcams(output: string): string[] {
  const cameras = new Map<string, number>();
  for (const line of output.split(/\r?\n/)) {
    const match = /^\s*\/dev\/video(\d+)\s+\[(.+)\]/.exec(line);
    if (!match) continue;
    const node = Number(match[1]);
    cameras.set(match[2], Math.min(node, cameras.get(match[2]) ?? node));
  }
  return [...cameras.values()].toSorted((a, b) => a - b).map((node) => `/dev/video${node}`);
}

/**
 * Lists the webcams of the current platform with ffmpeg: avfoundation on macOS, dshow on Windows and v4l2 on Linux.
 *
 * @returns {Promise<string[]>} The webcam identifiers to use as video source: the device names on macOS and Windows, the device paths on Linux.
 * @throws {Error} If ffmpeg could not be resolved on this host or could not be spawned.
 */
export async function listWebcams(): Promise<string[]> {
  if (process.platform === 'darwin') return parseAvfoundationWebcams(await ffmpegOutput(['-hide_banner', '-f', 'avfoundation', '-list_devices', 'true', '-i', '']));
  if (process.platform === 'win32') return parseDshowWebcams(await ffmpegOutput(['-hide_banner', '-list_devices', 'true', '-f', 'dshow', '-i', 'dummy']));
  return parseV4l2Webcams(await ffmpegOutput(['-hide_banner', '-sources', 'v4l2']));
}

/**
 * Builds the ffplay arguments to play a webcam with the input format of the current platform: avfoundation on macOS, dshow on Windows and v4l2 on Linux.
 * ffplay can open a single input: on Linux the audio source is ignored. On macOS the frame rate is set to 30 because the avfoundation default (29.97) is rejected by most cameras.
 *
 * @param {string} videoSource - The webcam identifier returned by {@link listWebcams}.
 * @param {string} [audioSource] - The optional microphone identifier. Ignored on Linux.
 * @returns {string[]} The ffplay arguments.
 */
export function getPlayWebcamArgs(videoSource: string, audioSource?: string): string[] {
  if (process.platform === 'darwin')
    return ['-hide_banner', '-window_title', videoSource, '-f', 'avfoundation', '-framerate', '30', '-i', audioSource ? `${videoSource}:${audioSource}` : videoSource];
  if (process.platform === 'win32')
    return ['-hide_banner', '-window_title', videoSource, '-f', 'dshow', '-i', audioSource ? `video=${videoSource}:audio=${audioSource}` : `video=${videoSource}`];
  return ['-hide_banner', '-window_title', videoSource, '-f', 'v4l2', '-i', videoSource];
}

/**
 * Plays a webcam in an ffplay window. ffplay is expected next to the resolved ffmpeg binary (it is part of the ffmpeg packages).
 *
 * @param {string} videoSource - The webcam identifier returned by {@link listWebcams}.
 * @param {string} [audioSource] - The optional microphone identifier. Ignored on Linux.
 * @returns {ChildProcess} The spawned ffplay child process: kill it to close the window.
 * @throws {Error} If ffmpeg could not be resolved on this host.
 */
export function playWebcam(videoSource: string, audioSource?: string): ChildProcess {
  if (!ffmpegCommand) {
    throw new Error('Cannot play the webcam: ffmpeg not found on this host');
  }
  const ffplayCommand = path.isAbsolute(ffmpegCommand) ? path.join(path.dirname(ffmpegCommand), path.basename(ffmpegCommand).replace(/^ffmpeg/i, 'ffplay')) : 'ffplay';
  const args = getPlayWebcamArgs(videoSource, audioSource);
  log.debug(`Spawning ffplay: ${ffplayCommand} ${args.map(redactSource).join(' ')}`);
  return spawn(ffplayCommand, args);
}

/**
 * Installs the full ffmpeg package with the system package manager (`apk` on Alpine, `apt-get` on Debian and Ubuntu) and resolves it again.
 * It requires Linux and root privileges, as in the Matterbridge docker images: the caller decides whether installing is allowed (i.e. only in docker).
 *
 * @returns {Promise<boolean>} `true` if ffmpeg is available after the installation, `false` if the installation is not supported here or failed.
 */
export async function installFfmpeg(): Promise<boolean> {
  if (process.platform !== 'linux') {
    log.warn(`Cannot install ffmpeg: unsupported platform ${process.platform}`);
    return false;
  }
  if (process.getuid?.() !== 0) {
    log.warn('Cannot install ffmpeg: root privileges are required');
    return false;
  }
  try {
    if (await isRunnable('apk')) {
      await runProbe('apk', ['add', '--no-cache', 'ffmpeg']);
    } else if (await isRunnable('apt-get')) {
      await runProbe('apt-get', ['update']);
      await runProbe('env', ['DEBIAN_FRONTEND=noninteractive', 'apt-get', 'install', '-y', '--no-install-recommends', 'ffmpeg']);
    } else {
      log.warn('Cannot install ffmpeg: no supported package manager found (apk, apt-get)');
      return false;
    }
  } catch (error) {
    log.error(`Failed to install ffmpeg: ${getErrorMessage(error)}`);
    return false;
  }
  ffmpegCommand = await resolveFfmpeg();
  log.info(ffmpegCommand ? `Installed ffmpeg: ${ffmpegCommand}` : 'ffmpeg was installed but could not be resolved');
  return ffmpegCommand !== undefined;
}
