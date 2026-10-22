/**
 * @file packages/test-utils/src/errorMessages.ts
 * @description This file contains the errorCauseMessages helper.
 * @author Luca Liguori
 * @created 2026-10-22
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

/**
 * Collects the messages of the nested causes and aggregated errors of an error, one indented line per message.
 * Only strings are returned: matter.js errors may reference the endpoint and its entire node graph, so no object is retained.
 *
 * @param {unknown} error - The error to walk.
 * @param {number} [depth] - The current nesting level, used for the indentation (default 1).
 * @param {number} [maxDepth] - The maximum nesting level to walk (default 5).
 * @returns {string[]} The indented messages, empty if the error has no causes.
 */
export function errorCauseMessages(error: unknown, depth: number = 1, maxDepth: number = 5): string[] {
  if (!(error instanceof Error) || depth > maxDepth) {
    return [];
  }
  const causes: unknown[] = [...(error instanceof AggregateError ? error.errors : []), ...(error.cause === undefined ? [] : [error.cause])];
  return causes.flatMap((cause) => [`${'  '.repeat(depth)}- ${cause instanceof Error ? cause.message : String(cause)}`, ...errorCauseMessages(cause, depth + 1, maxDepth)]);
}
