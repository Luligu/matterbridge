/**
 * @description This file contains the bin mb_mdns for the class Mdns.
 * @file packages/core/src/mb_mdns.ts
 * @author Luca Liguori
 * @created 2025-07-22
 * @version 2.0.0
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

import { AddressInfo } from 'node:net';
import os from 'node:os';

import { DnsClass, DnsClassFlag, DnsRecordType, Mdns, MDNS_MULTICAST_IPV4_ADDRESS, MDNS_MULTICAST_IPV6_ADDRESS, MDNS_MULTICAST_PORT } from '@matterbridge/dgram';
import { getIntParameter, getParameter, getStringArrayParameter, hasParameter } from '@matterbridge/utils/cli';
import { excludedInterfaceNamePattern } from '@matterbridge/utils/network';

import pkg from '../package.json' with { type: 'json' };

export const MB_MDNS_DEFAULT_INTERVAL_MS = 10000;
export const MB_MDNS_DEFAULT_TIMEOUT_MS = 600000;
export const MB_MDNS_CLEANUP_DELAY_MS = 250;

export interface MbMdnsOptions {
  showHelp: boolean;
  interfaceName?: string;
  ipv4InterfaceAddress: string;
  ipv6InterfaceAddress: string;
  outgoingIpv4InterfaceAddress?: string;
  outgoingIpv6InterfaceAddress?: string;
  advertiseIntervalMs?: number;
  queryIntervalMs?: number;
  unicast: boolean;
  filters: string[];
  ipFilters: string[];
  disableIpv4: boolean;
  disableIpv6: boolean;
  disableLoopback: boolean;
  disableTimeout: boolean;
  verbose: boolean;
}

export interface MbMdnsRuntime {
  mdnsIpv4?: Mdns;
  mdnsIpv6?: Mdns;
  cleanupAndLogAndExit: () => Promise<void>;
}

function defaultConsoleLog(message: string): void {
  // eslint-disable-next-line no-console
  console.log(message);
}

export function getMbMdnsHelpText(): string {
  return `Copyright (c) Matterbridge. All rights reserved. Version 2.0.0.

Usage: mb_mdns [options...]

If no command line is provided, mb_mdns shows all incoming mDNS records on all interfaces (0.0.0.0 and ::).

Options:
  -h, --help                                Show this help message and exit.
  --interfaceName <name>                    Network interface name to bind to (default all interfaces).
  --ipv4InterfaceAddress <address>          IPv4 address of the network interface to bind to (default: 0.0.0.0).
  --ipv6InterfaceAddress <address>          IPv6 address of the network interface to bind to (default: ::).
  --outgoingIpv4InterfaceAddress <address>  Outgoing IPv4 address of the network interface (default first external address).
  --outgoingIpv6InterfaceAddress <address>  Outgoing IPv6 address of the network interface (default first external address).
  --advertise <interval>                    Enable matterbridge mDNS advertisement each ms (default interval: 10000ms).
  --query <interval>                        Enable common mDNS services query each ms (default interval: 10000ms).
  --unicast                                 Enable unicast responses for mDNS queries (default: disabled).
  --filter <string...>                      Filter strings to match in the mDNS record name (default: no filter).
  --ip-filter <string...>                   Filter strings to match in the mDNS sender ip address (default: no filter).
  --noIpv4                                  Disable IPv4 mDNS server (default: enabled).
  --noIpv6                                  Disable IPv6 mDNS server (default: enabled).
  --no-loopback                             Disable multicast loopback (default: enabled).
  --no-timeout                              Disable automatic timeout of 10 minutes.
  -d, --debug                               Enable debug logging (default: disabled).
  -v, --verbose                             Enable verbose logging (default: disabled).
  -s, --silent                              Enable silent mode, only log notices, warnings and errors.

Examples:
  # Listen for Matter device commissioner service records only on eth0 interface
  mb_mdns --interfaceName eth0 --filter _matterc._udp

  # Listen for Matter device discovery service records only on eth0 interface
  mb_mdns --interfaceName eth0 --filter _matter._tcp

  # Listen for Matter commissioner and discovery service records on all interfaces
  mb_mdns --filter _matterc._udp _matter._tcp

  # Listen for Matter commissioner and discovery service records on all interfaces from specific ipv4 and ipv6 ips
  mb_mdns --filter _matterc._udp _matter._tcp --ip-filter 192.168.69.20 fe80::1077:2e0d:2c91:aa90

  # Query for mDNS devices every 10s on a specific interface
  mb_mdns --interfaceName eth0 --query

  # Advertise _matterbridge._tcp.local every 5s with filter
  mb_mdns --advertise 5000 --filter _matterbridge._tcp.local

  # Query each 5s and listen for _matterbridge._tcp.local service records
  mb_mdns --query 5000 --filter _matterbridge._tcp.local
`;
}

export function printMbMdnsHelp(log: (message: string) => void = defaultConsoleLog): void {
  log(getMbMdnsHelpText());
}

export function getMbMdnsOptions(): MbMdnsOptions {
  const advertiseIntervalMs = hasParameter('advertise') ? getIntParameter('advertise') || MB_MDNS_DEFAULT_INTERVAL_MS : undefined;
  const queryIntervalMs = hasParameter('query') ? getIntParameter('query') || MB_MDNS_DEFAULT_INTERVAL_MS : undefined;

  return {
    showHelp: hasParameter('h') || hasParameter('help'),
    interfaceName: getParameter('interfaceName'),
    ipv4InterfaceAddress: getParameter('ipv4InterfaceAddress') || '0.0.0.0',
    ipv6InterfaceAddress: getParameter('ipv6InterfaceAddress') || '::',
    outgoingIpv4InterfaceAddress: getParameter('outgoingIpv4InterfaceAddress'),
    outgoingIpv6InterfaceAddress: getParameter('outgoingIpv6InterfaceAddress'),
    advertiseIntervalMs,
    queryIntervalMs,
    unicast: hasParameter('unicast'),
    filters: getStringArrayParameter('filter') ?? [],
    ipFilters: getStringArrayParameter('ip-filter') ?? [],
    disableIpv4: hasParameter('noIpv4'),
    disableIpv6: hasParameter('noIpv6'),
    disableLoopback: hasParameter('no-loopback'),
    disableTimeout: hasParameter('no-timeout'),
    verbose: hasParameter('v') || hasParameter('verbose'),
  };
}

export function sendMdnsQuery(mdns: Mdns, unicast: boolean = false): void {
  mdns.log.info('Sending mDNS query for common services...');
  try {
    mdns.sendQuery([
      { name: '_matterc._udp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: unicast },
      { name: '_matter._tcp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: unicast },
      { name: '_matterbridge._tcp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: unicast },
      { name: '_home-assistant._tcp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: unicast },
      { name: '_shelly._tcp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: unicast },
      { name: '_mqtt._tcp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: unicast },
      { name: '_http._tcp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: unicast },
      { name: '_googlecast._tcp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: unicast },
      { name: '_airplay._tcp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: unicast },
      { name: '_amzn-alexa._tcp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: unicast },
      { name: '_companion-link._tcp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: unicast },
      { name: '_hap._tcp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: unicast },
      { name: '_hap._udp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: unicast },
      { name: '_ipp._tcp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: unicast },
      { name: '_ipps._tcp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: unicast },
      { name: '_meshcop._tcp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: unicast },
      { name: '_printer._tcp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: unicast },
      { name: '_raop._tcp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: unicast },
      { name: '_sleep-proxy._tcp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: unicast },
      { name: '_ssh._tcp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: unicast },
      { name: '_services._dns-sd._udp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: unicast },
    ]);
  } catch (error) {
    mdns.log.error(`Error sending mDNS query: ${(error as Error).message}`);
  }
}

export function advertiseMatterbridgeService(mdns: Mdns, ttl: number = 120): void {
  mdns.log.info(`Sending mDNS advertisement for matterbridge service with TTL ${ttl ? ttl.toString() : 'goodbye'}...`);
  const httpServiceType = '_http._tcp.local';
  const matterbridgeServiceType = '_matterbridge._tcp.local';
  const httpInstanceName = 'matterbridge._http._tcp.local';
  const matterbridgeInstanceName = 'matterbridge._matterbridge._tcp.local';
  const hostName = 'matterbridge.local';
  const port = 8283;

  const ptrHttpServiceTypeRdata = mdns.encodeDnsName(httpServiceType);
  const ptrMatterbridgeServiceTypeRdata = mdns.encodeDnsName(matterbridgeServiceType);
  const ptrHttpInstanceRdata = mdns.encodeDnsName(httpInstanceName);
  const ptrMatterbridgeInstanceRdata = mdns.encodeDnsName(matterbridgeInstanceName);
  const srvRdata = mdns.encodeSrvRdata(0, 0, port, hostName);
  const txtRdata = mdns.encodeTxtRdata([`version=${pkg.version}`, 'path=/']);

  const answers: { name: string; rtype: number; rclass: number; ttl: number; rdata: Buffer }[] = [
    { name: '_services._dns-sd._udp.local', rtype: DnsRecordType.PTR, rclass: DnsClass.IN, ttl, rdata: ptrHttpServiceTypeRdata },
    { name: httpServiceType, rtype: DnsRecordType.PTR, rclass: DnsClass.IN, ttl, rdata: ptrHttpInstanceRdata },
    { name: '_services._dns-sd._udp.local', rtype: DnsRecordType.PTR, rclass: DnsClass.IN, ttl, rdata: ptrMatterbridgeServiceTypeRdata },
    { name: matterbridgeServiceType, rtype: DnsRecordType.PTR, rclass: DnsClass.IN, ttl, rdata: ptrMatterbridgeInstanceRdata },
    { name: httpInstanceName, rtype: DnsRecordType.SRV, rclass: DnsClass.IN | DnsClassFlag.FLUSH, ttl, rdata: srvRdata },
    { name: matterbridgeInstanceName, rtype: DnsRecordType.SRV, rclass: DnsClass.IN | DnsClassFlag.FLUSH, ttl, rdata: srvRdata },
    { name: httpInstanceName, rtype: DnsRecordType.TXT, rclass: DnsClass.IN | DnsClassFlag.FLUSH, ttl, rdata: txtRdata },
    { name: matterbridgeInstanceName, rtype: DnsRecordType.TXT, rclass: DnsClass.IN | DnsClassFlag.FLUSH, ttl, rdata: txtRdata },
  ];

  const interfaces = os.networkInterfaces();
  let interfaceInfos: os.NetworkInterfaceInfo[] = mdns.interfaceName ? (interfaces[mdns.interfaceName] ?? []) : [];

  if (interfaceInfos.length === 0) {
    for (const name of Object.keys(interfaces)) {
      if (excludedInterfaceNamePattern.test(name)) continue;
      const infos = interfaces[name];
      if (infos && infos.length > 0 && !infos[0].internal) {
        interfaceInfos = infos;
        break;
      }
    }
  }

  for (const info of interfaceInfos) {
    if (info.family === 'IPv4' && !info.internal) {
      answers.push({ name: hostName, rtype: DnsRecordType.A, rclass: DnsClass.IN | DnsClassFlag.FLUSH, ttl, rdata: mdns.encodeA(info.address) });
    } else if (info.family === 'IPv6' && !info.internal) {
      answers.push({ name: hostName, rtype: DnsRecordType.AAAA, rclass: DnsClass.IN | DnsClassFlag.FLUSH, ttl, rdata: mdns.encodeAAAA(info.address) });
    }
  }

  try {
    mdns.sendResponse(answers);
  } catch (error) {
    mdns.log.error(`Error sending mDNS advertisement: ${(error as Error).message}`);
  }
}

export function startMbMdns(options: MbMdnsOptions, registerSignalHandlers: boolean = true): MbMdnsRuntime {
  let mdnsIpv4QueryInterval: ReturnType<typeof setInterval> | undefined;
  let mdnsIpv6QueryInterval: ReturnType<typeof setInterval> | undefined;
  let mdnsIpv4AdvertiseInterval: ReturnType<typeof setInterval> | undefined;
  let mdnsIpv6AdvertiseInterval: ReturnType<typeof setInterval> | undefined;

  let mdnsIpv4: Mdns | undefined;
  let mdnsIpv6: Mdns | undefined;

  async function cleanupAndLogAndExit(): Promise<void> {
    clearInterval(mdnsIpv4QueryInterval);
    clearInterval(mdnsIpv6QueryInterval);
    clearInterval(mdnsIpv4AdvertiseInterval);
    clearInterval(mdnsIpv6AdvertiseInterval);
    if (options.advertiseIntervalMs !== undefined) {
      if (mdnsIpv4) advertiseMatterbridgeService(mdnsIpv4, 0);
      if (mdnsIpv6) advertiseMatterbridgeService(mdnsIpv6, 0);
    }
    await new Promise<void>((resolve) => setTimeout(resolve, MB_MDNS_CLEANUP_DELAY_MS));
    mdnsIpv4?.stop();
    mdnsIpv6?.stop();
    mdnsIpv4?.logDevices();
    mdnsIpv6?.logDevices();
    await new Promise<void>((resolve) => setTimeout(resolve, MB_MDNS_CLEANUP_DELAY_MS));
  }

  if (!options.disableIpv4) {
    mdnsIpv4 = new Mdns(
      'mDNS Server udp4',
      MDNS_MULTICAST_IPV4_ADDRESS,
      MDNS_MULTICAST_PORT,
      'udp4',
      true,
      options.interfaceName,
      options.ipv4InterfaceAddress,
      options.outgoingIpv4InterfaceAddress,
    );
    if (options.verbose) mdnsIpv4.listNetworkInterfaces();
    if (options.filters.length > 0) mdnsIpv4.filters.push(...options.filters);
    if (options.ipFilters.length > 0) mdnsIpv4.ipFilters.push(...options.ipFilters);
    mdnsIpv4.on('error', (err) => {
      mdnsIpv4?.log.error(`mDNS udp4 Server error: ${err.message}\n${err.stack}`);
    });
    mdnsIpv4.start();
    mdnsIpv4.on('ready', (address: AddressInfo) => {
      if (options.disableLoopback) {
        mdnsIpv4?.socket.setMulticastLoopback(false);
        mdnsIpv4?.log.info('Multicast loopback disabled for mdnsIpv4');
      }
      mdnsIpv4?.log.info(`mdnsIpv4 server ready on ${address.family} ${address.address}:${address.port}`);
      if (options.advertiseIntervalMs !== undefined) {
        advertiseMatterbridgeService(mdnsIpv4 as Mdns);
        mdnsIpv4AdvertiseInterval = setInterval(() => advertiseMatterbridgeService(mdnsIpv4 as Mdns), options.advertiseIntervalMs).unref();
      }
      if (options.queryIntervalMs !== undefined) {
        sendMdnsQuery(mdnsIpv4 as Mdns, options.unicast);
        mdnsIpv4QueryInterval = setInterval(() => sendMdnsQuery(mdnsIpv4 as Mdns, options.unicast), options.queryIntervalMs).unref();
      }
    });
  }

  if (!options.disableIpv6) {
    mdnsIpv6 = new Mdns(
      'mDNS Server udp6',
      MDNS_MULTICAST_IPV6_ADDRESS,
      MDNS_MULTICAST_PORT,
      'udp6',
      true,
      options.interfaceName,
      options.ipv6InterfaceAddress,
      options.outgoingIpv6InterfaceAddress,
    );
    if (options.disableIpv4 && options.verbose) mdnsIpv6.listNetworkInterfaces();
    if (options.filters.length > 0) mdnsIpv6.filters.push(...options.filters);
    if (options.ipFilters.length > 0) mdnsIpv6.ipFilters.push(...options.ipFilters);
    mdnsIpv6.on('error', (err) => {
      mdnsIpv6?.log.error(`mDNS udp6 Server error: ${err.message}\n${err.stack}`);
    });
    mdnsIpv6.start();
    mdnsIpv6.on('ready', (address: AddressInfo) => {
      if (options.disableLoopback) {
        mdnsIpv6?.socket.setMulticastLoopback(false);
        mdnsIpv6?.log.info('Multicast loopback disabled for mdnsIpv6');
      }
      mdnsIpv6?.log.info(`mdnsIpv6 server ready on ${address.family} ${address.address}:${address.port}`);
      if (options.advertiseIntervalMs !== undefined) {
        advertiseMatterbridgeService(mdnsIpv6 as Mdns);
        mdnsIpv6AdvertiseInterval = setInterval(() => advertiseMatterbridgeService(mdnsIpv6 as Mdns), options.advertiseIntervalMs).unref();
      }
      if (options.queryIntervalMs !== undefined) {
        sendMdnsQuery(mdnsIpv6 as Mdns, options.unicast);
        mdnsIpv6QueryInterval = setInterval(() => sendMdnsQuery(mdnsIpv6 as Mdns, options.unicast), options.queryIntervalMs).unref();
      }
    });
  }

  if (registerSignalHandlers) {
    process.on('SIGINT', async () => {
      await cleanupAndLogAndExit();
    });
    process.on('SIGTERM', async () => {
      await cleanupAndLogAndExit();
    });
  }

  if (!options.disableTimeout) {
    setTimeout(async () => {
      await cleanupAndLogAndExit();
    }, MB_MDNS_DEFAULT_TIMEOUT_MS).unref();
  }

  return {
    mdnsIpv4,
    mdnsIpv6,
    cleanupAndLogAndExit,
  };
}

export function mbMdnsMain(exitFn: (code: number) => never | void = process.exit, log: (message: string) => void = defaultConsoleLog): MbMdnsRuntime | undefined {
  const options = getMbMdnsOptions();

  if (options.showHelp) {
    printMbMdnsHelp(log);
    exitFn(0);
    return;
  }

  return startMbMdns(options);
}