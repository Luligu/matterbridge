/**
 * @file packages/core/vitest/matterStorage.test.ts
 * @description This file contains the tests for matterStorage.
 * @author Luca Liguori
 */

const NAME = 'MatterStorage';

import fs from 'node:fs';
import path from 'node:path';

import { type Environment, StorageContext, StorageManager, StorageService } from '@matter/general';
import { createTestEnvironment, destroyTestEnvironment } from '@matterbridge/test-utils/vitest/matter';
import { HOMEDIR, log, loggerErrorSpy, loggerInfoSpy, setupTest } from '@matterbridge/test-utils/vitest/setup';
import type { SharedMatterbridge } from '@matterbridge/types';
import { MATTER_STORAGE_DIR } from '@matterbridge/types';
import { CYAN, er, nf } from 'node-ansi-logger';

// Spy on copyDirectory, passing through to the real implementation unless a test overrides it
const copyDirectorySpy = vi.hoisted(() => vi.fn());
vi.mock('@matterbridge/utils/copy-dir', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@matterbridge/utils/copy-dir')>();
  copyDirectorySpy.mockImplementation(actual.copyDirectory);
  return { ...actual, copyDirectory: copyDirectorySpy };
});

import { backupMatterStorage, startMatterStorage, stopMatterStorage } from '../src/matterStorage.js';

// Setup the test environment
await setupTest(NAME, false);

