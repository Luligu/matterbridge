/**
 * This file contains the check updates functions.
 *
 * @file update.ts
 * @author Luca Liguori
 * @date 2025-02-24
 * @version 1.0.0
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
 * limitations under the License. *
 */

import { Matterbridge } from './matterbridge.js';
import { plg, RegisteredPlugin } from './matterbridgeTypes.js';
import { db, nt, wr } from './logger/export.js';

/**
 * Checks for updates for Matterbridge and its plugins.
 * If the 'shelly' parameter is present, also checks for Shelly updates.
 *
 * @param {Matterbridge} matterbridge - The Matterbridge instance.
 * @returns {Promise<void>} A promise that resolves when the update checks are complete.
 */
export async function checkUpdates(matterbridge: Matterbridge): Promise<void> {
  const { hasParameter } = await import('./utils/parameter.js');

  getMatterbridgeLatestVersion(matterbridge);
  getMatterbridgeDevVersion(matterbridge);
  for (const plugin of matterbridge.plugins) {
    getPluginLatestVersion(matterbridge, plugin);
  }
  if (hasParameter('shelly')) {
    const { getShellySysUpdate, getShellyMainUpdate } = await import('./shelly.js');
    getShellySysUpdate(matterbridge);
    getShellyMainUpdate(matterbridge);
  }
}

/**
 * Retrieves the latest version of Matterbridge and updates the matterbridgeLatestVersion property.
 * If there is an error retrieving the latest version, logs an error message.
 *
 * @param {Matterbridge} matterbridge - The Matterbridge instance.
 * @returns {Promise<void>} A promise that resolves when the latest version is retrieved.
 */
async function getMatterbridgeLatestVersion(matterbridge: Matterbridge): Promise<void> {
  const { getNpmPackageVersion } = await import('./utils/network.js');

  getNpmPackageVersion('matterbridge')
    .then(async (version) => {
      matterbridge.matterbridgeLatestVersion = version;
      matterbridge.matterbridgeInformation.matterbridgeLatestVersion = version;
      await matterbridge.nodeContext?.set<string>('matterbridgeLatestVersion', matterbridge.matterbridgeLatestVersion);
      if (matterbridge.matterbridgeVersion !== matterbridge.matterbridgeLatestVersion) {
        matterbridge.log.notice(`Matterbridge is out of date. Current version: ${matterbridge.matterbridgeVersion}. Latest version: ${matterbridge.matterbridgeLatestVersion}.`);
        matterbridge.frontend.wssSendRefreshRequired('matterbridgeLatestVersion');
        matterbridge.frontend.wssSendUpdateRequired();
      } else {
        matterbridge.log.debug(`Matterbridge is up to date. Current version: ${matterbridge.matterbridgeVersion}. Latest version: ${matterbridge.matterbridgeLatestVersion}.`);
      }
    })
    .catch((error) => {
      matterbridge.log.warn(`Error getting Matterbridge latest version: ${error.message}`);
    });
}

/**
 * Retrieves the latest dev version of Matterbridge and updates the matterbridgeDevVersion property.
 * If there is an error retrieving the latest version, logs an error message.
 *
 * @param {Matterbridge} matterbridge - The Matterbridge instance.
 * @returns {Promise<void>} A promise that resolves when the latest dev version is retrieved.
 */
async function getMatterbridgeDevVersion(matterbridge: Matterbridge): Promise<void> {
  const { getNpmPackageVersion } = await import('./utils/network.js');

  getNpmPackageVersion('matterbridge', 'dev')
    .then(async (version) => {
      matterbridge.matterbridgeDevVersion = version;
      matterbridge.matterbridgeInformation.matterbridgeDevVersion = version;
      await matterbridge.nodeContext?.set<string>('matterbridgeDevVersion', version);
      if (matterbridge.matterbridgeVersion.includes('-dev.') && matterbridge.matterbridgeVersion !== version) {
        matterbridge.log.notice(`Matterbridge@dev is out of date. Current version: ${matterbridge.matterbridgeVersion}. Latest dev version: ${matterbridge.matterbridgeDevVersion}.`);
        matterbridge.frontend.wssSendRefreshRequired('matterbridgeDevVersion');
        matterbridge.frontend.wssSendUpdateRequired();
      }
    })
    .catch((error) => {
      matterbridge.log.warn(`Error getting Matterbridge latest dev version: ${error.message}`);
    });
}

/**
 * Retrieves the latest version of a plugin and updates the plugin's latestVersion property.
 * If there is an error retrieving the latest version, logs an error message.
 *
 * @param {Matterbridge} matterbridge - The Matterbridge instance.
 * @param {RegisteredPlugin} plugin - The plugin for which to retrieve the latest version.
 * @returns {Promise<void>} A promise that resolves when the latest version is retrieved.
 */
async function getPluginLatestVersion(matterbridge: Matterbridge, plugin: RegisteredPlugin): Promise<void> {
  const { getNpmPackageVersion } = await import('./utils/network.js');

  getNpmPackageVersion(plugin.name)
    .then((version) => {
      plugin.latestVersion = version;
      if (plugin.version !== plugin.latestVersion) {
        matterbridge.log.notice(`The plugin ${plg}${plugin.name}${nt} is out of date. Current version: ${plugin.version}. Latest version: ${plugin.latestVersion}.`);
        matterbridge.frontend.wssSendRefreshRequired('plugins');
      } else {
        matterbridge.log.debug(`The plugin ${plg}${plugin.name}${db} is up to date. Current version: ${plugin.version}. Latest version: ${plugin.latestVersion}.`);
      }
    })
    .catch((error) => {
      matterbridge.log.warn(`Error getting ${plg}${plugin.name}${wr} latest version: ${error.message}`);
    });
}
