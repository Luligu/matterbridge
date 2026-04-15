/**
 * @description This file contains the Jest helpers.
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

import { jest } from '@jest/globals';
import { BroadcastServer } from '@matterbridge/thread/server';

// Spy on BroadcastServer methods
export const closeBroadcastServerSpy = jest.spyOn(BroadcastServer.prototype, 'close');
export const getUniqueIdBroadcastServerSpy = jest.spyOn(BroadcastServer.prototype, 'getUniqueId');
export const isWorkerRequestBroadcastServerSpy = jest.spyOn(BroadcastServer.prototype, 'isWorkerRequest');
export const isWorkerRequestOfTypeBroadcastServerSpy = jest.spyOn(BroadcastServer.prototype, 'isWorkerRequestOfType');
export const isWorkerResponseBroadcastServerSpy = jest.spyOn(BroadcastServer.prototype, 'isWorkerResponse');
export const isWorkerResponseOfTypeBroadcastServerSpy = jest.spyOn(BroadcastServer.prototype, 'isWorkerResponseOfType');
export const broadcastBroadcastServerSpy = jest.spyOn(BroadcastServer.prototype, 'broadcast');
export const requestBroadcastServerSpy = jest.spyOn(BroadcastServer.prototype, 'request');
export const respondBroadcastServerSpy = jest.spyOn(BroadcastServer.prototype, 'respond');
export const fetchBroadcastServerSpy = jest.spyOn(BroadcastServer.prototype, 'fetch');
// @ts-expect-error - access to private members for testing
export const broadcastMessageHandlerBroadcastServerSpy = jest.spyOn(BroadcastServer.prototype, 'broadcastMessageHandler');
// @ts-expect-error - access to private members for testing
export const broadcastMessageErrorHandlerBroadcastServerSpy = jest.spyOn(BroadcastServer.prototype, 'broadcastMessageErrorHandler');
