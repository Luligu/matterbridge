/**
 * This file contains the Plugins class.
 *
 * @file plugins.ts
 * @author Luca Liguori
 * @created 2024-07-14
 * @version 1.3.1
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

// AnsiLogger module
import { AnsiLogger, LogLevel, TimestampFormat, UNDERLINE, UNDERLINEOFF, BLUE, db, er, nf, nt, rs, wr, debugStringify, CYAN } from 'node-ansi-logger';

// Matterbridge
import type { Matterbridge } from './matterbridge.js';
import type { MatterbridgePlatform, PlatformConfig, PlatformSchema } from './matterbridgePlatform.js';
import { ApiPlugin, plg, Plugin, PluginName, StoragePlugin, typ } from './matterbridgeTypes.js';
import { inspectError, logError } from './utils/error.js';
import { hasParameter } from './utils/commandLine.js';
import { BroadcastServer } from './broadcastServer.js';
import { WorkerMessage } from './broadcastServerTypes.js';

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

/**
 * Manages Matterbridge plugins.
 */
export class PluginManager extends EventEmitter<PluginManagerEvents> {
  private readonly _plugins = new Map<string, Plugin>();
  private readonly log: AnsiLogger;
  private readonly server: BroadcastServer;
  private readonly debug = hasParameter('debug') || hasParameter('verbose');
  private readonly verbose = hasParameter('verbose');

  /**
   * Creates an instance of PluginManager.
   *
   * @param {Matterbridge} matterbridge - The Matterbridge instance.
   */
  constructor(private readonly matterbridge: Matterbridge) {
    super();
    this.log = new AnsiLogger({ logName: 'PluginManager', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: hasParameter('debug') ? LogLevel.DEBUG : LogLevel.INFO });
    this.log.debug('Matterbridge plugin manager starting...');
    this.server = new BroadcastServer('plugins', this.log);
    this.server.on('broadcast_message', this.msgHandler.bind(this));
    this.log.debug('Matterbridge plugin manager started');
  }

  destroy(): void {
    this.server.close();
  }

