// test\esm-fs-unstable-mock.test.ts

// ESM unstable mock of 'node:fs'

jest.unstable_mockModule('node:fs', () => {
  const originalModule = jest.requireActual<typeof import('node:fs')>('node:fs');
  return {
    ...originalModule,

    existsSync: jest.fn<typeof existsSync>((path: PathLike) => {
      return originalModule.existsSync(path);
    }),
    promises: {
      rmdir: jest.fn((path: PathLike, options?: RmDirOptions) => {
        return originalModule.promises.rmdir(path, options);
      }),
      mkdir: jest.fn((path: PathLike, options?: Mode | MakeDirectoryOptions | null) => {
        return originalModule.promises.mkdir(path, options);
      }),
    },
  };
});
const { existsSync, promises } = await import('node:fs');

import type { PathLike, MakeDirectoryOptions, Mode, RmDirOptions } from 'node:fs';
import type { mkdir } from 'node:fs/promises';

import { jest } from '@jest/globals';

describe('ESM module node:fs unstable mock module test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call original fs.existsSync methods', async () => {
    expect(existsSync('/.notexist')).toBe(false);
    expect(existsSync('package.json')).toBe(true);
    expect(existsSync).toHaveBeenCalledTimes(2);
  });

  it('should mock fs.existsSync to return true for specific paths', async () => {
    (existsSync as jest.Mocked<typeof existsSync>).mockImplementation((path: PathLike) => {
      return path === '/.dockerenv' || path === 'package.json';
    });
    expect(existsSync('/.dockerenv')).toBe(true);
    expect(existsSync('package.json')).toBe(true);
    expect(existsSync('tsconfig.json')).toBe(false);
    expect(existsSync).toHaveBeenCalledTimes(3);
  });

  it('should call original fs.promises.mkdir methods', async () => {
    // Prepare removing the directory
    await promises.rmdir('temp_dir').catch(() => {
      // Ignore error if the directory does not exist
    });
    expect(promises.rmdir).toHaveBeenCalledTimes(1);

    await expect(promises.mkdir('temp_dir')).resolves.toBeUndefined();
    expect(promises.mkdir).toHaveBeenCalledTimes(1);

    // Clean up by removing the directory
    await promises.rmdir('temp_dir').catch(() => {
      // Ignore error if the directory does not exist
    });
    expect(promises.rmdir).toHaveBeenCalledTimes(2);
  });

  it('should mock fs.promises.mkdir methods', async () => {
    // Prepare removing the directory
    await promises.rmdir('temp_dir').catch(() => {
      // Ignore error if the directory does not exist
    });
    expect(promises.rmdir).toHaveBeenCalledTimes(1);

    (promises.mkdir as jest.Mocked<typeof mkdir>).mockImplementation((path: PathLike, options?: Mode | MakeDirectoryOptions | null) => {
      return Promise.resolve(undefined);
    });
    await expect(promises.mkdir('temp_dir')).resolves.toBe(undefined);
    await expect(promises.mkdir('temp_dir', { recursive: true })).resolves.toBe(undefined);
    expect(promises.mkdir).toHaveBeenCalledTimes(2);

    // Clean up by removing the directory
    await promises.rmdir('temp_dir').catch(() => {
      // Ignore error if the directory does not exist
    });
    expect(promises.rmdir).toHaveBeenCalledTimes(2);
  });
});
