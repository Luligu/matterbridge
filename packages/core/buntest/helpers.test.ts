/**
 * @file packages/core/buntest/helpers.test.ts
 * @description This file contains the bun tests for helpers.
 * @author Luca Liguori
 */

const NAME = 'Helpers';
const MATTER_PORT = 6600;

import { afterAll, beforeAll, describe, expect, test, vi } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import url from 'node:url';

import type { Endpoint } from '@matter/node';
import { BindingServer } from '@matter/node/behaviors/binding';
import { BridgedDeviceBasicInformationServer } from '@matter/node/behaviors/bridged-device-basic-information';
import { DescriptorServer } from '@matter/node/behaviors/descriptor';
import { OnOffServer } from '@matter/node/behaviors/on-off';
import { Identify } from '@matter/types/clusters/identify';
import { OnOff } from '@matter/types/clusters/on-off';
import { aggregator, getMatterbridge } from '@matterbridge/test-utils/buntest/matter';
import { log, setupTest } from '@matterbridge/test-utils/buntest/setup';

import { addVirtualDevice, addVirtualDevices, resolveRootDirectory } from '../src/helpers.js';
import type { Matterbridge } from '../src/matterbridge.js';
import { useServerNode, waitFor } from './bunUtils.js';

await setupTest(NAME, false);

/**
 * Turns a virtual device on and waits until it has turned itself off again.
 *
 * @param {Endpoint | undefined} device - The virtual device.
 * @param {() => boolean} [done] - An additional condition to wait for, e.g. the callback having run.
 * @returns {Promise<void>} Resolves once the device is off again.
 */
async function press(device: Endpoint | undefined, done: () => boolean = () => true): Promise<void> {
  if (!device) throw new Error('virtual device not found');
  expect(device.stateOf(OnOffServer).onOff).toBe(false);
  let turnedOn = false;
  const listener = (value: boolean): void => {
    if (value) turnedOn = true;
  };
  const events = (device as any).events.onOff.onOff$Changed;
  events.on(listener);
  try {
    await device.setStateOf(OnOffServer, { onOff: true });
    await waitFor(() => turnedOn && !device.stateOf(OnOffServer).onOff && done());
  } finally {
    events.off(listener);
  }
}

describe('Matterbridge ' + NAME, () => {
  useServerNode(MATTER_PORT);
  const restartProcess = vi.fn(async () => {});
  const shutdownProcess = vi.fn(async () => {});
  const updateProcess = vi.fn(async () => {});
  const matterbridge = { ...getMatterbridge(), log, restartProcess, shutdownProcess, updateProcess } as unknown as Matterbridge;

  test('a light virtual device runs its callback and turns itself off', async () => {
    const callback = vi.fn(async () => {});
    const device = await addVirtualDevice(aggregator, 'Test Device', 'light', callback);
    expect(device.lifecycle.isReady).toBe(true);
    expect(device.id).toBe('TestDevice:light');
    expect(device.stateOf(BridgedDeviceBasicInformationServer).nodeLabel).toBe('Test Device');
    expect([...aggregator.parts].map((part) => part.id)).toEqual(['TestDevice:light']);
    await press(device, () => callback.mock.calls.length === 1);
  });

  test('addVirtualDevices adds the restart and update devices of every virtual mode', async () => {
    matterbridge.virtualMode = 'disabled';
    matterbridge.bridgeMode = 'bridge';
    await addVirtualDevices(matterbridge, aggregator);
    expect(aggregator.parts.size).toBe(1);

    for (const [mode, clientList] of [
      ['light', undefined],
      ['outlet', undefined],
      ['switch', [Identify.id, OnOff.id]],
      ['mounted_switch', []],
    ] as const) {
      matterbridge.virtualMode = mode;
      await addVirtualDevices(matterbridge, aggregator);
      for (const name of ['UpdateMatterbridge', 'RestartMatterbridge']) {
        const part = aggregator.parts.get(`${name}:${mode}`);
        expect(part).toBeDefined();
        if (clientList === undefined) continue;
        expect(part?.behaviors.has(BindingServer)).toBe(mode === 'switch');
        expect([...(part?.stateOf(DescriptorServer).clientList ?? [])]).toEqual([...clientList]);
      }
      expect(aggregator.parts.has(`RebootMatterbridge:${mode}`)).toBe(false);
    }
    expect(aggregator.parts.size).toBe(9);
  });

  test('the restart device restarts or shuts down by restart mode, the update device updates', async () => {
    const restartDevice = aggregator.parts.get('RestartMatterbridge:light');
    matterbridge.restartMode = 'none';
    await press(restartDevice, () => restartProcess.mock.calls.length === 1);
    matterbridge.restartMode = 'service';
    await press(restartDevice, () => shutdownProcess.mock.calls.length === 1);
    expect(restartProcess).toHaveBeenCalledTimes(1);

    await press(aggregator.parts.get('UpdateMatterbridge:light'), () => updateProcess.mock.calls.length === 1);
  });
});

