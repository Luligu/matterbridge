/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * This file contains the deepEqual function.
 *
 * @file deepEqual.ts
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

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Performs a deep comparison between two values to determine if they are equivalent.
 * This comparison includes primitive types, arrays, and objects, allowing for optional
 * exclusion of specific properties from the comparison in objects.
 *
 * @param {any} a The first value to compare.
 * @param {any} b The second value to compare.
 * @param {string[]} [excludeProperties=[]] An array of property names to exclude from the comparison in objects.
 * @returns {boolean} True if the values are deeply equal, excluding any specified properties; otherwise, false.
 *
 * Note: This function utilizes recursion for deep comparison of nested structures and includes a debugging
 * mechanism that can be toggled on or off for detailed comparison logging. It is important to ensure that
 * objects do not contain circular references when enabling debug logging to avoid infinite loops.
 *
 * Example usage:
 * ```
 * const obj1 = { a: 1, b: { c: 2 } };
 * const obj2 = { a: 1, b: { c: 2 } };
 * console.log(deepEqual(obj1, obj2)); // true
 *
 * const arr1 = [1, 2, [3, 4]];
 * const arr2 = [1, 2, [3, 4]];
 * console.log(deepEqual(arr1, arr2)); // true
 *
 * const obj3 = { a: 1, b: { c: 2, d: 3 } };
 * const obj4 = { a: 1, b: { c: 2 } };
 * console.log(deepEqual(obj3, obj4, ['d'])); // true, excluding property 'd' from comparison
 * ```
 */
export function deepEqual(a: any, b: any, excludeProperties: string[] = []): boolean {
  // Toggle debugging on or off easily
  // const debug = false;

  // Helper function for conditional logging

  const debugLog = (...messages: any[]) => {
    // if (debug) {
    // console.log(...messages);
    // }
  };

  // If both are the same instance, return true (handles primitives and same object references)
  if (a === b) {
    return true;
  }

  // If types are different, return false
  if (typeof a !== typeof b) {
    debugLog(`deepEqual false for typeof a: ${typeof a} typeof b: ${typeof b}`);
    return false;
  }

  // If one of them is null (and we know they are not equal from the first check), return false
  if (a == null || b == null) {
    debugLog('deepEqual false for == null');
    return false;
  }

  // Handle Dates compare by timestamp
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  // Handle Regexps compare by their source & flags
  if (a instanceof RegExp && b instanceof RegExp) {
    return a.source === b.source && a.flags === b.flags;
  }

  // Handle Arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      debugLog(`deepEqual false for array a.length(${a.length}) !== b.length(${b.length})`);
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i], excludeProperties)) {
        debugLog('deepEqual false for array !deepEqual(a[i], b[i])');
        debugLog(`- aProps.length(${a[i]}):`, a[i]);
        debugLog(`- bProps.length(${b[i]}):`, b[i]);
        return false;
      }
    }
    return true;
  }

  // Handle Objects (and exclude null, functions, and arrays)
  if (typeof a === 'object' && typeof b === 'object') {
    const aProps = Object.getOwnPropertyNames(a).filter((prop) => !excludeProperties.includes(prop));
    const bProps = Object.getOwnPropertyNames(b).filter((prop) => !excludeProperties.includes(prop));

    // If their property lengths are different, they're different objects
    if (aProps.length !== bProps.length) {
      debugLog(`deepEqual false for aProps.length(${aProps.length}) !== bProps.length(${bProps.length})`);
      debugLog(`- aProps.length(${aProps.length}):`, aProps);
      debugLog(`- bProps.length(${bProps.length}):`, bProps);
      return false;
    }

    // Check each property in 'a' to see if it's in 'b' and if it's equal (deep check)
    for (const prop of aProps) {
      if (!Object.prototype.hasOwnProperty.call(b, prop)) {
        debugLog(`deepEqual false for !b.hasOwnProperty(${prop})`);
        return false;
      }
      if (!deepEqual(a[prop], b[prop], excludeProperties)) {
        debugLog(`deepEqual false for !deepEqual(a[${prop}], b[${prop}])` /* , a[prop], b[prop]*/);
        return false;
      }
    }

    return true;
  }

  // If none of the above, the objects are not equal
  return false;
}
