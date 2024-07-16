/* eslint-disable @typescript-eslint/no-unused-vars */
import { AnsiLogger, db, er, nf, pl, TimestampFormat, wr } from 'node-ansi-logger';
import { Matterbridge } from './matterbridge.js';
import { RegisteredPlugin } from './matterbridgeTypes.js';
import { NodeStorage } from 'node-persist-manager';
import path from 'path';
import { promises as fs } from 'fs';

// Default colors
const plg = '\u001B[38;5;33m';
const dev = '\u001B[38;5;79m';
const typ = '\u001B[38;5;207m';

export class Plugins {
  private _plugins = new Map<string, RegisteredPlugin>();
  private nodeContext: NodeStorage;
  private matterbridge: Matterbridge;
  private log: AnsiLogger;

  constructor(matterbridge: Matterbridge) {
    this.matterbridge = matterbridge;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.nodeContext = (matterbridge as any).nodeContext;
    this.log = new AnsiLogger({ logName: 'MatterbridgePluginsManager', logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: matterbridge.debugEnabled });
    this.log.debug('Matterbridge plugin manager starting...');
  }

  get lenght(): number {
    return this._plugins.size;
  }

  get size(): number {
    return this._plugins.size;
  }

  has(name: string): boolean {
    return this._plugins.has(name);
  }

  clear(): void {
    this._plugins.clear();
  }

  [Symbol.iterator]() {
    return this._plugins.values();
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
    this.log.debug(`Saved ${pl}${plugins.length}${db} plugins to storage`);
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
      if (!plugin.name) this.log.warn(`Plugin ${plg}${plugin.name}${wr} has no name in package.json`);
      if (!plugin.version) this.log.warn(`Plugin ${plg}${plugin.name}${wr} has no version in package.json`);
      plugin.name = packageJson.name || 'Unknown name';
      plugin.version = packageJson.version || '1.0.0';
      plugin.description = packageJson.description || 'Unknown description';
      plugin.author = packageJson.author || 'Unknown author';
      if (!plugin.path) this.log.warn(`Plugin ${plg}${plugin.name}${wr} has no path`);
      if (!plugin.type) this.log.warn(`Plugin ${plg}${plugin.name}${wr} has no type`);
      // await this.saveToStorage();
      return packageJson;
    } catch (err) {
      this.log.error(`Failed to parse package.json of plugin ${plg}${plugin.name}${er}: ${err}`);
      plugin.error = true;
      return null;
    }
  }

  async enable(nameOrPath: string): Promise<RegisteredPlugin | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pluginsArray = (this.matterbridge as any).registeredPlugins;
    this._plugins.clear();
    for (const plugin of pluginsArray) this._plugins.set(plugin.name, plugin);

    if (!nameOrPath || nameOrPath === '') return null;
    if (this._plugins.has(nameOrPath)) {
      const plugin = this._plugins.get(nameOrPath) as RegisteredPlugin;
      plugin.enabled = true;
      this.log.info(`Enabled plugin ${plg}${plugin.name}${nf}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.matterbridge as any).registeredPlugins = Array.from(this._plugins.values());
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.matterbridge as any).registeredPlugins = Array.from(this._plugins.values());
      await this.saveToStorage();
      return plugin;
    } catch (err) {
      this.log.error(`Failed to parse package.json of plugin ${plg}${nameOrPath}${er}: ${err}`);
      return null;
    }
  }

  async disable(nameOrPath: string): Promise<RegisteredPlugin | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pluginsArray = (this.matterbridge as any).registeredPlugins;
    this._plugins.clear();
    for (const plugin of pluginsArray) this._plugins.set(plugin.name, plugin);

    if (!nameOrPath || nameOrPath === '') return null;
    if (this._plugins.has(nameOrPath)) {
      const plugin = this._plugins.get(nameOrPath) as RegisteredPlugin;
      plugin.enabled = false;
      this.log.info(`Disabled plugin ${plg}${plugin.name}${nf}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.matterbridge as any).registeredPlugins = Array.from(this._plugins.values());
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.matterbridge as any).registeredPlugins = Array.from(this._plugins.values());
      await this.saveToStorage();
      return plugin;
    } catch (err) {
      this.log.error(`Failed to parse package.json of plugin ${plg}${nameOrPath}${er}: ${err}`);
      return null;
    }
  }

  async remove(nameOrPath: string): Promise<RegisteredPlugin | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pluginsArray = (this.matterbridge as any).registeredPlugins;
    this._plugins.clear();
    for (const plugin of pluginsArray) this._plugins.set(plugin.name, plugin);

    if (!nameOrPath || nameOrPath === '') return null;
    if (this._plugins.has(nameOrPath)) {
      const plugin = this._plugins.get(nameOrPath) as RegisteredPlugin;
      this._plugins.delete(nameOrPath);
      this.log.info(`Removed plugin ${plg}${plugin.name}${nf}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.matterbridge as any).registeredPlugins = Array.from(this._plugins.values());
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.matterbridge as any).registeredPlugins = Array.from(this._plugins.values());
      await this.saveToStorage();
      return plugin;
    } catch (err) {
      this.log.error(`Failed to parse package.json of plugin ${plg}${nameOrPath}${er}: ${err}`);
      return null;
    }
  }

  async add(nameOrPath: string): Promise<RegisteredPlugin | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pluginsArray = (this.matterbridge as any).registeredPlugins;
    this._plugins.clear();
    for (const plugin of pluginsArray) this._plugins.set(plugin.name, plugin);

    if (!nameOrPath || nameOrPath === '') return null;
    const packageJsonPath = await this.resolve(nameOrPath);
    if (!packageJsonPath) {
      this.log.error(`Failed to add plugin ${plg}${nameOrPath}${er}: package.json not found`);
      return null;
    }
    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      if (this._plugins.get(packageJson.name)) {
        this.log.error(`Failed to add plugin ${plg}${nameOrPath}${er}: plugin already registered`);
        return null;
      }
      this._plugins.set(packageJson.name, { name: packageJson.name, enabled: true, path: packageJsonPath, type: '', version: packageJson.version, description: packageJson.description, author: packageJson.author });
      this.log.info(`Added plugin ${plg}${packageJson.name}${nf}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.matterbridge as any).registeredPlugins = Array.from(this._plugins.values());
      await this.saveToStorage();
      const plugin = this._plugins.get(packageJson.name);
      return plugin || null;
    } catch (err) {
      this.log.error(`Failed to parse package.json of plugin ${plg}${nameOrPath}${er}: ${err}`);
      return null;
    }
  }
}
