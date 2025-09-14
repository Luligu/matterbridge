// src/utils/createZip.mocked.test.ts

const NAME = 'CreateZipMocked';

import { jest } from '@jest/globals';
import { LogLevel } from 'node-ansi-logger';

import { loggerLogSpy, setupTest } from './jestHelpers.ts';

// Mock all external dependencies before importing the module under test
const mockCreateWriteStream = jest.fn();
const mockStatSync = jest.fn();
const mockGlobSync = jest.fn();
const mockArchiver = jest.fn();

// Mock node:fs
jest.unstable_mockModule('node:fs', () => ({
  createWriteStream: mockCreateWriteStream,
  statSync: mockStatSync,
}));

// Mock node:path
jest.unstable_mockModule('node:path', () => ({
  basename: jest.fn((path: string) => path.split('/').pop() || path.split('\\').pop() || path),
}));

// Mock glob
jest.unstable_mockModule('glob', () => ({
  glob: {
    sync: mockGlobSync,
  },
}));

// Mock archiver
jest.unstable_mockModule('archiver', () => ({
  default: mockArchiver,
}));

// Import the module under test after mocking
const { createZip } = await import('./createZip.ts');

// Setup the test environment
setupTest(NAME, false);

describe('createZip (mocked)', () => {
  let mockArchiveInstance: any;
  let mockOutputStreamInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock archive instance
    mockArchiveInstance = {
      pipe: jest.fn(),
      file: jest.fn(),
      directory: jest.fn(),
      finalize: jest.fn().mockReturnValue(Promise.resolve()),
      pointer: jest.fn().mockReturnValue(12345),
      on: jest.fn(),
    };

    // Setup mock output stream instance
    mockOutputStreamInstance = {
      on: jest.fn(),
    };

    // Setup archiver mock
    mockArchiver.mockReturnValue(mockArchiveInstance);
    mockCreateWriteStream.mockReturnValue(mockOutputStreamInstance);
  });

  it('should create archive successfully and resolve with bytes written', async () => {
    // Mock file stats
    mockStatSync.mockReturnValue({
      isFile: () => true,
      isDirectory: () => false,
    });

    // Simulate output stream 'close' event
    mockOutputStreamInstance.on.mockImplementation((event: string, callback: () => void) => {
      if (event === 'close') {
        setTimeout(() => callback(), 0);
      }
    });

    const promise = createZip('/test/output.zip', '/test/file.txt');

    // Wait for the close event to be triggered
    await Promise.resolve();

    const result = await promise;
    expect(result).toBe(12345);
    expect(mockArchiver).toHaveBeenCalledWith('zip', { zlib: { level: 9 } });
    expect(mockArchiveInstance.file).toHaveBeenCalledWith('/test/file.txt', { name: 'file.txt' });
    expect(mockArchiveInstance.finalize).toHaveBeenCalled();
  });

  it('should handle directory source path', async () => {
    // Mock directory stats
    mockStatSync.mockReturnValue({
      isFile: () => false,
      isDirectory: () => true,
    });

    // Simulate output stream 'close' event
    mockOutputStreamInstance.on.mockImplementation((event: string, callback: () => void) => {
      if (event === 'close') {
        setTimeout(() => callback(), 0);
      }
    });

    const promise = createZip('/test/output.zip', '/test/directory');

    await Promise.resolve();

    const result = await promise;
    expect(result).toBe(12345);
    expect(mockArchiveInstance.directory).toHaveBeenCalledWith('/test/directory', 'directory');
  });

  it('should handle glob patterns when statSync throws error', async () => {
    // Mock statSync to throw error (file not found)
    mockStatSync.mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory');
    });

    // Mock glob to return matching files
    mockGlobSync.mockReturnValue(['/test/file1.js', '/test/file2.js']);

    // Simulate output stream 'close' event
    mockOutputStreamInstance.on.mockImplementation((event: string, callback: () => void) => {
      if (event === 'close') {
        setTimeout(() => callback(), 0);
      }
    });

    const promise = createZip('/test/output.zip', '/test/*.js');

    await Promise.resolve();

    const result = await promise;
    expect(result).toBe(12345);
    expect(mockGlobSync).toHaveBeenCalledWith('/test/*.js');
    expect(mockArchiveInstance.file).toHaveBeenCalledWith('/test/file1.js', { name: '/test/file1.js' });
    expect(mockArchiveInstance.file).toHaveBeenCalledWith('/test/file2.js', { name: '/test/file2.js' });
  });

  it('should handle Windows path separators in glob patterns', async () => {
    // Mock statSync to throw error
    mockStatSync.mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory');
    });

    // Mock glob to return matching files
    mockGlobSync.mockReturnValue(['/test/file1.js']);

    // Simulate output stream 'close' event
    mockOutputStreamInstance.on.mockImplementation((event: string, callback: () => void) => {
      if (event === 'close') {
        setTimeout(() => callback(), 0);
      }
    });

    const promise = createZip('/test/output.zip', 'C:\\test\\*.js');

    await Promise.resolve();

    await promise;

    // Verify that Windows backslashes are converted to forward slashes for glob
    expect(mockGlobSync).toHaveBeenCalledWith('C:/test/*.js');
  });

  it('should handle non-glob pattern when statSync throws error', async () => {
    // Mock statSync to throw error
    mockStatSync.mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory');
    });

    // Simulate output stream 'close' event
    mockOutputStreamInstance.on.mockImplementation((event: string, callback: () => void) => {
      if (event === 'close') {
        setTimeout(() => callback(), 0);
      }
    });

    const promise = createZip('/test/output.zip', '/test/nonexistent.txt');

    await Promise.resolve();

    const result = await promise;
    expect(result).toBe(12345);

    // Should log error for non-existent file that's not a glob pattern
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('no files or directory found for pattern /test/nonexistent.txt'));
  });

  it('should handle multiple source paths', async () => {
    // Mock different types of source paths
    let callCount = 0;
    mockStatSync.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { isFile: () => true, isDirectory: () => false };
      } else if (callCount === 2) {
        return { isFile: () => false, isDirectory: () => true };
      } else {
        throw new Error('ENOENT: no such file or directory');
      }
    });

    mockGlobSync.mockReturnValue(['/test/glob1.js', '/test/glob2.js']);

    // Simulate output stream 'close' event
    mockOutputStreamInstance.on.mockImplementation((event: string, callback: () => void) => {
      if (event === 'close') {
        setTimeout(() => callback(), 0);
      }
    });

    const promise = createZip('/test/output.zip', '/test/file.txt', '/test/directory', '/test/*.js');

    await Promise.resolve();

    const result = await promise;
    expect(result).toBe(12345);
    expect(mockArchiveInstance.file).toHaveBeenCalledWith('/test/file.txt', { name: 'file.txt' });
    expect(mockArchiveInstance.directory).toHaveBeenCalledWith('/test/directory', 'directory');
    expect(mockArchiveInstance.file).toHaveBeenCalledWith('/test/glob1.js', { name: '/test/glob1.js' });
    expect(mockArchiveInstance.file).toHaveBeenCalledWith('/test/glob2.js', { name: '/test/glob2.js' });
  });

  it('should reject when archive finalize throws error', async () => {
    // Mock file stats
    mockStatSync.mockReturnValue({
      isFile: () => true,
      isDirectory: () => false,
    });

    // Mock finalize to throw error
    const finalizeError = new Error('Finalize failed');
    mockArchiveInstance.finalize.mockRejectedValue(finalizeError);

    await expect(createZip('/test/output.zip', '/test/file.txt')).rejects.toThrow('Finalize failed');
  });

  it('should handle archive error event', async () => {
    // Mock file stats
    mockStatSync.mockReturnValue({
      isFile: () => true,
      isDirectory: () => false,
    });

    let errorCallback: (error: any) => void;
    mockArchiveInstance.on.mockImplementation((event: string, callback: (error: any) => void) => {
      if (event === 'error') {
        errorCallback = callback;
      }
    });

    const promise = createZip('/test/output.zip', '/test/file.txt');

    // Simulate archive error
    const archiveError = { message: 'Archive error occurred' };
    setTimeout(() => errorCallback(archiveError), 0);

    await expect(promise).rejects.toEqual(archiveError);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, 'archive error: Archive error occurred');
  });

  it('should handle archive warning event with ENOENT code', async () => {
    // Mock file stats
    mockStatSync.mockReturnValue({
      isFile: () => true,
      isDirectory: () => false,
    });

    let warningCallback: (warning: any) => void;
    let closeCallback: () => void;

    mockArchiveInstance.on.mockImplementation((event: string, callback: () => void) => {
      if (event === 'warning') {
        warningCallback = callback;
      }
    });

    mockOutputStreamInstance.on.mockImplementation((event: string, callback: () => void) => {
      if (event === 'close') {
        closeCallback = callback;
      }
    });

    const promise = createZip('/test/output.zip', '/test/file.txt');

    // Simulate archive warning with ENOENT code
    const warning = { code: 'ENOENT', message: 'File not found warning' };
    setTimeout(() => {
      warningCallback(warning);
      closeCallback(); // Complete the archive process
    }, 0);

    await Promise.resolve();

    const result = await promise;
    expect(result).toBe(12345);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.WARN, 'archive warning: File not found warning');
  });

  it('should handle archive warning event with non-ENOENT code', async () => {
    // Mock file stats
    mockStatSync.mockReturnValue({
      isFile: () => true,
      isDirectory: () => false,
    });

    let warningCallback: (warning: any) => void;
    mockArchiveInstance.on.mockImplementation((event: string, callback: (warning: any) => void) => {
      if (event === 'warning') {
        warningCallback = callback;
      }
    });

    const promise = createZip('/test/output.zip', '/test/file.txt');

    // Simulate archive warning with non-ENOENT code
    const warning = { code: 'OTHER_ERROR', message: 'Serious warning' };
    setTimeout(() => warningCallback(warning), 0);

    await expect(promise).rejects.toEqual(warning);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, 'archive warning: Serious warning');
  });

  it('should handle output stream end event', async () => {
    // Mock file stats
    mockStatSync.mockReturnValue({
      isFile: () => true,
      isDirectory: () => false,
    });

    let endCallback: () => void;
    let closeCallback: () => void;

    mockOutputStreamInstance.on.mockImplementation((event: string, callback: () => void) => {
      if (event === 'end') {
        endCallback = callback;
      } else if (event === 'close') {
        closeCallback = callback;
      }
    });

    const promise = createZip('/test/output.zip', '/test/file.txt');

    // Simulate output stream events
    setTimeout(() => {
      endCallback();
      closeCallback();
    }, 0);

    await Promise.resolve();

    const result = await promise;
    expect(result).toBe(12345);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'archive /test/output.zip data has been drained 12345 total bytes');
  });

  it('should handle archive entry event', async () => {
    // Mock file stats
    mockStatSync.mockReturnValue({
      isFile: () => true,
      isDirectory: () => false,
    });

    let entryCallback: (entry: any) => void;
    let closeCallback: () => void;

    mockArchiveInstance.on.mockImplementation((event: string, callback: (entry: any) => void) => {
      if (event === 'entry') {
        entryCallback = callback;
      }
    });

    mockOutputStreamInstance.on.mockImplementation((event: string, callback: () => void) => {
      if (event === 'close') {
        closeCallback = callback;
      }
    });

    const promise = createZip('/test/output.zip', '/test/file.txt');

    // Simulate archive entry event
    const entryData = { name: 'file.txt' };
    setTimeout(() => {
      entryCallback(entryData);
      closeCallback();
    }, 0);

    await Promise.resolve();

    const result = await promise;
    expect(result).toBe(12345);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, '- archive entry: file.txt');
  });

  it('should handle empty glob results', async () => {
    // Mock statSync to throw error
    mockStatSync.mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory');
    });

    // Mock glob to return empty array
    mockGlobSync.mockReturnValue([]);

    // Simulate output stream 'close' event
    mockOutputStreamInstance.on.mockImplementation((event: string, callback: () => void) => {
      if (event === 'close') {
        setTimeout(() => callback(), 0);
      }
    });

    const promise = createZip('/test/output.zip', '/test/*.nonexistent');

    await Promise.resolve();

    const result = await promise;
    expect(result).toBe(12345);
    expect(mockGlobSync).toHaveBeenCalledWith('/test/*.nonexistent');
    // Should not call archive.file for empty glob results
    expect(mockArchiveInstance.file).not.toHaveBeenCalled();
  });
});
