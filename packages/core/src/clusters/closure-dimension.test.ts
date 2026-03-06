// src\clusters\closure-dimension.test.ts

const NAME = 'ClosureDimensionCluster';

import { jest } from '@jest/globals';

import { setupTest } from '../jestutils/jestHelpers.js';
import { ClosureDimension } from './closure-dimension.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  test('has the expected cluster id', () => {
    expect(ClosureDimension.Cluster.id).toBe(0x0105);
    expect(ClosureDimension.Complete.id).toBe(0x0105);
  });

  test('rejects an empty feature set', () => {
    expect(() => ClosureDimension.Cluster.with()).toThrow();
  });

  test('composes Positioning elements', () => {
    const ps = ClosureDimension.Cluster.with(ClosureDimension.Feature.Positioning);
    expect(ps.attributes).toHaveProperty('resolution');
    expect(ps.attributes).toHaveProperty('stepValue');
    expect(ps.commands).toHaveProperty('step');
  });

  test('composes Unit and Limitation elements only with Positioning', () => {
    expect(() => ClosureDimension.Cluster.with(ClosureDimension.Feature.Unit)).toThrow();
    expect(() => ClosureDimension.Cluster.with(ClosureDimension.Feature.Limitation)).toThrow();

    const ut = ClosureDimension.Cluster.with(ClosureDimension.Feature.Positioning, ClosureDimension.Feature.Unit);
    expect(ut.attributes).toHaveProperty('unit');
    expect(ut.attributes).toHaveProperty('unitRange');

    const lm = ClosureDimension.Cluster.with(ClosureDimension.Feature.Positioning, ClosureDimension.Feature.Limitation);
    expect(lm.attributes).toHaveProperty('limitRange');
  });

  test('rejects mutually exclusive feature combinations', () => {
    expect(() => ClosureDimension.Cluster.with(ClosureDimension.Feature.Translation, ClosureDimension.Feature.Rotation)).toThrow();
    expect(() => ClosureDimension.Cluster.with(ClosureDimension.Feature.Translation, ClosureDimension.Feature.Modulation)).toThrow();
    expect(() => ClosureDimension.Cluster.with(ClosureDimension.Feature.Rotation, ClosureDimension.Feature.Modulation)).toThrow();
  });
});
