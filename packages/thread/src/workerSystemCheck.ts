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

import os from 'node:os';

import { inspectError } from '@matterbridge/utils/error';
import { excludedInterfaceNamePattern } from '@matterbridge/utils/network';
import { LogLevel } from 'node-ansi-logger';

import { WorkerWrapper } from './workerWrapper.js';

new WorkerWrapper('SystemCheck', async (worker) => {
  worker.logger(LogLevel.INFO, `Starting system check...`);
  let success = false;
  try {
    // Fetch SharedMatterbridge data from the main thread
    const shared = (await worker.server.fetch({ type: 'matterbridge_shared', src: `matterbridge`, dst: 'matterbridge' }, 1000)).result.data;

    /* Check Node.Js version */
    // prettier-ignore
    if (process.env.NVM_BIN && process.env.NVM_DIR) worker.logger(LogLevel.ERROR, `NVM is a development tool and is not supported in production. Please install node from https://github.com/nodesource/distributions.`);
    const nodeVersion = process.versions.node;
    const versionMajor = parseInt(nodeVersion.split('.')[0]);
    const versionMinor = parseInt(nodeVersion.split('.')[1]);
    const versionPatch = parseInt(nodeVersion.split('.')[2]);
    worker.logger(LogLevel.DEBUG, `Node.js Version: ${versionMajor}.${versionMinor}.${versionPatch}`);
    if (versionMajor === 20 && versionMinor < 19) worker.logger(LogLevel.ERROR, `Node.js version < 20.19.0 is not supported. Please upgrade to Node.js LTS version (24.x).`);
    if (versionMajor === 22 && versionMinor < 13) worker.logger(LogLevel.ERROR, `Node.js version < 22.13.0 is not supported. Please upgrade to Node.js LTS version (24.x).`);
    // prettier-ignore
    if (versionMajor === 21 || versionMajor === 23 || versionMajor === 25) worker.logger(LogLevel.ERROR, `Node.js odd major versions are not supported. Please upgrade to Node.js LTS version (24.x).`);
    // prettier-ignore
    if (versionMajor !== 24) worker.logger(LogLevel.NOTICE, `You are running Node.js ${versionMajor}.${versionMinor}.${versionPatch}. Please consider upgrading to Node.js LTS version (24.x).`);

    /* Check network interface */
    const networkInterfaces = os.networkInterfaces();
    let foundInternal = false;
    let foundExternal = false;
    let foundIpv4 = false;
    let foundIpv6 = false;
    for (const [interfaceName, interfaceDetails] of Object.entries(networkInterfaces)) {
      // prettier-ignore
      if (!shared.mdnsInterface && excludedInterfaceNamePattern.test(interfaceName)) worker.logger(LogLevel.WARN, `Found network interface '${interfaceName}'. Please use --mdnsinterface parameter to specify the correct local interface for mDNS.`);
      if (excludedInterfaceNamePattern.test(interfaceName)) continue;
      for (const detail of interfaceDetails || []) {
        if (detail.internal) foundInternal = true;
        if (!detail.internal) foundExternal = true;
        if (detail.family === 'IPv4' && !detail.internal && foundIpv4 === false) foundIpv4 = true;
        if (detail.family === 'IPv6' && !detail.internal && foundIpv6 === false) foundIpv6 = true;
      }
    }
    if (!foundInternal) worker.logger(LogLevel.ERROR, `No internal network interface found. Check your network configuration.`);
    if (!foundExternal) worker.logger(LogLevel.ERROR, `No external network interface found. Check your network configuration.`);
    if (!foundIpv4) worker.logger(LogLevel.ERROR, `No IPv4 network interface found. Check your network configuration.`);
    if (!foundIpv6) worker.logger(LogLevel.ERROR, `No IPv6 network interface found. Check your network configuration.`);

    worker.logger(LogLevel.INFO, `System check succeeded`);
    success = true;
  } catch (error) {
    const errorMessage = inspectError(worker.log, `Failed to perform system check`, error);
    worker.logger(LogLevel.ERROR, errorMessage);
  }
  return success;
});
