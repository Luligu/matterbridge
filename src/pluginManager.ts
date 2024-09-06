/**
 * This file contains the Plugins class.
 *
 * @file plugins.ts
 * @author Luca Liguori
 * @date 2024-07-14
 * @version 1.0.8
 *
 * Copyright 2024 Luca Liguori.
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

/* eslint-disable @typescript-eslint/no-unused-vars */
import { AnsiLogger, BLUE, db, er, LogLevel, nf, nt, pl, rs, TimestampFormat, UNDERLINE, UNDERLINEOFF, wr } from 'node-ansi-logger';
import { Matterbridge } from './matterbridge.js';
import { plg, RegisteredPlugin, typ } from './matterbridgeTypes.js';
import { NodeStorage } from 'node-persist-manager';
import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { MatterbridgePlatform, PlatformConfig, PlatformSchema } from './matterbridgePlatform.js';
import { exec, ExecException } from 'child_process';
import { shelly_config, somfytahoma_config, zigbee2mqtt_config } from './defaultConfigSchema.js';

export class PluginManager {
  private _plugins = new Map<string, RegisteredPlugin>();
  private nodeContext: NodeStorage;
  private matterbridge: Matterbridge;
  private log: AnsiLogger;

  constructor(matterbridge: Matterbridge) {
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
    const tasks = Array.from(this._plugins.values()).map(async (plugin) => {
      try {
        await callback(plugin);
      } catch (error) {
        this.log.error(`Error processing forEach plugin ${plg}${plugin.name}${er}:`, error);
        // throw error;
      }
    });
    await Promise.all(tasks);
  }

  get logLevel(): LogLevel {
    return this.log.logLevel;
  }

  set logLevel(logLevel: LogLevel) {
    this.log.logLevel = logLevel;
  }

