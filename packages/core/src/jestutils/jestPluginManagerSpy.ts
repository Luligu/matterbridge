/**
 * @description This file contains the Jest PluginManager spy.
 * @file src/jestPluginManagerSpy.ts
 * @author Luca Liguori
 * @created 2026-04-15
 * @version 1.0.0
 * @license Apache-2.0
 *
 * Copyright 2026, 2027, 2028 Luca Liguori.
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

import { PluginManager } from '../pluginManager.js';

// Spy on PluginManager methods
const { jest } = await import('@jest/globals' as string);
export const destroyPluginSpy: jest.SpiedFunction<typeof PluginManager.prototype.destroy> = jest.spyOn(PluginManager.prototype, 'destroy');
export const checkDependenciesPluginSpy: jest.SpiedFunction<typeof PluginManager.prototype.checkDependencies> = jest.spyOn(PluginManager.prototype, 'checkDependencies');
export const lengthPluginSpy: jest.SpiedGetter<typeof PluginManager.prototype.length> = jest.spyOn(PluginManager.prototype, 'length', 'get');
export const sizePluginSpy: jest.SpiedGetter<typeof PluginManager.prototype.size> = jest.spyOn(PluginManager.prototype, 'size', 'get');
export const hasPluginSpy: jest.SpiedFunction<typeof PluginManager.prototype.has> = jest.spyOn(PluginManager.prototype, 'has');
export const getPluginSpy: jest.SpiedFunction<typeof PluginManager.prototype.get> = jest.spyOn(PluginManager.prototype, 'get');
export const setPluginSpy: jest.SpiedFunction<typeof PluginManager.prototype.set> = jest.spyOn(PluginManager.prototype, 'set');
export const clearPluginSpy: jest.SpiedFunction<typeof PluginManager.prototype.clear> = jest.spyOn(PluginManager.prototype, 'clear');
export const arrayPluginSpy: jest.SpiedFunction<typeof PluginManager.prototype.array> = jest.spyOn(PluginManager.prototype, 'array');
export const storagePluginArraySpy: jest.SpiedFunction<typeof PluginManager.prototype.storagePluginArray> = jest.spyOn(PluginManager.prototype, 'storagePluginArray');
export const apiPluginArraySpy: jest.SpiedFunction<typeof PluginManager.prototype.apiPluginArray> = jest.spyOn(PluginManager.prototype, 'apiPluginArray');
export const iteratorPluginSpy: jest.SpiedFunction<(typeof PluginManager.prototype)[typeof Symbol.iterator]> = jest.spyOn(PluginManager.prototype, Symbol.iterator);
export const forEachPluginSpy: jest.SpiedFunction<typeof PluginManager.prototype.forEach> = jest.spyOn(PluginManager.prototype, 'forEach');
export const logLevelPluginSpy: jest.SpiedSetter<typeof PluginManager.prototype.logLevel> = jest.spyOn(PluginManager.prototype, 'logLevel', 'set');
export const loadFromStoragePluginSpy: jest.SpiedFunction<typeof PluginManager.prototype.loadFromStorage> = jest.spyOn(PluginManager.prototype, 'loadFromStorage');
export const saveToStoragePluginSpy: jest.SpiedFunction<typeof PluginManager.prototype.saveToStorage> = jest.spyOn(PluginManager.prototype, 'saveToStorage');
export const resolvePluginSpy: jest.SpiedFunction<typeof PluginManager.prototype.resolve> = jest.spyOn(PluginManager.prototype, 'resolve');
export const installPluginSpy: jest.SpiedFunction<typeof PluginManager.prototype.install> = jest.spyOn(PluginManager.prototype, 'install');
export const uninstallPluginSpy: jest.SpiedFunction<typeof PluginManager.prototype.uninstall> = jest.spyOn(PluginManager.prototype, 'uninstall');
export const getAuthorPluginSpy: jest.SpiedFunction<typeof PluginManager.prototype.getAuthor> = jest.spyOn(PluginManager.prototype, 'getAuthor');
export const getDescriptionPluginSpy: jest.SpiedFunction<typeof PluginManager.prototype.getDescription> = jest.spyOn(PluginManager.prototype, 'getDescription');
export const getHomepagePluginSpy: jest.SpiedFunction<typeof PluginManager.prototype.getHomepage> = jest.spyOn(PluginManager.prototype, 'getHomepage');
export const getHelpPluginSpy: jest.SpiedFunction<typeof PluginManager.prototype.getHelp> = jest.spyOn(PluginManager.prototype, 'getHelp');
export const getChangelogPluginSpy: jest.SpiedFunction<typeof PluginManager.prototype.getChangelog> = jest.spyOn(PluginManager.prototype, 'getChangelog');
export const getFundingPluginSpy: jest.SpiedFunction<typeof PluginManager.prototype.getFunding> = jest.spyOn(PluginManager.prototype, 'getFunding');
export const parsePluginSpy: jest.SpiedFunction<typeof PluginManager.prototype.parse> = jest.spyOn(PluginManager.prototype, 'parse');
export const addPluginSpy: jest.SpiedFunction<typeof PluginManager.prototype.add> = jest.spyOn(PluginManager.prototype, 'add');
export const enablePluginSpy: jest.SpiedFunction<typeof PluginManager.prototype.enable> = jest.spyOn(PluginManager.prototype, 'enable');
export const disablePluginSpy: jest.SpiedFunction<typeof PluginManager.prototype.disable> = jest.spyOn(PluginManager.prototype, 'disable');
export const removePluginSpy: jest.SpiedFunction<typeof PluginManager.prototype.remove> = jest.spyOn(PluginManager.prototype, 'remove');
export const loadPluginSpy: jest.SpiedFunction<typeof PluginManager.prototype.load> = jest.spyOn(PluginManager.prototype, 'load');
export const startPluginSpy: jest.SpiedFunction<typeof PluginManager.prototype.start> = jest.spyOn(PluginManager.prototype, 'start');
export const configurePluginSpy: jest.SpiedFunction<typeof PluginManager.prototype.configure> = jest.spyOn(PluginManager.prototype, 'configure');
export const shutdownPluginSpy: jest.SpiedFunction<typeof PluginManager.prototype.shutdown> = jest.spyOn(PluginManager.prototype, 'shutdown');
export const loadConfigPluginSpy: jest.SpiedFunction<typeof PluginManager.prototype.loadConfig> = jest.spyOn(PluginManager.prototype, 'loadConfig');
export const saveConfigFromPluginPluginSpy: jest.SpiedFunction<typeof PluginManager.prototype.saveConfigFromPlugin> = jest.spyOn(PluginManager.prototype, 'saveConfigFromPlugin');
export const saveConfigFromJsonPluginSpy: jest.SpiedFunction<typeof PluginManager.prototype.saveConfigFromJson> = jest.spyOn(PluginManager.prototype, 'saveConfigFromJson');
export const loadSchemaPluginSpy: jest.SpiedFunction<typeof PluginManager.prototype.loadSchema> = jest.spyOn(PluginManager.prototype, 'loadSchema');
export const getDefaultSchemaPluginSpy: jest.SpiedFunction<typeof PluginManager.prototype.getDefaultSchema> = jest.spyOn(PluginManager.prototype, 'getDefaultSchema');
