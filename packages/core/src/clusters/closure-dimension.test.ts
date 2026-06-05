// src\clusters\closure-dimension.test.ts

const NAME = 'ClosureDimensionCluster';

import { jest } from '@jest/globals';

import { setupTest } from '../jestutils/jestSetupTest.js';
import { ClosureDimension } from './closure-dimension.js';

type ClusterWithSupportedFeatures = {
  supportedFeatures?: Record<string, boolean>;
};

function getSupportedFeatures(cluster: object): Record<string, boolean> {
  return (cluster as ClusterWithSupportedFeatures).supportedFeatures ?? {};
}

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
    expect(ClosureDimension.id).toBe(0x0105);
  });

  test('allows an empty feature selection', () => {
    const cluster = ClosureDimension.with();

    expect(cluster.id).toBe(ClosureDimension.id);
    expect(getSupportedFeatures(cluster)).toEqual({});
  });

  test('composes Positioning elements', () => {
    const ps = ClosureDimension.with(ClosureDimension.Feature.Positioning);
    expect(ps.attributes).toHaveProperty('resolution');
    expect(ps.attributes).toHaveProperty('stepValue');
    expect(ps.commands).toHaveProperty('step');
  });

  test('allows MotionLatching without Positioning-dependent features', () => {
    const ml = ClosureDimension.with(ClosureDimension.Feature.MotionLatching);

    expect(ml.id).toBe(ClosureDimension.id);
  });

  test('records Unit and Limitation in supportedFeatures', () => {
    const unitOnly = ClosureDimension.with(ClosureDimension.Feature.Unit);
    expect(getSupportedFeatures(unitOnly)).toEqual({ unit: true });

    const ut = ClosureDimension.with(ClosureDimension.Feature.Positioning, ClosureDimension.Feature.Unit);
    expect(ut.attributes).toHaveProperty('unit');
    expect(ut.attributes).toHaveProperty('unitRange');
    expect(getSupportedFeatures(ut)).toEqual({ positioning: true, unit: true });

    const lm = ClosureDimension.with(ClosureDimension.Feature.Positioning, ClosureDimension.Feature.Limitation);
    expect(lm.attributes).toHaveProperty('limitRange');
    expect(getSupportedFeatures(lm)).toEqual({ positioning: true, limitation: true });
  });

  test('allows mutually exclusive combinations and records all requested features', () => {
    expect(getSupportedFeatures(ClosureDimension.with(ClosureDimension.Feature.Translation, ClosureDimension.Feature.Rotation))).toEqual({ translation: true, rotation: true });
    expect(getSupportedFeatures(ClosureDimension.with(ClosureDimension.Feature.Translation, ClosureDimension.Feature.Modulation))).toEqual({ translation: true, modulation: true });
    expect(getSupportedFeatures(ClosureDimension.with(ClosureDimension.Feature.Rotation, ClosureDimension.Feature.Modulation))).toEqual({ rotation: true, modulation: true });
  });

  test('allows positioning-only features alongside MotionLatching', () => {
    expect(getSupportedFeatures(ClosureDimension.with(ClosureDimension.Feature.MotionLatching, ClosureDimension.Feature.Unit))).toEqual({ motionLatching: true, unit: true });
  });

  test('allows exclusive motion features once Positioning is enabled', () => {
    expect(getSupportedFeatures(ClosureDimension.with(ClosureDimension.Feature.Positioning, ClosureDimension.Feature.Translation, ClosureDimension.Feature.Rotation))).toEqual({
      positioning: true,
      translation: true,
      rotation: true,
    });
  });

  test('creates a new namespace for repeated feature selections', () => {
    const first = ClosureDimension.with(ClosureDimension.Feature.Positioning, ClosureDimension.Feature.Unit);
    const second = ClosureDimension.with(ClosureDimension.Feature.Unit, ClosureDimension.Feature.Positioning, ClosureDimension.Feature.Unit);

    expect(second).not.toBe(first);
    expect(getSupportedFeatures(second)).toEqual(getSupportedFeatures(first));
  });
});
