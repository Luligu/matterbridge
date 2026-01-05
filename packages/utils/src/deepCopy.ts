/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * This file contains the deepCopy function.
 *
 * @file deepCopy.ts
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

/**
 * Creates a deep copy of the given value.
 *
 * @template T - The type of the value being copied.
 * @param {T} value - The value to be copied.
 * @returns {T} - The deep copy of the value.
 */
export function deepCopy<T>(value: T): T {
  if (typeof value !== 'object' || value === null) {
    // Primitive value (string, number, boolean, bigint, undefined, symbol) or null
    return value;
  } else if (Array.isArray(value)) {
    // Array: Recursively copy each element
    return value.map((item) => deepCopy(item)) as any;
  } else if (value instanceof Date) {
    // Date objects
    return new Date(value.getTime()) as any;
  } else if (value instanceof RegExp) {
    // RegExp objects
    return new RegExp(value.source, value.flags) as any;
  } else if (value instanceof Map) {
    // Maps
    const mapCopy = new Map();
    for (const [origKey, origVal] of value.entries()) {
      const clonedKey = deepCopy(origKey);
      const clonedVal = deepCopy(origVal);
      mapCopy.set(clonedKey, clonedVal);
    }
    return mapCopy as any;
  } else if (value instanceof Set) {
    // Sets
    const setCopy = new Set();
    value.forEach((item) => {
      setCopy.add(deepCopy(item));
    });
    return setCopy as any;
  } else {
    // Objects: Create a copy with the same prototype as the original
    const proto = Object.getPrototypeOf(value);
    const copy = Object.create(proto);
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        copy[key] = deepCopy(value[key]);
      }
    }
    return copy as T;
  }
}
