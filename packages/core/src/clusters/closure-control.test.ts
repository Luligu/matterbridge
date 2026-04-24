// src\clusters\closure-control.test.ts

const NAME = 'ClosureControlCluster';

import { jest } from '@jest/globals';

import { setupTest } from '../jestutils/jestSetupTest.js';
import { ClosureControl } from './closure-control.js';

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
    expect(ClosureControl.Cluster.id).toBe(0x0104);
    expect(ClosureControl.Complete.id).toBe(0x0104);
  });

  test('rejects an empty feature set', () => {
    expect(() => ClosureControl.Cluster.with()).toThrow();
  });

  test('adds CountdownTime only for Positioning and not Instantaneous', () => {
    const ps = ClosureControl.Cluster.with(ClosureControl.Feature.Positioning);
    expect(ps.attributes).toHaveProperty('countdownTime');

    const psIs = ClosureControl.Cluster.with(ClosureControl.Feature.Positioning, ClosureControl.Feature.Instantaneous);
    expect(psIs.attributes).not.toHaveProperty('countdownTime');
  });

  test('adds Stop + MovementCompleted only when NOT Instantaneous', () => {
    const notIs = ClosureControl.Cluster.with(ClosureControl.Feature.MotionLatching);
    expect(notIs.commands).toHaveProperty('stop');
    expect(notIs.events).toHaveProperty('movementCompleted');

    const isEnabled = ClosureControl.Cluster.with(ClosureControl.Feature.MotionLatching, ClosureControl.Feature.Instantaneous);
    expect(isEnabled.commands).not.toHaveProperty('stop');
    expect(isEnabled.events).not.toHaveProperty('movementCompleted');
  });

  test('rejects illegal feature combinations', () => {
    expect(() => ClosureControl.Cluster.with(ClosureControl.Feature.Calibration)).toThrow();
    expect(() => ClosureControl.Cluster.with(ClosureControl.Feature.Speed)).toThrow();
    expect(() => ClosureControl.Cluster.with(ClosureControl.Feature.Positioning, ClosureControl.Feature.Speed, ClosureControl.Feature.Instantaneous)).toThrow();
  });
});