  private async msgHandler(msg: WorkerMessage): Promise<void> {
    if (this.server.isWorkerRequest(msg, msg.type) && (msg.dst === 'all' || msg.dst === 'plugins')) {
      if (this.verbose) this.log.debug(`Received request message ${CYAN}${msg.type}${db} from ${CYAN}${msg.src}${db}: ${debugStringify(msg)}${db}`);
      switch (msg.type) {
        case 'get_log_level':
          this.server.respond({ ...msg, response: { success: true, logLevel: this.log.logLevel } });
          break;
        case 'set_log_level':
          this.log.logLevel = msg.params.logLevel;
          this.server.respond({ ...msg, response: { success: true, logLevel: this.log.logLevel } });
          break;
        case 'plugins_length':
          this.server.respond({ ...msg, response: { length: this.length } });
          break;
        case 'plugins_size':
          this.server.respond({ ...msg, response: { size: this.size } });
          break;
        case 'plugins_has':
          this.server.respond({ ...msg, response: { has: this.has(msg.params.name) } });
          break;
        case 'plugins_get':
          {
            const plugin = this.get(msg.params.name);
            if (plugin) {
              this.server.respond({ ...msg, response: { plugin: this.toApiPlugin(plugin) } });
            } else {
              this.server.respond({ ...msg, response: { plugin: undefined } });
            }
          }
          break;
        case 'plugins_set':
          this.server.respond({ ...msg, response: { plugin: this.set(msg.params.plugin) } });
          break;
        case 'plugins_storagepluginarray':
          this.server.respond({ ...msg, response: { plugins: this.storagePluginArray() } });
          break;
        case 'plugins_apipluginarray':
          this.server.respond({ ...msg, response: { plugins: this.apiPluginArray() } });
          break;
        case 'plugins_install':
          this.server.respond({ ...msg, response: { packageName: msg.params.packageName, success: await this.install(msg.params.packageName) } });
          break;
        case 'plugins_uninstall':
          this.server.respond({ ...msg, response: { packageName: msg.params.packageName, success: await this.uninstall(msg.params.packageName) } });
          break;
        case 'plugins_add':
          {
            const plugin = await this.add(msg.params.nameOrPath);
            if (plugin) {
              this.server.respond({ ...msg, response: { plugin: this.toApiPlugin(plugin) } });
            } else {
              this.server.respond({ ...msg, response: { plugin } });
            }
          }
          break;
        case 'plugins_remove':
          {
            const plugin = await this.remove(msg.params.nameOrPath);
            if (plugin) {
              this.server.respond({ ...msg, response: { plugin: this.toApiPlugin(plugin) } });
            } else {
              this.server.respond({ ...msg, response: { plugin } });
            }
          }
          break;
        case 'plugins_enable':
          {
            const plugin = await this.enable(msg.params.nameOrPath);
            if (plugin) {
              this.server.respond({ ...msg, response: { plugin: this.toApiPlugin(plugin) } });
            } else {
              this.server.respond({ ...msg, response: { plugin } });
            }
          }
          break;
        case 'plugins_disable':
          {
            const plugin = await this.disable(msg.params.nameOrPath);
            if (plugin) {
              this.server.respond({ ...msg, response: { plugin: this.toApiPlugin(plugin) } });
            } else {
              this.server.respond({ ...msg, response: { plugin } });
            }
          }
          break;
        case 'plugins_load':
          {
            const platform = await this.load(msg.params.plugin);
            if (platform) {
              this.server.respond({ ...msg, params: {}, response: { platform: {} } });
            } else {
              this.server.respond({ ...msg, response: { platform } });
            }
          }
          break;
        case 'plugins_start':
          {
            const plugin = await this.start(msg.params.plugin, msg.params.message, msg.params.configure);
            if (plugin) {
              this.server.respond({ ...msg, params: {}, response: { plugin: this.toApiPlugin(plugin) } });
            } else {
              this.server.respond({ ...msg, response: { plugin } });
            }
          }
          break;
        case 'plugins_configure':
          {
            const plugin = await this.configure(msg.params.plugin);
            if (plugin) {
              this.server.respond({ ...msg, params: {}, response: { plugin: this.toApiPlugin(plugin) } });
            } else {
              this.server.respond({ ...msg, response: { plugin } });
            }
          }
          break;
        case 'plugins_shutdown':
          {
            const plugin = await this.shutdown(msg.params.plugin, msg.params.reason, msg.params.removeAllDevices, msg.params.force);
            if (plugin) {
              this.server.respond({ ...msg, params: {}, response: { plugin: this.toApiPlugin(plugin) } });
            } else {
              this.server.respond({ ...msg, response: { plugin } });
            }
          }
          break;
        default:
          if (this.verbose) this.log.debug(`Unknown broadcast message ${CYAN}${msg.type}${db} from ${CYAN}${msg.src}${db}`);
      }
    }
  }

  /**
   * Gets the number of plugins.
   *
   * @returns {number} The number of plugins.
   */
  get length(): number {
    return this._plugins.size;
  }

  /**
   * Gets the number of plugins.
   *
   * @returns {number} The number of plugins.
   */
  get size(): number {
    return this._plugins.size;
  }

  /**
   * Checks if a plugin with the specified name exists.
   *
   * @param {string} name - The name of the plugin.
   * @returns {boolean} True if the plugin exists, false otherwise.
   */
  has(name: string): boolean {
    return this._plugins.has(name);
  }

  /**
   * Gets a plugin by its name.
   *
   * @param {string} name - The name of the plugin.
   * @returns {Plugin | undefined} The plugin, or undefined if not found.
   */
  get(name: string): Plugin | undefined {
    return this._plugins.get(name);
  }

  /**
   * Adds a plugin to the manager.
   *
   * @param {Plugin} plugin - The plugin to add.
   * @returns {Plugin} The added plugin.
   */
  set(plugin: Plugin): Plugin {
    this._plugins.set(plugin.name, plugin);
    return plugin;
  }

  /**
   * Clears all plugins from the manager.
   */
  clear(): void {
    this._plugins.clear();
  }

  /**
   * Converts a plugin or API plugin to a storage plugin.
   *
   * @param {Plugin | ApiPlugin} plugin - The plugin or API plugin to convert.
   * @returns {StoragePlugin} The converted storage plugin.
   */
  private toStoragePlugin(plugin: Plugin | ApiPlugin): StoragePlugin {
    return {
      name: plugin.name,
      path: plugin.path,
      type: plugin.type,
      version: plugin.version,
      description: plugin.description,
      author: plugin.author,
      enabled: plugin.enabled,
    };
  }

