/**
 * This file contains the deepEqual function.
 *
 * @file isvalid.ts
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

/**
 * Checks if a given string is a valid IPv4 address.
 *
 * @param {string} ipv4Address - The string to be checked.
 * @returns {boolean} - Returns true if the string is a valid IPv4 address, otherwise returns false.
 */
export function isValidIpv4Address(ipv4Address: string): boolean {
  const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipv4Regex.test(ipv4Address);
}

/**
 * Checks if a value is a valid number within the specified range.
 *
 * @param {any} value - The value to be checked.
 * @param {number} min - The minimum value allowed (optional).
 * @param {number} max - The maximum value allowed (optional).
 * @returns {boolean} Returns true if the value is a valid number within the specified range, otherwise false.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isValidNumber(value: any, min?: number, max?: number): value is number {
  if (value === undefined || value === null || typeof value !== 'number' || Number.isNaN(value)) return false;
  if (min !== undefined && value < min) return false;
  if (max !== undefined && value > max) return false;
  return true;
}

/**
 * Checks if a value is a valid boolean.
 *
 * @param {any} value - The value to be checked.
 * @returns {boolean} `true` if the value is a valid boolean, `false` otherwise.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isValidBoolean(value: any): value is boolean {
  return value !== undefined && value !== null && typeof value === 'boolean';
}

/**
 * Checks if a value is a valid string.
 *
 * @param {any} value - The value to be checked.
 * @param {number} minLength - The min string length (optional).
 * @param {number} maxLength - The max string length (optional).
 * @returns {boolean} A boolean indicating whether the value is a valid string.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isValidString(value: any, minLength?: number, maxLength?: number): value is string {
  if (value === undefined || value === null || typeof value !== 'string') return false;
  if (minLength !== undefined && value.length < minLength) return false;
  if (maxLength !== undefined && value.length > maxLength) return false;
  return true;
}

/**
 * Checks if a value is a valid object.
 *
 * @param {any} value - The value to be checked.
 * @param {number} minLength - The min number of keys (optional).
 * @param {number} maxLength - The max number of keys (optional).
 * @returns {boolean} A boolean indicating whether the value is a valid object.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isValidObject(value: any, minLength?: number, maxLength?: number): value is object {
  if (value === undefined || value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  if (minLength !== undefined && keys.length < minLength) return false;
  if (maxLength !== undefined && keys.length > maxLength) return false;
  return true;
}

/**
 * Checks if a value is a valid array.
 *
 * @param {any} value - The value to be checked.
 * @param {number} minLength - The min number of elements (optional).
 * @param {number} maxLength - The max number of elements (optional).
 * @returns {boolean} A boolean indicating whether the value is a valid array.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isValidArray(value: any, minLength?: number, maxLength?: number): value is unknown[] {
  if (value === undefined || value === null || !Array.isArray(value)) return false;
  if (minLength !== undefined && value.length < minLength) return false;
  if (maxLength !== undefined && value.length > maxLength) return false;
  return true;
}

/**
 * Checks if the given value is null.
 *
 * @param {any} value - The value to check.
 * @returns {boolean} `true` if the value is null, `false` otherwise.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isValidNull(value: any): value is null {
  return value === null;
}

/**
 * Checks if a value is undefined.
 *
 * @param {any} value - The value to check.
 * @returns {boolean} `true` if the value is undefined, `false` otherwise.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isValidUndefined(value: any): value is undefined {
  return value === undefined;
}