describe('Matterbridge ' + NAME + ' resolveRootDirectory', () => {
  /** The temporary directory holding all the install layout fixtures of this suite. */
  let fixtures: string;
  const coreDirectory = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
  const repositoryRoot = path.resolve(coreDirectory, '..', '..');

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
      if (name !== null) await writeFile(path.join(directory, 'package.json'), JSON.stringify({ name, version: '1.2.3' }), 'utf8');
    }
  }

  /**
   * Reads the name of a package.json.
   *
   * @param {...string} segments - The path segments of the package directory.
   * @returns {Promise<string>} The package name.
   */
  const packageName = async (...segments: string[]): Promise<string> => (JSON.parse(await readFile(path.join(...segments, 'package.json'), 'utf8')) as { name: string }).name;

  beforeAll(async () => {
    fixtures = await mkdtemp(path.join(os.tmpdir(), 'matterbridge-rootdir-'));
  });

  afterAll(async () => {
    await rm(fixtures, { recursive: true, force: true });
  });

  test('resolves the real repository root from the core src, dist, vitest and buntest directories', async () => {
    for (const directory of ['src', 'dist', 'vitest', 'buntest']) expect(await resolveRootDirectory(path.join(coreDirectory, directory))).toBe(repositoryRoot);
    // The resolved root must be the directory the production code reads the versions from.
    expect(await packageName(repositoryRoot)).toBe('matterbridge');
    expect(await packageName(repositoryRoot, 'apps', 'frontend')).toBeDefined();
  });

  // Each case: the layout, the directory to resolve from, and the expected root (both relative to the fixtures).
  test.each<[string, Record<string, string | null>, string, string]>([
    [
      'the development layout of a clone not named matterbridge',
      {
        'renamed-clone': 'matterbridge',
        'renamed-clone/apps/frontend': 'matterbridge-frontend',
        'renamed-clone/packages/core/src': '@matterbridge/core',
        'renamed-clone/packages/core/dist': null,
      },
      'renamed-clone/packages/core/dist',
      'renamed-clone',
    ],
    ['the bundled core layout', { 'bundled/matterbridge': 'matterbridge', 'bundled/matterbridge/dist': null }, 'bundled/matterbridge/dist', 'bundled/matterbridge'],
    [
      'the nested npm global layout',
      {
        'npm/lib/node_modules/matterbridge': 'matterbridge',
        'npm/lib/node_modules/matterbridge/apps/frontend': 'matterbridge-frontend',
        'npm/lib/node_modules/matterbridge/node_modules/@matterbridge/core/dist': '@matterbridge/core',
      },
      'npm/lib/node_modules/matterbridge/node_modules/@matterbridge/core/dist',
      'npm/lib/node_modules/matterbridge',
    ],
    [
      // Reproduces the ENOENT on <prefix>/apps/frontend/package.json when matterbridge is started with node from a bun global install.
      'the flat bun global layout, not the bun global prefix',
      {
        'bun/install/global': 'global',
        'bun/install/global/node_modules/@matterbridge/core/dist': '@matterbridge/core',
        'bun/install/global/node_modules/matterbridge': 'matterbridge',
        'bun/install/global/node_modules/matterbridge/apps/frontend': 'matterbridge-frontend',
      },
      'bun/install/global/node_modules/@matterbridge/core/dist',
      'bun/install/global/node_modules/matterbridge',
    ],
    [
      'the flat hoisted layout of a plugin local install',
      { 'plugin': 'matterbridge-mock-plugin', 'plugin/node_modules/@matterbridge/core/dist': '@matterbridge/core', 'plugin/node_modules/matterbridge': 'matterbridge' },
      'plugin/node_modules/@matterbridge/core/dist',
      'plugin/node_modules/matterbridge',
    ],
    [
      'the matterbridge package directory over its own node_modules copy',
      { 'prefer/matterbridge': 'matterbridge', 'prefer/matterbridge/dist': null, 'prefer/matterbridge/node_modules/matterbridge': 'matterbridge' },
      'prefer/matterbridge/dist',
      'prefer/matterbridge',
    ],
  ])('resolves %s', async (_name, layout, from, root) => {
    await createLayout(layout);
    expect(await resolveRootDirectory(path.join(fixtures, from))).toBe(path.join(fixtures, root));
  });

  test('returns undefined when no valid matterbridge package.json is found', async () => {
    await createLayout({
      'other/deep/dist': '@matterbridge/core',
      'other/deep': 'matterbridge-other',
      'other': 'not-matterbridge',
      'malformed/dist': null,
      'nopackage/node_modules/matterbridge': null,
      'nopackage/node_modules/@matterbridge/core/dist': '@matterbridge/core',
      'noname/dist': null,
    });
    await writeFile(path.join(fixtures, 'malformed', 'package.json'), '{ "name": "matterbridge", ', 'utf8');
    await writeFile(path.join(fixtures, 'noname', 'package.json'), JSON.stringify({ version: '1.0.0' }), 'utf8');

    for (const [from, maxLevels] of [
      ['other/deep/dist', 3],
      ['malformed/dist', 2],
      ['nopackage/node_modules/@matterbridge/core/dist', 4],
      ['noname/dist', 2],
      ['missing/deeper/dist', 3],
    ] as const) {
      expect(await resolveRootDirectory(path.join(fixtures, from), maxLevels)).toBeUndefined();
    }
    // The file system root is reached without throwing.
    expect(await resolveRootDirectory(path.parse(fixtures).root, 5)).toBeUndefined();
  });

  test('probes at most maxLevels parent directories', async () => {
    await createLayout({ 'levels/matterbridge': 'matterbridge', 'levels/matterbridge/a/b/c/d': null });
    const root = path.join(fixtures, 'levels', 'matterbridge');
    const leaf = path.join(root, 'a', 'b', 'c', 'd');

    expect(await resolveRootDirectory(leaf, 4)).toBeUndefined(); // d, c, b and a are probed
    expect(await resolveRootDirectory(leaf, 5)).toBe(root); // d, c, b, a and matterbridge are probed
  });
});
