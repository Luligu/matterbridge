/**
 * @file packages/utils/vitest/measurementUtils.test.ts
 * @description This file contains the tests for measurementUtils.
 * @author Luca Liguori
 */

import { luxToMatter, matterToLux } from '../src/measurementUtils.js';

describe('measurementUtils', () => {
  describe('luxToMatter', () => {
    test('encodes lux per the spec formula (10000 x log10(lux) + 1)', () => {
      expect(luxToMatter(1)).toBe(1);
      expect(luxToMatter(10)).toBe(10001);
      expect(luxToMatter(100)).toBe(20001);
      expect(luxToMatter(1000)).toBe(30001);
    });

    test('returns 0 (too low to be measured) for lux below the 1 lx floor', () => {
      expect(luxToMatter(0)).toBe(0);
      expect(luxToMatter(0.5)).toBe(0);
      expect(luxToMatter(-5)).toBe(0);
    });

    test('returns 0 for NaN', () => {
      expect(luxToMatter(Number.NaN)).toBe(0);
    });

    test('returns 0 for +/- Infinity', () => {
      expect(luxToMatter(Number.POSITIVE_INFINITY)).toBe(0);
      expect(luxToMatter(Number.NEGATIVE_INFINITY)).toBe(0);
    });

    test('caps very large lux at 0xfffe', () => {
      expect(luxToMatter(3_576_000)).toBe(0xfffe); // spec's upper bound, ~3.576 Mlx
      expect(luxToMatter(1e30)).toBe(0xfffe);
    });
  });

  describe('matterToLux', () => {
    test('decodes the Matter encoded value back to lux', () => {
      expect(matterToLux(1)).toBe(1);
      expect(matterToLux(10001)).toBe(10);
      expect(matterToLux(20001)).toBe(100);
      expect(matterToLux(30001)).toBe(1000);
    });

    test('returns 0 for value === 0 (too low to be measured sentinel)', () => {
      expect(matterToLux(0)).toBe(0);
    });

    test('returns 0 for negative value', () => {
      expect(matterToLux(-5)).toBe(0);
    });

    test('returns 0 for NaN', () => {
      expect(matterToLux(Number.NaN)).toBe(0);
    });

    test('returns 0 for +/- Infinity', () => {
      expect(matterToLux(Number.POSITIVE_INFINITY)).toBe(0);
      expect(matterToLux(Number.NEGATIVE_INFINITY)).toBe(0);
    });

    test('caps values above 0xfffe at 0xfffe', () => {
      expect(matterToLux(0xffff)).toBe(matterToLux(0xfffe));
      expect(matterToLux(1_000_000)).toBe(matterToLux(0xfffe));
    });
  });

  test('luxToMatter and matterToLux are approximate inverses', () => {
    for (const lux of [1, 10, 100, 1000, 10000]) {
      expect(matterToLux(luxToMatter(lux))).toBeCloseTo(lux, -1);
    }
  });
});
