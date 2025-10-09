/**
 * This file contains the CLI emitter.
 *
 * @file cliEmitter.ts
 * @author Luca Liguori
 * @created 2025-07-04
 * @version 1.0.1
 * @license Apache-2.0
 *
 * Copyright 2025, 2026, 2027 Luca Liguori.
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
if (process.argv.includes('--loader') || process.argv.includes('-loader')) console.log('\u001B[32mCli emitter loaded.\u001B[40;0m');

import { EventEmitter } from 'node:events';

interface CliEvents {
  shutdown: [];
  cpu: [number, number];
  memory: [string, string, string, string, string, string, string];
  uptime: [string, string];
  ready: [];
}

export const cliEmitter = new EventEmitter<CliEvents>();

export let lastCpuUsage = 0;
export let lastProcessCpuUsage = 0;

/**
 * Sets the last CPU usage.
 *
 * @param {number} val - The CPU usage percentage to set.
 * @returns {void}
 */
export function setLastCpuUsage(val: number): void {
  lastCpuUsage = val;
}

/**
 * Sets the last process CPU usage.
 *
 * @param {number} val - The process CPU usage percentage to set.
 * @returns {void}
 */
export function setLastProcessCpuUsage(val: number): void {
  lastProcessCpuUsage = val;
}
