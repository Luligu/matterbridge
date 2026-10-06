/**
 * @file packages/core/vitest/matterbridge.test.ts
 * @description This file contains the tests for the Matterbridge class.
 * @author Luca Liguori
 */

/**
 * WARNING!!!
 * The tests in this unit are supposed to run sequentially because they depend on the Matterbridge/Matter state.
 * Is not possible for timing reasons to create and destroy a Matter node each test to keep isolation.
 */

const NAME = 'MatterbridgeGlobal';
const MATTER_PORT = 6000;
const FRONTEND_PORT = 8803;

import { rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Logger, LogLevel as MatterLogLevel } from '@matter/general';
import type { ServerNode } from '@matter/node';
import { PowerSourceServer } from '@matter/node/behaviors/power-source';
import { PowerSource } from '@matter/types/clusters/power-source';
import { flushAsync } from '@matterbridge/test-utils';
import { HOMEDIR, loggerLogSpy, loggerWarnSpy, originalProcessArgv, setDebug, setupTest } from '@matterbridge/test-utils/vitest/setup';
import { BroadcastServer } from '@matterbridge/thread/server';
import { type ApiMatter, plg, type WorkerMessage } from '@matterbridge/types';
import { getParameter, hasParameter } from '@matterbridge/utils/cli';
import { LogLevel, nf } from 'node-ansi-logger';
import type { MockedFunction } from 'vitest';

import { Matterbridge } from '../src/matterbridge.js';
import { MatterbridgeEndpoint } from '../src/matterbridgeEndpoint.js';
import { closeMdnsInstance, destroyInstance } from './vitestUtils.js';

// Spy on BroadcastServer methods (inlined: test-utils cannot depend on core)
const isWorkerRequestBroadcastServerSpy = vi.spyOn(BroadcastServer.prototype, 'isWorkerRequest');
const isWorkerResponseBroadcastServerSpy = vi.spyOn(BroadcastServer.prototype, 'isWorkerResponse');
const requestBroadcastServerSpy = vi.spyOn(BroadcastServer.prototype, 'request');
const respondBroadcastServerSpy = vi.spyOn(BroadcastServer.prototype, 'respond');
const fetchBroadcastServerSpy = vi.spyOn(BroadcastServer.prototype, 'fetch');
const broadcastMessageHandlerBroadcastServerSpy = vi.spyOn(BroadcastServer.prototype, 'broadcastMessageHandler');

// Setup the test environment
await setupTest(NAME, false, ['--novirtual', '--frontend', '0', '--port', MATTER_PORT.toString(), '--profile', 'Jest', '--logger', 'debug', '--matterlogger', 'debug', '--debug'], {
  MATTERBRIDGE_START_MATTER_INTERVAL_MS: '10',
  MATTERBRIDGE_PAUSE_MATTER_INTERVAL_MS: '10',
});
process.argv.push('--homedir', HOMEDIR);

rmSync(HOMEDIR, { recursive: true, force: true }); // Ensure the home directory doesn't exist before starting the tests

