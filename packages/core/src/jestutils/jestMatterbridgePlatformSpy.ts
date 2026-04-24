/**
 * @description This file contains the Jest Spy helpers for MatterbridgePlatform.
 * @file src/jestMatterbridgePlatformSpy.ts
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

import { MatterbridgePlatform } from '../matterbridgePlatform.js';

// Spy on MatterbridgePlatform methods
// @ts-expect-error - access to private members for testing
export const destroyMatterbridgePlatformSpy = jest.spyOn(MatterbridgePlatform.prototype, 'destroy');
export const onStartMatterbridgePlatformSpy = jest.spyOn(MatterbridgePlatform.prototype, 'onStart');
export const onConfigureMatterbridgePlatformSpy = jest.spyOn(MatterbridgePlatform.prototype, 'onConfigure');
export const onShutdownMatterbridgePlatformSpy = jest.spyOn(MatterbridgePlatform.prototype, 'onShutdown');
export const onChangeLoggerLevelMatterbridgePlatformSpy = jest.spyOn(MatterbridgePlatform.prototype, 'onChangeLoggerLevel');
export const onActionMatterbridgePlatformSpy = jest.spyOn(MatterbridgePlatform.prototype, 'onAction');
export const onConfigChangedMatterbridgePlatformSpy = jest.spyOn(MatterbridgePlatform.prototype, 'onConfigChanged');
export const saveConfigMatterbridgePlatformSpy = jest.spyOn(MatterbridgePlatform.prototype, 'saveConfig');
export const getSchemaMatterbridgePlatformSpy = jest.spyOn(MatterbridgePlatform.prototype, 'getSchema');
export const setSchemaMatterbridgePlatformSpy = jest.spyOn(MatterbridgePlatform.prototype, 'setSchema');
export const wssSendRestartRequiredMatterbridgePlatformSpy = jest.spyOn(MatterbridgePlatform.prototype, 'wssSendRestartRequired');
export const wssSendSnackbarMessageMatterbridgePlatformSpy = jest.spyOn(MatterbridgePlatform.prototype, 'wssSendSnackbarMessage');
export const sizeMatterbridgePlatformSpy = jest.spyOn(MatterbridgePlatform.prototype, 'size');
export const getDevicesMatterbridgePlatformSpy = jest.spyOn(MatterbridgePlatform.prototype, 'getDevices');
export const getDeviceByNameMatterbridgePlatformSpy = jest.spyOn(MatterbridgePlatform.prototype, 'getDeviceByName');
export const getDeviceByUniqueIdMatterbridgePlatformSpy = jest.spyOn(MatterbridgePlatform.prototype, 'getDeviceByUniqueId');
export const getDeviceBySerialNumberMatterbridgePlatformSpy = jest.spyOn(MatterbridgePlatform.prototype, 'getDeviceBySerialNumber');
export const getDeviceByIdMatterbridgePlatformSpy = jest.spyOn(MatterbridgePlatform.prototype, 'getDeviceById');
export const getDeviceByOriginalIdMatterbridgePlatformSpy = jest.spyOn(MatterbridgePlatform.prototype, 'getDeviceByOriginalId');
export const getDeviceByNumberMatterbridgePlatformSpy = jest.spyOn(MatterbridgePlatform.prototype, 'getDeviceByNumber');
export const hasDeviceNameMatterbridgePlatformSpy = jest.spyOn(MatterbridgePlatform.prototype, 'hasDeviceName');
export const hasDeviceUniqueIdMatterbridgePlatformSpy = jest.spyOn(MatterbridgePlatform.prototype, 'hasDeviceUniqueId');
export const registerVirtualDeviceMatterbridgePlatformSpy = jest.spyOn(MatterbridgePlatform.prototype, 'registerVirtualDevice');
export const registerDeviceMatterbridgePlatformSpy = jest.spyOn(MatterbridgePlatform.prototype, 'registerDevice');
export const unregisterDeviceMatterbridgePlatformSpy = jest.spyOn(MatterbridgePlatform.prototype, 'unregisterDevice');
export const unregisterAllDevicesMatterbridgePlatformSpy = jest.spyOn(MatterbridgePlatform.prototype, 'unregisterAllDevices');
// @ts-expect-error - access to private members for testing
export const saveSelectsMatterbridgePlatformSpy = jest.spyOn(MatterbridgePlatform.prototype, 'saveSelects');
export const clearSelectMatterbridgePlatformSpy = jest.spyOn(MatterbridgePlatform.prototype, 'clearSelect');
export const clearDeviceSelectMatterbridgePlatformSpy = jest.spyOn(MatterbridgePlatform.prototype, 'clearDeviceSelect');
export const clearEntitySelectMatterbridgePlatformSpy = jest.spyOn(MatterbridgePlatform.prototype, 'clearEntitySelect');
export const setSelectDeviceMatterbridgePlatformSpy = jest.spyOn(MatterbridgePlatform.prototype, 'setSelectDevice');
export const getSelectDeviceMatterbridgePlatformSpy = jest.spyOn(MatterbridgePlatform.prototype, 'getSelectDevice');
export const setSelectDeviceEntityMatterbridgePlatformSpy = jest.spyOn(MatterbridgePlatform.prototype, 'setSelectDeviceEntity');
export const getSelectDevicesMatterbridgePlatformSpy = jest.spyOn(MatterbridgePlatform.prototype, 'getSelectDevices');
export const setSelectEntityMatterbridgePlatformSpy = jest.spyOn(MatterbridgePlatform.prototype, 'setSelectEntity');
export const getSelectEntityMatterbridgePlatformSpy = jest.spyOn(MatterbridgePlatform.prototype, 'getSelectEntity');
export const getSelectEntitiesMatterbridgePlatformSpy = jest.spyOn(MatterbridgePlatform.prototype, 'getSelectEntities');
export const verifyMatterbridgeVersionMatterbridgePlatformSpy = jest.spyOn(MatterbridgePlatform.prototype, 'verifyMatterbridgeVersion');
export const validateDeviceMatterbridgePlatformSpy = jest.spyOn(MatterbridgePlatform.prototype, 'validateDevice');
export const validateEntityMatterbridgePlatformSpy = jest.spyOn(MatterbridgePlatform.prototype, 'validateEntity');
// @ts-expect-error - access to private members for testing
export const clearEndpointNumbersMatterbridgePlatformSpy = jest.spyOn(MatterbridgePlatform.prototype, 'clearEndpointNumbers');
// @ts-expect-error - access to private members for testing
export const checkEndpointNumbersMatterbridgePlatformSpy = jest.spyOn(MatterbridgePlatform.prototype, 'checkEndpointNumbers');
