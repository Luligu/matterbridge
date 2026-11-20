/**
 * @file packages/dgram/src/matterbridgeAdvertise.ts
 * @description This file contains the class MatterbridgeAdvertise, a Matterbridge frontend advertiser using the shared mDNS responder.
 * @author Luca Liguori
 * @created 2026-09-28
 * @version 1.0.2
 * @license Apache-2.0
 *
 * Copyright 2026, 2027, 2028 Luca Liguori.
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

import { createHash } from 'node:crypto';
import os from 'node:os';
import { parseArgs } from 'node:util';

import { getErrorMessage } from '@matterbridge/utils/error';
import { excludedInterfaceNamePattern } from '@matterbridge/utils/network';
import { LogLevel } from 'node-ansi-logger';

import { MDNS_ADVERTISE_DEFAULT_ADDRESS_CHECK_MS, MdnsResponder, type MdnsResponderOptions } from './mdnsResponder.js';

// These are Matterbridge application-profile choices, not ports or service names prescribed by RFC 6763.
/** Default service port advertised in the SRV records (the matterbridge frontend). */
export const MATTERBRIDGE_ADVERTISE_DEFAULT_PORT = 8283;
/** Default service types advertised. */
export const MATTERBRIDGE_ADVERTISE_DEFAULT_SERVICES = ['_matterbridge._tcp', '_http._tcp'];
/** Default TXT entries (RFC 6763 §6.7 txtvers first). */
export const MATTERBRIDGE_ADVERTISE_DEFAULT_TXT = ['txtvers=1', 'path=/'];
/** Default alias host label, given up on conflict. */
export const MATTERBRIDGE_ADVERTISE_DEFAULT_ALIAS = 'matterbridge';
/** Options for the Matterbridge frontend advertiser. */
export type MatterbridgeAdvertiseOptions = Partial<MdnsResponderOptions>;

/** Advertises the Matterbridge frontend using the shared mDNS responder. */
export class MatterbridgeAdvertise extends MdnsResponder {
  /**
   * Creates a frontend advertiser with Matterbridge service and naming defaults.
   *
   * @param {MatterbridgeAdvertiseOptions} [options] - Overrides for the frontend advertisement.
   * @throws {Error} If no usable interface exists or an option is invalid.
   */
  constructor(options: MatterbridgeAdvertiseOptions = {}) {
    const interfaceName = options.interfaceName ?? MatterbridgeAdvertise.findInterfaceName();
    if (!interfaceName || !os.networkInterfaces()[interfaceName]) throw new Error(`MatterbridgeAdvertise: network interface ${interfaceName ?? '(none found)'} not available`);
    const id = MatterbridgeAdvertise.interfaceId(interfaceName);
    // RFC 6763 §6.7 recommends a profile version tag first; the frontend profile also supplies its HTTP path.
    // RFC 6762 §9 handles conflicts in the base responder; the optional friendly alias is expendable.
    super({
      ...options,
      interfaceName,
      port: options.port ?? MATTERBRIDGE_ADVERTISE_DEFAULT_PORT,
      hostName: options.hostName ?? `matterbridge-${id}`,
      instanceName: options.instanceName ?? `Matterbridge ${id.slice(-6)}`,
      services: options.services ?? MATTERBRIDGE_ADVERTISE_DEFAULT_SERVICES,
      txt: options.txt ?? MATTERBRIDGE_ADVERTISE_DEFAULT_TXT,
      alias: options.alias ?? MATTERBRIDGE_ADVERTISE_DEFAULT_ALIAS,
    });
  }

  /**
   * Finds the first external interface that is not excluded.
   *
   * @returns {string | undefined} The interface name.
   */
  private static findInterfaceName(): string | undefined {
    for (const [name, infos] of Object.entries(os.networkInterfaces())) {
      if (excludedInterfaceNamePattern.test(name)) continue;
      if (infos?.some((info) => !info.internal)) return name;
    }
    return undefined;
  }

  /**
   * Returns the 12 uppercase hex digits of the interface MAC address, or of a hash of the host name when the MAC is missing or hidden.
   *
   * @param {string} interfaceName - The interface name.
   * @returns {string} The id.
   */
  private static interfaceId(interfaceName: string): string {
    const placeholders = new Set(['00:00:00:00:00:00', '02:00:00:00:00:00']); // Missing or hidden (privacy) MAC addresses
    const mac = os.networkInterfaces()[interfaceName]?.find((info) => !placeholders.has(info.mac))?.mac;
    if (mac) return mac.replaceAll(':', '').toUpperCase();
    return createHash('sha256').update(os.hostname()).digest('hex').slice(0, 12).toUpperCase();
  }
}

