/* eslint-disable @typescript-eslint/no-unused-vars */

/* eslint-disable @typescript-eslint/no-explicit-any */

process.argv = ['node', 'matterbridge.test.js', '-logger', 'debug', '-matterlogger', 'error', '-bridge', '-profile', 'Jest', '-port', '5555', '-passcode', '123456', '-discriminator', '3860'];

import { jest } from '@jest/globals';

// jest.mock('@project-chip/matter-node.js/util');

import { AnsiLogger, db, LogLevel, nf, rs, UNDERLINE, UNDERLINEOFF } from 'node-ansi-logger';
import { Matterbridge } from './matterbridge.js';
import { wait, waiter } from './utils/utils.js';
import { MdnsService } from '@matter/main/protocol';

// Default colors
const plg = '\u001B[38;5;33m';
const dev = '\u001B[38;5;79m';
const typ = '\u001B[38;5;207m';

describe('Matterbridge loadInstance() and cleanup() -bridge mode', () => {
  let matterbridge: Matterbridge;
  let loggerLogSpy: jest.SpiedFunction<(level: LogLevel, message: string, ...parameters: any[]) => void>;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let consoleDebugSpy: jest.SpiedFunction<typeof console.debug>;
  let consoleInfoSpy: jest.SpiedFunction<typeof console.info>;
  let consoleWarnSpy: jest.SpiedFunction<typeof console.info>;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeAll(async () => {
    // Spy on and mock the AnsiLogger.log method
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {
      // console.error(`Mocked log: ${level} - ${message}`, ...parameters);
    });
    // Spy on and mock console.log
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {
      // console.error(args);
    });
    // Spy on and mock console.log
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation((...args: any[]) => {
      // console.error(args);
    });
    // Spy on and mock console.log
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation((...args: any[]) => {
      // console.error(args);
    });
    // Spy on and mock console.log
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation((...args: any[]) => {
      // console.warn(args);
    });
    // Spy on and mock console.log
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args: any[]) => {
      // console.error(args);
    });
  });

  beforeEach(() => {
    loggerLogSpy?.mockClear();
    consoleLogSpy?.mockClear();
    consoleDebugSpy?.mockClear();
    consoleInfoSpy?.mockClear();
    consoleWarnSpy?.mockClear();
    consoleErrorSpy?.mockClear();
  });

  afterAll(async () => {
    loggerLogSpy?.mockRestore();
    consoleLogSpy?.mockRestore();
    consoleDebugSpy?.mockRestore();
    consoleInfoSpy?.mockRestore();
    consoleWarnSpy?.mockRestore();
    consoleErrorSpy?.mockRestore();
  }, 60000);

  test('Matterbridge.loadInstance(true) -bridge mode', async () => {
    matterbridge = await Matterbridge.loadInstance(true);

    expect(matterbridge).toBeDefined();
    expect(matterbridge.profile).toBe('Jest');
    expect(matterbridge.bridgeMode).toBe('bridge');

    expect((matterbridge as any).initialized).toBeTruthy();
    expect((matterbridge as any).log).toBeDefined();
    expect((matterbridge as any).homeDirectory).not.toBe('');
    expect((matterbridge as any).matterbridgeDirectory).not.toBe('');
    expect((matterbridge as any).nodeStorage).toBeDefined();
    expect((matterbridge as any).nodeContext).toBeDefined();
    expect((matterbridge as any).plugins).toBeDefined();
    expect((matterbridge as any).devices.size).toBe(0);

    expect((matterbridge as any).frontend.httpServer).toBeDefined();
    expect((matterbridge as any).frontend.httpsServer).toBeUndefined();
    expect((matterbridge as any).frontend.expressApp).toBeDefined();
    expect((matterbridge as any).frontend.webSocketServer).toBeDefined();

    expect((matterbridge as any).nodeStorage).toBeDefined();
    expect((matterbridge as any).nodeContext).toBeDefined();
    expect((matterbridge as any).matterStorageName).toBe('matterstorage.Jest');
    expect((matterbridge as any).nodeStorageName).toBe('storage.Jest');

    expect((matterbridge as any).matterStorageService).toBeDefined();
    expect((matterbridge as any).matterStorageManager).toBeDefined();
    expect((matterbridge as any).matterbridgeContext).toBeDefined();
    expect((matterbridge as any).mattercontrollerContext).toBeUndefined();
    expect((matterbridge as any).serverNode).toBeDefined();
    expect((matterbridge as any).aggregatorNode).toBeDefined();

    expect((matterbridge as any).mdnsInterface).toBe(undefined);
    expect((matterbridge as any).port).toBe(5555 + 1);
    expect((matterbridge as any).passcode).toBe(123456 + 1);
    expect((matterbridge as any).discriminator).toBe(3860 + 1);

    await wait(5000, 'Wait for matter to load', true);
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `The frontend http server is listening on ${UNDERLINE}http://${matterbridge.systemInformation.ipv4Address}:8283${UNDERLINEOFF}${rs}`);

    await waiter(
      'Matter server started',
      () => {
        return (matterbridge as any).configureTimeout !== undefined && (matterbridge as any).reachabilityTimeout !== undefined;
      },
      false,
      60000,
      1000,
      true,
    );
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.NOTICE, `Starting Matterbridge server node`);
    await wait(1000, 'Wait for matter to load', true);
  }, 60000);

  test('Matterbridge.destroyInstance() -bridge mode', async () => {
    await matterbridge.destroyInstance();
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.NOTICE, `Cleanup completed. Shutting down...`);
    await matterbridge.environment.get(MdnsService)[Symbol.asyncDispose]();
    await wait(1000, 'Wait for matter to unload', false);
  }, 60000);
});
