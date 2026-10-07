/**
 * @file packages/utils/buntest/diagnostic.test.ts
 * @description This file contains the tests for the diagnostic functions.
 * @author Luca Liguori
 */

import { describe, expect, it, spyOn } from 'bun:test';

import { writeDiagnostic } from '../src/diagnostic.js';

describe('writeDiagnostic()', () => {
  it('should write a diagnostic message to stderr', () => {
    const stderrWriteSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      writeDiagnostic('CheckUpdates', 'fetching plugins');

      expect(stderrWriteSpy).toHaveBeenCalledTimes(1);
      expect(stderrWriteSpy).toHaveBeenCalledWith('\u001B[37;44m[diagnostic]\u001B[0m CheckUpdates: fetching plugins\n');
    } finally {
      stderrWriteSpy.mockRestore();
    }
  });
});
