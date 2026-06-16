/**
 * @description Thread package entrypoint exports.
 * @file src/export.ts
 * @author Luca Liguori
 * @created 2026-03-04
 * @version 1.0.0
 * @license Apache-2.0
 */

export * from './broadcastServer.js';
export * from './threadsManager.js';
/**
 * Export the systemCheck thread module.
 */
// istanbul ignore next
// oxlint-disable-next-line typescript/explicit-function-return-type typescript/explicit-module-boundary-types
export async function systemCheck() {
  await import('./workerSystemCheck.js');
}
