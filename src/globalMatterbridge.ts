/* eslint-disable no-var */
import type { Matterbridge } from './matterbridge.js';
import type { Frontend } from './frontend.js';
import type { AnsiLogger } from 'node-ansi-logger';

// Augmenting the globalThis type for typed global variables
declare global {
  var __matterbridge__: Matterbridge | undefined;
  var __frontend__: Frontend | undefined;
  var __log__: AnsiLogger | undefined;
}

/**
 * Store the Matterbridge instance globally for later retrieval.
 * @param {Matterbridge} matterbridge An initialized Matterbridge instance
 */
export function setGlobalMatterbridge(matterbridge: Matterbridge): void {
  globalThis.__matterbridge__ = matterbridge;
  globalThis.__frontend__ = matterbridge.frontend;
  globalThis.__log__ = matterbridge.log;
}

/**
 * Retrieve the globally stored Matterbridge instance.
 * @returns {Matterbridge} The Matterbridge instance.
 * @throws {Error} If the Matterbridge instance is not set.
 */
export function getGlobalMatterbridge(): Matterbridge {
  if (!globalThis.__matterbridge__) {
    throw new Error('Global Matterbridge instance is not set.');
  }
  return globalThis.__matterbridge__;
}

/**
 * Retrieve the globally stored Frontend instance.
 * @returns {Frontend} The Frontend instance.
 * @throws {Error} If the Frontend instance is not set.
 */
export function getGlobalFrontend(): Frontend {
  if (!globalThis.__frontend__) {
    throw new Error('Global Frontend instance is not set.');
  }
  return globalThis.__frontend__;
}

/**
 * Retrieve the globally stored Logger instance.
 * @returns {AnsiLogger} The AnsiLogger instance.
 * @throws {Error} If the Logger instance is not set.
 */
export function getGlobalLog(): AnsiLogger {
  if (!globalThis.__log__) {
    throw new Error('Global Logger instance is not set.');
  }
  return globalThis.__log__;
}
