/**
 * This file contains the deepEqual function.
 *
 * @file utils.ts
 * @author Luca Liguori
 * @date 2024-02-17
 * @version 1.2.9
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
import { createWriteStream, statSync } from 'fs';
import archiver, { ArchiverError, EntryData } from 'archiver';
import path from 'path';
import { AnsiLogger, LogLevel, TimestampFormat } from 'node-ansi-logger';
import { glob } from 'glob';

const log = new AnsiLogger({ logName: 'MatterbridgeUtils', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.INFO });

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

/**
 * Retrieves the mac address of the first non-internal network interface.
 * @returns {string | undefined} The IPv4 address of the selected network interface, or undefined if not found.
 */
export function getMacAddress(): string | undefined {
  let macAddress: string | undefined;
  const networkInterfaces = os.networkInterfaces();
  // console.log('Available Network Interfaces:', networkInterfaces);
  for (const interfaceDetails of Object.values(networkInterfaces)) {
    if (!interfaceDetails) {
      break;
    }
    for (const detail of interfaceDetails) {
      if (detail.family === 'IPv6' && !detail.internal && macAddress === undefined) {
        macAddress = detail.mac;
      }
    }
    if (macAddress !== undefined) {
      break;
    }
  }
  return macAddress;
}

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

/**
 * Logs the available network interfaces and their details.
 * @param {boolean} log - Whether to enable logging of network interface details.
 * @returns {string | undefined} The IPv6 address of the network interface, if available.
 */
export function logInterfaces(debug = true): string | undefined {
  log.logLevel = LogLevel.INFO;
  log.logName = 'LogInterfaces';

  let ipv6Address: string | undefined;
  const networkInterfaces = os.networkInterfaces();
  if (debug) log.info('Available Network Interfaces:', networkInterfaces);
  for (const [interfaceName, networkInterface] of Object.entries(networkInterfaces)) {
    if (!networkInterface) break;
    if (debug) log.info('Interface:', '\u001B[48;5;21m\u001B[38;5;255m', interfaceName, '\u001B[40;0m');
    for (const detail of networkInterface) {
      if (debug) log.info('Details:', detail);
    }
  }
  return ipv6Address;
}

/**
 * Asynchronous waiter function that resolves when the provided condition is met or rejects on timeout.
 * @param {string} name - The name of the waiter.
 * @param {() => boolean} check - A function that checks the condition. Should return a boolean.
 * @param {boolean} [exitWithReject=false] - Optional. If true, the promise will be rejected on timeout. Default is false.
 * @param {number} [resolveTimeout=5000] - Optional. The timeout duration in milliseconds. Default is 5000ms.
 * @param {number} [resolveInterval=500] - Optional. The interval duration in milliseconds between condition checks. Default is 500ms.
 * @param {boolean} [debug=false] - Optional. If true, debug messages will be logged to the console. Default is false.
 * @returns {Promise<boolean>} A promise that resolves to true when the condition is met, or false if the timeout occurs.
 */
export async function waiter(name: string, check: () => boolean, exitWithReject = false, resolveTimeout = 5000, resolveInterval = 500, debug = false) {
  log.logLevel = LogLevel.DEBUG;
  log.logName = 'Waiter';
  if (debug) log.debug(`Waiter "${name}" started...`);
  return new Promise<boolean>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      if (debug) log.debug(`Waiter "${name}" finished for timeout...`);
      clearTimeout(timeoutId);
      clearInterval(intervalId);
      if (exitWithReject) reject(new Error(`Waiter "${name}" finished due to timeout`));
      else resolve(false);
    }, resolveTimeout);

    const intervalId = setInterval(() => {
      if (check()) {
        if (debug) log.debug(`Waiter "${name}" finished for true condition...`);
        clearTimeout(timeoutId);
        clearInterval(intervalId);
        resolve(true);
      }
    }, resolveInterval);
  });
}

