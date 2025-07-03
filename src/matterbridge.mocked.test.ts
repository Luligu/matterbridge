// src\matterbridge.test.ts

const NAME = 'MatterbridgeMocked';
const HOMEDIR = path.join('jest', NAME);

// Mock the spawnCommand from spawn module before importing it
jest.unstable_mockModule('./utils/spawn.js', () => ({
  spawnCommand: jest.fn((matterbridge: Matterbridge, command: string, args: string[]) => {
    return Promise.resolve(true); // Mock the spawnCommand function to resolve immediately
  }),
}));
const spawn = await import('./utils/spawn.js');
const spawnCommandMock = spawn.spawnCommand as jest.MockedFunction<typeof spawn.spawnCommand>;

import { jest } from '@jest/globals';
import os from 'node:os';
import path from 'node:path';
import { rmSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';

import { AnsiLogger, CYAN, LogLevel, nf, nt, TimestampFormat, wr } from 'node-ansi-logger';
import { NodeStorageManager } from 'node-persist-manager';

import { getParameter } from './utils/export.ts';
import { Matterbridge } from './matterbridge.ts';
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

// Cleanup the matter environment
rmSync(HOMEDIR, { recursive: true, force: true });

describe('Matterbridge mocked', () => {
  let matterbridge: Matterbridge;

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
    expect(matterbridge.matterbridgeQrPairingCode).toBeUndefined();
    expect(matterbridge.matterbridgeManualPairingCode).toBeUndefined();
    expect(matterbridge.matterbridgeFabricInformations).toBeUndefined();
    expect(matterbridge.matterbridgeSessionInformations).toBeUndefined();
    expect(matterbridge.matterbridgePaired).toBeUndefined();
    expect(matterbridge.bridgeMode).toBe('');
    expect(matterbridge.restartMode).toBe('');
    expect(matterbridge.profile).toBe('Jest');
    expect(matterbridge.shutdown).toBe(false);
    expect(matterbridge.edge).toBe(true);
    expect((matterbridge as any).failCountLimit).toBe(120);

    expect(matterbridge.log).toBeDefined();
    expect(matterbridge.matterbrideLoggerFile).toBe('matterbridge.Jest.log');
    expect(matterbridge.matterLoggerFile).toBe('matter.Jest.log');

    expect(matterbridge.plugins).toBeUndefined();
    expect(matterbridge.devices).toBeUndefined();

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
    spawnCommandMock.mockImplementationOnce((matterbridge: Matterbridge, command: string, args: string[]) => {
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
    const checkUpdatesSpy = update.checkUpdates;
    jest.useFakeTimers();
    await matterbridge.initialize();
    jest.advanceTimersByTime(12 * 60 * 60 * 1000); // Simulate 12 hours
    jest.useRealTimers();
    await new Promise((resolve) => setTimeout(resolve, 10)); // Wait for the next tick
    expect(checkUpdatesSpy).toHaveBeenCalledTimes(2);
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
});
