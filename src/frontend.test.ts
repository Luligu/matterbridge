// src\frontend.express.test.ts

const MATTER_PORT = 6005;
const FRONTEND_PORT = 8285;
const NAME = 'Frontend';
const HOMEDIR = path.join('jest', NAME);

process.argv = ['node', 'frontend.test.js', '-novirtual', '-test', '-homedir', HOMEDIR, '-frontend', FRONTEND_PORT.toString(), '-port', MATTER_PORT.toString()];

import { jest } from '@jest/globals';

jest.unstable_mockModule('node:http', async () => {
  const originalModule = jest.requireActual<typeof import('node:http')>('node:http');
  return {
    ...originalModule,
    createServer: jest.fn((...args) => {
      return (originalModule.createServer as typeof originalModule.createServer)(...(args as any));
    }),
  };
});
const http = await import('node:http');
const createServerMock = http.createServer as jest.MockedFunction<typeof http.createServer>;

import path from 'node:path';
import { rmSync, writeFileSync } from 'node:fs';
import { AnsiLogger, db, LogLevel, rs, UNDERLINE, UNDERLINEOFF, YELLOW } from 'node-ansi-logger';

// Dynamically import after mocking
const { Matterbridge } = await import('./matterbridge.ts');
const { Frontend } = await import('./frontend.ts');
import type { Matterbridge as MatterbridgeType } from './matterbridge.ts';
import type { Frontend as FrontendType } from './frontend.ts';
import { cliEmitter } from './cliEmitter.ts';

/*
const processExitSpy = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
  return undefined as never;
});
*/
const startSpy = jest.spyOn(Frontend.prototype, 'start');
const stopSpy = jest.spyOn(Frontend.prototype, 'stop');

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

