// src\matterbridgePlatform.initialized.test.ts

const NAME = 'MatterbridgePlatformInitialized';
const MATTER_PORT = 7100;
const FRONTEND_PORT = 8501;

process.argv = [...originalProcessArgv, '--verbose', '--loader'];

import { jest } from '@jest/globals';

import { PlatformSchema } from './matterbridgePlatform.js';
import { MatterbridgeAccessoryPlatform } from './matterbridgeAccessoryPlatform.js';
import { MatterbridgeDynamicPlatform } from './matterbridgeDynamicPlatform.js';
import { flushAsync, matterbridge, originalProcessArgv, plugins, setupTest, setDebug, startMatterbridge, stopMatterbridge } from './jestutils/jestHelpers.js';
import { Frontend } from './frontend.js';

const wssSendRestartRequired = jest.spyOn(Frontend.prototype, 'wssSendRestartRequired');

const wssSendSnackbarMessage = jest.spyOn(Frontend.prototype, 'wssSendSnackbarMessage');

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge platform', () => {
  let accessoryPlatform: MatterbridgeAccessoryPlatform;
  let dynamicPlatform: MatterbridgeDynamicPlatform;

  beforeAll(async () => {
    // Create an initialized Matterbridge environment
    await startMatterbridge(`bridge`, FRONTEND_PORT, MATTER_PORT);
  });

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Destroy the initialized Matterbridge environment
    await stopMatterbridge();
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('Add accessory plugin matterbridge-accessory-test', async () => {
    expect(plugins.length).toBe(0);
    expect(await plugins.add('./src/mock/pluginmbatest')).not.toBeNull();
    expect(plugins.length).toBe(1);
    expect(plugins.get('matterbridge-accessory-test')?.type).toBe('AnyPlatform');
    accessoryPlatform = (await plugins.load('matterbridge-accessory-test')) as MatterbridgeAccessoryPlatform;
    expect(accessoryPlatform).not.toBeUndefined();
    expect(accessoryPlatform.name).toBe('matterbridge-accessory-test');
    expect(accessoryPlatform.type).toBe('AccessoryPlatform');
    expect(plugins.get('matterbridge-accessory-test')?.name).toBe('matterbridge-accessory-test');
    expect(plugins.get('matterbridge-accessory-test')?.type).toBe('AccessoryPlatform');
  }, 10000);

  test('Add dynamic plugin matterbridge-dynamic-test', async () => {
    expect(plugins.length).toBe(1);
    expect(await plugins.add('./src/mock/pluginmbdtest')).not.toBeNull();
    expect(plugins.length).toBe(2);
    expect(plugins.get('matterbridge-dynamic-test')?.type).toBe('AnyPlatform');
    dynamicPlatform = (await plugins.load('matterbridge-dynamic-test')) as MatterbridgeDynamicPlatform;
    expect(dynamicPlatform).not.toBeUndefined();
    expect(dynamicPlatform.name).toBe('matterbridge-dynamic-test');
    expect(dynamicPlatform.type).toBe('DynamicPlatform');
    expect(plugins.get('matterbridge-dynamic-test')?.name).toBe('matterbridge-dynamic-test');
    expect(plugins.get('matterbridge-dynamic-test')?.type).toBe('DynamicPlatform');
  }, 10000);

  test('Constructor accessory', async () => {
    expect(accessoryPlatform.log.logName).toBe('Matterbridge accessory test plugin');
    expect(accessoryPlatform.config).toEqual({ name: 'matterbridge-accessory-test', type: 'AccessoryPlatform', version: '1.0.0', debug: false, unregisterOnShutdown: false });
    await accessoryPlatform.ready;
    expect(accessoryPlatform.isReady).toBe(true);
    expect(accessoryPlatform.isLoaded).toBe(true);
    expect(accessoryPlatform.isStarted).toBe(false);
    expect(accessoryPlatform.isConfigured).toBe(false);
  });

  test('Constructor dynamic', async () => {
    expect(dynamicPlatform.log.logName).toBe('Matterbridge dynamic test plugin');
    expect(dynamicPlatform.config).toEqual({ name: 'matterbridge-dynamic-test', type: 'DynamicPlatform', version: '1.0.0', debug: false, unregisterOnShutdown: false });
    await dynamicPlatform.ready;
    expect(dynamicPlatform.isReady).toBe(true);
    expect(dynamicPlatform.isLoaded).toBe(true);
    expect(dynamicPlatform.isStarted).toBe(false);
    expect(dynamicPlatform.isConfigured).toBe(false);
  });

  test('Save config for accessory platform', async () => {
    expect(accessoryPlatform.saveConfig({ ...accessoryPlatform.config, debug: true })).toBeUndefined();
    await flushAsync();
    expect(accessoryPlatform.config).toEqual({ name: 'matterbridge-accessory-test', type: 'AccessoryPlatform', version: '1.0.0', debug: true, unregisterOnShutdown: false });
  });

  test('Save config for dynamic platform', async () => {
    expect(dynamicPlatform.saveConfig({ ...dynamicPlatform.config, debug: true })).toBeUndefined();
    await flushAsync();
    expect(dynamicPlatform.config).toEqual({ name: 'matterbridge-dynamic-test', type: 'DynamicPlatform', version: '1.0.0', debug: true, unregisterOnShutdown: false });
  });

  test('Get schema for accessory platform', async () => {
    const schema = await accessoryPlatform.getSchema();
    expect(schema).toEqual(defSchemaAccessory);
    await flushAsync();
  });

  test('Get schema for dynamic platform', async () => {
    const schema = await dynamicPlatform.getSchema();
    expect(schema).toEqual(defSchemaDynamic);
    await flushAsync();
  });

  test('Set schema for accessory platform', async () => {
    const schema = (await accessoryPlatform.getSchema()) as any;
    expect(schema).toEqual(defSchemaAccessory);
    schema.properties.debug.default = true;
    accessoryPlatform.setSchema(schema as PlatformSchema);
    expect(schema).toEqual({ ...defSchemaAccessory, properties: { ...defSchemaAccessory.properties, debug: { ...defSchemaAccessory.properties.debug, default: true } } });
    await flushAsync();
  });

  test('Set schema for dynamic platform', async () => {
    const schema = (await dynamicPlatform.getSchema()) as any;
    expect(schema).toEqual(defSchemaDynamic);
    schema.properties.debug.default = true;
    dynamicPlatform.setSchema(schema as PlatformSchema);
    expect(schema).toEqual({ ...defSchemaDynamic, properties: { ...defSchemaDynamic.properties, debug: { ...defSchemaDynamic.properties.debug, default: true } } });
    await flushAsync();
  });

  test('Broadcast wssSendRestartRequired', async () => {
    accessoryPlatform.wssSendRestartRequired(true, true);
    await flushAsync(undefined, undefined, 100);
    expect(wssSendRestartRequired).toHaveBeenCalledWith(true, true); // All wssSend calls are skipped if no clients are connected
  });

  test('Broadcast wssSendSnackbarMessage', async () => {
    accessoryPlatform.wssSendSnackbarMessage('Test message', 5, 'success');
    await flushAsync(undefined, undefined, 100);
    expect(wssSendSnackbarMessage).toHaveBeenCalledWith('Test message', 5, 'success'); // All wssSend calls are skipped if no clients are connected
  });

  test('Platform status properties should be false after shutdown for accessory platform', async () => {
    await accessoryPlatform.onShutdown();
    const plugin = await plugins.shutdown('matterbridge-accessory-test', 'Jest closing', false, true);
    expect(plugin).toBeDefined();
    expect(accessoryPlatform.isReady).toBe(false);
    expect(accessoryPlatform.isLoaded).toBe(false);
    expect(accessoryPlatform.isStarted).toBe(false);
    expect(accessoryPlatform.isConfigured).toBe(false);
  });

  test('Platform status properties should be false after shutdown for dynamic platform', async () => {
    await dynamicPlatform.onShutdown();
    const plugin = await plugins.shutdown('matterbridge-dynamic-test', 'Jest closing', false, true);
    expect(plugin).toBeDefined();
    expect(dynamicPlatform.isReady).toBe(false);
    expect(dynamicPlatform.isLoaded).toBe(false);
    expect(dynamicPlatform.isStarted).toBe(false);
    expect(dynamicPlatform.isConfigured).toBe(false);
  });
});

