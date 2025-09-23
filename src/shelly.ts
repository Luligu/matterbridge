/**
 * This file contains the shelly api functions.
 *
 * @file shelly.ts
 * @author Luca Liguori
 * @created 2025-02-19
 * @version 1.1.0
 * @license Apache-2.0
 *
 * Copyright 2025, 2026, 2027 Luca Liguori.
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

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { RequestOptions } from 'node:http';

import { debugStringify } from 'node-ansi-logger';

import { Matterbridge } from './matterbridge.js';

let verifyIntervalSecs = 15;
let verifyTimeoutSecs = 600;

/**
 * Sets the interval for verification in seconds.
 *
 * @param {number} seconds - The interval in seconds.
 * @returns {void}
 */
export function setVerifyIntervalSecs(seconds: number): void {
  verifyIntervalSecs = seconds;
}

/**
 * Sets the timeout for verification in seconds.
 *
 * @param {number} seconds - The timeout in seconds.
 * @returns {void}
 */
export function setVerifyTimeoutSecs(seconds: number): void {
  verifyTimeoutSecs = seconds;
}

/**
 * Fetches Shelly system updates. If available: logs the result, sends a snackbar message, and broadcasts the message.
 *
 * @param {Matterbridge} matterbridge - The Matterbridge instance.
 * @returns {Promise<void>} A promise that resolves when the operation is complete.
 */