describe('Matterbridge frontend', () => {
  let matterbridge: MatterbridgeType;
  let frontend: FrontendType;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('Verify mock of createServer', () => {
    // Call the createServer mock to ensure it is defined
    http.createServer();
    // Verify that the createServer mock is called
    expect(createServerMock).toBeDefined();
    expect(createServerMock).toHaveBeenCalled();
  });

  test('Matterbridge.loadInstance(true)', async () => {
    // Load the Matterbridge instance with frontend enabled
    matterbridge = await Matterbridge.loadInstance(true);
    frontend = matterbridge.frontend;
    expect(matterbridge).toBeDefined();
    expect(frontend).toBeDefined();

    await new Promise<void>((resolve) => {
      frontend.once('server_listening', () => resolve());
    });

    expect((matterbridge as any).initialized).toBe(true);
    expect((matterbridge as any).frontend.httpServer).toBeDefined();
    expect((matterbridge as any).frontend.httpsServer).toBeUndefined();
    expect((matterbridge as any).frontend.expressApp).toBeDefined();
    expect((matterbridge as any).frontend.webSocketServer).toBeDefined();
    expect(startSpy).toHaveBeenNthCalledWith(1, FRONTEND_PORT);
    expect(createServerMock).toHaveBeenCalled();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Initializing the frontend http server on port ${YELLOW}${FRONTEND_PORT}${db}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`The frontend http server is listening on`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`The WebSocketServer is listening on`));
  }, 60000);

  test('Frontend cliEmitter', () => {
    // Test the cliEmitter functionality
    expect(cliEmitter).toBeDefined();
    expect(cliEmitter.on).toBeDefined();
    expect(cliEmitter.emit).toBeDefined();
    expect(cliEmitter.listeners('uptime')).toHaveLength(1);
    expect(cliEmitter.listeners('memory')).toHaveLength(1);
    expect(cliEmitter.listeners('cpu')).toHaveLength(1);

    cliEmitter.emit('uptime', 123456);
    cliEmitter.emit('memory', 123456789);
    cliEmitter.emit('cpu', 12.34);
  });

  test('Frontend formatMemoryUsage', () => {
    // Test the formatMemoryUsage  functionality
    expect((frontend as any).formatMemoryUsage(1024 ** 3)).toBe('1.00 GB');
    expect((frontend as any).formatMemoryUsage(1024 ** 2)).toBe('1.00 MB');
    expect((frontend as any).formatMemoryUsage(3000)).toBe('2.93 KB');
  });

  test('Frontend formatOsUpTime', () => {
    // Test the formatOsUpTime functionality
    expect((frontend as any).formatOsUpTime(123456)).toBe('1 day');
    expect((frontend as any).formatOsUpTime(3800)).toBe('1 hour');
    expect((frontend as any).formatOsUpTime(3600)).toBe('1 hour');
    expect((frontend as any).formatOsUpTime(65)).toBe('1 minute');
    expect((frontend as any).formatOsUpTime(60)).toBe('1 minute');
    expect((frontend as any).formatOsUpTime(30)).toBe('30 seconds');
    expect((frontend as any).formatOsUpTime(0)).toBe('0 seconds');
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

  test('Frontend.start() with createServerMock', async () => {
    process.argv = ['node', 'frontend.test.js', '-ingress', '-novirtual', '-test', '-homedir', HOMEDIR, '-frontend', FRONTEND_PORT.toString(), '-port', MATTER_PORT.toString()];

    createServerMock.mockImplementationOnce(() => {
      throw new Error('Test error');
    });

    frontend.start(FRONTEND_PORT);
    await new Promise<void>((resolve) => {
      frontend.once('server_error', () => resolve());
    });
    expect((matterbridge as any).initialized).toBe(true);
    expect((matterbridge as any).frontend.httpServer).toBeUndefined();
    expect((matterbridge as any).frontend.httpsServer).toBeUndefined();
    expect((matterbridge as any).frontend.expressApp).toBeDefined();
    expect((matterbridge as any).frontend.webSocketServer).toBeUndefined();
    expect(startSpy).toHaveBeenNthCalledWith(1, FRONTEND_PORT);
    expect(createServerMock).toHaveBeenCalled();
  });

  test('Frontend.start() -ingress', async () => {
    process.argv = ['node', 'frontend.test.js', '-ingress', '-novirtual', '-test', '-homedir', HOMEDIR, '-frontend', FRONTEND_PORT.toString(), '-port', MATTER_PORT.toString()];
    frontend.start(FRONTEND_PORT);
    await new Promise<void>((resolve) => {
      frontend.once('server_listening', () => resolve());
    });
    expect((matterbridge as any).initialized).toBe(true);
    expect((matterbridge as any).frontend.httpServer).toBeDefined();
    expect((matterbridge as any).frontend.httpsServer).toBeUndefined();
    expect((matterbridge as any).frontend.expressApp).toBeDefined();
    expect((matterbridge as any).frontend.webSocketServer).toBeDefined();
    expect(startSpy).toHaveBeenNthCalledWith(1, FRONTEND_PORT);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Initializing the frontend http server on port ${YELLOW}${FRONTEND_PORT}${db}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`The frontend http server is listening on ${UNDERLINE}http://0.0.0.0:${FRONTEND_PORT}${UNDERLINEOFF}${rs}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`The WebSocketServer is listening on`));

    // Test httpServer on error
    const errorEACCES = new Error('Test error');
    (errorEACCES as any).code = 'EACCES';
    (frontend as any).httpServer.emit('error', errorEACCES);

    const errorEADDRINUSE = new Error('Test error');
    (errorEADDRINUSE as any).code = 'EADDRINUSE';
    (frontend as any).httpServer.emit('error', errorEADDRINUSE);

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Port ${FRONTEND_PORT} requires elevated privileges`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Port ${FRONTEND_PORT} is already in use`);
  });

  test('Frontend.stop() -ingress', async () => {
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

  test('Frontend.start() -ssl without certs', async () => {
    process.argv = ['node', 'frontend.test.js', '-ssl', '-novirtual', '-test', '-homedir', HOMEDIR, '-frontend', FRONTEND_PORT.toString(), '-port', MATTER_PORT.toString()];

    frontend.start(FRONTEND_PORT);
    await new Promise<void>((resolve) => {
      frontend.once('server_error', () => resolve());
    });
    expect((matterbridge as any).initialized).toBe(true);
    expect((matterbridge as any).frontend.httpServer).toBeUndefined();
    expect((matterbridge as any).frontend.httpsServer).toBeUndefined();
    expect((matterbridge as any).frontend.expressApp).toBeDefined();
    expect((matterbridge as any).frontend.webSocketServer).toBeUndefined();
    expect(startSpy).toHaveBeenNthCalledWith(1, FRONTEND_PORT);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Error reading certificate file`));
  });

  test('Frontend.start() -ssl without key certs', async () => {
    process.argv = ['node', 'frontend.test.js', '-ssl', '-novirtual', '-test', '-homedir', HOMEDIR, '-frontend', FRONTEND_PORT.toString(), '-port', MATTER_PORT.toString()];

    writeFileSync(path.join(matterbridge.matterbridgeDirectory, 'certs/cert.pem'), 'cert', 'utf8');

    frontend.start(FRONTEND_PORT);
    await new Promise<void>((resolve) => {
      frontend.once('server_error', () => resolve());
    });
    expect((matterbridge as any).initialized).toBe(true);
    expect((matterbridge as any).frontend.httpServer).toBeUndefined();
    expect((matterbridge as any).frontend.httpsServer).toBeUndefined();
    expect((matterbridge as any).frontend.expressApp).toBeDefined();
    expect((matterbridge as any).frontend.webSocketServer).toBeUndefined();
    expect(startSpy).toHaveBeenNthCalledWith(1, FRONTEND_PORT);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Error reading key file`));
  });

  test('Frontend.start() -ssl without ca certs', async () => {
    process.argv = ['node', 'frontend.test.js', '-ssl', '-novirtual', '-test', '-homedir', HOMEDIR, '-frontend', FRONTEND_PORT.toString(), '-port', MATTER_PORT.toString()];

    writeFileSync(path.join(matterbridge.matterbridgeDirectory, 'certs/cert.pem'), 'cert', 'utf8');
    writeFileSync(path.join(matterbridge.matterbridgeDirectory, 'certs/key.pem'), 'key', 'utf8');

    frontend.start(FRONTEND_PORT);
    await new Promise<void>((resolve) => {
      frontend.once('server_error', () => resolve());
    });
    expect((matterbridge as any).initialized).toBe(true);
    expect((matterbridge as any).frontend.httpServer).toBeUndefined();
    expect((matterbridge as any).frontend.httpsServer).toBeUndefined();
    expect((matterbridge as any).frontend.expressApp).toBeDefined();
    expect((matterbridge as any).frontend.webSocketServer).toBeUndefined();
    expect(startSpy).toHaveBeenNthCalledWith(1, FRONTEND_PORT);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`ca.pem not loaded`));
  });

  test('Frontend.start() -ssl', async () => {
    process.argv = ['node', 'frontend.test.js', '-ssl', '-novirtual', '-test', '-homedir', HOMEDIR, '-frontend', FRONTEND_PORT.toString(), '-port', MATTER_PORT.toString()];

    writeFileSync(path.join(matterbridge.matterbridgeDirectory, 'certs/cert.pem'), 'cert', 'utf8');
    writeFileSync(path.join(matterbridge.matterbridgeDirectory, 'certs/key.pem'), 'key', 'utf8');
    writeFileSync(path.join(matterbridge.matterbridgeDirectory, 'certs/ca.pem'), 'ca', 'utf8');

    frontend.start();
    await new Promise<void>((resolve) => {
      frontend.once('server_error', () => resolve());
    });
    expect((matterbridge as any).initialized).toBe(true);
    expect((matterbridge as any).frontend.httpServer).toBeUndefined();
    expect((matterbridge as any).frontend.httpsServer).toBeUndefined();
    expect((matterbridge as any).frontend.expressApp).toBeDefined();
    expect((matterbridge as any).frontend.webSocketServer).toBeUndefined();
    expect(startSpy).toHaveBeenNthCalledWith(1);
  });

  test('Matterbridge.destroyInstance()', async () => {
    // Close the Matterbridge instance
    await matterbridge.destroyInstance(10, 1000);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Cleanup completed. Shutting down...`);

    expect(stopSpy).toHaveBeenCalledTimes(1);
    expect((matterbridge as any).frontend.httpServer).toBeUndefined();
    expect((matterbridge as any).frontend.httpsServer).toBeUndefined();
    expect((matterbridge as any).frontend.expressApp).toBeUndefined();
    expect((matterbridge as any).frontend.webSocketServer).toBeUndefined();
  });
});
