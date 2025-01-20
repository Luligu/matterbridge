/**
 * This file contains the entry point of Matterbridge.
 *
 * @file index.ts
 * @author Luca Liguori
 * @date 2023-12-29
 * @version 1.0.6
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
 * limitations under the License. *
 */

import { Matterbridge } from './matterbridge.js';

// @matter
export {
  Identity,
  AtLeastOne,
  SemanticNamespace,
  ClosureTag,
  CompassDirectionTag,
  CompassLocationTag,
  DirectionTag,
  ElectricalMeasurementTag,
  LaundryTag,
  LevelTag,
  LocationTag,
  NumberTag,
  PositionTag,
  PowerSourceTag,
  RefrigeratorTag,
  RoomAirConditionerTag,
  SwitchesTag,
} from '@matter/main';
export * from '@matter/main/clusters';
export * from '@matter/main/types';

// @project-chip
export { ClusterServer, ClusterServerObj, ClusterClient, ClusterClientObj } from '@project-chip/matter.js/cluster';

// Matterbridge
export * from './matterbridge.js';
export * from './matterbridgeTypes.js';
export * from './matterbridgeEndpoint.js';
export * from './matterbridgeDeviceTypes.js';
export * from './matterbridgePlatform.js';
export * from './matterbridgeAccessoryPlatform.js';
export * from './matterbridgeDynamicPlatform.js';

const cli = '\u001B[32m';
const er = '\u001B[38;5;9m';
const rs = '\u001B[40;0m';

async function main() {
  // eslint-disable-next-line no-console
  if (process.argv.includes('-debug')) console.log(cli + 'MAIN: Matterbridge.loadInstance() called' + rs);
  await Matterbridge.loadInstance();
  // eslint-disable-next-line no-console
  if (process.argv.includes('-debug')) console.log(cli + 'MAIN: Matterbridge.loadInstance() exited' + rs);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(er + `MAIN: Matterbridge.loadInstance() failed with error: ${error}` + rs);
});