/** The help of the `mdns-advertise` bin. */
export const MATTERBRIDGE_ADVERTISE_HELP = `Usage: mdns-advertise [options]

Advertises matterbridge with mDNS and DNS-SD over IPv4 and IPv6 (RFC 6762, RFC 6763).
Stop it with Ctrl+C: it sends the goodbyes before exiting.

Options:
  --interface <name>         Network interface to advertise on (default: the first external interface)
  --port <port>              Service port in the SRV records (default: ${MATTERBRIDGE_ADVERTISE_DEFAULT_PORT})
  --hostname <label>         Host label, without .local (default: matterbridge-<MAC of the interface>)
  --alias <label>            Alias host label, given up on conflict (default: ${MATTERBRIDGE_ADVERTISE_DEFAULT_ALIAS})
  --no-alias                 Do not claim an alias
  --instance <name>          Service instance name (default: Matterbridge <last 6 hex digits of the MAC>)
  --service <type>           Service type, as _service._tcp or _service._udp; repeat it for more services
                             (default: ${MATTERBRIDGE_ADVERTISE_DEFAULT_SERVICES.join(', ')})
  --txt <key=value>          TXT entry; repeat it for more entries (default: ${MATTERBRIDGE_ADVERTISE_DEFAULT_TXT.join(' ')})
  --address-check <seconds>  Seconds between two checks of the interface addresses, 0 disables them (default: ${MDNS_ADVERTISE_DEFAULT_ADDRESS_CHECK_MS / 1000})
  --no-ipv4                  Do not advertise on IPv4 (224.0.0.251)
  --no-ipv6                  Do not advertise on IPv6 (ff02::fb)
  --debug                    Log at debug level
  -h, --help                 Show this help
`;

/**
 * Prints a command line error and sets the exit code.
 *
 * @param {string} message - The error message.
 * @returns {undefined} Nothing, so the caller can return it.
 */
function commandLineError(message: string): undefined {
  // oxlint-disable-next-line no-console
  console.error(`mdns-advertise: ${message}\nRun mdns-advertise --help to see the options.`);
  process.exitCode = 2;
}

/**
 * Runs the advertiser from a terminal until SIGINT or SIGTERM, then sends the goodbyes.
 * It is the `mdns-advertise` bin: see {@link MATTERBRIDGE_ADVERTISE_HELP} for the options.
 *
 * @param {string[]} argv - The arguments after the script name.
 * @param {MatterbridgeAdvertiseOptions} [options] - Extra options, used by the tests.
 * @returns {Promise<MatterbridgeAdvertise | undefined>} The advertiser once its records have been announced, or undefined after the help or a command line error.
 */
export async function runMatterbridgeAdvertise(argv: string[], options: MatterbridgeAdvertiseOptions = {}): Promise<MatterbridgeAdvertise | undefined> {
  const config = {
    args: argv,
    options: {
      'interface': { type: 'string' },
      'port': { type: 'string' },
      'hostname': { type: 'string' },
      'alias': { type: 'string' },
      'no-alias': { type: 'boolean' },
      'instance': { type: 'string' },
      'service': { type: 'string', multiple: true },
      'txt': { type: 'string', multiple: true },
      'address-check': { type: 'string' },
      'no-ipv4': { type: 'boolean' },
      'no-ipv6': { type: 'boolean' },
      'debug': { type: 'boolean' },
      'help': { type: 'boolean', short: 'h' },
    },
  } as const;
  let values: ReturnType<typeof parseArgs<typeof config>>['values'];
  try {
    ({ values } = parseArgs(config));
  } catch (error) {
    return commandLineError(getErrorMessage(error));
  }
  if (values.help) {
    // oxlint-disable-next-line no-console
    console.log(MATTERBRIDGE_ADVERTISE_HELP);
    return undefined;
  }
  const addressCheck = values['address-check'] === undefined ? undefined : Number(values['address-check']);
  if (addressCheck !== undefined && (!Number.isFinite(addressCheck) || addressCheck < 0)) return commandLineError(`invalid --address-check ${values['address-check']}`);
  let advertiser: MatterbridgeAdvertise;
  try {
    advertiser = new MatterbridgeAdvertise({
      interfaceName: values.interface,
      port: values.port === undefined ? undefined : Number(values.port),
      hostName: values.hostname,
      alias: values['no-alias'] === true ? false : values.alias,
      instanceName: values.instance,
      services: values.service,
      txt: values.txt,
      addressCheckIntervalMs: addressCheck === undefined ? undefined : addressCheck * 1000,
      enableIpv4: values['no-ipv4'] !== true,
      enableIpv6: values['no-ipv6'] !== true,
      ...options,
    });
  } catch (error) {
    return commandLineError(getErrorMessage(error));
  }
  if (values.debug === true) advertiser.log.logLevel = LogLevel.DEBUG;
  const shutdown = (): void => void advertiser.stop();
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  await advertiser.start();
  return advertiser;
}
