/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

process.argv = ['node', 'matterbridge.test.js', '-logger', 'debug', '-matterlogger', 'debug', '-test', '-frontend', '0', '-profile', 'JestPluginManager'];

import { jest } from '@jest/globals';
import { AnsiLogger, db, er, LogLevel, nf, nt, pl, UNDERLINE, UNDERLINEOFF } from 'node-ansi-logger';
import { Matterbridge } from './matterbridge.js';
import { RegisteredPlugin } from './matterbridgeTypes.js';
import { PluginManager } from './pluginManager.js';
import { execSync } from 'node:child_process';
import { waiter } from './utils/utils.js';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { DeviceManager } from './deviceManager.js';
import { MatterbridgePlatform, PlatformConfig } from './matterbridgePlatform.js';

// Default colors
const plg = '\u001B[38;5;33m';
const dev = '\u001B[38;5;79m';
const typ = '\u001B[38;5;207m';

describe('PluginManager', () => {
  let matterbridge: Matterbridge;
  let plugins: PluginManager;
  let devices: DeviceManager;

  let parseSpy: jest.SpiedFunction<typeof JSON.parse>;

  let loggerLogSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.log>;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let consoleDebugSpy: jest.SpiedFunction<typeof console.log>;
  let consoleInfoSpy: jest.SpiedFunction<typeof console.log>;
  let consoleWarnSpy: jest.SpiedFunction<typeof console.log>;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.log>;
  const debug = false;

  if (!debug) {
    // Spy on and mock AnsiLogger.log
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {
      //
    });
    // Spy on and mock console.log
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {
      //
    });
    // Spy on and mock console.debug
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation((...args: any[]) => {
      //
    });
    // Spy on and mock console.info
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation((...args: any[]) => {
      //
    });
    // Spy on and mock console.warn
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation((...args: any[]) => {
      //
    });
    // Spy on and mock console.error
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args: any[]) => {
      //
    });
  } else {
    // Spy on AnsiLogger.log
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log');
    // Spy on console.log
    consoleLogSpy = jest.spyOn(console, 'log');
    // Spy on console.debug
    consoleDebugSpy = jest.spyOn(console, 'debug');
    // Spy on console.info
    consoleInfoSpy = jest.spyOn(console, 'info');
    // Spy on console.warn
    consoleWarnSpy = jest.spyOn(console, 'warn');
    // Spy on console.error
    consoleErrorSpy = jest.spyOn(console, 'error');
  }

  beforeAll(async () => {
    matterbridge = await Matterbridge.loadInstance(true);
    plugins = (matterbridge as any).plugins;
  });

  beforeEach(async () => {
    // Spy on JSON.parse
    parseSpy = jest.spyOn(JSON, 'parse');
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Restore JSON.parse
    parseSpy.mockRestore();
  });

  afterAll(async () => {
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('constructor initializes correctly', () => {
    expect(plugins).toBeInstanceOf(PluginManager);
  });

  test('logLevel changes correctly', () => {
    plugins.logLevel = LogLevel.DEBUG;
    expect((plugins as any).log.logLevel).toBe(LogLevel.DEBUG);
  });

  test('clear and load from storage', async () => {
    plugins.clear();
    expect(await plugins.saveToStorage()).toBe(0);
    expect(await plugins.loadFromStorage()).toHaveLength(0);
  });

  test('size returns correct number of plugins', () => {
    expect(plugins.size).toBe(0);
    expect(plugins.length).toBe(0);
    plugins.set({ name: 'matterbridge-mock1', path: './src/mock/plugin1/package.json', type: 'Unknown', version: '1.0.0', description: 'To update', author: 'To update' });
    plugins.set({ name: 'matterbridge-mock2', path: './src/mock/plugin2/package.json', type: 'Unknown', version: '1.0.0', description: 'To update', author: 'To update' });
    plugins.set({ name: 'matterbridge-mock3', path: './src/mock/plugin3/package.json', type: 'Unknown', version: '1.0.0', description: 'To update', author: 'To update' });
    expect(plugins.size).toBe(3);
    expect(plugins.length).toBe(3);
    expect(plugins.array()).toHaveLength(3);
    expect(plugins.array()).toEqual([
      { 'author': 'To update', 'description': 'To update', 'name': 'matterbridge-mock1', 'path': './src/mock/plugin1/package.json', 'type': 'Unknown', 'version': '1.0.0' },
      { 'author': 'To update', 'description': 'To update', 'name': 'matterbridge-mock2', 'path': './src/mock/plugin2/package.json', 'type': 'Unknown', 'version': '1.0.0' },
      { 'author': 'To update', 'description': 'To update', 'name': 'matterbridge-mock3', 'path': './src/mock/plugin3/package.json', 'type': 'Unknown', 'version': '1.0.0' },
    ]);
  });

  test('has returns true if plugin exists', () => {
    expect(plugins.has('testPlugin')).toBe(false);
    expect(plugins.has('matterbridge-mock1')).toBe(true);
    expect(plugins.has('matterbridge-mock2')).toBe(true);
    expect(plugins.has('matterbridge-mock3')).toBe(true);
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
    await plugins.forEach(async (plugin: RegisteredPlugin) => {
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
    loggerLogSpy.mockClear();
    let count = 0;
    await plugins.forEach(async (plugin: RegisteredPlugin) => {
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

  test('parse plugin', async () => {
    const packageFilePath = path.join('.', 'src', 'mock', 'plugintest', 'package.json');
    (plugins as any)._plugins.set('matterbridge-test', { name: 'matterbridge-test', path: './src/mock/plugintest/package.json', type: 'Any', main: 'index.js', version: '1.0.0', description: 'To update', author: 'To update' });
    const plugin = plugins.get('matterbridge-test');
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;
    expect(await plugins.parse(plugin)).not.toBeNull();

    loggerLogSpy.mockClear();
    await fs.writeFile(packageFilePath, JSON.stringify({ name: 'test', type: 'module', main: 'index.js', version: '1.0.0', description: 'To update', author: 'To update' }), 'utf8');
    expect(await plugins.parse(plugin)).not.toBeNull();

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
    plugin.type = undefined as unknown as string;
    expect(await plugins.parse(plugin)).not.toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.WARN, expect.stringContaining('has no type'));
    plugin.type = 'Any';

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
    plugins.set({ name: 'matterbridge-mock3', path: './src/mock/plugin3/package.json', type: 'Unknown', version: '1.0.0', description: 'To update', author: 'To update' });
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

  test('add/disable/enable/remove plugin matterbridge-eve-door', async () => {
    execSync('npm install -g matterbridge-eve-door --omit=dev');

    expect(plugins.length).toBe(0);
    expect(await plugins.add('matterbridge-eve-door')).not.toBeNull();
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Added plugin ${plg}matterbridge-eve-door${nf}`);
    expect(plugins.length).toBe(1);
    const plugin = plugins.get('matterbridge-eve-door');
    expect(plugin).not.toBeUndefined();
    expect(plugin?.name).toBe('matterbridge-eve-door');
    expect(plugin?.enabled).toBe(true);

    expect(await plugins.disable('matterbridge-eve-door')).not.toBeNull();
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Disabled plugin ${plg}matterbridge-eve-door${nf}`);
    expect(plugins.length).toBe(1);
    expect(plugin?.enabled).toBe(false);

    expect(await plugins.enable('matterbridge-eve-door')).not.toBeNull();
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Enabled plugin ${plg}matterbridge-eve-door${nf}`);
    expect(plugins.length).toBe(1);
    expect(plugin?.enabled).toBe(true);

    expect(await plugins.remove('matterbridge-eve-door')).not.toBeNull();
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Removed plugin ${plg}matterbridge-eve-door${nf}`);
    expect(plugins.length).toBe(0);

    execSync('npm uninstall -g matterbridge-eve-door');
  }, 60000);

  test('save to storage', async () => {
    (plugins as any)._plugins.set('matterbridge-mock1', { name: 'matterbridge-mock1', path: './src/mock/plugin1/package.json', type: 'Unknown', version: '1.0.0', description: 'To update', author: 'To update' });
    (plugins as any)._plugins.set('matterbridge-mock2', { name: 'matterbridge-mock2', path: './src/mock/plugin2/package.json', type: 'Unknown', version: '1.0.0', description: 'To update', author: 'To update' });
    (plugins as any)._plugins.set('matterbridge-mock3', { name: 'matterbridge-mock3', path: './src/mock/plugin3/package.json', type: 'Unknown', version: '1.0.0', description: 'To update', author: 'To update' });
    expect(await plugins.saveToStorage()).toBe(3);
    plugins.clear();
    expect(await plugins.saveToStorage()).toBe(0);
  });

  test('install plugin matterbridge-xyz', async () => {
    // if (matterbridge.systemInformation.osPlatform === 'darwin') return; // MacOS fails

    expect(await plugins.install('matterbridge-xyz')).toBeUndefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Installing plugin ${plg}matterbridge-xyz${nf}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Failed to install plugin ${plg}matterbridge-xyz${er}:`));
  }, 300000);

  test('install plugin matterbridge-example-accessory-platform', async () => {
    // if (matterbridge.systemInformation.osPlatform === 'darwin') return; // MacOS fails

    const version = await plugins.install('matterbridge-example-accessory-platform');
    expect(version).not.toBeUndefined();
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Installing plugin ${plg}matterbridge-example-accessory-platform${nf}`);
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Installed plugin ${plg}matterbridge-example-accessory-platform${nf}`);
  }, 300000);

  test('install plugin matterbridge-example-dynamic-platform', async () => {
    // if (matterbridge.systemInformation.osPlatform === 'darwin') return; // MacOS fails

    const version = await plugins.install('matterbridge-example-dynamic-platform');
    expect(version).not.toBeUndefined();
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Installing plugin ${plg}matterbridge-example-dynamic-platform${nf}`);
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Installed plugin ${plg}matterbridge-example-dynamic-platform${nf}`);
  }, 300000);

  test('add plugin matterbridge-xyz', async () => {
    // if (matterbridge.systemInformation.osPlatform === 'darwin') return; // MacOS fails

    expect(plugins.length).toBe(0);
    const plugin = await plugins.add('matterbridge-xyz');
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.ERROR, `Failed to add plugin ${plg}matterbridge-xyz${er}: package.json not found`);
    expect(plugin).toBeNull();
    expect(plugins.length).toBe(0);
  }, 60000);

  test('add plugin matterbridge-example-accessory-platform', async () => {
    // if (matterbridge.systemInformation.osPlatform === 'darwin') return; // MacOS fails

    expect(plugins.length).toBe(0);
    const plugin = await plugins.add('matterbridge-example-accessory-platform');
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Added plugin ${plg}matterbridge-example-accessory-platform${nf}`);
    expect(plugin).not.toBeNull();
    expect(plugins.length).toBe(1);

    loggerLogSpy.mockClear();
    expect(await plugins.add('matterbridge-example-accessory-platform')).toBe(null);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Plugin ${plg}matterbridge-example-accessory-platform${nf} already registered`);
    expect(plugins.length).toBe(1);

    /*
    loggerLogSpy.mockClear();
    let count = 0;
    const parseSpy = jest.spyOn(JSON, 'parse').mockImplementation(() => {
      count++;
      if (count === 1) {
        return {};
      }
      throw new Error('Test error');
    });
    expect(await plugins.add('matterbridge-example-accessory-platform')).toBe(null);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Failed to parse package.json of plugin ${plg}matterbridge-example-accessory-platform${er}: Test error`);
    expect(plugins.length).toBe(1);
    jest.spyOn(JSON, 'parse');
    */

    const newPlugin = plugins.get('matterbridge-example-accessory-platform');
    expect(newPlugin).not.toBeUndefined();
    if (!newPlugin) return;
    expect(newPlugin.name).toBe('matterbridge-example-accessory-platform');
    expect(newPlugin.type).toBe('AnyPlatform');
  }, 60000);

  test('add plugin matterbridge-example-dynamic-platform', async () => {
    // if (matterbridge.systemInformation.osPlatform === 'darwin') return; // MacOS fails

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
  }, 60000);

  test('load default config plugin matterbridge-example-accessory-platform', async () => {
    // if (matterbridge.systemInformation.osPlatform === 'darwin') return; // MacOS fails

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

    await deleteConfig();
    jest.spyOn(fs, 'writeFile').mockImplementationOnce(async () => {
      throw new Error('Test error');
    });
    let config = await plugins.loadConfig(plugin);
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.ERROR, `Error creating config file ${configFileName} for plugin ${plg}${plugin.name}${er}: Test error`);
    loggerLogSpy.mockClear();

    await deleteConfig();
    jest.spyOn(fs, 'access').mockImplementationOnce(async () => {
      throw new Error('Test error');
    });
    config = await plugins.loadConfig(plugin);
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.ERROR, `Error accessing config file ${configFileName} for plugin ${plg}${plugin.name}${er}: Test error`);
    loggerLogSpy.mockClear();

    await deleteConfig();
    config = await plugins.loadConfig(plugin);
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.DEBUG, `Created config file ${configFileName} for plugin ${plg}${plugin.name}${db}.`);
    loggerLogSpy.mockClear();

    config = await plugins.loadConfig(plugin);
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.DEBUG, `Loaded config file ${configFileName} for plugin ${plg}${plugin.name}${db}.`);
    expect(config).not.toBeUndefined();
    expect(config).not.toBeNull();
    expect(config.name).toBe(plugin.name);
    expect(config.type).toBe(plugin.type);
    expect(config.type).toBe('AnyPlatform');
    expect(config.debug).toBeDefined();
    expect(config.unregisterOnShutdown).toBeDefined();
  }, 60000);

  test('save config from plugin matterbridge-example-accessory-platform', async () => {
    // if (matterbridge.systemInformation.osPlatform === 'darwin') return; // MacOS fails

    expect(plugins.length).toBe(2);
    const plugin = plugins.get('matterbridge-example-accessory-platform');
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;
    const platform = await plugins.load(plugin);
    expect(platform).toBeDefined();
    expect(plugin.platform).toBeDefined();
    if (!plugin.platform) return;
    expect(plugin.name).toBe('matterbridge-example-accessory-platform');
    expect(plugin.type).toBe('AccessoryPlatform');

    const config = plugin.platform.config;
    plugin.platform.config = undefined as unknown as PlatformConfig;
    await expect(plugins.saveConfigFromPlugin(plugin)).rejects.toThrow(`Error saving config file for plugin ${plg}${plugin.name}${er}: config not found`);
    plugin.platform.config = config;
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Error saving config file for plugin ${plg}${plugin.name}${er}: config not found`);

    loggerLogSpy.mockClear();
    jest.spyOn(fs, 'writeFile').mockImplementationOnce(async () => {
      throw new Error('Test error');
    });
    // await plugins.saveConfigFromPlugin(plugin);
    await expect(plugins.saveConfigFromPlugin(plugin)).rejects.toThrow();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Error saving config file`));

    loggerLogSpy.mockClear();
    await plugins.saveConfigFromPlugin(plugin);
    const configFile = path.join(matterbridge.matterbridgeDirectory, `${plugin.name}.config.json`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Saved config file ${configFile} for plugin ${plg}${plugin.name}${db}`);

    await plugins.shutdown(plugin, 'Test with Jest', true, true);
  }, 60000);

  test('save config from json matterbridge-example-accessory-platform', async () => {
    // if (matterbridge.systemInformation.osPlatform === 'darwin') return; // MacOS fails

    expect(plugins.length).toBe(2);
    const plugin = plugins.get('matterbridge-example-accessory-platform');
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;
    const platform = await plugins.load(plugin);
    expect(platform).toBeDefined();
    expect(plugin.name).toBe('matterbridge-example-accessory-platform');
    expect(plugin.type).toBe('AccessoryPlatform');

    let config = await plugins.loadConfig(plugin);
    config.name = undefined;
    loggerLogSpy.mockClear();
    await plugins.saveConfigFromJson(plugin, config);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Error saving config file for plugin ${plg}${plugin.name}${er}.`), expect.any(Object));

    loggerLogSpy.mockClear();
    jest.spyOn(fs, 'writeFile').mockImplementationOnce(async () => {
      throw new Error('Test error');
    });
    config = await plugins.loadConfig(plugin);
    await plugins.saveConfigFromJson(plugin, config);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Error saving config file`));

    loggerLogSpy.mockClear();
    config = await plugins.loadConfig(plugin);
    await plugins.saveConfigFromJson(plugin, config);
    const configFile = path.join(matterbridge.matterbridgeDirectory, `${plugin.name}.config.json`);
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.DEBUG, `Saved config file ${configFile} for plugin ${plg}${plugin.name}${db}`);

    await plugins.shutdown(plugin, 'Test with Jest', true, true);
  }, 60000);

  test('load schema plugin matterbridge-example-accessory-platform', async () => {
    // if (matterbridge.systemInformation.osPlatform === 'darwin') return; // MacOS fails

    expect(plugins.length).toBe(2);
    const plugin = plugins.get('matterbridge-example-accessory-platform');
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;
    const schemaFile = plugin.path.replace('package.json', `${plugin.name}.schema.json`);
    try {
      await fs.writeFile(schemaFile, JSON.stringify(plugins.getDefaultSchema(plugin), null, 2), 'utf8');
    } catch (error) {
      // Ignore error
      // eslint-disable-next-line no-console
      console.error('writeFile:', schemaFile, error);
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
  }, 60000);

  test('load default schema plugin matterbridge-example-accessory-platform', async () => {
    // if (matterbridge.systemInformation.osPlatform === 'darwin') return; // MacOS fails

    expect(plugins.length).toBe(2);
    const plugin = plugins.get('matterbridge-example-accessory-platform');
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;
    const schemaFile = plugin.path.replace('package.json', `${plugin.name}.schema.json`);
    try {
      await fs.unlink(schemaFile);
    } catch (error) {
      // Ignore error
      // eslint-disable-next-line no-console
      console.error('unlink:', schemaFile, error);
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
  }, 60000);

  test('should not load plugin matterbridge-example-accessory-platform if parse error', async () => {
    // if (matterbridge.systemInformation.osPlatform === 'darwin') return; // MacOS fails

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
    parseSpy.mockImplementationOnce(() => {
      throw new Error('Test error');
    });
    const platform = await plugins.load(plugin, false, 'Test with Jest');
    expect(platform).toBeUndefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Failed to load plugin ${plg}${plugin?.name}${er}: Test error`);
    plugin.error = false;
  });

  test('load plugin matterbridge-example-accessory-platform', async () => {
    // if (matterbridge.systemInformation.osPlatform === 'darwin') return; // MacOS fails

    const plugin = plugins.get('matterbridge-example-accessory-platform');
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;

    const platform = await plugins.load(plugin, false, 'Test with Jest');
    expect(platform).toBeDefined();
    if (!platform) return;
    expect(platform.matterbridge).toBeDefined();
    expect(platform.log).toBeDefined();
    expect(platform.config).toBeDefined();
    expect(platform.name).toBe('matterbridge-example-accessory-platform');
    expect(platform.type).toBe('AccessoryPlatform');
    expect(platform.version).toBeDefined();
    expect(platform.version).not.toBe('');

    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Loading plugin ${plg}${plugin.name}${nf} type ${typ}${plugin.type}${nf}`);
    // expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Loaded plugin ${plg}${plugin.name}${nf} type ${typ}${plugin?.type}${db} (entrypoint ${UNDERLINE}${plugin.path}${UNDERLINEOFF})`);
    expect(plugin.type).toBe('AccessoryPlatform');
    expect(plugin.platform).toBeDefined();
    expect(plugin.loaded).toBe(true);
    expect(plugin.registeredDevices).toBe(0);
    expect(plugin.addedDevices).toBe(0);
    expect(plugin.configJson).toBeDefined();
    expect(plugin.schemaJson).toBeDefined();
  });

  test('load, start and configure in parallel plugin matterbridge-example-dynamic-platform', async () => {
    // if (matterbridge.systemInformation.osPlatform === 'darwin') return; // MacOS fails

    const plugin = plugins.get('matterbridge-example-dynamic-platform');
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;

    plugins.load(plugin, true, 'Test with Jest', true);
    expect(plugin.loaded).toBe(undefined);
    expect(plugin.started).toBe(undefined);
    expect(plugin.configured).toBe(undefined);
    await waiter(
      'Plugin to start',
      () => {
        return plugin.configured === true;
      },
      false,
      60000,
      1000,
    );
    expect(plugin.loaded).toBe(true);
    expect(plugin.started).toBe(true);
    expect(plugin.configured).toBe(true);
  }, 60000);

  test('should not start plugin matterbridge-example-accessory-platform if not loaded', async () => {
    // if (matterbridge.systemInformation.osPlatform === 'darwin') return; // MacOS fails

    const plugin = plugins.get('matterbridge-example-accessory-platform');
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;
    expect(plugin.loaded).toBeTruthy();
    expect(plugin.started).toBeFalsy();
    expect(plugin.configured).toBeFalsy();

    plugin.loaded = false;
    const result = await plugins.start(plugin, 'Test with Jest', false);
    expect(result).toBeUndefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Plugin ${plg}${plugin?.name}${er} not loaded`);
    plugin.loaded = true;
  });

  test('should not start plugin matterbridge-example-accessory-platform if no platform', async () => {
    // if (matterbridge.systemInformation.osPlatform === 'darwin') return; // MacOS fails

    const plugin = plugins.get('matterbridge-example-accessory-platform');
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;
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
    // if (matterbridge.systemInformation.osPlatform === 'darwin') return; // MacOS fails

    const plugin = plugins.get('matterbridge-example-accessory-platform');
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;
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
    // if (matterbridge.systemInformation.osPlatform === 'darwin') return; // MacOS fails

    const plugin = plugins.get('matterbridge-example-accessory-platform');
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;
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
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Failed to start plugin ${plg}${plugin.name}${er}: Test error`);
    plugin.error = false;
  });

  test('start plugin matterbridge-example-accessory-platform', async () => {
    // if (matterbridge.systemInformation.osPlatform === 'darwin') return; // MacOS fails

    let plugin = plugins.get('matterbridge-example-accessory-platform');
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;
    expect(plugin.loaded).toBeTruthy();
    expect(plugin.started).toBeFalsy();
    expect(plugin.configured).toBeFalsy();

    plugin = await plugins.start(plugin, 'Test with Jest', false);
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Starting plugin ${plg}${plugin?.name}${nf} type ${typ}${plugin?.type}${nf}`);
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.NOTICE, `Started plugin ${plg}${plugin?.name}${nt} type ${typ}${plugin?.type}${nt}`);
    if (!plugin) return;
    await waiter(
      'Plugin to start',
      () => {
        return plugin.started === true;
      },
      false,
      5000,
      1000,
      true,
    );
    expect(plugin.started).toBe(true);
  }, 60000);

  test('configure plugin matterbridge-example-accessory-platform should log errors', async () => {
    // if (matterbridge.systemInformation.osPlatform === 'darwin') return; // MacOS fails

    const plugin = plugins.get('matterbridge-example-accessory-platform');
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;
    expect(plugin.loaded).toBeTruthy();
    expect(plugin.started).toBeTruthy();
    expect(plugin.configured).toBeFalsy();

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
  }, 60000);

  test('configure plugin matterbridge-example-accessory-platform should log if it throws', async () => {
    // if (matterbridge.systemInformation.osPlatform === 'darwin') return; // MacOS fails

    // loggerLogSpy.mockRestore();
    // consoleLogSpy.mockRestore();

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
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Failed to configure plugin ${plg}${plugin.name}${er}: Error: Test error`);
  }, 60000);

  test('configure plugin matterbridge-example-accessory-platform', async () => {
    // if (matterbridge.systemInformation.osPlatform === 'darwin') return; // MacOS fails

    let plugin = plugins.get('matterbridge-example-accessory-platform');
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;
    expect(plugin.loaded).toBeTruthy();
    expect(plugin.started).toBeTruthy();
    expect(plugin.configured).toBeFalsy();
    plugin = await plugins.configure(plugin);
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Configuring plugin ${plg}${plugin?.name}${nf} type ${typ}${plugin?.type}${nf}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Configured plugin ${plg}${plugin?.name}${nt} type ${typ}${plugin?.type}${nt}`);
    expect(plugin).not.toBeUndefined();
    expect(plugin.configured).toBe(true);
  }, 60000);

  test('should not shutdown plugin matterbridge-example-accessory-platform', async () => {
    // if (matterbridge.systemInformation.osPlatform === 'darwin') return; // MacOS fails

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
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Failed to shut down plugin ${plg}${plugin.name}${er}: Test error`);
  });

  test('shutdown plugin matterbridge-example-accessory-platform', async () => {
    // if (matterbridge.systemInformation.osPlatform === 'darwin') return; // MacOS fails

    let plugin = plugins.get('matterbridge-example-accessory-platform');
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;
    expect(plugin.loaded).toBeTruthy();
    expect(plugin.started).toBeTruthy();
    expect(plugin.configured).toBeTruthy();

    plugin = await plugins.shutdown(plugin, 'Test with Jest', true);
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Shutting down plugin ${plg}${plugin.name}${nf}: Test with Jest...`);
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.NOTICE, `Shutdown of plugin ${plg}${plugin.name}${nt} completed`);
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.DEBUG, `Removing all bridged endpoints for plugin ${plg}${plugin.name}${db}`);
    if (!plugin) return;
    await waiter(
      'Plugin to shutdown',
      () => {
        return plugin.loaded === undefined;
      },
      false,
      5000,
      1000,
      true,
    );
    expect(plugin.locked).toBe(undefined);
    expect(plugin.error).toBe(undefined);
    expect(plugin.loaded).toBe(undefined);
    expect(plugin.started).toBe(undefined);
    expect(plugin.configured).toBe(undefined);
    expect(plugin.platform).toBe(undefined);

    expect(await plugins.saveToStorage()).toBe(2);
  }, 60000);

  test('shutdown plugin matterbridge-example-dynamic-platform', async () => {
    // if (matterbridge.systemInformation.osPlatform === 'darwin') return; // MacOS fails

    let plugin = plugins.get('matterbridge-example-dynamic-platform');
    expect(plugin).not.toBeUndefined();
    expect(plugin?.loaded).toBeTruthy();
    expect(plugin?.started).toBeTruthy();
    expect(plugin?.configured).toBeTruthy();
    if (!plugin) return;

    plugin = await plugins.shutdown(plugin, 'Test with Jest', true);
    expect(plugin).not.toBeUndefined();
  }, 60000);

  test('uninstall not existing plugin matterbridge-xyz', async () => {
    // if (matterbridge.systemInformation.osPlatform === 'darwin') return; // MacOS fails

    expect(await plugins.uninstall('matterbridge-xyz')).toBeDefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Uninstalling plugin ${plg}matterbridge-xyz${nf}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Uninstalled plugin ${plg}matterbridge-xyz${nf}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Uninstalled plugin ${plg}matterbridge-xyz${db}:`));
  }, 300000);

  test('uninstall plugin matterbridge-example-accessory-platform', async () => {
    // if (matterbridge.systemInformation.osPlatform === 'darwin') return; // MacOS fails

    expect(await plugins.uninstall('matterbridge-example-accessory-platform')).toBeDefined();
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Uninstalling plugin ${plg}matterbridge-example-accessory-platform${nf}`);
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Uninstalled plugin ${plg}matterbridge-example-accessory-platform${nf}`);
  }, 300000);

  test('uninstall plugin matterbridge-example-dynamic-platform', async () => {
    // if (matterbridge.systemInformation.osPlatform === 'darwin') return; // MacOS fails

    expect(await plugins.uninstall('matterbridge-example-dynamic-platform')).toBeDefined();
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Uninstalling plugin ${plg}matterbridge-example-dynamic-platform${nf}`);
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Uninstalled plugin ${plg}matterbridge-example-dynamic-platform${nf}`);
  }, 300000);

  test('install not existing plugin matterbridge-xyz with mock', async () => {
    // if (matterbridge.systemInformation.osPlatform === 'darwin') return; // MacOS fails

    jest.unstable_mockModule('node:child_process', () => ({
      exec: jest.fn((cmd, callback: (error: Error | null, stdout: string, stderr: string) => void) => {
        callback(new Error('Test error'), '', '');
      }),
    }));
    expect(await plugins.install('matterbridge-xyz')).toBeUndefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Failed to install plugin ${plg}matterbridge-xyz${er}:`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Failed to install plugin ${plg}matterbridge-xyz${db}:`));
    jest.unstable_mockModule('node:child_process', () => jest.requireActual('node:child_process'));
  }, 300000);

  test('uninstall not existing plugin matterbridge-xyz with mock', async () => {
    // if (matterbridge.systemInformation.osPlatform === 'darwin') return; // MacOS fails

    jest.unstable_mockModule('node:child_process', () => ({
      exec: jest.fn((cmd, callback: (error: Error | null, stdout: string, stderr: string) => void) => {
        callback(new Error('Test error'), '', '');
      }),
    }));
    expect(await plugins.uninstall('matterbridge-xyz')).toBeUndefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Failed to uninstall plugin ${plg}matterbridge-xyz${er}:`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Failed to uninstall plugin ${plg}matterbridge-xyz${db}:`));
    jest.unstable_mockModule('node:child_process', () => jest.requireActual('node:child_process'));
  }, 300000);

  test('Matterbridge.destroyInstance()', async () => {
    // Close the Matterbridge instance
    await matterbridge.destroyInstance();

    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.NOTICE, `Cleanup completed. Shutting down...`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }, 60000);

  test('Cleanup storage', async () => {
    process.argv.push('-factoryreset');
    (matterbridge as any).initialized = true;
    await (matterbridge as any).parseCommandLine();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Factory reset done! Remove all paired fabrics from the controllers.');
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }, 60000);
});