describe('matterStorage', () => {
  let environment: Environment;
  let matterbridge: SharedMatterbridge;
  let storageDir: string;
  /** Managers started by the current test and not yet stopped: afterEach stops them so a failing test cannot leak module state */
  const runningManagers = new Set<StorageManager>();

  /**
   * Starts the matter storage and tracks the returned manager.
   *
   * @param {string} storeId - The store ID to open.
   * @returns {Promise<StorageManager>} The opened storage manager.
   */
  async function start(storeId: string): Promise<StorageManager> {
    const manager = await startMatterStorage(matterbridge, storeId, log);
    runningManagers.add(manager);
    return manager;
  }

  /**
   * Stops the matter storage and untracks the manager.
   *
   * @param {StorageManager} manager - The storage manager to stop.
   * @returns {Promise<void>} A promise that resolves when the storage is stopped.
   */
  async function stop(manager: StorageManager): Promise<void> {
    runningManagers.delete(manager);
    await stopMatterStorage(manager, log);
  }

  beforeAll(async () => {
    matterbridge = {
      matterbridgeDirectory: path.join(HOMEDIR, 'matterStorageTest'),
    } as unknown as SharedMatterbridge;
    storageDir = path.join(matterbridge.matterbridgeDirectory, MATTER_STORAGE_DIR);
    fs.mkdirSync(matterbridge.matterbridgeDirectory, { recursive: true });
    environment = await createTestEnvironment();
  });

  beforeEach(() => {
    loggerInfoSpy.mockClear();
    loggerErrorSpy.mockClear();
    copyDirectorySpy.mockClear();
  });

  afterEach(async () => {
    for (const manager of runningManagers) await stop(manager);
  });

  afterAll(async () => {
    await destroyTestEnvironment();
    fs.rmSync(matterbridge.matterbridgeDirectory, { recursive: true, force: true });
  });

  test('startMatterStorage migrates persist, backs up and stopMatterStorage persists to disk', async () => {
    const storeId = 'TestStore';

    // Pre-populate the legacy 'persist' context on disk
    environment.vars.set('path.root', storageDir);
    const seedManager = await environment.get(StorageService).open(storeId);
    await seedManager.createContext('persist').set('migratedKey', 'migratedValue');
    await seedManager.createContext('persist').set('numberKey', 42);
    await seedManager.createContext('persist').set('existingKey', 'staleValue');
    await seedManager.createContext('matterbridge').set('existingKey', 'newValue');
    await seedManager.close();

    const manager = await start(storeId);
    expect(manager).toBeDefined();

    // Backup done after the open
    // Only the store of this storage manager is backed up
    expect(copyDirectorySpy).toHaveBeenCalledWith(path.join(storageDir, storeId), path.join(storageDir + '.backup', storeId), log);
    expect(loggerInfoSpy).toHaveBeenCalledWith('Created matter node storage backup');
    expect(fs.existsSync(path.join(storageDir + '.backup', storeId))).toBe(true);

    // Migration done
    const context = manager.createContext('matterbridge');
    expect(await context.get('migratedKey')).toBe('migratedValue');
    expect(await context.get('numberKey')).toBe(42);
    expect(await context.get('existingKey')).toBe('newValue');
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Migrated 2 keys of matter node storage context from ${CYAN}persist${nf} to ${CYAN}matterbridge${nf}`);
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Cleared 1 keys of matter node storage context ${CYAN}persist${nf} already migrated to ${CYAN}matterbridge${nf}`);

    await stop(manager);
    expect(environment.has(StorageService)).toBe(true);
    expect(loggerInfoSpy).toHaveBeenCalledWith('Closed matter node storage');

    // Reopen from disk after the driver has been released: the migration must be persisted
    const checkManager = await environment.get(StorageService).open(storeId);
    expect(await checkManager.createContext('matterbridge').get('migratedKey')).toBe('migratedValue');
    expect(await checkManager.createContext('matterbridge').get('numberKey')).toBe(42);
    expect(await checkManager.createContext('matterbridge').get('existingKey')).toBe('newValue');
    expect(await checkManager.createContext('persist').keys()).toEqual([]);
    await checkManager.close();
  });

  test('startMatterStorage skips undefined values in persist', async () => {
    const valuesSpy = vi
      .spyOn(StorageContext.prototype, 'values')
      // A key without value: matter.js returns it in values() but get() would throw on it
      .mockImplementationOnce(() => ({ undefinedKey: undefined, definedKey: 'definedValue' }));

    const manager = await start('UndefinedStore');
    valuesSpy.mockRestore();
    const context = manager.createContext('matterbridge');
    expect(await context.has('undefinedKey')).toBe(false);
    expect(await context.get('definedKey')).toBe('definedValue');
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Migrated 1 keys of matter node storage context from ${CYAN}persist${nf} to ${CYAN}matterbridge${nf}`);
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Cleared 1 keys of matter node storage context ${CYAN}persist${nf} already migrated to ${CYAN}matterbridge${nf}`);

    await stop(manager);
  });

  test('startMatterStorage only clears persist when every key is already migrated', async () => {
    // Same key in persist at both starts, as written by Matterbridge before each start
    const valuesSpy = vi.spyOn(StorageContext.prototype, 'values').mockImplementation(() => ({ storeId: 'AlreadyMigrated' }));
    try {
      const manager = await start('AlreadyMigrated');
      expect(loggerInfoSpy).toHaveBeenCalledWith(`Migrated 1 keys of matter node storage context from ${CYAN}persist${nf} to ${CYAN}matterbridge${nf}`);
      await stop(manager);

      loggerInfoSpy.mockClear();
      const manager2 = await start('AlreadyMigrated');
      expect(loggerInfoSpy).not.toHaveBeenCalledWith(expect.stringContaining('keys of matter node storage context from'));
      expect(loggerInfoSpy).toHaveBeenCalledWith(`Cleared 1 keys of matter node storage context ${CYAN}persist${nf} already migrated to ${CYAN}matterbridge${nf}`);
      await stop(manager2);
    } finally {
      valuesSpy.mockRestore();
    }
  });

  test('startMatterStorage closes the storage manager and rethrows when the migration fails', async () => {
    const error = new Error('Values failure');
    const valuesSpy = vi.spyOn(StorageContext.prototype, 'values').mockImplementationOnce(() => {
      throw error;
    });
    const closeSpy = vi.spyOn(StorageManager.prototype, 'close');

    const result = await startMatterStorage(matterbridge, 'FailingStore', log).catch((caught: unknown) => caught);
    expect(result).toBe(error);
    expect(loggerErrorSpy).toHaveBeenCalledWith(`Error starting matter node storage with store ID ${CYAN}FailingStore${er}:`, error);
    expect(closeSpy).toHaveBeenCalledTimes(1);
    valuesSpy.mockRestore();
    closeSpy.mockRestore();

    // The store is not left locked: it can be started again
    const manager = await start('FailingStore');
    expect(manager).toBeDefined();
    await stop(manager);
  });

  test('startMatterStorage does not clear persist when it is empty', async () => {
    const clearAllSpy = vi.spyOn(StorageContext.prototype, 'clearAll');

    const manager = await start('EmptyStore');
    expect(manager).toBeDefined();
    expect(clearAllSpy).not.toHaveBeenCalled();
    clearAllSpy.mockRestore();
    expect(loggerInfoSpy).not.toHaveBeenCalledWith(expect.stringContaining('Migrated matter node storage context'));

    await stop(manager);
  });

  test('startMatterStorage works again after stopMatterStorage with multiple managers', async () => {
    const manager1 = await start('Store1');
    const manager2 = await start('Store2');

    // Each store is backed up in its own folder
    expect(copyDirectorySpy).toHaveBeenCalledWith(path.join(storageDir, 'Store1'), path.join(storageDir + '.backup', 'Store1'), log);
    expect(copyDirectorySpy).toHaveBeenCalledWith(path.join(storageDir, 'Store2'), path.join(storageDir + '.backup', 'Store2'), log);
    await stop(manager1);
    await stop(manager2);
    expect(environment.has(StorageService)).toBe(true);

    // Restart in the same process: the storage service keeps its drivers
    const manager3 = await start('Store1');
    expect(manager3).toBeDefined();
    await stop(manager3);
  });

  test('backupMatterStorage skips backup when storageName is empty', async () => {
    await backupMatterStorage('', 'backup', log);
    expect(loggerInfoSpy).toHaveBeenCalledWith(`No matter node storage found to backup from ${CYAN}${nf} to ${CYAN}backup${nf}`);
    expect(copyDirectorySpy).not.toHaveBeenCalled();
  });

  test('backupMatterStorage skips backup when storageName does not exist', async () => {
    const missingDir = path.join(matterbridge.matterbridgeDirectory, 'non-existent-storage');
    const backupDir = missingDir + '.backup';

    await backupMatterStorage(missingDir, backupDir, log);
    expect(loggerInfoSpy).toHaveBeenCalledWith(`No matter node storage found to backup from ${CYAN}${missingDir}${nf} to ${CYAN}${backupDir}${nf}`);
    expect(copyDirectorySpy).not.toHaveBeenCalled();
    expect(fs.existsSync(backupDir)).toBe(false);
  });

  test('backupMatterStorage succeeds when directory exists', async () => {
    const sourceDir = path.join(matterbridge.matterbridgeDirectory, 'valid-storage');
    const backupDir = sourceDir + '.backup';
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.writeFileSync(path.join(sourceDir, 'data.json'), '{"test":true}');

    await backupMatterStorage(sourceDir, backupDir, log);
    expect(loggerInfoSpy).toHaveBeenCalledWith('Created matter node storage backup');
    expect(fs.readFileSync(path.join(backupDir, 'data.json'), 'utf8')).toBe('{"test":true}');
  });

  test('backupMatterStorage handles copyDirectory returning false', async () => {
    copyDirectorySpy.mockResolvedValueOnce(false);

    await backupMatterStorage(storageDir, 'backup', log);
    expect(loggerErrorSpy).toHaveBeenCalledWith(`Error creating matter node storage backup from ${CYAN}${storageDir}${nf} to ${CYAN}backup${nf}`);
  });

  test('backupMatterStorage handles copyDirectory throwing an error', async () => {
    const error = new Error('Copy failed');
    copyDirectorySpy.mockRejectedValueOnce(error);

    await backupMatterStorage(storageDir, 'backup', log);
    expect(loggerErrorSpy).toHaveBeenCalledWith(`Error creating matter node storage backup from ${CYAN}${storageDir}${nf} to ${CYAN}backup${nf}:`, error);
  });
});