describe('Matterbridge', () => {
  let matterbridge: Matterbridge;

  // Mock BroadcastServer methods
  isWorkerRequestBroadcastServerSpy.mockImplementation(() => true);
  isWorkerResponseBroadcastServerSpy.mockImplementation(() => true);
  (broadcastMessageHandlerBroadcastServerSpy as unknown as MockedFunction<(event: unknown) => void>).mockImplementation(() => {});
  requestBroadcastServerSpy.mockImplementation(() => {});
  respondBroadcastServerSpy.mockImplementation(() => {});
  fetchBroadcastServerSpy.mockImplementation(() => {
    return Promise.resolve() as any;
  });

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clear debug
    await setDebug(false);
  });

  afterAll(async () => {
    // Close mDNS instance
    await closeMdnsInstance(matterbridge);
    // Restore all mocks
    vi.restoreAllMocks();
  });

  test('Matterbridge.loadInstance(false)', async () => {
    expect((Matterbridge as any).instance).toBeUndefined();
    matterbridge = await Matterbridge.loadInstance(); // Default to false if no parameter is provided
    expect((Matterbridge as any).instance).toBeDefined();
    expect((matterbridge as any).initialized).toBeFalsy();
    expect(matterbridge).toBeDefined();
    expect(matterbridge.profile).toBe('Jest');
    expect(matterbridge.uuid).toHaveLength(0);
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

  test('Matterbridge getApiSettings', () => {
    const apiSettings = matterbridge.getApiSettings();

    expect(apiSettings.systemInformation).toEqual(matterbridge.systemInformation);
    expect(apiSettings.systemInformation).not.toBe(matterbridge.systemInformation);
    expect(apiSettings.matterbridgeInformation).toMatchObject({
      rootDirectory: matterbridge.rootDirectory,
      homeDirectory: matterbridge.homeDirectory,
      matterbridgeDirectory: matterbridge.matterbridgeDirectory,
      matterbridgePluginDirectory: matterbridge.matterbridgePluginDirectory,
      matterbridgeCertDirectory: matterbridge.matterbridgeCertDirectory,
      globalModulesDirectory: matterbridge.globalModulesDirectory,
      matterPort: matterbridge.port ?? 5540,
      matterDiscriminator: matterbridge.discriminator,
      matterPasscode: matterbridge.passcode,
      restartRequired: false,
      fixedRestartRequired: false,
      updateRequired: false,
    });
  });

  test('broadcast handler', async () => {
    isWorkerRequestBroadcastServerSpy.mockImplementationOnce(() => false);
    await (matterbridge as any).msgHandler({} as any);
    isWorkerResponseBroadcastServerSpy.mockImplementationOnce(() => false);
    await (matterbridge as any).msgHandler({} as any);

    expect((matterbridge as any).server).toBeInstanceOf(BroadcastServer);

    await (matterbridge as any).msgHandler({ type: 'test', src: 'manager', dst: 'matterbridge' } as any); // no id
    await (matterbridge as any).msgHandler({ id: 123456, type: 'test', src: 'manager', dst: 'unknown' } as any); // unknown dst
    await (matterbridge as any).msgHandler({ id: 123456, type: 'test', src: 'manager', dst: 'matterbridge' } as any); // valid
    await (matterbridge as any).msgHandler({ id: 123456, type: 'test', src: 'manager', dst: 'all' } as any); // valid
    await (matterbridge as any).msgHandler({ id: 123456, type: 'test', src: 'manager', dst: 'matterbridge', params: {} } as any); // valid
    await (matterbridge as any).msgHandler({ id: 123456, type: 'test', src: 'manager', dst: 'all', response: { success: false } } as any);
    await (matterbridge as any).msgHandler({ id: 123456, type: 'test', src: 'manager', dst: 'all', response: { success: true } } as any);

    await (matterbridge as any).msgHandler({ id: 123456, type: 'get_log_level', src: 'manager', dst: 'matterbridge' } as any);
    await (matterbridge as any).msgHandler({ id: 123456, type: 'set_log_level', src: 'manager', dst: 'matterbridge', params: { level: LogLevel.DEBUG } } as any);
    await (matterbridge as any).msgHandler({ id: 123456, type: 'matterbridge_latest_version', src: 'manager', dst: 'matterbridge', params: { version: '1.0.0' } } as any);
    expect(matterbridge.matterbridgeLatestVersion).toBe('1.0.0');
    await (matterbridge as any).msgHandler({ id: 123456, type: 'matterbridge_dev_version', src: 'manager', dst: 'matterbridge', params: { version: '1.0.0' } } as any);
    expect(matterbridge.matterbridgeDevVersion).toBe('1.0.0');
    // oxfmt-ignore
    await (matterbridge as any).msgHandler({ id: 123456, type: 'matterbridge_docker_version', src: 'manager', dst: 'matterbridge', params: { dockerVersion: '1.0.0', dockerDev: '1.0.0', dockerLatestVersion: '1.0.0', dockerDevVersion: '1.0.0' } } as any);
    await (matterbridge as any).msgHandler({ id: 123456, type: 'matterbridge_global_prefix', src: 'manager', dst: 'matterbridge', params: { prefix: '' } } as any);
    expect(matterbridge.globalModulesDirectory).toBe('');
    await (matterbridge as any).msgHandler({ id: 123456, type: 'matterbridge_platform', src: 'manager', dst: 'matterbridge', params: {} } as any);
    await (matterbridge as any).msgHandler({ id: 123456, type: 'matterbridge_shared', src: 'manager', dst: 'matterbridge', params: {} } as any);
    const apiSettings = matterbridge.getApiSettings();
    await (matterbridge as any).msgHandler({ id: 123456, type: 'matterbridge_apisettings', src: 'manager', dst: 'matterbridge', params: {} } as any);
    expect(respondBroadcastServerSpy).toHaveBeenCalledWith({
      id: 123456,
      type: 'matterbridge_apisettings',
      src: 'manager',
      dst: 'matterbridge',
      params: {},
      // systemInformation is refreshed on every getApiSettings() call (memory, uptime)
      result: { data: { ...apiSettings, systemInformation: expect.objectContaining({ hostname: apiSettings.systemInformation.hostname }) }, success: true },
    });
    await (matterbridge as any).msgHandler({ id: 123456, type: 'matterbridge_start_plugin_server', src: 'manager', dst: 'matterbridge', params: { pluginName: '' } } as any);
    await (matterbridge as any).msgHandler({ id: 123456, type: 'matterbridge_stop_plugin_server', src: 'manager', dst: 'matterbridge', params: { pluginName: '' } } as any);
    await (matterbridge as any).msgHandler({ id: 123456, type: 'matterbridge_start_device_server', src: 'manager', dst: 'matterbridge', params: { deviceUniqueId: '' } } as any);
    await (matterbridge as any).msgHandler({ id: 123456, type: 'matterbridge_stop_device_server', src: 'manager', dst: 'matterbridge', params: { deviceUniqueId: '' } } as any);

    // Responses
    // oxlint-disable-next-line typescript/no-misused-promises
    const cleanupSpy = vi.spyOn(matterbridge as any, 'cleanup').mockImplementation(async () => Promise.resolve());
    // oxfmt-ignore
    await (matterbridge as any).msgHandler({ id: 123456, timestamp: Date.now(), type: 'manager_spawn_response', src: 'manager', dst: 'matterbridge', result: { packageCommand: 'install', packageName: 'matterbridge', success: true } } as any);
    // oxfmt-ignore
    await (matterbridge as any).msgHandler({ id: 123456, timestamp: Date.now(), type: 'manager_spawn_response', src: 'manager', dst: 'matterbridge', error: 'Error message' } as any);
    cleanupSpy.mockRestore();
  });

  test.each(['matterbridge_restart', 'matterbridge_shutdown'] as const)('should handle %s through the process lifecycle', async (type) => {
    const lifecycleSpy = vi.spyOn(matterbridge, type === 'matterbridge_restart' ? 'restartProcess' : 'shutdownProcess').mockResolvedValueOnce();
    try {
      await (matterbridge as any).msgHandler({ id: 123456, timestamp: Date.now(), type, src: 'frontend', dst: 'matterbridge', params: undefined });
      expect(respondBroadcastServerSpy).toHaveBeenCalledWith(expect.objectContaining({ type, result: { success: true } }));
      expect(lifecycleSpy).toHaveBeenCalledTimes(1);
    } finally {
      lifecycleSpy.mockRestore();
    }
  });

  test.each(['root', 'missing-root', 'plugin', 'device', 'unknown', 'duplicate'] as const)('should respond to matterbridge_apimatter for the %s node lookup', async (scenario) => {
    const originalServerNode = matterbridge.serverNode;
    const rootNode = { id: 'Matterbridge' } as ServerNode;
    const pluginNode = { id: 'plugin-node' } as ServerNode;
    const deviceNode = { id: scenario === 'duplicate' ? 'plugin-node' : 'device-node' } as ServerNode;
    const pluginsSpy = vi
      .spyOn(matterbridge.plugins, 'array')
      .mockReturnValue([{}, { serverNode: { id: 'other-plugin' } }, { serverNode: pluginNode }] as unknown as ReturnType<typeof matterbridge.plugins.array>);
    const devicesSpy = vi
      .spyOn(matterbridge.devices, 'array')
      .mockReturnValue([{}, { serverNode: { id: 'other-device' } }, { serverNode: deviceNode }] as unknown as ReturnType<typeof matterbridge.devices.array>);
    const expectedNode = scenario === 'root' ? rootNode : scenario === 'plugin' || scenario === 'duplicate' ? pluginNode : scenario === 'device' ? deviceNode : undefined;
    const matter: ApiMatter = {
      id: expectedNode?.id ?? '',
      online: true,
      commissioned: false,
      advertising: false,
      advertiseTime: 0,
      windowStatus: 0,
      qrPairingCode: 'MT:TEST',
      manualPairingCode: '12345678901',
      fabricInformations: [],
      sessionInformations: [],
      serialNumber: 'TEST',
    };
    const matterNodeHelpers = await import('../src/matterNodeHelpers.js');
    const getServerNodeDataSpy = vi.spyOn(matterNodeHelpers, 'getServerNodeData').mockReturnValue(matter);
    const request = {
      id: 123456,
      type: 'matterbridge_apimatter',
      src: 'frontend',
      dst: 'matterbridge',
      params: { id: scenario === 'root' || scenario === 'missing-root' ? 'Matterbridge' : scenario === 'unknown' ? 'missing-node' : (expectedNode?.id ?? '') },
    } as const;
    matterbridge.serverNode = scenario === 'missing-root' ? undefined : rootNode;
    try {
      const handler = matterbridge as unknown as { msgHandler(message: WorkerMessage): Promise<void> };
      await handler.msgHandler(request);
      expect(respondBroadcastServerSpy).toHaveBeenCalledTimes(1);
      expect(respondBroadcastServerSpy).toHaveBeenCalledWith({ ...request, result: { matter: expectedNode ? matter : undefined } });
      expect(getServerNodeDataSpy.mock.calls).toEqual(expectedNode ? [[expectedNode]] : []);
      expect(pluginsSpy).toHaveBeenCalledTimes(scenario === 'root' || scenario === 'missing-root' ? 0 : 1);
      expect(devicesSpy).toHaveBeenCalledTimes(scenario === 'device' || scenario === 'unknown' ? 1 : 0);
    } finally {
      matterbridge.serverNode = originalServerNode;
      pluginsSpy.mockRestore();
      devicesSpy.mockRestore();
      getServerNodeDataSpy.mockRestore();
    }
  });

  test('Matterbridge.loadInstance(true) should not initialize if already loaded', async () => {
    // await setDebug(true);
    expect((Matterbridge as any).instance).toBeDefined();
    matterbridge = await Matterbridge.loadInstance(true);
    expect((matterbridge as any).initialized).toBeFalsy();
    await (matterbridge as any).initialize();
    expect((matterbridge as any).initialized).toBeTruthy();
    expect(matterbridge.uuid).toHaveLength(36); // Check if uuid is set and has the correct length for a UUID

    // Clear the timeouts and intervals set by initialize to prevent them from running during tests
    expect((matterbridge as any).systemCheckTimeout).toBeDefined();
    expect((matterbridge as any).checkUpdateTimeout).toBeDefined();
    expect((matterbridge as any).checkUpdateInterval).toBeDefined();
    clearTimeout((matterbridge as any).systemCheckTimeout);
    clearTimeout((matterbridge as any).checkUpdateTimeout);
    clearInterval((matterbridge as any).checkUpdateInterval);

    expect(matterbridge.serverNode).toBeDefined();
    // Without --root-power-source, the Root endpoint SHALL NOT expose a Power Source cluster.
    expect(matterbridge.serverNode?.behaviors.has(PowerSourceServer.with(PowerSource.Feature.Wired))).toBeFalsy();
    expect(matterbridge.aggregatorNode).toBeDefined();
    expect(matterbridge.matterStorageManager).toBeDefined();
    expect(matterbridge.matterStorageService).toBeDefined();
    expect(matterbridge.matterbridgeContext).toBeDefined();
    matterbridge.plugins.clear();
    await matterbridge.plugins.saveToStorage();

    if (!matterbridge.serverNode?.lifecycle.isOnline) {
      await new Promise((resolve) => {
        matterbridge.once('online', resolve);
      });
    }
    await flushAsync(undefined, undefined, 100);

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
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`Created Matterbridge Directory: ${path.join(HOMEDIR, '.matterbridge')}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      expect.stringContaining(`Created Matterbridge Frontend Certificate Directory: ${path.join(HOMEDIR, '.matterbridge', 'profiles', 'Jest', 'certs')}`),
    );
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      expect.stringContaining(`Created Matterbridge Frontend Uploads Directory: ${path.join(HOMEDIR, '.matterbridge', 'profiles', 'Jest', 'uploads')}`),
    );
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      expect.stringContaining(`Created Matterbridge Plugin Directory: ${path.join(HOMEDIR, 'Matterbridge', 'profiles', 'Jest')}`),
    );
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      expect.stringContaining(`Created Matterbridge Matter Certificate Directory: ${path.join(HOMEDIR, '.mattercert', 'profiles', 'Jest')}`),
    );

    // -frontend 0
    expect((matterbridge as any).frontend.httpServer).toBeUndefined();
    expect((matterbridge as any).frontend.httpsServer).toBeUndefined();
    expect((matterbridge as any).frontend.expressApp).toBeUndefined();
    expect((matterbridge as any).frontend.webSocketServer).toBeUndefined();

    // Destroy the Matterbridge instance
    process.argv.push('--reset-sessions');
    await destroyInstance(matterbridge, 0, 0);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringContaining('Cleanup completed. Shutting down...'));

    expect((matterbridge as any).initialized).toBeFalsy();
    expect((matterbridge as any).hasCleanupStarted).toBeFalsy();
    expect((Matterbridge as any).instance).toBeUndefined(); // Instance is not defined cause cleanup() has been called
    // await setDebug(false);
  }, 30000);

  test('Matterbridge.loadInstance(true) with frontend', async () => {
    await setDebug(false);
    process.argv = [
      ...originalProcessArgv.slice(0, 2),
      '--novirtual',
      '--frontend',
      FRONTEND_PORT.toString(),
      '--port',
      MATTER_PORT.toString(),
      '--homedir',
      HOMEDIR,
      '--profile',
      'Jest',
    ];

    expect((Matterbridge as any).instance).toBeUndefined();
    matterbridge = await Matterbridge.loadInstance(true);
    expect((Matterbridge as any).instance).toBeDefined();
    expect((matterbridge as any).initialized).toBeTruthy();

    // Clear the timeouts and intervals set by initialize to prevent them from running during tests
    expect((matterbridge as any).systemCheckTimeout).toBeDefined();
    expect((matterbridge as any).checkUpdateTimeout).toBeDefined();
    expect((matterbridge as any).checkUpdateInterval).toBeDefined();
    clearTimeout((matterbridge as any).systemCheckTimeout);
    clearTimeout((matterbridge as any).checkUpdateTimeout);
    clearInterval((matterbridge as any).checkUpdateInterval);

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
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.DEBUG,
      expect.stringContaining(`Directory Matterbridge Directory already exists at path: ${path.join(HOMEDIR, '.matterbridge', 'profiles', 'Jest')}`),
    );
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.DEBUG,
      expect.stringContaining(`Directory Matterbridge Frontend Certificate Directory already exists at path: ${path.join(HOMEDIR, '.matterbridge', 'profiles', 'Jest', 'certs')}`),
    );
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.DEBUG,
      expect.stringContaining(`Directory Matterbridge Frontend Uploads Directory already exists at path: ${path.join(HOMEDIR, '.matterbridge', 'profiles', 'Jest', 'uploads')}`),
    );
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.DEBUG,
      expect.stringContaining(`Directory Matterbridge Plugin Directory already exists at path: ${path.join(HOMEDIR, 'Matterbridge', 'profiles', 'Jest')}`),
    );
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.DEBUG,
      expect.stringContaining(`Directory Matterbridge Matter Certificate Directory already exists at path: ${path.join(HOMEDIR, '.mattercert', 'profiles', 'Jest')}`),
    );

    // -frontend FRONTEND_PORT
    expect((matterbridge as any).frontend.port).toBe(FRONTEND_PORT);
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
    process.argv = [
      ...originalProcessArgv.slice(0, 2),
      '--novirtual',
      '--frontend',
      '0',
      '--port',
      MATTER_PORT.toString(),
      '--homedir',
      HOMEDIR,
      '--profile',
      'Jest',
      '--logger',
      'debug',
      '--matterlogger',
      'debug',
    ];
    matterbridge = await Matterbridge.loadInstance(true);
    if (!(matterbridge as any).initialized) await (matterbridge as any).initialize();
    expect(matterbridge).toBeDefined();
    expect(matterbridge.profile).toBe('Jest');
    expect((matterbridge as any).initialized).toBe(true);
    expect((matterbridge as any).hasCleanupStarted).toBe(false);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Matterbridge profile: Jest'));

    // Clear the timeouts and intervals set by initialize to prevent them from running during tests
    expect((matterbridge as any).systemCheckTimeout).toBeDefined();
    expect((matterbridge as any).checkUpdateTimeout).toBeDefined();
    expect((matterbridge as any).checkUpdateInterval).toBeDefined();
    clearTimeout((matterbridge as any).systemCheckTimeout);
    clearTimeout((matterbridge as any).checkUpdateTimeout);
    clearInterval((matterbridge as any).checkUpdateInterval);

    await new Promise((resolve) => {
      matterbridge.once('online', resolve);
    });
    await Promise.resolve();
  }, 60000);

  test('should generate valid commissioning values when passcode and discriminator are out of range', async () => {
    expect(matterbridge.matterbridgeContext).toBeDefined();
    if (!matterbridge.matterbridgeContext) return;

    process.argv.push('--root-power-source');
    const invalidServerNode = await (matterbridge as any).createServerNode(matterbridge.matterbridgeContext, MATTER_PORT + 1, -1, 0x1000);
    process.argv.splice(process.argv.indexOf('--root-power-source'), 1);

    expect(invalidServerNode.state.commissioning.pairingCodes.manualPairingCode).toEqual(expect.any(String));
    expect(invalidServerNode.state.commissioning.pairingCodes.qrPairingCode).toEqual(expect.any(String));
    expect(invalidServerNode.behaviors.has(PowerSourceServer.with(PowerSource.Feature.Wired))).toBe(true);
    expect(invalidServerNode.state.powerSource.status).toBe(PowerSource.PowerSourceStatus.Active);
    expect(invalidServerNode.state.powerSource.order).toBe(0);
    expect(invalidServerNode.state.powerSource.endpointList).toEqual([0]);
    expect(invalidServerNode.state.powerSource.wiredCurrentType).toBe(PowerSource.WiredCurrentType.Ac);
    expect(loggerWarnSpy).toHaveBeenCalledWith(' * Adding the PowerSource cluster server to the root endpoint.                           *');
    expect(loggerWarnSpy).toHaveBeenCalledWith('Invalid passcode -1 for server node Matterbridge. Passcode must be between 0 and 99999999. Generating a random passcode...');
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      'Invalid discriminator 4096 for server node Matterbridge. Discriminator must be between 0 and 4095 (0xFFF). Generating a random discriminator...',
    );

    await invalidServerNode.close();
  });

  test('hasParameter("debug") should return false', () => {
    expect(hasParameter('debug')).toBeFalsy();
  });

  test('hasParameter("frontend") should return true', () => {
    expect(hasParameter('frontend')).toBeTruthy();
  });

  test('matterbridge -add mockPlugin1', async () => {
    expect((matterbridge as any).initialized).toBe(true);
    expect((matterbridge as any).hasCleanupStarted).toBe(false);
    expect((matterbridge as any).shutdown).toBe(false);
    expect(matterbridge.plugins).toHaveLength(0);
    expect(matterbridge.devices).toHaveLength(0);

    process.argv = [
      ...originalProcessArgv.slice(0, 2),
      '-frontend',
      '0',
      '-port',
      MATTER_PORT.toString(),
      '-homedir',
      HOMEDIR,
      '-profile',
      'Jest',
      '-logger',
      'debug',
      '-matterlogger',
      'debug',
      '-add',
      './packages/core/src/mock/plugin1',
    ];
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

    process.argv = [
      ...originalProcessArgv.slice(0, 2),
      '--frontend',
      '0',
      '--port',
      MATTER_PORT.toString(),
      '--homedir',
      HOMEDIR,
      '--profile',
      'Jest',
      '--logger',
      'debug',
      '--matterlogger',
      'debug',
      '--disable',
      './packages/core/src/mock/plugin1',
    ];
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

    process.argv = [
      ...originalProcessArgv.slice(0, 2),
      '--frontend',
      '0',
      '--port',
      MATTER_PORT.toString(),
      '--homedir',
      HOMEDIR,
      '--profile',
      'Jest',
      '--logger',
      'debug',
      '--matterlogger',
      'debug',
      '--enable',
      './packages/core/src/mock/plugin1',
    ];
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

    process.argv = [
      ...originalProcessArgv.slice(0, 2),
      '--frontend',
      '0',
      '--port',
      MATTER_PORT.toString(),
      '--homedir',
      HOMEDIR,
      '--profile',
      'Jest',
      '--logger',
      'debug',
      '--matterlogger',
      'debug',
      '--remove',
      './packages/core/src/mock/plugin1',
    ];
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

    process.argv = [
      ...originalProcessArgv.slice(0, 2),
      '--frontend',
      '0',
      '--port',
      MATTER_PORT.toString(),
      '--homedir',
      HOMEDIR,
      '--profile',
      'Jest',
      '--logger',
      'debug',
      '--matterlogger',
      'debug',
      '--add',
      './packages/core/src/mock/plugin1',
    ];
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

    process.argv = [
      ...originalProcessArgv.slice(0, 2),
      '--frontend',
      '0',
      '--port',
      MATTER_PORT.toString(),
      '--homedir',
      HOMEDIR,
      '--profile',
      'Jest',
      '--logger',
      'debug',
      '--matterlogger',
      'debug',
      '--add',
      './packages/core/src/mock/plugin2',
    ];
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

    process.argv = [
      ...originalProcessArgv.slice(0, 2),
      '--frontend',
      '0',
      '--port',
      MATTER_PORT.toString(),
      '--homedir',
      HOMEDIR,
      '--profile',
      'Jest',
      '--logger',
      'debug',
      '--matterlogger',
      'debug',
      '--add',
      './packages/core/src/mock/plugin3',
    ];
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
    await matterbridge.setLogLevel(LogLevel.INFO);
    expect((matterbridge as any).log.logLevel).toBe(LogLevel.INFO);
    expect((matterbridge as any).frontend.log.logLevel).toBe(LogLevel.INFO);
    expect((matterbridge as any).plugins.log.logLevel).toBe(LogLevel.INFO);
    expect((matterbridge as any).devices.log.logLevel).toBe(LogLevel.INFO);
    expect(MatterbridgeEndpoint.logLevel).toBe(LogLevel.INFO);
    expect(matterbridge.getLogLevel()).toBe(LogLevel.INFO);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `WebSocketServer logger global callback set to ${LogLevel.INFO}`);
  });

  test('setLogLevel LogLevel.DEBUG', async () => {
    await matterbridge.setLogLevel(LogLevel.DEBUG);
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

    process.argv = [
      ...originalProcessArgv.slice(0, 2),
      '--frontend',
      '0',
      '--port',
      MATTER_PORT.toString(),
      '--homedir',
      HOMEDIR,
      '--profile',
      'Jest',
      '--logger',
      'debug',
      '--matterlogger',
      'debug',
    ];
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

    process.argv = [
      ...originalProcessArgv.slice(0, 2),
      '--frontend',
      '0',
      '--port',
      MATTER_PORT.toString(),
      '--homedir',
      HOMEDIR,
      '--profile',
      'Jest',
      '--logger',
      'debug',
      '--matterlogger',
      'debug',
      '--list',
    ];
    await (matterbridge as any).parseCommandLine();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `│ Registered plugins (3)`);
    // expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `│ Registered devices (0)`);
    await shutdownPromise;
    matterbridge.shutdown = false;
    matterbridge.removeAllListeners('shutdown');
  }, 60000);

  test('matterbridge --logstorage', async () => {
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

    process.argv = [
      ...originalProcessArgv.slice(0, 2),
      '--frontend',
      '0',
      '--port',
      MATTER_PORT.toString(),
      '--homedir',
      HOMEDIR,
      '--profile',
      'Jest',
      '--logger',
      'debug',
      '--matterlogger',
      'debug',
      '--logstorage',
    ];
    await (matterbridge as any).parseCommandLine();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `${plg}Matterbridge${nf} storage log`);
    await shutdownPromise;
    matterbridge.shutdown = false;
    matterbridge.removeAllListeners('shutdown');
  }, 60000);

  test('matterbridge --loginterfaces', async () => {
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

    process.argv = [
      ...originalProcessArgv.slice(0, 2),
      '--frontend',
      '0',
      '--port',
      MATTER_PORT.toString(),
      '--homedir',
      HOMEDIR,
      '--profile',
      'Jest',
      '--logger',
      'debug',
      '--matterlogger',
      'debug',
      '--loginterfaces',
    ];
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

  test('matterbridge --reset', async () => {
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

    process.argv = [
      ...originalProcessArgv.slice(0, 2),
      '--frontend',
      '0',
      '--port',
      MATTER_PORT.toString(),
      '--homedir',
      HOMEDIR,
      '--profile',
      'Jest',
      '--logger',
      'debug',
      '--matterlogger',
      'debug',
      '--reset',
    ];
    (matterbridge as any).initialized = true;

    // Bridge mode
    await (matterbridge as any).parseCommandLine();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Matter storage reset done! Remove the bridge from the controller.');
    await shutdownPromise;
    matterbridge.shutdown = false;
    matterbridge.removeAllListeners('shutdown');

    // ChildBridge mode
    matterbridge.bridgeMode = 'childbridge';
    matterbridge.plugins.set({ name: 'test-plugin', storageContext: { clearAll: vi.fn() } } as any);
    expect(matterbridge.plugins).toHaveLength(1);
    matterbridge.devices.set({ uniqueId: 'test-device', mode: 'server', deviceName: 'test-device' } as any);
    expect(matterbridge.devices).toHaveLength(1);
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
    await setDebug(false);
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

    process.argv = [
      ...originalProcessArgv.slice(0, 2),
      '-frontend',
      '0',
      '-port',
      MATTER_PORT.toString(),
      '-homedir',
      HOMEDIR,
      '-profile',
      'Jest',
      '-logger',
      'debug',
      '-matterlogger',
      'debug',
      '-reset',
      'xxx',
    ];
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

  test('matterbridge --factoryreset', async () => {
    expect((matterbridge as any).initialized).toBe(false);
    expect((matterbridge as any).hasCleanupStarted).toBe(false);
    expect((matterbridge as any).shutdown).toBe(false);

    process.argv = [
      ...originalProcessArgv.slice(0, 2),
      '--frontend',
      '0',
      '--port',
      MATTER_PORT.toString(),
      '--homedir',
      HOMEDIR,
      '--profile',
      'Jest',
      '--logger',
      'debug',
      '--matterlogger',
      'debug',
      '--factoryreset',
    ];
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
