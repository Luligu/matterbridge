// src\update.test.ts

import { jest } from '@jest/globals';
import { db, nt, wr } from 'node-ansi-logger';

import type { Matterbridge } from './matterbridge.js';
import { checkUpdates, getMatterbridgeLatestVersion, getMatterbridgeDevVersion, getPluginLatestVersion, getPluginDevVersion, checkUpdatesAndLog } from './update.js';
import { plg, RegisteredPlugin } from './matterbridgeTypes.js';

// Mock the function getNpmPackageVersion
jest.unstable_mockModule('./utils/network.js', () => ({
  getNpmPackageVersion: jest.fn(),
  getGitHubUpdate: jest.fn(),
}));

// Mock the function getShellySysUpdate and getShellyMainUpdate
jest.unstable_mockModule('./shelly.js', () => ({
  getShellySysUpdate: jest.fn(),
  getShellyMainUpdate: jest.fn(),
}));

describe('getMatterbridgeLatestVersion', () => {
  let matterbridgeMock: Matterbridge;
  let pluginMock: RegisteredPlugin;

  beforeEach(() => {
    pluginMock = {
      name: 'matterbridge-test',
      version: '1.0.0',
      latestVersion: {},
    } as unknown as RegisteredPlugin;

    matterbridgeMock = {
      matterbridgeVersion: '1.0.0',
      matterbridgeInformation: {},
      log: {
        notice: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
      },
      frontend: {
        wssSendSnackbarMessage: jest.fn(),
        wssSendRefreshRequired: jest.fn(),
        wssSendUpdateRequired: jest.fn(),
      },
      nodeContext: {
        set: jest.fn(),
      },
      plugins: [pluginMock],
    } as unknown as Matterbridge;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.resetModules();
    jest.restoreAllMocks();
  });

  it('should check updates', async () => {
    const { getNpmPackageVersion } = await import('./utils/network.js');
    const { getShellySysUpdate, getShellyMainUpdate } = await import('./shelly.js');

    // Set the return value for this specific test case
    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockResolvedValue('1.0.0');

    process.argv.push('-shelly');

    await checkUpdates(matterbridgeMock);

    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge');
    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge', 'dev');
    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge-test');
    expect(getShellySysUpdate).toHaveBeenCalledWith(matterbridgeMock);
    expect(getShellyMainUpdate).toHaveBeenCalledWith(matterbridgeMock);
  });

  it('should update to the latest version if versions differ', async () => {
    const { getNpmPackageVersion } = await import('./utils/network.js');

    // Set the return value for this specific test case
    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockResolvedValueOnce('1.1.0');

    await getMatterbridgeLatestVersion(matterbridgeMock);

    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge');
    expect(matterbridgeMock.matterbridgeVersion).toBe('1.0.0');
    expect(matterbridgeMock.matterbridgeLatestVersion).toBe('1.1.0');
    expect(matterbridgeMock.matterbridgeInformation.matterbridgeLatestVersion).toBe('1.1.0');
    expect(matterbridgeMock.log.notice).toHaveBeenCalledWith('Matterbridge is out of date. Current version: 1.0.0. Latest version: 1.1.0.');
    expect(matterbridgeMock.frontend.wssSendSnackbarMessage).toHaveBeenCalledWith('Matterbridge latest update available', 0, 'info');
    expect(matterbridgeMock.frontend.wssSendRefreshRequired).toHaveBeenCalledWith('matterbridgeLatestVersion');
    expect(matterbridgeMock.frontend.wssSendUpdateRequired).toHaveBeenCalled();
  });

  it('should log a debug message if the current version is up to date', async () => {
    const { getNpmPackageVersion } = await import('./utils/network.js');

    // Set the return value for this specific test case
    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockResolvedValueOnce('1.0.0');

    await getMatterbridgeLatestVersion(matterbridgeMock);

    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge');
    expect(matterbridgeMock.matterbridgeVersion).toBe('1.0.0');
    expect(matterbridgeMock.matterbridgeLatestVersion).toBe('1.0.0');
    expect(matterbridgeMock.matterbridgeInformation.matterbridgeLatestVersion).toBe('1.0.0');
    expect(matterbridgeMock.log.debug).toHaveBeenCalledWith('Matterbridge is up to date. Current version: 1.0.0. Latest version: 1.0.0.');
    expect(matterbridgeMock.frontend.wssSendSnackbarMessage).not.toHaveBeenCalled();
    expect(matterbridgeMock.frontend.wssSendRefreshRequired).not.toHaveBeenCalled();
    expect(matterbridgeMock.frontend.wssSendUpdateRequired).not.toHaveBeenCalled();
  });

  it('should log a warning on error fetching the latest version', async () => {
    const { getNpmPackageVersion } = await import('./utils/network.js');

    // Set the return value for this specific test case
    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockRejectedValueOnce(new Error('Network error'));

    await getMatterbridgeLatestVersion(matterbridgeMock);

    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge');
    expect(matterbridgeMock.log.warn).toHaveBeenCalledWith('Error getting Matterbridge latest version: Network error');
  });

  it('should update to the dev version if versions differ', async () => {
    const { getNpmPackageVersion } = await import('./utils/network.js');

    matterbridgeMock.matterbridgeVersion = '1.0.0-dev-1';

    // Set the return value for this specific test case
    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockResolvedValueOnce('1.1.0-dev-1');

    await getMatterbridgeDevVersion(matterbridgeMock);

    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge', 'dev');
    expect(matterbridgeMock.matterbridgeVersion).toBe('1.0.0-dev-1');
    expect(matterbridgeMock.matterbridgeDevVersion).toBe('1.1.0-dev-1');
    expect(matterbridgeMock.matterbridgeInformation.matterbridgeDevVersion).toBe('1.1.0-dev-1');
    expect(matterbridgeMock.log.notice).toHaveBeenCalledWith('Matterbridge@dev is out of date. Current version: 1.0.0-dev-1. Latest dev version: 1.1.0-dev-1.');
    expect(matterbridgeMock.frontend.wssSendSnackbarMessage).toHaveBeenCalledWith('Matterbridge dev update available', 0, 'info');
    expect(matterbridgeMock.frontend.wssSendRefreshRequired).toHaveBeenCalledWith('matterbridgeDevVersion');
    expect(matterbridgeMock.frontend.wssSendUpdateRequired).toHaveBeenCalled();
  });

  it('should log a debug message if the dev version is up to date', async () => {
    const { getNpmPackageVersion } = await import('./utils/network.js');

    matterbridgeMock.matterbridgeVersion = '1.0.0-dev-1';

    // Set the return value for this specific test case
    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockResolvedValueOnce('1.0.0-dev-1');

    await getMatterbridgeDevVersion(matterbridgeMock);

    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge', 'dev');
    expect(matterbridgeMock.matterbridgeVersion).toBe('1.0.0-dev-1');
    expect(matterbridgeMock.matterbridgeDevVersion).toBe('1.0.0-dev-1');
    expect(matterbridgeMock.matterbridgeInformation.matterbridgeDevVersion).toBe('1.0.0-dev-1');
    expect(matterbridgeMock.log.debug).toHaveBeenCalledWith('Matterbridge@dev is up to date. Current version: 1.0.0-dev-1. Latest dev version: 1.0.0-dev-1.');
    expect(matterbridgeMock.frontend.wssSendRefreshRequired).not.toHaveBeenCalled();
    expect(matterbridgeMock.frontend.wssSendUpdateRequired).not.toHaveBeenCalled();
  });

  it('should log a warning on error fetching the dev version', async () => {
    const { getNpmPackageVersion } = await import('./utils/network.js');

    // Set the return value for this specific test case
    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockRejectedValueOnce(new Error('Network error'));

    await getMatterbridgeDevVersion(matterbridgeMock);

    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge', 'dev');
    expect(matterbridgeMock.log.warn).toHaveBeenCalledWith('Error getting Matterbridge latest dev version: Network error');
  });

  it('should update to the plugin latest version if versions differ', async () => {
    const { getNpmPackageVersion } = await import('./utils/network.js');

    // Set the return value for this specific test case
    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockResolvedValueOnce('1.1.0');

    await getPluginLatestVersion(matterbridgeMock, pluginMock);

    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge-test');
    expect(pluginMock.version).toBe('1.0.0');
    expect(pluginMock.latestVersion).toBe('1.1.0');
    expect(matterbridgeMock.log.notice).toHaveBeenCalledWith(`The plugin ${plg}matterbridge-test${nt} is out of date. Current version: 1.0.0. Latest version: 1.1.0.`);
    expect(matterbridgeMock.frontend.wssSendRefreshRequired).toHaveBeenCalledWith('plugins');
  });

  it('should log a debug message if the plugin current version is up to date', async () => {
    const { getNpmPackageVersion } = await import('./utils/network.js');

    // Set the return value for this specific test case
    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockResolvedValueOnce('1.0.0');

    await getPluginLatestVersion(matterbridgeMock, pluginMock);

    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge-test');
    expect(pluginMock.version).toBe('1.0.0');
    expect(pluginMock.latestVersion).toBe('1.0.0');
    expect(matterbridgeMock.log.debug).toHaveBeenCalledWith(`The plugin ${plg}matterbridge-test${db} is up to date. Current version: 1.0.0. Latest version: 1.0.0.`);
    expect(matterbridgeMock.frontend.wssSendRefreshRequired).not.toHaveBeenCalled();
  });

  it('should log a warning on error fetching the plugin latest version', async () => {
    const { getNpmPackageVersion } = await import('./utils/network.js');

    // Set the return value for this specific test case
    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockRejectedValueOnce(new Error('Network error'));

    await getPluginLatestVersion(matterbridgeMock, pluginMock);

    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge-test');
    expect(matterbridgeMock.log.warn).toHaveBeenCalledWith(`Error getting plugin ${plg}matterbridge-test${wr} latest version: Network error`);
  });

  it('should update to the plugin dev version and log if versions differ', async () => {
    const { getNpmPackageVersion } = await import('./utils/network.js');

    pluginMock.version = '1.0.0-dev-123456';

    // Set the return value for this specific test case
    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockResolvedValueOnce('1.1.0-dev-123456');

    await getPluginDevVersion(matterbridgeMock, pluginMock);

    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge-test', 'dev');
    expect(pluginMock.version).toBe('1.0.0-dev-123456');
    expect(pluginMock.devVersion).toBe('1.1.0-dev-123456');
    expect(matterbridgeMock.log.notice).toHaveBeenCalledWith(`The plugin ${plg}matterbridge-test${nt} is out of date. Current version: 1.0.0-dev-123456. Latest dev version: 1.1.0-dev-123456.`);
    expect(matterbridgeMock.frontend.wssSendRefreshRequired).toHaveBeenCalledWith('plugins');
  });

  it('should update to the plugin dev version and log if the plugin current version is up to date', async () => {
    const { getNpmPackageVersion } = await import('./utils/network.js');

    pluginMock.version = '1.1.0-dev-123456';

    // Set the return value for this specific test case
    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockResolvedValueOnce('1.1.0-dev-123456');

    await getPluginDevVersion(matterbridgeMock, pluginMock);

    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge-test', 'dev');
    expect(pluginMock.version).toBe('1.1.0-dev-123456');
    expect(pluginMock.devVersion).toBe('1.1.0-dev-123456');
    expect(matterbridgeMock.log.debug).toHaveBeenCalledWith(`The plugin ${plg}matterbridge-test${db} is up to date. Current version: 1.1.0-dev-123456. Latest dev version: 1.1.0-dev-123456.`);
    expect(matterbridgeMock.frontend.wssSendRefreshRequired).not.toHaveBeenCalled();
  });

  it('should log a warning on error fetching the plugin dev version', async () => {
    const { getNpmPackageVersion } = await import('./utils/network.js');

    // Set the return value for this specific test case
    (getNpmPackageVersion as jest.MockedFunction<(packageName: string, tag?: string, timeout?: number) => Promise<string>>).mockRejectedValueOnce(new Error('Network error'));

    await getPluginDevVersion(matterbridgeMock, pluginMock);

    expect(getNpmPackageVersion).toHaveBeenCalledWith('matterbridge-test', 'dev');
    expect(matterbridgeMock.log.debug).toHaveBeenCalledWith(`Error getting plugin ${plg}matterbridge-test${db} latest dev version: Network error`);
  });

  it('should check GitHub for updates and log', async () => {
    const { getGitHubUpdate } = await import('./utils/network.js');

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

    await checkUpdatesAndLog(matterbridgeMock);
    expect(getGitHubUpdate).toHaveBeenCalledWith('main', 'update.json', 5_000);
    expect(matterbridgeMock.log.debug).toHaveBeenCalledWith(expect.stringContaining(`GitHub main update status:`));

    matterbridgeMock.matterbridgeVersion = '1.0.0-dev-1';
    await checkUpdatesAndLog(matterbridgeMock);
    expect(getGitHubUpdate).toHaveBeenCalledWith('dev', 'update.json', 5_000);
    expect(matterbridgeMock.log.debug).toHaveBeenCalledWith(expect.stringContaining(`GitHub dev update status:`));
    matterbridgeMock.matterbridgeVersion = '1.0.0';
  });

  it('should check GitHub and fail', async () => {
    const { getGitHubUpdate } = await import('./utils/network.js');

    // Set the return value for this specific test case
    (getGitHubUpdate as jest.MockedFunction<(branch: string, file: string, timeout?: number) => Promise<any>>).mockRejectedValue(new Error('Network error'));

    await checkUpdatesAndLog(matterbridgeMock);
    expect(getGitHubUpdate).toHaveBeenCalledWith('main', 'update.json', 5_000);
    expect(matterbridgeMock.log.debug).toHaveBeenCalledWith(`Error checking GitHub main updates: Network error`);

    matterbridgeMock.matterbridgeVersion = '1.0.0-dev-1';
    await checkUpdatesAndLog(matterbridgeMock);
    expect(getGitHubUpdate).toHaveBeenCalledWith('dev', 'update.json', 5_000);
    expect(matterbridgeMock.log.debug).toHaveBeenCalledWith(`Error checking GitHub dev updates: Network error`);
    matterbridgeMock.matterbridgeVersion = '1.0.0';
  });
});
