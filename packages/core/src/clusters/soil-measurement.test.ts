// src\clusters\soil-measurement.test.ts

const NAME = 'SoilMeasurementCluster';

import { jest } from '@jest/globals';

import { setupTest } from '../jestutils/jestSetupTest.js';
import { SoilMeasurement } from './soil-measurement.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  test('has stable id and required attributes', () => {
    expect(SoilMeasurement.Cluster.id).toBe(0x0430);
    expect(SoilMeasurement.Cluster.attributes).toHaveProperty('soilMoistureMeasurementLimits');
    expect(SoilMeasurement.Cluster.attributes).toHaveProperty('soilMoistureMeasuredValue');
  });
});
