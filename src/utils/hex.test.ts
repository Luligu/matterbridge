/**
 * Jest tests for bufferToHex and hexToBuffer functions.
 *
 * @module hex.test.ts
 */
import { bufferToHex, hexToBuffer } from './hex';

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => hexToBuffer(123 as any)).toThrow(TypeError);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