export async function getShellySysUpdate(matterbridge: Matterbridge): Promise<void> {
  try {
    const updates = (await getShelly('/api/updates/sys/check')) as { name: string }[];
    if (updates.length === 0) return;

    matterbridge.matterbridgeInformation.shellySysUpdate = true;
    matterbridge.frontend.wssBroadcastMessage({ id: 0, src: 'Matterbridge', dst: 'Frontend', method: 'shelly_sys_update', success: true, response: { available: true } });
    for (const { name } of updates) {
      if (!name) continue;
      matterbridge.log.notice(`Shelly system update available: ${name}`);
      matterbridge.frontend.wssSendSnackbarMessage(`Shelly system update available: ${name}`, 10);
    }
  } catch (err) {
    matterbridge.log.error(`Error getting Shelly system updates: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Triggers Shelly system updates.
 *
 * @param {Matterbridge} matterbridge - The Matterbridge instance.
 * @returns {Promise<void>} A promise that resolves when the operation is complete.
 */
export async function triggerShellySysUpdate(matterbridge: Matterbridge): Promise<void> {
  try {
    // Trigger the update request
    await getShelly('/api/updates/sys/perform');
    matterbridge.log.notice('Installing Shelly system update...');
    matterbridge.matterbridgeInformation.shellySysUpdate = false;
    matterbridge.frontend.wssSendSnackbarMessage('Installing Shelly system update...', 15);
    matterbridge.frontend.wssBroadcastMessage({ id: 0, src: 'Matterbridge', dst: 'Frontend', method: 'shelly_sys_update', success: true, response: { available: false } });

    // Begin polling update status
    await verifyShellyUpdate(matterbridge, '/api/updates/sys/status', 'Shelly system update');
  } catch (err) {
    matterbridge.log.error(`Error triggering Shelly system update: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Fetches Shelly main updates. If available: logs the result, sends a snackbar message, and broadcasts the message.
 *
 * @param {Matterbridge} matterbridge - The Matterbridge instance.
 * @returns {Promise<void>} A promise that resolves when the operation is complete.
 */
export async function getShellyMainUpdate(matterbridge: Matterbridge): Promise<void> {
  try {
    const updates = (await getShelly('/api/updates/main/check')) as { name: string }[];
    if (updates.length === 0) return;

    matterbridge.matterbridgeInformation.shellyMainUpdate = true;
    matterbridge.frontend.wssBroadcastMessage({ id: 0, src: 'Matterbridge', dst: 'Frontend', method: 'shelly_main_update', success: true, response: { available: true } });
    for (const { name } of updates) {
      if (!name) continue;
      matterbridge.log.notice(`Shelly software update available: ${name}`);
      matterbridge.frontend.wssSendSnackbarMessage(`Shelly software update available: ${name}`, 10);
    }
  } catch (err) {
    matterbridge.log.error(`Error getting Shelly main updates: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Triggers Shelly main updates.
 *
 * @param {Matterbridge} matterbridge - The Matterbridge instance.
 * @returns {Promise<void>} A promise that resolves when the operation is complete.
 */
export async function triggerShellyMainUpdate(matterbridge: Matterbridge): Promise<void> {
  try {
    // Trigger the perform-update request
    await getShelly('/api/updates/main/perform');
    matterbridge.log.notice('Installing Shelly software update...');
    matterbridge.matterbridgeInformation.shellyMainUpdate = false;
    matterbridge.frontend.wssSendSnackbarMessage('Installing Shelly software update...', 15);
    matterbridge.frontend.wssBroadcastMessage({ id: 0, src: 'Matterbridge', dst: 'Frontend', method: 'shelly_main_update', success: true, response: { available: false } });

    // Begin polling the update status
    await verifyShellyUpdate(matterbridge, '/api/updates/main/status', 'Shelly software update');
  } catch (err) {
    matterbridge.log.error(`Error triggering Shelly main update: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Verifies Shelly update.
 *
 * @param {Matterbridge} matterbridge - The Matterbridge instance.
 * @param {string} api - The api to call: /api/updates/sys/status or /api/updates/main/status
 * @param {string} name - The name of the update.
 * @returns {Promise<void>} A promise that resolves when the operation is complete.
 */
export async function verifyShellyUpdate(matterbridge: Matterbridge, api: string, name: string): Promise<void> {
  return new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      matterbridge.log.error(`${name} check timed out`);
      matterbridge.frontend.wssSendCloseSnackbarMessage(`${name} in progress...`);
      clearInterval(interval);
      resolve();
    }, verifyTimeoutSecs * 1000); // 10 minutes
    const interval = setInterval(() => {
      getShelly(api, 10 * 1000) // 10 seconds
        .then(async (data: { updatingInProgress: boolean }) => {
          if (data.updatingInProgress) {
            matterbridge.log.debug(`${name} in progress...`);
            matterbridge.frontend.wssSendSnackbarMessage(`${name} in progress...`, 0);
          } else {
            matterbridge.log.notice(`${name} installed`);
            matterbridge.frontend.wssSendCloseSnackbarMessage(`${name} in progress...`);
            matterbridge.frontend.wssSendSnackbarMessage(`${name} installed`, 20);
            clearInterval(interval);
            clearTimeout(timeout);
            resolve();
          }
          return;
        })
        .catch((error) => {
          matterbridge.log.error(`Error getting status of ${name}: ${error instanceof Error ? error.message : String(error)}`);
          matterbridge.frontend.wssSendCloseSnackbarMessage(`${name} in progress...`);
          clearInterval(interval);
          clearTimeout(timeout);
          resolve();
        });
    }, verifyIntervalSecs * 1000); // 15 seconds
  });
}

/**
 * Triggers Shelly change network configuration.
 *
 * @param {Matterbridge} matterbridge - The Matterbridge instance.
 * @param {object} config - The network configuration.
 * @param {string} config.type - The type of network configuration, either 'static' or 'dhcp'.
 * @param {string} config.ip - The IP address to set (required for static configuration).
 * @param {string} config.subnet - The subnet mask to set (required for static configuration).
 * @param {string} config.gateway - The gateway to set (required for static configuration).
 * @param {string} config.dns - The DNS server to set (required for static configuration).
 * @returns {Promise<void>} A promise that resolves when the operation is complete.
 */
export async function triggerShellyChangeIp(matterbridge: Matterbridge, config: { type: 'static' | 'dhcp'; ip: string; subnet: string; gateway: string; dns: string }): Promise<void> {
  const api = config.type === 'static' ? '/api/network/connection/static' : '/api/network/connection/dynamic';
  const data: { interface: string; addr?: string; mask?: string; gw?: string; dns?: string } = { interface: 'end0' };
  if (config.type === 'static') {
    data['addr'] = config.ip;
    data['mask'] = config.subnet;
    data['gw'] = config.gateway;
    data['dns'] = config.dns;
  }

  matterbridge.log.debug(`Triggering Shelly network configuration change: ${debugStringify(config)}`);
  try {
    await postShelly(api, data);
    matterbridge.log.debug(`Triggered Shelly network configuration change: ${debugStringify(config)}`);
    matterbridge.log.notice(`Changed Shelly network configuration`);
    matterbridge.frontend.wssSendSnackbarMessage('Changed Shelly network configuration');
  } catch (error) {
    matterbridge.log.debug(`****Error triggering Shelly network configuration change ${debugStringify(config)}: ${error instanceof Error ? error.message : String(error)}`);
    matterbridge.log.error(`Error changing Shelly network configuration: ${error instanceof Error ? error.message : String(error)}`);
    matterbridge.frontend.wssSendSnackbarMessage('Error changing Shelly network configuration', 10, 'error');
  }
}

/**
 * Triggers Shelly system reboot.
 *
 * @param {Matterbridge} matterbridge - The Matterbridge instance.
 * @returns {Promise<void>} A promise that resolves when the operation is complete.
 */
export async function triggerShellyReboot(matterbridge: Matterbridge): Promise<void> {
  matterbridge.log.debug(`Triggering Shelly system reboot`);
  try {
    matterbridge.frontend.wssSendSnackbarMessage('Rebooting Shelly board...', 0);
    await postShelly('/api/system/reboot', {});
    matterbridge.log.debug(`Triggered Shelly system reboot`);
    matterbridge.log.notice(`Rebooting Shelly board...`);
    matterbridge.frontend.wssSendCloseSnackbarMessage('Rebooting Shelly board...');
    matterbridge.frontend.wssSendSnackbarMessage('Reboot of Shelly board started!', 5, 'success');
  } catch (error) {
    matterbridge.log.debug(`****Error triggering Shelly system reboot: ${error instanceof Error ? error.message : String(error)}`);
    matterbridge.log.error(`Error rebooting Shelly board: ${error instanceof Error ? error.message : String(error)}`);
    matterbridge.frontend.wssSendCloseSnackbarMessage('Rebooting Shelly board...');
    matterbridge.frontend.wssSendSnackbarMessage('Error rebooting Shelly board', 10, 'error');
  }
}

/**
 * Triggers Shelly soft reset.
 * It will replaces network config with the default one (edn0 on dhcp).
 *
 * @param {Matterbridge} matterbridge - The Matterbridge instance.
 * @returns {Promise<void>} A promise that resolves when the operation is complete.
 */
export async function triggerShellySoftReset(matterbridge: Matterbridge): Promise<void> {
  matterbridge.log.debug(`Triggering Shelly soft reset`);
  try {
    matterbridge.frontend.wssSendSnackbarMessage('Resetting the network parameters on Shelly board...', 0);
    await getShelly('/api/reset/soft');
    matterbridge.log.debug(`Triggered Shelly soft reset`);
    matterbridge.log.notice(`Resetting the network parameters on Shelly board...`);
    matterbridge.frontend.wssSendCloseSnackbarMessage('Resetting the network parameters on Shelly board...');
    matterbridge.frontend.wssSendSnackbarMessage('Reset of the network parameters on Shelly board done!', 5, 'success');
  } catch (error) {
    matterbridge.log.debug(`****Error triggering Shelly soft reset: ${error instanceof Error ? error.message : String(error)}`);
    matterbridge.log.error(`Error resetting the network parameters on Shelly board: ${error instanceof Error ? error.message : String(error)}`);
    matterbridge.frontend.wssSendCloseSnackbarMessage('Resetting the network parameters on Shelly board...');
    matterbridge.frontend.wssSendSnackbarMessage('Error resetting the network parameters on Shelly board', 10, 'error');
  }
}
/**
 * Triggers Shelly hard reset.
 * It will do a hard reset and will remove both directories .matterbridge Matterbridge.
 *
 * @param {Matterbridge} matterbridge - The Matterbridge instance.
 * @returns {Promise<void>} A promise that resolves when the operation is complete.
 */
export async function triggerShellyHardReset(matterbridge: Matterbridge): Promise<void> {
  matterbridge.log.debug(`Triggering Shelly hard reset`);
  try {
    matterbridge.frontend.wssSendSnackbarMessage('Factory resetting Shelly board...', 0);
    await getShelly('/api/reset/hard');
    matterbridge.log.debug(`Triggered Shelly hard reset`);
    matterbridge.log.notice(`Factory resetting Shelly board...`);
    matterbridge.frontend.wssSendCloseSnackbarMessage('Factory resetting Shelly board...');
    matterbridge.frontend.wssSendSnackbarMessage('Factory reset of Shelly board done!', 5, 'success');
  } catch (error) {
    matterbridge.log.debug(`****Error triggering Shelly hard reset: ${error instanceof Error ? error.message : String(error)}`);
    matterbridge.log.error(`Error while factory resetting the Shelly board: ${error instanceof Error ? error.message : String(error)}`);
    matterbridge.frontend.wssSendCloseSnackbarMessage('Factory resetting Shelly board...');
    matterbridge.frontend.wssSendSnackbarMessage('Error while factory resetting the Shelly board', 10, 'error');
  }
}

/**
 * Fetches Shelly system log and write it to shelly.log.
 *
 * @param {Matterbridge} matterbridge - The Matterbridge instance.
 * @returns {Promise<boolean>}  A promise that resolves to true if the log was successfully downloaded, false otherwise.
 */
export async function createShellySystemLog(matterbridge: Matterbridge): Promise<boolean> {
  const { promises: fs } = await import('node:fs');
  const path = await import('node:path');

  matterbridge.log.debug(`Downloading Shelly system log...`);
  try {
    const data = await getShelly('/api/logs/system');
    await fs.writeFile(path.join(matterbridge.matterbridgeDirectory, 'shelly.log'), data);
    matterbridge.log.notice(`Shelly system log ready for download`);
    matterbridge.frontend.wssSendSnackbarMessage('Shelly system log ready for download');
    return true;
  } catch (error) {
    matterbridge.log.error(`Error getting Shelly system log: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

/**
 * Perform a GET to Shelly board apis.
 *
 * @param {string} api - The api to call:
 *
 *      /api/updates/sys/check => [{name:string; ...}]
 *      /api/updates/sys/perform => {"updatingInProgress":true} or {"updatingInProgress":false}
 *      /api/updates/sys/status => {"updatingInProgress":true} or {"updatingInProgress":false}
 *      /api/updates/main/check => [{name:string; ...}]
 *      /api/updates/main/perform => {"updatingInProgress":true} or {"updatingInProgress":false}
 *      /api/updates/main/status  => {"updatingInProgress":true} or {"updatingInProgress":false}
 *
 *      /api/logs/system => text
 *
 *      /api/reset/soft => "ok"                 Replaces network config with default one (edn0 on dhcp)
 *      /api/reset/hard => reboot on success    Hard reset makes soft reset + removing both directories .matterbridge Matterbridge + reboot
 *
 *
 * @param {number} [timeout] - The timeout duration in milliseconds (default is 60000ms).
 * @returns {Promise<any>} A promise that resolves to the response.
 * @throws {Error} If the request fails.
 */
export async function getShelly(api: string, timeout = 60000): Promise<any> {
  const http = await import('node:http');
  return new Promise((resolve, reject) => {
    const url = `http://127.0.0.1:8101${api}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error(`Request timed out after ${timeout / 1000} seconds`));
    }, timeout).unref();

    const req = http.get(url, { signal: controller.signal }, (res) => {
      let data = '';

      if (res.statusCode !== 200) {
        clearTimeout(timeoutId);
        res.resume(); // Discard response data to close the socket properly
        req.destroy(); // Forcefully close the request
        reject(new Error(`Failed to fetch data. Status code: ${res.statusCode}`));
        return;
      }

      res.on('data', (chunk) => {
        // console.log(chunk);
        data += chunk;
      });

      res.on('end', () => {
        clearTimeout(timeoutId);
        if (api !== '/api/logs/system') {
          try {
            const jsonData = JSON.parse(data);
            resolve(jsonData);
          } catch (error) {
            reject(new Error(`Failed to parse response JSON: ${error instanceof Error ? error.message : error}`));
          }
        } else {
          // console.log(data);
          resolve(data);
        }
      });
    });

    req.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(new Error(`Request failed: ${error instanceof Error ? error.message : error}`));
    });
  });
}

