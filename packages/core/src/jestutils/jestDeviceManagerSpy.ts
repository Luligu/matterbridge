/**
 * @description This file contains the Jest DeviceManager spy.
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

import { DeviceManager } from '../deviceManager.js';

// Spy on DeviceManager methods
const { jest } = await import('@jest/globals' as string);
export const destroyDeviceManagerSpy: jest.SpiedFunction<typeof DeviceManager.prototype.destroy> = jest.spyOn(DeviceManager.prototype, 'destroy');
export const lengthDeviceManagerSpy: jest.SpiedGetter<typeof DeviceManager.prototype.length> = jest.spyOn(DeviceManager.prototype, 'length', 'get');
export const sizeDeviceManagerSpy: jest.SpiedGetter<typeof DeviceManager.prototype.size> = jest.spyOn(DeviceManager.prototype, 'size', 'get');
export const hasDeviceManagerSpy: jest.SpiedFunction<typeof DeviceManager.prototype.has> = jest.spyOn(DeviceManager.prototype, 'has');
export const getDeviceManagerSpy: jest.SpiedFunction<typeof DeviceManager.prototype.get> = jest.spyOn(DeviceManager.prototype, 'get');
export const setDeviceManagerSpy: jest.SpiedFunction<typeof DeviceManager.prototype.set> = jest.spyOn(DeviceManager.prototype, 'set');
export const removeDeviceManagerSpy: jest.SpiedFunction<typeof DeviceManager.prototype.remove> = jest.spyOn(DeviceManager.prototype, 'remove');
export const clearDeviceManagerSpy: jest.SpiedFunction<typeof DeviceManager.prototype.clear> = jest.spyOn(DeviceManager.prototype, 'clear');
export const arrayDeviceManagerSpy: jest.SpiedFunction<typeof DeviceManager.prototype.array> = jest.spyOn(DeviceManager.prototype, 'array');
export const baseArrayDeviceManagerSpy: jest.SpiedFunction<typeof DeviceManager.prototype.baseArray> = jest.spyOn(DeviceManager.prototype, 'baseArray');
export const iteratorDeviceManagerSpy: jest.SpiedFunction<(typeof DeviceManager.prototype)[typeof Symbol.iterator]> = jest.spyOn(DeviceManager.prototype, Symbol.iterator);
export const forEachDeviceManagerSpy: jest.SpiedFunction<typeof DeviceManager.prototype.forEach> = jest.spyOn(DeviceManager.prototype, 'forEach');
export const logLevelDeviceManagerSpy: jest.SpiedSetter<typeof DeviceManager.prototype.logLevel> = jest.spyOn(DeviceManager.prototype, 'logLevel', 'set');
