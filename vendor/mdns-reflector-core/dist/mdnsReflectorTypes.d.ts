/**
 * @description This file contains the definitions for the mDNS reflector classes.
 * @file src/dgram/mdnsReflectorTypes.ts
 * @author Luca Liguori
 * @created 2025-12-25
 * @version 1.0.0
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
export declare const MDNS_REFLECTOR_BIND_ADDRESS_IPV4 = "0.0.0.0";
export declare const MDNS_REFLECTOR_BIND_ADDRESS_IPV6 = "::";
export declare const MDNS_REFLECTOR_ADDRESS = "localhost";
export declare const MDNS_REFLECTOR_HOST_DOCKER = "host.docker.internal";
export declare const MDNS_REFLECTOR_PORT = 15353;
export declare enum MessageType {
    Ping = 0,
    Pong = 1,
    Hello = 2,
    Goodbye = 3,
    Mdns = 4
}
export interface ReflectorMessage {
    magic: number;
    version: string;
    timestamp: number;
    type: MessageType;
    payload: Buffer;
}
/**
 * Returns true if the provided buffer looks like a valid reflector message.
 *
 * Validation rules are:
 * - Minimum header size
 * - Magic marker
 * - Reserved byte must be 0
 * - Message type must be within the known range
 * - Major and minor must match (patch is allowed to differ)
 *
 * @param { Buffer } buffer - The buffer to check.
 * @returns { boolean } True if the buffer is a valid reflector message, false otherwise.
 */
export declare function isReflector(buffer: Buffer): boolean;
/**
 * Encodes a ReflectorMessage into a Buffer.
 *
 * @param {MessageType} type - The type of the message.
 * @param {Buffer} payload - The payload of the message.
 * @returns {Buffer} The encoded message as a Buffer.
 */
export declare function encode(type: MessageType, payload: Buffer): Buffer;
/**
 *  Decodes a Buffer into a ReflectorMessage.
 *
 * @param {Buffer} buffer - The buffer to decode.
 * @returns  {ReflectorMessage | null} The decoded message, or null if the buffer is invalid.
 */
export declare function decode(buffer: Buffer): ReflectorMessage | null;
//# sourceMappingURL=mdnsReflectorTypes.d.ts.map