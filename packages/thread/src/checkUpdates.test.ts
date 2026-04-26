// src\checkUpdates.test.ts
/* eslint-disable @typescript-eslint/ban-ts-comment */

const MATTER_PORT = 13000;
const FRONTEND_PORT = 8810;
const NAME = 'MatterbridgeUpdate';
const HOMEDIR = path.join('.cache', 'jest', NAME);
const PASSCODE = 123456;
const DISCRIMINATOR = 3860;

import path from 'node:path';

import { jest } from '@jest/globals';
import type { ApiPlugin } from '@matterbridge/types';
import { plg } from '@matterbridge/types';
import { AnsiLogger, db, LogLevel, nt, TimestampFormat, wr } from 'node-ansi-logger';

// @ts-ignore
import { flushAsync } from '../../../packages/core/src/jestutils/jestFlushAsync.js';
// @ts-ignore
import { wssSendRefreshRequiredFrontendSpy, wssSendSnackbarMessageFrontendSpy, wssSendUpdateRequiredFrontendSpy } from '../../../packages/core/src/jestutils/jestFrontendSpy.js';
import {
  matterbridge,
  startMatterbridge,
  stopMatterbridge,
  // @ts-ignore
} from '../../../packages/core/src/jestutils/jestMatterbridgeTest.js';
import { loggerDebugSpy, loggerNoticeSpy, loggerWarnSpy, setupTest } from '../../../packages/core/src/jestutils/jestSetupTest.js';
import { BroadcastServer } from './broadcastServer.js';
import { checkUpdates, checkUpdatesAndLog, getMatterbridgeDevVersion, getMatterbridgeLatestVersion, getPluginDevVersion, getPluginLatestVersion } from './checkUpdates.js';

// Mock selected functions from @matterbridge/utils (tree-shaken subpath imports)
jest.unstable_mockModule('@matterbridge/utils/npm-version', () => ({
  getNpmPackageVersion: jest.fn(),
}));

jest.unstable_mockModule('@matterbridge/utils/github-version', () => ({
  getGitHubUpdate: jest.fn(),
}));

/*
// Mock the function getShellySysUpdate and getShellyMainUpdate
jest.unstable_mockModule('./shelly.js', () => ({
  getShellySysUpdate: jest.fn(),
  getShellyMainUpdate: jest.fn(),
}));
*/

await setupTest(NAME, false);

