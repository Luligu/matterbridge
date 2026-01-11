/**
 * @description This file contains the class Coap.
 * @file src/dgram/coap.ts
 * @author Luca Liguori
 * @created 2025-03-22
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

// Node.js imports
import dgram from 'node:dgram';

// AnsiLogger imports
import { BLUE, db, GREEN, MAGENTA, nf } from 'node-ansi-logger';

// Net imports
import { COAP_MULTICAST_IPV4_ADDRESS, COAP_MULTICAST_PORT, Multicast } from './multicast.js';

/**
 * Represents a CoAP message.
 *
 * A CoAP message is structured with a fixed header, an optional token, a series of options,
 * and an optional payload. The header consists of version, type, token length, code, and message ID.
 * The token is used to match responses with requests, options provide additional metadata, and
 * the payload carries the message content.
 */
export interface CoapMessage {
  /**
   * The CoAP protocol version.
   * Typically, this is 1.
   * (Stored in the top 2 bits of the first header byte.)
   */
  version: number;
  /**
   * The message type.
   * It indicates whether the message is Confirmable, Non-confirmable, Acknowledgement, or Reset.
   * (Stored in bits 5-4 of the first header byte.)
   * 0: Confirmable (CON)
   * 1: Non-confirmable (NON)
   * 2: Acknowledgement (ACK)
   * 3: Reset (RST)
   */
  type: number;
  /**
   * The token length.
   * This value (0-8) specifies the length of the token field.
   * (Stored in the lower 4 bits of the first header byte.)
   */
  tokenLength: number;
  /**
   * The message code.
   * It indicates the method or response code, e.g., GET, POST, or a success/error response.
   * (Stored in the second header byte.)
   * CoAP uses an 8‑bit Code field divided into a 3‑bit class and a 5‑bit detail. The code can be represented as X.XX (e.g. 0.01) and is defined in RFC 7252. Here are the standard CoAP codes:
   * Request Codes (Class 0)
   * 0.01 – 1-GET
   * Retrieve a resource.
   * 0.02 – 2-POST
   * Create a resource or trigger an action.
   * 0.03 – 3-PUT
   * Update or create a resource.
   * 0.04 – 4-DELETE
   * Remove a resource.
   * Success Response Codes (Class 2)
   * 2.00 – Empty / Success
   * Indicates an empty message or a successful request with no payload.
   * 2.01 – Created
   * The request resulted in a new resource being created.
   * 2.02 – Deleted
   * The resource was successfully deleted.
   * 2.03 – Valid
   * The response indicates that the resource is still valid (used with caching).
   * 2.04 – Changed
   * The resource was successfully modified.
   * 2.05 – Content
   * The response contains the requested content.
   * Client Error Response Codes (Class 4)
   * 4.00 – Bad Request
   * The request was malformed.
   * 4.01 – Unauthorized
   * The request requires authentication.
   * 4.02 – Bad Option
   * An option in the request was not understood or is unacceptable.
   * 4.03 – Forbidden
   * The server refuses to fulfill the request.
   * 4.04 – Not Found
   * The requested resource was not found.
   * 4.05 – Method Not Allowed
   * The request method is not supported for the target resource.
   * 4.06 – Not Acceptable
   * The server cannot generate a response matching the list of acceptable values.
   * 4.12 – Precondition Failed
   * A precondition given in the request evaluated to false.
   * 4.13 – Request Entity Too Large
   * The request payload is too large.
   * 4.15 – Unsupported Content-Format
   * The server does not support the content format of the request payload.
   * Server Error Response Codes (Class 5)
   * 5.00 – Internal Server Error
   * The server encountered an unexpected condition.
   * 5.01 – Not Implemented
   * The server does not support the requested method.
   * 5.02 – Bad Gateway
   * The server, while acting as a gateway or proxy, received an invalid response.
   * 5.03 – Service Unavailable
   * The server is currently unable to handle the request.
   * 5.04 – Gateway Timeout
   * The server did not receive a timely response from an upstream server.
   * 5.05 – Proxying Not Supported
   * The server does not support proxying for the requested resource.
   */
  code: number;
  /**
   * The message identifier.
   * This 16-bit field is used to match messages of type Acknowledgement/Reset with their corresponding requests.
   * (Stored in bytes 2-3 of the header.)
   */
  messageId: number;
  /**
   * The token.
   * A variable-length sequence (0-8 bytes) that helps match a request with its response.
   */
  token: Buffer;
  /**
   * An array of options.
   * Options carry additional information such as URI path, content format, etc., and are encoded using a delta mechanism.
   */
  options: CoapOption[];
  /**
   * The payload.
   * The actual content of the message, if present. It follows a payload marker (0xFF) if non-empty.
   */
  payload?: Buffer;
}

