/**
 * @description This file contains the Jest MatterbridgeEndpoint spy.
 * @file src/jestMatterbridgeEndpointSpy.ts
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

import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';

// Spy on MatterbridgeEndpoint methods
const { jest } = await import('@jest/globals' as string);
export const setClusterMatterbridgeEndpointSpy: jest.SpiedFunction<typeof MatterbridgeEndpoint.prototype.setCluster> = jest.spyOn(MatterbridgeEndpoint.prototype, 'setCluster');
export const setAttributeMatterbridgeEndpointSpy: jest.SpiedFunction<typeof MatterbridgeEndpoint.prototype.setAttribute> = jest.spyOn(
  MatterbridgeEndpoint.prototype,
  'setAttribute',
);
export const updateAttributeMatterbridgeEndpointSpy: jest.SpiedFunction<typeof MatterbridgeEndpoint.prototype.updateAttribute> = jest.spyOn(
  MatterbridgeEndpoint.prototype,
  'updateAttribute',
);
export const subscribeAttributeMatterbridgeEndpointSpy: jest.SpiedFunction<typeof MatterbridgeEndpoint.prototype.subscribeAttribute> = jest.spyOn(
  MatterbridgeEndpoint.prototype,
  'subscribeAttribute',
);
export const triggerEventMatterbridgeEndpointSpy: jest.SpiedFunction<typeof MatterbridgeEndpoint.prototype.triggerEvent> = jest.spyOn(
  MatterbridgeEndpoint.prototype,
  'triggerEvent',
);
export const triggerSwitchEventMatterbridgeEndpointSpy: jest.SpiedFunction<typeof MatterbridgeEndpoint.prototype.triggerSwitchEvent> = jest.spyOn(
  MatterbridgeEndpoint.prototype,
  'triggerSwitchEvent',
);