  /**
   * Converts a plugin to an API plugin.
   *
   * @param {Plugin} plugin - The plugin to convert.
   * @returns {ApiPlugin} The converted API plugin.
   */
  private toApiPlugin(plugin: Plugin): ApiPlugin {
    return {
      name: plugin.name,
      version: plugin.version,
      description: plugin.description,
      author: plugin.author,
      path: plugin.path,
      type: plugin.type,
      latestVersion: plugin.latestVersion,
      devVersion: plugin.devVersion,
      homepage: plugin.homepage,
      help: plugin.help,
      changelog: plugin.changelog,
      funding: plugin.funding,
      locked: plugin.locked,
      error: plugin.error,
      enabled: plugin.enabled,
      loaded: plugin.loaded,
      started: plugin.started,
      configured: plugin.configured,
      restartRequired: plugin.restartRequired,
      registeredDevices: plugin.registeredDevices,
      configJson: plugin.configJson,
      schemaJson: plugin.schemaJson,
      hasWhiteList: plugin.hasWhiteList,
      hasBlackList: plugin.hasBlackList,
      matter: plugin.serverNode ? this.matterbridge.getServerNodeData(plugin.serverNode) : undefined,
    };
  }

  /**
   * Gets an array of all plugins.
   *
   * @returns {Plugin[]} An array of all plugins.
   */
  array(): Plugin[] {
    return Array.from(this._plugins.values());
  }

  /**
   * Gets a StoragePlugin array of all plugins suitable for serialization.
   *
   * @returns {StoragePlugin[]} An array of all plugins.
   */
  storagePluginArray(): StoragePlugin[] {
    const storagePlugins: StoragePlugin[] = [];
    for (const plugin of this._plugins.values()) {
      storagePlugins.push(this.toStoragePlugin(plugin));
    }
    return storagePlugins;
  }

  /**
   * Gets an ApiPlugin array of all plugins suitable for serialization.
   *
   * @returns {ApiPlugin[]} An array of all plugins.
   */
  apiPluginArray(): ApiPlugin[] {
    const apiPlugins: ApiPlugin[] = [];
    for (const plugin of this._plugins.values()) {
      apiPlugins.push(this.toApiPlugin(plugin));
    }
    return apiPlugins;
  }

  /**
   * Gets an iterator for the plugins.
   *
   * @returns {IterableIterator<Plugin>} An iterator for the plugins.
   */
  [Symbol.iterator]() {
    return this._plugins.values();
  }

  /**
   * Executes a provided function once for each plugin.
   *
   * @param {Function} callback - The function to execute for each plugin.
   * @returns {Promise<void>}
   */
  async forEach(callback: (plugin: Plugin) => Promise<void>): Promise<void> {
    if (this.size === 0) return;

    const tasks = Array.from(this._plugins.values()).map(async (plugin) => {
      try {
        await callback(plugin);
      } catch (err) {
        logError(this.log, `Error processing forEach plugin ${plg}${plugin.name}${er}`, err);
      }
    });
    await Promise.all(tasks);
  }

  /**
   * Sets the log level for the plugin manager.
   *
   * @param {LogLevel} logLevel - The log level to set.
   */
  set logLevel(logLevel: LogLevel) {
    this.log.logLevel = logLevel;
  }

  /**
   * Loads registered plugins from storage.
   *
   * @returns {Promise<StoragePlugin[]>} A promise that resolves to an array of registered plugins.
   */
  async loadFromStorage(): Promise<StoragePlugin[]> {
    if (!this.matterbridge.nodeContext) {
      throw new Error('loadFromStorage: node context is not available.');
    }
    // Load the array from storage and convert it to a map
    const pluginsArray = await this.matterbridge.nodeContext.get<StoragePlugin[]>('plugins', []);
    for (const plugin of pluginsArray) this._plugins.set(plugin.name, plugin);
    this.log.debug(`Loaded ${BLUE}${pluginsArray.length}${db} plugins from storage`);
    return pluginsArray;
  }