interface CoapOption {
  number: number;
  value: Buffer;
}

export const COAP_OPTION_URI_PATH = 11;
export const COIOT_OPTION_DEVID = 3332;
export const COIOT_OPTION_VALIDITY = 3412;
export const COIOT_OPTION_SERIAL = 3420;
export const COIOT_REQUEST_STATUS_ID = 56831;
export const COIOT_REQUEST_DESCRIPTION_ID = 56832;

export class Coap extends Multicast {
  constructor(
    name: string,
    multicastAddress: string,
    multicastPort: number,
    socketType: 'udp4' | 'udp6',
    reuseAddr: boolean | undefined = true,
    interfaceName?: string,
    interfaceAddress?: string,
  ) {
    super(name, multicastAddress, multicastPort, socketType, reuseAddr, interfaceName, interfaceAddress);
  }

  onCoapMessage(message: CoapMessage, rinfo: dgram.RemoteInfo): void {
    this.log.debug(`Coap message received from ${BLUE}${rinfo.family}${db} ${BLUE}${rinfo.address}${db}:${BLUE}${rinfo.port}${db}`);
  }

  override onMessage(msg: Buffer, rinfo: dgram.RemoteInfo): void {
    this.log.info(`Dgram multicast socket received a CoAP message from ${BLUE}${rinfo.family}${nf} ${BLUE}${rinfo.address}${nf}:${BLUE}${rinfo.port}${nf}`);
    try {
      const result = this.decodeCoapMessage(msg);
      this.onCoapMessage(result, rinfo);
      this.logCoapMessage(result);
    } catch (error) {
      this.log.error(`Error decoding CoAP message: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Decodes a CoAP message from a Buffer.
   *
   * @param {Buffer} msg - The Buffer containing the raw CoAP message.
   * @returns {CoapMessage} A parsed CoAP message object.
   * @throws {Error} if the message is malformed.
   */
  decodeCoapMessage(msg: Buffer): CoapMessage {
    // A valid CoAP message must have at least 4 bytes for the header.
    if (msg.length < 4) {
      throw new Error('Message too short to be a valid CoAP message');
    }

    // Parse the 4-byte fixed header.
    const version = (msg[0] & 0xc0) >> 6; // Bits 7-6: Version
    const type = (msg[0] & 0x30) >> 4; // Bits 5-4: Type
    const tokenLength = msg[0] & 0x0f; // Bits 3-0: Token Length
    const code = msg[1]; // 8-bit Code
    const messageId = msg.readUInt16BE(2); // 16-bit Message ID

    let offset = 4;

    // Parse token if present.
    let token = Buffer.alloc(0);
    if (tokenLength > 0) {
      if (msg.length < offset + tokenLength) {
        throw new Error('Message too short for the token length specified');
      }
      token = msg.slice(offset, offset + tokenLength);
      offset += tokenLength;
    }

    // Parse options.
    const options: CoapOption[] = [];
    let currentOptionNumber = 0;

    while (offset < msg.length) {
      // Payload marker: 0xFF indicates the beginning of the payload.
      if (msg[offset] === 0xff) {
        offset++; // Skip the marker.
        break;
      }

      // Read the option header byte.
      const optionHeader = msg[offset++];
      let delta = (optionHeader & 0xf0) >> 4; // High nibble: option delta.
      let length = optionHeader & 0x0f; // Low nibble: option length.

      // Extended delta handling.
      if (delta === 13) {
        if (offset >= msg.length) {
          throw new Error('Invalid extended option delta');
        }
        delta = msg[offset++] + 13;
      } else if (delta === 14) {
        if (offset + 1 >= msg.length) {
          throw new Error('Invalid extended option delta');
        }
        delta = msg.readUInt16BE(offset) + 269;
        offset += 2;
      } else if (delta === 15) {
        throw new Error('Reserved option delta value encountered');
      }

      // Extended length handling.
      if (length === 13) {
        if (offset >= msg.length) {
          throw new Error('Invalid extended option length');
        }
        length = msg[offset++] + 13;
      } else if (length === 14) {
        if (offset + 1 >= msg.length) {
          throw new Error('Invalid extended option length');
        }
        length = msg.readUInt16BE(offset) + 269;
        offset += 2;
      } else if (length === 15) {
        throw new Error('Reserved option length value encountered');
      }

      // Calculate the actual option number.
      currentOptionNumber += delta;

      // Ensure that the option's value fits in the remaining message.
      if (offset + length > msg.length) {
        throw new Error('Option length exceeds message length');
      }
      const optionValue = msg.slice(offset, offset + length);
      offset += length;

      options.push({
        number: currentOptionNumber,
        value: optionValue,
      });
    }

    // Parse payload if any remains.
    const payload = offset < msg.length ? msg.slice(offset) : undefined;

    return {
      version,
      type,
      tokenLength,
      code,
      messageId,
      token,
      options,
      payload,
    };
  }

  /**
   * Encodes a CoAP message into a Buffer.
   *
   * @param {CoapMessage} msg - The CoAP message to encode.
   * @returns {Buffer} A Buffer representing the encoded CoAP message.
   * @throws {Error} if the message is malformed.
   */
  encodeCoapMessage(msg: CoapMessage): Buffer {
    const parts: Buffer[] = [];

    // Determine token length (ensure it's consistent with msg.token)
    const token = msg.token || Buffer.alloc(0);
    const tokenLength = token.length;
    if (tokenLength > 8) {
      throw new Error('Token length cannot exceed 8 bytes');
    }

    // Create header (4 bytes):
    //   Byte 0: Version (2 bits), Type (2 bits), Token Length (4 bits)
    //   Byte 1: Code (8 bits)
    //   Bytes 2-3: Message ID (16 bits)
    const header = Buffer.alloc(4);
    header[0] = ((msg.version & 0x03) << 6) | ((msg.type & 0x03) << 4) | (tokenLength & 0x0f);
    header[1] = msg.code;
    header.writeUInt16BE(msg.messageId, 2);
    parts.push(header);

    // Append token if present.
    if (tokenLength > 0) {
      parts.push(token);
    }

    // Sort options by option number in ascending order.
    const sortedOptions = msg.options.slice().sort((a, b) => a.number - b.number);
    let previousOptionNumber = 0;

    // Encode each option.
    for (const option of sortedOptions) {
      const optionDelta = option.number - previousOptionNumber;
      const optionValueLength = option.value.length;
      let deltaNibble: number;
      let deltaExtended: Buffer | null = null;
      let lengthNibble: number;
      let lengthExtended: Buffer | null = null;

      // Determine option delta nibble and extended delta field.
      if (optionDelta < 13) {
        deltaNibble = optionDelta;
      } else if (optionDelta < 269) {
        deltaNibble = 13;
        deltaExtended = Buffer.from([optionDelta - 13]);
      } else {
        deltaNibble = 14;
        deltaExtended = Buffer.alloc(2);
        deltaExtended.writeUInt16BE(optionDelta - 269, 0);
      }

      // Determine option length nibble and extended length field.
      if (optionValueLength < 13) {
        lengthNibble = optionValueLength;
      } else if (optionValueLength < 269) {
        lengthNibble = 13;
        lengthExtended = Buffer.from([optionValueLength - 13]);
      } else {
        lengthNibble = 14;
        lengthExtended = Buffer.alloc(2);
        lengthExtended.writeUInt16BE(optionValueLength - 269, 0);
      }

      // Option header byte: high nibble is delta, low nibble is length.
      const optionHeader = Buffer.alloc(1);
      optionHeader[0] = (deltaNibble << 4) | (lengthNibble & 0x0f);
      parts.push(optionHeader);

      // Append extended delta if needed.
      if (deltaExtended) {
        parts.push(deltaExtended);
      }

      // Append extended length if needed.
      if (lengthExtended) {
        parts.push(lengthExtended);
      }

      // Append the option value.
      parts.push(option.value);

      // Update previous option number.
      previousOptionNumber = option.number;
    }

    // If a payload is present, add the payload marker (0xFF) followed by the payload.
    if (msg.payload && msg.payload.length > 0) {
      parts.push(Buffer.from([0xff])); // Payload marker.
      parts.push(msg.payload);
    }

    return Buffer.concat(parts);
  }

  /**
   * Converts a CoAP message type numeric value to its string representation.
   *
   * CoAP message types are:
   *  - 0: Confirmable (CON)
   *  - 1: Non-confirmable (NON)
   *  - 2: Acknowledgement (ACK)
   *  - 3: Reset (RST)
   *
   * @param {number} type - The numeric CoAP message type.
   * @returns {string} The string representation of the message type.
   */
  coapTypeToString(type: number): string {
    switch (type) {
      case 0:
        return 'Confirmable (CON)';
      case 1:
        return 'Non-confirmable (NON)';
      case 2:
        return 'Acknowledgement (ACK)';
      case 3:
        return 'Reset (RST)';
      default:
        return `Unknown Type (${type})`;
    }
  }

  /**
   * Converts a CoAP code numeric value to its string representation.
   *
   * The CoAP code is split into a 3-bit class and a 5-bit detail.
   * For example:
   *   - 0.01: GET
   *   - 0.02: POST
   *   - 0.03: PUT
   *   - 0.04: DELETE
   *   - 2.05: Content (success response)
   *   - 4.04: Not Found (client error)
   *   - 5.00: Internal Server Error (server error)
   *
   * @param {number} code - The numeric CoAP code.
   * @returns {string} The string representation of the code.
   */
  coapCodeToString(code: number): string {
    // Split the code: the upper 3 bits form the class and the lower 5 bits form the detail.
    const cls = code >> 5;
    const detail = code & 0x1f;
    const codeStr = `${cls}.${detail.toString().padStart(2, '0')}`;
    return codeStr;
  }

  sendRequest(
    messageId: number,
    options: CoapOption[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload: Record<string, any> | undefined,
    token: string | undefined,
    address: string | undefined,
    port: number | undefined,
  ): void {
    const coapMessage: CoapMessage = {
      version: 1,
      type: 1, // e.g., Confirmable
      tokenLength: token ? Buffer.from(token).length : 0,
      code: 1, // e.g., GET
      messageId,
      token: token ? Buffer.from(token) : Buffer.alloc(0),
      options,
      payload: payload ? Buffer.from(JSON.stringify(payload)) : undefined,
    };
    const encodedBuffer = this.encodeCoapMessage(coapMessage);
    this.send(encodedBuffer, address ?? COAP_MULTICAST_IPV4_ADDRESS, port ?? COAP_MULTICAST_PORT);
  }

  logCoapMessage(msg: CoapMessage) {
    this.log.info(
      `Decoded CoAP message: version ${MAGENTA}${msg.version}${nf} type ${MAGENTA}${this.coapTypeToString(msg.type)}${nf} ` +
        `code ${MAGENTA}${this.coapCodeToString(msg.code)}${nf} messageId ${MAGENTA}${msg.messageId}${nf} ` +
        `tokenLength ${MAGENTA}${msg.tokenLength}${nf} token ${MAGENTA}${msg.tokenLength == 0 ? 'no token' : msg.token.toString('hex')}${nf} ` +
        `options ${MAGENTA}${msg.options.length}${nf} payload ${MAGENTA}${msg.payload ? msg.payload.length + ' bytes' : undefined}${nf}`,
    );
    msg.options.forEach((option) => {
      if (option.number === COAP_OPTION_URI_PATH) {
        this.log.info(`Option: COAP_OPTION_URI_PATH => ${GREEN}${option.value}${nf}`);
      } else if (option.number === COIOT_OPTION_DEVID) {
        /*
         * First defined option is COIOT_OPTION_GLOBAL_DEVID. This is a global option and must be present in all CoIoT packages with request or payload.
         * Its value is a string in format <devtype>#<devid>#<version> for example SHSEN-1#4B3F9E#1 The whole option should be less than 50 bytes.
         */
        const parts = option.value.toString().split('#');
        const deviceModel = parts[0];
        const deviceMac = parts[1];
        const protocolRevision = parts[2];
        this.log.info(
          `Option: COIOT_OPTION_DEVID => ${option.value} => Model: ${GREEN}${deviceModel}${nf}, MAC: ${GREEN}${deviceMac}${nf}, Protocol: ${GREEN}${protocolRevision}${nf}`,
        );
      } else if (option.number === COIOT_OPTION_SERIAL) {
        /*
         * This option is mandatory in status response and publishes. It is a uint16_t in network byte order which indicates a change in the status report.
         * When a new status report is handled, all payload processing can be skipped if the serial number does not change from the last processed payload.
         * The value 0 is reserved and should not be sent. This allows easy initialization in the receiving devices.
         */
        const serial = option.value.readUInt16BE(0);
        this.log.info(`Option: COIOT_OPTION_SERIAL => 0x${option.value.toString('hex')} => serial: ${GREEN}${serial}${nf}`);
      } else if (option.number === COIOT_OPTION_VALIDITY) {
        /*
         * COIOT_OPTION_STATUS_VALIDITY is a uint16_t in network byte order (big endian) that states the maximal time between this and the next status publish.
         * This way a device can state its report interval. If a report is not received from this device after the interval has passed the device should be considered offline.
         * The LS bit of this option controls how the value is scaled:
         * - If the LS bit is 0, the value is number of 1/10 of seconds in the validity period, so 2 is 0.2 seconds, 10 is a second, 600 is a minute, 65534 is 109 minutes and 13 seconds.
         * - If the LS bit is 1, the value is number of 4 seconds interval in the whole interval. So 3 is 12 seconds, 11 is 44 seconds and 65535 is more than 3 days.
         */
        const validity = option.value.readUInt16BE(0);
        let validFor = 0;
        if ((validity & 0x1) === 0) {
          validFor = Math.floor(validity / 10);
        } else {
          validFor = validity * 4;
        }
        this.log.info(`Option: COIOT_OPTION_VALIDITY => 0x${option.value.toString('hex')} => valid for: ${GREEN}${validFor}${nf} seconds`);
      } else
        this.log.info(
          `Option: ${option.number} - ${option.value
            .toString('hex')
            .match(/.{1,2}/g)
            ?.join(' ')}`,
        ); // Split into pairs of hex characters
    });
    if (msg.payload && msg.payload.length > 0) this.log.info(`Payload:`, JSON.parse(msg.payload.toString()), '\n');
    else this.log.info(`No payload`, '\n');
  }
}
