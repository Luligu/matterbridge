// src\utils\deepEqual.test.ts

import { deepEqual } from './deepEqual.ts';

describe('deepEqual', () => {
  // Primitives and same references
  test('returns true for identical primitives', () => {
    expect(deepEqual(42, 42)).toBe(true);
    expect(deepEqual('foo', 'foo')).toBe(true);
    expect(deepEqual(true, true)).toBe(true);
  });

  test('returns false for different primitives', () => {
    expect(deepEqual(42, 43)).toBe(false);
    expect(deepEqual('foo', 'bar')).toBe(false);
    expect(deepEqual(true, false)).toBe(false);
  });

  test('returns true for same object reference', () => {
    const obj = { a: 1 };
    expect(deepEqual(obj, obj)).toBe(true);
  });

  // Null and undefined
  test('distinguishes null and undefined', () => {
    expect(deepEqual(null, null)).toBe(true);
    expect(deepEqual(undefined, undefined)).toBe(true);
    expect(deepEqual(null, undefined)).toBe(false);
    expect(deepEqual(null, {})).toBe(false);
    expect(deepEqual({}, null)).toBe(false);
  });

  // Type mismatch
  test('returns false when types differ', () => {
    expect(deepEqual(1, '1')).toBe(false);
    expect(deepEqual({}, [])).toBe(false);
    expect(deepEqual([], {})).toBe(false);
  });

  // Arrays
  describe('array comparisons', () => {
    test('equal flat arrays', () => {
      expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    });

    test('different-length arrays', () => {
      expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
    });

    test('nested arrays', () => {
      const a = [1, [2, 3], 4];
      const b = [1, [2, 3], 4];
      const c = [1, [2, 4], 4];
      expect(deepEqual(a, b)).toBe(true);
      expect(deepEqual(a, c)).toBe(false);
    });
  });

  // Objects
  describe('object comparisons', () => {
    test('equal flat objects', () => {
      expect(deepEqual({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(true);
    });

    test('objects with different keys', () => {
      expect(deepEqual({ x: 1, y: 2 }, { x: 1 })).toBe(false);
      expect(deepEqual({ x: 1 }, { x: 1, y: 2 })).toBe(false);
    });

    test('missing property on b when keys differ but lengths match', () => {
      const a = { a: 1, b: 2 };
      const b = { a: 1, c: 3 };
      // aProps = ['a','b'], bProps = ['a','c'] -> lengths equal, but 'b' missing on b
      expect(deepEqual(a, b)).toBe(false);
    });

    test('nested objects', () => {
      const a = { foo: { bar: 42 }, baz: [1, 2] };
      const b = { foo: { bar: 42 }, baz: [1, 2] };
      const c = { foo: { bar: 43 }, baz: [1, 2] };
      expect(deepEqual(a, b)).toBe(true);
      expect(deepEqual(a, c)).toBe(false);
    });

    test('with excluded properties', () => {
      const a = { keep: 1, skip: 2 };
      const b = { keep: 1, skip: 3 };
      expect(deepEqual(a, b, ['skip'])).toBe(true);

      // if excluded removes keys, lengths match
      const x = { a: 1, b: 2 };
      const y = { a: 1 };
      expect(deepEqual(x, y, ['b'])).toBe(true);
    });
  });

  // Date comparisons
  describe('Date comparisons', () => {
    test('equal Date instances', () => {
      const d1 = new Date(0);
      const d2 = new Date(0);
      expect(deepEqual(d1, d2)).toBe(true);
    });

    test('different Date timestamps', () => {
      const d1 = new Date(0);
      const d2 = new Date(0);
      d2.setTime(1);
      expect(deepEqual(d1, d2)).toBe(false);
    });
  });

  // RegExp comparisons
  describe('RegExp comparisons', () => {
    test('equal RegExp same pattern and flags', () => {
      expect(deepEqual(/abc/i, /abc/i)).toBe(true);
    });

    test('different RegExp pattern', () => {
      expect(deepEqual(/abc/, /abd/)).toBe(false);
    });

    test('different RegExp flags', () => {
      expect(deepEqual(/abc/g, /abc/i)).toBe(false);
    });
  });

  // Mixed edge cases
  test('functions and dates are treated as plain objects/primitives', () => {
    const fn1 = () => {};
    const fn2 = () => {};
    expect(deepEqual(fn1, fn1)).toBe(true);
    expect(deepEqual(fn1, fn2)).toBe(false);

    const d1 = new Date(0);
    const d2 = new Date(0);
    // Date objects aren't specially handled: they’re objects with internal state
    expect(deepEqual(d1, d2)).toBe(true);
    d2.setTime(1);
    expect(deepEqual(d1, d2)).toBe(false);
  });
});
