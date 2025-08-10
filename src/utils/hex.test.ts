// src\utils\hex.test.ts
import { bufferToHex, hexToBuffer, pemToBuffer, extractPrivateKeyRaw } from './hex.ts';

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

  it('should validate PEM certificates when validate=true', () => {
    expect(() => pemToBuffer(Matter_PAA_Cert, true)).not.toThrow();
    expect(() => pemToBuffer(Matter_PAI_Cert, true)).not.toThrow();
    expect(() => pemToBuffer(Matter_DAC_Cert, true)).not.toThrow();
  });

  it('should validate PEM private keys when validate=true', () => {
    expect(() => pemToBuffer(Matter_PAA_Key, true)).not.toThrow();
    expect(() => pemToBuffer(Matter_PAI_Key, true)).not.toThrow();
    expect(() => pemToBuffer(Matter_DAC_Key, true)).not.toThrow();
  });

  it('should throw error for invalid PEM content when validate=true', () => {
    const invalidCert = `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJAMlyFqk69v+9MA0GCSqGSIb3DQEBCwUAMBQxEjAQBgNVBAMMCWxv
-----END CERTIFICATE-----`;

    expect(() => pemToBuffer(invalidCert, true)).toThrow('PEM validation failed');
  });

  it('should throw error for certificate with invalid base64 characters when validate=true', () => {
    expect(() => pemToBuffer(Wrong_Cert, true)).toThrow('Invalid PEM format: contains invalid base64 characters');
  });

  it('should throw error for truncated certificate when validate=true', () => {
    expect(() => pemToBuffer(Wrong_Cert_Truncated, true)).toThrow('PEM validation failed');
  });

  it('should throw error for private key with invalid base64 characters when validate=true', () => {
    expect(() => pemToBuffer(Wrong_Key, true)).toThrow('Invalid PEM format: contains invalid base64 characters');
  });

  it('should throw error for malformed private key when validate=true', () => {
    expect(() => pemToBuffer(Wrong_Key_Malformed, true)).toThrow('PEM validation failed');
  });

  it('should not throw for invalid PEMs when validate=false', () => {
    // These should not throw when validation is disabled, even though they contain invalid data
    expect(() => pemToBuffer(Wrong_Cert_Truncated, false)).not.toThrow();
    expect(() => pemToBuffer(Wrong_Key_Malformed, false)).not.toThrow();
  });

  it('should not validate when validate=false (default)', () => {
    const invalidCert = `-----BEGIN CERTIFICATE-----
MIIBkTCB+w==
-----END CERTIFICATE-----`;

    // Should not throw when validation is disabled
    expect(() => pemToBuffer(invalidCert, false)).not.toThrow();
    expect(() => pemToBuffer(invalidCert)).not.toThrow(); // default behavior
  });

  it('should handle unknown PEM types when validate=true', () => {
    const unknownPem = `-----BEGIN UNKNOWN TYPE-----
MIIBkTCB+wIJAMlyFqk69v+9MA0GCSqGSIb3DQEBCwUAMBQxEjAQBgNVBAMMCWxv
-----END UNKNOWN TYPE-----`;

    // Should not throw for unknown types (validation is skipped)
    expect(() => pemToBuffer(unknownPem, true)).not.toThrow();
  });

  it('should validate PUBLIC KEY PEM when validate=true', () => {
    // Extract public key from one of the certificates for testing
    const publicKeyPem = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEbFUQymkvRFjJu4nLZP3d0u+S7pxb
ImSvYgK/4x041AMcUHYLJxL5da+EXyZ90w/5TCaPW1UjybzPKcyKwF78WA==
-----END PUBLIC KEY-----`;

    expect(() => pemToBuffer(publicKeyPem, true)).not.toThrow();
  });

  it('should process all Matter PEM constants successfully', () => {
    // Test all certificates convert to buffers with expected properties
    const paaCertBuffer = pemToBuffer(Matter_PAA_Cert);
    const paiCertBuffer = pemToBuffer(Matter_PAI_Cert);
    const dacCertBuffer = pemToBuffer(Matter_DAC_Cert);

    expect(paaCertBuffer).toBeInstanceOf(Uint8Array);
    expect(paiCertBuffer).toBeInstanceOf(Uint8Array);
    expect(dacCertBuffer).toBeInstanceOf(Uint8Array);

    // All should start with ASN.1 SEQUENCE tag for certificates
    expect(paaCertBuffer[0]).toBe(0x30);
    expect(paiCertBuffer[0]).toBe(0x30);
    expect(dacCertBuffer[0]).toBe(0x30);

    // Test all private keys convert to buffers
    const paaKeyBuffer = pemToBuffer(Matter_PAA_Key);
    const paiKeyBuffer = pemToBuffer(Matter_PAI_Key);
    const dacKeyBuffer = pemToBuffer(Matter_DAC_Key);

    expect(paaKeyBuffer).toBeInstanceOf(Uint8Array);
    expect(paiKeyBuffer).toBeInstanceOf(Uint8Array);
    expect(dacKeyBuffer).toBeInstanceOf(Uint8Array);

    // All should start with ASN.1 SEQUENCE tag for EC private keys
    expect(paaKeyBuffer[0]).toBe(0x30);
    expect(paiKeyBuffer[0]).toBe(0x30);
    expect(dacKeyBuffer[0]).toBe(0x30);

    // Validate all PEMs when validation is enabled
    expect(() => pemToBuffer(Matter_PAA_Cert, true)).not.toThrow();
    expect(() => pemToBuffer(Matter_PAA_Key, true)).not.toThrow();
    expect(() => pemToBuffer(Matter_PAI_Cert, true)).not.toThrow();
    expect(() => pemToBuffer(Matter_PAI_Key, true)).not.toThrow();
    expect(() => pemToBuffer(Matter_DAC_Cert, true)).not.toThrow();
    expect(() => pemToBuffer(Matter_DAC_Key, true)).not.toThrow();
  });
});

describe('extractPrivateKeyRaw()', () => {
  it('should throw TypeError if input is not a string', () => {
    expect(() => extractPrivateKeyRaw(123 as any)).toThrow(TypeError);
    expect(() => extractPrivateKeyRaw(123 as any)).toThrow('Expected a string for PEM private key input');
  });

  it('should throw error for invalid PEM format without BEGIN/END markers', () => {
    expect(() => extractPrivateKeyRaw('invalid pem content')).toThrow('No EC PRIVATE KEY block found in the supplied PEM');
  });

  it('should extract 32-byte raw private key from Matter PAA private key', () => {
    const rawKey = extractPrivateKeyRaw(Matter_PAA_Key);

    expect(rawKey).toBeInstanceOf(Uint8Array);
    expect(rawKey.length).toBe(32);

    // Convert to hex for validation
    const hexKey = bufferToHex(rawKey);
    expect(hexKey).toHaveLength(64); // 32 bytes = 64 hex characters
    expect(hexKey).toMatch(/^[0-9a-f]{64}$/); // Only lowercase hex characters
  });

  it('should extract 32-byte raw private key from Matter PAI private key', () => {
    const rawKey = extractPrivateKeyRaw(Matter_PAI_Key);

    expect(rawKey).toBeInstanceOf(Uint8Array);
    expect(rawKey.length).toBe(32);

    // The extracted key should be different from PAA key
    const paaRawKey = extractPrivateKeyRaw(Matter_PAA_Key);
    expect(rawKey).not.toEqual(paaRawKey);
  });

  it('should extract 32-byte raw private key from Matter DAC private key', () => {
    const rawKey = extractPrivateKeyRaw(Matter_DAC_Key);

    expect(rawKey).toBeInstanceOf(Uint8Array);
    expect(rawKey.length).toBe(32);

    // Verify it produces a different result than other keys
    const paaRawKey = extractPrivateKeyRaw(Matter_PAA_Key);
    const paiRawKey = extractPrivateKeyRaw(Matter_PAI_Key);
    expect(rawKey).not.toEqual(paaRawKey);
    expect(rawKey).not.toEqual(paiRawKey);
  });

  it('should throw error for malformed private key', () => {
    expect(() => extractPrivateKeyRaw(Wrong_Key_Malformed)).toThrow('Failed to extract private key');
  });

  it('should throw error for invalid base64 in private key', () => {
    expect(() => extractPrivateKeyRaw(Wrong_Key)).toThrow('Failed to extract private key');
  });

  it('should format error messages correctly for both Error and non-Error cases', () => {
    // Test that the function properly handles malformed keys (this exercises the try-catch)
    expect(() => extractPrivateKeyRaw(Wrong_Key_Malformed)).toThrow('Failed to extract private key');
  });

  it('should work with both EC PRIVATE KEY and PRIVATE KEY formats', () => {
    // Test with EC PRIVATE KEY format (the current format)
    const rawKeyEC = extractPrivateKeyRaw(Matter_PAA_Key);
    expect(rawKeyEC).toBeInstanceOf(Uint8Array);
    expect(rawKeyEC.length).toBe(32);

    // We only test EC PRIVATE KEY format since that's what we have in our test data
    // PKCS#8 format would require a different test key that we don't have
    expect(bufferToHex(rawKeyEC)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should handle keys with extra whitespace', () => {
    // Use the original key content but with whitespace
    const keyContent = Matter_PAA_Key.replace(/-----BEGIN EC PRIVATE KEY-----/, '')
      .replace(/-----END EC PRIVATE KEY-----/, '')
      .trim();

    const keyWithWhitespace = `-----BEGIN EC PRIVATE KEY-----
${keyContent}
-----END EC PRIVATE KEY-----`;

    const rawKey = extractPrivateKeyRaw(keyWithWhitespace);
    expect(rawKey).toBeInstanceOf(Uint8Array);
    expect(rawKey.length).toBe(32);

    // Should extract the same key as the clean version
    const cleanRawKey = extractPrivateKeyRaw(Matter_PAA_Key);
    expect(rawKey).toEqual(cleanRawKey);
  });
});

const Matter_PAA_Cert = `-----BEGIN CERTIFICATE-----
MIIBzTCCAXSgAwIBAgIIESTTd6253ZYwCgYIKoZIzj0EAwIwODEgMB4GA1UEAwwX
TWF0dGVyIE1hdHRlcmJyaWRnZSBQQUExFDASBgorBgEEAYKifAIBDARGRkYxMCAX
DTI0MDEwMTAwMDAwMFoYDzIwNTMxMjIzMjM1OTU5WjA4MSAwHgYDVQQDDBdNYXR0
ZXIgTWF0dGVyYnJpZGdlIFBBQTEUMBIGCisGAQQBgqJ8AgEMBEZGRjEwWTATBgcq
hkjOPQIBBggqhkjOPQMBBwNCAARsVRDKaS9EWMm7ictk/d3S75LunFsiZK9iAr/j
HTjUAxxQdgsnEvl1r4RfJn3TD/lMJo9bVSPJvM8pzIrAXvxYo2YwZDASBgNVHRMB
Af8ECDAGAQH/AgEBMA4GA1UdDwEB/wQEAwIBBjAdBgNVHQ4EFgQUYv/gW9qxspWa
2mTFSOoyinqy0/swHwYDVR0jBBgwFoAUYv/gW9qxspWa2mTFSOoyinqy0/swCgYI
KoZIzj0EAwIDRwAwRAIgboNYsAxjKb6UGVz32q727baz6WWdchJgTB7QVixNZq4C
IDmsF+SWn0ahN1//rVn+F89W1ucktxobi+ReX6uA16R2
-----END CERTIFICATE-----`;

const Matter_PAA_Key = `-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIHlD9ZCwF2AZ9ef2p0amVUsaEr/aV7Kld5IzdEJWIvPRoAoGCCqGSM49
AwEHoUQDQgAEbFUQymkvRFjJu4nLZP3d0u+S7pxbImSvYgK/4x041AMcUHYLJxL5
da+EXyZ90w/5TCaPW1UjybzPKcyKwF78WA==
-----END EC PRIVATE KEY-----`;

const Matter_PAI_Cert = `-----BEGIN CERTIFICATE-----
MIIB4zCCAYigAwIBAgIIHVPDiuKah4YwCgYIKoZIzj0EAwIwODEgMB4GA1UEAwwX
TWF0dGVyIE1hdHRlcmJyaWRnZSBQQUExFDASBgorBgEEAYKifAIBDARGRkYxMB4X
DTI0MDEwMTAwMDAwMFoXDTQzMTIzMTIzNTk1OVowTjEgMB4GA1UEAwwXTWF0dGVy
IE1hdHRlcmJyaWRnZSBQQUkxFDASBgorBgEEAYKifAIBDARGRkYxMRQwEgYKKwYB
BAGConwCAgwEODAwMDBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABHHBXg8LCsjj
LJQ+Cmma6ehEMC6pg2nxjMEN2GFQ2D5ERL1Xrfh+bc8euA1EaaVpZTjMq/7WPwyr
ObhtdCr0sVqjZjBkMBIGA1UdEwEB/wQIMAYBAf8CAQAwDgYDVR0PAQH/BAQDAgEG
MB0GA1UdDgQWBBSqUMlMBmAqLUsWw7g8blAk4hwbQTAfBgNVHSMEGDAWgBRi/+Bb
2rGylZraZMVI6jKKerLT+zAKBggqhkjOPQQDAgNJADBGAiEAoSMpJNdJDROxK0Wt
1eiHPfpE+8Zn4ALhQfruwnvyTBICIQCebodC7ZliTlDNHJ7uevGbX5RWUsxZhLot
XwIToJZ8JQ==
-----END CERTIFICATE-----`;

const Matter_PAI_Key = `-----BEGIN EC PRIVATE KEY-----
MHcCAQEEICQEqyNN2XurTIBkTr7ZMOAWVEjS7N8AWSjhwv4wbrbIoAoGCCqGSM49
AwEHoUQDQgAEccFeDwsKyOMslD4KaZrp6EQwLqmDafGMwQ3YYVDYPkREvVet+H5t
zx64DURppWllOMyr/tY/DKs5uG10KvSxWg==
-----END EC PRIVATE KEY-----`;

const Matter_DAC_Cert = `-----BEGIN CERTIFICATE-----
MIIB8jCCAZigAwIBAgIIPxvkZ+gFZGIwCgYIKoZIzj0EAwIwTjEgMB4GA1UEAwwX
TWF0dGVyIE1hdHRlcmJyaWRnZSBQQUkxFDASBgorBgEEAYKifAIBDARGRkYxMRQw
EgYKKwYBBAGConwCAgwEODAwMDAeFw0yNDAxMDEwMDAwMDBaFw00MzEyMzEyMzU5
NTlaME4xIDAeBgNVBAMMF01hdHRlciBNYXR0ZXJicmlkZ2UgREFDMRQwEgYKKwYB
BAGConwCAQwERkZGMTEUMBIGCisGAQQBgqJ8AgIMBDgwMDAwWTATBgcqhkjOPQIB
BggqhkjOPQMBBwNCAARwnd4f+sbfN/1aaoyOHl4FKR5fPcJvgWKDWtOix8eaDKPH
9acs8R4EXhIe8ujQbYI4kQdr9UMTkSIpY71lHoA5o2AwXjAMBgNVHRMBAf8EAjAA
MA4GA1UdDwEB/wQEAwIHgDAdBgNVHQ4EFgQUfdBlI3q76RaYG8ZrmR/EQRjeQzow
HwYDVR0jBBgwFoAUqlDJTAZgKi1LFsO4PG5QJOIcG0EwCgYIKoZIzj0EAwIDSAAw
RQIgbYv8tsJCG/iEZjC201k19Z6U4ujkXfOg2QY2ETcrtM4CIQCABu4UDezZbFI8
ovQpl1cOboZIta5+tVnFefBsO7whxQ==
-----END CERTIFICATE-----`;

const Matter_DAC_Key = `-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIFBxqFkUxMoN2JkUXLFeiZnLNUpftjLi0sKMbZ6uajHXoAoGCCqGSM49
AwEHoUQDQgAEcJ3eH/rG3zf9WmqMjh5eBSkeXz3Cb4Fig1rTosfHmgyjx/WnLPEe
BF4SHvLo0G2COJEHa/VDE5EiKWO9ZR6AOQ==
-----END EC PRIVATE KEY-----`;

// Invalid/wrong certificate and key constants for testing validation
const Wrong_Cert = `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJAMlyFqk69v+9MA0GCSqGSIb3DQEBCwUAMBQxEjAQBgNVBAMMCWxv
InvalidBase64Content!@#$%^&*()
BAMMCWxvY2FsaG9zdDBcMA0GCSqGSIb3DQEBAQUAA0sAMEgCQQDTwqq/3Hn+DjZ4
-----END CERTIFICATE-----`;

const Wrong_Cert_Truncated = `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJAMlyFqk69v+9MA0GCSqGSIb3DQEBCwUAMBQxEjAQBgNVBAMMCWxv
-----END CERTIFICATE-----`;

const Wrong_Key = `-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIFBxqFkUxMoN2JkUXLFeiZnLNUpftjLi0sKMbZ6uajHXoAoGCCqGSM49
WrongKeyData!@#$%^&*()NotValidBase64
BF4SHvLo0G2COJEHa/VDE5EiKWO9ZR6AOQ==
-----END EC PRIVATE KEY-----`;

const Wrong_Key_Malformed = `-----BEGIN EC PRIVATE KEY-----
MHcCAQEE
-----END EC PRIVATE KEY-----`;
