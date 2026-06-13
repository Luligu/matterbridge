// src\clusters\soil-measurement.test.ts

const NAME = 'SoilMeasurementCluster';

import { jest } from '@jest/globals';

import { SoilMeasurement } from '../../src/clusters/soil-measurement.js';
import { setupTest } from '../../src/jestutils/jestSetupTest.js';

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
    expect(SoilMeasurement.id).toBe(0x0430);
    expect(SoilMeasurement.name).toBe('SoilMeasurement');
    expect(SoilMeasurement.revision).toBe(1);
  });

  test('exposes the expected attributes', () => {
    expect(SoilMeasurement.attributes).toHaveProperty('soilMoistureMeasurementLimits');
    expect(SoilMeasurement.attributes).toHaveProperty('soilMoistureMeasuredValue');
  });

  test('has no feature selection helpers', () => {
    expect(SoilMeasurement.features).toEqual({});
  });
});
