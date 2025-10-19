/**
 * This file contains the parameters functions.
 *
 * @file parameter.ts
 * @author Luca Liguori
 * @created 2025-02-16
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

import { isValidNumber } from './isvalid.js';

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
 * Checks if any of the provided command-line parameters are present.
 *
 * @param {string[]} params - The names of the parameters to check.
 * @returns {boolean} True if any of the parameters are present, otherwise false.
 */
export function hasAnyParameter(...params: string[]): boolean {
  return params.some((param) => {
    return hasParameter(param);
  });
}

/**
 * Retrieves the value of a command-line parameter as a string.
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
 * Retrieves the value of a command-line parameter as a number array.
 *
 * @param {string} name - The name of the parameter to retrieve.
 * @returns {number[] | undefined} An array of string values for the parameter, or undefined if not found.
 */
export function getIntArrayParameter(name: string): number[] | undefined {
  const commandArguments = process.argv.slice(2);
  let markerIndex = commandArguments.indexOf(`--${name}`);
  if (markerIndex < 0) markerIndex = commandArguments.indexOf(`-${name}`);
  if (markerIndex < 0) return undefined;
  const intValues: number[] = [];
  for (let i = markerIndex + 1; i < commandArguments.length && !commandArguments[i].startsWith('-'); i++) {
    const intValue = parseInt(commandArguments[i], 10);
    if (isValidNumber(intValue)) intValues.push(intValue);
  }
  if (intValues.length === 0) return undefined;
  return intValues;
}

/**
 * Retrieves the value of a command-line parameter as a string array.
 *
 * @param {string} name - The name of the parameter to retrieve.
 * @returns {string[] | undefined} An array of string values for the parameter, or undefined if not found.
 */
export function getStringArrayParameter(name: string): string[] | undefined {
  const commandArguments = process.argv.slice(2);
  let markerIndex = commandArguments.indexOf(`--${name}`);
  if (markerIndex < 0) markerIndex = commandArguments.indexOf(`-${name}`);
  if (markerIndex < 0) return undefined;
  const values: string[] = [];
  for (let i = markerIndex + 1; i < commandArguments.length && !commandArguments[i].startsWith('-'); i++) {
    values.push(commandArguments[i]);
  }
  if (values.length === 0) return undefined;
  return values;
}
