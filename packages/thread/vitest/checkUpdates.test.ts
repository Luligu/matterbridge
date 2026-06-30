// vitest\checkUpdates.test.ts

const NAME = 'MatterbridgeUpdate';

import type { ApiPlugin } from '@matterbridge/types';
import { plg } from '@matterbridge/types';
import { AnsiLogger, db, LogLevel, nt, TimestampFormat, wr } from 'node-ansi-logger';
import type { Mock } from 'vitest';

import { BroadcastServer } from '../src/broadcastServer.js';
import { checkUpdates, checkUpdatesAndLog, getMatterbridgeDevVersion, getMatterbridgeLatestVersion, getPluginDevVersion, getPluginLatestVersion } from '../src/checkUpdates.js';
import { flushAsync } from './flushAsync.js';
import { matterbridge, startMatterbridge, stopMatterbridge } from './sharedMatterbridge.js';
import { loggerDebugSpy, loggerNoticeSpy, loggerWarnSpy, setupTest } from './vitestSetupTest.js';

// Spy on the @matterbridge/utils subpath exports (tree-shaken subpath imports). Using spy mode patches the real module
// exports in place, so every (possibly concurrent) dynamic import inside checkUpdates() sees the same spy.
vi.mock('@matterbridge/utils/npm-version', { spy: true });

vi.mock('@matterbridge/utils/github-version', { spy: true });

await setupTest(NAME, false);

