/**
 * This file contains the check updates functions.
 *
 * @file update.ts
 * @author Luca Liguori
 * @created 2025-02-24
 * @version 2.0.0
 * @license Apache-2.0
 *
 * Copyright 2025, 2026, 2027 Luca Liguori.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// AnsiLogger module
import { AnsiLogger, db, debugStringify, nt, TimestampFormat, wr } from 'node-ansi-logger';

// Matterbridge module
import { ApiPlugin, plg, SharedMatterbridge } from './matterbridgeTypes.js';
import { BroadcastServer } from './broadcastServer.js';
import { hasParameter } from './utils/commandLine.js';
import { isValidString } from './utils/isvalid.js';

/**
 * Checks for updates for Matterbridge and its plugins.
 * If the 'shelly' parameter is present, also checks for Shelly updates.
 *
 * @param {SharedMatterbridge} matterbridge - The Matterbridge instance.
 * @returns {Promise<void>} A promise that resolves when the update checks are complete.
 */
export async function checkUpdates(matterbridge: SharedMatterbridge): Promise<void> {
  /** Broadcast server */
  const log = new AnsiLogger({ logName: 'MatterbridgeUpdates', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: matterbridge.logLevel });
  const server = new BroadcastServer('updates', log);

  const checkUpdatePromise = checkUpdatesAndLog(matterbridge, log, server);
  const latestVersionPromise = getMatterbridgeLatestVersion(matterbridge, log, server);
  const devVersionPromise = getMatterbridgeDevVersion(matterbridge, log, server);
  const pluginsVersionPromises = [];
  const pluginsDevVersionPromises = [];
  const shellyUpdatesPromises = [];
  const plugins = (await server.fetch({ type: 'plugins_apipluginarray', src: server.name, dst: 'plugins', params: {} })).response.plugins;
  for (const plugin of plugins) {
    pluginsVersionPromises.push(getPluginLatestVersion(log, server, plugin));
    pluginsDevVersionPromises.push(getPluginDevVersion(log, server, plugin));
  }

  if (hasParameter('shelly')) {
    const { getShellySysUpdate, getShellyMainUpdate } = await import('./shelly.js');

    shellyUpdatesPromises.push(getShellySysUpdate(matterbridge, log, server));
    shellyUpdatesPromises.push(getShellyMainUpdate(matterbridge, log, server));
  }
  await Promise.all([checkUpdatePromise, latestVersionPromise, devVersionPromise, ...pluginsVersionPromises, ...pluginsDevVersionPromises, ...shellyUpdatesPromises]);

  server.close();
}

/**
 * Checks for updates and logs from https://matterbridge.io/.
 * If the update check fails, logs a warning message.
 *
 * @param {SharedMatterbridge} matterbridge - The Matterbridge instance.
 * @param {AnsiLogger} log - The logger instance.
 * @param {BroadcastServer} server - The broadcast server instance.
 */
