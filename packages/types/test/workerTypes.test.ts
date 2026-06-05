/**
 * @description Tests for worker data type guards in workerTypes.
 * @file workerTypes.test.ts
 * @author Luca Liguori
 * @created 2026-05-31
 * @version 1.0.0
 * @license Apache-2.0
 */

import { jest } from '@jest/globals';

import { isArchiveWorkerData, isSpawnWorkerData, isWorkerData } from '../src/workerTypes.js';

describe('Worker data type guards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  const base = { threadName: 'SystemCheck', logLevel: 'info', debug: false, verbose: false, tracker: false };
  const spawn = { ...base, command: 'npm', args: ['install'], packageCommand: 'install', packageName: 'some-pkg' };
  const archive = { ...base, command: 'zip', archivePath: '/tmp/out.zip', sourcePaths: ['/tmp/src'], destinationPath: '/tmp/dst' };

  describe('isWorkerData', () => {
    test('should return true for valid base worker data', () => {
      expect(isWorkerData(base)).toBe(true);
    });

    test('should return true for valid spawn worker data', () => {
      expect(isWorkerData(spawn)).toBe(true);
    });

    test('should return true for valid archive worker data', () => {
      expect(isWorkerData(archive)).toBe(true);
    });

    test('should return false for null', () => {
      expect(isWorkerData(null)).toBe(false);
    });

    test('should return false for a non-object', () => {
      expect(isWorkerData('string')).toBe(false);
    });

    test('should return false when threadName is missing', () => {
      const { threadName: _, ...rest } = base;
      expect(isWorkerData(rest)).toBe(false);
    });

    test('should return false when logLevel is not a string', () => {
      expect(isWorkerData({ ...base, logLevel: 42 })).toBe(false);
    });

    test('should return false when debug is not a boolean', () => {
      expect(isWorkerData({ ...base, debug: 'true' })).toBe(false);
    });

    test('should return false when verbose is not a boolean', () => {
      expect(isWorkerData({ ...base, verbose: 1 })).toBe(false);
    });

    test('should return false when tracker is not a boolean', () => {
      expect(isWorkerData({ ...base, tracker: null })).toBe(false);
    });
  });

  describe('isSpawnWorkerData', () => {
    test('should return true for valid spawn worker data', () => {
      expect(isSpawnWorkerData(spawn)).toBe(true);
    });

    test('should return false for plain base worker data', () => {
      expect(isSpawnWorkerData(base)).toBe(false);
    });

    test('should return false for archive worker data', () => {
      expect(isSpawnWorkerData(archive)).toBe(false);
    });

    test('should return false when command is missing', () => {
      const { command: _, ...rest } = spawn;
      expect(isSpawnWorkerData(rest)).toBe(false);
    });

    test('should return false when args is not an array', () => {
      expect(isSpawnWorkerData({ ...spawn, args: 'install' })).toBe(false);
    });

    test('should return false when packageCommand is an invalid value', () => {
      expect(isSpawnWorkerData({ ...spawn, packageCommand: 'update' })).toBe(false);
    });

    test('should return true when packageCommand is uninstall', () => {
      expect(isSpawnWorkerData({ ...spawn, packageCommand: 'uninstall' })).toBe(true);
    });

    test('should return false when packageName is not a string', () => {
      expect(isSpawnWorkerData({ ...spawn, packageName: 99 })).toBe(false);
    });

    test('should return false for null', () => {
      expect(isSpawnWorkerData(null)).toBe(false);
    });
  });

  describe('isArchiveWorkerData', () => {
    test('should return true for valid archive worker data', () => {
      expect(isArchiveWorkerData(archive)).toBe(true);
    });

    test('should return false for plain base worker data', () => {
      expect(isArchiveWorkerData(base)).toBe(false);
    });

    test('should return false for spawn worker data', () => {
      expect(isArchiveWorkerData(spawn)).toBe(false);
    });

    test('should return false when archivePath is missing', () => {
      const { archivePath: _, ...rest } = archive;
      expect(isArchiveWorkerData(rest)).toBe(false);
    });

    test('should return false when archivePath is not a string', () => {
      expect(isArchiveWorkerData({ ...archive, archivePath: 42 })).toBe(false);
    });

    test('should return false when sourcePaths is not an array', () => {
      expect(isArchiveWorkerData({ ...archive, sourcePaths: '/tmp/src' })).toBe(false);
    });

    test('should return false when destinationPath is not a string', () => {
      expect(isArchiveWorkerData({ ...archive, destinationPath: true })).toBe(false);
    });

    test('should return false when command is not a string', () => {
      expect(isArchiveWorkerData({ ...archive, command: 123 })).toBe(false);
    });

    test('should return false for null', () => {
      expect(isArchiveWorkerData(null)).toBe(false);
    });
  });
});
