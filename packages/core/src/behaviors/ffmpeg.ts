/**
 * @file src/behaviors/ffmpeg.ts
 * @description This file contains the shared ffmpeg binary resolution helpers.
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

/** The resolved ffmpeg binary, or `undefined` if ffmpeg could not be found on this host. Resolved once at module load. */
const ffmpegCommand: string | undefined = await resolveFfmpeg();
if (ffmpegCommand) log.debug(`Using ffmpeg: ${ffmpegCommand}`);
else log.warn('ffmpeg could not be resolved on this host; ffmpeg-dependent features will not work');

/**
 * Whether ffmpeg was resolved on this host at module load.
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
