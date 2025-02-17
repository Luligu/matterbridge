/**
 * This file contains the entry point of Matterbridge.
 *
 * @file index.ts
 * @author Luca Liguori
 * @date 2023-12-29
 * @version 1.0.7
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

// Matterbridge
import { Matterbridge } from './matterbridge.js';
import { hasParameter } from './utils/export.js';

// AnsiLogger module
import { AnsiLogger, LogLevel, TimestampFormat } from './logger/export.js';

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

const log = new AnsiLogger({ logName: 'Main', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: hasParameter('debug') ? LogLevel.DEBUG : LogLevel.INFO });

async function main() {
  log.debug('***Matterbridge.loadInstance() called');
  await Matterbridge.loadInstance();
  log.debug('***Matterbridge.loadInstance() exited');
}

main().catch((error) => {
  log.error(`Matterbridge.loadInstance() failed with error: ${error instanceof Error ? error.message : error}`);
});
