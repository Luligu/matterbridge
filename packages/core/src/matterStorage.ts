/**
 * @file packages/core/src/matterStorage.ts
 * @description This file contains the functions for managing matter storage.
 * @author Luca Liguori
 * @created 2026-10-28
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

// WARNING: Not released yet and excluded from Vitest coverage

// Node modules
import fs from 'node:fs';
import path from 'node:path';

// @matter
import { Environment, type StorageManager, StorageService } from '@matter/general';
// @matterbridge
import { MATTER_STORAGE_DIR, type SharedMatterbridge } from '@matterbridge/types';
import { copyDirectory } from '@matterbridge/utils/copy-dir';
// Ansi Logger module
import { type AnsiLogger, CYAN, er, nf } from 'node-ansi-logger';

/**
 * Starts the matter storage, opens the storage manager of the store ID, performs a backup and migrates the legacy 'persist' context to 'matterbridge'.
 *
 * @param {SharedMatterbridge} matterbridge - The matterbridge object containing the directory information.
 * @param {string} storeId - The identifier for the storage manager to be opened.
 * @param {AnsiLogger} log - The logger to use for logging messages.
 *
 * @returns {Promise<StorageManager>} - A promise that resolves to the opened storage manager.
 */
export async function startMatterStorage(matterbridge: SharedMatterbridge, storeId: string, log: AnsiLogger): Promise<StorageManager> {
  // Setup Matter storage
  log.info(`Starting matter node storage...`);
  const environment = Environment.default;
  const storageDir = path.join(matterbridge.matterbridgeDirectory, MATTER_STORAGE_DIR);
  environment.vars.set('path.root', storageDir);
  const matterStorageService = environment.get(StorageService);
  log.info(`Started matter node storage service in ${CYAN}${matterStorageService.location}${nf}`);

  // Open the matter storage manager with the specified store ID
  const matterStorageManager = await matterStorageService.open(storeId);
  log.info(`Opened matter node storage manager with store ID ${CYAN}${storeId}${nf}`);

  // Close the storage manager on any error so the store is not left locked: the caller never receives it
  try {
    // Backup only the store of this storage manager since it is created/opened correctly and locked by this node:
    // each MatterNode (bridge, childbridge plugin or server mode device) backs up its own store without overwriting the others
    await backupMatterStorage(path.join(storageDir, storeId), path.join(storageDir + '.backup', storeId), log);

    // Create the matter storage context with the legacy name 'persist'
    const storageContextPersist = matterStorageManager.createContext('persist');
    log.info(`Created matter node storage context with legacy name ${CYAN}persist${nf}`);

    // Create the matter storage context with the new name 'matterbridge'
    const storageContext = matterStorageManager.createContext('matterbridge');
    log.info(`Created matter node storage context with name ${CYAN}matterbridge${nf}`);

    // Migrate the matter storage context with the legacy name 'persist' to 'matterbridge', copying only the keys missing in 'matterbridge'
    const values = await storageContextPersist.values();
    let migrated = 0;
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined || (await storageContext.has(key))) continue;
      await storageContext.set(key, value);
      migrated++;
    }
    const total = Object.keys(values).length;
    if (total) {
      await storageContextPersist.clearAll();
      if (migrated) log.info(`Migrated ${migrated} keys of matter node storage context from ${CYAN}persist${nf} to ${CYAN}matterbridge${nf}`);
      if (total > migrated) log.info(`Cleared ${total - migrated} keys of matter node storage context ${CYAN}persist${nf} already migrated to ${CYAN}matterbridge${nf}`);
    }
  } catch (error) {
    log.error(`Error starting matter node storage with store ID ${CYAN}${storeId}${er}:`, error);
    await matterStorageManager.close();
    throw error;
  }

  return matterStorageManager;
}

/**
 * Makes a backup copy of the specified matter storage directory.
 *
 * @param {string} storageName - The name of the storage directory to be backed up.
 * @param {string} backupName - The name of the backup directory to be created.
 * @param {AnsiLogger} log - The logger to use for logging messages.
 *
 * @returns {Promise<void>} A promise that resolves when the backup has been done.
 */
export async function backupMatterStorage(storageName: string, backupName: string, log: AnsiLogger): Promise<void> {
  log.info(`Creating matter node storage backup from ${CYAN}${storageName}${nf} to ${CYAN}${backupName}${nf}...`);
  if (!storageName || !fs.existsSync(storageName)) {
    log.info(`No matter node storage found to backup from ${CYAN}${storageName}${nf} to ${CYAN}${backupName}${nf}`);
    return;
  }
  try {
    if (await copyDirectory(storageName, backupName, log)) log.info('Created matter node storage backup');
    else log.error(`Error creating matter node storage backup from ${CYAN}${storageName}${nf} to ${CYAN}${backupName}${nf}`);
  } catch (error) {
    log.error(`Error creating matter node storage backup from ${CYAN}${storageName}${nf} to ${CYAN}${backupName}${nf}:`, error);
  }
}

/**
 * Stops the matter storage.
 *
 * @param {StorageManager} storageManager - The storage manager to be closed.
 * @param {AnsiLogger} log - The logger to use for logging messages.
 *
 * @returns {Promise<void>} A promise that resolves when the storage is stopped.
 */
export async function stopMatterStorage(storageManager: StorageManager, log: AnsiLogger): Promise<void> {
  log.info('Closing matter node storage manager...');
  await storageManager.close();
  log.info('Closed matter node storage');
}
