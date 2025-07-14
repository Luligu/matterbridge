import path from 'node:path';

import { vi, describe, it, expect, beforeEach, afterEach, MockInstance } from 'vitest';
import { AnsiLogger, LogLevel, TimestampFormat } from 'node-ansi-logger';

import * as spawn from '../src/utils/spawn.ts';
import { Matterbridge } from '../src/matterbridge.ts';

const NAME = 'ViMatterbridgeGlobal';
const HOMEDIR = path.join('jest', NAME);

process.argv = ['node', 'matterbridge.test.js', '-novirtual', '-frontend', '0', '-homedir', HOMEDIR, '-logger', 'debug', '-matterlogger', 'debug'];

// Partial mock for @matter/main, preserving all actual exports except Logger
vi.mock('@matter/main', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    Logger: {
      log: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
      addLogger: vi.fn(),
      setLogger: vi.fn(),
      removeLogger: vi.fn(),
      toJSON: vi.fn(() => ''),
    },
  };
});

let loggerLogSpy: MockInstance<typeof AnsiLogger.prototype.log>;
let consoleLogSpy: MockInstance<typeof console.log>;
let consoleDebugSpy: MockInstance<typeof console.debug>;
let consoleInfoSpy: MockInstance<typeof console.info>;
let consoleWarnSpy: MockInstance<typeof console.warn>;
let consoleErrorSpy: MockInstance<typeof console.error>;
const debug = false; // Set to true to enable debug logging

if (!debug) {
  loggerLogSpy = vi.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {});
  consoleLogSpy = vi.spyOn(console, 'log').mockImplementation((...args: any[]) => {});
  consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation((...args: any[]) => {});
  consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation((...args: any[]) => {});
  consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation((...args: any[]) => {});
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args: any[]) => {});
} else {
  loggerLogSpy = vi.spyOn(AnsiLogger.prototype, 'log');
  consoleLogSpy = vi.spyOn(console, 'log');
  consoleDebugSpy = vi.spyOn(console, 'debug');
  consoleInfoSpy = vi.spyOn(console, 'info');
  consoleWarnSpy = vi.spyOn(console, 'warn');
  consoleErrorSpy = vi.spyOn(console, 'error');
}

