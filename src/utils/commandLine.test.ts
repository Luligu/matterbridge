// src\utils\commandLine.test.ts
import { jest } from '@jest/globals';

import { hasParameter, getParameter, getIntParameter, getIntArrayParameter, getStringArrayParameter } from './commandLine.ts';

describe('Parameter Functions', () => {
  const ORIGINAL_ARGV = process.argv;

  beforeEach(() => {
    jest.resetModules();
    process.argv = ['node', 'script.js'];
  });

  afterAll(() => {
    process.argv = ORIGINAL_ARGV;
  });

  describe('hasParameter', () => {
    test('detects short flag', () => {
      process.argv = [...process.argv, '-a'];
      expect(hasParameter('a')).toBe(true);
    });

    test('detects long flag', () => {
      process.argv = [...process.argv, '--verbose'];
      expect(hasParameter('verbose')).toBe(true);
    });

    test('returns false when not present', () => {
      expect(hasParameter('missing')).toBe(false);
    });
  });

  describe('getParameter', () => {
    test('retrieves value for short flag', () => {
      process.argv = [...process.argv, '-a', 'foo'];
      expect(getParameter('a')).toBe('foo');
    });

    test('retrieves value for long flag', () => {
      process.argv = [...process.argv, '--name', 'Luca'];
      expect(getParameter('name')).toBe('Luca');
    });

    test('returns undefined if flag missing', () => {
      expect(getParameter('nope')).toBeUndefined();
    });

    test('returns undefined if value missing', () => {
      process.argv = [...process.argv, '--empty'];
      expect(getParameter('empty')).toBeUndefined();
    });
  });

  describe('getIntParameter', () => {
    test('parses integer correctly', () => {
      process.argv = [...process.argv, '--num', '42'];
      expect(getIntParameter('num')).toBe(42);
    });

    test('returns undefined for non-numeric', () => {
      process.argv = [...process.argv, '--num', 'abc'];
      expect(getIntParameter('num')).toBeUndefined();
    });

    test('returns undefined if missing', () => {
      expect(getIntParameter('none')).toBeUndefined();
    });
  });

  describe('getIntArrayParameter', () => {
    test('parses multiple ints', () => {
      process.argv = [...process.argv, '--list', '1', '2', '3'];
      expect(getIntArrayParameter('list')).toEqual([1, 2, 3]);
    });

    test('stops at next flag', () => {
      process.argv = [...process.argv, '--list', '4', '5', '-x', '7'];
      expect(getIntArrayParameter('list')).toEqual([4, 5]);
    });

    test('returns undefined if no valid ints', () => {
      process.argv = [...process.argv, '--list', 'foo', 'bar'];
      expect(getIntArrayParameter('list')).toBeUndefined();
    });

    test('returns undefined if flag missing', () => {
      expect(getIntArrayParameter('absent')).toBeUndefined();
    });
  });

  describe('getStringArrayParameter', () => {
    test('parses multiple strings', () => {
      process.argv = [...process.argv, '--items', 'a', 'b', 'c'];
      expect(getStringArrayParameter('items')).toEqual(['a', 'b', 'c']);
    });

    test('stops at next flag', () => {
      process.argv = [...process.argv, '--items', 'x', 'y', '--other', 'z'];
      expect(getStringArrayParameter('items')).toEqual(['x', 'y']);
    });

    test('returns undefined if no values', () => {
      process.argv = [...process.argv, '--items'];
      expect(getStringArrayParameter('items')).toBeUndefined();
    });

    test('returns undefined if flag missing', () => {
      expect(getStringArrayParameter('none')).toBeUndefined();
    });
  });
});
