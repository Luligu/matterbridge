// src\matterbridge.test.ts

const NAME = 'MatterbridgeMocked';
const HOMEDIR = path.join('jest', NAME);

import { jest } from '@jest/globals';
import os from 'node:os';
import path from 'node:path';
import { rmSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';

import { AnsiLogger, CYAN, LogLevel, nf, TimestampFormat } from 'node-ansi-logger';
import { NodeStorageManager } from 'node-persist-manager';

import { getParameter } from './utils/export.ts';
import { Matterbridge } from './matterbridge.ts';
import { VendorId, LogLevel as MatterLogLevel } from '@matter/main';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.ts';

let loggerLogSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.log>;
let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
let consoleDebugSpy: jest.SpiedFunction<typeof console.log>;
let consoleInfoSpy: jest.SpiedFunction<typeof console.log>;
let consoleWarnSpy: jest.SpiedFunction<typeof console.log>;
let consoleErrorSpy: jest.SpiedFunction<typeof console.log>;
const debug = true; // Set to true to enable debug logs

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
    matterbridge.log = new AnsiLogger({ logName: 'Matterbridge', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });
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
      'matterbridge.test.js',
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
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Using mdnsInterface ${CYAN}${availableInterfaces[0]}${nf} for the Matter MdnsBroadcaster.`);
    await (matterbridge as any).nodeContext.set('mattermdnsinterface', '');
    await (matterbridge as any).nodeContext.set('matteripv4address', '');
    await (matterbridge as any).nodeContext.set('matteripv6address', '');
    expect(matterbridge.matterbridgeInformation.virtualMode).toBe('disabled');

    process.argv = [
      'node',
      'matterbridge.test.js',
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
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Invalid mdnsInterface`));

    await (matterbridge as any).nodeContext.set('mattermdnsinterface', '');
    await (matterbridge as any).nodeContext.remove('virtualmode');
    process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-test', '-homedir', HOMEDIR, '-profile', 'Jest', '-logger', 'null', '-matterlogger', 'null', '-debug'];
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
});
