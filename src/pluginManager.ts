/**
 * This file contains the Plugins class.
 *
 * @file plugins.ts
 * @author Luca Liguori
 * @created 2024-07-14
 * @version 1.1.2
 * @license Apache-2.0
 *
 * Copyright 2024, 2025, 2026 Luca Liguori.
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

// Node.js import
import EventEmitter from 'node:events';
import type { ExecException } from 'node:child_process';

// AnsiLogger module
import { AnsiLogger, LogLevel, TimestampFormat, UNDERLINE, UNDERLINEOFF, BLUE, db, er, nf, nt, rs, wr } from 'node-ansi-logger';
// NodeStorage module
import { NodeStorage } from 'node-persist-manager';

// Matterbridge
import { Matterbridge } from './matterbridge.js';
import { MatterbridgePlatform, PlatformConfig, PlatformSchema } from './matterbridgePlatform.js';
import { plg, RegisteredPlugin, typ } from './matterbridgeTypes.js';

interface PluginManagerEvents {
  added: [name: string];
  removed: [name: string];
  loaded: [name: string];
  enabled: [name: string];
  disabled: [name: string];
  installed: [name: string, version: string | undefined];
  uninstalled: [name: string];
  started: [name: string];
  configured: [name: string];
  shutdown: [name: string];
}

export class PluginManager extends EventEmitter<PluginManagerEvents> {
  private _plugins = new Map<string, RegisteredPlugin>();
  private nodeContext: NodeStorage;
  private matterbridge: Matterbridge;
  private log: AnsiLogger;

  constructor(matterbridge: Matterbridge) {
    super();
    this.matterbridge = matterbridge;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.nodeContext = (matterbridge as any).nodeContext;
    this.log = new AnsiLogger({ logName: 'PluginManager', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: matterbridge.log.logLevel });
    this.log.debug('Matterbridge plugin manager starting...');
  }

  get length(): number {
    return this._plugins.size;
  }

  get size(): number {
    return this._plugins.size;
  }

  has(name: string): boolean {
    return this._plugins.has(name);
  }

  get(name: string): RegisteredPlugin | undefined {
    return this._plugins.get(name);
  }

  set(plugin: RegisteredPlugin): RegisteredPlugin {
    this._plugins.set(plugin.name, plugin);
    return plugin;
  }

  clear(): void {
    this._plugins.clear();
  }

  array(): RegisteredPlugin[] {
    return Array.from(this._plugins.values());
  }

  [Symbol.iterator]() {
    return this._plugins.values();
  }

  async forEach(callback: (plugin: RegisteredPlugin) => Promise<void>): Promise<void> {
    if (this.size === 0) return;

    const tasks = Array.from(this._plugins.values()).map(async (plugin) => {
      try {
        await callback(plugin);
      } catch (err) {
        this.log.error(`Error processing forEach plugin ${plg}${plugin.name}${er}: ${err instanceof Error ? err.message + '\n' + err.stack : err}`);
        // throw error;
      }
    });
    await Promise.all(tasks);
  }

  set logLevel(logLevel: LogLevel) {
    this.log.logLevel = logLevel;
  }

  /**
   * Loads registered plugins from storage.
   *
   * This method retrieves an array of registered plugins from the storage and converts it
   * into a map where the plugin names are the keys and the plugin objects are the values.
   *
   * @returns {Promise<RegisteredPlugin[]>} A promise that resolves to an array of registered plugins.
   */
  async loadFromStorage(): Promise<RegisteredPlugin[]> {
    // Load the array from storage and convert it to a map
    const pluginsArray = await this.nodeContext.get<RegisteredPlugin[]>('plugins', []);
    for (const plugin of pluginsArray) this._plugins.set(plugin.name, plugin);
    return pluginsArray;
  }

  /**
   * Loads registered plugins from storage.
   *
   * This method retrieves an array of registered plugins from the storage and converts it
   * into a map where the plugin names are the keys and the plugin objects are the values.
   *
   * @returns {Promise<RegisteredPlugin[]>} A promise that resolves to an array of registered plugins.
   */
  async saveToStorage(): Promise<number> {
    // Convert the map to an array
    const plugins: RegisteredPlugin[] = [];
    const pluginArrayFromMap = Array.from(this._plugins.values());
    for (const plugin of pluginArrayFromMap) {
      plugins.push({
        name: plugin.name,
        path: plugin.path,
        type: plugin.type,
        version: plugin.version,
        description: plugin.description,
        author: plugin.author,
        enabled: plugin.enabled,
        qrPairingCode: plugin.qrPairingCode,
        manualPairingCode: plugin.manualPairingCode,
      });
    }
    await this.nodeContext.set<RegisteredPlugin[]>('plugins', plugins);
    this.log.debug(`Saved ${BLUE}${plugins.length}${db} plugins to storage`);
    return plugins.length;
  }

  /**
   * Resolves the name of a plugin by loading and parsing its package.json file.
   *
   * @param {string} pluginPath - The path to the plugin or the path to the plugin's package.json file.
   * @returns {Promise<string | null>} A promise that resolves to the path of the plugin's package.json file or null if it could not be resolved.
   */
  async resolve(pluginPath: string): Promise<string | null> {
    const { default: path } = await import('node:path');
    const { promises } = await import('node:fs');
    if (!pluginPath.endsWith('package.json')) pluginPath = path.join(pluginPath, 'package.json');

    // Resolve the package.json of the plugin
    let packageJsonPath = path.resolve(pluginPath);
    this.log.debug(`Resolving plugin path ${plg}${packageJsonPath}${db}`);

    // Check if the package.json file exists
    try {
      await promises.access(packageJsonPath);
    } catch {
      this.log.debug(`Package.json not found at ${plg}${packageJsonPath}${db}`);
      packageJsonPath = path.join(this.matterbridge.globalModulesDirectory, pluginPath);
      this.log.debug(`Trying at ${plg}${packageJsonPath}${db}`);
    }
    try {
      // Load the package.json of the plugin
      const packageJson = JSON.parse(await promises.readFile(packageJsonPath, 'utf8'));

      // Check for main issues
      if (!packageJson.name) {
        this.log.error(`Package.json name not found at ${packageJsonPath}`);
        return null;
      }
      if (!packageJson.type || packageJson.type !== 'module') {
        this.log.error(`Plugin at ${packageJsonPath} is not a module`);
        return null;
      }
      if (!packageJson.main) {
        this.log.error(`Plugin at ${packageJsonPath} has no main entrypoint in package.json`);
        return null;
      }

      // Check for @project-chip and @matter packages in dependencies and devDependencies
      const checkForProjectChipPackages = (dependencies: Record<string, string>) => {
        return Object.keys(dependencies).filter((pkg) => pkg.startsWith('@project-chip') || pkg.startsWith('@matter'));
      };
      const projectChipDependencies = checkForProjectChipPackages(packageJson.dependencies || {});
      if (projectChipDependencies.length > 0) {
        this.log.error(`Found @project-chip packages "${projectChipDependencies.join(', ')}" in plugin dependencies.`);
        this.log.error(`Please open an issue on the plugin repository to remove them.`);
        return null;
      }
      const projectChipDevDependencies = checkForProjectChipPackages(packageJson.devDependencies || {});
      if (projectChipDevDependencies.length > 0) {
        this.log.error(`Found @project-chip packages "${projectChipDevDependencies.join(', ')}" in plugin devDependencies.`);
        this.log.error(`Please open an issue on the plugin repository to remove them.`);
        return null;
      }
      const projectChipPeerDependencies = checkForProjectChipPackages(packageJson.peerDependencies || {});
      if (projectChipPeerDependencies.length > 0) {
        this.log.error(`Found @project-chip packages "${projectChipPeerDependencies.join(', ')}" in plugin peerDependencies.`);
        this.log.error(`Please open an issue on the plugin repository to remove them.`);
        return null;
      }

      // Check for matterbridge package in dependencies and devDependencies
      const checkForMatterbridgePackage = (dependencies: Record<string, string>) => {
        return Object.keys(dependencies).filter((pkg) => pkg === 'matterbridge');
      };
      const matterbridgeDependencies = checkForMatterbridgePackage(packageJson.dependencies || {});
      if (matterbridgeDependencies.length > 0) {
        this.log.error(`Found matterbridge package in the plugin dependencies.`);
        this.log.error(`Please open an issue on the plugin repository to remove them.`);
        return null;
      }
      const matterbridgeDevDependencies = checkForMatterbridgePackage(packageJson.devDependencies || {});
      if (matterbridgeDevDependencies.length > 0) {
        this.log.error(`Found matterbridge package in the plugin devDependencies.`);
        this.log.error(`Please open an issue on the plugin repository to remove them.`);
        return null;
      }
      const matterbridgePeerDependencies = checkForMatterbridgePackage(packageJson.peerDependencies || {});
      if (matterbridgePeerDependencies.length > 0) {
        this.log.error(`Found matterbridge package in the plugin peerDependencies.`);
        this.log.error(`Please open an issue on the plugin repository to remove them.`);
        return null;
      }

      this.log.debug(`Resolved plugin path ${plg}${pluginPath}${db}: ${packageJsonPath}`);
      return packageJsonPath;
    } catch (err) {
      this.log.error(`Failed to resolve plugin path ${plg}${pluginPath}${er}: ${err instanceof Error ? err.message + '\n' + err.stack : err}`);
      return null;
    }
  }

  /**
   * Get the author of a plugin from its package.json.
   *
   * @param {Record<string, string | number | Record<string, string | number | object>>} packageJson - The package.json object of the plugin.
   * @returns {string} The author of the plugin, or 'Unknown author' if not found.
   */
  getAuthor(packageJson: Record<string, string | number | Record<string, string | number | object>>): string {
    if (packageJson.author && typeof packageJson.author === 'string') return packageJson.author;
    else if (packageJson.author && typeof packageJson.author === 'object' && packageJson.author.name && typeof packageJson.author.name === 'string') return packageJson.author.name;
    return 'Unknown author';
  }

  /**
   * Get the homepage of a plugin from its package.json.
   *
   * @param {Record<string, string | number | Record<string, string | number | object>>} packageJson - The package.json object of the plugin.
   * @returns {string | undefined} The homepage of the plugin, or undefined if not found.
   */
  getHomepage(packageJson: Record<string, string | number | Record<string, string | number | object>>): string | undefined {
    if (packageJson.homepage && typeof packageJson.homepage === 'string' && packageJson.homepage.includes('http')) {
      return packageJson.homepage.replace('git+', '').replace('.git', '');
    } else if (packageJson.repository && typeof packageJson.repository === 'object' && packageJson.repository.url && typeof packageJson.repository.url === 'string' && packageJson.repository.url.includes('http')) {
      return packageJson.repository.url.replace('git+', '').replace('.git', '');
    }
  }

  /**
   * Get the help URL of a plugin from its package.json.
   *
   * @param {Record<string, string | number | Record<string, string | number | object>>} packageJson - The package.json object of the plugin.
   * @returns {string | undefined} The URL to the help page or to the README file, or undefined if not found.
   */
  getHelp(packageJson: Record<string, string | number | Record<string, string | number | object>>): string | undefined {
    // If there's a help field that looks like a URL, return it.
    if (packageJson.help && typeof packageJson.help === 'string' && packageJson.help.startsWith('http')) {
      return packageJson.help;
    } else if (packageJson.repository && typeof packageJson.repository === 'object' && packageJson.repository.url && typeof packageJson.repository.url === 'string' && packageJson.repository.url.includes('http')) {
      return packageJson.repository.url.replace('git+', '').replace('.git', '') + '/blob/main/README.md';
    } else if (packageJson.homepage && typeof packageJson.homepage === 'string' && packageJson.homepage.includes('http')) {
      return packageJson.homepage.replace('git+', '').replace('.git', '');
    }
  }

  /**
   * Get the changelog URL of a plugin from its package.json.
   *
   * @param {Record<string, string | number | Record<string, string | number | object>>} packageJson - The package.json object of the plugin.
   * @returns {string | undefined} The URL to the CHANGELOG file, or undefined if not found.
   */
  getChangelog(packageJson: Record<string, string | number | Record<string, string | number | object>>): string | undefined {
    // If there's a changelog field that looks like a URL, return it.
    if (packageJson.changelog && typeof packageJson.changelog === 'string' && packageJson.changelog.startsWith('http')) {
      return packageJson.changelog;
    } else if (packageJson.repository && typeof packageJson.repository === 'object' && packageJson.repository.url && typeof packageJson.repository.url === 'string' && packageJson.repository.url.includes('http')) {
      return packageJson.repository.url.replace('git+', '').replace('.git', '') + '/blob/main/CHANGELOG.md';
    } else if (packageJson.homepage && typeof packageJson.homepage === 'string' && packageJson.homepage.includes('http')) {
      return packageJson.homepage.replace('git+', '').replace('.git', '');
    }
  }

  /**
   * Get the first funding URL(s) of a plugin from its package.json.
   *
   * @param {Record<string, any>} packageJson - The package.json object of the plugin.
   * @returns {string | undefined} The first funding URLs, or undefined if not found.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getFunding(packageJson: Record<string, any>): string | undefined {
    const funding = packageJson.funding;
    if (!funding) return undefined;
    if (typeof funding === 'string' && !funding.startsWith('http')) return;
    if (typeof funding === 'string' && funding.startsWith('http')) return funding;

    // Normalize funding into an array.
    const fundingEntries = Array.isArray(funding) ? funding : [funding];
    for (const entry of fundingEntries) {
      if (entry && typeof entry === 'string' && entry.startsWith('http')) {
        // If the funding entry is a string, assume it is a URL.
        return entry;
      } else if (entry && typeof entry === 'object' && typeof entry.url === 'string' && entry.url.startsWith('http')) {
        // If it's an object with a 'url' property, use that.
        return entry.url;
      }
    }
  }

  /**
   * Loads and parse the plugin package.json and returns it.
   *
   * @param {RegisteredPlugin} plugin - The plugin to load the package from.
   * @returns {Promise<Record<string, string | number | object> | null>} A promise that resolves to the parsed package.json object or null if it could not be parsed.
   */
  async parse(plugin: RegisteredPlugin): Promise<Record<string, string | number | object> | null> {
    const { promises } = await import('node:fs');
    try {
      this.log.debug(`Parsing package.json of plugin ${plg}${plugin.name}${db}`);
      const packageJson = JSON.parse(await promises.readFile(plugin.path, 'utf8'));
      if (!packageJson.name) this.log.warn(`Plugin ${plg}${plugin.name}${wr} has no name in package.json`);
      if (!packageJson.version) this.log.warn(`Plugin ${plg}${plugin.name}${wr} has no version in package.json`);
      if (!packageJson.description) this.log.warn(`Plugin ${plg}${plugin.name}${wr} has no description in package.json`);
      if (!packageJson.author) this.log.warn(`Plugin ${plg}${plugin.name}${wr} has no author in package.json`);
      if (!packageJson.homepage) this.log.info(`Plugin ${plg}${plugin.name}${nf} has no homepage in package.json`);
      if (!packageJson.type || packageJson.type !== 'module') this.log.error(`Plugin ${plg}${plugin.name}${er} is not a module`);
      if (!packageJson.main) this.log.error(`Plugin ${plg}${plugin.name}${er} has no main entrypoint in package.json`);
      plugin.name = packageJson.name || 'Unknown name';
      plugin.version = packageJson.version || '1.0.0';
      plugin.description = packageJson.description || 'Unknown description';
      plugin.author = this.getAuthor(packageJson);
      plugin.homepage = this.getHomepage(packageJson);
      plugin.help = this.getHelp(packageJson);
      plugin.changelog = this.getChangelog(packageJson);
      plugin.funding = this.getFunding(packageJson);
      if (!plugin.type) this.log.warn(`Plugin ${plg}${plugin.name}${wr} has no type`);

      // Check for @project-chip and @matter packages in dependencies and devDependencies
      const checkForProjectChipPackages = (dependencies: Record<string, string>) => {
        return Object.keys(dependencies).filter((pkg) => pkg.startsWith('@project-chip') || pkg.startsWith('@matter'));
      };
      const projectChipDependencies = checkForProjectChipPackages(packageJson.dependencies || {});
      if (projectChipDependencies.length > 0) {
        this.log.error(`Found @project-chip packages "${projectChipDependencies.join(', ')}" in plugin ${plg}${plugin.name}${er} dependencies.`);
        this.log.error(`Please open an issue on the plugin repository to remove them.`);
        return null;
      }
      const projectChipDevDependencies = checkForProjectChipPackages(packageJson.devDependencies || {});
      if (projectChipDevDependencies.length > 0) {
        this.log.error(`Found @project-chip packages "${projectChipDevDependencies.join(', ')}" in plugin ${plg}${plugin.name}${er} devDependencies.`);
        this.log.error(`Please open an issue on the plugin repository to remove them.`);
        return null;
      }
      const projectChipPeerDependencies = checkForProjectChipPackages(packageJson.peerDependencies || {});
      if (projectChipPeerDependencies.length > 0) {
        this.log.error(`Found @project-chip packages "${projectChipPeerDependencies.join(', ')}" in plugin ${plg}${plugin.name}${er} peerDependencies.`);
        this.log.error(`Please open an issue on the plugin repository to remove them.`);
        return null;
      }

      // Check for matterbridge package in dependencies and devDependencies
      const checkForMatterbridgePackage = (dependencies: Record<string, string>) => {
        return Object.keys(dependencies).filter((pkg) => pkg === 'matterbridge');
      };
      const matterbridgeDependencies = checkForMatterbridgePackage(packageJson.dependencies || {});
      if (matterbridgeDependencies.length > 0) {
        this.log.error(`Found matterbridge package in the plugin ${plg}${plugin.name}${er} dependencies.`);
        this.log.error(`Please open an issue on the plugin repository to remove them.`);
        return null;
      }
      const matterbridgeDevDependencies = checkForMatterbridgePackage(packageJson.devDependencies || {});
      if (matterbridgeDevDependencies.length > 0) {
        this.log.error(`Found matterbridge package in the plugin ${plg}${plugin.name}${er} devDependencies.`);
        this.log.error(`Please open an issue on the plugin repository to remove them.`);
        return null;
      }
      const matterbridgePeerDependencies = checkForMatterbridgePackage(packageJson.peerDependencies || {});
      if (matterbridgePeerDependencies.length > 0) {
        this.log.error(`Found matterbridge package in the plugin ${plg}${plugin.name}${er} peerDependencies.`);
        this.log.error(`Please open an issue on the plugin repository to remove them.`);
        return null;
      }

      return packageJson;
    } catch (err) {
      this.log.error(`Failed to parse package.json of plugin ${plg}${plugin.name}${er}: ${err instanceof Error ? err.message + '\n' + err.stack : err}`);
      plugin.error = true;
      return null;
    }
  }

  /**
   * Enables a plugin by its name or path.
   *
   * This method enables a plugin by setting its `enabled` property to `true` and saving the updated
   * plugin information to storage. It first checks if the plugin is already registered in the `_plugins` map.
   * If not, it attempts to resolve the plugin's `package.json` file to retrieve its name and enable it.
   *
   * @param {string} nameOrPath - The name or path of the plugin to enable.
   * @returns {Promise<RegisteredPlugin | null>} A promise that resolves to the enabled plugin object, or null if the plugin could not be enabled.
   */
  async enable(nameOrPath: string): Promise<RegisteredPlugin | null> {
    const { promises } = await import('node:fs');
    if (!nameOrPath) return null;
    if (this._plugins.has(nameOrPath)) {
      const plugin = this._plugins.get(nameOrPath) as RegisteredPlugin;
      plugin.enabled = true;
      this.log.info(`Enabled plugin ${plg}${plugin.name}${nf}`);
      await this.saveToStorage();
      this.emit('enabled', plugin.name);
      return plugin;
    }
    const packageJsonPath = await this.resolve(nameOrPath);
    if (!packageJsonPath) {
      this.log.error(`Failed to enable plugin ${plg}${nameOrPath}${er}: package.json not found`);
      return null;
    }
    try {
      const packageJson = JSON.parse(await promises.readFile(packageJsonPath, 'utf8'));
      const plugin = this._plugins.get(packageJson.name);
      if (!plugin) {
        this.log.error(`Failed to enable plugin ${plg}${nameOrPath}${er}: plugin not registered`);
        return null;
      }
      plugin.enabled = true;
      this.log.info(`Enabled plugin ${plg}${plugin.name}${nf}`);
      await this.saveToStorage();
      this.emit('enabled', plugin.name);
      return plugin;
    } catch (err) {
      this.log.error(`Failed to parse package.json of plugin ${plg}${nameOrPath}${er}: ${err instanceof Error ? err.message + '\n' + err.stack : err}`);
      return null;
    }
  }

  /**
   * Enables a plugin by its name or path.
   *
   * This method enables a plugin by setting its `enabled` property to `true` and saving the updated
   * plugin information to storage. It first checks if the plugin is already registered in the `_plugins` map.
   * If not, it attempts to resolve the plugin's `package.json` file to retrieve its name and enable it.
   *
   * @param {string} nameOrPath - The name or path of the plugin to enable.
   * @returns {Promise<RegisteredPlugin | null>} A promise that resolves to the enabled plugin object, or null if the plugin could not be enabled.
   */
  async disable(nameOrPath: string): Promise<RegisteredPlugin | null> {
    const { promises } = await import('node:fs');
    if (!nameOrPath) return null;
    if (this._plugins.has(nameOrPath)) {
      const plugin = this._plugins.get(nameOrPath) as RegisteredPlugin;
      plugin.enabled = false;
      this.log.info(`Disabled plugin ${plg}${plugin.name}${nf}`);
      await this.saveToStorage();
      this.emit('disabled', plugin.name);
      return plugin;
    }
    const packageJsonPath = await this.resolve(nameOrPath);
    if (!packageJsonPath) {
      this.log.error(`Failed to disable plugin ${plg}${nameOrPath}${er}: package.json not found`);
      return null;
    }
    try {
      const packageJson = JSON.parse(await promises.readFile(packageJsonPath, 'utf8'));
      const plugin = this._plugins.get(packageJson.name);
      if (!plugin) {
        this.log.error(`Failed to disable plugin ${plg}${nameOrPath}${er}: plugin not registered`);
        return null;
      }
      plugin.enabled = false;
      this.log.info(`Disabled plugin ${plg}${plugin.name}${nf}`);
      await this.saveToStorage();
      this.emit('disabled', plugin.name);
      return plugin;
    } catch (err) {
      this.log.error(`Failed to parse package.json of plugin ${plg}${nameOrPath}${er}: ${err instanceof Error ? err.message + '\n' + err.stack : err}`);
      return null;
    }
  }

  /**
   * Removes a plugin by its name or path.
   *
   * This method removes a plugin from the `_plugins` map and saves the updated plugin information to storage.
   * It first checks if the plugin is already registered in the `_plugins` map. If not, it attempts to resolve
   * the plugin's `package.json` file to retrieve its name and remove it.
   *
   * @param {string} nameOrPath - The name or path of the plugin to remove.
   * @returns {Promise<RegisteredPlugin | null>} A promise that resolves to the removed plugin object, or null if the plugin could not be removed.
   */
  async remove(nameOrPath: string): Promise<RegisteredPlugin | null> {
    const { promises } = await import('node:fs');
    if (!nameOrPath) return null;
    if (this._plugins.has(nameOrPath)) {
      const plugin = this._plugins.get(nameOrPath) as RegisteredPlugin;
      this._plugins.delete(nameOrPath);
      this.log.info(`Removed plugin ${plg}${plugin.name}${nf}`);
      await this.saveToStorage();
      this.emit('removed', plugin.name);
      return plugin;
    }
    const packageJsonPath = await this.resolve(nameOrPath);
    if (!packageJsonPath) {
      this.log.error(`Failed to remove plugin ${plg}${nameOrPath}${er}: package.json not found`);
      return null;
    }
    try {
      const packageJson = JSON.parse(await promises.readFile(packageJsonPath, 'utf8'));
      const plugin = this._plugins.get(packageJson.name);
      if (!plugin) {
        this.log.error(`Failed to remove plugin ${plg}${nameOrPath}${er}: plugin not registered`);
        return null;
      }
      this._plugins.delete(packageJson.name);
      this.log.info(`Removed plugin ${plg}${plugin.name}${nf}`);
      await this.saveToStorage();
      this.emit('removed', plugin.name);
      return plugin;
    } catch (err) {
      this.log.error(`Failed to parse package.json of plugin ${plg}${nameOrPath}${er}: ${err instanceof Error ? err.message + '\n' + err.stack : err}`);
      return null;
    }
  }

  /**
   * Adds a plugin by its name or path.
   *
   * This method adds a plugin to the plugins map and saves the updated plugin information to storage.
   * It first resolves the plugin's `package.json` file to retrieve its details. If the plugin is already
   * registered, it logs an info message and returns null. Otherwise, it registers the plugin, enables it,
   * and saves the updated plugin information to storage.
   *
   * @param {string} nameOrPath - The name or path of the plugin to add.
   * @returns {Promise<RegisteredPlugin | null>} A promise that resolves to the added plugin object, or null if the plugin could not be added.
   */
  async add(nameOrPath: string): Promise<RegisteredPlugin | null> {
    const { promises } = await import('node:fs');
    if (!nameOrPath) return null;
    const packageJsonPath = await this.resolve(nameOrPath);
    if (!packageJsonPath) {
      this.log.error(`Failed to add plugin ${plg}${nameOrPath}${er}: package.json not found`);
      return null;
    }
    try {
      const packageJson = JSON.parse(await promises.readFile(packageJsonPath, 'utf8'));
      if (this._plugins.get(packageJson.name)) {
        this.log.info(`Plugin ${plg}${nameOrPath}${nf} already registered`);
        return null;
      }
      this._plugins.set(packageJson.name, {
        name: packageJson.name,
        enabled: true,
        path: packageJsonPath,
        type: 'AnyPlatform',
        version: packageJson.version,
        description: packageJson.description,
        author: this.getAuthor(packageJson),
      });
      this.log.info(`Added plugin ${plg}${packageJson.name}${nf}`);
      await this.saveToStorage();
      const plugin = this._plugins.get(packageJson.name);
      this.emit('added', packageJson.name);
      return plugin || null;
    } catch (err) {
      this.log.error(`Failed to parse package.json of plugin ${plg}${nameOrPath}${er}: ${err instanceof Error ? err.message + '\n' + err.stack : err}`);
      return null;
    }
  }

  /**
   * Installs a plugin by its name.
   *
   * This method first uninstalls any existing version of the plugin, then installs the plugin globally using npm.
   * It logs the installation process and retrieves the installed version of the plugin.
   *
   * @param {string} name - The name of the plugin to install.
   * @returns {Promise<string | undefined>} A promise that resolves to the installed version of the plugin, or undefined if the installation failed.
   */
  async install(name: string): Promise<string | undefined> {
    const { exec } = await import('node:child_process');
    await this.uninstall(name);
    this.log.info(`Installing plugin ${plg}${name}${nf}`);
    return new Promise((resolve) => {
      exec(`npm install -g ${name} --omit=dev`, (error: ExecException | null, stdout: string, stderr: string) => {
        if (error) {
          this.log.error(`Failed to install plugin ${plg}${name}${er}: ${error}`);
          this.log.debug(`Failed to install plugin ${plg}${name}${db}: ${stderr}`);
          resolve(undefined);
        } else {
          this.log.info(`Installed plugin ${plg}${name}${nf}`);
          this.log.debug(`Installed plugin ${plg}${name}${db}: ${stdout}`);

          // Get the installed version
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          exec(`npm list -g ${name} --depth=0`, (listError, listStdout, listStderr) => {
            if (listError) {
              this.log.error(`List error: ${listError}`);
              resolve(undefined);
            }
            // Clean the output to get only the package name and version
            const lines = listStdout.split('\n');
            const versionLine = lines.find((line) => line.includes(`${name}@`));
            if (versionLine) {
              const version = versionLine.split('@')[1].trim();
              this.log.info(`Installed plugin ${plg}${name}@${version}${nf}`);
              this.emit('installed', name, version);
              resolve(version);
            } else {
              resolve(undefined);
            }
          });
        }
      });
    });
  }

  /**
   * Uninstalls a plugin by its name.
   *
   * This method uninstalls a globally installed plugin using npm. It logs the uninstallation process
   * and returns the name of the uninstalled plugin if successful, or undefined if the uninstallation failed.
   *
   * @param {string} name - The name of the plugin to uninstall.
   * @returns {Promise<string | undefined>} A promise that resolves to the name of the uninstalled plugin, or undefined if the uninstallation failed.
   */
  async uninstall(name: string): Promise<string | undefined> {
    const { exec } = await import('node:child_process');
    this.log.info(`Uninstalling plugin ${plg}${name}${nf}`);
    return new Promise((resolve) => {
      exec(`npm uninstall -g ${name}`, (error: ExecException | null, stdout: string, stderr: string) => {
        if (error) {
          this.log.error(`Failed to uninstall plugin ${plg}${name}${er}: ${error}`);
          this.log.debug(`Failed to uninstall plugin ${plg}${name}${db}: ${stderr}`);
          resolve(undefined);
        } else {
          this.log.info(`Uninstalled plugin ${plg}${name}${nf}`);
          this.log.debug(`Uninstalled plugin ${plg}${name}${db}: ${stdout}`);
          this.emit('uninstalled', name);
          resolve(name);
        }
      });
    });
  }

  /**
   * Loads a plugin and returns the corresponding MatterbridgePlatform instance.
   *
   * @param {RegisteredPlugin} plugin - The plugin to load.
   * @param {boolean} start - Optional flag indicating whether to start the plugin after loading. Default is false.
   * @param {string} message - Optional message to pass to the plugin when starting.
   * @param {boolean} configure - Optional flag indicating whether to configure the plugin after loading. Default is false.
   * @returns {Promise<MatterbridgePlatform | undefined>} A Promise that resolves to the loaded MatterbridgePlatform instance or undefined.
   */
  async load(plugin: RegisteredPlugin, start = false, message = '', configure = false): Promise<MatterbridgePlatform | undefined> {
    const { promises } = await import('node:fs');
    const { default: path } = await import('node:path');
    if (!plugin.enabled) {
      this.log.error(`Plugin ${plg}${plugin.name}${er} not enabled`);
      return undefined;
    }
    if (plugin.platform) {
      this.log.error(`Plugin ${plg}${plugin.name}${er} already loaded`);
      return plugin.platform;
    }
    this.log.info(`Loading plugin ${plg}${plugin.name}${nf} type ${typ}${plugin.type}${nf}`);
    try {
      // Load the package.json of the plugin
      const packageJson = JSON.parse(await promises.readFile(plugin.path, 'utf8'));
      // Resolve the main module path relative to package.json
      const pluginEntry = path.resolve(path.dirname(plugin.path), packageJson.main);
      // Dynamically import the plugin
      const { pathToFileURL } = await import('node:url');
      const pluginUrl = pathToFileURL(pluginEntry);
      this.log.debug(`Importing plugin ${plg}${plugin.name}${db} from ${pluginUrl.href}`);
      const pluginInstance = await import(pluginUrl.href);
      this.log.debug(`Imported plugin ${plg}${plugin.name}${db} from ${pluginUrl.href}`);

      // Call the default export function of the plugin, passing this MatterBridge instance, the log and the config
      if (pluginInstance.default) {
        const config: PlatformConfig = await this.loadConfig(plugin);

        // Preset the plugin properties here in case the plugin throws an error during loading. In this case the user can change the config and restart the plugin.
        plugin.name = packageJson.name;
        plugin.description = packageJson.description ?? 'No description';
        plugin.version = packageJson.version;
        plugin.author = this.getAuthor(packageJson);
        plugin.configJson = config;
        plugin.schemaJson = await this.loadSchema(plugin);
        config.name = plugin.name;
        config.version = packageJson.version;

        const log = new AnsiLogger({ logName: plugin.description ?? 'No description', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: (config.debug as boolean) ? LogLevel.DEBUG : this.matterbridge.log.logLevel });
        const platform = pluginInstance.default(this.matterbridge, log, config) as MatterbridgePlatform;
        config.type = platform.type;
        platform.name = packageJson.name;
        platform.config = config;
        platform.version = packageJson.version;
        plugin.name = packageJson.name;
        plugin.description = packageJson.description ?? 'No description';
        plugin.version = packageJson.version;
        plugin.author = this.getAuthor(packageJson);
        plugin.homepage = this.getHomepage(packageJson);
        plugin.help = this.getHelp(packageJson);
        plugin.changelog = this.getChangelog(packageJson);
        plugin.funding = this.getFunding(packageJson);
        plugin.type = platform.type;
        plugin.platform = platform;
        plugin.loaded = true;
        plugin.registeredDevices = 0;
        plugin.addedDevices = 0;

        await this.saveToStorage(); // Save the plugin to storage

        this.log.notice(`Loaded plugin ${plg}${plugin.name}${nt} type ${typ}${platform.type}${nt} (entrypoint ${UNDERLINE}${pluginEntry}${UNDERLINEOFF})`);

        this.emit('loaded', plugin.name);

        if (start) await this.start(plugin, message, false);

        if (configure) await this.configure(plugin);

        return platform;
      } else {
        this.log.error(`Plugin ${plg}${plugin.name}${er} does not provide a default export`);
        plugin.error = true;
      }
    } catch (err) {
      this.log.error(`Failed to load plugin ${plg}${plugin.name}${er}: ${err instanceof Error ? err.message + '\n' + err.stack : err}`);
      plugin.error = true;
    }
    return undefined;
  }

  /**
   * Starts a plugin.
   *
   * @param {RegisteredPlugin} plugin - The plugin to start.
   * @param {string} [message] - Optional message to pass to the plugin's onStart method.
   * @param {boolean} [configure] - Indicates whether to configure the plugin after starting (default false).
   * @returns {Promise<RegisteredPlugin | undefined>} A promise that resolves when the plugin is started successfully, or rejects with an error if starting the plugin fails.
   */
  async start(plugin: RegisteredPlugin, message?: string, configure = false): Promise<RegisteredPlugin | undefined> {
    if (!plugin.loaded) {
      this.log.error(`Plugin ${plg}${plugin.name}${er} not loaded`);
      return undefined;
    }
    if (!plugin.platform) {
      this.log.error(`Plugin ${plg}${plugin.name}${er} no platform found`);
      return undefined;
    }
    if (plugin.started) {
      this.log.error(`Plugin ${plg}${plugin.name}${er} already started`);
      return undefined;
    }
    this.log.info(`Starting plugin ${plg}${plugin.name}${nf} type ${typ}${plugin.type}${nf}`);
    try {
      await plugin.platform.onStart(message);
      this.log.notice(`Started plugin ${plg}${plugin.name}${nt} type ${typ}${plugin.type}${nt}`);
      plugin.started = true;
      await this.saveConfigFromPlugin(plugin);
      this.emit('started', plugin.name);
      if (configure) await this.configure(plugin);
      return plugin;
    } catch (err) {
      plugin.error = true;
      this.log.error(`Failed to start plugin ${plg}${plugin.name}${er}: ${err instanceof Error ? err.message + '\n' + err.stack : err}`);
    }
    return undefined;
  }

  /**
   * Configures a plugin.
   *
   * @param {RegisteredPlugin} plugin - The plugin to configure.
   * @returns {Promise<RegisteredPlugin | undefined>} A promise that resolves when the plugin is configured successfully, or rejects with an error if configuration fails.
   */
  async configure(plugin: RegisteredPlugin): Promise<RegisteredPlugin | undefined> {
    if (!plugin.loaded) {
      this.log.error(`Plugin ${plg}${plugin.name}${er} not loaded`);
      return undefined;
    }
    if (!plugin.started) {
      this.log.error(`Plugin ${plg}${plugin.name}${er} not started`);
      return undefined;
    }
    if (!plugin.platform) {
      this.log.error(`Plugin ${plg}${plugin.name}${er} no platform found`);
      return undefined;
    }
    if (plugin.configured) {
      this.log.debug(`Plugin ${plg}${plugin.name}${db} already configured`);
      return undefined;
    }
    this.log.info(`Configuring plugin ${plg}${plugin.name}${nf} type ${typ}${plugin.type}${nf}`);
    try {
      await plugin.platform.onConfigure();
      this.log.notice(`Configured plugin ${plg}${plugin.name}${nt} type ${typ}${plugin.type}${nt}`);
      plugin.configured = true;
      this.emit('configured', plugin.name);
      return plugin;
    } catch (err) {
      plugin.error = true;
      this.log.error(`Failed to configure plugin ${plg}${plugin.name}${er}: ${err instanceof Error ? err.message + '\n' + err.stack : err}`);
    }
    return undefined;
  }

  /**
   * Shuts down a plugin.
   *
   * This method shuts down a plugin by calling its `onShutdown` method and resetting its state.
   * It logs the shutdown process and optionally removes all devices associated with the plugin.
   *
   * @param {RegisteredPlugin} plugin - The plugin to shut down.
   * @param {string} [reason] - The reason for shutting down the plugin.
   * @param {boolean} [removeAllDevices] - Whether to remove all devices associated with the plugin.
   * @param {boolean} [force] - Whether to force the shutdown even if the plugin is not loaded or started.
   * @returns {Promise<RegisteredPlugin | undefined>} A promise that resolves to the shut down plugin object, or undefined if the shutdown failed.
   */
  async shutdown(plugin: RegisteredPlugin, reason?: string, removeAllDevices = false, force = false): Promise<RegisteredPlugin | undefined> {
    this.log.debug(`Shutting down plugin ${plg}${plugin.name}${db}`);
    if (!plugin.loaded) {
      this.log.debug(`Plugin ${plg}${plugin.name}${db} not loaded`);
      if (!force) return undefined;
    }
    if (!plugin.started) {
      this.log.debug(`Plugin ${plg}${plugin.name}${db} not started`);
      if (!force) return undefined;
    }
    if (!plugin.configured) {
      this.log.debug(`Plugin ${plg}${plugin.name}${db} not configured`);
    }
    if (!plugin.platform) {
      this.log.debug(`Plugin ${plg}${plugin.name}${db} no platform found`);
      return undefined;
    }
    this.log.info(`Shutting down plugin ${plg}${plugin.name}${nf}: ${reason}...`);
    try {
      await plugin.platform.onShutdown(reason);
      plugin.locked = undefined;
      plugin.error = undefined;
      plugin.loaded = undefined;
      plugin.started = undefined;
      plugin.configured = undefined;
      plugin.platform = undefined;
      if (removeAllDevices) {
        this.log.info(`Removing all endpoints for plugin ${plg}${plugin.name}${nf}: ${reason}...`);
        await this.matterbridge.removeAllBridgedEndpoints(plugin.name);
      }
      plugin.registeredDevices = undefined;
      plugin.addedDevices = undefined;
      this.log.notice(`Shutdown of plugin ${plg}${plugin.name}${nt} completed`);
      this.emit('shutdown', plugin.name);
      return plugin;
    } catch (err) {
      this.log.error(`Failed to shut down plugin ${plg}${plugin.name}${er}: ${err instanceof Error ? err.message + '\n' + err.stack : err}`);
    }
    return undefined;
  }

  /**
   * Loads the configuration for a plugin.
   * If the configuration file exists, it reads the file and returns the parsed JSON data.
   * If the configuration file does not exist, it creates a new file with default configuration and returns it.
   * If any error occurs during file access or creation, it logs an error and return un empty config.
   *
   * @param {RegisteredPlugin} plugin - The plugin for which to load the configuration.
   * @returns {Promise<PlatformConfig>} A promise that resolves to the loaded or created configuration.
   */
  async loadConfig(plugin: RegisteredPlugin): Promise<PlatformConfig> {
    const { default: path } = await import('node:path');
    const { promises } = await import('node:fs');
    const { shelly_config, somfytahoma_config, zigbee2mqtt_config } = await import('./defaultConfigSchema.js');
    const configFile = path.join(this.matterbridge.matterbridgeDirectory, `${plugin.name}.config.json`);
    try {
      await promises.access(configFile);
      const data = await promises.readFile(configFile, 'utf8');
      const config = JSON.parse(data) as PlatformConfig;
      this.log.debug(`Loaded config file ${configFile} for plugin ${plg}${plugin.name}${db}.`);
      // this.log.debug(`Loaded config file ${configFile} for plugin ${plg}${plugin.name}${db}.\nConfig:${rs}\n`, config);
      // The first time a plugin is added to the system, the config file is created with the plugin name and type "AnyPlatform".
      config.name = plugin.name;
      config.type = plugin.type;
      if (config.debug === undefined) config.debug = false;
      if (config.unregisterOnShutdown === undefined) config.unregisterOnShutdown = false;
      return config;
    } catch (err) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code === 'ENOENT') {
        let config: PlatformConfig;
        if (plugin.name === 'matterbridge-zigbee2mqtt') config = zigbee2mqtt_config;
        else if (plugin.name === 'matterbridge-somfy-tahoma') config = somfytahoma_config;
        else if (plugin.name === 'matterbridge-shelly') config = shelly_config;
        else config = { name: plugin.name, type: plugin.type, debug: false, unregisterOnShutdown: false };
        try {
          await promises.writeFile(configFile, JSON.stringify(config, null, 2), 'utf8');
          this.log.debug(`Created config file ${configFile} for plugin ${plg}${plugin.name}${db}.`);
          // this.log.debug(`Created config file ${configFile} for plugin ${plg}${plugin.name}${db}.\nConfig:${rs}\n`, config);
          return config;
        } catch (err) {
          this.log.error(`Error creating config file ${configFile} for plugin ${plg}${plugin.name}${er}: ${err instanceof Error ? err.message + '\n' + err.stack : err}`);
          return config;
        }
      } else {
        this.log.error(`Error accessing config file ${configFile} for plugin ${plg}${plugin.name}${er}: ${err instanceof Error ? err.message + '\n' + err.stack : err}`);
        return { name: plugin.name, type: plugin.type, debug: false, unregisterOnShutdown: false };
      }
    }
  }

  /**
   * Saves the configuration of a plugin to a file.
   *
   * This method saves the configuration of the specified plugin to a JSON file in the matterbridge directory.
   * If the plugin's configuration is not found, it logs an error and rejects the promise. If the configuration
   * is successfully saved, it logs a debug message. If an error occurs during the file write operation, it logs
   * the error and rejects the promise.
   *
   * @param {RegisteredPlugin} plugin - The plugin whose configuration is to be saved.
   * @param {boolean} [restartRequired] - Indicates whether a restart is required after saving the configuration.
   * @returns {Promise<void>} A promise that resolves when the configuration is successfully saved, or rejects if an error occurs.
   * @throws {Error} If the plugin's configuration is not found.
   */
  async saveConfigFromPlugin(plugin: RegisteredPlugin, restartRequired = false): Promise<void> {
    const { default: path } = await import('node:path');
    const { promises } = await import('node:fs');
    if (!plugin.platform?.config) {
      this.log.error(`Error saving config file for plugin ${plg}${plugin.name}${er}: config not found`);
      return Promise.reject(new Error(`Error saving config file for plugin ${plg}${plugin.name}${er}: config not found`));
    }
    const configFile = path.join(this.matterbridge.matterbridgeDirectory, `${plugin.name}.config.json`);
    try {
      await promises.writeFile(configFile, JSON.stringify(plugin.platform.config, null, 2), 'utf8');
      plugin.configJson = plugin.platform.config;
      if (restartRequired) plugin.restartRequired = true;
      this.log.debug(`Saved config file ${configFile} for plugin ${plg}${plugin.name}${db}`);
      // this.log.debug(`Saved config file ${configFile} for plugin ${plg}${plugin.name}${db}.\nConfig:${rs}\n`, plugin.platform.config);
      return Promise.resolve();
    } catch (err) {
      this.log.error(`Error saving config file ${configFile} for plugin ${plg}${plugin.name}${er}: ${err instanceof Error ? err.message + '\n' + err.stack : err}`);
      return Promise.reject(err);
    }
  }

  /**
   * Saves the configuration of a plugin from a JSON object to a file.
   *
   * This method saves the provided configuration of the specified plugin to a JSON file in the matterbridge directory.
   * It first checks if the configuration data is valid by ensuring it contains the correct name and type, and matches
   * the plugin's name. If the configuration data is invalid, it logs an error and returns. If the configuration is
   * successfully saved, it updates the plugin's `configJson` property and logs a debug message. If an error occurs
   * during the file write operation, it logs the error and returns.
   *
   * @param {RegisteredPlugin} plugin - The plugin whose configuration is to be saved.
   * @param {PlatformConfig} config - The configuration data to be saved.
   * @param {boolean} [restartRequired] - Indicates whether a restart is required after saving the configuration.
   * @returns {Promise<void>} A promise that resolves when the configuration is successfully saved, or returns if an error occurs.
   */
  async saveConfigFromJson(plugin: RegisteredPlugin, config: PlatformConfig, restartRequired = false): Promise<void> {
    const { default: path } = await import('node:path');
    const { promises } = await import('node:fs');
    if (!config.name || !config.type || config.name !== plugin.name) {
      this.log.error(`Error saving config file for plugin ${plg}${plugin.name}${er}. Wrong config data content:${rs}\n`, config);
      return;
    }
    const configFile = path.join(this.matterbridge.matterbridgeDirectory, `${plugin.name}.config.json`);
    try {
      await promises.writeFile(configFile, JSON.stringify(config, null, 2), 'utf8');
      plugin.configJson = config;
      if (restartRequired) plugin.restartRequired = true;
      if (plugin.platform) {
        plugin.platform.config = config;
        plugin.platform.onConfigChanged(config).catch((err) => this.log.error(`Error calling onConfigChanged for plugin ${plg}${plugin.name}${er}: ${err}`));
      }
      this.log.debug(`Saved config file ${configFile} for plugin ${plg}${plugin.name}${db}`);
      // this.log.debug(`Saved config file ${configFile} for plugin ${plg}${plugin.name}${db}.\nConfig:${rs}\n`, config);
    } catch (err) {
      this.log.error(`Error saving config file ${configFile} for plugin ${plg}${plugin.name}${er}: ${err instanceof Error ? err.message + '\n' + err.stack : err}`);
      return;
    }
  }

  /**
   * Loads the schema for a plugin.
   *
   * This method attempts to load the schema file for the specified plugin. If the schema file is found,
   * it reads and parses the file, updates the schema's title and description, and logs the process.
   * If the schema file is not found, it logs the event and loads a default schema for the plugin.
   *
   * @param {RegisteredPlugin} plugin - The plugin whose schema is to be loaded.
   * @returns {Promise<PlatformSchema>} A promise that resolves to the loaded schema object, or the default schema if the schema file is not found.
   */
  async loadSchema(plugin: RegisteredPlugin): Promise<PlatformSchema> {
    const { promises } = await import('node:fs');
    const schemaFile = plugin.path.replace('package.json', `${plugin.name}.schema.json`);
    try {
      await promises.access(schemaFile);
      const data = await promises.readFile(schemaFile, 'utf8');
      const schema = JSON.parse(data) as PlatformSchema;
      schema.title = plugin.description;
      schema.description = plugin.name + ' v. ' + plugin.version + ' by ' + plugin.author;
      this.log.debug(`Loaded schema file ${schemaFile} for plugin ${plg}${plugin.name}${db}.`);
      // this.log.debug(`Loaded schema file ${schemaFile} for plugin ${plg}${plugin.name}${db}.\nSchema:${rs}\n`, schema);
      return schema;
    } catch (_err) {
      this.log.debug(`Schema file ${schemaFile} for plugin ${plg}${plugin.name}${db} not found. Loading default schema.`);
      return this.getDefaultSchema(plugin);
    }
  }

  /**
   * Returns the default schema for a plugin.
   *
   * This method generates a default schema object for the specified plugin. The schema includes
   * metadata such as the plugin's title, description, version, and author. It also defines the
   * properties of the schema, including the plugin's name, type, debug flag, and unregisterOnShutdown flag.
   *
   * @param {RegisteredPlugin} plugin - The plugin for which the default schema is to be generated.
   * @returns {PlatformSchema} The default schema object for the plugin.
   */
  getDefaultSchema(plugin: RegisteredPlugin): PlatformSchema {
    return {
      title: plugin.description,
      description: plugin.name + ' v. ' + plugin.version + ' by ' + plugin.author,
      type: 'object',
      properties: {
        name: {
          description: 'Plugin name',
          type: 'string',
          readOnly: true,
        },
        type: {
          description: 'Plugin type',
          type: 'string',
          readOnly: true,
        },
        debug: {
          description: 'Enable the debug for the plugin (development only)',
          type: 'boolean',
          default: false,
        },
        unregisterOnShutdown: {
          description: 'Unregister all devices on shutdown (development only)',
          type: 'boolean',
          default: false,
        },
      },
    };
  }
}
