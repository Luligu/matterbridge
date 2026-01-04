/**
 * This file contains the createDirectory function.
 *
 * @file createDirectory.ts
 * @author Luca Liguori
 * @created 2025-06-08
 * @version 1.0.0
 * @license Apache-2.0
 *
 * Copyright 2025, 2026, 2027 Luca Liguori.
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

// Node.js modules
import { promises as fs } from 'node:fs';

// AnsiLogger module
import { AnsiLogger } from 'node-ansi-logger';

/**
 * Creates a directory at the specified path if it doesn't already exist.
 *
 * @param {string} path - The path to the directory to create.
 * @param {string} name - The name of the directory.
 * @param {AnsiLogger} log - The logger instance to use for logging messages.
 * @returns {Promise<void>} A promise that resolves when the directory has been created or already exists.
 */
export async function createDirectory(path: string, name: string, log: AnsiLogger): Promise<void> {
  try {
    await fs.access(path);
    log.debug(`Directory ${name} already exists at path: ${path}`);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      try {
        await fs.mkdir(path, { recursive: true });
        log.info(`Created ${name}: ${path}`);
      } catch (err) {
        log.error(`Error creating dir ${name} path ${path}: ${err}`);
      }
    } else {
      log.error(`Error accessing dir ${name} path ${path}: ${err}`);
    }
  }
}
