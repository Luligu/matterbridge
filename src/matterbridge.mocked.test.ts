// src\matterbridge.test.ts

const NAME = 'MatterbridgeMocked';
const HOMEDIR = path.join('jest', NAME);

// Mock the spawnCommand from spawn module before importing it
jest.unstable_mockModule('./utils/spawn.js', () => ({
  spawnCommand: jest.fn((matterbridge: MatterbridgeType, command: string, args: string[]) => {
    return Promise.resolve(true); // Mock the spawnCommand function to resolve immediately
  }),
}));
const spawnModule = await import('./utils/spawn.js');
const spawnCommandMock = spawnModule.spawnCommand as jest.MockedFunction<typeof spawnModule.spawnCommand>;

// Mock the wait from wait module before importing it
jest.unstable_mockModule('./utils/wait.js', () => ({
  waiter: jest.fn((name: string, check: () => boolean, exitWithReject: boolean = false, resolveTimeout: number = 5000, resolveInterval: number = 500, debug: boolean = false) => {
    // console.warn(`Mocked waiter called with name: ${name}, exitWithReject: ${exitWithReject}, resolveTimeout: ${resolveTimeout}, resolveInterval: ${resolveInterval}, debug: ${debug}`);
    return Promise.resolve(true); // Mock the waiter function to resolve immediately
  }),
  wait: jest.fn((timeout: number = 1000, name?: string, debug: boolean = false) => {
    // console.warn(`Mocked wait called with timeout: ${timeout}, name: ${name}, debug: ${debug}`);
    return Promise.resolve(); // Mock the wait function to resolve immediately
  }),
  withTimeout: jest.fn((promise: Promise<any>, timeoutMillisecs: number = 10000, reThrow: boolean = true) => {
    // console.warn(`Mocked withTimeout called with timeoutMillisecs: ${timeoutMillisecs}, reThrow: ${reThrow}`);
    return Promise.resolve(); // Mock the withTimeout function to resolve immediately
  }),
}));
const waitModule = await import('./utils/wait.js');
const wait = waitModule.wait as jest.MockedFunction<typeof waitModule.wait>;
const waiter = waitModule.waiter as jest.MockedFunction<typeof waitModule.waiter>;
const withTimeout = waitModule.withTimeout as jest.MockedFunction<typeof waitModule.withTimeout>;

const pluginsLoadSpy = jest.spyOn(PluginManager.prototype, 'load');
const pluginsStartSpy = jest.spyOn(PluginManager.prototype, 'start');
const pluginsConfigureSpy = jest.spyOn(PluginManager.prototype, 'configure');
const pluginsShutdownSpy = jest.spyOn(PluginManager.prototype, 'shutdown');

import { jest } from '@jest/globals';
import os from 'node:os';
import path from 'node:path';
import { rmSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';

import { AnsiLogger, CYAN, er, LogLevel, nf, nt, pl, TimestampFormat, wr } from 'node-ansi-logger';
import { NodeStorageManager } from 'node-persist-manager';

import { getParameter } from './utils/commandLine.ts';
// import { Matterbridge } from './matterbridge.ts';
const { Matterbridge } = await import('./matterbridge.ts');
import type { Matterbridge as MatterbridgeType } from './matterbridge.js';
import { VendorId, LogLevel as MatterLogLevel, Logger } from '@matter/main';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.ts';
import { plg, RegisteredPlugin } from './matterbridgeTypes.ts';
import { PluginManager } from './pluginManager.ts';

let loggerLogSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.log>;
let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
let consoleDebugSpy: jest.SpiedFunction<typeof console.log>;
let consoleInfoSpy: jest.SpiedFunction<typeof console.log>;
let consoleWarnSpy: jest.SpiedFunction<typeof console.log>;
let consoleErrorSpy: jest.SpiedFunction<typeof console.log>;
const debug = false; // Set to true to enable debug logs

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

function setDebug(debug: boolean) {
  if (debug) {
    loggerLogSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleDebugSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log');
    consoleLogSpy = jest.spyOn(console, 'log');
    consoleDebugSpy = jest.spyOn(console, 'debug');
    consoleInfoSpy = jest.spyOn(console, 'info');
    consoleWarnSpy = jest.spyOn(console, 'warn');
    consoleErrorSpy = jest.spyOn(console, 'error');
  } else {
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {});
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation((...args: any[]) => {});
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation((...args: any[]) => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation((...args: any[]) => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args: any[]) => {});
  }
}

// Cleanup the matter environment
rmSync(HOMEDIR, { recursive: true, force: true });

