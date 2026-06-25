/**
 * @description This file contains the getGlobalBunModules function.
 * @file bunPrefix.ts
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

import os from 'node:os';
import path from 'node:path';

import { logModuleLoaded } from './loader.js';

logModuleLoaded('BunPrefix');

/**
 * Checks if the current runtime environment is Bun.
 *
 * @returns {boolean} True if the current runtime is Bun, false otherwise.
 */
export function isBun(): boolean {
  return typeof process !== 'undefined' && process.versions?.bun !== undefined;
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
