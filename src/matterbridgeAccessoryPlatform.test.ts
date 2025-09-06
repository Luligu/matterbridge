// src\matterbridgeAccessoryPlatform.test.ts

const NAME = 'MatterbridgeAccessoryPlatform';
const HOMEDIR = path.join('jest', NAME);

process.argv = ['node', 'matterbridge.test.js', '-novirtual', '-frontend', '0', '-homedir', HOMEDIR];

import path from 'node:path';
import { rmSync } from 'node:fs';

import { jest } from '@jest/globals';
import { AnsiLogger } from 'node-ansi-logger';

import { Matterbridge } from './matterbridge.js';
import { MatterbridgeAccessoryPlatform } from './matterbridgeAccessoryPlatform.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';

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
  const matterbridge = {
    homeDirectory: HOMEDIR,
    matterbridgeDirectory: path.join(HOMEDIR, '.matterbridge'),
    matterbridgePluginDirectory: path.join(HOMEDIR, 'Matterbridge'),
    systemInformation: { ipv4Address: undefined, ipv6Address: undefined, osRelease: 'xx.xx.xx.xx.xx.xx', nodeVersion: '22.1.10' },
    matterbridgeVersion: '3.0.0',
    log: {
      fatal: jest.fn((message: string, ...parameters: any[]) => {}),
      error: jest.fn((message: string, ...parameters: any[]) => {}),
      warn: jest.fn((message: string, ...parameters: any[]) => {}),
      notice: jest.fn((message: string, ...parameters: any[]) => {}),
      info: jest.fn((message: string, ...parameters: any[]) => {}),
      debug: jest.fn((message: string, ...parameters: any[]) => {}),
    } as unknown as AnsiLogger,
    getDevices: jest.fn(() => []),
    getPlugins: jest.fn(() => []),
    addBridgedEndpoint: jest.fn(async (pluginName: string, device: MatterbridgeEndpoint) => {}),
    removeBridgedEndpoint: jest.fn(async (pluginName: string, device: MatterbridgeEndpoint) => {}),
    removeAllBridgedEndpoints: jest.fn(async (pluginName: string) => {}),
  } as unknown as Matterbridge;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('create a MatterbridgeAccessoryPlatform', async () => {
    const platform = new MatterbridgeAccessoryPlatform(matterbridge, matterbridge.log, { name: 'test', type: 'type', debug: false, unregisterOnShutdown: false });
    expect(platform.type).toBe('AccessoryPlatform');
  });
});
