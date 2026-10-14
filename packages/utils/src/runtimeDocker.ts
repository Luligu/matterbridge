/**
 * @file packages/utils/src/runtimeDocker.ts
 * @description This file contains Docker runtime helpers.
 * @author Luca Liguori
 * @created 2026-10-14
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

import { existsSync } from 'node:fs';

import { logModuleLoaded } from './loader.js';

logModuleLoaded('RuntimeDocker');

/** Files a container runtime creates in the container: `/.dockerenv` (Docker, dev containers) and `/run/.containerenv` (Podman). */
export const DOCKER_MARKER_FILES: readonly string[] = ['/.dockerenv', '/run/.containerenv'];

/**
 * Checks if the current process runs in a Linux container: Docker or Podman (a marker file in
 * {@link DOCKER_MARKER_FILES}), a VS Code dev container (`REMOTE_CONTAINERS`) or GitHub Codespaces (`CODESPACES`).
 *
 * Unlike the `--docker` parameter, which the Matterbridge docker images pass, this also detects a dev container or a
 * container where the user starts Matterbridge by hand.
 *
 * @param {readonly string[]} [markerFiles] - The marker files to look for, {@link DOCKER_MARKER_FILES} by default.
 * @returns {boolean} True if the current process runs in a Linux container, false otherwise.
 */
export function isDocker(markerFiles: readonly string[] = DOCKER_MARKER_FILES): boolean {
  if (process.platform !== 'linux') return false;
  if (process.env.REMOTE_CONTAINERS === 'true' || process.env.CODESPACES === 'true') return true;
  return markerFiles.some((file) => existsSync(file));
}
