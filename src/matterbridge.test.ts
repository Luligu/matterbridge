// src\matterbridge.test.ts

const MATTER_PORT = 6001;
const NAME = 'MatterbridgeGlobal';
const HOMEDIR = path.join('jest', NAME);

process.argv = ['node', 'matterbridge.test.js', '-novirtual', '-frontend', '0', '-port', MATTER_PORT.toString(), '-homedir', HOMEDIR, '-profile', 'Jest', '-logger', 'debug', '-matterlogger', 'debug', '-debug'];

import os from 'node:os';
import path from 'node:path';

import { jest } from '@jest/globals';
import { LogLevel as MatterLogLevel, Logger } from '@matter/general';
import { FabricId, FabricIndex, NodeId, VendorId } from '@matter/types';
import { SessionsBehavior } from '@matter/node';
import { ExposedFabricInformation } from '@matter/protocol';
import { LogLevel, nf } from 'node-ansi-logger';

import { getParameter, hasParameter } from './utils/commandLine.js';
import { Matterbridge } from './matterbridge.js';
import { plg } from './matterbridgeTypes.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { closeMdnsInstance, destroyInstance, flushAsync, loggerLogSpy, setupTest } from './jestutils/jestHelpers.js';
import { BroadcastServer } from './broadcastServer.js';

// Mock BroadcastServer methods
const broadcastServerIsWorkerRequestSpy = jest.spyOn(BroadcastServer.prototype, 'isWorkerRequest').mockImplementation(() => true);
const broadcastServerIsWorkerResponseSpy = jest.spyOn(BroadcastServer.prototype, 'isWorkerResponse').mockImplementation(() => true);
const broadcastServerBroadcastMessageHandlerSpy = jest.spyOn(BroadcastServer.prototype as any, 'broadcastMessageHandler').mockImplementation(() => {});
const broadcastServerRequestSpy = jest.spyOn(BroadcastServer.prototype, 'request').mockImplementation(() => {});
const broadcastServerRespondSpy = jest.spyOn(BroadcastServer.prototype, 'respond').mockImplementation(() => {});
const broadcastServerFetchSpy = jest.spyOn(BroadcastServer.prototype, 'fetch').mockImplementation(async () => {
  return Promise.resolve(undefined) as any;
});

// Setup the test environment
setupTest(NAME, false);

