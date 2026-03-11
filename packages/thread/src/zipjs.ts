/**
 * This file contains zip.js utility functions.
 *
 * @file zipjs.ts
 * @author Luca Liguori
 * @created 2026-03-11
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

import { Uint8ArrayReader, Uint8ArrayWriter, ZipReader, ZipWriter } from '@zip.js/zip.js';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';

import { AnsiLogger, LogLevel, TimestampFormat } from 'node-ansi-logger';

export interface ZipContentEntry {
  filename: string;
  directory: boolean;
  compressedSize: number;
  uncompressedSize: number;
  lastModDate: Date;
}

/**
 * Creates a zip archive containing the provided files and directories.
 *
 * @param {string} zipPath - The output zip file path.
 * @param {string[]} sourcePaths - The files and directories to include in the archive.
 * @returns {Promise<number>} The size of the generated zip file in bytes.
 */
export async function createZip(zipPath: string, sourcePaths: string[]): Promise<number> {
  if (sourcePaths.length === 0) throw new Error('No files or directories provided to createZip.');

  const log = createLogger();
  const writer = new ZipWriter(new Uint8ArrayWriter());
  let entryCount = 0;

  for (const sourcePath of sourcePaths) {
    const resolvedSourcePath = resolve(sourcePath);
    entryCount += await addZipEntry(writer, resolvedSourcePath, basename(resolvedSourcePath), log);
  }

  const zipData = await writer.close();
  await mkdir(dirname(zipPath), { recursive: true });
  await writeFile(zipPath, zipData);

  log.info(`Created zip ${zipPath} with ${entryCount} entries (${zipData.byteLength} bytes).`);
  return zipData.byteLength;
}

/**
 * Reads a zip archive and logs its content.
 *
 * @param {string} zipPath - The zip file path.
 * @returns {Promise<ZipContentEntry[]>} The entries found in the archive.
 */
export async function readZip(zipPath: string): Promise<ZipContentEntry[]> {
  const log = createLogger();
  const reader = new ZipReader(new Uint8ArrayReader(await readFile(zipPath)));

  try {
    const entries = await reader.getEntries();
    const content = entries.map((entry) => ({
      filename: entry.filename,
      directory: entry.directory,
      compressedSize: entry.compressedSize,
      uncompressedSize: entry.uncompressedSize,
      lastModDate: entry.lastModDate,
    }));

    if (content.length === 0) {
      log.info(`Zip ${zipPath} is empty.`);
    } else {
      for (const entry of content) {
        log.info(`${entry.directory ? 'dir ' : 'file'} ${entry.filename} (${entry.uncompressedSize} bytes)`);
      }
    }

    return content;
  } finally {
    await reader.close();
  }
}

/**
 * Extracts a zip archive into a directory next to the zip file.
 *
 * @param {string} zipPath - The zip file path.
 * @param {string} [destinationPath] - Optional output directory path.
 * @returns {Promise<string>} The extraction directory path.
 */
export async function unZip(zipPath: string, destinationPath: string = getDefaultDestinationPath(zipPath)): Promise<string> {
  const log = createLogger();
  const reader = new ZipReader(new Uint8ArrayReader(await readFile(zipPath)));
  let extractedEntries = 0;

  await mkdir(destinationPath, { recursive: true });

  try {
    const entries = await reader.getEntries();
    for (const entry of entries) {
      const entryPath = resolveEntryPath(destinationPath, entry.filename);

      if (entry.directory) {
        await mkdir(entryPath, { recursive: true });
        extractedEntries++;
        continue;
      }

      await mkdir(dirname(entryPath), { recursive: true });
      const fileData = await entry.getData(new Uint8ArrayWriter());
      await writeFile(entryPath, fileData);
      extractedEntries++;
    }
  } finally {
    await reader.close();
  }

  log.info(`Extracted ${extractedEntries} entries from ${zipPath} to ${destinationPath}.`);
  return destinationPath;
}

function createLogger(): AnsiLogger {
  return new AnsiLogger({ logName: 'ZipJs', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.INFO });
}

async function addZipEntry(writer: ZipWriter<Uint8Array<ArrayBuffer>>, sourcePath: string, entryName: string, log: AnsiLogger): Promise<number> {
  const sourceStats = await stat(sourcePath);
  const normalizedEntryName = normalizeEntryName(entryName);

  if (sourceStats.isDirectory()) {
    const directoryEntryName = normalizedEntryName.replace(/\/?$/, '/');
    await writer.add(directoryEntryName, undefined, { directory: true, lastModDate: sourceStats.mtime, level: 9 });
    const children = await readdir(sourcePath, { withFileTypes: true });
    children.sort((left, right) => left.name.localeCompare(right.name));

    let childEntries = 1;
    for (const child of children) {
      childEntries += await addZipEntry(writer, join(sourcePath, child.name), `${directoryEntryName}${child.name}`, log);
    }

    log.debug(`Added directory ${directoryEntryName}`);
    return childEntries;
  }

  if (sourceStats.isFile()) {
    await writer.add(normalizedEntryName, new Uint8ArrayReader(await readFile(sourcePath)), { lastModDate: sourceStats.mtime, level: 9 });
    log.debug(`Added file ${normalizedEntryName}`);
    return 1;
  }

  throw new Error(`Unsupported source path type: ${sourcePath}`);
}

function getDefaultDestinationPath(zipPath: string): string {
  const zipExtension = extname(zipPath);
  const zipName = basename(zipPath, zipExtension);
  return join(dirname(zipPath), zipName);
}

function normalizeEntryName(entryName: string): string {
  return entryName.replace(/\\/g, '/');
}

function resolveEntryPath(destinationPath: string, entryName: string): string {
  const resolvedDestinationPath = resolve(destinationPath);
  const resolvedEntryPath = resolve(resolvedDestinationPath, normalizeEntryName(entryName));
  const relativeEntryPath = relative(resolvedDestinationPath, resolvedEntryPath);

  if (isAbsolute(relativeEntryPath) || relativeEntryPath.startsWith('..')) {
    throw new Error(`Refusing to extract zip entry outside destination: ${entryName}`);
  }

  return resolvedEntryPath;
}
