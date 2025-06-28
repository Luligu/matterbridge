/**
 * This file contains the createZip function.
 *
 * @file createZip.ts
 * @author Luca Liguori
 * @created 2025-02-16
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

// Archiver module import types
import type { ArchiverError, EntryData } from 'archiver';

// AnsiLogger module
import { AnsiLogger, LogLevel, TimestampFormat } from '../logger/export.js';

/**
 * Creates a ZIP archive from the specified source pattern or directory and writes it to the specified output path.
 *
 * @param {string} outputPath - The path where the output ZIP file will be written.
 * @param {string[]} sourcePaths - The source pattern or directory to be zipped (use path.join for sourcePath).
 * @returns {Promise<number>} - A promise that resolves to the total number of bytes written to the ZIP file.
 *
 * @remarks
 * This function uses the `archiver` library to create a ZIP archive. It sets the compression level to 9 (maximum compression).
 * The function ensures that the output file is properly closed after the archiving process is complete.
 * It logs the progress and the total number of bytes written to the console.
 *
 * This function uses the `glob` library to match files based on the source pattern (internally converted in posix).
 */
export async function createZip(outputPath: string, ...sourcePaths: string[]): Promise<number> {
  const log = new AnsiLogger({ logName: 'Archive', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.INFO });

  const { default: archiver } = await import('archiver');
  const { glob } = await import('glob');
  const { createWriteStream, statSync } = await import('node:fs');
  const path = await import('node:path');

  log.debug(`creating archive ${outputPath} from ${sourcePaths.join(', ')} ...`);

  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: 9 }, // Set compression level
    });

    output.on('close', () => {
      log.debug(`archive ${outputPath} closed with ${archive.pointer()} total bytes`);
      resolve(archive.pointer());
    });

    /* istanbul ignore next */
    output.on('end', () => {
      log.debug(`archive ${outputPath} data has been drained ${archive.pointer()} total bytes`);
    });

    /* istanbul ignore next */
    archive.on('error', (error: ArchiverError) => {
      log.error(`archive error: ${error.message}`);
      reject(error);
    });

    /* istanbul ignore next */
    archive.on('warning', (error: ArchiverError) => {
      if (error.code === 'ENOENT') {
        log.warn(`archive warning: ${error.message}`);
      } else {
        log.error(`archive warning: ${error.message}`);
        reject(error);
      }
    });

    archive.on('entry', (entry: EntryData) => {
      log.debug(`- archive entry: ${entry.name}`);
    });

    archive.pipe(output);

    for (const sourcePath of sourcePaths) {
      // Check if the sourcePath is a file or directory
      let stats;
      try {
        stats = statSync(sourcePath);
      } catch (error) {
        if (sourcePath.includes('*')) {
          const files = glob.sync(sourcePath.replace(/\\/g, '/'));
          log.debug(`adding files matching glob pattern: ${sourcePath}`);
          for (const file of files) {
            log.debug(`- glob file: ${file}`);
            archive.file(file, { name: file });
          }
        } else {
          /* istanbul ignore next */
          log.error(`no files or directory found for pattern ${sourcePath}: ${error}`);
        }
        continue;
      }
      if (stats.isFile()) {
        log.debug(`adding file: ${sourcePath}`);
        archive.file(sourcePath, { name: path.basename(sourcePath) });
      } else if (stats.isDirectory()) {
        log.debug(`adding directory: ${sourcePath}`);
        archive.directory(sourcePath, path.basename(sourcePath));
      }
    }
    // Finalize the archive (i.e., we are done appending files but streams have to finish yet)
    log.debug(`finalizing archive ${outputPath}...`);
    archive.finalize().catch(reject);
  });
}
