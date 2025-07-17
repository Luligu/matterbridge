/**
 * This file contains the error functions.
 *
 * @file error.ts
 * @author Luca Liguori
 * @created 2025-07-17
 * @version 1.0.0
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

import { inspect } from 'node:util';

import type { AnsiLogger } from 'node-ansi-logger';

/**
 * Logs an error message using the provided AnsiLogger instance.
 *
 * @param {AnsiLogger} log - The AnsiLogger instance to use for logging.
 * @param {string} message - The error message to log.
 * @param {unknown} error - The error object or value to log. If it's an Error instance,
 *                          its message and stack trace will be included in the log.
 */
export function logError(log: AnsiLogger, message: string, error: unknown): void {
  log.error(`${message}: ${error instanceof Error ? error.message + '\nStack:\n' + error.stack : error}`);
}

/**
 * Logs an error message using the provided AnsiLogger instance with detailed inspection.
 * Uses util.inspect to get a detailed view of the error with a stack depth of 10 levels.
 *
 * @param {AnsiLogger} log - The AnsiLogger instance to use for logging.
 * @param {string} message - The error message to log.
 * @param {unknown} error - The error object or value to log. Will be inspected with depth 10.
 */
export function inspectError(log: AnsiLogger, message: string, error: unknown): void {
  const inspectedError = inspect(error, { depth: 10, colors: false, showHidden: false });
  log.error(`${message}: ${inspectedError}`);
}