  async loadFromStorage(): Promise<RegisteredPlugin[]> {
    // Load the array from storage and convert it to a map
    const pluginsArray = await this.nodeContext.get<RegisteredPlugin[]>('plugins', []);
    for (const plugin of pluginsArray) this._plugins.set(plugin.name, plugin);
    return pluginsArray;
  }

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
   * @param pluginPath - The path to the plugin or the path to the plugin's package.json file.
   * @returns The path to the resolved package.json file, or null if the package.json file is not found or does not contain a name.
   */
  async resolve(pluginPath: string): Promise<string | null> {
    if (!pluginPath.endsWith('package.json')) pluginPath = path.join(pluginPath, 'package.json');

    // Resolve the package.json of the plugin
    let packageJsonPath = path.resolve(pluginPath);
    this.log.debug(`Resolving plugin path ${plg}${packageJsonPath}${db}`);

    // Check if the package.json file exists
    try {
      await fs.access(packageJsonPath);
    } catch {
      this.log.debug(`Package.json not found at ${plg}${packageJsonPath}${db}`);
      packageJsonPath = path.join(this.matterbridge.globalModulesDirectory, pluginPath);
      this.log.debug(`Trying at ${plg}${packageJsonPath}${db}`);
    }
    try {
      // Load the package.json of the plugin
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      if (!packageJson.name) {
        this.log.debug(`Package.json name not found at ${packageJsonPath}`);
        return null;
      }

      // Check for @project-chip packages in dependencies and devDependencies
      const checkForProjectChipPackages = (dependencies: Record<string, string>) => {
        return Object.keys(dependencies).filter((pkg) => pkg.startsWith('@project-chip'));
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

      this.log.debug(`Resolved plugin path ${plg}${pluginPath}${db}: ${packageJsonPath}`);
      return packageJsonPath;
    } catch (err) {
      this.log.error(`Failed to resolve plugin path ${plg}${pluginPath}${er}: ${err}`);
      return null;
    }
  }

  /**
   * Loads and parse the plugin package.json and returns it.
   * @param plugin - The plugin to load the package from.
   * @returns A Promise that resolves to the package.json object or undefined if the package.json could not be loaded.
   */
  async parse(plugin: RegisteredPlugin): Promise<Record<string, string | number | object> | null> {
    this.log.debug(`Parsing package.json of plugin ${plg}${plugin.name}${db}`);
    try {
      const packageJson = JSON.parse(await fs.readFile(plugin.path, 'utf8'));
      if (!packageJson.name) this.log.warn(`Plugin ${plg}${plugin.name}${wr} has no name in package.json`);
      if (!packageJson.version) this.log.warn(`Plugin ${plg}${plugin.name}${wr} has no version in package.json`);
      if (!packageJson.description) this.log.warn(`Plugin ${plg}${plugin.name}${wr} has no description in package.json`);
      if (!packageJson.author) this.log.warn(`Plugin ${plg}${plugin.name}${wr} has no author in package.json`);
      if (!packageJson.type || packageJson.type !== 'module') this.log.error(`Plugin ${plg}${plugin.name}${er} is not a module`);
      if (!packageJson.main) this.log.error(`Plugin ${plg}${plugin.name}${er} has no main entrypoint in package.json`);
      if (!packageJson.types) this.log.error(`Plugin ${plg}${plugin.name}${er} has no types in package.json`);
      plugin.name = packageJson.name || 'Unknown name';
      plugin.version = packageJson.version || '1.0.0';
      plugin.description = packageJson.description || 'Unknown description';
      plugin.author = packageJson.author || 'Unknown author';
      if (!plugin.path) this.log.warn(`Plugin ${plg}${plugin.name}${wr} has no path`);
      if (!plugin.type) this.log.warn(`Plugin ${plg}${plugin.name}${wr} has no type`);

      // Check for @project-chip packages in dependencies and devDependencies
      const checkForProjectChipPackages = (dependencies: Record<string, string>) => {
        return Object.keys(dependencies).filter((pkg) => pkg.startsWith('@project-chip'));
      };
      const projectChipDependencies = checkForProjectChipPackages(packageJson.dependencies || {});
      if (projectChipDependencies.length > 0) {
        this.log.error(`Found @project-chip packages "${projectChipDependencies.join(', ')}" in plugin ${plg}${plugin.name}${er} dependencies.`);
        this.log.error(`Please open an issue on the plugin repository to remove them.`);
        this.log.error(`In the next release this plugin will not be loaded cause it doesn't meet the requirements.`);
      }
      const projectChipDevDependencies = checkForProjectChipPackages(packageJson.devDependencies || {});
      if (projectChipDevDependencies.length > 0) {
        this.log.error(`Found @project-chip packages "${projectChipDevDependencies.join(', ')}" in plugin ${plg}${plugin.name}${er} devDependencies.`);
        this.log.error(`Please open an issue on the plugin repository to remove them.`);
        this.log.error(`In the next release this plugin will not be loaded cause it doesn't meet the requirements.`);
      }

      // Check for matterbridge package in dependencies and devDependencies
      const checkForMatterbridgePackage = (dependencies: Record<string, string>) => {
        return Object.keys(dependencies).filter((pkg) => pkg === 'matterbridge');
      };
      const matterbridgeDependencies = checkForMatterbridgePackage(packageJson.dependencies || {});
      if (matterbridgeDependencies.length > 0) {
        this.log.error(`Found matterbridge package in the plugin ${plg}${plugin.name}${er} dependencies.`);
        this.log.error(`Please open an issue on the plugin repository to remove them.`);
        this.log.error(`In the next release this plugin will not be loaded cause it doesn't meet the requirements.`);
      }
      const matterbridgeDevDependencies = checkForMatterbridgePackage(packageJson.devDependencies || {});
      if (matterbridgeDevDependencies.length > 0) {
        this.log.error(`Found matterbridge package in the plugin ${plg}${plugin.name}${er} devDependencies.`);
        this.log.error(`Please open an issue on the plugin repository to remove them.`);
        this.log.error(`In the next release this plugin will not be loaded cause it doesn't meet the requirements.`);
      }

      // await this.saveToStorage(); // No need to save the plugin to storage
      return packageJson;
    } catch (err) {
      this.log.error(`Failed to parse package.json of plugin ${plg}${plugin.name}${er}: ${err}`);
      plugin.error = true;
      return null;
    }
  }

  async enable(nameOrPath: string): Promise<RegisteredPlugin | null> {
    if (!nameOrPath || nameOrPath === '') return null;
    if (this._plugins.has(nameOrPath)) {
      const plugin = this._plugins.get(nameOrPath) as RegisteredPlugin;
      plugin.enabled = true;
      this.log.info(`Enabled plugin ${plg}${plugin.name}${nf}`);
      await this.saveToStorage();
      return plugin;
    }
    const packageJsonPath = await this.resolve(nameOrPath);
    if (!packageJsonPath) {
      this.log.error(`Failed to enable plugin ${plg}${nameOrPath}${er}: package.json not found`);
      return null;
    }
    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      const plugin = this._plugins.get(packageJson.name);
      if (!plugin) {
        this.log.error(`Failed to enable plugin ${plg}${nameOrPath}${er}: plugin not registered`);
        return null;
      }
      plugin.enabled = true;
      this.log.info(`Enabled plugin ${plg}${plugin.name}${nf}`);
      await this.saveToStorage();
      return plugin;
    } catch (err) {
      this.log.error(`Failed to parse package.json of plugin ${plg}${nameOrPath}${er}: ${err}`);
      return null;
    }
  }

