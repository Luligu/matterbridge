/**
 * @file packages/core/buntest/matterLogger.test.ts
 * @description This file contains the tests for matterLogger.
 * @author Luca Liguori
 */

const NAME = 'MatterLogger';

import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from 'bun:test';
import path from 'node:path';

import { Diagnostic, LogFormat as MatterLogFormat, Logger, LogLevel as MatterLogLevel } from '@matter/general';
import { getSharedMatterbridge } from '@matterbridge/test-utils/buntest/matter';
import { log, loggerDebugSpy, loggerLogSpy, setupTest } from '@matterbridge/test-utils/buntest/setup';
import { MATTER_LOGGER_FILE, MATTERBRIDGE_LOGGER_FILE, type SharedMatterbridge } from '@matterbridge/types';
import { AnsiLogger, LogLevel } from 'node-ansi-logger';

import { ansiToMatterLogLevel, createDestinationMatterLogger, matterToAnsiLogLevel, setupLoggers } from '../src/matterLogger.js';

// Setup the test environment
await setupTest(NAME, false);

describe('matterLogger', () => {
  const originalWrite = Logger.destinations.default.write;
  const originalFormat = Logger.format;
  let matterLog: AnsiLogger;
  // Never set the real global log file
  const setGlobalLogfileSpy = vi.spyOn(AnsiLogger, 'setGlobalLogfile').mockImplementation(() => {});

  /**
   * Builds a matterbridge object with the requested file logger flags.
   *
   * @param {boolean} fileLogger - The matterbridge file logger flag.
   * @param {boolean} matterFileLogger - The matter file logger flag.
   * @returns {SharedMatterbridge} The matterbridge object.
   */
  function getMatterbridge(fileLogger: boolean, matterFileLogger: boolean): SharedMatterbridge {
    return { ...getSharedMatterbridge(), logLevel: LogLevel.DEBUG, fileLogger, matterFileLogger };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    matterLog = new AnsiLogger({ logName: 'TestMatterLog', logLevel: LogLevel.DEBUG });
  });

  afterEach(() => {
    Logger.destinations.default.write = originalWrite;
    Logger.format = originalFormat;
  });

  afterAll(() => {
    setGlobalLogfileSpy.mockRestore();
  });

  test('matterToAnsiLogLevel converts every matter.js log level', () => {
    expect(matterToAnsiLogLevel(MatterLogLevel.DEBUG)).toBe(LogLevel.DEBUG);
    expect(matterToAnsiLogLevel(MatterLogLevel.INFO)).toBe(LogLevel.INFO);
    expect(matterToAnsiLogLevel(MatterLogLevel.NOTICE)).toBe(LogLevel.NOTICE);
    expect(matterToAnsiLogLevel(MatterLogLevel.WARN)).toBe(LogLevel.WARN);
    expect(matterToAnsiLogLevel(MatterLogLevel.ERROR)).toBe(LogLevel.ERROR);
    expect(matterToAnsiLogLevel(MatterLogLevel.FATAL)).toBe(LogLevel.FATAL);
  });

  test('ansiToMatterLogLevel converts every AnsiLogger log level', () => {
    expect(ansiToMatterLogLevel(LogLevel.DEBUG)).toBe(MatterLogLevel.DEBUG);
    expect(ansiToMatterLogLevel(LogLevel.INFO)).toBe(MatterLogLevel.INFO);
    expect(ansiToMatterLogLevel(LogLevel.NOTICE)).toBe(MatterLogLevel.NOTICE);
    expect(ansiToMatterLogLevel(LogLevel.WARN)).toBe(MatterLogLevel.WARN);
    expect(ansiToMatterLogLevel(LogLevel.ERROR)).toBe(MatterLogLevel.ERROR);
    expect(ansiToMatterLogLevel(LogLevel.FATAL)).toBe(MatterLogLevel.FATAL);
    expect(ansiToMatterLogLevel(LogLevel.NONE)).toBe(MatterLogLevel.FATAL);
  });

  test('setupLoggers without file loggers and not verbose', () => {
    const matterbridge = getMatterbridge(false, false);

    setupLoggers(matterbridge, log, matterLog, false);
    expect(setGlobalLogfileSpy).not.toHaveBeenCalled();
    expect(Logger.destinations.default.write).not.toBe(originalWrite);
    expect(matterLog.logFilePath).toBeUndefined();
    expect(loggerDebugSpy).not.toHaveBeenCalledWith(expect.stringContaining('logLevel'));
  });

  test('setupLoggers with file loggers and verbose', () => {
    const matterbridge = getMatterbridge(true, true);

    setupLoggers(matterbridge, log, matterLog, true);
    expect(setGlobalLogfileSpy).toHaveBeenCalledWith(path.join(matterbridge.matterbridgeDirectory, MATTERBRIDGE_LOGGER_FILE), LogLevel.DEBUG);
    expect(matterLog.logFilePath).toBe(path.resolve(matterbridge.matterbridgeDirectory, MATTER_LOGGER_FILE));
    expect(loggerDebugSpy).toHaveBeenCalledWith(`Matterbridge logLevel: ${log.logLevel} fileLogger: true.`);
    expect(loggerDebugSpy).toHaveBeenCalledWith(`Matter logLevel: ${matterLog.logLevel} fileLogger: true.`);
  });

  test('createDestinationMatterLogger logs a PLAIN matter.js message', () => {
    Logger.format = MatterLogFormat.PLAIN;
    const destinationLogger = createDestinationMatterLogger(getMatterbridge(false, false), log, matterLog);

    destinationLogger('2026-03-31 16:02:26.974 INFO Facility Plain message', Diagnostic.message({ now: new Date(), level: MatterLogLevel.INFO, facility: 'Facility' }));
    expect(matterLog.logName).toBe('Facility');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Plain message');
  });

  test('createDestinationMatterLogger logs a PLAIN matter.js message without the facility in the text', () => {
    Logger.format = MatterLogFormat.PLAIN;
    const destinationLogger = createDestinationMatterLogger(getMatterbridge(false, false), log, matterLog);

    destinationLogger('2026-03-31 16:02:26.974 INFO Other message', Diagnostic.message({ now: new Date(), level: MatterLogLevel.INFO, facility: 'Facility' }));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, undefined);
  });

  test('createDestinationMatterLogger logs an ANSI matter.js message', () => {
    Logger.format = MatterLogFormat.ANSI;
    const destinationLogger = createDestinationMatterLogger(getMatterbridge(false, false), log, matterLog);

    destinationLogger('x'.repeat(65) + 'Ansi message', Diagnostic.message({ now: new Date(), level: MatterLogLevel.WARN, facility: 'Facility' }));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.WARN, 'Ansi message');
  });

  test('createDestinationMatterLogger logs a debug message when a matter.js message cannot be logged', () => {
    vi.spyOn(matterLog, 'log').mockImplementationOnce(() => {
      throw new Error('Matter log failure');
    });
    const destinationLogger = createDestinationMatterLogger(getMatterbridge(false, false), log, matterLog);

    destinationLogger('2026-03-31 16:02:26.974 DEBUG Facility Message', Diagnostic.message({ now: new Date(), level: MatterLogLevel.DEBUG, facility: 'Facility' }));
    expect(loggerDebugSpy).toHaveBeenCalledWith('Error parsing matter log message facility Facility');
  });
});
