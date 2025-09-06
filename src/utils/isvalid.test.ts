// src\utils\isvalid.test.ts

import { isValidIpv4Address, isValidNumber, isValidBoolean, isValidString, isValidObject, isValidArray, isValidNull, isValidUndefined, parseVersionString, isValidRegExp } from './isvalid.js';

describe('Validation Functions', () => {
  describe('isValidIpv4Address', () => {
    test('valid addresses', () => {
      expect(isValidIpv4Address('0.0.0.0')).toBe(true);
      expect(isValidIpv4Address('255.255.255.255')).toBe(true);
      expect(isValidIpv4Address('192.168.0.1')).toBe(true);
    });

    test('invalid addresses', () => {
      expect(isValidIpv4Address('')).toBe(false);
      expect(isValidIpv4Address('256.0.0.1')).toBe(false);
      expect(isValidIpv4Address('192.168.0')).toBe(false);
      expect(isValidIpv4Address('192.168.0.1.1')).toBe(false);
      expect(isValidIpv4Address('192.168.0.a')).toBe(false);
      expect(isValidIpv4Address(' 192.168.0.1')).toBe(false);
      expect(isValidIpv4Address('192.168.0.1 ')).toBe(false);
    });
  });

  describe('isValidNumber', () => {
    test('valid numbers without range', () => {
      expect(isValidNumber(0)).toBe(true);
      expect(isValidNumber(-1)).toBe(true);
      expect(isValidNumber(3.14)).toBe(true);
    });

    test('invalid numbers and types', () => {
      expect(isValidNumber(NaN)).toBe(false);
      expect(isValidNumber(Infinity)).toBe(false);
      expect(isValidNumber(null)).toBe(false);
      expect(isValidNumber(undefined)).toBe(false);
      expect(isValidNumber('123' as any)).toBe(false);
    });

    test('range validation', () => {
      expect(isValidNumber(5, 0, 10)).toBe(true);
      expect(isValidNumber(-1, 0)).toBe(false);
      expect(isValidNumber(11, undefined, 10)).toBe(false);
    });
  });

  describe('isValidBoolean', () => {
    test('valid booleans', () => {
      expect(isValidBoolean(true)).toBe(true);
      expect(isValidBoolean(false)).toBe(true);
    });

    test('invalid booleans', () => {
      expect(isValidBoolean(null)).toBe(false);
      expect(isValidBoolean(undefined)).toBe(false);
      expect(isValidBoolean(0 as any)).toBe(false);
      expect(isValidBoolean('true' as any)).toBe(false);
    });
  });

  describe('isValidString', () => {
    test('valid strings without length', () => {
      expect(isValidString('')).toBe(true);
      expect(isValidString('hello')).toBe(true);
    });

    test('invalid strings and types', () => {
      expect(isValidString(null)).toBe(false);
      expect(isValidString(undefined)).toBe(false);
      expect(isValidString(123 as any)).toBe(false);
    });

    test('length validation', () => {
      expect(isValidString('abc', 2, 4)).toBe(true);
      expect(isValidString('a', 2)).toBe(false);
      expect(isValidString('longer', undefined, 5)).toBe(false);
    });
  });

  describe('isValidRegExp', () => {
    test('valid RegExp literal', () => {
      expect(isValidRegExp(/test/)).toBe(true);
    });

    test('valid RegExp constructed', () => {
      expect(isValidRegExp(new RegExp('abc', 'gi'))).toBe(true);
    });

    test('invalid values', () => {
      expect(isValidRegExp(null)).toBe(false);
      expect(isValidRegExp(undefined)).toBe(false);
      expect(isValidRegExp('pattern' as any)).toBe(false);
      expect(isValidRegExp(123 as any)).toBe(false);
      expect(isValidRegExp({ source: 'test', flags: 'g' } as any)).toBe(false);
    });
  });

  describe('isValidObject', () => {
    test('valid objects without key count', () => {
      expect(isValidObject({})).toBe(true);
      expect(isValidObject({ a: 1 })).toBe(true);
    });

    test('invalid objects', () => {
      expect(isValidObject(null)).toBe(false);
      expect(isValidObject(undefined)).toBe(false);
      expect(isValidObject([])).toBe(false);
      expect(isValidObject(123 as any)).toBe(false);
    });

    test('key count validation', () => {
      expect(isValidObject({ a: 1, b: 2 }, 1, 3)).toBe(true);
      expect(isValidObject({ a: 1 }, 2)).toBe(false);
      expect(isValidObject({ a: 1, b: 2, c: 3 }, undefined, 2)).toBe(false);
    });
  });

  describe('isValidArray', () => {
    test('valid arrays without length', () => {
      expect(isValidArray([])).toBe(true);
      expect(isValidArray([1, 2, 3])).toBe(true);
    });

    test('invalid arrays', () => {
      expect(isValidArray(null)).toBe(false);
      expect(isValidArray(undefined)).toBe(false);
      expect(isValidArray({} as any)).toBe(false);
    });

    test('length validation', () => {
      expect(isValidArray([1, 2], 1, 3)).toBe(true);
      expect(isValidArray([1], 2)).toBe(false);
      expect(isValidArray([1, 2, 3, 4], undefined, 3)).toBe(false);
    });
  });

  describe('isValidNull and isValidUndefined', () => {
    test('null validation', () => {
      expect(isValidNull(null)).toBe(true);
      expect(isValidNull(undefined)).toBe(false);
      expect(isValidNull(0 as any)).toBe(false);
    });

    test('undefined validation', () => {
      expect(isValidUndefined(undefined)).toBe(true);
      expect(isValidUndefined(null)).toBe(false);
      expect(isValidUndefined('' as any)).toBe(false);
    });
  });

  describe('parseVersionString', () => {
    test('valid version strings', () => {
      expect(parseVersionString('1.2.3')).toBe(10203);
      expect(parseVersionString('10.0.0')).toBe(100000);
      expect(parseVersionString('99.99.99')).toBe(999999);
      expect(parseVersionString('6.11.0-1011-raspi')).toBe(61100);
    });

    test('invalid version strings', () => {
      expect(parseVersionString('')).toBeUndefined();
      expect(parseVersionString('1.2')).toBeUndefined();
      expect(parseVersionString('a.b.c')).toBeUndefined();
      expect(parseVersionString('100.0.0')).toBeUndefined();
      expect(parseVersionString('1.100.0')).toBeUndefined();
      expect(parseVersionString('1.2.100')).toBeUndefined();
    });

    test('non-string input returns undefined', () => {
      expect(parseVersionString(null as any)).toBeUndefined();
      expect(parseVersionString(undefined as any)).toBeUndefined();
    });
  });
});
