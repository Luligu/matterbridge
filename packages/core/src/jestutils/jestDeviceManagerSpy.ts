/**
 * @description This file contains the Jest helpers.
 * @file src/jestDeviceManagerSpy.ts
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

import { DeviceManager } from '../deviceManager.js';

// Spy on DeviceManager methods
export const destroyDeviceManagerSpy = jest.spyOn(DeviceManager.prototype, 'destroy');
export const lengthDeviceManagerSpy = jest.spyOn(DeviceManager.prototype, 'length', 'get');
export const sizeDeviceManagerSpy = jest.spyOn(DeviceManager.prototype, 'size', 'get');
export const hasDeviceManagerSpy = jest.spyOn(DeviceManager.prototype, 'has');
export const getDeviceManagerSpy = jest.spyOn(DeviceManager.prototype, 'get');
export const setDeviceManagerSpy = jest.spyOn(DeviceManager.prototype, 'set');
export const removeDeviceManagerSpy = jest.spyOn(DeviceManager.prototype, 'remove');
export const clearDeviceManagerSpy = jest.spyOn(DeviceManager.prototype, 'clear');
export const arrayDeviceManagerSpy = jest.spyOn(DeviceManager.prototype, 'array');
export const baseArrayDeviceManagerSpy = jest.spyOn(DeviceManager.prototype, 'baseArray');
export const iteratorDeviceManagerSpy = jest.spyOn(DeviceManager.prototype, Symbol.iterator);
export const forEachDeviceManagerSpy = jest.spyOn(DeviceManager.prototype, 'forEach');
export const logLevelDeviceManagerSpy = jest.spyOn(DeviceManager.prototype, 'logLevel', 'set');
