/**
 * This file contains the copyDirectory function.
 *
 * @file copyDirectory.ts
 * @author Luca Liguori
 * @created 2025-02-16
 * @version 1.0.2
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

// AnsiLogger module
import { AnsiLogger, LogLevel, TimestampFormat } from '../logger/export.js';

/**
 * Copies a directory and all its subdirectories and files to a new location.
 *
 * @param {string} srcDir - The path to the source directory.
 * @param {string} destDir - The path to the destination directory.
 * @returns {Promise<boolean>} - A promise that resolves when the copy operation is complete or fails for error.
 * @throws {Error} - Throws an error if the copy operation fails.
 */
export async function copyDirectory(srcDir: string, destDir: string): Promise<boolean> {
  if (srcDir === '') {
    throw new Error('Source directory must be specified.');
  }
  if (destDir === '') {
    throw new Error('Destination directory must be specified.');
  }
  if (!srcDir) {
    throw new Error('Source directory must be specified.');
  }
  if (!destDir) {
    throw new Error('Destination directory must be specified.');
  }
  if (srcDir === destDir) {
    throw new Error('Source and destination directories must be different.');
  }
  const log = new AnsiLogger({ logName: 'CopyDirectory', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.INFO });

  const fs = await import('node:fs').then((mod) => mod.promises);
  const path = await import('node:path');

  log.debug(`copyDirectory: copying directory from ${srcDir} to ${destDir}`);
  try {
    // Create destination directory if it doesn't exist
    await fs.mkdir(destDir, { recursive: true });

    // Read contents of the source directory
    const entries = await fs.readdir(srcDir, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(srcDir, entry.name);
      const destPath = path.join(destDir, entry.name);

      if (entry.isDirectory()) {
        // Recursive call if entry is a directory
        await copyDirectory(srcPath, destPath);
      } else if (entry.isFile()) {
        // Copy file if entry is a file
        await fs.copyFile(srcPath, destPath);
      }
    }
    return true;
  } catch (error) {
    log.error(`copyDirectory error copying from ${srcDir} to ${destDir}: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}
