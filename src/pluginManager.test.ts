// src\pluginManager.test.ts

const MATTER_PORT = 6006;
const NAME = 'PluginManager';
const HOMEDIR = path.join('jest', NAME);
const NPM_CONFIG_PREFIX = path.resolve(path.join(HOMEDIR, '.npm-global'));
await fs.mkdir(NPM_CONFIG_PREFIX, { recursive: true });
const NPM_CONFIG_CACHE = path.resolve(path.join(HOMEDIR, '.npm-cache'));
await fs.mkdir(NPM_CONFIG_CACHE, { recursive: true });

process.argv = ['node', 'matterbridge.test.js', '-novirtual', '-logger', 'debug', '-matterlogger', 'debug', '-test', '-frontend', '0', '-homedir', HOMEDIR, '-port', MATTER_PORT.toString()];
process.env.npm_config_prefix = NPM_CONFIG_PREFIX;
process.env.npm_config_cache = NPM_CONFIG_CACHE;

// Mock the spawnCommand from spawn module before importing it
jest.unstable_mockModule('./utils/spawn.js', () => ({
  spawnCommand: jest.fn((matterbridge: MatterbridgeType, command: string, args: string[]) => {
    return Promise.resolve(true); // Mock the spawnCommand function to resolve immediately
  }),
}));
const spawnModule = await import('./utils/spawn.js');
const spawnCommandMock = spawnModule.spawnCommand as jest.MockedFunction<typeof spawnModule.spawnCommand>;

const jsonParseSpy = jest.spyOn(JSON, 'parse');

const matterbridgeShutdownSpy = jest.spyOn(Matterbridge.prototype, 'shutdownProcess');

// Mock MatterbridgePlatform methods
const platformRegisterDeviceSpy = jest.spyOn(MatterbridgePlatform.prototype, 'registerDevice').mockImplementation(() => Promise.resolve(undefined));
const platformUnregisterDeviceSpy = jest.spyOn(MatterbridgePlatform.prototype, 'unregisterDevice').mockImplementation(() => Promise.resolve(undefined));
const platformUnregisterAllDevicesSpy = jest.spyOn(MatterbridgePlatform.prototype, 'unregisterAllDevices').mockImplementation(() => Promise.resolve(undefined));
const dynamicPlatformRegisterDeviceSpy = jest.spyOn(MatterbridgeDynamicPlatform.prototype, 'registerDevice').mockImplementation(() => Promise.resolve(undefined));
const dynamicPlatformUnregisterDeviceSpy = jest.spyOn(MatterbridgeDynamicPlatform.prototype, 'unregisterDevice').mockImplementation(() => Promise.resolve(undefined));
const dynamicPlatformUnregisterAllDevicesSpy = jest.spyOn(MatterbridgeDynamicPlatform.prototype, 'unregisterAllDevices').mockImplementation(() => Promise.resolve(undefined));

// Spy on PluginManager methods
const pluginsAddSpy = jest.spyOn(PluginManager.prototype, 'add');
const pluginsRemoveSpy = jest.spyOn(PluginManager.prototype, 'remove');
const pluginsEnableSpy = jest.spyOn(PluginManager.prototype, 'enable');
const pluginsDisableSpy = jest.spyOn(PluginManager.prototype, 'disable');
const pluginsLoadSpy = jest.spyOn(PluginManager.prototype, 'load');
const pluginsStartSpy = jest.spyOn(PluginManager.prototype, 'start');
const pluginsConfigureSpy = jest.spyOn(PluginManager.prototype, 'configure');
const pluginsShutdownSpy = jest.spyOn(PluginManager.prototype, 'shutdown');

import { execSync } from 'node:child_process';
import { promises as fs, writeFileSync, unlinkSync, existsSync, accessSync } from 'node:fs';
import path from 'node:path';

import { jest } from '@jest/globals';
import { AnsiLogger, db, er, LogLevel, nf, nt, TimestampFormat } from 'node-ansi-logger';

import { Matterbridge } from './matterbridge.js';
import type { Matterbridge as MatterbridgeType } from './matterbridge.js';
import { MatterbridgePlatform, PlatformConfig } from './matterbridgePlatform.js';
import { MatterbridgeDynamicPlatform } from './matterbridgeDynamicPlatform.js';
import { plg, Plugin, typ } from './matterbridgeTypes.js';
import { PluginManager } from './pluginManager.js';
import { waiter, wait } from './utils/export.js';
import { closeMdnsInstance, destroyInstance, loggerLogSpy, setDebug, setupTest } from './jestutils/jestHelpers.js';
import { BroadcastServer } from './broadcastServer.js';

// Setup the test environment
await setupTest(NAME, false);

