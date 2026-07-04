/**
 * @file packages/core/src/devices/export.ts
 * @description Exports core device modules.
 * @author Luca Liguori
 * @created 2026-03-04
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

/* oxlint-disable oxc/no-barrel-file */

// Chapter 10. Media Device Types - Single class device types
export * from './basicVideoPlayer.js';
export * from './castingVideoPlayer.js';
export * from './speaker.js';

// Matter 1.5.0 - Single class device types
export * from './closure.js';
export * from './closurePanel.js';
export * from './irrigationSystem.js';
export * from './soilSensor.js';

// Chapter 12. Robotic Device Types - Single class device types
export * from './roboticVacuumCleaner.js';

// Chapter 13. Appliances Device Types - Single class device types
export * from './airConditioner.js';
export * from './cooktop.js';
export * from './dishwasher.js';
export * from './extractorHood.js';
export * from './laundryDryer.js';
export * from './laundryWasher.js';
export * from './microwaveOven.js';
export * from './oven.js';
export * from './refrigerator.js';

// Chapter 14. Energy Device Types - Single class device types
export * from './batteryStorage.js';
export * from './evse.js';
export * from './heatPump.js';
export * from './solarPower.js';
export * from './waterHeater.js';
