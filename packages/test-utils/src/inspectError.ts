/**
 * @file packages/test-utils/src/inspectError.ts
 * @description This file contains the inspectError helper.
 * @author Luca Liguori
 * @created 2026-10-06
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

import { inspect } from 'node:util';

import { type AnsiLogger, RESET } from 'node-ansi-logger';

/**
 * Logs an error message using the provided AnsiLogger instance with detailed inspection.
 * Uses util.inspect to get a detailed view of the error with a stack depth of 10 levels.
 * If the error is an Error instance, it also includes the error message.
 *
 * @param {AnsiLogger} log - The AnsiLogger instance to use for logging.
 * @param {string} message - The error message to log.
 * @param {unknown} error - The error object or value to log. Will be inspected with depth 10.
 * @returns {string} - The full logged message.
 */
export function inspectError(log: AnsiLogger, message: string, error: unknown): string {
  const errorMessage = error instanceof Error ? `${error.message} \n` : '';
  const inspectedError = inspect(error, { depth: 10, colors: true, showHidden: false });
  const fullMessage = `${message}: ${errorMessage}${RESET}${inspectedError}`;
  log.error(fullMessage);
  return fullMessage;
}
