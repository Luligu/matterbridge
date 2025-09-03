// src\esm-fs-unstable-mock.test.ts

// ESM unstable mock of 'node:fs'

jest.unstable_mockModule('node:fs', () => {
  const originalModule = jest.requireActual<typeof import('node:fs')>('node:fs');
  return {
    ...originalModule,

    existsSync: jest.fn<typeof existsSync>((path: PathLike) => {
      return originalModule.existsSync(path);
    }),
  };
});
const { existsSync, promises } = await import('node:fs');
import type { PathLike } from 'node:fs';

import { jest } from '@jest/globals';

describe('ESM module node:fs unstable mock test', () => {
  it('should check the ESM mock module', async () => {
    const not_a_file = (await import('./esm-unstable-mock.ts')).not_a_file;
    expect(not_a_file).toBeDefined();

    // Before mocking, check the original behavior
    expect(not_a_file()).toBe(false);

    // Mock the existsSync function to always return true
    (existsSync as jest.Mocked<typeof existsSync>).mockImplementation((path: PathLike) => {
      return true;
    });
    expect(not_a_file()).toBe(true);
  });
});
