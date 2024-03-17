#!/usr/bin/env node
/**
 * This file contains the CLI entry point of Matterbridge.
 *
 * @file cli.ts
 * @author Luca Liguori
 * @date 2023-12-29
 * @version 1.0.10
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

/* eslint-disable no-console */
import wtf from 'wtfnode';
import { Matterbridge } from './matterbridge.js';

let instance: Matterbridge | undefined;

async function main() {
  console.log('CLI: Matterbridge.loadInstance() called');
  instance = await Matterbridge.loadInstance(true);
  registerHandlers();
  console.log('CLI: Matterbridge.loadInstance() exited');
}

function registerHandlers() {
  instance!.on('shutdown', async () => shutdown());
  instance!.on('restart', async () => restart());
}

async function shutdown() {
  console.log('CLI: received shutdown event, exiting...');
  wtf.dump();
  process.exit(0);
}

async function restart() {
  console.log('CLI: received restart event, loading...');
  wtf.dump();
  instance = await Matterbridge.loadInstance(true);
  registerHandlers();
}

process.title = 'matterbridge';

main().catch((error) => {
  console.error(`CLI: Matterbridge.loadInstance() failed with error: ${error}`);
});
