// src\frontend.express.test.ts

const MATTER_PORT = 6005;
const NAME = 'Frontend';
const HOMEDIR = path.join('jest', NAME);

process.argv = ['node', 'frontend.test.js', '-novirtual', '-test', '-homedir', HOMEDIR, '-port', MATTER_PORT.toString()];

import { expect, jest } from '@jest/globals';

import path from 'node:path';
import { rmSync } from 'node:fs';
import { AnsiLogger, db, LogLevel, rs, UNDERLINE, UNDERLINEOFF, YELLOW } from 'node-ansi-logger';

import { Matterbridge } from './matterbridge.ts';
import { Frontend } from './frontend.ts';

const processExitSpy = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
  return undefined as never;
});
const startSpy = jest.spyOn(Frontend.prototype, 'start');
const stopSpy = jest.spyOn(Frontend.prototype, 'stop');

let loggerLogSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.log>;
let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
let consoleDebugSpy: jest.SpiedFunction<typeof console.log>;
let consoleInfoSpy: jest.SpiedFunction<typeof console.log>;
let consoleWarnSpy: jest.SpiedFunction<typeof console.log>;
let consoleErrorSpy: jest.SpiedFunction<typeof console.log>;
const debug = false;

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

describe('Matterbridge frontend', () => {
  let matterbridge: Matterbridge;
  let frontend: Frontend;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('Matterbridge.loadInstance(true)', async () => {
    // Load the Matterbridge instance with frontend enabled
    matterbridge = await Matterbridge.loadInstance(true);
    frontend = matterbridge.frontend;
    expect(matterbridge).toBeDefined();
    await new Promise<void>((resolve) => {
      frontend.once('server_listening', () => resolve());
    });
    expect((matterbridge as any).initialized).toBe(true);
    expect((matterbridge as any).frontend.httpServer).toBeDefined();
    expect((matterbridge as any).frontend.httpsServer).toBeUndefined();
    expect((matterbridge as any).frontend.expressApp).toBeDefined();
    expect((matterbridge as any).frontend.webSocketServer).toBeDefined();
    expect(startSpy).toHaveBeenNthCalledWith(1, undefined);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Initializing the frontend http server on port ${YELLOW}8283${db}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`The frontend http server is listening on`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`The WebSocketServer is listening on`));
  });

  test('Frontend.stop()', async () => {
    // Stop the frontend
    await matterbridge.frontend.stop();

    expect(stopSpy).toHaveBeenCalledTimes(1);
    expect((matterbridge as any).frontend.httpServer).toBeUndefined();
    expect((matterbridge as any).frontend.httpsServer).toBeUndefined();
    expect((matterbridge as any).frontend.expressApp).toBeUndefined();
    expect((matterbridge as any).frontend.webSocketServer).toBeUndefined();

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Stopping the frontend...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Frontend app closed successfully`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `WebSocket server closed successfully`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Http server closed successfully`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Frontend stopped successfully`);
  });

  test('Matterbridge.destroyInstance()', async () => {
    // Close the Matterbridge instance
    await matterbridge.destroyInstance(10, 10);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Cleanup completed. Shutting down...`);
  });
});
