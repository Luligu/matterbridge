/* eslint-disable n/no-missing-import */

jest.mock('node:fs', () => {
  const originalModule = jest.requireActual('node:fs');
  return {
    ...originalModule,
    existsSync: jest.fn((path: PathLike) => {
      // console.log(`node:fs called mocked existsSync(${path})`);
      return originalModule.existsSync(path);
    }),
  };
});
import { existsSync, PathLike } from 'node:fs';
const existsSyncMock = existsSync as jest.MockedFunction<typeof existsSync>;

describe('ESM module node:fs unstable mock test', () => {
  it('should not mock existsSync', async () => {
    expect(existsSync('not_a_file_1')).toBeFalsy();
  });

  it('mock once the implementation of existsSync', async () => {
    // Mock the existsSync function to always return true
    const mocked = existsSyncMock.mockImplementationOnce((path) => {
      // console.log(`node:fs called mocked implementation of existsSync(${path})`);
      return true;
    });
    expect(mocked).toBeDefined();
  });

  it('should use the once mock implementation of existsSync', async () => {
    expect(existsSync('not_a_file_2')).toBeTruthy();
  });

  it('should not use the once mock implementation of existsSync', async () => {
    expect(existsSync('not_a_file_2')).toBeFalsy();
  });

  it('mock the implementation of existsSync', async () => {
    // Mock the existsSync function to always return true
    const mocked = existsSyncMock.mockImplementation((path: PathLike) => {
      // console.log(`node:fs called mocked implementation of existsSync(${path})`);
      return true;
    });
    expect(mocked).toBeDefined();
  });

  it('should use the mock implementation of existsSync', async () => {
    expect(existsSync('not_a_file_2')).toBeTruthy();
  });

  it('unmock the implementation of existsSync', async () => {
    // Unmock the existsSync function to always return true
    existsSyncMock.mockRestore();
    expect(existsSyncMock).toBeDefined();
  });

  it('should not use the mock implementation of existsSync', async () => {
    expect(existsSync('not_a_file_2')).toBeFalsy();
  });

  it('should use the ESM mock module', async () => {
    const { not_a_file } = await import('../src/jest/esm-fs-unstable-mock');
    expect(not_a_file).toBeDefined();

    // Before mocking the implementation
    expect(not_a_file()).toBeFalsy();

    // Mock the existsSync function to always return true
    existsSyncMock.mockImplementation((path: PathLike) => {
      return true;
    });

    // After mocking the implementation
    expect(not_a_file()).toBeTruthy();
  });
});
