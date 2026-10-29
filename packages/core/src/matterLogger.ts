/**
 * @file packages/core/src/matterLogger.ts
 * @description This file contains the functions for setting up the matterbridge and matter.js loggers.
 * @author Luca Liguori
 * @created 2026-10-29
 * @version 1.0.0
 * @license Apache-2.0
 *
 * Copyright 2025, 2026 Luca Liguori.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// WARNING: Not released yet and excluded from Vitest coverage

// Node modules
import path from 'node:path';

// @matter
import { type Diagnostic, LogFormat as MatterLogFormat, Logger, LogLevel as MatterLogLevel } from '@matter/general';
// @matterbridge
import { MATTER_LOGGER_FILE, MATTERBRIDGE_LOGGER_FILE, type SharedMatterbridge } from '@matterbridge/types';
// Ansi Logger module
import { AnsiLogger, LogLevel } from 'node-ansi-logger';

/**
 * Converts a matter.js log level to the corresponding AnsiLogger log level.
 *
 * @param {MatterLogLevel} level - The matter.js log level.
 * @returns {LogLevel} The AnsiLogger log level.
 */
export function matterToAnsiLogLevel(level: MatterLogLevel): LogLevel {
  switch (level) {
    case 0:
      return LogLevel.DEBUG;
    case 1:
      return LogLevel.INFO;
    case 2:
      return LogLevel.NOTICE;
    case 3:
      return LogLevel.WARN;
    case 4:
      return LogLevel.ERROR;
    default:
      return LogLevel.FATAL;
  }
}

/**
 * Converts an AnsiLogger log level to the corresponding matter.js log level.
 * AnsiLogger NONE has no matter.js equivalent and is mapped to FATAL, the least verbose level.
 *
 * @param {LogLevel} level - The AnsiLogger log level.
 * @returns {MatterLogLevel} The matter.js log level.
 */
export function ansiToMatterLogLevel(level: LogLevel): MatterLogLevel {
  switch (level) {
    case LogLevel.DEBUG:
      return MatterLogLevel.DEBUG;
    case LogLevel.INFO:
      return MatterLogLevel.INFO;
    case LogLevel.NOTICE:
      return MatterLogLevel.NOTICE;
    case LogLevel.WARN:
      return MatterLogLevel.WARN;
    case LogLevel.ERROR:
      return MatterLogLevel.ERROR;
    default:
      return MatterLogLevel.FATAL;
  }
}

/**
 * Sets up the matterbridge file logger and routes the matter.js log messages to the matter logger.
 *
 * @param {SharedMatterbridge} matterbridge - The matterbridge object containing the log levels, the file logger flags and the directory information.
 * @param {AnsiLogger} log - The matterbridge logger.
 * @param {AnsiLogger} matterLog - The logger used to show the matter.js log messages.
 * @param {boolean} verbose - Whether to log the resulting logger configuration.
 */
export function setupLoggers(matterbridge: SharedMatterbridge, log: AnsiLogger, matterLog: AnsiLogger, verbose: boolean): void {
  // Setup the matterbridge logger
  if (matterbridge.fileLogger) {
    AnsiLogger.setGlobalLogfile(path.join(matterbridge.matterbridgeDirectory, MATTERBRIDGE_LOGGER_FILE), matterbridge.logLevel);
  }

  // Setup the matter logger
  Logger.destinations.default.write = createDestinationMatterLogger(matterbridge, log, matterLog);

  if (verbose) {
    log.debug(`Matterbridge logLevel: ${log.logLevel} fileLogger: ${matterbridge.fileLogger}.`);
    log.debug(`Matter logLevel: ${matterLog.logLevel} fileLogger: ${matterbridge.matterFileLogger}.`);
  }
}

/**
 * Creates a MatterLogger function to show the matter.js log messages in AnsiLogger (console and frontend).
 * It also logs to file (matter.log) if matterFileLogger is true.
 *
 * @param {SharedMatterbridge} matterbridge - The matterbridge object containing the matter file logger flag and the directory information.
 * @param {AnsiLogger} log - The matterbridge logger, used to report a message that cannot be logged.
 * @param {AnsiLogger} matterLog - The logger used to show the matter.js log messages.
 *
 * @returns {(text: string, message: Diagnostic.Message) => void} The MatterLogger function to be used in Logger.destinations.default.write.
 */
export function createDestinationMatterLogger(matterbridge: SharedMatterbridge, log: AnsiLogger, matterLog: AnsiLogger): (text: string, message: Diagnostic.Message) => void {
  if (matterbridge.matterFileLogger) {
    matterLog.logFilePath = path.join(matterbridge.matterbridgeDirectory, MATTER_LOGGER_FILE);
  }

  return (text: string, message: Diagnostic.Message) => {
    try {
      let msg: string;
      if (Logger.format === MatterLogFormat.ANSI) {
        msg = text.slice(65);
      } else {
        msg = text.split(message.facility)[1]?.trim();
      }
      matterLog.logName = message.facility;
      matterLog.log(matterToAnsiLogLevel(message.level), msg);
    } catch (_error) {
      log.debug(`Error parsing matter log message facility ${message.facility}`);
    }
  };
}
