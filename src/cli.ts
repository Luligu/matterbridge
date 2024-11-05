#!/usr/bin/env node
/**
 * This file contains the CLI entry point of Matterbridge.
 *
 * @file cli.ts
 * @author Luca Liguori
 * @date 2023-12-29
 * @version 1.0.11
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

/* eslint-disable no-console */
import { Matterbridge } from './matterbridge.js';
import { MatterbridgeEdge } from './matterbridgeEdge.js';

let instance: Matterbridge | MatterbridgeEdge | undefined;
const cli = '\u001B[32m';
const er = '\u001B[38;5;9m';
const rs = '\u001B[40;0m';

async function main() {
  if (process.argv.includes('-debug')) console.log(cli + `CLI: ${process.argv.includes('-edge') ? 'MatterbridgeEdge' : 'Matterbridge'}.loadInstance() called` + rs);
  if (process.argv.includes('-edge')) instance = await MatterbridgeEdge.loadInstance(true);
  else instance = await Matterbridge.loadInstance(true);
  registerHandlers();
  if (process.argv.includes('-debug')) console.log(cli + `CLI: ${process.argv.includes('-edge') ? 'MatterbridgeEdge' : 'Matterbridge'}.loadInstance() exited` + rs);
}

function registerHandlers() {
  if (instance) instance.on('shutdown', async () => shutdown());
  if (instance) instance.on('restart', async () => restart());
  if (instance) instance.on('update', async () => update());
}

async function shutdown() {
  if (process.argv.includes('-debug')) console.log(cli + 'CLI: received shutdown event, exiting...' + rs);
  process.exit(0);
}

async function restart() {
  if (process.argv.includes('-debug')) console.log(cli + 'CLI: received restart event, loading...' + rs);
  if (process.argv.includes('-edge')) instance = await MatterbridgeEdge.loadInstance(true);
  else instance = await Matterbridge.loadInstance(true);
  registerHandlers();
}

async function update() {
  if (process.argv.includes('-debug')) console.log(cli + 'CLI: received update event, updating...' + rs);
  // TODO: Implement update logic outside of matterbridge
  if (process.argv.includes('-edge')) instance = await MatterbridgeEdge.loadInstance();
  else instance = await Matterbridge.loadInstance(true);
  registerHandlers();
}

process.title = 'matterbridge';

// Run the main function
main().catch((error) => {
  console.error(er + `CLI: Matterbridge.loadInstance() failed with error: ${error}` + rs);
});
