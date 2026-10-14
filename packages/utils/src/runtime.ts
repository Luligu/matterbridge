/**
 * @file packages/utils/src/runtime.ts
 * @description This file contains process runtime helpers.
 * @author Luca Liguori
 * @created 2026-10-15
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

import { spawnSync } from 'node:child_process';

import { logModuleLoaded } from './loader.js';

logModuleLoaded('Runtime');

/** Maximum time the `sudo -n true` probe may run before it is killed. */
const SUDO_PROBE_TIMEOUT_MS = 5000;

/**
 * Checks if the current process runs as root (user id 0). Always false on Windows, which has no user ids.
 *
 * @returns {boolean} True if the current process runs as root, false otherwise.
 */
export function isRoot(): boolean {
  return process.getuid?.() === 0;
}

/**
 * Checks if the current process can run commands with sudo without a password, by running `sudo -n true`.
 * `sudo -n` fails instead of prompting, so the probe never hangs waiting for a password. Always false on Windows.
 *
 * @returns {boolean} True if `sudo -n true` succeeds, false if sudo is missing, needs a password or fails.
 */
export function hasPasswordlessSudo(): boolean {
  if (process.platform === 'win32') return false;
  try {
    const result = spawnSync('sudo', ['-n', 'true'], { stdio: 'ignore', timeout: SUDO_PROBE_TIMEOUT_MS });
    return !result.error && result.status === 0;
  } catch {
    return false;
  }
}
