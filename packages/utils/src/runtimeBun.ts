/**
 * @description This file contains Bun runtime helpers.
 * @file runtimeBun.ts
 * @author Luca Liguori
 * @created 2026-06-24
 * @version 1.0.0
 * @license Apache-2.0
 *
 * Copyright 2026 Luca Liguori.
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

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { logModuleLoaded } from './loader.js';

logModuleLoaded('RuntimeBun');

// Cache the detection once — the runtime can't change mid-process.
const HAS_BUN_GLOBAL = typeof Bun !== 'undefined';

/**
 * Checks if the current runtime environment is Bun.
 *
 * @returns {boolean} True if the current runtime is Bun, false otherwise.
 */
export function isBun(): boolean {
  return HAS_BUN_GLOBAL || typeof process?.versions?.bun === 'string';
}

/**
 * Checks if Bun is available in the current environment.
 *
 * @returns {boolean} True if Bun is available, false otherwise.
 */
export function bunAvailable(): boolean {
  if (isBun()) {
    return true;
  }
  const home = process.env.HOME ?? '';
  if (home && existsSync(`${home}/.bun/bin/bun`)) return true;
  try {
    execFileSync('bun', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false; // bun not on PATH
  }
}

/**
 * The Bun version string (e.g. `"1.3.0"`), or `undefined` when not on Bun.
 *
 * @returns {string | undefined} The Bun version string, or `undefined` if not running on Bun.
 */
export function getBunVersion(): string | undefined {
  if (HAS_BUN_GLOBAL) return Bun.version;
  return process?.versions?.bun;
}

/**
 * The git commit (revision) Bun was built from, or `undefined` when unavailable.
 *
 * @returns {string | undefined} The Bun revision string, or `undefined` if not available.
 */
export function getBunRevision(): string | undefined {
  return HAS_BUN_GLOBAL ? Bun.revision : undefined;
}

/**
 * The Node.js version Bun reports for compatibility (e.g. `"22.6.0"`).
 * Present in both runtimes; useful for logging what the Node-compat layer emulates.
 *
 * @returns {string | undefined} The Node.js version string, or `undefined` if not available.
 */
export function getNodeCompatVersion(): string | undefined {
  return process?.versions?.node;
}

/**
 * Returns the global `Bun` namespace when available, otherwise `undefined`.
 * Lets callers reach the full API without repeating the runtime guard.
 *
 * @returns {typeof Bun | undefined} The global Bun namespace, or `undefined` if not available.
 * @example
 * const bun = getBun();
 * if (bun) await bun.write('out.txt', 'hello');
 */
export function getBun(): typeof Bun | undefined {
  return HAS_BUN_GLOBAL ? Bun : undefined;
}

/**
 * Retrieves the path to the global Bun modules directory.
 *
 * Bun has no `bun root -g` equivalent of `npm root -g`, so the path is derived from
 * `$BUN_INSTALL` (falling back to `~/.bun`) as `<bunInstall>/install/global/node_modules`.
 *
 * @returns {string} The path of the global Bun modules directory.
 * @remarks This function is only relevant when running in a Bun environment. If called in a non-Bun environment, it will throw an error.
 * Call getGlobalNodeModules() instead, which will return the appropriate global modules directory for the current runtime (Bun or Node.js).
 */
export function getGlobalBunModules(): string {
  if (!isBun()) {
    throw new Error('getGlobalBunModules can only be called in a Bun environment.');
  }
  const bunInstall = process.env.BUN_INSTALL ?? path.join(os.homedir(), '.bun');
  return path.join(bunInstall, 'install', 'global', 'node_modules');
}

/* -------------------------------------------------------------------------- */
/* Guarded wrappers over useful Bun namespace APIs (with Node fallbacks)       */
/* -------------------------------------------------------------------------- */

/**
 * High-resolution monotonic time in nanoseconds since process start.
 * Uses `Bun.nanoseconds()` on Bun, `process.hrtime.bigint()` (as a number) on Node.
 *
 * Note: precision degrades after ~14.8 weeks of uptime once the count exceeds
 * `Number.MAX_SAFE_INTEGER` — fine for measuring short durations, not absolute time.
 *
 * @returns {number} The high-resolution monotonic time in nanoseconds.
 */
export function nanoseconds(): number {
  if (HAS_BUN_GLOBAL) return Bun.nanoseconds();
  return Number(process.hrtime.bigint());
}

/**
 * Async sleep. `Bun.sleep()` on Bun, a `setTimeout` promise on Node.
 *
 * @param {number} ms - The number of milliseconds to sleep.
 * @returns {Promise<void>} A promise that resolves after the specified duration.
 * @example
 * await sleep(1000); // Sleep for 1 second
 */
export async function sleep(ms: number): Promise<void> {
  if (HAS_BUN_GLOBAL) return Bun.sleep(ms);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Locate an executable in `PATH` (like the `which` command).
 * Returns `null` when not found, or when not running on Bun.
 *
 * @param {string} command - The name of the command to locate.
 * @returns {string | null } The path to the executable if found, or `null` if not found or not running on Bun.
 * @example
 * const nodePath = which('node'); // Returns the path to the 'node' executable if found
 */
export function which(command: string): string | null {
  return HAS_BUN_GLOBAL ? Bun.which(command) : null;
}

/**
 * Manually trigger the garbage collector.
 *
 * This does two things:
 * 1. It tells JavaScriptCore to run the garbage collector
 * 2. It tells [mimalloc](https://github.com/microsoft/mimalloc) to clean up fragmented memory. Mimalloc manages the heap not used in JavaScriptCore.
 *
 * @param {boolean} [force] - On Bun, pass `true` for a synchronous full GC. Default is `true`.
 *
 * @returns {void}
 *
 * @example
 * gc(); // Request a garbage collection pass
 */
export function gc(force = true): void {
  if (HAS_BUN_GLOBAL) {
    Bun.gc(force);
  }
}

/**
 * Force the garbage collector to run extremely often,
 * especially inside `bun:test`.
 *
 * - `0`: default, disable
 * - `1`: asynchronously call the garbage collector more often
 * - `2`: synchronously call the garbage collector more often.
 *
 * This is a global setting. It's useful for debugging seemingly random crashes.
 *
 * `BUN_GARBAGE_COLLECTOR_LEVEL` environment variable is also supported.
 *
 * @param {0 | 1 | 2} [level] - The desired garbage collection level. If not provided, the current level will be returned.
 *
 * @returns {0 | 1 | 2 | undefined} The previous garbage collection level, or `undefined` if not running on Bun.
 */
export function setGcLevel(level?: 0 | 1 | 2): 0 | 1 | 2 | undefined {
  return HAS_BUN_GLOBAL ? Bun.unsafe.gcAggressionLevel(level) : undefined;
}

/* -------------------------------------------------------------------------- */
/* Aggregated runtime info                                                     */
/* -------------------------------------------------------------------------- */

export interface BunRuntimeInfo {
  /** Whether the process is running under Bun. */
  isBun: boolean;
  /** Bun version string, e.g. `"1.3.0"`. */
  version?: string;
  /** Git revision Bun was built from. */
  revision?: string;
  /** Node.js version emulated by Bun's compat layer. */
  nodeCompat?: string;
  /** Absolute path to the runtime binary (`bun`/`node`). */
  execPath: string;
  /** Entry script (`Bun.main` on Bun, `argv[1]` on Node). */
  main?: string;
  /** CPU architecture, e.g. `"arm64"`. */
  arch: string;
  /** OS platform, e.g. `"linux"`. */
  platform: string;
}

/**
 * Collects a structured snapshot of the current runtime — handy to log once at
 * Matterbridge startup. Works on both Bun and Node.
 *
 * @returns {BunRuntimeInfo} An object containing detailed information about the current runtime environment.
 *
 * @example
 * const runtimeInfo = getBunRuntimeInfo();
 * console.log(runtimeInfo);
 */
export function getBunRuntimeInfo(): BunRuntimeInfo {
  const bun = getBun();

  return {
    isBun: isBun(),
    version: getBunVersion(),
    revision: getBunRevision(),
    nodeCompat: getNodeCompatVersion(),
    execPath: process.execPath,
    main: bun?.main ?? process.argv[1],
    arch: process.arch,
    platform: process.platform,
  };
}
