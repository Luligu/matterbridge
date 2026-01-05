/**
 * @description This file contains the class MdnsReflectorClient.
 * @file src/dgram/mdnsReflectorClient.ts
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
import { AnsiLogger } from 'node-ansi-logger';
import { Mdns, Unicast } from 'mb-lib-dgram';
type RecentCache = Map<string, number>;
/**
 * Options for configuring an {@link MdnsReflectorClient} instance.
 */
export interface MdnsReflectorClientOptions {
    verbose?: boolean;
    debug?: boolean;
    silent?: boolean;
    localhost?: boolean;
    interfaceName?: string;
    filter?: string[];
}
export declare class MdnsReflectorClient {
    options: MdnsReflectorClientOptions;
    log: AnsiLogger;
    mdnsIpv4: Mdns;
    mdnsIpv6: Mdns;
    unicastIpv4: Unicast;
    unicastIpv6: Unicast;
    reflectedIpv4: RecentCache;
    reflectedIpv6: RecentCache;
    TTL_MS: number;
    /**
     * Creates an instance of MdnsReflectorClient.
     *
     * @param {MdnsReflectorClientOptions} [options] - Optional configuration values. Missing fields use defaults.
     *
     * @remarks
     * The MdnsReflectorClient must run inside a Docker container.
     * The MdnsReflectorClient sends mDNS messages from the container to the MdnsReflectorServer running on the host machine.
     * The MdnsReflectorClient also reflects mDNS messages from the MdnsReflectorServer to the container.
     * Parameters:
     * --filter <string[]> - filters to apply to incoming mDNS messages.
     * --localhost - use localhost addresses to send messages to the container.
     */
    constructor(options?: MdnsReflectorClientOptions);
    /**
     * Generates a fingerprint for a given buffer using SHA1 hash.
     *
     * @param {Buffer} buf - The buffer to generate the fingerprint for.
     * @returns {string} The SHA1 hash of the buffer as a hexadecimal string.
     */
    fingerprint(buf: Buffer): string;
    /**
     * Remembers a key in the cache with a time-to-live (TTL).
     *
     * @param {RecentCache} cache - The cache to store the key in.
     * @param {string} key - The key to remember.
     * @param {number} ttlMs - The time-to-live in milliseconds.
     */
    remember(cache: RecentCache, key: string, ttlMs: number): void;
    /**
     * Checks if a key has been seen recently in the cache.
     *
     * @param {RecentCache} cache - The cache to check.
     * @param {string} key - The key to check.
     * @returns {boolean} True if the key has been seen recently, false otherwise.
     */
    seenRecently(cache: RecentCache, key: string): boolean;
    /**
     * Prunes expired entries from the cache and limits its size.
     *
     * @param {RecentCache} cache - The cache to prune.
     */
    prune(cache: RecentCache): void;
    /**
     * Starts the mDNS Reflector Client.
     */
    start(): Promise<void>;
    /**
     * Stops the mDNS Reflector Client.
     */
    stop(): Promise<void>;
}
export {};
//# sourceMappingURL=mdnsReflectorClient.d.ts.map