export async function checkUpdatesAndLog(matterbridge: SharedMatterbridge, log: AnsiLogger, server: BroadcastServer): Promise<void> {
  const { getGitHubUpdate } = await import('./utils/network.js');

  const branch = matterbridge.matterbridgeVersion.includes('-dev-') ? 'dev' : 'main';
  try {
    const updateJson = await getGitHubUpdate(branch, 'update.json', 5_000);
    log.debug(`GitHub ${branch} update status: ${debugStringify(updateJson)}.`);
    if (
      isValidString(branch === 'main' ? updateJson.latestMessage : updateJson.devMessage, 1) &&
      isValidString(branch === 'main' ? updateJson.latestMessageSeverity : updateJson.devMessageSeverity, 4) &&
      ['info', 'warning', 'error', 'success'].includes(branch === 'main' ? updateJson.latestMessageSeverity : updateJson.devMessageSeverity)
    ) {
      log.notice(`GitHub ${branch} update message: ${branch === 'main' ? updateJson.latestMessage : updateJson.devMessage}`);
      server.request({
        type: 'frontend_snackbarmessage',
        src: server.name,
        dst: 'frontend',
        params: { message: branch === 'main' ? updateJson.latestMessage : updateJson.devMessage, timeout: 0, severity: branch === 'main' ? updateJson.latestMessageSeverity : updateJson.devMessageSeverity },
      });
      // matterbridge.frontend.wssSendSnackbarMessage(branch === 'main' ? updateJson.latestMessage : updateJson.devMessage, 0, branch === 'main' ? updateJson.latestMessageSeverity : updateJson.devMessageSeverity);
    }
  } catch (error) {
    log.debug(`Error checking GitHub ${branch} updates: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Retrieves the latest version of Matterbridge and updates the matterbridgeLatestVersion property.
 * If there is an error retrieving the latest version, logs an error message.
 *
 * @param {SharedMatterbridge} matterbridge - The Matterbridge instance.
 * @param {AnsiLogger} log - The logger instance.
 * @param {BroadcastServer} server - The broadcast server instance.
 * @returns {Promise<string | undefined>} A promise that resolves when the latest version is retrieved.
 */
export async function getMatterbridgeLatestVersion(matterbridge: SharedMatterbridge, log: AnsiLogger, server: BroadcastServer): Promise<string | undefined> {
  const { getNpmPackageVersion } = await import('./utils/network.js');

  try {
    const version = await getNpmPackageVersion('matterbridge');
    server.request({ type: 'matterbridge_latest_version', src: server.name, dst: 'matterbridge', params: { version } });
    // matterbridge.matterbridgeLatestVersion = version;
    // await matterbridge.nodeContext?.set<string>('matterbridgeLatestVersion', matterbridge.matterbridgeLatestVersion);
    if (matterbridge.matterbridgeVersion !== version) {
      log.notice(`Matterbridge is out of date. Current version: ${matterbridge.matterbridgeVersion}. Latest version: ${version}.`);
      server.request({
        type: 'frontend_snackbarmessage',
        src: server.name,
        dst: 'frontend',
        params: { message: 'Matterbridge latest update available', timeout: 0, severity: 'info' },
      });
      // matterbridge.frontend.wssSendSnackbarMessage('Matterbridge latest update available', 0, 'info');
      server.request({ type: 'frontend_updaterequired', src: server.name, dst: 'frontend', params: { devVersion: false } });
      // matterbridge.frontend.wssSendUpdateRequired();
      server.request({ type: 'frontend_refreshrequired', src: server.name, dst: 'frontend', params: { changed: 'settings' } });
      // matterbridge.frontend.wssSendRefreshRequired('settings');
    } else {
      log.debug(`Matterbridge is up to date. Current version: ${matterbridge.matterbridgeVersion}. Latest version: ${version}.`);
    }
    return version;
  } catch (error) {
    // logError(matterbridge.log, `Error getting Matterbridge latest version`, error);
    log.warn(`Error getting Matterbridge latest version: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Retrieves the latest dev version of Matterbridge and updates the matterbridgeDevVersion property.
 * If there is an error retrieving the latest version, logs an error message.
 *
 * @param {SharedMatterbridge} matterbridge - The Matterbridge instance.
 * @param {AnsiLogger} log - The logger instance.
 * @param {BroadcastServer} server - The broadcast server instance.
 * @returns {Promise<string | undefined>} A promise that resolves when the latest dev version is retrieved.
 */
export async function getMatterbridgeDevVersion(matterbridge: SharedMatterbridge, log: AnsiLogger, server: BroadcastServer): Promise<string | undefined> {
  const { getNpmPackageVersion } = await import('./utils/network.js');

  try {
    const version = await getNpmPackageVersion('matterbridge', 'dev');
    server.request({ type: 'matterbridge_dev_version', src: server.name, dst: 'matterbridge', params: { version } });
    // matterbridge.matterbridgeDevVersion = version;
    // await matterbridge.nodeContext?.set<string>('matterbridgeDevVersion', version);
    if (matterbridge.matterbridgeVersion.includes('-dev-') && matterbridge.matterbridgeVersion !== version) {
      log.notice(`Matterbridge@dev is out of date. Current version: ${matterbridge.matterbridgeVersion}. Latest dev version: ${version}.`);
      server.request({
        type: 'frontend_snackbarmessage',
        src: server.name,
        dst: 'frontend',
        params: { message: 'Matterbridge dev update available', timeout: 0, severity: 'info' },
      });
      // matterbridge.frontend.wssSendSnackbarMessage('Matterbridge dev update available', 0, 'info');
      server.request({ type: 'frontend_updaterequired', src: server.name, dst: 'frontend', params: { devVersion: true } });
      // matterbridge.frontend.wssSendUpdateRequired(true);
      server.request({ type: 'frontend_refreshrequired', src: server.name, dst: 'frontend', params: { changed: 'settings' } });
      // matterbridge.frontend.wssSendRefreshRequired('settings');
    } else if (matterbridge.matterbridgeVersion.includes('-dev-') && matterbridge.matterbridgeVersion === version) {
      log.debug(`Matterbridge@dev is up to date. Current version: ${matterbridge.matterbridgeVersion}. Latest dev version: ${version}.`);
    }
    return version;
  } catch (error) {
    log.warn(`Error getting Matterbridge latest dev version: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Retrieves the latest version of a plugin and updates the plugin's latestVersion property.
 * If there is an error retrieving the latest version, logs an error message.
 *
 * @param {AnsiLogger} log - The logger instance.
 * @param {BroadcastServer} server - The broadcast server instance.
 * @param {ApiPlugin} plugin - The plugin for which to retrieve the latest version.
 * @returns {Promise<string | undefined>} A promise that resolves when the latest version is retrieved.
 */
export async function getPluginLatestVersion(log: AnsiLogger, server: BroadcastServer, plugin: ApiPlugin): Promise<string | undefined> {
  const { getNpmPackageVersion } = await import('./utils/network.js');

  try {
    const version = await getNpmPackageVersion(plugin.name);
    plugin.latestVersion = version;
    server.request({ type: 'plugins_set_latest_version', src: server.name, dst: 'plugins', params: { plugin, version } });
    if (plugin.version !== plugin.latestVersion) {
      log.notice(`The plugin ${plg}${plugin.name}${nt} is out of date. Current version: ${plugin.version}. Latest version: ${plugin.latestVersion}.`);
      server.request({ type: 'frontend_refreshrequired', src: server.name, dst: 'frontend', params: { changed: 'plugins' } });
      // matterbridge.frontend.wssSendRefreshRequired('plugins');
    } else {
      log.debug(`The plugin ${plg}${plugin.name}${db} is up to date. Current version: ${plugin.version}. Latest version: ${plugin.latestVersion}.`);
    }
    return version;
  } catch (error) {
    log.warn(`Error getting plugin ${plg}${plugin.name}${wr} latest version: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Retrieves the latest dev version of a plugin and updates the plugin's devVersion property.
 * If there is an error retrieving the latest version, logs an error message.
 *
 * @param {AnsiLogger} log - The logger instance.
 * @param {BroadcastServer} server - The broadcast server instance.
 * @param {ApiPlugin} plugin - The plugin for which to retrieve the latest version.
 * @returns {Promise<string | undefined>} A promise that resolves when the latest dev version is retrieved.
 */
export async function getPluginDevVersion(log: AnsiLogger, server: BroadcastServer, plugin: ApiPlugin): Promise<string | undefined> {
  const { getNpmPackageVersion } = await import('./utils/network.js');

  try {
    const version = await getNpmPackageVersion(plugin.name, 'dev');
    plugin.devVersion = version;
    server.request({ type: 'plugins_set_dev_version', src: server.name, dst: 'plugins', params: { plugin, version } });
    if (plugin.version.includes('-dev-') && plugin.version !== plugin.devVersion) {
      log.notice(`The plugin ${plg}${plugin.name}${nt} is out of date. Current version: ${plugin.version}. Latest dev version: ${plugin.devVersion}.`);
      server.request({ type: 'frontend_refreshrequired', src: server.name, dst: 'frontend', params: { changed: 'plugins' } });
      // matterbridge.frontend.wssSendRefreshRequired('plugins');
    } else if (plugin.version.includes('-dev-') && plugin.version === plugin.devVersion) {
      log.debug(`The plugin ${plg}${plugin.name}${db} is up to date. Current version: ${plugin.version}. Latest dev version: ${plugin.devVersion}.`);
    }
    return version;
  } catch (error) {
    log.debug(`Error getting plugin ${plg}${plugin.name}${db} latest dev version: ${error instanceof Error ? error.message : error}`);
  }
}
