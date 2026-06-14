/**
 * @description This file contains the Jest BroadcastServer spy.
 * @file src/jestBroadcastServerSpy.ts
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

import { BroadcastServer } from '@matterbridge/thread/server';

// Spy on BroadcastServer methods
const { jest } = await import('@jest/globals' as string);
export const closeBroadcastServerSpy: jest.SpiedFunction<typeof BroadcastServer.prototype.close> = jest.spyOn(BroadcastServer.prototype, 'close');
export const getUniqueIdBroadcastServerSpy: jest.SpiedFunction<typeof BroadcastServer.prototype.getUniqueId> = jest.spyOn(BroadcastServer.prototype, 'getUniqueId');
export const isWorkerRequestBroadcastServerSpy: jest.SpiedFunction<typeof BroadcastServer.prototype.isWorkerRequest> = jest.spyOn(BroadcastServer.prototype, 'isWorkerRequest');
export const isWorkerRequestOfTypeBroadcastServerSpy: jest.SpiedFunction<typeof BroadcastServer.prototype.isWorkerRequestOfType> = jest.spyOn(
  BroadcastServer.prototype,
  'isWorkerRequestOfType',
);
export const isWorkerResponseBroadcastServerSpy: jest.SpiedFunction<typeof BroadcastServer.prototype.isWorkerResponse> = jest.spyOn(BroadcastServer.prototype, 'isWorkerResponse');
export const isWorkerResponseOfTypeBroadcastServerSpy: jest.SpiedFunction<typeof BroadcastServer.prototype.isWorkerResponseOfType> = jest.spyOn(
  BroadcastServer.prototype,
  'isWorkerResponseOfType',
);
export const broadcastBroadcastServerSpy: jest.SpiedFunction<typeof BroadcastServer.prototype.broadcast> = jest.spyOn(BroadcastServer.prototype, 'broadcast');
export const requestBroadcastServerSpy: jest.SpiedFunction<typeof BroadcastServer.prototype.request> = jest.spyOn(BroadcastServer.prototype, 'request');
export const respondBroadcastServerSpy: jest.SpiedFunction<typeof BroadcastServer.prototype.respond> = jest.spyOn(BroadcastServer.prototype, 'respond');
export const fetchBroadcastServerSpy: jest.SpiedFunction<typeof BroadcastServer.prototype.fetch> = jest.spyOn(BroadcastServer.prototype, 'fetch');
// @ts-expect-error - TypeScript does not recognize the private method, but we want to spy on it anyway
export const broadcastMessageHandlerBroadcastServerSpy: jest.SpiedFunction<typeof BroadcastServer.prototype.broadcastMessageHandler> = jest.spyOn(
  BroadcastServer.prototype,
  'broadcastMessageHandler',
);
// @ts-expect-error - TypeScript does not recognize the private method, but we want to spy on it anyway
export const broadcastMessageErrorHandlerBroadcastServerSpy: jest.SpiedFunction<typeof BroadcastServer.prototype.broadcastMessageErrorHandler> = jest.spyOn(
  BroadcastServer.prototype,
  'broadcastMessageErrorHandler',
);
