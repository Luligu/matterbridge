/**
 * @description This file contains the network functions.
 * @file network.ts
 * @author Luca Liguori
 * @created 2024-02-17
 * @version 1.0.3
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

// AnsiLogger module
import { AnsiLogger, BLUE, CYAN, LogLevel, nf, TimestampFormat } from 'node-ansi-logger';

/**
 * Retrieves the first non-internal network interface details.
 *
 * @returns {os.NetworkInterfaceInfo | undefined} The details of the selected network interface, or undefined if not found.
 */
export function getInterfaceDetails(): { interfaceName: string; ipv4Address: string | undefined; ipv6Address: string | undefined; macAddress: string | undefined } | undefined {
  const result: { interfaceName: string; ipv4Address: string | undefined; ipv6Address: string | undefined; macAddress: string | undefined } = {
    interfaceName: '',
    ipv4Address: undefined,
    ipv6Address: undefined,
    macAddress: undefined,
  };
  for (const [interfaceName, interfaceDetails] of Object.entries(os.networkInterfaces())) {
    if (!interfaceName || !interfaceDetails || interfaceDetails.length === 0) continue;
    for (const detail of interfaceDetails) {
      if (detail.internal) continue;
      if (!result.interfaceName) result.interfaceName = interfaceName;
      if (interfaceName === result.interfaceName && !result.ipv4Address && detail.family === 'IPv4') result.ipv4Address = detail.address;
      if (interfaceName === result.interfaceName && !result.ipv6Address && detail.family === 'IPv6') result.ipv6Address = detail.address;
      if (interfaceName === result.interfaceName && !result.macAddress) result.macAddress = detail.mac;
    }
  }
  if (result.interfaceName) return result;
}

/**
 * Retrieves the first non-internal network interface name.
 *
 * @returns {string | undefined} The name of the selected network interface, or undefined if not found.
 */
export function getInterfaceName(): string | undefined {
  for (const [interfaceName, interfaceDetails] of Object.entries(os.networkInterfaces())) {
    if (!interfaceName || !interfaceDetails || interfaceDetails.length === 0) continue;
    for (const detail of interfaceDetails) {
      if (!detail.internal) return interfaceName;
    }
  }
}

/**
 * Retrieves the IPv4 address of the first non-internal network interface.
 *
 * @returns {string | undefined} The IPv4 address of the selected network interface, or undefined if not found.
 *
 * @remarks
 * Type of ipv4 addresses:
 * - 192.168.x.x, 10.x.x.x, 172.16–31.x.x: RFC 1918 = Private networks
 * - 172.16.0.0 → 172.31.255.255: RFC 1918 = Private IP address used inside local networks, VMs, WSL2 and containers
 * - 169.254.0.0 → 169.254.255.255: APIPA = Automatic Private IP Addressing used when a device fails to obtain an IP address via DHCP
 * - 100.64.0.0 → 100.127.255.255: CGNAT = Carrier-Grade NAT RFC 6598 = Shared Address Space
 */
export function getIpv4InterfaceAddress(): string | undefined {
  for (const [interfaceName, interfaceDetails] of Object.entries(os.networkInterfaces())) {
    if (!interfaceName || !interfaceDetails || interfaceDetails.length === 0) continue;
    for (const detail of interfaceDetails) {
      if (detail.family === 'IPv4' && !detail.internal) return detail.address;
    }
  }
}

/**
 * Retrieves the IPv6 address of the first non-internal network interface.
 *
 * If `scope` is true, appends a zone id (scope) for link-local addresses when
 * available:
 * - On Windows: uses `%<scopeid>` (e.g. `...%11`)
 * - On other platforms: uses `%<interfaceName>` (e.g. `...%eth0`)
 *
 * @param {boolean} [scope] - Whether to append a zone id when available.
 * @returns {string | undefined} The IPv6 address of the selected network interface, or undefined if not found.
 *
 * @remarks
 * Type of IPv6 addresses (preferred order for Matter)
 *
 * fd00::/8
 *   - IPv6 ULA (Unique Local Address)
 *   - Private IPv6 networks (RFC 4193)
 *   - ✔ PREFERRED
 *
 * 2000::/3
 *   - Global Unicast IPv6
 *   - Publicly routable IPv6
 *   - ⚠ OPTIONAL (advanced setups only)
 *
 * fe80::/10
 *   - IPv6 Link-Local
 *   - Interface-scoped only, non-routable
 */
export function getIpv6InterfaceAddress(scope: boolean = false): string | undefined {
  for (const [interfaceName, interfaceDetails] of Object.entries(os.networkInterfaces())) {
    if (!interfaceName || !interfaceDetails || interfaceDetails.length === 0) continue;
    for (const detail of interfaceDetails) {
      if (detail.family === 'IPv6' && !detail.internal) {
        const address = detail.address;
        if (!scope) return address;

        // Defensive check: if already has a zone id, keep it. Should never happen from os.networkInterfaces().
        if (address.includes('%')) return address;

        const isWindows = os.platform() === 'win32';
        const zoneId = isWindows ? detail.scopeid : interfaceName;
        if (zoneId !== undefined && zoneId !== null && `${zoneId}`.length > 0) {
          return `${address}%${zoneId}`;
        }
        return address;
      }
    }
  }
}

/**
 * Retrieves the mac address of the first non-internal network interface.
 *
 * @returns {string | undefined} The mac address, or undefined if not found.
 */
export function getMacAddress(): string | undefined {
  for (const [interfaceName, interfaceDetails] of Object.entries(os.networkInterfaces())) {
    if (!interfaceName || !interfaceDetails || interfaceDetails.length === 0) continue;
    for (const detail of interfaceDetails) {
      if (!detail.internal) return detail.mac;
    }
  }
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
  } catch (_error) {
    return null;
  }
}
