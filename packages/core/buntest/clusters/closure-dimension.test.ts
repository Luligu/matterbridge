/**
 * @file packages/core/buntest/clusters/closure-dimension.test.ts
 * @description This file contains the bun tests for the ClosureDimension cluster definition.
 * @author Luca Liguori
 */

import { describe, expect, test } from 'bun:test';

import { ThreeLevelAuto } from '@matter/types/globals';

import { ClosureDimension } from '../../src/clusters/closure-dimension.js';
import { expectClusterRegistration } from './registration.js';

describe('ClosureDimension cluster', () => {
  test('identity, features, attributes and commands', () => {
    expect({ id: ClosureDimension.id, name: ClosureDimension.name, revision: ClosureDimension.revision }).toMatchObject({ id: 0x0105, name: 'ClosureDimension', revision: 1 });
    const features = ['Positioning', 'MotionLatching', 'Unit', 'Limitation', 'Speed', 'Translation', 'Rotation', 'Modulation'];
    expect(Object.entries(ClosureDimension.Feature)).toEqual(features.map((feature) => [feature, feature]));
    expect(new ClosureDimension.FeatureMap({ positioning: true, unit: true })).toMatchObject({ positioning: true, unit: true });
    expect(Object.keys(ClosureDimension.attributes)).toEqual(
      expect.arrayContaining([
        'currentState',
        'targetState',
        'resolution',
        'stepValue',
        'unit',
        'unitRange',
        'limitRange',
        'translationDirection',
        'rotationAxis',
        'overflow',
        'modulationType',
        'latchControlModes',
      ]),
    );
    expect(Object.keys(ClosureDimension.commands)).toEqual(expect.arrayContaining(['setTarget', 'step']));
  });

  test('enum, struct and bitmap values', () => {
    expect(ClosureDimension.ClosureUnit.Degree).toBe(1);
    expect(ClosureDimension.ModulationType.Ventilation).toBe(4);
    expect(ClosureDimension.Overflow.RightOutside).toBe(10);
    expect(ClosureDimension.RotationAxis.RightBarrier).toBe(10);
    expect(ClosureDimension.StepDirection.Increase).toBe(1);
    expect(ClosureDimension.TranslationDirection.DepthSymmetry).toBe(11);
    expect(new ClosureDimension.LatchControlModes({ remoteUnlatching: true })).toMatchObject({ remoteUnlatching: true });
    // DimensionState fills the missing latch field with null.
    expect({ ...new ClosureDimension.DimensionState({ position: null, speed: ThreeLevelAuto.Auto }) }).toEqual({ latch: null, position: null, speed: ThreeLevelAuto.Auto });
    expect(new ClosureDimension.RangePercent100ths({ min: 0, max: 10000 })).toMatchObject({ min: 0, max: 10000 });
    expect(new ClosureDimension.UnitRange({ min: 0, max: 90 })).toMatchObject({ min: 0, max: 90 });
    expect(new ClosureDimension.SetTargetRequest({ position: 5000 })).toMatchObject({ position: 5000 });
    expect(new ClosureDimension.StepRequest({ direction: ClosureDimension.StepDirection.Increase, numberOfSteps: 1 })).toMatchObject({
      direction: ClosureDimension.StepDirection.Increase,
      numberOfSteps: 1,
    });
  });

  test('registers the definition and the model when matter.js does not ship the cluster', async () => {
    const specifier = '../../src/clusters/closure-dimension.js?register';
    await expectClusterRegistration(0x0105, async () => (await import(specifier)) as Record<string, unknown>, 'ClosureDimension');
  });
});