  /**
   * Saves registered plugins to storage.
   *
   * @returns {Promise<number>} A promise that resolves to the number of registered plugins.
   */
  async saveToStorage(): Promise<number> {
    if (!this.matterbridge.nodeContext) {
      throw new Error('loadFromStorage: node context is not available.');
    }
    // Convert the map to an array
    const plugins: StoragePlugin[] = [];
    for (const plugin of this.array()) {
      plugins.push({
        name: plugin.name,
        path: plugin.path,
        type: plugin.type,
        version: plugin.version,
        description: plugin.description,
        author: plugin.author,
        enabled: plugin.enabled,
      });
    }
    await this.matterbridge.nodeContext.set<StoragePlugin[]>('plugins', plugins);
    this.log.debug(`Saved ${BLUE}${plugins.length}${db} plugins to storage`);
    return plugins.length;
  }

  /**
   * Resolves the name of a plugin by loading and parsing its package.json file.
   *
   * @param {string} nameOrPath - The name of the plugin or the path to the plugin's package.json file.
   * @returns {Promise<string | null>} A promise that resolves to the path of the plugin's package.json file or null if it could not be resolved.
   */
  async resolve(nameOrPath: string): Promise<string | null> {
    const { default: path } = await import('node:path');
    const { promises } = await import('node:fs');
    if (!nameOrPath.endsWith('package.json')) nameOrPath = path.join(nameOrPath, 'package.json');

    // Resolve the package.json of the plugin
    let packageJsonPath = path.resolve(nameOrPath);
    this.log.debug(`Resolving plugin path ${plg}${packageJsonPath}${db}`);

    // Check if the package.json file exists
    try {
      await promises.access(packageJsonPath);
    } catch {
      this.log.debug(`Package.json not found at ${plg}${packageJsonPath}${db}`);
      packageJsonPath = path.join(this.matterbridge.globalModulesDirectory, nameOrPath);
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

      this.log.debug(`Resolved plugin path ${plg}${nameOrPath}${db}: ${packageJsonPath}`);
      return packageJsonPath;
    } catch (err) {
      logError(this.log, `Failed to resolve plugin path ${plg}${nameOrPath}${er}`, err);
      return null;
    }
  }

  /**
   * Installs a package globally using npm.
   *
   * @param {string} packageName - The name of the package to install.
   * @returns {Promise<boolean>} A promise that resolves to true if the installation was successful, false otherwise.
   */
  async install(packageName: string): Promise<boolean> {
    this.log.debug(`Installing plugin ${plg}${packageName}${db}...`);
    const { spawnCommand } = await import('./utils/spawn.js');
    if (await spawnCommand('npm', ['install', '-g', packageName, '--omit=dev', '--verbose'], 'install', packageName)) {
      this.matterbridge.restartRequired = true;
      this.matterbridge.fixedRestartRequired = true;
      packageName = packageName.replace(/@.*$/, ''); // Remove @version if present
      if (packageName !== 'matterbridge') {
        if (!this.has(packageName)) await this.add(packageName);
        const plugin = this.get(packageName);
        if (plugin && !plugin.loaded) await this.load(plugin);
      } else {
        if (this.matterbridge.restartMode !== '') {
          await this.matterbridge.shutdownProcess();
        }
      }
      this.log.info(`Installed plugin ${plg}${packageName}${db} successfully`);
      return true;
    } else {
      this.log.error(`Failed to install plugin ${plg}${packageName}${er}`);
      return false;
    }
  }

