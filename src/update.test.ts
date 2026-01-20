// src\update.test.ts

const MATTER_PORT = 13000;
const FRONTEND_PORT = 8810;
const NAME = 'MatterbridgeUpdate';
const HOMEDIR = path.join('jest', NAME);
const PASSCODE = 123456;
const DISCRIMINATOR = 3860;

import path from 'node:path';

import { jest } from '@jest/globals';
import { AnsiLogger, db, LogLevel, nt, TimestampFormat, wr } from 'node-ansi-logger';

import { checkUpdates, getMatterbridgeLatestVersion, getMatterbridgeDevVersion, getPluginLatestVersion, getPluginDevVersion, checkUpdatesAndLog } from './update.js';
import { ApiPlugin, plg } from './matterbridgeTypes.js';
import { flushAsync, loggerDebugSpy, loggerNoticeSpy, loggerWarnSpy, matterbridge, setupTest, startMatterbridge, stopMatterbridge, wssSendRefreshRequiredSpy, wssSendSnackbarMessageSpy, wssSendUpdateRequiredSpy } from './jestutils/jestHelpers.js';
import { BroadcastServer } from './broadcastServer.js';

// Mock selected functions from @matterbridge/utils
jest.unstable_mockModule('@matterbridge/utils', () => ({
  getNpmPackageVersion: jest.fn(),
  getGitHubUpdate: jest.fn(),
  wait: jest.fn(),
}));

