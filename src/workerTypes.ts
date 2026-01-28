/**
 * This file contains the worker types.
 *
 * @file workerTypes.ts
 * @author Luca Liguori
 * @created 2025-11-25
 * @version 1.1.0
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

import type { LogLevel } from 'node-ansi-logger';

/** Control messages sent through parentPort manager <-> workers */
export type ParentPortMessage =
  | { type: 'init'; threadName: string | null; threadId: number; success: boolean }
  | { type: 'ping'; threadName: string | null; threadId: number }
  | { type: 'pong'; threadName: string | null; threadId: number }
  | { type: 'log'; threadName: string | null; threadId: number; logName: string | undefined; logLevel: LogLevel; message: string }
  | { type: 'exit'; threadName: string | null; threadId: number; success: boolean };
