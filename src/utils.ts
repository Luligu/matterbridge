/**
 * This file contains the deepEqual function.
 *
 * @file utils.ts
 * @author Luca Liguori
 * @date 2024-02-17
 * @version 1.2.3
 *
 * Copyright 2024 Luca Liguori.
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

import os from 'os';

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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deepEqual(a: any, b: any, excludeProperties: string[] = []): boolean {
  // Toggle debugging on or off easily
  const debug = false;

  // Helper function for conditional logging
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const debugLog = (...messages: any[]) => {
    if (debug) {
      // eslint-disable-next-line no-console
      console.log(...messages);
    }
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return value.map((item) => deepCopy(item)) as any;
  } else if (value instanceof Date) {
    // Date objects
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Date(value.getTime()) as any;
  } else if (value instanceof Map) {
    // Maps
    const mapCopy = new Map();
    value.forEach((val, key) => {
      mapCopy.set(key, deepCopy(val));
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return mapCopy as any;
  } else if (value instanceof Set) {
    // Sets
    const setCopy = new Set();
    value.forEach((item) => {
      setCopy.add(deepCopy(item));
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

/**
 * Retrieves the IPv4 address of the first non-internal network interface.
 * @returns {string | undefined} The IPv4 address of the selected network interface, or undefined if not found.
 */
export function getIpv4InterfaceAddress(): string | undefined {
  let ipv4Address: string | undefined;
  const networkInterfaces = os.networkInterfaces();
  // console.log('Available Network Interfaces:', networkInterfaces);
  for (const interfaceDetails of Object.values(networkInterfaces)) {
    if (!interfaceDetails) {
      break;
    }
    for (const detail of interfaceDetails) {
      if (detail.family === 'IPv4' && !detail.internal && ipv4Address === undefined) {
        ipv4Address = detail.address;
      }
    }
    if (ipv4Address !== undefined) {
      break;
    }
  }
  // console.log('Selected Network Interfaces:', ipv4Address);
  return ipv4Address;
}

/**
 * Retrieves the IPv6 address of the first non-internal network interface.
 * @returns {string | undefined} The IPv4 address of the selected network interface, or undefined if not found.
 */
export function getIpv6InterfaceAddress(): string | undefined {
  let ipv6Address: string | undefined;
  const networkInterfaces = os.networkInterfaces();
  // console.log('Available Network Interfaces:', networkInterfaces);
  for (const interfaceDetails of Object.values(networkInterfaces)) {
    if (!interfaceDetails) {
      break;
    }
    for (const detail of interfaceDetails) {
      if (detail.family === 'IPv6' && !detail.internal && ipv6Address === undefined) {
        ipv6Address = detail.address;
      }
    }
    if (ipv6Address !== undefined) {
      break;
    }
  }
  // console.log('Selected Network Interfaces:', ipv6Address);
  return ipv6Address;
}
