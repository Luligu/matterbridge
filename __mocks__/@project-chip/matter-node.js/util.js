/**
 * @license
 * Copyright 2022-2024 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */
import { ValidationError } from '@project-chip/matter.js/common';
import { execSync } from 'child_process';
function getParameter(name) {
  const commandArguments = process.argv.slice(2);
  let markerIndex = commandArguments.indexOf(`-${name}`);
  if (markerIndex === -1) markerIndex = commandArguments.indexOf(`--${name}`);
  if (markerIndex === -1 || markerIndex + 1 === commandArguments.length) return void 0;
  return commandArguments[markerIndex + 1];
}
function hasParameter(name) {
  const commandArguments = process.argv.slice(2);
  let markerIncluded = commandArguments.includes(`-${name}`);
  if (!markerIncluded) markerIncluded = commandArguments.includes(`--${name}`);
  return markerIncluded;
}
function getIntParameter(name) {
  const value = getParameter(name);
  if (value === void 0) return void 0;
  const intValue = parseInt(value, 10);
  if (isNaN(intValue)) throw new ValidationError(`Invalid value for parameter ${name}: ${value} is not a number`);
  return intValue;
}
function commandExecutor(scriptParamName) {
  const script = getParameter(scriptParamName);
  if (script === void 0) return void 0;
  // eslint-disable-next-line no-console
  return () => console.log(`${scriptParamName}: ${execSync(script).toString().slice(0, -1)}`);
}
function requireMinNodeVersion(minVersion) {
  const version = process.versions.node;
  const versionMajor = parseInt(version.split('.')[0]);
  if (versionMajor < minVersion) throw new MatterError(`Node version ${versionMajor} is not supported. Please upgrade to ${minVersion} or above.`);
}
export { commandExecutor, getIntParameter, getParameter, hasParameter, requireMinNodeVersion };
export * from '@project-chip/matter.js/util';
// # sourceMappingURL=CommandLine.js.map
