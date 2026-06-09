// src\clusters\closure-dimension.test.ts

const NAME = 'ClosureDimensionCluster';

import { jest } from '@jest/globals';
import { ThreeLevelAuto } from '@matter/types/globals';

import { setupTest } from '../jestutils/jestSetupTest.js';
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

  test('has the expected cluster identity', () => {
    expect(ClosureDimension.id).toBe(0x0105);
    expect(ClosureDimension.name).toBe('ClosureDimension');
    expect(ClosureDimension.revision).toBe(1);
  });

  test('exposes the expected feature constants', () => {
    expect(ClosureDimension.Feature).toEqual({
      Positioning: 'Positioning',
      MotionLatching: 'MotionLatching',
      Unit: 'Unit',
      Limitation: 'Limitation',
      Speed: 'Speed',
      Translation: 'Translation',
      Rotation: 'Rotation',
      Modulation: 'Modulation',
    });

    expect(new ClosureDimension.FeatureMap({ positioning: true, unit: true })).toEqual({ positioning: true, unit: true });
  });

  test('exposes the expected attributes', () => {
    expect(ClosureDimension.attributes).toHaveProperty('currentState');
    expect(ClosureDimension.attributes).toHaveProperty('targetState');
    expect(ClosureDimension.attributes).toHaveProperty('resolution');
    expect(ClosureDimension.attributes).toHaveProperty('stepValue');
    expect(ClosureDimension.attributes).toHaveProperty('unit');
    expect(ClosureDimension.attributes).toHaveProperty('unitRange');
    expect(ClosureDimension.attributes).toHaveProperty('limitRange');
    expect(ClosureDimension.attributes).toHaveProperty('translationDirection');
    expect(ClosureDimension.attributes).toHaveProperty('rotationAxis');
    expect(ClosureDimension.attributes).toHaveProperty('overflow');
    expect(ClosureDimension.attributes).toHaveProperty('modulationType');
    expect(ClosureDimension.attributes).toHaveProperty('latchControlModes');
  });

  test('exposes the expected commands', () => {
    expect(ClosureDimension.commands).toHaveProperty('setTarget');
    expect(ClosureDimension.commands).toHaveProperty('step');
  });

  test('exposes the expected enum constants', () => {
    expect(ClosureDimension.ClosureUnit.Degree).toBe(1);
    expect(ClosureDimension.ModulationType.Ventilation).toBe(4);
    expect(ClosureDimension.Overflow.RightOutside).toBe(10);
    expect(ClosureDimension.RotationAxis.RightBarrier).toBe(10);
    expect(ClosureDimension.StepDirection.Increase).toBe(1);
    expect(ClosureDimension.TranslationDirection.DepthSymmetry).toBe(11);
  });

  test('creates expected struct and bitmap values', () => {
    expect(new ClosureDimension.LatchControlModes({ remoteUnlatching: true })).toEqual({ remoteUnlatching: true });
    expect(new ClosureDimension.DimensionState({ position: null, speed: ThreeLevelAuto.Auto })).toEqual({ latch: null, position: null, speed: ThreeLevelAuto.Auto });
    expect(new ClosureDimension.RangePercent100ths({ min: 0, max: 10000 })).toEqual({ min: 0, max: 10000 });
    expect(new ClosureDimension.UnitRange({ min: 0, max: 90 })).toEqual({ min: 0, max: 90 });
    expect(new ClosureDimension.SetTargetRequest({ position: 5000 })).toEqual({ position: 5000 });
    expect(new ClosureDimension.StepRequest({ direction: ClosureDimension.StepDirection.Increase, numberOfSteps: 1 })).toEqual({
      direction: ClosureDimension.StepDirection.Increase,
      numberOfSteps: 1,
    });
  });
});
