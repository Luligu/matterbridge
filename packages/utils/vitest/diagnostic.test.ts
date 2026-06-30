/**
 * This file contains the tests for the diagnostic functions.
 *
 * @file diagnostic.test.ts
 * @author Luca Liguori
 * @created 2026-06-30
 * @version 1.0.0
 * @license Apache-2.0
 */

import { writeDiagnostic } from '../src/diagnostic.js';

describe('writeDiagnostic()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should write a diagnostic message to stderr', () => {
    const stderrWriteSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    writeDiagnostic('CheckUpdates', 'fetching plugins');

    expect(stderrWriteSpy).toHaveBeenCalledTimes(1);
    expect(stderrWriteSpy).toHaveBeenCalledWith('\u001B[37;44m[diagnostic]\u001B[0m CheckUpdates: fetching plugins\n');
  });
});
