/**
 * This file contains the deepEqual function.
 *
 * @file parameter.ts
 * @author Luca Liguori
 * @date 2025-02-16
 * @version 1.0.0
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
 * limitations under the License. *
 */

import { isValidNumber } from './export.js';

/**
 * Retrieves the value of a command-line parameter.
 *
 * @param {string} name - The name of the parameter to retrieve.
 * @returns {string | undefined} The value of the parameter, or undefined if not found.
 */
export function getParameter(name: string): string | undefined {
  const commandArguments = process.argv.slice(2);
  let markerIndex = commandArguments.indexOf(`-${name}`);
  if (markerIndex === -1) markerIndex = commandArguments.indexOf(`--${name}`);
  if (markerIndex === -1 || markerIndex + 1 === commandArguments.length) return undefined;
  return commandArguments[markerIndex + 1];
}

/**
 * Checks if a command-line parameter is present.
 *
 * @param {string} name - The name of the parameter to check.
 * @returns {boolean} True if the parameter is present, otherwise false.
 */
export function hasParameter(name: string): boolean {
  const commandArguments = process.argv.slice(2);
  let markerIncluded = commandArguments.includes(`-${name}`);
  if (!markerIncluded) markerIncluded = commandArguments.includes(`--${name}`);
  return markerIncluded;
}

/**
 * Retrieves the value of a command-line parameter as an integer.
 *
 * @param {string} name - The name of the parameter to retrieve.
 * @returns {number | undefined} The integer value of the parameter, or undefined if not found or invalid.
 */
export function getIntParameter(name: string): number | undefined {
  const value = getParameter(name);
  if (value === undefined) return undefined;
  const intValue = parseInt(value, 10);
  if (!isValidNumber(intValue)) return undefined;
  return intValue;
}

/**
 * Retrieves the value of a command-line parameter as a string array.
 *
 * @param {string} name - The name of the parameter to retrieve.
 * @returns {string[]} An array of string values for the parameter, or an empty array if not found.
 */
export function getStringArrayParameter(name: string): string[] {
  const args = process.argv.slice(2);
  const idx = args.indexOf(`--${name}`) || args.indexOf(`-${name}`);
  if (idx < 0) return [];
  const values: string[] = [];
  for (let i = idx + 1; i < args.length && !args[i].startsWith('-'); i++) {
    values.push(args[i]);
  }
  return values;
}
