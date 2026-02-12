/**
 * This file contains the workerSystemCheck thread.
 *
 * @file workerSystemCheck.ts
 * @author Luca Liguori
 * @created 2026-02-12
 * @version 1.0.0
 * @license Apache-2.0
 *
 * Copyright 2026, 2027, 2028 Luca Liguori.
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

import { threadId, isMainThread, parentPort, workerData } from 'node:worker_threads';
import os from 'node:os';

import { AnsiLogger, LogLevel, MAGENTA, TimestampFormat } from 'node-ansi-logger';
import { hasParameter, inspectError, excludedInterfaceNamePattern } from '@matterbridge/utils';

import { logWorkerInfo, parentLog, parentPost, threadLogger } from './worker.js';
import { BroadcastServer } from './broadcastServer.js';

const debug = hasParameter('debug') || hasParameter('verbose') || hasParameter('debug-worker') || hasParameter('verbose-worker');
const verbose = hasParameter('verbose') || hasParameter('verbose-worker');
const name = 'MatterbridgeSystemCheck';

// Send init message
if (!isMainThread && parentPort) {
  parentPost({ type: 'init', threadId, threadName: workerData.threadName, success: true });
  if (debug) parentLog(name, LogLevel.INFO, `Worker ${workerData.threadName}:${threadId} initialized.`);
}

// Broadcast server
const log = new AnsiLogger({
  logName: name,
  logNameColor: MAGENTA,
  logTimestampFormat: TimestampFormat.TIME_MILLIS,
  logLevel: debug ? LogLevel.DEBUG : LogLevel.INFO,
});
const server = new BroadcastServer('matterbridge', log);

// Log worker info
if (verbose) logWorkerInfo(log, verbose);

threadLogger(name, LogLevel.INFO, `Starting system check...`);
let success = false;
try {
  // Fetch SharedMatterbridge data from the main thread
  const shared = (await server.fetch({ type: 'matterbridge_shared', src: `matterbridge`, dst: 'matterbridge' }, 1000)).result.data;

  /* Check Node.Js version */
  // prettier-ignore
  if (process.env.NVM_BIN && process.env.NVM_DIR) threadLogger(name, LogLevel.ERROR, `NVM is a development tool and is not supported in production. Please install node from https://github.com/nodesource/distributions.`);
  const nodeVersion = process.versions.node;
  const versionMajor = parseInt(nodeVersion.split('.')[0]);
  const versionMinor = parseInt(nodeVersion.split('.')[1]);
  const versionPatch = parseInt(nodeVersion.split('.')[2]);
  threadLogger(name, LogLevel.DEBUG, `Node.js Version: ${versionMajor}.${versionMinor}.${versionPatch}`);
  if (versionMajor === 20 && versionMinor < 19) threadLogger(name, LogLevel.ERROR, `Node.js version < 20.19.0 is not supported. Please upgrade to Node.js LTS version (24.x).`);
  if (versionMajor === 22 && versionMinor < 13) threadLogger(name, LogLevel.ERROR, `Node.js version < 22.13.0 is not supported. Please upgrade to Node.js LTS version (24.x).`);
  // prettier-ignore
  if (versionMajor === 21 || versionMajor === 23 || versionMajor === 25) threadLogger(name, LogLevel.ERROR, `Node.js odd major versions are not supported. Please upgrade to Node.js LTS version (24.x).`);
  // prettier-ignore
  if (versionMajor !== 24) threadLogger(name, LogLevel.NOTICE, `You are running Node.js ${versionMajor}.${versionMinor}.${versionPatch}. Please consider upgrading to Node.js LTS version (24.x).`);

  /* Check network interface */
  const networkInterfaces = os.networkInterfaces();
  let foundInternal = false;
  let foundExternal = false;
  let foundIpv4 = false;
  let foundIpv6 = false;
  for (const [interfaceName, interfaceDetails] of Object.entries(networkInterfaces)) {
    // prettier-ignore
    if (!shared.mdnsInterface && excludedInterfaceNamePattern.test(interfaceName)) threadLogger(name, LogLevel.WARN, `Found network interface '${interfaceName}'. Please use --mdnsinterface parameter to specify the correct local interface for mDNS.`);
    if (excludedInterfaceNamePattern.test(interfaceName)) continue;
    for (const detail of interfaceDetails || []) {
      if (detail.internal) foundInternal = true;
      if (!detail.internal) foundExternal = true;
      if (detail.family === 'IPv4' && !detail.internal && foundIpv4 === false) foundIpv4 = true;
      if (detail.family === 'IPv6' && !detail.internal && foundIpv6 === false) foundIpv6 = true;
    }
  }
  if (!foundInternal) threadLogger(name, LogLevel.ERROR, `No internal network interface found. Check your network configuration.`);
  if (!foundExternal) threadLogger(name, LogLevel.ERROR, `No external network interface found. Check your network configuration.`);
  if (!foundIpv4) threadLogger(name, LogLevel.ERROR, `No IPv4 network interface found. Check your network configuration.`);
  if (!foundIpv6) threadLogger(name, LogLevel.ERROR, `No IPv6 network interface found. Check your network configuration.`);

  threadLogger(name, LogLevel.INFO, `System check succeeded`);
  success = true;
} catch (error) {
  const errorMessage = inspectError(log, `Failed to perform system check`, error);
  threadLogger(name, LogLevel.ERROR, errorMessage);
}

// Close the broadcast server
server.close();

// Send exit message
if (!isMainThread && parentPort) {
  parentPost({ type: 'exit', threadId, threadName: workerData.threadName, success });
  if (debug) parentLog(name, LogLevel.INFO, `Worker ${workerData.threadName}:${threadId} exiting with success: ${success}.`);
}
