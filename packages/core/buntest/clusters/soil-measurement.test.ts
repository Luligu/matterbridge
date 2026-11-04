/**
 * @file packages/core/buntest/clusters/soil-measurement.test.ts
 * @description This file contains the bun tests for the SoilMeasurement cluster definition.
 * @author Luca Liguori
 */

import { describe, expect, test } from 'bun:test';

import { SoilMeasurement } from '../../src/clusters/soil-measurement.js';

describe('SoilMeasurement cluster', () => {
  test('identity, attributes and features', () => {
    expect({ id: SoilMeasurement.id, name: SoilMeasurement.name, revision: SoilMeasurement.revision }).toMatchObject({ id: 0x0430, name: 'SoilMeasurement', revision: 1 });
    expect(Object.keys(SoilMeasurement.attributes)).toEqual(expect.arrayContaining(['soilMoistureMeasurementLimits', 'soilMoistureMeasuredValue']));
    expect(SoilMeasurement.features).toEqual({});
  });
});