describe('Matterbridge', () => {
  let matterbridge: Matterbridge;

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Close mDNS instance
    await closeMdnsInstance(matterbridge);
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('Matterbridge.loadInstance(false)', async () => {
    expect((Matterbridge as any).instance).toBeUndefined();
    matterbridge = await Matterbridge.loadInstance(); // Default to false if no parameter is provided
    expect((Matterbridge as any).instance).toBeDefined();
    expect((matterbridge as any).initialized).toBeFalsy();
    expect(matterbridge).toBeDefined();
    expect(matterbridge.profile).toBe('Jest');
    expect(matterbridge.serverNode).toBeUndefined();
    expect(matterbridge.aggregatorNode).toBeUndefined();
    expect(matterbridge.matterStorageManager).toBeUndefined();
    expect(matterbridge.matterStorageService).toBeUndefined();
    expect(matterbridge.matterbridgeContext).toBeUndefined();

    expect((matterbridge as any).initialized).toBeFalsy();
    expect((matterbridge as any).log).toBeDefined();
    expect((matterbridge as any).homeDirectory).toBe('');
    expect((matterbridge as any).matterbridgeDirectory).toBe('');
    expect((matterbridge as any).globalModulesDirectory).toBe('');
    expect((matterbridge as any).matterbridgeLatestVersion).toBe('');
    expect((matterbridge as any).nodeStorage).toBeUndefined();
    expect((matterbridge as any).nodeContext).toBeUndefined();
    expect((matterbridge as any).globalModulesDirectory).toBe('');
    expect((matterbridge as any).matterbridgeLatestVersion).toBe('');
    expect((matterbridge as any).plugins).toBeDefined();
    expect((matterbridge as any).devices).toBeDefined();

    expect((matterbridge as any).frontend.httpServer).toBeUndefined();
    expect((matterbridge as any).frontend.httpsServer).toBeUndefined();
    expect((matterbridge as any).frontend.expressApp).toBeUndefined();
    expect((matterbridge as any).frontend.webSocketServer).toBeUndefined();

    // Destroy the Matterbridge instance
    await destroyInstance(matterbridge, 0, 0);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Cleanup with instance not initialized...'));

    expect((matterbridge as any).initialized).toBeFalsy();
    expect((matterbridge as any).hasCleanupStarted).toBeFalsy();
    expect((Matterbridge as any).instance).toBeDefined(); // Instance is still defined cause cleanup() is not called when initialized is false
  });

  test('broadcast handler', async () => {
    broadcastServerIsWorkerRequestSpy.mockImplementationOnce(() => false);
    await (matterbridge as any).msgHandler({} as any);
    broadcastServerIsWorkerResponseSpy.mockImplementationOnce(() => false);
    await (matterbridge as any).msgHandler({} as any);

    expect((matterbridge as any).server).toBeInstanceOf(BroadcastServer);

    await (matterbridge as any).msgHandler({ type: 'jest', src: 'manager', dst: 'matterbridge' } as any); // no id
    await (matterbridge as any).msgHandler({ id: 123456, type: 'jest', src: 'manager', dst: 'unknown' } as any); // unknown dst
    await (matterbridge as any).msgHandler({ id: 123456, type: 'jest', src: 'manager', dst: 'matterbridge' } as any); // valid
    await (matterbridge as any).msgHandler({ id: 123456, type: 'jest', src: 'manager', dst: 'all' } as any); // valid
    await (matterbridge as any).msgHandler({ id: 123456, type: 'jest', src: 'manager', dst: 'matterbridge', params: {} } as any); // valid
    await (matterbridge as any).msgHandler({ id: 123456, type: 'jest', src: 'manager', dst: 'all', response: { success: false } } as any);
    await (matterbridge as any).msgHandler({ id: 123456, type: 'jest', src: 'manager', dst: 'all', response: { success: true } } as any);

    await (matterbridge as any).msgHandler({ id: 123456, type: 'get_log_level', src: 'manager', dst: 'matterbridge' } as any);
    await (matterbridge as any).msgHandler({ id: 123456, type: 'set_log_level', src: 'manager', dst: 'matterbridge', params: { level: LogLevel.DEBUG } } as any);
  });

  test('Matterbridge.loadInstance(true) should not initialize if already loaded', async () => {
    expect((Matterbridge as any).instance).toBeDefined();
    matterbridge = await Matterbridge.loadInstance(true);
    expect((matterbridge as any).initialized).toBeFalsy();
    await (matterbridge as any).initialize();
    expect((matterbridge as any).initialized).toBeTruthy();
    expect(matterbridge.serverNode).toBeDefined();
    expect(matterbridge.aggregatorNode).toBeDefined();
    expect(matterbridge.matterStorageManager).toBeDefined();
    expect(matterbridge.matterStorageService).toBeDefined();
    expect(matterbridge.matterbridgeContext).toBeDefined();
    matterbridge.plugins.clear();
    await matterbridge.plugins.saveToStorage();

    await new Promise((resolve) => {
      matterbridge.once('online', resolve);
    });
    await Promise.resolve();

    expect(matterbridge).toBeDefined();
    expect(matterbridge.profile).toBe('Jest');
    expect((matterbridge as any).initialized).toBeTruthy();
    expect((matterbridge as any).log).toBeDefined();
    expect(matterbridge.homeDirectory).toBe(getParameter('homedir') ?? os.homedir());
    expect(matterbridge.matterbridgeDirectory).toBe(path.join(matterbridge.homeDirectory, '.matterbridge', 'profiles', 'Jest'));
    expect(matterbridge.matterbridgePluginDirectory).toBe(path.join(matterbridge.homeDirectory, 'Matterbridge', 'profiles', 'Jest'));
    expect(matterbridge.matterbridgeCertDirectory).toBe(path.join(matterbridge.homeDirectory, '.mattercert', 'profiles', 'Jest'));
    expect(matterbridge.globalModulesDirectory).not.toBe('');
    expect(matterbridge.matterbridgeVersion).not.toBe('');
    expect(matterbridge.matterbridgeLatestVersion).toBe(matterbridge.matterbridgeVersion);
    expect(matterbridge.matterbridgeDevVersion).toBe(matterbridge.matterbridgeVersion);
    expect((matterbridge as any).nodeStorage).toBeDefined();
    expect((matterbridge as any).nodeContext).toBeDefined();
    expect(matterbridge.plugins).toBeDefined();
    expect((matterbridge as any).plugins).toBeDefined();
    expect((matterbridge as any).plugins.size).toBe(0);
    expect(matterbridge.devices).toBeDefined();
    expect((matterbridge as any).devices).toBeDefined();
    expect((matterbridge as any).devices.size).toBe(0);

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Matterbridge profile: Jest'));

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`Created Matterbridge Home Directory: ${HOMEDIR}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`Created Matterbridge Directory: ${path.join('jest', 'MatterbridgeGlobal', '.matterbridge')}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`Created Matterbridge Frontend Certificate Directory: ${path.join('jest', 'MatterbridgeGlobal', '.matterbridge', 'profiles', 'Jest', 'certs')}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`Created Matterbridge Frontend Uploads Directory: ${path.join('jest', 'MatterbridgeGlobal', '.matterbridge', 'profiles', 'Jest', 'uploads')}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`Created Matterbridge Plugin Directory: ${path.join('jest', 'MatterbridgeGlobal', 'Matterbridge', 'profiles', 'Jest')}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`Created Matterbridge Matter Certificate Directory: ${path.join('jest', 'MatterbridgeGlobal', '.mattercert', 'profiles', 'Jest')}`));

    // -frontend 0
    expect((matterbridge as any).frontend.httpServer).toBeUndefined();
    expect((matterbridge as any).frontend.httpsServer).toBeUndefined();
    expect((matterbridge as any).frontend.expressApp).toBeUndefined();
    expect((matterbridge as any).frontend.webSocketServer).toBeUndefined();

    // Destroy the Matterbridge instance
    await destroyInstance(matterbridge, 0, 0);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringContaining('Cleanup completed. Shutting down...'));

    expect((matterbridge as any).initialized).toBeFalsy();
    expect((matterbridge as any).hasCleanupStarted).toBeFalsy();
    expect((Matterbridge as any).instance).toBeUndefined(); // Instance is not defined cause cleanup() has been called
  });

  test('Matterbridge.loadInstance(true) with frontend', async () => {
    process.argv = ['node', 'matterbridge.test.js', '-novirtual', '-frontend', '8081', '-port', MATTER_PORT.toString(), '-homedir', HOMEDIR, '-profile', 'Jest'];

    expect((Matterbridge as any).instance).toBeUndefined();
    matterbridge = await Matterbridge.loadInstance(true);
    expect((Matterbridge as any).instance).toBeDefined();
    expect((matterbridge as any).initialized).toBeTruthy();

    await new Promise((resolve) => {
      matterbridge.once('online', resolve);
    });
    await Promise.resolve();

    expect(matterbridge).toBeDefined();
    expect(matterbridge.profile).toBe('Jest');
    expect((matterbridge as any).initialized).toBeTruthy();
    expect((matterbridge as any).log).toBeDefined();
    expect((matterbridge as any).homeDirectory).not.toBe('');
    expect((matterbridge as any).matterbridgeDirectory).not.toBe('');
    expect((matterbridge as any).nodeStorage).toBeDefined();
    expect((matterbridge as any).nodeContext).toBeDefined();
    expect((matterbridge as any).plugins).toBeDefined();
    expect((matterbridge as any).devices.size).toBe(0);

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Directory Matterbridge Home Directory already exists at path: ${HOMEDIR}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Directory Matterbridge Directory already exists at path: ${path.join('jest', 'MatterbridgeGlobal', '.matterbridge', 'profiles', 'Jest')}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.DEBUG,
      expect.stringContaining(`Directory Matterbridge Frontend Certificate Directory already exists at path: ${path.join('jest', 'MatterbridgeGlobal', '.matterbridge', 'profiles', 'Jest', 'certs')}`),
    );
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.DEBUG,
      expect.stringContaining(`Directory Matterbridge Frontend Uploads Directory already exists at path: ${path.join('jest', 'MatterbridgeGlobal', '.matterbridge', 'profiles', 'Jest', 'uploads')}`),
    );
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Directory Matterbridge Plugin Directory already exists at path: ${path.join('jest', 'MatterbridgeGlobal', 'Matterbridge', 'profiles', 'Jest')}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Directory Matterbridge Matter Certificate Directory already exists at path: ${path.join('jest', 'MatterbridgeGlobal', '.mattercert', 'profiles', 'Jest')}`));

    // -frontend 8081
    expect((matterbridge as any).frontend.port).toBe(8081);
    expect((matterbridge as any).frontend.httpServer).toBeDefined();
    expect((matterbridge as any).frontend.httpsServer).toBeUndefined();
    expect((matterbridge as any).frontend.expressApp).toBeDefined();
    expect((matterbridge as any).frontend.webSocketServer).toBeDefined();
  }, 60000);

  test('destroy instance', async () => {
    // Destroy the Matterbridge instance
    await destroyInstance(matterbridge, 0, 0);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringContaining('Cleanup completed. Shutting down...'));
  });

  test('Matterbridge profile', async () => {
    process.argv = ['node', 'matterbridge.test.js', '-novirtual', '-frontend', '0', '-port', MATTER_PORT.toString(), '-homedir', HOMEDIR, '-profile', 'Jest', '-logger', 'debug', '-matterlogger', 'debug'];
    matterbridge = await Matterbridge.loadInstance(true);
    if (!(matterbridge as any).initialized) await (matterbridge as any).initialize();
    expect(matterbridge).toBeDefined();
    expect(matterbridge.profile).toBe('Jest');
    expect((matterbridge as any).initialized).toBe(true);
    expect((matterbridge as any).hasCleanupStarted).toBe(false);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Matterbridge profile: Jest'));

    await new Promise((resolve) => {
      matterbridge.once('online', resolve);
    });
    await Promise.resolve();
  }, 60000);

  test('hasParameter("debug") should return false', async () => {
    expect(hasParameter('debug')).toBeFalsy();
  });

  test('hasParameter("frontend") should return true', async () => {
    expect(hasParameter('frontend')).toBeTruthy();
  });

  test('Sanitize fabrics', () => {
    const fabricInfos: ExposedFabricInformation[] = [
      {
        fabricIndex: FabricIndex(1),
        fabricId: FabricId(45653242346465555556n),
        nodeId: NodeId(556546442432656555556n),
        rootNodeId: NodeId(5565442324264656555556n),
        rootVendorId: VendorId(4996),
        label: 'Fabric 1 label',
      },
      {
        fabricIndex: FabricIndex(2),
        fabricId: FabricId(45654621214656555556n),
        nodeId: NodeId(556546462112156555556n),
        rootNodeId: NodeId(556546412212656555556n),
        rootVendorId: VendorId(4937),
        label: 'Fabric 2 label',
      },
    ];
    expect((matterbridge as any).sanitizeFabricInformations(fabricInfos).length).toBe(2);
    expect(() => {
      JSON.stringify(fabricInfos);
    }).toThrow();
    expect(JSON.stringify((matterbridge as any).sanitizeFabricInformations(fabricInfos)).length).toBe(402);
  });

  test('Sanitize sessions', () => {
    let sessionInfos: SessionsBehavior.Session[] = [
      {
        name: 'secure/64351',
        nodeId: NodeId(16784206195868397986n),
        peerNodeId: NodeId(1604858123872676291n),
        fabric: { fabricIndex: FabricIndex(2), fabricId: FabricId(456546212146567986n), nodeId: NodeId(1678420619586823323397986n), rootNodeId: NodeId(18446744060824623349729n), rootVendorId: VendorId(4362), label: 'SmartThings Hub 0503' },
        isPeerActive: true,
        lastInteractionTimestamp: 1720035723121269,
        lastActiveTimestamp: 1720035761223121,
        numberOfActiveSubscriptions: 0,
      },
    ];
    expect(() => {
      JSON.stringify(sessionInfos);
    }).toThrow();
    expect((matterbridge as any).sanitizeSessionInformation(sessionInfos).length).toBe(1);
    expect(JSON.stringify((matterbridge as any).sanitizeSessionInformation(sessionInfos)).length).toBe(450);
    sessionInfos = [
      {
        name: 'secure/64351',
        nodeId: NodeId(16784206195868397986n),
        peerNodeId: NodeId(1604858123872676291n),
        fabric: { fabricIndex: FabricIndex(2), fabricId: FabricId(456546212146567986n), nodeId: NodeId(1678420619586823323397986n), rootNodeId: NodeId(18446744060824623349729n), rootVendorId: VendorId(4362), label: 'SmartThings Hub 0503' },
        isPeerActive: false,
        lastInteractionTimestamp: 1720035723121269,
        lastActiveTimestamp: 1720035761223121,
        numberOfActiveSubscriptions: 0,
      },
    ];
    expect((matterbridge as any).sanitizeSessionInformation(sessionInfos).length).toBe(0);
  });

  test('getVendorIdName', () => {
    expect((matterbridge as any).getVendorIdName(undefined)).toBe('');
    expect((matterbridge as any).getVendorIdName(4937)).toContain('AppleHome');
    expect((matterbridge as any).getVendorIdName(4996)).toContain('AppleKeyChain');
    expect((matterbridge as any).getVendorIdName(4362)).toContain('SmartThings');
    expect((matterbridge as any).getVendorIdName(4939)).toContain('HomeAssistant');
    expect((matterbridge as any).getVendorIdName(24582)).toContain('GoogleHome');
    expect((matterbridge as any).getVendorIdName(4631)).toContain('Alexa');
    expect((matterbridge as any).getVendorIdName(4701)).toContain('Tuya');
    expect((matterbridge as any).getVendorIdName(4718)).toContain('Xiaomi');
    expect((matterbridge as any).getVendorIdName(4742)).toContain('eWeLink');
    expect((matterbridge as any).getVendorIdName(5264)).toContain('Shelly');
    expect((matterbridge as any).getVendorIdName(0x1488)).toContain('ShortcutLabsFlic');
    expect((matterbridge as any).getVendorIdName(65521)).toContain('MatterTest');
    expect((matterbridge as any).getVendorIdName(matterbridge.aggregatorVendorId)).toContain('MatterTest');
    expect((matterbridge as any).getVendorIdName(1)).toContain('Unknown vendorId');
  });

  test('matterbridge -add mockPlugin1', async () => {
    expect((matterbridge as any).initialized).toBe(true);
    expect((matterbridge as any).hasCleanupStarted).toBe(false);
    expect((matterbridge as any).shutdown).toBe(false);
    expect(matterbridge.plugins).toHaveLength(0);
    expect(matterbridge.devices).toHaveLength(0);

    process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-port', MATTER_PORT.toString(), '-homedir', HOMEDIR, '-profile', 'Jest', '-logger', 'debug', '-matterlogger', 'debug', '-add', './src/mock/plugin1'];
    await (matterbridge as any).parseCommandLine();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Added plugin ${plg}matterbridge-mock1${nf}`);

    const plugins = matterbridge.plugins.array();
    expect(plugins).toHaveLength(1);
    expect(plugins[0].version).toBe('1.0.1');
    expect(plugins[0].name).toBe('matterbridge-mock1');
    expect(plugins[0].description).toBe('Matterbridge mock plugin 1');
    expect(plugins[0].author).toBe('https://github.com/Luligu');
    expect(plugins[0].enabled).toBeTruthy();

    expect(matterbridge.devices).toHaveLength(0);

    matterbridge.shutdown = false;
    matterbridge.removeAllListeners('shutdown');
  }, 60000);

  test('matterbridge -disable mockPlugin1', async () => {
    expect((matterbridge as any).initialized).toBe(true);
    expect((matterbridge as any).hasCleanupStarted).toBe(false);
    expect((matterbridge as any).shutdown).toBe(false);
    expect(matterbridge.plugins).toHaveLength(1);
    expect(matterbridge.devices).toHaveLength(0);

    process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-port', MATTER_PORT.toString(), '-homedir', HOMEDIR, '-profile', 'Jest', '-logger', 'debug', '-matterlogger', 'debug', '-disable', './src/mock/plugin1'];
    await (matterbridge as any).parseCommandLine();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Disabled plugin ${plg}matterbridge-mock1${nf}`);

    const plugins = matterbridge.plugins.array();
    expect(plugins).toHaveLength(1);
    expect(plugins[0].version).toBe('1.0.1');
    expect(plugins[0].name).toBe('matterbridge-mock1');
    expect(plugins[0].description).toBe('Matterbridge mock plugin 1');
    expect(plugins[0].author).toBe('https://github.com/Luligu');
    expect(plugins[0].enabled).toBeFalsy();

    expect(matterbridge.devices).toHaveLength(0);

    matterbridge.shutdown = false;
    matterbridge.removeAllListeners('shutdown');
  }, 60000);

  test('matterbridge -enable mockPlugin1', async () => {
    expect((matterbridge as any).initialized).toBe(true);
    expect((matterbridge as any).hasCleanupStarted).toBe(false);
    expect((matterbridge as any).shutdown).toBe(false);
    expect(matterbridge.plugins).toHaveLength(1);
    expect(matterbridge.devices).toHaveLength(0);

    process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-port', MATTER_PORT.toString(), '-homedir', HOMEDIR, '-profile', 'Jest', '-logger', 'debug', '-matterlogger', 'debug', '-enable', './src/mock/plugin1'];
    await (matterbridge as any).parseCommandLine();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Enabled plugin ${plg}matterbridge-mock1${nf}`);

    const plugins = matterbridge.plugins.array();
    expect(plugins).toHaveLength(1);
    expect(plugins[0].version).toBe('1.0.1');
    expect(plugins[0].name).toBe('matterbridge-mock1');
    expect(plugins[0].description).toBe('Matterbridge mock plugin 1');
    expect(plugins[0].author).toBe('https://github.com/Luligu');
    expect(plugins[0].enabled).toBeTruthy();

    expect(matterbridge.devices).toHaveLength(0);

    matterbridge.shutdown = false;
    matterbridge.removeAllListeners('shutdown');
  }, 60000);

  test('matterbridge -remove mockPlugin1', async () => {
    expect((matterbridge as any).initialized).toBe(true);
    expect((matterbridge as any).hasCleanupStarted).toBe(false);
    expect((matterbridge as any).shutdown).toBe(false);
    expect(matterbridge.plugins).toHaveLength(1);
    expect(matterbridge.devices).toHaveLength(0);

    process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-port', MATTER_PORT.toString(), '-homedir', HOMEDIR, '-profile', 'Jest', '-logger', 'debug', '-matterlogger', 'debug', '-remove', './src/mock/plugin1'];
    await (matterbridge as any).parseCommandLine();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Removed plugin ${plg}matterbridge-mock1${nf}`);

    expect(matterbridge.plugins).toHaveLength(0);
    expect(matterbridge.devices).toHaveLength(0);

    matterbridge.shutdown = false;
    matterbridge.removeAllListeners('shutdown');
  }, 60000);

  test('matterbridge -add mockPlugin1 again', async () => {
    expect((matterbridge as any).initialized).toBe(true);
    expect((matterbridge as any).hasCleanupStarted).toBe(false);
    expect((matterbridge as any).shutdown).toBe(false);

    process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-port', MATTER_PORT.toString(), '-homedir', HOMEDIR, '-profile', 'Jest', '-logger', 'debug', '-matterlogger', 'debug', '-add', './src/mock/plugin1'];
    await (matterbridge as any).parseCommandLine();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Added plugin ${plg}matterbridge-mock1${nf}`);
    const plugins = matterbridge.plugins.array();
    expect(plugins).toHaveLength(1);
    expect(plugins[0].version).toBe('1.0.1');
    expect(plugins[0].name).toBe('matterbridge-mock1');
    expect(plugins[0].description).toBe('Matterbridge mock plugin 1');
    expect(plugins[0].author).toBe('https://github.com/Luligu');
    expect(plugins[0].enabled).toBeTruthy();

    matterbridge.shutdown = false;
    matterbridge.removeAllListeners('shutdown');
  }, 60000);

  test('matterbridge -add mockPlugin2', async () => {
    expect((matterbridge as any).initialized).toBe(true);
    expect((matterbridge as any).hasCleanupStarted).toBe(false);
    expect((matterbridge as any).shutdown).toBe(false);

    process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-port', MATTER_PORT.toString(), '-homedir', HOMEDIR, '-profile', 'Jest', '-logger', 'debug', '-matterlogger', 'debug', '-add', './src/mock/plugin2'];
    await (matterbridge as any).parseCommandLine();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Added plugin ${plg}matterbridge-mock2${nf}`);
    const plugins = matterbridge.plugins.array();
    expect(plugins).toHaveLength(2);
    expect(plugins[1].version).toBe('1.0.2');
    expect(plugins[1].name).toBe('matterbridge-mock2');
    expect(plugins[1].description).toBe('Matterbridge mock plugin 2');
    expect(plugins[1].author).toBe('https://github.com/Luligu');
    expect(plugins[1].enabled).toBeTruthy();

    matterbridge.shutdown = false;
    matterbridge.removeAllListeners('shutdown');
  }, 60000);

  test('matterbridge -add mockPlugin3', async () => {
    expect((matterbridge as any).initialized).toBe(true);
    expect((matterbridge as any).hasCleanupStarted).toBe(false);
    expect((matterbridge as any).shutdown).toBe(false);

    process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-port', MATTER_PORT.toString(), '-homedir', HOMEDIR, '-profile', 'Jest', '-logger', 'debug', '-matterlogger', 'debug', '-add', './src/mock/plugin3'];
    await (matterbridge as any).parseCommandLine();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Added plugin ${plg}matterbridge-mock3${nf}`);
    const plugins = matterbridge.plugins.array();
    expect(plugins).toHaveLength(3);
    expect(plugins[2].version).toBe('1.0.3');
    expect(plugins[2].name).toBe('matterbridge-mock3');
    expect(plugins[2].description).toBe('Matterbridge mock plugin 3');
    expect(plugins[2].author).toBe('https://github.com/Luligu');
    expect(plugins[2].enabled).toBeTruthy();

    matterbridge.shutdown = false;
    matterbridge.removeAllListeners('shutdown');
  }, 60000);

  test('setLogLevel LogLevel.INFO', async () => {
    Logger.level = MatterLogLevel.INFO;
    matterbridge.setLogLevel(LogLevel.INFO);
    expect((matterbridge as any).log.logLevel).toBe(LogLevel.INFO);
    expect((matterbridge as any).frontend.log.logLevel).toBe(LogLevel.INFO);
    expect((matterbridge as any).plugins.log.logLevel).toBe(LogLevel.INFO);
    expect((matterbridge as any).devices.log.logLevel).toBe(LogLevel.INFO);
    expect(MatterbridgeEndpoint.logLevel).toBe(LogLevel.INFO);
    expect(matterbridge.getLogLevel()).toBe(LogLevel.INFO);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `WebSocketServer logger global callback set to ${LogLevel.INFO}`);
  });

  test('setLogLevel LogLevel.DEBUG', async () => {
    matterbridge.setLogLevel(LogLevel.DEBUG);
    expect((matterbridge as any).log.logLevel).toBe(LogLevel.DEBUG);
    expect((matterbridge as any).frontend.log.logLevel).toBe(LogLevel.DEBUG);
    expect((matterbridge as any).plugins.log.logLevel).toBe(LogLevel.DEBUG);
    expect((matterbridge as any).devices.log.logLevel).toBe(LogLevel.DEBUG);
    expect(MatterbridgeEndpoint.logLevel).toBe(LogLevel.DEBUG);
    expect(matterbridge.getLogLevel()).toBe(LogLevel.DEBUG);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `WebSocketServer logger global callback set to ${LogLevel.DEBUG}`);
  });

  test('matterbridge load and start mockPlugin1/2/3', async () => {
    // setDebug(true);

    expect((matterbridge as any).initialized).toBe(true);
    expect((matterbridge as any).hasCleanupStarted).toBe(false);
    expect((matterbridge as any).shutdown).toBe(false);

    process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-port', MATTER_PORT.toString(), '-homedir', HOMEDIR, '-profile', 'Jest', '-logger', 'debug', '-matterlogger', 'debug'];
    const plugins = matterbridge.plugins.array();
    expect(plugins).toHaveLength(3);

    await (matterbridge as any).plugins.load(plugins[0]);
    expect(plugins[0].loaded).toBeTruthy();
    await (matterbridge as any).plugins.start(plugins[0], 'Jest test');
    expect(plugins[0].started).toBeTruthy();
    expect(plugins[0].configured).toBeFalsy();

    await (matterbridge as any).plugins.load(plugins[1]);
    expect(plugins[1].loaded).toBeTruthy();
    await (matterbridge as any).plugins.start(plugins[1], 'Jest test');
    expect(plugins[1].started).toBeTruthy();
    expect(plugins[1].configured).toBeFalsy();

    await (matterbridge as any).plugins.load(plugins[2]);
    expect(plugins[2].loaded).toBeTruthy();
    await (matterbridge as any).plugins.start(plugins[2], 'Jest test');
    expect(plugins[2].started).toBeTruthy();
    expect(plugins[2].configured).toBeFalsy();

    // setDebug(false);
  }, 10000);

  test('matterbridge -list', async () => {
    expect((matterbridge as any).initialized).toBe(true);
    expect((matterbridge as any).hasCleanupStarted).toBe(false);
    expect((matterbridge as any).shutdown).toBe(false);

    const shutdownPromise = new Promise((resolve) => {
      matterbridge.on('shutdown', resolve as () => void);
      const interval = setInterval(() => {
        if (matterbridge.shutdown) {
          clearInterval(interval);
          resolve(0);
        }
      }, 100);
    });

    process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-port', MATTER_PORT.toString(), '-homedir', HOMEDIR, '-profile', 'Jest', '-logger', 'debug', '-matterlogger', 'debug', '-list'];
    await (matterbridge as any).parseCommandLine();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `│ Registered plugins (3)`);
    // expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `│ Registered devices (0)`);
    await shutdownPromise;
    matterbridge.shutdown = false;
    matterbridge.removeAllListeners('shutdown');
  }, 60000);

  test('matterbridge -logstorage', async () => {
    expect((matterbridge as any).initialized).toBe(true);
    expect((matterbridge as any).hasCleanupStarted).toBe(false);
    expect((matterbridge as any).shutdown).toBe(false);

    const shutdownPromise = new Promise((resolve) => {
      matterbridge.on('shutdown', resolve as () => void);
      const interval = setInterval(() => {
        if (matterbridge.shutdown) {
          clearInterval(interval);
          resolve(0);
        }
      }, 100);
    });

    process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-port', MATTER_PORT.toString(), '-homedir', HOMEDIR, '-profile', 'Jest', '-logger', 'debug', '-matterlogger', 'debug', '-logstorage'];
    await (matterbridge as any).parseCommandLine();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `${plg}Matterbridge${nf} storage log`);
    await shutdownPromise;
    matterbridge.shutdown = false;
    matterbridge.removeAllListeners('shutdown');
  }, 60000);

  test('matterbridge -loginterfaces', async () => {
    expect((matterbridge as any).initialized).toBe(true);
    expect((matterbridge as any).hasCleanupStarted).toBe(false);
    expect((matterbridge as any).shutdown).toBe(false);

    const shutdownPromise = new Promise((resolve) => {
      matterbridge.on('shutdown', resolve as () => void);
      const interval = setInterval(() => {
        if (matterbridge.shutdown) {
          clearInterval(interval);
          resolve(0);
        }
      }, 100);
    });

    process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-port', MATTER_PORT.toString(), '-homedir', HOMEDIR, '-profile', 'Jest', '-logger', 'debug', '-matterlogger', 'debug', '-loginterfaces'];
    await (matterbridge as any).parseCommandLine();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`Network interface`));
    await shutdownPromise;
    matterbridge.shutdown = false;
    matterbridge.removeAllListeners('shutdown');
  }, 60000);

  test('destroy instance II', async () => {
    // Destroy the Matterbridge instance
    await destroyInstance(matterbridge);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringContaining('Cleanup completed. Shutting down...'));
  });

  test('matterbridge -reset', async () => {
    expect((matterbridge as any).initialized).toBe(false);
    expect((matterbridge as any).hasCleanupStarted).toBe(false);
    expect((matterbridge as any).shutdown).toBe(false);

    const shutdownPromise = new Promise((resolve) => {
      matterbridge.on('shutdown', resolve as () => void);
      const interval = setInterval(() => {
        if (matterbridge.shutdown) {
          clearInterval(interval);
          resolve(0);
        }
      }, 100);
    });

    process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-port', MATTER_PORT.toString(), '-homedir', HOMEDIR, '-profile', 'Jest', '-logger', 'debug', '-matterlogger', 'debug', '-reset'];
    (matterbridge as any).initialized = true;
    await (matterbridge as any).parseCommandLine();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Matter storage reset done! Remove the bridge from the controller.');
    await shutdownPromise;
    matterbridge.shutdown = false;
    matterbridge.removeAllListeners('shutdown');
    // Destroy the Matterbridge instance
    await destroyInstance(matterbridge);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringContaining('Cleanup completed. Shutting down...'));
  });

  test('matterbridge -reset xxx', async () => {
    expect((matterbridge as any).initialized).toBe(false);
    expect((matterbridge as any).hasCleanupStarted).toBe(false);
    expect((matterbridge as any).shutdown).toBe(false);

    const shutdownPromise = new Promise((resolve) => {
      matterbridge.on('shutdown', resolve as () => void);
      const interval = setInterval(() => {
        if (matterbridge.shutdown) {
          clearInterval(interval);
          resolve(0);
        }
      }, 100);
    });

    process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-port', MATTER_PORT.toString(), '-homedir', HOMEDIR, '-profile', 'Jest', '-logger', 'debug', '-matterlogger', 'debug', '-reset', 'xxx'];
    (matterbridge as any).log.logLevel = LogLevel.DEBUG;
    await (matterbridge as any).parseCommandLine();
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.DEBUG, 'Reset plugin xxx');
    (matterbridge as any).log.logLevel = LogLevel.DEBUG;
    await shutdownPromise;
    matterbridge.shutdown = false;
    matterbridge.removeAllListeners('shutdown');
    // Destroy the Matterbridge instance
    await destroyInstance(matterbridge);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Cleanup with instance not initialized...'));
  });

  test('matterbridge -factoryreset', async () => {
    expect((matterbridge as any).initialized).toBe(false);
    expect((matterbridge as any).hasCleanupStarted).toBe(false);
    expect((matterbridge as any).shutdown).toBe(false);

    process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-port', MATTER_PORT.toString(), '-homedir', HOMEDIR, '-profile', 'Jest', '-logger', 'debug', '-matterlogger', 'debug', '-factoryreset'];
    (matterbridge as any).initialized = true;
    await (matterbridge as any).parseCommandLine();

    const shutdownPromise = new Promise((resolve) => {
      matterbridge.on('shutdown', resolve as () => void);
      const interval = setInterval(() => {
        if (matterbridge.shutdown) {
          clearInterval(interval);
          resolve(0);
        }
      }, 100);
    });

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('Removing matter storage directory'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('Removing matter storage backup directory'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('Removing matterbridge storage directory'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('Removing matterbridge storage backup directory'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Factory reset done! Remove all paired fabrics from the controllers.');
    expect((matterbridge as any).plugins).toHaveLength(0);
    expect((matterbridge as any).devices).toHaveLength(0);

    await shutdownPromise;
    matterbridge.shutdown = false;
    matterbridge.removeAllListeners('shutdown');
    // Destroy the Matterbridge instance
    await destroyInstance(matterbridge);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringContaining('Cleanup completed. Shutting down...'));
  });

  test('matterbridge cleanup("updating...", true)', async () => {
    expect((matterbridge as any).initialized).toBe(false);
    expect((matterbridge as any).hasCleanupStarted).toBe(false);
    expect((matterbridge as any).shutdown).toBe(false);
    (matterbridge as any).initialized = true;

    await new Promise<void>((resolve) => {
      matterbridge.on('update', resolve);
      (matterbridge as any).cleanup('updating...', true, 10);
    });

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('Cleanup completed. Updating...'));

    matterbridge.shutdown = false;
    matterbridge.removeAllListeners('update');
  }, 10000);

  test('matterbridge cleanup("restarting...", true)', async () => {
    expect((matterbridge as any).initialized).toBe(false);
    expect((matterbridge as any).hasCleanupStarted).toBe(false);
    expect((matterbridge as any).shutdown).toBe(false);
    (matterbridge as any).initialized = true;

    await new Promise<void>((resolve) => {
      matterbridge.on('restart', resolve);
      (matterbridge as any).cleanup('restarting...', true, 10);
    });

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('Cleanup completed. Restarting...'));

    matterbridge.shutdown = false;
    matterbridge.removeAllListeners('update');
  }, 10000);
});