/**
 * Perform a POST request to Shelly board apis.
 *
 * @param {string} api - The api to call:
 *
 *     Set static ip
 *     /api/network/connection/static -d '{"interface": "end0", "addr": "10.11.12.101", "mask": "255.255.255.0", "gw": "10.11.12.1", "dns": "1.1.1.1"}' => {}
 *
 *     Set dhcp
 *     /api/network/connection/dynamic -d '{"interface": "end0"}' => {}
 *
 *     Reboot
 *     /api/system/reboot => {"success":true}
 *
 *     curl -H "Content-Type: application/json" -X POST http://127.0.0.1:8101/api/network/connection/dynamic
 *        -d '{"interface": "end0"}'
 *
 *     curl -H "Content-Type: application/json" -X POST http://127.0.0.1:8101/api/network/connection/static
 *        -d '{"interface": "end0", "addr": "192.168.1.64", "mask": "255.255.255.0", "gw": "192.168.1.1", "dns": "192.168.1.1"}'
 *
 * @param {any} data - The data to send in the POST request, typically a JSON object.
 * @param {number} [timeout] - The timeout duration in milliseconds (default is 60000ms).
 * @returns {Promise<any>} A promise that resolves to the response.
 * @throws {Error} If the request fails.
 */
export async function postShelly(api: string, data: any, timeout = 60000): Promise<any> {
  const http = await import('node:http');
  return new Promise((resolve, reject) => {
    const url = `http://127.0.0.1:8101${api}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error(`Request timed out after ${timeout / 1000} seconds`));
    }, timeout).unref();

    const jsonData = JSON.stringify(data);
    const options: RequestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(jsonData),
      },
      signal: controller.signal,
    };

    const req = http.request(url, options, (res) => {
      let responseData = '';

      // Check for non-success status codes (e.g., 300+)
      if (res.statusCode && res.statusCode >= 300) {
        clearTimeout(timeoutId);
        res.resume(); // Discard response data to free up memory
        req.destroy(); // Close the request
        return reject(new Error(`Failed to post data. Status code: ${res.statusCode}`));
      }

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        clearTimeout(timeoutId);
        try {
          const jsonResponse = JSON.parse(responseData);
          resolve(jsonResponse);
        } catch (err) {
          reject(new Error(`Failed to parse response JSON: ${err instanceof Error ? err.message : err}`));
        }
      });
    });

    req.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(new Error(`Request failed: ${error instanceof Error ? error.message : error}`));
    });

    // Send the JSON data
    req.write(jsonData);
    req.end();
  });
}
