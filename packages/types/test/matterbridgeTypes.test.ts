/**
 * @description Tests for exported constants in matterbridgeTypes.
 * @file matterbridgeTypes.test.ts
 * @author Luca Liguori
 * @created 2026-05-31
 * @version 1.0.0
 * @license Apache-2.0
 */

import { jest } from '@jest/globals';

import {
  dev,
  MATTER_LOGGER_FILE,
  MATTER_STORAGE_DIR,
  MATTERBRIDGE_BACKUP_FILE,
  MATTERBRIDGE_DIAGNOSTIC_FILE,
  MATTERBRIDGE_HISTORY_FILE,
  MATTERBRIDGE_LOGGER_FILE,
  MATTERBRIDGE_PLUGIN_CONFIG_FILE,
  MATTERBRIDGE_PLUGIN_STORAGE_FILE,
  NODE_STORAGE_DIR,
  plg,
  typ,
} from '../src/matterbridgeTypes.js';

describe('matterbridgeTypes constants', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('ANSI color constants', () => {
    test('plg should be the ANSI escape for color 33', () => {
      expect(plg).toBe('[38;5;33m');
    });

    test('dev should be the ANSI escape for color 79', () => {
      expect(dev).toBe('[38;5;79m');
    });

    test('typ should be the ANSI escape for color 207', () => {
      expect(typ).toBe('[38;5;207m');
    });
  });

  describe('file name constants', () => {
    test('MATTERBRIDGE_LOGGER_FILE should be matterbridge.log', () => {
      expect(MATTERBRIDGE_LOGGER_FILE).toBe('matterbridge.log');
    });

    test('MATTER_LOGGER_FILE should be matter.log', () => {
      expect(MATTER_LOGGER_FILE).toBe('matter.log');
    });

    test('MATTERBRIDGE_DIAGNOSTIC_FILE should be diagnostic.log', () => {
      expect(MATTERBRIDGE_DIAGNOSTIC_FILE).toBe('diagnostic.log');
    });

    test('MATTERBRIDGE_HISTORY_FILE should be history.html', () => {
      expect(MATTERBRIDGE_HISTORY_FILE).toBe('history.html');
    });

    test('MATTERBRIDGE_BACKUP_FILE should be matterbridge.backup.zip', () => {
      expect(MATTERBRIDGE_BACKUP_FILE).toBe('matterbridge.backup.zip');
    });

    test('MATTERBRIDGE_PLUGIN_STORAGE_FILE should be matterbridge.pluginstorage.zip', () => {
      expect(MATTERBRIDGE_PLUGIN_STORAGE_FILE).toBe('matterbridge.pluginstorage.zip');
    });

    test('MATTERBRIDGE_PLUGIN_CONFIG_FILE should be matterbridge.pluginconfig.zip', () => {
      expect(MATTERBRIDGE_PLUGIN_CONFIG_FILE).toBe('matterbridge.pluginconfig.zip');
    });
  });

  describe('directory name constants', () => {
    test('NODE_STORAGE_DIR should be storage', () => {
      expect(NODE_STORAGE_DIR).toBe('storage');
    });

    test('MATTER_STORAGE_DIR should be matterstorage', () => {
      expect(MATTER_STORAGE_DIR).toBe('matterstorage');
    });
  });
});
