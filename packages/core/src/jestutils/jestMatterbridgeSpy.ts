/**
 * @description This file contains the Jest Spy helpers for Matterbridge.
 * @file src/jestMatterbridgeSpy.ts
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

import { Matterbridge } from '../matterbridge.js';

// Spy on Matterbridge methods
export const addBridgedEndpointMatterbridgeSpy = jest.spyOn(Matterbridge.prototype, 'addBridgedEndpoint');
export const removeBridgedEndpointMatterbridgeSpy = jest.spyOn(Matterbridge.prototype, 'removeBridgedEndpoint');
export const removeAllBridgedEndpointsMatterbridgeSpy = jest.spyOn(Matterbridge.prototype, 'removeAllBridgedEndpoints');
export const addVirtualEndpointMatterbridgeSpy = jest.spyOn(Matterbridge.prototype, 'addVirtualEndpoint');