describe('getMatterbridgeLatestVersion', () => {
  // Create BroadcastServer for tests
  const log = new AnsiLogger({ logName: 'TestBroadcastServer', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });
  const testServer = new BroadcastServer('manager', log);
  let plugin: ApiPlugin | null = null;

  beforeAll(async () => {
    // Start matterbridge instance
    await startMatterbridge('bridge', FRONTEND_PORT, MATTER_PORT, PASSCODE, DISCRIMINATOR);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Close test server
    testServer.close();
    // Stop matterbridge instance
    await stopMatterbridge(undefined, 500);
    // Restore all mocks
    jest.restoreAllMocks();
  });

  it('should add plugin', async () => {
    plugin = (await testServer.fetch({ type: 'plugins_add', src: testServer.name, dst: 'plugins', params: { nameOrPath: './packages/core/src/mock/plugin1' } }, 5000)).result
      .plugin;
    expect(plugin).not.toBe(null);
  });

  it('should check updates', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');

    // const { getShellySysUpdate, getShellyMainUpdate } = await import('./shelly.js');

    // Set the return value for this specific test case
    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockResolvedValue('1.0.0');

    // process.argv.push('-shelly');
    await checkUpdates(matterbridge);

    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge');
    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge', 'dev');
    expect(getNpmPackageVersion).toHaveBeenCalledWith(plugin ? plugin.name : 'unknown-plugin');
    // expect(getShellySysUpdate).toHaveBeenCalledWith(matterbridge, expect.any(AnsiLogger), expect.any(BroadcastServer));
    // expect(getShellyMainUpdate).toHaveBeenCalledWith(matterbridge, expect.any(AnsiLogger), expect.any(BroadcastServer));
  });

  it('should update to the latest version if versions differ', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');

    // Set the return value for this specific test case
    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockResolvedValueOnce('1.1.0');

    await getMatterbridgeLatestVersion(matterbridge, log, testServer);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge');
    expect(matterbridge.matterbridgeLatestVersion).toBe('1.1.0');
    expect(loggerNoticeSpy).toHaveBeenCalledWith(`Matterbridge is out of date. Current version: ${matterbridge.matterbridgeVersion}. Latest version: 1.1.0.`);
    expect(wssSendSnackbarMessageFrontendSpy).toHaveBeenCalledWith('Matterbridge latest update available', 0, 'info');
    expect(wssSendUpdateRequiredFrontendSpy).toHaveBeenCalled();
  });

  it('should log a debug message if the current version is up to date', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');

    // Set the return value for this specific test case
    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockResolvedValueOnce(matterbridge.matterbridgeVersion);

    await getMatterbridgeLatestVersion(matterbridge, log, testServer);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge');
    expect(matterbridge.matterbridgeLatestVersion).toBe(matterbridge.matterbridgeVersion);
    expect(loggerDebugSpy).toHaveBeenCalledWith(
      `Matterbridge is up to date. Current version: ${matterbridge.matterbridgeVersion}. Latest version: ${matterbridge.matterbridgeVersion}.`,
    );
    expect(wssSendSnackbarMessageFrontendSpy).not.toHaveBeenCalled();
    expect(wssSendUpdateRequiredFrontendSpy).not.toHaveBeenCalled();
    expect(wssSendRefreshRequiredFrontendSpy).not.toHaveBeenCalled();
  });

  it('should log a warning on error fetching the latest version', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');

    // Set the return value for this specific test case
    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockRejectedValueOnce(new Error('Network error'));

    await getMatterbridgeLatestVersion(matterbridge, log, testServer);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge');
    expect(loggerWarnSpy).toHaveBeenCalledWith('Error getting Matterbridge latest version: Network error');
  });

  it('should log a warning on non-Error fetching the latest version', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');

    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockRejectedValueOnce('Network error');

    await getMatterbridgeLatestVersion(matterbridge, log, testServer);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge');
    expect(loggerWarnSpy).toHaveBeenCalledWith('Error getting Matterbridge latest version: Network error');
  });

  it('should update to the dev version if versions differ', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');

    matterbridge.matterbridgeVersion = '1.0.0-dev-1';

    // Set the return value for this specific test case
    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockResolvedValueOnce('1.1.0-dev-1');

    await getMatterbridgeDevVersion(matterbridge, log, testServer);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge', 'dev');
    expect(matterbridge.matterbridgeDevVersion).toBe('1.1.0-dev-1');
    expect(loggerNoticeSpy).toHaveBeenCalledWith('Matterbridge@dev is out of date. Current version: 1.0.0-dev-1. Latest dev version: 1.1.0-dev-1.');
    expect(wssSendSnackbarMessageFrontendSpy).toHaveBeenCalledWith('Matterbridge dev update available', 0, 'info');
    expect(wssSendUpdateRequiredFrontendSpy).toHaveBeenCalled();
  });

  it('should log a debug message if the dev version is up to date', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');

    matterbridge.matterbridgeVersion = '1.0.0-dev-1';

    // Set the return value for this specific test case
    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockResolvedValueOnce('1.0.0-dev-1');

    await getMatterbridgeDevVersion(matterbridge, log, testServer);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge', 'dev');
    expect(matterbridge.matterbridgeDevVersion).toBe('1.0.0-dev-1');
    expect(loggerDebugSpy).toHaveBeenCalledWith('Matterbridge@dev is up to date. Current version: 1.0.0-dev-1. Latest dev version: 1.0.0-dev-1.');
    expect(wssSendSnackbarMessageFrontendSpy).not.toHaveBeenCalled();
    expect(wssSendUpdateRequiredFrontendSpy).not.toHaveBeenCalled();
    expect(wssSendRefreshRequiredFrontendSpy).not.toHaveBeenCalled();
  });

  it('should log a warning on error fetching the dev version', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');

    // Set the return value for this specific test case
    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockRejectedValueOnce(new Error('Network error'));

    await getMatterbridgeDevVersion(matterbridge, log, testServer);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge', 'dev');
    expect(loggerWarnSpy).toHaveBeenCalledWith('Error getting Matterbridge latest dev version: Network error');
  });

  it('should log a warning on non-Error fetching the dev version', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');

    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockRejectedValueOnce('Network error');

    await getMatterbridgeDevVersion(matterbridge, log, testServer);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge', 'dev');
    expect(loggerWarnSpy).toHaveBeenCalledWith('Error getting Matterbridge latest dev version: Network error');
  });

  it('should update to the dev version if running a git version', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');

    matterbridge.matterbridgeVersion = '1.0.0-git-1';
    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockResolvedValueOnce('1.1.0-dev-1');

    await getMatterbridgeDevVersion(matterbridge, log, testServer);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge', 'dev');
    expect(loggerNoticeSpy).toHaveBeenCalledWith('Matterbridge@dev is out of date. Current version: 1.0.0-git-1. Latest dev version: 1.1.0-dev-1.');
    expect(wssSendSnackbarMessageFrontendSpy).toHaveBeenCalledWith('Matterbridge dev update available', 0, 'info');
    expect(wssSendUpdateRequiredFrontendSpy).toHaveBeenCalled();
  });

  it('should log a debug message if the git version is up to date', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');

    matterbridge.matterbridgeVersion = '1.0.0-git-1';
    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockResolvedValueOnce('1.0.0-git-1');

    await getMatterbridgeDevVersion(matterbridge, log, testServer);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge', 'dev');
    expect(loggerDebugSpy).toHaveBeenCalledWith('Matterbridge@dev is up to date. Current version: 1.0.0-git-1. Latest dev version: 1.0.0-git-1.');
    expect(wssSendSnackbarMessageFrontendSpy).not.toHaveBeenCalled();
    expect(wssSendUpdateRequiredFrontendSpy).not.toHaveBeenCalled();
    expect(wssSendRefreshRequiredFrontendSpy).not.toHaveBeenCalled();
  });

  it('should update to the plugin latest version if versions differ', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');

    // Set the return value for this specific test case
    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockResolvedValueOnce('1.1.0');

    expect(plugin).not.toBeNull();
    if (plugin === null) return;
    await getPluginLatestVersion(log, testServer, plugin);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith(plugin.name);
    expect(loggerNoticeSpy).toHaveBeenCalledWith(`The plugin ${plg}${plugin.name}${nt} is out of date. Current version: ${plugin.version}. Latest version: 1.1.0.`);
    expect(wssSendRefreshRequiredFrontendSpy).toHaveBeenCalledWith('plugins', undefined);
  });

  it('should log a debug message if the plugin current version is up to date', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');

    // Set the return value for this specific test case
    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockResolvedValueOnce('1.0.1');

    expect(plugin).not.toBeNull();
    if (plugin === null) return;
    await getPluginLatestVersion(log, testServer, plugin);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith(plugin.name);
    expect(loggerDebugSpy).toHaveBeenCalledWith(`The plugin ${plg}${plugin.name}${db} is up to date. Current version: ${plugin.version}. Latest version: 1.0.1.`);
    expect(wssSendRefreshRequiredFrontendSpy).not.toHaveBeenCalled();
  });

  it('should log a warning on error fetching the plugin latest version', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');

    // Set the return value for this specific test case
    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockRejectedValueOnce(new Error('Network error'));

    expect(plugin).not.toBeNull();
    if (plugin === null) return;
    await getPluginLatestVersion(log, testServer, plugin);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith(plugin.name);
    expect(loggerWarnSpy).toHaveBeenCalledWith(`Error getting plugin ${plg}${plugin.name}${wr} latest version: Network error`);
  });

  it('should log a warning on non-Error fetching the plugin latest version', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');

    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockRejectedValueOnce('Network error');

    expect(plugin).not.toBeNull();
    if (plugin === null) return;
    await getPluginLatestVersion(log, testServer, plugin);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith(plugin.name);
    expect(loggerWarnSpy).toHaveBeenCalledWith(`Error getting plugin ${plg}${plugin.name}${wr} latest version: Network error`);
  });

  it('should update to the plugin dev version and log if versions differ', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');

    expect(plugin).not.toBeNull();
    if (plugin === null) return;
    plugin.version = '1.0.0-dev-123456';

    // Set the return value for this specific test case
    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockResolvedValueOnce('1.1.0-dev-123456');

    await getPluginDevVersion(log, testServer, plugin);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith(plugin.name, 'dev');
    expect(plugin.devVersion).toBe('1.1.0-dev-123456');
    expect(loggerNoticeSpy).toHaveBeenCalledWith(`The plugin ${plg}${plugin.name}${nt} is out of date. Current version: 1.0.0-dev-123456. Latest dev version: 1.1.0-dev-123456.`);
    expect(wssSendRefreshRequiredFrontendSpy).toHaveBeenCalledWith('plugins', undefined);
  });

  it('should update to the plugin dev version and log if the plugin current version is up to date', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');

    expect(plugin).not.toBeNull();
    if (plugin === null) return;
    plugin.version = '1.1.0-dev-123456';

    // Set the return value for this specific test case
    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockResolvedValueOnce('1.1.0-dev-123456');

    await getPluginDevVersion(log, testServer, plugin);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith(plugin.name, 'dev');
    expect(plugin.devVersion).toBe('1.1.0-dev-123456');
    expect(loggerDebugSpy).toHaveBeenCalledWith(`The plugin ${plg}${plugin.name}${db} is up to date. Current version: 1.1.0-dev-123456. Latest dev version: 1.1.0-dev-123456.`);
    expect(wssSendRefreshRequiredFrontendSpy).not.toHaveBeenCalled();
  });

  it('should log a warning on error fetching the plugin dev version', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');

    // Set the return value for this specific test case
    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockRejectedValueOnce(new Error('Network error'));

    expect(plugin).not.toBeNull();
    if (plugin === null) return;
    await getPluginDevVersion(log, testServer, plugin);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith(plugin.name, 'dev');
    expect(loggerDebugSpy).toHaveBeenCalledWith(`Error getting plugin ${plg}${plugin.name}${db} latest dev version: Network error`);
  });

  it('should log a warning on non-Error fetching the plugin dev version', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');

    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockRejectedValueOnce('Network error');

    expect(plugin).not.toBeNull();
    if (plugin === null) return;
    await getPluginDevVersion(log, testServer, plugin);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith(plugin.name, 'dev');
    expect(loggerDebugSpy).toHaveBeenCalledWith(`Error getting plugin ${plg}${plugin.name}${db} latest dev version: Network error`);
  });

  it('should update to the plugin dev version if the plugin is a git version', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');

    expect(plugin).not.toBeNull();
    if (plugin === null) return;

    plugin.version = '1.0.0-git-123456';
    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockResolvedValueOnce('1.1.0-dev-123456');

    await getPluginDevVersion(log, testServer, plugin);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith(plugin.name, 'dev');
    expect(loggerNoticeSpy).toHaveBeenCalledWith(`The plugin ${plg}${plugin.name}${nt} is out of date. Current version: 1.0.0-git-123456. Latest dev version: 1.1.0-dev-123456.`);
    expect(wssSendRefreshRequiredFrontendSpy).toHaveBeenCalledWith('plugins', undefined);
  });

  it('should not log plugin dev update status when plugin git version is already up to date', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');

    expect(plugin).not.toBeNull();
    if (plugin === null) return;

    plugin.version = '1.0.0-git-123456';
    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockResolvedValueOnce('1.0.0-git-123456');

    await getPluginDevVersion(log, testServer, plugin);
    await flushAsync(undefined, undefined, 100);

    const pluginDevNotices = (loggerNoticeSpy as jest.Mock).mock.calls.filter((c) => String(c[0]).includes('latest dev version'));
    const pluginDevDebugs = (loggerDebugSpy as jest.Mock).mock.calls.filter((c) => String(c[0]).includes('latest dev version'));
    expect(pluginDevNotices).toHaveLength(0);
    expect(pluginDevDebugs).toHaveLength(0);
    expect(wssSendRefreshRequiredFrontendSpy).not.toHaveBeenCalled();
  });

  it('should check GitHub for updates and log', async () => {
    const { getGitHubUpdate } = await import('@matterbridge/utils/github-version');

    // Set the return value for this specific test case
    (getGitHubUpdate as jest.MockedFunction<(branch: string, file: string, timeout?: number) => Promise<any>>).mockResolvedValue({
      latest: '3.1.9',
      latestDate: '2025-07-??',
      dev: '3.1.9-dev-123456',
      devDate: '2025-07-??',
      latestMessage: 'Bumped matter.js to 0.15.2',
      latestMessageSeverity: 'info',
      devMessage: 'Bumped matter.js to 0.15.2',
      devMessageSeverity: 'info',
    });

    matterbridge.matterbridgeVersion = '1.0.0';
    await checkUpdatesAndLog(matterbridge, log, testServer);
    await flushAsync(undefined, undefined, 100);
    expect(getGitHubUpdate).toHaveBeenCalledWith('main', expect.stringContaining('update.json'), 5_000);
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining(`GitHub main update status:`));

    matterbridge.matterbridgeVersion = '1.0.0-dev-1';
    await checkUpdatesAndLog(matterbridge, log, testServer);
    await flushAsync(undefined, undefined, 100);
    expect(getGitHubUpdate).toHaveBeenCalledWith('dev', expect.stringContaining('update.json'), 5_000);
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining(`GitHub dev update status:`));
  });

  it('should not send snackbar when GitHub update message is invalid', async () => {
    const { getGitHubUpdate } = await import('@matterbridge/utils/github-version');

    (getGitHubUpdate as jest.MockedFunction<(branch: string, file: string, timeout?: number) => Promise<any>>).mockResolvedValue({
      latestMessage: 'Hello',
      latestMessageSeverity: 'invalid',
      devMessage: 'Hello',
      devMessageSeverity: 'invalid',
    });

    matterbridge.matterbridgeVersion = '1.0.0';
    await checkUpdatesAndLog(matterbridge, log, testServer);
    await flushAsync(undefined, undefined, 100);

    expect(getGitHubUpdate).toHaveBeenCalledWith('main', expect.stringContaining('update.json'), 5_000);
    // Other tests may still emit snackbars asynchronously; assert this specific invalid payload does not.
    expect(wssSendSnackbarMessageFrontendSpy).not.toHaveBeenCalledWith('Hello', 0, expect.any(String));
  });

  it('should not log dev update status when running a non-dev version', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');

    matterbridge.matterbridgeVersion = '1.0.0';
    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockResolvedValueOnce('9.9.9-dev-1');

    await getMatterbridgeDevVersion(matterbridge, log, testServer);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge', 'dev');

    const devNotices = (loggerNoticeSpy as jest.Mock).mock.calls.filter((c) => String(c[0]).includes('Matterbridge@dev'));
    const devDebugs = (loggerDebugSpy as jest.Mock).mock.calls.filter((c) => String(c[0]).includes('Matterbridge@dev'));
    expect(devNotices).toHaveLength(0);
    expect(devDebugs).toHaveLength(0);

    expect(wssSendSnackbarMessageFrontendSpy).not.toHaveBeenCalled();
    expect(wssSendUpdateRequiredFrontendSpy).not.toHaveBeenCalled();
  });

  it('should not log plugin dev update status when plugin is not a dev/git version', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');

    expect(plugin).not.toBeNull();
    if (plugin === null) return;

    plugin.version = '1.0.0';
    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockResolvedValueOnce('9.9.9-dev-1');

    await getPluginDevVersion(log, testServer, plugin);
    await flushAsync(undefined, undefined, 100);

    const pluginDevNotices = (loggerNoticeSpy as jest.Mock).mock.calls.filter((c) => String(c[0]).includes('latest dev version'));
    const pluginDevDebugs = (loggerDebugSpy as jest.Mock).mock.calls.filter((c) => String(c[0]).includes('latest dev version'));
    expect(pluginDevNotices).toHaveLength(0);
    expect(pluginDevDebugs).toHaveLength(0);
    expect(wssSendRefreshRequiredFrontendSpy).not.toHaveBeenCalled();
  });

  it('should check GitHub and fail', async () => {
    const { getGitHubUpdate } = await import('@matterbridge/utils/github-version');

    // Set the return value for this specific test case
    (getGitHubUpdate as jest.MockedFunction<(branch: string, file: string, timeout?: number) => Promise<any>>).mockRejectedValue(new Error('Network error'));

    matterbridge.matterbridgeVersion = '1.0.0';
    await checkUpdatesAndLog(matterbridge, log, testServer);
    expect(getGitHubUpdate).toHaveBeenCalledWith('main', expect.stringContaining('update.json'), 5_000);
    expect(loggerDebugSpy).toHaveBeenCalledWith(`Error checking GitHub main updates: Network error`);

    matterbridge.matterbridgeVersion = '1.0.0-dev-1';
    await checkUpdatesAndLog(matterbridge, log, testServer);
    expect(getGitHubUpdate).toHaveBeenCalledWith('dev', expect.stringContaining('update.json'), 5_000);
    expect(loggerDebugSpy).toHaveBeenCalledWith(`Error checking GitHub dev updates: Network error`);
  });

  it('should check GitHub and fail with non-Error', async () => {
    const { getGitHubUpdate } = await import('@matterbridge/utils/github-version');

    (getGitHubUpdate as jest.MockedFunction<(branch: string, file: string, timeout?: number) => Promise<any>>).mockRejectedValueOnce('Network error');
    matterbridge.matterbridgeVersion = '1.0.0';
    await checkUpdatesAndLog(matterbridge, log, testServer);
    expect(getGitHubUpdate).toHaveBeenCalledWith('main', expect.stringContaining('update.json'), 5_000);
    expect(loggerDebugSpy).toHaveBeenCalledWith(`Error checking GitHub main updates: Network error`);

    (getGitHubUpdate as jest.MockedFunction<(branch: string, file: string, timeout?: number) => Promise<any>>).mockRejectedValueOnce('Network error');
    matterbridge.matterbridgeVersion = '1.0.0-dev-1';
    await checkUpdatesAndLog(matterbridge, log, testServer);
    expect(getGitHubUpdate).toHaveBeenCalledWith('dev', expect.stringContaining('update.json'), 5_000);
    expect(loggerDebugSpy).toHaveBeenCalledWith(`Error checking GitHub dev updates: Network error`);
  });
});
