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

import { Matterbridge } from './matterbridge.js';

async function main() {
  // eslint-disable-next-line no-console
  console.log('CLI: Matterbridge.loadInstance() called');
  await Matterbridge.loadInstance(true);
  // eslint-disable-next-line no-console
  console.log('CLI: Matterbridge.loadInstance() exited');
}

process.title = 'matterbridge';

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(`CLI: Matterbridge.loadInstance() failed with error: ${error}`);
});
