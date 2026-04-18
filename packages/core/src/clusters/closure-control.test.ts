// src\clusters\closure-control.test.ts

const NAME = 'ClosureControlCluster';

import { jest } from '@jest/globals';

import { setupTest } from '../jestutils/jestSetupTest.js';
import { ClosureControl } from './closure-control.js';

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
    expect(ClosureControl.id).toBe(0x0104);
  });

  test('allows an empty feature selection', () => {
    const cluster = ClosureControl.with();

    expect(cluster.id).toBe(ClosureControl.id);
    expect(getSupportedFeatures(cluster)).toEqual({});
  });

  test('retains CountdownTime even when Instantaneous is selected', () => {
    const ps = ClosureControl.with(ClosureControl.Feature.Positioning);
    expect(ps.attributes).toHaveProperty('countdownTime');
    expect(getSupportedFeatures(ps)).toEqual({ positioning: true });

    const psIs = ClosureControl.with(ClosureControl.Feature.Positioning, ClosureControl.Feature.Instantaneous);
    expect(psIs.attributes).toHaveProperty('countdownTime');
    expect(getSupportedFeatures(psIs)).toEqual({ positioning: true, instantaneous: true });
  });

  test('retains Stop and MovementCompleted when Instantaneous is selected', () => {
    const notIs = ClosureControl.with(ClosureControl.Feature.MotionLatching);
    expect(notIs.commands).toHaveProperty('stop');
    expect(notIs.events).toHaveProperty('movementCompleted');

    const isEnabled = ClosureControl.with(ClosureControl.Feature.MotionLatching, ClosureControl.Feature.Instantaneous);
    expect(isEnabled.commands).toHaveProperty('stop');
    expect(isEnabled.events).toHaveProperty('movementCompleted');
  });

  test('allows combinations that were previously validated locally', () => {
    expect(getSupportedFeatures(ClosureControl.with(ClosureControl.Feature.Calibration))).toEqual({ calibration: true });
    expect(getSupportedFeatures(ClosureControl.with(ClosureControl.Feature.Speed))).toEqual({ speed: true });
    expect(getSupportedFeatures(ClosureControl.with(ClosureControl.Feature.Positioning, ClosureControl.Feature.Speed, ClosureControl.Feature.Instantaneous))).toEqual({
      positioning: true,
      speed: true,
      instantaneous: true,
    });
  });

  test('allows positioning-only features when MotionLatching is selected without Positioning', () => {
    expect(getSupportedFeatures(ClosureControl.with(ClosureControl.Feature.MotionLatching, ClosureControl.Feature.Ventilation))).toEqual({
      motionLatching: true,
      ventilation: true,
    });
  });

  test('creates a new namespace for repeated feature selections', () => {
    const first = ClosureControl.with(ClosureControl.Feature.Positioning, ClosureControl.Feature.Ventilation);
    const second = ClosureControl.with(ClosureControl.Feature.Ventilation, ClosureControl.Feature.Positioning, ClosureControl.Feature.Ventilation);

    expect(second).not.toBe(first);
    expect(getSupportedFeatures(second)).toEqual(getSupportedFeatures(first));
  });
});