describe('PluginManager', () => {
  let matterbridge: Matterbridge;
  let plugins: PluginManager;
  let server: BroadcastServer;
  let useSudo = false;

  const log = new AnsiLogger({ logName: 'TestBroadcastServer', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });
  const testServer = new BroadcastServer('manager', log);

  async function needsSudo() {
    try {
      const prefix = execSync('npm config get prefix', { encoding: 'utf8' }).trim();
      const testFile = `${prefix}/.npm-perm-test-${Date.now()}`;
      try {
        writeFileSync(testFile, 'test');
        unlinkSync(testFile);
        return false; // writable → no sudo needed
      } catch {
        return process.platform !== 'win32'; // on Windows there's no sudo anyway
      }
    } catch {
      // Fallback if npm is broken or inaccessible
      return process.platform !== 'win32';
    }
  }

  function needsSudoFast(): boolean {
    const { NPM_CONFIG_PREFIX, PREFIX, HOME } = process.env;
    const platform = process.platform;

    // Windows: never needs sudo
    if (platform === 'win32') return false;

    // CI or root environments never need sudo
    if (process.env.CI || process.getuid?.() === 0 || process.geteuid?.() === 0) return false;

    // If user explicitly set a prefix, assume it's writable
    const prefix = NPM_CONFIG_PREFIX || PREFIX;
    if (prefix && prefix.startsWith(HOME || '')) return false;

    // macOS/Linux defaults:
    //   - /usr/local (needs sudo)
    //   - ~/.npm-global (user-writable)
    //   - $HOME/.asdf, $HOME/.nvm (user-writable)
    const likelyGlobalPrefixes = ['/usr/local', '/usr', '/opt/homebrew', '/opt/local'];

    if (prefix && likelyGlobalPrefixes.some((p) => prefix.startsWith(p))) return true;

    if (prefix && existsSync(prefix)) {
      try {
        accessSync(prefix, fs.constants.W_OK);
        return false;
      } catch {
        return true;
      }
    }

    // Heuristic fallback: safe default → needs sudo
    return true;
  }

  beforeAll(async () => {
    useSudo = needsSudoFast(); // await needsSudo();
  });

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {});

  afterAll(async () => {
    // Close the test server
    testServer.close();
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('Load matterbridge', async () => {
    matterbridge = await Matterbridge.loadInstance(true);
    expect(matterbridge).toBeInstanceOf(Matterbridge);
    plugins = matterbridge.plugins;
    expect(plugins).toBeInstanceOf(PluginManager);
    plugins.logLevel = LogLevel.DEBUG;
    server = (plugins as any).server;
    expect(server).toBeInstanceOf(BroadcastServer);
    matterbridge.globalModulesDirectory = path.join(NPM_CONFIG_PREFIX, 'node_modules');
  });

  test('BroadcastServer from local path', async () => {
    const pluginPath = path.join('.', 'src', 'mock', 'plugin1');
    expect((await testServer.fetch({ type: 'plugins_install', src: testServer.name, dst: 'plugins', params: { packageName: pluginPath } }, 5000)).response.success).toBe(true);
    expect(plugins.has('matterbridge-mock1')).toBe(true);
    expect(plugins.get('matterbridge-mock1')?.enabled).toBe(true);

    expect((await testServer.fetch({ type: 'plugins_add', src: testServer.name, dst: 'plugins', params: { nameOrPath: pluginPath } }, 5000)).response.plugin).toBeDefined();

    expect((await testServer.fetch({ type: 'plugins_disable', src: testServer.name, dst: 'plugins', params: { nameOrPath: 'matterbridge-mock1' } }, 5000)).response.plugin).toBeDefined();
    expect(plugins.get('matterbridge-mock1')?.enabled).toBe(false);

    expect((await testServer.fetch({ type: 'plugins_enable', src: testServer.name, dst: 'plugins', params: { nameOrPath: 'matterbridge-mock1' } }, 5000)).response.plugin).toBeDefined();
    expect(plugins.get('matterbridge-mock1')?.enabled).toBe(true);

    expect((await testServer.fetch({ type: 'plugins_load', src: testServer.name, dst: 'plugins', params: { plugin: 'matterbridge-mock1' } }, 5000)).response.platform).toBeDefined();
    expect(plugins.get('matterbridge-mock1')?.loaded).toBe(true);

    expect((await testServer.fetch({ type: 'plugins_start', src: testServer.name, dst: 'plugins', params: { plugin: 'matterbridge-mock1' } }, 5000)).response.plugin).toBeDefined();
    expect(plugins.get('matterbridge-mock1')?.started).toBe(true);

    expect((await testServer.fetch({ type: 'plugins_configure', src: testServer.name, dst: 'plugins', params: { plugin: 'matterbridge-mock1' } }, 5000)).response.plugin).toBeDefined();
    expect(plugins.get('matterbridge-mock1')?.configured).toBe(true);

    expect((await testServer.fetch({ type: 'plugins_shutdown', src: testServer.name, dst: 'plugins', params: { plugin: 'matterbridge-mock1' } }, 5000)).response.plugin).toBeDefined();

    expect((await testServer.fetch({ type: 'plugins_remove', src: testServer.name, dst: 'plugins', params: { nameOrPath: 'matterbridge-mock1' } }, 5000)).response.plugin).toBeDefined();

    // Try all operations on removed plugin
    expect((await testServer.fetch({ type: 'plugins_enable', src: testServer.name, dst: 'plugins', params: { nameOrPath: 'matterbridge-mock1' } }, 5000)).response.plugin).toBeNull();
    expect((await testServer.fetch({ type: 'plugins_disable', src: testServer.name, dst: 'plugins', params: { nameOrPath: 'matterbridge-mock1' } }, 5000)).response.plugin).toBeNull();
    expect((await testServer.fetch({ type: 'plugins_load', src: testServer.name, dst: 'plugins', params: { plugin: 'matterbridge-mock1' } }, 5000)).response.platform).toBeUndefined();
    expect((await testServer.fetch({ type: 'plugins_start', src: testServer.name, dst: 'plugins', params: { plugin: 'matterbridge-mock1' } }, 5000)).response.plugin).toBeUndefined();
    expect((await testServer.fetch({ type: 'plugins_configure', src: testServer.name, dst: 'plugins', params: { plugin: 'matterbridge-mock1' } }, 5000)).response.plugin).toBeUndefined();
    expect((await testServer.fetch({ type: 'plugins_shutdown', src: testServer.name, dst: 'plugins', params: { plugin: 'matterbridge-mock1' } }, 5000)).response.plugin).toBeUndefined();
    expect((await testServer.fetch({ type: 'plugins_remove', src: testServer.name, dst: 'plugins', params: { nameOrPath: 'matterbridge-mock1' } }, 5000)).response.plugin).toBeNull();
    // @ts-expect-error testing non-existing type
    testServer.request({ type: 'plugins_unknown', src: testServer.name, dst: 'plugins', params: { nameOrPath: 'matterbridge-mock1' } });

    expect((await testServer.fetch({ type: 'plugins_add', src: testServer.name, dst: 'plugins', params: { nameOrPath: pluginPath } }, 5000)).response.plugin).toBeDefined();

    expect((await testServer.fetch({ type: 'plugins_uninstall', src: testServer.name, dst: 'plugins', params: { packageName: 'matterbridge-mock1' } }, 5000)).response.success).toBe(true);
    expect(plugins.has('matterbridge-mock1')).toBe(false);
  });

  test('logLevel changes correctly', async () => {
    plugins.logLevel = LogLevel.DEBUG;
    expect((plugins as any).log.logLevel).toBe(LogLevel.DEBUG);

    expect((await testServer.fetch({ type: 'set_log_level', src: testServer.name, dst: 'plugins', params: { logLevel: LogLevel.DEBUG } })).response.logLevel).toBe(LogLevel.DEBUG);
    expect((await testServer.fetch({ type: 'get_log_level', src: testServer.name, dst: 'plugins' })).response.logLevel).toBe(LogLevel.DEBUG);
  });

  test('clear, save and load from storage', async () => {
    plugins.clear();
    expect(await plugins.saveToStorage()).toBe(0);
    expect(await plugins.loadFromStorage()).toHaveLength(0);
  });

  test('save and load from storage with no context', async () => {
    plugins.clear();
    const context = matterbridge.nodeContext;
    matterbridge.nodeContext = undefined;
    await expect(plugins.saveToStorage()).rejects.toThrow(new Error('loadFromStorage: node context is not available.'));
    await expect(plugins.loadFromStorage()).rejects.toThrow(new Error('loadFromStorage: node context is not available.'));
    matterbridge.nodeContext = context;
  });

  test('async forEach to return', async () => {
    let count = 0;
    await plugins.forEach(async (plugin: Plugin) => {
      count++;
    });
    expect(count).toBe(0);
  });

  test('size and length return correct number of plugins', async () => {
    expect(plugins.size).toBe(0);
    expect(plugins.length).toBe(0);

    expect((await testServer.fetch({ type: 'plugins_size', src: testServer.name, dst: 'plugins' })).response.size).toBe(0);
    expect((await testServer.fetch({ type: 'plugins_length', src: testServer.name, dst: 'plugins' })).response.length).toBe(0);
  });

  test('set and get return plugin', async () => {
    plugins.set({ name: 'matterbridge-mock1', path: './src/mock/plugin1/package.json', enabled: true, type: 'Unknown' as any, version: '1.0.0', description: 'To update', author: 'To update', homepage: 'https://example.com' });
    plugins.set({ name: 'matterbridge-mock2', path: './src/mock/plugin2/package.json', enabled: true, type: 'Unknown' as any, version: '1.0.0', description: 'To update', author: 'To update', homepage: 'https://example.com' });
    plugins.set({ name: 'matterbridge-mock3', path: './src/mock/plugin3/package.json', enabled: true, type: 'Unknown' as any, version: '1.0.0', description: 'To update', author: 'To update', homepage: 'https://example.com' });
    expect(plugins.size).toBe(3);
    expect(plugins.length).toBe(3);
    expect(plugins.array()).toEqual([
      { 'author': 'To update', 'description': 'To update', enabled: true, 'homepage': 'https://example.com', 'name': 'matterbridge-mock1', 'path': './src/mock/plugin1/package.json', 'type': 'Unknown', 'version': '1.0.0' },
      { 'author': 'To update', 'description': 'To update', enabled: true, 'homepage': 'https://example.com', 'name': 'matterbridge-mock2', 'path': './src/mock/plugin2/package.json', 'type': 'Unknown', 'version': '1.0.0' },
      { 'author': 'To update', 'description': 'To update', enabled: true, 'homepage': 'https://example.com', 'name': 'matterbridge-mock3', 'path': './src/mock/plugin3/package.json', 'type': 'Unknown', 'version': '1.0.0' },
    ]);
    expect(plugins.storagePluginArray()).toEqual([
      { 'author': 'To update', 'description': 'To update', enabled: true, 'name': 'matterbridge-mock1', 'path': './src/mock/plugin1/package.json', 'type': 'Unknown', 'version': '1.0.0' },
      { 'author': 'To update', 'description': 'To update', enabled: true, 'name': 'matterbridge-mock2', 'path': './src/mock/plugin2/package.json', 'type': 'Unknown', 'version': '1.0.0' },
      { 'author': 'To update', 'description': 'To update', enabled: true, 'name': 'matterbridge-mock3', 'path': './src/mock/plugin3/package.json', 'type': 'Unknown', 'version': '1.0.0' },
    ]);
    expect(plugins.apiPluginArray()).toEqual([
      { 'author': 'To update', 'description': 'To update', enabled: true, 'homepage': 'https://example.com', 'name': 'matterbridge-mock1', 'path': './src/mock/plugin1/package.json', 'type': 'Unknown', 'version': '1.0.0' },
      { 'author': 'To update', 'description': 'To update', enabled: true, 'homepage': 'https://example.com', 'name': 'matterbridge-mock2', 'path': './src/mock/plugin2/package.json', 'type': 'Unknown', 'version': '1.0.0' },
      { 'author': 'To update', 'description': 'To update', enabled: true, 'homepage': 'https://example.com', 'name': 'matterbridge-mock3', 'path': './src/mock/plugin3/package.json', 'type': 'Unknown', 'version': '1.0.0' },
    ]);

    expect((await testServer.fetch({ type: 'plugins_get', src: testServer.name, dst: 'plugins', params: { name: 'matterbridge-mock1' } })).response.plugin).toBeDefined();
    expect((await testServer.fetch({ type: 'plugins_get', src: testServer.name, dst: 'plugins', params: { name: 'matterbridge-unknown' } })).response.plugin).toBeUndefined();
    expect((await testServer.fetch({ type: 'plugins_storagepluginarray', src: testServer.name, dst: 'plugins' })).response.plugins).toHaveLength(3);
    expect((await testServer.fetch({ type: 'plugins_apipluginarray', src: testServer.name, dst: 'plugins' })).response.plugins).toHaveLength(3);
    const mockPlugin4 = { name: 'matterbridge-mock4', path: './src/mock/plugin4/package.json', enabled: true, type: 'Unknown' as any, version: '1.0.0', description: 'To update', author: 'To update', homepage: 'https://example.com' };
    expect((await testServer.fetch({ type: 'plugins_set', src: testServer.name, dst: 'plugins', params: { plugin: mockPlugin4 } })).response.plugin).toEqual(mockPlugin4);
    expect((await testServer.fetch({ type: 'plugins_get', src: testServer.name, dst: 'plugins', params: { name: mockPlugin4.name } })).response.plugin).toEqual(mockPlugin4);
    // @ts-expect-error accessing private member
    plugins._plugins.delete('matterbridge-mock4');
  });

  test('save and load from storage', async () => {
    expect(await plugins.saveToStorage()).toBe(3);
    expect(await plugins.loadFromStorage()).toHaveLength(3);
  });

  test('has returns true if plugin exists', async () => {
    expect(plugins.has('testPlugin')).toBe(false);
    expect(plugins.has('matterbridge-mock1')).toBe(true);
    expect(plugins.has('matterbridge-mock2')).toBe(true);
    expect(plugins.has('matterbridge-mock3')).toBe(true);

    expect((await testServer.fetch({ type: 'plugins_has', src: testServer.name, dst: 'plugins', params: { name: 'matterbridge-mock1' } })).response.has).toBe(true);
    expect((await testServer.fetch({ type: 'plugins_has', src: testServer.name, dst: 'plugins', params: { name: 'matterbridge-unknown' } })).response.has).toBe(false);
  });

  test('array returns array of plugins', () => {
    const arr = plugins.array();
    expect(arr).toBeInstanceOf(Array);
    expect(arr).toHaveLength(3);
  });

  test('storagePluginArray returns array of storage plugins', () => {
    const arr = plugins.storagePluginArray();
    expect(arr).toBeInstanceOf(Array);
    expect(arr).toHaveLength(3);
  });

  test('apiPluginArray returns array of API plugins', () => {
    const arr = plugins.apiPluginArray();
    expect(arr).toBeInstanceOf(Array);
    expect(arr).toHaveLength(3);
  });

  test('Symbol.iterator allows for iteration over plugins', () => {
    let count = 0;
    for (const plugin of plugins) {
      expect(plugin.name).toBeDefined();
      expect(plugin.path).toBeDefined();
      expect(plugin.type).toBeDefined();
      expect(plugin.type).toBe('Unknown');
      expect(plugin.version).toBeDefined();
      expect(plugin.version).toBe('1.0.0');
      expect(plugin.description).toBeDefined();
      expect(plugin.description).toBe('To update');
      expect(plugin.author).toBeDefined();
      expect(plugin.author).toBe('To update');
      count++;
    }
    expect(count).toBe(3);
  });

  test('async forEach allows for iteration over plugins', async () => {
    let count = 0;
    await plugins.forEach(async (plugin: Plugin) => {
      expect(plugin.name).toBeDefined();
      expect(plugin.path).toBeDefined();
      expect(plugin.type).toBeDefined();
      expect(plugin.type).toBe('Unknown');
      expect(plugin.version).toBeDefined();
      expect(plugin.version).toBe('1.0.0');
      expect(plugin.description).toBeDefined();
      expect(plugin.description).toBe('To update');
      expect(plugin.author).toBeDefined();
      expect(plugin.author).toBe('To update');
      count++;
    });
    expect(count).toBe(3);
  });

  test('async forEach to not throw', async () => {
    let count = 0;
    await plugins.forEach(async (plugin: Plugin) => {
      count++;
      throw new Error('Test error');
    });
    expect(count).toBe(3);
    expect((plugins as any).log.log).toHaveBeenCalledTimes(3);
  });

  test('resolve plugin', async () => {
    expect(await plugins.resolve('xyz')).toBeNull();
    expect(await plugins.resolve('./src/mock/plugin1')).not.toBeNull();
    expect(await plugins.resolve('./src/mock/plugin2')).not.toBeNull();
    expect(await plugins.resolve('./src/mock/plugin3')).not.toBeNull();
  });

  test('resolve plugin should fail', async () => {
    const result = await plugins.resolve('xyz');
    expect(result).toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Package.json not found at'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Trying at'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Failed to resolve plugin path'));
  });

  test('resolve plugin should log errors', async () => {
    const packageFilePath = path.join('.', 'src', 'mock', 'plugintest', 'package.json');
    await fs.writeFile(packageFilePath, JSON.stringify({ notname: 'test', type: 'module', main: 'index.js' }), 'utf8');
    let result = await plugins.resolve('./src/mock/plugintest');
    expect(result).toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Package.json name not found'));

    loggerLogSpy.mockClear();
    await fs.writeFile(packageFilePath, JSON.stringify({ name: 'test', type: 'notmodule', main: 'index.js' }), 'utf8');
    result = await plugins.resolve('./src/mock/plugintest');
    expect(result).toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('is not a module'));

    loggerLogSpy.mockClear();
    await fs.writeFile(packageFilePath, JSON.stringify({ name: 'test', type: 'module', notmain: 'index.js' }), 'utf8');
    result = await plugins.resolve('./src/mock/plugintest');
    expect(result).toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('has no main entrypoint'));

    loggerLogSpy.mockClear();
    await fs.writeFile(packageFilePath, JSON.stringify({ name: 'test', type: 'module', main: 'index.js', dependencies: { matterbridge: '1.0.0' } }), 'utf8');
    result = await plugins.resolve('./src/mock/plugintest');
    expect(result).toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Found matterbridge package in the plugin dependencies.'));

    loggerLogSpy.mockClear();
    await fs.writeFile(packageFilePath, JSON.stringify({ name: 'test', type: 'module', main: 'index.js', devDependencies: { matterbridge: '1.0.0' } }), 'utf8');
    result = await plugins.resolve('./src/mock/plugintest');
    expect(result).toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Found matterbridge package in the plugin devDependencies.'));

    loggerLogSpy.mockClear();
    await fs.writeFile(packageFilePath, JSON.stringify({ name: 'test', type: 'module', main: 'index.js', peerDependencies: { matterbridge: '1.0.0' } }), 'utf8');
    result = await plugins.resolve('./src/mock/plugintest');
    expect(result).toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Found matterbridge package in the plugin peerDependencies.'));

    loggerLogSpy.mockClear();
    await fs.writeFile(packageFilePath, JSON.stringify({ name: 'test', type: 'module', main: 'index.js', dependencies: { '@project-chip': '1.0.0' } }), 'utf8');
    result = await plugins.resolve('./src/mock/plugintest');
    expect(result).toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Found @project-chip packages'));

    loggerLogSpy.mockClear();
    await fs.writeFile(packageFilePath, JSON.stringify({ name: 'test', type: 'module', main: 'index.js', devDependencies: { '@project-chip': '1.0.0' } }), 'utf8');
    result = await plugins.resolve('./src/mock/plugintest');
    expect(result).toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Found @project-chip packages'));

    loggerLogSpy.mockClear();
    await fs.writeFile(packageFilePath, JSON.stringify({ name: 'test', type: 'module', main: 'index.js', peerDependencies: { '@project-chip': '1.0.0' } }), 'utf8');
    result = await plugins.resolve('./src/mock/plugintest');
    expect(result).toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Found @project-chip packages'));

    loggerLogSpy.mockClear();
    await fs.writeFile(packageFilePath, JSON.stringify({ name: 'test', type: 'module', main: 'index.js', dependencies: { '@matter': '1.0.0' } }), 'utf8');
    result = await plugins.resolve('./src/mock/plugintest');
    expect(result).toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Found @project-chip packages'));

    loggerLogSpy.mockClear();
    await fs.writeFile(packageFilePath, JSON.stringify({ name: 'test', type: 'module', main: 'index.js', devDependencies: { '@matter': '1.0.0' } }), 'utf8');
    result = await plugins.resolve('./src/mock/plugintest');
    expect(result).toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Found @project-chip packages'));

    loggerLogSpy.mockClear();
    await fs.writeFile(packageFilePath, JSON.stringify({ name: 'test', type: 'module', main: 'index.js', peerDependencies: { '@matter': '1.0.0' } }), 'utf8');
    result = await plugins.resolve('./src/mock/plugintest');
    expect(result).toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Found @project-chip packages'));

    loggerLogSpy.mockClear();
    await fs.writeFile(packageFilePath, JSON.stringify({ name: 'test', type: 'module', main: 'index.js' }), 'utf8');
    result = await plugins.resolve('./src/mock/plugintest');
    expect(result).not.toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Resolved plugin path'));
  });

  test('install plugin', async () => {
    pluginsAddSpy.mockImplementationOnce(async (nameOrPath: string) => {
      return null;
    });
    matterbridgeShutdownSpy.mockImplementationOnce(() => {
      return Promise.resolve();
    });

    await plugins.install('matterbridge-websocket');
    expect(spawnCommandMock).toHaveBeenCalledWith('npm', ['install', '-g', 'matterbridge-websocket', '--omit=dev', '--verbose'], 'install', 'matterbridge-websocket');
    expect(matterbridge.restartRequired).toBe(true);
    expect(matterbridge.fixedRestartRequired).toBe(true);
    expect(pluginsAddSpy).toHaveBeenCalledTimes(1);
    jest.clearAllMocks();

    await plugins.install('matterbridge');
    expect(matterbridge.restartMode).toBe('');
    expect(spawnCommandMock).toHaveBeenCalledWith('npm', ['install', '-g', 'matterbridge', '--omit=dev', '--verbose'], 'install', 'matterbridge');
    expect(matterbridge.restartRequired).toBe(true);
    expect(matterbridge.fixedRestartRequired).toBe(true);
    expect(pluginsAddSpy).toHaveBeenCalledTimes(0);
    expect(matterbridgeShutdownSpy).toHaveBeenCalledTimes(0);
    jest.clearAllMocks();

    matterbridge.restartMode = 'service';
    await plugins.install('matterbridge');
    expect(spawnCommandMock).toHaveBeenCalledWith('npm', ['install', '-g', 'matterbridge', '--omit=dev', '--verbose'], 'install', 'matterbridge');
    expect(matterbridge.restartRequired).toBe(true);
    expect(matterbridge.fixedRestartRequired).toBe(true);
    expect(pluginsAddSpy).toHaveBeenCalledTimes(0);
    expect(matterbridgeShutdownSpy).toHaveBeenCalledTimes(1);
    jest.clearAllMocks();

    spawnCommandMock.mockImplementationOnce(() => {
      return Promise.resolve(false);
    });
    await expect(plugins.install('matterbridge')).resolves.toBe(false);
    expect(spawnCommandMock).toHaveBeenCalledWith('npm', ['install', '-g', 'matterbridge', '--omit=dev', '--verbose'], 'install', 'matterbridge');
    expect(matterbridge.restartRequired).toBe(true);
    expect(matterbridge.fixedRestartRequired).toBe(true);
    expect(pluginsAddSpy).toHaveBeenCalledTimes(0);
    expect(matterbridgeShutdownSpy).toHaveBeenCalledTimes(0);

    (plugins as any)._plugins.delete('matterbridge-websocket');
    matterbridge.restartMode = '';
    matterbridge.restartRequired = false;
    matterbridge.fixedRestartRequired = false;
  });

  test('uninstall plugin', async () => {
    (plugins as any)._plugins.set('matterbridge-websocket', { name: 'matterbridge-websocket', loaded: true });
    pluginsShutdownSpy.mockImplementationOnce(async (plugin: Plugin | string, reason?: string, removeAllDevices: boolean = false, force: boolean = false) => {
      return plugin as Plugin;
    });
    pluginsRemoveSpy.mockImplementationOnce(async (nameOrPath: string) => {
      return null;
    });

    await plugins.uninstall('matterbridge-websocket');
    expect(pluginsShutdownSpy).toHaveBeenCalledTimes(1);
    expect(pluginsRemoveSpy).toHaveBeenCalledTimes(1);
    expect(spawnCommandMock).toHaveBeenCalledWith('npm', ['uninstall', '-g', 'matterbridge-websocket', '--verbose'], 'uninstall', 'matterbridge-websocket');
    expect(matterbridge.restartRequired).toBe(false);
    expect(matterbridge.fixedRestartRequired).toBe(false);
    jest.clearAllMocks();

    spawnCommandMock.mockImplementationOnce(() => {
      return Promise.resolve(false);
    });
    await expect(plugins.uninstall('matterbridge-websocket')).resolves.toBe(false);
    expect(spawnCommandMock).toHaveBeenCalledWith('npm', ['uninstall', '-g', 'matterbridge-websocket', '--verbose'], 'uninstall', 'matterbridge-websocket');
    jest.clearAllMocks();

    await expect(plugins.uninstall('matterbridge')).resolves.toBe(false);
    expect(spawnCommandMock).toHaveBeenCalledTimes(0);

    (plugins as any)._plugins.delete('matterbridge-websocket');
  });

  test('parse plugin', async () => {
    const packageFilePath = path.join('.', 'src', 'mock', 'plugintest', 'package.json');
    (plugins as any)._plugins.set('matterbridge-test', { name: 'matterbridge-test', path: './src/mock/plugintest/package.json', type: 'Any', main: 'index.js', version: '1.0.0', description: 'To update', author: 'To update' });
    const plugin = plugins.get('matterbridge-test');
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;

    loggerLogSpy.mockClear();
    expect(await plugins.parse('matterbridge-test')).not.toBeNull();
    expect(await plugins.parse('matterbridge-unknown')).toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Plugin ${plg}matterbridge-unknown${er} not found`);

    loggerLogSpy.mockClear();
    expect(await plugins.parse(plugin)).not.toBeNull();
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.ERROR, expect.anything());

    loggerLogSpy.mockClear();
    await fs.writeFile(packageFilePath, JSON.stringify({ name: 'test', type: 'module', main: 'index.js', version: '1.0.0', description: 'To update', author: 'To update' }), 'utf8');
    expect(await plugins.parse(plugin)).not.toBeNull();
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.WARN, expect.anything());
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.ERROR, expect.anything());

    loggerLogSpy.mockClear();
    await fs.writeFile(packageFilePath, JSON.stringify({ notname: 'test', type: 'module', main: 'index.js', version: '1.0.0', description: 'To update', author: 'To update' }), 'utf8');
    expect(await plugins.parse(plugin)).not.toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.WARN, expect.stringContaining('has no name in package.json'));
    expect(plugin.name).toBe('Unknown name');

    loggerLogSpy.mockClear();
    await fs.writeFile(packageFilePath, JSON.stringify({ name: 'test', type: 'module', main: 'index.js', notversion: '1.0.0', description: 'To update', author: 'To update' }), 'utf8');
    expect(await plugins.parse(plugin)).not.toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.WARN, expect.stringContaining('has no version in package.json'));
    expect(plugin.version).toBe('1.0.0');

    loggerLogSpy.mockClear();
    await fs.writeFile(packageFilePath, JSON.stringify({ name: 'test', type: 'module', main: 'index.js', version: '1.0.0', notdescription: 'To update', author: 'To update' }), 'utf8');
    expect(await plugins.parse(plugin)).not.toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.WARN, expect.stringContaining('has no description in package.json'));
    expect(plugin.description).toBe('Unknown description');

    loggerLogSpy.mockClear();
    await fs.writeFile(packageFilePath, JSON.stringify({ name: 'test', type: 'module', main: 'index.js', version: '1.0.0', description: 'To update', notauthor: 'To update' }), 'utf8');
    expect(await plugins.parse(plugin)).not.toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.WARN, expect.stringContaining('has no author in package.json'));
    expect(plugin.author).toBe('Unknown author');

    loggerLogSpy.mockClear();
    await fs.writeFile(packageFilePath, JSON.stringify({ name: 'test', nottype: 'module', main: 'index.js', version: '1.0.0', description: 'To update', author: 'To update' }), 'utf8');
    expect(await plugins.parse(plugin)).not.toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('is not a module'));

    loggerLogSpy.mockClear();
    await fs.writeFile(packageFilePath, JSON.stringify({ name: 'test', type: 'notmodule', main: 'index.js', version: '1.0.0', description: 'To update', author: 'To update' }), 'utf8');
    expect(await plugins.parse(plugin)).not.toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('is not a module'));

    loggerLogSpy.mockClear();
    await fs.writeFile(packageFilePath, JSON.stringify({ name: 'test', type: 'module', notmain: 'index.js', version: '1.0.0', description: 'To update', author: 'To update' }), 'utf8');
    expect(await plugins.parse(plugin)).not.toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('has no main entrypoint in package.json'));

    loggerLogSpy.mockClear();
    await fs.writeFile(packageFilePath, JSON.stringify({ name: 'test', type: 'module', main: 'index.js', version: '1.0.0', description: 'To update', author: 'To update' }), 'utf8');
    plugin.type = undefined as any;
    expect(await plugins.parse(plugin)).not.toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.WARN, expect.stringContaining('has no type'));
    plugin.type = 'Any' as any;

    loggerLogSpy.mockClear();
    await fs.writeFile(packageFilePath, JSON.stringify({ dependencies: { matterbridge: '1.0.0' }, name: 'test', type: 'module', main: 'index.js', version: '1.0.0', description: 'To update', author: 'To update' }), 'utf8');
    expect(await plugins.parse(plugin)).toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Found matterbridge package'));

    loggerLogSpy.mockClear();
    await fs.writeFile(packageFilePath, JSON.stringify({ devDependencies: { matterbridge: '1.0.0' }, name: 'test', type: 'module', main: 'index.js', version: '1.0.0', description: 'To update', author: 'To update' }), 'utf8');
    expect(await plugins.parse(plugin)).toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Found matterbridge package'));

    loggerLogSpy.mockClear();
    await fs.writeFile(packageFilePath, JSON.stringify({ peerDependencies: { matterbridge: '1.0.0' }, name: 'test', type: 'module', main: 'index.js', version: '1.0.0', description: 'To update', author: 'To update' }), 'utf8');
    expect(await plugins.parse(plugin)).toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Found matterbridge package'));

    loggerLogSpy.mockClear();
    await fs.writeFile(packageFilePath, JSON.stringify({ dependencies: { '@project-chip': '1.0.0' }, name: 'test', type: 'module', main: 'index.js', version: '1.0.0', description: 'To update', author: 'To update' }), 'utf8');
    expect(await plugins.parse(plugin)).toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Found @project-chip packages'));

    loggerLogSpy.mockClear();
    await fs.writeFile(packageFilePath, JSON.stringify({ devDependencies: { '@project-chip': '1.0.0' }, name: 'test', type: 'module', main: 'index.js', version: '1.0.0', description: 'To update', author: 'To update' }), 'utf8');
    expect(await plugins.parse(plugin)).toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Found @project-chip packages'));

    loggerLogSpy.mockClear();
    await fs.writeFile(packageFilePath, JSON.stringify({ peerDependencies: { '@project-chip': '1.0.0' }, name: 'test', type: 'module', main: 'index.js', version: '1.0.0', description: 'To update', author: 'To update' }), 'utf8');
    expect(await plugins.parse(plugin)).toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Found @project-chip packages'));

    loggerLogSpy.mockClear();
    await fs.writeFile(packageFilePath, JSON.stringify({ dependencies: { '@matter': '1.0.0' }, name: 'test', type: 'module', main: 'index.js', version: '1.0.0', description: 'To update', author: 'To update' }), 'utf8');
    expect(await plugins.parse(plugin)).toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Found @project-chip packages'));

    loggerLogSpy.mockClear();
    await fs.writeFile(packageFilePath, JSON.stringify({ devDependencies: { '@matter': '1.0.0' }, name: 'test', type: 'module', main: 'index.js', version: '1.0.0', description: 'To update', author: 'To update' }), 'utf8');
    expect(await plugins.parse(plugin)).toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Found @project-chip packages'));

    loggerLogSpy.mockClear();
    await fs.writeFile(packageFilePath, JSON.stringify({ peerDependencies: { '@matter': '1.0.0' }, name: 'test', type: 'module', main: 'index.js', version: '1.0.0', description: 'To update', author: 'To update' }), 'utf8');
    expect(await plugins.parse(plugin)).toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Found @project-chip packages'));

    loggerLogSpy.mockClear();
    await fs.writeFile(packageFilePath, JSON.stringify({ name: 'test', type: 'module', main: 'index.js', version: '1.0.0', description: 'To update', author: 'To update' }), 'utf8');
    loggerLogSpy.mockImplementationOnce((level: string, message: string, ...parameters: any[]) => {
      throw new Error('Test error');
    });
    expect(await plugins.parse(plugin)).toBeNull();
    expect(plugin.error).toBe(true);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Failed to parse package.json of plugin'));
    plugin.error = false;

    (plugins as any)._plugins.delete('matterbridge-test');
  });

  test('parse author', async () => {
    expect(plugins.getAuthor({})).toBe('Unknown author');
    expect(plugins.getAuthor({ author: undefined } as any)).toBe('Unknown author');
    expect(plugins.getAuthor({ author: 'String name' })).toBe('String name');
    expect(plugins.getAuthor({ author: { name: 'Object name' } })).toBe('Object name');
  });

  test('parse homepage', async () => {
    expect(plugins.getHomepage({})).toBe(undefined);
    expect(plugins.getHomepage({ homepage: undefined } as any)).toBe(undefined);
    expect(plugins.getHomepage({ homepage: 'HomeUrl' })).toBe(undefined);
    expect(plugins.getHomepage({ homepage: 'http://HomeUrl' })).toBe('http://HomeUrl');
    expect(plugins.getHomepage({ homepage: 'git+HomeUrl.git' })).toBe(undefined);
    expect(plugins.getHomepage({ repository: { url: 'https://github.com/Luligu/matterbridge' } })).toBe('https://github.com/Luligu/matterbridge');
    expect(plugins.getHomepage({ repository: { url: 'git+https://github.com/Luligu/matterbridge.git' } })).toBe('https://github.com/Luligu/matterbridge');
  });

  test('parse help', async () => {
    expect(plugins.getHelp({})).toBe(undefined);
    expect(plugins.getHelp({ help: 'HelpUrl' })).toBe(undefined);
    expect(plugins.getHelp({ help: 'http://HelpUrl' })).toBe('http://HelpUrl');
    expect(plugins.getHelp({ help: 'https://github.com/Luligu/matterbridge.git' })).toBe('https://github.com/Luligu/matterbridge.git');
    expect(plugins.getHelp({ homepage: 'https://github.com/Luligu/matterbridge' })).toBe('https://github.com/Luligu/matterbridge');
    expect(plugins.getHelp({ homepage: 'git+https://github.com/Luligu/matterbridge.git' })).toBe('https://github.com/Luligu/matterbridge');
    expect(plugins.getHelp({ repository: { url: 'https://github.com/Luligu/matterbridge' } })).toBe('https://github.com/Luligu/matterbridge/blob/main/README.md');
    expect(plugins.getHelp({ repository: { url: 'git+https://github.com/Luligu/matterbridge.git' } })).toBe('https://github.com/Luligu/matterbridge/blob/main/README.md');
  });

  test('parse changelog', async () => {
    expect(plugins.getChangelog({})).toBe(undefined);
    expect(plugins.getChangelog({ changelog: 'ChangelogUrl' })).toBe(undefined);
    expect(plugins.getChangelog({ changelog: 'http://ChangelogUrl' })).toBe('http://ChangelogUrl');
    expect(plugins.getChangelog({ changelog: 'https://github.com/Luligu/matterbridge.git' })).toBe('https://github.com/Luligu/matterbridge.git');
    expect(plugins.getChangelog({ homepage: 'https://github.com/Luligu/matterbridge' })).toBe('https://github.com/Luligu/matterbridge');
    expect(plugins.getChangelog({ homepage: 'git+https://github.com/Luligu/matterbridge.git' })).toBe('https://github.com/Luligu/matterbridge');
    expect(plugins.getChangelog({ repository: { url: 'https://github.com/Luligu/matterbridge' } })).toBe('https://github.com/Luligu/matterbridge/blob/main/CHANGELOG.md');
    expect(plugins.getChangelog({ repository: { url: 'git+https://github.com/Luligu/matterbridge.git' } })).toBe('https://github.com/Luligu/matterbridge/blob/main/CHANGELOG.md');
  });

  test('parse funding', async () => {
    expect(plugins.getFunding({})).toBe(undefined);
    expect(plugins.getFunding({ funding: 'FundingUrl' })).toBe(undefined);
    expect(plugins.getFunding({ funding: 'https://www.buymeacoffee.com/luligugithub' })).toBe('https://www.buymeacoffee.com/luligugithub');
    expect(plugins.getFunding({ funding: { type: 'whatever', url: 'https://www.buymeacoffee.com/luligugithub' } })).toBe('https://www.buymeacoffee.com/luligugithub');
    expect(plugins.getFunding({ funding: { url: 'https://www.buymeacoffee.com/luligugithub' } })).toBe('https://www.buymeacoffee.com/luligugithub');
    expect(plugins.getFunding({ funding: ['https://www.buymeacoffee.com/luligugithub'] })).toBe('https://www.buymeacoffee.com/luligugithub');
    expect(plugins.getFunding({ funding: [{ url: 'https://www.buymeacoffee.com/luligugithub' }] })).toBe('https://www.buymeacoffee.com/luligugithub');
  });

  test('parse registered plugin', async () => {
    let count = 0;
    for (const plugin of plugins) {
      expect(await plugins.parse(plugin)).not.toBeNull();
      expect(plugin.name).toBeDefined();
      expect(plugin.path).toBeDefined();
      expect(plugin.type).toBeDefined();
      expect(plugin.type).toBe('Unknown');
      expect(plugin.version).toBeDefined();
      expect(plugin.version).not.toBe('1.0.0');
      expect(plugin.description).toBeDefined();
      expect(plugin.description).not.toBe('To update');
      expect(plugin.author).toBeDefined();
      expect(plugin.author).not.toBe('To update');
      count++;
    }
    expect(count).toBe(3);
  });

  test('enable plugin', async () => {
    expect(await plugins.enable(undefined as unknown as string)).toBeNull();
    expect(await plugins.enable(null as unknown as string)).toBeNull();
    expect(await plugins.enable('')).toBeNull();
    expect(await plugins.enable('xyz')).toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Failed to enable plugin ${plg}xyz${er}: package.json not found`);

    loggerLogSpy.mockClear();
    expect(await plugins.enable('./src/mock/plugin1')).not.toBeNull();
    expect((await plugins.enable('./src/mock/plugin1'))?.enabled).toBeTruthy();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Enabled plugin ${plg}matterbridge-mock1${nf}`);

    loggerLogSpy.mockClear();
    expect(await plugins.enable('./src/mock/plugin2')).not.toBeNull();
    expect((await plugins.enable('./src/mock/plugin2'))?.enabled).toBeTruthy();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Enabled plugin ${plg}matterbridge-mock2${nf}`);

    loggerLogSpy.mockClear();
    expect(await plugins.enable('./src/mock/plugin3')).not.toBeNull();
    expect((await plugins.enable('./src/mock/plugin3'))?.enabled).toBeTruthy();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Enabled plugin ${plg}matterbridge-mock3${nf}`);

    loggerLogSpy.mockClear();
    expect(await plugins.enable('./src/mock/plugintest/package.json')).toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Failed to enable plugin ${plg}./src/mock/plugintest/package.json${er}: plugin not registered`);

    loggerLogSpy.mockClear();
    jest.spyOn(plugins, 'saveToStorage').mockImplementationOnce(async () => {
      throw new Error('Test error');
    });
    expect(await plugins.enable('./src/mock/plugin3')).toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Enabled plugin ${plg}matterbridge-mock3${nf}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Failed to parse package.json of plugin`));
  });

  test('disable plugin', async () => {
    expect(await plugins.disable('')).toBeNull();
    expect(await plugins.disable('xyz')).toBeNull();

    expect(await plugins.disable('./src/mock/plugin1')).not.toBeNull();
    expect((await plugins.disable('./src/mock/plugin1'))?.enabled).toBeFalsy();

    expect(await plugins.disable('./src/mock/plugin2')).not.toBeNull();
    expect((await plugins.disable('./src/mock/plugin2'))?.enabled).toBeFalsy();

    expect(await plugins.disable('./src/mock/plugin3')).not.toBeNull();
    expect((await plugins.disable('./src/mock/plugin3'))?.enabled).toBeFalsy();

    loggerLogSpy.mockClear();
    expect(await plugins.disable('./src/mock/plugintest/package.json')).toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Failed to disable plugin ${plg}./src/mock/plugintest/package.json${er}: plugin not registered`);

    loggerLogSpy.mockClear();
    jest.spyOn(plugins, 'saveToStorage').mockImplementationOnce(async () => {
      throw new Error('Test error');
    });
    expect(await plugins.disable('./src/mock/plugin3')).toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Disabled plugin ${plg}matterbridge-mock3${nf}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Failed to parse package.json of plugin`));
  });

  test('remove plugin', async () => {
    expect(await plugins.remove('')).toBeNull();
    expect(await plugins.remove('xyz')).toBeNull();

    expect(plugins.length).toBe(3);

    expect(await plugins.remove('./src/mock/plugin1')).not.toBeNull();
    expect(plugins.length).toBe(2);

    expect(await plugins.remove('./src/mock/plugin2')).not.toBeNull();
    expect(plugins.length).toBe(1);

    expect(await plugins.remove('./src/mock/plugin3')).not.toBeNull();
    expect(plugins.length).toBe(0);
    loggerLogSpy.mockClear();

    expect(await plugins.remove('./src/mock/plugintest/package.json')).toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Failed to remove plugin ${plg}./src/mock/plugintest/package.json${er}: plugin not registered`);
    loggerLogSpy.mockClear();

    plugins.set({ name: 'matterbridge-mock3', path: './src/mock/plugin3/package.json', enabled: true, type: 'Unknown' as any, version: '1.0.0', description: 'To update', author: 'To update', homepage: 'https://example.com' });
    jest.spyOn(plugins, 'saveToStorage').mockImplementationOnce(async () => {
      throw new Error('Test error');
    });
    expect(await plugins.remove('./src/mock/plugin3')).toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Removed plugin ${plg}matterbridge-mock3${nf}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Failed to parse package.json of plugin`));

    expect(plugins.length).toBe(0);
  });

  test('add plugin', async () => {
    expect(await plugins.add('')).toBeNull();
    expect(await plugins.add('xyz')).toBeNull();
    expect(plugins.length).toBe(0);
    expect(await plugins.add('./src/mock/plugin1')).not.toBeNull();
    expect(await plugins.add('matterbridge-mock1')).toBeNull();
    expect(plugins.length).toBe(1);
    expect(await plugins.add('./src/mock/plugin2')).not.toBeNull();
    expect(await plugins.add('matterbridge-mock2')).toBeNull();
    expect(plugins.length).toBe(2);
    expect(await plugins.add('./src/mock/plugin3')).not.toBeNull();
    expect(await plugins.add('matterbridge-mock3')).toBeNull();
    expect(plugins.length).toBe(3);

    loggerLogSpy.mockClear();
    expect(await plugins.remove('./src/mock/plugin3')).not.toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Removed plugin ${plg}matterbridge-mock3${nf}`);

    loggerLogSpy.mockClear();
    jest.spyOn(plugins, 'saveToStorage').mockImplementationOnce(async () => {
      throw new Error('Test error');
    });
    expect(await plugins.add('./src/mock/plugin3')).toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Added plugin ${plg}matterbridge-mock3${nf}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Failed to parse package.json of plugin`));

    expect(plugins.length).toBe(3);
  });

  test('remove plugin with name', async () => {
    (matterbridge as any).registeredPlugins = Array.from((plugins as any)._plugins.values());

    expect(plugins.length).toBe(3);

    expect(await plugins.remove('matterbridge-mock1')).not.toBeNull();
    expect(plugins.length).toBe(2);

    expect(await plugins.remove('matterbridge-mock2')).not.toBeNull();
    expect(plugins.length).toBe(1);

    expect(await plugins.remove('matterbridge-mock3')).not.toBeNull();
    expect(plugins.length).toBe(0);
  });

  test('install example plugins', async () => {
    await setDebug(false);
    // console.log('Installing with prefix:', prefix);
    useSudo = false;
    execSync(`npm install ./ --omit=dev --silent --cache=${NPM_CONFIG_CACHE} --prefix=${NPM_CONFIG_PREFIX}`, {
      stdio: 'inherit',
      env: { ...process.env, npm_config_prefix: NPM_CONFIG_PREFIX, npm_config_cache: NPM_CONFIG_CACHE },
    });
    execSync(`npm install matterbridge-example-accessory-platform --omit=dev --silent --cache=${NPM_CONFIG_CACHE} --prefix=${NPM_CONFIG_PREFIX}`, {
      stdio: 'inherit',
      env: { ...process.env, npm_config_prefix: NPM_CONFIG_PREFIX, npm_config_cache: NPM_CONFIG_CACHE },
    });
    execSync(`npm install matterbridge-example-dynamic-platform --omit=dev --silent --cache=${NPM_CONFIG_CACHE} --prefix=${NPM_CONFIG_PREFIX}`, {
      stdio: 'inherit',
      env: { ...process.env, npm_config_prefix: NPM_CONFIG_PREFIX, npm_config_cache: NPM_CONFIG_CACHE },
    });
    expect(plugins.length).toBe(0);
  }, 60000);

  test('add/disable/enable/remove plugin matterbridge-example-accessory-platform', async () => {
    await setDebug(false);
    expect(plugins.length).toBe(0);
    expect(await plugins.add('matterbridge-example-accessory-platform')).not.toBeNull();
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Added plugin ${plg}matterbridge-example-accessory-platform${nf}`);
    expect(plugins.length).toBe(1);
    const plugin = plugins.get('matterbridge-example-accessory-platform');
    expect(plugin).not.toBeUndefined();
    expect(plugin?.name).toBe('matterbridge-example-accessory-platform');
    expect(plugin?.enabled).toBe(true);

    expect(await plugins.disable('matterbridge-example-accessory-platform')).not.toBeNull();
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Disabled plugin ${plg}matterbridge-example-accessory-platform${nf}`);
    expect(plugins.length).toBe(1);
    expect(plugin?.enabled).toBe(false);

    expect(await plugins.enable('matterbridge-example-accessory-platform')).not.toBeNull();
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Enabled plugin ${plg}matterbridge-example-accessory-platform${nf}`);
    expect(plugins.length).toBe(1);
    expect(plugin?.enabled).toBe(true);

    expect(await plugins.remove('matterbridge-example-accessory-platform')).not.toBeNull();
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Removed plugin ${plg}matterbridge-example-accessory-platform${nf}`);
    expect(plugins.length).toBe(0);
  });

  test('save to storage', async () => {
    await setDebug(false);
    (plugins as any)._plugins.set('matterbridge-mock1', { name: 'matterbridge-mock1', path: './src/mock/plugin1/package.json', type: 'Unknown', version: '1.0.0', description: 'To update', author: 'To update' });
    (plugins as any)._plugins.set('matterbridge-mock2', { name: 'matterbridge-mock2', path: './src/mock/plugin2/package.json', type: 'Unknown', version: '1.0.0', description: 'To update', author: 'To update' });
    (plugins as any)._plugins.set('matterbridge-mock3', { name: 'matterbridge-mock3', path: './src/mock/plugin3/package.json', type: 'Unknown', version: '1.0.0', description: 'To update', author: 'To update' });
    expect(await plugins.saveToStorage()).toBe(3);
    plugins.clear();
    expect(await plugins.saveToStorage()).toBe(0);
  });

  test('add plugin matterbridge-xyz', async () => {
    expect(plugins.length).toBe(0);
    const plugin = await plugins.add('matterbridge-xyz');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Failed to add plugin ${plg}matterbridge-xyz${er}: package.json not found`);
    expect(plugin).toBeNull();
    expect(plugins.length).toBe(0);
  });

  test('add plugin matterbridge-example-accessory-platform', async () => {
    expect(plugins.length).toBe(0);
    const plugin = await plugins.add('matterbridge-example-accessory-platform');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Added plugin ${plg}matterbridge-example-accessory-platform${nf}`);
    expect(plugin).not.toBeNull();
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;
    expect(plugin.name).toBe('matterbridge-example-accessory-platform');
    expect(plugin.type).toBe('AnyPlatform');
    expect(plugins.length).toBe(1);

    loggerLogSpy.mockClear();
    expect(await plugins.add('matterbridge-example-accessory-platform')).toBe(null);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Plugin ${plg}matterbridge-example-accessory-platform${nf} already registered`);
    expect(plugins.length).toBe(1);

    const newPlugin = plugins.get('matterbridge-example-accessory-platform');
    expect(newPlugin).not.toBeUndefined();
    if (!newPlugin) return;
    expect(newPlugin.name).toBe('matterbridge-example-accessory-platform');
    expect(newPlugin.type).toBe('AnyPlatform');
  });

  test('add plugin matterbridge-example-dynamic-platform', async () => {
    expect(plugins.length).toBe(1);
    const plugin = await plugins.add('matterbridge-example-dynamic-platform');
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Added plugin ${plg}matterbridge-example-dynamic-platform${nf}`);
    expect(plugin).not.toBeNull();
    expect(plugins.length).toBe(2);

    const newPlugin = plugins.get('matterbridge-example-dynamic-platform');
    expect(newPlugin).not.toBeUndefined();
    if (!newPlugin) return;
    expect(newPlugin.name).toBe('matterbridge-example-dynamic-platform');
    expect(newPlugin.type).toBe('AnyPlatform');
  });

  test('load default config plugin matterbridge-example-accessory-platform', async () => {
    const configFileName = path.join(matterbridge.matterbridgeDirectory, `matterbridge-example-accessory-platform.config.json`);
    const deleteConfig = async () => {
      try {
        await fs.unlink(configFileName);
      } catch (error) {
        // Ignore error
      }
    };
    expect(plugins.length).toBe(2);
    const plugin = plugins.get('matterbridge-example-accessory-platform');
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;
    const defaultConfigFile = plugin.path.replace('package.json', `${plugin.name}.config.json`);

    // Test write error
    await deleteConfig();
    jest.spyOn(fs, 'writeFile').mockImplementationOnce(async () => {
      throw new Error('Test write error');
    });
    let config = await plugins.loadConfig(plugin);
    expect(config).toEqual({ name: 'matterbridge-example-accessory-platform', type: 'AnyPlatform', version: '1.0.0', debug: false, unregisterOnShutdown: false });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Error creating config file ${configFileName} for plugin ${plg}${plugin.name}${er}: Test write error`));
    loggerLogSpy.mockClear();

    // Test access error
    await deleteConfig();
    jest.spyOn(fs, 'access').mockImplementationOnce(async () => {
      throw new Error('Test access error');
    });
    config = await plugins.loadConfig(plugin);
    expect(config).toEqual({ name: 'matterbridge-example-accessory-platform', type: 'AnyPlatform', version: '1.0.0', debug: false, unregisterOnShutdown: false });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Error accessing config file ${configFileName} for plugin ${plg}${plugin.name}${er}: Test access error`));
    loggerLogSpy.mockClear();

    // Test create new config file
    await deleteConfig();
    config = await plugins.loadConfig(plugin);
    expect(config).toEqual({ name: 'matterbridge-example-accessory-platform', type: 'AnyPlatform', version: '1.0.0', debug: false, unregisterOnShutdown: false });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Config file ${configFileName} for plugin ${plg}${plugin.name}${db} does not exist, creating new config file...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Default config file ${defaultConfigFile} for plugin ${plg}${plugin.name}${db} does not exist, creating new config file...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Created config file ${configFileName} for plugin ${plg}${plugin.name}${db}.`);
    loggerLogSpy.mockClear();

    // Test load config file
    config = await plugins.loadConfig(plugin);
    expect(config).toEqual({ name: 'matterbridge-example-accessory-platform', type: 'AnyPlatform', version: '1.0.0', debug: false, unregisterOnShutdown: false });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Loaded config file ${configFileName} for plugin ${plg}${plugin.name}${db}.`);
    loggerLogSpy.mockClear();

    // Test default values false for debug and unregisterOnShutdown
    (config as any).debug = undefined;
    (config as any).unregisterOnShutdown = undefined;
    await plugins.saveConfigFromJson(plugin, config);
    config = await plugins.loadConfig(plugin);
    expect(config).toEqual({ name: 'matterbridge-example-accessory-platform', type: 'AnyPlatform', version: '1.0.0', debug: false, unregisterOnShutdown: false });
    loggerLogSpy.mockClear();

    // Test default config file in plugin package path
    await deleteConfig();
    await fs.writeFile(defaultConfigFile, JSON.stringify(config, null, 2), 'utf8');
    config = await plugins.loadConfig(plugin);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Config file ${configFileName} for plugin ${plg}${plugin.name}${db} does not exist, creating new config file...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Loaded default config file ${defaultConfigFile} for plugin ${plg}${plugin.name}${db}.`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Created config file ${configFileName} for plugin ${plg}${plugin.name}${db}.`);
    loggerLogSpy.mockClear();
  });

  test('save config from plugin matterbridge-example-accessory-platform', async () => {
    expect(plugins.length).toBe(2);
    const plugin = plugins.get('matterbridge-example-accessory-platform');
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;
    expect(plugin.loaded).toBeFalsy();
    expect(plugin.platform).toBeUndefined();
    expect(plugin.started).toBeFalsy();
    expect(plugin.configured).toBeFalsy();
    expect(plugin.error).toBeFalsy();
    await plugins.shutdown(plugin, 'Test with Jest', true, true);
    const packageJson = JSON.parse(await fs.readFile(plugin.path, 'utf8'));
    packageJson.description = undefined;
    await fs.writeFile(plugin.path, JSON.stringify(packageJson, null, 2), 'utf8');
    const platform = await plugins.load(plugin);
    expect(platform).toBeDefined();
    expect(plugin.platform).toBeDefined();
    if (!platform || !plugin.platform) return;
    await platform.ready;
    expect(plugin.name).toBe('matterbridge-example-accessory-platform');
    expect(plugin.type).toBe('AccessoryPlatform');
    loggerLogSpy.mockClear();

    // Test save config error from plugin
    const config = plugin.platform.config;
    plugin.platform.config = undefined as unknown as PlatformConfig;
    await expect(plugins.saveConfigFromPlugin(plugin)).rejects.toThrow(`Error saving config file for plugin ${plg}${plugin.name}${er}: config not found`);
    plugin.platform.config = config;
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Error saving config file for plugin ${plg}${plugin.name}${er}: config not found`);
    loggerLogSpy.mockClear();

    // Test save config write error from plugin
    jest.spyOn(fs, 'writeFile').mockImplementationOnce(async () => {
      throw new Error('Test error');
    });
    await expect(plugins.saveConfigFromPlugin(plugin)).rejects.toThrow();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Error saving config file`));
    loggerLogSpy.mockClear();

    // Test save config from plugin
    await plugins.saveConfigFromPlugin(plugin, true);
    expect(plugin.restartRequired).toBe(true);
    const configFile = path.join(matterbridge.matterbridgeDirectory, `${plugin.name}.config.json`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Saved config file ${configFile} for plugin ${plg}${plugin.name}${db}`);

    await plugins.shutdown(plugin, 'Test with Jest', true, true);
  });

  test('save config from json matterbridge-example-accessory-platform', async () => {
    expect(plugins.length).toBe(2);
    const plugin = plugins.get('matterbridge-example-accessory-platform');
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;
    const platform = await plugins.load(plugin);
    expect(platform).toBeDefined();
    if (!plugin.platform) return;
    expect(plugin.name).toBe('matterbridge-example-accessory-platform');
    expect(plugin.type).toBe('AccessoryPlatform');

    // Test save config error from json
    let config = await plugins.loadConfig(plugin);
    (config as any).name = undefined;
    loggerLogSpy.mockClear();
    await plugins.saveConfigFromJson(plugin, config);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Error saving config file for plugin ${plg}${plugin.name}${er}.`), expect.any(Object));
    loggerLogSpy.mockClear();

    // Test save config write error from json
    jest.spyOn(fs, 'writeFile').mockImplementationOnce(async () => {
      throw new Error('Test error');
    });
    config = await plugins.loadConfig(plugin);
    await plugins.saveConfigFromJson(plugin, config);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Error saving config file`));
    loggerLogSpy.mockClear();

    // Test save config onConfigChanged error from json
    jest.spyOn(plugin.platform, 'onConfigChanged').mockImplementationOnce(async () => {
      throw new Error('Test error');
    });
    config = await plugins.loadConfig(plugin);
    await plugins.saveConfigFromJson(plugin, config);
    await wait(250);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Error calling onConfigChanged for plugin ${plg}${plugin.name}${er}`));
    loggerLogSpy.mockClear();

    // Test save config from json
    config = await plugins.loadConfig(plugin);
    await plugins.saveConfigFromJson(plugin, config, true);
    expect(plugin.restartRequired).toBe(true);
    const configFile = path.join(matterbridge.matterbridgeDirectory, `${plugin.name}.config.json`);
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.DEBUG, `Saved config file ${configFile} for plugin ${plg}${plugin.name}${db}`);

    await plugins.shutdown(plugin, 'Test with Jest', true, true);
  });

  test('load schema plugin matterbridge-example-accessory-platform', async () => {
    expect(plugins.length).toBe(2);
    const plugin = plugins.get('matterbridge-example-accessory-platform');
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;
    const schemaFile = plugin.path.replace('package.json', `${plugin.name}.schema.json`);
    try {
      await fs.writeFile(schemaFile, JSON.stringify(plugins.getDefaultSchema(plugin), null, 2), 'utf8');
    } catch (error) {
      // Ignore error
      // console.error('writeFile:', schemaFile, error);
    }

    const schema = await plugins.loadSchema(plugin);
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.DEBUG, `Loaded schema file ${schemaFile} for plugin ${plg}${plugin.name}${db}.`);
    expect(schema).not.toBeUndefined();
    expect(schema).not.toBeNull();
    expect(schema.title).toBe(plugin.description);
    expect(schema.description).toBeDefined();
    expect(schema.type).toBe('object');
    expect(schema.properties).toBeDefined();
    expect((schema.properties as any).name).toBeDefined();
    expect((schema.properties as any).type).toBeDefined();
    expect((schema.properties as any).debug).toBeDefined();
    expect((schema.properties as any).unregisterOnShutdown).toBeDefined();
  });

  test('load default schema plugin matterbridge-example-accessory-platform', async () => {
    expect(plugins.length).toBe(2);
    const plugin = plugins.get('matterbridge-example-accessory-platform');
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;
    const schemaFile = plugin.path.replace('package.json', `${plugin.name}.schema.json`);
    try {
      await fs.unlink(schemaFile);
    } catch (error) {
      // Ignore error
      // console.error('unlink:', schemaFile, error);
    }

    const schema = await plugins.loadSchema(plugin);
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Schema file ${schemaFile} for plugin ${plg}${plugin.name}${db} not found. Loading default schema.`));
    expect(schema).not.toBeUndefined();
    expect(schema).not.toBeNull();
    expect(schema.title).toBe(plugin.description);
    expect(schema.description).toBeDefined();
    expect(schema.type).toBe('object');
    expect(schema.properties).toBeDefined();
    expect((schema.properties as any).name).toBeDefined();
    expect((schema.properties as any).type).toBeDefined();
    expect((schema.properties as any).debug).toBeDefined();
    expect((schema.properties as any).unregisterOnShutdown).toBeDefined();
  });

  test('should not load plugin matterbridge-example-accessory-platform if parse error', async () => {
    const plugin = plugins.get('matterbridge-example-accessory-platform');
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;

    loggerLogSpy.mockClear();
    plugin.enabled = false;
    await plugins.load(plugin, false, 'Test with Jest');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Plugin ${plg}${plugin.name}${er} not enabled`);
    plugin.enabled = true;

    loggerLogSpy.mockClear();
    const savedPlatform = plugin.platform;
    plugin.platform = {} as unknown as MatterbridgePlatform;
    await plugins.load(plugin, false, 'Test with Jest');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Plugin ${plg}${plugin.name}${er} already loaded`);
    plugin.platform = savedPlatform;

    loggerLogSpy.mockClear();
    jsonParseSpy.mockImplementationOnce(() => {
      throw new Error('Test error');
    });
    const platform = await plugins.load(plugin, false, 'Test with Jest');
    expect(platform).toBeUndefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Failed to load plugin ${plg}${plugin?.name}${er}: Test error`));
    plugin.error = false;
  });

  test('should not load plugin test without default export', async () => {
    const plugin = await plugins.add('./src/mock/plugintest');
    expect(plugin).toBeDefined();
    if (!plugin) return;
    await plugins.load(plugin, false, 'Test with Jest');
    await plugins.remove(plugin.name);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`does not provide a default export`));
  });

  test('load plugin matterbridge-example-accessory-platform', async () => {
    const plugin = plugins.get('matterbridge-example-accessory-platform');
    expect(plugin).toBeDefined();
    if (!plugin) return;

    expect(await plugins.load('unknown')).toBeUndefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Plugin ${plg}unknown${er} not found`);

    const platform = await plugins.load(plugin, false, 'Test with Jest');
    expect(platform).toBeDefined();
    if (!platform) return;

    expect(await plugins.load('matterbridge-example-accessory-platform')).toBeDefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Plugin ${plg}${plugin.name}${er} already loaded`);

    expect(platform.matterbridge).toBeDefined();
    expect(platform.log).toBeDefined();
    expect(platform.config).toBeDefined();
    expect(platform.name).toBe('matterbridge-example-accessory-platform');
    expect(platform.type).toBe('AccessoryPlatform');
    expect(platform.version).toBeDefined();
    expect(platform.version).not.toBe('');

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Loading plugin ${plg}${plugin.name}${nf} type ${typ}${plugin.type}${nf}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringContaining(`Loaded plugin ${plg}${plugin.name}${nt} type ${typ}${platform.type}${nt}`));
    expect(plugin.name).toBe('matterbridge-example-accessory-platform');
    expect(plugin.type).toBe('AccessoryPlatform');
    expect(plugin.platform).toBeDefined();
    expect(plugin.loaded).toBe(true);
    expect(plugin.registeredDevices).toBe(0);
    expect(plugin.configJson).toBeDefined();
    expect(plugin.schemaJson).toBeDefined();
  });

  test('should not start plugin matterbridge-example-accessory-platform if not loaded', async () => {
    const plugin = plugins.get('matterbridge-example-accessory-platform');
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;
    expect(plugin.name).toBe('matterbridge-example-accessory-platform');
    expect(plugin.type).toBe('AccessoryPlatform');
    expect(plugin.loaded).toBeTruthy();
    expect(plugin.started).toBeFalsy();
    expect(plugin.configured).toBeFalsy();

    plugin.loaded = false;
    const result = await plugins.start(plugin, 'Test with Jest');
    expect(result).toBeUndefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Plugin ${plg}${plugin?.name}${er} not loaded`);
    plugin.loaded = true;
  });

  test('should not start plugin matterbridge-example-accessory-platform if no platform', async () => {
    const plugin = plugins.get('matterbridge-example-accessory-platform');
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;
    expect(plugin.name).toBe('matterbridge-example-accessory-platform');
    expect(plugin.type).toBe('AccessoryPlatform');
    expect(plugin.loaded).toBeTruthy();
    expect(plugin.started).toBeFalsy();
    expect(plugin.configured).toBeFalsy();

    const platform = plugin.platform;
    plugin.platform = undefined;
    const result = await plugins.start(plugin, 'Test with Jest', false);
    expect(result).toBeUndefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Plugin ${plg}${plugin?.name}${er} no platform found`);
    plugin.platform = platform;
  });

  test('should not start plugin matterbridge-example-accessory-platform if already started', async () => {
    const plugin = plugins.get('matterbridge-example-accessory-platform');
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;
    expect(plugin.name).toBe('matterbridge-example-accessory-platform');
    expect(plugin.type).toBe('AccessoryPlatform');
    expect(plugin.loaded).toBeTruthy();
    expect(plugin.started).toBeFalsy();
    expect(plugin.configured).toBeFalsy();

    plugin.started = true;
    const result = await plugins.start(plugin, 'Test with Jest', false);
    expect(result).toBeUndefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Plugin ${plg}${plugin?.name}${er} already started`);
    plugin.started = false;
  });

  test('should log start plugin matterbridge-example-accessory-platform if it throws', async () => {
    const plugin = plugins.get('matterbridge-example-accessory-platform');
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;
    expect(plugin.name).toBe('matterbridge-example-accessory-platform');
    expect(plugin.type).toBe('AccessoryPlatform');
    expect(plugin.loaded).toBeTruthy();
    expect(plugin.started).toBeFalsy();
    expect(plugin.configured).toBeFalsy();
    expect(plugin.platform).toBeDefined();
    if (!plugin.platform) return;
    jest.spyOn(plugin.platform, 'onStart').mockImplementationOnce(async () => {
      throw new Error('Test error');
    });
    const result = await plugins.start(plugin, 'Test with Jest', false);
    expect(result).toBeUndefined();
    expect(plugin.error).toBeTruthy();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Starting plugin ${plg}${plugin.name}${nf} type ${typ}${plugin?.type}${nf}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Failed to start plugin ${plg}${plugin.name}${er}: Test error`));
    plugin.error = false;
  });

  test('start plugin matterbridge-example-accessory-platform', async () => {
    let plugin = plugins.get('matterbridge-example-accessory-platform');
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;
    expect(plugin.name).toBe('matterbridge-example-accessory-platform');
    expect(plugin.type).toBe('AccessoryPlatform');
    expect(plugin.loaded).toBeTruthy();
    expect(plugin.platform).toBeDefined();
    expect(plugin.started).toBeFalsy();
    expect(plugin.configured).toBeFalsy();

    expect(await plugins.start('unknown')).toBeUndefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Plugin ${plg}unknown${er} not found`);

    plugin = await plugins.start(plugin, 'Test with Jest', false);
    expect(plugin).toBeDefined();
    if (!plugin) return;

    expect(await plugins.start('matterbridge-example-accessory-platform')).toBeUndefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Plugin ${plg}${plugin.name}${er} already started`);

    expect(plugin.started).toBe(true);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Starting plugin ${plg}${plugin?.name}${nf} type ${typ}${plugin?.type}${nf}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Started plugin ${plg}${plugin?.name}${nt} type ${typ}${plugin?.type}${nt}`);
  });

  test('configure plugin matterbridge-example-accessory-platform should log errors', async () => {
    const plugin = plugins.get('matterbridge-example-accessory-platform');
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;
    expect(plugin.loaded).toBeTruthy();
    expect(plugin.started).toBeTruthy();
    expect(plugin.configured).toBeFalsy();

    expect(await plugins.configure('unknown')).toBeUndefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Plugin ${plg}unknown${er} not found`);

    plugin.loaded = false;
    expect(await plugins.configure(plugin)).toBeUndefined();
    plugin.loaded = true;
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Plugin ${plg}${plugin?.name}${er} not loaded`);

    plugin.started = false;
    expect(await plugins.configure(plugin)).toBeUndefined();
    plugin.started = true;
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Plugin ${plg}${plugin?.name}${er} not started`);

    const platform = plugin.platform;
    plugin.platform = undefined;
    expect(await plugins.configure(plugin)).toBeUndefined();
    plugin.platform = platform;
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Plugin ${plg}${plugin?.name}${er} no platform found`);

    plugin.configured = true;
    expect(await plugins.configure(plugin)).toBeUndefined();
    plugin.configured = false;
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Plugin ${plg}${plugin?.name}${db} already configured`);
  });

  test('configure plugin matterbridge-example-accessory-platform should log if it throws', async () => {
    const plugin = plugins.get('matterbridge-example-accessory-platform');
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;
    expect(plugin.loaded).toBeTruthy();
    expect(plugin.started).toBeTruthy();
    expect(plugin.configured).toBeFalsy();

    // Spy on and mock the configure method to throw an error once
    if (plugin.platform) {
      const configureSpy = jest.spyOn(plugin.platform, 'onConfigure').mockImplementationOnce(async () => {
        throw new Error('Test error');
      });
    }
    await plugins.configure(plugin);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Failed to configure plugin ${plg}${plugin.name}${er}: Test error`));
  });

  test('configure plugin matterbridge-example-accessory-platform', async () => {
    let plugin = plugins.get('matterbridge-example-accessory-platform');
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;
    expect(plugin.loaded).toBeTruthy();
    expect(plugin.started).toBeTruthy();
    expect(plugin.configured).toBeFalsy();
    plugin = await plugins.configure(plugin);
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;

    expect(await plugins.configure('matterbridge-example-accessory-platform')).toBeUndefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Plugin ${plg}${plugin.name}${db} already configured`);

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Configuring plugin ${plg}${plugin?.name}${nf} type ${typ}${plugin?.type}${nf}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Configured plugin ${plg}${plugin?.name}${nt} type ${typ}${plugin?.type}${nt}`);
    expect(plugin).not.toBeUndefined();
    expect(plugin.configured).toBe(true);
  });

  test('should not shutdown plugin matterbridge-example-accessory-platform', async () => {
    const plugin = plugins.get('matterbridge-example-accessory-platform');
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;
    expect(plugin.loaded).toBeTruthy();
    expect(plugin.started).toBeTruthy();
    expect(plugin.configured).toBeTruthy();

    plugin.loaded = false;
    let result = await plugins.shutdown(plugin, 'Test with Jest', true, false);
    expect(result).toBeUndefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Plugin ${plg}${plugin.name}${db} not loaded`);
    plugin.loaded = true;

    loggerLogSpy.mockClear();
    plugin.started = false;
    result = await plugins.shutdown(plugin, 'Test with Jest', true, false);
    expect(result).toBeUndefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Plugin ${plg}${plugin.name}${db} not started`);
    plugin.started = true;

    loggerLogSpy.mockClear();
    const platform = plugin.platform;
    plugin.platform = undefined;
    plugin.configured = false;
    result = await plugins.shutdown(plugin, 'Test with Jest', true, false);
    expect(result).toBeUndefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Plugin ${plg}${plugin.name}${db} not configured`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Plugin ${plg}${plugin.name}${db} no platform found`);
    plugin.configured = true;
    plugin.platform = platform;

    loggerLogSpy.mockClear();
    expect(plugin.platform).toBeDefined();
    if (!plugin.platform) return;
    jest.spyOn(plugin.platform, 'onShutdown').mockImplementationOnce(async () => {
      throw new Error('Test error');
    });
    result = await plugins.shutdown(plugin, 'Test with Jest', true, false);
    expect(result).toBeUndefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Failed to shut down plugin ${plg}${plugin.name}${er}: Test error`));
  });

  test('shutdown plugin matterbridge-example-accessory-platform', async () => {
    let plugin = plugins.get('matterbridge-example-accessory-platform');
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;
    expect(plugin.loaded).toBeTruthy();
    expect(plugin.started).toBeTruthy();
    expect(plugin.configured).toBeTruthy();

    expect(await plugins.shutdown('unknown')).toBeUndefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Plugin ${plg}unknown${er} not found`);

    plugin = await plugins.shutdown(plugin, 'Test with Jest', true);
    expect(plugin).toBeDefined();
    if (!plugin) return;

    expect(await plugins.shutdown('matterbridge-example-accessory-platform')).toBeUndefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Plugin ${plg}${plugin.name}${db} not loaded`);

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Shutting down plugin ${plg}${plugin.name}${nf}: Test with Jest...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Shutdown of plugin ${plg}${plugin.name}${nt} completed`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Removing all bridged endpoints for plugin ${plg}${plugin.name}${db}`);
    expect(plugin.locked).toBe(undefined);
    expect(plugin.error).toBe(undefined);
    expect(plugin.loaded).toBe(undefined);
    expect(plugin.started).toBe(undefined);
    expect(plugin.configured).toBe(undefined);
    expect(plugin.platform).toBe(undefined);

    expect(await plugins.saveToStorage()).toBe(2);
  });

  test('load, start with configure and shutdown plugin matterbridge-example-accessory-platform', async () => {
    const plugin = plugins.get('matterbridge-example-accessory-platform');
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;
    expect(plugin.locked).toBe(undefined);
    expect(plugin.error).toBe(undefined);
    expect(plugin.loaded).toBe(undefined);
    expect(plugin.started).toBe(undefined);
    expect(plugin.configured).toBe(undefined);
    expect(plugin.platform).toBe(undefined);

    const platform = await plugins.load(plugin);
    expect(platform).toBeDefined();
    await plugins.start(plugin, 'Test with Jest', true);
    expect(plugin.locked).toBe(undefined);
    expect(plugin.error).toBe(undefined);
    expect(plugin.loaded).toBe(true);
    expect(plugin.started).toBe(true);
    expect(plugin.configured).toBe(true);
    expect(plugin.platform).toBeDefined();
    await plugins.shutdown(plugin, 'Test with Jest', true);
    expect(plugin.locked).toBe(undefined);
    expect(plugin.error).toBe(undefined);
    expect(plugin.loaded).toBe(undefined);
    expect(plugin.started).toBe(undefined);
    expect(plugin.configured).toBe(undefined);
    expect(plugin.platform).toBe(undefined);
  });

  test('load, start and configure in parallel plugin matterbridge-example-dynamic-platform', async () => {
    const plugin = plugins.get('matterbridge-example-dynamic-platform');
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;
    const config = await plugins.loadConfig(plugin);
    config.whiteList = ['No devices'];
    await plugins.saveConfigFromJson(plugin, config);

    plugins.load(plugin, true, 'Test with Jest', true);
    expect(plugin.loaded).toBe(undefined);
    expect(plugin.started).toBe(undefined);
    expect(plugin.configured).toBe(undefined);
    await waiter(
      'Plugin to start',
      () => {
        return plugin.configured === true && plugin.started === true && plugin.loaded === true;
      },
      true,
      30000,
      100,
      true,
    );
    expect(plugin.loaded).toBe(true);
    expect(plugin.started).toBe(true);
    expect(plugin.configured).toBe(true);
  }, 30000);

  test('shutdown plugin matterbridge-example-dynamic-platform', async () => {
    let plugin = plugins.get('matterbridge-example-dynamic-platform');
    expect(plugin).not.toBeUndefined();
    expect(plugin?.loaded).toBeTruthy();
    expect(plugin?.started).toBeTruthy();
    expect(plugin?.configured).toBeTruthy();
    if (!plugin) return;

    plugin = await plugins.shutdown(plugin, 'Test with Jest', true);
    expect(plugin).not.toBeUndefined();

    plugin = await plugins.shutdown(plugin as Plugin, 'Test with Jest');
  });

  test('uninstall example plugins', async () => {
    execSync(`npm uninstall matterbridge --silent --prefix=${NPM_CONFIG_PREFIX}`, {
      stdio: 'inherit',
      env: { ...process.env, npm_config_prefix: NPM_CONFIG_PREFIX },
    });
    execSync(`npm uninstall matterbridge-example-accessory-platform --silent --prefix=${NPM_CONFIG_PREFIX}`, {
      stdio: 'inherit',
      env: { ...process.env, npm_config_prefix: NPM_CONFIG_PREFIX },
    });
    execSync(`npm uninstall matterbridge-example-dynamic-platform --silent --prefix=${NPM_CONFIG_PREFIX}`, {
      stdio: 'inherit',
      env: { ...process.env, npm_config_prefix: NPM_CONFIG_PREFIX },
    });
    expect(plugins.length).toBe(2);
  }, 60000);

  test('Matterbridge.destroyInstance()', async () => {
    // Destroy the Matterbridge instance
    await destroyInstance(matterbridge);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringContaining('Cleanup completed. Shutting down...'));
    // Close mDNS instance
    await closeMdnsInstance(matterbridge);
  });
});