describe(`Test ${NAME}`, () => {
  // Create BroadcastServer for tests
  const log = new AnsiLogger({ logName: 'TestBroadcastServer', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });
  const testServer = new BroadcastServer('manager', log);
  let plugin: ApiPlugin | null = null;

  beforeAll(async () => {
    // Start the shared matterbridge responders
    await startMatterbridge();
    // Add the mock plugin via the plugins responder so the plugin update tests have a plugin to work with
    plugin = (await testServer.fetch({ type: 'plugins_add', src: testServer.name, dst: 'plugins', params: { nameOrPath: './packages/core/src/mock/plugin1' } }, 5000)).result
      .plugin;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    // Close test server
    testServer.close();
    // Stop matterbridge instance
    await stopMatterbridge();
    // Restore all mocks
    vi.restoreAllMocks();
  });

  it('should add plugin', () => {
    expect(plugin).not.toBe(null);
  });

  it('should keep disabled check update breadcrumbs quiet', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');
    const { getGitHubUpdate } = await import('@matterbridge/utils/github-version');
    const stderrWriteSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    matterbridge.matterbridgeVersion = '1.0.0';
    if (plugin !== null) plugin.version = '1.0.0';
    (getNpmPackageVersion as Mock<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockImplementation(async () => Promise.resolve('1.0.0'));
    (getGitHubUpdate as Mock).mockResolvedValue({});

    try {
      await checkUpdates(matterbridge, testServer);
      expect(stderrWriteSpy).not.toHaveBeenCalled();
    } finally {
      stderrWriteSpy.mockRestore();
    }
  });

  it('should log a debug message when fetching plugins for update check fails', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');
    const { getGitHubUpdate } = await import('@matterbridge/utils/github-version');
    const fetchSpy = vi.spyOn(testServer, 'fetch').mockRejectedValueOnce(new Error('Plugin fetch failed'));
    const stderrWriteSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    matterbridge.matterbridgeVersion = '1.0.0';
    (getNpmPackageVersion as Mock<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockImplementation(async () => Promise.resolve('1.0.0'));
    (getGitHubUpdate as Mock).mockResolvedValue({});

    try {
      await checkUpdates(matterbridge, testServer);
    } finally {
      fetchSpy.mockRestore();
      stderrWriteSpy.mockRestore();
    }

    expect(loggerDebugSpy).toHaveBeenCalledWith('Error fetching plugins for update check: Plugin fetch failed');
    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge');
    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge', 'dev');
    expect(getNpmPackageVersion).toHaveBeenCalledTimes(2);
    expect(getGitHubUpdate).toHaveBeenCalled();
  });

  it('should check updates', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');
    const { getGitHubUpdate } = await import('@matterbridge/utils/github-version');
    const frontendServer = new BroadcastServer('frontend', log);
    const matterbridgeUpdateMessages: { version: string; devVersion: boolean }[] = [];
    const pluginUpdateMessages: { plugin: string; version: string; devVersion: boolean }[] = [];
    const snackbarMessages: string[] = [];

    // Set the return value for this specific test case
    (getNpmPackageVersion as Mock<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockImplementation(async (packageName: string, tag?: string) => {
      if (packageName === 'matterbridge' && tag === 'dev') return Promise.resolve('1.1.0-dev-1');
      if (packageName === 'matterbridge') return Promise.resolve('1.1.0');
      if (tag === 'dev') return Promise.resolve('1.1.0-dev-1');
      return Promise.resolve('1.1.0');
    });
    (getGitHubUpdate as Mock).mockResolvedValue({});
    matterbridge.matterbridgeVersion = '1.0.0-dev-1';
    if (plugin !== null) plugin.version = '1.0.0-dev-1';

    frontendServer.on('broadcast_message', (msg) => {
      if (msg.type === 'frontend_updaterequired' && 'params' in msg) matterbridgeUpdateMessages.push(msg.params);
      if (msg.type === 'frontend_pluginupdaterequired' && 'params' in msg) pluginUpdateMessages.push(msg.params);
      if (msg.type === 'frontend_snackbarmessage' && 'params' in msg) snackbarMessages.push(msg.params.message);
    });

    try {
      await checkUpdates(matterbridge, testServer);
      await flushAsync(undefined, undefined, 100);
    } finally {
      frontendServer.close();
    }

    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge');
    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge', 'dev');
    expect(getNpmPackageVersion).toHaveBeenCalledWith(plugin ? plugin.name : 'unknown-plugin');
    expect(getNpmPackageVersion).toHaveBeenCalledWith(plugin ? plugin.name : 'unknown-plugin', 'dev');
    expect(getGitHubUpdate).toHaveBeenCalled();
    expect(matterbridgeUpdateMessages).toEqual([
      { version: '1.1.0', devVersion: false },
      { version: '1.1.0-dev-1', devVersion: true },
    ]);
    expect(pluginUpdateMessages).toEqual([
      { plugin: plugin?.name, version: '1.1.0', devVersion: false },
      { plugin: plugin?.name, version: '1.1.0-dev-1', devVersion: true },
    ]);
    expect(snackbarMessages).not.toContain('No updates available');
  });

  it('should send plugin version messages when all versions are current', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');
    const { getGitHubUpdate } = await import('@matterbridge/utils/github-version');
    const frontendServer = new BroadcastServer('frontend', log);
    const pluginUpdateMessages: { plugin: string; version: string; devVersion: boolean }[] = [];
    const snackbarMessages: string[] = [];

    matterbridge.matterbridgeVersion = '1.0.0';
    if (plugin !== null) plugin.version = '1.0.1';
    (getNpmPackageVersion as Mock<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockImplementation(async (packageName: string) =>
      Promise.resolve(packageName === 'matterbridge' ? '1.0.0' : '1.0.1'),
    );
    (getGitHubUpdate as Mock).mockResolvedValue({});

    frontendServer.on('broadcast_message', (msg) => {
      if (msg.type === 'frontend_pluginupdaterequired' && 'params' in msg) pluginUpdateMessages.push(msg.params);
      if (msg.type === 'frontend_snackbarmessage' && 'params' in msg) snackbarMessages.push(msg.params.message);
    });

    try {
      await checkUpdates(matterbridge, testServer);
      await flushAsync(undefined, undefined, 100);
    } finally {
      frontendServer.close();
    }

    expect(pluginUpdateMessages).toEqual([
      { plugin: plugin?.name, version: '1.0.1', devVersion: false },
      { plugin: plugin?.name, version: '1.0.1', devVersion: true },
    ]);
    expect(snackbarMessages).toEqual(['No updates available']);
  });

  it('should update to the latest version if versions differ', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');

    // Set the return value for this specific test case
    (getNpmPackageVersion as Mock<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockResolvedValueOnce('1.1.0');

    await getMatterbridgeLatestVersion(matterbridge, log, testServer);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge');
    expect(matterbridge.matterbridgeLatestVersion).toBe('1.1.0');
    expect(loggerNoticeSpy).toHaveBeenCalledWith(`Matterbridge is out of date. Current version: ${matterbridge.matterbridgeVersion}. Latest version: 1.1.0.`);
  });

  it('should log a debug message if the current version is up to date', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');

    // Set the return value for this specific test case
    (getNpmPackageVersion as Mock<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockResolvedValueOnce(matterbridge.matterbridgeVersion);

    await getMatterbridgeLatestVersion(matterbridge, log, testServer);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge');
    expect(matterbridge.matterbridgeLatestVersion).toBe(matterbridge.matterbridgeVersion);
    expect(loggerDebugSpy).toHaveBeenCalledWith(
      `Matterbridge is up to date. Current version: ${matterbridge.matterbridgeVersion}. Latest version: ${matterbridge.matterbridgeVersion}.`,
    );
  });

  it('should log a warning on error fetching the latest version', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');

    // Set the return value for this specific test case
    (getNpmPackageVersion as Mock<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockRejectedValueOnce(new Error('Network error'));

    await getMatterbridgeLatestVersion(matterbridge, log, testServer);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge');
    expect(loggerWarnSpy).toHaveBeenCalledWith('Error getting Matterbridge latest version: Network error');
  });

  it('should log a warning on non-Error fetching the latest version', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');

    (getNpmPackageVersion as Mock<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockRejectedValueOnce('Network error');

    await getMatterbridgeLatestVersion(matterbridge, log, testServer);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge');
    expect(loggerWarnSpy).toHaveBeenCalledWith('Error getting Matterbridge latest version: Network error');
  });

  it('should update to the dev version if versions differ', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');

    matterbridge.matterbridgeVersion = '1.0.0-dev-1';

    // Set the return value for this specific test case
    (getNpmPackageVersion as Mock<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockResolvedValueOnce('1.1.0-dev-1');

    await getMatterbridgeDevVersion(matterbridge, log, testServer);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge', 'dev');
    expect(matterbridge.matterbridgeDevVersion).toBe('1.1.0-dev-1');
    expect(loggerNoticeSpy).toHaveBeenCalledWith('Matterbridge@dev is out of date. Current version: 1.0.0-dev-1. Latest dev version: 1.1.0-dev-1.');
  });

  it('should log a debug message if the dev version is up to date', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');

    matterbridge.matterbridgeVersion = '1.0.0-dev-1';

    // Set the return value for this specific test case
    (getNpmPackageVersion as Mock<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockResolvedValueOnce('1.0.0-dev-1');

    await getMatterbridgeDevVersion(matterbridge, log, testServer);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge', 'dev');
    expect(matterbridge.matterbridgeDevVersion).toBe('1.0.0-dev-1');
    expect(loggerDebugSpy).toHaveBeenCalledWith('Matterbridge@dev is up to date. Current version: 1.0.0-dev-1. Latest dev version: 1.0.0-dev-1.');
  });

  it('should log a warning on error fetching the dev version', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');

    // Set the return value for this specific test case
    (getNpmPackageVersion as Mock<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockRejectedValueOnce(new Error('Network error'));

    await getMatterbridgeDevVersion(matterbridge, log, testServer);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge', 'dev');
    expect(loggerWarnSpy).toHaveBeenCalledWith('Error getting Matterbridge latest dev version: Network error');
  });

  it('should log a warning on non-Error fetching the dev version', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');

    (getNpmPackageVersion as Mock<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockRejectedValueOnce('Network error');

    await getMatterbridgeDevVersion(matterbridge, log, testServer);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge', 'dev');
    expect(loggerWarnSpy).toHaveBeenCalledWith('Error getting Matterbridge latest dev version: Network error');
  });

  it('should update to the dev version if running a git version', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');

    matterbridge.matterbridgeVersion = '1.0.0-git-1';
    (getNpmPackageVersion as Mock<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockResolvedValueOnce('1.1.0-dev-1');

    await getMatterbridgeDevVersion(matterbridge, log, testServer);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge', 'dev');
    expect(loggerNoticeSpy).toHaveBeenCalledWith('Matterbridge@dev is out of date. Current version: 1.0.0-git-1. Latest dev version: 1.1.0-dev-1.');
  });

  it('should log a debug message if the git version is up to date', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');

    matterbridge.matterbridgeVersion = '1.0.0-git-1';
    (getNpmPackageVersion as Mock<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockResolvedValueOnce('1.0.0-git-1');

    await getMatterbridgeDevVersion(matterbridge, log, testServer);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge', 'dev');
    expect(loggerDebugSpy).toHaveBeenCalledWith('Matterbridge@dev is up to date. Current version: 1.0.0-git-1. Latest dev version: 1.0.0-git-1.');
  });

  it('should update to the plugin latest version if versions differ', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');
    const requestSpy = vi.spyOn(testServer, 'request');

    // Set the return value for this specific test case
    (getNpmPackageVersion as Mock<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockResolvedValueOnce('1.1.0');

    expect(plugin).not.toBeNull();
    if (plugin === null) return;
    await getPluginLatestVersion(log, testServer, plugin);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith(plugin.name);
    expect(loggerNoticeSpy).toHaveBeenCalledWith(`The plugin ${plg}${plugin.name}${nt} is out of date. Current version: ${plugin.version}. Latest version: 1.1.0.`);
    expect(requestSpy).toHaveBeenCalledWith({
      type: 'frontend_snackbarmessage',
      src: testServer.name,
      dst: 'frontend',
      params: { message: `Plugin ${plugin.name} latest update available`, timeout: 60, severity: 'info' },
    });
    requestSpy.mockRestore();
  });

  it('should log a debug message if the plugin current version is up to date', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');

    // Set the return value for this specific test case
    (getNpmPackageVersion as Mock<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockResolvedValueOnce('1.0.1');

    expect(plugin).not.toBeNull();
    if (plugin === null) return;
    await getPluginLatestVersion(log, testServer, plugin);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith(plugin.name);
    expect(loggerDebugSpy).toHaveBeenCalledWith(`The plugin ${plg}${plugin.name}${db} is up to date. Current version: ${plugin.version}. Latest version: 1.0.1.`);
  });

  it('should log a warning on error fetching the plugin latest version', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');

    // Set the return value for this specific test case
    (getNpmPackageVersion as Mock<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockRejectedValueOnce(new Error('Network error'));

    expect(plugin).not.toBeNull();
    if (plugin === null) return;
    await getPluginLatestVersion(log, testServer, plugin);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith(plugin.name);
    expect(loggerWarnSpy).toHaveBeenCalledWith(`Error getting plugin ${plg}${plugin.name}${wr} latest version: Network error`);
  });

  it('should log a warning on non-Error fetching the plugin latest version', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');

    (getNpmPackageVersion as Mock<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockRejectedValueOnce('Network error');

    expect(plugin).not.toBeNull();
    if (plugin === null) return;
    await getPluginLatestVersion(log, testServer, plugin);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith(plugin.name);
    expect(loggerWarnSpy).toHaveBeenCalledWith(`Error getting plugin ${plg}${plugin.name}${wr} latest version: Network error`);
  });

  it('should update to the plugin dev version and log if versions differ', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');
    const requestSpy = vi.spyOn(testServer, 'request');

    expect(plugin).not.toBeNull();
    if (plugin === null) return;
    plugin.version = '1.0.0-dev-123456';

    // Set the return value for this specific test case
    (getNpmPackageVersion as Mock<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockResolvedValueOnce('1.1.0-dev-123456');

    await getPluginDevVersion(log, testServer, plugin);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith(plugin.name, 'dev');
    expect(plugin.devVersion).toBe('1.1.0-dev-123456');
    expect(loggerNoticeSpy).toHaveBeenCalledWith(`The plugin ${plg}${plugin.name}${nt} is out of date. Current version: 1.0.0-dev-123456. Latest dev version: 1.1.0-dev-123456.`);
    expect(requestSpy).toHaveBeenCalledWith({
      type: 'frontend_snackbarmessage',
      src: testServer.name,
      dst: 'frontend',
      params: { message: `Plugin ${plugin.name} dev update available`, timeout: 60, severity: 'info' },
    });
    requestSpy.mockRestore();
  });

  it('should update to the plugin dev version and log if the plugin current version is up to date', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');

    expect(plugin).not.toBeNull();
    if (plugin === null) return;
    plugin.version = '1.1.0-dev-123456';

    // Set the return value for this specific test case
    (getNpmPackageVersion as Mock<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockResolvedValueOnce('1.1.0-dev-123456');

    await getPluginDevVersion(log, testServer, plugin);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith(plugin.name, 'dev');
    expect(plugin.devVersion).toBe('1.1.0-dev-123456');
    expect(loggerDebugSpy).toHaveBeenCalledWith(`The plugin ${plg}${plugin.name}${db} is up to date. Current version: 1.1.0-dev-123456. Latest dev version: 1.1.0-dev-123456.`);
  });

  it('should log a warning on error fetching the plugin dev version', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');

    // Set the return value for this specific test case
    (getNpmPackageVersion as Mock<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockRejectedValueOnce(new Error('Network error'));

    expect(plugin).not.toBeNull();
    if (plugin === null) return;
    await getPluginDevVersion(log, testServer, plugin);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith(plugin.name, 'dev');
    expect(loggerDebugSpy).toHaveBeenCalledWith(`Error getting plugin ${plg}${plugin.name}${db} latest dev version: Network error`);
  });

  it('should log a warning on non-Error fetching the plugin dev version', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');

    (getNpmPackageVersion as Mock<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockRejectedValueOnce('Network error');

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
    (getNpmPackageVersion as Mock<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockResolvedValueOnce('1.1.0-dev-123456');

    await getPluginDevVersion(log, testServer, plugin);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith(plugin.name, 'dev');
    expect(loggerNoticeSpy).toHaveBeenCalledWith(`The plugin ${plg}${plugin.name}${nt} is out of date. Current version: 1.0.0-git-123456. Latest dev version: 1.1.0-dev-123456.`);
  });

  it('should not log plugin dev update status when plugin git version is already up to date', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');

    expect(plugin).not.toBeNull();
    if (plugin === null) return;

    plugin.version = '1.0.0-git-123456';
    (getNpmPackageVersion as Mock<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockResolvedValueOnce('1.0.0-git-123456');

    await getPluginDevVersion(log, testServer, plugin);
    await flushAsync(undefined, undefined, 100);

    const pluginDevNotices = (loggerNoticeSpy as Mock).mock.calls.filter((c) => String(c[0]).includes('latest dev version'));
    const pluginDevDebugs = (loggerDebugSpy as Mock).mock.calls.filter((c) => String(c[0]).includes('latest dev version'));
    expect(pluginDevNotices).toHaveLength(0);
    expect(pluginDevDebugs).toHaveLength(0);
  });

  it('should check GitHub for updates and log', async () => {
    const { getGitHubUpdate } = await import('@matterbridge/utils/github-version');

    // Set the return value for this specific test case
    (getGitHubUpdate as Mock<(branch: string, file: string, timeout?: number) => Promise<any>>).mockResolvedValue({
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

    (getGitHubUpdate as Mock<(branch: string, file: string, timeout?: number) => Promise<any>>).mockResolvedValue({
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
  });

  it('should not log dev update status when running a non-dev version', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');

    matterbridge.matterbridgeVersion = '1.0.0';
    (getNpmPackageVersion as Mock<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockResolvedValueOnce('9.9.9-dev-1');

    await getMatterbridgeDevVersion(matterbridge, log, testServer);
    await flushAsync(undefined, undefined, 100);

    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge', 'dev');

    const devNotices = (loggerNoticeSpy as Mock).mock.calls.filter((c) => String(c[0]).includes('Matterbridge@dev'));
    const devDebugs = (loggerDebugSpy as Mock).mock.calls.filter((c) => String(c[0]).includes('Matterbridge@dev'));
    expect(devNotices).toHaveLength(0);
    expect(devDebugs).toHaveLength(0);
  });

  it('should not log plugin dev update status when plugin is not a dev/git version', async () => {
    const { getNpmPackageVersion } = await import('@matterbridge/utils/npm-version');

    expect(plugin).not.toBeNull();
    if (plugin === null) return;

    plugin.version = '1.0.0';
    (getNpmPackageVersion as Mock<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockResolvedValueOnce('9.9.9-dev-1');

    await getPluginDevVersion(log, testServer, plugin);
    await flushAsync(undefined, undefined, 100);

    const pluginDevNotices = (loggerNoticeSpy as Mock).mock.calls.filter((c) => String(c[0]).includes('latest dev version'));
    const pluginDevDebugs = (loggerDebugSpy as Mock).mock.calls.filter((c) => String(c[0]).includes('latest dev version'));
    expect(pluginDevNotices).toHaveLength(0);
    expect(pluginDevDebugs).toHaveLength(0);
  });

  it('should check GitHub and fail', async () => {
    const { getGitHubUpdate } = await import('@matterbridge/utils/github-version');

    // Set the return value for this specific test case
    (getGitHubUpdate as Mock<(branch: string, file: string, timeout?: number) => Promise<any>>).mockRejectedValue(new Error('Network error'));

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

    (getGitHubUpdate as Mock<(branch: string, file: string, timeout?: number) => Promise<any>>).mockRejectedValueOnce('Network error');
    matterbridge.matterbridgeVersion = '1.0.0';
    await checkUpdatesAndLog(matterbridge, log, testServer);
    expect(getGitHubUpdate).toHaveBeenCalledWith('main', expect.stringContaining('update.json'), 5_000);
    expect(loggerDebugSpy).toHaveBeenCalledWith(`Error checking GitHub main updates: Network error`);

    (getGitHubUpdate as Mock<(branch: string, file: string, timeout?: number) => Promise<any>>).mockRejectedValueOnce('Network error');
    matterbridge.matterbridgeVersion = '1.0.0-dev-1';
    await checkUpdatesAndLog(matterbridge, log, testServer);
    expect(getGitHubUpdate).toHaveBeenCalledWith('dev', expect.stringContaining('update.json'), 5_000);
    expect(loggerDebugSpy).toHaveBeenCalledWith(`Error checking GitHub dev updates: Network error`);
  });
});
