/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

process.argv = ['node', 'matterbridge.test.js', '-debug', '-frontend', '0', '-profile', 'Jest'];

import { jest } from '@jest/globals';

jest.mock('@project-chip/matter-node.js/util');

import { AnsiLogger, db, er, LogLevel, nf, pl, UNDERLINE, UNDERLINEOFF } from 'node-ansi-logger';
import { Matterbridge } from './matterbridge.js';
import { RegisteredPlugin } from './matterbridgeTypes.js';
import { Plugins } from './plugins.js';
import { exec, execSync } from 'child_process';
import { getMacAddress, waiter } from './utils/utils.js';
import path from 'path';
import { promises as fs } from 'fs';

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
    plugins = (matterbridge as any).plugins;
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

  test('async forEach allows for iteration over plugins', () => {
    let count = 0;
    plugins.forEach(async (plugin: RegisteredPlugin) => {
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
  }, 60000);

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
    plugins = (matterbridge as any).plugins;
  }, 60000);

  beforeEach(() => {
    loggerLogSpy.mockClear();
    consoleLogSpy.mockClear();
  });

  afterAll(async () => {
    await matterbridge.destroyInstance();
    // Restore the mocked AnsiLogger.log method
    loggerLogSpy.mockRestore();
    // Restore the mocked console.log
    consoleLogSpy.mockRestore();
  }, 60000);

  test('constructor initializes correctly', () => {
    expect(plugins).toBeInstanceOf(Plugins);
  });

  test('clear and load from storage', async () => {
    plugins.clear();
    expect(await plugins.saveToStorage()).toBe(0);
    expect(await plugins.loadFromStorage()).toHaveLength(0);
  });

  test('install plugin matterbridge-xyz', async () => {
    // loggerLogSpy.mockRestore();
    // consoleLogSpy.mockRestore();

    expect(await plugins.install('matterbridge-xyz')).toBeUndefined();
  }, 300000);

  test('install plugin matterbridge-eve-door', async () => {
    // loggerLogSpy.mockRestore();
    // consoleLogSpy.mockRestore();

    const version = await plugins.install('matterbridge-eve-door');
    expect(version).not.toBeUndefined();

    // console.error(`Plugin installed: ${version}`);
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Installing plugin ${plg}matterbridge-eve-door${nf}`);
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Installed plugin ${plg}matterbridge-eve-door${nf}`);
  }, 300000);

  test('install plugin matterbridge-eve-motion', async () => {
    // loggerLogSpy.mockRestore();
    // consoleLogSpy.mockRestore();

    const version = await plugins.install('matterbridge-eve-motion');
    expect(version).not.toBeUndefined();

    // console.error(`Plugin installed: ${version}`);
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Installing plugin ${plg}matterbridge-eve-motion${nf}`);
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Installed plugin ${plg}matterbridge-eve-motion${nf}`);
  }, 300000);

  test('add plugin matterbridge-xyz', async () => {
    // loggerLogSpy.mockRestore();
    // consoleLogSpy.mockRestore();

    expect(plugins.length).toBe(0);
    const plugin = await plugins.add('matterbridge-xyz');
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.ERROR, `Failed to add plugin ${plg}matterbridge-xyz${er}: package.json not found`);
    expect(plugin).toBeNull();
    expect(plugins.length).toBe(0);
  }, 60000);

  test('add plugin matterbridge-eve-door', async () => {
    // loggerLogSpy.mockRestore();
    // consoleLogSpy.mockRestore();

    expect(plugins.length).toBe(0);
    const plugin = await plugins.add('matterbridge-eve-door');
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Added plugin ${plg}matterbridge-eve-door${nf}`);
    expect(plugin).not.toBeNull();
    expect(plugins.length).toBe(1);
  }, 60000);

  test('add plugin matterbridge-eve-motion', async () => {
    // loggerLogSpy.mockRestore();
    // consoleLogSpy.mockRestore();

    expect(plugins.length).toBe(1);
    const plugin = await plugins.add('matterbridge-eve-motion');
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Added plugin ${plg}matterbridge-eve-motion${nf}`);
    expect(plugin).not.toBeNull();
    expect(plugins.length).toBe(2);
  }, 60000);

  test('load config plugin matterbridge-eve-door', async () => {
    // loggerLogSpy.mockRestore();
    // consoleLogSpy.mockRestore();

    expect(plugins.length).toBe(2);
    const plugin = plugins.get('matterbridge-eve-door');
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;
    const configFile = path.join(matterbridge.matterbridgeDirectory, `${plugin.name}.config.json`);
    try {
      await fs.unlink(configFile);
    } catch (error) {
      // Ignore error
    }
    let config = await plugins.loadConfig(plugin);
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.DEBUG, `Created config file ${configFile} for plugin ${plg}${plugin.name}${db}.`);

    config = await plugins.loadConfig(plugin);
    // if (getMacAddress() === '30:f6:ef:69:2b:c5') {

    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.DEBUG, `Loaded config file ${configFile} for plugin ${plg}${plugin.name}${db}.`);
    // }
    expect(config).not.toBeUndefined();
    expect(config).not.toBeNull();
    expect(config.name).toBe(plugin.name);
    expect(config.type).toBe(plugin.type);
    expect(config.debug).toBeDefined();
    expect(config.unregisterOnShutdown).toBeDefined();
  }, 60000);

  test('save config from plugin matterbridge-eve-door', async () => {
    // loggerLogSpy.mockRestore();
    // consoleLogSpy.mockRestore();

    expect(plugins.length).toBe(2);
    const plugin = plugins.get('matterbridge-eve-door');
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;
    await plugins.load(plugin);
    await plugins.saveConfigFromPlugin(plugin);
    const configFile = path.join(matterbridge.matterbridgeDirectory, `${plugin.name}.config.json`);
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.DEBUG, `Saved config file ${configFile} for plugin ${plg}${plugin.name}${db}`);
    await plugins.shutdown(plugin, 'Test with Jest', true, true);
  }, 60000);

  test('save config from json matterbridge-eve-door', async () => {
    // loggerLogSpy.mockRestore();
    // consoleLogSpy.mockRestore();

    expect(plugins.length).toBe(2);
    const plugin = plugins.get('matterbridge-eve-door');
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;
    await plugins.load(plugin);
    const config = await plugins.loadConfig(plugin);
    await plugins.saveConfigFromJson(plugin, config);
    const configFile = path.join(matterbridge.matterbridgeDirectory, `${plugin.name}.config.json`);
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.DEBUG, `Saved config file ${configFile} for plugin ${plg}${plugin.name}${db}`);
    await plugins.shutdown(plugin, 'Test with Jest', true, true);
  }, 60000);

  test('load schema plugin matterbridge-eve-door', async () => {
    // loggerLogSpy.mockRestore();
    // consoleLogSpy.mockRestore();

    expect(plugins.length).toBe(2);
    const plugin = plugins.get('matterbridge-eve-door');
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

  test('load default schema plugin matterbridge-eve-door', async () => {
    // loggerLogSpy.mockRestore();
    // consoleLogSpy.mockRestore();

    expect(plugins.length).toBe(2);
    const plugin = plugins.get('matterbridge-eve-door');
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
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.DEBUG, `Schema file ${schemaFile} for plugin ${plg}${plugin.name}${db} not found. Loading default schema.`);
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

  test('load plugin matterbridge-eve-door', async () => {
    // loggerLogSpy.mockRestore();
    // consoleLogSpy.mockRestore();

    const plugin = plugins.get('matterbridge-eve-door');
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;

    const platform = await plugins.load(plugin, false, 'Test with Jest');
    expect(platform).toBeDefined();
    if (!platform) return;
    expect(platform.matterbridge).toBeDefined();
    expect(platform.log).toBeDefined();
    expect(platform.config).toBeDefined();
    expect(platform.name).toBe('matterbridge-eve-door');
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

  test('load, start and configure in parallel plugin matterbridge-eve-motion', async () => {
    // loggerLogSpy.mockRestore();
    // consoleLogSpy.mockRestore();

    const plugin = plugins.get('matterbridge-eve-motion');
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;

    plugins.load(plugin, true, 'Test with Jest', true); // No await do it in parallel
    expect(plugin.loaded).toBe(undefined);
    expect(plugin.started).toBe(undefined);
    expect(plugin.configured).toBe(undefined);
  });

  test('wait for plugin matterbridge-eve-motion to load and start', async () => {
    // loggerLogSpy.mockRestore();
    // consoleLogSpy.mockRestore();

    const plugin = plugins.get('matterbridge-eve-motion');
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;
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

  test('start plugin matterbridge-eve-door', async () => {
    // loggerLogSpy.mockRestore();
    // consoleLogSpy.mockRestore();

    let plugin = plugins.get('matterbridge-eve-door');
    expect(plugin).not.toBeUndefined();
    expect(plugin?.loaded).toBeTruthy();
    expect(plugin?.started).toBeFalsy();
    expect(plugin?.configured).toBeFalsy();
    if (!plugin) return;

    plugin = await plugins.start(plugin, 'Test with Jest', false);
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Starting plugin ${plg}${plugin?.name}${db} type ${typ}${plugin?.type}${db}`);
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Started plugin ${plg}${plugin?.name}${db} type ${typ}${plugin?.type}${db}`);
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

  test('configure plugin matterbridge-eve-door', async () => {
    // loggerLogSpy.mockRestore();
    // consoleLogSpy.mockRestore();

    let plugin = plugins.get('matterbridge-eve-door');
    expect(plugin).not.toBeUndefined();
    expect(plugin?.loaded).toBeTruthy();
    expect(plugin?.started).toBeTruthy();
    expect(plugin?.configured).toBeFalsy();
    if (!plugin) return;
    plugin = await plugins.configure(plugin);
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Configuring plugin ${plg}${plugin?.name}${nf} type ${typ}${plugin?.type}${nf}`);
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Configured plugin ${plg}${plugin?.name}${nf} type ${typ}${plugin?.type}${nf}`);
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;
    /*
    await waiter(
      'Plugin to configure',
      () => {
        return plugin.configured === true;
      },
      false,
      5000,
      1000,
      true,
    );
    */
    expect(plugin.configured).toBe(true);
  }, 60000);

  test('shutdown plugin matterbridge-eve-door', async () => {
    // loggerLogSpy.mockRestore();
    // consoleLogSpy.mockRestore();

    let plugin = plugins.get('matterbridge-eve-door');
    expect(plugin).not.toBeUndefined();
    expect(plugin?.loaded).toBeTruthy();
    expect(plugin?.started).toBeTruthy();
    expect(plugin?.configured).toBeTruthy();
    if (!plugin) return;

    plugin = await plugins.shutdown(plugin, 'Test with Jest', true);
    expect(plugin).not.toBeUndefined();
    if (!plugin) return;
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Shutting down plugin ${plg}${plugin.name}${nf}: Test with Jest...`);
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Shutdown of plugin ${plg}${plugin.name}${nf} completed`);
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.DEBUG, `Removing all bridged devices for plugin ${plg}${plugin.name}${db}`);
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

  test('shutdown plugin matterbridge-eve-motion', async () => {
    // loggerLogSpy.mockRestore();
    // consoleLogSpy.mockRestore();

    let plugin = plugins.get('matterbridge-eve-motion');
    expect(plugin).not.toBeUndefined();
    expect(plugin?.loaded).toBeTruthy();
    expect(plugin?.started).toBeTruthy();
    expect(plugin?.configured).toBeTruthy();
    if (!plugin) return;

    plugin = await plugins.shutdown(plugin, 'Test with Jest', true);
    expect(plugin).not.toBeUndefined();
  }, 60000);

  test('uninstall not existing plugin matterbridge-xyz', async () => {
    // loggerLogSpy.mockRestore();
    // consoleLogSpy.mockRestore();

    expect(await plugins.uninstall('matterbridge-xyz')).toBeDefined();
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Uninstalling plugin ${plg}matterbridge-xyz${nf}`);
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Uninstalled plugin ${plg}matterbridge-xyz${nf}`);
  }, 300000);

  test('uninstall plugin matterbridge-eve-door', async () => {
    // loggerLogSpy.mockRestore();
    // consoleLogSpy.mockRestore();
    if (matterbridge.systemInformation.osPlatform === 'darwin') return; // MacOS fails

    expect(await plugins.uninstall('matterbridge-eve-door')).toBeDefined();
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Uninstalling plugin ${plg}matterbridge-eve-door${nf}`);
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Uninstalled plugin ${plg}matterbridge-eve-door${nf}`);
  }, 300000);

  test('uninstall plugin matterbridge-eve-motion', async () => {
    // loggerLogSpy.mockRestore();
    // consoleLogSpy.mockRestore();

    expect(await plugins.uninstall('matterbridge-eve-motion')).toBeDefined();
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Uninstalling plugin ${plg}matterbridge-eve-motion${nf}`);
    expect((plugins as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Uninstalled plugin ${plg}matterbridge-eve-motion${nf}`);
  }, 300000);

  test('cleanup Jest profile', async () => {
    plugins.clear();
    expect(await plugins.saveToStorage()).toBe(0);
    (matterbridge as any).registeredDevices = [];
    if (getMacAddress() === '30:f6:ef:69:2b:c5') {
      execSync('npm uninstall -g matterbridge-eve-door');
    }
  }, 60000);
});