describe('Matterbridge', () => {
  let matterbridge: Matterbridge;

  beforeEach(async () => {
    matterbridge = await Matterbridge.loadInstance(false);
    // Set up required properties/mocks
    matterbridge.log = { debug: vi.fn(), info: vi.fn(), notice: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn(), now: vi.fn() } as any;
    // matterbridge.log = new AnsiLogger({ logName: 'Matterbridge', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });
    matterbridge.plugins = { array: () => [], clear: vi.fn(), [Symbol.iterator]: function* () {} } as any;
    matterbridge.devices = { array: () => [], clear: vi.fn(), [Symbol.iterator]: function* () {} } as any;
    matterbridge.frontend = {
      start: vi.fn(),
      stop: vi.fn(),
      wssSendRefreshRequired: vi.fn(),
      wssSendRestartRequired: vi.fn(),
      wssSendSnackbarMessage: vi.fn(),
      wssSendMessage: vi.fn(),
    } as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize system and matterbridge information', () => {
    expect(matterbridge.systemInformation).toBeDefined();
    expect(matterbridge.matterbridgeInformation).toBeDefined();
  });

  it('should emit initialize_completed after initialize', async () => {
    const spy = vi.fn();
    matterbridge.on('initialize_completed', spy);
    await matterbridge.initialize();
    expect(spy).toHaveBeenCalled();
    expect((matterbridge as any)['initialized']).toBe(true);
  });

  it('should call parseCommandLine during initialize', async () => {
    const spy = vi.spyOn(matterbridge as any, 'parseCommandLine').mockResolvedValue(undefined);
    await matterbridge.initialize();
    expect(spy).toHaveBeenCalled();
  });

  it('should log system info in logNodeAndSystemInfo', async () => {
    await (matterbridge as any)['logNodeAndSystemInfo']();
    expect(matterbridge.log.debug).toHaveBeenCalled();
  });

  it('should register and deregister process handlers', () => {
    (matterbridge as any)['registerProcessHandlers']();
    (matterbridge as any)['deregisterProcessHandlers']();
    expect(matterbridge.log.error).not.toHaveBeenCalled();
  });

  it('should call cleanup and emit cleanup events', async () => {
    (matterbridge as any)['initialized'] = true;
    (matterbridge as any)['hasCleanupStarted'] = false;
    const spyStart = vi.fn();
    const spyComplete = vi.fn();
    matterbridge.on('cleanup_started', spyStart);
    matterbridge.on('cleanup_completed', spyComplete);
    await (matterbridge as any)['cleanup']('test cleanup');
    expect(spyStart).toHaveBeenCalled();
    expect(spyComplete).toHaveBeenCalled();
  });

  it('should not run cleanup if already started', async () => {
    (matterbridge as any)['initialized'] = true;
    (matterbridge as any)['hasCleanupStarted'] = true;
    const debugSpy = matterbridge.log.debug as any;
    await (matterbridge as any)['cleanup']('test cleanup');
    expect(debugSpy).toHaveBeenCalledWith('Cleanup already started...');
  });

  it('should get devices using getDevices()', () => {
    const fakeDevices = [{ id: 1 }, { id: 2 }];
    matterbridge.devices.array = vi.fn(() => fakeDevices) as any;
    expect(matterbridge.getDevices()).toBe(fakeDevices);
  });

  it('should get plugins using getPlugins()', () => {
    const fakePlugins = [{ name: 'p1' }, { name: 'p2' }];
    matterbridge.plugins.array = vi.fn(() => fakePlugins) as any;
    expect(matterbridge.getPlugins()).toBe(fakePlugins);
  });

  it('should set log level and propagate to dependencies', async () => {
    const setLevel = vi.fn();
    matterbridge.frontend.logLevel = LogLevel.NONE; // Set to NONE initially
    matterbridge.devices.logLevel = LogLevel.NONE;
    matterbridge.plugins.logLevel = LogLevel.NONE;
    (global as any).MatterbridgeEndpoint = { logLevel: LogLevel.NONE };
    matterbridge.log = { debug: vi.fn() } as any;
    await matterbridge.setLogLevel(LogLevel.INFO);
    expect(matterbridge.frontend.logLevel).toBe(LogLevel.INFO);
    expect(matterbridge.devices.logLevel).toBe(LogLevel.INFO);
    expect(matterbridge.plugins.logLevel).toBe(LogLevel.INFO);
    expect(matterbridge.log.debug).toHaveBeenCalled();
  });

  it('should emit and listen to custom events', () => {
    const handler = vi.fn();
    matterbridge.on('online', handler);
    matterbridge.emit('online', 'nodeid');
    expect(handler).toHaveBeenCalledWith('nodeid');
  });

  it('should call destroyInstance and cleanup', async () => {
    const cleanupSpy = vi.spyOn(matterbridge as any, 'cleanup').mockResolvedValue(undefined);
    matterbridge.log.info = vi.fn();
    await matterbridge.destroyInstance(10);
    expect(cleanupSpy).toHaveBeenCalled();
    expect(matterbridge.log.info).toHaveBeenCalledWith(expect.stringContaining('Destroy instance...'));
  });

  it('should call restartProcess and cleanup', async () => {
    const cleanupSpy = vi.spyOn(matterbridge as any, 'cleanup').mockResolvedValue(undefined);
    await matterbridge.restartProcess();
    expect(cleanupSpy).toHaveBeenCalledWith('restarting...', true);
  });

  it('should call shutdownProcess and cleanup', async () => {
    const cleanupSpy = vi.spyOn(matterbridge as any, 'cleanup').mockResolvedValue(undefined);
    await matterbridge.shutdownProcess();
    expect(cleanupSpy).toHaveBeenCalledWith('shutting down...', false);
  });

  it('should call updateProcess and cleanup', async () => {
    const spawnSpy = vi.spyOn(spawn, 'spawnCommand').mockResolvedValueOnce(true);
    const cleanupSpy = vi.spyOn(matterbridge as any, 'cleanup').mockResolvedValue(undefined);
    matterbridge.log.info = vi.fn();
    await matterbridge.updateProcess();
    expect(spawnSpy).toHaveBeenCalledWith(matterbridge, 'npm', ['install', '-g', 'matterbridge', '--omit=dev', '--verbose']);
    expect(cleanupSpy).toHaveBeenCalledWith('updating...', false);
    expect(matterbridge.log.info).toHaveBeenCalledWith(expect.stringContaining('Updating matterbridge...'));
    expect((matterbridge.frontend as any).wssSendRestartRequired).toHaveBeenCalled();
  });

  it('should call unregisterAndShutdownProcess and cleanup', async () => {
    const cleanupSpy = vi.spyOn(matterbridge as any, 'cleanup').mockResolvedValue(undefined);
    matterbridge.log.info = vi.fn();
    matterbridge.plugins = [{ name: 'p1' }] as any;
    matterbridge.removeAllBridgedEndpoints = vi.fn().mockResolvedValue(undefined);
    matterbridge.devices.clear = vi.fn();
    await matterbridge.unregisterAndShutdownProcess();
    expect(cleanupSpy).toHaveBeenCalledWith('unregistered all devices and shutting down...', false);
    expect(matterbridge.log.info).toHaveBeenCalledWith(expect.stringContaining('Unregistering all devices and shutting down...'));
  });

  it('should call shutdownProcessAndReset and cleanup', async () => {
    const cleanupSpy = vi.spyOn(matterbridge as any, 'cleanup').mockResolvedValue(undefined);
    await matterbridge.shutdownProcessAndReset();
    expect(cleanupSpy).toHaveBeenCalledWith('shutting down with reset...', false);
  });

  it('should call shutdownProcessAndFactoryReset and cleanup', async () => {
    const cleanupSpy = vi.spyOn(matterbridge as any, 'cleanup').mockResolvedValue(undefined);
    await matterbridge.shutdownProcessAndFactoryReset();
    expect(cleanupSpy).toHaveBeenCalledWith('shutting down with factory reset...', false);
  });
});