/**
 * Asynchronously waits for a specified amount of time.
 * @param {number} timeout - The duration to wait in milliseconds. Default is 1000ms.
 * @param {string} name - The name of the wait operation. Default is undefined.
 * @param {boolean} debug - Whether to enable debug logging. Default is false.
 * @returns {Promise<void>} A Promise that resolves after the specified timeout.
 */
export async function wait(timeout = 1000, name?: string, debug = false): Promise<void> {
  log.logLevel = LogLevel.DEBUG;
  log.logName = 'Wait';
  if (debug) log.debug(`Wait "${name}" started...`);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      if (debug) log.debug(`Wait "${name}" finished...`);
      clearTimeout(timeoutId);
      resolve();
    }, timeout);
  });
}

/**
 * Creates a ZIP archive from the specified source pattern or directory and writes it to the specified output path.
 *
 * @param {string} outputPath - The path where the output ZIP file will be written.
 * @param {string[]} sourcePaths - The source pattern or directory to be zipped (use path.join for sourcePath).
 * @returns {Promise<number>} - A promise that resolves to the total number of bytes written to the ZIP file.
 *
 * @remarks
 * This function uses the `archiver` library to create a ZIP archive. It sets the compression level to 9 (maximum compression).
 * The function ensures that the output file is properly closed after the archiving process is complete.
 * It logs the progress and the total number of bytes written to the console.
 *
 * This function uses the `glob` library to match files based on the source pattern (internally converted in posix).
 *
 * @example
 * createZip('/path/to/source', '/path/to/output.zip')
 *   .then(bytes => console.log(`ZIP file created with ${bytes} bytes`))
 *   .catch(error => console.error(`Error creating ZIP file: ${error.message}`));
 */
export async function createZip(outputPath: string, ...sourcePaths: string[]): Promise<number> {
  log.logLevel = LogLevel.INFO;
  log.logName = 'Archive';
  log.debug(`creating archive ${outputPath} from ${sourcePaths.join(', ')} ...`);

  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: 9 }, // Set compression level
    });

    output.on('close', () => {
      log.debug(`archive ${outputPath} closed with ${archive.pointer()} total bytes`);
      resolve(archive.pointer());
    });

    output.on('end', () => {
      log.debug(`archive ${outputPath} data has been drained ${archive.pointer()} total bytes`);
    });

    archive.on('error', (error: ArchiverError) => {
      log.error(`archive error: ${error.message}`);
      reject(error);
    });

    archive.on('warning', (error: ArchiverError) => {
      if (error.code === 'ENOENT') {
        log.warn(`archive warning: ${error.message}`);
      } else {
        log.error(`archive warning: ${error.message}`);
        reject(error);
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    archive.on('entry', (entry: EntryData) => {
      // log.debug(`- entry: ${entry.name}`);
    });

    archive.pipe(output);

    for (const sourcePath of sourcePaths) {
      // Check if the sourcePath is a file or directory
      let stats;
      try {
        stats = statSync(sourcePath);
      } catch (error) {
        if (sourcePath.includes('*')) {
          const files = glob.sync(sourcePath.replace(/\\/g, '/'));
          log.debug(`adding files matching glob pattern: ${sourcePath}`);
          for (const file of files) {
            // log.debug(`-glob file: ${file}`);
            archive.file(file, { name: file });
          }
        } else {
          log.error(`no files or directory found for pattern ${sourcePath}: ${error}`);
        }
        continue;
      }
      if (stats.isFile()) {
        log.debug(`adding file: ${sourcePath}`);
        archive.file(sourcePath, { name: path.basename(sourcePath) });
      } else if (stats.isDirectory()) {
        log.debug(`adding directory: ${sourcePath}`);
        archive.directory(sourcePath, path.basename(sourcePath));
      }
    }
    // Finalize the archive (i.e., we are done appending files but streams have to finish yet)
    log.debug(`finalizing archive ${outputPath}...`);
    archive.finalize().catch(reject);
  });
}

// await createZip('output.zip', path.join('C:\\Users\\lligu\\.matterbridge'), path.join('C:\\Users\\lligu\\Matterbridge'));