describe('Matterbridge mocked', () => {
  let matterbridge: MatterbridgeType;

  beforeEach(async () => {
    // Reset the process.argv to simulate command line arguments
    process.argv = ['node', 'matterbridge.test.js', '-novirtual', '-frontend', '0', '-test', '-homedir', HOMEDIR, '-profile', 'Jest'];

    // Reset the Matterbridge instance
    (Matterbridge as any).instance = undefined;
    matterbridge = await Matterbridge.loadInstance(); // Default to false if no parameter is provided
  });

  afterEach(async () => {
    // Destroy the Matterbridge instance
    await matterbridge.destroyInstance(10, 10);

    // Clear all mocks again
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('mocked spawnCommand', async () => {
    const { spawnCommand } = await import('./utils/spawn.js');
    const result = await spawnCommand(matterbridge, 'echo', ['Hello, World!']);
    expect(result).toBe(true);
    expect(spawnCommand).toHaveBeenCalledWith(matterbridge, 'echo', ['Hello, World!']);
  });

  test('mocked wait', async () => {
    await wait(1000, 'Test Wait', true);
    expect(wait).toHaveBeenCalledWith(1000, 'Test Wait', true);
  });

  test('mocked waiter', async () => {
    const condition = jest.fn(() => true);
    const result = await waiter('Test Waiter', condition, false, 5000, 500, true);
    expect(result).toBe(true);
    expect(condition).not.toHaveBeenCalled();
    expect(waiter).toHaveBeenCalledWith('Test Waiter', condition, false, 5000, 500, true);
  });

  test('mocked withTimeout', async () => {
    const promise = new Promise((resolve) => setTimeout(resolve, 1000));
    const result = await withTimeout(promise, 2000);
    expect(result).toBeUndefined();
    expect(withTimeout).toHaveBeenCalledWith(promise, 2000);
  });

  test('Matterbridge.loadInstance(false)', async () => {
    expect(matterbridge.systemInformation).toBeDefined();
    expect(matterbridge.matterbridgeInformation).toBeDefined();

    expect(matterbridge.homeDirectory).toBe('');
    expect(matterbridge.rootDirectory).toBe('');
    expect(matterbridge.matterbridgeDirectory).toBe('');
    expect(matterbridge.matterbridgePluginDirectory).toBe('');
    expect(matterbridge.matterbridgeCertDirectory).toBe('');
    expect(matterbridge.globalModulesDirectory).toBe('');
    expect(matterbridge.matterbridgeVersion).toBe('');
    expect(matterbridge.matterbridgeLatestVersion).toBe('');
    expect(matterbridge.matterbridgeDevVersion).toBe('');
    expect(matterbridge.bridgeMode).toBe('');
    expect(matterbridge.restartMode).toBe('');
    expect(matterbridge.profile).toBe('Jest');
    expect(matterbridge.shutdown).toBe(false);
    expect((matterbridge as any).edge).toBe(undefined);
    expect((matterbridge as any).failCountLimit).toBe(120);

    expect(matterbridge.log).toBeDefined();
    expect(matterbridge.matterbridgeLoggerFile).toBe('matterbridge.Jest.log');
    expect(matterbridge.matterLoggerFile).toBe('matter.Jest.log');

    expect(matterbridge.plugins).toBeDefined();
    expect(matterbridge.devices).toBeDefined();

    expect(matterbridge.frontend).toBeDefined();
    expect((matterbridge.frontend as any).httpServer).toBeUndefined();
    expect((matterbridge.frontend as any).httpsServer).toBeUndefined();
    expect((matterbridge.frontend as any).expressApp).toBeUndefined();
    expect((matterbridge.frontend as any).webSocketServer).toBeUndefined();

    expect(matterbridge.environment).toBeDefined();

    expect(matterbridge.nodeStorageName).toBe('storage.Jest');
    expect(matterbridge.nodeStorage).toBeUndefined();
    expect(matterbridge.nodeContext).toBeUndefined();

    expect(matterbridge.matterStorageName).toBe('matterstorage.Jest');
    expect(matterbridge.matterStorageService).toBeUndefined();
    expect(matterbridge.matterStorageManager).toBeUndefined();
    expect(matterbridge.matterbridgeContext).toBeUndefined();
    expect(matterbridge.controllerContext).toBeUndefined();

    expect(matterbridge.mdnsInterface).toBeUndefined();
    expect(matterbridge.ipv4address).toBeUndefined();
    expect(matterbridge.ipv6address).toBeUndefined();
    expect(matterbridge.port).toBeUndefined();
    expect(matterbridge.passcode).toBeUndefined();
    expect(matterbridge.discriminator).toBeUndefined();
    expect(matterbridge.certification).toBeUndefined();

    expect(matterbridge.serverNode).toBeUndefined();
    expect(matterbridge.aggregatorNode).toBeUndefined();
    expect(matterbridge.matterStorageManager).toBeUndefined();
    expect(matterbridge.matterStorageService).toBeUndefined();
    expect(matterbridge.matterbridgeContext).toBeUndefined();

    expect((Matterbridge as any).instance).toBeDefined();
  });

  test('Matterbridge.initialize()', async () => {
    await matterbridge.initialize();
    expect((matterbridge as any).initialized).toBeTruthy();
    expect((matterbridge as any).hasCleanupStarted).toBeFalsy();

    expect(matterbridge.serverNode).toBeUndefined();
    expect(matterbridge.aggregatorNode).toBeUndefined();
    expect(matterbridge.matterStorageManager).toBeDefined();
    expect(matterbridge.matterStorageService).toBeDefined();
    expect(matterbridge.matterbridgeContext).toBeDefined();

    expect((matterbridge as any).log).toBeDefined();
    expect(matterbridge.homeDirectory).toBe(getParameter('homedir') ?? os.homedir());
    expect(matterbridge.matterbridgeInformation.homeDirectory).toBe(matterbridge.homeDirectory);
    expect(matterbridge.matterbridgeDirectory).toBe(path.join(matterbridge.homeDirectory, '.matterbridge'));
    expect(matterbridge.matterbridgeInformation.matterbridgeDirectory).toBe(matterbridge.matterbridgeDirectory);
    expect(matterbridge.matterbridgePluginDirectory).toBe(path.join(matterbridge.homeDirectory, 'Matterbridge'));
    expect(matterbridge.matterbridgeInformation.matterbridgePluginDirectory).toBe(matterbridge.matterbridgePluginDirectory);
    expect(matterbridge.matterbridgeCertDirectory).toBe(path.join(matterbridge.homeDirectory, '.mattercert'));
    expect(matterbridge.matterbridgeInformation.matterbridgeCertDirectory).toBe(matterbridge.matterbridgeCertDirectory);
    expect(matterbridge.globalModulesDirectory).not.toBe('');
    expect(matterbridge.matterbridgeInformation.globalModulesDirectory).toBe(matterbridge.globalModulesDirectory);
    expect(matterbridge.matterbridgeVersion).not.toBe('');
    expect(matterbridge.matterbridgeInformation.matterbridgeVersion).toBe(matterbridge.matterbridgeVersion);
    expect(matterbridge.matterbridgeLatestVersion).toBe(matterbridge.matterbridgeVersion);
    expect(matterbridge.matterbridgeInformation.matterbridgeLatestVersion).toBe(matterbridge.matterbridgeLatestVersion);
    expect(matterbridge.matterbridgeDevVersion).toBe(matterbridge.matterbridgeVersion);
    expect(matterbridge.matterbridgeInformation.matterbridgeDevVersion).toBe(matterbridge.matterbridgeDevVersion);
    expect((matterbridge as any).nodeStorage).toBeDefined();
    expect((matterbridge as any).nodeContext).toBeDefined();
    expect(matterbridge.getPlugins()).toBeDefined();
    expect((matterbridge as any).plugins).toBeDefined();
    expect((matterbridge as any).plugins.size).toBe(0);
    expect(matterbridge.getDevices()).toBeDefined();
    expect((matterbridge as any).devices).toBeDefined();
    expect((matterbridge as any).devices.size).toBe(0);

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Matterbridge profile: Jest'));

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`Created Matterbridge Home Directory: ${HOMEDIR}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`Created Matterbridge Directory: ${path.join('jest', 'MatterbridgeMocked', '.matterbridge')}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`Created Matterbridge Frontend Certificate Directory: ${path.join('jest', 'MatterbridgeMocked', '.matterbridge', 'certs')}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`Created Matterbridge Frontend Uploads Directory: ${path.join('jest', 'MatterbridgeMocked', '.matterbridge', 'uploads')}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`Created Matterbridge Plugin Directory: ${path.join('jest', 'MatterbridgeMocked', 'Matterbridge')}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`Created Matterbridge Matter Certificate Directory: ${path.join('jest', 'MatterbridgeMocked', '.mattercert')}`));

    // -frontend 0
    expect((matterbridge as any).frontend.httpServer).toBeUndefined();
    expect((matterbridge as any).frontend.httpsServer).toBeUndefined();
    expect((matterbridge as any).frontend.expressApp).toBeUndefined();
    expect((matterbridge as any).frontend.webSocketServer).toBeUndefined();

    // Destroy the Matterbridge instance
    await matterbridge.destroyInstance(10, 10);
    expect((matterbridge as any).checkUpdateTimeout).toBeUndefined();
    expect((matterbridge as any).checkUpdateInterval).toBeUndefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Dispose 0 MdnsService...`);

    expect(matterbridge.log.logLevel).toBe(LogLevel.INFO);
    expect(matterbridge.frontend.logLevel).toBeUndefined();
    expect(MatterbridgeEndpoint.logLevel).toBe(LogLevel.INFO);
    expect(matterbridge.matterbridgeInformation.loggerLevel).toBe(LogLevel.INFO);
    expect(matterbridge.matterbridgeInformation.matterLoggerLevel).toBe(MatterLogLevel.INFO);
    expect((matterbridge as any).initialized).toBeFalsy();
    expect((matterbridge as any).hasCleanupStarted).toBeFalsy();
    expect((Matterbridge as any).instance).toBeUndefined();
  });

  test('Matterbridge.initialize() with pairing.json', async () => {
    process.argv = ['node', 'matterbridge.test.js', '-novirtual', '-frontend', '0', '-test', '-homedir', HOMEDIR, '-profile', 'Jest', '-logger', 'debug', '-filelogger', '-matterlogger', 'debug', '-matterfilelogger', '-debug'];
    const filePath = path.join('jest', 'MatterbridgeMocked', '.mattercert', 'pairing.json');
    mkdirSync(path.join('jest', 'MatterbridgeMocked', '.mattercert'), { recursive: true });
    writeFileSync(
      filePath,
      `{
        "vendorId": 65522,
        "vendorName": "TestVendor",
        "productId": 1234,
        "productName": "TestProduct",
        "passcode": 12345678,
        "discriminator": 1234
      }`,
      'utf-8',
    );
    await matterbridge.initialize();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`Pairing file ${CYAN}${filePath}${nf} found.`));
    expect(matterbridge.aggregatorVendorId).toBe(VendorId(0xfff2));
    expect(matterbridge.aggregatorVendorName).toBe('TestVendor');
    expect(matterbridge.aggregatorProductId).toBe(1234);
    expect(matterbridge.aggregatorProductName).toBe('TestProduct');
    expect(matterbridge.passcode).toBe(12345678);
    expect(matterbridge.discriminator).toBe(1234);

    expect(matterbridge.log.logLevel).toBe(LogLevel.DEBUG);
    expect(matterbridge.matterbridgeInformation.loggerLevel).toBe(LogLevel.DEBUG);
    expect(matterbridge.matterbridgeInformation.fileLogger).toBe(true);
    expect(matterbridge.matterbridgeInformation.matterLoggerLevel).toBe(MatterLogLevel.DEBUG);
    expect(matterbridge.matterbridgeInformation.matterFileLogger).toBe(true);

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Directory Matterbridge Home Directory already exists at path: ${HOMEDIR}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Directory Matterbridge Directory already exists at path: ${path.join('jest', 'MatterbridgeMocked', '.matterbridge')}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Directory Matterbridge Frontend Certificate Directory already exists at path: ${path.join('jest', 'MatterbridgeMocked', '.matterbridge', 'certs')}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Directory Matterbridge Frontend Uploads Directory already exists at path: ${path.join('jest', 'MatterbridgeMocked', '.matterbridge', 'uploads')}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Directory Matterbridge Plugin Directory already exists at path: ${path.join('jest', 'MatterbridgeMocked', 'Matterbridge')}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Directory Matterbridge Matter Certificate Directory already exists at path: ${path.join('jest', 'MatterbridgeMocked', '.mattercert')}`));

    unlinkSync(path.join(matterbridge.matterbridgeCertDirectory, 'pairing.json'));
    await (matterbridge as any).nodeContext.set('mattermdnsinterface', '');
    await (matterbridge as any).nodeContext.set('matteripv4address', '');
    await (matterbridge as any).nodeContext.set('matteripv6address', '');
  });

  test('Matterbridge.initialize() logger info', async () => {
    process.argv = ['node', 'matterbridge.test.js', '-novirtual', '-frontend', '0', '-test', '-homedir', HOMEDIR, '-profile', 'Jest', '-logger', 'info', '-matterlogger', 'info', '-debug'];
    await matterbridge.initialize();
    expect(matterbridge.log.logLevel).toBe(LogLevel.INFO);
    expect(matterbridge.matterbridgeInformation.loggerLevel).toBe(LogLevel.INFO);
    expect(matterbridge.matterbridgeInformation.fileLogger).toBe(false);
    expect(matterbridge.matterbridgeInformation.matterLoggerLevel).toBe(MatterLogLevel.INFO);
    expect(matterbridge.matterbridgeInformation.matterFileLogger).toBe(false);
  });

  test('Matterbridge.initialize() logger notice', async () => {
    process.argv = ['node', 'matterbridge.test.js', '-novirtual', '-frontend', '0', '-test', '-homedir', HOMEDIR, '-profile', 'Jest', '-logger', 'notice', '-matterlogger', 'notice', '-debug'];
    await matterbridge.initialize();
    expect(matterbridge.log.logLevel).toBe(LogLevel.NOTICE);
    expect(matterbridge.matterbridgeInformation.loggerLevel).toBe(LogLevel.NOTICE);
    expect(matterbridge.matterbridgeInformation.matterLoggerLevel).toBe(MatterLogLevel.NOTICE);
  });

  test('Matterbridge.initialize() logger warn', async () => {
    process.argv = ['node', 'matterbridge.test.js', '-novirtual', '-frontend', '0', '-test', '-homedir', HOMEDIR, '-profile', 'Jest', '-logger', 'warn', '-matterlogger', 'warn', '-debug'];
    await matterbridge.initialize();
    expect(matterbridge.log.logLevel).toBe(LogLevel.WARN);
    expect(matterbridge.matterbridgeInformation.loggerLevel).toBe(LogLevel.WARN);
    expect(matterbridge.matterbridgeInformation.matterLoggerLevel).toBe(MatterLogLevel.WARN);
  });

  test('Matterbridge.initialize() logger error', async () => {
    process.argv = ['node', 'matterbridge.test.js', '-novirtual', '-frontend', '0', '-test', '-homedir', HOMEDIR, '-profile', 'Jest', '-logger', 'error', '-matterlogger', 'error', '-debug'];
    await matterbridge.initialize();
    expect(matterbridge.log.logLevel).toBe(LogLevel.ERROR);
    expect(matterbridge.matterbridgeInformation.loggerLevel).toBe(LogLevel.ERROR);
    expect(matterbridge.matterbridgeInformation.matterLoggerLevel).toBe(MatterLogLevel.ERROR);
  });

  test('Matterbridge.initialize() logger fatal', async () => {
    process.argv = ['node', 'matterbridge.test.js', '-novirtual', '-frontend', '0', '-test', '-homedir', HOMEDIR, '-profile', 'Jest', '-logger', 'fatal', '-matterlogger', 'fatal', '-debug'];
    await matterbridge.initialize();
    expect(matterbridge.log.logLevel).toBe(LogLevel.FATAL);
    expect(matterbridge.matterbridgeInformation.loggerLevel).toBe(LogLevel.FATAL);
    expect(matterbridge.matterbridgeInformation.matterLoggerLevel).toBe(MatterLogLevel.FATAL);
  });

  test('Matterbridge.initialize() logger default', async () => {
    const networkInterfaces = os.networkInterfaces();
    const availableAddresses = Object.entries(networkInterfaces);
    const availableInterfaces = Object.keys(networkInterfaces);
    process.argv = [
      'node',
      'matterbridge.mocked.test.js',
      '-novirtual',
      '-frontend',
      '0',
      '-test',
      '-homedir',
      HOMEDIR,
      '-profile',
      'Jest',
      '-logger',
      'null',
      '-matterlogger',
      'null',
      '-debug',
      '-mdnsinterface',
      availableInterfaces[0],
      '-ipv4address',
      '127.0.0.1',
      '-ipv6address',
      '::1',
    ];
    (Matterbridge as any).instance = undefined; // Reset the instance to ensure a fresh start
    matterbridge = await Matterbridge.loadInstance(true);
    expect(matterbridge.log.logLevel).toBe(LogLevel.INFO);
    expect(matterbridge.matterbridgeInformation.loggerLevel).toBe(LogLevel.INFO);
    expect(matterbridge.matterbridgeInformation.matterLoggerLevel).toBe(MatterLogLevel.INFO);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Using mdnsinterface ${CYAN}${availableInterfaces[0]}${nf} for the Matter MdnsBroadcaster.`);
    await (matterbridge as any).nodeContext.set('mattermdnsinterface', ''); // Prepare for next test
    await (matterbridge as any).nodeContext.set('matteripv4address', ''); // Prepare for next test
    await (matterbridge as any).nodeContext.set('matteripv6address', ''); // Prepare for next test
    expect(matterbridge.matterbridgeInformation.virtualMode).toBe('disabled');
    await matterbridge.destroyInstance(10, 10);

    process.argv = [
      'node',
      'matterbridge.mocked.test.js',
      '-novirtual',
      '-frontend',
      '0',
      '-test',
      '-homedir',
      HOMEDIR,
      '-profile',
      'Jest',
      '-logger',
      'null',
      '-matterlogger',
      'null',
      '-debug',
      '-mdnsinterface',
      'invalid',
      '-ipv4address',
      'invalid',
      '-ipv6address',
      'invalid',
    ];
    await matterbridge.initialize();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Invalid mdnsinterface`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Invalid ipv4address`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Invalid ipv6address`));
    await (matterbridge as any).nodeContext.set('mattermdnsinterface', '');
    await (matterbridge as any).nodeContext.remove('virtualmode');
    await matterbridge.destroyInstance(10, 10);

    process.argv = ['node', 'matterbridge.mocked.test.js', '-frontend', '0', '-test', '-homedir', HOMEDIR, '-profile', 'Jest', '-logger', 'null', '-matterlogger', 'null', '-debug'];
    await matterbridge.initialize();
    expect(matterbridge.mdnsInterface).toBeUndefined();
    expect(matterbridge.matterbridgeInformation.virtualMode).toBe('outlet');

    await matterbridge.setLogLevel(LogLevel.DEBUG);
    expect(MatterbridgeEndpoint.logLevel).toBe(LogLevel.DEBUG);
    expect(matterbridge.log.logLevel).toBe(LogLevel.DEBUG);
    expect(matterbridge.frontend.logLevel).toBe(undefined);
    expect((matterbridge.devices as any).log.logLevel).toBe(LogLevel.DEBUG);
    expect((matterbridge.plugins as any).log.logLevel).toBe(LogLevel.DEBUG);
  });

  test('Matterbridge.initialize() plugins', async () => {
    process.argv = ['node', 'matterbridge.mocked.test.js', '-novirtual', '-frontend', '0', '-test', '-homedir', HOMEDIR];
    await matterbridge.initialize();
    expect(matterbridge.getPlugins()).toEqual([]);
    expect(await (matterbridge.plugins as any).add('./src/mock/plugin1')).not.toBeNull();
    expect(await (matterbridge.plugins as any).add('./src/mock/plugin2')).not.toBeNull();
    expect(await (matterbridge.plugins as any).add('./src/mock/plugin3')).not.toBeNull();
    expect(await (matterbridge.plugins as any).add('./src/mock/plugin4')).not.toBeNull();
    expect(await (matterbridge.plugins as any).add('./src/mock/plugin5')).not.toBeNull();
    expect(await (matterbridge.plugins as any).add('./src/mock/plugin6')).not.toBeNull();
    expect((matterbridge.plugins as any).length).toBe(6);

    // Test set log level for plugins
    await (matterbridge.plugins as any).load(matterbridge.getPlugins()[0]);
    matterbridge.setLogLevel(LogLevel.NOTICE);
    expect((matterbridge.plugins as any).log.logLevel).toBe(LogLevel.NOTICE);
    expect(matterbridge.getPlugins()[0].platform?.log.logLevel).toBe(LogLevel.NOTICE);

    // Test reinstall of plugins
    const parseSpy = jest.spyOn(PluginManager.prototype, 'parse').mockImplementation(async (plugin: RegisteredPlugin) => {
      return null; // Simulate a plugin that does not return a valid instance
    });
    spawnCommandMock.mockImplementationOnce((matterbridge: MatterbridgeType, command: string, args: string[]) => {
      return Promise.reject(new Error(`Mocked spawnCommand error for command: ${command} with args: ${args.join(' ')}`));
    });
    await matterbridge.initialize();
    expect(parseSpy).toHaveBeenCalledTimes(6);
    expect(spawnCommandMock).toHaveBeenCalledTimes(6);
    await matterbridge.destroyInstance(10, 10);
    parseSpy.mockRestore();

    // Test startPlugins
    const resolveSpy = jest.spyOn(PluginManager.prototype, 'resolve').mockImplementation(async (pluginPath: string) => {
      return null; // Simulate a plugin that does not return a valid path
    });
    await matterbridge.initialize();
    await (matterbridge as any).startPlugins();
    expect(resolveSpy).toHaveBeenCalledTimes(6);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('not found or not validated. Disabling it.'));

    for (const plugin of matterbridge.getPlugins()) {
      expect(plugin.enabled).toBe(false);
      if (plugin.name === 'matterbridge-mock1') plugin.enabled = true; // Enable the plugin for the next test
      if (plugin.name === 'matterbridge-mock4') plugin.enabled = true; // Enable the plugin for the next test
    }
    resolveSpy.mockImplementation(async (pluginPath: string) => {
      return pluginPath; // Simulate a plugin that returns a valid path
    });
    await (matterbridge as any).startPlugins();
    expect(resolveSpy).toHaveBeenCalledTimes(12);

    await matterbridge.destroyInstance(10, 10);
    resolveSpy.mockRestore();

    // Test throw error for unsupported Node version
    const originalNodeVersion = process.versions.node;
    Object.defineProperty(process.versions, 'node', {
      get: () => '16.0.0',
    });
    await expect(matterbridge.initialize()).rejects.toThrow(`Node version 16 is not supported. Please upgrade to 18 or above.`);
    Object.defineProperty(process.versions, 'node', {
      get: () => originalNodeVersion,
    });
    expect((matterbridge.plugins as any).length).toBe(6);
  });

  test('Matterbridge.initialize() devices', async () => {
    process.argv = ['node', 'matterbridge.mocked.test.js', '-novirtual', '-frontend', '0', '-test', '-homedir', HOMEDIR];
    await matterbridge.initialize();
    expect(matterbridge.getDevices()).toEqual([]);
  });

  test('Matterbridge.initialize() -service should fails for createStorage', async () => {
    jest.spyOn(NodeStorageManager.prototype, 'createStorage').mockImplementationOnce(() => {
      throw new Error('Test error for createStorage');
    });
    // Reset the process.argv to simulate command line arguments
    process.argv = ['node', 'matterbridge.test.js', '-service', '-novirtual', '-frontend', '0', '-test', '-homedir', HOMEDIR, '-profile', 'Jest', '-logger', 'debug', '-matterlogger', 'debug', '-debug'];
    await expect(matterbridge.initialize()).rejects.toThrow('Fatal error creating node storage manager and context for matterbridge');
    expect(matterbridge.restartMode).toBe('service');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, 'The matterbridge storage is corrupted. Restoring it with backup...');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, 'The matterbridge storage has been restored with backup');
  });

  test('Matterbridge.initialize() -docker -norestore should fails for createStorage', async () => {
    jest.spyOn(NodeStorageManager.prototype, 'createStorage').mockImplementationOnce(() => {
      throw new Error('Test error for createStorage');
    });
    // Reset the process.argv to simulate command line arguments
    process.argv = ['node', 'matterbridge.test.js', '-docker', '-norestore', '-novirtual', '-frontend', '0', '-test', '-homedir', HOMEDIR, '-profile', 'Jest', '-logger', 'debug', '-matterlogger', 'debug', '-debug'];
    await expect(matterbridge.initialize()).rejects.toThrow('Fatal error creating node storage manager and context for matterbridge');
    expect(matterbridge.restartMode).toBe('docker');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.FATAL, 'The matterbridge storage is corrupted. Found -norestore parameter: exiting...');
  });

  test('Matterbridge.initialize() Matter Storage', async () => {
    jest.spyOn(Matterbridge.prototype as any, 'startMatterStorage').mockImplementationOnce(async () => {
      throw new Error('Test error for startMatterStorage');
    });
    // Reset the process.argv to simulate command line arguments
    process.argv = ['node', 'matterbridge.test.js', '-novirtual', '-frontend', '0', '-controller', '-homedir', HOMEDIR, '-profile', 'Jest', '-logger', 'debug', '-matterlogger', 'debug', '-debug'];
    await expect(matterbridge.initialize()).rejects.toThrow('Fatal error creating matter storage: Test error for startMatterStorage');
    await matterbridge.destroyInstance(10, 10);

    // Reset the process.argv to simulate reset of a registered plugin
    process.argv = ['node', 'matterbridge.test.js', '-novirtual', '-frontend', '0', '-controller', '-homedir', HOMEDIR, '-profile', 'Jest', '-reset', 'matterbridge-mock1'];
    await matterbridge.initialize();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Reset commissioning for plugin ${plg}matterbridge-mock1${nt} done! Remove the device from the controller.`);
    await matterbridge.destroyInstance(10, 10);

    // Reset the process.argv to simulate reset of not registered plugin
    process.argv = ['node', 'matterbridge.test.js', '-novirtual', '-frontend', '0', '-controller', '-homedir', HOMEDIR, '-profile', 'Jest', '-reset', 'matterbridge-noplugin'];
    await matterbridge.initialize();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.WARN, `Plugin ${plg}matterbridge-noplugin${wr} not registerd in matterbridge`);
  });

  test('Matterbridge.initialize() update', async () => {
    // Reset the process.argv to simulate command line arguments
    process.argv = ['node', 'matterbridge.test.js', '-novirtual', '-frontend', '0', '-controller', '-homedir', HOMEDIR];
    // Mock the checkUpdates from update module before importing it
    jest.unstable_mockModule('./update.js', () => ({
      checkUpdates: jest.fn().mockImplementation(() => Promise.resolve()), // Mock the checkUpdates function to resolve immediately
    }));
    const update = await import('./update.js');
    const checkUpdatesMock = update.checkUpdates;
    jest.useFakeTimers();
    await matterbridge.initialize();
    jest.advanceTimersByTime(12 * 60 * 60 * 1000); // Simulate 12 hours
    jest.useRealTimers();
    await new Promise((resolve) => setTimeout(resolve, 10)); // Wait for the next tick
    expect(checkUpdatesMock).toHaveBeenCalledTimes(2);
  });

  test('Matterbridge.initialize() registerProcessHandlers', async () => {
    // Reset the process.argv to simulate command line arguments
    process.argv = ['node', 'matterbridge.test.js', '-novirtual', '-frontend', '0', '-controller', '-homedir', HOMEDIR, '-matterlogger', 'debug', '-matterfilelogger'];
    const createMatterFileLoggerSpy = jest.spyOn(Matterbridge.prototype, 'createMatterFileLogger');
    await matterbridge.initialize();
    if ((matterbridge as any).exceptionHandler) await (matterbridge as any).exceptionHandler(new Error('Test error for exceptionHandler'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Unhandled Exception detected:'));
    if ((matterbridge as any).rejectionHandler) await (matterbridge as any).rejectionHandler(new Error('Test error for rejectionHandler'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Unhandled Rejection detected:'));
    jest.spyOn(matterbridge as any, 'cleanup').mockImplementationOnce(async () => {
      return Promise.resolve();
    });
    if ((matterbridge as any).sigintHandler) await (matterbridge as any).sigintHandler();
    jest.spyOn(matterbridge as any, 'cleanup').mockImplementationOnce(async () => {
      return Promise.resolve();
    });
    if ((matterbridge as any).sigtermHandler) await (matterbridge as any).sigtermHandler();

    expect(createMatterFileLoggerSpy).toHaveBeenCalled();
    Logger.get('Jest').debug('Test log message');
    Logger.get('Jest').info('Test log message');
    Logger.get('Jest').notice('Test log message');
    Logger.get('Jest').warn('Test log message');
    Logger.get('Jest').error('Test log message');
    Logger.get('Jest').fatal('Test log message');
  });

  test('Matterbridge.initialize() logNodeAndSystemInfo', async () => {
    // Reset the process.argv to simulate command line arguments
    process.argv = ['node', 'matterbridge.test.js', '-novirtual', '-frontend', '0', '-controller', '-homedir', HOMEDIR];
    await matterbridge.initialize();
    matterbridge.mdnsInterface = 'eth0'; // Set a valid interface for testing
    const ifaces = {};
    ifaces['empty'] = undefined; // Simulate an empty interface
    ifaces['eth0'] = [
      {
        address: ' 192.168.1.100',
        netmask: '255.255.255.0',
        family: 'IPv4',
        mac: '00:11:22:33:44:55',
        internal: false,
        cidr: 'eth0',
      },
      {
        address: 'fe80::1234:5678:9abc:def0',
        netmask: 'ffff:ffff:ffff:ffff::',
        family: 'IPv6',
        mac: '00:11:22:33:44:55',
        internal: false,
      },
    ];
    ifaces['lo'] = [
      {
        address: '127.0.0.1',
        netmask: '255.0.0.0',
        family: 'IPv4',
        mac: '00:00:00:00:00:00',
        internal: true,
        cidr: 'lo',
      },
    ];
    const networkInterfacesSpy = jest.spyOn(os, 'networkInterfaces').mockReturnValueOnce(ifaces);
    await (matterbridge as any).logNodeAndSystemInfo();
    matterbridge.mdnsInterface = undefined; // Reset the interface after testing
    matterbridge.systemInformation.ipv4Address = ''; // Reset the ipv4Address after testing
    matterbridge.systemInformation.ipv6Address = ''; // Reset the ipv6Address after testing
    networkInterfacesSpy.mockReturnValueOnce({
      empty: undefined,
      eth0: [
        {
          address: 'fe80::1234:5678:9abc:def0',
          netmask: 'ffff:ffff:ffff:ffff::',
          family: 'IPv6',
          mac: '00:11:22:33:44:55',
          internal: false,
          scopeid: 0,
          cidr: 'eth0',
        },
      ],
      lo: [],
    }); // Reset the spy to return an empty interface
    await (matterbridge as any).logNodeAndSystemInfo();
    expect(networkInterfacesSpy).toHaveBeenCalled();
  });

  test('Matterbridge.initialize() parseCommandLine', async () => {
    // Reset the process.argv to simulate command line arguments
    process.argv = ['node', 'matterbridge.test.js', '-novirtual', '-frontend', '0', '-test', '-homedir', HOMEDIR];
    writeFileSync(
      path.join(HOMEDIR, '.mattercert', 'pairing.json'),
      JSON.stringify(
        {
          serialNumber: 'xxxx',
          uniqueId: 'yyyy',
          vendorId: 65521,
          vendorName: 'Matterbridge',
          productId: 32768,
          productName: 'Matterbridge aggregator',
          deviceType: 14,
          passcode: 20252026,
          discriminator: 2355,
          privateKey: 'FFFF',
          certificate: 'FFFF',
          intermediateCertificate: 'FFFF',
          declaration: 'FFFF',
        },
        null,
        2,
      ),
      'utf-8',
    ); // Create a dummy file to avoid errors
    await matterbridge.initialize();
    // const startMatterStorageSpy = jest.spyOn(matterbridge as any, 'startMatterStorage').mockImplementation(async () => Promise.resolve());
    // const stopMatterStorageSpy = jest.spyOn(matterbridge as any, 'stopMatterStorage').mockImplementation(async () => Promise.resolve());
    // const cleanupSpy = jest.spyOn(matterbridge as any, 'cleanup').mockImplementation(async () => Promise.resolve());
    expect(matterbridge.getPlugins().length).toBe(6);

    process.argv = ['node', 'matterbridge.test.js', '-novirtual', '-frontend', '0', '-test', '-homedir', HOMEDIR, '-help'];
    matterbridge.shutdown = false;
    matterbridge.aggregatorSerialNumber = 'xxxx';
    matterbridge.aggregatorUniqueId = 'yyyy';
    matterbridge.matterStorageService = { open: jest.fn().mockImplementation(async () => Promise.resolve()) } as any; // Mock the matterStorageService to avoid errors
    await (matterbridge as any).parseCommandLine();
    expect(matterbridge.shutdown).toBe(true);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('Usage: matterbridge [options]'));

    process.argv = ['node', 'matterbridge.test.js', '-novirtual', '-frontend', '0', '-test', '-homedir', HOMEDIR, '-list'];
    matterbridge.shutdown = false;
    await (matterbridge as any).parseCommandLine();
    expect(matterbridge.shutdown).toBe(true);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('Registered plugins'));

    process.argv = ['node', 'matterbridge.test.js', '-novirtual', '-frontend', '0', '-test', '-homedir', HOMEDIR, '-logstorage'];
    matterbridge.shutdown = false;
    await (matterbridge as any).parseCommandLine();
    expect(matterbridge.shutdown).toBe(true);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`${plg}Matterbridge${nf} storage log`));

    process.argv = ['node', 'matterbridge.test.js', '-novirtual', '-frontend', '0', '-test', '-homedir', HOMEDIR, '-loginterfaces'];
    matterbridge.shutdown = false;
    await (matterbridge as any).parseCommandLine();
    expect(matterbridge.shutdown).toBe(true);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`Available Network Interfaces:`));

    process.argv = ['node', 'matterbridge.test.js', '-novirtual', '-frontend', '0', '-test', '-homedir', HOMEDIR, '-disable', './src/mock/plugin1'];
    matterbridge.shutdown = false;
    await (matterbridge as any).parseCommandLine();
    expect(matterbridge.shutdown).toBe(true);
    expect(matterbridge.plugins.get('matterbridge-mock1')?.enabled).toBe(false);

    process.argv = ['node', 'matterbridge.test.js', '-novirtual', '-frontend', '0', '-test', '-homedir', HOMEDIR, '-enable', './src/mock/plugin1'];
    matterbridge.shutdown = false;
    await (matterbridge as any).parseCommandLine();
    expect(matterbridge.shutdown).toBe(true);
    expect(matterbridge.getPlugins().length).toBe(6);
    expect(matterbridge.plugins.get('matterbridge-mock1')?.enabled).toBe(true);

    process.argv = ['node', 'matterbridge.test.js', '-novirtual', '-frontend', '0', '-test', '-homedir', HOMEDIR, '-remove', './src/mock/plugin1'];
    matterbridge.shutdown = false;
    await (matterbridge as any).parseCommandLine();
    expect(matterbridge.shutdown).toBe(true);
    expect(matterbridge.getPlugins().length).toBe(5);

    process.argv = ['node', 'matterbridge.test.js', '-novirtual', '-frontend', '0', '-test', '-homedir', HOMEDIR, '-add', './src/mock/plugin1'];
    matterbridge.shutdown = false;
    await (matterbridge as any).parseCommandLine();
    expect(matterbridge.shutdown).toBe(true);
    expect(matterbridge.getPlugins().length).toBe(6);

    process.argv = ['node', 'matterbridge.test.js', '-novirtual', '-frontend', '0', '-test', '-homedir', HOMEDIR, '-reset'];
    matterbridge.shutdown = false;
    await (matterbridge as any).parseCommandLine();
    expect(matterbridge.shutdown).toBe(true);
    expect(matterbridge.getPlugins().length).toBe(0);

    process.argv = ['node', 'matterbridge.test.js', '-novirtual', '-frontend', '0', '-test', '-homedir', HOMEDIR, '-factoryreset'];
    matterbridge.shutdown = false;
    await (matterbridge as any).parseCommandLine();
    expect(matterbridge.shutdown).toBe(true);

    // startMatterStorageSpy.mockRestore();
    // stopMatterStorageSpy.mockRestore();
    // cleanupSpy.mockRestore();
  });

  test('Matterbridge.initialize() startBridge and startChildbridge', async () => {
    await matterbridge.initialize();
    const frontendStartSpy = jest.spyOn(matterbridge.frontend, 'start').mockImplementation(async () => Promise.resolve());
    const startBridgeSpy = jest.spyOn(matterbridge as any, 'startBridge').mockImplementation(async () => Promise.resolve());
    const startChildBridgeSpy = jest.spyOn(matterbridge as any, 'startChildbridge').mockImplementation(async () => Promise.resolve());
    expect(matterbridge.nodeContext).toBeDefined();
    await matterbridge.nodeContext?.remove('bridgeMode');
    jest.clearAllMocks();

    process.argv = ['node', 'matterbridge.test.js', '-novirtual', '-homedir', HOMEDIR];
    await (matterbridge as any).parseCommandLine();
    expect(frontendStartSpy).toHaveBeenCalled();
    expect(startBridgeSpy).toHaveBeenCalled();
    expect(startChildBridgeSpy).not.toHaveBeenCalled();
    expect(await matterbridge.nodeContext?.get<string>('bridgeMode', '')).toBe('bridge');
    jest.clearAllMocks();

    process.argv = ['node', 'matterbridge.test.js', '-novirtual', '-homedir', HOMEDIR, '-bridge'];
    await (matterbridge as any).parseCommandLine();
    expect(frontendStartSpy).toHaveBeenCalled();
    expect(startBridgeSpy).toHaveBeenCalled();
    expect(startChildBridgeSpy).not.toHaveBeenCalled();
    jest.clearAllMocks();

    process.argv = ['node', 'matterbridge.test.js', '-novirtual', '-homedir', HOMEDIR, '-childbridge'];
    await (matterbridge as any).parseCommandLine();
    expect(frontendStartSpy).toHaveBeenCalled();
    expect(startBridgeSpy).not.toHaveBeenCalled();
    expect(startChildBridgeSpy).toHaveBeenCalled();

    frontendStartSpy.mockRestore();
    startBridgeSpy.mockRestore();
    startChildBridgeSpy.mockRestore();
  });

  test('Matterbridge.initialize() restartProcess', async () => {
    process.argv = ['node', 'matterbridge.test.js', '-novirtual', '-frontend', '0', '-test', '-homedir', HOMEDIR];
    await matterbridge.initialize();
    const cleanupSpy = jest.spyOn(matterbridge as any, 'cleanup').mockImplementation(async () => Promise.resolve());

    await matterbridge.restartProcess();
    expect(cleanupSpy).toHaveBeenCalledWith('restarting...', true);
    jest.clearAllMocks();

    await matterbridge.shutdownProcess();
    expect(cleanupSpy).toHaveBeenCalledWith('shutting down...', false);
    jest.clearAllMocks();

    await matterbridge.updateProcess();
    expect(cleanupSpy).toHaveBeenCalledWith('updating...', false);
    expect(spawnCommandMock).toHaveBeenCalledWith(matterbridge, 'npm', expect.arrayContaining(['install', '-g', 'matterbridge', '--omit=dev', '--verbose']));
    jest.clearAllMocks();

    spawnCommandMock.mockImplementationOnce(() => {
      return Promise.reject(new Error('Mocked spawnCommand error for updateProcess'));
    });
    await matterbridge.updateProcess();
    expect(cleanupSpy).toHaveBeenCalledWith('updating...', false);
    expect(spawnCommandMock).toHaveBeenCalledWith(matterbridge, 'npm', expect.arrayContaining(['install', '-g', 'matterbridge', '--omit=dev', '--verbose']));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Error updating matterbridge:'));

    cleanupSpy.mockRestore();
  });

  test('Matterbridge.initialize() unregisterAndShutdownProcess', async () => {
    process.argv = ['node', 'matterbridge.test.js', '-novirtual', '-frontend', '0', '-test', '-homedir', HOMEDIR];
    await matterbridge.initialize();
    const cleanupSpy = jest.spyOn(matterbridge as any, 'cleanup');
    const removeAllBridgedEndpointsSpy = jest.spyOn(matterbridge as any, 'removeAllBridgedEndpoints').mockImplementation(async () => {
      return Promise.resolve();
    });

    matterbridge.plugins.set({ name: 'matterbridge-mock1', enabled: true, path: './src/mock/plugin1/package.json', type: 'DynamicPlatform', version: '1.0.0', description: 'To update', author: 'To update', homepage: 'https://example.com' });
    await matterbridge.unregisterAndShutdownProcess(10);
    expect(removeAllBridgedEndpointsSpy).toHaveBeenCalled();
    expect(cleanupSpy).toHaveBeenCalledWith('unregistered all devices and shutting down...', false, 10);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('unregistered all devices and shutting down...'));
    jest.clearAllMocks();

    matterbridge.plugins.set({ name: 'matterbridge-mock1', enabled: true, path: './src/mock/plugin1/package.json', type: 'DynamicPlatform', version: '1.0.0', description: 'To update', author: 'To update', homepage: 'https://example.com' });
    (matterbridge as any).initialized = true;
    matterbridge.hasCleanupStarted = false;
    matterbridge.bridgeMode = 'childbridge';
    await matterbridge.unregisterAndShutdownProcess(10);
    expect(removeAllBridgedEndpointsSpy).toHaveBeenCalled();
    expect(cleanupSpy).toHaveBeenCalledWith('unregistered all devices and shutting down...', false, 10);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('unregistered all devices and shutting down...'));

    matterbridge.plugins.clear();
    matterbridge.bridgeMode = 'bridge';
    cleanupSpy.mockRestore();
    removeAllBridgedEndpointsSpy.mockRestore();
  });

  test('Matterbridge.initialize() cleanup()', async () => {
    process.argv = ['node', 'matterbridge.mocked.test.js', '-novirtual', '-frontend', '0', '-test', '-homedir', HOMEDIR];
    await matterbridge.initialize();
    matterbridge.plugins.set({ name: 'matterbridge-mock1', path: './src/mock/plugin1/package.json', type: 'Unknown', version: '1.0.0', description: 'To update', author: 'To update', homepage: 'https://example.com' });
    const plugin = matterbridge.plugins.get('matterbridge-mock1');
    expect(plugin).toBeDefined();
    if (!plugin) return;
    plugin.enabled = true;
    plugin.error = false;
    plugin.reachabilityTimeout = setTimeout(() => {}, 60000);
    const pluginsShutdownSpy = jest.spyOn(matterbridge.plugins as any, 'shutdown').mockImplementation(async () => {
      return Promise.resolve();
    });

    (matterbridge as any).startMatterInterval = setInterval(() => {}, 60000);
    (matterbridge as any).configureTimeout = setTimeout(() => {}, 60000);
    (matterbridge as any).reachabilityTimeout = setTimeout(() => {}, 60000);
    await (matterbridge as any).cleanup('cleanup test', false, 10);
    expect((matterbridge as any).startMatterInterval).toBeUndefined();
    expect((matterbridge as any).checkUpdateTimeout).toBeUndefined();
    expect((matterbridge as any).checkUpdateInterval).toBeUndefined();
    expect((matterbridge as any).configureTimeout).toBeUndefined();
    expect((matterbridge as any).reachabilityTimeout).toBeUndefined();
    expect(plugin.reachabilityTimeout).toBeUndefined();

    const instance = (Matterbridge as any).instance;
    (matterbridge as any).initialized = true; // Set initialized to true to allow cleanup
    (matterbridge as any).hasCleanupStarted = false; // Set hasCleanupStarted to false to allow cleanup
    await (matterbridge as any).cleanup('updating...', true, 10);
    (Matterbridge as any).instance = instance; // Restore the instance after cleanup
    (matterbridge as any).initialized = true; // Set initialized to true to allow cleanup
    (matterbridge as any).hasCleanupStarted = false; // Set hasCleanupStarted to false to allow cleanup
    await (matterbridge as any).cleanup('restarting...', true, 10);
    (Matterbridge as any).instance = instance; // Restore the instance after cleanup

    matterbridge.plugins.clear();
    pluginsShutdownSpy.mockRestore();
  });

  test('Matterbridge.initialize() startBridge()', async () => {
    // Setup test environment
    jest.useFakeTimers();
    const createServerNodeSpy = jest.spyOn(matterbridge as any, 'createServerNode').mockImplementation(async () => Promise.resolve({ add: jest.fn() }));
    const createAggregatorNodeSpy = jest.spyOn(matterbridge as any, 'createAggregatorNode').mockImplementation(async () => Promise.resolve({}));
    const startPluginsSpy = jest.spyOn(matterbridge as any, 'startPlugins').mockImplementation(async () => Promise.resolve());
    const startServerNodeSpy = jest.spyOn(matterbridge as any, 'startServerNode').mockImplementation(async () => Promise.resolve());

    process.argv = ['node', 'matterbridge.mocked.test.js', '-novirtual', '-frontend', '0', '-test', '-homedir', HOMEDIR];
    await matterbridge.initialize();
    matterbridge.plugins.clear();
    matterbridge.plugins.set({ name: 'matterbridge-mock1', path: './src/mock/plugin1/package.json', type: 'Unknown', version: '1.0.0', description: 'To update', author: 'To update', homepage: 'https://example.com' });
    matterbridge.plugins.set({ name: 'matterbridge-mock2', path: './src/mock/plugin2/package.json', type: 'Unknown', version: '1.0.0', description: 'To update', author: 'To update', homepage: 'https://example.com' });
    matterbridge.plugins.set({ name: 'matterbridge-mock3', path: './src/mock/plugin3/package.json', type: 'Unknown', version: '1.0.0', description: 'To update', author: 'To update', homepage: 'https://example.com' });
    const plugin1 = matterbridge.plugins.get('matterbridge-mock1');
    expect(plugin1).toBeDefined();
    if (!plugin1) return;
    plugin1.enabled = true;
    plugin1.error = false;
    const plugin2 = matterbridge.plugins.get('matterbridge-mock2');
    expect(plugin2).toBeDefined();
    if (!plugin2) return;
    plugin2.enabled = true;
    plugin2.error = false;
    const plugin3 = matterbridge.plugins.get('matterbridge-mock3');
    expect(plugin3).toBeDefined();
    if (!plugin3) return;
    plugin3.enabled = false;

    // test throw error for matterStorageManager not initialized
    const saveMatterStorageManager = matterbridge.matterStorageManager;
    matterbridge.matterStorageManager = undefined;
    await expect((matterbridge as any).startBridge()).rejects.toThrow();
    matterbridge.matterStorageManager = saveMatterStorageManager;

    // test throw error for matterbridgeContext not initialized
    const saveMatterStorageContext = matterbridge.matterbridgeContext;
    matterbridge.matterbridgeContext = undefined;
    await expect((matterbridge as any).startBridge()).rejects.toThrow();
    matterbridge.matterbridgeContext = saveMatterStorageContext;

    await (matterbridge as any).startBridge();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Starting start matter interval in bridge mode`));

    jest.advanceTimersByTime(1000); // Simulate 1 second for the interval
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Waiting (failSafeCount=0/120) in startMatterInterval interval`));
    (matterbridge as any).failCountLimit = 0; // Set failCountLimit to 0 to trigger the fail-safe check

    jest.advanceTimersByTime(1000); // Simulate 1 second for the interval
    expect(plugin1.error).toBe(true);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Error waiting for plugin ${plg}${plugin1.name}${er} to load and start. Plugin is in error state.`));

    jest.advanceTimersByTime(1000); // Simulate 1 second for the interval
    expect((matterbridge as any).startMatterInterval).toBeUndefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`The plugin ${plg}${plugin1.name}${er} is in error state.`));

    await (matterbridge as any).startBridge();
    plugin1.error = false; // Reset plugin error state for next tests
    plugin1.loaded = true; // Set plugin as loaded to continue testing
    plugin1.started = true; // Set plugin as started to continue testing
    plugin2.error = false; // Reset plugin error state for next tests
    plugin2.loaded = true; // Set plugin as loaded to continue testing
    plugin2.started = true; // Set plugin as started to continue testing
    plugin3.enabled = false;
    jest.advanceTimersByTime(1000); // Simulate 1 second for the interval
    expect(startServerNodeSpy).toHaveBeenCalled();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Cleared startMatterInterval interval for Matterbridge`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringContaining(`Matterbridge bridge started successfully`));

    pluginsConfigureSpy.mockImplementation(async (plugin: RegisteredPlugin) => {
      if (plugin.name === 'matterbridge-mock1') {
        plugin.configured = false; // Simulate not successful configuration
        return Promise.resolve(undefined as any);
      } else return Promise.reject(new Error(`Mocked error for plugin ${plugin.name}`));
    });
    jest.advanceTimersByTime(60000); // Simulate 1 minute for the interval
    jest.useRealTimers();
    await new Promise((resolve) => setTimeout(resolve, 100)); // Wait for the next tick
    expect(pluginsConfigureSpy).toHaveBeenCalledTimes(2);
    expect((matterbridge as any).startMatterInterval).toBeUndefined(); // Reset the interval after testing

    // Reset test environment
    matterbridge.plugins.clear();
    matterbridge.serverNode = undefined;
    matterbridge.aggregatorNode = undefined;
    matterbridge.plugins.clear();
    createServerNodeSpy.mockRestore();
    createAggregatorNodeSpy.mockRestore();
    startPluginsSpy.mockRestore();
    startServerNodeSpy.mockRestore();
  });

  test('Matterbridge.initialize() startChildbridge()', async () => {
    // Setup test environment
    jest.useFakeTimers();
    const createServerNodeSpy = jest.spyOn(matterbridge as any, 'createServerNode').mockImplementation(async () => Promise.resolve({ add: jest.fn() }));
    const createAggregatorNodeSpy = jest.spyOn(matterbridge as any, 'createAggregatorNode').mockImplementation(async () => Promise.resolve({}));
    const startPluginsSpy = jest.spyOn(matterbridge as any, 'startPlugins').mockImplementation(async () => Promise.resolve());
    const startServerNodeSpy = jest.spyOn(matterbridge as any, 'startServerNode').mockImplementation(async () => Promise.resolve());

    process.argv = ['node', 'matterbridge.mocked.test.js', '-novirtual', '-frontend', '0', '-test', '-homedir', HOMEDIR];
    await matterbridge.initialize();
    matterbridge.plugins.clear();
    // prettier-ignore-start
    matterbridge.plugins.set({ name: 'matterbridge-mock1', path: './src/mock/plugin1/package.json', type: 'AccessoryPlatform', version: '1.0.0', addedDevices: 0, description: 'To update', author: 'To update', homepage: 'https://example.com' });
    matterbridge.plugins.set({ name: 'matterbridge-mock2', path: './src/mock/plugin2/package.json', type: 'AccessoryPlatform', version: '1.0.0', addedDevices: 1, description: 'To update', author: 'To update', homepage: 'https://example.com' });
    matterbridge.plugins.set({ name: 'matterbridge-mock3', path: './src/mock/plugin3/package.json', type: 'AccessoryPlatform', version: '1.0.0', addedDevices: 1, description: 'To update', author: 'To update', homepage: 'https://example.com' });
    matterbridge.plugins.set({ name: 'matterbridge-mock4', path: './src/mock/plugin4/package.json', type: 'DynamicPlatform', version: '1.0.0', addedDevices: 1, description: 'To update', author: 'To update', homepage: 'https://example.com' });
    matterbridge.plugins.set({ name: 'matterbridge-mock5', path: './src/mock/plugin5/package.json', type: 'DynamicPlatform', version: '1.0.0', addedDevices: 1, description: 'To update', author: 'To update', homepage: 'https://example.com' });
    matterbridge.plugins.set({ name: 'matterbridge-mock6', path: './src/mock/plugin6/package.json', type: 'DynamicPlatform', version: '1.0.0', addedDevices: 1, description: 'To update', author: 'To update', homepage: 'https://example.com' });
    // prettier-ignore-end
    const plugin1 = matterbridge.plugins.get('matterbridge-mock1') as RegisteredPlugin;
    plugin1.enabled = true;
    plugin1.error = false;
    const plugin2 = matterbridge.plugins.get('matterbridge-mock2') as RegisteredPlugin;
    plugin2.enabled = true;
    plugin2.error = false;
    const plugin3 = matterbridge.plugins.get('matterbridge-mock3') as RegisteredPlugin;
    plugin3.enabled = true;
    plugin3.error = false;
    plugin3.enabled = false;
    const plugin4 = matterbridge.plugins.get('matterbridge-mock4') as RegisteredPlugin;
    plugin4.enabled = true;
    plugin4.error = false;
    const plugin5 = matterbridge.plugins.get('matterbridge-mock5') as RegisteredPlugin;
    plugin5.enabled = true;
    plugin5.error = false;
    const plugin6 = matterbridge.plugins.get('matterbridge-mock6') as RegisteredPlugin;
    plugin6.enabled = true;
    plugin6.error = false;

    // test throw error for matterStorageManager not initialized
    const saveMatterStorageManager = matterbridge.matterStorageManager;
    matterbridge.matterStorageManager = undefined;
    await expect((matterbridge as any).startChildbridge()).rejects.toThrow();
    matterbridge.matterStorageManager = saveMatterStorageManager;

    await (matterbridge as any).startChildbridge(0);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Starting start matter interval in childbridge mode...`));
    jest.advanceTimersByTime(1000); // Simulate 1 second for the start interval
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Waiting (failSafeCount=0/120)`));

    (matterbridge as any).failCountLimit = 0; // Set failCountLimit to 0 to trigger the fail-safe check. It will put the plugin in error state
    jest.advanceTimersByTime(1000); // Advance 1 second for the start interval
    expect(plugin1.error).toBe(true);
    expect(plugin2.error).toBe(true);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Error waiting for plugin ${plg}${plugin1.name}${er} to load and start. Plugin is in error state.`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Error waiting for plugin ${plg}${plugin2.name}${er} to load and start. Plugin is in error state.`));

    jest.advanceTimersByTime(1000); // Simulate 1 second for the start interval. It will clear the interval for error state of the first plugin
    expect((matterbridge as any).startMatterInterval).toBeUndefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`The plugin ${plg}${plugin1.name}${er} is in error state.`));
    // expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`The plugin ${plg}${plugin2.name}${er} is in error state.`));
    jest.clearAllMocks();

    matterbridge.devices.set({ name: 'Test Device 1', uniqueId: '123', mode: 'server', serverNode: {} } as any); // Mock a device in server mode
    await (matterbridge as any).startChildbridge(0);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Starting start matter interval in childbridge mode...`));
    plugin1.error = plugin2.error = plugin3.error = plugin4.error = plugin5.error = plugin6.error = false; // Reset error state for next tests
    plugin1.enabled = plugin1.loaded = plugin1.started = true;
    plugin2.enabled = plugin2.loaded = plugin2.started = true;
    plugin3.enabled = plugin3.loaded = plugin3.started = true;
    plugin4.enabled = plugin4.loaded = plugin4.started = true;
    plugin5.enabled = plugin5.loaded = plugin5.started = true;
    plugin6.enabled = plugin6.loaded = plugin6.started = true;
    plugin6.enabled = false; // Disable plugin6 to test the childbridge mode
    plugin2.serverNode = {} as any; // Mock serverNode for plugin2
    plugin2.aggregatorNode = {} as any; // Mock aggregatorNode for plugin2
    plugin2.storageContext = {} as any; // Mock storageContext for plugin2
    plugin2.nodeContext = {} as any; // Mock storageContext for plugin2
    plugin2.type = 'DynamicPlatform'; // Set type to DynamicPlatform for plugin2
    plugin3.serverNode = {} as any; // Mock serverNode for plugin3
    plugin4.serverNode = {} as any; // Mock serverNode for plugin4
    plugin4.storageContext = {} as any; // Mock storageContext for plugin4
    jest.advanceTimersByTime(1000); // Simulate 1 second for the interval to execute
    expect((matterbridge as any).startMatterInterval).toBeUndefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Cleared startMatterInterval interval in childbridge mode`));
    expect((matterbridge as any).configureTimeout).toBeDefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringContaining(`Matterbridge childbridge started successfully`));

    pluginsConfigureSpy.mockImplementation(async (plugin: RegisteredPlugin) => {
      if (plugin.name === 'matterbridge-mock5') {
        return Promise.reject(new Error(`Mocked error for plugin ${plugin.name}`));
      } else {
        plugin.configured = false; // Simulate not successful configuration
        return Promise.resolve(undefined as any);
      }
    });
    jest.advanceTimersByTime(60000); // Simulate 1 minute for the interval
    jest.useRealTimers();
    await new Promise((resolve) => setTimeout(resolve, 100)); // Wait for the next tick
    expect(plugin5.error).toBe(true);
    expect(pluginsConfigureSpy).toHaveBeenCalledTimes(5);

    // Reset test environment
    matterbridge.plugins.clear();
    matterbridge.devices.clear();
    matterbridge.serverNode = undefined;
    matterbridge.aggregatorNode = undefined;
    matterbridge.plugins.clear();
    createServerNodeSpy.mockRestore();
    createAggregatorNodeSpy.mockRestore();
    startPluginsSpy.mockRestore();
    startServerNodeSpy.mockRestore();
    pluginsConfigureSpy.mockRestore();
  }, 10000);
});
