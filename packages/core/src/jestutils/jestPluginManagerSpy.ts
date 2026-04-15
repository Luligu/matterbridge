/**
 * @description This file contains the Jest helpers.
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

import { jest } from '@jest/globals';

import { PluginManager } from '../pluginManager.js';

// Spy on PluginManager methods
export const destroyPluginSpy = jest.spyOn(PluginManager.prototype, 'destroy');
export const checkDependenciesPluginSpy = jest.spyOn(PluginManager.prototype, 'checkDependencies');
export const lengthPluginSpy = jest.spyOn(PluginManager.prototype, 'length', 'get');
export const sizePluginSpy = jest.spyOn(PluginManager.prototype, 'size', 'get');
export const hasPluginSpy = jest.spyOn(PluginManager.prototype, 'has');
export const getPluginSpy = jest.spyOn(PluginManager.prototype, 'get');
export const setPluginSpy = jest.spyOn(PluginManager.prototype, 'set');
export const clearPluginSpy = jest.spyOn(PluginManager.prototype, 'clear');
export const arrayPluginSpy = jest.spyOn(PluginManager.prototype, 'array');
export const storagePluginArraySpy = jest.spyOn(PluginManager.prototype, 'storagePluginArray');
export const apiPluginArraySpy = jest.spyOn(PluginManager.prototype, 'apiPluginArray');
export const iteratorPluginSpy = jest.spyOn(PluginManager.prototype, Symbol.iterator);
export const forEachPluginSpy = jest.spyOn(PluginManager.prototype, 'forEach');
export const logLevelPluginSpy = jest.spyOn(PluginManager.prototype, 'logLevel', 'set');
export const loadFromStoragePluginSpy = jest.spyOn(PluginManager.prototype, 'loadFromStorage');
export const saveToStoragePluginSpy = jest.spyOn(PluginManager.prototype, 'saveToStorage');
export const resolvePluginSpy = jest.spyOn(PluginManager.prototype, 'resolve');
export const installPluginSpy = jest.spyOn(PluginManager.prototype, 'install');
export const uninstallPluginSpy = jest.spyOn(PluginManager.prototype, 'uninstall');
export const getAuthorPluginSpy = jest.spyOn(PluginManager.prototype, 'getAuthor');
export const getDescriptionPluginSpy = jest.spyOn(PluginManager.prototype, 'getDescription');
export const getHomepagePluginSpy = jest.spyOn(PluginManager.prototype, 'getHomepage');
export const getHelpPluginSpy = jest.spyOn(PluginManager.prototype, 'getHelp');
export const getChangelogPluginSpy = jest.spyOn(PluginManager.prototype, 'getChangelog');
export const getFundingPluginSpy = jest.spyOn(PluginManager.prototype, 'getFunding');
export const parsePluginSpy = jest.spyOn(PluginManager.prototype, 'parse');
export const addPluginSpy = jest.spyOn(PluginManager.prototype, 'add');
export const enablePluginSpy = jest.spyOn(PluginManager.prototype, 'enable');
export const disablePluginSpy = jest.spyOn(PluginManager.prototype, 'disable');
export const removePluginSpy = jest.spyOn(PluginManager.prototype, 'remove');
export const loadPluginSpy = jest.spyOn(PluginManager.prototype, 'load');
export const startPluginSpy = jest.spyOn(PluginManager.prototype, 'start');
export const configurePluginSpy = jest.spyOn(PluginManager.prototype, 'configure');
export const shutdownPluginSpy = jest.spyOn(PluginManager.prototype, 'shutdown');
export const loadConfigPluginSpy = jest.spyOn(PluginManager.prototype, 'loadConfig');
export const saveConfigFromPluginPluginSpy = jest.spyOn(PluginManager.prototype, 'saveConfigFromPlugin');
export const saveConfigFromJsonPluginSpy = jest.spyOn(PluginManager.prototype, 'saveConfigFromJson');
export const loadSchemaPluginSpy = jest.spyOn(PluginManager.prototype, 'loadSchema');
export const getDefaultSchemaPluginSpy = jest.spyOn(PluginManager.prototype, 'getDefaultSchema');