  async disable(nameOrPath: string): Promise<RegisteredPlugin | null> {
    if (!nameOrPath || nameOrPath === '') return null;
    if (this._plugins.has(nameOrPath)) {
      const plugin = this._plugins.get(nameOrPath) as RegisteredPlugin;
      plugin.enabled = false;
      this.log.info(`Disabled plugin ${plg}${plugin.name}${nf}`);
      await this.saveToStorage();
      return plugin;
    }
    const packageJsonPath = await this.resolve(nameOrPath);
    if (!packageJsonPath) {
      this.log.error(`Failed to disable plugin ${plg}${nameOrPath}${er}: package.json not found`);
      return null;
    }
    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      const plugin = this._plugins.get(packageJson.name);
      if (!plugin) {
        this.log.error(`Failed to disable plugin ${plg}${nameOrPath}${er}: plugin not registered`);
        return null;
      }
      plugin.enabled = false;
      this.log.info(`Disabled plugin ${plg}${plugin.name}${nf}`);
      await this.saveToStorage();
      return plugin;
    } catch (err) {
      this.log.error(`Failed to parse package.json of plugin ${plg}${nameOrPath}${er}: ${err}`);
      return null;
    }
  }

  async remove(nameOrPath: string): Promise<RegisteredPlugin | null> {
    if (!nameOrPath || nameOrPath === '') return null;
    if (this._plugins.has(nameOrPath)) {
      const plugin = this._plugins.get(nameOrPath) as RegisteredPlugin;
      this._plugins.delete(nameOrPath);
      this.log.info(`Removed plugin ${plg}${plugin.name}${nf}`);
      await this.saveToStorage();
      return plugin;
    }
    const packageJsonPath = await this.resolve(nameOrPath);
    if (!packageJsonPath) {
      this.log.error(`Failed to remove plugin ${plg}${nameOrPath}${er}: package.json not found`);
      return null;
    }
    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      const plugin = this._plugins.get(packageJson.name);
      if (!plugin) {
        this.log.error(`Failed to remove plugin ${plg}${nameOrPath}${er}: plugin not registered`);
        return null;
      }
      this._plugins.delete(packageJson.name);
      this.log.info(`Removed plugin ${plg}${plugin.name}${nf}`);
      await this.saveToStorage();
      return plugin;
    } catch (err) {
      this.log.error(`Failed to parse package.json of plugin ${plg}${nameOrPath}${er}: ${err}`);
      return null;
    }
  }

  async add(nameOrPath: string): Promise<RegisteredPlugin | null> {
    if (!nameOrPath || nameOrPath === '') return null;
    const packageJsonPath = await this.resolve(nameOrPath);
    if (!packageJsonPath) {
      this.log.error(`Failed to add plugin ${plg}${nameOrPath}${er}: package.json not found`);
      return null;
    }
    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      if (this._plugins.get(packageJson.name)) {
        this.log.info(`Plugin ${plg}${nameOrPath}${nf} already registered`);
        return null;
      }
      this._plugins.set(packageJson.name, { name: packageJson.name, enabled: true, path: packageJsonPath, type: '', version: packageJson.version, description: packageJson.description, author: packageJson.author });
      this.log.info(`Added plugin ${plg}${packageJson.name}${nf}`);
      await this.saveToStorage();
      const plugin = this._plugins.get(packageJson.name);
      return plugin || null;
    } catch (err) {
      this.log.error(`Failed to parse package.json of plugin ${plg}${nameOrPath}${er}: ${err}`);
      return null;
    }
  }

  async install(name: string): Promise<string | undefined> {
    this.log.info(`Installing plugin ${plg}${name}${nf}`);
    return new Promise((resolve, reject) => {
      exec(`npm install -g ${name}`, (error: ExecException | null, stdout: string, stderr: string) => {
        if (error) {
          this.log.error(`Failed to install plugin ${plg}${name}${er}: ${error}`);
          this.log.debug(`Failed to install plugin ${plg}${name}${db}: ${stderr}`);
          resolve(undefined);
        } else {
          this.log.info(`Installed plugin ${plg}${name}${nf}`);
          this.log.debug(`Installed plugin ${plg}${name}${db}: ${stdout}`);
          // Get the installed version
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
              resolve(version);
            } else {
              resolve(undefined);
            }
          });
        }
      });
    });
  }

  async uninstall(name: string): Promise<string | undefined> {
    this.log.info(`Uninstalling plugin ${plg}${name}${nf}`);
    return new Promise((resolve, reject) => {
      exec(`npm uninstall -g ${name}`, (error: ExecException | null, stdout: string, stderr: string) => {
        if (error) {
          this.log.error(`Failed to uninstall plugin ${plg}${name}${er}: ${error}`);
          this.log.debug(`Failed to uninstall plugin ${plg}${name}${db}: ${stderr}`);
          // console.error(`Failed to uninstall plugin ${plg}${name}${er}: ${stderr}`);
          resolve(undefined);
        } else {
          this.log.info(`Uninstalled plugin ${plg}${name}${nf}`);
          this.log.debug(`Uninstalled plugin ${plg}${name}${db}: ${stdout}`);
          // console.error(`Uninstalled plugin ${plg}${name}${nf}: ${stdout}`);
          resolve(name);
        }
      });
    });
  }

  /**
   * Loads a plugin and returns the corresponding MatterbridgePlatform instance.
   * @param plugin - The plugin to load.
   * @param start - Optional flag indicating whether to start the plugin after loading. Default is false.
   * @param message - Optional message to pass to the plugin when starting.
   * @returns A Promise that resolves to the loaded MatterbridgePlatform instance.
   * @throws An error if the plugin is not enabled, already loaded, or fails to load.
   */
  async load(plugin: RegisteredPlugin, start = false, message = '', configure = false): Promise<MatterbridgePlatform | undefined> {
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
      const packageJson = JSON.parse(await fs.readFile(plugin.path, 'utf8'));
      // Resolve the main module path relative to package.json
      const pluginEntry = path.resolve(path.dirname(plugin.path), packageJson.main);
      // Dynamically import the plugin
      const pluginUrl = pathToFileURL(pluginEntry);
      this.log.debug(`Importing plugin ${plg}${plugin.name}${db} from ${pluginUrl.href}`);
      const pluginInstance = await import(pluginUrl.href);
      this.log.debug(`Imported plugin ${plg}${plugin.name}${db} from ${pluginUrl.href}`);

      // Call the default export function of the plugin, passing this MatterBridge instance, the log and the config
      if (pluginInstance.default) {
        const config: PlatformConfig = await this.loadConfig(plugin);
        const log = new AnsiLogger({ logName: plugin.description ?? 'No description', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: (config.debug as boolean) ? LogLevel.DEBUG : this.matterbridge.log.logLevel });
        const platform = pluginInstance.default(this.matterbridge, log, config) as MatterbridgePlatform;
        config.type = platform.type;
        platform.name = packageJson.name;
        platform.config = config;
        platform.version = packageJson.version;
        plugin.name = packageJson.name;
        plugin.description = packageJson.description ?? 'No description';
        plugin.version = packageJson.version;
        plugin.author = packageJson.author ?? 'Unknown';
        plugin.type = platform.type;
        plugin.platform = platform;
        plugin.loaded = true;
        plugin.registeredDevices = 0;
        plugin.addedDevices = 0;
        plugin.configJson = config;
        plugin.schemaJson = await this.loadSchema(plugin);

        await this.saveToStorage(); // Save the plugin to storage

        this.log.notice(`Loaded plugin ${plg}${plugin.name}${nf} type ${typ}${platform.type}${db} (entrypoint ${UNDERLINE}${pluginEntry}${UNDERLINEOFF})`);

        if (start) await this.start(plugin, message, false);

        if (configure) await this.configure(plugin);

        return platform;
      } else {
        this.log.error(`Plugin ${plg}${plugin.name}${er} does not provide a default export`);
        plugin.error = true;
      }
    } catch (err) {
      this.log.error(`Failed to load plugin ${plg}${plugin.name}${er}: ${err}`);
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
      if (configure) await this.configure(plugin);
      return plugin;
    } catch (err) {
      plugin.error = true;
      this.log.error(`Failed to start plugin ${plg}${plugin.name}${er}: ${err}`);
    }
    return undefined;
  }

  /**
   * Configures a plugin.
   *
   * @param {RegisteredPlugin} plugin - The plugin to configure.
   * @returns {Promise<void>} A promise that resolves when the plugin is configured successfully, or rejects with an error if configuration fails.
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
      await this.saveConfigFromPlugin(plugin);
      return plugin;
    } catch (err) {
      plugin.error = true;
      this.log.error(`Failed to configure plugin ${plg}${plugin.name}${er}: ${err}`);
    }
    return undefined;
  }

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
      this.log.debug(`*Plugin ${plg}${plugin.name}${db} no platform found`);
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
      plugin.connected = undefined;
      plugin.platform = undefined;
      if (removeAllDevices) {
        this.log.info(`Removing all devices for plugin ${plg}${plugin.name}${nf}: ${reason}...`);
        await this.matterbridge.removeAllBridgedDevices(plugin.name);
      }
      plugin.registeredDevices = undefined;
      plugin.addedDevices = undefined;
      this.log.notice(`Shutdown of plugin ${plg}${plugin.name}${nt} completed`);
      return plugin;
    } catch (err) {
      this.log.error(`Failed to shut down plugin ${plg}${plugin.name}${er}: ${err}`);
    }
    return undefined;
  }

  /**
   * Loads the configuration for a plugin.
   * If the configuration file exists, it reads the file and returns the parsed JSON data.
   * If the configuration file does not exist, it creates a new file with default configuration and returns it.
   * If any error occurs during file access or creation, it logs an error and return un empty config.
   *
   * @param plugin - The plugin for which to load the configuration.
   * @returns A promise that resolves to the loaded or created configuration.
   */
  async loadConfig(plugin: RegisteredPlugin): Promise<PlatformConfig> {
    const configFile = path.join(this.matterbridge.matterbridgeDirectory, `${plugin.name}.config.json`);
    try {
      await fs.access(configFile);
      const data = await fs.readFile(configFile, 'utf8');
      const config = JSON.parse(data) as PlatformConfig;
      this.log.debug(`Loaded config file ${configFile} for plugin ${plg}${plugin.name}${db}.`);
      // this.log.debug(`Loaded config file ${configFile} for plugin ${plg}${plugin.name}${db}.\nConfig:${rs}\n`, config);
      /* The first time a plugin is added to the system, the config file is created with the plugin name and type "".*/
      config.name = plugin.name;
      config.type = plugin.type;
      if (config.debug === undefined) config.debug = false;
      if (config.unregisterOnShutdown === undefined) config.unregisterOnShutdown = false;
      return config;
    } catch (err) {
      if (err) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'ENOENT') {
          let config: PlatformConfig;
          if (plugin.name === 'matterbridge-zigbee2mqtt') config = zigbee2mqtt_config;
          else if (plugin.name === 'matterbridge-somfy-tahoma') config = somfytahoma_config;
          else if (plugin.name === 'matterbridge-shelly') config = shelly_config;
          else config = { name: plugin.name, type: plugin.type, debug: false, unregisterOnShutdown: false };
          try {
            await fs.writeFile(configFile, JSON.stringify(config, null, 2), 'utf8');
            this.log.debug(`Created config file ${configFile} for plugin ${plg}${plugin.name}${db}.`);
            // this.log.debug(`Created config file ${configFile} for plugin ${plg}${plugin.name}${db}.\nConfig:${rs}\n`, config);
            return config;
          } catch (err) {
            this.log.error(`Error creating config file ${configFile} for plugin ${plg}${plugin.name}${er}: ${err}`);
            return config;
          }
        } else {
          this.log.error(`Error accessing config file ${configFile} for plugin ${plg}${plugin.name}${er}: ${err}`);
          return { name: plugin.name, type: plugin.type, debug: false, unregisterOnShutdown: false };
        }
      }
      this.log.error(`Error loading config file ${configFile} for plugin ${plg}${plugin.name}${er}: ${err}`);
      return { name: plugin.name, type: plugin.type, debug: false, unregisterOnShutdown: false };
    }
  }

  async saveConfigFromPlugin(plugin: RegisteredPlugin): Promise<void> {
    if (!plugin.platform?.config) {
      this.log.error(`Error saving config file for plugin ${plg}${plugin.name}${er}: config not found`);
      return Promise.reject(new Error(`Error saving config file for plugin ${plg}${plugin.name}${er}: config not found`));
    }
    const configFile = path.join(this.matterbridge.matterbridgeDirectory, `${plugin.name}.config.json`);
    try {
      await fs.writeFile(configFile, JSON.stringify(plugin.platform.config, null, 2), 'utf8');
      this.log.debug(`Saved config file ${configFile} for plugin ${plg}${plugin.name}${db}`);
      // this.log.debug(`Saved config file ${configFile} for plugin ${plg}${plugin.name}${db}.\nConfig:${rs}\n`, plugin.platform.config);
      return Promise.resolve();
    } catch (err) {
      this.log.error(`Error saving config file ${configFile} for plugin ${plg}${plugin.name}${er}: ${err}`);
      return Promise.reject(err);
    }
  }

  async saveConfigFromJson(plugin: RegisteredPlugin, config: PlatformConfig): Promise<void> {
    if (!config.name || !config.type || config.name !== plugin.name) {
      this.log.error(`Error saving config file for plugin ${plg}${plugin.name}${er}. Wrong config data content:${rs}\n`, config);
      return;
    }
    const configFile = path.join(this.matterbridge.matterbridgeDirectory, `${plugin.name}.config.json`);
    try {
      await fs.writeFile(configFile, JSON.stringify(config, null, 2), 'utf8');
      plugin.configJson = config;
      this.log.debug(`Saved config file ${configFile} for plugin ${plg}${plugin.name}${db}`);
      // this.log.debug(`Saved config file ${configFile} for plugin ${plg}${plugin.name}${db}.\nConfig:${rs}\n`, config);
    } catch (err) {
      this.log.error(`Error saving config file ${configFile} for plugin ${plg}${plugin.name}${er}: ${err}`);
      return;
    }
  }

  async loadSchema(plugin: RegisteredPlugin): Promise<PlatformSchema> {
    let schemaFile = plugin.path.replace('package.json', `${plugin.name}.schema.json`);
    try {
      await fs.access(schemaFile);
      const data = await fs.readFile(schemaFile, 'utf8');
      const schema = JSON.parse(data) as PlatformSchema;
      schema.title = plugin.description;
      schema.description = plugin.name + ' v. ' + plugin.version + ' by ' + plugin.author;
      this.log.debug(`Loaded schema file ${schemaFile} for plugin ${plg}${plugin.name}${db}.`);
      // this.log.debug(`Loaded schema file ${schemaFile} for plugin ${plg}${plugin.name}${db}.\nSchema:${rs}\n`, schema);
      // Delete the schema file from old position
      schemaFile = path.join(this.matterbridge.matterbridgeDirectory, `${plugin.name}.schema.json`);
      try {
        await fs.unlink(schemaFile);
        this.log.debug(`Schema file ${schemaFile} deleted.`);
      } catch (err) {
        this.log.debug(`Schema file ${schemaFile} to delete not found.`);
      }
      return schema;
    } catch (err) {
      this.log.debug(`Schema file ${schemaFile} for plugin ${plg}${plugin.name}${db} not found. Loading default schema.`);
      return this.getDefaultSchema(plugin);
    }
  }

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