// Mock the function getShellySysUpdate and getShellyMainUpdate
jest.unstable_mockModule('./shelly.js', () => ({
  getShellySysUpdate: jest.fn(),
  getShellyMainUpdate: jest.fn(),
}));

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
    await stopMatterbridge();
    // Restore all mocks
    jest.restoreAllMocks();
    // Reset modules to clear the mocked modules
    jest.resetModules();
  });

  it('should add plugin', async () => {
    plugin = (await testServer.fetch({ type: 'plugins_add', src: testServer.name, dst: 'plugins', params: { nameOrPath: './src/mock/plugin1' } }, 5000)).result.plugin;
    expect(plugin).not.toBe(null);
  });

  it('should check updates', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils');
    const { getShellySysUpdate, getShellyMainUpdate } = await import('./shelly.js');

    // Set the return value for this specific test case
    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockResolvedValue('1.0.0');

    process.argv.push('-shelly');

    await checkUpdates(matterbridge);

    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge');
    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge', 'dev');
    expect(getNpmPackageVersion).toHaveBeenCalledWith(plugin ? plugin.name : 'unknown-plugin');
    expect(getShellySysUpdate).toHaveBeenCalledWith(matterbridge, expect.any(AnsiLogger), expect.any(BroadcastServer));
    expect(getShellyMainUpdate).toHaveBeenCalledWith(matterbridge, expect.any(AnsiLogger), expect.any(BroadcastServer));
  });

  it('should update to the latest version if versions differ', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils');

    // Set the return value for this specific test case
    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockResolvedValueOnce('1.1.0');

    await getMatterbridgeLatestVersion(matterbridge, log, testServer);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge');
    expect(matterbridge.matterbridgeLatestVersion).toBe('1.1.0');
    expect(loggerNoticeSpy).toHaveBeenCalledWith(`Matterbridge is out of date. Current version: ${matterbridge.matterbridgeVersion}. Latest version: 1.1.0.`);
    expect(wssSendSnackbarMessageSpy).toHaveBeenCalledWith('Matterbridge latest update available', 0, 'info');
    expect(wssSendUpdateRequiredSpy).toHaveBeenCalled();
  });

  it('should log a debug message if the current version is up to date', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils');

    // Set the return value for this specific test case
    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockResolvedValueOnce(matterbridge.matterbridgeVersion);

    await getMatterbridgeLatestVersion(matterbridge, log, testServer);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge');
    expect(matterbridge.matterbridgeLatestVersion).toBe(matterbridge.matterbridgeVersion);
    expect(loggerDebugSpy).toHaveBeenCalledWith(`Matterbridge is up to date. Current version: ${matterbridge.matterbridgeVersion}. Latest version: ${matterbridge.matterbridgeVersion}.`);
    expect(wssSendSnackbarMessageSpy).not.toHaveBeenCalled();
    expect(wssSendUpdateRequiredSpy).not.toHaveBeenCalled();
    expect(wssSendRefreshRequiredSpy).not.toHaveBeenCalled();
  });

  it('should log a warning on error fetching the latest version', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils');

    // Set the return value for this specific test case
    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockRejectedValueOnce(new Error('Network error'));

    await getMatterbridgeLatestVersion(matterbridge, log, testServer);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge');
    expect(loggerWarnSpy).toHaveBeenCalledWith('Error getting Matterbridge latest version: Network error');
  });

  it('should update to the dev version if versions differ', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils');

    matterbridge.matterbridgeVersion = '1.0.0-dev-1';

    // Set the return value for this specific test case
    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockResolvedValueOnce('1.1.0-dev-1');

    await getMatterbridgeDevVersion(matterbridge, log, testServer);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge', 'dev');
    expect(matterbridge.matterbridgeDevVersion).toBe('1.1.0-dev-1');
    expect(loggerNoticeSpy).toHaveBeenCalledWith('Matterbridge@dev is out of date. Current version: 1.0.0-dev-1. Latest dev version: 1.1.0-dev-1.');
    expect(wssSendSnackbarMessageSpy).toHaveBeenCalledWith('Matterbridge dev update available', 0, 'info');
    expect(wssSendUpdateRequiredSpy).toHaveBeenCalled();
  });

  it('should log a debug message if the dev version is up to date', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils');

    matterbridge.matterbridgeVersion = '1.0.0-dev-1';

    // Set the return value for this specific test case
    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockResolvedValueOnce('1.0.0-dev-1');

    await getMatterbridgeDevVersion(matterbridge, log, testServer);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge', 'dev');
    expect(matterbridge.matterbridgeDevVersion).toBe('1.0.0-dev-1');
    expect(loggerDebugSpy).toHaveBeenCalledWith('Matterbridge@dev is up to date. Current version: 1.0.0-dev-1. Latest dev version: 1.0.0-dev-1.');
    expect(wssSendSnackbarMessageSpy).not.toHaveBeenCalled();
    expect(wssSendUpdateRequiredSpy).not.toHaveBeenCalled();
    expect(wssSendRefreshRequiredSpy).not.toHaveBeenCalled();
  });

  it('should log a warning on error fetching the dev version', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils');

    // Set the return value for this specific test case
    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockRejectedValueOnce(new Error('Network error'));

    await getMatterbridgeDevVersion(matterbridge, log, testServer);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge', 'dev');
    expect(loggerWarnSpy).toHaveBeenCalledWith('Error getting Matterbridge latest dev version: Network error');
  });

  it('should update to the plugin latest version if versions differ', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils');

    // Set the return value for this specific test case
    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockResolvedValueOnce('1.1.0');

    expect(plugin).not.toBeNull();
    if (plugin === null) return;
    await getPluginLatestVersion(log, testServer, plugin);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith(plugin.name);
    expect(loggerNoticeSpy).toHaveBeenCalledWith(`The plugin ${plg}${plugin.name}${nt} is out of date. Current version: ${plugin.version}. Latest version: 1.1.0.`);
    expect(wssSendRefreshRequiredSpy).toHaveBeenCalledWith('plugins', undefined);
  });

  it('should log a debug message if the plugin current version is up to date', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils');

    // Set the return value for this specific test case
    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockResolvedValueOnce('1.0.1');

    expect(plugin).not.toBeNull();
    if (plugin === null) return;
    await getPluginLatestVersion(log, testServer, plugin);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith(plugin.name);
    expect(loggerDebugSpy).toHaveBeenCalledWith(`The plugin ${plg}${plugin.name}${db} is up to date. Current version: ${plugin.version}. Latest version: 1.0.1.`);
    expect(wssSendRefreshRequiredSpy).not.toHaveBeenCalled();
  });

  it('should log a warning on error fetching the plugin latest version', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils');

    // Set the return value for this specific test case
    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockRejectedValueOnce(new Error('Network error'));

    expect(plugin).not.toBeNull();
    if (plugin === null) return;
    await getPluginLatestVersion(log, testServer, plugin);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith(plugin.name);
    expect(loggerWarnSpy).toHaveBeenCalledWith(`Error getting plugin ${plg}${plugin.name}${wr} latest version: Network error`);
  });

  it('should update to the plugin dev version and log if versions differ', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils');

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
    expect(wssSendRefreshRequiredSpy).toHaveBeenCalledWith('plugins', undefined);
  });

  it('should update to the plugin dev version and log if the plugin current version is up to date', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils');

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
    expect(wssSendRefreshRequiredSpy).not.toHaveBeenCalled();
  });

  it('should log a warning on error fetching the plugin dev version', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils');

    // Set the return value for this specific test case
    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockRejectedValueOnce(new Error('Network error'));

    expect(plugin).not.toBeNull();
    if (plugin === null) return;
    await getPluginDevVersion(log, testServer, plugin);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith(plugin.name, 'dev');
    expect(loggerDebugSpy).toHaveBeenCalledWith(`Error getting plugin ${plg}${plugin.name}${db} latest dev version: Network error`);
  });

  it('should check GitHub for updates and log', async () => {
    const { getGitHubUpdate } = await import('@matterbridge/utils');

    // Set the return value for this specific test case
    (getGitHubUpdate as jest.MockedFunction<(branch: string, file: string, timeout?: number) => Promise<any>>).mockResolvedValue({
      'latest': '3.1.9',
      'latestDate': '2025-07-??',
      'dev': '3.1.9-dev-123456',
      'devDate': '2025-07-??',
      'latestMessage': 'Bumped matter.js to 0.15.2',
      'latestMessageSeverity': 'info',
      'devMessage': 'Bumped matter.js to 0.15.2',
      'devMessageSeverity': 'info',
    });

    matterbridge.matterbridgeVersion = '1.0.0';
    await checkUpdatesAndLog(matterbridge, log, testServer);
    expect(getGitHubUpdate).toHaveBeenCalledWith('main', 'update.json', 5_000);
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining(`GitHub main update status:`));

    matterbridge.matterbridgeVersion = '1.0.0-dev-1';
    await checkUpdatesAndLog(matterbridge, log, testServer);
    expect(getGitHubUpdate).toHaveBeenCalledWith('dev', 'update.json', 5_000);
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining(`GitHub dev update status:`));
  });

  it('should check GitHub and fail', async () => {
    const { getGitHubUpdate } = await import('@matterbridge/utils');

    // Set the return value for this specific test case
    (getGitHubUpdate as jest.MockedFunction<(branch: string, file: string, timeout?: number) => Promise<any>>).mockRejectedValue(new Error('Network error'));

    matterbridge.matterbridgeVersion = '1.0.0';
    await checkUpdatesAndLog(matterbridge, log, testServer);
    expect(getGitHubUpdate).toHaveBeenCalledWith('main', 'update.json', 5_000);
    expect(loggerDebugSpy).toHaveBeenCalledWith(`Error checking GitHub main updates: Network error`);

    matterbridge.matterbridgeVersion = '1.0.0-dev-1';
    await checkUpdatesAndLog(matterbridge, log, testServer);
    expect(getGitHubUpdate).toHaveBeenCalledWith('dev', 'update.json', 5_000);
    expect(loggerDebugSpy).toHaveBeenCalledWith(`Error checking GitHub dev updates: Network error`);
  });
});
