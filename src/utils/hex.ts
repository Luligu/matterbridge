/**
 * This file contains the hex functions.
 *
 * @file hex.ts
 * @author Luca Liguori
 * @date 2025-05-06
 * @version 1.0.0
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
 * limitations under the License. *
 */

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
