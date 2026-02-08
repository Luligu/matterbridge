/**
 * @description This file contains a dummy test.
 * @file dummy.test.ts
 * @author Luca Liguori
 * @created 2026-01-12
 * @version 1.0.0
 * @license Apache-2.0
 */

import { jest } from '@jest/globals';

describe('Dummy test suite', () => {
  beforeAll(async () => {});

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {});

  afterAll(async () => {
    // Restore all mocks
    jest.restoreAllMocks();
  });

  it('dummy test', () => {
    expect(true).toBe(true);
  });
});