  /**
   * Uninstalls a package globally using npm.
   *
   * @param {string} packageName - The name of the package to uninstall.
   * @returns {Promise<boolean>} A promise that resolves to true if the uninstallation was successful, false otherwise.
   */
  async uninstall(packageName: string): Promise<boolean> {
    this.log.debug(`Uninstalling plugin ${plg}${packageName}${db}...`);
    const { spawnCommand } = await import('./utils/spawn.js');
    packageName = packageName.replace(/@.*$/, '');
    if (packageName === 'matterbridge') return false;
    if (this.has(packageName)) {
      const plugin = this.get(packageName);
      if (plugin && plugin.loaded) await this.shutdown(plugin, 'Matterbridge is uninstalling the plugin');
      await this.remove(packageName);
    }
    if (await spawnCommand('npm', ['uninstall', '-g', packageName, '--verbose'], 'uninstall', packageName)) {
      this.log.info(`Uninstalled plugin ${plg}${packageName}${db} successfully`);
      return true;
    } else {
      this.log.error(`Failed to uninstall plugin ${plg}${packageName}${er}`);
      return false;
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
   * Parses the plugin package.json and returns it.
   * It will also log warnings and errors for missing or invalid fields.
   * It will return null if critical errors are found.
   *
   * @param {Plugin | PluginName} plugin - The plugin to load the package from.
   * @returns {Promise<Record<string, string | number | object> | null>} A promise that resolves to the parsed package.json object or null if it could not be parsed.
   */
  async parse(plugin: Plugin | PluginName): Promise<Record<string, string | number | object> | null> {
    const { promises } = await import('node:fs');
    if (typeof plugin === 'string') {
      const p = this._plugins.get(plugin);
      if (!p) {
        this.log.error(`Plugin ${plg}${plugin}${er} not found`);
        return null;
      }
      plugin = p;
    }
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
      logError(this.log, `Failed to parse package.json of plugin ${plg}${plugin.name}${er}`, err);
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
   * @returns {Promise<Plugin | null>} A promise that resolves to the enabled plugin object, or null if the plugin could not be enabled.
   */
  async enable(nameOrPath: string): Promise<Plugin | null> {
    const { promises } = await import('node:fs');
    if (!nameOrPath) return null;
    if (this._plugins.has(nameOrPath)) {
      const plugin = this._plugins.get(nameOrPath) as Plugin;
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
      logError(this.log, `Failed to parse package.json of plugin ${plg}${nameOrPath}${er}`, err);
      return null;
    }
  }

  /**
   * Disables a plugin by its name or path.
   *
   * This method disables a plugin by setting its `enabled` property to `false` and saving the updated
   * plugin information to storage. It first checks if the plugin is already registered in the `_plugins` map.
   * If not, it attempts to resolve the plugin's `package.json` file to retrieve its name and disable it.
   *
   * @param {string} nameOrPath - The name or path of the plugin to enable.
   * @returns {Promise<Plugin | null>} A promise that resolves to the disabled plugin object, or null if the plugin could not be disabled.
   */
  async disable(nameOrPath: string): Promise<Plugin | null> {
    const { promises } = await import('node:fs');
    if (!nameOrPath) return null;
    if (this._plugins.has(nameOrPath)) {
      const plugin = this._plugins.get(nameOrPath) as Plugin;
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
      logError(this.log, `Failed to parse package.json of plugin ${plg}${nameOrPath}${er}`, err);
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
   * @returns {Promise<Plugin | null>} A promise that resolves to the removed plugin object, or null if the plugin could not be removed.
   */
  async remove(nameOrPath: string): Promise<Plugin | null> {
    const { promises } = await import('node:fs');
    if (!nameOrPath) return null;
    if (this._plugins.has(nameOrPath)) {
      const plugin = this._plugins.get(nameOrPath) as Plugin;
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
      logError(this.log, `Failed to parse package.json of plugin ${plg}${nameOrPath}${er}`, err);
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
   * @returns {Promise<Plugin | null>} A promise that resolves to the added plugin object, or null if the plugin could not be added.
   */
  async add(nameOrPath: string): Promise<Plugin | null> {
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
        homepage: this.getHomepage(packageJson),
        help: this.getHelp(packageJson),
        changelog: this.getChangelog(packageJson),
        funding: this.getFunding(packageJson),
      });
      this.log.info(`Added plugin ${plg}${packageJson.name}${nf}`);
      await this.saveToStorage();
      const plugin = this._plugins.get(packageJson.name);
      this.emit('added', packageJson.name);
      return plugin as Plugin;
    } catch (err) {
      logError(this.log, `Failed to parse package.json of plugin ${plg}${nameOrPath}${er}`, err);
      return null;
    }
  }

  /**
   * Loads a plugin and returns the corresponding MatterbridgePlatform instance.
   *
   * @param {Plugin | PluginName} plugin - The plugin to load.
   * @param {boolean} start - Optional flag indicating whether to start the plugin after loading. Default is false.
   * @param {string} message - Optional message to pass to the plugin when starting.
   * @param {boolean} configure - Optional flag indicating whether to configure the plugin after loading. Default is false.
   * @returns {Promise<MatterbridgePlatform | undefined>} A Promise that resolves to the loaded MatterbridgePlatform instance or undefined.
   */
  async load(plugin: Plugin | PluginName, start: boolean = false, message: string = '', configure: boolean = false): Promise<MatterbridgePlatform | undefined> {
    const { promises } = await import('node:fs');
    const { default: path } = await import('node:path');
    if (typeof plugin === 'string') {
      const p = this._plugins.get(plugin);
      if (!p) {
        this.log.error(`Plugin ${plg}${plugin}${er} not found`);
        return undefined;
      }
      plugin = p;
    }
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
        config.name = packageJson.name;
        config.version = packageJson.version;

        const log = new AnsiLogger({ logName: plugin.description, logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: (config.debug as boolean) ? LogLevel.DEBUG : this.matterbridge.log.logLevel });
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
      inspectError(this.log, `Failed to load plugin ${plg}${plugin.name}${er}`, err);
      plugin.error = true;
    }
    return undefined;
  }

  /**
   * Starts a plugin.
   *
   * @param {Plugin | PluginName} plugin - The plugin to start.
   * @param {string} [message] - Optional message to pass to the plugin's onStart method.
   * @param {boolean} [configure] - Indicates whether to configure the plugin after starting (default false).
   * @returns {Promise<Plugin | undefined>} A promise that resolves when the plugin is started successfully, or rejects with an error if starting the plugin fails.
   */
  async start(plugin: Plugin | PluginName, message?: string, configure: boolean = false): Promise<Plugin | undefined> {
    if (typeof plugin === 'string') {
      const p = this._plugins.get(plugin);
      if (!p) {
        this.log.error(`Plugin ${plg}${plugin}${er} not found`);
        return undefined;
      }
      plugin = p;
    }
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
      logError(this.log, `Failed to start plugin ${plg}${plugin.name}${er}`, err);
    }
    return undefined;
  }

  /**
   * Configures a plugin.
   *
   * @param {Plugin | PluginName} plugin - The plugin to configure.
   * @returns {Promise<Plugin | undefined>} A promise that resolves when the plugin is configured successfully, or rejects with an error if configuration fails.
   */
  async configure(plugin: Plugin | PluginName): Promise<Plugin | undefined> {
    if (typeof plugin === 'string') {
      const p = this._plugins.get(plugin);
      if (!p) {
        this.log.error(`Plugin ${plg}${plugin}${er} not found`);
        return undefined;
      }
      plugin = p;
    }
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
      logError(this.log, `Failed to configure plugin ${plg}${plugin.name}${er}`, err);
    }
    return undefined;
  }

  /**
   * Shuts down a plugin.
   *
   * This method shuts down a plugin by calling its `onShutdown` method and resetting its state.
   * It logs the shutdown process and optionally removes all devices associated with the plugin.
   *
   * @param {Plugin | PluginName} plugin - The plugin to shut down.
   * @param {string} [reason] - The reason for shutting down the plugin.
   * @param {boolean} [removeAllDevices] - Whether to remove all devices associated with the plugin.
   * @param {boolean} [force] - Whether to force the shutdown even if the plugin is not loaded or started.
   * @returns {Promise<Plugin | undefined>} A promise that resolves to the shut down plugin object, or undefined if the shutdown failed.
   */
  async shutdown(plugin: Plugin | PluginName, reason?: string, removeAllDevices: boolean = false, force: boolean = false): Promise<Plugin | undefined> {
    if (typeof plugin === 'string') {
      const p = this._plugins.get(plugin);
      if (!p) {
        this.log.error(`Plugin ${plg}${plugin}${er} not found`);
        return undefined;
      }
      plugin = p;
    }
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
      this.log.notice(`Shutdown of plugin ${plg}${plugin.name}${nt} completed`);
      this.emit('shutdown', plugin.name);
      return plugin;
    } catch (err) {
      logError(this.log, `Failed to shut down plugin ${plg}${plugin.name}${er}`, err);
    }
    return undefined;
  }

