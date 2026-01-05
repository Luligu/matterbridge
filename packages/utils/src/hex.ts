/**
 * This file contains the hex functions.
 *
 * @file hex.ts
 * @author Luca Liguori
 * @created 2025-05-06
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

import { createPublicKey, createPrivateKey, X509Certificate } from 'node:crypto';

/**
 * Converts an ArrayBuffer or Uint8Array to a hexadecimal string.
 *
 * Accepts any {ArrayBufferLike} input: a raw ArrayBuffer (binary data storage) or
 * a Uint8Array (TypedArray view over an ArrayBuffer). While an ArrayBuffer holds
 * the raw memory, a Uint8Array is a typed view into that memory, letting you access
 * its bytes directly. This function normalizes both by creating a Uint8Array view
 * before conversion.
 *
 * @param {ArrayBufferLike} buffer - The buffer or typed-array view to convert.
 * @returns {string} A lowercase hex string representation of the buffer's bytes.
 *
 * @throws {TypeError} If the input is not an ArrayBuffer or ArrayBufferView.
 */
export function bufferToHex(buffer: ArrayBufferLike): string {
  // Check if the input is an ArrayBuffer or ArrayBufferView
  if (!(buffer instanceof ArrayBuffer || ArrayBuffer.isView(buffer))) {
    throw new TypeError('Expected input to be an ArrayBuffer or ArrayBufferView');
  }

  // Create a Uint8Array view over the buffer
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  // Convert each byte to 2-digit hex
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Converts a hexadecimal string to a Uint8Array.
 *
 * @param {string} hex - The hex string to convert. Can include uppercase or lowercase characters.
 * @returns {Uint8Array} A Uint8Array representing the corresponding binary data.
 *
 * @throws {TypeError} If the input is not a string.
 * @throws {Error} If the input length is odd or contains non-hex characters.
 */
export function hexToBuffer(hex: string): Uint8Array {
  // Ensure the input is a string
  if (typeof hex !== 'string') {
    throw new TypeError('Expected a string for hex input');
  }

  // Trim any whitespace from the input string
  const cleaned = hex.trim();

  // Check if the length of the hex string is even
  if (cleaned.length % 2 !== 0) {
    throw new Error('Invalid hex string length, must be even');
  }

  // Validate that the string contains only valid hex characters
  if (!/^[0-9a-fA-F]*$/.test(cleaned)) {
    throw new Error('Invalid hex string, contains non-hex characters');
  }

  // Calculate the length of the resulting Uint8Array
  const length = cleaned.length / 2;

  // Create a Uint8Array to hold the binary data
  const result = new Uint8Array(length);

  // Convert each pair of hex characters into a byte
  for (let i = 0; i < length; i++) {
    result[i] = parseInt(cleaned.substr(i * 2, 2), 16);
  }

  // Return the resulting Uint8Array
  return result;
}

/**
 * Converts a PEM (Privacy-Enhanced Mail) formatted string to a Uint8Array.
 *
 * PEM format is a base64-encoded format commonly used for cryptographic keys and certificates,
 * wrapped with header and footer lines like "-----BEGIN CERTIFICATE-----" and "-----END CERTIFICATE-----".
 * This function extracts the base64 content and converts it to binary data using Node.js Buffer API.
 *
 * @param {string} pem - The PEM formatted string to convert.
 * @param {boolean} validate - Whether to validate the PEM content using Node.js crypto module. Default is false.
 * @returns {Uint8Array} A Uint8Array representing the decoded binary data.
 *
 * @throws {TypeError} If the input is not a string.
 * @throws {Error} If the PEM format is invalid, contains invalid base64 characters, or validation fails.
 */
export function pemToBuffer(pem: string, validate: boolean = false): Uint8Array {
  // Ensure the input is a string
  if (typeof pem !== 'string') {
    throw new TypeError('Expected a string for PEM input');
  }

  // Trim whitespace from the input
  const cleaned = pem.trim();

  // Check if the string appears to be in PEM format
  if (!cleaned.includes('-----BEGIN') || !cleaned.includes('-----END')) {
    throw new Error('Invalid PEM format: missing BEGIN/END markers');
  }

  // Extract the base64 content between the header and footer
  const lines = cleaned.split('\n');
  const base64Lines: string[] = [];
  let inContent = false;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith('-----BEGIN')) {
      inContent = true;
      continue;
    }

    if (trimmedLine.startsWith('-----END')) {
      inContent = false;
      break;
    }

    if (inContent && trimmedLine.length > 0) {
      base64Lines.push(trimmedLine);
    }
  }

  if (base64Lines.length === 0) {
    throw new Error('Invalid PEM format: no content found between BEGIN/END markers');
  }

  // Join all base64 lines together
  const base64String = base64Lines.join('');

  // Validate base64 string format
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64String)) {
    throw new Error('Invalid PEM format: contains invalid base64 characters');
  }

  try {
    // Use Node.js Buffer API instead of legacy atob()
    const buffer = Buffer.from(base64String, 'base64');

    // Convert Buffer to Uint8Array
    const result = new Uint8Array(buffer);

    // Validate PEM content using Node.js crypto module if requested
    if (validate) {
      try {
        // Determine PEM type from the header and validate accordingly
        const pemType = cleaned.match(/-----BEGIN\s+([^-]+)-----/)?.[1]?.trim();

        if (pemType?.includes('CERTIFICATE')) {
          // Use X509Certificate for robust certificate validation
          const cert = new X509Certificate(pem);
          // Check validity period
          if (cert.validFrom && cert.validTo) {
            const now = Date.now();
            const from = Date.parse(cert.validFrom);
            const to = Date.parse(cert.validTo);
            // istanbul ignore next if
            if (now < from || now > to) {
              throw new Error('Certificate is not currently valid');
            }
          }
          // Check subject/issuer fields
          // istanbul ignore next if
          if (!cert.subject || !cert.issuer) {
            throw new Error('Certificate missing subject or issuer');
          }
          // Optionally check signature (not possible without CA chain)
        } else if (pemType?.includes('PRIVATE KEY')) {
          // For private keys, try to create a private key
          createPrivateKey({ key: pem, format: 'pem' });
        } else if (pemType?.includes('PUBLIC KEY')) {
          // For public keys, try to create a public key
          createPublicKey({ key: pem, format: 'pem' });
        }
        // If no specific type is detected, skip validation
      } catch (validationError) {
        // istanbul ignore next
        throw new Error(`PEM validation failed: ${validationError instanceof Error ? validationError.message : String(validationError)}`);
      }
    }

    return result;
  } catch (error) {
    // istanbul ignore next
    throw new Error(`Failed to decode base64 content: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extracts the raw 32-byte private key scalar from an EC private key PEM.
 *
 * This function parses an EC private key in PEM format and extracts the raw
 * 32-byte private scalar (the "d" value) used in elliptic curve cryptography.
 * This is the actual secret key material.
 *
 * @param {string} pemPrivateKey - The EC private key in PEM format
 * @returns {Uint8Array} The raw 32-byte private key scalar
 * @throws {Error} If the input is not a valid EC private key PEM
 *
 * @example
 * ```typescript
 * const pemKey = `-----BEGIN EC PRIVATE KEY-----
 * MHcCAQEEIFBxqFkUxMoN2JkUXLFeiZnLNUpftjLi0sKMbZ6uajHXoAoGCCqGSM49
 * AwEHoUQDQgAEcJ3eH/rG3zf9WmqMjh5eBSkeXz3Cb4Fig1rTosfHmgyjx/WnLPEe
 * BF4SHvLo0G2COJEHa/VDE5EiKWO9ZR6AOQ==
 * -----END EC PRIVATE KEY-----`;
 *
 * const rawKey = extractPrivateKeyRaw(pemKey);
 * console.log(rawKey.length); // 32
 * console.log(bufferToHex(rawKey)); // hex representation of the private scalar
 * ```
 */
export function extractPrivateKeyRaw(pemPrivateKey: string): Uint8Array {
  if (typeof pemPrivateKey !== 'string') {
    throw new TypeError('Expected a string for PEM private key input');
  }

  // Extract the private key block
  const keyBlock = /-----BEGIN (?:EC )?PRIVATE KEY-----[^-]+-----END (?:EC )?PRIVATE KEY-----/s.exec(pemPrivateKey);
  if (!keyBlock) {
    throw new Error('No EC PRIVATE KEY block found in the supplied PEM');
  }

  try {
    // Create a private key object
    const privateKey = createPrivateKey(keyBlock[0]);

    // Export as PKCS#8 DER format
    const pkcs8Der = privateKey.export({ format: 'der', type: 'pkcs8' }) as Buffer;

    // For P-256 curves, the private scalar is the last 32 bytes of the PKCS#8 DER
    // istanbul ignore next
    if (pkcs8Der.length < 32) {
      throw new Error('Invalid private key: DER data too short');
    }

    // Extract the last 32 bytes which contain the raw private scalar
    const rawPrivateKey = pkcs8Der.subarray(pkcs8Der.length - 32);

    return new Uint8Array(rawPrivateKey);
  } catch (error) {
    // istanbul ignore next
    throw new Error(`Failed to extract private key: ${error instanceof Error ? error.message : String(error)}`);
  }
}
