/* eslint-disable @typescript-eslint/no-unused-vars */

/* eslint-disable @typescript-eslint/no-explicit-any */

process.argv = ['node', 'matterbridge.test.js', '-debug', '-matterlogger', 'fatal', '-bridge', '-profile', 'Jest'];

import { jest } from '@jest/globals';

jest.mock('@project-chip/matter-node.js/util');

import { AnsiLogger, db, LogLevel, nf } from 'node-ansi-logger';
import { Matterbridge } from './matterbridge.js';
import { wait, waiter } from './utils/utils.js';

// Default colors
const plg = '\u001B[38;5;33m';
const dev = '\u001B[38;5;79m';
const typ = '\u001B[38;5;207m';

describe('Matterbridge loadInstance() and cleanup() -bridge mode', () => {
  let matterbridge: Matterbridge;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let loggerLogSpy: jest.SpiedFunction<(level: LogLevel, message: string, ...parameters: any[]) => void>;

  beforeAll(async () => {
    // Spy on and mock the AnsiLogger.log method
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {
      // console.error(`Mocked log: ${level} - ${message}`, ...parameters);
    });
    // Spy on and mock console.log
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {
      // console.error(args);
    });
  });

  beforeEach(() => {
    loggerLogSpy.mockClear();
    consoleLogSpy.mockClear();
  });

  afterAll(async () => {
    loggerLogSpy.mockRestore();
    consoleLogSpy.mockRestore();
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
    expect((matterbridge as any).registeredDevices).toHaveLength(0);

    expect((matterbridge as any).httpServer).toBeDefined();
    expect((matterbridge as any).httpsServer).toBeUndefined();
    expect((matterbridge as any).expressApp).toBeDefined();
    expect((matterbridge as any).webSocketServer).toBeDefined();

    expect((matterbridge as any).nodeStorage).toBeDefined();
    expect((matterbridge as any).nodeContext).toBeDefined();
    expect((matterbridge as any).matterStorageName).toBe('matterbridge.Jest.json');
    expect((matterbridge as any).nodeStorageName).toBe('storage.Jest');

    expect((matterbridge as any).storageManager).toBeDefined();
    expect((matterbridge as any).matterbridgeContext).toBeDefined();
    expect((matterbridge as any).mattercontrollerContext).toBeUndefined();
    expect((matterbridge as any).matterServer).toBeDefined();
    expect((matterbridge as any).matterAggregator).toBeDefined();
    expect((matterbridge as any).commissioningServer).toBeDefined();
    expect((matterbridge as any).commissioningController).toBeUndefined();

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
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.NOTICE, `Matter server started`);
    await wait(1000, 'Wait for matter to load', false);
  }, 60000);

  test('Matterbridge.destroyInstance() -bridge mode', async () => {
    await matterbridge.destroyInstance();
    // console.error(`Matterbridge.destroyInstance() -bridge mode completed`);
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.NOTICE, `Cleanup completed. Shutting down...`);
    await wait(1000, 'Wait for matter to unload', false);
  }, 60000);
});