const defSchemaAccessory = {
  'description': 'matterbridge-accessory-test v. 1.0.0 by LuLigu',
  'properties': {
    'name': {
      'description': 'Plugin name',
      'readOnly': true,
      'type': 'string',
    },
    'type': {
      'description': 'Plugin type',
      'readOnly': true,
      'type': 'string',
    },
    'debug': {
      'default': false,
      'description': 'Enable the debug for the plugin (development only)',
      'type': 'boolean',
    },
    'unregisterOnShutdown': {
      'default': false,
      'description': 'Unregister all devices on shutdown (development only)',
      'type': 'boolean',
    },
  },
  'title': 'Matterbridge accessory test plugin',
  'type': 'object',
};

const defSchemaDynamic = {
  'description': 'matterbridge-dynamic-test v. 1.0.0 by LuLigu',
  'properties': {
    'name': {
      'description': 'Plugin name',
      'readOnly': true,
      'type': 'string',
    },
    'type': {
      'description': 'Plugin type',
      'readOnly': true,
      'type': 'string',
    },
    'debug': {
      'default': false,
      'description': 'Enable the debug for the plugin (development only)',
      'type': 'boolean',
    },
    'unregisterOnShutdown': {
      'default': false,
      'description': 'Unregister all devices on shutdown (development only)',
      'type': 'boolean',
    },
  },
  'title': 'Matterbridge dynamic test plugin',
  'type': 'object',
};