  /**
   * Loads the configuration for a plugin.
   * If the configuration file exists, it reads the file and returns the parsed JSON data.
   * If the configuration file does not exist, it creates a new file with default configuration and returns it.
   * If any error occurs during file access or creation, it logs an error and return un empty config.
   *
   * @param {Plugin} plugin - The plugin for which to load the configuration.
   * @returns {Promise<PlatformConfig>} A promise that resolves to the loaded or created configuration.
   */
  async loadConfig(plugin: Plugin): Promise<PlatformConfig> {
    const { default: path } = await import('node:path');
    const { promises } = await import('node:fs');
    const { shelly_config, somfytahoma_config, zigbee2mqtt_config } = await import('./defaultConfigSchema.js');
    const configFile = path.join(this.matterbridge.matterbridgeDirectory, `${plugin.name}.config.json`);
    const defaultConfigFile = plugin.path.replace('package.json', `${plugin.name}.config.json`);

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
        this.log.debug(`Config file ${configFile} for plugin ${plg}${plugin.name}${db} does not exist, creating new config file...`);
        let config: PlatformConfig;
        try {
          await promises.access(defaultConfigFile);
          const data = await promises.readFile(defaultConfigFile, 'utf8');
          config = JSON.parse(data) as PlatformConfig;
          this.log.debug(`Loaded default config file ${defaultConfigFile} for plugin ${plg}${plugin.name}${db}.`);
        } catch (_err) {
          this.log.debug(`Default config file ${defaultConfigFile} for plugin ${plg}${plugin.name}${db} does not exist, creating new config file...`);
          // TODO: Remove this when all these plugins have their own default config file
          // istanbul ignore next if
          if (plugin.name === 'matterbridge-zigbee2mqtt') config = zigbee2mqtt_config;
          else if (plugin.name === 'matterbridge-somfy-tahoma') config = somfytahoma_config;
          else if (plugin.name === 'matterbridge-shelly') config = shelly_config;
          else config = { name: plugin.name, type: plugin.type, version: '1.0.0', debug: false, unregisterOnShutdown: false };
        }
        try {
          await promises.writeFile(configFile, JSON.stringify(config, null, 2), 'utf8');
          this.log.debug(`Created config file ${configFile} for plugin ${plg}${plugin.name}${db}.`);
          // this.log.debug(`Created config file ${configFile} for plugin ${plg}${plugin.name}${db}.\nConfig:${rs}\n`, config);
          return config;
        } catch (err) {
          logError(this.log, `Error creating config file ${configFile} for plugin ${plg}${plugin.name}${er}`, err);
          return config;
        }
      } else {
        logError(this.log, `Error accessing config file ${configFile} for plugin ${plg}${plugin.name}${er}`, err);
        return { name: plugin.name, type: plugin.type, version: '1.0.0', debug: false, unregisterOnShutdown: false };
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
   * @param {Plugin} plugin - The plugin whose configuration is to be saved.
   * @param {boolean} [restartRequired] - Indicates whether a restart is required after saving the configuration.
   * @returns {Promise<void>} A promise that resolves when the configuration is successfully saved, or rejects if an error occurs.
   * @throws {Error} If the plugin's configuration is not found.
   */
  async saveConfigFromPlugin(plugin: Plugin, restartRequired: boolean = false): Promise<void> {
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
      logError(this.log, `Error saving config file ${configFile} for plugin ${plg}${plugin.name}${er}`, err);
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
   * @param {Plugin} plugin - The plugin whose configuration is to be saved.
   * @param {PlatformConfig} config - The configuration data to be saved.
   * @param {boolean} [restartRequired] - Indicates whether a restart is required after saving the configuration.
   * @returns {Promise<void>} A promise that resolves when the configuration is successfully saved, or returns if an error occurs.
   */
  async saveConfigFromJson(plugin: Plugin, config: PlatformConfig, restartRequired: boolean = false): Promise<void> {
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
      logError(this.log, `Error saving config file ${configFile} for plugin ${plg}${plugin.name}${er}`, err);
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
   * @param {Plugin} plugin - The plugin whose schema is to be loaded.
   * @returns {Promise<PlatformSchema>} A promise that resolves to the loaded schema object, or the default schema if the schema file is not found.
   */
  async loadSchema(plugin: Plugin): Promise<PlatformSchema> {
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
   * @param {Plugin} plugin - The plugin for which the default schema is to be generated.
   * @returns {PlatformSchema} The default schema object for the plugin.
   */
  getDefaultSchema(plugin: Plugin): PlatformSchema {
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
