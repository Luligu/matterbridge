/**
 * @description This file contains the class MdnsReflectorServer.
 * @file src/dgram/mdnsReflectorServer.ts
 * @author Luca Liguori
 * @created 2025-12-25
 * @version 1.2.0
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
import { RemoteInfo } from 'node:dgram';
import { AnsiLogger } from 'node-ansi-logger';
import { Mdns, Unicast } from 'mb-lib-dgram';
/**
 * Options for configuring an {@link MdnsReflectorServer} instance.
 */
export interface MdnsReflectorServerOptions {
    verbose?: boolean;
    debug?: boolean;
    silent?: boolean;
    broadcast?: boolean;
    localhost?: boolean;
    shareWithClients?: boolean;
    logReflectorMessages?: boolean;
    interfaceName?: string;
    filter?: string[];
}
export declare class MdnsReflectorServer {
    options: MdnsReflectorServerOptions;
    log: AnsiLogger;
    mdnsIpv4: Mdns;
    mdnsIpv6: Mdns;
    unicastIpv4: Unicast;
    unicastIpv6: Unicast;
    ipv4Clients: Map<string, RemoteInfo>;
    ipv6Clients: Map<string, RemoteInfo>;
    /**
     * Creates an instance of MdnsReflectorServer.
     *
     * @param { MdnsReflectorServerOptions } options - Options for configuring the MdnsReflectorServer.
     *
     * @remarks
     * The MdnsReflectorServer must run on the host machine.
     * The MdnsReflectorServer reflects mDNS messages from the lan to the Ipv4 and IPv6 reflector clients running inside Docker containers.
     * The MdnsReflectorServer also reflects mDNS messages from the Ipv4 and IPv6 reflector clients to the lan.
     * The MdnsReflectorServer also upgrades the A and AAAA records from the Docker environment to point to the host machine IP addresses.
     * Parameters:
     * --filter <string[]> - filters to apply to incoming mDNS messages.
     * --broadcast - use broadcast addresses to reflect messages to the lan.
     * --localhost - use localhost addresses to reflect messages to the lan.
     * --share-with-clients - share messages between reflector clients.
     */
    constructor(options?: MdnsReflectorServerOptions);
    /**
     * Get the broadcast address for the given Mdns instance.
     *
     * @param {Mdns} mdns - The Mdns instance.
     * @returns {string | undefined} The broadcast address or undefined if not found.
     */
    getBroadcastAddress(mdns: Mdns): string | undefined;
    /**
     * Decode and upgrade the A and AAAA records from Docker environment to point the host machine.
     * Matterbridge running inside Docker Desktop containers register mDNS records with the container's IP address,
     * which is not reachable from outside the Docker network.
     * To make these services reachable, we need to upgrade the A and AAAA records using the host machine IP addresses.
     * The reflector server runs on the host, while mDNS advertisements come from containers.
     *
     * @param {Buffer<ArrayBufferLike>} msg - The mDNS message buffer.
     * @returns {Buffer<ArrayBufferLike>} The upgraded mDNS message buffer.
     */
    upgradeAddress(msg: Buffer<ArrayBufferLike>): Buffer<ArrayBufferLike>;
    /**
     * Starts the mDNS Reflector Server.
     */
    start(): Promise<void>;
    /**
     * Stops the mDNS Reflector Server.
     */
    stop(): Promise<void>;
}
//# sourceMappingURL=mdnsReflectorServer.d.ts.map