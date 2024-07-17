/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

process.argv = ['node', 'matterbridge.test.js', '-debug', '-frontend', '0', '-profile', 'Jest'];

import { jest } from '@jest/globals';

jest.mock('@project-chip/matter-node.js/util');

import { AnsiLogger, db, LogLevel, nf, pl } from 'node-ansi-logger';
import { Matterbridge } from './matterbridge.js';
import { RegisteredPlugin } from './matterbridgeTypes.js';
import { Plugins } from './plugins.js';
import { exec, execSync } from 'child_process';
import e from 'express';
import exp from 'constants';

// Default colors
const plg = '\u001B[38;5;33m';
const dev = '\u001B[38;5;79m';
const typ = '\u001B[38;5;207m';

describe('PluginsManager', () => {
  let matterbridge: Matterbridge;
  let plugins: Plugins;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let loggerLogSpy: jest.SpiedFunction<(level: LogLevel, message: string, ...parameters: any[]) => void>;

  beforeAll(async () => {
    // Spy on and mock the AnsiLogger.log method
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {
      // console.log(`Mocked log: ${level} - ${message}`, ...parameters);
    });
    // Spy on and mock console.log
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {
      // Mock implementation or empty function
    });
    matterbridge = await Matterbridge.loadInstance(true);
    plugins = new Plugins(matterbridge);
  });

  afterAll(async () => {
    await matterbridge.destroyInstance();
    // Restore the mocked AnsiLogger.log method
    loggerLogSpy.mockRestore();
    // Restore the mocked console.log
    consoleLogSpy.mockRestore();
  });

  test('constructor initializes correctly', () => {
    expect(plugins).toBeInstanceOf(Plugins);
  });

  test('clear and load from storage', async () => {
    plugins.clear();
    expect(await plugins.saveToStorage()).toBe(0);
    expect(await plugins.loadFromStorage()).toHaveLength(0);
  });

  test('size returns correct number of plugins', () => {
    expect(plugins.size).toBe(0);
    expect(plugins.length).toBe(0);
    (plugins as any)._plugins.set('matterbridge-mock1', { name: 'matterbridge-mock1', path: './src/mock/plugin1/package.json', type: 'Unknown', version: '1.0.0', description: 'To update', author: 'To update' });
    (plugins as any)._plugins.set('matterbridge-mock2', { name: 'matterbridge-mock2', path: './src/mock/plugin2/package.json', type: 'Unknown', version: '1.0.0', description: 'To update', author: 'To update' });
    (plugins as any)._plugins.set('matterbridge-mock3', { name: 'matterbridge-mock3', path: './src/mock/plugin3/package.json', type: 'Unknown', version: '1.0.0', description: 'To update', author: 'To update' });
    expect(plugins.size).toBe(3);
    expect(plugins.length).toBe(3);
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

  test('resolve plugin', async () => {
    // loggerLogSpy.mockRestore();
    // consoleLogSpy.mockRestore();

    expect(await plugins.resolve('')).not.toBeNull(); // Should return the package.json file of the matterbridge
    expect(await plugins.resolve('xyz')).toBeNull();
    expect(await plugins.resolve('./src/mock/plugin1')).not.toBeNull();
    expect(await plugins.resolve('./src/mock/plugin2')).not.toBeNull();
    expect(await plugins.resolve('./src/mock/plugin3')).not.toBeNull();
  });

  test('parse plugin', async () => {
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
    // loggerLogSpy.mockRestore();
    // consoleLogSpy.mockRestore();

    expect(await plugins.enable('')).toBeNull();
    expect(await plugins.enable('xyz')).toBeNull();

    expect(await plugins.enable('./src/mock/plugin1')).not.toBeNull();
    expect((await plugins.enable('./src/mock/plugin1'))?.enabled).toBeTruthy();

    expect(await plugins.enable('./src/mock/plugin2')).not.toBeNull();
    expect((await plugins.enable('./src/mock/plugin2'))?.enabled).toBeTruthy();

    expect(await plugins.enable('./src/mock/plugin3')).not.toBeNull();
    expect((await plugins.enable('./src/mock/plugin3'))?.enabled).toBeTruthy();
  });

  test('disable plugin', async () => {
    // loggerLogSpy.mockRestore();
    // consoleLogSpy.mockRestore();

    expect(await plugins.disable('')).toBeNull();
    expect(await plugins.disable('xyz')).toBeNull();

    expect(await plugins.disable('./src/mock/plugin1')).not.toBeNull();
    expect((await plugins.disable('./src/mock/plugin1'))?.enabled).toBeFalsy();

    expect(await plugins.disable('./src/mock/plugin2')).not.toBeNull();
    expect((await plugins.disable('./src/mock/plugin2'))?.enabled).toBeFalsy();

    expect(await plugins.disable('./src/mock/plugin3')).not.toBeNull();
    expect((await plugins.disable('./src/mock/plugin3'))?.enabled).toBeFalsy();
  });

  test('remove plugin', async () => {
    // loggerLogSpy.mockRestore();
    // consoleLogSpy.mockRestore();

    expect(await plugins.remove('')).toBeNull();
    expect(await plugins.remove('xyz')).toBeNull();

    expect(plugins.length).toBe(3);

    expect(await plugins.remove('./src/mock/plugin1')).not.toBeNull();
    expect(plugins.length).toBe(2);

    expect(await plugins.remove('./src/mock/plugin2')).not.toBeNull();
    expect(plugins.length).toBe(1);

    expect(await plugins.remove('./src/mock/plugin3')).not.toBeNull();
    expect(plugins.length).toBe(0);
  });

  test('add plugin', async () => {
    // loggerLogSpy.mockRestore();
    // consoleLogSpy.mockRestore();

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
  });

  test('remove plugin with name', async () => {
    // loggerLogSpy.mockRestore();
    // consoleLogSpy.mockRestore();
    (matterbridge as any).registeredPlugins = Array.from((plugins as any)._plugins.values());

    expect(plugins.length).toBe(3);

    expect(await plugins.remove('matterbridge-mock1')).not.toBeNull();
    expect(plugins.length).toBe(2);

    expect(await plugins.remove('matterbridge-mock2')).not.toBeNull();
    expect(plugins.length).toBe(1);

    expect(await plugins.remove('matterbridge-mock3')).not.toBeNull();
    expect(plugins.length).toBe(0);
  });

  test('add plugin with name', async () => {
    // loggerLogSpy.mockRestore();
    // consoleLogSpy.mockRestore();

    execSync('npm install -g matterbridge-eve-door');
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
  });

  test('save to storage', async () => {
    (plugins as any)._plugins.set('matterbridge-mock1', { name: 'matterbridge-mock1', path: './src/mock/plugin1/package.json', type: 'Unknown', version: '1.0.0', description: 'To update', author: 'To update' });
    (plugins as any)._plugins.set('matterbridge-mock2', { name: 'matterbridge-mock2', path: './src/mock/plugin2/package.json', type: 'Unknown', version: '1.0.0', description: 'To update', author: 'To update' });
    (plugins as any)._plugins.set('matterbridge-mock3', { name: 'matterbridge-mock3', path: './src/mock/plugin3/package.json', type: 'Unknown', version: '1.0.0', description: 'To update', author: 'To update' });
    expect(await plugins.saveToStorage()).toBe(3);
    plugins.clear();
    expect(await plugins.saveToStorage()).toBe(0);
  });
});

