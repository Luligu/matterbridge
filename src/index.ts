/**
 * This file contains the entry point of Matterbridge.
 *
 * @file index.ts
 * @author Luca Liguori
 * @date 2023-12-29
 * @version 1.0.5
 *
 * Copyright 2023, 2024 Luca Liguori.
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
 * limitations under the License. *
 */

import '@project-chip/matter-node.js';
import { Matterbridge } from './matterbridge.js';

export * from '@project-chip/matter-node.js/device';
export * from '@project-chip/matter-node.js/cluster';
export * from '@project-chip/matter-node.js/log';
export * from '@project-chip/matter-node.js/datatype';

export * from 'matter-history';

export * from './matterbridge.js';
export * from './matterbridgeDevice.js';
export * from './matterbridgeAccessoryPlatform.js';
export * from './matterbridgeDynamicPlatform.js';
export * from './AirQualityCluster.js';
export * from './ColorControlServer.js';
export * from './TvocCluster.js';

async function main() {
  // eslint-disable-next-line no-console
  console.log('MAIN: Matterbridge.loadInstance() called');
  await Matterbridge.loadInstance();
  // eslint-disable-next-line no-console
  console.log('MAIN: Matterbridge.loadInstance() exited');
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(`MAIN: Matterbridge.loadInstance() failed with error: ${error}`);
});
