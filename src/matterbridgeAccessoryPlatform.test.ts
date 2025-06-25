// src\matterbridgeAccessoryPlatform.test.ts

const NAME = 'MatterbridgeAccessoryPlatform';
const HOMEDIR = path.join('jest', NAME);

process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-homedir', HOMEDIR];

import { jest } from '@jest/globals';

import path from 'node:path';
import { rmSync } from 'node:fs';
import { AnsiLogger, LogLevel } from 'node-ansi-logger';

import { Matterbridge } from './matterbridge.js';
import { MatterbridgeAccessoryPlatform } from './matterbridgeAccessoryPlatform.ts';
import { MatterbridgePlatform } from './matterbridgePlatform.ts';

let loggerLogSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.log>;
let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
let consoleDebugSpy: jest.SpiedFunction<typeof console.log>;
let consoleInfoSpy: jest.SpiedFunction<typeof console.log>;
let consoleWarnSpy: jest.SpiedFunction<typeof console.log>;
let consoleErrorSpy: jest.SpiedFunction<typeof console.log>;
const debug = false; // Set to true to enable debug logging

if (!debug) {
  loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {});
  consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {});
  consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation((...args: any[]) => {});
  consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation((...args: any[]) => {});
  consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation((...args: any[]) => {});
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args: any[]) => {});
} else {
  loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log');
  consoleLogSpy = jest.spyOn(console, 'log');
  consoleDebugSpy = jest.spyOn(console, 'debug');
  consoleInfoSpy = jest.spyOn(console, 'info');
  consoleWarnSpy = jest.spyOn(console, 'warn');
  consoleErrorSpy = jest.spyOn(console, 'error');
}

// Cleanup the matter environment
rmSync(HOMEDIR, { recursive: true, force: true });

describe('Matterbridge accessory platform', () => {
  let matterbridge: Matterbridge;
  let platform: MatterbridgePlatform;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Restore all mocks
    jest.restoreAllMocks();
  }, 60000);

  test('create a MatterbridgeAccessoryPlatform', async () => {
    matterbridge = await Matterbridge.loadInstance(true);
    expect((Matterbridge as any).instance).toBeDefined();

    await new Promise<void>((resolve) => {
      matterbridge.once('online', (name) => {
        if (name === 'Matterbridge') resolve();
      });
    });

    platform = new MatterbridgeAccessoryPlatform(matterbridge, new AnsiLogger({ logName: 'Matterbridge platform' }), { name: 'test', type: 'type', debug: false, unregisterOnShutdown: false });
    expect(platform.type).toBe('AccessoryPlatform');

    // Close the Matterbridge instance
    await matterbridge.destroyInstance();
    expect((Matterbridge as any).instance).toBeUndefined();
  }, 60000);

  test('Cleanup storage', async () => {
    process.argv.push('-factoryreset');
    (matterbridge as any).initialized = true;
    await (matterbridge as any).parseCommandLine();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Factory reset done! Remove all paired fabrics from the controllers.');
  }, 60000);
});
