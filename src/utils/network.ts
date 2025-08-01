/**
 * @description This file contains the network functions.
 * @file network.ts
 * @author Luca Liguori
 * @created 2024-02-17
 * @version 1.0.1
 * @license Apache-2.0
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
 * limitations under the License.
 */

// Node.js modules
import os from 'node:os';
// Node.js modules import types
import type { ExecException } from 'node:child_process';

// AnsiLogger module
import { AnsiLogger, BLUE, CYAN, LogLevel, nf, TimestampFormat } from 'node-ansi-logger';

/**
 * Retrieves the IPv4 address of the first non-internal network interface.
 *
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
 *
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
 *
 * @returns {string | undefined} The mac address, or undefined if not found.
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
      if (!detail.internal && macAddress === undefined) {
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
 *
 * @returns {void}
 */
export function logInterfaces(): void {
  const log = new AnsiLogger({ logName: 'MatterbridgeUtils', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.INFO });

  log.logLevel = LogLevel.INFO;
  log.logName = 'LogInterfaces';

  log.info('Available Network Interfaces:');
  const availableAddresses = Object.entries(os.networkInterfaces());
  for (const [ifaceName, ifaces] of availableAddresses) {
    if (ifaces && ifaces.length > 0) {
      log.info(`Network interface ${BLUE}${ifaceName}${nf}:`);
      ifaces.forEach((iface) => {
        log.info(
          `- ${CYAN}${iface.family}${nf} address ${CYAN}${iface.address}${nf} netmask ${CYAN}${iface.netmask}${nf} mac ${CYAN}${iface.mac}${nf}` +
            `${iface.scopeid ? ` scopeid ${CYAN}${iface.scopeid}${nf}` : ''}${iface.cidr ? ` cidr ${CYAN}${iface.cidr}${nf}` : ''} ${CYAN}${iface.internal ? 'internal' : 'external'}${nf}`,
        );
      });
    }
  }
}

/**
 * Resolves the given hostname to an IP address.
 *
 * @param {string} hostname - The hostname to resolve.
 * @param {0 | 4 | 6} [family] - The address family to use (0 for any, 4 for IPv4, 6 for IPv6). Default is 4.
 * @returns {Promise<string | null>} - A promise that resolves to the IP address or null if not found.
 *
 * @remarks
 * This function uses DNS lookup to resolve the hostname, which can take some time to complete.
 */
export async function resolveHostname(hostname: string, family: 0 | 4 | 6 = 4): Promise<string | null> {
  const dns = await import('node:dns');
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
 * @param {string} [tag] - The tag of the package version to retrieve (default is 'latest').
 * @param {number} [timeout] - The timeout duration in milliseconds (default is 10000ms).
 * @returns {Promise<string>} A promise that resolves to the version string of the package.
 * @throws {Error} If the request fails or the tag is not found.
 */
export async function getNpmPackageVersion(packageName: string, tag: string = 'latest', timeout: number = 10000): Promise<string> {
  const https = await import('node:https');
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
 * Retrieves a file from the public directory of the Matterbridge GitHub repository.
 *
 * @param {string} branch - The branch from which to fetch the file.
 * @param {string} file - The file path to fetch.
 * @param {number} [timeout] - The timeout duration in milliseconds (default is 10000ms).
 * @returns {Promise<Record<string, boolean | string | number>>} A promise that resolves to the parsed JSON object from the file.
 * @throws {Error} If the request fails or the JSON parsing fails.
 */
export async function getGitHubUpdate(branch: string, file: string, timeout: number = 10000): Promise<Record<string, boolean | string | number>> {
  const https = await import('node:https');
  return new Promise((resolve, reject) => {
    const url = `https://raw.githubusercontent.com/Luligu/matterbridge/${branch}/public/${file}`;
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
          resolve(jsonData);
        } catch (error) {
          reject(new Error(`Failed to parse response JSON: ${error instanceof Error ? error.message : error}`));
        }
      });
    });

    // istanbul ignore next
    req.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(new Error(`Request failed: ${error instanceof Error ? error.message : error}`));
    });
  });
}

/**
 * Retrieves the path to the global Node.js modules directory.
 *
 * @returns {Promise<string>} A promise that resolves to the path of the global Node.js modules directory.
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
