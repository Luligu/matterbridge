/**
 * @file packages/core/vitest/helpers.test.ts
 * @description This file contains the tests for helpers.
 * @author Luca Liguori
 */

/* oxlint-disable no-console */

const NAME = 'Helpers';
const MATTER_PORT = 6600;
const MATTER_CREATE_ONLY = true;

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import url from 'node:url';

import type { Endpoint } from '@matter/node';
import { BindingServer, BridgedDeviceBasicInformationServer, DescriptorServer, OnOffServer } from '@matter/node/behaviors';
import { Identify } from '@matter/types/clusters/identify';
import { OnOff } from '@matter/types/clusters/on-off';
import { consoleLogSpy, log, setDebug, setupTest } from '@matterbridge/vitest-utils';
import {
  aggregator,
  createServerNode,
  createTestEnvironment,
  destroyTestEnvironment,
  flushServerNode,
  getMatterbridge,
  startServerNode,
  stopServerNode,
} from '@matterbridge/vitest-utils/matter';

import { addVirtualDevice, addVirtualDevices, resolveRootDirectory } from '../src/helpers.js';
import type { Matterbridge } from '../src/matterbridge.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  let matterbridge: Matterbridge;
  let device: Endpoint;

  beforeAll(async () => {
    // Setup the Matter test environment
    await createTestEnvironment();

    // Create the server node and aggregator
    await createServerNode(MATTER_PORT);

    // Start the server node if not in create-only mode
    if (!MATTER_CREATE_ONLY) await startServerNode();

    matterbridge = { ...getMatterbridge(), log: log } as Matterbridge;
  }, 30000);

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clear debug mode after each test
    await setDebug(false);
  });

  afterAll(async () => {
    // Stop or flush the server node depending on the create-only mode
    if (MATTER_CREATE_ONLY) await flushServerNode();
    else await stopServerNode();

    // Destroy the Matter test environment
    await destroyTestEnvironment();

    // Restore all mocks
    vi.restoreAllMocks();
  }, 30000);

  test('add a light virtual device', async () => {
    expect(aggregator).toBeDefined();
    device = await addVirtualDevice(aggregator, 'Test Device', 'light', async () => {
      // Callback function when the device is turned on
      console.log('Device turned on');
    });
    expect(device).toBeDefined();
    expect(device.lifecycle.isReady).toBeTruthy();
    expect(device.id).toBe('TestDevice:light');
    expect(device.stateOf(BridgedDeviceBasicInformationServer).nodeLabel).toBe('Test Device');
    expect(device.stateOf(OnOffServer).onOff).toBe(false);
    expect(aggregator.parts.has('TestDevice:light')).toBeTruthy();
    expect(aggregator.parts.size).toBe(1);
  });

  test('send command to the virtual device', async () => {
    expect(device).toBeDefined();
    expect(device.lifecycle.isReady).toBeTruthy();
    expect(device.stateOf(OnOffServer).onOff).toBe(false);

    await new Promise<void>((resolve) => {
      // oxlint-disable-next-line typescript/explicit-function-return-type
      const listener = (value: boolean) => {
        if (value) {
          (device as any).events.onOff.onOff$Changed.off(listener);
          resolve();
        }
      };
      (device as any).events.onOff.onOff$Changed.on(listener);
      void device.setStateOf(OnOffServer, { onOff: true });
    });
    // expect(await invokeBehaviorCommand(device as unknown as MatterbridgeEndpoint, OnOffServer, 'on')).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(consoleLogSpy).toHaveBeenCalledWith('Device turned on');
    expect(device.stateOf(OnOffServer).onOff).toBe(false);
  });

  test('should not add the virtual devices', async () => {
    matterbridge.virtualMode = 'disabled';
    expect(aggregator).toBeDefined();
    await addVirtualDevices(matterbridge, aggregator);
    expect(aggregator.parts.size).toBe(1);
  });

  test('add all the light virtual devices', async () => {
    matterbridge.virtualMode = 'light';
    matterbridge.bridgeMode = 'bridge';
    expect(matterbridge.log).toBeDefined();
    expect(aggregator).toBeDefined();
    await addVirtualDevices(matterbridge, aggregator);
    expect(aggregator.parts.has('TestDevice:light')).toBeTruthy();
    expect(aggregator.parts.has('UpdateMatterbridge:light')).toBeTruthy();
    expect(aggregator.parts.has('RestartMatterbridge:light')).toBeTruthy();
    expect(aggregator.parts.has('RebootMatterbridge:light')).toBeFalsy();
    expect(aggregator.parts.size).toBe(3);
  });

  test('add all the outlet virtual devices', async () => {
    matterbridge.virtualMode = 'outlet';
    expect(matterbridge.log).toBeDefined();
    expect(aggregator).toBeDefined();
    await addVirtualDevices(matterbridge, aggregator);
    expect(aggregator.parts.has('UpdateMatterbridge:outlet')).toBeTruthy();
    expect(aggregator.parts.has('RestartMatterbridge:outlet')).toBeTruthy();
    expect(aggregator.parts.has('RebootMatterbridge:outlet')).toBeFalsy();
    expect(aggregator.parts.size).toBe(5);
  });

  test('add all the switch virtual devices', async () => {
    matterbridge.virtualMode = 'switch';
    expect(matterbridge.log).toBeDefined();
    expect(aggregator).toBeDefined();
    await addVirtualDevices(matterbridge, aggregator);
    expect(aggregator.parts.has('UpdateMatterbridge:switch')).toBeTruthy();
    expect(aggregator.parts.has('RestartMatterbridge:switch')).toBeTruthy();
    expect(aggregator.parts.has('RebootMatterbridge:switch')).toBeFalsy();
    expect(aggregator.parts.size).toBe(7);

    // Logger.get('AggregatorNode').info(aggregator);
    expect(aggregator.parts.get('UpdateMatterbridge:switch')?.behaviors.has(BindingServer)).toBeTruthy();
    expect(aggregator.parts.get('UpdateMatterbridge:switch')?.stateOf(DescriptorServer).clientList).toEqual([Identify.id, OnOff.id]);
    expect(aggregator.parts.get('RestartMatterbridge:switch')?.behaviors.has(BindingServer)).toBeTruthy();
    expect(aggregator.parts.get('RestartMatterbridge:switch')?.stateOf(DescriptorServer).clientList).toEqual([Identify.id, OnOff.id]);
  });

  test('add all the mounted-switch virtual devices', async () => {
    matterbridge.virtualMode = 'mounted_switch';
    expect(matterbridge.log).toBeDefined();
    expect(aggregator).toBeDefined();
    await addVirtualDevices(matterbridge, aggregator);
    expect(aggregator.parts.has('UpdateMatterbridge:mounted_switch')).toBeTruthy();
    expect(aggregator.parts.has('RestartMatterbridge:mounted_switch')).toBeTruthy();
    expect(aggregator.parts.has('RebootMatterbridge:mounted_switch')).toBeFalsy();
    expect(aggregator.parts.size).toBe(9);

    // await setDebug(true);
    // Logger.get('AggregatorNode').info(aggregator);

    expect(aggregator.parts.get('UpdateMatterbridge:mounted_switch')?.behaviors.has(BindingServer)).toBeFalsy();
    expect(aggregator.parts.get('UpdateMatterbridge:mounted_switch')?.stateOf(DescriptorServer).clientList).toEqual([]);
    // expect(aggregator.parts.get('UpdateMatterbridge:mounted_switch')?.stateOf(DescriptorServer).deviceTypeList).toEqual([{}]);
    expect(aggregator.parts.get('RestartMatterbridge:mounted_switch')?.behaviors.has(BindingServer)).toBeFalsy();
    expect(aggregator.parts.get('RestartMatterbridge:mounted_switch')?.stateOf(DescriptorServer).clientList).toEqual([]);
    // expect(aggregator.parts.get('RestartMatterbridge:mounted_switch')?.stateOf(DescriptorServer).deviceTypeList).toEqual([{}]);
  });

  test('send command restart to the virtual device', async () => {
    await setDebug(false);
    const restartDevice = aggregator.parts.get('RestartMatterbridge:light');
    expect(restartDevice).toBeDefined();
    if (!restartDevice) return;
    expect(restartDevice.stateOf(OnOffServer).onOff).toBe(false);

    await new Promise<void>((resolve) => {
      // oxlint-disable-next-line typescript/explicit-function-return-type
      const listener = (value: boolean) => {
        if (value) {
          (restartDevice as any).events.onOff.onOff$Changed.off(listener);
          resolve();
        }
      };
      (restartDevice as any).events.onOff.onOff$Changed.on(listener);
      void restartDevice.setStateOf(OnOffServer, { onOff: true });
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(restartDevice.stateOf(OnOffServer).onOff).toBe(false);

    matterbridge.restartMode = 'service';
    await new Promise<void>((resolve) => {
      // oxlint-disable-next-line typescript/explicit-function-return-type
      const listener = (value: boolean) => {
        if (value) {
          (restartDevice as any).events.onOff.onOff$Changed.off(listener);
          resolve();
        }
      };
      (restartDevice as any).events.onOff.onOff$Changed.on(listener);
      void restartDevice.setStateOf(OnOffServer, { onOff: true });
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(restartDevice.stateOf(OnOffServer).onOff).toBe(false);
  });

  test('send command update to the virtual device', async () => {
    const updateDevice = aggregator.parts.get('UpdateMatterbridge:light');
    expect(updateDevice).toBeDefined();
    if (!updateDevice) return;
    expect(updateDevice.stateOf(OnOffServer).onOff).toBe(false);

    await new Promise<void>((resolve) => {
      const listener = (value: boolean): void => {
        if (value) {
          (updateDevice as any).events.onOff.onOff$Changed.off(listener);
          resolve();
        }
      };
      (updateDevice as any).events.onOff.onOff$Changed.on(listener);
      void updateDevice.setStateOf(OnOffServer, { onOff: true });
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(updateDevice.stateOf(OnOffServer).onOff).toBe(false);
  });
});

describe('Matterbridge ' + NAME + ' resolveRootDirectory', () => {
  /** The temporary directory holding all the install layout fixtures of this suite. */
  let fixtures: string;

  /**
   * Creates a directory tree and writes a package.json with the given name in each entry directory.
   *
   * @param {Record<string, string | null>} tree - Map of fixture relative directory to the package.json name to write in it, or null to only create the directory.
   * @returns {Promise<void>} A promise that resolves when the fixture has been created on disk.
   */
  async function createLayout(tree: Record<string, string | null>): Promise<void> {
    for (const [relative, name] of Object.entries(tree)) {
      const directory = path.join(fixtures, relative);
      await mkdir(directory, { recursive: true });
      if (name !== null) await writeFile(path.join(directory, 'package.json'), JSON.stringify({ name, version: '1.2.3' }, null, 2), 'utf8');
    }
  }

  beforeAll(async () => {
    fixtures = await mkdtemp(path.join(os.tmpdir(), 'matterbridge-rootdir-'));
  });

  afterAll(async () => {
    await rm(fixtures, { recursive: true, force: true });
  });

  test('resolves the real repository root from the real core src directory', async () => {
    const coreSrcDirectory = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..', 'src');
    const repositoryRoot = path.resolve(coreSrcDirectory, '..', '..', '..');

    const resolved = await resolveRootDirectory(coreSrcDirectory);

    expect(resolved).toBe(repositoryRoot);
    if (resolved === undefined) return;
    // The resolved root must be the directory the production code reads the versions from.
    expect(JSON.parse(await readFile(path.join(resolved, 'package.json'), 'utf8')).name).toBe('matterbridge');
    expect(JSON.parse(await readFile(path.join(resolved, 'apps', 'frontend', 'package.json'), 'utf8')).name).toBeDefined();
  });

  test('resolves the real repository root from the real core dist and vitest directories', async () => {
    const coreDirectory = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
    const repositoryRoot = path.resolve(coreDirectory, '..', '..');

    expect(await resolveRootDirectory(path.join(coreDirectory, 'dist'))).toBe(repositoryRoot);
    expect(await resolveRootDirectory(path.join(coreDirectory, 'vitest'))).toBe(repositoryRoot);
  });

  test('resolves the development layout when the repository directory is not named matterbridge', async () => {
    await createLayout({
      'renamed-clone': 'matterbridge',
      'renamed-clone/apps/frontend': 'matterbridge-frontend',
      'renamed-clone/packages/core/src': '@matterbridge/core',
      'renamed-clone/packages/core/dist': null,
    });
    const root = path.join(fixtures, 'renamed-clone');

    expect(await resolveRootDirectory(path.join(root, 'packages', 'core', 'src'))).toBe(root);
    expect(await resolveRootDirectory(path.join(root, 'packages', 'core', 'dist'))).toBe(root);
  });

  test('resolves the bundled core layout', async () => {
    await createLayout({
      'bundled/matterbridge': 'matterbridge',
      'bundled/matterbridge/dist': null,
    });
    const root = path.join(fixtures, 'bundled', 'matterbridge');

    expect(await resolveRootDirectory(path.join(root, 'dist'))).toBe(root);
  });

  test('resolves the nested npm global layout', async () => {
    await createLayout({
      'npm/lib/node_modules/matterbridge': 'matterbridge',
      'npm/lib/node_modules/matterbridge/apps/frontend': 'matterbridge-frontend',
      'npm/lib/node_modules/matterbridge/node_modules/@matterbridge/core/dist': '@matterbridge/core',
    });
    const root = path.join(fixtures, 'npm', 'lib', 'node_modules', 'matterbridge');

    expect(await resolveRootDirectory(path.join(root, 'node_modules', '@matterbridge', 'core', 'dist'))).toBe(root);
  });

  test('resolves the flat bun global layout and not the bun global prefix', async () => {
    // Reproduces the ENOENT on <prefix>/apps/frontend/package.json when matterbridge is started with node from a bun global install.
    await createLayout({
      'bun/install/global': 'global', // Bun writes its own manifest in the global prefix.
      'bun/install/global/node_modules/@matterbridge/core/dist': '@matterbridge/core',
      'bun/install/global/node_modules/matterbridge': 'matterbridge',
      'bun/install/global/node_modules/matterbridge/apps/frontend': 'matterbridge-frontend',
    });
    const globalPrefix = path.join(fixtures, 'bun', 'install', 'global');
    const root = path.join(globalPrefix, 'node_modules', 'matterbridge');

    const resolved = await resolveRootDirectory(path.join(globalPrefix, 'node_modules', '@matterbridge', 'core', 'dist'));

    expect(resolved).toBe(root);
    expect(resolved).not.toBe(globalPrefix);
    if (resolved === undefined) return;
    expect(JSON.parse(await readFile(path.join(resolved, 'apps', 'frontend', 'package.json'), 'utf8')).name).toBe('matterbridge-frontend');
  });

  test('resolves the flat hoisted layout of a plugin local install', async () => {
    await createLayout({
      'plugin': 'matterbridge-mock-plugin',
      'plugin/node_modules/@matterbridge/core/dist': '@matterbridge/core',
      'plugin/node_modules/matterbridge': 'matterbridge',
    });
    const root = path.join(fixtures, 'plugin', 'node_modules', 'matterbridge');

    expect(await resolveRootDirectory(path.join(fixtures, 'plugin', 'node_modules', '@matterbridge', 'core', 'dist'))).toBe(root);
  });

  test('prefers the matterbridge package directory over its own node_modules copy', async () => {
    await createLayout({
      'prefer/matterbridge': 'matterbridge',
      'prefer/matterbridge/dist': null,
      'prefer/matterbridge/node_modules/matterbridge': 'matterbridge',
    });
    const root = path.join(fixtures, 'prefer', 'matterbridge');

    expect(await resolveRootDirectory(path.join(root, 'dist'))).toBe(root);
  });

  test('returns undefined when only packages with another name are found', async () => {
    await createLayout({
      'other/deep/dist': '@matterbridge/core',
      'other/deep': 'matterbridge-other',
      'other': 'not-matterbridge',
    });

    expect(await resolveRootDirectory(path.join(fixtures, 'other', 'deep', 'dist'), 3)).toBeUndefined();
  });

  test('returns undefined when the package.json is malformed', async () => {
    const root = path.join(fixtures, 'malformed');
    await createLayout({ 'malformed/dist': null });
    await writeFile(path.join(root, 'package.json'), '{ "name": "matterbridge", ', 'utf8');

    expect(await resolveRootDirectory(path.join(root, 'dist'), 2)).toBeUndefined();
  });

  test('returns undefined when a matterbridge directory has no package.json', async () => {
    await createLayout({
      'nopackage/node_modules/matterbridge': null,
      'nopackage/node_modules/@matterbridge/core/dist': '@matterbridge/core',
    });

    expect(await resolveRootDirectory(path.join(fixtures, 'nopackage', 'node_modules', '@matterbridge', 'core', 'dist'), 4)).toBeUndefined();
  });

  test('returns undefined when the package.json has no name', async () => {
    const root = path.join(fixtures, 'noname');
    await createLayout({ 'noname/dist': null });
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ version: '1.0.0' }), 'utf8');

    expect(await resolveRootDirectory(path.join(root, 'dist'), 2)).toBeUndefined();
  });

  test('returns undefined for a directory that does not exist', async () => {
    expect(await resolveRootDirectory(path.join(fixtures, 'missing', 'deeper', 'dist'), 3)).toBeUndefined();
  });

  test('probes at most maxLevels parent directories', async () => {
    await createLayout({
      'levels/matterbridge': 'matterbridge',
      'levels/matterbridge/a/b/c/d': null,
    });
    const root = path.join(fixtures, 'levels', 'matterbridge');
    const leaf = path.join(root, 'a', 'b', 'c', 'd');

    expect(await resolveRootDirectory(leaf, 4)).toBeUndefined(); // d, c, b and a are probed
    expect(await resolveRootDirectory(leaf, 5)).toBe(root); // d, c, b, a and matterbridge are probed
  });

  test('stops at the file system root without throwing', async () => {
    expect(await resolveRootDirectory(path.parse(fixtures).root, 5)).toBeUndefined();
  });
});
