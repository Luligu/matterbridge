// src\utils\hex.test.ts
import { bufferToHex, hexToBuffer, pemToBuffer } from './hex.ts';

describe('bufferToHex()', () => {
  it('throws error for non-ArrayBufferLike input', () => {
    // @ts-expect-error Suppress TypeScript error for testing purpose
    expect(() => bufferToHex('invalid input')).toThrow(TypeError);
  });

  it('should convert an empty buffer to an empty string', () => {
    expect(bufferToHex(new Uint8Array())).toBe('');
  });

  it('should convert a Uint8Array to lowercase hex', () => {
    const arr = new Uint8Array([0, 15, 16, 255]);
    expect(bufferToHex(arr)).toBe('000f10ff');
  });

  it('should work with ArrayBuffer input', () => {
    const buf = new Uint8Array([1, 2, 3, 250]).buffer;
    expect(bufferToHex(buf)).toBe('010203fa');
  });
});

describe('hexToBuffer()', () => {
  it('should throw TypeError if input is not a string', () => {
    expect(() => hexToBuffer(123 as any)).toThrow(TypeError);
    expect(() => hexToBuffer(123 as any)).toThrow('Expected a string for hex input');
  });

  it('should convert an empty string to an empty Uint8Array', () => {
    const out = hexToBuffer('');
    expect(out).toBeInstanceOf(Uint8Array);
    expect(out).toHaveLength(0);
  });

  it('should parse lowercase and uppercase hex correctly', () => {
    const lower = hexToBuffer('deadbeef');
    const upper = hexToBuffer('DEADBEEF');
    const expected = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    expect(lower).toEqual(expected);
    expect(upper).toEqual(expected);
  });

  it('should throw on odd-length strings', () => {
    expect(() => hexToBuffer('abc')).toThrow('length');
  });

  it('should throw on invalid characters', () => {
    expect(() => hexToBuffer('zz')).toThrow('non-hex');
  });

  it('round-trips correctly', () => {
    const original = new Uint8Array([0, 127, 128, 255]);
    const hex = bufferToHex(original);
    const round = hexToBuffer(hex);
    expect(round).toEqual(original);
  });
});

describe('pemToBuffer()', () => {
  it('should throw TypeError if input is not a string', () => {
    expect(() => pemToBuffer(123 as any)).toThrow(TypeError);
    expect(() => pemToBuffer(123 as any)).toThrow('Expected a string for PEM input');
  });

  it('should throw error for invalid PEM format without BEGIN/END markers', () => {
    expect(() => pemToBuffer('invalid pem content')).toThrow('Invalid PEM format: missing BEGIN/END markers');
  });

  it('should throw error for PEM with no content between markers', () => {
    const emptyPem = `-----BEGIN CERTIFICATE-----
-----END CERTIFICATE-----`;
    expect(() => pemToBuffer(emptyPem)).toThrow('Invalid PEM format: no content found between BEGIN/END markers');
  });

  it('should decode a valid PEM certificate', () => {
    const pemCert = `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJAMlyFqk69v+9MA0GCSqGSIb3DQEBCwUAMBQxEjAQBgNVBAMMCWxv
Y2FsaG9zdDAeFw0yMzAxMDEwMDAwMDBaFw0yNDAxMDEwMDAwMDBaMBQxEjAQBgNV
BAMMCWxvY2FsaG9zdDBcMA0GCSqGSIb3DQEBAQUAA0sAMEgCQQDTwqq/3Hn+DjZ4
-----END CERTIFICATE-----`;

    const result = pemToBuffer(pemCert);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);

    // Verify first few bytes match expected ASN.1 DER structure for certificate
    expect(result[0]).toBe(0x30); // SEQUENCE tag
    expect(result[1]).toBe(0x82); // Length indicator
  });

  it('should handle PEM with different types (RSA PRIVATE KEY)', () => {
    const pemKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA7/+9MA0GCSqGSIb3DQEBCwUAMBQxEjAQBgNVBAMMCWxvY2Fs
aG9zdDAeFw0yMzAxMDEwMDAwMDBaFw0yNDAxMDEwMDAwMDBaMBQxEjAQBgNVBAMM
-----END RSA PRIVATE KEY-----`;

    const result = pemToBuffer(pemKey);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should handle PEM with extra whitespace and empty lines', () => {
    const pemWithWhitespace = `
    -----BEGIN CERTIFICATE-----
    
    MIIBkTCB+wIJAMlyFqk69v+9MA0GCSqGSIb3DQEBCwUAMBQxEjAQBgNVBAMMCWxv
    Y2FsaG9zdDAeFw0yMzAxMDEwMDAwMDBaFw0yNDAxMDEwMDAwMDBaMBQxEjAQBgNV
    
    -----END CERTIFICATE-----
    `;

    const result = pemToBuffer(pemWithWhitespace);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should throw error for invalid base64 content', () => {
    const invalidPem = `-----BEGIN CERTIFICATE-----
This is not valid base64!@#$%
-----END CERTIFICATE-----`;

    expect(() => pemToBuffer(invalidPem)).toThrow('Invalid PEM format: contains invalid base64 characters');
  });
});
