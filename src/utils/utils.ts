/**
 * This file contains the deepEqual function.
 *
 * @file utils.ts
 * @author Luca Liguori
 * @date 2024-02-17
 * @version 1.2.9
 *
 * Copyright 2024, 2025, 2026 Luca Liguori.
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

// Node.js modules
import os from 'node:os';
import path from 'node:path';

// Node.js modules import types
import type { ExecException } from 'node:child_process';

// Archiver module import types
import type { ArchiverError, EntryData } from 'archiver';

// AnsiLogger module
import { AnsiLogger, idn, LogLevel, rs, TimestampFormat } from '../logger/export.js';

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
 * Logs the available network interfaces and their details.
 * @param {boolean} log - Whether to enable logging of network interface details.
 * @returns {string | undefined} The IPv6 address of the network interface, if available.
 */
export function logInterfaces(debug = true): string | undefined {
  log.logLevel = LogLevel.INFO;
  log.logName = 'LogInterfaces';

  let ipv6Address: string | undefined;
  const networkInterfaces = os.networkInterfaces();
  if (debug) log.info('Available Network Interfaces:');
  for (const [interfaceName, networkInterface] of Object.entries(networkInterfaces)) {
    if (!networkInterface) break;
    if (debug) log.info(`Interface: ${idn}${interfaceName}${rs}`);
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
 */
export async function createZip(outputPath: string, ...sourcePaths: string[]): Promise<number> {
  const { default: archiver } = await import('archiver');
  const { glob } = await import('glob');
  const { createWriteStream, statSync } = await import('fs');

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

    archive.on('entry', (entry: EntryData) => {
      log.debug(`- archive entry: ${entry.name}`);
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
            log.debug(`- glob file: ${file}`);
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

/**
 * Copies a directory and all its subdirectories and files to a new location.
 *
 * @param {string} srcDir - The path to the source directory.
 * @param {string} destDir - The path to the destination directory.
 * @returns {Promise<boolean>} - A promise that resolves when the copy operation is complete or fails for error.
 * @throws {Error} - Throws an error if the copy operation fails.
 */
export async function copyDirectory(srcDir: string, destDir: string): Promise<boolean> {
  const fs = await import('fs').then((mod) => mod.promises);

  log.debug(`copyDirectory: copying directory from ${srcDir} to ${destDir}`);
  try {
    // Create destination directory if it doesn't exist
    await fs.mkdir(destDir, { recursive: true });

    // Read contents of the source directory
    const entries = await fs.readdir(srcDir, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(srcDir, entry.name);
      const destPath = path.join(destDir, entry.name);

      if (entry.isDirectory()) {
        // Recursive call if entry is a directory
        await copyDirectory(srcPath, destPath);
      } else if (entry.isFile()) {
        // Copy file if entry is a file
        await fs.copyFile(srcPath, destPath);
      }
    }
    return true;
  } catch (error) {
    log.error(`copyDirectory error copying from ${srcDir} to ${destDir}: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

/**
 * Resolves the given hostname to an IP address.
 *
 * @param {string} hostname - The hostname to resolve.
 * @param {0 | 4 | 6} [family=4] - The address family to use (0 for any, 4 for IPv4, 6 for IPv6). Default is 4.
 * @returns {Promise<string | null>} - A promise that resolves to the IP address or null if not found.
 *
 * @remarks
 * This function uses DNS lookup to resolve the hostname, which can take some time to complete.
 */
export async function resolveHostname(hostname: string, family: 0 | 4 | 6 = 4): Promise<string | null> {
  const dns = await import('dns');
  try {
    const addresses = await dns.promises.lookup(hostname.toLowerCase() /* + '.local'*/, { family });
    return addresses.address;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return null;
  }
}

/**
 * Retrieves the version of an npm package from the npm registry.
 *
 * @param {string} packageName - The name of the npm package.
 * @param {string} [tag='latest'] - The tag of the package version to retrieve (default is 'latest').
 * @param {number} [timeout=5000] - The timeout duration in milliseconds (default is 5000ms).
 * @returns {Promise<string>} A promise that resolves to the version string of the package.
 * @throws {Error} If the request fails or the tag is not found.
 */
export async function getNpmPackageVersion(packageName: string, tag = 'latest', timeout = 5000): Promise<string> {
  const https = await import('https');
  return new Promise((resolve, reject) => {
    const url = `https://registry.npmjs.org/${packageName}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error(`Request timed out after ${timeout / 1000} seconds`));
    }, timeout);

    const req = https.get(url, { signal: controller.signal }, (res) => {
      let data = '';

      if (res.statusCode !== 200) {
        clearTimeout(timeoutId);
        res.resume(); // Discard response data to close the socket properly
        req.destroy(); // Forcefully close the request
        reject(new Error(`Failed to fetch data. Status code: ${res.statusCode}`));
        return;
      }

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        clearTimeout(timeoutId);
        try {
          const jsonData = JSON.parse(data);
          // console.log(`Package ${packageName} tag ${tag}`, jsonData);
          const version = jsonData['dist-tags']?.[tag];
          if (version) {
            resolve(version);
          } else {
            reject(new Error(`Tag "${tag}" not found for package "${packageName}"`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse response JSON: ${error instanceof Error ? error.message : error}`));
        }
      });
    });

    req.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(new Error(`Request failed: ${error instanceof Error ? error.message : error}`));
    });
  });
}

/**
 * Retrieves the path to the global Node.js modules directory.
 * @returns A promise that resolves to the path of the global Node.js modules directory.
 */
export async function getGlobalNodeModules(): Promise<string> {
  const { exec } = await import('node:child_process');
  return new Promise((resolve, reject) => {
    exec('npm root -g', (error: ExecException | null, stdout: string) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}
