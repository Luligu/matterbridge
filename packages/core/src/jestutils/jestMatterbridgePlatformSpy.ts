/**
 * @description This file contains the Jest MatterbridgePlatform spy.
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

import { MatterbridgePlatform } from '../matterbridgePlatform.js';

// Spy on MatterbridgePlatform methods
const { jest } = await import('@jest/globals' as string);
// @ts-expect-error - TypeScript does not recognize the private method, but we want to spy on it anyway
export const destroyMatterbridgePlatformSpy: jest.SpiedFunction<typeof MatterbridgePlatform.prototype.destroy> = jest.spyOn(MatterbridgePlatform.prototype, 'destroy');
export const onStartMatterbridgePlatformSpy: jest.SpiedFunction<typeof MatterbridgePlatform.prototype.onStart> = jest.spyOn(MatterbridgePlatform.prototype, 'onStart');
export const onConfigureMatterbridgePlatformSpy: jest.SpiedFunction<typeof MatterbridgePlatform.prototype.onConfigure> = jest.spyOn(MatterbridgePlatform.prototype, 'onConfigure');
export const onShutdownMatterbridgePlatformSpy: jest.SpiedFunction<typeof MatterbridgePlatform.prototype.onShutdown> = jest.spyOn(MatterbridgePlatform.prototype, 'onShutdown');
export const onChangeLoggerLevelMatterbridgePlatformSpy: jest.SpiedFunction<typeof MatterbridgePlatform.prototype.onChangeLoggerLevel> = jest.spyOn(
  MatterbridgePlatform.prototype,
  'onChangeLoggerLevel',
);
export const onActionMatterbridgePlatformSpy: jest.SpiedFunction<typeof MatterbridgePlatform.prototype.onAction> = jest.spyOn(MatterbridgePlatform.prototype, 'onAction');
export const onConfigChangedMatterbridgePlatformSpy: jest.SpiedFunction<typeof MatterbridgePlatform.prototype.onConfigChanged> = jest.spyOn(
  MatterbridgePlatform.prototype,
  'onConfigChanged',
);
export const saveConfigMatterbridgePlatformSpy: jest.SpiedFunction<typeof MatterbridgePlatform.prototype.saveConfig> = jest.spyOn(MatterbridgePlatform.prototype, 'saveConfig');
export const getSchemaMatterbridgePlatformSpy: jest.SpiedFunction<typeof MatterbridgePlatform.prototype.getSchema> = jest.spyOn(MatterbridgePlatform.prototype, 'getSchema');
export const setSchemaMatterbridgePlatformSpy: jest.SpiedFunction<typeof MatterbridgePlatform.prototype.setSchema> = jest.spyOn(MatterbridgePlatform.prototype, 'setSchema');
export const wssSendRestartRequiredMatterbridgePlatformSpy: jest.SpiedFunction<typeof MatterbridgePlatform.prototype.wssSendRestartRequired> = jest.spyOn(
  MatterbridgePlatform.prototype,
  'wssSendRestartRequired',
);
export const wssSendSnackbarMessageMatterbridgePlatformSpy: jest.SpiedFunction<typeof MatterbridgePlatform.prototype.wssSendSnackbarMessage> = jest.spyOn(
  MatterbridgePlatform.prototype,
  'wssSendSnackbarMessage',
);
export const sizeMatterbridgePlatformSpy: jest.SpiedFunction<typeof MatterbridgePlatform.prototype.size> = jest.spyOn(MatterbridgePlatform.prototype, 'size');
export const getDevicesMatterbridgePlatformSpy: jest.SpiedFunction<typeof MatterbridgePlatform.prototype.getDevices> = jest.spyOn(MatterbridgePlatform.prototype, 'getDevices');
export const getDeviceByNameMatterbridgePlatformSpy: jest.SpiedFunction<typeof MatterbridgePlatform.prototype.getDeviceByName> = jest.spyOn(
  MatterbridgePlatform.prototype,
  'getDeviceByName',
);
export const getDeviceByUniqueIdMatterbridgePlatformSpy: jest.SpiedFunction<typeof MatterbridgePlatform.prototype.getDeviceByUniqueId> = jest.spyOn(
  MatterbridgePlatform.prototype,
  'getDeviceByUniqueId',
);
export const getDeviceBySerialNumberMatterbridgePlatformSpy: jest.SpiedFunction<typeof MatterbridgePlatform.prototype.getDeviceBySerialNumber> = jest.spyOn(
  MatterbridgePlatform.prototype,
  'getDeviceBySerialNumber',
);
export const getDeviceByIdMatterbridgePlatformSpy: jest.SpiedFunction<typeof MatterbridgePlatform.prototype.getDeviceById> = jest.spyOn(
  MatterbridgePlatform.prototype,
  'getDeviceById',
);
export const getDeviceByOriginalIdMatterbridgePlatformSpy: jest.SpiedFunction<typeof MatterbridgePlatform.prototype.getDeviceByOriginalId> = jest.spyOn(
  MatterbridgePlatform.prototype,
  'getDeviceByOriginalId',
);
export const getDeviceByNumberMatterbridgePlatformSpy: jest.SpiedFunction<typeof MatterbridgePlatform.prototype.getDeviceByNumber> = jest.spyOn(
  MatterbridgePlatform.prototype,
  'getDeviceByNumber',
);
export const hasDeviceNameMatterbridgePlatformSpy: jest.SpiedFunction<typeof MatterbridgePlatform.prototype.hasDeviceName> = jest.spyOn(
  MatterbridgePlatform.prototype,
  'hasDeviceName',
);
export const hasDeviceUniqueIdMatterbridgePlatformSpy: jest.SpiedFunction<typeof MatterbridgePlatform.prototype.hasDeviceUniqueId> = jest.spyOn(
  MatterbridgePlatform.prototype,
  'hasDeviceUniqueId',
);
export const registerVirtualDeviceMatterbridgePlatformSpy: jest.SpiedFunction<typeof MatterbridgePlatform.prototype.registerVirtualDevice> = jest.spyOn(
  MatterbridgePlatform.prototype,
  'registerVirtualDevice',
);
export const registerDeviceMatterbridgePlatformSpy: jest.SpiedFunction<typeof MatterbridgePlatform.prototype.registerDevice> = jest.spyOn(
  MatterbridgePlatform.prototype,
  'registerDevice',
);
export const unregisterDeviceMatterbridgePlatformSpy: jest.SpiedFunction<typeof MatterbridgePlatform.prototype.unregisterDevice> = jest.spyOn(
  MatterbridgePlatform.prototype,
  'unregisterDevice',
);
export const unregisterAllDevicesMatterbridgePlatformSpy: jest.SpiedFunction<typeof MatterbridgePlatform.prototype.unregisterAllDevices> = jest.spyOn(
  MatterbridgePlatform.prototype,
  'unregisterAllDevices',
);
// @ts-expect-error - TypeScript does not recognize the private method, but we want to spy on it anyway
export const saveSelectsMatterbridgePlatformSpy: jest.SpiedFunction<typeof MatterbridgePlatform.prototype.saveSelects> = jest.spyOn(MatterbridgePlatform.prototype, 'saveSelects');
export const clearSelectMatterbridgePlatformSpy: jest.SpiedFunction<typeof MatterbridgePlatform.prototype.clearSelect> = jest.spyOn(MatterbridgePlatform.prototype, 'clearSelect');
export const clearDeviceSelectMatterbridgePlatformSpy: jest.SpiedFunction<typeof MatterbridgePlatform.prototype.clearDeviceSelect> = jest.spyOn(
  MatterbridgePlatform.prototype,
  'clearDeviceSelect',
);
export const clearEntitySelectMatterbridgePlatformSpy: jest.SpiedFunction<typeof MatterbridgePlatform.prototype.clearEntitySelect> = jest.spyOn(
  MatterbridgePlatform.prototype,
  'clearEntitySelect',
);
export const setSelectDeviceMatterbridgePlatformSpy: jest.SpiedFunction<typeof MatterbridgePlatform.prototype.setSelectDevice> = jest.spyOn(
  MatterbridgePlatform.prototype,
  'setSelectDevice',
);
export const getSelectDeviceMatterbridgePlatformSpy: jest.SpiedFunction<typeof MatterbridgePlatform.prototype.getSelectDevice> = jest.spyOn(
  MatterbridgePlatform.prototype,
  'getSelectDevice',
);
export const setSelectDeviceEntityMatterbridgePlatformSpy: jest.SpiedFunction<typeof MatterbridgePlatform.prototype.setSelectDeviceEntity> = jest.spyOn(
  MatterbridgePlatform.prototype,
  'setSelectDeviceEntity',
);
export const getSelectDevicesMatterbridgePlatformSpy: jest.SpiedFunction<typeof MatterbridgePlatform.prototype.getSelectDevices> = jest.spyOn(
  MatterbridgePlatform.prototype,
  'getSelectDevices',
);
export const setSelectEntityMatterbridgePlatformSpy: jest.SpiedFunction<typeof MatterbridgePlatform.prototype.setSelectEntity> = jest.spyOn(
  MatterbridgePlatform.prototype,
  'setSelectEntity',
);
export const getSelectEntityMatterbridgePlatformSpy: jest.SpiedFunction<typeof MatterbridgePlatform.prototype.getSelectEntity> = jest.spyOn(
  MatterbridgePlatform.prototype,
  'getSelectEntity',
);
export const getSelectEntitiesMatterbridgePlatformSpy: jest.SpiedFunction<typeof MatterbridgePlatform.prototype.getSelectEntities> = jest.spyOn(
  MatterbridgePlatform.prototype,
  'getSelectEntities',
);
export const verifyMatterbridgeVersionMatterbridgePlatformSpy: jest.SpiedFunction<typeof MatterbridgePlatform.prototype.verifyMatterbridgeVersion> = jest.spyOn(
  MatterbridgePlatform.prototype,
  'verifyMatterbridgeVersion',
);
export const validateDeviceMatterbridgePlatformSpy: jest.SpiedFunction<typeof MatterbridgePlatform.prototype.validateDevice> = jest.spyOn(
  MatterbridgePlatform.prototype,
  'validateDevice',
);
export const validateEntityMatterbridgePlatformSpy: jest.SpiedFunction<typeof MatterbridgePlatform.prototype.validateEntity> = jest.spyOn(
  MatterbridgePlatform.prototype,
  'validateEntity',
);
// @ts-expect-error - TypeScript does not recognize the private method, but we want to spy on it anyway
export const clearEndpointNumbersMatterbridgePlatformSpy: jest.SpiedFunction<typeof MatterbridgePlatform.prototype.clearEndpointNumbers> = jest.spyOn(
  MatterbridgePlatform.prototype,
  'clearEndpointNumbers',
);
// @ts-expect-error - TypeScript does not recognize the private method, but we want to spy on it anyway
export const checkEndpointNumbersMatterbridgePlatformSpy: jest.SpiedFunction<typeof MatterbridgePlatform.prototype.checkEndpointNumbers> = jest.spyOn(
  MatterbridgePlatform.prototype,
  'checkEndpointNumbers',
);
