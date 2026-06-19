/**
 * @description Helpers to derive human-readable descriptions from enum values.
 * @file enumDescription.ts
 * @author Luca Liguori
 * @created 2026-03-23
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

import { logModuleLoaded } from './loader.js';

logModuleLoaded('EnumDescription');

type EnumValue = string | number;
export type EnumLike = Record<string, EnumValue>;

export interface EnumDescriptionOptions {
  fallback?: string;
}

/**
 * Check whether an enum object key is a reverse-mapping entry from a numeric enum.
 *
 * @param {string} key - The enum object key.
 * @returns {boolean} True when the key is a numeric reverse-mapping entry.
 */
function isNumericEnumReverseKey(key: string): boolean {
  return /^-?\d+$/.test(key);
}

/**
 * Resolve the enum member name for a runtime enum value.
 *
 * @param {EnumLike} enumType - The enum object.
 * @param {EnumValue} value - The enum value to look up.
 * @returns {string | undefined} The enum member name, if found.
 */
function getEnumKey(enumType: EnumLike, value: EnumValue): string | undefined {
  return Object.keys(enumType)
    .filter((key) => !isNumericEnumReverseKey(key))
    .find((key) => enumType[key] === value);
}

/**
 * Resolve the exact enum member name for an enum value.
 *
 * Example: value `0` from `DoorState` resolves to `DoorOpen`.
 *
 * @param {EnumLike} enumType - The enum object.
 * @param {EnumValue | null | undefined} value - The enum value to resolve.
 * @param {EnumDescriptionOptions} options - Optional fallback options.
 * @returns {string} The enum member name, or the fallback.
 */
export function getEnumDescription<T extends EnumLike>(enumType: T, value: T[keyof T] | null | undefined, options: EnumDescriptionOptions = {}): string {
  const fallback = options.fallback ?? 'Invalid';
  if (value === undefined || value === null) return fallback;

  const enumKey = getEnumKey(enumType, value);
  return enumKey ?? fallback;
}
