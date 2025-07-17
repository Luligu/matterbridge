/**
 * @description This file contains the tests for the error functions.
 * @file error.test.ts
 * @author Luca Liguori
 * @created 2025-07-17
 * @version 1.0.0
 * @license Apache-2.0
 */

import path from 'node:path';
import { rmSync } from 'node:fs';

import { jest } from '@jest/globals';
import { AnsiLogger } from 'node-ansi-logger';

import { logError, inspectError } from './error.js';

const MATTER_PORT = 0;
const NAME = 'Error';
const HOMEDIR = path.join('jest', NAME);

// Cleanup the matter environment
rmSync(HOMEDIR, { recursive: true, force: true });

describe('Error logger', () => {
  let mockLogger: jest.Mocked<AnsiLogger>;

  beforeAll(async () => {});

  beforeEach(async () => {
    // Create a mock logger
    mockLogger = {
      error: jest.fn(),
    } as unknown as jest.Mocked<AnsiLogger>;

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {});

  afterAll(async () => {
    // Restore all mocks
    jest.restoreAllMocks();
  });

  it('should log error message with Error instance including message and stack', () => {
    const testError = new Error('Test error message');
    const testMessage = 'Failed to process';

    logError(mockLogger, testMessage, testError);

    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(`${testMessage}: ${testError.message}\nStack:\n${testError.stack}`);
  });

  it('should log error message with non-Error value', () => {
    const testError = 'Simple string error';
    const testMessage = 'Operation failed';

    logError(mockLogger, testMessage, testError);

    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(`${testMessage}: ${testError}`);
  });

  it('should log error message with null value', () => {
    const testError = null;
    const testMessage = 'Null error occurred';

    logError(mockLogger, testMessage, testError);

    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(`${testMessage}: ${testError}`);
  });

  it('should log error message with undefined value', () => {
    const testError = undefined;
    const testMessage = 'Undefined error occurred';

    logError(mockLogger, testMessage, testError);

    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(`${testMessage}: ${testError}`);
  });

  it('should log error message with number value', () => {
    const testError = 404;
    const testMessage = 'HTTP error';

    logError(mockLogger, testMessage, testError);

    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(`${testMessage}: ${testError}`);
  });

  it('should log error message with object value', () => {
    const testError = { code: 'ENOENT', path: '/missing/file' };
    const testMessage = 'File system error';

    logError(mockLogger, testMessage, testError);

    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(`${testMessage}: ${testError}`);
  });

  it('should handle Error instance with custom properties', () => {
    const testError = new Error('Custom error');
    testError.stack = 'Error: Custom error\n    at test (test.js:1:1)';
    const testMessage = 'Custom error test';

    logError(mockLogger, testMessage, testError);

    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(`${testMessage}: ${testError.message}\nStack:\n${testError.stack}`);
  });

  it('should handle Error instance without stack trace', () => {
    const testError = new Error('Error without stack');
    delete testError.stack;
    const testMessage = 'Stack-less error';

    logError(mockLogger, testMessage, testError);

    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(`${testMessage}: ${testError.message}\nStack:\n${testError.stack}`);
  });

  describe('inspectError', () => {
    it('should log error message with Error instance using inspect', () => {
      const testError = new Error('Test error message');
      const testMessage = 'Failed to process';

      inspectError(mockLogger, testMessage, testError);

      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      const loggedMessage = mockLogger.error.mock.calls[0][0];
      expect(loggedMessage).toContain(`${testMessage}:`);
      expect(loggedMessage).toContain('Error: Test error message');
    });

    it('should log error message with string value using inspect', () => {
      const testError = 'Simple string error';
      const testMessage = 'Operation failed';

      inspectError(mockLogger, testMessage, testError);

      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(`${testMessage}: 'Simple string error'`);
    });

    it('should log error message with null value using inspect', () => {
      const testError = null;
      const testMessage = 'Null error occurred';

      inspectError(mockLogger, testMessage, testError);

      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(`${testMessage}: null`);
    });

    it('should log error message with undefined value using inspect', () => {
      const testError = undefined;
      const testMessage = 'Undefined error occurred';

      inspectError(mockLogger, testMessage, testError);

      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(`${testMessage}: undefined`);
    });

    it('should log error message with number value using inspect', () => {
      const testError = 404;
      const testMessage = 'HTTP error';

      inspectError(mockLogger, testMessage, testError);

      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(`${testMessage}: 404`);
    });

    it('should log error message with complex object using inspect', () => {
      const testError = {
        code: 'ENOENT',
        path: '/missing/file',
        nested: { deep: { value: 'test' } },
      };
      const testMessage = 'File system error';

      inspectError(mockLogger, testMessage, testError);

      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      const loggedMessage = mockLogger.error.mock.calls[0][0];
      expect(loggedMessage).toContain(`${testMessage}:`);
      expect(loggedMessage).toContain("code: 'ENOENT'");
      expect(loggedMessage).toContain("path: '/missing/file'");
      expect(loggedMessage).toContain('nested:');
    });

    it('should log error message with deeply nested object using inspect depth 10', () => {
      const createNestedObject = (depth: number): any => {
        if (depth === 0) return 'deep value';
        return { level: depth, nested: createNestedObject(depth - 1) };
      };

      const testError = createNestedObject(12); // Deeper than 10 levels
      const testMessage = 'Deep nesting error';

      inspectError(mockLogger, testMessage, testError);

      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      const loggedMessage = mockLogger.error.mock.calls[0][0];
      expect(loggedMessage).toContain(`${testMessage}:`);
      expect(loggedMessage).toContain('level: 12');
      // Should show at least 10 levels deep
      expect(loggedMessage).toContain('level: 3');
    });
  });
});