describe('PluginsManager load/start/configure/shutdown', () => {
  let matterbridge: Matterbridge;
  let plugins: Plugins;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let loggerLogSpy: jest.SpiedFunction<(level: LogLevel, message: string, ...parameters: any[]) => void>;

  beforeAll(async () => {
    // Spy on and mock the AnsiLogger.log method
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {
      // console.log(`Mocked log: ${level} - ${message}`, ...parameters);
    });
    // Spy on and mock console.log
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {
      // Mock implementation or empty function
    });
    matterbridge = await Matterbridge.loadInstance(true);
    plugins = new Plugins(matterbridge);
  });

  afterAll(async () => {
    await matterbridge.destroyInstance();
    // Restore the mocked AnsiLogger.log method
    loggerLogSpy.mockRestore();
    // Restore the mocked console.log
    consoleLogSpy.mockRestore();
  });

  test('constructor initializes correctly', () => {
    expect(plugins).toBeInstanceOf(Plugins);
  });

  test('clear and load from storage', async () => {
    plugins.clear();
    expect(await plugins.saveToStorage()).toBe(0);
    expect(await plugins.loadFromStorage()).toHaveLength(0);
  });

  test('add plugin with name', async () => {
    loggerLogSpy.mockClear();
    consoleLogSpy.mockClear();
    // loggerLogSpy.mockRestore();
    // consoleLogSpy.mockRestore();

    execSync('npm install -g matterbridge-eve-door');
    expect(plugins.length).toBe(0);
    const plugin = await plugins.add('matterbridge-eve-door');
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Added plugin ${plg}matterbridge-eve-door${nf}`);
    expect(plugin).not.toBeNull();
    if (!plugin) return;
    expect(await plugins.load(plugin, false, 'Test with Jest')).toBeDefined();
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Added plugin ${plg}matterbridge-eve-door${nf}`);
  });
});
