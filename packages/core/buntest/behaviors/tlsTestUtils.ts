/**
 * @file packages/core/buntest/behaviors/tlsTestUtils.ts
 * @description This file contains the test helpers of the TLS Certificate Management and TLS Client Management servers: DER encoded X.509 certificates and CSR decoding.
 * @author Luca Liguori
 */

import { createPublicKey, generateKeyPairSync, type KeyObject, randomBytes, sign, verify } from 'node:crypto';

/** DER encoded AlgorithmIdentifier ecdsa-with-SHA256. */
export const ECDSA_WITH_SHA256 = Buffer.from([0x30, 0x0a, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x04, 0x03, 0x02]);

/** One day in milliseconds. */
export const DAY_MS = 86_400_000;

/**
 * Encodes a DER element.
 *
 * @param {number} tag - The DER tag octet.
 * @param {Buffer} content - The content octets.
 * @returns {Buffer} The DER element.
 */
export function der(tag: number, content: Buffer): Buffer {
  const { length } = content;
  if (length < 0x80) return Buffer.concat([Buffer.from([tag, length]), content]);
  const lengthBytes: number[] = [];
  for (let remaining = length; remaining > 0; remaining = Math.floor(remaining / 256)) lengthBytes.unshift(remaining % 256);
  return Buffer.concat([Buffer.from([tag, 0x80 + lengthBytes.length, ...lengthBytes]), content]);
}

/** A decoded DER element. */
export interface DerElement {
  /** The tag octet. */
  tag: number;
  /** The content octets. */
  content: Buffer;
  /** The whole element, tag and length included. */
  raw: Buffer;
}

/**
 * Decodes the DER elements of a buffer.
 *
 * @param {Buffer} data - The DER encoded elements.
 * @returns {DerElement[]} The decoded elements.
 */
export function derChildren(data: Buffer): DerElement[] {
  const elements: DerElement[] = [];
  let offset = 0;
  while (offset < data.length) {
    const tag = data[offset];
    let length = data[offset + 1];
    let header = 2;
    if (length >= 0x80) {
      const count = length - 0x80;
      length = 0;
      for (let i = 0; i < count; i++) length = length * 256 + data[offset + 2 + i];
      header += count;
    }
    elements.push({ tag, content: data.subarray(offset + header, offset + header + length), raw: data.subarray(offset, offset + header + length) });
    offset += header + length;
  }
  return elements;
}

/**
 * Encodes an X.509 Name with a single common name.
 *
 * @param {string} commonName - The common name.
 * @returns {Buffer} The DER encoded Name.
 */
function name(commonName: string): Buffer {
  return der(0x30, der(0x31, der(0x30, Buffer.concat([Buffer.from([0x06, 0x03, 0x55, 0x04, 0x03]), der(0x0c, Buffer.from(commonName, 'utf8'))]))));
}

/**
 * Encodes a time as an X.509 UTCTime (YYMMDDHHMMSSZ, years 2000 to 2049).
 *
 * @param {number} ms - The time in Unix milliseconds.
 * @returns {Buffer} The DER encoded UTCTime.
 */
function utcTime(ms: number): Buffer {
  const iso = new Date(ms).toISOString();
  return der(0x17, Buffer.from(`${iso.slice(2, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}${iso.slice(11, 13)}${iso.slice(14, 16)}${iso.slice(17, 19)}Z`, 'ascii'));
}

/** Options of {@link createCertificate}. */
export interface CertificateOptions {
  /** The key signing the certificate. Defaults to a new P-256 key. */
  signerKey?: KeyObject;
  /** The public key of the certificate. Defaults to the public key of the signer. */
  publicKey?: KeyObject;
  /** The start of the validity period in Unix milliseconds. Defaults to one day ago. */
  notBefore?: number;
  /** The end of the validity period in Unix milliseconds. Defaults to one year from now. */
  notAfter?: number;
  /** Octets of padding added in a non critical extension, to make the certificate larger. Defaults to none. */
  padding?: number;
}

/**
 * Creates a DER encoded X.509 v3 certificate signed with ecdsa-with-SHA256.
 *
 * @param {CertificateOptions} [options] - The certificate options.
 * @returns {Buffer} The DER encoded certificate.
 */
export function createCertificate(options: CertificateOptions = {}): Buffer {
  const signerKey = options.signerKey ?? generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey;
  const publicKey = options.publicKey ?? createPublicKey(signerKey);
  const notBefore = options.notBefore ?? Date.now() - DAY_MS;
  const notAfter = options.notAfter ?? Date.now() + 365 * DAY_MS;
  // A positive, minimally encoded DER INTEGER serial number: the first octet is 0x01 to 0x7f.
  const serial = randomBytes(8);
  serial[0] = 1 + (serial[0] % 0x7f);
  const commonName = `Test ${randomBytes(6).toString('hex')}`;
  const extensions =
    options.padding === undefined
      ? Buffer.alloc(0)
      : der(0xa3, der(0x30, der(0x30, Buffer.concat([Buffer.from([0x06, 0x03, 0x2a, 0x03, 0x04]), der(0x04, Buffer.alloc(options.padding, 0x55))]))));
  const tbs = der(
    0x30,
    Buffer.concat([
      Buffer.from([0xa0, 0x03, 0x02, 0x01, 0x02]),
      der(0x02, serial),
      ECDSA_WITH_SHA256,
      name(commonName),
      der(0x30, Buffer.concat([utcTime(notBefore), utcTime(notAfter)])),
      name(commonName),
      publicKey.export({ type: 'spki', format: 'der' }),
      extensions,
    ]),
  );
  const signature = sign('sha256', tbs, signerKey);
  return der(0x30, Buffer.concat([tbs, ECDSA_WITH_SHA256, der(0x03, Buffer.concat([Buffer.from([0x00]), signature]))]));
}

/** A decoded PKCS #10 certificate signing request. */
export interface DecodedCsr {
  /** The public key of the request. */
  publicKey: KeyObject;
  /** The DER encoded signature AlgorithmIdentifier. */
  signatureAlgorithm: Buffer;
  /** Whether the signature of the CertificationRequestInfo by the public key is valid. */
  signatureValid: boolean;
}

/**
 * Decodes a DER encoded PKCS #10 certificate signing request and verifies its signature.
 *
 * @param {Uint8Array} csr - The DER encoded CSR.
 * @returns {DecodedCsr} The decoded CSR.
 */
export function decodeCsr(csr: Uint8Array): DecodedCsr {
  const [request] = derChildren(Buffer.from(csr));
  const [requestInfo, signatureAlgorithm, signature] = derChildren(request.content);
  const [, , publicKeyInfo] = derChildren(requestInfo.content);
  const publicKey = createPublicKey({ key: publicKeyInfo.raw, format: 'der', type: 'spki' });
  // The BIT STRING content starts with the number of unused bits.
  const signatureValid = verify('sha256', requestInfo.raw, publicKey, signature.content.subarray(1));
  return { publicKey, signatureAlgorithm: signatureAlgorithm.raw, signatureValid };
}

/**
 * Verifies a raw r || s ECDSA over SHA-256 signature of a ClientCSR nonce.
 *
 * @param {KeyObject} publicKey - The public key of the CSR.
 * @param {Uint8Array} nonce - The nonce.
 * @param {Uint8Array} nonceSignature - The raw signature.
 * @returns {boolean} True if the signature is valid.
 */
export function verifyNonceSignature(publicKey: KeyObject, nonce: Uint8Array, nonceSignature: Uint8Array): boolean {
  return verify('sha256', nonce, { key: publicKey, dsaEncoding: 'ieee-p1363' }, nonceSignature);
}
