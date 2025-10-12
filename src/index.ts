/**
 * @description This file contains the entry point of Matterbridge.
 * @file index.ts
 * @author Luca Liguori
 * @created 2023-12-29
 * @version 1.0.9
 * @license Apache-2.0
 *
 * Copyright 2023, 2024, 2025 Luca Liguori.
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

// eslint-disable-next-line no-console
if (process.argv.includes('--loader') || process.argv.includes('-loader')) console.log('\u001B[32mIndex loaded.\u001B[40;0m');

// Matterbridge
export * from './matterbridge.js';
export * from './matterbridgeTypes.js';
export * from './matterbridgeEndpoint.js';
export * from './matterbridgeEndpointHelpers.js';
export * from './matterbridgeBehaviors.js';
export * from './matterbridgeDeviceTypes.js';
export * from './matterbridgePlatform.js';
export * from './matterbridgeAccessoryPlatform.js';
export * from './matterbridgeDynamicPlatform.js';
export { addVirtualDevice } from './helpers.js';
